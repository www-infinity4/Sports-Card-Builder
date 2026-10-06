const test=require('node:test');
const assert=require('node:assert/strict');
const Services=require('../public/cloudflare-card-services');

test('current service contracts have centralized endpoints and request metadata',async t=>{
 const previous=global.fetch;
 const seen=[];
 global.fetch=async(url,options)=>{
  seen.push({url,options});
  return {ok:true,status:200};
 };
 t.after(()=>{global.fetch=previous});
 await Services.inspectImage({body:new FormData(),requestId:'reader-request'});
 assert.equal(seen[0].url,Services.BASE_URL+Services.ENDPOINTS.imageRead);
 assert.equal(seen[0].options.headers.get('X-Oracle-Contract'),'full-read-v2');
 assert.equal(seen[0].options.headers.get('X-Request-ID'),'reader-request');
 assert.ok(seen[0].options.headers.get('Idempotency-Key'));
 assert.equal(Services.ENDPOINTS.imageCompare,'/v1/image-compare');
 assert.equal(Services.ENDPOINTS.cardIntel,'/v1/card-intel');
 assert.equal(Services.ENDPOINTS.workersImage,'/v1/image');
 assert.equal(Services.ENDPOINTS.comfyImage,'/v1/comfy-image');
});

test('reader, compare, search, intel, Workers AI, and Comfy outages normalize consistently',async t=>{
 const previous=global.fetch;
 global.fetch=async()=>{throw new TypeError('network unavailable')};
 t.after(()=>{global.fetch=previous});
 const attempts=[
  Services.inspectImage({body:new FormData()}),
  Services.compareImageCandidates({body:new FormData()}),
  Services.fetchCardIntel('named baseball player'),
  Services.renderWorkersAI({body:new FormData()}),
  Services.renderComfy({body:'{}'}),
  Services.searchWeb('1987 Topps')
 ];
 const failures=await Promise.all(attempts.map(p=>assert.rejects(p,/service_unavailable/)));
 assert.equal(failures.length,6);
 assert.ok(Services.diagnostics().slice(-6).every(request=>request.ok===false));
});

test('future canonical routes remain honestly unavailable; Comfy accepts one reference',()=>{
 const capabilities=Services.capabilities();
 assert.equal(capabilities.current.imageRead.implemented,true);
 assert.equal(capabilities.current.imageRead.healthy,'unknown');
 assert.equal(capabilities.current.comfyImage.referenceImages,1);
 assert.equal(capabilities.twoImage.comfy,'unavailable');
 assert.ok(capabilities.futureAliases.every(alias=>alias.implemented===false&&alias.status==='unavailable'));
});
