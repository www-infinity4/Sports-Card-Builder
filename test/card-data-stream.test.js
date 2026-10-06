const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Stream=require('../public/card-data-stream');
const Evidence=require('../public/card-evidence');

const playerIntel=()=>({
 ok:true,player:{fullName:'Juan Soto',primaryPosition:'RF',biography:'A professional baseball outfielder.'},
 seasons:[{season:2023,team:'San Diego Padres',group:'hitting',gamesPlayed:162,homeRuns:35,avg:'.275'}],
 highlights:[{season:2023,text:'Played 162 games.'}]
});
const printed=()=>Evidence.merge(Evidence.create(),Evidence.fromVision({
 visibleText:['JUAN SOTO','Topps 2023'],titleOptions:['JUAN SOTO'],subjectType:'baseball player',category:'sports'
}));

test('UMD exposes the same synchronous API in Node and a browser',()=>{
 const context=vm.createContext({window:{OracleCardEvidence:Evidence}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/card-data-stream.js'),'utf8'),context);
 assert.equal(typeof context.window.OracleCardDataStream.build,'function');
 assert.equal(typeof context.window.OracleCardDataStream.normalize,'function');
 assert.equal(context.window.OracleCardDataStream.build().category,'generic');
 assert.equal(context.window.OracleCardDataStream.build().backFormat,'compact-facts');
});

test('standalone browser module recognizes printed identity without requiring an evidence script',()=>{
 const context=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/card-data-stream.js'),'utf8'),context);
 const data=context.window.OracleCardDataStream.build({imageReader:{
  titleOptions:['PINK FLOYD'],subjectType:'band',visibleText:['PINK FLOYD','Topps 1987']
 }});
 assert.equal(data.title,'PINK FLOYD');
 assert.equal(data.provenance.title.source,'visible-text');
 assert.equal(data.maker,'Topps');
 assert.equal(data.year,'1987');
 assert.equal(data.category,'music');
 assert.equal(data.backFormat,'discography');
});

test('unknown input has a complete schema without fabricated identity, dates, or stats',()=>{
 const data=Stream.build();
 assert.deepEqual(Object.keys(data).sort(),[...Stream.FIELDS].sort());
 assert.equal(data.title,'');
 assert.equal(data.subject,'');
 assert.equal(data.year,'');
 assert.equal(data.maker,'');
 assert.equal(data.category,'generic');
 assert.equal(data.backFormat,'compact-facts');
 for(const field of Stream.LISTS)assert.deepEqual(data[field],[]);
 for(const field of [...Stream.SCALARS,...Stream.LISTS]){
  assert.equal(data.provenance[field],null);
  assert.equal(data.confidence[field],0);
 }
 assert.deepEqual(Stream.build(null),data);
});

test('create returns independent mutable containers',()=>{
 const first=Stream.create(),second=Stream.create();
 first.facts.push('one');
 first.confidence.title=100;
 assert.deepEqual(second.facts,[]);
 assert.equal(second.confidence.title,0);
});

test('printed OCR beats comparison, state and inflated web confidence',()=>{
 const data=Stream.build({
  evidence:printed(),state:{identity:{title:'Wrong state name',dateText:'1999'}},
  comparison:{title:'Wrong comparison name',confidence:{title:100}},
  web:[{url:'https://example.test/card',fields:{
   title:{value:'Wrong web name',confidence:100},cardYear:{value:'1980',confidence:100},
   brand:{value:'Fleer',confidence:100}
  }}]
 });
 assert.equal(data.title,'JUAN SOTO');
 assert.equal(data.maker,'Topps');
 assert.equal(data.brand,'Topps');
 assert.equal(data.year,'2023');
 assert.equal(data.provenance.title.source,'visible-text');
 assert.equal(data.provenance.brand.source,'printed-logo');
 assert.equal(data.confidence.title,96);
 assert.equal(data.sources[0].url,'https://example.test/card');
});

test('raw image-reader fields and structured comparison fields are consumed',()=>{
 const data=Stream.build({
  imageReader:{visibleText:['PINK FLOYD','Topps 1987'],titleOptions:['PINK FLOYD'],subjectType:'band',
   facts:[{label:'Medium',value:'Printed collectible'}]},
  comparison:{fields:{series:{value:'Music collection',confidence:88}},image:'data:image/png;base64,secret'}
 });
 assert.equal(data.title,'PINK FLOYD');
 assert.equal(data.category,'music');
 assert.equal(data.maker,'Topps');
 assert.equal(data.year,'1987');
 assert.equal(data.series,'Music collection');
 assert.equal(data.provenance.series.source,'image-comparison');
 assert.equal(data.facts[0].label,'Medium');
 assert.equal(data.facts[0].value,'Printed collectible');
});

test('structured web fields enrich factual biography but search snippets and titles are not identity',()=>{
 const data=Stream.build({
  web:[
   {title:'Unrelated famous person',content:'Invented narrative',url:'https://example.test/search'},
   {title:'Result',url:'https://example.test/source',cardData:{
    biography:'The subject is a vintage mechanical instrument.',
    facts:[{label:'Mechanism',value:'Mechanical',sources:[{url:'https://example.test/source'}]}]
   }}
  ]
 });
 assert.equal(data.title,'');
 assert.equal(data.description,'');
 assert.equal(data.biography,'The subject is a vintage mechanical instrument.');
 assert.equal(data.backFormat,'biography');
 assert.equal(data.provenance.biography.source,'web-search');
 assert.equal(data.facts[0].provenance.source,'web-search');
 assert.equal(data.facts[0].sources[0].url,'https://example.test/source');
});

test('evidence corrections, including empty strings, dominate subsequent printed fields',()=>{
 let evidence=Evidence.addUserOverride(printed(),'title','Corrected subject');
 evidence=Evidence.addUserOverride(evidence,'brand','');
 const data=Stream.build({evidence,imageReader:{title:'Printed replacement',brand:'Panini'},intel:playerIntel()});
 assert.equal(data.title,'Corrected subject');
 assert.equal(data.brand,'');
 assert.equal(data.provenance.brand.source,'user-correction');
 assert.equal(data.confidence.brand,100);
 assert.deepEqual(data.stats,[]);
});

test('top-level corrections are final, support all new fields and authoritative empty lists',()=>{
 const data=Stream.build({
  evidence:Evidence.addUserOverride(printed(),'title','Earlier correction'),
  verifiedOverrides:{biography:'Verified biography',copyrightText:'Copyright supplied by user'},
  userOverrides:{
   title:'Final subject',subtitle:'User subtitle',maker:'User maker',year:'',
   parallelNumber:'1/1',rarity:'Unique',footerText:'Collector copy',
   facts:[{label:'Origin',value:'User supplied'}],timeline:[],highlights:[]
  },
  web:[{cardData:{year:'1980',timeline:['Web timeline'],highlights:['Web highlight']}}]
 });
 assert.equal(data.title,'Final subject');
 assert.equal(data.year,'');
 assert.equal(data.biography,'Verified biography');
 assert.equal(data.subtitle,'User subtitle');
 assert.equal(data.parallelNumber,'1/1');
 assert.equal(data.rarity,'Unique');
 assert.equal(data.copyrightText,'Copyright supplied by user');
 assert.equal(data.footerText,'Collector copy');
 assert.deepEqual(data.timeline,[]);
 assert.deepEqual(data.highlights,[]);
 assert.equal(data.provenance.timeline.source,'user-correction');
 assert.equal(data.facts[0].provenance.source,'user-correction');
 assert.equal(data.facts[0].provenance.value.label,'Origin');
});

test('an explicitly erased title does not refill from subject, state, or intel',()=>{
 const data=Stream.build({evidence:printed(),userOverrides:{title:''},intel:playerIntel(),state:{identity:{title:'Juan Soto'}}});
 assert.equal(data.title,'');
 assert.equal(data.provenance.title.source,'user-correction');
 assert.deepEqual(data.stats,[]);
 assert.equal(data.biography,'');
});

test('matched card-intel supplies real statistics and source-backed highlights',()=>{
 const intel=playerIntel();
 const data=Stream.build({evidence:printed(),intel});
 assert.equal(data.stats.length,1);
 assert.equal(data.stats[0].homeRuns,35);
 assert.equal(data.stats[0].avg,'.275');
 assert.equal(data.stats[0].rbi,undefined);
 assert.equal(data.stats[0].provenance.source,'player-intel');
 assert.equal(data.stats[0].provenance.value.homeRuns,35);
 assert.equal(data.stats[0].sources[0].source,'card-intel');
 assert.equal(data.context,'San Diego Padres');
 assert.equal(data.backFormat,'stats');
 assert.equal(data.highlights[0].text,'Played 162 games.');
 assert.equal(data.highlights[0].provenance.source,'player-intel');
 assert.equal(data.biography,intel.player.biography);
 assert.ok(data.sources.some(source=>source.source==='card-intel'));
 assert.equal(intel.seasons[0].provenance,undefined);
});

test('caller-verified evidence.playerIntel still matches the final selected title',()=>{
 const evidence=Evidence.merge(printed(),{playerIntel:playerIntel()});
 assert.equal(Stream.build({evidence}).stats.length,1);
 const changed=Stream.build({evidence,userOverrides:{title:'Unknown person'}});
 assert.deepEqual(changed.stats,[]);
 assert.deepEqual(changed.highlights,[]);
 assert.equal(changed.biography,'');
});

test('identity matching tolerates case, punctuation and accents but never partial names',()=>{
 const intel=playerIntel();
 intel.player.fullName='Juán Soto';
 assert.equal(Stream.build({userOverrides:{title:'JUAN SOTO'},intel}).stats.length,1);
 assert.equal(Stream.build({userOverrides:{title:'Soto'},intel}).stats.length,0);
 assert.equal(Stream.build({userOverrides:{title:'Juan Soto Jr'},intel}).stats.length,0);
});

test('unsupported, unverified, unmatched, failed and non-card-intel payloads cannot enrich',()=>{
 for(const marker of [{supported:false},{verified:false},{matched:false},{ok:false},{source:'web-search'}]){
  const data=Stream.build({evidence:printed(),intel:{...playerIntel(),...marker}});
  assert.deepEqual(data.stats,[]);
  assert.deepEqual(data.highlights,[]);
  assert.equal(data.biography,'');
  assert.equal(data.backFormat,'biography');
 }
});

test('arbitrary OCR, web, state, evidence and user statistics are all rejected',()=>{
 const seasons=[{season:2024,homeRuns:999}];
 const data=Stream.build({
  evidence:{title:'Juan Soto',stats:seasons,seasons,playerIntel:{player:{fullName:'Different Player'},seasons}},
  imageReader:{stats:seasons},state:{stats:seasons,back:{data:{stats:seasons},format:'stats'}},
  web:[{fields:{stats:{value:seasons,source:'player-intel',confidence:100}}}],
  userOverrides:{stats:seasons},verifiedOverrides:{stats:seasons}
 });
 assert.deepEqual(data.stats,[]);
 assert.notEqual(data.backFormat,'stats');
});

test('non-sports selected category blocks even name-matched sports enrichment',()=>{
 for(const category of ['movie','tv','music','product','generic']){
  const data=Stream.build({intel:playerIntel(),userOverrides:{title:'Juan Soto',category}});
  assert.deepEqual(data.stats,[]);
  assert.deepEqual(data.highlights,[]);
  assert.equal(data.category,category);
 }
 const inferred=Stream.build({intel:playerIntel(),evidence:{title:'Juan Soto',subjectType:'band'}});
 assert.equal(inferred.category,'music');
 assert.deepEqual(inferred.stats,[]);
});

test('matched intel does not replace corrected context or biography',()=>{
 const data=Stream.build({evidence:printed(),intel:playerIntel(),userOverrides:{context:'',biography:'User biography',highlights:[]}});
 assert.equal(data.context,'');
 assert.equal(data.biography,'User biography');
 assert.deepEqual(data.highlights,[]);
 assert.equal(data.stats.length,1);
});

test('template and plan cannot fabricate subject facts or turn suggestions into highlights',()=>{
 const data=Stream.build({
  template:{id:'topps-1987',maker:'Topps',year:1987,category:'sports',title:'Wrong Subject'},
  plan:{suggestedYear:1987,title:'Fake player',biography:'Fake biography',
   suggestions:['Won the championship'],highlights:['Fake record'],stats:[{homeRuns:100}]}
 });
 assert.equal(data.templateId,'topps-1987');
 assert.equal(data.provenance.templateId.source,'design-metadata');
 assert.equal(data.title,'');
 assert.equal(data.maker,'');
 assert.equal(data.year,'');
 assert.equal(data.category,'generic');
 assert.deepEqual(data.stats,[]);
 assert.deepEqual(data.highlights,[]);
 assert.equal(data.biography,'');
});

test('every supported category has a canonical content-appropriate back format',()=>{
 const expected={sports:'biography',movie:'movie-tv',tv:'movie-tv',music:'discography',product:'product',generic:'compact-facts'};
 for(const [category,format] of Object.entries(expected)){
  const data=Stream.build({userOverrides:{category}});
  assert.equal(data.category,category);
  assert.equal(data.backFormat,format);
 }
 assert.equal(Stream.build({evidence:{subjectType:'band'}}).category,'music');
 assert.equal(Stream.build({evidence:{subjectType:'television character'}}).category,'tv');
 assert.equal(Stream.build({evidence:{subjectType:'movie character'}}).category,'movie');
 assert.equal(Stream.build({evidence:{subjectType:'device'}}).category,'product');
 assert.equal(Stream.build({evidence:{category:'unsupported'}}).category,'generic');
 assert.equal(Stream.build({evidence:{subjectType:'band'},userOverrides:{category:''}}).category,'generic');
});

test('generic biography, story and timeline use supplied facts rather than invented prose',()=>{
 for(const [fields,format] of [
  [{biography:'A documented local landmark.'},'biography'],
  [{story:'The object was exhibited in a local museum.'},'story'],
  [{timeline:[{date:'2001',event:'Exhibited'}]},'timeline']
 ]){
  const data=Stream.build({verifiedOverrides:fields});
  assert.equal(data.category,'generic');
  assert.equal(data.backFormat,format);
  assert.equal(data.title,'');
  assert.equal(data.year,'');
 }
});

test('back format aliases normalize and unsupported formats cannot leak',()=>{
 for(const [requested,expected] of [['bio','biography'],['facts','compact-facts'],['movie/tv','movie-tv'],['nonsense','compact-facts'],['stats','compact-facts']]){
  assert.equal(Stream.build({state:{back:{format:requested}}}).backFormat,expected);
 }
 for(const format of Stream.BACK_FORMATS.filter(value=>value!=='stats')){
  assert.equal(Stream.build({userOverrides:{backFormat:format}}).backFormat,format);
 }
});

test('normalization aliases and IDs preserve scalar types and explicit provenance',()=>{
 const data=Stream.normalize({
  cardMaker:'Bowman',cardYear:1991,dateText:'1991-04-01',bio:'Supplied biography',
  semanticDescription:'Printed portrait',cardNumber:17,
  provenance:{cardMaker:{source:'printed-logo'}},confidence:{cardMaker:99}
 },{cardId:'card-1',setId:'set-1'});
 assert.equal(data.maker,'Bowman');
 assert.equal(data.provenance.maker.source,'printed-logo');
 assert.equal(data.year,'1991');
 assert.equal(data.date,'1991-04-01');
 assert.equal(data.cardNumber,'17');
 assert.equal(data.biography,'Supplied biography');
 assert.equal(data.description,'Printed portrait');
 assert.equal(data.cardId,'card-1');
 assert.equal(data.setId,'set-1');
});

test('list items retain individual provenance and sources and deduplicate identical facts',()=>{
 const data=Stream.build({
  evidence:{facts:[{text:'Printed fact',provenance:{source:'visible-text',confidence:96},sources:['https://example.test/printed']}]},
  web:[{cardData:{facts:[{text:'Printed fact'},{text:'Web fact'}],credits:[{name:'Photographer',role:'Photo'}]}}]
 });
 assert.equal(data.facts.length,2);
 const printedFact=data.facts.find(item=>item.text==='Printed fact');
 assert.equal(printedFact.provenance.source,'visible-text');
 assert.equal(printedFact.provenance.confidence,96);
 assert.equal(printedFact.sources[0].url,'https://example.test/printed');
 assert.equal(data.credits[0].name,'Photographer');
 assert.equal(data.credits[0].provenance.source,'web-search');
 assert.equal(data.provenance.facts.confidence,96);
 assert.ok(data.sources.every(item=>item.provenance&&Array.isArray(item.sources)));
});

test('provenance and output discard image payloads recursively and never mutate inputs',()=>{
 const evidence=printed();
 evidence.playerIntel=playerIntel();
 evidence.playerIntel.seasons[0].image='data:image/png;base64,private';
 evidence.playerIntel.seasons[0].nested={photoData:'private',note:'Retained'};
 evidence.facts=[{text:'Fact',imageData:'private',sources:[{url:'https://example.test/fact',image:'private'}]}];
 evidence.imageComparison={image:'data:image/png;base64,private'};
 const before=JSON.stringify(evidence);
 const data=Stream.build({evidence});
 const serialized=JSON.stringify(data);
 assert.equal(serialized.includes('private'),false);
 assert.equal(serialized.includes('base64'),false);
 assert.equal(data.stats[0].nested.note,'Retained');
 assert.equal(JSON.stringify(evidence),before);
});

test('subject can provide a title but no unidentified intel can provide a subject',()=>{
 assert.equal(Stream.build({evidence:{subject:'Known object'}}).title,'Known object');
 const data=Stream.build({intel:playerIntel()});
 assert.equal(data.title,'');
 assert.equal(data.subject,'');
 assert.deepEqual(data.stats,[]);
});

test('malformed optional lists and confidence cannot break normalization',()=>{
 const data=Stream.build({evidence:{
  title:{value:'Unknown subject',confidence:'invalid',source:'web-search',sources:{}},
  facts:[{text:'One fact',sources:{}}],timeline:{},credits:[null,false]
 },web:[null,'not a result'],intel:{player:null}});
 assert.equal(data.title,'Unknown subject');
 assert.equal(data.confidence.title,48);
 assert.equal(data.facts[0].text,'One fact');
 assert.deepEqual(data.timeline,[]);
 assert.deepEqual(data.credits,[]);
});

test('request IDs, footer and copyright metadata are accepted but explicit corrections win',()=>{
 const data=Stream.build({
  cardId:'card-17',setId:'set-2',cardNumber:'SC-17',copyrightText:'Supplied product copyright',footerText:'Supplied product footer',
  backFormat:'biography',userOverrides:{footerText:'',cardId:'user-card'}
 });
 assert.equal(data.cardId,'user-card');
 assert.equal(data.setId,'set-2');
 assert.equal(data.cardNumber,'SC-17');
 assert.equal(data.copyrightText,'Supplied product copyright');
 assert.equal(data.footerText,'');
 assert.equal(data.provenance.footerText.source,'user-correction');
 assert.equal(data.backFormat,'biography');
 assert.equal(Stream.build({template:{id:'story-design',backFormat:'story'}}).backFormat,'story');
});

test('other-category artists and advertisements infer the appropriate factual category',()=>{
 for(const subjectType of ['artist','recording artist']){
  const data=Stream.build({evidence:{category:'other',subjectType}});
  assert.equal(data.category,'music');
  assert.equal(data.backFormat,'discography');
 }
 for(const subjectType of ['advertisement','ad','advertising']){
  const data=Stream.build({evidence:{category:'other',subjectType}});
  assert.equal(data.category,'product');
  assert.equal(data.backFormat,'product');
 }
 assert.equal(Stream.build({evidence:{category:'other',subjectType:'artist'},userOverrides:{category:'generic'}}).category,'generic');
});

test('generic description-only backs use the exact factual description as biography',()=>{
 const data=Stream.build({evidence:{description:'An antique brass instrument.',
  provenance:{description:{source:'image-reader',confidence:82}}}});
 assert.equal(data.category,'generic');
 assert.equal(data.backFormat,'biography');
 assert.equal(data.description,'An antique brass instrument.');
 assert.equal(data.biography,data.description);
 assert.deepEqual(data.provenance.biography,data.provenance.description);
 const erased=Stream.build({evidence:{description:'Antique instrument'},userOverrides:{biography:''}});
 assert.equal(erased.biography,'');
});

test('supported entertainment and team evidence becomes attributed credits and facts',()=>{
 const data=Stream.build({
  evidence:{category:'movie',fields:{
   studio:{value:'Known Studio',source:'visible-text',confidence:96},
   actor:{value:'Named Actor',source:'image-reader',confidence:82},
   franchise:{value:'Documented Franchise',source:'visible-text',confidence:96}
  }},
  web:[{cardData:{network:'Known Network',actorName:'Named Actor',team:'Documented Team',league:'Documented League'}}]
 });
 assert.equal(data.credits.find(item=>item.role==='Studio').name,'Known Studio');
 assert.equal(data.credits.find(item=>item.role==='Studio').confidence,96);
 assert.equal(data.credits.find(item=>item.role==='Actor').name,'Named Actor');
 assert.equal(data.credits.find(item=>item.role==='Actor').confidence,82);
 assert.equal(data.credits.find(item=>item.role==='Network').provenance.source,'web-search');
 assert.equal(data.facts.find(item=>item.label==='Franchise').value,'Documented Franchise');
 assert.equal(data.facts.find(item=>item.label==='Team').value,'Documented Team');
 assert.equal(data.facts.find(item=>item.label==='League').value,'Documented League');
 assert.equal(data.actor,undefined);
 assert.equal(data.studio,undefined);
});

test('facts have direct confidence and deterministic strongest-first ordering',()=>{
 const webFacts=[{text:'Weak B'},{text:'Weak A'}];
 const first=Stream.build({
  evidence:{facts:[{text:'Printed',provenance:{source:'visible-text',confidence:96}}]},
  web:[{cardData:{facts:webFacts}}]
 });
 const second=Stream.build({
  evidence:{facts:[{text:'Printed',provenance:{source:'visible-text',confidence:96}}]},
  web:[{cardData:{facts:[...webFacts].reverse()}}]
 });
 assert.deepEqual(first.facts,second.facts);
 assert.deepEqual(first.facts.map(item=>item.text),['Printed','Weak A','Weak B']);
 assert.deepEqual(first.facts.map(item=>item.confidence),[96,48,48]);
 assert.equal(Stream.build({evidence:printed(),intel:playerIntel()}).stats[0].confidence,75);
});
