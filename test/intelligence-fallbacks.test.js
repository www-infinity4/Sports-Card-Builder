const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
function load(start,end,values){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'application function exists');
 const context=vm.createContext(values);
 vm.runInContext(app.slice(a,b),context);
 return context;
}

function imageSearchHarness(overrides={}){
 const services={
  chat:async()=>{throw new Error('GPT unavailable')},
  searchWeb:async()=>{throw new Error('SearXNG unavailable')},
  compareImageCandidates:async()=>{throw new Error('image comparison unavailable')},
  ...overrides
 };
 return load('async function fetchImageSearchComparison','function mergeImageComparison',{
  asTextArray:value=>Array.isArray(value)?value.map(String):typeof value==='string'?[value]:[],
  firstText:value=>Array.isArray(value)?String(value[0]||''):'',
  normalizedName:value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),
  TEMPLATE_DB:{detectCategory:()=> 'sports'},
  SERVICES:services,
  prepareTransportImage:async blob=>blob,
  $:()=>({value:'',textContent:''}),
  console:{warn(){}}
 });
}

test('SearXNG outage leaves image comparison optional and non-blocking',async()=>{
 const context=imageSearchHarness();
 const comparison=await context.fetchImageSearchComparison({
  visibleText:['PINK FLOYD'],titleOptions:['PINK FLOYD'],keywords:['music']
 },new Blob(['image']));
 assert.equal(comparison,null);
});

test('image comparison outage leaves OCR fields available',async()=>{
 const context=imageSearchHarness({
  searchWeb:async query=>({
   ok:true,json:async()=>({results:[{
    title:'Pink Floyd card',url:'https://example.test/card',
    img_src:'https://example.test/card.jpg',content:'printed collectible card'
   }]})
  })
 });
 const comparison=await context.fetchImageSearchComparison({
  visibleText:['PINK FLOYD'],titleOptions:['PINK FLOYD'],keywords:['music']
 },new Blob(['image']));
 assert.equal(comparison,null);
});

test('web context search and GPT query planning outages return no results without throwing',async()=>{
 const context=load('async function fetchWebContextForImage','async function fetchImageSearchComparison',{
  asTextArray:value=>Array.isArray(value)?value.map(String):typeof value==='string'?[value]:[],
  firstText:value=>Array.isArray(value)?String(value[0]||''):'',
  normalizedName:value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),
  SERVICES:{
   chat:async()=>{throw new Error('GPT unavailable')},
   searchWeb:async()=>{throw new Error('SearXNG unavailable')}
  },
  $:()=>({value:'PINK FLOYD'}),
  console:{warn(){}}
 });
 const results=await context.fetchWebContextForImage({visibleText:['PINK FLOYD']});
 assert.equal(results.length,0);
});
