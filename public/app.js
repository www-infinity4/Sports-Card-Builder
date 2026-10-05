const SERVICE='https://infinity-rogers.marvaseater.workers.dev';
const $=id=>document.getElementById(id);
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

function setBusy(busy,label='Creating…'){
 $('make').disabled=busy;$('make3').disabled=busy;$('buildLike').disabled=busy;
 $('retryBtn').disabled=busy;$('tightenBtn').disabled=busy;$('moreBtn').disabled=busy;
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

async function showResult(index){
 const src=results[index];if(!src)return;
 activeResult=index;$('resultImage').src=src;$('resultImage').style.display='block';$('empty').style.display='none';
 $('buildMonitor').style.display='none';$('resultActions').style.display='flex';$('newCard').style.display='inline-block';
 renderVariationBar();
}

async function finishOutput(out){
 if(!out?.dataURI)throw new Error('empty_image');
 const finished=out.mode==='server-composite'?out.dataURI:await stampProductLine(out.dataURI);
 const img=new Image();img.src=finished;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('image_display_failed'))});
 results.push(finished);await showResult(results.length-1);return finished;
}

function variationPrompt(plan,kind,index=0){
 const base=plan.renderPrompt;
 if(kind==='retry') return base+' Create a new independent render of the same design. Preserve every hard requirement while allowing natural generative differences.';
 if(kind==='tighten') return base+' TIGHTEN this design: preserve all hard requirements and successful creative ideas, but improve crop, spacing, border discipline, hierarchy, print realism, typography zones and overall restraint. Remove unnecessary clutter. Do not make it generic.';
 if(kind==='more') return base+' Create a sibling variation that clearly belongs to the same card family and preserves the best visual language, materials and rarity feel, while inventing one tasteful new premium detail.';
 const modes=[
  'Variation 1: faithful execution. Follow the design plan closely while allowing tasteful card-making judgment.',
  'Variation 2: premium execution. Preserve every hard requirement, but allow one or two valuable collector-grade inventions such as rarity treatment, foil detail, corner device or print finish.',
  'Variation 3: creative execution. Preserve every hard requirement and subject identity, but explore the strongest original interpretation that still feels like the requested card family.'
 ];
 return base+' '+modes[index%3];
}

async function generateFromPlan(kind='single',count=1){
 if(!lastBlob||!lastPlan||!lastDescription)throw new Error('missing_build_state');
 for(let i=0;i<count;i++){
  stage('render','active',count>1?'Rendering variation '+(i+1)+' of '+count+'…':'Rendering the card…');
  const prompt=kind==='single'?lastPlan.renderPrompt:variationPrompt(lastPlan,kind,i);
  const out=await renderCard(lastBlob,prompt,lastDescription,lastReferenceBlob);
  stage('render','done');
  stage('finish','active','Finishing…');
  await finishOutput(out);
  stage('finish','done');
 }
 $('status').innerHTML='<strong>'+count+' card'+(count>1?'s':'')+' created.</strong>';
}

function openPicker(){ $('photo').click(); }
function setPhoto(file){
 sourceFile=file||null;
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
 if(!sourceFile){
  $('thumb').removeAttribute('src');$('thumb').style.display='none';$('thumbText').style.display='grid';
  $('thumbControls').style.display='none';$('photo').value='';$('status').textContent='Tap the photo tile to begin.';return;
 }
 previewUrl=URL.createObjectURL(sourceFile);
 $('thumb').src=previewUrl;$('thumb').style.display='block';$('thumbText').style.display='none';
 $('thumbControls').style.display='flex';$('status').textContent='Photo ready. Describe the exact card you want.';
}
$('photo').addEventListener('change',e=>setPhoto(e.target.files?.[0]||null));
$('thumbBox').addEventListener('click',e=>{if(!e.target.closest('button'))openPicker()});
$('thumbBox').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPicker()}});
$('replacePhoto').addEventListener('click',e=>{e.stopPropagation();openPicker()});
$('removePhoto').addEventListener('click',e=>{e.stopPropagation();setPhoto(null)});
['dragenter','dragover'].forEach(type=>$('composer').addEventListener(type,e=>{e.preventDefault();$('composer').style.borderColor='#9fb7ca'}));
['dragleave','drop'].forEach(type=>$('composer').addEventListener(type,e=>{e.preventDefault();$('composer').style.borderColor='#cdd7e1'}));
$('composer').addEventListener('drop',e=>{const f=[...(e.dataTransfer?.files||[])].find(x=>x.type.startsWith('image/'));if(f)setPhoto(f)});


function openReferencePicker(){ $('referencePhoto').click(); }
function setReference(file){
 referenceFile=file||null;
 if(referencePreviewUrl){URL.revokeObjectURL(referencePreviewUrl);referencePreviewUrl=''}
 if(!referenceFile){
  $('referenceThumb').removeAttribute('src');$('referenceThumb').style.display='none';$('referenceText').style.display='grid';
  $('referenceControls').style.display='none';$('referencePhoto').value='';
  return;
 }
 referencePreviewUrl=URL.createObjectURL(referenceFile);
 $('referenceThumb').src=referencePreviewUrl;$('referenceThumb').style.display='block';$('referenceText').style.display='none';
 $('referenceControls').style.display='flex';$('status').textContent='Reference card ready. Add a subject and tell Oracle what to carry over.';
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

async function buildDesignPlan(description){
 const input=`You are Oracle, a senior sports-card art director. Read the user's short request literally and convert it into a production design plan for an image editor using reference image 0.

USER REQUEST:
${description}

INTERNAL CARD-STYLE REFERENCE:
${styleKnowledge(description)}

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
- renderPrompt must be a single strong image-editing prompt that includes every important requirement above and explicitly says to transform reference image 0 into the finished card artwork.
`;
 const r=await fetch(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'structured-card-art-direction'}})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('design_unavailable');
 const raw=String(d.output||d.output_text||d.answer||'').trim();
 const plan=extractJSON(raw);
 if(!plan?.renderPrompt)throw new Error('design_plan_invalid');
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
 const r=await fetch(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'reference-card-design-analysis'}})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('reference_design_unavailable');
 const plan=extractJSON(String(d.output||d.output_text||d.answer||''));
 if(!plan?.renderPrompt)throw new Error('reference_plan_invalid');
 return plan;
}

async function stampProductLine(dataURI){
 const img=new Image();img.src=dataURI;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('stamp_load_failed'))});
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const h=Math.max(28,Math.round(canvas.height*.036));
 const g=ctx.createLinearGradient(0,canvas.height-h,0,canvas.height);g.addColorStop(0,'rgba(8,12,18,.05)');g.addColorStop(1,'rgba(8,12,18,.68)');
 ctx.fillStyle=g;ctx.fillRect(0,canvas.height-h,canvas.width,h);
 const text='Fantasy Craft Product · Infinity® · Produced by Goudey Tradition Trading Card Company LLC';
 ctx.font=Math.max(10,Math.round(canvas.width*.017))+'px Arial, sans-serif';ctx.fillStyle='rgba(255,255,255,.94)';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(text,canvas.width/2,canvas.height-h/2,canvas.width-Math.round(canvas.width*.04));
 return canvas.toDataURL('image/jpeg',.95);
}

async function renderCard(blob,prompt,description,designBlob=null){
 const form=new FormData();
 form.append('image',blob,'subject.jpg');
 if(designBlob)form.append('design_reference',designBlob,'design-reference.jpg');
 form.append('prompt',prompt);
 form.append('request',description);
 const r=await fetch(SERVICE+'/v1/image',{method:'POST',body:form});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok){const e=new Error(String(d.error||'generation_failed'));e.code=String(d.error||'');throw e}
 return d;
}

async function createCard(count=1,mode='original'){
 const description=$('message').value.trim();
 if(!sourceFile){$('status').innerHTML='<strong>Add a photo first.</strong>';return}
 if(!description&&mode!=='reference'){$('status').innerHTML='<strong>Describe the card you want.</strong>';return}
 if(mode==='reference'&&!referenceFile){$('status').innerHTML='<strong>Add a card design reference first.</strong>';return}
 setBusy(true,count===3?'Creating 3…':'Creating…');$('status').textContent='Designing your card…';showMonitor();
 try{
  results=[];activeResult=-1;renderVariationBar();$('resultActions').style.display='none';
  stage('prepare','active','Preparing a high-quality reference image…');
  lastBlob=await resizeImage(sourceFile);
  lastReferenceBlob=mode==='reference'?await resizeImage(referenceFile):null;
  lastDescription=description||'Build a new card using the uploaded reference design.';
  buildMode=mode;
  stage('prepare','done');
  stage('plan','active','Turning your description into an exact card design…');
  lastPlan=mode==='reference'?await buildReferencePlan(lastDescription):await buildDesignPlan(lastDescription);
  stage('plan','done');
  await generateFromPlan(count===3?'variations':'single',count);
 }catch(e){
  const active=document.querySelector('.buildStep.active');
  if(active){active.classList.remove('active');active.classList.add('error');active.querySelector('.state').textContent='Check'}
  $('buildNote').textContent='Build stopped here. Your photo and description are still ready to retry.';
  $('status').innerHTML='<strong>Build stopped.</strong> Try again.';
 }finally{setBusy(false)}
}

async function buildAction(kind){
 if(!lastBlob||!lastPlan||!lastDescription){$('status').textContent='Create a card first.';return}
 setBusy(true,kind==='tighten'?'Tightening…':'Creating…');
 $('buildMonitor').style.display='block';$('resultImage').style.display='none';$('resultActions').style.display='none';resetMonitor();
 stage('prepare','done');stage('plan','done');
 try{
  await generateFromPlan(kind,1);
 }catch(e){
  const active=document.querySelector('.buildStep.active');if(active){active.classList.remove('active');active.classList.add('error');active.querySelector('.state').textContent='Check'}
  $('buildNote').textContent='This variation stopped. Your previous cards are safe.';
  $('status').innerHTML='<strong>Variation stopped.</strong> Try again.';
  if(results.length)await showResult(activeResult>=0?activeResult:results.length-1);
 }finally{setBusy(false)}
}
$('make').addEventListener('click',createCard);
$('newCard').addEventListener('click',()=>{$('resultImage').style.display='none';$('buildMonitor').style.display='none';$('empty').style.display='grid';$('newCard').style.display='none';$('status').textContent='Ready for another card.'});
