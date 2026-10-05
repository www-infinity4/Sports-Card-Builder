(function(global){
'use strict';

const ABILITIES={
 vision_browser:{
  id:'vision_browser',
  engine:'transformers.js',
  fork:'www-infinity4/transformers.js',
  runtime:'browser',
  tasks:['image-classification','object-detection','segmentation','depth-estimation','zero-shot-object-detection'],
  purpose:'Fast browser-side inspection of uploaded subject and rendered card.'
 },
 segmentation:{
  id:'segmentation',
  engine:'SAM2',
  fork:'www-infinity4/sam2',
  runtime:'gpu-service',
  tasks:['subject-mask','object-mask','video-mask-propagation'],
  purpose:'Precise player/object isolation, masking and region-aware editing.'
 },
 workflow:{
  id:'workflow',
  engine:'ComfyUI',
  fork:'www-infinity4/ComfyUI',
  runtime:'gpu-service',
  tasks:['workflow-graph','inpainting','outpainting','reference-conditioning','mask-compositing','upscaling','frame-interpolation'],
  purpose:'Primary open workflow/orchestration engine for reproducible card builds.'
 },
 image_generation:{
  id:'image_generation',
  engine:'FLUX + Diffusers',
  forks:['www-infinity4/flux','www-infinity4/diffusers'],
  runtime:'gpu-service',
  tasks:['text-to-image','image-to-image','inpainting','controlled-generation'],
  purpose:'High-quality card artwork generation and edit pipelines.'
 },
 video_generation:{
  id:'video_generation',
  engine:'Wan2.2',
  fork:'www-infinity4/Wan2.2',
  runtime:'gpu-service',
  tasks:['text-to-video','image-to-video','text-image-to-video','character-animation'],
  purpose:'Animate finished cards, foil, reveals and short collectible sequences.'
 }
};

function route(build){
 const s=build?.semantics||{};
 const requested=String(s.raw||'').toLowerCase();
 const pipeline=['vision_browser'];
 if(build?.mode==='reference'||/reference|use this card|build like/.test(requested))pipeline.push('segmentation');
 pipeline.push('workflow','image_generation');
 if(/animate|animation|motion|video|moving|spin|rotate|reveal|shimmer/.test(requested))pipeline.push('video_generation');
 return {
  version:'2026.10.05.1',
  pipeline,
  abilities:pipeline.map(id=>ABILITIES[id]),
  execution:{
   browser:pipeline.filter(id=>ABILITIES[id].runtime==='browser'),
   gpuService:pipeline.filter(id=>ABILITIES[id].runtime==='gpu-service')
  }
 };
}

function buildCapabilityNote(plan){
 const r=route(plan);
 return [
  'ORACLE ABILITY ROUTE:',
  ...r.abilities.map(a=>'- '+a.engine+': '+a.purpose),
  'Use the selected engines as responsibilities, not as decorative names. Preserve all semantic hard locks.'
 ].join('\n');
}

global.OracleAbilityRouter={ABILITIES,route,buildCapabilityNote};
})(window);
