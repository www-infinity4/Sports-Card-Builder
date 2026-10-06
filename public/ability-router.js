(function(global){
'use strict';

const ABILITIES={
 image_reader:{
  id:'image_reader',
  engine:'Gemma 4 26B',
  runtime:'Cloudflare Workers AI',
  tasks:['ocr','visual-semantics','objects','era-clues','media-clues'],
  purpose:'Reads the exact uploaded image twice, with an OCR-first audit pass.'
 },
 web_context:{
  id:'web_context',
  engine:'Orange Brook / SearXNG',
  runtime:'Cloudflare container',
  tasks:['exact-ocr-search','context-corroboration'],
  purpose:'Searches literal visible text first, then corroborates image context.'
 },
 manager:{
  id:'manager',
  engine:'GPT-OSS 120B',
  runtime:'Cloudflare Workers AI',
  tasks:['semantic-reconciliation','design-planning','renderer-recovery','visual-critique'],
  purpose:'Acts as the manager over reading, planning, recovery and critique.'
 },
 image_generation:{
  id:'image_generation',
  engine:'FLUX.2 Dev + Klein 9B',
  runtime:'Cloudflare Workers AI',
  tasks:['reference-image-edit','card-render','repair-render'],
  purpose:'Renders and repairs the finished collectible-card artwork.'
 },
 exact_typography:{
  id:'exact_typography',
  engine:'Exact text compositor',
  runtime:'browser',
  tasks:['title','context','series','date','collector-mark'],
  purpose:'Adds verified text after image generation so names are spelled exactly.'
 },
 browser_critic:{
  id:'browser_critic',
  engine:'Code Phi Cloud Browser',
  runtime:'Cloudflare Browser Rendering',
  tasks:['mobile-inspection','runtime-errors','overflow','broken-assets'],
  purpose:'Inspects the finished card in the phone-sized browser view before acceptance.'
 }
};

function route(build={}){
 const raw=String(build?.semantics?.raw||'').toLowerCase();
 const pipeline=['image_reader','web_context','manager','image_generation','exact_typography','browser_critic'];
 return {
  version:'2026.10.06.2',
  pipeline,
  abilities:pipeline.map(id=>ABILITIES[id]),
  optional:/reference|build like|use this card/.test(raw)?['reference-conditioning']:[],
  execution:{active:pipeline}
 };
}

function buildCapabilityNote(plan){
 const r=route(plan);
 return [
  'ORACLE ACTIVE SKILLS:',
  ...r.abilities.map(a=>'- '+a.engine+': '+a.purpose),
  'These are active responsibilities, not decorative labels. Preserve semantic hard locks.'
 ].join('\n');
}

global.OracleAbilityRouter={ABILITIES,route,buildCapabilityNote};
})(window);
