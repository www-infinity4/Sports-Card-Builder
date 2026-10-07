(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./card-evidence'):root.OracleCardEvidence);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OracleCardDataStream=api;
})(typeof window!=='undefined'?window:globalThis,function(Evidence){
 'use strict';

 const SCALARS=Object.freeze([
  'cardId','setId','title','subtitle','subject','subjectType','category','context',
  'brand','maker','series','year','date','cardNumber','parallelNumber','rarity',
  'biography','story','description','copyrightText','footerText','backFormat','templateId'
 ]);
 const LISTS=Object.freeze(['facts','stats','timeline','highlights','credits','sources']);
 const FIELDS=Object.freeze([...SCALARS,...LISTS,'provenance','confidence']);
 const CATEGORIES=Object.freeze(['fantasy','movie','tv','music','product','artifact','game','sports','generic']);
 const BACK_FORMATS=Object.freeze(['stats','biography','story','timeline','discography','movie-tv','product','compact-facts']);
 const ALIASES={cardMaker:'maker',manufacturer:'maker',cardYear:'year',dateText:'date',semanticDescription:'description',bio:'biography',format:'backFormat'};
 const DOMAIN_FIELDS={studio:['credits','Studio'],network:['credits','Network'],actor:['credits','Actor'],actorName:['credits','Actor'],
  franchise:['facts','Franchise'],team:['facts','Team'],league:['facts','League']};
 const WEIGHTS={'user-correction':100,'printed-logo':98,'visible-text':96,'image-reader':82,'image-comparison':75,'player-intel':75,'web-search':48,'state':35,'visual-inference':30,'design-metadata':100};
 const CEILINGS={'web-search':60,'image-comparison':90,'player-intel':75,'gpt-interpreter':65,'visual-inference':45,'state':35};
 const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
 const text=value=>typeof value==='string'||typeof value==='number'?String(value).trim():'';
 const name=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const array=value=>Array.isArray(value)?value:[];

 function safe(value,depth=0){
  if(depth>8)return null;
  if(typeof value==='string')return /^(?:data:|blob:)/i.test(value.trim())?'':value;
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(Array.isArray(value))return value.map(item=>safe(item,depth+1));
  if(typeof value!=='object')return null;
  const result={};
  for(const [key,item] of Object.entries(value)){
   if(/image|photo|blob|base64|pixels|binary/i.test(key)||['__proto__','constructor','prototype','provenance','confidence','sources'].includes(key))continue;
   result[key]=safe(item,depth+1);
  }
  return result;
 }
 function confidence(value,source){
  const number=value==null?NaN:Number(value);
  return Math.min(CEILINGS[source]??100,Number.isFinite(number)?Math.max(0,Math.min(100,number)):WEIGHTS[source]||35);
 }
 function create(){
  const result={};
  for(const field of SCALARS)result[field]='';
  for(const field of LISTS)result[field]=[];
  result.category='generic';
  result.backFormat='compact-facts';
  result.provenance={};
  result.confidence={};
  for(const field of [...SCALARS,...LISTS]){
   result.provenance[field]=null;
   result.confidence[field]=0;
  }
  return result;
 }
 function category(value,type){
  const explicit=text(value).toLowerCase();
  if(CATEGORIES.includes(explicit))return explicit;
  if(explicit&& !['auto','other','unknown'].includes(explicit))return 'generic';
  const hint=text(type).toLowerCase();
  if(/\b(?:dungeons|dragon|dungeon|rpg|role.?playing|wizard|sorcerer|fantasy|spell|monster|paladin|rogue)\b/.test(hint))return 'fantasy';
  if(/\b(?:band|musician|music|singer|album|artist|song|concert)\b/.test(hint))return 'music';
  if(/\b(?:tv|television|show|cartoon|anime|animation)\b/.test(hint))return 'tv';
  if(/\b(?:movie|film|cinema)\b/.test(hint))return 'movie';
  if(/\b(?:product|vehicle|toy|device|advertisement|advertising|ad|commercial)\b/.test(hint))return 'product';
  if(/\b(?:artifact|coin|antique|relic|museum|fossil|mineral|jewel|gem|medal|stamp)\b/.test(hint))return 'artifact';
  if(/\b(?:video.?game|board.?game|card.?game|console|arcade|game item|game character)\b/.test(hint))return 'game';
  if(/\b(?:athlete|player|baseball|basketball|football|hockey|sport|pitcher)\b/.test(hint))return 'sports';
  return 'generic';
 }
 function backFormat(value,data){
  const alias={bio:'biography',facts:'compact-facts',compact:'compact-facts','movie/tv':'movie-tv',movie:'movie-tv',tv:'movie-tv'};
  const requested=alias[text(value)]||text(value);
  if(BACK_FORMATS.includes(requested)&&!(requested==='stats'&&!data.stats.length))return requested;
  if(data.category==='sports')return data.stats.length?'stats':'biography';
  if(data.category==='music')return 'discography';
  if(['movie','tv'].includes(data.category))return 'movie-tv';
  if(data.category==='product')return 'product';
  return data.story?'story':data.biography||data.description?'biography':data.timeline.length?'timeline':'compact-facts';
 }
 function build(options={}){
  if(!options||typeof options!=='object')options={};
  const out=create();
  const candidates={};
  const lists={};
  const listOverrides={};
  const sourceRecords=[];
  const evidence=options.evidence||{};
  function addSource(value,source){
   const record=typeof value==='string'?{url:text(value),source}:safe(value);
   if(!record||typeof record!=='object'||(!record.url&&!record.title&&!record.source))return;
   if(record.url&&!/^https?:\/\//i.test(record.url))delete record.url;
   record.source=text(record.source)||source;
   const key=JSON.stringify(record);
   if(!sourceRecords.some(item=>JSON.stringify(item)===key))sourceRecords.push(record);
  }
  function put(key,value,metadata={},forcedSource){
   const field=ALIASES[key]||key;
   if(DOMAIN_FIELDS[field]){
    const wrapped=value&&typeof value==='object'&&!Array.isArray(value)&&own(value,'value');
    const actual=wrapped?value.value:value;
    const meta=wrapped?{...metadata,...value}:metadata;
    const [list,label]=DOMAIN_FIELDS[field];
    const values=Array.isArray(actual)?actual:[actual];
    const entries=values.map(item=>text(item)).filter(Boolean).map(item=>
     list==='credits'?{role:label,name:item}:{label,value:item}
    );
    if(entries.length)put(list,entries,meta,forcedSource);
    return;
   }
   if(field==='stats'||(!SCALARS.includes(field)&&!LISTS.includes(field)))return;
   const wrapped=value&&typeof value==='object'&&!Array.isArray(value)&&own(value,'value');
   const actual=wrapped?value.value:value;
   const meta=wrapped?{...metadata,...value}:metadata;
   const source=forcedSource||text(meta.source)||'visual-inference';
   const score=source==='user-correction'?100:confidence(meta.confidence,source);
   const correction=source==='user-correction';
   if(LISTS.includes(field)){
    const values=Array.isArray(actual)?actual:typeof actual==='string'?[actual]:[];
    if(field==='sources'){
     for(const item of values)addSource(item,source);
     return;
    }
    const items=values.map(item=>{
     const original=item&&typeof item==='object'?item:{text:text(item)};
     const payload=safe(original);
     if(payload==null||payload===''||(typeof payload==='object'&&!Object.keys(payload).length))return null;
     if(typeof payload==='object'&&Object.keys(payload).every(k=>payload[k]===''))return null;
     const entry=typeof payload==='object'&&!Array.isArray(payload)?payload:{text:text(payload)};
     const itemSource=forcedSource||text(original.provenance?.source)||source;
     const itemScore=correction?100:confidence(original.provenance?.confidence??score,itemSource);
     const references=Array.isArray(original.sources)?original.sources:array(meta.sources);
     const cleanSources=references.map(ref=>typeof ref==='string'?{url:text(ref),source:itemSource}:safe(ref))
      .filter(ref=>ref&&(!ref.url||/^https?:\/\//i.test(ref.url)));
     for(const ref of cleanSources)addSource(ref,itemSource);
     return {...entry,confidence:itemScore,provenance:{value:safe(entry),confidence:itemScore,source:itemSource},sources:cleanSources};
    }).filter(Boolean);
    if(correction)listOverrides[field]=items;
    else lists[field]=[...(lists[field]||[]),...items];
    return;
   }
   if(actual==null&&!correction)return;
   const cleaned=safe(text(actual));
   if(!cleaned&&!correction)return;
   const prior=candidates[field];
   if(prior&&!correction&&(prior.source==='user-correction'||prior.confidence>=score))return;
   candidates[field]={value:cleaned,confidence:score,source};
   for(const ref of array(meta.sources))addSource(ref,source);
  }
  function consume(data,defaultSource,locked=false){
   if(!data||typeof data!=='object')return;
   for(const field of [...SCALARS,...LISTS,...Object.keys(ALIASES),...Object.keys(DOMAIN_FIELDS)]){
    if(!own(data,field))continue;
    put(field,data[field],{
     source:data.provenance?.[field]?.source||data.fieldProvenance?.[field]?.source||data.source||defaultSource,
     confidence:data.confidence?.[field]??data.fieldConfidence?.[field]??data.provenance?.[field]?.confidence??
      (typeof data.confidence==='number'?data.confidence:undefined),
     sources:data.provenance?.[field]?.sources||[]
    },locked?defaultSource:undefined);
   }
   for(const [field,value] of Object.entries(data.fields||{}))put(field,value,{source:defaultSource},locked?defaultSource:undefined);
  }
  function vision(data){
   if(!data||typeof data!=='object')return;
   if(Evidence)consume(Evidence.fromVision(data),'image-reader');
   consume(data,'image-reader',true);
   if(!Evidence){
    const values={
     title:data.title||data.titleOptions?.[0]||data.playerName||data.characterName,
     brand:data.brand||data.brandOptions?.[0]||data.cardMaker,
     context:data.context||data.contextOptions?.[0]||data.team
    };
    for(const [field,value] of Object.entries(values)){
     const printed=array(data.visibleText).some(line=>name(line)===name(value));
     put(field,value,{source:printed?'visible-text':'image-reader'});
    }
    for(const line of array(data.visibleText)){
     const maker=text(line).match(/\b(Topps|Upper\s?Deck|Donruss|Fleer|Bowman|Panini|Score|SkyBox|Leaf)\b/i);
     const year=text(line).match(/\b(?:19[4-9]\d|20[0-4]\d)\b/);
     if(maker){
      put('maker',maker[1],{source:'printed-logo'});
      if(!candidates.brand)put('brand',maker[1],{source:'printed-logo'});
     }
     if(year)put('year',year[0],{source:'visible-text'});
    }
   }
   for(const [field,value] of Object.entries({...data,...data.fields})){
    if(!SCALARS.includes(ALIASES[field]||field)&&!DOMAIN_FIELDS[field])continue;
    const actual=value?.value??value;
    const printed=array(data.visibleText).some(line=>name(line)===name(actual));
    if(printed&&text(actual))put(field,value,{source:'visible-text'},'visible-text');
   }
  }
  consume(options.state?.detected,'state',true);
  consume(options.state?.identity,'state',true);
  consume(options.state,'state',true);
  vision(options.imageReader||options.vision);
  consume(options.comparison||evidence.imageComparison,'image-comparison',true);
  const web=options.web||options.webMatches||evidence.webMatches||[];
  for(const match of Array.isArray(web)?web:[web]){
   if(!match||typeof match!=='object')continue;
   // Search-result titles and snippets describe a result, not necessarily the card.
   consume(match.fields?{fields:match.fields}:match.cardData||match.structuredData||match.data,'web-search',true);
   if(match.url)addSource({url:match.url,title:text(match.title),source:'web-search'},'web-search');
  }
  consume(evidence,'visual-inference');
  for(const field of ['cardId','setId','cardNumber','copyrightText','footerText','backFormat','templateId']){
   if(own(options,field))put(field,options[field],{source:'user-correction'});
  }
  for(const overrides of [evidence.userOverrides,options.verifiedOverrides,options.userOverrides]){
   for(const [field,value] of Object.entries(overrides||{}))put(field,value,{source:'user-correction'},'user-correction');
  }
  function assign(){
   for(const [field,provenance] of Object.entries(candidates)){
    out[field]=provenance.value;
    out.provenance[field]={...provenance};
    out.confidence[field]=provenance.confidence;
   }
  }
  assign();
  if(!own(candidates,'title')&&out.subject)put('title',out.subject,out.provenance.subject);
  if(!own(candidates,'subject')&&out.title)put('subject',out.title,out.provenance.title);
  assign();
  const normalizedCategory=candidates.category?.source==='user-correction'&&!out.category?'generic':
   category(candidates.category?out.category:'',out.subjectType);
  out.category=normalizedCategory;
  if(out.provenance.category)out.provenance.category.value=normalizedCategory;
  else if(normalizedCategory!=='generic'&&out.provenance.subjectType){
   out.provenance.category={...out.provenance.subjectType,value:normalizedCategory};
   out.confidence.category=out.provenance.category.confidence;
  }
  const intel=[options.intel,evidence.playerIntel].find(item=>
   item&&item.ok!==false&&item.verified!==false&&item.matched!==false&&item.supported!==false&&
   item.player&&name(item.player.fullName)&&name(item.player.fullName)===name(out.title)&&
   (!item.source||['card-intel','player-intel','/v1/card-intel'].includes(item.source))
  );
  if(intel&&(normalizedCategory==='sports'||(!candidates.category&&!out.subjectType))){
   if(!candidates.category)put('category','sports',{source:'player-intel'});
   put('biography',intel.player.biography||intel.player.bio,{source:'player-intel'});
   put('highlights',intel.highlights,{source:'player-intel'},'player-intel');
   const rows=Array.isArray(intel.seasons)?intel.seasons:[];
   if(rows.length)put('context',rows[rows.length-1]?.team,{source:'player-intel'});
   out.stats=rows.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(safe(row)).length).map(row=>{
    const value=safe(row);
    return {...value,confidence:75,provenance:{value:safe(value),confidence:75,source:'player-intel'},sources:[{source:'card-intel'}]};
   });
   if(out.stats.length){
    out.provenance.stats={value:out.stats.map(row=>row.provenance.value),confidence:75,source:'player-intel'};
    out.confidence.stats=75;
   }
   addSource({source:'card-intel',title:intel.player.fullName},'player-intel');
  }
  assign();
  out.category=candidates.category?.source==='user-correction'&&!out.category?'generic':category(out.category,out.subjectType);
  if(out.provenance.category)out.provenance.category.value=out.category;
  if(out.category==='generic'&&!candidates.biography&&!out.story&&out.description){
   put('biography',out.description,out.provenance.description||{source:'visual-inference'});
   out.biography=candidates.biography.value;
   out.provenance.biography={...candidates.biography};
   out.confidence.biography=candidates.biography.confidence;
  }
  for(const field of ['facts','timeline','highlights','credits']){
   const entries=own(listOverrides,field)?listOverrides[field]:lists[field]||[];
   const unique=new Map();
   for(const entry of entries){
    const key=JSON.stringify(entry.provenance.value);
    if(!unique.has(key)||unique.get(key).provenance.confidence<entry.provenance.confidence)unique.set(key,entry);
   }
   out[field]=[...unique.values()];
   if(field==='facts')out[field].sort((a,b)=>b.confidence-a.confidence||
    compare(JSON.stringify(a.provenance.value),JSON.stringify(b.provenance.value)));
   const best=out[field].map(item=>item.provenance).sort((a,b)=>b.confidence-a.confidence)[0];
   if(best||own(listOverrides,field)){
    const source=own(listOverrides,field)?'user-correction':best.source;
    const score=own(listOverrides,field)?100:best.confidence;
    out.provenance[field]={value:out[field].map(item=>item.provenance.value),confidence:score,source};
    out.confidence[field]=score;
   }
  }
  const requested=candidates.backFormat?.value||options.state?.back?.format||
   options.template?.backFormat||options.template?.back?.format;
  out.backFormat=backFormat(requested,out);
  if(out.provenance.backFormat)out.provenance.backFormat.value=out.backFormat;
  const templateId=text(options.template?.id||options.template?.templateId);
  if(templateId&&!candidates.templateId){
   out.templateId=templateId;
   out.provenance.templateId={value:templateId,confidence:100,source:'design-metadata'};
   out.confidence.templateId=100;
  }
  out.sources=sourceRecords.map(record=>({...record,
   confidence:confidence(null,record.source),
   provenance:{value:safe(record),confidence:confidence(null,record.source),source:record.source},sources:[]
  })).sort((a,b)=>b.confidence-a.confidence||compare(JSON.stringify(a.provenance.value),JSON.stringify(b.provenance.value)));
  if(sourceRecords.length){
   out.provenance.sources={value:out.sources.map(record=>record.provenance.value),confidence:100,source:'source-records'};
   out.confidence.sources=100;
  }
  function compare(a,b){return a<b?-1:a>b?1:0}
  return out;
 }
 function normalize(data={},options={}){
  return build({...options,evidence:data});
 }
 return {FIELDS,SCALARS,LISTS,CATEGORIES,BACK_FORMATS,create,normalize,build};
});
