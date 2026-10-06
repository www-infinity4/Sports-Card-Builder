(function(root,factory){
 const stream=typeof module==='object'&&module.exports?require('./card-data-stream'):root.OracleCardDataStream;
 const api=factory(stream);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OracleCardBack=api;
})(typeof window!=='undefined'?window:globalThis,function(stream){
 'use strict';
 const FORMATS=['stats','biography','story','timeline','discography','movie-tv','product','compact-facts'];
 function formatFor(data={},intel){
  // Legacy callers pass state and intelligence instead of CardData.
  if(data.identity||data.detected)data=stream.build({state:data,intel});
  const requested=data.backFormat||data.format||'auto';
  const alias={bio:'biography',music:'discography','discography/music':'discography'};
  if(requested!=='auto'&&FORMATS.includes(alias[requested]||requested))return alias[requested]||requested;
  const type=(String(data.category)+' '+String(data.subjectType)).toLowerCase();
  if(/movie|tv|film|character|actor|television/.test(type))return 'movie-tv';
  if(/music|band|artist|singer|musician/.test(type))return 'discography';
  if(/product|advertis|commercial/.test(type))return 'product';
  if(/sports|baseball|athlete|player|pitcher/.test(type))return 'stats';
  return data.story?'story':'biography';
 }
 function buildData(state,intel,plan,options={}){
  const data=stream.build({...options,state,intel,plan});
  return {...data,format:formatFor(data),bio:data.biography,dateText:data.date||data.year,
   seasons:data.stats,selected:data.stats[0]||null};
 }
 function text(value){
  if(value==null)return '';
  if(typeof value!=='object')return String(value);
  if(value.text!=null)return String(value.text);
  if(value.value!=null)return [value.label,value.value].filter(v=>v!=null&&v!=='').join(': ');
  return Object.entries(value).filter(([key,v])=>!['confidence','source','provenance','verified','sources'].includes(key)&&v!=null&&typeof v!=='object')
   .map(([key,v])=>key+': '+v).join(' · ');
 }
 function sections(data,format){
  const entries=[];
  function add(field,label,value,priority){
   if(value==null||value==='')return;
   const values=Array.isArray(value)?value:[value];
   values.forEach((item,index)=>{
    const content=text(item);
    if(!content)return;
    const confidence=Number(item?.provenance?.confidence??item?.confidence??data.provenance?.[field]?.confidence??data.confidence?.[field]??0);
    entries.push({field:Array.isArray(value)?field+'['+index+']':field,label,text:content,priority,confidence});
   });
  }
  for(const [field,label] of [['subject','Subject'],['context','Context'],['brand','Brand'],['maker','Maker'],['series','Series'],['year','Year'],['date','Date'],['rarity','Rarity'],['parallelNumber','Parallel']])add(field,label,data[field],70);
  const primary={
   stats:['stats','Verified statistics'],biography:['biography','Biography'],story:['story','Story'],
   timeline:['timeline','Timeline'],discography:['timeline','Music / recordings'],
   'movie-tv':['story','Scene / story'],product:['description','Product description'],
   'compact-facts':['facts','Facts']
  }[format];
  add(primary[0],primary[1],data[primary[0]],90);
  for(const [field,label] of [['subtitle','Subtitle'],['biography','Biography'],['story','Story'],['description','Description'],['facts','Facts'],['timeline','Timeline'],['highlights','Highlights'],['credits','Credits']]){
   if(field!==primary[0])add(field,label,data[field],field==='credits'?40:60);
  }
  // URLs stay in the manifest; short source labels can appear when space permits.
  (data.sources||[]).forEach((source,index)=>{
   if(source?.title)add('sources['+index+']','Source',source.title,10);
  });
  return entries.sort((a,b)=>b.confidence-a.confidence||b.priority-a.priority);
 }
 function wrap(value,width,measure){
  const lines=[];let line='';
  for(const word of String(value||'').split(/\s+/).filter(Boolean)){
   if(measure(word)>width){
    if(line){lines.push(line);line=''}
    let part='';
    for(const char of word){
     if(part&&measure(part+char)>width){lines.push(part);part=''}
     if(measure(char)>width)throw new Error('back_text_region_too_narrow');
     part+=char;
    }
    line=part;
   }else if(line&&measure(line+' '+word)>width){lines.push(line);line=word}
   else line=line?line+' '+word:word;
  }
  if(line)lines.push(line);
  return lines;
 }
 function layout(data={},options={}){
  const width=options.width||750,height=options.height||1050;
  if(width<250||height<350)throw new Error('back_canvas_too_small');
  const margin=Math.round(width*.06),inner=width-margin*2;
  const measure=(value,size)=>options.measure?options.measure(value,size):String(value).length*size*.6;
  const commands=[],omitted=[];
  function block(field,value,size,y,label){
   const lines=wrap(value,inner,t=>measure(t,size));
   return {field,label,size,lines,x:margin,y,height:lines.length*(size+5)};
  }
  const legal=[data.copyrightText,data.footerText].filter(Boolean).join('\n');
  const footer=block('footerText',legal,13,0);
  footer.y=height-margin-footer.height+13;
  const number=block('cardNumber',data.cardNumber||'',18,margin+18);
  const title=block('title',data.title||data.subject||'',28,number.y+number.height+12);
  const bodyTop=title.y+title.height+20;
  const bodyBottom=footer.y-35;
  if(bodyBottom<bodyTop)throw new Error('back_required_text_exceeds_card');
  commands.push(number,title);
  let y=bodyTop;
  const format=formatFor(data);
  for(const entry of sections(data,format)){
   const value=entry.label+': '+entry.text;
   let candidate=block(entry.field,value,18,y,entry.label);
   if(y+candidate.height>bodyBottom)candidate=block(entry.field,value,16,y,entry.label);
   // Omit a complete fact, not a truncated sentence or a misleading statistic.
   if(y+candidate.height>bodyBottom){omitted.push({field:entry.field,reason:'space',confidence:entry.confidence});continue}
   commands.push(candidate);y+=candidate.height+12;
  }
  commands.push(footer);
  return {width,height,margin,format,commands,omittedFields:omitted};
 }
 function render(canvas,data,options={}){
  const ctx=canvas.getContext('2d');
  const template=options.template||{};
  const vintage=Number(template.year)>0&&Number(template.year)<1990;
  const palette=template.palette||[];
  const treatment={background:vintage?'#e5d4ae':palette[0]||'#f4f1e8',
   ink:'#17212b',accent:palette[1]||'#20304d',font:vintage?'Georgia':'Arial',
   corners:template.designData?.cornerTreatment||'sharp',vintage};
  const result=layout(data,{width:canvas.width,height:canvas.height,measure:(value,size)=>{
   ctx.font='bold '+size+'px '+treatment.font;return ctx.measureText(value).width;
  }});
  ctx.fillStyle=treatment.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle=treatment.accent;ctx.lineWidth=3;
  ctx.strokeRect(result.margin/2,result.margin/2,canvas.width-result.margin,canvas.height-result.margin);
  ctx.fillStyle=treatment.ink;ctx.textAlign='left';ctx.textBaseline='alphabetic';
  for(const command of result.commands){
   ctx.font=(['title','cardNumber'].includes(command.field)?'bold ':'')+command.size+'px '+treatment.font;
   command.lines.forEach((line,index)=>ctx.fillText(line,command.x,command.y+index*(command.size+5)));
  }
  return {...result,treatment,image:canvas.toDataURL('image/png')};
 }
 return {FORMATS,formatFor,buildData,sections,wrap,layout,render};
});
