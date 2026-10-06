(function(global){
'use strict';

const STOP=new Set(['the','a','an','of','and','for','to','in','on','at','with']);

function words(title){
 return String(title||'').trim().split(/\s+/).map(x=>x.replace(/[^A-Za-z0-9]/g,'')).filter(Boolean);
}
function prefix(title){
 const w=words(title);
 if(!w.length)return 'CARD';
 if(w.length===1)return w[0].slice(0,3).toUpperCase();
 const meaningful=w.filter(x=>!STOP.has(x.toLowerCase()));
 const source=meaningful.length?meaningful:w;
 return source.map(x=>x[0]).join('').slice(0,5).toUpperCase();
}
function number(title,index=1){return prefix(title)+'-'+Math.max(1,Number(index)||1);}

global.OracleCardNumbering={prefix,number};
})(window);
