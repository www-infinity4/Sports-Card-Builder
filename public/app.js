const SERVICE='https://infinity-rogers.marvaseater.workers.dev';
const $=id=>document.getElementById(id);
let sourceFile=null;
let previewUrl='';

function setPhoto(file){
 sourceFile=file||null;
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
 if(!sourceFile){
  $('thumb').removeAttribute('src');$('thumb').style.display='none';$('thumbText').style.display='block';
  $('thumbControls').style.display='none';$('photo').value='';
  $('status').textContent='Ready when you are.';return;
 }
 previewUrl=URL.createObjectURL(sourceFile);
 $('thumb').src=previewUrl;$('thumb').style.display='block';$('thumbText').style.display='none';
 $('thumbControls').style.display='flex';
 $('status').textContent='Photo ready.';
}
$('photo').addEventListener('change',e=>setPhoto(e.target.files?.[0]||null));
$('replacePhoto').addEventListener('click',()=>{$('photo').click()});
$('removePhoto').addEventListener('click',()=>setPhoto(null));
$('thumbBox').addEventListener('click',e=>{if(!e.target.closest('button'))$('photo').click()});
['dragenter','dragover'].forEach(type=>$('composer').addEventListener(type,e=>{e.preventDefault();$('composer').style.borderColor='#aeb8c3'}));
['dragleave','drop'].forEach(type=>$('composer').addEventListener(type,e=>{e.preventDefault();$('composer').style.borderColor='#d7dde4'}));
$('composer').addEventListener('drop',e=>{const f=[...(e.dataTransfer?.files||[])].find(x=>x.type.startsWith('image/'));if(f)setPhoto(f)});

function resetMonitor(){
 document.querySelectorAll('.buildStep').forEach(el=>{el.classList.remove('active','done','error');el.querySelector('.state').textContent='Waiting'});
 $('buildNote').textContent='Starting…';
}
function showMonitor(){
 $('empty').style.display='none';$('resultImage').style.display='none';$('buildMonitor').style.display='block';resetMonitor();
}
function stage(name,state,note=''){
 const el=document.querySelector('[data-stage="'+name+'"]');if(!el)return;
 el.classList.remove('active','done','error');el.classList.add(state);
 el.querySelector('.state').textContent=state==='active'?'Working':state==='done'?'Done':'Check';
 if(note)$('buildNote').textContent=note;
}

async function resizeImage(file,max=500){
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const w=Math.max(1,Math.round(bitmap.width*scale));
 const h=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
 if(bitmap.close)bitmap.close();
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image_prepare_failed')),'image/jpeg',.9));
}

const BRAND_STYLE_MAP={
 topps:'classic flagship baseball-card composition, crisp border treatment, balanced player photo hierarchy, authentic vintage-to-modern collector feel',
 fleer:'colorful vintage baseball-card composition, energetic period typography zones, bright bordered collector aesthetic',
 donruss:'bold vintage baseball-card design, strong geometric borders, warm print palette, unmistakable late-20th-century collector energy',
 'upper deck':'premium glossy baseball-card composition, photographic emphasis, elegant metallic accents, upscale early-1990s collector feel',
 bowman:'prospect-card composition, youthful premium presentation, clean border system, rookie-focused visual hierarchy',
 'stadium club':'photo-forward premium baseball card, near-full-bleed photography, restrained framing, sophisticated sports editorial finish',
 score:'bold colorful baseball-card graphic system, energetic sports-page composition, strong border and title areas',
 leaf:'heritage baseball-card aesthetic, rich vintage print character, refined traditional framing'
};

function expandBrandLanguage(description){
 let direction=description;
 for(const [brand,style] of Object.entries(BRAND_STYLE_MAP)){
  const re=new RegExp('\\b'+brand.replace(' ','\\s+')+'\\b','ig');
  direction=direction.replace(re,style);
 }
 return direction;
}

async function designPrompt(description,simplified=false){
 const translated=expandBrandLanguage(description);
 const brief=simplified
 ? `Create a premium fantasy collectible trading card from reference image 0. Preserve the recognizable subject. User direction: ${translated}. The card may use any appropriate color palette; do not force white. Use sophisticated print design, coherent borders or full-bleed treatment as appropriate, refined lighting, and premium materials. No copied brand logos, no exact trademark graphics, no text, no watermarks.`
 : `You are an expert collectible-card art director. Convert the user's idea into one polished image-generation prompt for reference image 0.

User idea: ${translated}

Return ONLY the final prompt.

The final image must be a finished premium fantasy sports/trading card, portrait orientation, with the uploaded subject clearly recognizable. Match the requested era and card aesthetic faithfully through composition, borders, color, print texture, photography treatment, foil and framing. The card does NOT need to be white; choose the palette and materials that fit the requested style. Do not render a website, mockup, tabletop photo, or empty template. Do not reproduce protected logos or exact trademark graphics. Avoid novelty clip-art, fake plastic UI, duplicated subjects, malformed anatomy, watermarks, signatures, or generated text. Leave a subtle clean lower edge for final production marking.`;

 if(simplified)return brief;
 const r=await fetch(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input:brief,context:{application:'Oracle Card Studio',task:'card-art-direction'}})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('design_unavailable');
 return String(d.output||d.output_text||d.answer||'').trim();
}

async function compositeShell(shellDataURI,photoBlob){
 const shell=new Image();shell.src=shellDataURI;
 await new Promise((resolve,reject)=>{shell.onload=resolve;shell.onerror=()=>reject(new Error('shell_load_failed'))});
 const photo=await createImageBitmap(photoBlob);
 const canvas=document.createElement('canvas');canvas.width=shell.naturalWidth;canvas.height=shell.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(shell,0,0);
 const x=Math.round(canvas.width*.12),y=Math.round(canvas.height*.16),w=Math.round(canvas.width*.76),h=Math.round(canvas.height*.66);
 const r=Math.max(18,Math.round(canvas.width*.025));
 ctx.save();
 ctx.beginPath();
 ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.clip();
 const scale=Math.max(w/photo.width,h/photo.height);
 const dw=photo.width*scale,dh=photo.height*scale;
 ctx.drawImage(photo,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
 ctx.restore();
 if(photo.close)photo.close();
 const edge=ctx.createLinearGradient(x,y,x+w,y+h);edge.addColorStop(0,'rgba(255,255,255,.75)');edge.addColorStop(.5,'rgba(255,255,255,.08)');edge.addColorStop(1,'rgba(10,20,30,.45)');
 ctx.strokeStyle=edge;ctx.lineWidth=Math.max(4,Math.round(canvas.width*.007));ctx.strokeRect(x,y,w,h);
 return canvas.toDataURL('image/jpeg',.94);
}

async function stampProductLine(dataURI){
 const img=new Image();img.src=dataURI;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('stamp_load_failed'))});
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
 const h=Math.max(26,Math.round(canvas.height*.035));
 const g=ctx.createLinearGradient(0,canvas.height-h,0,canvas.height);g.addColorStop(0,'rgba(8,12,18,0.12)');g.addColorStop(1,'rgba(8,12,18,0.68)');
 ctx.fillStyle=g;ctx.fillRect(0,canvas.height-h,canvas.width,h);
 const text='Fantasy Craft Product · Infinity® · Produced by Goudey Tradition Trading Card Company LLC';
 ctx.font=Math.max(10,Math.round(canvas.width*.018))+'px Arial, sans-serif';
 ctx.fillStyle='rgba(255,255,255,.92)';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(text,canvas.width/2,canvas.height-h/2,canvas.width-Math.round(canvas.width*.04));
 return canvas.toDataURL('image/jpeg',.94);
}

async function renderCard(blob,prompt){
 const form=new FormData();form.append('image',blob,'reference.jpg');form.append('prompt',prompt);
 const r=await fetch(SERVICE+'/v1/image',{method:'POST',body:form});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok){
  const err=String(d.error||'generation_failed');const e=new Error(err);e.code=err.includes('3030')?'FLAGGED':err;throw e;
 }
 return d;
}

async function createCard(){
 const description=$('message').value.trim();
 if(!sourceFile){$('status').innerHTML='<strong>Choose a photo first.</strong>';return}
 if(!description){$('status').innerHTML='<strong>Describe the card you want.</strong>';return}
 $('make').disabled=true;$('make').textContent='Creating…';$('status').textContent='Designing your card…';showMonitor();
 try{
  stage('prepare','active','Preparing your photo…');
  const blob=await resizeImage(sourceFile);
  stage('prepare','done');
  stage('plan','active','Building the card design…');
  let prompt=await designPrompt(description,false);
  stage('plan','done');
  stage('render','active','Rendering the card artwork…');
  $('buildNote').textContent='Rendering artwork with automatic recovery enabled…';
  const out=await renderCard(blob,prompt);
  stage('render','done');
  stage('finish','active',out.mode==='shell-fallback'?'Integrating your photo into the finished card…':'Finishing your card…');
  if(!out?.dataURI)throw new Error('empty_image');
  const artwork=out.mode==='shell-fallback'?await compositeShell(out.dataURI,blob):out.dataURI;
  const finished=await stampProductLine(artwork);
  $('resultImage').src=finished;
  await new Promise((resolve,reject)=>{if($('resultImage').complete&&$('resultImage').naturalWidth){resolve();return}$('resultImage').onload=resolve;$('resultImage').onerror=()=>reject(new Error('image_display_failed'))});
  stage('finish','done','Card ready.');
  $('buildMonitor').style.display='none';$('resultImage').style.display='block';$('empty').style.display='none';$('newCard').style.display='inline-block';
  $('status').innerHTML='<strong>Card created.</strong>';
 }catch(e){
  const active=document.querySelector('.buildStep.active');if(active){active.classList.remove('active');active.classList.add('error');active.querySelector('.state').textContent='Check'}
  $('buildNote').textContent='Build stopped here. You can retry without losing your photo or description.';
  const flagged=e.code==='FLAGGED'||String(e.message||'').includes('3030');
  $('status').innerHTML=flagged?'<strong>This version could not be rendered.</strong> Try again or shorten the description.':'<strong>Build stopped.</strong> Please retry.';
 }finally{
  $('make').disabled=false;$('make').textContent='Create Card';
 }
}
$('make').addEventListener('click',createCard);
$('newCard').addEventListener('click',()=>{$('resultImage').style.display='none';$('buildMonitor').style.display='none';$('empty').style.display='grid';$('newCard').style.display='none';$('status').textContent='Ready for another card.';});
