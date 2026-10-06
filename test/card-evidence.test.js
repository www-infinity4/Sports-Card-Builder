const test=require('node:test');
const assert=require('node:assert/strict');
const Evidence=require('../public/card-evidence');

test('printed title, maker, and year become high-confidence evidence',()=>{
 const evidence=Evidence.merge(Evidence.create(),Evidence.fromVision({
  visibleText:['PINK FLOYD','Topps 1987'],
  titleOptions:['PINK FLOYD']
 }));
 assert.equal(evidence.title,'PINK FLOYD');
 assert.equal(evidence.provenance.title.source,'visible-text');
 assert.equal(evidence.brand,'Topps');
 assert.equal(evidence.provenance.brand.source,'printed-logo');
 assert.equal(evidence.cardMaker,'Topps');
 assert.equal(evidence.cardYear,'1987');
 assert.equal(evidence.provenance.cardYear.source,'visible-text');
});

test('weaker web and comparison evidence cannot replace printed OCR and remains a conflict',()=>{
 const printed=Evidence.merge(Evidence.create(),Evidence.fromVision({
  visibleText:['PINK FLOYD'],titleOptions:['PINK FLOYD']
 }));
 const merged=Evidence.merge(printed,{
  fields:{title:{value:'Pink Floyd tribute band',confidence:18,source:'web-search',evidence:['weak result']}}
 });
 assert.equal(merged.title,'PINK FLOYD');
 assert.ok(merged.conflicts.some(conflict=>conflict.field==='title'&&conflict.rejected.value==='Pink Floyd tribute band'));
});

test('user corrections remain authoritative over later evidence',()=>{
 let evidence=Evidence.merge(Evidence.create(),Evidence.fromVision({
  visibleText:['PINK FLOYD'],titleOptions:['PINK FLOYD']
 }));
 evidence=Evidence.addUserOverride(evidence,'title','Pink Floyd (user correction)');
 evidence=Evidence.merge(evidence,{fields:{
  title:{value:'Pink Floyd',confidence:100,source:'image-comparison',evidence:['match']}
 }});
 assert.equal(evidence.title,'Pink Floyd (user correction)');
 assert.equal(evidence.provenance.title.source,'user-correction');
});

test('all image intelligence fields survive normalization with provenance',()=>{
 const evidence=Evidence.merge(Evidence.create(),Evidence.fromVision({
  visibleText:['BOWMAN','1991'],logos:['BOWMAN'],numbers:['17'],
  objects:['baseball bat'],colors:['red'],eraClues:['early 1990s'],
  mediaClues:['printed trading card'],semanticDescription:'A baseball card'
 }));
 assert.deepEqual(evidence.visibleText,['BOWMAN','1991']);
 assert.deepEqual(evidence.numbers,['17']);
 assert.deepEqual(evidence.objects,['baseball bat']);
 assert.deepEqual(evidence.colors,['red']);
 assert.deepEqual(evidence.eraClues,['early 1990s']);
 assert.deepEqual(evidence.mediaClues,['printed trading card']);
 assert.equal(evidence.semanticDescription,'A baseball card');
 assert.equal(evidence.provenance.visibleText.source,'visible-text');
 assert.equal(evidence.confidence.numbers,96);
});

test('clearing an explicit category override restores the evidence-backed category',()=>{
 let evidence=Evidence.merge(Evidence.create(),Evidence.fromVision({category:'sports'}));
 evidence=Evidence.addUserOverride(evidence,'category','movie');
 assert.equal(evidence.category,'movie');
 evidence=Evidence.clearUserOverride(evidence,'category');
 assert.equal(evidence.category,'sports');
 assert.equal(evidence.userOverrides.category,undefined);
});
