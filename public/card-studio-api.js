(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OracleCardStudio=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';

 const artifacts=new Map(),cardData=new Map(),adapters=new Map();
 const options={};
 const PURPOSES=['movie-watcher','advertising','website','collection','custom'];
 const FOCUS={
  'movie-watcher':['Overview','Characters','Story','Locations','Themes','Memorable moments'],
  advertising:['Product','Benefits','Features','Audience','Offer','Call to action'],
  website:['Homepage','About','Services','Portfolio','Resources','Contact'],
  collection:['Overview','Origins','Milestones','Details','Legacy','Highlights'],
  custom:['Overview','Background','Details','Highlights','Context','Perspective']
 };
 let activeAdapter=null,busy=false,sequence=0;

 function error(code){const e=new Error(code);e.code=code;return e}
 function clone(value){
  if(value===undefined)return undefined;
  if(typeof structuredClone==='function')return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
 }
 function dependency(key,globalName,path){
  if(Object.hasOwn(options,key))return options[key];
  if(root[globalName])return root[globalName];
  if(typeof require==='function'&&path){
   try{return require(path)}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e}
  }
  return null;
 }
 function dataStream(){return dependency('dataStream','OracleCardDataStream','./card-data-stream')}
 function back(){return dependency('cardBack','OracleCardBack','./card-back')}
 function services(){return dependency('services','OracleCloudflareCardServices','./cloudflare-card-services')}
 function renderer(){return dependency('render','OracleCardRender')||root.OracleCardRenderer||null}
 function status(implemented,configured,health='unknown'){
  return {implemented:Boolean(implemented),configured:Boolean(configured),healthy:health,
   status:!implemented||!configured?'unavailable':health===true?'healthy':health===false?'degraded':'configured'};
 }
 function capabilities(){
  const stream=dataStream(),cardBack=back(),render=renderer(),service=services();
  let serviceCaps={},adapterCaps={};
  try{serviceCaps=clone(service?.capabilities?.()||{})}catch{serviceCaps={status:'degraded'}}
  try{adapterCaps=activeAdapter?.capabilities?.()||{}}catch{adapterCaps={status:'degraded'}}
  const current=serviceCaps.current||{};
  const observations=serviceCaps.requests||[];
  for(const [name,entry] of Object.entries(current)){
   const last=[...observations].reverse().find(item=>item.endpoint===name);
   const health=last&&typeof last.ok==='boolean'?last.ok:entry.healthy===true||entry.healthy===false?entry.healthy:'unknown';
   current[name]={...entry,...status(entry.implemented,entry.configured===true,health),
    configured:entry.configured??false};
  }
  return clone({
   schema:'phi.card-studio-capabilities/v1',
   id:'card-studio',implemented:true,
   tasks:['card','card-front','card-back','card-set','reference-card','advertising-card'],
   dependencies:{
    imageRead:current.imageRead||status(false,false),
    imageRender:current.workersImage||current.comfyImage||status(false,false),
    browserValidation:status(true,typeof activeAdapter?.build==='function')
   },
   api:status(true,true,true),
   dataStream:status(typeof stream?.build==='function',typeof stream?.build==='function'),
   cardBack:status(typeof cardBack?.formatFor==='function',typeof cardBack?.formatFor==='function'),
   render:status(typeof render==='function'||typeof render?.render==='function',Boolean(render)),
   build: {...status(true,typeof activeAdapter?.build==='function',activeAdapter?.observedHealth??'unknown'),busy,adapter:activeAdapter?.name||null},
   setManifest:{...status(true,true,true),purposes:[...PURPOSES],maxCount:100},
   services:serviceCaps,
   adapter:adapterCaps
  });
 }
 function registerAdapter(name,adapter){
  if(typeof name!=='string'||!name.trim()||typeof adapter?.build!=='function')throw error('invalid_build_adapter');
  if(busy)throw error('build_in_progress');
  adapters.set(name,{...adapter,name,observedHealth:'unknown'});
  return name;
 }
 function configure(config={}){
  if(busy)throw error('build_in_progress');
  if(!config||typeof config!=='object')throw error('invalid_configuration');
  if(Object.hasOwn(config,'build')){
   if(config.build===null)activeAdapter=null;
   else{
    registerAdapter('configured',{build:config.build,capabilities:config.capabilities});
    activeAdapter=adapters.get('configured');
   }
  }
  if(Object.hasOwn(config,'adapter')){
   if(config.adapter===null)activeAdapter=null;
   else if(typeof config.adapter==='string'){
    if(!adapters.has(config.adapter))throw error('unknown_build_adapter');
    activeAdapter=adapters.get(config.adapter);
   }else{
    registerAdapter(config.adapter.name||'configured',config.adapter);
    activeAdapter=adapters.get(config.adapter.name||'configured');
   }
  }
  if(config.capabilities&&!Object.hasOwn(config,'build')&&activeAdapter)activeAdapter={...activeAdapter,capabilities:config.capabilities};
  for(const key of ['dataStream','cardBack','render','services']){
   if(Object.hasOwn(config,key))options[key]=config[key];
  }
  return capabilities();
 }
 function buildRequest(input={}){
  const stream=dataStream();
  if(typeof stream?.build!=='function')throw error('card_data_stream_unavailable');
  if(!input||typeof input!=='object'||Array.isArray(input))throw error('invalid_build_input');
  const original=clone(input);
  const normalized=stream.build({...clone(original),state:clone(original.state??original)});
  return clone({schema:'phi.card-build-request/v1',input:original,cardData:normalized});
 }
 function metadata(value){
  if(value===null||value===undefined)return value;
  if(typeof value==='string')return /^\s*(?:data:image\/|blob:)/i.test(value)?undefined:value;
  if(typeof value!=='object')return value;
  if((typeof Blob!=='undefined'&&value instanceof Blob)||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return undefined;
  if(Array.isArray(value))return value.map(metadata).filter(item=>item!==undefined);
  const out={};
  for(const [key,item] of Object.entries(value)){
   if(/^(?:image|images|photo|photos|blob|blobs|base64|bytes|buffer|payload|dataURI|dataURL|imageData|imagePayload|frontImage|backImage|referenceImage|referenceImages|artImage|artwork)$/i.test(key)||/(?:base64|payload|imageBytes|imageBuffer)$/i.test(key))continue;
   const cleaned=metadata(item);
   if(cleaned!==undefined)Object.defineProperty(out,key,{value:cleaned,enumerable:true,writable:true,configurable:true});
  }
  return out;
 }
 function recordArtifact(output,request){
  if(!output||typeof output!=='object')throw error('invalid_build_output');
  const image=output.front?.image??output.frontImage??(typeof output.front==='string'?output.front:undefined)??output.dataURI;
  if(typeof image!=='string'||!image.trim())throw error('missing_front_image');
  const priorData=output.id==null?undefined:cardData.get(String(output.id));
  const data=clone(output.cardData??output.data??priorData??request?.cardData??output.back?.data??request??{});
  const build=output.build||{};
  const createdAt=build.createdAt??output.createdAt??request?.input?.createdAt??new Date().toISOString();
  const buildId=build.buildId??output.buildId??'build-'+(++sequence);
  const id=String(output.id??(data.cardId||data.id||'card-'+buildId+'-'+(++sequence)));
  const setId=output.setId??data.setId??null;
  data.cardId=id;
  data.setId=setId==null?'':String(setId);
  const cardBack=back();
  const backData=output.back?.data??data.back??data;
  const normalizedBackData=backData&&typeof backData==='object'&&!Array.isArray(backData)?
   {...backData,cardId:id,setId:data.setId}:backData;
  const artifact={
   schema:'phi.card-artifact/v1',id,setId:setId==null?null:String(setId),
   front:{image,templateId:output.front?.templateId??output.templateId??data.templateId??null,
    renderPath:output.front?.renderPath??output.renderPath??output.rendererPath??build.renderer??null},
   back:{image:output.back?.image??output.backImage??(typeof output.back==='string'?output.back:null),
    format:output.back?.format??(typeof cardBack?.formatFor==='function'?cardBack.formatFor(clone(data)):null),
    data:metadata(normalizedBackData),
    omittedFields:metadata(output.back?.omittedFields??output.omittedFields??[])},
   evidence:metadata(output.evidence??data.evidence??request?.input?.evidence??{}),
   sources:metadata(output.sources??data.sources??[]),
   provenance:metadata(output.provenance??data.provenance??{}),
   build:{buildId,createdAt,renderer:build.renderer??output.renderer??output.rendererPath??null,
    validation:metadata(build.validation??output.validation??null)}
  };
  artifacts.set(id,clone(artifact));
  cardData.set(id,clone(data));
  return clone(artifact);
 }
 async function buildCard(input={}){
  if(busy)throw error('build_in_progress');
  if(typeof activeAdapter?.build!=='function')throw error('build_adapter_unavailable');
  busy=true;
  let invoked=false;
  try{
   const request=buildRequest(input);
   invoked=true;
   const output=await activeAdapter.build(clone(request));
   const artifact=recordArtifact(output,request);
   activeAdapter.observedHealth=true;
   return artifact;
  }catch(e){
   if(invoked)activeAdapter.observedHealth=false;
   throw e;
  }finally{busy=false}
 }
 function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
 }
 function hash(value){
  let h=2166136261;
  for(const char of canonical(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
 }
 function merge(a,b){
  const result=clone(a||{});
  for(const [key,value] of Object.entries(b||{})){
   Object.defineProperty(result,key,{value:value&&typeof value==='object'&&!Array.isArray(value)&&a?.[key]&&typeof a[key]==='object'&&!Array.isArray(a[key])?merge(a[key],value):clone(value),enumerable:true,writable:true,configurable:true});
  }
  return result;
 }
 function buildSetManifest(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw error('invalid_set_input');
  const purpose=input.purpose||'collection';
  if(!PURPOSES.includes(purpose))throw error('invalid_set_purpose');
  const provided=input.subjects??input.cards;
  if(provided!==undefined&&!Array.isArray(provided))throw error('invalid_set_subjects');
  const count=input.count??provided?.length??1;
  if(!Number.isInteger(count)||count<1||count>100)throw error('invalid_set_count');
  if(provided&&provided.length!==count)throw error('subject_count_mismatch');
  const subject=String(input.subject||input.title||input.description||'').trim();
  if(!provided&&!subject)throw error('set_subject_required');
  const theme=clone(input.theme||{});
  const numbering=typeof input.numbering==='string'?{format:input.numbering}:clone(input.numbering||{});
  const start=numbering.start??1;
  if(!Number.isInteger(start)||start<1)throw error('invalid_numbering_start');
  const format=numbering.format||numbering.style||'fraction';
  if(!['fraction','prefix'].includes(format))throw error('invalid_numbering_format');
  const total=numbering.total??start+count-1;
  if(!Number.isInteger(total)||total<start+count-1)throw error('invalid_numbering_total');
  const prefix=String(numbering.prefix??input.prefix??'CARD');
  const entries=Array.from({length:count},(_,i)=>{
   const focus=FOCUS[purpose][i%FOCUS[purpose].length]+(i>=FOCUS[purpose].length?' '+(Math.floor(i/FOCUS[purpose].length)+1):'');
   const entry=provided?provided[i]:{subject:count===1?subject:subject+' — '+focus,focus};
   const value=typeof entry==='string'?{subject:entry}:clone(entry);
   if(!value||typeof value!=='object'||Array.isArray(value))throw error('invalid_set_subject');
   const override=merge(value.overrides,input.overrides?.[i]??input.perCard?.[i]);
   const result=merge(value,override);
   delete result.overrides;
   const correctedSubject=result.userOverrides?.subject;
   result.subject=String(correctedSubject?.value??correctedSubject??result.subject??result.title??result.name??'').trim();
   if(!result.subject)throw error('set_subject_required');
   return result;
  });
  function contentKey(entry){
   const content={};
   for(const field of ['subject','title','context','focus','instruction','description','story','biography','facts','timeline','highlights','credits']){
    const corrected=entry.userOverrides?.[field];
    const value=corrected?.value??corrected??entry[field]??entry.identity?.[field]??'';
    content[field]=typeof value==='string'?value.trim().toLowerCase().replace(/\s+/g,' '):metadata(value);
   }
   return canonical(content);
  }
  if(new Set(entries.map(contentKey)).size!==count)throw error('duplicate_set_subject');
  const intent=metadata({...input,purpose,count,subjects:entries,theme,numbering:{format,start,total,prefix}});
  delete intent.createdAt;delete intent.cards;delete intent.id;
  const id='set-'+hash(intent);
  const createdAt=input.createdAt??new Date().toISOString();
  const cards=entries.map((entry,i)=>{
   const cardNumber=(format==='prefix'?prefix+'-':'')+(start+i)+(format==='fraction'?'/'+total:'');
   const request=merge(input.request,entry);
   request.purpose=purpose;
   request.theme=merge(theme,request.theme);
   request.cardNumber=cardNumber;
   request.identity=merge({title:request.title||entry.subject},request.identity);
   request.identity.cardNumber=cardNumber;
   request.userOverrides=merge(merge({title:request.identity.title},request.userOverrides),{subject:entry.subject,cardNumber});
   request.set={id,index:i+1,count};
   request.id=id+'-card-'+(i+1);
   request.cardId=request.id;
   request.setId=id;
   return {id:request.id,status:'pending',index:i+1,cardNumber,subject:entry.subject,request};
  });
  return clone({schema:'phi.card-set/v1',id,title:String(input.title??input.subject??'Card Set'),
   purpose,count,createdAt,theme,sources:metadata(input.sources??[]),
   numbering:{format,start,total,prefix},status:'pending',cards});
 }
 function getCardData(id){return clone(cardData.get(String(id))??null)}
 function getArtifact(id){return clone(artifacts.get(String(id))??null)}
 return {capabilities,configure,registerAdapter,buildRequest,buildCard,buildSetManifest,getCardData,getArtifact,recordArtifact};
});
