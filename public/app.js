const ROGERS_AI_URL='https://infinity-rogers.marvaseater.workers.dev/v1/chat';
const styles={
 'topps-modern':{label:'Topps Modern',bg:'#f6f8fb',ink:'#121722',border:'#cad7e8',name:'#102148',foil:'#dceeff',notes:'clean flagship framing, crisp red/blue energy, modern premium sports-card presentation'},
 'topps-chrome':{label:'Topps Chrome',bg:'#edf3f9',ink:'#121212',border:'#b9d1eb',name:'#1c2d55',foil:'#def5ff',notes:'chrome refractor feel, metallic silver-blue finish, premium shine'},
 bowman:{label:'Bowman Prospect',bg:'#f8f8f4',ink:'#111',border:'#ccd0d5',name:'#111a24',foil:'#f0f6ff',notes:'prospect-forward layout, rookie-card energy, clean modern lines'},
 donruss:{label:'Donruss',bg:'#f7edd8',ink:'#18120b',border:'#d3a85e',name:'#2c1c12',foil:'#f5dba0',notes:'warm vintage palette, bold classic sports-card geometry, collector-era feel'},
 fleer:{label:'Fleer',bg:'#faf8f2',ink:'#151515',border:'#d6d8df',name:'#20316e',foil:'#f9efd0',notes:'clean vintage framing, bright accents, nostalgic collector layout'},
 'upper-deck':{label:'Upper Deck',bg:'#f2f7fb',ink:'#102030',border:'#cad6e3',name:'#13253e',foil:'#e4f5ff',notes:'premium gloss, elegant borders, upscale collectible finish'},
 'stadium-club':{label:'Stadium Club',bg:'#fbfbfb',ink:'#111',border:'#dedede',name:'#111',foil:'#ededed',notes:'photo-forward presentation, minimal framing, high-end photography emphasis'},
 score:{label:'Score',bg:'#f9f9f9',ink:'#161616',border:'#d6dbe3',name:'#0f2d1f',foil:'#dff4e5',notes:'bold graphic energy, lively color blocking, strong sports-page feel'},
 leaf:{label:'Leaf',bg:'#f9f4e5',ink:'#16120c',border:'#d7c08a',name:'#1f2b1e',foil:'#efe1b8',notes:'heritage feel, earthy richness, vintage collectible tone'},
 'diamond-kings':{label:'Diamond Kings',bg:'#f5ecdc',ink:'#16120d',border:'#d9b86c',name:'#18120d',foil:'#f3dfb0',notes:'painted oil-brush feel, premium black-and-gold framing, artistic collector finish'}
};
const $=id=>document.getElementById(id);
const els={photo:$('photo'),style:$('style'),year:$('year'),player:$('player'),team:$('team'),subtitle:$('subtitle'),number:$('number'),rarity:$('rarity'),signature:$('signature'),instructions:$('instructions'),extras:$('extras'),setName:$('setName'),yearBadge:$('yearBadge'),playerName:$('playerName'),teamLine:$('teamLine'),foil:$('foil'),ribbon:$('ribbon'),sig:$('sig'),serial:$('serial'),plateName:$('plateName'),plateSub:$('plateSub'),cardNo:$('cardNo'),previewImage:$('previewImage'),placeholder:$('placeholder'),prompt:$('prompt'),status:$('status')};

Object.entries(styles).forEach(([key,v])=>{const o=document.createElement('option');o.value=key;o.textContent=v.label;els.style.appendChild(o)});els.style.value='diamond-kings';

function apply(){
 const s=styles[els.style.value];
 document.documentElement.style.setProperty('--card-bg',s.bg);
 document.documentElement.style.setProperty('--card-ink',s.ink);
 document.documentElement.style.setProperty('--card-border',s.border);
 document.documentElement.style.setProperty('--name',s.name);
 document.documentElement.style.setProperty('--foil',s.foil);
 const p=els.player.value.trim()||'Featured Player',t=els.team.value.trim()||'Team',sub=els.subtitle.value.trim()||'Collector Card';
 els.setName.textContent=s.label;els.ribbon.textContent=s.label;els.yearBadge.textContent=els.year.value.trim()||'2026';els.playerName.textContent=p;els.teamLine.textContent=t+' · '+sub;els.foil.textContent=els.rarity.value.trim()||'1/1 FOIL';els.serial.textContent=els.foil.textContent;els.sig.textContent=els.signature.value.trim()||p;els.plateName.textContent=p;els.plateSub.textContent=sub;els.cardNo.textContent=els.number.value.trim()||'#SCB-001';
}
function buildPrompt(){
 const s=styles[els.style.value],p=els.player.value.trim()||'Featured Player';
 const text=[
 'Design a premium baseball trading card using the uploaded image as the primary subject reference.',
 'Style family: '+s.label+'.',
 'Visual direction: '+s.notes+'.',
 'Player / subject: '+p+'.',
 'Team: '+els.team.value.trim()+'.',
 'Year: '+els.year.value.trim()+'.',
 'Subtitle: '+els.subtitle.value.trim()+'.',
 'Card number: '+els.number.value.trim()+'.',
 'Foil / rarity: '+els.rarity.value.trim()+'.',
 'Signature: '+els.signature.value.trim()+'.',
 'Instructions: '+els.instructions.value.trim(),
 'Special features: '+els.extras.value.trim(),
 'Use the uploaded photo as the focal image. Transform it into a real collectible-card composition rather than simply placing a photo in a rectangle. Preserve a clean readable nameplate, strong hierarchy, premium framing, and coherent era-appropriate styling. Do not copy brand logos.'
 ].join('\n');
 els.prompt.value=text;els.status.textContent='Design prompt built.';return text;
}
function parseJSON(text){try{return JSON.parse(text)}catch{}const a=text.indexOf('{'),b=text.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(text.slice(a,b+1))}catch{}}return null}
async function askRogers(){
 const prompt=buildPrompt();els.status.textContent='Rogers AI is designing…';
 try{
  const r=await fetch(ROGERS_AI_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({input:prompt,context:{application:'Sports Card Builder',task:'sports-card-design',styleFamily:els.style.value}})});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));
  const out=String(d.output||d.output_text||d.answer||'').trim(),parsed=parseJSON(out);
  els.prompt.value=parsed?.card?.finalDesignPrompt||parsed?.reply||out||prompt;
  els.status.textContent='Rogers AI design returned.';
 }catch(e){els.status.textContent='Rogers AI unavailable: '+e.message}
}
els.photo.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{els.previewImage.src=rd.result;els.previewImage.style.display='block';els.placeholder.style.display='none';els.status.textContent='Image imported.'};rd.readAsDataURL(f)});
['style','year','player','team','subtitle','number','rarity','signature'].forEach(id=>$(id).addEventListener('input',apply));
$('build').addEventListener('click',buildPrompt);$('rogers').addEventListener('click',askRogers);$('copy').addEventListener('click',async()=>{if(!els.prompt.value.trim())buildPrompt();try{await navigator.clipboard.writeText(els.prompt.value);els.status.textContent='Prompt copied.'}catch{els.status.textContent='Copy unavailable on this browser.'}});
apply();