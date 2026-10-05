const SERVICE='https://infinity-rogers.marvaseater.workers.dev';
const $=id=>document.getElementById(id);
let sourceFile=null;

$('photo').addEventListener('change',e=>{
 sourceFile=e.target.files?.[0]||null;
 if(!sourceFile){$('status').textContent='Ready when you are.';return}
 const url=URL.createObjectURL(sourceFile);
 $('thumb').src=url;$('thumb').style.display='block';$('thumbText').style.display='none';
 $('status').textContent='Photo ready.';
});

async function resizeImage(file,max=500){
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const w=Math.max(1,Math.round(bitmap.width*scale));
 const h=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:false});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
 if(bitmap.close)bitmap.close();
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image_prepare_failed')),'image/jpeg',.9));
}

async function designPrompt(description,simplified=false){
 const brief=simplified
 ? `Create a tasteful premium collectible trading card from reference image 0. Preserve the main subject. Use a polished portrait card composition, refined borders, sophisticated lighting, subtle metallic details, clean areas for card typography, and professional print-design balance. No logos, no signatures, no brand marks, no copied text, no extra people, no distorted anatomy, no childish or novelty styling. User preference: ${description}`
 : `You are an expert collectible-card art director. Convert the user's idea into one polished image-generation prompt for reference image 0.

User idea: ${description}

Return ONLY the final prompt.

The final image must be a finished premium collectible trading card, portrait orientation, with the uploaded subject clearly recognizable. Translate any named card brand or era into general visual qualities only; do not request exact logos or trademarked marks. Use elegant framing, authentic print-design balance, premium materials, controlled foil or metallic detail when appropriate, dramatic but tasteful lighting, and clear areas where card typography could sit naturally. Avoid novelty graphics, cheesy clip-art, fake plastic UI, duplicated people, malformed anatomy, illegible text, watermarks, signatures, or copied logos. Aim for sophisticated collector-grade artwork.`;

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
   const err=String(d.error||'generation_failed');
   const e=new Error(err);e.code=err.includes('3030')?'FLAGGED':err;throw e;
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
   try{
     out=await renderCard(blob,prompt);
   }catch(e){
     if(e.code!=='FLAGGED')throw e;
     $('status').textContent='Refining the design…';
     prompt=await designPrompt(description,true);
     out=await renderCard(blob,prompt);
   }
   $('resultImage').src=out.dataURI;$('resultImage').style.display='block';$('empty').style.display='none';$('newCard').style.display='inline-block';
   $('status').innerHTML='<strong>Card created.</strong>';
 }catch(e){
   const flagged=e.code==='FLAGGED'||String(e.message||'').includes('3030');
   $('status').innerHTML=flagged
     ? '<strong>This photo or description could not be rendered.</strong> Try a different crop, photo, or simpler description.'
     : '<strong>Could not create the card.</strong> Please try again.';
 }finally{
   $('make').disabled=false;$('make').textContent='Create Card';
 }
}

$('make').addEventListener('click',createCard);
$('newCard').addEventListener('click',()=>{
 $('resultImage').style.display='none';$('empty').style.display='grid';$('newCard').style.display='none';$('status').textContent='Ready for another card.';
});