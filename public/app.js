const SERVICE='https://infinity-rogers.marvaseater.workers.dev';
const COMFY_RENDERER_ENDPOINT=SERVICE+'/v1/comfy-image';
const $=id=>document.getElementById(id);
const BUILDER=window.OracleBuilderTools||null;
const ABILITY_ROUTER=window.OracleAbilityRouter||null;
const CARD_STATE=window.OracleCardState||null;
const CARD_NUMBERING=window.OracleCardNumbering||null;
const CARD_TEMPLATES=window.OracleCardTemplates||null;
const CARD_BACK=window.OracleCardBack||null;
const CARD_CRITIC=window.OracleCardCritic||null;
let lastToolPlan=null;
let lastAbilityRoute=null;

async function fetchWithTimeout(url,options={},timeoutMs=8000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  return await fetch(url,{...options,signal:controller.signal});
 }finally{
  clearTimeout(timer);
 }
}
let sourceFile=null;
let previewUrl='';
let referenceFile=null;
let referencePreviewUrl='';
let lastReferenceBlob=null;
let buildMode='original';
let lastBlob=null;
let lastDescription='';
let lastPlan=null;
let results=[];
let activeResult=-1;
let lastIntel=null;
let lastIntent=null;
let backResult='';
let currentSide='front';
let selectedImageFiles=[];
let selectedImageIndex=-1;


function state(){return CARD_STATE?.state||{selections:{border:'white',style:'flagship',finish:'paper',signature:'none',oneOfOne:true,useLogo:true,useBrand:true,includeDate:true,buildBack:true},identity:{title:'',brand:'',logoText:'',series:'',dateText:'',cardNumber:''},detected:{}}}

function builderDescription(freeform=''){
 const s=state();
 const title=s.identity.title||s.detected.title||'';
 if(CARD_NUMBERING&&title&&!s.identity.cardNumber)s.identity.cardNumber=CARD_NUMBERING.number(title,1);
 const spec=CARD_TEMPLATES?CARD_TEMPLATES.compile(s,freeform):freeform;
 return [
  title?'Subject/title: '+title+'.':'',
  s.identity.cardNumber?'Card number: '+s.identity.cardNumber+'.':'',
  spec
 ].filter(Boolean).join('\n');
}

function updateBuilderSummary(){
 const s=state(), t=CARD_TEMPLATES?.choose(s);
 const bits=[
  t?.name||((s.selections.border||'white')+' border'),
  s.selections.style,
  s.selections.finish,
  s.selections.signature==='signature'?'signature':'no signature',
  s.selections.oneOfOne?'automatic 1/1':'no 1/1'
 ];
 $('builderSummary').textContent='Auto build: '+bits.join(' · ')+'.';
}

function builderStepBlocks(){return [...document.querySelectorAll('#builderControls .controlBlock[data-builder-step]')];}
function labelFor(group,value){
 const groupEl=document.querySelector('[data-choice-group="'+group+'"]');
 const btn=groupEl?.querySelector('.choiceBtn[data-value="'+value+'"]');
 return btn?.textContent?.trim()||String(value||'');
}
function setStepSummary(block,text){
 const b=block?.querySelector('.controlSummary');if(b)b.textContent=text||'Change';
}
function openBuilderStep(name){
 const blocks=builderStepBlocks();
 const target=blocks.find(b=>b.dataset.builderStep===name);
 if(!target)return;
 blocks.forEach(b=>{if(b!==target&&b.classList.contains('current'))b.classList.remove('current')});
 target.classList.remove('complete');target.classList.add('current');
}
function completeBuilderStep(name,summary,next){
 const block=builderStepBlocks().find(b=>b.dataset.builderStep===name);if(!block)return;
 setStepSummary(block,summary);block.classList.remove('current');block.classList.add('complete');
 if(next)openBuilderStep(next);
}
function activateChoice(group,value,advance=true){
 document.querySelectorAll('[data-choice-group="'+group+'"] .choiceBtn').forEach(b=>b.classList.toggle('active',b.dataset.value===value));
 CARD_STATE?.setSelection(group,value);
 updateBuilderSummary();
 if(advance){
  const next=group==='border'?'style':group==='style'?'finish':group==='finish'?'collector':null;
  if(next)completeBuilderStep(group,labelFor(group,value),next);
 }
}

function initBuilderControls(){
 builderStepBlocks().forEach(block=>{
  const summary=block.querySelector('.controlSummary');
  if(summary)summary.addEventListener('click',()=>openBuilderStep(block.dataset.builderStep));
 });
 document.querySelectorAll('[data-choice-group]').forEach(group=>{
  group.querySelectorAll('.choiceBtn').forEach(btn=>btn.addEventListener('click',()=>activateChoice(group.dataset.choiceGroup,btn.dataset.value,true)));
 });
 $('oneOfOneToggle').addEventListener('click',()=>{
  const s=state();CARD_STATE?.setSelection('oneOfOne',!s.selections.oneOfOne);
  $('oneOfOneToggle').classList.toggle('active',state().selections.oneOfOne);
  $('oneOfOneToggle').textContent=state().selections.oneOfOne?'1/1 On':'1/1 Off';updateBuilderSummary();
 });
 $('signatureToggle').addEventListener('click',()=>{
  const on=state().selections.signature!=='signature';CARD_STATE?.setSelection('signature',on?'signature':'none');
  $('signatureToggle').classList.toggle('active',on);$('signatureToggle').textContent=on?'Signature On':'Signature';updateBuilderSummary();
 });
 $('logoToggle').addEventListener('click',()=>{
  const on=!state().selections.useLogo;CARD_STATE?.setSelection('useLogo',on);
  $('logoToggle').classList.toggle('active',on);$('logoToggle').textContent=on?'Logo':'No Logo';
 });
 $('backToggle').addEventListener('click',()=>{
  const on=!state().selections.buildBack;CARD_STATE?.setSelection('buildBack',on);
  $('backToggle').classList.toggle('active',on);$('backToggle').textContent=on?'Build Back':'No Back';
 });
 $('collectorContinue').addEventListener('click',()=>{
  const s=state().selections;
  completeBuilderStep('collector',[s.oneOfOne?'1/1':'no 1/1',s.signature==='signature'?'signature':'no signature',s.useLogo?'logo':'no logo',s.buildBack?'back':'front only'].join(' · '),'identity');
 });
 ['editTitleBtn','editBrandBtn','editSeriesBtn'].forEach(id=>$(id).addEventListener('click',()=>{$('customFields').classList.add('open');}));
 const inputMap={cardTitleInput:'title',cardBrandInput:'brand',cardLogoInput:'logoText',cardSeriesInput:'series',cardDateInput:'dateText'};
 Object.entries(inputMap).forEach(([id,key])=>$(id).addEventListener('input',e=>{
  CARD_STATE?.setIdentity(key,e.target.value);
  if(key==='title'&&CARD_NUMBERING)state().identity.cardNumber=e.target.value?CARD_NUMBERING.number(e.target.value,1):'';
 }));
 $('identityContinue').addEventListener('click',()=>{
  const s=state();const title=s.identity.title||s.detected.title||'Title not set';
  completeBuilderStep('identity',[title,s.identity.brand,s.identity.series,s.identity.dateText].filter(Boolean).join(' · '),null);
 });
 updateBuilderSummary();
}
function applyReaderSuggestions(data={}){
 CARD_STATE?.applyDetected(data);
 const box=$('readerIdeas');box.innerHTML='';
 const suggestions=[];
 for(const title of (data.titleOptions||[]).slice(0,4))suggestions.push({label:title,apply:()=>{CARD_STATE?.setIdentity('title',title);$('cardTitleInput').value=title;state().identity.cardNumber=CARD_NUMBERING?.number(title,1)||'';}});
 for(const style of (data.styleOptions||[]).slice(0,4))suggestions.push({label:style,apply:()=>{if(['flagship','vintage','contemporary','abstract'].includes(style))activateChoice('style',style);}});
 for(const item of suggestions){
  const b=document.createElement('button');b.type='button';b.className='choiceBtn';b.textContent=item.label;b.addEventListener('click',item.apply);box.appendChild(b);
 }
 box.classList.toggle('visible',suggestions.length>0);
}
window.applyOracleReaderSuggestions=applyReaderSuggestions;

initBuilderControls();


function setBusy(busy,label='Creating…'){
 $('make').disabled=busy;$('make3').disabled=busy;$('buildLike').disabled=busy;
 $('retryBtn').disabled=busy;$('tightenBtn').disabled=busy;$('moreBtn').disabled=busy;$('backBtn').disabled=busy;
 if(busy){$('make').textContent=label;$('make3').textContent='Working…'}
 else{$('make').textContent='Create Card';$('buildLike').textContent='Build Like This Card';$('make3').textContent='Create 3'}
}

function renderVariationBar(){
 const bar=$('variationBar');bar.innerHTML='';
 if(results.length<2){bar.style.display='none';return}
 results.forEach((src,i)=>{
  const b=document.createElement('button');b.type='button';b.className='variationThumb'+(i===activeResult?' active':'');
  b.setAttribute('aria-label','Variation '+(i+1));
  const im=document.createElement('img');im.src=src;im.alt='Variation '+(i+1);b.appendChild(im);
  b.addEventListener('click',()=>showResult(i));bar.appendChild(b);
 });
 bar.style.display='flex';
}

function reviewRequest(){
 const s=state();
 const title=(s.identity.title||s.detected.title||'').trim();
 return {complete:Boolean(title),issues:title?[]:['title'],title};
}

async function dataURIToBlob(dataURI){
 const r=await fetch(dataURI);
 return await r.blob();
}

async function askOracleToReview(src){
 try{
  const renderedBlob=await dataURIToBlob(src);
  const visual=await readUploadedImage(renderedBlob).catch(()=>null);
  const s=state();
  const input=`You are Oracle, a senior collectible-card art director reviewing ONE finished card image.

LOCKED REQUEST:
${lastDescription||builderDescription('')}

LOCKED IDENTITY:
${JSON.stringify(s.identity)}

LOCKED BUILD SETTINGS:
${JSON.stringify(s.selections)}

RENDERED-CARD VISION READ:
${JSON.stringify(visual||{})}

DESIGN PLAN:
${JSON.stringify(lastPlan||{})}

Return ONLY JSON:
{
 "summary":"one short sentence saying the most important thing to fix or preserve",
 "actions":[
  {"kind":"style","label":"short button label","instruction":"specific style correction"},
  {"kind":"layout","label":"short button label","instruction":"specific layout/crop/spacing correction"},
  {"kind":"variation","label":"short button label","instruction":"specific alternate direction"}
 ]
}

Rules:
- Judge the finished card, not a generic template.
- Do not ask the user to fill title, brand, or logo; Auto Build owns those.
- Preserve exact subject identity and user photo.
- If visible text looks garbled or duplicated, say so and make the correction explicit.
- If title/logo placement is missing or weak, make that the highest priority.
- Keep each button label under 22 characters.
- Never invent a real athlete or brand unsupported by the locked request or vision read.`;
  const r=await fetchWithTimeout(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'finished-card-critic'}})},7000);
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)return null;
  const parsed=extractJSON(String(d.output||d.output_text||d.answer||''));
  return parsed&&Array.isArray(parsed.actions)?parsed:null;
 }catch{return null}
}

async function updateReviewPanel(src=''){
 const review=reviewRequest();
 const status=$('reviewStatus');
 const primary=$('retryBtn');
 const layout=$('tightenBtn');
 const variation=$('moreBtn');
 const back=$('backBtn');
 $('reviewPanel').style.display='block';
 back.style.display=state().selections.buildBack?'inline-block':'none';

 if(!review.complete){
  status.innerHTML='<strong>Auto Build is finishing the card identity.</strong> The image reader will supply the title and brand treatment.';
  primary.textContent='Re-read Image';
  primary.dataset.action='reread';
  primary.dataset.instruction='';
  layout.style.display='none';
  variation.style.display='none';
  return;
 }

 status.innerHTML='<strong>Oracle is reviewing this exact card…</strong>';
 primary.textContent='Improve Style';primary.dataset.action='style';primary.dataset.instruction='';
 layout.textContent='Improve Layout';layout.dataset.action='layout';layout.dataset.instruction='';layout.style.display='inline-block';
 variation.textContent='New Variation';variation.dataset.action='variation';variation.dataset.instruction='';variation.style.display='inline-block';

 const critique=src?await askOracleToReview(src):null;
 if(!critique)return;
 status.innerHTML='<strong>Oracle review:</strong> '+String(critique.summary||'The card is ready for a targeted refinement.');
 const buttons=[primary,layout,variation];
 critique.actions.slice(0,3).forEach((action,i)=>{
  const btn=buttons[i];if(!btn)return;
  const kind=['style','layout','variation'].includes(action.kind)?action.kind:(i===0?'style':i===1?'layout':'variation');
  btn.dataset.action=kind;
  btn.dataset.instruction=String(action.instruction||'');
  btn.textContent=String(action.label||btn.textContent).slice(0,22);
 });
}

async function showResult(index){
 const src=results[index];if(!src)return;
 activeResult=index;$('resultImage').src=src;$('resultImage').style.display='block';$('empty').style.display='none';
 $('buildMonitor').style.display='none';$('resultActions').style.display='flex';$('newCard').style.display='inline-block';$('sideSwitch').style.display=backResult?'flex':'none';currentSide='front';$('frontSide').classList.add('active');$('backSide').classList.remove('active');
 renderVariationBar();await updateReviewPanel(src);
}

async function finishOutput(out){
 if(!out?.dataURI)throw new Error('empty_image');
 const base=out.mode==='server-composite'?out.dataURI:out.dataURI;
 const labeled=await stampFrontIdentity(base);
 const marked=await stampCollectorMarks(labeled);
 const finished=await stampProductLine(marked);
 const img=new Image();img.src=finished;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('image_display_failed'))});
 results.push(finished);await showResult(results.length-1);return finished;
}

function variationPrompt(plan,kind,index=0,instruction=''){
 const base=plan.renderPrompt;
 const directed=instruction?(' ORACLE REVIEW CORRECTION: '+instruction):'';
 if(kind==='style') return base+' IMPROVE STYLE ONLY: keep the subject, identity, requested border, material, card number, 1/1 policy and all locked details. Raise the art direction to a premium contemporary collectible standard with stronger visual hierarchy, more intentional graphic relationships, better material realism and one tasteful high-end detail. Do not add text or change the subject.'+directed;
 if(kind==='layout') return base+' IMPROVE LAYOUT ONLY: preserve the selected style and all locked details, but improve crop, spacing, subject scale, border discipline, negative space, balance and card proportions. Remove awkward empty areas and accidental framing. Do not add text or change the subject.'+directed;
 if(kind==='variation') return base+' Create a new sibling variation of the same approved request. Preserve every locked detail and subject identity, but explore one different premium composition while staying in the same card family.'+directed;
 const modes=[
  'Variation 1: faithful execution. Follow the design plan closely while allowing tasteful card-making judgment.',
  'Variation 2: premium execution. Preserve every hard requirement, but allow one or two valuable collector-grade inventions such as rarity treatment, foil detail, corner device or print finish.',
  'Variation 3: creative execution. Preserve every hard requirement and subject identity, but explore the strongest original interpretation that still feels like the requested card family.'
 ];
 return base+' '+modes[index%3];
}

async function generateFromPlan(kind='single',count=1,instruction=''){
 if(!lastBlob||!lastPlan||!lastDescription)throw new Error('missing_build_state');
 if(BUILDER){
  const tp=lastPlan.toolSpec||lastToolPlan||BUILDER.buildToolPlan(lastDescription);
  const check=BUILDER.validatePlan(lastPlan,tp.semantics);
  if(!check.ok)lastPlan=BUILDER.normalizeAIPlan(lastPlan,tp);
 }
 for(let i=0;i<count;i++){
  stage('render','active',count>1?'Rendering variation '+(i+1)+' of '+count+'…':'Rendering through Oracle’s best available engine…');
  const basePrompt=kind==='single'?lastPlan.renderPrompt:variationPrompt(lastPlan,kind,i,instruction);
  const prompt=ABILITY_ROUTER&&lastToolPlan?basePrompt+'\n\n'+ABILITY_ROUTER.buildCapabilityNote({...lastToolPlan,mode:buildMode}):basePrompt;
  const out=await renderCard(lastBlob,prompt,lastDescription,lastReferenceBlob);
  stage('render','done');
  stage('finish','active','Finishing…');
  await finishOutput(out);
  stage('finish','done');
 }
 $('status').innerHTML='<strong>'+count+' card'+(count>1?'s':'')+' created.</strong>';
}


async function readUploadedImage(blob){
 const form=new FormData();
 form.append('image',blob,'reader.jpg');
 const r=await fetchWithTimeout(SERVICE+'/v1/image-read',{method:'POST',body:form},12000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)return null;
 return d;
}

function firstText(values){
 return (Array.isArray(values)?values:[]).map(v=>String(v||'').trim()).find(Boolean)||'';
}
function titleCase(value){
 return String(value||'').trim().replace(/\b\w/g,c=>c.toUpperCase());
}
async function completeVisionIdentity(data={}){
 const fallbackTitle=firstText(data.titleOptions)||titleCase(data.subjectType)||titleCase(firstText(data.keywords))||'Featured Card';
 const fallbackBrand=firstText(data.brandOptions)||'Oracle Originals';
 const fallbackLogo=firstText(data.logoOptions)||fallbackBrand;
 const fallback={
  ...data,
  titleOptions:[fallbackTitle,...(data.titleOptions||[]).filter(x=>String(x).trim()!==fallbackTitle)],
  brandOptions:[fallbackBrand,...(data.brandOptions||[]).filter(x=>String(x).trim()!==fallbackBrand)],
  logoOptions:[fallbackLogo,...(data.logoOptions||[]).filter(x=>String(x).trim()!==fallbackLogo)]
 };
 try{
  const input=`Complete the identity fields for a fantasy collectible card from IMAGE-READER METADATA. Return ONLY JSON:
{"title":"","brand":"","logoText":"","series":"","dateText":"","style":""}

IMAGE-READER METADATA:
${JSON.stringify(data)}

Rules:
- Ground title in what the image reader actually detected. A strange or viral product name is allowed when supported by title candidates, visible text, or keywords.
- Never invent the identity of a real person.
- Use a real brand only when supported by the metadata. Otherwise create a short fantasy card/product brand appropriate to the subject.
- logoText should be a short printable logo treatment, usually 1-3 words.
- Do not return blanks: Auto Build must arrive with a usable title, brand, and logo treatment.
- Keep title concise enough to print on the card.`;
  const r=await fetchWithTimeout(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'image-identity-completion'}})},6500);
  const d=await r.json().catch(()=>({}));
  const parsed=r.ok&&d.ok?extractJSON(String(d.output||d.output_text||d.answer||'')):null;
  if(parsed){
   const title=String(parsed.title||fallbackTitle).trim();
   const brand=String(parsed.brand||fallbackBrand).trim();
   const logoText=String(parsed.logoText||brand||fallbackLogo).trim();
   return {
    ...fallback,
    titleOptions:[title,...fallback.titleOptions.filter(x=>String(x).trim()!==title)],
    brandOptions:[brand,...fallback.brandOptions.filter(x=>String(x).trim()!==brand)],
    logoOptions:[logoText,...fallback.logoOptions.filter(x=>String(x).trim()!==logoText)],
    seriesOptions:parsed.series?[String(parsed.series)]:[],
    dateOptions:parsed.dateText?[String(parsed.dateText),...(fallback.dateOptions||[])]:fallback.dateOptions||[],
    styleOptions:parsed.style?[String(parsed.style),...(fallback.styleOptions||[])]:fallback.styleOptions||[]
   };
  }
 }catch{}
 return fallback;
}

function applyVisionResult(data){
 if(!data)return;
 const title=firstText(data.titleOptions)||titleCase(data.subjectType)||titleCase(firstText(data.keywords))||'Featured Card';
 const brand=firstText(data.brandOptions)||'Oracle Originals';
 const logo=firstText(data.logoOptions)||brand;
 const series=firstText(data.seriesOptions);
 const date=firstText(data.dateOptions);
 const detected={
  title,
  subjectType:data.subjectType||'',
  brand,
  logo,
  era:date,
  date,
  keywords:Array.isArray(data.keywords)?data.keywords:[]
 };
 CARD_STATE?.applyDetected(detected);
 if(!state().identity.title){
  CARD_STATE?.setIdentity('title',title);
  $('cardTitleInput').value=title;
  state().identity.cardNumber=CARD_NUMBERING?.number(title,1)||'';
 }
 if(!state().identity.brand){
  CARD_STATE?.setIdentity('brand',brand);
  $('cardBrandInput').value=brand;
 }
 if(!state().identity.logoText){
  CARD_STATE?.setIdentity('logoText',logo);
  $('cardLogoInput').value=logo;
 }
 if(series&&!state().identity.series){
  CARD_STATE?.setIdentity('series',series);
  $('cardSeriesInput').value=series;
 }
 if(date&&!state().identity.dateText){
  CARD_STATE?.setIdentity('dateText',date);
  $('cardDateInput').value=date;
 }
 applyReaderSuggestions({
  titleOptions:data.titleOptions||[title],
  styleOptions:data.styleOptions||[],
  subjectType:data.subjectType||'',
  brandOptions:data.brandOptions||[brand],
  logoOptions:data.logoOptions||[logo],
  dateOptions:data.dateOptions||[],
  visibleText:data.visibleText||[],
  keywords:data.keywords||[]
 });
}

async function autoCropDominantImage(file){
 if(!file)return {blob:null,cropped:false,box:null};
 const bitmap=await createImageBitmap(file);
 const ow=bitmap.width,oh=bitmap.height;
 const maxDim=256,scale=Math.min(1,maxDim/Math.max(ow,oh));
 const w=Math.max(32,Math.round(ow*scale)),h=Math.max(32,Math.round(oh*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true,alpha:false});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
 const data=ctx.getImageData(0,0,w,h).data;
 const tile=Math.max(6,Math.round(Math.min(w,h)/28));
 const cols=Math.ceil(w/tile),rows=Math.ceil(h/tile);
 const active=new Uint8Array(cols*rows);
 const score=new Float32Array(cols*rows);

 function tileStats(tx,ty){
  const x0=tx*tile,y0=ty*tile,x1=Math.min(w,x0+tile),y1=Math.min(h,y0+tile);
  let n=0,sum=0,sum2=0,sat=0,edges=0,prev=-1;
  for(let y=y0;y<y1;y+=2){
   for(let x=x0;x<x1;x+=2){
    const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    const lum=.299*r+.587*g+.114*b;
    sum+=lum;sum2+=lum*lum;n++;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b);sat+=mx-mn;
    if(prev>=0)edges+=Math.abs(lum-prev);prev=lum;
   }
  }
  const mean=sum/Math.max(1,n),variance=Math.max(0,sum2/Math.max(1,n)-mean*mean);
  const std=Math.sqrt(variance),avgSat=sat/Math.max(1,n),avgEdge=edges/Math.max(1,n-1);
  return {std,avgSat,avgEdge,mean};
 }

 for(let ty=0;ty<rows;ty++){
  for(let tx=0;tx<cols;tx++){
   const st=tileStats(tx,ty),idx=ty*cols+tx;
   const texture=st.std*1.25+st.avgSat*.22+st.avgEdge*.32;
   score[idx]=texture;
   const photoLike=texture>24 || (st.std>15&&st.avgSat>18) || (st.std>21&&st.avgEdge>10);
   const blankish=(st.mean>242&&st.std<8)||(st.mean<15&&st.std<8);
   active[idx]=photoLike&&!blankish?1:0;
  }
 }

 // Bridge tiny gaps so one photo is not split by highlights or dark clothing.
 const bridged=new Uint8Array(active);
 for(let ty=1;ty<rows-1;ty++)for(let tx=1;tx<cols-1;tx++){
  const idx=ty*cols+tx;if(active[idx])continue;
  let neighbors=0;
  for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)if(xx||yy)neighbors+=active[(ty+yy)*cols+(tx+xx)];
  if(neighbors>=5)bridged[idx]=1;
 }

 const seen=new Uint8Array(cols*rows);
 let best=null;
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++){
  const start=ty*cols+tx;if(!bridged[start]||seen[start])continue;
  const stack=[[tx,ty]];seen[start]=1;
  let minX=tx,maxX=tx,minY=ty,maxY=ty,count=0,totalScore=0;
  while(stack.length){
   const [cx,cy]=stack.pop(),idx=cy*cols+cx;
   count++;totalScore+=score[idx];minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
   for(const [dx,dy] of dirs){
    const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
    const ni=ny*cols+nx;if(bridged[ni]&&!seen[ni]){seen[ni]=1;stack.push([nx,ny]);}
   }
  }
  const bw=(maxX-minX+1)*tile,bh=(maxY-minY+1)*tile;
  const area=bw*bh,areaRatio=area/(w*h),density=count/Math.max(1,(maxX-minX+1)*(maxY-minY+1));
  const componentScore=area*(.55+.45*density)*(1+Math.min(1,totalScore/Math.max(1,count)/80));
  if(areaRatio>.08&&(!best||componentScore>best.componentScore))best={minX,maxX,minY,maxY,areaRatio,density,componentScore};
 }

 if(!best){
  if(bitmap.close)bitmap.close();
  return {blob:file,cropped:false,box:null};
 }

 let x0=Math.max(0,best.minX*tile-tile),y0=Math.max(0,best.minY*tile-tile);
 let x1=Math.min(w,(best.maxX+1)*tile+tile),y1=Math.min(h,(best.maxY+1)*tile+tile);
 let cropW=x1-x0,cropH=y1-y0;
 const ratio=(cropW*cropH)/(w*h);

 // If the dominant image already fills most of the upload, keep the original.
 if(ratio>.82 || cropW<Math.min(90,w*.28) || cropH<Math.min(90,h*.28)){
  if(bitmap.close)bitmap.close();
  return {blob:file,cropped:false,box:null};
 }

 const sx=Math.max(0,Math.round(x0/scale)),sy=Math.max(0,Math.round(y0/scale));
 const sw=Math.min(ow-sx,Math.round(cropW/scale)),sh=Math.min(oh-sy,Math.round(cropH/scale));
 const out=document.createElement('canvas');out.width=sw;out.height=sh;
 const ox=out.getContext('2d',{alpha:false});ox.fillStyle='#fff';ox.fillRect(0,0,sw,sh);
 ox.drawImage(bitmap,sx,sy,sw,sh,0,0,sw,sh);
 if(bitmap.close)bitmap.close();
 const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('auto_crop_failed')),'image/jpeg',.96));
 return {blob,cropped:true,box:{x:sx,y:sy,width:sw,height:sh,sourceWidth:ow,sourceHeight:oh}};
}

async function prepareUploadedImage(file){
 try{return await autoCropDominantImage(file)}
 catch{return {blob:file,cropped:false,box:null}}
}


function clearImageTray(){
 const tray=$('imageTray');if(!tray)return;
 tray.querySelectorAll('img').forEach(img=>{const u=img.dataset.objectUrl;if(u)URL.revokeObjectURL(u)});
 tray.innerHTML='';tray.classList.remove('visible');
 selectedImageFiles=[];selectedImageIndex=-1;
}
function renderImageTray(files){
 const tray=$('imageTray');if(!tray)return;
 tray.innerHTML='';selectedImageFiles=[...files];selectedImageIndex=-1;
 selectedImageFiles.forEach((file,index)=>{
  const b=document.createElement('button');b.type='button';b.className='imageChoice';b.setAttribute('aria-label','Use image '+(index+1));
  const img=document.createElement('img');const url=URL.createObjectURL(file);img.src=url;img.dataset.objectUrl=url;img.alt='';
  b.appendChild(img);
  b.addEventListener('click',async()=>{
   selectedImageIndex=index;
   tray.querySelectorAll('.imageChoice').forEach((x,i)=>x.classList.toggle('active',i===index));
   await setPhoto(file);
  });
  tray.appendChild(b);
 });
 tray.classList.toggle('visible',selectedImageFiles.length>1);
}
function openPicker(){ $('photo').click(); }
async function setPhoto(file){
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
 if(!file){
  sourceFile=null;
  $('thumb').removeAttribute('src');$('thumb').style.display='none';$('thumbText').style.display='grid';
  $('thumbControls').style.display='none';$('photo').value='';$('status').textContent='Tap the photo tile to begin.';return;
 }
 $('status').textContent='Finding the main image and cropping away the page…';
 const prepared=await prepareUploadedImage(file);
 sourceFile=prepared.blob||file;
 previewUrl=URL.createObjectURL(sourceFile);
 $('thumb').src=previewUrl;$('thumb').style.display='block';$('thumbText').style.display='none';
 $('thumbControls').style.display='flex';
 $('status').textContent=prepared.cropped?'Main image found. Reading what is actually in it…':'Reading what is actually in the image…';
 const visionRaw=await readUploadedImage(sourceFile).catch(()=>null);
 const vision=await completeVisionIdentity(visionRaw||{});
 applyVisionResult(vision);
 const autoTitle=state().identity.title||firstText(vision.titleOptions);
 $('status').textContent='Auto Build read the image'+(autoTitle?': '+autoTitle:'')+'. Title, brand, and logo are filled in; change them only if you want.';
}
$('photo').addEventListener('change',async e=>{
 const files=[...(e.target.files||[])].filter(f=>f.type.startsWith('image/'));
 if(!files.length){await setPhoto(null);return}
 renderImageTray(files);
 selectedImageIndex=0;
 $('imageTray')?.querySelector('.imageChoice')?.classList.add('active');
 await setPhoto(files[0]);
});
$('thumbBox').addEventListener('click',e=>{if(!e.target.closest('button'))openPicker()});
$('thumbBox').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPicker()}});
$('replacePhoto').addEventListener('click',e=>{e.stopPropagation();openPicker()});
$('removePhoto').addEventListener('click',e=>{e.stopPropagation();clearImageTray();setPhoto(null)});
['dragenter','dragover'].forEach(type=>$('composer').addEventListener(type,e=>{e.preventDefault();$('composer').style.borderColor='#9fb7ca'}));
['dragleave','drop'].forEach(type=>$('composer').addEventListener(type,e=>{e.preventDefault();$('composer').style.borderColor='#cdd7e1'}));
$('composer').addEventListener('drop',e=>{const f=[...(e.dataTransfer?.files||[])].find(x=>x.type.startsWith('image/'));if(f)setPhoto(f)});


function openReferencePicker(){ $('referencePhoto').click(); }
async function setReference(file){
 if(referencePreviewUrl){URL.revokeObjectURL(referencePreviewUrl);referencePreviewUrl=''}
 if(!file){
  referenceFile=null;
  $('referenceThumb').removeAttribute('src');$('referenceThumb').style.display='none';$('referenceText').style.display='grid';
  $('referenceControls').style.display='none';$('referencePhoto').value='';
  return;
 }
 $('status').textContent='Finding the reference card inside the upload…';
 const prepared=await prepareUploadedImage(file);
 referenceFile=prepared.blob||file;
 referencePreviewUrl=URL.createObjectURL(referenceFile);
 $('referenceThumb').src=referencePreviewUrl;$('referenceThumb').style.display='block';$('referenceText').style.display='none';
 $('referenceControls').style.display='flex';
 $('status').textContent=prepared.cropped?'Reference image cropped automatically.':'Reference card ready.';
}
$('referencePhoto').addEventListener('change',e=>setReference(e.target.files?.[0]||null));
$('referenceBox').addEventListener('click',e=>{if(!e.target.closest('button'))openReferencePicker()});
$('referenceBox').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openReferencePicker()}});
$('replaceReference').addEventListener('click',e=>{e.stopPropagation();openReferencePicker()});
$('removeReference').addEventListener('click',e=>{e.stopPropagation();setReference(null)});

function resetMonitor(){
 document.querySelectorAll('.buildStep').forEach(el=>{el.classList.remove('active','done','error');el.querySelector('.state').textContent='Waiting'});
 $('buildNote').textContent='Starting…';
}
function showMonitor(){$('empty').style.display='none';$('resultImage').style.display='none';$('buildMonitor').style.display='block';resetMonitor()}
function stage(name,state,note=''){
 const el=document.querySelector('[data-stage="'+name+'"]');if(!el)return;
 el.classList.remove('active','done','error');el.classList.add(state);
 el.querySelector('.state').textContent=state==='active'?'Working':state==='done'?'Done':'Check';
 if(note)$('buildNote').textContent=note;
}

async function resizeImage(file,max=512){
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
 if(bitmap.close)bitmap.close();
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image_prepare_failed')),'image/jpeg',.94));
}

function extractJSON(text){
 const raw=String(text||'').trim();
 try{return JSON.parse(raw)}catch{}
 const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
 if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch{}}
 return null;
}

const CARD_STYLE_LIBRARY={
 topps:"classic flagship baseball card; disciplined rectangular geometry; clearly defined perimeter border when requested; thin inner accent rules; photo-first composition; restrained team-color accents; compact player-name and team typography zones; vintage-to-modern matte/gloss print depending on era; never a generic metallic luxury frame",
 fleer:"1980s-to-1990s colorful baseball-card language; bright edge treatments; energetic geometric color blocking; compact lower-third name treatment; lively but printable graphics; photo-forward center",
 donruss:"bold late-1980s baseball-card design; strong border geometry; warm saturated print colors; angular or ribbon-like graphic elements; clear name/team zones; vintage coated-card finish",
 "upper deck":"premium early-1990s photography-led sports card; cleaner border system; strong full-color image; restrained metallic accents; upscale editorial spacing; crisp modern print feel",
 bowman:"prospect-focused baseball card; clean youthful presentation; modern border system; prominent subject; rookie/prospect hierarchy; bright premium finish",
 "stadium club":"near-full-bleed photography; minimal framing; dramatic sports photography; subtle typography; premium glossy finish; border should stay restrained unless explicitly requested",
 score:"bright energetic sports-card graphics; strong color blocks; bold border rhythm; accessible late-1980s/1990s print feel; readable lower-third zones",
 leaf:"heritage collector-card aesthetic; refined traditional framing; rich print texture; classic composition; restrained premium treatment",
 "diamond kings":"illustrated fine-art baseball-card feel; painterly portrait integration; decorative collector composition; rich warm color; handcrafted card-art character"
};

function styleKnowledge(description){
 const t=String(description||'').toLowerCase();
 const hits=Object.entries(CARD_STYLE_LIBRARY).filter(([k])=>t.includes(k)).map(([k,v])=>k.toUpperCase()+": "+v);
 return hits.length?hits.join("\n"):"No named card family detected; follow the user's visual words literally.";
}


async function extractCardIntent(description){
 const input=`Extract collectible-card intent from this request. Return ONLY JSON:
{"playerQuery":"","teamQuery":"","explicitYear":"","cardType":"","subset":"","historicalAngle":""}
Request: ${description}
Only use playerQuery when the request explicitly names a baseball player. Never infer one from unrelated subjects.`;
 const r=await fetchWithTimeout(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'card-entity-intent'}})},4500);
 const d=await r.json().catch(()=>({}));
 const parsed=extractJSON(String(d.output||d.output_text||d.answer||''));
 return parsed||{playerQuery:'',teamQuery:'',explicitYear:'',cardType:'',subset:'',historicalAngle:''};
}

async function fetchPlayerIntel(name){
 if(!name)return null;
 const r=await fetchWithTimeout(SERVICE+'/v1/card-intel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})},4500);
 const d=await r.json().catch(()=>({}));
 return r.ok&&d.ok?d:null;
}

function renderSmartIdeas(plan){
 const box=$('smartIdeas');box.innerHTML='';
 const ideas=Array.isArray(plan?.suggestions)?plan.suggestions.filter(Boolean).slice(0,5):[];
 if(!ideas.length){box.style.display='none';return}
 ideas.forEach(text=>{
  const b=document.createElement('button');b.type='button';b.className='ideaChip';b.textContent=text;
  b.addEventListener('click',()=>{$('message').value=text;$('message').focus()});
  box.appendChild(b);
 });
 box.style.display='flex';
}

async function buildDesignPlan(description,intel=null,intent=null){
 const toolPlan=BUILDER?BUILDER.buildToolPlan(description):null;
 lastToolPlan=toolPlan;
 const input=`You are Oracle, a senior sports-card art director. Read the user's short request literally and convert it into a production design plan for an image editor using reference image 0.

USER REQUEST:
${description}

INTERNAL CARD-STYLE REFERENCE:
${styleKnowledge(description)}

PUBLIC PLAYER / SEASON DATA:
${intel?JSON.stringify({player:intel.player,highlights:intel.highlights,seasons:(intel.seasons||[]).slice(-12)}):"No verified player data available."}

EXTRACTED INTENT:
${JSON.stringify(intent||{})}

BUILDER TOOL SPECIFICATION (treat hardRequirements as locked constraints; enrich, do not contradict):
${toolPlan?JSON.stringify({semantics:toolPlan.semantics,style:toolPlan.style,layout:toolPlan.layout,hardRequirements:BUILDER.hardRequirements(toolPlan.semantics,toolPlan.style,toolPlan.layout)}):'Builder toolkit unavailable.'}

Return ONLY valid JSON:
{
 "era":"",
 "cardFamily":"",
 "outerBorder":"",
 "innerFrame":"",
 "palette":"",
 "photoTreatment":"",
 "layout":"",
 "materials":"",
 "lighting":"",
 "typeZones":"",
 "specialDetails":"",
 "suggestedYear":"",
 "suggestedCardType":"",
 "suggestions":["","",""],
 "backStyle":"",
 "mustPreserve":[""],
 "mustAvoid":[""],
 "renderPrompt":""
}

Rules:
- Obey explicit visual instructions exactly. If the user says WHITE BORDER, the outerBorder MUST explicitly require a clearly visible bright white border around the full card perimeter. Never substitute silver, gray, black, gold, chrome, or another border.
- Brand names such as Topps, Fleer, Donruss, Upper Deck, Bowman, Stadium Club, Score, Leaf or Diamond Kings are references to real sports-card design eras. Translate them into concrete design traits: border width, geometry, photo crop, typography placement, color blocking, print texture and material treatment.
- The uploaded subject must remain recognizable and be integrated into the card artwork, not pasted into a generic empty frame.
- Design the WHOLE card as one coherent printed object. The subject, border, color fields, lighting and graphic shapes must visually interact.
- Use the user's requested colors. Never default everything to white/silver Oracle colors; Oracle styling applies to the WEBSITE, not the generated card.
- Do not invent a generic metallic frame unless the request calls for one.
- Do not generate logos or exact trademark marks. Style resemblance is fine.
- No mockup, tabletop, slab, holder, phone screen, empty template or placeholder window.
- Keep generated lettering minimal because final production text is added separately.
- If verified player data is supplied, use it to suggest historically meaningful card concepts: standout seasons, team/position context, postseason-era concepts, matchup or teammate pairings when sensible. Do not fabricate statistics.
- suggestions should be concise ready-to-use card ideas derived only from verified subject context. Never inject unrelated teams, eras, people or examples.
- suggestedYear should prefer a meaningful season supported by verified data unless the user explicitly named a year.
- backStyle should describe a matching period-correct card-back design.
- renderPrompt must be a single strong image-editing prompt that includes every important requirement above and explicitly says to transform reference image 0 into the finished card artwork.
`;
 const r=await fetchWithTimeout(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'structured-card-art-direction'}})},8000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('design_unavailable');
 const raw=String(d.output||d.output_text||d.answer||'').trim();
 const plan=extractJSON(raw);
 if(!plan?.renderPrompt)throw new Error('design_plan_invalid');
 return BUILDER&&toolPlan?BUILDER.normalizeAIPlan(plan,toolPlan):plan;
}



function localDesignPlan(description,intel=null,intent=null){
 if(BUILDER){
  const toolPlan=BUILDER.buildToolPlan(description);lastToolPlan=toolPlan;
  return BUILDER.normalizeAIPlan({
   era:toolPlan.semantics.year||'user-directed',
   cardFamily:toolPlan.style.family,
   suggestedYear:toolPlan.semantics.year||'',
   suggestedCardType:toolPlan.semantics.cardType||'',
   suggestions:[],
   backStyle:'Match the front era, print language and information hierarchy.'
  },toolPlan);
 }
 const d=String(description||'').trim();
 const style=styleKnowledge(d);
 const year=intent?.explicitYear||'';
 const player=intel?.player?.fullName||intent?.playerQuery||'the uploaded subject';
 const renderPrompt=[
  'Transform reference image 0 into a finished collectible sports card.',
  'Preserve the uploaded subject identity and recognizable face/body.',
  d?'User direction: '+d+'.':'Use a clean, photo-first vintage sports-card composition.',
  'Card-style guidance: '+style,
  year?'Use '+year+' as the explicit era/year direction.':'',
  'Render the WHOLE card as one coherent printed object with sharp rectangular card corners.',
  'Use disciplined border geometry, intentional typography zones, period-appropriate print texture and restrained readable graphics.',
  'Do not create a slab, holder, tabletop mockup, phone screen, empty template, placeholder window, or generic metallic frame.',
  'Do not reproduce exact logos or trademark marks.',
  'Keep generated lettering minimal because final production text is handled separately.'
 ].filter(Boolean).join(' ');
 return {
  era:year||'user-directed',
  cardFamily:'locally directed sports-card design',
  outerBorder:'Follow the request literally; keep the full card perimeter clearly visible.',
  innerFrame:'Structured print-card geometry that supports the photograph.',
  palette:'Use colors requested by the user and appropriate team/era accents.',
  photoTreatment:'Integrate '+player+' into the complete card artwork; do not paste the image into an empty frame.',
  layout:'Photo-first collectible-card layout with deliberate border, name and team zones.',
  materials:'Printed trading-card stock with era-appropriate matte or gloss finish.',
  lighting:'Natural subject lighting integrated with the card art.',
  typeZones:'Reserve readable player/team/stat zones without generating excessive fake text.',
  specialDetails:'Preserve explicit design details from the request.',
  suggestedYear:year,
  suggestedCardType:intent?.cardType||'',
  suggestions:[],
  backStyle:'Match the front era and geometry with a readable statistics-first card back.',
  mustPreserve:['subject identity','explicit colors','explicit border and era instructions','full sharp card corners'],
  mustAvoid:['slab or holder','tabletop mockup','generic luxury frame','unrequested logos'],
  renderPrompt
 };
}

function localReferencePlan(description){
 const d=String(description||'').trim();
 return {
  designDNA:'Carry over the composition and visual design language from reference image 1.',
  outerBorder:'Match the reference card perimeter and border proportions while keeping the entire card visible.',
  innerFrame:'Adapt the reference framing around the new subject.',
  palette:'Carry over the reference color relationships unless the user overrides them.',
  photoWindow:'Use reference image 0 as the subject and reference image 1 only for design language.',
  typeZones:'Match the reference hierarchy without copying literal names, logos, or trademarks.',
  materials:'Match the reference print/foil/material treatment.',
  rarityTreatment:'Preserve useful rarity cues from the reference.',
  specialDetails:'Keep sharp rectangular card corners and coherent whole-card construction.',
  mustPreserve:['subject identity from image 0','design language from image 1','full card perimeter'],
  mustAdapt:['names','team identifiers','literal text and trademarks'],
  renderPrompt:[
   'Create a finished sports card using reference image 0 for subject identity and reference image 1 for design/style.',
   d?'User direction: '+d+'.':'',
   'Carry over reference image 1 composition, border geometry, color blocking, materials, photo-window proportions, typography zones and collector details.',
   'Do not copy literal names, team logos, trademarks or text from the reference card.',
   'Integrate the new subject naturally into the complete printed card. Keep the entire card visible with sharp rectangular corners. No slab, holder or tabletop mockup.'
  ].filter(Boolean).join(' ')
 };
}

async function buildReferencePlan(description){
 const input=`You are Oracle, a senior sports-card design analyst. The user supplied TWO images:
- reference image 0 = the SUBJECT that must appear on the new card
- reference image 1 = the CARD DESIGN REFERENCE whose visual design language should be carried over

USER REQUEST:
${description||'Build a new card using the reference card design.'}

Return ONLY valid JSON:
{
 "designDNA":"",
 "outerBorder":"",
 "innerFrame":"",
 "palette":"",
 "photoWindow":"",
 "typeZones":"",
 "materials":"",
 "rarityTreatment":"",
 "specialDetails":"",
 "mustPreserve":[""],
 "mustAdapt":[""],
 "renderPrompt":""
}

Rules:
- Copy the visual DESIGN LANGUAGE of reference image 1: composition, border geometry, color blocking, foil/material treatment, rarity treatment, corner devices, photo-window proportions and typography zones.
- Put the SUBJECT from reference image 0 into the new card.
- Do not copy logos, trademarks, player names, team logos, or literal text from reference image 1.
- The final result must feel like the same card family, not like an image pasted into a frame.
- Preserve useful original inventions from the reference such as unusual foil, rarity cues or collector details when they improve the new card.
- renderPrompt must explicitly tell the image editor to use reference image 0 for subject identity and reference image 1 for design/style.
`;
 const r=await fetchWithTimeout(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'reference-card-design-analysis'}})},8000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('reference_design_unavailable');
 const plan=extractJSON(String(d.output||d.output_text||d.answer||''));
 if(!plan?.renderPrompt)throw new Error('reference_plan_invalid');
 return plan;
}


const BACK_STYLE_LIBRARY={
 "topps:1989":{bg:"#e6b04f",ink:"#1f2e3c",accent:"#d94b35",panel:"#f1cf7b",rule:"#334b61",title:"1989 flagship back"},
 "topps:1987":{bg:"#e7c56e",ink:"#24363d",accent:"#b84237",panel:"#f3dc98",rule:"#324952",title:"1987 flagship back"},
 "fleer:1987":{bg:"#dce7ee",ink:"#1f2933",accent:"#2d6aa1",panel:"#f7fbfe",rule:"#84a8c5",title:"1987 Fleer-style back"},
 "donruss:1989":{bg:"#efe6d1",ink:"#241f1a",accent:"#c44b34",panel:"#fffaf0",rule:"#30343b",title:"1989 Donruss-style back"},
 "upper deck:1989":{bg:"#e7edf2",ink:"#152331",accent:"#3e6f9f",panel:"#ffffff",rule:"#a7b8c7",title:"1989 premium photo-era back"},
 generic:{bg:"#e6edf3",ink:"#17212a",accent:"#486f91",panel:"#f9fbfc",rule:"#9fb0bf",title:"Oracle card back"}
};

function backStyleFor(description,plan){
 const t=(description+' '+(plan?.cardFamily||'')+' '+(plan?.era||'')).toLowerCase();
 const year=(description.match(/\b(19|20)\d{2}\b/)||[])[0]||String(plan?.suggestedYear||'');
 for(const key of Object.keys(BACK_STYLE_LIBRARY)){
  if(key==='generic')continue;
  const [brand,y]=key.split(':');
  if(t.includes(brand)&&String(year)===y)return BACK_STYLE_LIBRARY[key];
 }
 if(t.includes('topps'))return BACK_STYLE_LIBRARY['topps:1989'];
 if(t.includes('fleer'))return BACK_STYLE_LIBRARY['fleer:1987'];
 if(t.includes('donruss'))return BACK_STYLE_LIBRARY['donruss:1989'];
 if(t.includes('upper deck'))return BACK_STYLE_LIBRARY['upper deck:1989'];
 return BACK_STYLE_LIBRARY.generic;
}

function fitText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){
 const words=String(text||'').split(/\s+/);let line='',lines=[];
 for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}
 if(line)lines.push(line);lines=lines.slice(0,maxLines);
 lines.forEach((ln,i)=>ctx.fillText(ln,x,y+i*lineHeight));
 return y+lines.length*lineHeight;
}

function selectedStats(){
 const hi=lastIntel?.highlights||[];
 const target=String(lastPlan?.suggestedYear||lastIntent?.explicitYear||'');
 return hi.find(s=>String(s.season)===target)||hi[0]||(lastIntel?.seasons||[]).slice(-1)[0]||null;
}

async function buildBackCard(){
 if(!results.length){$('status').textContent='Create the front first.';return}
 const style=backStyleFor(lastDescription,lastPlan);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle=style.bg;ctx.fillRect(0,0,768,1024);
 ctx.fillStyle=style.accent;ctx.fillRect(0,0,768,72);
 ctx.fillStyle=style.panel;ctx.fillRect(34,94,700,820);
 ctx.strokeStyle=style.rule;ctx.lineWidth=5;ctx.strokeRect(34,94,700,820);
 ctx.fillStyle=style.ink;ctx.textAlign='left';
 const player=lastIntel?.player||{};
 const stat=selectedStats();
 const backData=CARD_BACK?CARD_BACK.buildData(state(),lastIntel,lastPlan):null;
 const backTitle=backData?.title||player.fullName||state().identity.title||'Featured Card';
 const cardNumber=state().identity.cardNumber||CARD_NUMBERING?.number(backTitle,1)||'CARD-1';
 ctx.font='900 34px Arial';ctx.fillText(backTitle,62,145);
 ctx.textAlign='right';ctx.font='900 18px Arial';ctx.fillText(cardNumber,706,145);ctx.textAlign='left';
 ctx.font='700 17px Arial';ctx.fillText([player.primaryPosition,stat?.team,stat?.season].filter(Boolean).join(' · '),62,176);
 ctx.strokeStyle=style.rule;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(62,195);ctx.lineTo(706,195);ctx.stroke();

 ctx.font='900 19px Arial';ctx.fillText(stat?'PLAYER PROFILE':'CARD PROFILE',62,232);
 ctx.font='16px Arial';
 let yy=264;
 const profileLines=(stat?[
  player.mlbDebutDate?'MLB debut: '+player.mlbDebutDate:'',
  player.batSide?'Bats: '+player.batSide:'',
  player.pitchHand?'Throws: '+player.pitchHand:'',
  player.height?'Height: '+player.height:'',
  player.weight?'Weight: '+player.weight:''
 ]:[
  state().identity.brand?'Brand: '+state().identity.brand:'',
  state().identity.series?'Series: '+state().identity.series:'',
  state().identity.dateText?'Date / era: '+state().identity.dateText:'',
  'Card number: '+cardNumber,
  'Edition: 1/1'
 ]).filter(Boolean);
 profileLines.forEach(v=>{ctx.fillText(v,62,yy);yy+=25});

 ctx.font='900 19px Arial';ctx.fillText(stat?'SELECTED SEASON':'CARD DETAILS',62,410);
 ctx.fillStyle='#ffffff';ctx.fillRect(62,430,644,112);
 ctx.fillStyle=style.ink;ctx.font='800 16px Arial';
 const stats=stat?(stat?.group==='pitching'
  ? [['YR',stat?.season],['TEAM',stat?.team],['W',stat?.wins],['L',stat?.losses],['ERA',stat?.era],['SO',stat?.strikeOuts],['SV',stat?.saves]]
  : [['YR',stat?.season],['TEAM',stat?.team],['G',stat?.gamesPlayed],['AVG',stat?.avg],['HR',stat?.homeRuns],['RBI',stat?.rbi],['H',stat?.hits]])
  : [['CARD',cardNumber],['STYLE',state().selections.style],['BORDER',state().selections.border],['FINISH',state().selections.finish],['EDITION','1/1']];
 let sx=78;stats.forEach(([k,v],i)=>{ctx.font='800 12px Arial';ctx.fillText(String(k||''),sx,460);ctx.font='900 16px Arial';ctx.fillText(String(v??''),sx,492);sx+=i===1?130:105});

 ctx.font='900 19px Arial';ctx.fillText('ORACLE CARD NOTE',62,592);
 ctx.font='16px Arial';
 const note=(lastPlan?.suggestions?.[0]||lastPlan?.specialDetails||(backData?.highlights||[])[0]||'One-of-one fantasy collector card.');
 fitText(ctx,note,62,626,640,24,4);

 ctx.font='900 19px Arial';ctx.fillText('CAREER SNAPSHOT',62,748);
 ctx.font='14px Arial';
 const seasons=(lastIntel?.seasons||[]).slice(-6);
 let sy=777;
 if(seasons.length){seasons.forEach(s=>{
  const row=s.group==='pitching'
   ? [s.season,s.team,'W '+s.wins,'ERA '+s.era,'SO '+s.strikeOuts]
   : [s.season,s.team,'AVG '+s.avg,'HR '+s.homeRuns,'RBI '+s.rbi];
  ctx.fillText(row.filter(Boolean).join('   '),62,sy);sy+=22;
 });}else{
  const lines=[state().identity.brand&&('Brand: '+state().identity.brand),state().identity.series&&('Series: '+state().identity.series),state().identity.dateText&&('Date / era: '+state().identity.dateText),'Card '+cardNumber+' · 1/1'].filter(Boolean);
  lines.forEach(line=>{ctx.fillText(line,62,sy);sy+=25;});
 }

 // High-contrast legal/product line: never white-on-white.
 ctx.fillStyle='#121820';ctx.fillRect(0,956,768,68);
 ctx.fillStyle='#fff';ctx.font='700 13px Arial';ctx.textAlign='center';
 ctx.fillText('Fantasy Craft Product · Infinity® · Produced by Goudey Tradition Trading Card Company LLC',384,988,720);
 backResult=canvas.toDataURL('image/png');
 showBack();
}

function showFront(){
 currentSide='front';$('frontSide').classList.add('active');$('backSide').classList.remove('active');
 if(results.length)$('resultImage').src=results[activeResult>=0?activeResult:results.length-1];
}
function showBack(){
 if(!backResult)return;
 currentSide='back';$('backSide').classList.add('active');$('frontSide').classList.remove('active');
 $('resultImage').src=backResult;$('resultImage').style.display='block';$('empty').style.display='none';$('sideSwitch').style.display='flex';
}


async function stampFrontIdentity(dataURI){
 const s=state(),id=s.identity||{};
 const title=(id.title||s.detected?.title||'').trim();
 const brand=(s.selections.useBrand?id.brand:'')||'';
 const logo=(s.selections.useLogo?id.logoText:'')||'';
 const series=id.series||'';
 const date=s.selections.includeDate?(id.dateText||''):'';
 const cardNumber=id.cardNumber||'';
 if(!title&&!brand&&!logo&&!series&&!date&&!cardNumber)return dataURI;
 const img=new Image();img.src=dataURI;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('front_identity_load_failed'))});
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const w=canvas.width,h=canvas.height,footer=Math.max(34,Math.round(h*.044));
 const pad=Math.round(w*.035);
 const panelH=Math.max(78,Math.round(h*.105));
 const y=h-footer-panelH;
 const dark=s.selections.border==='black'||s.selections.border==='hologram'||s.selections.border==='chrome';
 ctx.fillStyle=dark?'rgba(10,13,17,.88)':'rgba(255,255,255,.94)';
 ctx.fillRect(pad,y,w-pad*2,panelH);
 ctx.strokeStyle=dark?'rgba(255,255,255,.22)':'rgba(20,27,34,.18)';
 ctx.lineWidth=Math.max(1,Math.round(w*.0016));ctx.strokeRect(pad,y,w-pad*2,panelH);
 ctx.textBaseline='alphabetic';ctx.textAlign='left';
 const ink=dark?'#ffffff':'#11161c';
 const sub=dark?'rgba(255,255,255,.78)':'rgba(17,22,28,.72)';
 ctx.fillStyle=ink;
 ctx.font='900 '+Math.max(22,Math.round(w*.045))+'px Arial, Helvetica, sans-serif';
 const displayTitle=title||brand||logo;
 if(displayTitle)ctx.fillText(displayTitle,pad+Math.round(w*.022),y+Math.round(panelH*.48),w-Math.round(w*.18));
 ctx.font='800 '+Math.max(11,Math.round(w*.018))+'px Arial, Helvetica, sans-serif';
 ctx.fillStyle=sub;
 const secondary=[brand&&brand!==displayTitle?brand:'',logo&&logo!==displayTitle&&logo!==brand?logo:'',series,date].filter(Boolean).join(' · ');
 if(secondary)ctx.fillText(secondary,pad+Math.round(w*.022),y+Math.round(panelH*.74),w-Math.round(w*.23));
 if(cardNumber){
  ctx.textAlign='right';ctx.fillStyle=sub;ctx.font='900 '+Math.max(11,Math.round(w*.018))+'px Arial, Helvetica, sans-serif';
  ctx.fillText(cardNumber,w-pad-Math.round(w*.022),y+Math.round(panelH*.74));
 }
 return canvas.toDataURL('image/jpeg',.97);
}

async function stampCollectorMarks(dataURI){
 const s=state();
 if(!s.selections.oneOfOne)return dataURI;
 const img=new Image();img.src=dataURI;
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('collector_mark_load_failed'))});

 const mark=new Image();
 mark.src='./public/assets/one-of-one-gold.svg?v=20261005-1';
 await new Promise((resolve,reject)=>{mark.onload=resolve;mark.onerror=()=>reject(new Error('collector_asset_load_failed'))});

 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);

 const footer=Math.max(34,Math.round(canvas.height*.044));
 const targetW=Math.max(34,Math.round(canvas.width*.055));
 const targetH=Math.round(targetW*(72/180));
 const insetX=Math.max(16,Math.round(canvas.width*.026));
 const insetY=Math.max(10,Math.round(canvas.height*.018));
 const x=canvas.width-insetX-targetW;
 const y=canvas.height-footer-insetY-targetH;

 ctx.save();
 ctx.globalAlpha=.96;
 ctx.drawImage(mark,x,y,targetW,targetH);
 ctx.restore();

 return canvas.toDataURL('image/jpeg',.97);
}

async function stampProductLine(dataURI){
 const img=new Image();img.src=dataURI;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('stamp_load_failed'))});
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const h=Math.max(34,Math.round(canvas.height*.044));
 ctx.fillStyle='rgba(12,17,23,.92)';ctx.fillRect(0,canvas.height-h,canvas.width,h);
 const text='Fantasy Craft Product · Infinity® · Produced by Goudey Tradition Trading Card Company LLC';
 ctx.font=Math.max(10,Math.round(canvas.width*.017))+'px Arial, sans-serif';ctx.fillStyle='rgba(255,255,255,.94)';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(text,canvas.width/2,canvas.height-h/2,canvas.width-Math.round(canvas.width*.04));
 return canvas.toDataURL('image/jpeg',.95);
}


async function renderExactWhiteFlagship(sourceBlob){
 const img=new Image();img.src=URL.createObjectURL(sourceBlob);
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('source_image_load_failed'))});
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
 const ctx=canvas.getContext('2d',{alpha:false});
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,768,1024);

 // clean flagship white border
 ctx.fillStyle='#ffffff';ctx.fillRect(28,28,712,968);
 ctx.strokeStyle='#d8dde2';ctx.lineWidth=3;ctx.strokeRect(42,42,684,940);

 // photo window
 const px=66,py=78,pw=636,ph=744;
 ctx.fillStyle='#f6f7f8';ctx.fillRect(px,py,pw,ph);
 const scale=Math.max(pw/img.naturalWidth,ph/img.naturalHeight);
 const sw=pw/scale,sh=ph/scale;
 const sx=Math.max(0,(img.naturalWidth-sw)/2),sy=Math.max(0,(img.naturalHeight-sh)/2);
 ctx.drawImage(img,sx,sy,sw,sh,px,py,pw,ph);
 URL.revokeObjectURL(img.src);

 // restrained inner rule
 ctx.strokeStyle='#171b20';ctx.lineWidth=2;ctx.strokeRect(px,py,pw,ph);

 // identity strip left intentionally plain; exact text is added later
 ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillRect(66,822,636,118);
 ctx.strokeStyle='#d9dde1';ctx.lineWidth=2;ctx.strokeRect(66,822,636,118);

 return {ok:true,dataURI:canvas.toDataURL('image/jpeg',.97),mode:'exact-source'};
}

async function blobToDataURI(blob){
 return await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||''));
  reader.onerror=()=>reject(new Error('image_encode_failed'));
  reader.readAsDataURL(blob);
 });
}

async function renderWithComfy(blob,prompt){
 const imageDataURI=await blobToDataURI(blob);
 const r=await fetchWithTimeout(COMFY_RENDERER_ENDPOINT,{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({imageDataURI,prompt,width:768,height:1024,denoise:.28})
 },150000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok){const e=new Error(String(d.error||'comfy_renderer_failed'));e.code=String(d.error||'');throw e}
 return d;
}

async function renderCard(blob,prompt,description,designBlob=null){
 try{
  const comfy=await renderWithComfy(blob,prompt);
  return {...comfy,mode:'comfyui-flux'};
 }catch(comfyError){
  if(comfyError.code!=='renderer_not_configured'&&comfyError.code!=='renderer_offline'){
   console.warn('Comfy renderer unavailable:',comfyError);
  }
 }
 const form=new FormData();
 form.append('image',blob,'subject.jpg');
 if(designBlob)form.append('design_reference',designBlob,'design-reference.jpg');
 form.append('prompt',prompt);
 form.append('request',description);
 if(ABILITY_ROUTER&&lastToolPlan){
  lastAbilityRoute=ABILITY_ROUTER.route({...lastToolPlan,mode:buildMode});
  form.append('ability_route',JSON.stringify(lastAbilityRoute));
  form.append('build_spec',JSON.stringify(lastToolPlan));
 }
 const r=await fetch(SERVICE+'/v1/image',{method:'POST',body:form});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok){const e=new Error(String(d.error||'generation_failed'));e.code=String(d.error||'');throw e}
 return d;
}

async function createCard(count=1,mode='original'){
 const freeform=$('message').value.trim();
 const description=builderDescription(freeform);
 if(!sourceFile){$('status').innerHTML='<strong>Add a photo first.</strong>';return}
 if(mode==='reference'&&!referenceFile){$('status').innerHTML='<strong>Add a card design reference first.</strong>';return}
 setBusy(true,count===3?'Creating 3…':'Creating…');$('status').textContent='Designing your card…';showMonitor();
 try{
  results=[];activeResult=-1;renderVariationBar();$('resultActions').style.display='none';
  stage('prepare','active','Preparing a high-quality reference image…');
  lastBlob=await resizeImage(sourceFile);
  lastReferenceBlob=mode==='reference'?await resizeImage(referenceFile):null;
  lastDescription=description||builderDescription('Build a new card using the uploaded reference design.');
  buildMode=mode;
  stage('prepare','done');
  stage('plan','active','Locking your selected card design…');
  const chosenTitle=state().identity.title||state().detected.title||'';
  const sportsContext=/\b(baseball|mlb|pitcher|catcher|rookie|home run|batting|reds|yankees|dodgers|cubs|cardinals)\b/i.test(lastDescription);
  lastIntent={
   playerQuery:sportsContext?chosenTitle:'',
   teamQuery:'',
   explicitYear:(lastDescription.match(/\b(?:19|20)\d{2}\b/)||[])[0]||'',
   cardType:sportsContext?'sports card':'collectible card',
   subset:'',
   historicalAngle:''
  };
  try{lastIntel=sportsContext&&chosenTitle?await fetchPlayerIntel(chosenTitle):null}catch{lastIntel=null}
  lastPlan=mode==='reference'?localReferencePlan(lastDescription):localDesignPlan(lastDescription,lastIntel,lastIntent);
  if(CARD_CRITIC){
   const check=CARD_CRITIC.inspectSpec(state(),lastPlan?.renderPrompt||'');
   if(!check.ok&&CARD_TEMPLATES)lastPlan.renderPrompt=builderDescription(freeform)+'\n\n'+lastPlan.renderPrompt;
  }
  $('smartIdeas').style.display='none';
  if(ABILITY_ROUTER&&lastToolPlan)lastAbilityRoute=ABILITY_ROUTER.route({...lastToolPlan,mode:buildMode});
  stage('plan','done',lastAbilityRoute?'Ability route locked: '+lastAbilityRoute.abilities.map(a=>a.engine).join(' → '):lastToolPlan?'Builder tools locked the card specification.':'Design direction ready.');
  await generateFromPlan(count===3?'variations':'single',count);
 }catch(e){
  const active=document.querySelector('.buildStep.active');
  if(active){active.classList.remove('active');active.classList.add('error');active.querySelector('.state').textContent='Check'}
  $('buildNote').textContent='Build stopped here. Your photo and description are still ready to retry.';
  $('status').innerHTML='<strong>Build stopped.</strong> Try again.';
 }finally{setBusy(false)}
}

async function buildAction(kind,instruction=''){
 if(!lastBlob||!lastPlan||!lastDescription){$('status').textContent='Create a card first.';return}
 setBusy(true,kind==='style'?'Improving style…':kind==='layout'?'Improving layout…':'Creating…');
 $('buildMonitor').style.display='block';$('resultImage').style.display='none';$('resultActions').style.display='none';resetMonitor();
 stage('prepare','done');stage('plan','done');
 try{
  await generateFromPlan(kind,1,instruction);
 }catch(e){
  const active=document.querySelector('.buildStep.active');if(active){active.classList.remove('active');active.classList.add('error');active.querySelector('.state').textContent='Check'}
  $('buildNote').textContent='This variation stopped. Your previous cards are safe.';
  $('status').innerHTML='<strong>Variation stopped.</strong> Try again.';
  if(results.length)await showResult(activeResult>=0?activeResult:results.length-1);
 }finally{setBusy(false)}
}
$('make').addEventListener('click',()=>createCard(1,'original'));
$('buildLike').addEventListener('click',()=>createCard(1,'reference'));
$('make3').addEventListener('click',()=>createCard(3,referenceFile?'reference':'original'));
$('retryBtn').addEventListener('click',async()=>{
 const action=$('retryBtn').dataset.action||'style';
 if(action==='reread'){
  if(sourceFile){
   $('reviewStatus').innerHTML='<strong>Re-reading the uploaded image…</strong>';
   const vision=await completeVisionIdentity(await readUploadedImage(sourceFile).catch(()=>({})));
   applyVisionResult(vision);
   await updateReviewPanel(results[activeResult]||results.at(-1)||'');
  }
  return;
 }
 buildAction(action,$('retryBtn').dataset.instruction||'');
});
$('tightenBtn').addEventListener('click',()=>buildAction($('tightenBtn').dataset.action||'layout',$('tightenBtn').dataset.instruction||''));
$('moreBtn').addEventListener('click',()=>buildAction($('moreBtn').dataset.action||'variation',$('moreBtn').dataset.instruction||''));
$('backBtn').addEventListener('click',buildBackCard);
$('frontSide').addEventListener('click',showFront);
$('backSide').addEventListener('click',()=>{if(backResult)showBack();else buildBackCard()});
$('newCard').addEventListener('click',()=>{
 results=[];activeResult=-1;backResult='';currentSide='front';lastPlan=null;lastBlob=null;lastReferenceBlob=null;lastDescription='';lastIntel=null;lastIntent=null;buildMode='original';clearImageTray();CARD_STATE?.reset();$('message').value='';builderStepBlocks().forEach((b,i)=>{b.classList.toggle('current',i===0);b.classList.remove('complete')});updateBuilderSummary();
 $('resultImage').style.display='none';$('buildMonitor').style.display='none';$('empty').style.display='grid';$('resultActions').style.display='none';$('reviewPanel').style.display='none';$('variationBar').style.display='none';$('sideSwitch').style.display='none';$('smartIdeas').style.display='none';$('status').textContent='Ready for another card.';
});
