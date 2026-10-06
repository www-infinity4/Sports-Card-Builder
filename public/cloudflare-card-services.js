(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OracleCloudflareCardServices=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';

 const BASE_URL='https://infinity-rogers.marvaseater.workers.dev';
 const SEARCH_URL='https://orange-brook-a2ac.marvaseater.workers.dev/search';
 const ENDPOINTS=Object.freeze({
  chat:'/v1/chat',
  imageRead:'/v1/image-read',
  imageCompare:'/v1/image-compare',
  cardIntel:'/v1/card-intel',
  workersImage:'/v1/image',
  comfyImage:'/v1/comfy-image',
  localComfy:'/api/render/comfy',
  localHealth:'/api/renderer/health',
  codePhi:'https://orange-brook-a2ac.marvaseater.workers.dev/code-phi/inspect',
  search:SEARCH_URL
 });
 const CONTRACTS=Object.freeze({imageRead:'full-read-v2',imageCompare:'image-compare-v2'});
 const TIMEOUTS=Object.freeze({chat:25000,imageRead:45000,imageCompare:45000,cardIntel:4500,workersImage:150000,comfyImage:150000,search:12000});
 const FUTURE_ALIASES=Object.freeze([
  '/v1/vision/inspect','/v1/vision/compare','/v1/vision/segment','/v1/workflow/card',
  '/v1/render/card','/v1/render/animate','/v1/validate/card'
 ]);
 const history=[];
 let counter=0;
 function id(){
  try{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID()}catch{}
  return 'oracle-'+Date.now().toString(36)+'-'+(++counter).toString(36)+'-'+Math.random().toString(36).slice(2,10);
 }
 const CLIENT_ID_KEY='oracle-card-client-id-v1';
 let stableClientId='';
 function clientId(){
  if(stableClientId)return stableClientId;
  let saved='';
  try{if(typeof localStorage!=='undefined')saved=String(localStorage.getItem(CLIENT_ID_KEY)||'')}catch{}
  if(/^oracle-card-[a-z0-9-]{8,}$/i.test(saved))return (stableClientId=saved);
  stableClientId='oracle-card-'+id();
  try{if(typeof localStorage!=='undefined')localStorage.setItem(CLIENT_ID_KEY,stableClientId)}catch{}
  return stableClientId;
 }
 function endpointUrl(key){
  if(!Object.hasOwn(ENDPOINTS,key))throw new Error('unknown_service_endpoint:'+key);
  const path=ENDPOINTS[key];
  if(key==='search'||key==='codePhi')return path;
  if(key==='search')return path;
  if(key==='localComfy'||key==='localHealth'){
   return typeof location!=='undefined'?new URL(path,location.origin).toString():path;
  }
  return BASE_URL+path;
 }
 function normalizeError(error,endpoint,status=0,requestId=''){
  const timeout=error?.name==='AbortError'||String(error?.message||'').includes('service_timeout');
  const normalized=new Error((timeout?'service_timeout:':'service_unavailable:')+endpoint);
  normalized.name='CardServiceError';
  normalized.code=timeout?'service_timeout':'service_unavailable';
  normalized.endpoint=endpoint;
  normalized.status=Number(status)||0;
  normalized.requestId=requestId;
  normalized.cause=error;
  return normalized;
 }
 async function request(key,options={}){
  const timeoutMs=Math.max(1,Number(options.timeoutMs)||TIMEOUTS[key]||8000);
  const requestId=options.requestId||id();
  const idempotencyKey=options.idempotencyKey||id();
  const maxRetries=Math.max(0,Math.min(2,Number(options.retries)||0));
  const method=String(options.method||'GET').toUpperCase();
  const headers=new Headers(options.headers||{});
  // Orange Brook's public search/browser endpoints allow standard headers only.
  // Rogers allows Oracle's request tracking and anonymous per-browser quota identity.
  if(key!=='search'&&key!=='codePhi'){
   headers.set('X-Request-ID',requestId);
   headers.set('Idempotency-Key',idempotencyKey);
   headers.set('X-Oracle-Contract',options.contract||'card-services-v1');
   if(key!=='localComfy'&&key!=='localHealth')headers.set('X-Infinity-User',clientId());
  }
  let attempt=0;
  while(true){
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),timeoutMs);
   const started=Date.now();
   try{
    const requestOptions={...options};
    for(const key of ['fetch','url','timeoutMs','retries','contract','requestId','idempotencyKey'])delete requestOptions[key];
    const response=await (options.fetch||fetch)(options.url||endpointUrl(key),{
     ...requestOptions,headers,method,signal:controller.signal
    });
    history.push({requestId,endpoint:key,method,status:response.status,ok:response.ok,attempts:attempt+1,durationMs:Date.now()-started});
    if(history.length>100)history.shift();
    if(!response.ok&&attempt<maxRetries&&(method==='GET'||Boolean(idempotencyKey))){
     attempt++;continue;
    }
    return response;
   }catch(error){
    history.push({requestId,endpoint:key,method,status:0,ok:false,attempts:attempt+1,durationMs:Date.now()-started,error:String(error?.name||'network_error')});
    if(history.length>100)history.shift();
    if(attempt<maxRetries&&(method==='GET'||Boolean(idempotencyKey))){attempt++;continue}
    throw normalizeError(error,key,0,requestId);
   }finally{clearTimeout(timer)}
  }
 }
 function chat(input,context={},options={}){
  return request('chat',{
   method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({input,context}),timeoutMs:options.timeoutMs||TIMEOUTS.chat,
   retries:options.retries||0,requestId:options.requestId
  });
 }
 function inspectImage({body,review=false,timeoutMs,requestId}={}){
  return request('imageRead',{
   method:'POST',body,timeoutMs:timeoutMs||(review?22000:TIMEOUTS.imageRead),
   contract:CONTRACTS.imageRead,requestId,retries:review?0:1
  });
 }
 function inspectFinishedCard(options={}){
  return inspectImage({...options,review:true});
 }
 function compareImageCandidates({body,requestId,timeoutMs}={}){
  return request('imageCompare',{method:'POST',body,contract:CONTRACTS.imageCompare,requestId,retries:1,timeoutMs});
 }
 function fetchCardIntel(name,{requestId}={}){
  return request('cardIntel',{
   method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({name}),requestId
  });
 }
 function renderWorkersAI({body,requestId}={}){
  return request('workersImage',{method:'POST',body,requestId,retries:0});
 }
 function renderComfy({body,requestId,local=false}={}){
  return request(local?'localComfy':'comfyImage',{
   method:'POST',headers:{'Content-Type':'application/json'},body,requestId,retries:0
  });
 }
 async function searchWeb(query,{images=false,timeoutMs=TIMEOUTS.search,fetch:fetchImpl}={}){
  const term=String(query||'').trim();
  const url=new URL(ENDPOINTS.search);
  url.search=new URLSearchParams({
   q:term,format:'json',safesearch:'1',
   ...(images?{categories:'images'}:{})
  });
  try{
   const primary=await request('search',{headers:{Accept:'application/json'},timeoutMs,fetch:fetchImpl,method:'GET',url:url.toString()});
   if(primary.ok)return primary;
  }catch(error){
   // An offline Orange Brook Container must not erase the evidence from the image reader.
  }
  // Clearly identified backup: Wikimedia's public search APIs, NOT a fake SearXNG response.
  const wiki=new URL(images?'https://commons.wikimedia.org/w/api.php':'https://en.wikipedia.org/w/api.php');
  wiki.search=images?new URLSearchParams({
   action:'query',generator:'search',gsrsearch:term,gsrnamespace:'6',gsrlimit:'12',
   prop:'imageinfo',iiprop:'url',iiurlwidth:'640',format:'json',origin:'*'
  }):new URLSearchParams({
   action:'query',list:'search',srsearch:term,srlimit:'12',format:'json',origin:'*'
  });
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(1000,timeoutMs));
  try{
   const r=await (fetchImpl||fetch)(wiki.toString(),{headers:{Accept:'application/json'},signal:controller.signal});
   if(!r.ok)throw new Error('wikimedia_fallback_http_'+r.status);
   const data=await r.json();
   if(data?.error)throw new Error('wikimedia_fallback_api_error');
   let results=[];
   if(images){
    results=Object.values(data?.query?.pages||{}).map(page=>{
     const file=page?.imageinfo?.[0]||{};
     const image=String(file.thumburl||file.url||'');
     const title=String(page?.title||'').replace(/^File:/,'');
     return {title,url:String(file.descriptionurl||file.url||''),img_src:image,thumbnail:image,content:'Wikimedia Commons file search result',source:'wikimedia-commons'};
    }).filter(item=>/^https:\/\//.test(item.img_src)&&!(/\.svg(?:[?#]|$)/i.test(item.img_src))).slice(0,12);
   }else{
    results=(data?.query?.search||[]).map(item=>({
     title:String(item.title||''),
     url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(item.title||'').replace(/ /g,'_')),
     content:String(item.snippet||'').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim(),
     source:'wikipedia'
    })).filter(item=>item.title);
   }
   history.push({requestId:id(),endpoint:'search',method:'GET',status:200,ok:true,provider:'wikimedia-fallback',count:results.length});
   if(history.length>100)history.shift();
   return new Response(JSON.stringify({results,query:term,provider:'wikimedia-fallback',primary:'orange-brook-unavailable'}),{
    status:200,headers:{'Content-Type':'application/json','X-Oracle-Search-Fallback':'wikimedia'}
   });
  }catch(error){
   throw normalizeError(error,'search');
  }finally{clearTimeout(timer)}
 }
 function capabilities(){
  return {
   current:{
    imageRead:{implemented:true,configured:true,healthy:'unknown',endpoint:endpointUrl('imageRead'),contract:CONTRACTS.imageRead},
    imageCompare:{implemented:true,configured:true,healthy:'unknown',endpoint:endpointUrl('imageCompare'),contract:CONTRACTS.imageCompare},
    cardIntel:{implemented:true,configured:true,healthy:'unknown',endpoint:endpointUrl('cardIntel')},
    workersImage:{implemented:true,configured:true,healthy:'unknown',endpoint:endpointUrl('workersImage')},
    comfyImage:{implemented:true,configured:true,healthy:'unknown',endpoint:endpointUrl('comfyImage'),referenceImages:1},
    localComfy:{implemented:true,configured:'runtime-check',healthy:'unknown',endpoint:ENDPOINTS.localComfy,referenceImages:1}
   },
   futureAliases:FUTURE_ALIASES.map(endpoint=>({endpoint,implemented:false,configured:false,healthy:false,status:'unavailable'})),
   twoImage:{workersAI:'supported-by-adapter',comfy:'unavailable',fallback:'route two-reference jobs through Workers AI'},
   requests:history.slice(-20)
  };
 }
 function diagnostics(){return history.slice(-50).map(item=>({...item}))}
 return {
  BASE_URL,SEARCH_URL,ENDPOINTS,CONTRACTS,TIMEOUTS,FUTURE_ALIASES,
  request,normalizeError,chat,inspectImage,inspectFinishedCard,compareImageCandidates,fetchCardIntel,
  renderWorkersAI,renderComfy,searchWeb,capabilities,diagnostics
 };
});
