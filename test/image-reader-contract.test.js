const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');

test('full image read sends rich instructions and requires service confirmation',()=>{
 assert.match(app,/form\.append\('purpose',review\?'review':'full-read'\)/);
 assert.match(app,/form\.append\('detail','full'\)/);
 assert.match(app,/form\.append\('instructions',FULL_READ_INSTRUCTIONS\)/);
 assert.match(app,/d\.contract!=='full-read-v2'/);
 assert.match(app,/d\.instructionsApplied!==true/);
 assert.match(app,/Number\(d\.passes\|\|0\)<2/);
});

test('image comparison rejects a stale service contract',()=>{
 assert.match(app,/out\.contract!=='image-compare-v2'/);
 assert.match(app,/out\.instructionsApplied!==true/);
 assert.match(app,/candidates\.length/);
});
