/*
 * Oracle card template database.
 *
 * A curated catalogue of trading-card design families, year by year, for
 * sports (Topps, Bowman, Upper Deck, Donruss, Fleer, Score, Leaf, Panini) and
 * entertainment cards (movies and TV shows). Each entry describes the design
 * language, frame, palette and where the brand spot, name plate and 1/1
 * serial sit, so the renderer and the exact-text compositor follow one layout.
 *
 * Designs are described in words only: no trademarks or logos are reproduced.
 * Every entry also carries a reference image query so the browser can collect
 * real online example images for the design (see app.js template references).
 *
 * Pure logic works in Node (for tests) and in the browser.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OracleTemplateDB=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';

const VERSION='2026.10.06.1';

const CATEGORIES={
 sports:{id:'sports',label:'Sports',brandRole:'card maker, league or team logo text actually printed in the image (e.g. Topps, Upper Deck, Yankees)',contextRole:'team, league or event',titleRole:'player / athlete name'},
 movie:{id:'movie',label:'Movie',brandRole:'studio or franchise (e.g. MGM, Warner Bros., Batman, Star Wars, Marvel)',contextRole:'movie title',titleRole:'character or actor name'},
 tv:{id:'tv',label:'TV show',brandRole:'network, studio or franchise (e.g. HBO, NBC, Star Trek, The Simpsons)',contextRole:'TV show title',titleRole:'character or actor name'},
 other:{id:'other',label:'Other',brandRole:'brand or logo text actually printed in the image',contextRole:'event, product, band, place or other context',titleRole:'subject name'}
};

// Layout presets. Fractions of card width / height.
const LAYOUTS={
 classic:{brand:'top-left',nameplate:'lower-right',serial:'lower-right',plate:'bar'},
 brandRight:{brand:'top-right',nameplate:'lower-right',serial:'lower-right',plate:'bar'},
 tombstone:{brand:'top-left',nameplate:'lower-right',serial:'lower-right',plate:'tab'},
 fullBleed:{brand:'top-left',nameplate:'lower-right',serial:'lower-right',plate:'fade'}
};

function T(id,maker,year,line,category,design,border,palette,layout='classic',keywords=[]){
 return {id,maker,year,line,category,design,border,palette,layout,keywords};
}

const TEMPLATES=[
 // ---- Topps (baseball flagship, year by year) ----
 T('topps-1952','Topps',1952,'Flagship','sports','Hand-tinted painted photo, white border, lower panel with a boxed facsimile signature, star-bordered name box and team emblem tile.','white',['#f4ecd8','#c8102e','#1b1b1b'],'classic',['vintage','hand tinted']),
 T('topps-1954','Topps',1954,'Flagship','sports','Bold solid-color background with a cut-out head shot plus a small action vignette, name and team stacked in the upper band.','white',['#e2b22c','#1f6fb2','#ffffff'],'brandRight',['vintage']),
 T('topps-1957','Topps',1957,'Flagship','sports','First full-color natural photography, thin white border, small name and team text tucked in a lower corner.','white',['#ffffff','#20304d','#c7a252'],'classic',['vintage']),
 T('topps-1963','Topps',1963,'Flagship','sports','Large photo with a circular inset head shot in a lower corner over a solid color band carrying the name.','white',['#ffffff','#e05a2b','#2a5ea8'],'classic',['circle inset']),
 T('topps-1965','Topps',1965,'Flagship','sports','Photo framed by a colored inner border with a waving team pennant in the lower corner.','white',['#ffffff','#2364aa','#e94b3c'],'classic',['pennant']),
 T('topps-1971','Topps',1971,'Flagship','sports','Iconic solid black border, thin white keyline, small facsimile signature and name/position in the lower band.','black',['#0d0d0d','#ffffff','#f2c230'],'classic',['black border']),
 T('topps-1972','Topps',1972,'Flagship','sports','Psychedelic tombstone arch framing the photo, bright gradient team-name lettering, colored rounded frame.','colored',['#ff6f3c','#2bb3a3','#f7d23e'],'tombstone',['psychedelic','tombstone']),
 T('topps-1975','Topps',1975,'Flagship','sports','Two-tone bright color border (top/bottom contrasting), team name across the top, round position badge.','two-tone',['#e5342b','#2a9d4b','#f6c022'],'brandRight',['two tone']),
 T('topps-1980','Topps',1980,'Flagship','sports','White border with a pennant-style team flag in a top corner and a colored banner holding the name.','white',['#ffffff','#e23b2e','#2c4f9e'],'brandRight',[]),
 T('topps-1983','Topps',1983,'Flagship','sports','Main action photo plus a small circular head shot inset in the lower corner, color stripe across the bottom.','white',['#ffffff','#2a5ea8','#ffcc33'],'classic',['inset']),
 T('topps-1986','Topps',1986,'Flagship','sports','Thick black top band with big team name, white border, small colored circle with position near the bottom.','white',['#111111','#ffffff','#d6262f'],'classic',['black top']),
 T('topps-1987','Topps',1987,'Flagship','sports','Famous woodgrain border, rounded photo window, team logo circle in a lower corner and color name bar.','woodgrain',['#7a4d26','#c7955c','#f2e6cf'],'classic',['woodgrain','wood']),
 T('topps-1989','Topps',1989,'Flagship','sports','White border with a slanted two-color name banner across the lower corner and team name in a contrasting stripe.','white',['#ffffff','#1f5aa6','#e8432f'],'classic',[]),
 T('topps-1990','Topps',1990,'Flagship','sports','Loud multicolor borders with speckled pattern, oval photo window, bold team name above the photo.','multicolor',['#f04e98','#3cc7f4','#f6e25b'],'brandRight',['neon','multicolor']),
 T('topps-1993','Topps',1993,'Flagship','sports','Clean white border, full action photo, name bar with a color accent stripe along the bottom edge.','white',['#ffffff','#1e3a8a','#c9a227'],'classic',[]),
 T('topps-2001','Topps',2001,'Flagship','sports','50th-anniversary green border with a gold foil name plate and team logo near the bottom corner.','green',['#145a32','#ffffff','#d4af37'],'classic',['gold foil']),
 T('topps-2011','Topps',2011,'Flagship','sports','Full photo with a white border, curved swoosh name plate and team emblem in a lower corner.','white',['#ffffff','#0a2240','#b3122e'],'classic',[]),
 T('topps-2017','Topps',2017,'Flagship','sports','Near borderless photo with a thin team-color stripe and a translucent wave name plate at the bottom.','minimal',['#ffffff','#0b3d91','#e31837'],'fullBleed',['borderless']),
 T('topps-2020','Topps',2020,'Flagship','sports','Full-bleed photo with a soft drop-shadow inner frame and angled team-color corner tab holding the name.','minimal',['#ffffff','#14213d','#fca311'],'fullBleed',['full bleed']),
 T('topps-2023','Topps',2023,'Flagship','sports','Full-bleed photo with a rounded team-color tab and a clean modern name plate in the lower corner.','minimal',['#ffffff','#003087','#e4002b'],'fullBleed',[]),
 T('topps-2024','Topps',2024,'Flagship','sports','Full-bleed photo with sweeping diagonal team-color bars and a compact lower-corner name plate.','minimal',['#ffffff','#0c2340','#ff5910'],'fullBleed',[]),
 T('topps-2025','Topps',2025,'Flagship','sports','Full-bleed action photo with a geometric team-color frame fragment and bold condensed name type.','minimal',['#ffffff','#002d72','#ff5910'],'fullBleed',[]),
 T('topps-2026','Topps',2026,'Flagship','sports','Modern full-bleed flagship photo, crisp thin perimeter rule, compact name plate lower right and foil serial.','minimal',['#ffffff','#101820','#c9a227'],'fullBleed',['modern','flagship','series one']),
 T('topps-chrome','Topps',2026,'Chrome','sports','Mirror-chrome refractor stock, metallic frame edges, spectral shimmer, bold chrome name plate.','chrome',['#dfe8f2','#7d8ea3','#1b2735'],'classic',['chrome','refractor','superfractor']),
 T('topps-now','Topps',2026,'Now','sports','Moment-of-the-day card: full-bleed photo, large dated headline strip, minimal frame and print-run line.','minimal',['#ffffff','#e21c2a','#101010'],'fullBleed',['now','moment','headline']),
 T('topps-heritage','Topps',2026,'Heritage','sports','Modern players on a throwback design with cream card stock, retro typography and vintage print texture.','cream',['#f3e9d2','#b5332e','#24456b'],'classic',['heritage','vintage','retro','throwback']),
 T('topps-stadium-club','Topps',2026,'Stadium Club','sports','Near full-bleed dramatic photography, minimal framing, small foil name in a lower corner.','minimal',['#0b0b0b','#ffffff','#c9a227'],'fullBleed',['stadium club']),
 // ---- Bowman ----
 T('bowman-1953','Bowman',1953,'Color','sports','Pure borderless color portrait with no printed name on the front, thin white frame.','white',['#ffffff','#e4d4b0','#2b2b2b'],'fullBleed',['vintage']),
 T('bowman-1989','Bowman',1989,'Flagship','sports','Tall oversize card with white border, large photo and colored name strip along the bottom.','white',['#ffffff','#1d4f91','#d62828'],'classic',[]),
 T('bowman-chrome','Bowman',2026,'Chrome Prospects','sports','Prospect chrome card with a 1st-Bowman style badge area, refractor stock and youthful clean layout.','chrome',['#e6eef5','#1f8a70','#f2c14e'],'classic',['prospect','prospects','1st bowman']),
 // ---- Upper Deck ----
 T('upperdeck-1989','Upper Deck',1989,'Flagship','sports','Premium white card, crisp photo, colored base-path stripe running down one edge, hologram on the back.','white',['#ffffff','#2e7d32','#8d6e63'],'brandRight',['hologram','premium']),
 T('upperdeck-1990','Upper Deck',1990,'Flagship','sports','White border, sharp photography and a slanted team-color bar with the name in the lower corner.','white',['#ffffff','#0d47a1','#c62828'],'brandRight',[]),
 T('upperdeck-1993','Upper Deck',1993,'Flagship','sports','Full photo with a team name running vertically in a translucent strip and gold foil accents.','white',['#ffffff','#5d4037','#d4af37'],'brandRight',[]),
 T('upperdeck-sp-1993','Upper Deck',1993,'SP','sports','Borderless premium card with a foil top banner and dramatic action photo.','foil',['#1a1a1a','#d4af37','#ffffff'],'brandRight',['sp','foil']),
 T('upperdeck-2026','Upper Deck',2026,'Series One','sports','Modern hockey/basketball style full-bleed photo with angular color slash and condensed name type.','minimal',['#ffffff','#0b1f3a','#c8102e'],'fullBleed',['young guns','hockey']),
 // ---- Donruss ----
 T('donruss-1984','Donruss',1984,'Flagship','sports','White border with diagonal team-color stripes framing the photo and a name tab at the bottom.','white',['#ffffff','#1e3a8a','#c62828'],'classic',[]),
 T('donruss-1985','Donruss',1985,'Flagship','sports','Black border with thin red horizontal speed lines and a bold name plate below the photo.','black',['#111111','#d62828','#ffffff'],'classic',['black border']),
 T('donruss-1987','Donruss',1987,'Flagship','sports','Black border sprinkled with small yellow baseballs and gold stripes, team logo in a lower corner.','black',['#0e0e0e','#f2c230','#ffffff'],'classic',['black border']),
 T('donruss-1988','Donruss',1988,'Flagship','sports','Black and team-color bands with sweeping curves bordering the photo.','black',['#111111','#1565c0','#e53935'],'classic',[]),
 T('donruss-1990','Donruss',1990,'Flagship','sports','Bright red border with black speckle script pattern and a name banner at the bottom.','red',['#d32f2f','#111111','#ffffff'],'classic',['red border']),
 T('donruss-rated-rookie','Donruss',2026,'Rated Rookie','sports','Rookie card with a bold rated-rookie style shield badge near the name and bright frame.','colored',['#0d47a1','#ffffff','#f9a825'],'classic',['rated rookie','rookie']),
 T('donruss-diamond-kings','Donruss',2026,'Diamond Kings','sports','Painted fine-art portrait, ornate gilded frame, decorative crest and script name plate.','gilded',['#3b2a1a','#d4af37','#f5e6c8'],'classic',['diamond kings','painted','painting']),
 // ---- Fleer ----
 T('fleer-1984','Fleer',1984,'Flagship','sports','White border with a team-color frame line and logo in a top corner.','white',['#ffffff','#1565c0','#2e7d32'],'brandRight',[]),
 T('fleer-1986','Fleer',1986,'Flagship','sports','Dark navy border with a team-color inner frame and name block below the photo.','navy',['#0d1b3e','#ffffff','#e53935'],'classic',[]),
 T('fleer-1987','Fleer',1987,'Flagship','sports','Blue-to-white gradient border, team logo in a corner and colored name bar.','blue-gradient',['#1e88e5','#ffffff','#0d47a1'],'classic',[]),
 T('fleer-1989','Fleer',1989,'Flagship','sports','Gray pinstripe border with a team-color bar across the bottom.','gray',['#bdbdbd','#ffffff','#c62828'],'classic',['pinstripe']),
 T('fleer-ultra-1991','Fleer',1991,'Ultra','sports','Gray marble-like frame with full-gloss photo and silver name plate.','silver',['#9e9e9e','#ffffff','#263238'],'classic',['ultra']),
 // ---- Score / Leaf / Panini ----
 T('score-1988','Score',1988,'Flagship','sports','Solid bright colored borders (red, blue, green, purple) with a thin keyline and name below.','colored',['#1565c0','#ffffff','#c62828'],'classic',[]),
 T('score-1990','Score',1990,'Flagship','sports','Multicolor diagonal border bands with a lower name bar and team logo in a corner.','multicolor',['#00897b','#ffffff','#f4511e'],'classic',[]),
 T('leaf-1990','Leaf',1990,'Flagship','sports','Premium gray-silver frame, refined thin rules and classic heritage composition.','silver',['#cfd8dc','#263238','#c9a227'],'classic',['leaf']),
 T('panini-prizm','Panini',2026,'Prizm','sports','Prismatic refractor frame with angular geometric facets and bold color parallel edges.','prizm',['#e0f7fa','#7c4dff','#ff4081'],'classic',['prizm','silver prizm','basketball','football']),
 T('panini-select','Panini',2026,'Select','sports','Tiered concourse/premier stadium frame with metallic die-cut style geometry.','chrome',['#cfd8dc','#263238','#00bcd4'],'classic',['select']),
 // ---- Movies ----
 T('topps-star-wars-1977','Topps',1977,'Star Wars','movie','Movie still inside a colored starfield border (series colors: blue, red, yellow, green, orange) with caption bar.','starfield',['#1d4ed8','#f8fafc','#facc15'],'classic',['star wars','starfield','space']),
 T('topps-batman-1966','Topps',1966,'Batman','movie','Painted comic-style scene, bright pop-art border and caption panel.','colored',['#1e40af','#facc15','#111111'],'classic',['batman','comic','pop art']),
 T('topps-batman-1989','Topps',1989,'Batman Movie','movie','Movie still with a solid black border, yellow accent frame and caption bar.','black',['#0a0a0a','#facc15','#ffffff'],'classic',['batman','gotham','dark knight']),
 T('topps-jurassic-park-1993','Topps',1993,'Jurassic Park','movie','Movie still with a jungle-green and red frame and amber caption tab.','colored',['#14532d','#b91c1c','#f59e0b'],'classic',['jurassic','dinosaur']),
 T('skybox-marvel-1990','SkyBox',1990,'Marvel Universe','movie','Comic hero art on a bold colored frame with burst graphics and a name banner.','colored',['#b91c1c','#1d4ed8','#facc15'],'classic',['marvel','comic','superhero']),
 T('upperdeck-marvel-masterpieces','Upper Deck',1992,'Masterpieces','movie','Painted heroic portrait with a thin frame and elegant name plate.','gilded',['#111827','#d4af37','#f3f4f6'],'classic',['masterpieces','painted']),
 T('movie-lobby-card','Studio',1950,'Lobby Card','movie','Golden-age lobby card: tinted still, ornate title band and studio credit spot.','cream',['#f5e6c8','#7f1d1d','#111111'],'brandRight',['lobby','classic film','mgm','golden age']),
 T('movie-chrome-2026','Topps',2026,'Movie Chrome','movie','Modern chrome movie card: full-bleed still, refractor edges, franchise in the brand spot.','chrome',['#e5e7eb','#111827','#c9a227'],'fullBleed',['chrome','movie']),
 // ---- TV shows ----
 T('topps-star-trek-1979','Topps',1979,'Star Trek','tv','Episode still on a deep space-blue border with a starburst caption strip.','colored',['#0b1d51','#fbbf24','#ffffff'],'classic',['star trek','space']),
 T('topps-happy-days-1976','Topps',1976,'Happy Days','tv','1970s sitcom card: still photo, rounded corner frame and yellow caption bar.','colored',['#fde047','#dc2626','#111111'],'classic',['sitcom','1970s']),
 T('topps-x-files-1995','Topps',1995,'X-Files','tv','Dark moody still with a green-black frame and case-file caption tab.','black',['#052e16','#22c55e','#e5e7eb'],'classic',['x-files','case file']),
 T('skybox-simpsons-1990','SkyBox',1990,'The Simpsons','tv','Cartoon still with a bright yellow frame and bold speech-bubble caption.','colored',['#fde047','#2563eb','#111111'],'classic',['simpsons','cartoon','animated']),
 T('tv-chrome-2026','Topps',2026,'TV Chrome','tv','Modern chrome TV card: full-bleed episode still, metallic edge, show or network in the brand spot.','chrome',['#e5e7eb','#0f172a','#38bdf8'],'fullBleed',['chrome','tv','series'])
];

const BY_ID=Object.fromEntries(TEMPLATES.map(t=>[t.id,t]));

const MAKER_ALIASES={
 'Topps':['topps','topp'],
 'Bowman':['bowman'],
 'Upper Deck':['upper deck','upperdeck','ud'],
 'Donruss':['donruss','dobruss','donrus','dunruss'],
 'Fleer':['fleer'],
 'Score':['score'],
 'Leaf':['leaf'],
 'Panini':['panini'],
 'SkyBox':['skybox','sky box'],
 'Studio':['lobby card','studio']
};

function norm(v){
 return ' '+String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';
}
function has(text,word){return text.includes(' '+norm(word).trim()+' ');}

function list(filter={}){
 return TEMPLATES.filter(t=>(!filter.category||t.category===filter.category)&&(!filter.maker||t.maker===filter.maker));
}
function get(id){return BY_ID[String(id||'')]||null;}
function makers(){return [...new Set(TEMPLATES.map(t=>t.maker))];}

function findMaker(text){
 const t=norm(text);
 for(const [maker,aliases] of Object.entries(MAKER_ALIASES)){
  if(aliases.some(a=>has(t,a)))return maker;
 }
 return '';
}
function findYear(text){
 const m=String(text||'').match(/\b(19[4-9]\d|20[0-4]\d)\b/);
 return m?Number(m[1]):0;
}

const SPORT_WORDS=['baseball','basketball','football','hockey','soccer','athlete','player','pitcher','batter','catcher','quarterback','mlb','nba','nfl','nhl','mls','ufc','golf','tennis','boxing','wrestling','jersey','stadium','rookie','team','league','sport','sports'];
const MOVIE_WORDS=['movie','film','cinema','studio','mgm','warner','paramount','universal','disney','pixar','marvel','dc comics','batman','superman','star wars','jurassic','actor','actress','premiere','poster','box office','trailer','hollywood','character','franchise','lobby card','director'];
const TV_WORDS=['tv','television','tv show','sitcom','episode','season finale','series premiere','network','hbo','nbc','cbs','abc','fox','netflix','streaming','showrunner','star trek','simpsons','x files','cartoon','anime'];

function detectCategory(input={}){
 const text=norm([
  input.text,input.subjectType,input.category,input.semanticDescription,
  ...(Array.isArray(input.keywords)?input.keywords:[]),
  ...(Array.isArray(input.mediaClues)?input.mediaClues:[]),
  ...(Array.isArray(input.visibleText)?input.visibleText:[])
 ].filter(Boolean).join(' '));
 const explicit=String(input.category||'').toLowerCase().trim();
 if(CATEGORIES[explicit]&&explicit!=='other')return explicit;
 const score=words=>words.reduce((n,w)=>n+(has(text,w)?1:0),0);
 const s=score(SPORT_WORDS),m=score(MOVIE_WORDS),v=score(TV_WORDS);
 if(!s&&!m&&!v)return 'other';
 if(v>m&&v>=s)return 'tv';
 if(m>=s&&m>=v)return 'movie';
 return 'sports';
}

function match(text,{category=''}={}){
 const t=norm(text);
 if(!t.trim())return null;
 const maker=findMaker(text);
 const year=findYear(text);
 let best=null,bestScore=0;
 for(const tpl of TEMPLATES){
  if(category&&category!=='other'&&tpl.category!==category)continue;
  let score=0;
  if(maker&&tpl.maker===maker)score+=5;
  if(maker&&tpl.maker!==maker)score-=3;
  const lineHit=tpl.line!=='Flagship'&&has(t,tpl.line);
  if(lineHit)score+=6;
  for(const k of tpl.keywords)if(has(t,k))score+=2;
  if(year){
   if(tpl.year===year)score+=5;
   else score+=Math.max(0,3-Math.abs(tpl.year-year)/4);
  }else score+=tpl.year/100000; // no year given: prefer the newest design
  if(score>bestScore){bestScore=score;best=tpl;}
 }
 return bestScore>=5?best:null;
}

function defaultFor(category){
 if(category==='movie')return BY_ID['movie-chrome-2026'];
 if(category==='tv')return BY_ID['tv-chrome-2026'];
 return BY_ID['topps-2026'];
}

function referenceQuery(tpl){
 if(!tpl)return '';
 const kind=tpl.category==='sports'?'baseball card':tpl.category==='tv'?'trading card tv':'trading card';
 const line=tpl.line==='Flagship'?'':tpl.line;
 return [tpl.year,tpl.maker==='Studio'?'':tpl.maker,line,kind].filter(Boolean).join(' ');
}

function promptFor(tpl){
 if(!tpl)return '';
 return [
  'CARD TEMPLATE: '+tpl.year+' '+tpl.maker+' '+tpl.line+' design language ('+tpl.category+').',
  'Design: '+tpl.design,
  'Frame/border: '+tpl.border+'. Palette: '+tpl.palette.join(', ')+'.',
  'Layout: keep the '+LAYOUTS[tpl.layout].brand+' corner clear for the brand spot and the lower-right corner clear for the name plate and the 1/1 serial. Do not draw any text, logos, numbers or trademarks; exact text is composited afterwards.'
 ].join(' ');
}

// Geometry for the exact-text compositor. Brand spot, lower-right name plate
// and a strong 1/1 foil serial above the name plate.
function frontLayout(W,H,tpl){
 const preset=LAYOUTS[tpl?.layout]||LAYOUTS.classic;
 const pad=Math.max(18,Math.round(W*.045));
 const brandH=Math.max(30,Math.round(H*.05));
 const brandW=Math.round(W*.42);
 const brand={
  x:preset.brand==='top-right'?W-pad-brandW:pad,
  y:pad,w:brandW,h:brandH,
  align:preset.brand==='top-right'?'right':'left'
 };
 const plateW=Math.round(W*.74);
 const plateH=Math.max(70,Math.round(H*.11));
 const nameplate={x:W-pad-plateW,y:H-pad-plateH,w:plateW,h:plateH,align:'right',style:preset.plate};
 const serialW=Math.max(60,Math.round(W*.2));
 const serialH=Math.round(serialW*.52);
 const serial={x:W-pad-serialW,y:nameplate.y-Math.round(pad*.45)-serialH,w:serialW,h:serialH};
 return {pad,brand,nameplate,serial,preset};
}

const LABEL_PREFIX=/^(title|name|subject|brand|logo|context|team|movie|show|series|type|date|era|year)\s*[:\-–]\s*/i;
// Keep prefilled fields short: strip labels, quotes, symbols and excess words.
function cleanField(value,maxWords=6){
 let s=String(value||'').split(/\r?\n/)[0];
 s=s.replace(LABEL_PREFIX,'').replace(/[©®™"“”«»]/g,'').replace(/\s+/g,' ').trim();
 s=s.replace(/^[\s,.;:|\-–]+|[\s,.;:|\-–]+$/g,'');
 const words=s.split(' ').filter(Boolean);
 if(words.length>maxWords){
  const cut=s.split(/\s[|•·–—-]\s|[,;(]/)[0].trim();
  s=(cut&&cut.split(' ').length<=maxWords?cut:words.slice(0,maxWords).join(' '));
 }
 return s.slice(0,60).trim();
}

return {VERSION,CATEGORIES,LAYOUTS,TEMPLATES,list,get,makers,findMaker,findYear,detectCategory,match,defaultFor,referenceQuery,promptFor,frontLayout,cleanField};
});
