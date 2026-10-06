const test=require('node:test');
const assert=require('node:assert/strict');
const back=require('../public/card-back');

for(const [category,format] of [['sports','stats'],['movie','movie-tv'],['tv','movie-tv'],['music','discography'],['product','product'],['generic','biography']]){
 test(category+' selects '+format,()=>assert.equal(back.formatFor({category}),format));
}
test('explicit formats and legacy bio alias are supported',()=>{
 for(const format of back.FORMATS)assert.equal(back.formatFor({backFormat:format}),format);
 assert.equal(back.formatFor({backFormat:'bio'}),'biography');
 assert.equal(back.formatFor({story:'Verified story'}),'story');
});
test('long data omits complete weaker facts without overflow or losing legal text and numbering',()=>{
 const data={title:'A factual title',category:'music',cardNumber:'8 / 8',
  copyrightText:'Copyright supplied by the user',footerText:'Footer '+('legal words '.repeat(40)),
  facts:Array.from({length:40},(_,i)=>({text:'Fact '+i+' '+('evidence '.repeat(20)),confidence:i===39?99:10})),
  biography:'Biography '.repeat(500)};
 const result=back.layout(data);
 assert.ok(result.omittedFields.length);
 assert.ok(result.commands.some(c=>c.field==='facts[39]'));
 assert.equal(result.commands.find(c=>c.field==='cardNumber').lines.join(' '),'8 / 8');
 const legal=result.commands.find(c=>c.field==='footerText').lines.join(' ');
 assert.ok(legal.includes(data.copyrightText));
 assert.equal(legal, [data.copyrightText,data.footerText].join(' ').trim());
 for(const command of result.commands){
  assert.ok(command.size>=13);
  for(const line of command.lines)assert.ok(line.length*command.size*.6<=result.width-result.margin*2);
  assert.ok(command.y-command.size>=0);
  assert.ok(command.y+Math.max(0,command.lines.length-1)*(command.size+5)<result.height);
 }
 assert.deepEqual(back.layout(data),result);
});
test('unbroken strings wrap within card boundaries',()=>{
 const result=back.layout({title:'A'.repeat(300),cardNumber:'1 / 8'});
 for(const command of result.commands)for(const line of command.lines)assert.ok(line.length*command.size*.6<=660);
});
test('impossible required text fails explicitly rather than clipping',()=>{
 assert.throws(()=>back.layout({footerText:'legal '.repeat(10000)}),/required_text_exceeds/);
});
test('entertainment has no baseball stat boxes',()=>{
 const sections=back.sections({category:'movie',story:'Supported scene',stats:[{homeRuns:99}]},'movie-tv');
 assert.ok(sections.some(s=>s.field==='story'));
 assert.ok(!sections.some(s=>s.field.startsWith('stats')));
});
test('renderer uses template vintage palette and sharp geometry',()=>{
 const drawn=[];
 const ctx={fillRect(){},strokeRect(){},measureText:t=>({width:t.length*8}),fillText:(...args)=>drawn.push(args)};
 const canvas={width:750,height:1050,getContext:()=>ctx,toDataURL:()=> 'back-image'};
 const rendered=back.render(canvas,{title:'Verified title',cardNumber:'1 / 1',footerText:'Legal'},
  {template:{year:1952,palette:['#eee','#900'],designData:{cornerTreatment:'sharp'}}});
 assert.equal(rendered.treatment.vintage,true);
 assert.equal(rendered.treatment.font,'Georgia');
 assert.equal(rendered.treatment.corners,'sharp');
 assert.equal(rendered.image,'back-image');
 assert.ok(drawn.some(([text])=>text==='Legal'));
});
