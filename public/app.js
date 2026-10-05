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
 const footer='Include a tiny, tasteful production line integrated along the lower card edge or back-style footer: “Fantasy Craft Product · Infinity® · Produced by Goudey Tradition Trading Card Company LLC.” Keep it legible but visually subordinate.';
 const brief=simplified
 ? `Create a premium fantasy collectible trading card from reference image 0. Preserve the recognizable subject. User direction: ${translated}. The card may use any appropriate color palette; do not force white. Use sophisticated print design, coherent borders or full-bleed treatment as appropriate, refined lighting, and premium materials. No copied brand logos or exact trademark graphics. ${footer}`
 : `You are an expert collectible-card art director. Convert the user's idea into one polished image-generation prompt for reference image 0.

User idea: ${translated}

Return ONLY the final prompt.

The final image must be a finished premium fantasy sports/trading card, portrait orientation, with the uploaded subject clearly recognizable. Match the requested era and card aesthetic faithfully through composition, borders, color, print texture, photography treatment, foil, framing and typography zones. The card does NOT need to be white; choose the palette and materials that fit the requested style. Do not render a website, mockup, tabletop photo, or empty template. Do not reproduce protected logos or exact trademark graphics. Avoid novelty clip-art, fake plastic UI, duplicated subjects, malformed anatomy, watermarks, and nonsense decorative text. ${footer}`;

 if(simplified)return brief;
 const r=await fetch(SERVICE+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input:brief,context:{application:'Oracle Card Studio',task:'card-art-direction'}})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error('design_unavailable');
 return String(d.output||d.output_text||d.answer||'').trim();
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
 $('make').disabled=true;$('make').textContent='Creating…';$('status').textContent='Designing your card…';
 try{
  const blob=await resizeImage(sourceFile);
  let prompt=await designPrompt(description,false);
  let out;
  try{out=await renderCard(blob,prompt)}
  catch(e){
   if(e.code!=='FLAGGED')throw e;
   $('status').textContent='Refining the design…';
   prompt=await designPrompt(description,true);
   out=await renderCard(blob,prompt);
  }
  $('resultImage').src=out.dataURI;$('resultImage').style.display='block';$('empty').style.display='none';$('newCard').style.display='inline-block';
  $('status').innerHTML='<strong>Card created.</strong>';
 }catch(e){
  const flagged=e.code==='FLAGGED'||String(e.message||'').includes('3030');
  $('status').innerHTML=flagged?'<strong>This version could not be rendered.</strong> Try a different photo or a shorter description.':'<strong>Could not create the card.</strong> Please try again.';
 }finally{
  $('make').disabled=false;$('make').textContent='Create Card';
 }
}
$('make').addEventListener('click',createCard);
$('newCard').addEventListener('click',()=>{$('resultImage').style.display='none';$('empty').style.display='grid';$('newCard').style.display='none';$('status').textContent='Ready for another card.';});
