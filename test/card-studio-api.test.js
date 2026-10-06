const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function studio(dependencies={}){
 const context={module:{exports:{}},structuredClone,Blob,ArrayBuffer};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/card-studio-api'),'utf8'),context);
 const api=context.module.exports;
 api.configure({
  dataStream:{build:input=>({schema:'phi.card-data/v1',...input})},
  cardBack:{formatFor:data=>data.subjectType==='movie'?'story':'bio'},
  services:null,render:null,...dependencies
 });
 return api;
}
const image='data:image/png;base64,RlJPTlQ=';
const backImage='data:image/png;base64,QkFDSw==';

test('browser UMD exports OracleCardStudio without requiring a browser pipeline',()=>{
 const context={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/card-studio-api'),'utf8'),context);
 assert.equal(typeof context.OracleCardStudio.buildCard,'function');
 assert.equal(context.OracleCardStudio.capabilities().build.status,'unavailable');
});

test('buildRequest delegates and isolates input and returned normalized data',()=>{
 let calls=0,normalized;
 const api=studio({dataStream:{build(input){
  calls++;input.identity.title='Normalized';
  return normalized={...input,evidence:{source:'printed-text'}};
 }}});
 const input={identity:{title:'Original'}};
 const result=api.buildRequest(input);
 assert.equal(calls,1);
 assert.equal(input.identity.title,'Original');
 assert.equal(result.schema,'phi.card-build-request/v1');
 assert.equal(result.cardData.identity.title,'Normalized');
 assert.equal(result.input.identity.title,'Original');
 result.cardData.evidence.source='changed';
 assert.equal(normalized.evidence.source,'printed-text');
 api.configure({dataStream:null});
 assert.throws(()=>api.buildRequest(input),{code:'card_data_stream_unavailable'});
});

test('buildCard rejects missing adapter, delegates once, and retains real output',async()=>{
 const api=studio();
 await assert.rejects(api.buildCard({}),{code:'build_adapter_unavailable'});
 let calls=0;
 api.configure({build:async request=>{
  calls++;
  assert.equal(request.schema,'phi.card-build-request/v1');
  assert.equal(request.cardData.schema,'phi.card-data/v1');
  return {id:'alpha',cardData:request.cardData,front:{image,templateId:'poster',renderPath:'existing-pipeline'},
   back:{image:backImage,data:{synopsis:'Verified description'}},
   build:{buildId:'real-build',createdAt:'2026-01-01',renderer:'observed-renderer',validation:{status:'reviewed'}}};
 }});
 const artifact=await api.buildCard({subject:'Film',subjectType:'movie'});
 assert.equal(calls,1);
 assert.equal(artifact.schema,'phi.card-artifact/v1');
 assert.equal(artifact.front.image,image);
 assert.equal(artifact.front.templateId,'poster');
 assert.equal(artifact.front.renderPath,'existing-pipeline');
 assert.equal(artifact.back.image,backImage);
 assert.equal(artifact.back.format,'story');
 assert.equal(artifact.back.data.synopsis,'Verified description');
 assert.equal(artifact.build.buildId,'real-build');
 assert.equal(artifact.build.renderer,'observed-renderer');
 assert.equal(artifact.build.createdAt,'2026-01-01');
 assert.equal(artifact.build.validation.status,'reviewed');
 assert.equal(api.getCardData('alpha').subject,'Film');
 assert.equal(api.capabilities().build.status,'healthy');
});

test('single-flight rejects overlap and configuration changes and recovers after failures',async()=>{
 const api=studio();
 let release,calls=0;
 api.configure({build:()=>{calls++;return new Promise(resolve=>{release=resolve})}});
 const pending=api.buildCard({subject:'One'});
 assert.equal(api.capabilities().build.busy,true);
 await assert.rejects(api.buildCard({subject:'Two'}),{code:'build_in_progress'});
 assert.throws(()=>api.configure({build:null}),{code:'build_in_progress'});
 assert.throws(()=>api.registerAdapter('other',{build:()=>{}}),{code:'build_in_progress'});
 release({front:{image}});
 await pending;
 assert.equal(calls,1);
 assert.equal(api.capabilities().build.busy,false);
 api.configure({build:async()=>{throw new Error('pipeline_failed')}});
 await assert.rejects(api.buildCard({}),/pipeline_failed/);
 assert.equal(api.capabilities().build.busy,false);
 assert.equal(api.capabilities().build.status,'degraded');
 api.configure({build:async()=>({})});
 await assert.rejects(api.buildCard({}),{code:'missing_front_image'});
 api.configure({build:async()=>({front:{image}})});
 assert.equal((await api.buildCard({})).front.image,image);
});

test('registered adapters are explicit and capability callbacks are delegated',async()=>{
 const api=studio();
 assert.equal(api.registerAdapter('existing-app',{build:async()=>({front:{image}}),
  capabilities:()=>({pipeline:{implemented:true,configured:true,healthy:'unknown'}})}),'existing-app');
 assert.equal(api.capabilities().build.configured,false);
 api.configure({adapter:'existing-app'});
 assert.equal(api.capabilities().build.adapter,'existing-app');
 assert.equal(api.capabilities().adapter.pipeline.healthy,'unknown');
 assert.equal((await api.buildCard({})).front.image,image);
 assert.throws(()=>api.configure({adapter:'absent'}),{code:'unknown_build_adapter'});
});

test('artifact metadata strips recursive image and binary payloads but preserves textual sources',()=>{
 const api=studio();
 const details={text:'Printed title',source:'image-reader',url:'https://example.com/source',
  image,payload:{huge:true},data:{evidence:image,title:'Film'},nested:[image,{imageData:image,text:'Caption'}],
  bytes:new Uint8Array([1,2]),blob:new Blob(['bytes']),photo:{image}};
 const artifact=api.recordArtifact({id:'metadata',front:{image},back:{image:backImage,data:details},
  evidence:details,sources:[details,'https://example.com/reference',image],
  provenance:{reader:details},build:{validation:details}});
 const serialized=JSON.stringify(artifact);
 assert.equal(serialized.split(image).length-1,1);
 assert.equal(serialized.split(backImage).length-1,1);
 for(const value of [artifact.evidence,artifact.provenance.reader,artifact.back.data,artifact.build.validation]){
  assert.equal(value.text,'Printed title');
  assert.equal(value.url,'https://example.com/source');
  assert.equal(value.data.title,'Film');
  assert.equal(value.image,undefined);
  assert.equal(value.payload,undefined);
  assert.equal(value.blob,undefined);
  assert.equal(value.data.evidence,undefined);
  assert.equal(value.nested.length,1);
  assert.equal(value.nested[0].text,'Caption');
 }
 assert.equal(artifact.sources.length,2);
});

test('recordArtifact and lookup return detached snapshots and unknown IDs return null',()=>{
 const api=studio();
 const output={id:'isolated',cardData:{subject:'Original',identity:{title:'Name'}},
  front:{image},evidence:{visibleText:['Original']}};
 const artifact=api.recordArtifact(output);
 output.cardData.identity.title='mutated input';
 artifact.evidence.visibleText[0]='mutated output';
 assert.equal(api.getArtifact('isolated').evidence.visibleText[0],'Original');
 const retrieved=api.getArtifact('isolated');
 retrieved.front.image='changed';
 assert.equal(api.getArtifact('isolated').front.image,image);
 const data=api.getCardData('isolated');
 data.identity.title='mutated lookup';
 assert.equal(api.getCardData('isolated').identity.title,'Name');
 assert.equal(api.getArtifact('missing'),null);
 assert.equal(api.getCardData('missing'),null);
});

test('UI can update a stored artifact back and an adapter can return the artifact itself',async()=>{
 const api=studio();
 const recorded=api.recordArtifact({id:42,setId:'collection',
  cardData:{cardId:'42',subject:'Actual pipeline result'},front:{image},
  back:{format:'bio',data:{subject:'Actual pipeline result'}}});
 assert.equal(recorded.id,'42');
 assert.equal(recorded.setId,'collection');
 recorded.back.image=backImage;
 api.recordArtifact(recorded);
 assert.equal(api.getCardData('42').subject,'Actual pipeline result');
 assert.equal(api.getArtifact('42').back.image,backImage);
 api.configure({build:async()=>api.getArtifact('42')});
 const returned=await api.buildCard({subject:'Initial request'});
 assert.equal(returned.id,'42');
 assert.equal(returned.setId,'collection');
 assert.equal(api.getCardData('42').subject,'Actual pipeline result');
});

test('variant captures sharing a buildId receive unique IDs and explicit updates retain identity',()=>{
 const api=studio();
 const output={cardData:{cardId:'',subject:'Variant'},setId:'shared-set',front:{image},
  back:{data:{subject:'Variant'},omittedFields:[{field:'facts[3]',reason:'space',image}]},
  build:{buildId:'shared-build'}};
 const first=api.recordArtifact(output),second=api.recordArtifact(output);
 assert.notEqual(first.id,second.id);
 for(const artifact of [first,second]){
  assert.equal(artifact.build.buildId,'shared-build');
  assert.equal(api.getCardData(artifact.id).cardId,artifact.id);
  assert.equal(api.getCardData(artifact.id).setId,'shared-set');
  assert.equal(artifact.back.data.cardId,artifact.id);
  assert.equal(artifact.back.data.setId,'shared-set');
  assert.equal(artifact.back.omittedFields[0].field,'facts[3]');
  assert.equal(artifact.back.omittedFields[0].image,undefined);
 }
 assert.equal(output.cardData.cardId,'');
 const update=api.recordArtifact({...first,back:{...first.back,image:backImage}});
 assert.equal(update.id,first.id);
 assert.equal(api.getArtifact(first.id).back.image,backImage);
 assert.equal(api.getArtifact(second.id).back.image,null);
});

test('capabilities report dependencies and observed service health without remote assumptions',()=>{
 const source={current:{
  workersImage:{implemented:true,configured:true,healthy:'unknown',endpoint:'/v1/image'},
  localComfy:{implemented:true,configured:'runtime-check',healthy:'unknown'},
  future:{implemented:false,configured:false,healthy:false}
 },requests:[]};
 const api=studio({services:{capabilities:()=>source}});
 let caps=api.capabilities();
 assert.equal(caps.id,'card-studio');
 assert.equal(caps.implemented,true);
 assert.equal(caps.tasks.join(','),'card,card-front,card-back,card-set,reference-card,advertising-card');
 assert.equal(caps.dependencies.imageRead.status,'unavailable');
 assert.equal(caps.dependencies.imageRender.healthy,'unknown');
 assert.equal(caps.dependencies.browserValidation.status,'unavailable');
 assert.equal(caps.dataStream.status,'configured');
 assert.equal(caps.render.status,'unavailable');
 assert.equal(caps.services.current.workersImage.status,'configured');
 assert.equal(caps.services.current.workersImage.healthy,'unknown');
 assert.equal(caps.services.current.localComfy.status,'unavailable');
 assert.equal(caps.services.current.future.status,'unavailable');
 source.requests.push({endpoint:'workersImage',ok:false});
 caps=api.capabilities();
 assert.equal(caps.services.current.workersImage.status,'degraded');
 source.requests.push({endpoint:'workersImage',ok:true});
 assert.equal(api.capabilities().services.current.workersImage.status,'healthy');
 caps.services.current.workersImage.endpoint='changed';
 assert.equal(source.current.workersImage.endpoint,'/v1/image');
 assert.equal(source.current.workersImage.healthy,'unknown');
 api.configure({dataStream:null,cardBack:null});
 assert.equal(api.capabilities().dataStream.implemented,false);
 assert.equal(api.capabilities().cardBack.status,'unavailable');
 api.configure({build:async()=>({front:{image}})});
 assert.equal(api.capabilities().dependencies.browserValidation.status,'configured');
 assert.equal(api.capabilities().dependencies.browserValidation.healthy,'unknown');
});

test('set manifest IDs are deterministic and independent of timestamps and object key order',()=>{
 const api=studio();
 const input={purpose:'collection',count:3,subjects:['Alpha','Beta','Gamma'],theme:{palette:['blue'],finish:'paper'}};
 const one=api.buildSetManifest({...input,createdAt:'2026-01-01'});
 const two=api.buildSetManifest({...input,theme:{finish:'paper',palette:['blue']},createdAt:'2027-02-03'});
 assert.equal(one.id,two.id);
 assert.equal(one.schema,'phi.card-set/v1');
 assert.equal(one.title,'Card Set');
 assert.equal(one.sources.length,0);
 assert.equal(one.cards[0].id,two.cards[0].id);
 assert.equal(one.createdAt,'2026-01-01');
 assert.equal(two.createdAt,'2027-02-03');
 assert.equal(new Set(one.cards.map(card=>card.id)).size,3);
 assert.equal(one.cards.map(card=>card.cardNumber).join(','),'1/3,2/3,3/3');
 assert.notEqual(api.buildSetManifest({...input,subjects:['Alpha','Beta','Delta']}).id,one.id);
 assert.equal(one.status,'pending');
 for(const card of one.cards){
  assert.equal(card.status,'pending');
  assert.equal(card.request.theme.palette[0],'blue');
  assert.equal(card.request.identity.cardNumber,card.cardNumber);
  assert.equal(card.front,undefined);
  assert.equal(card.artifact,undefined);
 }
 const sourced=api.buildSetManifest({title:'Film Studies',subjects:['A'],
  sources:[{title:'Studio',url:'https://example.com',image}]});
 assert.equal(sourced.title,'Film Studies');
 assert.equal(sourced.sources[0].url,'https://example.com');
 assert.equal(sourced.sources[0].image,undefined);
});

test('set numbering supports prefix and fraction, preserving per-card overrides and shared DNA',()=>{
 const api=studio();
 const manifest=api.buildSetManifest({purpose:'advertising',theme:{palette:['navy'],finish:'paper'},
  subjects:[{subject:'Shoes',overrides:{description:'Lightweight',theme:{finish:'foil'}}},
   {subject:'Boots',identity:{title:'Boot Campaign'},templateId:'rugged'}],
  overrides:[{identity:{context:'Summer'}},{}],numbering:{format:'prefix',prefix:'AD',start:7}});
 assert.equal(manifest.cards.map(card=>card.cardNumber).join(','),'AD-7,AD-8');
 assert.equal(manifest.cards[0].request.description,'Lightweight');
 assert.equal(manifest.cards[0].request.theme.finish,'foil');
 assert.equal(manifest.cards[0].request.theme.palette[0],'navy');
 assert.equal(manifest.cards[0].request.identity.context,'Summer');
 assert.equal(manifest.cards[1].request.identity.title,'Boot Campaign');
 assert.equal(manifest.cards[1].request.templateId,'rugged');
 manifest.cards[0].request.theme.palette[0]='changed';
 assert.equal(manifest.cards[1].request.theme.palette[0],'navy');
 assert.equal(manifest.theme.palette[0],'navy');
 assert.equal(api.buildSetManifest({subjects:['A','B'],numbering:{format:'fraction',start:3,total:10}}).cards[1].cardNumber,'4/10');
});

test('all purposes generate distinct pending focus requests rather than built art',()=>{
 const api=studio();
 for(const purpose of ['movie-watcher','advertising','website','collection','custom']){
  const manifest=api.buildSetManifest({purpose,subject:'Feature',count:8});
  assert.equal(new Set(manifest.cards.map(card=>card.subject)).size,8);
  assert.equal(new Set(manifest.cards.map(card=>card.request.focus)).size,8);
  assert.equal(manifest.cards.every(card=>card.status==='pending'),true);
 }
});

test('set cards may share a subject when their content differs but reject exact duplicates',()=>{
 const api=studio();
 const scenes=api.buildSetManifest({purpose:'movie-watcher',subjects:[
  {subject:'Hero',title:'Arrival',context:'Train station'},
  {subject:'Hero',title:'Departure',context:'Train station'},
  {subject:'Hero',title:'Arrival',context:'Harbor'},
  {subject:'Hero',focus:'Final confrontation'},
  {subject:'Hero',instruction:'Show the opening scene'}
 ]});
 assert.equal(scenes.cards.length,5);
 assert.equal(new Set(scenes.cards.map(card=>card.id)).size,5);
 assert.equal(scenes.cards.every(card=>card.subject==='Hero'),true);
 assert.throws(()=>api.buildSetManifest({subjects:[
  {subject:'Hero',title:'Arrival',context:'Harbor'},
  {context:'Harbor',title:'Arrival',subject:'Hero'}
 ]}),{code:'duplicate_set_subject'});
 assert.equal(api.buildSetManifest({subjects:[
  {subject:'Hero',identity:{title:'Act One'}},
  {subject:'Hero',identity:{title:'Act Two'}}
 ]}).count,2);
});

test('set validation bounds counts, prevents duplicate subjects, and validates numbering',()=>{
 const api=studio();
 for(const count of [0,-1,1.5,101,'2',NaN]){
  assert.throws(()=>api.buildSetManifest({subject:'A',count}),{code:'invalid_set_count'});
 }
 assert.throws(()=>api.buildSetManifest({purpose:'unknown',subject:'A'}),{code:'invalid_set_purpose'});
 assert.throws(()=>api.buildSetManifest({subjects:['A'],count:2}),{code:'subject_count_mismatch'});
 assert.throws(()=>api.buildSetManifest({subjects:['A',' a ']}),{code:'duplicate_set_subject'});
 assert.throws(()=>api.buildSetManifest({subjects:['A','B'],overrides:[{subject:'B'}]}),{code:'duplicate_set_subject'});
 assert.throws(()=>api.buildSetManifest({subjects:['']}),{code:'set_subject_required'});
 assert.throws(()=>api.buildSetManifest({subject:'A',numbering:{start:0}}),{code:'invalid_numbering_start'});
 assert.throws(()=>api.buildSetManifest({subjects:['A','B'],numbering:{total:1}}),{code:'invalid_numbering_total'});
 assert.equal(api.buildSetManifest({subject:'A',count:100}).cards.length,100);
});

test('real CardDataStream and CardBack integrate with build requests and pending set cards',async()=>{
 const api=studio({
  dataStream:require('../public/card-data-stream'),
  cardBack:require('../public/card-back')
 });
 const photo=new Blob(['real image source']);
 const request=api.buildRequest({subject:'Example film',category:'movie',photo,
  evidence:{story:'A verified scene',sources:[{title:'Studio',url:'https://example.com'}]}});
 assert.equal(request.cardData.subject,'Example film');
 assert.equal(request.cardData.category,'movie');
 assert.equal(request.cardData.backFormat,'movie-tv');
 assert.equal(request.input.photo.size,photo.size);
 api.configure({build:async normalized=>({front:{image},cardData:normalized.cardData})});
 const manifest=api.buildSetManifest({subjects:['Example film','Other film'],request:{category:'movie'}});
 const artifact=await api.buildCard(manifest.cards[0].request);
 assert.equal(artifact.id,manifest.cards[0].id);
 assert.equal(artifact.back.format,'movie-tv');
 assert.equal(artifact.back.data.subject,'Example film');
 assert.equal(artifact.back.data.cardNumber,'1/2');
 assert.equal(api.getCardData(artifact.id).setId,manifest.id);
 const selected=api.buildSetManifest({subjects:['A','B'],
  request:{evidence:{title:'Old title',subject:'Old subject',cardNumber:'old-number',
   provenance:{title:{source:'visible-text'},subject:{source:'visible-text'},cardNumber:{source:'visible-text'}}}}});
 const normalized=api.buildRequest(selected.cards[1].request).cardData;
 assert.equal(normalized.subject,'B');
 assert.equal(normalized.title,'B');
 assert.equal(normalized.cardNumber,'2/2');
});
