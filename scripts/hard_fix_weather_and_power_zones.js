import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function write(file, data) {
  fs.writeFileSync(file, data);
}

const header = `
<header class="tsl-site-header">
  <a class="tsl-brand" href="index.html">
    <div class="tsl-logo">TSL</div>
    <div>
      <div class="tsl-brand-title">The Slip Lab</div>
      <div class="tsl-brand-subtitle">MLB Home Run Intelligence</div>
    </div>
  </a>

  <nav class="tsl-pill-nav">
    <a class="tsl-pill-link" href="index.html">Home</a>
    <a class="tsl-pill-link" href="index.html#top-plays">Top Plays</a>
    <a class="tsl-pill-link" href="index.html#value-plays">Value</a>
    <a class="tsl-pill-link" href="power-zones.html">Power Zones</a>
    <a class="tsl-pill-link" href="index.html#stacks">Stacks</a>
    <a class="tsl-pill-link" href="slate.html">Slate</a>
    <a class="tsl-pill-link" href="weather.html">Weather</a>
    <a class="tsl-pill-link" href="results.html">Results</a>
  </nav>
</header>
`;

const weatherHtml = read(path.join(ROOT, "weather.html"));
let weatherMain = "";

const mainMatch = weatherHtml.match(/<main[\s\S]*?<\/main>/i);
if (mainMatch) {
  weatherMain = mainMatch[0];
} else {
  const firstGood = weatherHtml.search(/<section|<div class="summary|<div class="weather|<div class="weather-grid|<div class="card/i);
  const bodyClose = weatherHtml.search(/<\/body>/i);

  if (firstGood > -1 && bodyClose > firstGood) {
    weatherMain = `<main class="weather-page">${weatherHtml.slice(firstGood, bodyClose)}</main>`;
  } else {
    weatherMain = `<main class="weather-page">
      <section class="weather-summary">
        <p class="eyebrow">Ballpark Weather</p>
        <h1>Weather Board</h1>
        <p>Live weather layout is loading.</p>
      </section>
      <section id="weatherGrid" class="weather-grid"></section>
    </main>`;
  }
}

weatherMain = weatherMain.replace(/\\n/g, "");
weatherMain = weatherMain.replace(/<header[\s\S]*?<\/header>/gi, "");
weatherMain = weatherMain.replace(/^\s*(TSL|The Slip Lab|MLB Home Run Intelligence|Home|Top Plays|Value|Power Zones|Stacks|Slate|Weather|Results|\s|<br\s*\/?>)+/i, "");

write(path.join(ROOT, "weather.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Slip Lab | Weather</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="stylesheet" href="weather.css" />
</head>
<body>
${header}
${weatherMain}
</body>
</html>
`);

write(path.join(ROOT, "power-zones.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Slip Lab | Power Zones</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="stylesheet" href="power-zones.css" />
</head>
<body>
${header}

<main class="pz-page">
  <section class="pz-hero">
    <div>
      <p class="eyebrow">The Slip Lab</p>
      <h1>Power Zones</h1>
      <p>Daily HR power profile board built around hitter damage, pitcher vulnerability, park context, weather, and matchup strength.</p>
    </div>

    <div class="pz-actions">
      <span id="pzUpdated">Loading data</span>
      <button id="pzRefresh">Refresh</button>
    </div>
  </section>

  <section class="pz-controls">
    <input id="pzSearch" placeholder="Search player, team, pitcher, park..." />
    <div class="pz-tabs">
      <button class="pz-filter active" data-filter="ALL">All</button>
      <button class="pz-filter" data-filter="CORE">Core</button>
      <button class="pz-filter" data-filter="DANGER">Danger</button>
      <button class="pz-filter" data-filter="VALUE">Value</button>
      <button class="pz-filter" data-filter="SLEEPER">Sleeper</button>
    </div>
    <select id="pzSort">
      <option value="score">Sort by Slip Score</option>
      <option value="hr">Sort by HR</option>
      <option value="iso">Sort by ISO</option>
      <option value="slg">Sort by SLG</option>
    </select>
  </section>

  <section id="pzGrid" class="pz-grid"></section>
</main>

<div id="pzDrawer" class="pz-drawer" aria-hidden="true">
  <div class="pz-drawer-backdrop" id="pzCloseBackdrop"></div>
  <aside class="pz-drawer-panel">
    <button id="pzClose" class="pz-close">×</button>
    <div id="pzDrawerContent"></div>
  </aside>
</div>

<script src="power-zones.js?v=hard-reset-1"></script>
</body>
</html>
`);

write(path.join(ROOT, "power-zones.js"), `
const DATA_URL = "./data/power_zones.json?ts=" + Date.now();

let allRows = [];
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

function initials(name = "") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "TSL";
}

function fmt(value, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function decimal(value) {
  if (value === null || value === undefined || value === "") return ".000";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(3).replace(/^0/, "");
}

function pct(value) {
  if (value === null || value === undefined || value === "") return "0.0%";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(1) + "%";
}

function score(row) {
  const n = Number(row.score || row.slip_score || row.power_score || 0);
  return Number.isFinite(n) ? n : 0;
}

function grade(row) {
  return String(row.grade || row.tier || row.raw_tier || "CORE").toUpperCase();
}

function headshot(row) {
  return row.headshot_url || row.headshot || row.player_image || row.mlb_headshot_url || "";
}

function photo(row, size = "small") {
  const url = headshot(row);
  const fallback = initials(row.player || row.name);

  if (!url) return '<div class="pz-avatar ' + size + '">' + fallback + '</div>';

  return '<div class="pz-photo-wrap ' + size + '"><img src="' + url + '" alt="' + (row.player || "Player") + '" onerror="this.parentElement.outerHTML=\\'<div class=&quot;pz-avatar ' + size + '&quot;>' + fallback + '</div>\\'"></div>';
}

function matchRow(row) {
  const q = search.value.trim().toLowerCase();
  const g = grade(row);

  if (activeFilter !== "ALL" && g !== activeFilter) return false;
  if (!q) return true;

  return [
    row.player,
    row.name,
    row.team,
    row.opponent,
    row.pitcher,
    row.venue,
    row.game
  ].some(value => String(value || "").toLowerCase().includes(q));
}

function sortedRows(rows) {
  const key = sort.value;

  return [...rows].sort((a, b) => {
    if (key === "hr") return Number(b.hr || 0) - Number(a.hr || 0);
    if (key === "iso") return Number(b.iso || 0) - Number(a.iso || 0);
    if (key === "slg") return Number(b.slg || 0) - Number(a.slg || 0);
    return score(b) - score(a);
  });
}

function card(row) {
  const g = grade(row);

  return \`
    <article class="pz-card" data-player="\${row.player || row.name || ""}">
      <div class="pz-card-top">
        \${photo(row)}
        <div>
          <h3>\${row.player || row.name || "Unknown Player"}</h3>
          <p>\${row.team || "Team"} • #\${fmt(row.lineup, "-")} Spot</p>
        </div>
        <span class="pz-grade">\${g}</span>
      </div>

      <div class="pz-zone">⚡ \${fmt(row.zone, "Power Zone")}</div>

      <div class="pz-stat-grid">
        <div><span>HR</span><strong>\${fmt(row.hr)}</strong></div>
        <div><span>ISO</span><strong>\${decimal(row.iso)}</strong></div>
        <div><span>SLG</span><strong>\${decimal(row.slg)}</strong></div>
      </div>

      <div class="pz-pitcher">
        <span>Vs Today's Pitcher</span>
        <strong>\${fmt(row.pitcher, "Unknown Pitcher")}</strong>
        <div class="pz-tags">
          <em>\${fmt(row.pitcher_hand, "P")}</em>
          <em>\${fmt(row.era, "ERA N/A")}</em>
          <em>\${fmt(row.odds, "Odds N/A")}</em>
          <em>Score \${score(row).toFixed(1)}</em>
        </div>
      </div>

      <div class="pz-card-bottom">
        <small>\${fmt(row.game, "")}</small>
        <button class="pz-profile">Profile</button>
      </div>
    </article>
  \`;
}

function render() {
  const rows = sortedRows(allRows.filter(matchRow));

  if (!rows.length) {
    grid.innerHTML = '<div class="pz-empty">No Power Zones match this search.</div>';
    return;
  }

  grid.innerHTML = rows.map(card).join("");

  document.querySelectorAll(".pz-card").forEach(cardEl => {
    cardEl.addEventListener("click", () => {
      const player = cardEl.getAttribute("data-player");
      const row = allRows.find(r => String(r.player || r.name) === player);
      if (row) openDrawer(row);
    });
  });
}

function openDrawer(row) {
  drawerContent.innerHTML = \`
    <div class="pz-drawer-head">
      \${photo(row, "large")}
      <div>
        <h2>\${row.player || row.name}</h2>
        <p>\${row.team || ""} • \${grade(row)} • vs \${row.pitcher || "Pitcher N/A"}</p>
      </div>
      <strong class="pz-drawer-score">\${score(row).toFixed(1)}</strong>
    </div>

    <div class="pz-drawer-stats">
      <div><span>ISO</span><strong>\${decimal(row.iso)}</strong></div>
      <div><span>SLG</span><strong>\${decimal(row.slg)}</strong></div>
      <div><span>HR</span><strong>\${fmt(row.hr)}</strong></div>
      <div><span>Odds</span><strong>\${fmt(row.odds, "N/A")}</strong></div>
      <div><span>Barrel</span><strong>\${pct(row.barrel_pct)}</strong></div>
      <div><span>Hard Hit</span><strong>\${pct(row.hard_hit_pct)}</strong></div>
    </div>

    <section class="pz-read">
      <h3>Slip Lab Read</h3>
      <p>\${row.player || row.name} grades as \${grade(row)} with a Slip Score of \${score(row).toFixed(1)}. The profile is built from power output, matchup strength, pitcher vulnerability, odds context, and game environment.</p>
    </section>
  \`;

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

async function loadData() {
  grid.innerHTML = '<div class="pz-empty">Loading Power Zones...</div>';
  updated.textContent = "Loading data";

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load power_zones.json");

    const data = await res.json();
    allRows = Array.isArray(data) ? data : data.rows || data.players || [];

    updated.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    render();
  } catch (err) {
    console.error(err);
    updated.textContent = "Data error";
    grid.innerHTML = '<div class="pz-empty">Power Zones data could not load. Check data/power_zones.json.</div>';
  }
}

document.querySelectorAll(".pz-filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pz-filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    render();
  });
});

search.addEventListener("input", render);
sort.addEventListener("change", render);
refresh.addEventListener("click", loadData);
closeBtn.addEventListener("click", closeDrawer);
closeBackdrop.addEventListener("click", closeDrawer);

loadData();
`);

const pzCss = `
.pz-page {
  min-height: 100vh;
  padding: 34px max(24px, 14vw);
  background:
    radial-gradient(circle at 8% 0%, rgba(16,255,124,.13), transparent 38%),
    radial-gradient(circle at 95% 4%, rgba(133,44,255,.14), transparent 36%),
    #05070d;
  color: #fff;
}

.pz-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 10px;
  color: #10ff7c;
  text-transform: uppercase;
  letter-spacing: .18em;
  font-size: 12px;
  font-weight: 950;
}

.pz-hero h1 {
  margin: 0 0 8px;
  font-size: clamp(38px,5vw,62px);
  line-height: .92;
}

.pz-hero p {
  max-width: 760px;
  margin: 0;
  color: rgba(255,255,255,.66);
  font-weight: 750;
}

.pz-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255,255,255,.62);
  font-weight: 900;
}

#pzRefresh,
.pz-profile {
  border: 1px solid rgba(255,128,40,.5);
  color: #ff8a2a;
  background: rgba(255,128,40,.11);
  border-radius: 10px;
  padding: 10px 13px;
  font-weight: 950;
  cursor: pointer;
}

.pz-controls {
  display: grid;
  grid-template-columns: 1fr auto 220px;
  gap: 14px;
  align-items: center;
  margin-bottom: 26px;
}

#pzSearch,
#pzSort {
  width: 100%;
  border: 1px solid rgba(255,255,255,.11);
  background: rgba(255,255,255,.06);
  color: #fff;
  border-radius: 14px;
  padding: 15px;
  font-weight: 800;
}

.pz-tabs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pz-filter {
  border: 1px solid rgba(255,255,255,.13);
  background: rgba(255,255,255,.07);
  color: #fff;
  border-radius: 999px;
  padding: 13px 16px;
  font-weight: 950;
  cursor: pointer;
}

.pz-filter.active,
.pz-filter:hover {
  color: #10ff7c;
  border-color: rgba(16,255,124,.5);
  background: rgba(16,255,124,.13);
}

.pz-grid {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 18px;
}

.pz-card,
.pz-empty {
  border: 1px solid rgba(255,255,255,.1);
  background: linear-gradient(140deg, rgba(255,255,255,.07), rgba(16,255,124,.06));
  border-radius: 20px;
  padding: 18px;
}

.pz-card {
  cursor: pointer;
}

.pz-card-top {
  display: grid;
  grid-template-columns: 54px 1fr auto;
  gap: 14px;
  align-items: center;
}

.pz-card h3 {
  margin: 0 0 4px;
  font-size: 20px;
}

.pz-card p {
  margin: 0;
  color: rgba(255,255,255,.58);
  font-weight: 850;
}

.pz-avatar,
.pz-photo-wrap {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #10ffcf;
  color: #04100a;
  display: grid;
  place-items: center;
  font-weight: 950;
  overflow: hidden;
}

.pz-photo-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pz-avatar.large,
.pz-photo-wrap.large {
  width: 78px;
  height: 78px;
}

.pz-grade {
  border: 1px solid rgba(16,255,124,.45);
  background: rgba(16,255,124,.12);
  color: #10ff7c;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 950;
}

.pz-zone {
  display: inline-block;
  margin: 14px 0;
  border: 1px solid rgba(255,198,41,.45);
  background: rgba(255,198,41,.12);
  color: #ffc629;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 950;
}

.pz-stat-grid,
.pz-drawer-stats {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 8px;
}

.pz-stat-grid div,
.pz-drawer-stats div {
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(255,255,255,.055);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}

.pz-stat-grid span,
.pz-drawer-stats span,
.pz-pitcher span {
  display: block;
  color: rgba(255,255,255,.52);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .09em;
}

.pz-stat-grid strong,
.pz-drawer-stats strong {
  display: block;
  margin-top: 4px;
  font-size: 17px;
}

.pz-pitcher {
  border-top: 1px solid rgba(255,255,255,.08);
  margin-top: 14px;
  padding-top: 14px;
}

.pz-pitcher strong {
  display: block;
  margin: 6px 0;
  font-size: 18px;
}

.pz-tags {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.pz-tags em {
  font-style: normal;
  background: rgba(255,255,255,.08);
  border-radius: 7px;
  padding: 6px 8px;
  color: rgba(255,255,255,.7);
  font-size: 12px;
  font-weight: 900;
}

.pz-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  gap: 10px;
}

.pz-card-bottom small {
  color: rgba(255,255,255,.55);
}

.pz-empty {
  grid-column: 1 / -1;
  color: rgba(255,255,255,.72);
  font-weight: 950;
  min-height: 140px;
  display: grid;
  place-items: center;
}

.pz-drawer {
  display: none;
}

.pz-drawer.open {
  display: block;
}

.pz-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.62);
  backdrop-filter: blur(10px);
  z-index: 99998;
}

.pz-drawer-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: min(560px, 100vw);
  height: 100vh;
  overflow: auto;
  z-index: 99999;
  background: radial-gradient(circle at top, rgba(103,35,145,.42), #070911 46%);
  border-left: 1px solid rgba(255,255,255,.12);
  padding: 32px;
  color: #fff;
}

.pz-close {
  position: absolute;
  right: 20px;
  top: 18px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.08);
  color: #fff;
  border-radius: 10px;
  font-size: 22px;
  cursor: pointer;
}

.pz-drawer-head {
  display: grid;
  grid-template-columns: 82px 1fr auto;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
}

.pz-drawer-head h2 {
  margin: 0;
  font-size: 30px;
}

.pz-drawer-head p {
  margin: 4px 0 0;
  color: rgba(255,255,255,.62);
  font-weight: 800;
}

.pz-drawer-score {
  color: #ff5c93;
  border: 1px solid rgba(255,92,147,.5);
  padding: 12px;
  border-radius: 14px;
}

.pz-read {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 18px;
  padding: 18px;
  margin-top: 18px;
  background: rgba(0,0,0,.24);
}

.pz-read h3 {
  margin: 0 0 10px;
  color: #ff8a2a;
}

.pz-read p {
  color: rgba(255,255,255,.78);
  font-weight: 750;
  line-height: 1.55;
}

@media (max-width: 1100px) {
  .pz-page {
    padding: 24px;
  }

  .pz-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .pz-controls {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .pz-grid {
    grid-template-columns: 1fr;
  }

  .pz-hero {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;

write(path.join(ROOT, "power-zones.css"), pzCss);

console.log("Weather page top cleaned.");
console.log("Power Zones page and JS hard reset.");
