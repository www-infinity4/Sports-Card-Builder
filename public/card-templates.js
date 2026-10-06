(function(global){
'use strict';

const TEMPLATES={
 flagship_white:{
  id:'flagship_white',
  name:'White Flagship',
  border:'white',
  prompt:'Authentic flagship baseball trading-card language: clean bright white rectangular border around the full perimeter, large photo field, compact title/name zone, restrained brand/logo area, minimal front text, crisp printed-card hierarchy.'
 },
 flagship_black:{
  id:'flagship_black',
  name:'Black Flagship',
  border:'black',
  prompt:'Premium black-border trading card with a continuous sharp rectangular black perimeter, large photo field, compact identity zone, restrained collector graphics and minimal front text.'
 },
 chrome:{
  id:'chrome',
  name:'Chrome',
  border:'silver',
  prompt:'Modern chrome trading card with crisp metallic edge treatment, controlled reflective accents, strong subject photo, clean identity zone and premium collector finish.'
 },
 hologram:{
  id:'hologram',
  name:'Hologram',
  border:'holographic',
  prompt:'Premium holographic insert card: iridescent edge accents and restrained refractor shimmer around a strong central photo, readable title zone, collector-grade finish, no noisy full-card rainbow wash.'
 },
 insert:{
  id:'insert',
  name:'Insert Series',
  border:'style-directed',
  prompt:'Distinct premium insert-series composition with one memorable graphic device, strong subject image, clean title zone, restrained branding and collector-grade print finish.'
 }
};

const STYLE={
 topps:'Topps-style flagship language: photo-first composition, disciplined borders, compact name/team hierarchy and period-aware geometry. Do not copy trademarks or exact logos.',
 donruss:'Donruss-style language: bold late-1980s geometry, saturated print color, strong lower identity treatment and angular accents. Do not copy trademarks or exact logos.',
 fleer:'Fleer-style language: bright edge treatments, energetic color blocking, photo-forward center and compact lower-third identity. Do not copy trademarks or exact logos.',
 flagship:'Flagship: photo-first, real trading-card proportions, clean hierarchy, restrained graphics.',
 upperdeck:'Upper Deck-style language: premium photography-led card, clean frame system, crisp spacing and restrained metallic accents. Do not copy trademarks or exact logos.'
};

const FINISH={
 paper:'paper card stock with believable printed ink and subtle stock texture',
 matte:'premium matte stock with restrained reflections',
 gloss:'gloss-coated trading card with controlled highlights',
 foil:'selective foil stamping only on collector details and accents',
 refractor:'refractor/chrome finish with controlled spectral shimmer, not an all-over rainbow'
};

function choose(state){
 const s=state?.selections||{};
 if(s.border==='black')return TEMPLATES.flagship_black;
 if(s.border==='chrome')return TEMPLATES.chrome;
 if(s.border==='hologram')return TEMPLATES.hologram;
 if(s.border==='insert')return TEMPLATES.insert;
 return TEMPLATES.flagship_white;
}

function compile(state,freeform=''){
 const s=state?.selections||{}, id=state?.identity||{}, t=choose(state);
 const title=id.title||state?.detected?.title||'';
 const brand=id.brand||'';
 const logo=id.logoText||'';
 const lines=[
  'BUTTON-BUILDER LOCKS:',
  t.prompt,
  STYLE[s.style]||STYLE.flagship,
  'Material: '+(FINISH[s.finish]||FINISH.paper)+'.',
  'IMAGE POLICY: use the exact uploaded source image. Do not synthesize, replace, redraw, or hallucinate a different person, actor, player, object, uniform, face, or scene.',
  'Front structure: dominant exact uploaded image with card graphics and deterministic typography composed by the card renderer.',
  s.showName&&title?'Card name/title: '+title+'.':'Do not print a name/title.',
  s.showContext&&context?'Team / movie / context line: '+context+'.':'Do not print a team/movie/context line.',
  s.useBrand&&brand?'Brand/logo treatment: '+brand+'.':'Do not invent a brand.',
  s.useLogo&&logo?'Logo text equals the brand unless the user explicitly changes it: '+logo+'.':'Do not invent a logo.',
  id.series?'Series: '+id.series+'.':'',
  s.includeDate&&id.dateText?'Date/era text: '+id.dateText+'.':'',
  s.signature==='signature'?'Reserve a tasteful signature zone. Do not add other text around it.':'No signature on the front.',
  s.oneOfOne?'Reserve a small clean lower-right area for post-processing. Do NOT render 1/1, serial numbering, plaques, badges or boxes in the generated artwork; the exact 1/1 foil mark is added afterward.':'',
  'Always show the full sharp rectangular card perimeter. No rounded presentation frame, slab, holder, tabletop or phone mockup.',
  freeform?'Optional user refinement: '+freeform:''
 ];
 return lines.filter(Boolean).join('\n');
}

global.OracleCardTemplates={TEMPLATES,STYLE,FINISH,choose,compile};
})(window);
