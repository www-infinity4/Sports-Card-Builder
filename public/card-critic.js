(function(global){
'use strict';

function inspectSpec(state,prompt){
 const s=state?.selections||{}, id=state?.identity||{}, p=String(prompt||'').toLowerCase();
 const errors=[],warnings=[];
 if(!/full sharp rectangular card perimeter|full card perimeter|sharp rectangular/.test(p))errors.push('perimeter_not_locked');
 if(s.border==='white'&&!p.includes('white'))errors.push('white_border_missing');
 if(s.border==='black'&&!p.includes('black'))errors.push('black_border_missing');
 if(s.oneOfOne&&!p.includes('1/1'))warnings.push('one_of_one_not_reserved');
 if(id.title&&!p.includes(id.title.toLowerCase()))warnings.push('title_not_explicit');
 if(/biography paragraph|article-style body copy/.test(p)===false)warnings.push('front_text_density_not_explicit');
 return {ok:errors.length===0,errors,warnings};
}

global.OracleCardCritic={inspectSpec};
})(window);
