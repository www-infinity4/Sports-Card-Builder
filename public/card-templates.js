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
 flagship:'Flagship: photo-first, real trading-card proportions, clean hierarchy, restrained graphics.',
 vintage:'Vintage: period print texture, simple geometry, warm stock character, historically plausible card construction.',
 contemporary:'Contemporary: modern premium sports-card spacing, crisp production, controlled foil or graphic accents.',
 abstract:'Abstract insert: experimental geometry and art direction while preserving a believable physical trading-card structure.'
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
  'Front text density: LOW. Do not create biography paragraphs or article-style body copy on the front.',
  'Front structure: dominant photo, title/name, small brand/logo zone, optional series/date, automatic collector marks.',
  title?'Title lock: '+title+'.':'Use a minimal neutral title treatment if subject identity is not yet known.',
  s.useBrand&&brand?'Brand lock: '+brand+'.':'Do not invent a brand name.',
  s.useLogo&&logo?'Logo text lock: '+logo+'.':'Do not invent a logo.',
  id.series?'Series: '+id.series+'.':'',
  s.includeDate&&id.dateText?'Date/era text: '+id.dateText+'.':'',
  s.signature==='signature'?'Include a tasteful signature treatment in a dedicated signature zone.':'No signature on the front.',
  s.oneOfOne?'Reserve a clean lower-right collector area for a deterministic 1/1 foil mark added after generation. Do not generate duplicate 1/1 text.':'',
  'Always show the full sharp rectangular card perimeter. No rounded presentation frame, slab, holder, tabletop or phone mockup.',
  freeform?'Optional user refinement: '+freeform:''
 ];
 return lines.filter(Boolean).join('\n');
}

global.OracleCardTemplates={TEMPLATES,STYLE,FINISH,choose,compile};
})(window);
