/*
 * Oracle Auto Card engine.
 *
 * One tap, no input required: picks a subject, set, parallel, serial number,
 * rookie/autograph/relic hits and composes a complete production-style card
 * front and back. Free text (or the uploaded photo) steers the build.
 *
 * The card frame, typography, foil numbering and back are composed
 * deterministically on canvas, so a finished card is produced on every try.
 * Only the artwork comes from an image model, with a procedural painted
 * fallback when no model is reachable.
 *
 * Pure spec logic works in Node (for tests); rendering requires a browser.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OracleAutoCard=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';

const VERSION='2026.10.06.1';
const DEFAULT_BRAND='INFINITY';
const ART_ENDPOINT='https://image.pollinations.ai/prompt/';
const W=750,H=1050; // 2.5 x 3.5 in at 300 dpi

const TEAMS={
 ARI:{name:'Arizona Diamondbacks',city:'Arizona',short:'Diamondbacks',primary:'#A71930',secondary:'#E3D4AD',aliases:['diamondbacks','dbacks','d-backs','arizona']},
 ATL:{name:'Atlanta Braves',city:'Atlanta',short:'Braves',primary:'#13274F',secondary:'#CE1141',aliases:['braves','atlanta']},
 BAL:{name:'Baltimore Orioles',city:'Baltimore',short:'Orioles',primary:'#DF4601',secondary:'#000000',aliases:['orioles','baltimore','os']},
 BOS:{name:'Boston Red Sox',city:'Boston',short:'Red Sox',primary:'#BD3039',secondary:'#0C2340',aliases:['red sox','boston']},
 CHC:{name:'Chicago Cubs',city:'Chicago',short:'Cubs',primary:'#0E3386',secondary:'#CC3433',aliases:['cubs']},
 CWS:{name:'Chicago White Sox',city:'Chicago',short:'White Sox',primary:'#27251F',secondary:'#C4CED4',aliases:['white sox']},
 CIN:{name:'Cincinnati Reds',city:'Cincinnati',short:'Reds',primary:'#C6011F',secondary:'#000000',aliases:['reds','cincinnati']},
 CLE:{name:'Cleveland Guardians',city:'Cleveland',short:'Guardians',primary:'#00385D',secondary:'#E50022',aliases:['guardians','cleveland']},
 COL:{name:'Colorado Rockies',city:'Colorado',short:'Rockies',primary:'#333366',secondary:'#C4CED4',aliases:['rockies','colorado']},
 DET:{name:'Detroit Tigers',city:'Detroit',short:'Tigers',primary:'#0C2340',secondary:'#FA4616',aliases:['tigers','detroit']},
 HOU:{name:'Houston Astros',city:'Houston',short:'Astros',primary:'#002D62',secondary:'#EB6E1F',aliases:['astros','houston']},
 KC:{name:'Kansas City Royals',city:'Kansas City',short:'Royals',primary:'#004687',secondary:'#BD9B60',aliases:['royals','kansas city']},
 LAA:{name:'Los Angeles Angels',city:'Los Angeles',short:'Angels',primary:'#BA0021',secondary:'#003263',aliases:['angels','anaheim']},
 LAD:{name:'Los Angeles Dodgers',city:'Los Angeles',short:'Dodgers',primary:'#005A9C',secondary:'#EF3E42',aliases:['dodgers']},
 MIA:{name:'Miami Marlins',city:'Miami',short:'Marlins',primary:'#00A3E0',secondary:'#EF3340',aliases:['marlins','miami']},
 MIL:{name:'Milwaukee Brewers',city:'Milwaukee',short:'Brewers',primary:'#12284B',secondary:'#FFC52F',aliases:['brewers','milwaukee']},
 MIN:{name:'Minnesota Twins',city:'Minnesota',short:'Twins',primary:'#002B5C',secondary:'#D31145',aliases:['twins','minnesota']},
 NYM:{name:'New York Mets',city:'New York',short:'Mets',primary:'#002D72',secondary:'#FF5910',aliases:['mets']},
 NYY:{name:'New York Yankees',city:'New York',short:'Yankees',primary:'#0C2340',secondary:'#C4CED3',aliases:['yankees','yanks']},
 ATH:{name:'Athletics',city:'Sacramento',short:'Athletics',primary:'#003831',secondary:'#EFB21E',aliases:['athletics','a\'s','oakland']},
 PHI:{name:'Philadelphia Phillies',city:'Philadelphia',short:'Phillies',primary:'#E81828',secondary:'#002D72',aliases:['phillies','philadelphia']},
 PIT:{name:'Pittsburgh Pirates',city:'Pittsburgh',short:'Pirates',primary:'#27251F',secondary:'#FDB827',aliases:['pirates','pittsburgh']},
 SD:{name:'San Diego Padres',city:'San Diego',short:'Padres',primary:'#2F241D',secondary:'#FFC425',aliases:['padres','san diego']},
 SF:{name:'San Francisco Giants',city:'San Francisco',short:'Giants',primary:'#FD5A1E',secondary:'#27251F',aliases:['giants','san francisco']},
 SEA:{name:'Seattle Mariners',city:'Seattle',short:'Mariners',primary:'#0C2C56',secondary:'#005C5C',aliases:['mariners','seattle']},
 STL:{name:'St. Louis Cardinals',city:'St. Louis',short:'Cardinals',primary:'#C41E3A',secondary:'#0C2340',aliases:['cardinals','st louis','st. louis']},
 TB:{name:'Tampa Bay Rays',city:'Tampa Bay',short:'Rays',primary:'#092C5C',secondary:'#8FBCE6',aliases:['rays','tampa','tampa bay']},
 TEX:{name:'Texas Rangers',city:'Texas',short:'Rangers',primary:'#003278',secondary:'#C0111F',aliases:['rangers','texas']},
 TOR:{name:'Toronto Blue Jays',city:'Toronto',short:'Blue Jays',primary:'#134A8E',secondary:'#1D2D5C',aliases:['blue jays','jays','toronto']},
 WSH:{name:'Washington Nationals',city:'Washington',short:'Nationals',primary:'#AB0003',secondary:'#14225A',aliases:['nationals','nats','washington']}
};

// Curated default subjects (from the release plan). Teams are a starting
// point only; verified card-intel data overrides them when available.
const PLAYERS=[
 {name:'Aaron Judge',team:'NYY',pos:'RF',star:true},
 {name:'Juan Soto',team:'NYM',pos:'RF',star:true},
 {name:'Shohei Ohtani',team:'LAD',pos:'DH',star:true},
 {name:'Ronald Acuña Jr.',team:'ATL',pos:'RF',star:true},
 {name:'Bryce Harper',team:'PHI',pos:'1B',star:true},
 {name:'Freddie Freeman',team:'LAD',pos:'1B',star:true,headline:'Home Run'},
 {name:'Julio Rodríguez',team:'SEA',pos:'CF',star:true,headline:'Home Run'},
 {name:'Junior Caminero',team:'TB',pos:'3B'},
 {name:'Ketel Marte',team:'ARI',pos:'2B',headline:'2-Run Homer'},
 {name:'Jacob deGrom',team:'TEX',pos:'P',star:true,headline:'100 Career Wins'},
 {name:'Roki Sasaki',team:'LAD',pos:'P',headline:'9 Strikeouts'},
 {name:'Bryan Woo',team:'SEA',pos:'P'},
 {name:'Kyle Manzardo',team:'CLE',pos:'1B'},
 {name:'Wilyer Abreu',team:'BOS',pos:'RF',headline:'Home Run'},
 {name:'Hunter Goodman',team:'COL',pos:'C',headline:'15th Home Run'},
 {name:'Jac Caglianone',team:'KC',pos:'1B',rookie:true},
 {name:'Charlie Condon',team:'COL',pos:'3B',rookie:true},
 {name:'Sal Stewart',team:'CIN',pos:'3B',rookie:true},
 {name:'Travis Bazzana',team:'CLE',pos:'2B',rookie:true,headline:'RBI Game'},
 {name:'Cam Schlittler',team:'NYY',pos:'P',rookie:true},
 {name:'Noah Cameron',team:'KC',pos:'P',rookie:true},
 {name:'Dave Stieb',team:'TOR',pos:'P',vintage:true,year:1985,headline:'Most Underrated Pitcher of the 1980s'}
];

const SETS={
 flagship:{id:'flagship',label:'SERIES ONE',maxNumber:350,prefix:'',weight:30},
 chrome:{id:'chrome',label:'CHROME',maxNumber:220,prefix:'',weight:26},
 heritage:{id:'heritage',label:'HERITAGE',maxNumber:500,prefix:'',weight:12},
 now:{id:'now',label:'NOW',maxNumber:999,prefix:'',weight:10},
 kings:{id:'kings',label:'KINGS OF THE DIAMOND',maxNumber:150,prefix:'DK-',weight:12},
 prospects:{id:'prospects',label:'1ST PROSPECTS',maxNumber:150,prefix:'BP-',weight:10}
};

const PARALLELS=[
 {id:'base',name:'Base',printRun:0,weight:34,tier:1,odds:1,color:null},
 {id:'refractor',name:'Refractor',printRun:0,weight:22,tier:2,odds:3,color:'#dfe8f2'},
 {id:'blue',name:'Blue Refractor',printRun:150,weight:13,tier:3,odds:24,color:'#2b6fe0'},
 {id:'gold',name:'Gold Refractor',printRun:50,weight:10,tier:4,odds:72,color:'#d4a72c'},
 {id:'orange',name:'Orange Refractor',printRun:25,weight:8,tier:5,odds:144,color:'#f07a1a'},
 {id:'red',name:'Red Refractor',printRun:5,weight:6,tier:6,odds:720,color:'#d22c2c'},
 {id:'black',name:'Black 1/1',printRun:1,weight:4,tier:7,odds:2880,color:'#121212'},
 {id:'superfractor',name:'Superfractor',printRun:1,weight:3,tier:8,odds:5760,color:'#e8c25a'}
];
const PARALLEL_POINTS={base:6,refractor:14,blue:28,gold:42,orange:54,red:68,black:84,superfractor:94};

const STOPWORDS=new Set(('make build create give me a an the card cards of for with and in on at to my please new random any '+
 'chrome refractor superfractor gold black red orange blue base parallel auto autograph autographed signed signature relic patch jersey '+
 'rookie rc prospect prospects heritage vintage retro now moment highlight diamond kings painted flagship series one topps bowman '+
 'panini donruss fleer upper deck baseball mlb player pitcher hitter one-of-one numbered serial edition insert hit grail '+
 'team spotlight inning innings run runs home homer homers grand slam strikeout strikeouts win wins game games first career hr rbi '+
 'walk off walkoff milestone record season world opening day all star mvp cy young brand style').split(/\s+/));

const TEAM_NAME_TEXT=Object.values(TEAMS).map(t=>(' '+t.name+' ').toLowerCase());

function normalize(v){
 return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9/ ]+/g,' ').replace(/\s+/g,' ').trim();
}

function mulberry32(seed){
 let a=(Number(seed)>>>0)||1;
 return function(){
  a|=0;a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296;
 };
}
function pickWeighted(rng,items,weightOf=x=>x.weight){
 const total=items.reduce((s,x)=>s+Math.max(0,weightOf(x)),0);
 let r=rng()*total;
 for(const x of items){r-=Math.max(0,weightOf(x));if(r<0)return x;}
 return items[items.length-1];
}
function initials(name){
 return String(name||'').split(/\s+/).filter(w=>/^[A-Za-zÀ-ÿ]/.test(w)&&!/^(jr|sr|ii|iii)\.?$/i.test(w)).map(w=>w[0].toUpperCase()).join('').slice(0,3)||'X';
}
function findTeam(text){
 const t=' '+normalize(text)+' ';
 // Longer aliases first so "white sox" wins over "sox" style partials.
 const entries=[];
 for(const [abbr,team] of Object.entries(TEAMS)){
  for(const a of [team.name,team.short,...team.aliases])entries.push([normalize(a),abbr]);
 }
 entries.sort((a,b)=>b[0].length-a[0].length);
 for(const [alias,abbr] of entries){if(alias&&t.includes(' '+alias+' '))return abbr;}
 return '';
}
function findPoolPlayer(text){
 const t=' '+normalize(text)+' ';
 for(const p of PLAYERS){if(t.includes(' '+normalize(p.name)+' '))return p;}
 for(const p of PLAYERS){
  const last=normalize(p.name).split(' ').filter(w=>!/^(jr|sr|ii|iii)$/.test(w)).pop();
  if(last&&last.length>3&&t.includes(' '+last+' '))return p;
 }
 return null;
}
function extractNameCandidate(raw){
 const re=/\b([A-Z][A-Za-zÀ-ÿ.'’-]+(?:\s+(?:[A-Z][A-Za-zÀ-ÿ.'’-]+|Jr\.?|Sr\.?|II|III)){1,3})/g;
 let m;
 while((m=re.exec(String(raw||'')))){
  const words=m[1].split(/\s+/).filter(w=>!STOPWORDS.has(normalize(w))&&!findTeam(w));
  const joined=normalize(words.join(' '));
  if(words.length>=2&&!findTeam(joined)&&!TEAM_NAME_TEXT.some(n=>n.includes(joined)))return words.join(' ');
 }
 return '';
}

function parseIntent(text=''){
 const raw=String(text||'');
 const t=normalize(raw);
 const has=re=>re.test(t);
 const intent={raw,player:'',team:'',set:'',parallel:'',auto:null,relic:null,rookie:null,year:0,headline:'',pos:'',brand:''};

 const unquoted=raw.replace(/["“][^"”]*["”]/g,' ');
 const pool=findPoolPlayer(unquoted);
 intent.player=pool?pool.name:extractNameCandidate(unquoted);
 intent.team=findTeam(raw);

 if(has(/\bsuperfractor\b/))intent.parallel='superfractor';
 else if(has(/\b1 ?\/ ?1\b|\bone of one\b|\bblack\b/))intent.parallel='black';
 else if(has(/\bred\b(?! sox)/))intent.parallel='red';
 else if(has(/\borange\b/))intent.parallel='orange';
 else if(has(/\bgold\b/))intent.parallel='gold';
 else if(has(/\bblue\b(?! jays)/))intent.parallel='blue';
 else if(has(/\brefractor\b/))intent.parallel='refractor';
 else if(has(/\bbase\b/))intent.parallel='base';
 if(!intent.parallel){
  const run=t.match(/\/ ?(150|50|25|5)\b/);
  if(run)intent.parallel={150:'blue',50:'gold',25:'orange',5:'red'}[run[1]];
 }

 if(has(/\bnow\b|\bmoment\b|\bhighlight\b|\bwalk ?off\b|\bmilestone\b/))intent.set='now';
 else if(has(/\bdiamond kings?\b|\bkings\b|\bpainted\b|\bpainting\b|\boil\b/))intent.set='kings';
 else if(has(/\bheritage\b|\bvintage\b|\bretro\b|\b19[5-7]\d\b/))intent.set='heritage';
 else if(has(/\bbowman\b|\bprospects?\b|\b1st\b/))intent.set='prospects';
 else if(has(/\bchrome\b|\brefractor\b|\bsuperfractor\b/))intent.set='chrome';
 else if(has(/\bflagship\b|\bseries one\b|\bseries 1\b|\btopps\b/))intent.set='flagship';

 if(has(/\bno auto\b|\bunsigned\b/))intent.auto=false;
 else if(has(/\bautos?\b|\bautograph(ed|s)?\b|\bsigned\b|\bsignature\b/))intent.auto=true;
 if(has(/\bno relic\b/))intent.relic=false;
 else if(has(/\brelics?\b|\bpatch\b|\bjersey\b|\bmemorabilia\b|\bswatch\b|\bbat ?barrel\b/))intent.relic=true;
 if(has(/\brookie\b|\brc\b/))intent.rookie=true;
 if(has(/\bpitcher\b|\bpitching\b|\bon the mound\b/))intent.pos='P';

 const year=raw.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
 if(year)intent.year=Number(year[1]);
 const quoted=raw.match(/["“]([^"”]{3,60})["”]/);
 if(quoted)intent.headline=quoted[1].trim();
 const brand=raw.match(/\bbrand\s*[:=]\s*([A-Za-z0-9 &'.-]{2,24})/i);
 if(brand)intent.brand=brand[1].trim().toUpperCase();
 return intent;
}

function resolvePlayer(intent,rng){
 if(intent.player){
  const pool=findPoolPlayer(intent.player);
  if(pool&&normalize(pool.name)===normalize(intent.player))return {...pool,team:intent.team||pool.team};
  return {name:intent.player,team:intent.team||'',pos:intent.pos||'',custom:true};
 }
 if(intent.team){
  const onTeam=PLAYERS.filter(p=>p.team===intent.team&&(!intent.rookie||p.rookie));
  if(onTeam.length)return {...onTeam[Math.floor(rng()*onTeam.length)]};
  return {name:TEAMS[intent.team].name,team:intent.team,pos:'TEAM',teamCard:true};
 }
 let pool=PLAYERS;
 if(intent.rookie)pool=pool.filter(p=>p.rookie);
 if(intent.pos==='P')pool=pool.filter(p=>p.pos==='P');
 if(!pool.length)pool=PLAYERS;
 return {...pool[Math.floor(rng()*pool.length)]};
}

function buildSpec(intent={},options={}){
 const seed=Number.isFinite(Number(options.seed))?Number(options.seed):Math.floor(Math.random()*2**31);
 const rng=mulberry32(seed);
 const now=Number(options.year)||new Date().getFullYear();
 const player=resolvePlayer(intent,rng);
 if(intent.pos&&!player.teamCard)player.pos=intent.pos;
 const rookie=intent.rookie===true||Boolean(player.rookie);

 let setId=intent.set;
 if(!SETS[setId]){
  setId=pickWeighted(rng,Object.values(SETS),s=>{
   if(s.id==='now')return (player.headline||intent.headline)?18:4;
   if(s.id==='prospects')return rookie?26:0;
   if(s.id==='heritage')return player.vintage?40:s.weight;
   return s.weight;
  }).id;
 }
 const set=SETS[setId];

 let parallel=PARALLELS.find(p=>p.id===intent.parallel);
 if(!parallel)parallel=pickWeighted(rng,PARALLELS);
 const auto=intent.auto===null||intent.auto===undefined?(!player.teamCard&&rng()<0.22):Boolean(intent.auto)&&!player.teamCard;
 const relic=intent.relic===null||intent.relic===undefined?(!player.teamCard&&rng()<0.16):Boolean(intent.relic)&&!player.teamCard;
 const serial=parallel.printRun?1+Math.floor(rng()*parallel.printRun):0;
 const year=intent.year||player.year||now;

 const ini=initials(player.name);
 let cardNumber;
 if(auto&&relic)cardNumber=(setId==='chrome'?'CARP-':'ARP-')+ini;
 else if(auto)cardNumber=(setId==='chrome'?'CRA-':setId==='prospects'?'BPA-':'RA-')+ini;
 else if(relic)cardNumber=(setId==='chrome'?'CR-':'SR-')+ini;
 else cardNumber=set.prefix+(1+Math.floor(rng()*set.maxNumber));

 const team=TEAMS[player.team]||null;
 const isPitcher=player.pos==='P';
 const poses=isPitcher
  ?['mid-delivery with the throwing arm loaded high','explosive follow-through after a fastball','toeing the rubber in the set position, intense stare']
  :player.teamCard
   ?['teammates celebrating together at home plate','a dugout erupting after a big inning']
   :['powerful swing follow-through as the ball leaves the bat','rounding the bases after a home run, fist raised','diving catch with full extension','loading at the plate, eyes locked on the pitch'];
 const pose=poses[Math.floor(rng()*poses.length)];
 const headline=intent.headline||player.headline||'';
 const brand=intent.brand||options.brand||DEFAULT_BRAND;
 const jersey=1+Math.floor(rng()*99);

 const spec={
  version:VERSION,seed,brand,year,
  player:{name:player.name,pos:player.pos||'',teamCard:Boolean(player.teamCard),star:Boolean(player.star),custom:Boolean(player.custom),vintage:Boolean(player.vintage)},
  team:team?{abbr:player.team,...team}:{abbr:'',name:'',city:'',short:'',primary:'#1d2b3a',secondary:'#c9aa64',aliases:[]},
  set,parallel,serial,auto,relic,rookie,cardNumber,pose,headline,jersey,
  usePhoto:Boolean(options.hasPhoto)
 };
 spec.title=cardTitle(spec);
 spec.artPrompt=buildArtPrompt(spec);
 spec.value=valueReport(spec);
 return spec;
}

function cardTitle(spec){
 const bits=[String(spec.year),spec.brand,spec.set.label==='SERIES ONE'?'Series One':titleCase(spec.set.label),'#'+spec.cardNumber,spec.player.name];
 if(spec.rookie)bits.push('RC');
 if(spec.parallel.id!=='base')bits.push(spec.parallel.name);
 if(spec.auto)bits.push('Auto');
 if(spec.relic)bits.push('Relic');
 if(spec.parallel.printRun)bits.push(spec.parallel.printRun===1?'1/1':String(spec.serial)+'/'+spec.parallel.printRun);
 return bits.join(' ');
}
function titleCase(s){return String(s||'').toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());}

function buildArtPrompt(spec){
 const team=spec.team;
 const colors=team.name?team.name+' team colors':'bold team colors';
 const style={
  flagship:'premium sports photography, telephoto lens, shallow depth of field, crisp stadium lighting',
  chrome:'ultra-sharp modern sports photography, dramatic rim light, high contrast, vivid color',
  heritage:'1970s vintage sports photograph, warm film grain, slightly faded Kodachrome color, sunny day game',
  now:'breaking-moment sports photojournalism, motion freeze, roaring crowd blurred behind',
  kings:'fine-art oil painting with visible confident brushstrokes, rich warm gold light, museum portrait quality',
  prospects:'bright clean modern sports photography, youthful energy, spring training sunlight'
 }[spec.set.id];
 const subject=spec.player.teamCard
  ?'a professional baseball team in '+colors+' uniforms, '+spec.pose
  :'a professional baseball '+(spec.player.pos==='P'?'pitcher':'player')+' wearing a '+colors+' uniform with jersey number '+spec.jersey+', '+spec.pose;
 return [
  'Vertical trading card photograph of '+subject,
  style,
  'single clear subject, full body or three-quarter framing, centered, stadium background',
  'no text, no letters, no logos, no watermark, no border, no frame'
 ].join(', ');
}

function valueReport(spec){
 let pts=PARALLEL_POINTS[spec.parallel.id]||6;
 if(spec.rookie)pts+=14;
 if(spec.auto)pts+=22;
 if(spec.relic)pts+=9;
 if(spec.player.star)pts+=8;
 if(spec.set.id==='chrome'||spec.set.id==='prospects')pts*=1.08;
 if(spec.parallel.printRun>1&&spec.serial===spec.parallel.printRun)pts+=3; // jersey-style "last number" premium
 const index=Math.max(1,Math.min(100,Math.round(pts)));
 const tier=index>=90?'Grail':index>=70?'Case Hit':index>=50?'Big Hit':index>=32?'Short Print':index>=16?'Insert':'Base';
 let odds=spec.parallel.odds*(spec.auto?24:1)*(spec.relic?8:1)*(spec.rookie?2:1);
 odds=Math.max(1,Math.round(odds));
 const serialText=spec.parallel.printRun?(spec.parallel.printRun===1?'1/1':spec.serial+'/'+spec.parallel.printRun):'Unnumbered';
 return {index,tier,odds,oddsText:odds<=1?'Every pack':'1:'+odds.toLocaleString('en-US')+' packs',serialText};
}

/* ---------------------------------------------------------------- render */

const hasDOM=typeof document!=='undefined';

function canvas(w=W,h=H){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function shade(hex,amt){
 const n=parseInt(String(hex).replace('#',''),16);
 if(!Number.isFinite(n))return hex;
 const f=c=>Math.max(0,Math.min(255,Math.round(c+(amt<0?c*amt:(255-c)*amt))));
 const r=f(n>>16&255),g=f(n>>8&255),b=f(n&255);
 return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
function rgba(hex,a){const n=parseInt(String(hex).replace('#',''),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';}
function luminance(hex){const n=parseInt(String(hex).replace('#',''),16);return (0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255;}
function ink(hex){return luminance(hex)>0.6?'#111':'#fff';}

function drawCover(ctx,img,x,y,w,h,focusY=0.38){
 const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
 const s=Math.max(w/iw,h/ih);
 const dw=iw*s,dh=ih*s;
 const dx=x+(w-dw)/2,dy=y+Math.min(0,Math.max(h-dh,(h-dh)*focusY*2));
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();
}
function fitFont(ctx,text,maxW,start,min,weight,family){
 let size=start;
 do{ctx.font=weight+' '+size+'px '+family;if(ctx.measureText(text).width<=maxW)break;size-=2;}while(size>min);
 return size;
}
const SANS='"Arial Black","Helvetica Neue",Arial,sans-serif';
const COND='"Oswald","Bebas Neue","Impact","Arial Narrow",Arial,sans-serif';
const SERIF='Georgia,"Times New Roman",serif';
const SCRIPT='"Brush Script MT","Segoe Script","Snell Roundhand","Lucida Handwriting",cursive';

function foilGradient(ctx,x,y,w,h,kind='gold'){
 const g=ctx.createLinearGradient(x,y,x+w,y+h);
 const stops=kind==='silver'
  ?['#f7f9fb','#9aa6b2','#ffffff','#7d8995','#eef2f5']
  :kind==='rainbow'
   ?['#ff8fa3','#ffd36e','#9bf6a2','#7cc8ff','#c79bff','#ff8fa3']
   :['#fff3c4','#c8962e','#fff7d6','#a87414','#f2d27a'];
 stops.forEach((c,i)=>g.addColorStop(i/(stops.length-1),c));
 return g;
}

function drawRefractorSheen(ctx,x,y,w,h,intensity=0.22,kind='rainbow'){
 ctx.save();
 ctx.globalCompositeOperation='overlay';
 ctx.globalAlpha=intensity;
 ctx.fillStyle=foilGradient(ctx,x,y,w,h,kind);
 ctx.fillRect(x,y,w,h);
 ctx.globalCompositeOperation='screen';
 ctx.globalAlpha=intensity*0.8;
 for(let i=0;i<3;i++){
  const sx=x+w*(0.15+i*0.33);
  const g=ctx.createLinearGradient(sx,y,sx+w*0.18,y+h);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+w*0.08,y);ctx.lineTo(sx+w*0.08+w*0.3,y+h);ctx.lineTo(sx+w*0.3,y+h);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}

function drawSuperfractorSwirl(ctx,x,y,w,h){
 ctx.save();
 ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 const cx=x+w/2,cy=y+h/2;
 for(let i=0;i<64;i++){
  const a=i/64*Math.PI*2;
  ctx.strokeStyle=i%2?'rgba(255,236,170,.55)':'rgba(170,120,30,.45)';
  ctx.lineWidth=6;
  ctx.beginPath();ctx.moveTo(cx,cy);
  ctx.quadraticCurveTo(cx+Math.cos(a+0.6)*w*0.6,cy+Math.sin(a+0.6)*h*0.6,cx+Math.cos(a)*w*1.2,cy+Math.sin(a)*h*1.2);
  ctx.stroke();
 }
 ctx.restore();
}

function borderFill(ctx,spec,fallback){
 const p=spec.parallel;
 if(p.id==='superfractor')return foilGradient(ctx,0,0,W,H,'gold');
 if(p.id==='refractor')return foilGradient(ctx,0,0,W,H,'silver');
 if(p.color&&p.id!=='base')return p.color;
 return fallback;
}

function drawFrameBackground(ctx,spec,fallback){
 ctx.fillStyle=borderFill(ctx,spec,fallback);
 ctx.fillRect(0,0,W,H);
 if(spec.parallel.id==='superfractor')drawSuperfractorSwirl(ctx,0,0,W,H);
 if(spec.parallel.color&&!['base','black'].includes(spec.parallel.id)){
  // Metallic depth on colored parallels.
  const g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.25)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 }
}

function drawSerial(ctx,spec,x,y,size=30,align='right'){
 if(!spec.parallel.printRun)return;
 const text=spec.parallel.printRun===1?'1/1':String(spec.serial).padStart(String(spec.parallel.printRun).length,'0')+'/'+spec.parallel.printRun;
 ctx.save();
 ctx.font='900 '+size+'px '+SANS;ctx.textAlign=align;ctx.textBaseline='alphabetic';
 const tw=ctx.measureText(text).width;
 const bx=align==='right'?x-tw:align==='center'?x-tw/2:x;
 ctx.lineWidth=Math.max(3,size*0.16);ctx.strokeStyle='rgba(0,0,0,.65)';ctx.strokeText(text,x,y);
 ctx.fillStyle=foilGradient(ctx,bx,y-size,tw,size,spec.parallel.id==='black'?'silver':'gold');
 ctx.fillText(text,x,y);
 ctx.restore();
}

function drawBrandMark(ctx,spec,x,y,r,fill,stroke){
 ctx.save();
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
 ctx.lineWidth=Math.max(2,r*0.1);ctx.strokeStyle=stroke;ctx.stroke();
 ctx.fillStyle=ink(typeof fill==='string'?fill:'#ffffff');
 ctx.textAlign='center';ctx.textBaseline='middle';
 fitFont(ctx,spec.brand,r*1.6,Math.round(r*0.42),8,'900',SANS);
 ctx.fillText(spec.brand,x,y-r*0.12);
 ctx.font='800 '+Math.round(r*0.3)+'px '+SANS;
 ctx.fillText(String(spec.year),x,y+r*0.36);
 ctx.restore();
}

function drawRookieBadge(ctx,x,y,s){
 ctx.save();
 ctx.beginPath();
 ctx.moveTo(x,y);ctx.lineTo(x+s,y);ctx.lineTo(x+s,y+s*0.7);ctx.quadraticCurveTo(x+s,y+s*1.05,x+s/2,y+s*1.2);ctx.quadraticCurveTo(x,y+s*1.05,x,y+s*0.7);ctx.closePath();
 ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=s*0.08;ctx.strokeStyle='#c8102e';ctx.stroke();
 ctx.fillStyle='#c8102e';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='900 '+Math.round(s*0.46)+'px '+SANS;ctx.fillText('RC',x+s/2,y+s*0.5);
 ctx.font='800 '+Math.round(s*0.13)+'px '+SANS;ctx.fillText('ROOKIE',x+s/2,y+s*0.86);
 ctx.restore();
}

function drawSignature(ctx,spec,x,y,maxW){
 const name=spec.player.name.replace(/\b(Jr|Sr)\.?$/,'').trim();
 ctx.save();
 ctx.translate(x,y);ctx.rotate(-0.07);
 const size=fitFont(ctx,name,maxW,78,30,'400',SCRIPT);
 ctx.font='400 '+size+'px '+SCRIPT;
 ctx.textAlign='center';ctx.textBaseline='alphabetic';
 ctx.lineJoin='round';
 ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=Math.max(3,size*0.09);ctx.strokeText(name,0,0);
 ctx.fillStyle='#1b3fae';ctx.fillText(name,0,0);
 const tw=Math.min(maxW,ctx.measureText(name).width);
 ctx.strokeStyle='#1b3fae';ctx.lineWidth=Math.max(2,size*0.05);ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-tw*0.45,size*0.22);ctx.bezierCurveTo(-tw*0.1,size*0.42,tw*0.2,size*0.05,tw*0.5,size*0.3);ctx.stroke();
 ctx.restore();
}

function drawRelicWindow(ctx,spec,x,y,w,h){
 ctx.save();
 ctx.fillStyle='#f5f2ea';ctx.fillRect(x-6,y-6,w+12,h+12);
 ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.strokeRect(x-6,y-6,w+12,h+12);
 ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.fillStyle=spec.team.primary;ctx.fillRect(x,y,w,h);
 // Mesh jersey texture.
 for(let yy=y;yy<y+h;yy+=4){for(let xx=x+((yy/4)%2?2:0);xx<x+w;xx+=4){ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(xx,yy,2,2);}}
 ctx.strokeStyle=spec.team.secondary;ctx.lineWidth=h*0.12;
 ctx.beginPath();ctx.moveTo(x,y+h*0.62);ctx.lineTo(x+w,y+h*0.3);ctx.stroke();
 const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(0,0,0,.25)');
 ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
 ctx.restore();
 ctx.save();ctx.fillStyle='#111';ctx.font='900 13px '+SANS;ctx.textAlign='center';
 ctx.fillText('RELIC',x+w/2,y+h+22);ctx.restore();
}

function posLine(spec){
 const pos={P:'PITCHER',C:'CATCHER','1B':'FIRST BASE','2B':'SECOND BASE','3B':'THIRD BASE',SS:'SHORTSTOP',LF:'OUTFIELD',CF:'OUTFIELD',RF:'OUTFIELD',OF:'OUTFIELD',DH:'DESIGNATED HITTER',TEAM:'TEAM CARD'}[spec.player.pos]||String(spec.player.pos||'').toUpperCase();
 return [spec.team.name.toUpperCase(),pos].filter(Boolean).join('  •  ');
}

/* ---- templates ---- */

function frontFlagship(ctx,spec,art){
 drawFrameBackground(ctx,spec,'#ffffff');
 const m=34,px=m,py=m,pw=W-m*2,ph=H-m*2;
 drawCover(ctx,art,px,py,pw,ph);
 if(spec.parallel.id==='refractor'||spec.parallel.id==='superfractor')drawRefractorSheen(ctx,px,py,pw,ph,0.14);
 ctx.strokeStyle=spec.team.secondary;ctx.lineWidth=4;ctx.strokeRect(px+2,py+2,pw-4,ph-4);
 // Angled nameplate in team colors.
 const baseY=H-m-24;
 ctx.save();
 ctx.fillStyle=spec.team.primary;
 ctx.beginPath();ctx.moveTo(px-6,baseY-92);ctx.lineTo(px+pw*0.78,baseY-92);ctx.lineTo(px+pw*0.70,baseY-24);ctx.lineTo(px-6,baseY-24);ctx.closePath();ctx.fill();
 ctx.fillStyle=spec.team.secondary;
 ctx.beginPath();ctx.moveTo(px-6,baseY-24);ctx.lineTo(px+pw*0.70,baseY-24);ctx.lineTo(px+pw*0.66,baseY+10);ctx.lineTo(px-6,baseY+10);ctx.closePath();ctx.fill();
 ctx.fillStyle=ink(spec.team.primary);ctx.textAlign='left';ctx.textBaseline='alphabetic';
 const name=spec.player.name.toUpperCase();
 fitFont(ctx,name,pw*0.66,56,24,'900',COND);
 ctx.fillText(name,px+18,baseY-40);
 ctx.fillStyle=ink(spec.team.secondary);
 fitFont(ctx,posLine(spec),pw*0.6,18,10,'800',SANS);
 ctx.fillText(posLine(spec),px+18,baseY+1);
 ctx.restore();
 drawBrandMark(ctx,spec,px+pw-50,py+54,40,spec.team.primary,spec.team.secondary);
 if(spec.rookie)drawRookieBadge(ctx,px+pw-82,baseY-150,62);
 if(spec.relic)drawRelicWindow(ctx,spec,px+pw-150,py+pw*0.95,118,92);
 if(spec.auto)drawSignature(ctx,spec,px+pw*0.5,baseY-140,pw*0.7);
 drawSerial(ctx,spec,px+pw-14,baseY+4,30,'right');
}

function frontChrome(ctx,spec,art){
 drawFrameBackground(ctx,spec,'#c9d1d9');
 if(spec.parallel.id==='base')drawRefractorSheen(ctx,0,0,W,H,0.5,'silver');
 const m=22,px=m,py=m,pw=W-m*2,ph=H-m*2;
 ctx.save();
 roundRect(ctx,px,py,pw,ph,18);ctx.clip();
 drawCover(ctx,art,px,py,pw,ph);
 const g=ctx.createLinearGradient(0,H*0.6,0,H);
 g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,rgba(shade(spec.team.primary,-0.4),0.95));
 ctx.fillStyle=g;ctx.fillRect(px,H*0.6,pw,H*0.4);
 if(spec.parallel.id!=='base'&&spec.parallel.id!=='black')drawRefractorSheen(ctx,px,py,pw,ph,spec.parallel.id==='refractor'?0.3:0.18);
 ctx.restore();
 ctx.lineWidth=5;ctx.strokeStyle=foilGradient(ctx,0,0,W,H,'silver');roundRect(ctx,px,py,pw,ph,18);ctx.stroke();
 // Chrome name band.
 const by=H-m-118;
 ctx.save();
 ctx.fillStyle=foilGradient(ctx,px,by,pw,10,'silver');ctx.fillRect(px+20,by,pw-40,4);
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=8;
 const name=spec.player.name.toUpperCase();
 fitFont(ctx,name,pw-80,60,24,'900',COND);ctx.fillText(name,W/2,by+64);
 ctx.shadowBlur=0;
 fitFont(ctx,posLine(spec),pw-120,17,10,'800',SANS);ctx.fillStyle=spec.team.secondary==='#000000'?'#d9dee3':shade(spec.team.secondary,0.35);
 ctx.fillText(posLine(spec),W/2,by+94);
 ctx.restore();
 drawBrandMark(ctx,spec,px+58,py+58,40,'#ffffff',foilGradient(ctx,0,0,80,80,'silver'));
 ctx.save();ctx.fillStyle='#fff';ctx.font='900 18px '+SANS;ctx.textAlign='right';ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=6;
 ctx.fillText(spec.set.label,px+pw-20,py+40);ctx.restore();
 if(spec.rookie)drawRookieBadge(ctx,px+pw-84,py+60,62);
 if(spec.relic)drawRelicWindow(ctx,spec,px+22,by-140,118,92);
 if(spec.auto)drawSignature(ctx,spec,W/2,by-40,pw*0.7);
 drawSerial(ctx,spec,px+pw-22,by-14,32,'right');
}

function frontHeritage(ctx,spec,art){
 drawFrameBackground(ctx,spec,'#efe4cc');
 const m=40,px=m,py=m+30,pw=W-m*2,ph=H-m*2-170;
 ctx.fillStyle=spec.team.primary;ctx.fillRect(px-10,py-10,pw+20,ph+20);
 ctx.fillStyle=spec.team.secondary;ctx.fillRect(px-4,py-4,pw+8,ph+8);
 drawCover(ctx,art,px,py,pw,ph);
 // Warm film tone.
 ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgba(240,214,170,.28)';ctx.fillRect(px,py,pw,ph);ctx.restore();
 if(spec.parallel.id!=='base')drawRefractorSheen(ctx,px,py,pw,ph,0.12);
 // Team pennant script + name block.
 const ny=py+ph+30;
 ctx.save();
 ctx.fillStyle=spec.team.primary;roundRect(ctx,px-10,ny,pw+20,110,14);ctx.fill();
 ctx.fillStyle=ink(spec.team.primary);ctx.textAlign='left';
 const team=(spec.team.short||'Baseball');
 fitFont(ctx,team,pw*0.55,64,26,'italic 900',SERIF);ctx.fillText(team,px+14,ny+70);
 ctx.textAlign='right';
 fitFont(ctx,spec.player.name,pw*0.42,34,16,'700',SERIF);ctx.fillText(spec.player.name,px+pw-12,ny+50);
 ctx.font='800 16px '+SANS;ctx.fillText(posLine(spec).split('  •  ').pop(),px+pw-12,ny+84);
 ctx.restore();
 // Position circle.
 ctx.save();ctx.beginPath();ctx.arc(px+pw-40,py+44,34,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=5;ctx.strokeStyle=spec.team.primary;ctx.stroke();
 ctx.fillStyle=spec.team.primary;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 22px '+SANS;ctx.fillText(spec.player.pos||'★',px+pw-40,py+45);ctx.restore();
 ctx.save();ctx.fillStyle='#3b2f22';ctx.font='900 18px '+SANS;ctx.textAlign='left';ctx.fillText(spec.brand+' '+spec.set.label,px,py-24);ctx.restore();
 // Paper grain.
 addGrain(ctx,0.05);
 if(spec.rookie)drawRookieBadge(ctx,px+12,py+12,58);
 if(spec.relic)drawRelicWindow(ctx,spec,px+pw-140,py+ph-130,110,86);
 if(spec.auto)drawSignature(ctx,spec,px+pw*0.45,py+ph-40,pw*0.65);
 drawSerial(ctx,spec,px+pw,H-22,26,'right');
}

function frontNow(ctx,spec,art){
 ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
 drawCover(ctx,art,0,0,W,H);
 if(spec.parallel.id!=='base')drawRefractorSheen(ctx,0,0,W,H,0.1);
 const g=ctx.createLinearGradient(0,H*0.55,0,H);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.92)');
 ctx.fillStyle=g;ctx.fillRect(0,H*0.55,W,H*0.45);
 const edge=borderFill(ctx,spec,spec.team.primary);
 ctx.lineWidth=14;ctx.strokeStyle=edge;ctx.strokeRect(7,7,W-14,H-14);
 // NOW badge.
 ctx.save();
 ctx.fillStyle=spec.team.primary;ctx.fillRect(36,36,170,74);
 ctx.fillStyle=spec.team.secondary;ctx.fillRect(36,110,170,8);
 ctx.fillStyle=ink(spec.team.primary);ctx.font='900 46px '+COND;ctx.textAlign='center';ctx.fillText('NOW',121,90);
 ctx.font='900 16px '+SANS;ctx.textAlign='left';ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=6;
 ctx.fillText(spec.brand+'  •  CARD '+spec.cardNumber,36,146);
 ctx.restore();
 ctx.save();ctx.textAlign='left';ctx.fillStyle='#fff';
 const headline=(spec.headline||(spec.player.pos==='P'?'Dominant Outing':'Clutch Performance')).toUpperCase();
 fitFont(ctx,headline,W-90,40,18,'900',COND);ctx.fillStyle=spec.team.secondary==='#000000'?'#ffd34d':shade(spec.team.secondary,0.25);ctx.fillText(headline,44,H-170);
 ctx.fillStyle='#fff';fitFont(ctx,spec.player.name.toUpperCase(),W-90,66,26,'900',COND);ctx.fillText(spec.player.name.toUpperCase(),44,H-104);
 fitFont(ctx,posLine(spec),W-90,17,10,'800',SANS);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillText(posLine(spec),44,H-70);
 ctx.restore();
 if(spec.rookie)drawRookieBadge(ctx,W-110,40,64);
 if(spec.relic)drawRelicWindow(ctx,spec,W-170,H-370,120,92);
 if(spec.auto)drawSignature(ctx,spec,W/2,H-240,W*0.66);
 drawSerial(ctx,spec,W-44,H-40,30,'right');
}

function frontKings(ctx,spec,art){
 // Painterly treatment of the artwork.
 const paint=canvas(W,H);const p=paint.getContext('2d');
 p.filter='saturate(1.25) contrast(1.08)';drawCover(p,art,0,0,W,H);p.filter='none';
 painterly(p,W,H);
 ctx.fillStyle='#0d0b08';ctx.fillRect(0,0,W,H);
 const m=46;
 ctx.drawImage(paint,m,m,W-m*2,H-m*2-110,m,m,W-m*2,H-m*2-110);
 // Ornate gold frame.
 const gold=spec.parallel.id==='base'||spec.parallel.id==='gold'||spec.parallel.id==='superfractor'?foilGradient(ctx,0,0,W,H,'gold'):borderFill(ctx,spec,'#c8962e');
 ctx.lineWidth=10;ctx.strokeStyle=gold;ctx.strokeRect(m-10,m-10,W-(m-10)*2,H-(m-10)*2-100);
 ctx.lineWidth=3;ctx.strokeRect(m+4,m+4,W-(m+4)*2,H-(m+4)*2-110);
 [[m-10,m-10],[W-m+10,m-10],[m-10,H-m-100+10],[W-m+10,H-m-100+10]].forEach(([x,y])=>diamond(ctx,x,y,18,gold));
 if(spec.parallel.id!=='base')drawRefractorSheen(ctx,m,m,W-m*2,H-m*2-110,0.12);
 // Black-and-gold nameplate.
 const ny=H-m-96;
 ctx.save();
 ctx.fillStyle='#0b0b0b';roundRect(ctx,m+20,ny,W-(m+20)*2,92,10);ctx.fill();
 ctx.lineWidth=4;ctx.strokeStyle=gold;roundRect(ctx,m+20,ny,W-(m+20)*2,92,10);ctx.stroke();
 ctx.fillStyle=foilGradient(ctx,0,ny,W,40,'gold');ctx.textAlign='center';
 const name=spec.player.name.toUpperCase();
 fitFont(ctx,name,W-(m+50)*2,46,20,'700',SERIF);ctx.fillText(name,W/2,ny+50);
 fitFont(ctx,posLine(spec),W-(m+70)*2,15,9,'800',SANS);ctx.fillText(posLine(spec),W/2,ny+78);
 ctx.font='italic 700 20px '+SERIF;ctx.fillText(spec.set.label,W/2,m+38);
 ctx.restore();
 if(spec.rookie)drawRookieBadge(ctx,W-m-80,m+60,58);
 if(spec.relic)drawRelicWindow(ctx,spec,W-m-150,ny-150,118,92);
 if(spec.auto)drawSignature(ctx,spec,W/2,ny-50,W*0.62);
 drawSerial(ctx,spec,W/2,H-16,24,'center');
}

function frontProspects(ctx,spec,art){
 drawFrameBackground(ctx,spec,'#ffffff');
 const bar=96,m=26;
 ctx.fillStyle=spec.team.primary;ctx.fillRect(m,m,bar,H-m*2);
 drawCover(ctx,art,m+bar,m,W-m*2-bar,H-m*2);
 if(spec.parallel.id!=='base')drawRefractorSheen(ctx,m+bar,m,W-m*2-bar,H-m*2,0.16);
 ctx.fillStyle=spec.team.secondary;ctx.fillRect(m+bar-8,m,8,H-m*2);
 // "1st" badge.
 ctx.save();ctx.beginPath();ctx.arc(m+bar/2,m+60,38,0,Math.PI*2);ctx.fillStyle=foilGradient(ctx,m,m,bar,120,'gold');ctx.fill();
 ctx.fillStyle='#111';ctx.font='900 30px '+SANS;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('1st',m+bar/2,m+62);ctx.restore();
 // Vertical name.
 ctx.save();ctx.translate(m+bar/2+4,H-m-30);ctx.rotate(-Math.PI/2);
 ctx.fillStyle=ink(spec.team.primary);ctx.textAlign='left';ctx.textBaseline='middle';
 fitFont(ctx,spec.player.name.toUpperCase(),H-m*2-180,58,22,'900',COND);ctx.fillText(spec.player.name.toUpperCase(),0,0);
 ctx.restore();
 ctx.save();ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=8;ctx.textAlign='right';
 ctx.font='900 20px '+SANS;ctx.fillText(spec.brand+' '+spec.set.label,W-m-20,m+40);
 fitFont(ctx,posLine(spec),W-m*2-bar-40,17,10,'800',SANS);ctx.fillText(posLine(spec),W-m-20,H-m-24);
 ctx.restore();
 if(spec.rookie)drawRookieBadge(ctx,W-m-84,m+60,62);
 if(spec.relic)drawRelicWindow(ctx,spec,m+bar+24,H-m-190,118,92);
 if(spec.auto)drawSignature(ctx,spec,m+bar+(W-m*2-bar)/2,H-m-110,W*0.6);
 drawSerial(ctx,spec,W-m-20,H-m-60,30,'right');
}

const FRONT={flagship:frontFlagship,chrome:frontChrome,heritage:frontHeritage,now:frontNow,kings:frontKings,prospects:frontProspects};

function roundRect(ctx,x,y,w,h,r){
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function diamond(ctx,x,y,s,fill){ctx.save();ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.restore();}
function addGrain(ctx,amount){
 const img=ctx.getImageData(0,0,W,H),d=img.data;const rng=mulberry32(7);
 for(let i=0;i<d.length;i+=4){const n=(rng()-0.5)*255*amount;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}
 ctx.putImageData(img,0,0);
}
function painterly(p,w,h){
 // Brush-stroke resampling: short strokes oriented along a flow field,
 // sampling the underlying color. Gives a consistent oil-paint feel.
 const src=p.getImageData(0,0,w,h).data;
 const rng=mulberry32(11);
 p.globalAlpha=0.55;p.lineCap='round';
 for(let i=0;i<9000;i++){
  const x=Math.floor(rng()*w),y=Math.floor(rng()*h);
  const k=(y*w+x)*4;
  p.strokeStyle='rgb('+src[k]+','+src[k+1]+','+src[k+2]+')';
  p.lineWidth=2+rng()*5;
  const a=Math.sin(x*0.012)+Math.cos(y*0.01);
  const len=6+rng()*12;
  p.beginPath();p.moveTo(x,y);p.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);p.stroke();
 }
 p.globalAlpha=1;
}

/* ---- procedural artwork (never fails) ---- */

function proceduralArt(spec){
 const c=canvas(768,1024),ctx=c.getContext('2d');
 const w=c.width,h=c.height,rng=mulberry32(spec.seed);
 const sky=ctx.createLinearGradient(0,0,0,h*0.62);
 sky.addColorStop(0,shade(spec.team.primary,-0.55));sky.addColorStop(1,shade(spec.team.primary,0.15));
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 // Stadium lights.
 for(let i=0;i<5;i++){
  const lx=w*(0.1+i*0.2),ly=h*0.08+rng()*30;
  const g=ctx.createRadialGradient(lx,ly,2,lx,ly,180);g.addColorStop(0,'rgba(255,255,240,.9)');g.addColorStop(1,'rgba(255,255,240,0)');
  ctx.fillStyle=g;ctx.fillRect(lx-180,ly-180,360,360);
 }
 // Crowd bokeh.
 for(let i=0;i<260;i++){
  ctx.fillStyle='rgba(255,255,255,'+(0.05+rng()*0.18)+')';
  ctx.beginPath();ctx.arc(rng()*w,h*0.32+rng()*h*0.26,2+rng()*9,0,Math.PI*2);ctx.fill();
 }
 // Field.
 const grass=ctx.createLinearGradient(0,h*0.58,0,h);grass.addColorStop(0,'#2f7d32');grass.addColorStop(1,'#14461a');
 ctx.fillStyle=grass;ctx.fillRect(0,h*0.58,w,h*0.42);
 for(let i=0;i<8;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.04)':'rgba(0,0,0,.05)';ctx.fillRect(0,h*0.58+i*h*0.055,w,h*0.055);}
 ctx.fillStyle='#a8683a';ctx.beginPath();ctx.ellipse(w/2,h*0.9,w*0.55,h*0.12,0,0,Math.PI*2);ctx.fill();
 drawAthlete(ctx,spec,w,h);
 // Rim light + vignette.
 const v=ctx.createRadialGradient(w/2,h*0.5,h*0.25,w/2,h*0.5,h*0.75);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');
 ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
 return c;
}

function drawAthlete(ctx,spec,w,h){
 const pitcher=spec.player.pos==='P';
 const body=spec.team.primary,trim=spec.team.secondary,skin='#8a5a3c',pants='#f1f1ef';
 ctx.save();
 ctx.translate(w*0.5,h*0.86);
 const s=h/1024;
 ctx.scale(s,s);
 ctx.lineCap='round';ctx.lineJoin='round';
 ctx.shadowColor='rgba(255,255,255,.35)';ctx.shadowBlur=18;
 const limb=(pts,width,color)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))ctx.lineTo(p[0],p[1]);ctx.stroke();};
 if(pitcher){
  limb([[-20,-300],[-110,-150],[-150,0]],58,pants);   // drive leg
  limb([[20,-300],[120,-220],[200,-250]],58,pants);   // stride leg
  ctx.fillStyle=body;roundRect(ctx,-70,-560,140,280,50);ctx.fill();
  limb([[50,-520],[150,-600],[230,-700]],40,body);    // throwing arm
  limb([[-50,-520],[-150,-470],[-200,-400]],40,body);
  ctx.fillStyle='#5b3a1e';ctx.beginPath();ctx.arc(-210,-390,34,0,Math.PI*2);ctx.fill(); // glove
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(240,-712,13,0,Math.PI*2);ctx.fill();
 }else{
  limb([[-30,-300],[-120,-150],[-160,0]],58,pants);
  limb([[30,-300],[110,-160],[150,0]],58,pants);
  ctx.fillStyle=body;roundRect(ctx,-75,-570,150,290,50);ctx.fill();
  limb([[-50,-520],[40,-470],[120,-520]],40,body);
  limb([[50,-520],[110,-480],[130,-520]],40,body);
  ctx.strokeStyle='#d9b27c';ctx.lineWidth=20;ctx.beginPath();ctx.moveTo(125,-525);ctx.lineTo(330,-760);ctx.stroke(); // bat
  ctx.lineWidth=30;ctx.beginPath();ctx.moveTo(250,-670);ctx.lineTo(330,-760);ctx.stroke();
 }
 ctx.shadowBlur=0;
 ctx.fillStyle=trim;ctx.fillRect(-75,-300,150,18); // belt
 ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-620,48,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=body;ctx.beginPath();ctx.arc(0,-635,50,Math.PI,0);ctx.fill();ctx.fillRect(-5,-640,80,16); // cap + brim
 ctx.fillStyle=ink(body);ctx.font='900 72px '+SANS;ctx.textAlign='center';ctx.fillText(String(spec.jersey),0,-430);
 ctx.restore();
}

async function loadImage(src){
 const img=new Image();
 img.decoding='async';
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('image_load_failed'));img.src=src;});
 return img;
}

async function fetchGeneratedArt(spec,{timeoutMs=60000,endpoint=ART_ENDPOINT}={}){
 const url=endpoint+encodeURIComponent(spec.artPrompt)+'?width=768&height=1024&nologo=true&model=flux&seed='+(spec.seed%1000000);
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const r=await fetch(url,{signal:ctrl.signal,mode:'cors'});
  if(!r.ok)throw new Error('art_http_'+r.status);
  const blob=await r.blob();
  if(!/^image\//.test(blob.type)||blob.size<10000)throw new Error('art_invalid');
  const objectUrl=URL.createObjectURL(blob);
  try{return await loadImage(objectUrl);}finally{setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);}
 }finally{clearTimeout(timer);}
}

async function resolveArtwork(spec,{photo=null,onStatus=()=>{},timeoutMs,renderReference=null}={}){
 if(photo){
  const url=URL.createObjectURL(photo);
  try{const img=await loadImage(url);return {image:img,source:'upload'};}
  catch{onStatus('Uploaded photo could not be decoded; generating artwork instead…');}
  finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
 }
 try{
  onStatus('Generating card artwork…');
  return {image:await fetchGeneratedArt(spec,{timeoutMs}),source:'ai'};
 }catch(error){
  const painted=proceduralArt(spec);
  if(renderReference){
   // Second artist: the project's own reference-image renderer repaints the
   // procedural layout into realistic artwork.
   try{
    onStatus('Primary image model busy; repainting with the reference renderer…');
    const blob=await new Promise(resolve=>painted.toBlob(resolve,'image/jpeg',0.92));
    const out=await renderReference(blob,spec.artPrompt);
    if(out?.dataURI)return {image:await loadImage(out.dataURI),source:'reference-ai',warning:String(error?.message||error)};
   }catch(refError){
    onStatus('Reference renderer unavailable; using painted studio artwork…');
    return {image:painted,source:'procedural',warning:String(error?.message||error)+' · '+String(refError?.message||refError)};
   }
  }
  onStatus('Image model unavailable; using painted studio artwork…');
  return {image:painted,source:'procedural',warning:String(error?.message||error)};
 }
}

function renderFront(spec,art){
 const c=canvas(),ctx=c.getContext('2d');
 (FRONT[spec.set.id]||frontFlagship)(ctx,spec,art);
 return c.toDataURL('image/jpeg',0.95);
}

/* ---- back ---- */

function teamFromIntelName(name){return findTeam(name);}
function applyIntel(spec,intel){
 if(!intel)return spec;
 const seasons=Array.isArray(intel.seasons)?intel.seasons:[];
 const latest=seasons[seasons.length-1];
 const abbr=latest?.team?teamFromIntelName(latest.team):'';
 if(abbr&&abbr!==spec.team.abbr){spec.team={abbr,...TEAMS[abbr]};}
 const pos=intel.player?.primaryPosition;
 const posAbbr=typeof pos==='string'?pos:(pos?.abbreviation||'');
 if(posAbbr&&!spec.player.teamCard)spec.player.pos=posAbbr.length<=3?posAbbr:(/pitcher/i.test(posAbbr)?'P':spec.player.pos);
 if(intel.player?.fullName&&!spec.player.teamCard)spec.player.name=intel.player.fullName;
 spec.title=cardTitle(spec);
 spec.artPrompt=buildArtPrompt(spec);
 spec.value=valueReport(spec);
 return spec;
}

function statRows(intel){
 const seasons=(Array.isArray(intel?.seasons)?intel.seasons:[]).slice(-6);
 if(!seasons.length)return null;
 const pitching=seasons.some(s=>s.group==='pitching');
 const cols=pitching
  ?[['YEAR','season'],['TEAM','team'],['W','wins'],['L','losses'],['ERA','era'],['SO','strikeOuts'],['SV','saves']]
  :[['YEAR','season'],['TEAM','team'],['G','gamesPlayed'],['H','hits'],['HR','homeRuns'],['RBI','rbi'],['AVG','avg']];
 const rows=seasons.filter(s=>pitching?s.group==='pitching':s.group!=='pitching').map(s=>cols.map(([,k])=>{
  const v=s[k];
  if(k==='team'){const a=findTeam(v);return a||String(v||'').slice(0,4).toUpperCase();}
  return v===undefined||v===null||v===''?'—':String(v);
 }));
 return {cols:cols.map(c=>c[0]),rows};
}

function renderBack(spec,intel=null){
 const c=canvas(),ctx=c.getContext('2d');
 const stock='#e9dcc0',inkc='#1d1a16',prim=spec.team.primary,sec=spec.team.secondary;
 ctx.fillStyle=stock;ctx.fillRect(0,0,W,H);
 addGrain(ctx,0.04);
 ctx.fillStyle=prim;ctx.fillRect(0,0,W,150);
 ctx.fillStyle=sec;ctx.fillRect(0,150,W,10);
 // Card number badge.
 ctx.save();ctx.fillStyle='#fff';roundRect(ctx,28,28,150,94,12);ctx.fill();
 ctx.fillStyle=prim;ctx.textAlign='center';ctx.font='800 14px '+SANS;ctx.fillText('CARD NO.',103,58);
 fitFont(ctx,spec.cardNumber,130,40,14,'900',COND);ctx.fillText(spec.cardNumber,103,104);ctx.restore();
 ctx.save();ctx.fillStyle=ink(prim);ctx.textAlign='left';
 fitFont(ctx,spec.player.name.toUpperCase(),W-240,54,22,'900',COND);ctx.fillText(spec.player.name.toUpperCase(),200,82);
 fitFont(ctx,posLine(spec),W-240,17,10,'800',SANS);ctx.fillText(posLine(spec),200,118);
 ctx.restore();

 const p=intel?.player||{};
 const bio=[
  p.height&&('HT: '+p.height),p.weight&&('WT: '+p.weight),
  p.batSide&&('BATS: '+(p.batSide.description||p.batSide)),p.pitchHand&&('THROWS: '+(p.pitchHand.description||p.pitchHand)),
  p.mlbDebutDate&&('DEBUT: '+p.mlbDebutDate),p.birthDate&&('BORN: '+p.birthDate)
 ].filter(Boolean);
 ctx.fillStyle=inkc;ctx.font='800 17px '+SANS;ctx.textAlign='left';
 let y=200;
 if(bio.length){fitText(ctx,bio.join('   '),40,y,W-80,24,2);y+=58;}

 // Stats table.
 const table=statRows(intel);
 ctx.fillStyle=prim;ctx.fillRect(30,y,W-60,40);
 ctx.fillStyle=ink(prim);ctx.font='900 18px '+SANS;ctx.fillText(table?(table.cols.includes('ERA')?'MAJOR LEAGUE PITCHING RECORD':'MAJOR LEAGUE BATTING RECORD'):'CARD PROFILE',44,y+27);
 y+=40;
 if(table){
  const colW=(W-80)/table.cols.length;
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.fillRect(30,y,W-60,36+table.rows.length*34);
  ctx.fillStyle=inkc;ctx.font='900 15px '+SANS;ctx.textAlign='center';
  table.cols.forEach((h,i)=>ctx.fillText(h,40+colW*i+colW/2,y+25));
  ctx.font='700 16px '+SANS;
  table.rows.forEach((row,r)=>{
   if(r%2===0){ctx.fillStyle='rgba(0,0,0,.05)';ctx.fillRect(30,y+36+r*34,W-60,34);}
   ctx.fillStyle=inkc;row.forEach((v,i)=>ctx.fillText(v,40+colW*i+colW/2,y+60+r*34));
  });
  y+=36+table.rows.length*34+30;
 }else{
  // No verified stats: print only facts the build itself knows. Never invent numbers.
  const facts=[
   ['TEAM',spec.team.name||'—'],
   ['POSITION',posLine(spec).split('  •  ').pop()||'—'],
   ['SET',spec.year+' '+spec.brand+' '+titleCase(spec.set.label)],
   ['CARD NO.',spec.cardNumber],
   ['EDITION',spec.parallel.printRun?(spec.parallel.printRun===1?'One of one':'Numbered to '+spec.parallel.printRun):'Unnumbered base issue'],
   ['FINISH',spec.parallel.name]
  ];
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.fillRect(30,y,W-60,facts.length*38+20);
  ctx.textAlign='left';
  facts.forEach(([k,val],i)=>{
   if(i%2===0){ctx.fillStyle='rgba(0,0,0,.05)';ctx.fillRect(30,y+10+i*38,W-60,38);}
   ctx.fillStyle=prim;ctx.font='900 15px '+SANS;ctx.fillText(k,48,y+35+i*38);
   ctx.fillStyle=inkc;fitFont(ctx,val,W-260,18,11,'700',SANS);ctx.fillText(val,210,y+35+i*38);
  });
  y+=facts.length*38+20;
  ctx.fillStyle='rgba(29,26,22,.6)';ctx.font='italic 600 13px '+SERIF;
  ctx.fillText('Official season statistics print automatically when verified stats are reachable.',40,y+22);
  y+=56;
 }

 // Highlight blurb.
 ctx.textAlign='left';ctx.fillStyle=prim;ctx.font='900 20px '+SANS;ctx.fillText(spec.headline?'HIGHLIGHT':'CARD NOTE',40,y);
 ctx.fillStyle=inkc;ctx.font='600 17px '+SERIF;
 const note=spec.headline
  ?spec.player.name+' — '+spec.headline+'. Commemorated in the '+spec.year+' '+spec.brand+' '+titleCase(spec.set.label)+' release.'
  :'Part of the '+spec.year+' '+spec.brand+' '+titleCase(spec.set.label)+' release, featuring '+spec.player.name+(spec.team.name?' of the '+spec.team.name:'')+'.';
 y=fitText(ctx,note,40,y+30,W-80,24,4)+20;

 // Collector panel.
 const v=spec.value;
 const panelY=Math.max(y,H-300);
 ctx.fillStyle='#fff';roundRect(ctx,30,panelY,W-60,190,14);ctx.fill();
 ctx.lineWidth=3;ctx.strokeStyle=prim;ctx.stroke();
 ctx.fillStyle=prim;ctx.font='900 18px '+SANS;ctx.fillText('COLLECTOR DETAILS',50,panelY+34);
 const rows=[
  ['SET',spec.year+' '+spec.brand+' '+titleCase(spec.set.label)],
  ['PARALLEL',spec.parallel.name+(spec.parallel.printRun?' — '+v.serialText:'')],
  ['HITS',[spec.rookie&&'Rookie',spec.auto&&'Autograph',spec.relic&&'Relic'].filter(Boolean).join(' · ')||'—'],
  ['RARITY',v.tier+' · Value Index '+v.index+'/100 · Odds '+v.oddsText]
 ];
 ctx.font='700 16px '+SANS;ctx.fillStyle=inkc;
 rows.forEach(([k,val],i)=>{ctx.font='900 14px '+SANS;ctx.fillText(k,50,panelY+66+i*32);ctx.font='700 16px '+SANS;fitFont(ctx,val,W-230,16,11,'700',SANS);ctx.fillText(val,170,panelY+66+i*32);});

 ctx.fillStyle='#121820';ctx.fillRect(0,H-64,W,64);
 ctx.fillStyle='#fff';ctx.font='700 13px '+SANS;ctx.textAlign='center';
 ctx.fillText('Fantasy Craft Product · Infinity® · Produced by Goudey Tradition Trading Card Company LLC',W/2,H-26,W-40);
 return c.toDataURL('image/jpeg',0.95);
}

function fitText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){
 const words=String(text||'').split(/\s+/);let line='',lines=[];
 for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
 if(line)lines.push(line);lines=lines.slice(0,maxLines);
 lines.forEach((ln,i)=>ctx.fillText(ln,x,y+i*lineHeight));
 return y+lines.length*lineHeight;
}

/**
 * Full pipeline. Always resolves with a finished front + back.
 * options: {text, photo, seed, brand, fetchIntel(name)->Promise<intel|null>, onStatus(msg)}
 */
async function build(options={}){
 if(!hasDOM)throw new Error('auto_card_requires_browser');
 const onStatus=options.onStatus||(()=>{});
 onStatus('Reading your request…');
 const intent=parseIntent(options.text||'');
 const spec=buildSpec(intent,{seed:options.seed,brand:options.brand,hasPhoto:Boolean(options.photo)});
 let intel=null;
 if(options.fetchIntel&&!spec.player.teamCard){
  onStatus('Pulling verified stats for '+spec.player.name+'…');
  try{intel=await options.fetchIntel(spec.player.name);}catch{intel=null;}
  applyIntel(spec,intel);
 }
 const art=await resolveArtwork(spec,{photo:options.photo,onStatus,timeoutMs:options.artTimeoutMs,renderReference:options.renderReference});
 onStatus('Composing front, foil numbering and back…');
 let front;
 try{front=renderFront(spec,art.image);}
 catch(error){
  // Tainted or broken artwork: repaint procedurally so the build still finishes.
  art.warning=String(error?.message||error);art.source='procedural';
  front=renderFront(spec,proceduralArt(spec));
 }
 const back=renderBack(spec,intel);
 return {spec,intent,intel,front,back,artSource:art.source,warning:art.warning||''};
}

return {
 VERSION,TEAMS,PLAYERS,SETS,PARALLELS,
 normalize,mulberry32,parseIntent,buildSpec,buildArtPrompt,valueReport,cardTitle,findTeam,initials,applyIntel,statRows,
 build,renderFront,renderBack,proceduralArt,fetchGeneratedArt,resolveArtwork
};
});
