/* Wandura Toolkit: pure helpers for share links, the deadline countdown and model compare. Browser and Node (tests). */
(function(root,factory){var m=factory();if(typeof module==="object"&&module.exports)module.exports=m;if(root)root.WTK_F=m;})(typeof window!=="undefined"?window:this,function(){
"use strict";
/* ---------- share state: compact JSON -> base64url ---------- */
function b64urlEncode(str){
  var bytes=new TextEncoder().encode(str);var bin="";
  for(var i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function b64urlDecode(s){
  s=String(s).replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";
  var bin=atob(s);var bytes=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function encodeState(obj){return b64urlEncode(JSON.stringify(obj));}
function decodeState(s){
  try{var o=JSON.parse(b64urlDecode(s));if(!o||typeof o!=="object"||(o.t!=="p"&&o.t!=="k"))return null;return o;}catch(e){return null;}
}
var MAX_HASH=1200;
/* Builds "#p=..." or "#k=...". If the hash is too long, the pasted brief (br) is dropped and the fields are kept. */
function shareHash(state,max){
  max=max||MAX_HASH;var pre="#"+state.t+"=";
  var h=pre+encodeState(state);
  if(h.length>max&&state.br!=null){var s2={};for(var k in state)if(k!=="br")s2[k]=state[k];h=pre+encodeState(s2);return {hash:h,droppedBrief:true};}
  return {hash:h,droppedBrief:false};
}
function readHash(hash){
  var m=/^#(p|k)=([A-Za-z0-9_-]+)$/.exec(String(hash||""));if(!m)return null;
  var o=decodeState(m[2]);return o&&o.t===m[1]?o:null;
}
/* ---------- countdown ---------- */
function formatCountdown(ms){
  if(!(ms>0))return "Closed";
  var mins=Math.floor(ms/60000),d=Math.floor(mins/1440),h=Math.floor((mins%1440)/60),mi=mins%60;
  if(d>0)return d+"d "+h+"h "+mi+"m";
  if(h>0)return h+"h "+mi+"m";
  return mi+"m "+(Math.floor(ms/1000)%60)+"s";
}
function countdown(iso,nowMs){
  if(!iso)return null;var t=Date.parse(iso);if(isNaN(t))return null;
  var ms=t-nowMs;return {closed:ms<=0,ms:ms,text:formatCountdown(ms)};
}
/* ---------- model compare ---------- */
/* items: [{name, setting, credits (null = not published), seconds, resolution}] */
function compare(items,balance,creditUsd){
  var EPS=1e-9;balance=Math.max(0,Math.floor(+balance||0));
  var rows=items.map(function(it){
    var priced=typeof it.credits==="number"&&it.credits>0;
    var r={name:it.name,setting:it.setting,credits:priced?it.credits:null,seconds:it.seconds||null,resolution:it.resolution||null,priced:priced};
    r.usd=priced?Math.round(it.credits*creditUsd*100)/100:null;
    r.perSec=priced&&r.seconds?it.credits/r.seconds:null;
    r.usdPerSec=r.perSec!=null?r.perSec*creditUsd:null;
    r.clips=priced?Math.floor(balance/it.credits):null;
    return r;
  });
  function best(key,dir){
    var c=rows.map(function(r,i){return {i:i,v:r[key]};}).filter(function(x){return x.v!=null;});
    if(c.length<2)return [];
    var b=c.reduce(function(a,x){return dir<0?Math.min(a,x.v):Math.max(a,x.v);},dir<0?Infinity:-Infinity);
    if(dir>0&&b<=0)return [];
    var w=c.filter(function(x){return Math.abs(x.v-b)<EPS;}).map(function(x){return x.i;});
    return w.length===c.length?[]:w;
  }
  return {rows:rows,cheapestPerSec:best("perSec",-1),mostClips:best("clips",1)};
}
return {encodeState:encodeState,decodeState:decodeState,shareHash:shareHash,readHash:readHash,MAX_HASH:MAX_HASH,formatCountdown:formatCountdown,countdown:countdown,compare:compare};
});
