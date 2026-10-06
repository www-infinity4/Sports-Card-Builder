(function(global){
'use strict';

function formatFor(state,intel){
 const requested=state?.back?.format||'auto';
 if(requested!=='auto')return requested;
 const type=state?.detected?.subjectType||'';
 if(/band|music|artist/.test(type))return 'discography';
 if(intel?.seasons?.length)return 'stats';
 return 'bio';
}
function buildData(state,intel,plan){
 const identity=state?.identity||{};
 const player=intel?.player||{};
 const seasons=intel?.seasons||[];
 const highlights=intel?.highlights||[];
 const title=identity.title||state?.detected?.title||player.fullName||'Featured Card';
 return {
  format:formatFor(state,intel),
  title,
  brand:identity.brand||'',
  series:identity.series||'',
  dateText:identity.dateText||'',
  cardNumber:identity.cardNumber||'',
  category:player.primaryPosition||state?.detected?.subjectType||'',
  bio:'',
  highlights:(plan?.suggestions||[]).slice(0,4),
  seasons:seasons.slice(-8),
  selected:highlights[0]||seasons.slice(-1)[0]||null
 };
}

global.OracleCardBack={formatFor,buildData};
})(window);
