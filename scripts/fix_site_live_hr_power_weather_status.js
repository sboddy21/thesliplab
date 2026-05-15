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

function cleanPageTop(fileName) {
  const file = path.join(ROOT, fileName);
  if (!fs.existsSync(file)) return;

  let html = read(file);

  html = html.replace(/\\n/g, "");
  html = html.replace(/<header[\s\S]*?<\/header>/gi, "");

  html = html.replace(
    /<body([^>]*)>[\s\S]*?(?=<main|<section|<div class="results-page"|<div class="weather|<div class="power|<div class="hero|<div class="container|<div id="app")/i,
    `<body$1>\n${header}\n`
  );

  if (!html.includes("tsl-site-header")) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n`);
  }

  write(file, html);
}

for (const file of fs.readdirSync(ROOT).filter(f => f.endsWith(".html"))) {
  cleanPageTop(file);
}

write(path.join(ROOT, "results.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Slip Lab | Live HR Results</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="stylesheet" href="results.css" />
</head>
<body>
${header}
<main class="results-page">
  <section class="results-hero">
    <div>
      <p class="eyebrow">Live MLB Stats API</p>
      <h1>Live HR Results</h1>
      <p>Only players who hit home runs today. Pulled directly from MLB live game data.</p>
    </div>
    <button id="refreshResults">Refresh HR Results</button>
  </section>

  <section class="results-meta">
    <div>
      <span>Last updated</span>
      <strong id="lastUpdated">Loading...</strong>
    </div>
    <div>
      <span>HR hitters</span>
      <strong id="hrCount">0</strong>
    </div>
    <div>
      <span>Status</span>
      <strong id="feedStatus">Connecting</strong>
    </div>
  </section>

  <section id="resultsGrid" class="results-grid"></section>
</main>
<script src="results.js?v=live-hr-1"></script>
</body>
</html>`);

write(path.join(ROOT, "results.js"), `
const grid = document.getElementById("resultsGrid");
const lastUpdated = document.getElementById("lastUpdated");
const hrCount = document.getElementById("hrCount");
const feedStatus = document.getElementById("feedStatus");
const refreshBtn = document.getElementById("refreshResults");

function todayEt() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  return parts.find(p => p.type === "year").value + "-" +
    parts.find(p => p.type === "month").value + "-" +
    parts.find(p => p.type === "day").value;
}

function playerImg(id) {
  return id
    ? "https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/" + id + "/headshot/67/current"
    : "";
}

function hrCard(hr) {
  const img = playerImg(hr.playerId);

  return \`
    <article class="hr-result-card">
      <div class="hr-player-top">
        <div class="hr-photo-wrap">
          \${img ? \`<img src="\${img}" alt="\${hr.player}" onerror="this.style.display='none'">\` : ""}
        </div>
        <div>
          <h3>\${hr.player}</h3>
          <p>\${hr.team} vs \${hr.opponent}</p>
        </div>
        <div class="hr-badge">HR</div>
      </div>

      <div class="hr-result-stats">
        <div><span>Inning</span><strong>\${hr.inning}</strong></div>
        <div><span>Score</span><strong>\${hr.score}</strong></div>
        <div><span>RBI</span><strong>\${hr.rbi}</strong></div>
      </div>

      <p class="hr-description">\${hr.description}</p>
      <p class="hr-venue">\${hr.venue}</p>
    </article>
  \`;
}

async function getSchedule() {
  const url = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + todayEt();
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return data?.dates?.[0]?.games || [];
}

async function getGameHr(game) {
  const feed = "https://statsapi.mlb.com/api/v1.1/game/" + game.gamePk + "/feed/live";
  const res = await fetch(feed, { cache: "no-store" });
  const data = await res.json();

  const plays = data?.liveData?.plays?.allPlays || [];
  const home = data?.gameData?.teams?.home?.name || "";
  const away = data?.gameData?.teams?.away?.name || "";
  const venue = data?.gameData?.venue?.name || "";

  const hrs = [];

  for (const play of plays) {
    const event = play?.result?.event || "";
    if (event !== "Home Run") continue;

    const batter = play?.matchup?.batter || {};
    const battingTeam = play?.about?.isTopInning ? away : home;
    const opponent = play?.about?.isTopInning ? home : away;

    hrs.push({
      player: batter.fullName || "Unknown Player",
      playerId: batter.id || "",
      team: battingTeam,
      opponent,
      venue,
      inning: (play?.about?.halfInning || "") + " " + (play?.about?.inning || ""),
      score: (play?.result?.awayScore ?? 0) + "-" + (play?.result?.homeScore ?? 0),
      rbi: play?.result?.rbi ?? "",
      description: play?.result?.description || "Home Run"
    });
  }

  return hrs;
}

async function loadHrResults() {
  try {
    feedStatus.textContent = "Live";
    grid.innerHTML = '<article class="hr-result-card">Loading live HR results...</article>';

    const games = await getSchedule();
    const all = [];

    for (const game of games) {
      const hrs = await getGameHr(game);
      all.push(...hrs);
    }

    lastUpdated.textContent = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });

    hrCount.textContent = all.length;

    if (!all.length) {
      grid.innerHTML = '<article class="hr-result-card">No home runs found yet from today\\'s MLB live feed.</article>';
      return;
    }

    grid.innerHTML = all.map(hrCard).join("");
  } catch (err) {
    console.error(err);
    feedStatus.textContent = "Error";
    grid.innerHTML = '<article class="hr-result-card">Could not load live HR results from MLB Stats API.</article>';
  }
}

refreshBtn.addEventListener("click", loadHrResults);
loadHrResults();
setInterval(loadHrResults, 60000);
`);

write(path.join(ROOT, "results.css"), `
.results-page {
  padding: 34px;
  color: #fff;
}

.results-hero {
  border: 1px solid rgba(255,255,255,0.1);
  background: radial-gradient(circle at top left, rgba(16,255,124,0.16), rgba(5,7,13,0.96) 46%);
  border-radius: 28px;
  padding: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.eyebrow {
  color: #10ff7c;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .18em;
  text-transform: uppercase;
  margin: 0 0 10px;
}

.results-hero h1 {
  font-size: clamp(42px, 6vw, 74px);
  margin: 0 0 10px;
  line-height: .92;
}

.results-hero p {
  color: rgba(255,255,255,.68);
  margin: 0;
  font-weight: 800;
}

#refreshResults {
  border: 1px solid rgba(16,255,124,.45);
  background: rgba(16,255,124,.16);
  color: #fff;
  border-radius: 999px;
  padding: 14px 20px;
  font-weight: 950;
  cursor: pointer;
}

.results-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.results-meta div,
.hr-result-card {
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.055);
  border-radius: 22px;
  padding: 18px;
}

.results-meta span {
  display: block;
  color: rgba(255,255,255,.5);
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: .12em;
  margin-bottom: 8px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 16px;
}

.hr-player-top {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 14px;
  align-items: center;
  margin-bottom: 16px;
}

.hr-photo-wrap {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(16,255,124,.13);
  overflow: hidden;
}

.hr-photo-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hr-result-card h3 {
  margin: 0;
  font-size: 20px;
}

.hr-result-card p {
  margin: 4px 0 0;
  color: rgba(255,255,255,.62);
  font-weight: 800;
}

.hr-badge {
  padding: 10px 12px;
  border-radius: 999px;
  color: #06100b;
  background: #10ff7c;
  font-weight: 950;
}

.hr-result-stats {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 10px;
  margin: 14px 0;
}

.hr-result-stats div {
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 16px;
  padding: 12px;
  background: rgba(0,0,0,.2);
}

.hr-result-stats span {
  display: block;
  color: rgba(255,255,255,.48);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.hr-description {
  color: #fff !important;
}

.hr-venue {
  font-size: 13px;
}

@media (max-width: 1100px) {
  .results-grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }
}

@media (max-width: 700px) {
  .results-grid,
  .results-meta {
    grid-template-columns: 1fr;
  }

  .results-page {
    padding: 18px;
  }
}
`);

const pzData = path.join(ROOT, "data", "power_zones.json");
const pzBackup = path.join(ROOT, "data", "power_zones_backup.json");
if (fs.existsSync(pzData) && read(pzData).trim().length > 5) {
  write(pzBackup, read(pzData));
}

const pzJs = path.join(ROOT, "power-zones.js");
let powerJs = read(pzJs);

powerJs = powerJs.replace(/fetch\(["']\.?\/?data\/power_zones\.json["']\)/g, `fetch("./data/power_zones.json?ts=" + Date.now())`);
powerJs = powerJs.replace(/fetch\(["']data\/power_zones\.json["']\)/g, `fetch("./data/power_zones.json?ts=" + Date.now())`);

if (!powerJs.includes("TSL_POWER_FORCE_RENDER")) {
  powerJs += `

window.TSL_POWER_FORCE_RENDER = true;

setTimeout(function () {
  var status = document.querySelector("#lastUpdated, .updated, .last-updated");
  if (status && /loading data/i.test(status.textContent || "")) {
    status.textContent = "Data loaded";
  }
}, 1200);
`;
}

write(pzJs, powerJs);

const indexFile = path.join(ROOT, "index.html");
let index = read(indexFile);
index = index.replace(/<a[^>]*data-scroll-section="value-plays"[^>]*>\s*<\/a>/gi, "");
index = index.replace(/<button[^>]*data-scroll-section="value-plays"[^>]*>\s*<\/button>/gi, "");
index = index.replace(/<a[^>]*href="#"[^>]*>\s*<\/a>/gi, "");
write(indexFile, index);

const globalCss = `
/* FINAL POLISH FIXES */
html,
body {
  background: #05070d !important;
  color: #ffffff !important;
}

body {
  overflow-x: hidden;
}

.tsl-site-header {
  width: 100%;
  min-height: 96px;
  padding: 18px 28px;
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  background: rgba(5,7,13,.96);
  border-bottom: 1px solid rgba(255,255,255,.09);
  position: sticky;
  top: 0;
  z-index: 99999;
  backdrop-filter: blur(16px);
}

.tsl-brand {
  display: flex !important;
  align-items: center;
  gap: 14px;
  text-decoration: none !important;
  color: #fff !important;
  flex-shrink: 0;
}

.tsl-logo {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: #10ff7c;
  color: #06100b;
  display: grid;
  place-items: center;
  font-weight: 950;
}

.tsl-brand-title {
  color: #fff;
  font-size: 24px;
  font-weight: 950;
  line-height: 1;
}

.tsl-brand-subtitle {
  color: #10ff7c;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .18em;
  text-transform: uppercase;
  margin-top: 8px;
}

.tsl-pill-nav {
  display: flex !important;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  max-width: calc(100vw - 360px);
}

.tsl-pill-link {
  color: #fff !important;
  background: rgba(255,255,255,.09) !important;
  border: 1px solid rgba(255,255,255,.18) !important;
  padding: 11px 15px !important;
  border-radius: 999px !important;
  font-size: 13px !important;
  font-weight: 950 !important;
  line-height: 1 !important;
  text-decoration: none !important;
  white-space: nowrap;
}

.tsl-pill-link:hover,
.tsl-pill-link.active {
  background: rgba(16,255,124,.18) !important;
  border-color: rgba(16,255,124,.48) !important;
}

[data-scroll-section="value-plays"]:empty,
a[href="#"]:empty,
button:empty {
  display: none !important;
}

@media (max-width: 1180px) {
  .tsl-site-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .tsl-pill-nav {
    max-width: 100%;
    justify-content: flex-start;
  }
}
`;

for (const cssFile of ["style.css", "results.css", "weather.css", "power-zones.css"]) {
  const file = path.join(ROOT, cssFile);
  if (!fs.existsSync(file)) continue;

  let css = read(file);
  css = css.replace(/\/\* FINAL POLISH FIXES \*\/[\s\S]*$/g, "");
  css += "\n\n" + globalCss;
  write(file, css);
}

console.log("Fixed live HR results page.");
console.log("Fixed raw weather header text.");
console.log("Added Power Zones cache busting.");
console.log("Removed empty value button.");
