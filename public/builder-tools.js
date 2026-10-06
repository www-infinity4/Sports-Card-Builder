(function(global){
'use strict';

const VERSION='2026.10.05.1';

const STYLE_CATALOG={
  flagship:{
    aliases:['flagship'],
    default:{family:'premium flagship collectible card',traits:['photo-first composition','clean sharp perimeter geometry','confident editorial identity zones','polished printed-card stock','subject-domain-appropriate graphic language']},
    years:{}
  },
  topps:{
    aliases:['topps'],
    default:{family:'Topps-inspired flagship',traits:['photo-first composition','disciplined rectangular border','compact player/team identity zone','period-appropriate printed card stock']},
    years:{
      '1987':['warm heritage framing','woodgrain-inspired perimeter language','small lower identity panel','vintage coated stock'],
      '1988':['clean bright border','angled color accent geometry','photo-first crop','compact lower name zone'],
      '1989':['bright white perimeter border','layered lower-corner color geometry','clean action-photo window','late-1980s glossy stock'],
      '1990':['high-energy colored frame','bold geometric perimeter graphics','large photo field','bright early-1990s printing'],
      '1991':['clean white border','subtle anniversary-era polish','photo-led composition','restrained name/team treatment']
    }
  },
  fleer:{
    aliases:['fleer'],
    default:{family:'Fleer-inspired',traits:['bright color blocking','clean photo field','lively border rhythm','readable lower-third identity']},
    years:{
      '1987':['blue-gradient border language','clean white photo surround','compact name strip'],
      '1988':['white card field','strong team-color accent bars','simple photo-first geometry'],
      '1989':['gray/silver graphic field','angular color accents','clean centered photography']
    }
  },
  donruss:{
    aliases:['donruss'],
    default:{family:'Donruss-inspired',traits:['bold border geometry','saturated print colors','strong name/team zone','late-1980s coated-card feel']},
    years:{
      '1987':['black perimeter language','baseball motif accents','strong lower name zone'],
      '1989':['dark border geometry','multicolor angular accents','photo-first center']
    }
  },
  upperdeck:{
    aliases:['upper deck','upperdeck'],
    default:{family:'Upper Deck-inspired premium photography',traits:['premium photo reproduction','clean editorial spacing','restrained metallic accents','crisp modern stock']},
    years:{
      '1989':['clean premium photo field','small restrained identity zone','subtle metallic/editorial details']
    }
  },
  bowman:{
    aliases:['bowman'],
    default:{family:'Bowman-inspired prospect card',traits:['prospect-forward hierarchy','clean modern border','bright premium finish','large subject crop']},
    years:{}
  },
  stadiumclub:{
    aliases:['stadium club'],
    default:{family:'Stadium Club-inspired',traits:['near-full-bleed photography','minimal frame','dramatic sports photo','subtle typography']},
    years:{}
  },
  score:{
    aliases:['score'],
    default:{family:'Score-inspired',traits:['bright energetic graphics','strong color blocks','clear border rhythm','readable identity zone']},
    years:{}
  },
  leaf:{
    aliases:['leaf'],
    default:{family:'Leaf-inspired heritage premium',traits:['traditional framing','rich print texture','refined composition','restrained premium finish']},
    years:{}
  },
  diamondkings:{
    aliases:['diamond kings','diamond king'],
    default:{family:'painted collector-card art',traits:['painterly portrait integration','decorative collector composition','warm fine-art palette','handcrafted card-art character']},
    years:{}
  }
};

const POSITION_WORDS=[
 ['lower right',['lower right','bottom right','bottom-right','lower-right']],
 ['lower left',['lower left','bottom left','bottom-left','lower-left']],
 ['upper right',['upper right','top right','top-right','upper-right']],
 ['upper left',['upper left','top left','top-left','upper-left']],
 ['bottom center',['bottom center','bottom-centre','lower center','lower centre']],
 ['top center',['top center','top-centre','upper center','upper centre']],
 ['center',['center','centre','middle']]
];

function lower(v){return String(v||'').toLowerCase();}
function uniq(a){return [...new Set(a.filter(Boolean))];}
function matchOne(text,words){return words.find(w=>text.includes(w))||'';}
function yearFrom(text){
 const m=String(text||'').match(/\b(19\d{2}|20\d{2})\b/);
 return m?m[1]:'';
}
function positionFrom(text){
 const t=lower(text);
 for(const [name,words] of POSITION_WORDS) if(matchOne(t,words)) return name;
 return '';
}
function phraseAround(text,needle,span=46){
 const t=String(text||''); const i=lower(t).indexOf(lower(needle));
 if(i<0)return '';
 return t.slice(Math.max(0,i-span),Math.min(t.length,i+needle.length+span)).trim();
}
function detectBrand(text){
 const t=lower(text);
 for(const [key,entry] of Object.entries(STYLE_CATALOG)){
  if(entry.aliases.some(a=>t.includes(a)))return key;
 }
 return '';
}
function detectColors(text){
 const palette=['white','black','silver','gold','red','blue','navy','green','yellow','orange','purple','pink','gray','grey','cream','platinum','chrome','bronze','copper'];
 const t=lower(text);
 return uniq(palette.filter(c=>new RegExp('\\b'+c+'\\b','i').test(t)).map(c=>c==='grey'?'gray':c));
}
function detectBorder(text){
 const t=lower(text), colors=detectColors(text);
 const hasBorder=/\bborder\b|\bframe\b|\bperimeter\b/.test(t);
 if(!hasBorder)return {explicit:false,color:'',geometry:'sharp rectangular',instruction:''};
 let color='';
 for(const c of colors) if(new RegExp('\\b'+c+'(?:[- ](?:outer )?)?(?:border|frame)\\b|(?:border|frame)[- ]'+c,'i').test(t)){color=c;break}
 if(!color){
  const m=t.match(/\b(white|black|silver|gold|red|blue|navy|green|yellow|orange|purple|gray|cream|platinum|chrome|bronze|copper)\b.{0,18}\b(border|frame)\b/);
  color=m?m[1]:'';
 }
 return {
  explicit:true,
  color,
  geometry:/rounded corners?|round corners?/.test(t)?'rounded':'sharp rectangular',
  instruction:phraseAround(text,'border')||phraseAround(text,'frame')
 };
}
function detectRarity(text){
 const t=lower(text);
 const m=t.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);
 const one=/\b1\s*\/\s*1\b|\bone[- ]of[- ]one\b/.test(t);
 return {
  serial:m?m[0].replace(/\s/g,''):one?'1/1':'',
  oneOfOne:one,
  foil:/\bfoil\b/.test(t),
  foilColor:(t.match(/\b(silver|gold|black|red|blue|green|purple|platinum|rainbow|holo(?:graphic)?)\b.{0,15}\bfoil\b|\bfoil\b.{0,15}\b(silver|gold|black|red|blue|green|purple|platinum|rainbow|holo(?:graphic)?)\b/)||[]).slice(1).find(Boolean)||'',
  position:positionFrom(text)
 };
}
function detectCardType(text){
 const t=lower(text);
 const types=[
  ['rookie','rookie card'],['all-star','all-star card'],['all star','all-star card'],
  ['world series','World Series card'],['record breaker','record-breaker card'],
  ['future star','future stars card'],['team card','team card'],['leader','league leaders card'],
  ['autograph','autograph card'],['auto card','autograph card'],['relic','relic card'],
  ['patch','patch/relic card'],['certificate','certificate/commemorative card']
 ];
 for(const [n,v] of types)if(t.includes(n))return v;
 return 'collectible card';
}
function detectMaterials(text){
 const t=lower(text); const out=[];
 [['chrome','chrome finish'],['refractor','refractor finish'],['foil','foil stamping'],['holographic','holographic finish'],['holo','holographic finish'],['matte','matte stock'],['gloss','glossy stock'],['emboss','embossed detail'],['die cut','die-cut treatment'],['acetate','acetate layer'],['woodgrain','woodgrain print treatment']].forEach(([n,v])=>{if(t.includes(n))out.push(v)});
 return uniq(out);
}
function detectTextLocks(text){
 const t=String(text||''); const out=[];
 const quoted=[...t.matchAll(/["“”]([^"“”]{1,80})["“”]/g)].map(m=>m[1].trim());
 out.push(...quoted);
 const serial=(t.match(/\b\d{1,4}\s*\/\s*\d{1,4}\b/)||[])[0];
 if(serial)out.push(serial.replace(/\s/g,''));
 return uniq(out);
}
function parseRequest(description){
 const raw=String(description||'').trim();
 const t=lower(raw);
 const year=yearFrom(raw);
 const brand=detectBrand(raw);
 const border=detectBorder(raw);
 const rarity=detectRarity(raw);
 const colors=detectColors(raw);
 const materials=detectMaterials(raw);
 const orientation=/\bhorizontal\b|\blandscape\b/.test(t)?'horizontal':/\bvertical\b|\bportrait\b/.test(t)?'vertical':'vertical';
 const photoTreatment=/\bfull[- ]bleed\b/.test(t)?'full bleed':/\bportrait\b/.test(t)?'portrait crop':/\baction\b/.test(t)?'action crop':'photo-first';
 const exactness=/\bexact(?:ly)?\b|\bmust\b|\bdo not\b|\bdon'?t\b|\bonly\b|\bkeep\b/.test(t)?'strict':'normal';
 const constraints=[];
 if(border.explicit)constraints.push(border.instruction||((border.color?border.color+' ':'')+'border'));
 if(rarity.serial)constraints.push(rarity.serial+(rarity.foil?' foil':'')+(rarity.position?' '+rarity.position:''));
 if(/sharp corners?|square corners?/.test(t))constraints.push('sharp square card corners');
 if(/no rounded|not rounded/.test(t))constraints.push('no rounded card corners');
 if(/no logo|without logo/.test(t))constraints.push('no logo');
 if(/no text|without text/.test(t))constraints.push('no generated text');
 return {
  raw,year,brand,cardType:detectCardType(raw),orientation,photoTreatment,
  colors,border,rarity,materials,textLocks:detectTextLocks(raw),
  exactness,position:positionFrom(raw),constraints:uniq(constraints)
 };
}
function resolveStyle(semantics){
 const s=semantics||{}; const entry=STYLE_CATALOG[s.brand]||null;
 const traits=[];
 let family='custom user-directed collectible card';
 if(entry){
  family=entry.default.family;
  traits.push(...entry.default.traits);
  if(s.year&&entry.years[s.year])traits.unshift(...entry.years[s.year]);
 }
 if(!entry&&s.year){
  const y=Number(s.year);
  if(y>=1970&&y<=1979)traits.push('1970s printed-card restraint','simple geometric border','period print texture');
  else if(y>=1980&&y<=1989)traits.push('1980s photo-first collectible-card geometry','period color blocking','vintage coated stock');
  else if(y>=1990&&y<=1999)traits.push('1990s premium collectible-card printing','strong photography','clean graphic hierarchy');
  else if(y>=2000)traits.push('modern premium trading-card production','high-resolution subject treatment','precise collector-grade finish');
 }
 return {family,traits:uniq(traits),year:s.year||'',brand:s.brand||''};
}
function planLayout(semantics,style){
 const s=semantics||{}; const fullBleed=s.photoTreatment==='full bleed';
 const zones={
  card:{orientation:s.orientation||'vertical',corners:s.border?.geometry||'sharp rectangular',perimeter:'fully visible'},
  photo:{mode:s.photoTreatment||'photo-first',priority:'primary',crop:'preserve face, hands, equipment and recognizable identity'},
  identity:{position:fullBleed?'bottom overlay':'lower card zone',size:'compact',priority:'secondary'},
  rarity:s.rarity?.serial?{position:s.rarity.position||'lower right',content:s.rarity.serial,material:(s.rarity.foilColor?s.rarity.foilColor+' ':'')+(s.rarity.foil?'foil':'printed')} : null,
  footer:{position:'very bottom edge',contrast:'high contrast',priority:'legal/product line'},
  border:{color:s.border?.color||'',explicit:!!s.border?.explicit,width:s.border?.explicit?'clearly visible and continuous':'style appropriate'}
 };
 return {zones,styleFamily:style?.family||'custom collectible card'};
}
function hardRequirements(semantics,style,layout){
 const s=semantics||{}; const req=[
  'Transform the uploaded subject image into the completed card; preserve subject identity.',
  'Show the entire physical card perimeter in frame.',
  'Use sharp rectangular card geometry unless the user explicitly requests rounded corners.',
  'Make the result look like a professionally printed collectible card, not a mockup, slab, phone screen, template or picture-in-frame.'
 ];
 if(s.year)req.push('Honor the requested '+s.year+' era.');
 if(style?.family)req.push('Use '+style.family+' visual language without copying protected logos or literal trademarks.');
 if(s.border?.explicit)req.push('Border lock: '+(s.border.color?s.border.color+' ':'')+'border must be clearly visible around the full perimeter.');
 if(s.rarity?.serial)req.push('Rarity lock: '+s.rarity.serial+' must appear '+(s.rarity.position||'in a deliberate collector-mark position')+(s.rarity.foil?' as '+(s.rarity.foilColor||'metallic')+' foil':'')+'.');
 if(s.colors?.length)req.push('Palette intent: '+s.colors.join(', ')+'.');
 if(s.materials?.length)req.push('Material/finish intent: '+s.materials.join(', ')+'.');
 if(s.textLocks?.length)req.push('Literal text locks when rendered: '+s.textLocks.join(' | ')+'.');
 for(const c of s.constraints||[])req.push('User constraint: '+c+'.');
 return uniq(req);
}
function compilePrompt(semantics,style,layout,extras={}){
 const s=semantics||{}, st=style||resolveStyle(s), ly=layout||planLayout(s,st);
 const req=hardRequirements(s,st,ly);
 const art=Array.isArray(extras.artDirection)?extras.artDirection.filter(Boolean):[];
 const avoid=[
  'rounded presentation frame unless explicitly requested',
  'generic silver luxury frame when not requested',
  'floating card mockup',
  'grading slab or plastic holder',
  'tabletop scene',
  'fake brand logos',
  'any generated lettering or pseudo-text',
  'cropped-off card corners or hidden perimeter'
 ];
 return [
  'ORACLE COLLECTIBLE CARD BUILD SPEC.',
  'USER REQUEST: '+s.raw,
  'CARD TYPE: '+(s.cardType||'collectible card')+'.',
  'STYLE FAMILY: '+st.family+'.',
  st.traits?.length?'STYLE TRAITS: '+st.traits.join('; ')+'.':'',
  'LAYOUT: '+JSON.stringify(ly.zones)+'.',
  'HARD REQUIREMENTS: '+req.join(' '),
  art.length?'ADDITIONAL ART DIRECTION: '+art.join('; ')+'.':'',
  'QUALITY BAR: contemporary professional collectible-card production appropriate to the actual subject domain, coherent whole-card composition, clean edge discipline, controlled hierarchy, believable print materials, excellent subject integration, intentional negative space, precise collector detail.',
  'AVOID: '+avoid.join('; ')+'.',
  'Return one finished card image. Do not explain the design.'
 ].filter(Boolean).join('\n');
}
function validatePlan(plan,semantics){
 const errors=[]; const warnings=[];
 if(!plan||typeof plan!=='object')errors.push('missing_plan');
 if(!plan?.renderPrompt||String(plan.renderPrompt).length<120)errors.push('weak_render_prompt');
 const p=lower(plan?.renderPrompt||''); const s=semantics||{};
 if(s.year&&!p.includes(s.year))warnings.push('year_not_explicit');
 if(s.border?.explicit&&s.border.color&&!p.includes(s.border.color))errors.push('border_color_dropped');
 if(s.rarity?.serial&&!p.includes(lower(s.rarity.serial)))errors.push('rarity_dropped');
 if(s.rarity?.position&&!p.includes(lower(s.rarity.position)))warnings.push('rarity_position_dropped');
 if(/rounded/.test(p)&&s.border?.geometry==='sharp rectangular')warnings.push('rounded_corner_drift');
 return {ok:errors.length===0,errors,warnings};
}
function normalizeAIPlan(aiPlan,toolPlan){
 const base=toolPlan||buildToolPlan(aiPlan?.description||'');
 const ai=aiPlan&&typeof aiPlan==='object'?aiPlan:{};
 const art=[
  ai.photoTreatment,ai.layout,ai.materials,ai.lighting,ai.typeZones,ai.specialDetails
 ].filter(Boolean);
 const renderPrompt=compilePrompt(base.semantics,base.style,base.layout,{artDirection:art});
 const merged={
  ...ai,
  era:ai.era||base.semantics.year||'user-directed',
  cardFamily:ai.cardFamily||base.style.family,
  outerBorder:base.semantics.border?.explicit?(base.semantics.border.color?base.semantics.border.color+' ':'')+'border; full perimeter visible':(ai.outerBorder||'style appropriate border'),
  palette:ai.palette||base.semantics.colors.join(', '),
  layout:ai.layout||JSON.stringify(base.layout.zones),
  materials:ai.materials||base.semantics.materials.join(', '),
  mustPreserve:uniq([...(ai.mustPreserve||[]),...hardRequirements(base.semantics,base.style,base.layout)]),
  mustAvoid:uniq([...(ai.mustAvoid||[]),'cropped card perimeter','unrequested rounded corners','generic mockup or slab']),
  renderPrompt,
  toolSpec:base
 };
 const check=validatePlan(merged,base.semantics);
 if(!check.ok)merged.renderPrompt=base.renderPrompt;
 merged.validation=check;
 return merged;
}
function buildToolPlan(description){
 const semantics=parseRequest(description);
 const style=resolveStyle(semantics);
 const layout=planLayout(semantics,style);
 const renderPrompt=compilePrompt(semantics,style,layout);
 const plan={semantics,style,layout,renderPrompt,version:VERSION};
 plan.validation=validatePlan({renderPrompt},semantics);
 return plan;
}
global.OracleBuilderTools={
 VERSION,STYLE_CATALOG,parseRequest,resolveStyle,planLayout,compilePrompt,
 validatePlan,normalizeAIPlan,buildToolPlan,hardRequirements
};
})(window);
