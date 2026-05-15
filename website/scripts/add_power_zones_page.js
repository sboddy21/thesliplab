import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Slip Lab Power Zones</title>
<link rel="stylesheet" href="./power-zones.css">
</head>
<body>
<header class="tsl-header">
  <a class="tsl-brand" href="/">
    <div class="tsl-logo">TSL</div>
    <div>
      <div class="tsl-name">The Slip Lab</div>
      <div class="tsl-sub">MLB HOME RUN INTELLIGENCE</div>
    </div>
  </a>

  <nav class="tsl-nav">
    <a href="/">HOME</a>
    <a href="/power-zones" class="active">POWER ZONES</a>
    <a href="/slate">SLATE</a>
    <a href="/weather">WEATHER</a>
    <a href="/results">RESULTS</a>
    <a href="/parlay">STACKS</a>
  </nav>
</header>

<main class="page">
  <section class="hero">
    <div>
      <div class="kicker">THE SLIP LAB</div>
      <h1>Power Zones</h1>
      <p>Daily HR power profile board built around hitter damage, pitcher vulnerability, park context, weather, and matchup strength.</p>
    </div>

    <div class="hero-actions">
      <div id="updatedAt" class="updated">Loading data</div>
      <button id="refreshBtn">Refresh</button>
    </div>
  </section>

  <section class="controls">
    <input id="searchInput" type="search" placeholder="Search player, team, pitcher, park..." />

    <div class="chips">
      <button class="chip active" data-filter="ALL">All</button>
      <button class="chip" data-filter="CORE">Core</button>
      <button class="chip" data-filter="DANGER">Danger</button>
      <button class="chip" data-filter="VALUE">Value</button>
      <button class="chip" data-filter="SLEEPER">Sleeper</button>
    </div>

    <select id="sortSelect">
      <option value="score">Sort by Slip Score</option>
      <option value="hr">Sort by HR</option>
      <option value="slg">Sort by SLG</option>
      <option value="iso">Sort by ISO</option>
      <option value="odds">Sort by Odds</option>
    </select>
  </section>

  <section id="cardsGrid" class="cards-grid"></section>
</main>

<div id="modalBackdrop" class="modal-backdrop">
  <aside class="player-modal">
    <button id="closeModal" class="close-btn">×</button>

    <section class="modal-top">
      <div class="avatar" id="modalInitials">TSL</div>
      <div>
        <h2 id="modalName">Player</h2>
        <p id="modalSub">Team • Matchup</p>
      </div>
      <div id="modalBadge" class="modal-score">0</div>
    </section>

    <section class="modal-metrics" id="modalMetrics"></section>

    <nav class="modal-tabs">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="matchup">Matchup</button>
      <button class="tab" data-tab="power">Power</button>
      <button class="tab" data-tab="weather">Weather</button>
    </nav>

    <section id="tabContent" class="tab-content"></section>
  </aside>
</div>

<script src="./power-zones.js"></script>
</body>
</html>`;

const css = `:root {
  --bg: #06070b;
  --panel: #0d0f17;
  --panel2: #111522;
  --line: rgba(255,255,255,.09);
  --text: #f4f7fb;
  --muted: rgba(244,247,251,.62);
  --green: #00ff88;
  --orange: #ff7a21;
  --yellow: #ffbd26;
  --red: #ff405d;
  --purple: #b86cff;
  --blue: #18c8ff;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(0,255,136,.10), transparent 35rem),
    radial-gradient(circle at top right, rgba(184,108,255,.12), transparent 34rem),
    var(--bg);
  color: var(--text);
  font-family: Inter, Arial, Helvetica, sans-serif;
}

.tsl-header {
  height: 78px;
  background: rgba(4,5,8,.94);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.tsl-brand {
  display: flex;
  align-items: center;
  gap: 13px;
  color: white;
  text-decoration: none;
}

.tsl-logo {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--green);
  color: #00190c;
  display: grid;
  place-items: center;
  font-weight: 950;
}

.tsl-name {
  font-size: 21px;
  font-weight: 950;
  letter-spacing: -.03em;
}

.tsl-sub {
  color: var(--green);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .15em;
}

.tsl-nav {
  display: flex;
  gap: 24px;
  align-items: center;
}

.tsl-nav a {
  color: rgba(255,255,255,.72);
  text-decoration: none;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .05em;
}

.tsl-nav a.active {
  color: var(--green);
}

.page {
  max-width: 1220px;
  margin: 0 auto;
  padding: 28px 18px 70px;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-end;
  margin-bottom: 24px;
}

.kicker {
  color: var(--green);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .18em;
}

h1 {
  margin: 8px 0;
  font-size: 42px;
  line-height: 1;
  letter-spacing: -.05em;
}

.hero p {
  margin: 0;
  color: var(--muted);
  max-width: 690px;
  font-size: 15px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.updated {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

button {
  font-family: inherit;
}

#refreshBtn {
  background: rgba(255,255,255,.06);
  border: 1px solid var(--line);
  color: white;
  border-radius: 11px;
  padding: 10px 14px;
  font-weight: 900;
  cursor: pointer;
}

.controls {
  display: grid;
  grid-template-columns: 1fr auto 190px;
  gap: 12px;
  margin-bottom: 22px;
}

input,
select {
  background: rgba(255,255,255,.045);
  border: 1px solid var(--line);
  color: white;
  border-radius: 12px;
  padding: 13px 14px;
  outline: none;
}

.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  border: 1px solid var(--line);
  background: rgba(255,255,255,.045);
  color: rgba(255,255,255,.72);
  border-radius: 999px;
  padding: 10px 13px;
  font-weight: 950;
  font-size: 12px;
  cursor: pointer;
}

.chip.active {
  background: rgba(0,255,136,.13);
  border-color: rgba(0,255,136,.55);
  color: var(--green);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.player-card {
  background:
    linear-gradient(145deg, rgba(255,255,255,.045), rgba(255,255,255,.015)),
    var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 17px;
  min-height: 240px;
  position: relative;
  overflow: hidden;
}

.player-card:before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(0,255,136,.10), transparent 13rem);
  pointer-events: none;
}

.card-head,
.card-sub,
.stat-grid,
.pitcher-box,
.card-foot {
  position: relative;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.player-name {
  font-size: 19px;
  font-weight: 950;
  cursor: pointer;
}

.player-name:hover {
  color: var(--green);
}

.zone-pill {
  border: 1px solid rgba(255,189,38,.45);
  background: rgba(255,189,38,.12);
  color: var(--yellow);
  border-radius: 7px;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 950;
  white-space: nowrap;
}

.grade-pill {
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
  border: 1px solid var(--line);
}

.grade-core { color: var(--green); border-color: rgba(0,255,136,.38); background: rgba(0,255,136,.10); }
.grade-danger { color: var(--red); border-color: rgba(255,64,93,.38); background: rgba(255,64,93,.10); }
.grade-value { color: var(--yellow); border-color: rgba(255,189,38,.38); background: rgba(255,189,38,.10); }
.grade-sleeper { color: var(--purple); border-color: rgba(184,108,255,.38); background: rgba(184,108,255,.10); }

.card-sub {
  color: var(--muted);
  margin-top: 8px;
  font-weight: 800;
  font-size: 13px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  margin: 16px 0;
}

.stat {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.045);
  border-radius: 8px;
  padding: 9px;
  text-align: center;
}

.stat span {
  display: block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: .08em;
}

.stat strong {
  display: block;
  margin-top: 4px;
  font-size: 15px;
}

.pitcher-box {
  border-top: 1px solid var(--line);
  padding-top: 13px;
}

.box-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: .12em;
  margin-bottom: 8px;
}

.pitcher-name {
  font-weight: 950;
}

.pitcher-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 7px;
}

.mini {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.05);
  border-radius: 6px;
  padding: 4px 6px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
}

.card-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 11px;
  margin-top: 14px;
}

.profile-btn {
  color: var(--orange);
  background: rgba(255,122,33,.09);
  border: 1px solid rgba(255,122,33,.45);
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 950;
  cursor: pointer;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.72);
  backdrop-filter: blur(8px);
  display: none;
  justify-content: flex-end;
  z-index: 100;
}

.modal-backdrop.open {
  display: flex;
}

.player-modal {
  width: min(620px, 100%);
  height: 100vh;
  overflow-y: auto;
  background:
    radial-gradient(circle at top right, rgba(184,108,255,.28), transparent 25rem),
    linear-gradient(180deg, #1a0822, #08090f 48%);
  border-left: 1px solid rgba(255,255,255,.12);
  padding: 22px;
  position: relative;
}

.close-btn {
  position: absolute;
  right: 18px;
  top: 14px;
  background: transparent;
  border: 1px solid rgba(255,255,255,.18);
  color: white;
  border-radius: 9px;
  width: 32px;
  height: 32px;
  font-size: 22px;
  cursor: pointer;
}

.modal-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-right: 38px;
}

.avatar {
  width: 58px;
  height: 58px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--green), var(--blue));
  color: #00170c;
  display: grid;
  place-items: center;
  font-weight: 950;
}

.modal-top h2 {
  margin: 0;
  font-size: 28px;
}

.modal-top p {
  margin: 5px 0 0;
  color: var(--muted);
}

.modal-score {
  margin-left: auto;
  border: 1px solid rgba(255,64,93,.55);
  background: rgba(255,64,93,.12);
  color: #ff7d8f;
  border-radius: 13px;
  padding: 9px 10px;
  font-weight: 950;
}

.modal-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 12px;
  overflow: hidden;
  margin: 20px 0 14px;
  background: rgba(0,0,0,.25);
}

.modal-metric {
  padding: 13px;
  text-align: center;
  border-right: 1px solid rgba(255,255,255,.08);
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.modal-metric:nth-child(4n) {
  border-right: 0;
}

.modal-metric span {
  display: block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: .08em;
}

.modal-metric strong {
  display: block;
  margin-top: 5px;
  color: var(--yellow);
}

.modal-tabs {
  display: flex;
  gap: 6px;
  background: rgba(255,255,255,.06);
  border-radius: 9px;
  padding: 5px;
  margin-bottom: 14px;
}

.tab {
  flex: 1;
  background: transparent;
  color: var(--muted);
  border: 0;
  border-radius: 7px;
  padding: 9px;
  font-weight: 950;
  cursor: pointer;
}

.tab.active {
  background: rgba(255,122,33,.15);
  color: white;
  outline: 1px solid rgba(255,122,33,.65);
}

.tab-card {
  background: rgba(0,0,0,.26);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 14px;
  padding: 16px;
}

.tab-card h3 {
  margin: 0 0 12px;
  color: var(--orange);
}

.tab-card p {
  color: rgba(255,255,255,.78);
  line-height: 1.55;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.detail {
  background: rgba(255,255,255,.045);
  border-radius: 10px;
  padding: 12px;
}

.detail span {
  color: var(--muted);
  display: block;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: .08em;
}

.detail strong {
  display: block;
  margin-top: 5px;
}

@media (max-width: 960px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .controls {
    grid-template-columns: 1fr;
  }

  .hero {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 620px) {
  .tsl-header {
    height: auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
  }

  .tsl-nav {
    flex-wrap: wrap;
    gap: 14px;
  }

  .cards-grid {
    grid-template-columns: 1fr;
  }

  .modal-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;

const js = `const DATA_CANDIDATES = [
  "./data/top_hr_plays.json",
  "./data/slate_intelligence.json",
  "./data/value_hr_plays.json"
];

let allPlayers = [];
let activeFilter = "ALL";
let activePlayer = null;
let activeTab = "overview";

const grid = document.getElementById("cardsGrid");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const updatedAt = document.getElementById("updatedAt");
const modal = document.getElementById("modalBackdrop");

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) < 1 && n !== 0) return n.toFixed(digits).replace(/^0/, "");
  return n.toFixed(digits);
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return n.toFixed(1) + "%";
}

function odds(value) {
  if (!value && value !== 0) return "N/A";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n > 0 ? "+" + n : String(n);
}

function cleanText(value) {
  return String(value || "").trim();
}

function getPlayerName(row) {
  return cleanText(row.player || row.name || row.batter || row.hitter || row.player_name || "Unknown Player");
}

function getTeam(row) {
  return cleanText(row.team || row.player_team || row.abbr || row.team_abbr || "");
}

function getPitcher(row) {
  return cleanText(row.pitcher || row.opposing_pitcher || row.probable_pitcher || row.starter || "Unknown Pitcher");
}

function getGame(row) {
  return cleanText(row.game || row.matchup || row.game_label || row.away_home || "");
}

function getPark(row) {
  return cleanText(row.venue || row.park || row.ballpark || row.stadium || "");
}

function getScore(row) {
  return num(row.score ?? row.final_score ?? row.hr_score ?? row.model_score ?? row.power_score, 0);
}

function getIso(row) {
  return num(row.iso ?? row.ISO ?? row.player_iso ?? row.season_iso, 0);
}

function getSlg(row) {
  return num(row.slg ?? row.SLG ?? row.player_slg ?? row.season_slg, 0);
}

function getHr(row) {
  return num(row.hr ?? row.HR ?? row.season_hr ?? row.home_runs ?? row.hr_2026, 0);
}

function getGrade(row) {
  const raw = cleanText(row.tier || row.label || row.grade || row.bucket || "").toUpperCase();
  const score = getScore(row);

  if (raw.includes("CORE") || score >= 82) return "CORE";
  if (raw.includes("DANGER") || raw.includes("BAD")) return "DANGER";
  if (raw.includes("VALUE") || score >= 72) return "VALUE";
  return "SLEEPER";
}

function getZone(row) {
  const zone = cleanText(row.zone || row.best_zone || row.hot_zone || "");
  if (zone) return zone;
  const score = Math.max(5, Math.min(9, Math.round(getScore(row) / 10)));
  return score + " zone";
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function normalizeRow(row, index) {
  return {
    id: index + "-" + getPlayerName(row).replace(/\\s+/g, "_"),
    raw: row,
    player: getPlayerName(row),
    team: getTeam(row),
    pitcher: getPitcher(row),
    game: getGame(row),
    park: getPark(row),
    score: getScore(row),
    iso: getIso(row),
    slg: getSlg(row),
    hr: getHr(row),
    odds: row.odds ?? row.best_odds ?? row.hr_odds ?? "",
    grade: getGrade(row),
    zone: getZone(row),
    handedness: cleanText(row.handedness || row.bats || row.batter_hand || ""),
    lineup: cleanText(row.lineup || row.lineup_spot || row.batting_order || ""),
    pitcherHand: cleanText(row.pitcher_hand || row.p_hand || row.throws || ""),
    era: cleanText(row.era || row.pitcher_era || ""),
    weather: cleanText(row.weather_label || row.weather || ""),
    wind: cleanText(row.wind_text || row.wind || ""),
    barrel: num(row.barrel_pct ?? row.barrel_percent ?? row.barrel, 0),
    hardhit: num(row.hard_hit_pct ?? row.hardhit_pct ?? row.hard_hit, 0),
    xwoba: num(row.xwoba ?? row.xwOBA, 0),
    ev: num(row.ev ?? row.edge ?? row.expected_value, 0),
    rank: index + 1
  };
}

async function loadFirstAvailable() {
  for (const url of DATA_CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : payload.rows || payload.players || payload.data || payload.plays || [];
      if (rows.length) return rows;
    } catch {}
  }
  return [];
}

async function loadData() {
  const rows = await loadFirstAvailable();
  allPlayers = rows.map(normalizeRow).filter(player => player.player !== "Unknown Player");
  updatedAt.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  render();
}

function filteredPlayers() {
  const q = cleanText(searchInput.value).toLowerCase();

  let rows = allPlayers.filter(player => {
    const matchesFilter = activeFilter === "ALL" || player.grade === activeFilter;
    const haystack = [player.player, player.team, player.pitcher, player.game, player.park].join(" ").toLowerCase();
    return matchesFilter && (!q || haystack.includes(q));
  });

  const sortBy = sortSelect.value;
  rows.sort((a, b) => {
    if (sortBy === "hr") return b.hr - a.hr;
    if (sortBy === "slg") return b.slg - a.slg;
    if (sortBy === "iso") return b.iso - a.iso;
    if (sortBy === "odds") return num(b.odds, -999) - num(a.odds, -999);
    return b.score - a.score;
  });

  return rows;
}

function gradeClass(grade) {
  return "grade-" + grade.toLowerCase();
}

function renderCard(player) {
  return \`
    <article class="player-card">
      <div class="card-head">
        <div>
          <div class="player-name" data-id="\${player.id}">\${player.player}</div>
          <div class="card-sub">\${player.team} \${player.handedness ? "• " + player.handedness : ""} \${player.lineup ? "• #" + player.lineup + " Spot" : ""}</div>
        </div>
        <div class="grade-pill \${gradeClass(player.grade)}">\${player.grade}</div>
      </div>

      <div class="card-sub"><span class="zone-pill">⚡ \${player.zone}</span></div>

      <div class="stat-grid">
        <div class="stat"><span>HR</span><strong>\${player.hr || "0"}</strong></div>
        <div class="stat"><span>ISO</span><strong>\${fmt(player.iso)}</strong></div>
        <div class="stat"><span>SLG</span><strong>\${fmt(player.slg)}</strong></div>
      </div>

      <div class="pitcher-box">
        <div class="box-label">VS TODAY'S PITCHER</div>
        <div class="pitcher-name">\${player.pitcher}</div>
        <div class="pitcher-meta">
          <span class="mini">\${player.pitcherHand || "P"}</span>
          <span class="mini">\${player.era ? player.era + " ERA" : "ERA N/A"}</span>
          <span class="mini">\${odds(player.odds)}</span>
          <span class="mini">Score \${player.score.toFixed(1)}</span>
        </div>
      </div>

      <div class="card-foot">
        <span>\${player.game || player.park || "Today's slate"}</span>
        <button class="profile-btn" data-id="\${player.id}">PROFILE</button>
      </div>
    </article>
  \`;
}

function render() {
  const rows = filteredPlayers();

  if (!rows.length) {
    grid.innerHTML = "<div style='color:#ff6b6b;padding:22px'>No Power Zone players found.</div>";
    return;
  }

  grid.innerHTML = rows.map(renderCard).join("");

  document.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("click", () => openPlayer(el.dataset.id));
  });
}

function openPlayer(id) {
  activePlayer = allPlayers.find(player => player.id === id);
  if (!activePlayer) return;

  activeTab = "overview";
  modal.classList.add("open");
  renderModal();
}

function renderModal() {
  const p = activePlayer;
  if (!p) return;

  document.getElementById("modalInitials").textContent = initials(p.player);
  document.getElementById("modalName").textContent = p.player;
  document.getElementById("modalSub").textContent = \`\${p.team} • \${p.grade} • vs \${p.pitcher}\`;
  document.getElementById("modalBadge").textContent = p.score.toFixed(1);

  document.getElementById("modalMetrics").innerHTML = [
    ["ISO", fmt(p.iso)],
    ["SLG", fmt(p.slg)],
    ["HR", p.hr],
    ["ODDS", odds(p.odds)],
    ["BARREL", pct(p.barrel)],
    ["HARD HIT", pct(p.hardhit)],
    ["xWOBA", fmt(p.xwoba)],
    ["EV", pct(p.ev)]
  ].map(([label, value]) => \`
    <div class="modal-metric">
      <span>\${label}</span>
      <strong>\${value}</strong>
    </div>
  \`).join("");

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === activeTab);
  });

  document.getElementById("tabContent").innerHTML = renderTab(p);
}

function renderTab(p) {
  if (activeTab === "matchup") {
    return \`
      <div class="tab-card">
        <h3>Matchup Intelligence</h3>
        <div class="detail-grid">
          <div class="detail"><span>Pitcher</span><strong>\${p.pitcher}</strong></div>
          <div class="detail"><span>Pitcher Hand</span><strong>\${p.pitcherHand || "N/A"}</strong></div>
          <div class="detail"><span>Pitcher ERA</span><strong>\${p.era || "N/A"}</strong></div>
          <div class="detail"><span>Game</span><strong>\${p.game || "N/A"}</strong></div>
        </div>
        <p>This profile highlights whether the hitter power indicators line up with the opposing starter and game context.</p>
      </div>
    \`;
  }

  if (activeTab === "power") {
    return \`
      <div class="tab-card">
        <h3>Power Profile</h3>
        <div class="detail-grid">
          <div class="detail"><span>Home Runs</span><strong>\${p.hr}</strong></div>
          <div class="detail"><span>ISO</span><strong>\${fmt(p.iso)}</strong></div>
          <div class="detail"><span>SLG</span><strong>\${fmt(p.slg)}</strong></div>
          <div class="detail"><span>Zone Tag</span><strong>\${p.zone}</strong></div>
          <div class="detail"><span>Barrel</span><strong>\${pct(p.barrel)}</strong></div>
          <div class="detail"><span>Hard Hit</span><strong>\${pct(p.hardhit)}</strong></div>
        </div>
      </div>
    \`;
  }

  if (activeTab === "weather") {
    return \`
      <div class="tab-card">
        <h3>Environment</h3>
        <div class="detail-grid">
          <div class="detail"><span>Park</span><strong>\${p.park || "N/A"}</strong></div>
          <div class="detail"><span>Weather</span><strong>\${p.weather || "N/A"}</strong></div>
          <div class="detail"><span>Wind</span><strong>\${p.wind || "N/A"}</strong></div>
          <div class="detail"><span>Game</span><strong>\${p.game || "N/A"}</strong></div>
        </div>
      </div>
    \`;
  }

  return \`
    <div class="tab-card">
      <h3>Slip Lab Read</h3>
      <p><strong>\${p.player}</strong> grades as <strong>\${p.grade}</strong> with a Slip Score of <strong>\${p.score.toFixed(1)}</strong>. The profile is built from power output, matchup strength, pitcher vulnerability, odds context, and game environment.</p>
      <div class="detail-grid">
        <div class="detail"><span>Team</span><strong>\${p.team || "N/A"}</strong></div>
        <div class="detail"><span>Lineup</span><strong>\${p.lineup || "N/A"}</strong></div>
        <div class="detail"><span>Best Price</span><strong>\${odds(p.odds)}</strong></div>
        <div class="detail"><span>Power Zone</span><strong>\${p.zone}</strong></div>
      </div>
    </div>
  \`;
}

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    render();
  });
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;
    renderModal();
  });
});

document.getElementById("closeModal").addEventListener("click", () => {
  modal.classList.remove("open");
});

modal.addEventListener("click", e => {
  if (e.target === modal) modal.classList.remove("open");
});

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
document.getElementById("refreshBtn").addEventListener("click", loadData);

loadData();
`;

fs.writeFileSync(path.join(ROOT, "power-zones.html"), html);
fs.writeFileSync(path.join(ROOT, "power-zones.css"), css);
fs.writeFileSync(path.join(ROOT, "power-zones.js"), js);

const vercel = {
  framework: null,
  buildCommand: "npm run build",
  outputDirectory: "dist",
  cleanUrls: true,
  trailingSlash: false,
  rewrites: [
    { source: "/power-zones", destination: "/power-zones.html" },
    { source: "/weather", destination: "/weather.html" },
    { source: "/slate", destination: "/slate.html" },
    { source: "/results", destination: "/results.html" },
    { source: "/parlay", destination: "/parlay.html" }
  ]
};

fs.writeFileSync(path.join(ROOT, "vercel.json"), JSON.stringify(vercel, null, 2));

const buildScript = `import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  for (const item of fs.readdirSync(src)) {
    const from = path.join(src, item);
    const to = path.join(dest, item);
    const stat = fs.statSync(from);

    if (stat.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

rm(DIST);
fs.mkdirSync(DIST, { recursive: true });

for (const file of fs.readdirSync(ROOT)) {
  if (
    file.endsWith(".html") ||
    file.endsWith(".js") ||
    file.endsWith(".css") ||
    file === "vercel.json"
  ) {
    copyFile(path.join(ROOT, file), path.join(DIST, file));
  }
}

copyDir(path.join(ROOT, "data"), path.join(DIST, "data"));
copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));

console.log("THE SLIP LAB STATIC BUILD COMPLETE");
console.log("Output folder: dist");
`;

fs.writeFileSync(path.join(ROOT, "scripts", "build_static_site.js"), buildScript);

console.log("THE SLIP LAB POWER ZONES PAGE CREATED");
console.log("Created: power-zones.html");
console.log("Created: power-zones.css");
console.log("Created: power-zones.js");
console.log("Updated: vercel.json");
