const SERVICE='https://infinity-rogers.marvaseater.workers.dev';
const COMFY_RENDERER_ENDPOINT=SERVICE+'/v1/comfy-image';
const CODE_PHI_INSPECT='https://orange-brook-a2ac.marvaseater.workers.dev/code-phi/inspect';
const WEB_CONTEXT_SEARCH='https://orange-brook-a2ac.marvaseater.workers.dev/search';
const $=id=>document.getElementById(id);
const BUILDER=window.OracleBuilderTools||null;
const ABILITY_ROUTER=window.OracleAbilityRouter||null;
const CARD_STATE=window.OracleCardState||null;
const CARD_NUMBERING=window.OracleCardNumbering||null;
const CARD_TEMPLATES=window.OracleCardTemplates||null;
const CARD_BACK=window.OracleCardBack||null;
const CARD_CRITIC=window.OracleCardCritic||null;
const TEMPLATE_DB=window.OracleTemplateDB||null;
const TEMPLATE_REF_KEY='oracle-template-refs-v1';
const TEMPLATE_REF_TTL=7*24*3600*1000;
const TEMPLATE_REF_MISS_TTL=3600*1000;
// Route the image reader to read the whole image, not just the main subject.
const FULL_READ_INSTRUCTIONS=[
 'Read EVERYTHING in this image before answering: every printed word, name, number, jersey number, logo text, watermark, caption, copyright/credit line, card-maker mark, year, team, league, studio, network, franchise and series text, in every corner and on every edge.',
 'Also describe the subject, scene, objects, colors, era clues and media clues.',
 'Decide the category: sports, movie, tv or other. If the image is itself a trading card, report the card maker (Topps, Upper Deck, Donruss, Fleer, Bowman, Panini, Score, SkyBox…) and the card year when printed or clearly identifiable.',
 'Return JSON with: visibleText[], logos[], numbers[], subjectType, category, cardMaker, cardYear, franchise, studio, network, team, league, movieTitle, showTitle, characterName, playerName, titleOptions[], brandOptions[], contextOptions[], keywords[], eraClues[], mediaClues[], objects[], colors[], semanticDescription.',
 'Never identify a real person or character from appearance alone; only use names that are printed or otherwise evidenced.'
].join(' ');
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
let photoReadGeneration=0;
let imageReadPromise=Promise.resolve();
let imageReadState='idle';
let lastVision=null;
let lastWebContext=[];
let lastImageComparison=null;
let lastTemplateRefs=[];


function state(){return CARD_STATE?.state||{selections:{border:'white',style:'flagship',finish:'paper',signature:'none',oneOfOne:true,useLogo:true,useBrand:true,includeDate:true,buildBack:true},identity:{title:'',brand:'',logoText:'',series:'',dateText:'',cardNumber:''},detected:{}}}

function activeCategory(){
 const s=state();
 const chosen=String(s.selections.category||'auto');
 if(chosen!=='auto')return chosen;
 if(!TEMPLATE_DB)return 'sports';
 const detected=String(s.detected.category||'');
 if(detected&&detected!=='other')return detected;
 return TEMPLATE_DB.detectCategory({
  text:[$('message')?.value,s.identity.context,s.identity.brand,s.identity.series].filter(Boolean).join(' '),
  subjectType:s.detected.subjectType||lastVision?.subjectType||'',
  keywords:s.detected.keywords,
  mediaClues:lastVision?.mediaClues,
  semanticDescription:lastVision?.semanticDescription
 });
}
function activeTemplate(){
 if(!TEMPLATE_DB)return null;
 const s=state();
 const chosen=String(s.selections.template||'auto');
 if(chosen!=='auto'){const t=TEMPLATE_DB.get(chosen);if(t)return t;}
 const category=activeCategory();
 const text=[$('message')?.value,s.identity.series,s.identity.dateText,s.detected.cardMaker,s.detected.cardYear].filter(Boolean).join(' ');
 return TEMPLATE_DB.match(text,{category})||TEMPLATE_DB.defaultFor(category);
}
function templateLabel(t){return t?t.year+' '+t.maker+(t.line==='Flagship'?'':' '+t.line):'';}
function populateTemplateSelect(){
 const sel=$('cardTemplateSelect');if(!sel||!TEMPLATE_DB)return;
 const category=String(state().selections.category||'auto');
 const current=String(state().selections.template||'auto');
 sel.innerHTML='';
 const auto=document.createElement('option');auto.value='auto';auto.textContent='Auto match';sel.appendChild(auto);
 for(const maker of TEMPLATE_DB.makers()){
  const items=TEMPLATE_DB.list({maker}).filter(t=>category==='auto'||t.category===category).sort((a,b)=>a.year-b.year);
  if(!items.length)continue;
  const group=document.createElement('optgroup');group.label=maker;
  items.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=templateLabel(t);group.appendChild(o)});
  sel.appendChild(group);
 }
 sel.value=[...sel.options].some(o=>o.value===current)?current:'auto';
 CARD_STATE?.setSelection('template',sel.value);
 refreshAutoTemplateLabel();
}
function refreshAutoTemplateLabel(){
 const o=$('cardTemplateSelect')?.querySelector('option[value="auto"]');
 if(!o)return;
 o.textContent=state().selections.template==='auto'&&TEMPLATE_DB?'Auto: '+templateLabel(activeTemplate()):'Auto match';
}
function syncTemplateControls(){
 if($('cardCategorySelect'))$('cardCategorySelect').value=state().selections.category||'auto';
 populateTemplateSelect();
}
function readTemplateRefs(){
 try{const v=JSON.parse(localStorage.getItem(TEMPLATE_REF_KEY)||'{}');return v&&typeof v==='object'?v:{}}catch{return {}}
}
// Builds a local database of real online example images for each template
// design (SearXNG image search through the Cloudflare worker), cached per template.
async function fetchTemplateReferences(tpl){
 if(!tpl||!TEMPLATE_DB)return [];
 const db=readTemplateRefs();
 const hit=db[tpl.id];
 const ttl=hit?.miss?TEMPLATE_REF_MISS_TTL:TEMPLATE_REF_TTL;
 if(hit&&Date.now()-Number(hit.at||0)<ttl&&Array.isArray(hit.images))return hit.images;
 const remember=(images,miss)=>{
  db[tpl.id]={at:Date.now(),query:TEMPLATE_DB.referenceQuery(tpl),images,miss};
  try{localStorage.setItem(TEMPLATE_REF_KEY,JSON.stringify(db))}catch{}
 };
 try{
  const query=TEMPLATE_DB.referenceQuery(tpl);
  const u=new URL(WEB_CONTEXT_SEARCH);
  u.search=new URLSearchParams({q:query,format:'json',categories:'images',safesearch:'1'});
  const res=await fetchWithTimeout(u.toString(),{headers:{'Accept':'application/json'}},5000);
  if(!res.ok){if(!hit?.images?.length)remember([],true);return hit?.images||[];}
  const json=await res.json().catch(()=>({}));
  const images=(Array.isArray(json.results)?json.results:[]).map(x=>({
   title:String(x.title||'').slice(0,160),
   url:String(x.url||'').slice(0,500),
   image:String(x.img_src||x.thumbnail_src||'').slice(0,800)
  })).filter(x=>/^https?:\/\//i.test(x.image)).slice(0,8);
  if(images.length)remember(images,false);
  else if(!hit?.images?.length)remember([],true);
  return images.length?images:(hit?.images||[]);
 }catch{
  if(!hit?.images?.length)remember([],true);
  return hit?.images||[];
 }
}

function builderDescription(freeform=''){
 const s=state();
 const title=s.identity.title||s.detected.title||'';
 const context=s.identity.context||s.detected.context||'';
 const brand=s.identity.brand||s.detected.brand||'';
 const series=s.identity.series||'';
 const dateText=s.identity.dateText||s.detected.date||s.detected.era||'';
 const subjectType=s.detected.subjectType||lastVision?.subjectType||'';
 const keywords=Array.isArray(s.detected.keywords)?s.detected.keywords.slice(0,20):[];
 const visibleText=asTextArray(lastVision?.visibleText).slice(0,16);
 const semantic=String(lastVision?.semanticDescription||lastVision?.description||'').trim();
 const mediaClues=asTextArray(lastVision?.mediaClues).slice(0,10);
 const eraClues=asTextArray(lastVision?.eraClues).slice(0,10);
 if(CARD_NUMBERING&&title&&!s.identity.cardNumber)s.identity.cardNumber=CARD_NUMBERING.number(title,1);
 const category=activeCategory();
 const roles=TEMPLATE_DB?.CATEGORIES[category]||null;
 const tpl=activeTemplate();
 return [
  'IMAGE-DERIVED CARD DATA:',
  roles?'Card type: '+roles.label+'. Brand spot = '+roles.brandRole+'. Name plate (lower right) = '+roles.titleRole+'. Context = '+roles.contextRole+'.':'',
  title?'Title / subject: '+title+'.':'Title / subject: unknown.',
  context?'Context: '+context+'.':'',
  brand?'Brand / logo text: '+brand+'.':'',
  series?'Series / type: '+series+'.':'',
  dateText?'Date / era: '+dateText+'.':'',
  subjectType?'Detected subject type: '+subjectType+'.':'',
  visibleText.length?'EXACT VISIBLE TEXT FROM IMAGE: '+visibleText.join(' | ')+'.':'',
  semantic?'IMAGE SEMANTIC DESCRIPTION: '+semantic+'.':'',
  mediaClues.length?'Media clues: '+mediaClues.join('; ')+'.':'',
  eraClues.length?'Era clues: '+eraClues.join('; ')+'.':'',
  lastImageComparison?.compared?'SEARXNG IMAGE COMPARISON: '+JSON.stringify({title:lastImageComparison.title,context:lastImageComparison.context,brand:lastImageComparison.brand,series:lastImageComparison.series,date:lastImageComparison.date,confidence:lastImageComparison.confidence,matches:lastImageComparison.matches,evidence:lastImageComparison.evidence})+'.':'',
  keywords.length?'Visual keywords: '+keywords.join(', ')+'.':'',
  tpl?TEMPLATE_DB.promptFor(tpl):'',
  lastTemplateRefs.length?'TEMPLATE REFERENCE IMAGES FOUND ONLINE for '+templateLabel(tpl)+': '+lastTemplateRefs.slice(0,5).map(r=>r.title).filter(Boolean).join(' | ')+'.':'',
  'BUILD SETTINGS: template '+(tpl?templateLabel(tpl):'none')+', style '+String(s.selections.style||'flagship')+', border '+String(s.selections.border||'')+', finish '+String(s.selections.finish||'')+', '+(s.selections.oneOfOne?'1/1 on':'1/1 off')+'.',
  s.identity.cardNumber?'Internal card number: '+s.identity.cardNumber+'.':'',
  'SOURCE IMAGE POLICY: preserve the recognizable identity and important source-image details. Treat the uploaded image as the factual visual source, not as a suggestion to invent a replacement subject.',
  freeform?'USER INSTRUCTION: '+freeform:'USER INSTRUCTION: Design the strongest coherent collectible card that fits the image and detected context.'
 ].filter(Boolean).join('\n');
}

function renderSkillsPanel(route=null){
 const box=$('skillsPanel');if(!box)return;
 const abilities=Array.isArray(route?.abilities)?route.abilities:[];
 box.innerHTML='';
 if(!abilities.length){box.style.display='none';return}
 const title=document.createElement('div');title.className='skillsLabel';title.textContent='Skills in use';box.appendChild(title);
 const chips=document.createElement('div');chips.className='skillsChips';
 abilities.forEach(a=>{
  const chip=document.createElement('div');chip.className='skillChip';
  const name=document.createElement('strong');name.textContent=String(a.engine||a.id||'Skill');
  const purpose=document.createElement('span');purpose.textContent=String(a.purpose||'');
  chip.appendChild(name);chip.appendChild(purpose);chips.appendChild(chip);
 });
 box.appendChild(chips);box.style.display='block';
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
  const next=group==='style'?'border':group==='border'?'finish':group==='finish'?'collector':null;
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
 ['editBrandBtn','editSeriesBtn'].forEach(id=>$(id)?.addEventListener('click',()=>{$('customFields').classList.add('open');}));
 $('showNameToggle')?.addEventListener('click',()=>{
  const on=!state().selections.showName;CARD_STATE?.setSelection('showName',on);
  $('showNameToggle').classList.toggle('active',on);$('showNameToggle').textContent=on?'Name On':'Name Off';
 });
 $('showContextToggle')?.addEventListener('click',()=>{
  const on=!state().selections.showContext;CARD_STATE?.setSelection('showContext',on);
  $('showContextToggle').classList.toggle('active',on);$('showContextToggle').textContent=on?'Team / Movie On':'Team / Movie Off';
 });
 $('cardCategorySelect')?.addEventListener('change',e=>{
  CARD_STATE?.setSelection('category',e.target.value);
  populateTemplateSelect();
 });
 $('cardTemplateSelect')?.addEventListener('change',e=>{
  CARD_STATE?.setSelection('template',e.target.value);
  refreshAutoTemplateLabel();
 });
 $('message')?.addEventListener('input',refreshAutoTemplateLabel);
 const inputMap={cardTitleInput:'title',cardContextInput:'context',cardBrandInput:'brand',cardSeriesInput:'series',cardDateInput:'dateText'};
 Object.entries(inputMap).forEach(([id,key])=>$(id)?.addEventListener('input',e=>{
  CARD_STATE?.setIdentity(key,e.target.value);
  if(key==='brand'){CARD_STATE?.setIdentity('logoText',e.target.value);if($('cardLogoInput'))$('cardLogoInput').value=e.target.value;}
  if(key==='title'&&CARD_NUMBERING)state().identity.cardNumber=e.target.value?CARD_NUMBERING.number(e.target.value,1):'';
  refreshAutoTemplateLabel();
 }));
 $('identityContinue').addEventListener('click',()=>{
  const s=state();const title=s.identity.title||s.detected.title||'Title not set';
  completeBuilderStep('identity',[title,s.identity.context,s.identity.brand,s.identity.series,s.identity.dateText].filter(Boolean).join(' · '),null);
 });
 syncTemplateControls();
 updateBuilderSummary();
}
function applyReaderSuggestions(data={}){
 CARD_STATE?.applyDetected(data);
 const box=$('readerIdeas');box.innerHTML='';
 const suggestions=[];
 for(const title of (data.titleOptions||[]).slice(0,4))suggestions.push({label:title,apply:()=>{CARD_STATE?.setIdentity('title',title);$('cardTitleInput').value=title;state().identity.cardNumber=CARD_NUMBERING?.number(title,1)||'';}});
 // Style is chosen by the user first. Image reading must never silently change it.
 for(const item of suggestions){
  const b=document.createElement('button');b.type='button';b.className='choiceBtn';b.textContent=item.label;b.addEventListener('click',item.apply);box.appendChild(b);
 }
 box.classList.toggle('visible',suggestions.length>0);
}
window.applyOracleReaderSuggestions=applyReaderSuggestions;

initBuilderControls();
lastAbilityRoute=ABILITY_ROUTER?.route({semantics:{raw:''},mode:'original'})||null;
renderSkillsPanel(lastAbilityRoute);
// Simple flow: keep the uploader first, followed by GPT-prefilled fields and the instruction box.


function setBusy(busy,label='Creating…'){
 $('make').disabled=busy;$('make3').disabled=busy;$('buildLike').disabled=busy;
 if($('autoMake'))$('autoMake').disabled=busy;if($('auto3'))$('auto3').disabled=busy;
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

async function inspectRenderedCardWithCodePhi(renderedBlob){
 try{
  const preview=await prepareTransportImage(renderedBlob,{max:420,maxBytes:180000});
  const data=await blobToDataURI(preview);
  const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;background:#151515;min-height:100%}main{min-height:100vh;display:grid;place-items:start center;padding:10px}img{display:block;width:min(100%,384px);height:auto}</style></head><body><main><img src="'+data+'" alt="Finished collectible card preview"></main></body></html>';
  const response=await fetchWithTimeout(CODE_PHI_INSPECT,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({html,query:'Oracle collectible card visual verification'})
  },22000);
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.ok)return null;

  const screenshot=String(payload.inspection?.screenshotDataURI||'');

  return {
   summary:String(payload.summary||''),
   issues:Array.isArray(payload.issues)?payload.issues.slice(0,20):[],
   screenshotVision:null,
   inspection:payload.inspection?{
    consoleErrors:payload.inspection.consoleErrors||[],
    pageErrors:payload.inspection.pageErrors||[],
    failedRequests:payload.inspection.failedRequests||[],
    diagnostics:payload.inspection.diagnostics||{},
    viewport:payload.inspection.diagnostics?.viewport||null,
    screenshotCaptured:Boolean(screenshot)
   }:null
  };
 }catch{return null}
}

async function askOracleToReview(src){
 try{
  const renderedBlob=await dataURIToBlob(src);
  const [visual,browserInspection]=await Promise.all([
   readUploadedImage(renderedBlob,{review:true}).catch(()=>null),
   inspectRenderedCardWithCodePhi(renderedBlob).catch(()=>null)
  ]);
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

CODE PHI CLOUD BROWSER INSPECTION:
${JSON.stringify(browserInspection||{})}

CODE PHI SCREENSHOT VISION:
${JSON.stringify(browserInspection?.screenshotVision||{})}

DESIGN PLAN:
${JSON.stringify(lastPlan||{})}

Return ONLY JSON:
{
 "qualityScore":0,
 "blocking":false,
 "repairInstruction":"",
 "summary":"one short sentence saying the most important thing to fix or preserve",
 "actions":[
  {"kind":"style","label":"short button label","instruction":"specific style correction"},
  {"kind":"layout","label":"short button label","instruction":"specific layout/crop/spacing correction"},
  {"kind":"variation","label":"short button label","instruction":"specific alternate direction"}
 ]
}

Rules:
- Judge this finished render, not a generic template.
- Treat Code Phi browser errors, broken images and overflow as hard defects.
- Use the rendered-card vision read as the visual truth for the finished card.
- Use Code Phi browser diagnostics as the truth for mobile overflow, broken images, failed requests and runtime errors.
- Do not assume requested text or branding actually rendered.
- Strongly penalize giant dead space, tiny title/logo treatment, generic picture-frame appearance, weak subject scale, awkward crop, unreadable or duplicated text, and collector marks that collide with content.
- qualityScore is 0-100 for the finished card as actually seen on a phone.
- blocking=true ONLY for a clear major defect that should be repaired before presenting the final card: broken/missing image, severe crop, giant unintended dead space, generic empty-frame output, illegible/garbled dominant text, or a major collision.
- repairInstruction must be a single executable correction for the renderer. If blocking=false, leave repairInstruction blank.
- Do not call normal taste differences blocking.
- Do not ask the user to fill title, brand, or logo; Auto Build owns those.
- Preserve exact subject identity and user photo.
- If visible text looks garbled or duplicated, make the correction explicit.
- If title/logo placement is missing or weak, make that the highest priority.
- Keep each button label under 22 characters.
- Never invent a real athlete or brand unsupported by the locked request or vision read.`;
  async function criticCall(extra='',task='finished-card-critic'){
   const r=await fetchWithTimeout(SERVICE+'/v1/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({input:input+extra,context:{application:'Oracle Card Studio',task,codePhiBrowser:Boolean(browserInspection)}})
   },30000);
   const d=await r.json().catch(()=>({}));
   if(!r.ok||!d.ok)throw new Error(String(d.error||'oracle_review_failed'));
   const parsed=extractJSON(String(d.output||d.output_text||d.answer||''));
   if(!parsed||!Array.isArray(parsed.actions))throw new Error('oracle_review_invalid_json');
   return parsed;
  }
  try{
   return await criticCall();
  }catch(firstError){
   return await criticCall(
    '\n\nRECOVERY PASS: Return the exact JSON schema requested above. Use the strongest visible defect from the rendered-card read/browser screenshot and provide three concrete repair actions. Do not explain outside JSON.',
    'finished-card-critic-recovery'
   );
  }
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
 back.style.display=state().selections.buildBack?'inline-block':'none';back.textContent='Build Back';primary.style.display='inline-block';

 if(!review.complete){
  status.innerHTML='<strong>Oracle is reviewing this exact card while image identity finishes…</strong>';
 }else{
  status.innerHTML='<strong>Oracle is reviewing this exact card…</strong>';
 }
 primary.textContent='Improve Style';primary.dataset.action='style';primary.dataset.instruction='';
 layout.textContent='Improve Layout';layout.dataset.action='layout';layout.dataset.instruction='';layout.style.display='inline-block';
 variation.textContent='New Variation';variation.dataset.action='variation';variation.dataset.instruction='';variation.style.display='inline-block';

 const critique=src?await askOracleToReview(src):null;
 if(!critique){
  status.innerHTML='<strong>Oracle visual review could not finish.</strong> The finished card is still available; use Improve Style, Improve Layout, or New Variation.';
  return null;
 }
 const score=Number(critique.qualityScore);
 status.innerHTML='<strong>Oracle review'+(Number.isFinite(score)?' · '+Math.max(0,Math.min(100,Math.round(score)))+'/100':'')+':</strong> '+String(critique.summary||'The card is ready for a targeted refinement.');
 const buttons=[primary,layout,variation];
 critique.actions.slice(0,3).forEach((action,i)=>{
  const btn=buttons[i];if(!btn)return;
  const kind=['style','layout','variation'].includes(action.kind)?action.kind:(i===0?'style':i===1?'layout':'variation');
  btn.dataset.action=kind;
  btn.dataset.instruction=String(action.instruction||'');
  btn.textContent=String(action.label||btn.textContent).slice(0,22);
 });
 return critique;
}

async function showResult(index,{review=true}={}){
 const src=results[index];if(!src)return;
 if(autoBacks.has(src))backResult=autoBacks.get(src);
 if($('resultHeading'))$('resultHeading').textContent='Finished design';
 activeResult=index;$('resultImage').src=src;$('resultImage').style.display='block';$('empty').style.display='none';
 $('buildMonitor').style.display='none';$('resultActions').style.display='flex';$('newCard').style.display='inline-block';$('sideSwitch').style.display=backResult?'flex':'none';currentSide='front';$('frontSide').classList.add('active');$('backSide').classList.remove('active');
 renderVariationBar();if(review)await updateReviewPanel(src);
}

async function finishOutput(out,{review=true,display=true}={}){
 if(!out?.dataURI)throw new Error('empty_image');
 const base=out.dataURI;
 const typed=await stampFrontIdentity(base);
 const finished=await stampCollectorMarks(typed);
 const img=new Image();img.src=finished;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('image_display_failed'))});
 results.push(finished);
 if(display)await showResult(results.length-1,{review});
 return finished;
}

async function iterateFinishedCardOnce(finished,{allowRepair=true}={}){
 let critique=await updateReviewPanel(finished).catch(()=>null);
 const score=Number(critique?.qualityScore);
 const blocking=critique?.blocking===true||String(critique?.blocking||'').toLowerCase()==='true';
 const shouldRepair=Boolean(
  allowRepair&&blocking&&String(critique?.repairInstruction||'').trim()&&
  (!Number.isFinite(score)||score<72)
 );
 if(!shouldRepair)return {finished,critique,repaired:false};

 stage('iterate','active','GPT found a blocking visual defect. Repairing it once before final output…');
 const repairInstruction=String(critique.repairInstruction||'').trim();
 const repairPrompt=(lastPlan?.renderPrompt||lastDescription||'Create a polished collectible card from the uploaded image.')+
  ' ORACLE AUTOMATIC REPAIR: '+repairInstruction+
  ' Preserve the exact uploaded source subject and all locked factual text/data. Do not introduce a new subject, brand, team, era or title.';

 const repairedOut=await renderCard(lastBlob,repairPrompt,lastDescription,lastReferenceBlob);
 const oldIndex=results.lastIndexOf(finished);
 if(oldIndex>=0)results.splice(oldIndex,1);
 const repaired=await finishOutput(repairedOut,{review:false,display:false});
 critique=await updateReviewPanel(repaired).catch(()=>null);
 return {finished:repaired,critique,repaired:true};
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
 // Exact-source mode must never be blocked by planner/validator failures.
 for(let i=0;i<count;i++){
  stage('render','active',count>1?'Rendering variation '+(i+1)+' of '+count+'…':'Building the card from your exact image…');
  const basePrompt=kind==='single'?(lastPlan.renderPrompt||lastDescription):variationPrompt(lastPlan,kind,i,instruction);
  const out=await renderCard(lastBlob,basePrompt,lastDescription,lastReferenceBlob);
  stage('render','done');
  stage('finish','active','Finishing…');
  const finished=await finishOutput(out,{review:false,display:false});
  stage('finish','done');
  stage('iterate','active','GPT is inspecting the finished card and preparing repairs…');
  const iteration=await iterateFinishedCardOnce(finished,{allowRepair:true});
  stage('iterate','done',iteration.repaired?'GPT repaired one blocking defect and rechecked the card.':iteration.critique?'GPT visual review ready.':'Card finished. Manual refinement controls are ready.');
 }
 if(results.length)await showResult(results.length-1,{review:false});
 $('status').innerHTML='<strong>'+count+' card'+(count>1?'s':'')+' created.</strong>';
}


async function readUploadedImage(blob,{review=false}={}){
 const transport=await prepareTransportImage(blob,{max:1200,maxBytes:2_800_000});
 const form=new FormData();
 form.append('image',transport,'reader.jpg');
 form.append('purpose',review?'review':'full-read');
 form.append('detail','full');
 form.append('instructions',FULL_READ_INSTRUCTIONS);
 const r=await fetchWithTimeout(SERVICE+'/v1/image-read',{method:'POST',body:form},review?22000:45000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok){
  const e=new Error('Image reader /v1/image-read '+r.status+': '+String(d.error||d.detail||'image_read_failed'));
  e.status=r.status;e.route='/v1/image-read';throw e;
 }
 return d;
}

function firstText(values){
 return (Array.isArray(values)?values:[]).map(v=>String(v||'').trim()).find(Boolean)||'';
}

function asTextArray(v){
 if(Array.isArray(v))return v.map(x=>String(x||'').trim()).filter(Boolean);
 if(typeof v==='string'&&v.trim())return [v.trim()];
 return [];
}
function normalizeVisionPayload(raw={}){
 const root=raw&&typeof raw==='object'?raw:{};
 const nested=[root.analysis,root.result,root.vision,root.data].find(v=>v&&typeof v==='object')||{};
 const all={...nested,...root};

 const visibleText=[
  ...asTextArray(all.visibleText),
  ...asTextArray(all.ocr),
  ...asTextArray(all.text),
  ...asTextArray(all.detectedText),
  ...asTextArray(all.allText),
  ...asTextArray(all.logos),
  ...asTextArray(all.numbers),
  ...asTextArray(all.captions)
 ].filter(Boolean);

 const titleOptions=[
  ...asTextArray(all.titleOptions),
  ...asTextArray(all.titles),
  ...asTextArray(all.title),
  ...asTextArray(all.playerName),
  ...asTextArray(all.characterName),
  ...asTextArray(all.name),
  ...visibleText.filter(t=>t.length<=40)
 ].filter(Boolean);

 const brandOptions=[
  ...asTextArray(all.brandOptions),
  ...asTextArray(all.brands),
  ...asTextArray(all.franchise),
  ...asTextArray(all.studio),
  ...asTextArray(all.network),
  ...asTextArray(all.brand),
  ...asTextArray(all.logoText),
  ...asTextArray(all.logos),
  ...asTextArray(all.cardMaker)
 ].filter(Boolean);

 const contextOptions=[
  ...asTextArray(all.contextOptions),
  ...asTextArray(all.teamOptions),
  ...asTextArray(all.movieOptions),
  ...asTextArray(all.context),
  ...asTextArray(all.team),
  ...asTextArray(all.movie),
  ...asTextArray(all.movieTitle),
  ...asTextArray(all.showTitle),
  ...asTextArray(all.show),
  ...asTextArray(all.league)
 ].filter(Boolean);

 return {
  ...all,
  visibleText:[...new Set(visibleText)],
  titleOptions:[...new Set(titleOptions)],
  brandOptions:[...new Set(brandOptions)],
  contextOptions:[...new Set(contextOptions)],
  subjectType:String(all.subjectType||all.subject||all.category||'').trim(),
  category:String(all.category||'').trim().toLowerCase(),
  cardMaker:String(all.cardMaker||all.manufacturer||'').trim(),
  cardYear:String(all.cardYear||'').trim(),
  keywords:[...new Set([
   ...asTextArray(all.keywords),
   ...asTextArray(all.labels),
   ...asTextArray(all.tags),
   ...asTextArray(all.visualTraits),
   ...asTextArray(all.eraClues),
   ...asTextArray(all.mediaClues),
   ...asTextArray(all.objects),
   ...asTextArray(all.colors),
   ...asTextArray(all.environment)
  ])],
  visualTraits:asTextArray(all.visualTraits),
  eraClues:asTextArray(all.eraClues),
  mediaClues:asTextArray(all.mediaClues),
  objects:asTextArray(all.objects),
  colors:asTextArray(all.colors),
  environment:asTextArray(all.environment),
  semanticDescription:String(all.semanticDescription||all.description||'').trim()
 };
}
function titleCase(value){
 return String(value||'').trim().replace(/\b\w/g,c=>c.toUpperCase());
}
async function fetchWebContextForImage(data={}){
 const visible=asTextArray(data.visibleText).slice(0,10);
 const hint=String($('message')?.value||'').trim();
 // Search exact OCR evidence first. GPT may add a second corroborating query,
 // but it is never allowed to replace the literal text lookup.
 if(!visible.length&&!hint)return [];
 const directQuery=[hint,visible.slice(0,5).join(' ')].filter(Boolean).join(' ').trim().slice(0,240);
 const queries=directQuery?[directQuery]:[];

 try{
  const planner=`Turn this image evidence into ONE concise corroborating web-search query.
USER HINT: ${hint||'(none)'}
VISIBLE IMAGE TEXT: ${visible.join(' | ')||'(none)'}
SEMANTIC DESCRIPTION: ${String(data.semanticDescription||data.description||'').slice(0,800)}
Return only the query. Preserve exact visible title/band/product/team words when present. Do not infer a real person's or fictional character's identity from appearance.`;
  const rr=await fetchWithTimeout(SERVICE+'/v1/chat',{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({input:planner,context:{application:'Oracle Card Studio',task:'image-web-context-query'}})
  },20000);
  const dd=await rr.json().catch(()=>({}));
  const q=String(dd.output||dd.output_text||dd.answer||'').replace(/^["']|["']$/g,'').trim().slice(0,240);
  if(rr.ok&&dd.ok&&q&&!queries.some(x=>normalizedName(x)===normalizedName(q)))queries.push(q);
 }catch{}

 async function runSearch(query){
  try{
   const u=new URL(WEB_CONTEXT_SEARCH);
   u.search=new URLSearchParams({q:query,format:'json',safesearch:'1'});
   const res=await fetchWithTimeout(u.toString(),{headers:{'Accept':'application/json'}},10000);
   if(!res.ok)return [];
   const json=await res.json().catch(()=>({}));
   return (Array.isArray(json.results)?json.results:[]).slice(0,8).map(x=>({
    title:String(x.title||'').slice(0,220),
    snippet:String(x.content||x.description||'').replace(/\s+/g,' ').slice(0,500),
    url:String(x.url||'').slice(0,500)
   })).filter(x=>x.title||x.snippet);
  }catch{return []}
 }

 const batches=await Promise.all(queries.slice(0,2).map(runSearch));
 const seen=new Set(),merged=[];
 for(const item of batches.flat()){
  const key=normalizedName(item.url||item.title);
  if(!key||seen.has(key))continue;
  seen.add(key);merged.push(item);
  if(merged.length>=10)break;
 }
 return merged;
}

async function fetchImageSearchComparison(data={},blob=null){
 if(!blob)return null;
 const visible=asTextArray(data.visibleText).slice(0,8);
 const hint=String($('message')?.value||'').trim();
 const identityTerms=[
  firstText(data.brandOptions),
  firstText(data.contextOptions),
  firstText(data.titleOptions),
  data.cardYear,data.cardMaker
 ].map(v=>String(v||'').trim()).filter(Boolean);
 const fallbackTerms=[
  ...asTextArray(data.titleOptions).slice(0,2),
  ...asTextArray(data.keywords).slice(0,5),
  ...asTextArray(data.mediaClues).slice(0,3)
 ].filter(Boolean);
 const category=TEMPLATE_DB?.detectCategory({...data,text:hint})||'';
 const kindWord=category==='movie'?'movie':category==='tv'?'tv show':category==='sports'?'card':'';
 // Several independent queries (exact OCR, identity fields, visual keywords)
 // give the Cloudflare SearXNG worker more chances to return a true match.
 const queries=[...new Set([
  [hint,visible.join(' ')].filter(Boolean).join(' '),
  [...new Set(identityTerms)].join(' ')+(identityTerms.length&&kindWord?' '+kindWord:''),
  fallbackTerms.join(' ')
 ].map(q=>q.trim().slice(0,220)).filter(q=>q.length>=3))].slice(0,3);
 if(!queries.length)return null;
 async function search(q){
  try{
   const u=new URL(WEB_CONTEXT_SEARCH);
   u.search=new URLSearchParams({q,format:'json',categories:'images',safesearch:'1'});
   const res=await fetchWithTimeout(u.toString(),{headers:{'Accept':'application/json'},cache:'no-store'},12000);
   if(!res.ok)return [];
   const json=await res.json().catch(()=>({}));
   return (Array.isArray(json.results)?json.results:[]).map(x=>({
    query:q,
    title:String(x.title||'').slice(0,240),
    snippet:String(x.content||x.description||'').replace(/\s+/g,' ').slice(0,700),
    url:String(x.url||'').slice(0,1000),
    image:String(x.img_src||x.thumbnail_src||x.thumbnail||'').slice(0,2400)
   })).filter(x=>x.image);
  }catch{return []}
 }
 try{
  const batches=await Promise.all(queries.map(search));
  // Interleave results so each query contributes its best images.
  const seen=new Set(),candidates=[];
  for(let i=0;candidates.length<10&&batches.some(b=>i<b.length);i++){
   for(const b of batches){
    const x=b[i];if(!x)continue;
    const key=x.image.split('?')[0];
    if(seen.has(key))continue;
    seen.add(key);candidates.push({...x,index:candidates.length});
    if(candidates.length>=10)break;
   }
  }
  if(!candidates.length)return null;

  $('status').textContent='Image search found '+candidates.length+' results. Comparing the actual images…';
  const transport=await prepareTransportImage(blob,{max:1000,maxBytes:2_500_000});
  const form=new FormData();
  form.append('image',transport,'source.jpg');
  form.append('candidates',JSON.stringify(candidates));
  form.append('instructions','Compare the uploaded image with every candidate image. Use printed text, logos, layout, card design, scene and objects as evidence. Report title, context (team / movie / show), brand (studio, franchise, network or card maker), series, date, category and confidence.');
  const compare=await fetchWithTimeout(SERVICE+'/v1/image-compare',{method:'POST',body:form},45000);
  const out=await compare.json().catch(()=>({}));
  if(!compare.ok||!out.ok)return null;
  return {...out,query:queries[0],queries,candidateCount:candidates.length};
 }catch{return null}
}

function mergeImageComparison(data={},comparison=null){
 if(!comparison||Number(comparison.confidence||0)<55)return data;
 const prepend=(value,arr)=>[...new Set([String(value||'').trim(),...asTextArray(arr)].filter(Boolean))];
 return {
  ...data,
  titleOptions:prepend(comparison.title,data.titleOptions),
  contextOptions:prepend(comparison.context,data.contextOptions),
  brandOptions:prepend(comparison.brand,data.brandOptions),
  seriesOptions:prepend(comparison.series,data.seriesOptions),
  dateOptions:prepend(comparison.date,data.dateOptions),
  keywords:[...new Set([
   ...asTextArray(data.keywords),
   ...asTextArray(comparison.evidence)
  ])],
  imageSearchComparison:comparison
 };
}

async function completeVisionIdentity(data={},webContext=[],imageComparison=null){
 const visible=(Array.isArray(data.visibleText)?data.visibleText:[]).map(v=>String(v||'').trim()).filter(Boolean);
 const inputBase=`You are the senior image-data interpreter for a collectible-card builder. Convert the raw image-reader result into editable fields. Use ONLY evidence present in the reader payload. Do not identify an unknown real person from appearance alone. Do not invent a team, movie, brand, date, product, band, athlete, actor, logo, or event. Visible text may support a field only when it clearly functions as a title/name/logo rather than background noise.

RAW IMAGE READER:
${JSON.stringify(data)}

USER-PROVIDED SEMANTIC HINT (may be blank; if present it is authoritative user context, not a visual guess):
${String($('message')?.value||'').trim()}

WEB CONTEXT RESULTS (source/context lookup from visible text or the user's explicit hint; never from face recognition):
${JSON.stringify(webContext)}

SEARXNG IMAGE-SEARCH COMPARISON (the uploaded image was visually compared with returned search images using non-biometric evidence):
${JSON.stringify(imageComparison||{})}

Read EVERY part of the reader payload (all visible text, logos, numbers, captions, credits, objects, era and media clues) before answering.

Return ONLY JSON:
{
 "category":"sports|movie|tv|other",
 "title":"",
 "context":"",
 "brand":"",
 "series":"",
 "date":"",
 "cardMaker":"",
 "cardYear":"",
 "subjectType":"",
 "keywords":[],
 "confidence":{"title":0,"context":0,"brand":0,"series":0,"date":0}
}

Card structure (the card prints these exact fields):
- title = the name plate in the lower-right corner: player / athlete name for sports, character or actor name for movies and TV, otherwise the subject title.
- brand = the brand spot: for MOVIES the studio or franchise (e.g. MGM, Warner Bros., Batman, Star Wars, Marvel); for TV the network or franchise (e.g. HBO, Star Trek); for SPORTS the card maker, league or team logo text actually shown (e.g. Topps, Upper Deck, Yankees).
- context = team / league for sports, the movie title for movies, the show title for TV.
- cardMaker / cardYear = only when the image itself is a trading card with a visible maker mark or year (Topps, Upper Deck, Donruss, Fleer, Bowman, Panini, Score, SkyBox).
- Keep every field SHORT: title max 4 words, brand max 3 words, context max 5 words, series max 4 words, date = a year or short era. No labels, no sentences, no quotes.

Rules:
- If the evidence is uncertain, keep the factual field blank rather than inventing it.
- subjectType and series may use the reader's visualTraits, eraClues, mediaClues, objects, colors, environment and semanticDescription.
- Use a user-provided semantic hint when it directly names or describes the intended subject/context.
- Web results may strengthen context, brand, series, date/era, source title or media context when they agree with visible text/user hint.
- Image-search comparison is stronger than text-only search metadata when it has a high visual score AND agrees with visible text/artwork/layout.
- Never identify a real person or fictional/TV/movie character from appearance alone.
- Never substitute a made-up person, brand, team, date, or title.`;

 async function attempt(extra='',task='image-data-to-fields'){
  const r=await fetchWithTimeout(SERVICE+'/v1/chat',{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({input:inputBase+extra,context:{application:'Oracle Card Studio',task}})
  },20000);
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(String(d.error||'gpt_image_data_unavailable'));
  const parsed=extractJSON(String(d.output||d.output_text||d.answer||''));
  if(!parsed||typeof parsed!=='object')throw new Error('gpt_image_data_invalid_json');
  return parsed;
 }

 let parsed;
 try{
  parsed=await attempt();
 }catch(firstError){
  parsed=await attempt(
   '\n\nSECOND-PASS INSTRUCTION: The first structured pass failed. Re-read the same evidence more carefully, preserve uncertainty, and still return the exact JSON object.',
   'image-data-to-fields-recovery'
  );
 }

 // OCR is first-class evidence. If the general pass somehow leaves title blank
 // while readable text exists, ask GPT a focused reconciliation question instead
 // of letting the card continue without the obvious printed title.
 const currentTitle=String(parsed.title||'').trim();
 const visibleMatchesTitle=currentTitle&&visible.some(v=>{
  const a=normalizedName(v),b=normalizedName(currentTitle);
  return a&&b&&(a===b||a.includes(b)||b.includes(a));
 });
 if(visible.length&&(!currentTitle||!visibleMatchesTitle)){
  try{
   const ocrPass=await attempt(
    '\n\nOCR PRIORITY PASS: The image reader found this exact visible text: '+JSON.stringify(visible)+
    '. The current title is '+JSON.stringify(currentTitle||'(blank)')+'. Reconcile the title against the literal OCR. If a prominent visible string is clearly the work/band/team/product/title, put that exact wording in title. Use corroborating web context only to understand what the visible words refer to. Do not paraphrase a visible title.',
    'image-data-ocr-title-recovery'
   );
   parsed={...parsed,...ocrPass,confidence:{...(parsed.confidence||{}),...(ocrPass.confidence||{})}};
  }catch{}
 }

 const clean=(v,n)=>TEMPLATE_DB?TEMPLATE_DB.cleanField(v,n):String(v||'').trim();
 const title=clean(parsed.title,5);
 const brand=clean(parsed.brand,4);
 const context=clean(parsed.context,6);
 const series=clean(parsed.series,5);
 const date=clean(parsed.date,3);
 const cardMaker=clean(parsed.cardMaker||data.cardMaker,3);
 const cardYear=clean(parsed.cardYear||data.cardYear,1);
 const categoryRaw=String(parsed.category||data.category||'').trim().toLowerCase();
 const category=TEMPLATE_DB?TEMPLATE_DB.detectCategory({...data,category:categoryRaw,text:[title,brand,context].join(' ')}):categoryRaw;
 const subjectType=String(parsed.subjectType||data.subjectType||'').trim();
 const keywords=[...new Set([...(Array.isArray(parsed.keywords)?parsed.keywords:[]),...(Array.isArray(data.keywords)?data.keywords:[])].map(v=>String(v||'').trim()).filter(Boolean))];

 return {
  ...data,
  subjectType,
  category,
  cardMaker,
  cardYear,
  keywords,
  titleOptions:title?[title]:asTextArray(data.titleOptions),
  brandOptions:brand?[brand]:asTextArray(data.brandOptions),
  logoOptions:brand?[brand]:[],
  contextOptions:context?[context]:asTextArray(data.contextOptions),
  seriesOptions:series?[series]:asTextArray(data.seriesOptions),
  dateOptions:date?[date]:asTextArray(data.dateOptions),
  visibleText:visible,
  gptFieldConfidence:parsed.confidence||{}
 };
}
function applyVisionResult(data,{overwrite=false}={}){
 if(!data)return;
 // Prefilled fields stay short: strip labels, symbols and excess words.
 const clean=(v,n)=>TEMPLATE_DB?TEMPLATE_DB.cleanField(v,n):String(v||'').trim();
 const title=clean(firstText(data.titleOptions),5);
 const brand=clean(firstText(data.brandOptions),4);
 const logo=brand;
 const context=clean(firstText(data.contextOptions)||firstText(data.teamOptions)||firstText(data.movieOptions),6);
 const subjectType=String(data.subjectType||'').trim();
 const series=clean(firstText(data.seriesOptions),5);
 const date=clean(firstText(data.dateOptions),3);
 const detected={
  title,
  subjectType,
  category:String(data.category||'').trim().toLowerCase(),
  cardMaker:String(data.cardMaker||'').trim(),
  cardYear:String(data.cardYear||'').trim(),
  brand,
  logo,
  context,
  era:date,
  date,
  keywords:Array.isArray(data.keywords)?data.keywords:[]
 };
 CARD_STATE?.applyDetected(detected);
 if(title&&(overwrite||!state().identity.title)){
  CARD_STATE?.setIdentity('title',title);
  $('cardTitleInput').value=title;
  state().identity.cardNumber=CARD_NUMBERING?.number(title,1)||'';
 }
 if(brand&&(overwrite||!state().identity.brand)){
  CARD_STATE?.setIdentity('brand',brand);
  $('cardBrandInput').value=brand;
 }
 if(brand&&!state().identity.logoText){
  CARD_STATE?.setIdentity('logoText',brand);
  if($('cardLogoInput'))$('cardLogoInput').value=brand;
 }
 if(context&&(overwrite||!state().identity.context)){
  CARD_STATE?.setIdentity('context',context);
  if($('cardContextInput'))$('cardContextInput').value=context;
 }
 if(series&&(overwrite||!state().identity.series)){
  CARD_STATE?.setIdentity('series',series);
  $('cardSeriesInput').value=series;
 }
 if(date&&(overwrite||!state().identity.dateText)){
  CARD_STATE?.setIdentity('dateText',date);
  $('cardDateInput').value=date;
 }
 applyReaderSuggestions({
  titleOptions:data.titleOptions||[title],
  styleOptions:data.styleOptions||[],
  subjectType:data.subjectType||'',
  brandOptions:data.brandOptions||[brand],
  logoOptions:brand?[brand]:[],
  contextOptions:context?[context]:[],
  dateOptions:data.dateOptions||[],
  visibleText:data.visibleText||[],
  keywords:data.keywords||[]
 });
 refreshAutoTemplateLabel();
}

function normalizedName(value){
 return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
async function maybePrefillVerifiedContext(vision={}){
 if(state().identity.context)return;
 const subject=String(vision.subjectType||'').toLowerCase();
 const keywords=(vision.keywords||[]).join(' ').toLowerCase();
 if(!/baseball|athlete|player|pitcher|catcher|fielder|batter|mlb/.test(subject+' '+keywords))return;
 const title=(state().identity.title||firstText(vision.titleOptions)||'').trim();
 if(!title)return;
 try{
  const intel=await fetchPlayerIntel(title);
  const actual=intel?.player?.fullName||'';
  if(!actual||normalizedName(actual)!==normalizedName(title))return;
  const latest=(intel.highlights||[])[0]||(intel.seasons||[]).slice(-1)[0]||null;
  const team=String(latest?.team||'').trim();
  if(!team)return;
  CARD_STATE?.setIdentity('context',team);
  if($('cardContextInput'))$('cardContextInput').value=team;
 }catch{}
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

function resetImageDataForNewSource(){
 const s=state();
 if(s.detected)s.detected={title:'',subjectType:'',brand:'',logo:'',context:'',era:'',date:'',keywords:[],category:'',cardMaker:'',cardYear:''};
 if(s.identity){
  for(const key of ['title','brand','logoText','context','series','dateText','cardNumber'])s.identity[key]='';
 }
 for(const id of ['cardTitleInput','cardContextInput','cardBrandInput','cardSeriesInput','cardDateInput','cardLogoInput']){
  if($(id))$(id).value='';
 }
 lastIntel=null;lastIntent=null;lastPlan=null;lastDescription='';lastVision=null;lastWebContext=[];lastImageComparison=null;lastTemplateRefs=[];
 refreshAutoTemplateLabel();
}

function setCreateAvailability(ready,label='Create Card'){
 if($('make')){$('make').disabled=!ready;$('make').textContent=label}
}

async function retryCurrentImageRead(){
 if(!sourceFile)return;
 const generation=photoReadGeneration;
 imageReadState='reading';
 if($('retryReadBtn'))$('retryReadBtn').style.display='none';
 $('status').textContent='Retrying GPT image read…';
 try{
  const visionRaw=await readUploadedImage(sourceFile);
  if(generation!==photoReadGeneration)return;
  const normalizedVision=normalizeVisionPayload(visionRaw||{});
  lastVision=normalizedVision;
  applyVisionResult(normalizedVision,{overwrite:true});
  const [webContext,imageComparison]=await Promise.all([
   fetchWebContextForImage(normalizedVision),
   fetchImageSearchComparison(normalizedVision,sourceFile)
  ]);
  lastWebContext=webContext;
  lastImageComparison=imageComparison;
  const enrichedVision=mergeImageComparison(normalizedVision,imageComparison);
  applyVisionResult(enrichedVision,{overwrite:true});
  const vision=await completeVisionIdentity(enrichedVision,webContext,imageComparison);
  if(generation!==photoReadGeneration)return;
  lastVision={...normalizedVision,...vision};
  applyVisionResult(vision,{overwrite:true});
  imageReadState='ready';
  const bits=[
   state().identity.title,
   state().identity.context,
   state().identity.brand,
   state().identity.series
  ].filter(Boolean);
  $('status').textContent=bits.length?'GPT image data ready: '+bits.join(' · '):'GPT image read finished. Add any missing detail you want in the fields.';
 }catch(error){
  imageReadState='error';
  if($('retryReadBtn'))$('retryReadBtn').style.display='inline-block';
  $('status').textContent='Image read failed: '+String(error?.message||error||'unknown error')+'. Create Card is still available.';
 }
}

async function setPhoto(file){
 const generation=++photoReadGeneration;
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
 if(!file){
  sourceFile=null;
  imageReadState='idle';imageReadPromise=Promise.resolve();
  setCreateAvailability(false);
  resetImageDataForNewSource();
  $('thumb').removeAttribute('src');$('thumb').style.display='none';$('thumbText').style.display='grid';
  $('thumbControls').style.display='none';$('photo').value='';$('status').textContent='Tap the photo tile to begin.';return;
 }

 // A replacement photo starts a fresh factual read. Never let identity/context
 // from the previous upload leak into the new card.
 resetImageDataForNewSource();

 // Lock the exact uploaded file immediately for preview and rendering.
 sourceFile=file;
 previewUrl=URL.createObjectURL(sourceFile);
 $('thumb').src=previewUrl;$('thumb').style.display='block';$('thumbText').style.display='none';
 $('thumbControls').style.display='flex';
 imageReadState='reading';
 setCreateAvailability(true,'Create Card');
 if($('retryReadBtn'))$('retryReadBtn').style.display='none';
 $('status').textContent='Image uploaded. GPT is reading it and filling the card data. Create Card will wait for this read before planning.';

 // The first build waits for this read so the renderer cannot race ahead with
 // blank or stale fields. A read failure still leaves the user able to create.
 imageReadPromise=(async()=>{
  try{
   const visionRaw=await readUploadedImage(file);
   if(generation!==photoReadGeneration||sourceFile!==file)return;
   const normalizedVision=normalizeVisionPayload(visionRaw||{});
   lastVision=normalizedVision;

   // Put every supported AI-read fact into the visible fields immediately.
   // GPT then acts as manager and refines/organizes those same facts.
   applyVisionResult(normalizedVision,{overwrite:true});
   $('status').textContent='AI image data received. Checking visible text and web context…';
   const [webContext,imageComparison]=await Promise.all([
    fetchWebContextForImage(normalizedVision),
    fetchImageSearchComparison(normalizedVision,file)
   ]);
   lastWebContext=webContext;
   lastImageComparison=imageComparison;
   const enrichedVision=mergeImageComparison(normalizedVision,imageComparison);
   applyVisionResult(enrichedVision,{overwrite:true});
   $('status').textContent=imageComparison?.compared
    ?'SearXNG image comparison finished. GPT is organizing the verified fields…'
    :webContext.length?'Web context found. GPT is organizing the fields…':'GPT is organizing the image fields…';

   const vision=await completeVisionIdentity(enrichedVision,webContext,imageComparison);
   if(generation!==photoReadGeneration||sourceFile!==file)return;
   lastVision={...normalizedVision,...vision};
   applyVisionResult(vision,{overwrite:true});
   if($('retryReadBtn'))$('retryReadBtn').style.display='none';

   const autoTitle=state().identity.title||firstText(vision.titleOptions);
   const scanBits=[autoTitle,firstText(vision.contextOptions),firstText(vision.brandOptions)].filter(Boolean);
   $('status').textContent=scanBits.length
    ? 'GPT read: '+scanBits.join(' · ')+'. Check or edit the fields, then tell GPT what you want changed.'
    : 'GPT finished reading the image. Add any missing detail in the fields or instruction box.';

   maybePrefillVerifiedContext(vision).then(()=>{
    if(generation!==photoReadGeneration||sourceFile!==file)return;
    const name=state().identity.title||firstText(vision.titleOptions);
    $('status').textContent='GPT image data ready'+(name?': '+name:'')+'. Now add only the changes you want in the instruction box.';
   }).catch(()=>{});
  }catch(error){
   if(generation!==photoReadGeneration||sourceFile!==file)return;
   imageReadState='error';
   if($('retryReadBtn'))$('retryReadBtn').style.display='inline-block';
   $('status').textContent='GPT image read stopped: '+String(error?.message||error||'unknown image-read error')+'. Create Card is still available.';
  }finally{
   if(generation===photoReadGeneration&&sourceFile===file){
    if(imageReadState!=='error')imageReadState='ready';
    setCreateAvailability(true,'Create Card');
   }
  }
 })();
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
function showMonitor(){
 $('empty').style.display='none';$('resultImage').style.display='none';$('buildMonitor').style.display='block';resetMonitor();
 if($('resultHeading'))$('resultHeading').textContent='Building design';
}
function stage(name,state,note=''){
 const el=document.querySelector('[data-stage="'+name+'"]');if(!el)return;
 el.classList.remove('active','done','error');el.classList.add(state);
 el.querySelector('.state').textContent=state==='active'?'Working':state==='done'?'Done':'Check';
 if(note)$('buildNote').textContent=note;
}

async function resizeImage(file,max=512,quality=.94){
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
 if(bitmap.close)bitmap.close();
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image_prepare_failed')),'image/jpeg',quality));
}

async function prepareTransportImage(file,{max=1800,maxBytes=2_800_000}={}){
 if(!file)return file;
 if(file.size<=maxBytes){
  try{
   const bitmap=await createImageBitmap(file);
   const within=Math.max(bitmap.width,bitmap.height)<=max;
   if(bitmap.close)bitmap.close();
   if(within)return file;
  }catch{}
 }
 for(const [edge,quality] of [[max,.92],[1500,.88],[1200,.84],[1024,.80]]){
  try{
   const out=await resizeImage(file,edge,quality);
   if(out&&out.size<=maxBytes)return out;
  }catch{}
 }
 return await resizeImage(file,900,.76);
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
 const tpl=activeTemplate();
 if(tpl)hits.unshift('TEMPLATE DATABASE MATCH: '+TEMPLATE_DB.promptFor(tpl));
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
 lastAbilityRoute=ABILITY_ROUTER?.route({...toolPlan,mode:buildMode})||null;
 renderSkillsPanel(lastAbilityRoute);
 const input=`You are Oracle, a senior collectible-card art director. Read the user's short request literally and convert it into a production design plan for an image editor using reference image 0. The subject may be music, film, television, sports, products, art, history, people, places, objects or anything else. Never force a non-sports subject into sports-card semantics.

USER REQUEST:
${description}

INTERNAL CARD-STYLE REFERENCE:
${styleKnowledge(description)}

VERIFIED DOMAIN DATA (sports data appears here only when the subject is actually a verified player):
${intel?JSON.stringify({player:intel.player,highlights:intel.highlights,seasons:(intel.seasons||[]).slice(-12)}):"No verified player data available."}

EXTRACTED INTENT:
${JSON.stringify(intent||{})}

BUILDER TOOL SPECIFICATION (treat hardRequirements as locked constraints; enrich, do not contradict):
${toolPlan?JSON.stringify({semantics:toolPlan.semantics,style:toolPlan.style,layout:toolPlan.layout,hardRequirements:BUILDER.hardRequirements(toolPlan.semantics,toolPlan.style,toolPlan.layout)}):'Builder toolkit unavailable.'}

ACTIVE SKILLS / RESPONSIBILITIES:
${lastAbilityRoute?ABILITY_ROUTER.buildCapabilityNote({...toolPlan,mode:buildMode}):'No ability router available.'}

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
- When the user explicitly references a known card family such as Topps, Fleer, Donruss, Upper Deck, Bowman, Stadium Club, Score, Leaf or Diamond Kings, translate that reference into concrete design traits. Otherwise design for the actual subject domain instead of injecting sports language.
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
 const r=await fetchWithTimeout(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'structured-card-art-direction'}})},25000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('design_unavailable');
 const raw=String(d.output||d.output_text||d.answer||'').trim();
 const plan=extractJSON(raw);
 if(!plan?.renderPrompt)throw new Error('design_plan_invalid');
 return BUILDER&&toolPlan?BUILDER.normalizeAIPlan(plan,toolPlan):plan;
}



async function buildCompactRecoveryPlan(description){
 const s=state();
 const input=`You are Oracle, the final GPT manager for a collectible-card renderer. The larger planning pass failed. Produce a compact executable plan using the verified image data below.

VERIFIED BUILD DESCRIPTION:
${description}

VISIBLE OCR:
${JSON.stringify(asTextArray(lastVision?.visibleText))}

IMAGE SEARCH COMPARISON:
${JSON.stringify(lastImageComparison||{})}

LOCKED USER SETTINGS:
${JSON.stringify(s.selections)}

Return ONLY JSON:
{"renderPrompt":"","suggestions":[],"mustPreserve":[],"mustAvoid":[]}

Rules:
- renderPrompt must be one complete image-editing instruction using the uploaded image as reference image 0.
- Preserve the uploaded image subject and visible factual details.
- Respect exact OCR and high-confidence SearXNG image comparison context.
- Do not invent identity, brand, date, team or title.
- Do not force sports semantics onto music, art, products or other non-sports subjects.
- Keep the full sharp card perimeter visible and produce one finished collectible card, not a mockup or template.
- Do not ask the user questions.`;
 const r=await fetchWithTimeout(SERVICE+'/v1/chat',{
  method:'POST',
  headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'compact-card-plan-recovery'}})
 },30000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('compact_design_unavailable: '+String(d.error||r.status));
 const plan=extractJSON(String(d.output||d.output_text||d.answer||''));
 if(!plan?.renderPrompt)throw new Error('compact_design_invalid');
 return plan;
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
 const r=await fetchWithTimeout(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'reference-card-design-analysis'}})},25000);
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


function frontLayoutFor(W,H){
 if(!TEMPLATE_DB)return null;
 const tpl=activeTemplate();
 return {tpl,layout:TEMPLATE_DB.frontLayout(W,H,tpl)};
}
function pathRoundRect(ctx,x,y,w,h,r){
 r=Math.max(0,Math.min(r,w/2,h/2));
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function outlinedText(ctx,text,x,y,maxW,fill,stroke,lineWidth){
 ctx.lineJoin='round';ctx.miterLimit=2;
 ctx.lineWidth=lineWidth;ctx.strokeStyle=stroke;ctx.strokeText(text,x,y,maxW);
 ctx.fillStyle=fill;ctx.fillText(text,x,y,maxW);
}

async function stampFrontIdentity(dataURI){
 const s=state();
 const title=String(s.identity.title||s.detected.title||'').trim();
 const context=String(s.identity.context||s.detected.context||'').trim();
 const brand=String(s.identity.brand||s.identity.logoText||s.detected.brand||'').trim();
 const series=String(s.identity.series||'').trim();
 const date=String(s.identity.dateText||s.detected.date||'').trim();
 if(!title&&!context&&!brand&&!series&&!date)return dataURI;

 const img=new Image();img.src=dataURI;
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('front_identity_load_failed'))});
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const W=canvas.width,H=canvas.height;
 const front=frontLayoutFor(W,H);
 if(!front)return dataURI;
 const {tpl,layout:L}=front;
 const accent=tpl?.palette?.[2]||'#c9a227';
 const team=tpl?.palette?.[1]||'#1d2731';
 const font=(weight,size)=>weight+' '+size+'px "Arial Narrow",Arial,Helvetica,sans-serif';
 function fitFont(text,maxWidth,start,min=12,weight=900){
  let size=start;
  do{ctx.font=font(weight,size);if(ctx.measureText(text).width<=maxWidth)break;size-=2}while(size>min);
  return size;
 }

 // Production typography is composited after AI artwork so names stay exact,
 // readable and never become pseudo-text from the image model.
 const fadeTop=L.serial.y-L.pad;
 const g=ctx.createLinearGradient(0,fadeTop,0,H);
 g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.55)');
 ctx.fillStyle=g;ctx.fillRect(0,fadeTop,W,H-fadeTop);

 // Brand spot (studio / franchise / maker), e.g. MGM, Batman, Topps.
 if(brand&&s.selections.useBrand!==false&&normalizedName(brand)!==normalizedName(title)){
  const text=brand.toUpperCase();
  const padX=Math.round(L.brand.h*.4);
  const fs=fitFont(text,L.brand.w-padX*2,Math.round(L.brand.h*.62),12,900);
  ctx.font=font(900,fs);
  const bw=Math.min(L.brand.w,Math.ceil(ctx.measureText(text).width)+padX*2);
  const bx=L.brand.align==='right'?L.brand.x+L.brand.w-bw:L.brand.x;
  pathRoundRect(ctx,bx,L.brand.y,bw,L.brand.h,L.brand.h*.22);
  ctx.fillStyle='rgba(8,10,14,.86)';ctx.fill();
  ctx.lineWidth=Math.max(3,Math.round(W*.006));ctx.strokeStyle='#000';ctx.stroke();
  ctx.lineWidth=Math.max(1.5,Math.round(W*.003));ctx.strokeStyle=accent;ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';
  outlinedText(ctx,text,bx+bw/2,L.brand.y+L.brand.h/2+1,bw-padX*2,'#fff','#000',Math.max(2,fs*.12));
 }

 // Name plate, lower-right corner: title/name with a short context line.
 const sub=[context,series,date].filter(Boolean).filter((v,i,a)=>a.findIndex(x=>normalizedName(x)===normalizedName(v))===i).join(' · ');
 const nameText=(s.selections.showName!==false?title:'').toUpperCase();
 const subText=s.selections.showContext!==false?sub:[series,date].filter(Boolean).join(' · ');
 if(nameText||subText){
  const P=L.nameplate,padX=Math.round(P.h*.22);
  const nameFs=nameText?fitFont(nameText,P.w-padX*2,Math.round(P.h*.42),16,900):0;
  const subFs=subText?fitFont(subText,P.w-padX*2,Math.round(P.h*.2),11,800):0;
  ctx.font=font(900,nameFs||1);const nw=nameText?ctx.measureText(nameText).width:0;
  ctx.font=font(800,subFs||1);const sw=subText?ctx.measureText(subText).width:0;
  const pw=Math.min(P.w,Math.ceil(Math.max(nw,sw))+padX*2+Math.round(P.h*.12));
  const ph=Math.min(P.h,Math.round((nameFs?nameFs*1.12:0)+(subFs?subFs*1.5:0)+P.h*.2));
  const px=P.x+P.w-pw,py=P.y+P.h-ph;
  pathRoundRect(ctx,px,py,pw,ph,P.style==='tab'?ph*.3:Math.round(P.h*.08));
  ctx.fillStyle=P.style==='fade'?'rgba(8,10,14,.72)':'rgba(8,10,14,.88)';ctx.fill();
  ctx.lineWidth=Math.max(3,Math.round(W*.006));ctx.strokeStyle='#000';ctx.stroke();
  ctx.lineWidth=Math.max(1.5,Math.round(W*.003));ctx.strokeStyle=accent;ctx.stroke();
  ctx.fillStyle=team;ctx.fillRect(px+2,py+Math.round(ph*.18),Math.max(4,Math.round(P.h*.06)),Math.round(ph*.64));
  ctx.textAlign='right';ctx.textBaseline='alphabetic';
  const tx=px+pw-padX;let ty=py+Math.round(P.h*.1);
  if(nameText){
   ty+=Math.round(nameFs*.92);ctx.font=font(900,nameFs);
   outlinedText(ctx,nameText,tx,ty,pw-padX*2,'#fff','#000',Math.max(2,nameFs*.1));
  }
  if(subText){
   ty+=Math.round(subFs*1.35);ctx.font=font(800,subFs);
   outlinedText(ctx,subText,tx,ty,pw-padX*2,'rgba(255,255,255,.95)','#000',Math.max(2,subFs*.14));
  }
 }
 return canvas.toDataURL('image/jpeg',.97);
}

// Strong Topps-style 1/1: gold foil numbering on a dark plate, lower right.
async function stampCollectorMarks(dataURI){
 const s=state();
 if(!s.selections.oneOfOne)return dataURI;
 const img=new Image();img.src=dataURI;
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('collector_mark_load_failed'))});
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const front=frontLayoutFor(canvas.width,canvas.height);
 if(!front)return dataURI;
 const {x,y,w,h}=front.layout.serial;

 ctx.save();
 pathRoundRect(ctx,x,y,w,h,h*.2);
 ctx.fillStyle='rgba(6,6,8,.86)';ctx.fill();
 ctx.lineWidth=Math.max(3,Math.round(w*.035));ctx.strokeStyle='#000';ctx.stroke();
 const rim=ctx.createLinearGradient(x,y,x+w,y+h);
 rim.addColorStop(0,'#7d5a10');rim.addColorStop(.3,'#f9edb0');rim.addColorStop(.55,'#c89527');rim.addColorStop(.8,'#fff4bd');rim.addColorStop(1,'#a67616');
 ctx.lineWidth=Math.max(2,Math.round(w*.02));ctx.strokeStyle=rim;ctx.stroke();

 const fs=Math.round(h*.74);
 ctx.font='italic 900 '+fs+'px "Arial Narrow",Arial,Helvetica,sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';
 const foil=ctx.createLinearGradient(x,y+h*.15,x+w,y+h*.85);
 foil.addColorStop(0,'#8a6212');foil.addColorStop(.2,'#fff3b8');foil.addColorStop(.42,'#d19d2a');foil.addColorStop(.62,'#fff6c8');foil.addColorStop(.82,'#b07d18');foil.addColorStop(1,'#f4dc94');
 const tx=x+w/2,ty=y+h/2+fs*.04;
 // Shadow on the outline only, so the foil fill stays crisp.
 ctx.lineJoin='round';ctx.lineWidth=Math.max(2,fs*.1);ctx.strokeStyle='#2a1a00';
 ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=Math.round(fs*.08);ctx.shadowOffsetY=Math.round(fs*.03);
 ctx.strokeText('1/1',tx,ty,w*.9);
 ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.fillStyle=foil;ctx.fillText('1/1',tx,ty,w*.9);
 ctx.restore();
 return canvas.toDataURL('image/jpeg',.97);
}

async function stampProductLine(dataURI){return dataURI;}


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
 if(!r.ok||!d.ok){
  const detail=String(d.error||d.detail||'comfy_renderer_failed');
  const e=new Error('Comfy /v1/comfy-image '+r.status+': '+detail);
  e.code=String(d.error||'comfy_renderer_failed');e.status=r.status;e.route='/v1/comfy-image';throw e
 }
 return d;
}

async function renderWithWorkersAI(blob,prompt,description='',designBlob=null){
 const transport=await prepareTransportImage(blob,{max:480,maxBytes:800000});
 const form=new FormData();
 form.append('image',transport,'subject.jpg');
 if(designBlob){
  const designTransport=await prepareTransportImage(designBlob,{max:480,maxBytes:800000});
  form.append('design_reference',designTransport,'design-reference.jpg');
 }
 form.append('prompt',String(prompt||description||'Create a polished collectible trading card from the uploaded image.'));
 form.append('request',String(description||prompt||'').slice(0,1800));
 const r=await fetchWithTimeout(SERVICE+'/v1/image',{method:'POST',body:form},150000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok){
  const attempts=Array.isArray(d.attemptErrors)?d.attemptErrors.map(x=>String(x?.model||'model')+': '+String(x?.error||'error')).join(' | '):'';
  const detail=[String(d.error||d.detail||'workers_ai_image_failed'),attempts].filter(Boolean).join(' · ');
  const e=new Error('Workers AI /v1/image '+r.status+': '+detail);
  e.code=String(d.error||'workers_ai_image_failed');e.status=r.status;e.route='/v1/image';throw e
 }
 return d;
}

async function gptRenderRecovery(prompt,description,error){
 const input=`You are the senior rendering manager for a collectible-card image pipeline. A capable image renderer failed. Diagnose the failure from the exact error and rewrite the render instruction so the renderer has the best chance of succeeding WITHOUT weakening the user's requirements.

ORIGINAL CARD DESCRIPTION:
${description||''}

ORIGINAL RENDER PROMPT:
${prompt||''}

RENDER FAILURE:
${String(error?.message||error||'unknown')}

Return ONLY JSON:
{
 "reason":"",
 "renderPrompt":""
}

Rules:
- Preserve every supported factual subject detail and every explicit user instruction.
- Preserve the source subject identity; do not invent a replacement person, team, brand or era.
- Keep the request as one finished collectible card, not a mockup, slab, frame or template.
- If the failure suggests input validation, simplify prompt structure and remove redundant wording rather than removing requirements.
- If the failure suggests model/provider availability, write a renderer-neutral prompt suitable for the next capable image model.
- Do not fall back to canvas, generic templates, placeholder fields or fake data.
`;
 const r=await fetchWithTimeout(SERVICE+'/v1/chat',{
  method:'POST',
  headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'renderer-recovery-manager'}})
 },25000);
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('gpt_renderer_recovery_unavailable: '+String(d.error||r.status));
 const parsed=extractJSON(String(d.output||d.output_text||d.answer||''));
 if(!parsed?.renderPrompt)throw new Error('gpt_renderer_recovery_invalid');
 return parsed;
}

async function renderCard(blob,prompt,description,designBlob=null){
 let firstError=null;
 try{
  const out=await renderWithWorkersAI(blob,prompt,description,designBlob);
  out.rendererPath='workers-ai-reference-image';
  return out;
 }catch(error){
  firstError=error;
  console.warn('Workers AI first render failed',error);
 }

 // GPT is the fallback manager. It diagnoses the actual failure and rewrites
 // the instruction before we ask a renderer to try again.
 let recovery=null;
 try{
  recovery=await gptRenderRecovery(prompt,description,firstError);
  const retry=await renderWithWorkersAI(blob,recovery.renderPrompt,description,designBlob);
  retry.rendererPath='workers-ai-gpt-recovery';
  retry.recoveryReason=String(recovery.reason||'');
  return retry;
 }catch(recoveryError){
  console.warn('GPT-managed Workers AI recovery failed',recoveryError);

  // The alternate renderer still executes GPT's recovered prompt when available.
  // It is another employee, never a deterministic/template fallback.
  try{
   if(!recovery)recovery=await gptRenderRecovery(prompt,description,recoveryError);
   const out=await renderWithComfy(blob,recovery.renderPrompt||prompt||description||'Create a polished collectible trading card from the uploaded image.');
   out.rendererPath='comfy-gpt-recovery';
   out.recoveryReason=String(recovery?.reason||'');
   return out;
  }catch(comfyError){
   const e=new Error(
    'GPT-managed rendering failed. First: '+String(firstError?.message||firstError||'unknown')+
    ' · Recovery: '+String(recoveryError?.message||recoveryError||'unknown')+
    ' · Alternate renderer: '+String(comfyError?.message||comfyError||'unknown')
   );
   e.code='gpt_managed_rendering_failed';
   throw e;
  }
 }
}
async function nextPaint(){
 return await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}

async function createCard(count=1,mode='original'){
 if(!sourceFile){$('status').innerHTML='<strong>Add a photo first.</strong>';return}
 if(mode==='reference'&&!referenceFile){$('status').innerHTML='<strong>Add a card design reference first.</strong>';return}

 // Do not race the image reader. The first render must use the data extracted
 // from this exact upload, especially visible text such as a band/product/team name.
 const freeform=$('message').value.trim();

 setBusy(true,count===3?'Creating 3…':'Creating…');
 $('status').textContent='Finishing image read before the card plan…';
 showMonitor();

 try{
  if(imageReadState==='reading'&&imageReadPromise){
   const s=state();
   const titleNow=String(s.identity.title||s.detected.title||'').trim();
   const literalNow=asTextArray(lastVision?.visibleText);
   if(!titleNow&&!literalNow.length){
    stage('prepare','active','Reading the exact upload and comparing SearXNG images before planning…');
    await imageReadPromise;
   }
  }
  results=[];activeResult=-1;renderVariationBar();$('resultActions').style.display='none';
  autoMode=false;autoBacks.clear();backResult='';

  stage('prepare','active','Using the exact uploaded image…');
  lastBlob=sourceFile;
  lastReferenceBlob=mode==='reference'?referenceFile:null;
  buildMode=mode;
  lastTemplateRefs=await fetchTemplateReferences(activeTemplate());
  lastDescription=builderDescription(freeform)||'Build collectible card';
  stage('prepare','done');
  await nextPaint();

  stage('plan','active','GPT is turning the image data + your instruction into a card plan…');
  try{
   lastPlan=await buildDesignPlan(lastDescription,lastIntel,lastIntent);
  }catch(firstPlanError){
   stage('plan','active','GPT is retrying the card plan with a stricter production brief…');
   const recoveryDescription=lastDescription+'\nRECOVERY PASS: The first planning call failed. Produce a simpler but stronger executable card plan. Preserve every supported fact and every explicit user instruction. Do not invent missing identity or branding.';
   try{
    lastPlan=await buildDesignPlan(recoveryDescription,lastIntel,lastIntent);
   }catch(secondPlanError){
    stage('plan','active','GPT is rebuilding a compact executable card plan…');
    lastPlan=await buildCompactRecoveryPlan(recoveryDescription);
   }
  }
  renderSkillsPanel(lastAbilityRoute);
  stage('plan','done','GPT plan ready.');
  await nextPaint();

  for(let i=0;i<count;i++){
   stage('render','active',count>1?'Rendering card '+(i+1)+' of '+count+'…':'Rendering the GPT card plan…');
   await nextPaint();
   const renderPrompt=count>1?variationPrompt(lastPlan,'variation',i,''):lastPlan.renderPrompt;
   const out=await renderCard(lastBlob,renderPrompt,lastDescription,lastReferenceBlob);
   stage('render','done');
   stage('finish','active','Adding card text and collector details…');
   await nextPaint();
   const finished=await finishOutput(out,{review:false,display:false});
   stage('finish','done');
   stage('iterate','active','GPT is inspecting the finished card and preparing repairs…');
   const iteration=await iterateFinishedCardOnce(finished,{allowRepair:true});
   stage('iterate','done',iteration.repaired?'GPT repaired one blocking defect and rechecked the card.':iteration.critique?'GPT visual review ready.':'Card finished. Manual refinement controls are ready.');
  }

  if(results.length)await showResult(results.length-1,{review:false});
  $('status').innerHTML='<strong>'+count+' card'+(count>1?'s':'')+' created.</strong>';

  // Keep the first successful card stable. Any deeper sports-data enrichment is user-triggered later,
  // never allowed to rewrite the image-derived identity after a render.
 }catch(e){
  const active=document.querySelector('.buildStep.active');
  if(active){active.classList.remove('active');active.classList.add('error');active.querySelector('.state').textContent='Check'}
  const detail=String(e?.message||e||'unknown error');
  if($('resultHeading'))$('resultHeading').textContent='Render failed';
  $('buildNote').textContent='Build stopped: '+detail;
  $('status').innerHTML='<strong>Render failed.</strong> '+detail;
 }finally{
  setBusy(false);
 }
}

const AUTO_CARD=window.OracleAutoCard||null;
let autoMode=false;
let lastAutoSpec=null;
const autoTitles=new Map();
const autoBacks=new Map();

function autoStageFor(message){
 const m=String(message||'');
 if(/^Pulling/.test(m)){stage('prepare','done');stage('plan','active',m);return}
 if(/artwork|image model|reference renderer|Uploaded photo/i.test(m)){stage('prepare','done');stage('plan','done');stage('render','active',m);return}
 if(/^Composing/.test(m)){stage('render','done');stage('finish','active',m);return}
 stage('prepare','active',m);
}

function fileSlug(text){return String(text||'card').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'card';}

function downloadCurrentCard(){
 const src=$('resultImage').src;
 if(!src||!/^data:image\//.test(src))return;
 const a=document.createElement('a');
 a.href=src;
 const ext=(src.match(/^data:image\/(png|jpeg|webp)/)||[])[1]||'jpg';
 const front=results[activeResult]||src;
 a.download=fileSlug((autoTitles.get(front)||autoTitles.get(src)||state().identity.title||'card')+'-'+currentSide)+'.'+(ext==='jpeg'?'jpg':ext);
 document.body.appendChild(a);a.click();a.remove();
}

function showAutoReport(spec,artSource){
 const status=$('reviewStatus');
 $('reviewPanel').style.display='block';
 status.textContent='';
 const strong=document.createElement('strong');strong.textContent=spec.title;status.appendChild(strong);
 const v=spec.value;
 const art={upload:'your uploaded photo',ai:'AI-generated artwork','reference-ai':'reference-rendered artwork',procedural:'painted studio artwork'}[artSource]||'artwork';
 status.appendChild(document.createTextNode(' · '+v.tier+' · Value Index '+v.index+'/100 · '+v.serialText+' · Odds '+v.oddsText+' · Built from '+art+'.'));
 $('retryBtn').style.display='none';$('tightenBtn').style.display='none';
 $('moreBtn').style.display='inline-block';$('moreBtn').textContent='Pull Another';$('moreBtn').dataset.action='auto';$('moreBtn').dataset.instruction='';
 $('backBtn').style.display='inline-block';$('backBtn').textContent='Show Back';
}

async function autoCreate(count=1,{append=false}={}){
 if(!AUTO_CARD){$('status').textContent='Auto Card engine did not load. Refresh the page.';return}
 const s=state();
 const typed=$('message').value.trim();
 const title=String(s.identity.title||'').trim();
 const context=String(s.identity.context||'').trim();
 setBusy(true,count>1?'Auto ×'+count+'…':'Auto building…');
 showMonitor();
 if(!append){results=[];activeResult=-1;autoBacks.clear();backResult='';renderVariationBar();}
 autoMode=true;
 $('resultActions').style.display='none';
 try{
  for(let i=0;i<count;i++){
   stage('prepare','active',count>1?'Pulling card '+(i+1)+' of '+count+'…':'Reading your request…');
   // The engine picks everything itself; typed text / identity fields only steer it.
   const text=[typed,context,title&&!AUTO_CARD.parseIntent(typed).player?title:''].filter(Boolean).join(' ');
   const out=await AUTO_CARD.build({
    text,
    photo:sourceFile||null,
    brand:String(s.identity.brand||'').trim().toUpperCase().slice(0,24)||undefined,
    fetchIntel:name=>fetchPlayerIntel(name).catch(()=>null),
    renderReference:(blob,prompt)=>renderWithWorkersAI(blob,prompt+' Turn this rough painted layout into a realistic, sharp sports photograph. Keep the pose, uniform colors and framing. No text, no logos.',prompt),
    artTimeoutMs:45000,
    onStatus:autoStageFor
   });
   stage('finish','done');
   stage('iterate','done','Card '+(i+1)+' finished: '+out.spec.value.tier+'.');
   results.push(out.front);
   autoBacks.set(out.front,out.back);
   autoTitles.set(out.front,out.spec.title);
   lastAutoSpec=out.spec;
   if(out.warning)console.warn('Auto card artwork fallback',out.warning);
   if(count===1||i===count-1){
    await showResult(results.length-1,{review:false});
    showAutoReport(out.spec,out.artSource);
   }
  }
  $('status').innerHTML='<strong>'+count+' auto card'+(count>1?'s':'')+' pulled.</strong> Tap Back to see stats, Pull Another for a new pack.';
 }catch(e){
  const detail=String(e?.message||e||'unknown error');
  $('buildNote').textContent='Auto build stopped: '+detail;
  $('status').textContent='Auto build stopped: '+detail;
  if(results.length)await showResult(results.length-1,{review:false});
 }finally{
  setBusy(false);
 }
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
$('retryReadBtn')?.addEventListener('click',retryCurrentImageRead);
$('make').addEventListener('click',()=>createCard(1,'original'));
$('buildLike').addEventListener('click',()=>createCard(1,'reference'));
$('make3').addEventListener('click',()=>createCard(3,referenceFile?'reference':'original'));
$('retryBtn').addEventListener('click',async()=>{
 const action=$('retryBtn').dataset.action||'style';
 if(action==='reread'){
  if(sourceFile){
   $('reviewStatus').innerHTML='<strong>Re-reading the uploaded image…</strong>';
   const raw=await readUploadedImage(sourceFile);
   const normalized=normalizeVisionPayload(raw);
   const webContext=await fetchWebContextForImage(normalized);
   const vision=await completeVisionIdentity(normalized,webContext);
   applyVisionResult(vision,{overwrite:true});
   await updateReviewPanel(results[activeResult]||results.at(-1)||'');
  }
  return;
 }
 buildAction(action,$('retryBtn').dataset.instruction||'');
});
$('tightenBtn').addEventListener('click',()=>buildAction($('tightenBtn').dataset.action||'layout',$('tightenBtn').dataset.instruction||''));
$('moreBtn').addEventListener('click',()=>{
 if($('moreBtn').dataset.action==='auto')return autoCreate(1,{append:true});
 buildAction($('moreBtn').dataset.action||'variation',$('moreBtn').dataset.instruction||'');
});
$('backBtn').addEventListener('click',()=>{if(autoMode&&backResult)showBack();else buildBackCard()});
$('autoMake')?.addEventListener('click',()=>autoCreate(1));
$('auto3')?.addEventListener('click',()=>autoCreate(3));
$('downloadBtn')?.addEventListener('click',downloadCurrentCard);
$('frontSide').addEventListener('click',showFront);
$('backSide').addEventListener('click',()=>{if(backResult)showBack();else buildBackCard()});
$('newCard').addEventListener('click',()=>{
 autoMode=false;autoBacks.clear();autoTitles.clear();lastAutoSpec=null;
 results=[];activeResult=-1;backResult='';currentSide='front';lastPlan=null;lastBlob=null;lastReferenceBlob=null;lastDescription='';lastIntel=null;lastIntent=null;buildMode='original';clearImageTray();CARD_STATE?.reset();$('message').value='';syncTemplateControls();['cardTitleInput','cardContextInput','cardBrandInput','cardSeriesInput','cardDateInput','cardLogoInput'].forEach(id=>{if($(id))$(id).value=''});builderStepBlocks().forEach((b,i)=>{b.classList.toggle('current',i===0);b.classList.remove('complete')});updateBuilderSummary();
 $('resultImage').style.display='none';$('buildMonitor').style.display='none';$('empty').style.display='grid';$('resultActions').style.display='none';$('reviewPanel').style.display='none';$('variationBar').style.display='none';$('sideSwitch').style.display='none';$('smartIdeas').style.display='none';$('status').textContent='Ready for another card.';
});
