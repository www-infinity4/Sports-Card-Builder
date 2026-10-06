(function(global){
'use strict';

const VERSION='2026.10.05.1';

const CONTROL_VOCAB={
  topps:['topps','tops','top','topp'],
  donruss:['donruss','donrus','don russ','donruss'],
  fleer:['fleer','flear','flier'],
  flagship:['flagship','flag ship','flagshp'],
  upperdeck:['upper deck','upperdeck','upper dek','upper dec'],
  white:['white','whte','wite'],
  black:['black','blak'],
  chrome:['chrome','crome'],
  hologram:['hologram','holo','holographic'],
  insert:['insert','insert series'],
  paper:['paper','card stock','stock'],
  matte:['matte','mat'],
  gloss:['gloss','glossy'],
  foil:['foil','foyl'],
  refractor:['refractor','refracter','refr'],
  signature:['signature','signed','auto','autograph'],
  oneofone:['1/1','one of one','one-of-one','oneofone']
};

function lower(v){return String(v||'').toLowerCase();}
function cleanSpace(v){return String(v||'').replace(/\s+/g,' ').trim();}
function distance(a,b){
  a=lower(a);b=lower(b);
  const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++)dp[i][0]=i;
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
    const cost=a[i-1]===b[j-1]?0:1;
    dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
  }
  return dp[m][n];
}
function bestControlToken(token){
  const t=lower(token).replace(/[^a-z0-9/]+/g,'');
  if(!t||t.length<3)return null;
  let best=null;
  for(const [canonical,aliases] of Object.entries(CONTROL_VOCAB)){
    for(const alias of aliases){
      const a=lower(alias).replace(/[^a-z0-9/]+/g,'');
      const d=distance(t,a);
      const max=Math.max(t.length,a.length);
      const score=1-(d/max);
      if(score>=.72&&(!best||score>best.score))best={canonical,score,alias};
    }
  }
  return best;
}
function repairLocal(text=''){
  const raw=String(text||'');
  if(!raw.trim())return {original:'',normalized:'',repairs:[],confidence:1};
  const parts=raw.split(/(\s+|[^A-Za-z0-9/]+)/);
  const repairs=[];
  const out=parts.map(part=>{
    if(!/[A-Za-z0-9]/.test(part))return part;
    const hit=bestControlToken(part);
    if(!hit||hit.score<.8)return part;
    const current=lower(part).replace(/[^a-z0-9/]+/g,'');
    if(current===lower(hit.canonical).replace(/[^a-z0-9/]+/g,''))return part;
    repairs.push({from:part,to:hit.canonical,score:Number(hit.score.toFixed(3))});
    return hit.canonical;
  }).join('');
  return {
    original:raw,
    normalized:cleanSpace(out),
    repairs,
    confidence:repairs.length?Math.min(...repairs.map(r=>r.score)):1
  };
}
function safeJson(text){
  const raw=String(text||'').trim();
  try{return JSON.parse(raw)}catch{}
  const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch{}}
  return null;
}
async function repairWithGPT({text,state={},service='',fetcher=fetch,timeoutMs=7000}={}){
  const local=repairLocal(text);
  if(!local.normalized)return {...local,gpt:null,final:''};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const input=`You are an intent-repair compiler for a collectible-card builder.

RAW USER TEXT:
${text}

LOCALLY NORMALIZED TEXT:
${local.normalized}

CURRENT UI LOCKS:
${JSON.stringify({selections:state.selections||{},identity:state.identity||{}})}

Return ONLY JSON:
{
 "normalizedRequest":"",
 "meaning":"",
 "explicit":{
   "style":"",
   "border":"",
   "finish":"",
   "year":"",
   "signature":null,
   "oneOfOne":null
 },
 "unresolved":[],
 "confidence":0.0
}

Rules:
- Recover intended instructions from typos, speech-to-text errors, fragments, and malformed grammar.
- Treat nearby card vocabulary and the current UI state as the grammar.
- UI selections are LOCKED unless the user's text explicitly overrides them.
- Never invent a player, actor, person, team, movie, brand, statistic, date, or factual identity.
- Do not change a proper name merely because it resembles another word.
- If a fragment could mean multiple things, preserve it in unresolved instead of guessing.
- Correct syntax/wording only when the intended operation is recoverable.
- normalizedRequest must stay faithful to the user and may be more grammatical, but must not add facts.
- confidence is 0 to 1.`;
    const r=await fetcher(service+'/v1/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({input,context:{application:'Oracle Card Studio',task:'intent-repair-compiler',version:VERSION}}),
      signal:controller.signal
    });
    const d=await r.json().catch(()=>({}));
    const parsed=r.ok&&d.ok?safeJson(String(d.output||d.output_text||d.answer||'')):null;
    if(!parsed)return {...local,gpt:null,final:local.normalized};
    const normalized=cleanSpace(parsed.normalizedRequest||local.normalized);
    return {
      ...local,
      gpt:parsed,
      final:normalized||local.normalized,
      confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||local.confidence))
    };
  }catch{
    return {...local,gpt:null,final:local.normalized};
  }finally{clearTimeout(timer)}
}
function summarize(result){
  if(!result)return '';
  const bits=[];
  if(result.repairs?.length)bits.push(result.repairs.map(r=>r.from+'→'+r.to).join(', '));
  if(result.gpt?.meaning)bits.push(result.gpt.meaning);
  if(result.gpt?.unresolved?.length)bits.push('unresolved: '+result.gpt.unresolved.join(', '));
  return bits.join(' · ');
}

global.OracleIntentRepair={VERSION,CONTROL_VOCAB,distance,repairLocal,repairWithGPT,summarize};
})(window);
