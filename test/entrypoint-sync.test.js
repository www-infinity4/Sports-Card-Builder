const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('GitHub Pages root entrypoint mirrors the current Card Studio UI and module bundle',()=>{
 const repo=path.join(__dirname,'..');
 const publicHtml=fs.readFileSync(path.join(repo,'public','index.html'),'utf8');
 const rootHtml=fs.readFileSync(path.join(repo,'index.html'),'utf8');
 const expected=publicHtml.replace(/<script src="\.\//g,'<script src="./public/');
 assert.equal(rootHtml,expected,'Root page must mirror public/index.html with corrected script paths');
 for(const file of ['card-evidence.js','cloudflare-card-services.js','card-data-stream.js','card-studio-api.js']){
  assert.ok(publicHtml.includes('./'+file+'?'),'Missing active module: '+file);
  assert.ok(rootHtml.includes('./public/'+file+'?'),'Missing root module: '+file);
 }
});
