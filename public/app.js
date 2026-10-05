const ROGERS_AI_URL='https://infinity-rogers.marvaseater.workers.dev/v1/chat';
const styles={
 fleer:{label:'Fleer-inspired',bg:'#faf8f2',ink:'#151515',border:'#d6d8df',name:'#20316e',foil:'#f9efd0'},
 donruss:{label:'Donruss-inspired',bg:'#f7edd8',ink:'#18120b',border:'#d3a85e',name:'#2c1c12',foil:'#f5dba0'},
 upperdeck:{label:'Upper Deck-inspired',bg:'#f2f7fb',ink:'#102030',border:'#cad6e3',name:'#13253e',foil:'#e4f5ff'},
 chrome:{label:'Chrome Refractor',bg:'#edf3f9',ink:'#121212',border:'#b9d1eb',name:'#1c2d55',foil:'#def5ff'},
 bowman:{label:'Prospect',bg:'#f8f8f4',ink:'#111',border:'#ccd0d5',name:'#111a24',foil:'#f0f6ff'},
 stadium:{label:'Photo Premium',bg:'#fbfbfb',ink:'#111',border:'#dedede',name:'#111',foil:'#ededed'},
 score:{label:'Score-inspired',bg:'#f9f9f9',ink:'#161616',border:'#d6dbe3',name:'#0f2d1f',foil:'#dff4e5'},
 leaf:{label:'Leaf-inspired',bg:'#f9f4e5',ink:'#16120c',border:'#d7c08a',name:'#1f2b1e',foil:'#efe1b8'},
 diamond:{label:'Diamond Kings-inspired',bg:'#f5ecdc',ink:'#16120d',border:'#d9b86c',name:'#18120d',foil:'#f3dfb0'},
 modern:{label:'Modern Collector',bg:'#f6f8fb',ink:'#121722',border:'#cad7e8',name:'#102148',foil:'#dceeff'}
};
const $=id=>document.getElementById(id);
let imageLoaded=false;

function setStyle(key){
 const s=styles[key]||styles.modern;
 document.documentElement.style.setProperty('--card-bg',s.bg);
 document.documentElement.style.setProperty('--card-ink',s.ink);
 document.documentElement.style.setProperty('--card-border',s.border);
 document.documentElement.style.setProperty('--name',s.name);
 document.documentElement.style.setProperty('--foil',s.foil);
 $('setName').textContent=s.label;
 $('ribbon').textContent=s.label;
}
function inferStyle(text){
 const t=String(text||'').toLowerCase();
 if(t.includes('fleer'))return'fleer';
 if(t.includes('donruss'))return'donruss';
 if(t.includes('upper deck')||t.includes('upperdeck'))return'upperdeck';
 if(t.includes('diamond king'))return'diamond';
 if(t.includes('bowman')||t.includes('prospect'))return'bowman';
 if(t.includes('stadium club')||t.includes('photo'))return'stadium';
 if(t.includes('score'))return'score';
 if(t.includes('leaf'))return'leaf';
 if(t.includes('chrome')||t.includes('refractor')||t.includes('topps'))return'chrome';
 return'modern';
}
function parseJSON(text){
 const raw=String(text||'').trim();
 try{return JSON.parse(raw)}catch{}
 const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
 if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch{}}
 return null;
}
function applyDesign(data,fallbackText){
 const card=data?.card||data||{};
 const combined=[card.styleFamily,card.style,card.set,card.designDirection,fallbackText].filter(Boolean).join(' ');
 setStyle(inferStyle(combined));
 $('player').textContent=card.playerName||card.subject||'Custom Card';
 $('plateName').textContent=card.playerName||card.subject||'Custom Card';
 $('subtitle').textContent=card.subtitle||card.tagline||card.designDirection||'Custom collectible card';
 $('plateSub').textContent=card.subtitle||card.tagline||'Custom Sports Card';
 $('foil').textContent=card.foilMark||card.rarity||'1/1';
 $('year').textContent=String(card.year||new Date().getFullYear());
 $('number').textContent=card.cardNumber||'#001';
}
$('photo').addEventListener('change',e=>{
 const f=e.target.files?.[0];if(!f)return;
 const rd=new FileReader();
 rd.onload=()=>{imageLoaded=true;$('previewImage').src=rd.result;$('previewImage').style.display='block';$('placeholder').style.display='none';$('status').textContent='Image ready. Tell Rogers what kind of card you want.'};
 rd.readAsDataURL(f);
});
document.querySelectorAll('[data-prompt]').forEach(btn=>btn.addEventListener('click',()=>{$('message').value=btn.dataset.prompt;$('message').focus()}));

$('make').addEventListener('click',async()=>{
 const request=$('message').value.trim();
 if(!imageLoaded){$('status').textContent='Upload an image first.';return}
 if(!request){$('status').textContent='Tell Rogers what you want the card to look like.';return}
 $('make').disabled=true;$('make').textContent='Rogers is building…';$('status').textContent='Rogers AI is designing your card…';$('aiReply').style.display='none';
 const instruction=`You are Rogers inside Sports Card Builder. The user has already uploaded an image which remains the focal artwork in the browser preview. Interpret the user's plain-English request and return ONLY valid JSON. Do not ask follow-up questions.

User request: ${request}

Return this shape:
{"reply":"one short sentence","card":{"styleFamily":"one of fleer, donruss, upperdeck, chrome, bowman, stadium, score, leaf, diamond, modern","playerName":"short title if user provided one, otherwise Custom Card","subtitle":"short card subtitle based on request","year":"2026","foilMark":"short foil or rarity text","cardNumber":"#001","designDirection":"one concise visual description"}}

Use brand names only as styling references. Do not require API keys, payment, signup, or another service.`;
 try{
  const r=await fetch(ROGERS_AI_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input:instruction,context:{application:'Sports Card Builder',task:'simple-card-design'}})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));
  const out=String(d.output||d.output_text||d.answer||'').trim();
  const parsed=parseJSON(out);
  if(parsed){applyDesign(parsed,request);$('aiReply').textContent=parsed.reply||'Card design applied.'}
  else{applyDesign({},request);$('aiReply').textContent=out||'Card design applied.'}
  $('aiReply').style.display='block';$('status').textContent='Card updated.';
 }catch(e){
  applyDesign({},request);
  $('status').textContent='Rogers could not answer, so the card used your request locally.';
  $('aiReply').textContent='Your card preview still updated from your instructions.';
  $('aiReply').style.display='block';
 }finally{
  $('make').disabled=false;$('make').textContent='Make My Card';
 }
});
setStyle('modern');