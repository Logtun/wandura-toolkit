(function(){
"use strict";
var D=window.WTK_DATA;
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
function el(tag,attrs,kids){var e=document.createElement(tag);if(attrs){for(var k in attrs){if(k==="text")e.textContent=attrs[k];else if(k==="html")e.innerHTML=attrs[k];else if(k==="class")e.className=attrs[k];else e.setAttribute(k,attrs[k]);}}(kids||[]).forEach(function(c){if(c!=null)e.appendChild(typeof c==="string"?document.createTextNode(c):c);});return e;}
function fmt(n){return Math.round(n).toLocaleString("en-US");}
function usd(n){return "$"+(n*D.credit_usd).toFixed(2);}
function niceDate(iso){var p=iso.split("-");var m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+p[1]-1];return (+p[2])+" "+m+" "+p[0];}
var NP="price shown on Generate";
var toastT;function toast(t){var e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(toastT);toastT=setTimeout(function(){e.classList.remove("on");},1600);}
function copyText(t){
  function fallback(){var ta=el("textarea",{"aria-hidden":"true"});ta.value=t;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast("Copied");}catch(e){toast("Copy failed");}document.body.removeChild(ta);}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast("Copied");},fallback);}else fallback();
}

/* ---------- theme ---------- */
var root=document.documentElement;
function setTheme(t){root.setAttribute("data-theme",t);var b=$("#themeBtn");var light=t==="light";b.setAttribute("aria-pressed",light?"true":"false");b.setAttribute("aria-label",light?"Switch to dark mode":"Switch to light mode");$(".theme-label",b).textContent=light?"Dark":"Light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",light?"#f6f4f7":"#0a0a0a");try{localStorage.setItem("wtk-theme",t);}catch(e){}}
var saved=null;try{saved=localStorage.getItem("wtk-theme");}catch(e){}
setTheme(saved==="light"?"light":"dark");
$("#themeBtn").addEventListener("click",function(){setTheme(root.getAttribute("data-theme")==="light"?"dark":"light");});

/* ---------- tabs ---------- */
var tabs=$$('[role="tab"]');
function showTab(id){tabs.forEach(function(t){var on=t.id===id;t.setAttribute("aria-selected",on?"true":"false");t.tabIndex=on?0:-1;$("#"+t.getAttribute("aria-controls")).hidden=!on;});try{history.replaceState(null,"",id==="tab-kit"?"#kit":"#planner");}catch(e){}}
tabs.forEach(function(t,i){t.addEventListener("click",function(){showTab(t.id);});t.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key==="ArrowLeft"){var n=tabs[(i+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length];n.focus();showTab(n.id);}});});
if(location.hash==="#kit")showTab("tab-kit");

/* ---------- catalog ---------- */
var CAT=[];var BYNAME={};
function addEntry(e){var m=BYNAME[e.group];if(!m){m={name:e.group,kind:e.kind,settings:[]};BYNAME[e.group]=m;CAT.push(m);}m.settings.push(e);}
D.video.forEach(addEntry);D.image.forEach(addEntry);D.audio.forEach(addEntry);
D.unpublished.forEach(function(u){var m={name:u.model,kind:u.kind,unpublished:true,note:u.note,source:u.source,settings:[{setting:"Any setting",credits:null,source:u.source}]};BYNAME[u.model]=m;CAT.push(m);});
var KINDLABEL={video:"Video",image:"Image",audio:"Audio and voice"};

/* ---------- planner ---------- */
var PLANS=[{id:"free",label:"Free",credits:D.free.credits,sub:fmt(D.free.credits)+" to start"}].concat(D.plans.map(function(p){return {id:p.name.toLowerCase(),label:p.name,credits:p.credits,usd:p.usd_per_month,sub:"$"+p.usd_per_month+"/mo · "+fmt(p.credits)};})).concat([{id:"custom",label:"My balance",sub:"type it below"}]);
var plan="basic";
var seg=$("#planSeg");
PLANS.forEach(function(p){var b=el("button",{type:"button",role:"radio","aria-checked":p.id===plan?"true":"false","data-plan":p.id},[p.label,el("small",{text:p.sub})]);b.addEventListener("click",function(){choosePlan(p.id);});seg.appendChild(b);});
var packSel=$("#pack");packSel.appendChild(el("option",{value:"0",text:"No pack"}));
D.packs.forEach(function(p){packSel.appendChild(el("option",{value:String(p.credits),text:p.name+": +"+fmt(p.credits)+" credits ($"+p.usd+")"}));});
function choosePlan(id){plan=id;$$("button",seg).forEach(function(b){b.setAttribute("aria-checked",b.getAttribute("data-plan")===id?"true":"false");});var p=PLANS.filter(function(x){return x.id===id;})[0];if(p.credits!=null)$("#balance").value=p.credits;else $("#balance").focus();update();}
$("#balance").addEventListener("input",function(){var v=+this.value;var m=PLANS.filter(function(x){return x.credits===v;})[0];plan=m?m.id:"custom";$$("button",seg).forEach(function(b){b.setAttribute("aria-checked",b.getAttribute("data-plan")===plan?"true":"false");});update();});
packSel.addEventListener("change",update);
function balance(){var b=Math.max(0,Math.floor(+$("#balance").value||0));return b+(+packSel.value||0);}

var shots=[];
function modelOptions(sel,cur){
  ["video","image","audio"].forEach(function(k){var g=el("optgroup",{label:KINDLABEL[k]});CAT.filter(function(m){return m.kind===k;}).forEach(function(m){var o=el("option",{value:m.name,text:m.name+(m.unpublished?" (price not published)":"")});if(m.name===cur)o.selected=true;g.appendChild(o);});sel.appendChild(g);});
}
function settingLabel(s){return s.credits==null?s.setting:s.setting+" · "+fmt(s.credits)+" cr";}
function renderShots(){
  var box=$("#shots");box.innerHTML="";
  if(!shots.length){box.appendChild(el("p",{class:"empty",text:"No shots yet. Add one, or start from a preset above."}));}
  shots.forEach(function(s,i){
    var m=BYNAME[s.model];
    var ms=el("select",{"aria-label":"Model for shot "+(i+1)});modelOptions(ms,s.model);
    var ss=el("select",{"aria-label":"Setting for shot "+(i+1)});m.settings.forEach(function(st,j){var o=el("option",{value:String(j),text:settingLabel(st)});if(j===s.setting)o.selected=true;ss.appendChild(o);});
    var cn=el("input",{type:"number",min:"1",step:"1",inputmode:"numeric",value:String(s.count),"aria-label":"How many for shot "+(i+1)});
    var rm=el("button",{type:"button",class:"icon-btn","aria-label":"Remove shot "+(i+1),text:"×"});
    var st=m.settings[s.setting];
    var costEl=el("div",{class:"cost"});
    if(st.credits==null){costEl.appendChild(el("span",{class:"np",text:NP}));costEl.appendChild(el("span",{text:"not counted in the total"}));}
    else{costEl.appendChild(el("span",{text:fmt(st.credits)+" credits each"}));costEl.appendChild(el("b",{text:fmt(st.credits*s.count)+" credits"}));}
    var row=el("div",{class:"shot"},[
      el("label",{class:"field f-model"},[el("span",{text:"Model"}),ms]),
      el("label",{class:"field f-set"},[el("span",{text:"Setting"}),ss]),
      el("label",{class:"field"},[el("span",{text:"Count"}),cn]),
      rm,costEl]);
    ms.addEventListener("change",function(){s.model=ms.value;s.setting=0;renderShots();update();});
    ss.addEventListener("change",function(){s.setting=+ss.value;renderShots();update();});
    cn.addEventListener("input",function(){s.count=Math.max(1,Math.floor(+cn.value||1));var c=$(".cost",row);var st2=BYNAME[s.model].settings[s.setting];if(st2.credits!=null){c.lastChild.textContent=fmt(st2.credits*s.count)+" credits";}update();});
    rm.addEventListener("click",function(){shots.splice(i,1);renderShots();update();});
    box.appendChild(row);
  });
}
function findSetting(model,label){var m=BYNAME[model];for(var j=0;j<m.settings.length;j++)if(m.settings[j].setting===label)return j;return 0;}
var PRESETS={
  film:[{model:"Seedance 2.0",setting:"8s · 720p · 16:9 (default)",count:4},{model:"Nano Banana Pro",setting:"1K",count:3}],
  budget:[{model:"Kling 3.0",setting:"5s · 16:9 (default)",count:6},{model:"Nano Banana 2",setting:"1K",count:3}],
  clear:[]
};
$$("[data-preset]").forEach(function(b){b.addEventListener("click",function(){shots=PRESETS[b.getAttribute("data-preset")].map(function(p){return {model:p.model,setting:findSetting(p.model,p.setting),count:p.count};});renderShots();update();toast(b.textContent);});});
$("#addShot").addEventListener("click",function(){shots.push({model:"Seedance 2.0",setting:0,count:1});renderShots();update();var r=$$(".shot");if(r.length)r[r.length-1].querySelector("select").focus();});

var coverKind="video";
$$("#kindSeg button").forEach(function(b){b.addEventListener("click",function(){coverKind=b.getAttribute("data-kind");$$("#kindSeg button").forEach(function(x){x.setAttribute("aria-checked",x===b?"true":"false");});renderCover();});});
function renderCover(){
  var bal=balance();var box=$("#cover");box.innerHTML="";
  var unit=coverKind==="video"?"clips":coverKind==="image"?"images":"runs";
  $("#coverHint").textContent=fmt(bal)+" credits, spent on one model at its default or cheapest published setting.";
  var list=CAT.filter(function(m){return m.kind===coverKind;}).map(function(m){
    var pub=m.settings.filter(function(s){return s.credits!=null;});
    var def=pub[0];return {m:m,s:def};
  });
  list.sort(function(a,b){if(!a.s)return 1;if(!b.s)return -1;return Math.floor(bal/b.s.credits)-Math.floor(bal/a.s.credits);});
  list.forEach(function(x){
    var card=el("div",{class:"cv"+(x.s?"":" np")});
    card.appendChild(el("span",{class:"cv-m",text:x.m.name}));
    if(x.s){card.appendChild(el("span",{class:"cv-s",text:x.s.setting+" · "+fmt(x.s.credits)+" credits"}));card.appendChild(el("span",{class:"cv-n"},[fmt(Math.floor(bal/x.s.credits)),el("small",{text:unit})]));}
    else{var extra="";if(x.m.name==="GPT Image 2"){extra=" Pricing page: Basic covers up to "+D.plan_coverage_stated.Basic.gptimage2+", Growth up to "+D.plan_coverage_stated.Growth.gptimage2+".";}
      card.appendChild(el("span",{class:"cv-s",text:(x.m.name==="GPT Image 2"?"Published range: 3 to 90 credits, by quality.":"No published credit price.")+extra}));card.appendChild(el("span",{class:"cv-n",text:NP}));}
    box.appendChild(card);
  });
}
function update(){
  var bal=balance();var total=0;var np=[];
  shots.forEach(function(s){var st=BYNAME[s.model].settings[s.setting];if(st.credits==null){if(np.indexOf(s.model)<0)np.push(s.model);}else total+=st.credits*s.count;});
  $("#sTotal").textContent=fmt(total);$("#sTotalUsd").textContent="credits · about "+usd(total);
  var left=bal-total;var le=$("#sLeft");le.textContent=fmt(left);le.classList.toggle("neg",left<0);
  $("#sLeftNote").textContent=left<0?"short by "+fmt(-left)+" credits":"of "+fmt(bal)+" credits";
  var pct=bal>0?Math.min(100,total/bal*100):(total>0?100:0);$("#meterBar").style.width=pct+"%";$(".meter").classList.toggle("over",left<0);
  var n=$("#unpubNote");if(np.length){n.hidden=false;n.textContent=np.join(", ")+": "+NP+". Not counted in the total, so check the Generate button before you spend.";}else n.hidden=true;
  var p=PLANS.filter(function(x){return x.id===plan;})[0];
  var hint="";
  if(plan==="basic"||plan==="growth")hint=p.label+": $"+p.usd+"/month for "+fmt(p.credits)+" credits every month. Plan credits refresh each cycle, no rollover.";
  else if(plan==="free")hint="New accounts start with "+fmt(D.free.credits)+" free credits.";
  else hint="Using the balance you typed.";
  if(+packSel.value)hint+=" Pack credits need an active plan, last 90 days and are used first.";
  $("#planHint").textContent=hint;
  renderCover();
}

/* price table */
function renderPrices(){
  var t=el("table",{class:"ptable"});var thead=el("thead",{},[el("tr",{},[el("th",{text:"Model and setting"}),el("th",{text:"Credits"}),el("th",{text:"Source"})])]);t.appendChild(thead);var tb=el("tbody");
  function src(u){return el("a",{href:u,target:"_blank",rel:"noopener",text:u.replace("https://www.wandura.ai","")||"/"});}
  tb.appendChild(el("tr",{class:"grp"},[el("td",{colspan:"3",text:"Plans and packs"})]));
  D.plans.forEach(function(p){tb.appendChild(el("tr",{},[el("td",{text:p.name+" plan, $"+p.usd_per_month+"/month"}),el("td",{class:"n",text:fmt(p.credits)}),el("td",{},[src(p.source)])]));});
  D.packs.forEach(function(p){tb.appendChild(el("tr",{},[el("td",{text:p.name+", $"+p.usd+" one-time"}),el("td",{class:"n",text:fmt(p.credits)}),el("td",{},[src(p.source)])]));});
  tb.appendChild(el("tr",{},[el("td",{text:"Free start"}),el("td",{class:"n",text:fmt(D.free.credits)}),el("td",{},[src(D.free.source)])]));
  ["video","image","audio"].forEach(function(k){
    tb.appendChild(el("tr",{class:"grp"},[el("td",{colspan:"3",text:KINDLABEL[k]})]));
    CAT.filter(function(m){return m.kind===k;}).forEach(function(m){m.settings.forEach(function(s){
      tb.appendChild(el("tr",{},[el("td",{text:m.name+" · "+s.setting}),el("td",{class:"n",text:s.credits==null?NP:fmt(s.credits)}),el("td",{},[src(s.source)])]));});});
  });
  tb.appendChild(el("tr",{class:"grp"},[el("td",{colspan:"3",text:"Published per-second rates"})]));
  D.per_second_rates.forEach(function(r){tb.appendChild(el("tr",{},[el("td",{text:r.model+" · per second"}),el("td",{class:"n",text:String(r.credits_per_second)}),el("td",{},[src(r.source)])]));});
  t.appendChild(tb);
  var box=$("#priceTable");box.appendChild(el("p",{class:"hint",text:"1 credit = $0.01. Each price is quoted from the linked wandura.ai page. Settings not listed here show their price on the Generate button."}));box.appendChild(t);
}
var stamp="Prices read from wandura.ai on "+niceDate(D.read);
$("#stamp1").textContent=stamp;$("#stamp2").textContent=stamp+". Brief read the same day.";

/* ---------- challenge kit ---------- */
var C=D.challenge;
var CTRL=C.cinema_controls;
function has(ctrl,label){return CTRL[ctrl].options.some(function(o){return o.label===label;});}
var G={
 horror:{label:"Horror",studio:"Horror",era:"1990s",body:"35mm Film",lens:"Halation Vintage",n:6,drop:[1,4,3],long:[5,3],mood:"cold blue moonlight, deep shadows, quiet dread",
  d:{title:"The Knock",lead:"Mara",look:"a woman in her early 30s, shoulder-length black hair, oversized grey knit cardigan over a white T-shirt, bare feet, thin silver ring on her left hand",setting:"a small ground-floor apartment at 3 a.m., one lamp on, rain on the windows",hook:"three slow knocks on the front door"},
  s:[
   {beat:"The silence",type:"Wide shot",move:"Static shot",focal:"35mm",ap:"f/11 Deep Focus",tempo:"Calm",light:"Practicals",a:"{lead} sits awake on the couch in {setting}. The wall clock reads 3:00 and nothing moves"},
   {beat:"The silence",type:"Extreme close-up",move:"Slow zoom in",focal:"75mm",ap:"f/1.4 Wide Open",tempo:"Calm",light:"Window",a:"{lead}'s eyes in the dark as the dripping tap suddenly stops and the silence turns wrong"},
   {beat:"The knock",type:"Close-up",move:"Static shot",focal:"50mm",ap:"f/4 Moderate",tempo:"Dynamic",light:"Contre Jour",a:"The front door seen from the dark hallway: {hook}. Dust shivers off the frame with each one"},
   {beat:"The knock",type:"Medium tracking shot",move:"Handheld",focal:"14mm",ap:"f/4 Moderate",tempo:"Dynamic",light:"Practicals",a:"{lead} creeps down the narrow hallway toward the door, the lamp behind throwing a long shadow ahead"},
   {beat:"The choice",type:"POV close-up",move:"POV",focal:"8mm",ap:"f/11 Deep Focus",tempo:"Chaotic",light:"Silhouette",a:"Through the fisheye peephole: the corridor outside is empty, then its light flickers out"},
   {beat:"The choice",type:"Medium close-up",move:"Dolly out",focal:"35mm",ap:"f/1.4 Wide Open",tempo:"Calm",light:"Silhouette",a:"{lead}'s hand freezes on the door handle as one more knock comes from behind, inside the apartment. Hold, then cut to black for the end card"}
  ]},
 drama:{label:"Drama",studio:"Drama",era:"2020s",body:"Modern",lens:"Warm Vintage",n:5,drop:[2,4,3],long:[5,0],mood:"warm golden-hour light, soft haze, tender and quiet",
  d:{title:"The Last Letter",lead:"Ada",look:"a woman in her late 60s, silver hair in a low bun, navy wool coat, reading glasses on a thin chain",setting:"a quiet seaside train platform at golden hour",hook:"a letter she has carried for forty years"},
  s:[
   {beat:"The setup",type:"Wide shot",move:"Crane down",focal:"14mm",ap:"f/11 Deep Focus",tempo:"Calm",light:"Contre Jour",a:"{setting}. {lead} waits alone on a bench as the last train pulls in"},
   {beat:"The detail",type:"Insert close-up",move:"Rack focus",focal:"75mm",ap:"f/1.4 Wide Open",tempo:"Calm",light:"Window",a:"{lead}'s hands turn over {hook}, the paper soft and yellowed"},
   {beat:"The search",type:"Medium shot",move:"Side tracking",focal:"35mm",ap:"f/4 Moderate",tempo:"Dynamic",light:"Soft Cross",a:"{lead} walks beside the train, searching each window"},
   {beat:"The turn",type:"Close-up",move:"Static shot",focal:"50mm",ap:"f/1.4 Wide Open",tempo:"Calm",light:"Window",a:"A face in one window looks back. Recognition slowly reaches {lead}'s eyes"},
   {beat:"The choice",type:"Medium close-up",move:"Dolly in",focal:"50mm",ap:"f/4 Moderate",tempo:"Calm",light:"Soft Cross",a:"{lead} presses the letter to the glass instead of saying a word"},
   {beat:"The ending",type:"Wide shot",move:"Aerial pullback",focal:"14mm",ap:"f/11 Deep Focus",tempo:"Calm",light:"Contre Jour",a:"The train pulls away. {lead} stays on the platform, smiling through tears, hands empty. End card"}
  ]},
 scifi:{label:"Sci-fi",studio:"Epic",era:"1980s",body:"35mm Film",lens:"Anamorphic",n:4,drop:[1,4,2],long:[0,3,5],mood:"neon cyan and red practicals, drifting dust, vast and lonely",
  d:{title:"Signal",lead:"Kai",look:"a man in his 20s, buzzed black hair, worn orange flight jacket, cracked helmet clipped to his belt, small scar through the left eyebrow",setting:"an abandoned orbital relay station above a red planet",hook:"a signal repeating his own voice"},
  s:[
   {beat:"The world",type:"Extreme wide shot",move:"Slow zoom in",focal:"14mm",ap:"f/11 Deep Focus",tempo:"Calm",light:"Silhouette",a:"{setting}, tiny against the planet. One window still glows"},
   {beat:"The approach",type:"Medium shot",move:"Tracking",focal:"35mm",ap:"f/4 Moderate",tempo:"Dynamic",light:"Practicals",a:"{lead} floats down a dark corridor, a flashlight beam cutting through drifting dust"},
   {beat:"The discovery",type:"Close-up",move:"Rack focus",focal:"50mm",ap:"f/1.4 Wide Open",tempo:"Calm",light:"Practicals",a:"A cracked console screen wakes up and plays {hook}"},
   {beat:"The twist",type:"Close-up",move:"Dolly zoom",focal:"50mm",ap:"f/1.4 Wide Open",tempo:"Chaotic",light:"Contre Jour",a:"{lead}'s face as the voice says his next words a second before he does"},
   {beat:"The reveal",type:"Wide shot",move:"Arc left",focal:"14mm",ap:"f/4 Moderate",tempo:"Dynamic",light:"Silhouette",a:"Outside the window a second, identical station drifts into view, its window glowing"},
   {beat:"The choice",type:"Medium close-up",move:"Static shot",focal:"35mm",ap:"f/4 Moderate",tempo:"Calm",light:"Practicals",a:"{lead} reaches for the transmit switch. Cut to black on the click. End card"}
  ]},
 comedy:{label:"Comedy",studio:"Comedy",era:"2020s",body:"Modern",lens:"Clean Sharp",n:5,drop:[1,4,3],long:[5,2],mood:"bright, clean colour, crisp and playful",
  d:{title:"Wrong Door",lead:"Benny",look:"a lanky man in his 30s, curly red hair, bright yellow raincoat, mismatched socks, carrying a huge cake box",setting:"a fancy apartment hallway lined with identical doors",hook:"a surprise party at the wrong apartment"},
  s:[
   {beat:"The setup",type:"Wide shot",move:"Static shot",focal:"14mm",ap:"f/11 Deep Focus",tempo:"Calm",light:"Overhead Fall",a:"{lead} tiptoes down {setting}, balancing the cake box and checking a crumpled note"},
   {beat:"The mistake",type:"Insert close-up",move:"Slow zoom in",focal:"75mm",ap:"f/1.4 Wide Open",tempo:"Calm",light:"Window",a:"The note: the apartment number is smudged. {lead} squints, shrugs and picks a door"},
   {beat:"The big moment",type:"Medium shot",move:"Whip pan",focal:"35mm",ap:"f/4 Moderate",tempo:"Chaotic",light:"Practicals",a:"The door swings open. {lead} yells \"Surprise!\" and throws confetti. The setup is {hook}"},
   {beat:"The reaction",type:"Reaction close-up",move:"Crush zoom",focal:"50mm",ap:"f/4 Moderate",tempo:"Dynamic",light:"Practicals",a:"A very calm stranger in a bathrobe stares back, holding a cup of tea"},
   {beat:"The beat",type:"Medium two-shot",move:"Static shot",focal:"35mm",ap:"f/4 Moderate",tempo:"Calm",light:"Soft Cross",a:"A long, awkward pause. The stranger quietly takes a slice of cake"},
   {beat:"The button",type:"Wide shot",move:"Dolly out",focal:"14mm",ap:"f/11 Deep Focus",tempo:"Dynamic",light:"Overhead Fall",a:"Every door in the hallway opens at once. Neighbours peek out and {lead} sheepishly offers the box around. End card"}
  ]}
};
var gsel=$("#fGenre");Object.keys(G).forEach(function(k){gsel.appendChild(el("option",{value:k,text:G[k].label}));});

var DEFAULT_BRIEF=C.week+" · "+C.genre+" · "+C.theme+"\n"+C.tagline+"\n\n"+C.brief+"\n"+C.beats.map(function(b){return b[0]+" "+b[1];}).join("\n")+"\n\nRules: "+C.rules.join(". ")+".\nFilm submissions close "+C.deadline.replace(" (film submissions close)","")+".";
var brief={week:C.week,genre:"horror",title:C.theme,min:25,max:35,target:30,aspect:"9:16",res:"720p",model:"Seedance 2.0 Fast",deadline:C.deadline,rules:C.rules.slice(),isDefault:true,tag:C.tagline};

function fillBriefCard(){
  $("#bWeek").textContent=brief.week||"Weekly challenge";$("#bGenre").textContent=G[brief.genre].label;
  $("#bTitle").textContent=brief.title||"Your film";$("#bTag").textContent=brief.tag||"";
  var f=$("#bFacts");f.innerHTML="";
  [["Length",brief.min===brief.max?brief.target+" s":brief.min+"–"+brief.max+" s (target "+brief.target+")"],["Format",brief.aspect+" · "+brief.res],["Model",brief.model],["Deadline",brief.deadline||"See the brief"]].forEach(function(x){f.appendChild(el("div",{},[el("dt",{text:x[0]}),el("dd",{text:x[1]})]));});
  var st=$("#bStatus");if(brief.isDefault&&C.status_note){st.hidden=false;st.textContent=C.status_note+" Viral numbers lock "+C.viral_lock+"; results "+C.results+".";}else st.hidden=true;
  $("#bSrc").href=C.source;$("#bRead").textContent=niceDate(C.read);
}
function setFields(gk,keepTitle){var d=G[gk].d;$("#fGenre").value=gk;if(!keepTitle)$("#fTitle").value=d.title;$("#fLead").value=d.lead;$("#fLook").value=d.look;$("#fSetting").value=d.setting;$("#fHook").value=d.hook;}

var MODELS=Object.keys(BYNAME).concat(["Seedance 2.0 Fast","Seedance 2.0 Mini","Wandura Studio 4.0","Wandura Film 1.0"]).sort(function(a,b){return b.length-a.length;});
function titleCase(s){return s.toLowerCase().replace(/(^|\s)([a-z])/g,function(m,a,b){return a+b.toUpperCase();});}
function parseBrief(txt){
  var b={isDefault:false,rules:[]};var t=txt.replace(/\u2013|\u2014/g,"-");
  var w=t.match(/week\s*0*(\d{1,2})/i);b.week=w?"Week "+(w[1].length<2?"0":"")+w[1]:"";
  var lt=t.toLowerCase();
  b.genre=/horror|scary|haunt|ghost|knock/.test(lt)?"horror":/sci-?fi|science fiction|space|future|robot|alien/.test(lt)?"scifi":/comedy|funny|laugh|prank/.test(lt)?"comedy":/drama|love|family|letter|grief|romance/.test(lt)?"drama":null;
  var tt=t.match(/(?:horror|drama|sci-?fi|comedy|fantasy|action)\s*[·:|-]\s*([A-Za-z' ]{3,40})/i)||t.match(/^\s*(the\s+[a-z']+(?:\s+[a-z']+)?)\.?\s*$/im)||t.match(/["\u201c]([^"\u201d]{3,40})["\u201d]/);
  b.title=tt?titleCase(tt[1].trim()):"";
  var r=t.match(/(\d{1,3})\s*-\s*(\d{1,3})\s*(?:s\b|sec|second)/i);
  if(r){b.min=+r[1];b.max=+r[2];}
  var tg=t.match(/target\s*(\d{1,3})\s*(?:s\b|sec|second)/i)||t.match(/(\d{1,3})[- ]second\s+(?:ai\s+)?film/i)||t.match(/(\d{1,3})\s*s\s+film/i);
  if(tg)b.target=+tg[1];
  if(!b.min&&b.target){b.min=b.target;b.max=b.target;}
  if(b.min&&!b.target)b.target=Math.round((b.min+b.max)/2);
  var a=t.match(/\b(9:16|16:9|1:1|4:5|3:4)\b/);b.aspect=a?a[1]:"";
  var rs=t.match(/\b(480p|540p|720p|1080p|4k)\b/i);b.res=rs?rs[1].replace("K","k").replace(/k$/,"K"):"";
  b.model="";for(var i=0;i<MODELS.length;i++){if(lt.indexOf(MODELS[i].toLowerCase())>=0){b.model=MODELS[i];break;}}
  var dl=t.match(/(?:close[sd]?|due|deadline|by)[^\n.]*?(\d{1,2}\s+[A-Z][a-z]{2,8}(?:\s+\d{4})?(?:[^\n.]*?\d{1,2}:\d{2}\s*UTC)?)/i)||t.match(/(\d{1,2}\s+[A-Z][a-z]{2,8}\s+\d{4}[^\n]*?UTC)/);
  b.deadline=dl?dl[1].trim():"";
  var ab=t.match(/\babout\s+([^.\n]{6,90})/i);b.hook=ab?ab[1].trim():"";
  var tag=t.split(/\n/).map(function(x){return x.trim();}).filter(function(x){return x&&x.length<70&&/[.!?]$/.test(x)&&x.toLowerCase().indexOf("week")<0;});b.tag=tag[0]||"";
  var lines=t.split(/\n|\.\s+/).map(function(x){return x.trim().replace(/^[-*\u2022\d.)\s]+/,"");}).filter(function(x){return x.length>8&&x.length<200&&/\b(must|only|no |include|required|hashtag|label|watermark|vertical|seconds|submit|post|original|fictional|voice|age|18\+)\b|#\w/i.test(x);});
  var seen={};lines.forEach(function(x){x=x.replace(/^rules?\s*:\s*/i,"").replace(/\.$/,"");var k=x.toLowerCase();if(x===b.tag.replace(/\.$/,""))return;if(b.min&&/^\d{1,3}\s*-\s*\d{1,3}\s*(s|sec|seconds)$/i.test(x))return;if(x.length>8&&!seen[k]){seen[k]=1;b.rules.push(x);}});
  return b;
}
function sumFor(n,k){return 5*n+3*k;}
function plan_durations(tpl,target,min,max){
  var best=null;
  for(var n=Math.min(6,tpl.s.length);n>=2;n--){for(var k=0;k<=n;k++){var s=sumFor(n,k);var inR=s>=min&&s<=max;var sc=Math.abs(s-target)*10+Math.abs(n-tpl.n)*4+(inR?0:1000)+(n<4&&target>=20?40:0);if(!best||sc<best.sc)best={sc:sc,n:n,k:k,sum:s};}}
  var idx=tpl.s.map(function(_,i){return i;});var drop=tpl.drop.slice();
  while(idx.length>best.n){var d=drop.shift();if(d==null){idx.splice(Math.floor(idx.length/2),1);}else{var p=idx.indexOf(d);if(p>=0)idx.splice(p,1);}}
  var longs=tpl.long.filter(function(i){return idx.indexOf(i)>=0;}).concat(idx.filter(function(i){return tpl.long.indexOf(i)<0;}));
  var longSet=longs.slice(0,best.k);
  return idx.map(function(i){return {i:i,dur:longSet.indexOf(i)>=0?8:5};});
}
function fillT(s,f){return s.replace(/\{lead\}/g,f.lead).replace(/\{setting\}/g,f.setting).replace(/\{hook\}/g,f.hook);}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function priceFor(model,sec,res){var m=BYNAME[model];if(!m||m.unpublished)return null;var c=m.settings.filter(function(s){return s.credits!=null&&s.seconds===sec&&(!s.resolution||!res||s.resolution===res);});return c.length?c[0]:null;}
var kit=null;
function build(){
  var gk=$("#fGenre").value;var tpl=G[gk];
  var f={title:$("#fTitle").value.trim()||tpl.d.title,lead:$("#fLead").value.trim()||tpl.d.lead,look:$("#fLook").value.trim()||tpl.d.look,setting:$("#fSetting").value.trim()||tpl.d.setting,hook:$("#fHook").value.trim()||tpl.d.hook};
  var target=Math.max(10,Math.min(60,+$("#fRuntime").value||brief.target||30));
  var min=brief.min&&brief.max&&target>=brief.min&&target<=brief.max?brief.min:target-5,max=brief.min&&brief.max&&target>=brief.min&&target<=brief.max?brief.max:target+5;
  var model=$("#fModel").value.trim()||"Seedance 2.0 Fast";
  var aspect=brief.aspect||"9:16",res=brief.res||"720p";
  var plan=plan_durations(tpl,target,min,max);
  var t=0;var out=[];
  plan.forEach(function(p,n){var s=tpl.s[p.i];var start=t;t+=p.dur;
    var c={Camera:tpl.body,Lens:tpl.lens,"Focal length":s.focal,Aperture:s.ap,Era:tpl.era,Tempo:s.tempo,"Camera movement":s.move,Lighting:s.light,Genre:tpl.studio};
    var act=cap(fillT(s.a,f));
    var prompt=s.type+", "+s.move.toLowerCase()+". "+act+". "+f.lead+": "+f.look+". "+(act.indexOf(f.setting)>=0?"":"Setting: "+f.setting+". ")+s.light+" lighting, "+tpl.mood+". Shot on "+tpl.body+" with a "+tpl.lens.toLowerCase()+" lens, "+s.focal+", "+s.ap.split(" ")[0]+". "+tpl.era+" look, "+s.tempo.toLowerCase()+" tempo. Vertical "+aspect+", "+res+", "+p.dur+" seconds. Same character, outfit and set as the other shots. No on-screen text, no logos.";
    out.push({n:n+1,beat:s.beat,type:s.type,start:start,end:t,dur:p.dur,controls:c,action:act,prompt:prompt});
  });
  var cast="CAST: "+f.lead+", "+f.look+". Same face, hair, outfit and props in every shot; "+f.setting+".";
  var rules=brief.isDefault?C.rules.slice():[];
  if(!brief.isDefault){rules.push("Runtime "+min+"–"+max+" s (this plan: "+t+" s)");rules.push(aspect+" at "+res);rules.push("Made with "+model);brief.rules.forEach(function(r){if(rules.indexOf(r)<0&&rules.length<12)rules.push(r);});}
  rules.push("Shot list runs "+t+" s; trim in your editor if you need exact timing");
  // cost
  var cost=[];var direct=0,directOk=true;
  var anyNoRes=false;out.forEach(function(s){var p=priceFor(model,s.dur,res);if(p){direct+=p.credits;if(!p.resolution)anyNoRes=true;}else directOk=false;});
  if(directOk&&out.length){cost.push({k:out.length+" shots on "+model+(anyNoRes?" at its published default quality ("+res+" may cost more, shown on Generate)":" at "+res),v:fmt(direct)+" credits",u:usd(direct)});}
  else{cost.push({k:out.length+" shots on "+model,v:NP,np:true});
    var ref="Seedance 2.0";var rt=0,rok=true;out.forEach(function(s){var p=priceFor(ref,s.dur,"720p");if(p)rt+=p.credits;else rok=false;});
    if(rok&&model!==ref)cost.push({k:"Published reference: the same shot lengths on "+ref+" at 720p",v:fmt(rt)+" credits",u:usd(rt)});
    direct=rok?rt:0;}
  var nbp=priceFor("Nano Banana Pro",null,null)||BYNAME["Nano Banana Pro"].settings[0];
  cost.push({k:"Character sheet image (Nano Banana Pro, 1K), optional",v:fmt(nbp.credits)+" credits"});
  if(direct)cost.push({k:"With one retake per shot",v:fmt(direct*2+nbp.credits)+" credits",u:usd(direct*2+nbp.credits)});
  if(brief.isDefault)cost.push({k:"Creation support from Wandura, after idea approval",v:"up to 1,000 credits"});
  kit={f:f,model:model,aspect:aspect,res:res,shots:out,cast:cast,rules:rules,cost:cost,total:t,tpl:tpl};
  renderKit();
}
function sec(title,body,copyFn){var h=el("h3",{class:"card-title"},[title]);if(copyFn){var b=el("button",{type:"button",class:"copy",text:"Copy"});b.addEventListener("click",function(){copyText(copyFn());});h.appendChild(b);}return el("div",{class:"card kit-sec"},[h].concat(body));}
function shotText(s){return "SHOT "+s.n+" ("+s.start+"–"+s.end+" s, generate "+s.dur+" s) · "+s.beat+"\n"+s.type+". "+s.action+".\nCinema Studio: "+Object.keys(s.controls).map(function(k){return k+" "+s.controls[k];}).join(" · ")+"\nPrompt: "+s.prompt;}
function allText(){
  var k=kit;return [k.f.title.toUpperCase()+" · "+k.total+" s · "+k.aspect+" · "+k.res+" · "+k.model,"",k.cast,"",k.shots.map(shotText).join("\n\n"),"","RULES CHECKLIST",k.rules.map(function(r){return "[ ] "+r;}).join("\n"),"","CREDIT ESTIMATE",k.cost.map(function(c){return "- "+c.k+": "+c.v;}).join("\n"),"","Prices read from wandura.ai on "+niceDate(D.read)+". Wandura Toolkit by @iamlogtun."].join("\n");
}
function renderKit(){
  var k=kit;var o=$("#kitOut");o.innerHTML="";
  var sum=el("p",{class:"hint",text:k.shots.length+" shots · "+k.total+" s · "+k.aspect+" · "+k.res+" · "+k.model+". Set these controls in Cinema Studio, paste the prompt, and generate each shot."});
  var list=k.shots.map(function(s){
    var ctr=el("ul",{class:"ctrls"},Object.keys(s.controls).map(function(c){return el("li",{},[c+" ",el("b",{text:s.controls[c]})]);}));
    var cp=el("button",{type:"button",class:"copy",text:"Copy prompt"});cp.addEventListener("click",function(){copyText(s.prompt);});
    return el("div",{class:"kshot"},[
      el("div",{class:"kshot-h"},[el("b",{text:"Shot "+s.n+" · "+s.beat}),el("span",{class:"kshot-t",text:s.start+"–"+s.end+" s"})]),
      el("p",{class:"kshot-a"},[el("strong",{text:s.type+". "}),s.action+"."]),
      ctr,
      el("div",{class:"prompt"},[el("p",{text:s.prompt}),cp])
    ]);
  });
  o.appendChild(sec("Shot list and prompts",[sum].concat(list),function(){return k.shots.map(shotText).join("\n\n");}));
  o.appendChild(sec("Character sheet",[el("p",{class:"cast",text:k.cast}),el("p",{class:"hint",text:"Paste this line into every prompt (it is already in the ones above). Making a character sheet image first and reusing it as a reference, where the composer takes one, helps keep the same face."})],function(){return k.cast;}));
  var ul=el("ul",{class:"checks"},k.rules.map(function(r,i){var id="rule"+i;return el("li",{},[el("label",{for:id},[el("input",{type:"checkbox",id:id}),el("span",{text:r})])]);}));
  o.appendChild(sec("Rules checklist",[ul],function(){return k.rules.map(function(r){return "[ ] "+r;}).join("\n");}));
  var cl=k.cost.map(function(c){return el("div",{class:"costline"},[el("span",{text:c.k}),el("b",{class:c.np?"np":"",text:c.v+(c.u?" ("+c.u+")":"")})]);});
  o.appendChild(sec("Estimated credit cost",cl.concat([el("p",{class:"hint",text:"From the Credit Planner's published prices only. The Generate button shows the final price."})]),null));
}
function loadDefault(){
  brief={week:C.week,genre:"horror",title:C.theme,min:25,max:35,target:30,aspect:"9:16",res:"720p",model:"Seedance 2.0 Fast",deadline:C.deadline.replace(" (film submissions close)",""),rules:C.rules.slice(),isDefault:true,tag:C.tagline};
  $("#briefText").value=DEFAULT_BRIEF;setFields("horror");$("#fRuntime").value=30;$("#fModel").value="Seedance 2.0 Fast";fillBriefCard();build();
}
$("#readBrief").addEventListener("click",function(){
  var txt=$("#briefText").value;if(txt.trim()===DEFAULT_BRIEF.trim()){loadDefault();toast("This week's brief");return;}
  if(!txt.trim()){toast("Paste a brief first");return;}
  var b=parseBrief(txt);var gk=b.genre||$("#fGenre").value;
  brief={week:b.week,genre:gk,title:b.title||"",min:b.min||25,max:b.max||35,target:b.target||30,aspect:b.aspect||"9:16",res:b.res||"720p",model:b.model||"Seedance 2.0 Fast",deadline:b.deadline,rules:b.rules,isDefault:false,tag:b.tag};
  setFields(gk);if(b.title)$("#fTitle").value=b.title;if(b.hook)$("#fHook").value=b.hook;$("#fRuntime").value=brief.target;$("#fModel").value=brief.model;
  fillBriefCard();build();toast("Brief read");
});
$("#fGenre").addEventListener("change",function(){setFields(this.value,true);brief.genre=this.value;fillBriefCard();build();});
$("#buildKit").addEventListener("click",function(){build();toast("Kit rebuilt");var o=$("#kitOut");if(o.scrollIntoView)o.scrollIntoView({behavior:"smooth",block:"start"});});
["#copyAll","#copyAll2"].forEach(function(id){$(id).addEventListener("click",function(){if(!kit)build();copyText(allText());});});

/* init */
renderPrices();
shots=PRESETS.film.map(function(p){return {model:p.model,setting:findSetting(p.model,p.setting),count:p.count};});
renderShots();update();loadDefault();
window.WTK={parseBrief:parseBrief,allText:function(){return allText();}};
})();
