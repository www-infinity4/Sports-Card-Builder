const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const adapter=fs.readFileSync(path.join(__dirname,'..','public','cloudflare-card-services.js'),'utf8');

test('full image read sends rich instructions and requires service confirmation',()=>{
 assert.match(app,/form\.append\('purpose',review\?'review':'full-read'\)/);
 assert.match(app,/form\.append\('detail','full'\)/);
 assert.match(app,/form\.append\('instructions',FULL_READ_INSTRUCTIONS\)/);
 assert.match(app,/SERVICES\.inspectImage\(\{body:form\}\)/);
 assert.match(adapter,/imageRead:'\/v1\/image-read'/);
 assert.match(adapter,/CONTRACTS=Object\.freeze\(\{imageRead:'full-read-v2'/);
 assert.match(app,/d\.contract!=='full-read-v2'/);
 assert.match(app,/d\.instructionsApplied!==true/);
 assert.match(app,/Number\(d\.passes\|\|0\)<2/);
});

test('image comparison rejects a stale service contract',()=>{
 assert.match(app,/out\.contract!=='image-compare-v2'/);
 assert.match(app,/out\.instructionsApplied!==true/);
 assert.match(app,/candidates\.length/);
 assert.match(app,/SERVICES\.compareImageCandidates\(\{body:form\}\)/);
 assert.match(adapter,/imageCompare:'\/v1\/image-compare'/);
});

test('Cloudflare endpoints do not appear as scattered app URL strings',()=>{
 assert.doesNotMatch(app,/https:\/\/infinity-rogers\.marvaseater\.workers\.dev/);
 assert.doesNotMatch(app,/https:\/\/orange-brook-a2ac\.marvaseater\.workers\.dev\/search/);
});
