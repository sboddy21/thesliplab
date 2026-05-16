const DATA_URL = "https://raw.githubusercontent.com/sboddy21/mlb-sweeper/main/website/data/power_zones.json?ts=" + Date.now();

let allRows = [];
let rankedRows = [];
let activeFilter = "ALL";

const grid = document.getElementById("pzGrid");
const search = document.getElementById("pzSearch");
const sort = document.getElementById("pzSort");
const updated = document.getElementById("pzUpdated");
const refresh = document.getElementById("pzRefresh");
const drawer = document.getElementById("pzDrawer");
const drawerContent = document.getElementById("pzDrawerContent");
const closeBtn = document.getElementById("pzClose");
const closeBackdrop = document.getElementById("pzCloseBackdrop");

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function blank(v){if(v===null||v===undefined)return true;const t=String(v).trim();return !t||["#","-","--","n/a","na","nan","null","undefined","pending","live pending"].includes(t.toLowerCase());}
function clean(v,f=""){return blank(v)?(blank(f)?"":String(f)):String(v).trim();}
function n(v,f=0){const x=Number(String(v??"").replace("%",""));return Number.isFinite(x)?x:f;}
function dec(v){if(blank(v))return "";const x=Number(v);return Number.isFinite(x)?x.toFixed(3).replace(/^0/,""):clean(v);}
function score(r){const x=Number(r.score||r.slip_score||r.power_score||r.consensus_score||0);return Number.isFinite(x)?x:0;}
function grade(r){const rank=Number(r.power_rank||9999);if(rank<=25)return"CORE";if(rank<=75)return"DANGER";if(rank<=150)return"VALUE";return"SLEEPER";}
function lineupValue(r){return clean(r.lineup||r.batting_order||r.batting_spot||r.lineup_spot||r.spot||r.projected_lineup_spot||"");}
function lineupText(r){const spot=lineupValue(r);if(spot)return`#${spot} Spot`;return"Spot pending";}
function initials(name=""){return String(name).split(" ").filter(Boolean).slice(0,2).map(p=>p[0]).join("").toUpperCase()||"TSL";}
function photo(r){const url=r.headshot_url||r.headshot||r.player_image||"";const fb=initials(r.player||r.name);if(!url)return`<div class="pz-profile-photo" style="width:54px;height:54px;border-radius:999px;display:grid;place-items:center;background:#10ffcf;color:#04100a;font-weight:950;overflow:hidden;">${fb}</div>`;return`<div class="pz-profile-photo" style="width:54px;height:54px;border-radius:999px;overflow:hidden;background:#10ffcf;"><img src="${esc(url)}" alt="${esc(r.player||"Player")}" onerror="this.parentElement.textContent='${fb}'"></div>`;}
function card(row){return`<article class="pz-card" data-player="${esc(row.player||row.name||"")}"><div class="pz-card-top">${photo(row)}<div><h3>${esc(row.player||row.name||"Unknown Player")}</h3><p>${esc(clean(row.team,"Team"))} • ${esc(lineupText(row))}</p></div><span class="pz-grade">${grade(row)}</span></div><div class="pz-zone">⚡ ${esc(clean(row.zone,"Power Zone"))}</div><div class="pz-stat-grid"><div><span>HR</span><strong>${esc(clean(row.hr,"0"))}</strong></div><div><span>ISO</span><strong>${esc(dec(row.iso)||".000")}</strong></div><div><span>SLG</span><strong>${esc(dec(row.slg)||".000")}</strong></div></div><div class="pz-pitcher"><span>Vs Today's Pitcher</span><strong>${esc(clean(row.pitcher,"Pitcher Pending"))}</strong></div><div class="pz-card-bottom"><small>${esc(clean(row.game,""))}</small><button class="pz-profile" type="button">Profile</button></div></article>`;}
function matchRow(row){const q=normalize(search.value);if(activeFilter!=="ALL"&&grade(row)!==activeFilter)return false;if(!q)return true;return[row.player,row.name,row.team,row.opponent,row.pitcher,row.venue,row.game].some(v=>normalize(v).includes(q));}
function sortedRows(rows){const key=sort.value;return[...rows].sort((a,b)=>{if(key==="hr")return n(b.hr)-n(a.hr);if(key==="iso")return n(b.iso)-n(a.iso);if(key==="slg")return n(b.slg)-n(a.slg);return score(b)-score(a);});}
function render(){const rows=sortedRows(rankedRows.filter(matchRow));if(!rows.length){grid.innerHTML='<div class="pz-empty">No Power Zones match this search.</div>';return;}grid.innerHTML=rows.map(card).join("");}
async function loadData(){grid.innerHTML='<div class="pz-empty">Loading Power Zones...</div>';updated.textContent="Loading data";try{const res=await fetch(DATA_URL,{cache:"no-store"});if(!res.ok)throw new Error("Failed to load power_zones.json");const data=await res.json();allRows=Array.isArray(data)?data:data.rows||data.players||[];rankedRows=[...allRows].sort((a,b)=>score(b)-score(a)).map((row,index)=>({...row,power_rank:index+1}));updated.textContent=`Live ${new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})} • ${rankedRows.length} bats`;render();}catch(err){console.error(err);updated.textContent="Data error";grid.innerHTML='<div class="pz-empty">Power Zones data could not load. Check data/power_zones.json.</div>';}}
document.querySelectorAll(".pz-filter").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".pz-filter").forEach(b=>b.classList.remove("active"));btn.classList.add("active");activeFilter=String(btn.dataset.filter||"ALL").toUpperCase();render();}));
search.addEventListener("input",render);
sort.addEventListener("change",render);
refresh.addEventListener("click",loadData);
closeBtn?.addEventListener("click",()=>drawer.classList.remove("open"));
closeBackdrop?.addEventListener("click",()=>drawer.classList.remove("open"));
loadData();