(function(global){
'use strict';

const defaults={
 detected:{title:'',subjectType:'',brand:'',logo:'',era:'',date:'',keywords:[]},
 selections:{
  border:'white',
  style:'flagship',
  finish:'paper',
  signature:'none',
  oneOfOne:true,
  useLogo:true,
  useBrand:true,
  showName:true,
  showContext:true,
  includeDate:true,
  buildBack:true
 },
 identity:{
  title:'',
  brand:'',
  logoText:'',
  context:'',
  series:'',
  dateText:'',
  cardNumber:''
 },
 back:{format:'auto',data:null}
};

const state=JSON.parse(JSON.stringify(defaults));

function reset(){
 const fresh=JSON.parse(JSON.stringify(defaults));
 Object.keys(state).forEach(k=>delete state[k]);
 Object.assign(state,fresh);
 return state;
}
function setSelection(key,value){ if(key in state.selections) state.selections[key]=value; return state; }
function setIdentity(key,value){ if(key in state.identity) state.identity[key]=String(value||'').trim(); return state; }
function applyDetected(data={}){
 state.detected={...state.detected,...data};
 if(!state.identity.title&&data.title)state.identity.title=data.title;
 if(!state.identity.brand&&data.brand)state.identity.brand=data.brand;
 if(!state.identity.logoText&&data.logo)state.identity.logoText=data.logo;
 if(!state.identity.dateText&&data.date)state.identity.dateText=data.date;
 return state;
}
function clone(){return JSON.parse(JSON.stringify(state));}

global.OracleCardState={state,defaults,reset,setSelection,setIdentity,applyDetected,clone};
})(window);
