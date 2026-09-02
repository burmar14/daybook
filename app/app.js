(function(){
"use strict";

/* ============ constants ============ */
var MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
var MS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var ML=["J","F","M","A","M","J","J","A","S","O","N","D"];
var DOW=["S","M","T","W","T","F","S"];
var KEY="daybook.v1";
var LEVELS=[["year","Year"],["month","Month"],["week","Week"],["day","Day"]];

function daysIn(y,m){ return new Date(y,m+1,0).getDate() }
function k(y,m,d){ return y+"-"+m+"-"+d }
function startOfWeek(y,m,d){ var dt=new Date(y,m,d); dt.setDate(dt.getDate()-dt.getDay()); dt.setHours(0,0,0,0); return dt }
function weeksOfMonth(y,m){
  var s=startOfWeek(y,m,1), last=new Date(y,m,daysIn(y,m)), out=[];
  while(s<=last){ out.push(new Date(s)); s=new Date(s); s.setDate(s.getDate()+7) }
  return out;
}
function addDays(dt,n){ var x=new Date(dt); x.setDate(x.getDate()+n); return x }

/* ============ colour helpers ============ */
function hsl(h,s,l){
  s/=100; l/=100;
  var a=s*Math.min(l,1-l);
  function f(n){
    var x=(n+h/30)%12;
    var c=l-a*Math.max(-1,Math.min(x-3,Math.min(9-x,1)));
    return Math.round(255*c).toString(16).padStart(2,"0");
  }
  return "#"+f(0)+f(8)+f(4);
}
function isDark(){
  var t=document.documentElement.getAttribute("data-theme");
  if(t==="dark") return true;
  if(t==="light") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function col(s){ return (isDark() && s.cDark) ? s.cDark : s.c }
function onFill(hex){
  var r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  function lin(c){ return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4) }
  var L=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  return L>0.42 ? "rgba(18,21,16,.82)" : "rgba(255,255,255,.95)";
}

/* ============ categories ============ */
function kBrief(v){ return v>=1000 ? (Math.round(v/100)/10)+"k" : String(v) }
function mBrief(v){ return v>=60 ? String(Math.round(v/6)/10).replace(/\.0$/,"")+"h" : v+"m" }

var BUILTIN=[
 {id:"drinks",name:"Drinks",unit:"drinks",def:0,max:8,headLbl:"Clear days",
  stops:[{to:0,c:"#3F9E6A",l:"Clear"},{to:2,c:"#E0AE2E",l:"Light"},{to:4,c:"#C9483C",l:"Heavy"},
         {to:99,c:"#23262B",cDark:"#7A2233",l:"Rough"}],
  good:function(v){return v===0}, alert:function(v){return v>=3}, brief:String},
 {id:"move",name:"Move",unit:"effort",def:2,max:3,headLbl:"Active days",
  stops:[{to:0,c:"#A8B2A6",l:"Rest"},{to:1,c:"#9FC9AC",l:"Light"},{to:2,c:"#55A177",l:"Solid"},{to:3,c:"#1F7350",l:"Hard"}],
  good:function(v){return v>=1}},
 {id:"steps",name:"Steps",unit:"steps",def:6000,max:100000,headLbl:"6k+ days",
  numeric:true,stepBy:500,floors:[0,3000,6000,10000,15000],tapStart:2,brief:kBrief,
  stops:[{to:2999,c:"#C3D0D3",l:"Under 3k"},{to:5999,c:"#9BBCC6",l:"3–6k"},{to:9999,c:"#5E96A8",l:"6–10k"},
         {to:14999,c:"#2A6B84",l:"10–15k"},{to:1e9,c:"#14455C",l:"15k plus"}],
  good:function(v){return v>=6000}},
 {id:"read",name:"Reading",unit:"minutes",def:30,max:1440,headLbl:"Reading days",
  numeric:true,stepBy:5,floors:[0,15,30,60],tapStart:2,brief:mBrief,
  stops:[{to:0,c:"#B6AFC2",l:"None"},{to:29,c:"#A98FCB",l:"Under 30m"},
         {to:59,c:"#7E5CAE",l:"30–60m"},{to:1e9,c:"#513281",l:"An hour plus"}],
  good:function(v){return v>=15}},
 {id:"tidy",name:"Tidy",unit:"effort",def:1,max:3,headLbl:"Days on it",
  stops:[{to:0,c:"#B7AFA2",l:"Nothing"},{to:1,c:"#E2C79A",l:"Tidied"},{to:2,c:"#C99648",l:"Chores"},{to:3,c:"#96631F",l:"Deep clean"}],
  good:function(v){return v>=1}},
 {id:"mind",name:"Mind",unit:"mood",def:3,max:5,min:1,headLbl:"Avg mood",avg:true,brief:String,
  stops:[{to:1,c:"#4C5B93",l:"Low"},{to:2,c:"#7C87B0",l:"Flat"},{to:3,c:"#B8B6B0",l:"Even"},
         {to:4,c:"#DBBE7A",l:"Good"},{to:5,c:"#E9A23C",l:"Bright"}],
  good:function(v){return v>=3}},
 {id:"fuel",name:"Fuel",unit:"quality",def:2,max:3,headLbl:"Good days",
  stops:[{to:0,c:"#C0B49E",l:"Off plan"},{to:1,c:"#C7CE9A",l:"Rough"},{to:2,c:"#93B471",l:"Decent"},{to:3,c:"#4E8C4A",l:"Dialed"}],
  good:function(v){return v>=2}}
];

var TEMPLATES={
  level:{name:"Levels — more is better", build:function(h){ return {
    def:2,max:3,headLbl:"Days on it",
    stops:[{to:0,c:hsl(h,12,73),l:"None"},{to:1,c:hsl(h,34,63),l:"Light"},
           {to:2,c:hsl(h,48,47),l:"Solid"},{to:3,c:hsl(h,58,33),l:"Full"}],
    good:function(v){return v>=1}}}},
  done:{name:"Done or not", build:function(h){ return {
    def:1,max:1,headLbl:"Days done",
    stops:[{to:0,c:hsl(h,10,72),l:"Missed"},{to:1,c:hsl(h,52,42),l:"Done"}],
    good:function(v){return v>=1}}}},
  minutes:{name:"Minutes spent", build:function(h){ return {
    def:30,max:1440,numeric:true,stepBy:5,floors:[0,15,30,60],tapStart:2,brief:mBrief,headLbl:"Days on it",
    stops:[{to:0,c:hsl(h,10,72),l:"None"},{to:29,c:hsl(h,32,64),l:"Under 30m"},
           {to:59,c:hsl(h,46,48),l:"30–60m"},{to:1e9,c:hsl(h,56,33),l:"An hour plus"}],
    good:function(v){return v>=15}}}},
  count:{name:"Count — fewer is better", build:function(){ return {
    def:0,max:8,headLbl:"Zero days",brief:String,
    stops:[{to:0,c:"#3F9E6A",l:"None"},{to:2,c:"#E0AE2E",l:"A few"},{to:4,c:"#C9483C",l:"Many"},
           {to:99,c:"#23262B",cDark:"#7A2233",l:"Too many"}],
    good:function(v){return v===0}, alert:function(v){return v>=3}}}},
  scale:{name:"Scale of 1 to 5", build:function(){ return {
    def:3,max:5,min:1,headLbl:"Average",avg:true,brief:String,
    stops:[{to:1,c:"#4C5B93",l:"Low"},{to:2,c:"#7C87B0",l:"Flat"},{to:3,c:"#B8B6B0",l:"Even"},
           {to:4,c:"#DBBE7A",l:"Good"},{to:5,c:"#E9A23C",l:"Bright"}],
    good:function(v){return v>=3}}}}
};
var HUES=[8,32,140,168,200,262,318,45];

function buildCustom(c){
  var t=TEMPLATES[c.tpl]||TEMPLATES.level;
  var b=t.build(c.hue);
  b.id=c.id; b.name=c.name; b.unit=b.unit||""; b.custom=true; b.tpl=c.tpl; b.hue=c.hue;
  return b;
}
function allCats(){
  var out=BUILTIN.slice();
  S.custom.forEach(function(c){ out.push(buildCustom(c)) });
  out.forEach(function(c){
    if(!c.alert) c.alert=function(){return false};
    if(!c.brief) c.brief=function(){return ""};
  });
  return out;
}
function visibleCats(){ return allCats().filter(function(c){ return S.prefs.hidden.indexOf(c.id)<0 }) }
function catById(id){ var a=allCats(); for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i]; return null }
function minOf(c){ return c.min!==undefined?c.min:0 }
function stopFor(cat,v){
  for(var i=0;i<cat.stops.length;i++) if(v<=cat.stops[i].to) return cat.stops[i];
  return cat.stops[cat.stops.length-1];
}
function bandIdx(cat,v){
  var f=cat.floors;
  for(var i=f.length-1;i>=0;i--) if(v>=f[i]) return i;
  return 0;
}
function tapNext(cat,v){
  if(cat.numeric){
    if(v===undefined) return cat.floors[cat.tapStart];
    var b=bandIdx(cat,v);
    return b>=cat.floors.length-1 ? undefined : cat.floors[b+1];
  }
  if(v===undefined) return cat.def;
  if(v>=cat.max) return undefined;
  return v+1;
}

/* ============ store ============ */
function blank(){
  return {v:1, data:{}, notes:{}, custom:[],
          prefs:{marks:true, seen:false, hidden:[], cat:"drinks", year:new Date().getFullYear()}};
}
var S;
function load(){
  try{
    var raw=localStorage.getItem(KEY);
    if(!raw) return blank();
    var o=JSON.parse(raw), b=blank();
    o.data=o.data||{}; o.notes=o.notes||{}; o.custom=o.custom||[];
    o.prefs=Object.assign(b.prefs,o.prefs||{});
    if(!Array.isArray(o.prefs.hidden)) o.prefs.hidden=[];
    return o;
  }catch(e){ return blank() }
}
var saveTimer=null, saveWarned=false;
function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(function(){
    try{ localStorage.setItem(KEY, JSON.stringify(S)) }
    catch(e){ if(!saveWarned){ saveWarned=true; toast("Couldn't save — storage is full or blocked.") } }
  },120);
}
S=load();

function get(catId,y,m,d){ var t=S.data[catId]; return t?t[k(y,m,d)]:undefined }
function getD(catId,dt){ return get(catId,dt.getFullYear(),dt.getMonth(),dt.getDate()) }
function set(catId,y,m,d,v){
  if(!S.data[catId]) S.data[catId]={};
  if(v===undefined) delete S.data[catId][k(y,m,d)]; else S.data[catId][k(y,m,d)]=v;
  save();
}
function getNote(catId,y,m,d){ var t=S.notes[catId]; return t?(t[k(y,m,d)]||""):"" }
function setNote(catId,y,m,d,txt){
  if(!S.notes[catId]) S.notes[catId]={};
  if(txt) S.notes[catId][k(y,m,d)]=txt; else delete S.notes[catId][k(y,m,d)];
  save();
}

/* ============ today / focus ============ */
var T={};
function refreshToday(){ var n=new Date(); T={y:n.getFullYear(), m:n.getMonth(), d:n.getDate()} }
refreshToday();
function isFuture(y,m,d){
  if(y!==T.y) return y>T.y;
  if(m!==T.m) return m>T.m;
  return d>T.d;
}
function isFutureD(dt){ return isFuture(dt.getFullYear(),dt.getMonth(),dt.getDate()) }
function isToday(y,m,d){ return y===T.y && m===T.m && d===T.d }

var V={level:"year", f:{y:T.y,m:T.m,d:T.d}};
function focusDate(){ return new Date(V.f.y,V.f.m,V.f.d) }
function setFocus(dt){ V.f={y:dt.getFullYear(), m:dt.getMonth(), d:dt.getDate()} }
if(!catById(S.prefs.cat)) S.prefs.cat=(visibleCats()[0]||BUILTIN[0]).id;

var $=function(s){ return document.querySelector(s) };
var scroll=$("#scroll"), tabsEl=$("#tabs"), statsEl=$("#stats"), legendEl=$("#legend"), levelsEl=$("#levels");
var sheet=$("#sheet"), scrim=$("#scrim");

function toast(msg){
  var t=$("#toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(t._t); t._t=setTimeout(function(){ t.classList.remove("on") },2400);
}
function showView(id){ ["v-welcome","v-app","v-set"].forEach(function(x){ $("#"+x).classList.toggle("on", x===id) }) }
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c] }) }

/* ============ press handling ============ */
function press(el,onTap,onHold){
  var timer=null, held=false, sx=0, sy=0, moved=false;
  el.addEventListener("pointerdown",function(e){
    held=false; moved=false; sx=e.clientX; sy=e.clientY;
    timer=setTimeout(function(){ held=true; onHold&&onHold() },420);
  });
  el.addEventListener("pointermove",function(e){
    if(Math.abs(e.clientX-sx)>8||Math.abs(e.clientY-sy)>8){ moved=true; clearTimeout(timer) }
  });
  el.addEventListener("pointerup",function(){ clearTimeout(timer); if(!held && !moved) onTap() });
  el.addEventListener("pointercancel",function(){ clearTimeout(timer) });
  el.addEventListener("contextmenu",function(e){ e.preventDefault() });
}
function logTap(catId,y,m,d){
  var cat=catById(catId);
  set(catId,y,m,d, tapNext(cat,get(catId,y,m,d)));
  render();
}
function goDay(y,m,d){ V.level="day"; V.f={y:y,m:m,d:d}; render() }

/* ============ cell painting ============ */
function fillCell(el,catId,y,m,d){
  var cat=catById(catId), v=get(catId,y,m,d);
  if(v===undefined){ el.classList.remove("filled","mark"); el.style.background=""; el.style.removeProperty("--on-fill"); return undefined }
  var s=stopFor(cat,v), c=col(s);
  el.classList.add("filled");
  el.style.background=c;
  el.style.setProperty("--on-fill", onFill(c));
  el.classList.toggle("mark", !!(S.prefs.marks && cat.alert(v)));
  return v;
}

/* ============ level: YEAR ============ */
function renderYear(){
  var y=V.f.y, catId=S.prefs.cat;
  scroll.innerHTML='<div class="months"><span></span>'+
    ML.map(function(l,i){ return '<span data-m="'+i+'">'+l+'</span>' }).join("")+
    '</div><div class="grid" id="yg"></div>';
  var g=scroll.querySelector("#yg"), frag=document.createDocumentFragment();
  for(var d=1;d<=31;d++){
    var gut=document.createElement("div");
    gut.className="gut"; gut.textContent=(d===1||d%5===0)?d:"";
    frag.appendChild(gut);
    for(var m=0;m<12;m++){
      var c=document.createElement("button"); c.type="button";
      if(d>daysIn(y,m)){ c.className="cell void"; c.tabIndex=-1; frag.appendChild(c); continue }
      c.className="cell";
      c.setAttribute("aria-label",MN[m]+" "+d);
      c.classList.toggle("today",isToday(y,m,d));
      fillCell(c,catId,y,m,d);
      if(isFuture(y,m,d)){ c.classList.add("future"); c.disabled=true }
      else press(c, (function(m,d){ return function(){ logTap(catId,y,m,d) } })(m,d),
                   (function(m,d){ return function(){ goDay(y,m,d) } })(m,d));
      frag.appendChild(c);
    }
  }
  g.appendChild(frag);
  Array.prototype.forEach.call(scroll.querySelectorAll(".months span[data-m]"),function(s){
    s.onclick=function(){ V.level="month"; V.f={y:y,m:+s.dataset.m,d:1}; render() };
  });
}

/* ============ level: MONTH (weeks as columns) ============ */
function renderMonth(){
  var y=V.f.y, m=V.f.m, weeks=weeksOfMonth(y,m), cats=visibleCats(), n=weeks.length;
  var cols="20px repeat("+n+",1fr)";

  var head='<div class="wkhead" style="grid-template-columns:'+cols+'"><span></span>';
  weeks.forEach(function(ws,i){
    var lbl=1;
    for(var j=0;j<7;j++){ var dt=addDays(ws,j); if(dt.getMonth()===m){ lbl=dt.getDate(); break } }
    head+='<span data-w="'+i+'">'+lbl+'</span>';
  });
  head+='</div>';

  scroll.innerHTML=head+'<div class="mongrid" id="mg" style="grid-template-columns:'+cols+'"></div>';
  var g=scroll.querySelector("#mg"), frag=document.createDocumentFragment();

  for(var r=0;r<7;r++){
    var gut=document.createElement("div");
    gut.className="dowgut"; gut.textContent=DOW[r];
    frag.appendChild(gut);
    for(var w=0;w<n;w++){
      var dt=addDays(weeks[w],r);
      var cell=document.createElement("button"); cell.type="button";
      if(dt.getMonth()!==m){ cell.className="dcell blank"; cell.tabIndex=-1; frag.appendChild(cell); continue }
      var yy=dt.getFullYear(), mm=dt.getMonth(), dd=dt.getDate();
      cell.className="dcell";
      cell.setAttribute("aria-label",MN[mm]+" "+dd);
      cell.classList.toggle("today",isToday(yy,mm,dd));
      cats.forEach(function(c){
        var b=document.createElement("i");
        b.className="band"+(c.id===S.prefs.cat?" sel":"");
        var v=get(c.id,yy,mm,dd);
        if(v===undefined) b.classList.add("none");
        else b.style.background=col(stopFor(c,v));
        cell.appendChild(b);
      });
      var num=document.createElement("span");
      num.className="dnum"; num.textContent=dd;
      cell.appendChild(num);
      if(isFuture(yy,mm,dd)){ cell.classList.add("future"); cell.disabled=true }
      else press(cell,(function(yy,mm,dd){ return function(){ logTap(S.prefs.cat,yy,mm,dd) } })(yy,mm,dd),
                      (function(yy,mm,dd){ return function(){ goDay(yy,mm,dd) } })(yy,mm,dd));
      frag.appendChild(cell);
    }
  }
  g.appendChild(frag);
  Array.prototype.forEach.call(scroll.querySelectorAll(".wkhead span[data-w]"),function(s){
    s.onclick=function(){ V.level="week"; setFocus(weeks[+s.dataset.w]); render() };
  });
  scroll.insertAdjacentHTML("beforeend", monthSummary(y,m));
}
function monthSummary(y,m){
  var cat=catById(S.prefs.cat), counts={}, logged=0;
  cat.stops.forEach(function(s){ counts[s.l]=0 });
  for(var d=1;d<=daysIn(y,m);d++){
    var v=get(cat.id,y,m,d);
    if(v===undefined) continue;
    logged++; counts[stopFor(cat,v).l]++;
  }
  var rows=cat.stops.map(function(s){
    return '<li><b style="background:'+col(s)+'"></b><span>'+esc(s.l)+'</span><span>'+counts[s.l]+'</span></li>';
  }).join("");
  rows+='<li><b style="background:transparent;border:1px solid var(--empty-line)"></b><span>Not logged</span><span>'+(daysIn(y,m)-logged)+'</span></li>';
  return '<div class="msum"><h5>'+esc(cat.name)+' in '+MN[m]+'</h5><ul>'+rows+'</ul></div>';
}

/* ============ level: WEEK (days as columns, categories as rows) ============ */
function renderWeek(){
  var ws=startOfWeek(V.f.y,V.f.m,V.f.d), cats=visibleCats();
  var cols="78px repeat(7,1fr)";
  var rows="auto repeat("+cats.length+",minmax(44px,1fr))";
  scroll.innerHTML='<div class="wkgrid" id="wg" style="grid-template-columns:'+cols+
    ';grid-template-rows:'+rows+'"></div>';
  var g=scroll.querySelector("#wg"), frag=document.createDocumentFragment();

  frag.appendChild(document.createElement("div"));
  for(var i=0;i<7;i++){
    var dt=addDays(ws,i);
    var h=document.createElement("div");
    h.className="wkcolhead"+(isToday(dt.getFullYear(),dt.getMonth(),dt.getDate())?" today":"");
    h.innerHTML=DOW[i]+"<b>"+dt.getDate()+"</b>";
    (function(dt){ h.onclick=function(){ V.level="day"; setFocus(dt); render() } })(dt);
    frag.appendChild(h);
  }
  cats.forEach(function(c){
    var rh=document.createElement("div");
    rh.className="wkrowhead"+(c.id===S.prefs.cat?" sel":"");
    rh.innerHTML='<i style="background:'+col(stopFor(c,c.def))+'"></i><span>'+esc(c.name)+'</span>';
    rh.onclick=function(){ S.prefs.cat=c.id; save(); render() };
    frag.appendChild(rh);
    for(var i=0;i<7;i++){
      var dt=addDays(ws,i), yy=dt.getFullYear(), mm=dt.getMonth(), dd=dt.getDate();
      var cell=document.createElement("button"); cell.type="button"; cell.className="wcell";
      cell.setAttribute("aria-label",c.name+" on "+MS[mm]+" "+dd);
      cell.classList.toggle("today",isToday(yy,mm,dd));
      var v=fillCell(cell,c.id,yy,mm,dd);
      cell.textContent = v===undefined ? "" : c.brief(v);
      if(isFuture(yy,mm,dd)){ cell.classList.add("future"); cell.disabled=true }
      else press(cell,(function(c,yy,mm,dd){ return function(){ logTap(c.id,yy,mm,dd) } })(c,yy,mm,dd),
                      (function(c,yy,mm,dd){ return function(){ openSheet(yy,mm,dd,c.id) } })(c,yy,mm,dd));
      frag.appendChild(cell);
    }
  });
  g.appendChild(frag);
}

/* ============ level: DAY ============ */
function renderDay(){
  var y=V.f.y, m=V.f.m, d=V.f.d, cats=visibleCats();
  var dt=new Date(y,m,d);
  var html='<div class="dayhead"><h3>'+dt.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"})+'</h3>'+
           '<p>'+(isToday(y,m,d)?"Today":dt.getFullYear())+'</p></div>';
  scroll.innerHTML=html;
  var frag=document.createDocumentFragment();
  cats.forEach(function(c){
    var v=get(c.id,y,m,d), s=(v===undefined?null:stopFor(c,v));
    var row=document.createElement("div"); row.className="drow"+(c.id===S.prefs.cat?" sel":"");
    var sw=document.createElement("div"); sw.className="swatch";
    if(s){ sw.style.background=col(s); sw.style.borderColor="transparent" }
    var meta=document.createElement("div"); meta.className="meta";
    var val = v===undefined ? "Not logged"
      : s.l + (c.numeric ? " · "+v.toLocaleString()+" "+c.unit : "");
    meta.innerHTML='<span class="nm">'+esc(c.name)+'</span><span class="vl">'+esc(val)+'</span>';
    var minus=document.createElement("button"); minus.className="mini"; minus.textContent="−";
    minus.setAttribute("aria-label","Less "+c.name);
    var plus=document.createElement("button"); plus.className="mini"; plus.textContent="+";
    plus.setAttribute("aria-label","More "+c.name);
    var future=isFuture(y,m,d);
    if(future){ minus.disabled=true; plus.disabled=true }
    minus.onclick=function(){ nudgeCat(c,y,m,d,-1) };
    plus.onclick=function(){ nudgeCat(c,y,m,d,1) };
    sw.onclick=meta.onclick=function(){ if(!future) openSheet(y,m,d,c.id) };
    row.appendChild(sw); row.appendChild(meta); row.appendChild(minus); row.appendChild(plus);
    frag.appendChild(row);
    var nt=getNote(c.id,y,m,d);
    if(nt){ var p=document.createElement("p"); p.className="dnote"; p.textContent="“"+nt+"”"; frag.appendChild(p) }
  });
  scroll.appendChild(frag);
}
function nudgeCat(cat,y,m,d,dir){
  var v=get(cat.id,y,m,d), by=cat.stepBy||1, lo=minOf(cat);
  if(v===undefined) set(cat.id,y,m,d,cat.def);
  else{
    var n=v+dir*by;
    if(n<lo) set(cat.id,y,m,d,undefined);
    else set(cat.id,y,m,d,Math.min(n,cat.max));
  }
  render(); syncSheet();
}

/* ============ chrome ============ */
function renderLevels(){
  levelsEl.innerHTML=LEVELS.map(function(l){
    return '<button class="lvl" data-l="'+l[0]+'" aria-selected="'+(V.level===l[0])+'">'+l[1]+'</button>';
  }).join("");
  Array.prototype.forEach.call(levelsEl.children,function(b){
    b.onclick=function(){
      var want=b.dataset.l;
      if(V.level==="year" && want!=="year"){
        /* entering a narrower level from the year: land on today if it is in view, else the 1st */
        if(V.f.y===T.y) V.f={y:T.y,m:T.m,d:T.d}; else V.f={y:V.f.y,m:0,d:1};
      }
      V.level=want; render();
    };
  });
}
function renderTabs(){
  /* tabs stay on every level: they drive the stats bar and the emphasised band/row */
  var cats=visibleCats();
  tabsEl.innerHTML="";
  cats.forEach(function(c){
    var b=document.createElement("button");
    b.className="tab"; b.type="button"; b.setAttribute("role","tab");
    b.setAttribute("aria-selected", c.id===S.prefs.cat ? "true":"false");
    b.innerHTML='<i class="dot" style="background:'+col(stopFor(c,c.def))+'"></i>'+esc(c.name);
    b.onclick=function(){ S.prefs.cat=c.id; save(); render() };
    tabsEl.appendChild(b);
  });
}
function renderLegend(){
  if(V.level==="year"){
    legendEl.hidden=false;
    var cat=catById(S.prefs.cat);
    legendEl.innerHTML=cat.stops.map(function(s){
      return '<i><b style="background:'+col(s)+'"></b>'+esc(s.l)+'</i>';
    }).join("")+'<i><b style="background:transparent;border:1px solid var(--empty-line)"></b>Not logged</i>';
  } else if(V.level==="month"){
    legendEl.hidden=false;
    legendEl.innerHTML='<i style="color:var(--ink3)">Bands, top to bottom:</i>'+
      visibleCats().map(function(c){
        return '<i><b style="background:'+col(stopFor(c,c.def))+'"></b>'+esc(c.name)+'</i>';
      }).join("");
  } else {
    legendEl.hidden=true; legendEl.innerHTML="";
  }
}
function fmtShort(dt){ return dt.getDate()+" "+MS[dt.getMonth()] }
function titleText(){
  var f=V.f;
  if(V.level==="year") return String(f.y);
  if(V.level==="month") return MN[f.m]+" "+f.y;
  if(V.level==="week"){
    var s=startOfWeek(f.y,f.m,f.d), e=addDays(s,6);
    return fmtShort(s)+" – "+fmtShort(e);
  }
  return new Date(f.y,f.m,f.d).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
}
function subText(){
  /* the level switcher already names Week and Day; a subtitle there only crowds the bar */
  return (V.level==="year"||V.level==="month") ? catById(S.prefs.cat).name : "";
}
function canNext(){
  var f=V.f;
  if(V.level==="year") return f.y<T.y;
  if(V.level==="month") return new Date(f.y,f.m,1) < new Date(T.y,T.m,1);
  if(V.level==="week") return startOfWeek(f.y,f.m,f.d) < startOfWeek(T.y,T.m,T.d);
  return new Date(f.y,f.m,f.d) < new Date(T.y,T.m,T.d);
}
function shift(dir){
  var f=V.f, dt;
  if(V.level==="year"){ f.y+=dir; f.d=Math.min(f.d,daysIn(f.y,f.m)) }
  else if(V.level==="month"){ dt=new Date(f.y,f.m+dir,1); V.f={y:dt.getFullYear(),m:dt.getMonth(),d:1} }
  else if(V.level==="week"){ setFocus(addDays(new Date(f.y,f.m,f.d),dir*7)) }
  else { setFocus(addDays(new Date(f.y,f.m,f.d),dir)) }
  render();
}

/* ============ stats ============ */
function renderStats(){
  var cat=catById(S.prefs.cat), y=V.f.y, vals=[];
  for(var m=0;m<12;m++) for(var d=1;d<=daysIn(y,m);d++){
    var v=get(cat.id,y,m,d); if(v!==undefined) vals.push(v);
  }
  var head = cat.avg
    ? (vals.length ? (vals.reduce(function(a,b){return a+b},0)/vals.length).toFixed(1) : "—")
    : vals.filter(cat.good).length;
  var cur=new Date(T.y,T.m,T.d);
  if(get(cat.id,T.y,T.m,T.d)===undefined) cur.setDate(cur.getDate()-1);
  var streak=0, guard=0;
  while(guard++<4000){
    var vv=getD(cat.id,cur);
    if(vv===undefined || !cat.good(vv)) break;
    streak++; cur.setDate(cur.getDate()-1);
  }
  statsEl.innerHTML=
    '<div class="stat"><b>'+head+'</b><span>'+esc(cat.headLbl)+'</span></div>'+
    '<div class="stat"><b>'+streak+'</b><span>Day streak</span></div>'+
    '<div class="stat"><b>'+vals.length+'</b><span>Logged in '+y+'</span></div>';
}

/* ============ render ============ */
function render(){
  if(!catById(S.prefs.cat)) S.prefs.cat=(visibleCats()[0]||BUILTIN[0]).id;
  S.prefs.year=V.f.y; save();
  renderLevels(); renderTabs(); renderLegend();
  var sub=subText();
  $("#ttl").innerHTML=esc(titleText())+(sub?'<small>'+esc(sub)+'</small>':'');
  $("#next").disabled=!canNext();
  if(V.level==="year") renderYear();
  else if(V.level==="month") renderMonth();
  else if(V.level==="week") renderWeek();
  else renderDay();
  renderStats();
}
$("#prev").onclick=function(){ shift(-1) };
$("#next").onclick=function(){ if(canNext()) shift(1) };
$("#setbtn").onclick=function(){ renderSettings(); showView("v-set") };
$("#setback").onclick=function(){ showView("v-app"); render() };

/* ============ sheet ============ */
function openSheet(y,m,d,catId){
  var cat=catById(catId||S.prefs.cat);
  V.sheet={y:y,m:m,d:d,cat:cat.id};
  $("#sh-cat").textContent=cat.name;
  $("#sh-date").textContent=new Date(y,m,d).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"});
  $("#sh-note").value=getNote(cat.id,y,m,d);
  var wrap=$("#sh-chips"); wrap.innerHTML="";
  cat.stops.forEach(function(s,i){
    var b=document.createElement("button");
    b.className="chip"; b.type="button"; b.dataset.to=s.to;
    b.innerHTML='<i class="sw" style="background:'+col(s)+'"></i>'+esc(s.l);
    b.onclick=function(){
      set(cat.id,y,m,d, cat.numeric ? cat.floors[i] : Math.min(s.to,cat.max));
      syncSheet(); render();
    };
    wrap.appendChild(b);
  });
  syncSheet(); scrim.classList.add("on"); sheet.classList.add("on");
}
function syncSheet(){
  if(!V.sheet) return;
  var s=V.sheet, cat=catById(s.cat), v=get(cat.id,s.y,s.m,s.d);
  $("#sh-val").textContent = v===undefined ? "—" : (cat.numeric ? v.toLocaleString() : v);
  $("#sh-lbl").textContent = v===undefined ? "Not logged" : stopFor(cat,v).l+(cat.unit?" · "+cat.unit:"");
  Array.prototype.forEach.call($("#sh-chips").children,function(b){
    b.setAttribute("aria-pressed", v!==undefined && String(stopFor(cat,v).to)===b.dataset.to ? "true":"false");
  });
}
$("#sh-plus").onclick=function(){ var s=V.sheet; nudgeCat(catById(s.cat),s.y,s.m,s.d,1) };
$("#sh-minus").onclick=function(){ var s=V.sheet; nudgeCat(catById(s.cat),s.y,s.m,s.d,-1) };
$("#sh-clear").onclick=function(){
  var s=V.sheet;
  set(s.cat,s.y,s.m,s.d,undefined); setNote(s.cat,s.y,s.m,s.d,"");
  $("#sh-note").value=""; syncSheet(); render();
};
function closeSheet(){
  if(V.sheet){ var s=V.sheet; setNote(s.cat,s.y,s.m,s.d,$("#sh-note").value.trim()) }
  V.sheet=null; scrim.classList.remove("on"); sheet.classList.remove("on"); render();
}
$("#sh-done").onclick=closeSheet;
scrim.onclick=closeSheet;

/* ============ settings ============ */
var newCat={name:"", tpl:"level", hue:HUES[2]};
function renderSettings(){
  var body=$("#setbody"), cats=allCats();
  var catRows=cats.map(function(c){
    var hidden=S.prefs.hidden.indexOf(c.id)>=0;
    return '<div class="row">'+
      '<i class="sw" style="background:'+col(stopFor(c,c.def))+'"></i>'+
      '<span class="nm">'+esc(c.name)+(c.custom?'<span class="sub">Your category</span>':'')+'</span>'+
      (c.custom?'<button class="act dngr" data-del="'+esc(c.id)+'">Delete</button>':'')+
      '<button class="toggle" data-tog="'+esc(c.id)+'" aria-pressed="'+(!hidden)+'" aria-label="Show '+esc(c.name)+'"></button>'+
    '</div>';
  }).join("");
  var hueBtns=HUES.map(function(h){
    return '<button class="hue" data-hue="'+h+'" aria-pressed="'+(newCat.hue===h)+'" style="background:'+hsl(h,48,47)+'"></button>';
  }).join("");
  var tplOpts=Object.keys(TEMPLATES).map(function(t){
    return '<option value="'+t+'"'+(newCat.tpl===t?" selected":"")+'>'+TEMPLATES[t].name+'</option>';
  }).join("");

  body.innerHTML=
   '<div class="sec"><h5>Categories</h5><div class="rows">'+catRows+'</div>'+
     '<p class="hint">Turning one off hides it everywhere. Nothing you logged is deleted. The order here is the order of the bands in Month view.</p></div>'+
   '<div class="sec"><h5>Add a category</h5>'+
     '<div class="field"><label for="ncname">Name</label>'+
       '<input id="ncname" type="text" maxlength="18" placeholder="Meditation" value="'+esc(newCat.name)+'"></div>'+
     '<div class="field"><label for="nctpl">How it works</label><select id="nctpl">'+tplOpts+'</select></div>'+
     '<div class="field"><label>Colour</label><div class="hues">'+hueBtns+'</div></div>'+
     '<div class="field"><button class="btn" id="ncadd">Add category</button></div></div>'+
   '<div class="sec"><h5>Display</h5><div class="rows">'+
     '<div class="row"><span class="nm">Distinct marks<span class="sub">A dot on the alert levels, so the scale still reads without colour</span></span>'+
     '<button class="toggle" id="tmarks" aria-pressed="'+S.prefs.marks+'" aria-label="Distinct marks"></button></div></div></div>'+
   '<div class="sec"><h5>Your data</h5><div class="rows">'+
     '<div class="row"><span class="nm">Export a backup<span class="sub">A single file with everything in it</span></span><button class="act" id="doexp">Export</button></div>'+
     '<div class="row"><span class="nm">Restore from a backup<span class="sub">Replaces what is on this phone</span></span><button class="act" id="doimp">Import</button></div>'+
     '<div class="row"><span class="nm">Erase everything<span class="sub">Cannot be undone</span></span><button class="act dngr" id="doclr">Erase</button></div>'+
   '</div><p class="hint">Daybook keeps everything on this phone — there is no account and nothing is uploaded. That also means a lost phone is a lost year, so export a backup now and then.</p></div>'+
   '<div class="sec"><h5>About</h5><p class="hint">Daybook v1 · '+countDays()+' days logged across '+cats.length+' categories.</p></div>';

  Array.prototype.forEach.call(body.querySelectorAll("[data-tog]"),function(b){
    b.onclick=function(){
      var id=b.dataset.tog, i=S.prefs.hidden.indexOf(id);
      if(i>=0) S.prefs.hidden.splice(i,1);
      else{
        if(visibleCats().length<=1){ toast("Keep at least one category."); return }
        S.prefs.hidden.push(id);
      }
      save(); renderSettings();
    };
  });
  Array.prototype.forEach.call(body.querySelectorAll("[data-del]"),function(b){
    b.onclick=function(){
      var id=b.dataset.del;
      if(!confirm("Delete this category and everything logged in it?")) return;
      S.custom=S.custom.filter(function(c){ return c.id!==id });
      delete S.data[id]; delete S.notes[id];
      S.prefs.hidden=S.prefs.hidden.filter(function(x){ return x!==id });
      save(); renderSettings(); toast("Category deleted.");
    };
  });
  Array.prototype.forEach.call(body.querySelectorAll("[data-hue]"),function(b){
    b.onclick=function(){ newCat.hue=+b.dataset.hue; newCat.name=body.querySelector("#ncname").value; renderSettings() };
  });
  body.querySelector("#nctpl").onchange=function(e){ newCat.tpl=e.target.value };
  body.querySelector("#ncname").oninput=function(e){ newCat.name=e.target.value };
  body.querySelector("#ncadd").onclick=function(){
    var nm=(body.querySelector("#ncname").value||"").trim();
    if(!nm){ toast("Give it a name first."); return }
    var id="c"+Date.now().toString(36);
    S.custom.push({id:id,name:nm,tpl:newCat.tpl,hue:newCat.hue});
    newCat={name:"",tpl:"level",hue:HUES[2]};
    S.prefs.cat=id; save(); renderSettings(); toast("Added “"+nm+"”.");
  };
  body.querySelector("#tmarks").onclick=function(){ S.prefs.marks=!S.prefs.marks; save(); renderSettings() };
  body.querySelector("#doexp").onclick=exportData;
  body.querySelector("#doimp").onclick=function(){ $("#importfile").click() };
  body.querySelector("#doclr").onclick=function(){
    if(!confirm("Erase every day you have logged? This cannot be undone.")) return;
    if(!confirm("Really erase everything?")) return;
    S=blank(); S.prefs.seen=true; save(); renderSettings(); toast("Everything erased.");
  };
}
function countDays(){ var n=0; for(var c in S.data) n+=Object.keys(S.data[c]).length; return n }

/* ============ export / import ============ */
function stamp(){ var n=new Date(), p=function(x){ return String(x).padStart(2,"0") };
  return n.getFullYear()+"-"+p(n.getMonth()+1)+"-"+p(n.getDate()) }
function exportData(){
  var json=JSON.stringify(S,null,2), name="daybook-backup-"+stamp()+".json";
  try{
    var file=new File([json],name,{type:"application/json"});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:"Daybook backup"})
        .then(function(){ toast("Backup shared.") }).catch(function(){});
      return;
    }
  }catch(e){}
  var blob=new Blob([json],{type:"application/json"}), url=URL.createObjectURL(blob);
  var a=document.createElement("a"); a.href=url; a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove() },1500);
  toast("Backup saved.");
}
$("#importfile").onchange=function(e){
  var f=e.target.files&&e.target.files[0];
  if(!f) return;
  var r=new FileReader();
  r.onload=function(){
    try{
      var o=JSON.parse(r.result);
      if(!o || typeof o!=="object" || !o.data) throw new Error("bad");
      if(!confirm("Replace everything on this phone with this backup?")) return;
      var b=blank();
      S={v:1,data:o.data||{},notes:o.notes||{},custom:o.custom||[],
         prefs:Object.assign(b.prefs,o.prefs||{},{seen:true})};
      if(!Array.isArray(S.prefs.hidden)) S.prefs.hidden=[];
      save(); renderSettings(); toast("Backup restored.");
    }catch(err){ toast("That file isn't a Daybook backup.") }
  };
  r.readAsText(f); e.target.value="";
};

/* ============ welcome / boot ============ */
(function(){
  var standalone = window.navigator.standalone===true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if(/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone) $("#a2hs").hidden=false;
})();
$("#start").onclick=function(){ S.prefs.seen=true; save(); showView("v-app"); render() };

if(S.prefs.year && S.prefs.year<=T.y) V.f.y=S.prefs.year;
if(S.prefs.seen){ showView("v-app"); render() } else { showView("v-welcome") }

document.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="visible"){
    var before=T.y+"-"+T.m+"-"+T.d;
    refreshToday();
    if(before!==T.y+"-"+T.m+"-"+T.d && $("#v-app").classList.contains("on")) render();
  }
});
if(window.matchMedia){
  var mq=window.matchMedia("(prefers-color-scheme: dark)");
  var onScheme=function(){
    if($("#v-app").classList.contains("on")) render();
    if($("#v-set").classList.contains("on")) renderSettings();
  };
  if(mq.addEventListener) mq.addEventListener("change",onScheme);
  else if(mq.addListener) mq.addListener(onScheme);
}
if("serviceWorker" in navigator && location.protocol!=="file:"){
  window.addEventListener("load",function(){ navigator.serviceWorker.register("sw.js").catch(function(){}) });
}
})();
