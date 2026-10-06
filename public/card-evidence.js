(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OracleCardEvidence=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';

 const FIELDS=[
  'title','subject','subjectType','category','context','brand','cardMaker','cardYear',
  'franchise','studio','network','team','league','series','date','semanticDescription'
 ];
 const SOURCES={
  'user-correction':100,'printed-logo':98,'visible-text':96,'image-reader':82,
  'image-comparison':75,'player-intel':75,'web-search':48,'gpt-interpreter':42,'visual-inference':30
 };
 const SOURCE_CEILINGS={'gpt-interpreter':65,'web-search':60,'image-comparison':90,'player-intel':75,'visual-inference':45};

 function create(){
  const evidence={
   visibleText:[],logos:[],numbers:[],objects:[],colors:[],eraClues:[],mediaClues:[],
   semanticDescription:'',webMatches:[],imageComparison:null,playerIntel:null,
   confidence:{},provenance:{},conflicts:[],userOverrides:{}
  };
  for(const field of FIELDS){evidence[field]='';evidence.confidence[field]=0;evidence.provenance[field]=null}
  return evidence;
 }
 function confidenceFor(item,source){
  const n=Number(item?.confidence);
  const confidence=Number.isFinite(n)?Math.max(0,Math.min(100,n)):SOURCES[source]||35;
  return Math.min(confidence,SOURCE_CEILINGS[source]??100);
 }
 function cleanList(value){
  const values=Array.isArray(value)?value:typeof value==='string'?[value]:[];
  return [...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))];
 }
 function merge(baseValue,incomingValue){
  const current=baseValue&&typeof baseValue==='object'?baseValue:create();
  const next=incomingValue&&typeof incomingValue==='object'?incomingValue:{};
  const out={...create(),...current,
   confidence:{...(current.confidence||{})},
   provenance:{...(current.provenance||{})},
   conflicts:[...(current.conflicts||[])],
   userOverrides:{...(current.userOverrides||{})}
  };
  for(const key of ['visibleText','logos','numbers','objects','colors','eraClues','mediaClues','webMatches']){
   out[key]=[...new Set([...cleanList(current[key]),...cleanList(next[key])])];
   if(out[key].length&&!out.provenance[key]){
    const supplied=next.arrayProvenance?.[key]||{};
    const source=supplied.source||(['visibleText','numbers'].includes(key)?'visible-text':key==='logos'?'printed-logo':key==='webMatches'?'web-search':'image-reader');
    const confidence=confidenceFor(supplied,source);
    out.confidence[key]=confidence;
    out.provenance[key]={value:[...out[key]],confidence,source,evidence:cleanList(supplied.evidence||out[key])};
   }else if(out.provenance[key])out.provenance[key]={...out.provenance[key],value:[...out[key]]};
  }
  for(const key of ['imageComparison','playerIntel']){
   if(next[key]!=null){
    out[key]=next[key];
    const source=key==='imageComparison'?'image-comparison':'player-intel';
    const confidence=key==='imageComparison'?confidenceFor({confidence:next[key].confidence},source):SOURCES[source];
    out.confidence[key]=confidence;
    out.provenance[key]={value:next[key],confidence,source,evidence:cleanList(next[key].evidence)};
   }
  }
  for(const field of FIELDS){
   const candidate=next.fields?.[field]??(Object.hasOwn(next,field)?{
    value:next[field],
    confidence:next.fieldConfidence?.[field]??next.confidence?.[field],
    source:next.fieldProvenance?.[field]?.source??next.provenance?.[field]?.source??next.source,
    evidence:next.fieldProvenance?.[field]?.evidence??next.provenance?.[field]?.evidence??next.evidence
   }:null);
   if(!candidate||candidate.value==null)continue;
   const value=String(candidate.value).trim();
   if(!value)continue;
   const source=String(candidate.source||'visual-inference');
   const confidence=confidenceFor(candidate,source);
   const provenance={value,confidence,source,evidence:cleanList(candidate.evidence)};
   const prior=out.provenance[field];
   if(out.userOverrides[field]){
    if(value!==out.userOverrides[field].value)out.conflicts.push({field,kept:out.userOverrides[field],rejected:provenance});
    continue;
   }
   if(!prior||confidence>Number(prior.confidence||0)){
    if(prior&&String(prior.value)!==value)out.conflicts.push({field,kept:provenance,rejected:prior});
    out[field]=value;out.confidence[field]=confidence;out.provenance[field]=provenance;
   }else if(String(prior.value)!==value){
    out.conflicts.push({field,kept:prior,rejected:provenance});
   }
  }
  out.conflicts=out.conflicts.filter((item,index,all)=>all.findIndex(other=>
   other.field===item.field&&other.kept?.value===item.kept?.value&&other.rejected?.value===item.rejected?.value
  )===index);
  return out;
 }
 function fromVision(data={}){
  const visibleText=cleanList(data.visibleText);
  const logos=cleanList(data.logos);
  const numbers=cleanList(data.numbers);
  const fieldValues={
   title:data.title||data.titleOptions?.[0]||data.playerName||data.characterName,
   subject:data.subject||data.title||data.titleOptions?.[0],
   subjectType:data.subjectType,
   category:data.category,
   context:data.context||data.contextOptions?.[0]||data.team,
   brand:data.brand||data.brandOptions?.[0]||data.cardMaker||logos[0],
   cardMaker:data.cardMaker||data.manufacturer,
   cardYear:data.cardYear,
   franchise:data.franchise,
   studio:data.studio,
   network:data.network,
   team:data.team,
   league:data.league,
   series:data.series||data.seriesOptions?.[0],
   date:data.date||data.dateOptions?.[0]||data.cardYear,
   semanticDescription:data.semanticDescription||data.description
  };
  const sourceFor=(field,value)=>{
   if(['cardMaker','brand'].includes(field)&&value&&visibleText.some(t=>t.toLowerCase().includes(String(value).toLowerCase())))return 'printed-logo';
   if(value&&visibleText.some(t=>t.toLowerCase()===String(value).toLowerCase()||(field==='cardYear'&&t.includes(String(value)))))return 'visible-text';
   return 'image-reader';
  };
  for(const text of visibleText){
   const maker=text.match(/\b(Topps|Upper\s?Deck|Donruss|Fleer|Bowman|Panini|Score|SkyBox|Leaf)\b/i);
   if(maker&&!fieldValues.cardMaker)fieldValues.cardMaker=maker[1];
   const year=text.match(/\b(?:19[4-9]\d|20[0-4]\d)\b/);
   if(year&&!fieldValues.cardYear)fieldValues.cardYear=year[0];
  }
  if(!fieldValues.brand)fieldValues.brand=fieldValues.cardMaker||logos[0]||'';
  if(!fieldValues.date&&fieldValues.cardYear)fieldValues.date=fieldValues.cardYear;
  const fields={};
  for(const [field,value] of Object.entries(fieldValues)){
   if(value==null||String(value).trim()==='')continue;
   const isPrinted=sourceFor(field,value);
   const supplied=Number(data.gptFieldConfidence?.[field]??data.confidence?.[field]);
   fields[field]={
    value,
    confidence:isPrinted==='visible-text'||isPrinted==='printed-logo'?96:Number.isFinite(supplied)?supplied:82,
    source:isPrinted,
    evidence:visibleText.filter(text=>text.toLowerCase().includes(String(value).toLowerCase()))
   };
  }
  return {
   fields,visibleText,logos,numbers,
   objects:cleanList(data.objects),colors:cleanList(data.colors),
   eraClues:cleanList(data.eraClues),mediaClues:cleanList(data.mediaClues),
   semanticDescription:String(data.semanticDescription||data.description||'').trim(),
   arrayProvenance:{
    visibleText:{source:'visible-text',confidence:96,evidence:visibleText},
    logos:{source:'printed-logo',confidence:98,evidence:logos},
    numbers:{source:'visible-text',confidence:96,evidence:numbers},
    objects:{source:'image-reader',confidence:82,evidence:cleanList(data.objects)},
    colors:{source:'image-reader',confidence:82,evidence:cleanList(data.colors)},
    eraClues:{source:'image-reader',confidence:82,evidence:cleanList(data.eraClues)},
    mediaClues:{source:'image-reader',confidence:82,evidence:cleanList(data.mediaClues)}
   }
  };
 }
 function addUserOverride(evidence,field,value){
  if(!FIELDS.includes(field))return evidence;
  const text=String(value??'').trim();
  const override={value:text,confidence:100,source:'user-correction',evidence:['user-entered correction']};
  const out=merge(evidence,{fields:{[field]:override}});
  out.userOverrides={...out.userOverrides,[field]:override};
  out[field]=text;
  out.confidence[field]=100;
  out.provenance[field]=override;
  return out;
 }
 function clearUserOverride(evidence,field){
  if(!FIELDS.includes(field)||!evidence?.userOverrides?.[field])return evidence;
  const out={...evidence,confidence:{...evidence.confidence},provenance:{...evidence.provenance},userOverrides:{...evidence.userOverrides}};
  const previous=(evidence.conflicts||[]).filter(item=>item.field===field&&item.kept?.source==='user-correction'&&item.rejected?.source!=='user-correction')
   .map(item=>item.rejected).sort((a,b)=>Number(b.confidence||0)-Number(a.confidence||0))[0];
  delete out.userOverrides[field];
  if(previous){
   out[field]=previous.value;out.confidence[field]=previous.confidence;out.provenance[field]=previous;
  }else{
   out[field]='';out.confidence[field]=0;out.provenance[field]=null;
  }
  return out;
 }
 function fromComparison(comparison={}){
  const confidence=Math.max(0,Math.min(100,Number(comparison.confidence)||0));
  const fields={};
  for(const field of ['title','context','brand','series','date','category']){
   if(comparison[field])fields[field]={value:comparison[field],confidence,source:'image-comparison',evidence:cleanList(comparison.evidence)};
  }
  return {fields,imageComparison:comparison};
 }
 function fromWeb(matches=[]){
  return {
   webMatches:Array.isArray(matches)?matches:[],
   arrayProvenance:{webMatches:{source:'web-search',confidence:SOURCES['web-search'],evidence:(Array.isArray(matches)?matches:[]).map(item=>item.title||item.url).filter(Boolean)}}
  };
 }
 function fromGPT(data={}){
  const fields={};
  for(const field of FIELDS){
   if(!data[field])continue;
   fields[field]={value:data[field],confidence:data.confidence?.[field]??42,source:'gpt-interpreter',evidence:[]};
  }
  return {fields};
 }
 return {FIELDS,SOURCES,create,merge,fromVision,fromComparison,fromWeb,fromGPT,addUserOverride,clearUserOverride};
});
