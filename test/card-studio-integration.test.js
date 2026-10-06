const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');

function adapterHarness(){
 let adapter;
 const calls=[];
 const identity={},selections={},elements={make:{disabled:false},message:{value:''}};
 const context=vm.createContext({
  Blob,
  CARD_STUDIO:{configure:options=>{adapter=options}},
  SERVICES:{capabilities:()=>({current:{}})},
  $:id=>elements[id],
  studioRequest:null,
  imageReadPromise:Promise.resolve(),
  setPhoto:async image=>calls.push(['read',image]),
  setReference:async image=>calls.push(['reference',image]),
  CARD_EVIDENCE:{FIELDS:['title','context','category'],merge:(a,b)=>({...a,...b}),addUserOverride:(e,f,v)=>({...e,[f]:v})},
  CARD_DATA_STREAM:{SCALARS:['subject','title','cardNumber'],LISTS:['facts']},
  cardEvidence:{},
  CARD_STATE:{reset(){},setIdentity:(f,v)=>identity[f]=v,setSelection:(f,v)=>selections[f]=v},
  state:()=>({back:context.back,detected:{}}),
  back:{},
  results:[],
  studioCards:new Map(),
  createCard:async (count,mode)=>{
   calls.push(['create',count,mode]);
   context.results.push('front');
   context.studioCards.set('front',{back:{image:'back'},front:{image:'front'}});
  }
 });
 const from=app.indexOf('if(CARD_STUDIO)CARD_STUDIO.configure(');
 const to=app.indexOf("\n$('tightenBtn')",from);
 assert.ok(from>=0&&to>from);
 vm.runInContext(app.slice(from,to),context);
 return {adapter,context,calls,identity,selections,elements};
}
test('public browser adapter reuses upload evidence and existing front/back build pipeline',async()=>{
 const {adapter,context,calls,identity,selections}=adapterHarness();
 const image=new Blob(['image']),referenceImage=new Blob(['reference']);
 const artifact=await adapter.build({schema:'phi.card-build-request/v1',input:{image,referenceImage,instruction:'Vintage movie card',templateId:'movie-template',
  cardNumber:'2 / 8',backFormat:'movie-tv',userOverrides:{title:{value:'Corrected character'}}}});
 assert.deepEqual(calls.map(c=>c[0]),['read','reference','create']);
 assert.equal(calls[2][2],'reference');
 assert.equal(context.cardEvidence.title,'Corrected character');
 assert.equal(identity.title,'Corrected character');
 assert.equal(identity.cardNumber,'2 / 8');
 assert.equal(selections.template,'movie-template');
 assert.equal(context.back.format,'movie-tv');
 assert.equal(artifact.back.image,'back');
 assert.equal(context.studioRequest,null);
});
test('browser adapter refuses invalid images, concurrent UI builds and incomplete artifacts',async()=>{
 const {adapter,context,elements}=adapterHarness();
 await assert.rejects(adapter.build({image:'https://example.invalid'}),/blob_required/);
 elements.make.disabled=true;
 await assert.rejects(adapter.build({image:new Blob()}),/builder_busy/);
 elements.make.disabled=false;
 context.createCard=async()=>{context.results=[]};
 await assert.rejects(adapter.build({image:new Blob()}),/build_incomplete/);
 assert.equal(context.studioRequest,null);
});
test('nested caller identity and evidence survive the upload reset',async()=>{
 const {adapter,context,identity}=adapterHarness();
 await adapter.build({input:{image:new Blob(),identity:{context:'Caller supplied movie'},
  evidence:{description:'Supported description'},userOverrides:{brand:''}}});
 assert.equal(identity.context,'Caller supplied movie');
 assert.equal(identity.logoText,'');
 assert.equal(context.cardEvidence.description,'Supported description');
});
test('CardData capture does not promote interpreted lastVision to original reader evidence',()=>{
 let received;
 const context=vm.createContext({
  CARD_DATA_STREAM:{build:options=>{received=options;return options}},
  cardEvidence:{title:'Original evidence'},lastVision:{title:'Weaker interpreted title'},
  state:()=>({}),lastIntel:null,activeTemplate:()=>null,lastPlan:null,
  lastImageComparison:null,lastWebContext:[],studioRequest:null
 });
 vm.runInContext(app.slice(app.indexOf('function studioData('),app.indexOf('function captureStudioCard(')),context);
 context.studioData();
 assert.equal(received.imageReader,undefined);
 assert.equal(received.evidence.title,'Original evidence');
});
test('authoritatively empty front fields suppress detected and logo fallbacks',async()=>{
 const context=vm.createContext({
  state:()=>({identity:{logoText:'Printed logo'},detected:{title:'Printed title',context:'Printed context',brand:'Printed brand',date:'1990'}}),
  cardEvidence:{userOverrides:{title:{value:''},context:{value:''},brand:{value:''},date:{value:''}}}
 });
 vm.runInContext(app.slice(app.indexOf('async function stampFrontIdentity('),app.indexOf('// Strong Topps-style 1/1')),context);
 assert.equal(await context.stampFrontIdentity('source-image'),'source-image');
});
test('missing optional back modules retain the finished front',async()=>{
 const diagnostics=[];
 const context=vm.createContext({
  CARD_STUDIO:null,CARD_DATA_STREAM:null,CARD_BACK:null,results:['finished-front'],activeResult:0,
  recordBuildDiagnostic:(...args)=>diagnostics.push(args)
 });
 vm.runInContext(app.slice(app.indexOf('function studioData('),app.indexOf('function showFront(')),context);
 assert.equal(context.captureStudioCard('finished-front'),undefined);
 assert.equal(await context.buildBackCard(),undefined);
 assert.equal(diagnostics[0][1].status,'unavailable');
 assert.equal(context.results[0],'finished-front');
});
