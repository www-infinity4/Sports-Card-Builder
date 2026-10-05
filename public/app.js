const ROGERS='https://infinity-rogers.marvaseater.workers.dev';
const $=id=>document.getElementById(id);
let sourceFile=null;

$('photo').addEventListener('change',e=>{
 sourceFile=e.target.files?.[0]||null;
 $('status').textContent=sourceFile?'Image ready. Describe the card and press Create My Card.':'Upload an image and describe the card you want.';
});

async function resizeImage(file,max=500){
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
 if(bitmap.close)bitmap.close();
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare image.')),'image/jpeg',.92));
}

async function rogersPrompt(description){
 const input=`You are Rogers, the prompt director for Oracle Sports Card Studio.
Turn the user's short request into one excellent production prompt for a high-end image generator that will receive the user's uploaded photograph as reference image 0.

User request:
${description}

Write ONLY the final image-generation prompt, no explanation.

Requirements:
- preserve the recognizable subject from reference image 0
- transform the reference into a finished collectible sports/trading card, not a mock website and not a card photographed on a table
- premium professional print design, realistic typography areas, coherent border, lighting, foil/material details when requested
- use historical card-brand names only as broad aesthetic references; do not reproduce protected logos or exact trademarks
- portrait trading-card composition, approximately 2.5 x 3.5 ratio
- avoid cheesy clip-art, childish graphics, fake plastic frames, distorted hands/faces, nonsense text, duplicated subjects, extra limbs
- if the user names no style, choose a sophisticated premium collector-card direction
- Oracle aesthetic means luminous white/silver/gold polish, restrained luxury, crisp museum-quality presentation
- make the prompt detailed enough for FLUX.2 reference-image editing
`;
 const r=await fetch(ROGERS+'/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input,context:{application:'Oracle Sports Card Studio',task:'image-prompt-director'}})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error(d.error||('Rogers HTTP '+r.status));
 return String(d.output||d.output_text||d.answer||'').trim();
}

async function generateImage(blob,prompt){
 const form=new FormData();
 form.append('image',blob,'reference.jpg');
 form.append('prompt',prompt);
 const r=await fetch(ROGERS+'/v1/image',{method:'POST',body:form});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw new Error(d.error||('Image HTTP '+r.status));
 return d;
}

$('make').addEventListener('click',async()=>{
 const description=$('message').value.trim();
 if(!sourceFile){$('status').innerHTML='<strong>Upload an image first.</strong>';return}
 if(!description){$('status').innerHTML='<strong>Write a quick description of the card you want.</strong>';return}
 $('make').disabled=true;$('make').textContent='Creating…';$('status').textContent='Rogers is writing the image prompt…';$('meta').textContent='';
 try{
   const [blob,prompt]=await Promise.all([resizeImage(sourceFile),rogersPrompt(description)]);
   if(!prompt)throw new Error('Rogers returned an empty prompt.');
   $('status').textContent='FLUX.2 is rendering your card from the uploaded image…';
   const out=await generateImage(blob,prompt);
   $('resultImage').src=out.dataURI;
   $('resultImage').style.display='block';
   $('empty').style.display='none';
   $('status').innerHTML='<strong>Card created.</strong>';
   $('meta').textContent='Rendered with '+(out.model||'FLUX.2')+(Number.isFinite(out.remaining)?' · '+out.remaining+' image generations remaining today':'');
 }catch(e){
   $('status').innerHTML='<strong>Could not generate:</strong> '+String(e.message||e);
 }finally{
   $('make').disabled=false;$('make').textContent='Create My Card';
 }
});