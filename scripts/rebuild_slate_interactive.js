import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WEBSITE = path.join(ROOT, "website");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>The Slip Lab Slate Intelligence</title>
  <link rel="stylesheet" href="styles.css"/>

  <style>
    body {
      margin: 0;
      background:
        radial-gradient(circle at 20% 0%, rgba(0,255,136,.10), transparent 32%),
        linear-gradient(180deg, #050807 0%, #020403 100%);
      color: #f8fafc;
      font-family: Inter, Arial, sans-serif;
    }

    .lab-shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 36px 20px 90px;
    }

    .lab-top {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .lab-kicker {
      color: #00ff88;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .24em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .lab-title {
      margin: 0;
      font-size: clamp(36px, 5vw, 60px);
      letter-spacing: -.05em;
      line-height: .95;
    }

    .lab-title span {
      color: #00ff88;
    }

    .lab-copy {
      color: #9ca3af;
      max-width: 820px;
      line-height: 1.65;
      margin-top: 16px;
      font-size: 15px;
    }

    .date-card {
      min-width: 230px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(7,12,10,.82);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 0 32px rgba(0,255,136,.04);
    }

    .date-card label {
      display: block;
      color: #7c8a83;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .14em;
      margin-bottom: 8px;
    }

    .date-card strong {
      font-size: 18px;
    }

    .mini-note {
      color: #6b7280;
      font-size: 12px;
      margin-top: 8px;
    }

    .signal-grid {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 18px;
      margin-bottom: 18px;
    }

    .panel {
      border: 1px solid rgba(255,255,255,.08);
      background:
        linear-gradient(180deg, rgba(13,21,18,.92), rgba(5,8,7,.96));
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 0 40px rgba(0,0,0,.28);
    }

    .panel-head {
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255,255,255,.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
    }

    .panel-head h2 {
      margin: 0;
      font-size: 15px;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .signal-score {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 24px 20px 12px;
    }

    .signal-score strong {
      font-size: 52px;
      letter-spacing: -.05em;
      color: #00ff88;
    }

    .signal-score span {
      color: #9ca3af;
      font-size: 15px;
    }

    .signal-bars {
      padding: 0 20px 22px;
    }

    .bar-track {
      height: 9px;
      background: rgba(255,255,255,.07);
      border-radius: 999px;
      overflow: hidden;
      display: flex;
    }

    .bar-green {
      background: #00ff88;
      width: 22%;
    }

    .bar-gold {
      background: #facc15;
      width: 48%;
    }

    .bar-blue {
      background: #38bdf8;
      width: 24%;
    }

    .metric-row {
      display: grid;
      grid-template-columns: repeat(5,1fr);
      gap: 12px;
      padding: 0 20px 22px;
    }

    .metric {
      background: rgba(255,255,255,.035);
      border: 1px solid rgba(255,255,255,.05);
      border-radius: 14px;
      padding: 14px;
    }

    .metric label {
      display: block;
      color: #6b7280;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .12em;
      margin-bottom: 7px;
    }

    .metric strong {
      color: #00ff88;
      font-size: 24px;
    }

    .vuln-list {
      padding: 14px 18px 18px;
      display: grid;
      gap: 10px;
    }

    .vuln-item {
      display: grid;
      grid-template-columns: 42px 1fr 62px;
      align-items: center;
      gap: 12px;
      background: rgba(255,255,255,.035);
      border: 1px solid rgba(255,255,255,.055);
      border-radius: 14px;
      padding: 12px;
      cursor: pointer;
    }

    .vuln-item:hover {
      border-color: rgba(0,255,136,.35);
      background: rgba(0,255,136,.045);
    }

    .rank {
      color: #00ff88;
      font-weight: 900;
      font-size: 13px;
    }

    .vuln-name {
      font-weight: 800;
    }

    .vuln-sub {
      color: #6b7280;
      font-size: 12px;
      margin-top: 4px;
    }

    .vuln-score {
      color: #facc15;
      font-size: 24px;
      font-weight: 900;
      text-align: right;
    }

    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 20px 0;
    }

    .filter-pill {
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      color: #cbd5e1;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .06em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .filter-pill.active {
      color: #04110a;
      background: #00ff88;
      border-color: #00ff88;
    }

    .game-tabs {
      display: flex;
      gap: 18px;
      overflow-x: auto;
      padding-bottom: 14px;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,.07);
    }

    .game-tab {
      min-width: 128px;
      color: #9ca3af;
      font-size: 12px;
      padding: 9px 0;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }

    .game-tab.active {
      color: #ffffff;
      border-color: #00ff88;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 22px;
    }

    .match-card {
      border: 1px solid rgba(255,255,255,.08);
      background:
        radial-gradient(circle at 88% 18%, rgba(0,255,136,.09), transparent 25%),
        linear-gradient(180deg, rgba(12,18,30,.95), rgba(6,9,15,.98));
      border-radius: 20px;
      overflow: hidden;
    }

    .match-main {
      padding: 20px;
      display: grid;
      grid-template-columns: 1fr 86px;
      gap: 16px;
      border-bottom: 1px solid rgba(255,255,255,.06);
    }

    .pitcher-line {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar {
      width: 42px;
      height: 42px;
      border-radius: 999px;
      background: linear-gradient(135deg, #00ff88, #123524);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #021108;
      font-weight: 900;
    }

    .pitcher-name {
      font-size: 20px;
      font-weight: 900;
      margin-bottom: 4px;
    }

    .pitcher-meta {
      color: #9ca3af;
      font-size: 13px;
    }

    .vuln-box {
      border: 1px solid rgba(250,204,21,.28);
      background: rgba(250,204,21,.08);
      border-radius: 14px;
      display: grid;
      place-items: center;
      color: #facc15;
      font-size: 30px;
      font-weight: 900;
    }

    .stat-strip {
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 1px;
      background: rgba(255,255,255,.05);
    }

    .strip-stat {
      background: rgba(3,6,10,.92);
      padding: 14px;
      text-align: center;
    }

    .strip-stat label {
      display: block;
      color: #6b7280;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .12em;
      margin-bottom: 6px;
    }

    .strip-stat strong {
      font-size: 17px;
    }

    .danger-zone {
      padding: 16px 20px 20px;
    }

    .danger-title {
      color: #9ca3af;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .16em;
      margin-bottom: 12px;
    }

    .batter {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 12px 0;
      border-top: 1px solid rgba(255,255,255,.055);
    }

    .batter:first-of-type {
      border-top: 0;
    }

    .batter-rank {
      color: #00ff88;
      font-weight: 900;
      font-size: 12px;
    }

    .batter-name {
      font-weight: 800;
    }

    .batter-note {
      color: #6b7280;
      font-size: 12px;
      margin-top: 4px;
    }

    .tag-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .tag {
      border-radius: 999px;
      padding: 5px 8px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .04em;
      text-transform: uppercase;
      border: 1px solid rgba(255,255,255,.12);
    }

    .tag-core {
      color: #04110a;
      background: #00ff88;
      border-color: #00ff88;
    }

    .tag-danger {
      color: #c084fc;
      background: rgba(168,85,247,.13);
      border-color: rgba(168,85,247,.35);
    }

    .tag-hot {
      color: #38bdf8;
      background: rgba(56,189,248,.12);
      border-color: rgba(56,189,248,.35);
    }

    .tag-value {
      color: #facc15;
      background: rgba(250,204,21,.12);
      border-color: rgba(250,204,21,.36);
    }

    .tag-crusher {
      color: #fb7185;
      background: rgba(244,63,94,.12);
      border-color: rgba(244,63,94,.36);
    }

    .batter-score {
      color: #facc15;
      font-size: 22px;
      font-weight: 900;
    }

    .full-board {
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(7,12,10,.88);
      border-radius: 20px;
      overflow: hidden;
    }

    .full-board-head {
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255,255,255,.06);
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
    }

    .full-board-head h2 {
      margin: 0;
      font-size: 18px;
    }

    .search {
      width: min(340px, 100%);
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 12px;
      color: #fff;
      padding: 11px 12px;
      outline: none;
    }

    .table-scroll {
      overflow-x: auto;
    }

    table {
      width: 100%;
      min-width: 1080px;
      border-collapse: collapse;
    }

    th {
      color: #6b7280;
      font-size: 11px;
      letter-spacing: .12em;
      text-transform: uppercase;
      text-align: left;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,.06);
    }

    td {
      padding: 15px 16px;
      border-bottom: 1px solid rgba(255,255,255,.045);
      color: #e5e7eb;
      font-size: 13px;
    }

    tbody tr:hover {
      background: rgba(0,255,136,.035);
    }

    @media (max-width: 1000px) {
      .lab-top,
      .signal-grid {
        grid-template-columns: 1fr;
        display: grid;
      }

      .cards-grid {
        grid-template-columns: 1fr;
      }

      .metric-row {
        grid-template-columns: repeat(2,1fr);
      }
    }

    @media (max-width: 640px) {
      .date-card {
        min-width: 0;
      }

      .match-main {
        grid-template-columns: 1fr;
      }

      .metric-row {
        grid-template-columns: 1fr;
      }

      .full-board-head {
        align-items: stretch;
        flex-direction: column;
      }
    }
  </style>
</head>

<body>
  <main class="lab-shell">
    <section class="lab-top">
      <div>
        <div class="lab-kicker">Today’s Slate</div>
        <h1 class="lab-title">Home Run <span>Intelligence</span></h1>
        <p class="lab-copy">
          A Slip Lab dashboard for identifying pitcher vulnerability, dangerous bats, matchup pressure, value signals, and stack spots across the MLB slate.
        </p>
      </div>

      <div class="date-card">
        <label>Slate Date</label>
        <strong id="slateDate">Loading...</strong>
        <p class="mini-note" id="slateUpdated">Updated automatically</p>
      </div>
    </section>

    <section class="signal-grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Slate Power Signal</h2>
          <span class="mini-note">Model overview</span>
        </div>

        <div class="signal-score">
          <strong id="powerScore">0</strong>
          <span>projected HR pressure</span>
        </div>

        <div class="signal-bars">
          <div class="bar-track">
            <div class="bar-green"></div>
            <div class="bar-gold"></div>
            <div class="bar-blue"></div>
          </div>
        </div>

        <div class="metric-row">
          <div class="metric">
            <label>Core Bats</label>
            <strong id="coreBats">0</strong>
          </div>
          <div class="metric">
            <label>Danger Bats</label>
            <strong id="dangerBats">0</strong>
          </div>
          <div class="metric">
            <label>Value Looks</label>
            <strong id="valueLooks">0</strong>
          </div>
          <div class="metric">
            <label>Stack Games</label>
            <strong id="stackGames">0</strong>
          </div>
          <div class="metric">
            <label>Slate Games</label>
            <strong id="slateGames">0</strong>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Top Vulnerabilities</h2>
          <span class="mini-note">Pitchers to attack</span>
        </div>

        <div class="vuln-list" id="vulnList"></div>
      </div>
    </section>

    <section class="filter-row" id="filterRow">
      <button class="filter-pill active" data-filter="all">All Signals</button>
      <button class="filter-pill" data-filter="core">Core</button>
      <button class="filter-pill" data-filter="danger">Danger</button>
      <button class="filter-pill" data-filter="value">Value</button>
      <button class="filter-pill" data-filter="stack">Stack</button>
      <button class="filter-pill" data-filter="weather">Weather</button>
    </section>

    <section class="game-tabs" id="gameTabs"></section>

    <section class="cards-grid" id="cardsGrid"></section>

    <section class="full-board">
      <div class="full-board-head">
        <div>
          <div class="lab-kicker">Full Board</div>
          <h2>All Flagged Bats</h2>
        </div>
        <input class="search" id="searchInput" placeholder="Search player, team, pitcher, game..." />
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Team</th>
              <th>Pitcher</th>
              <th>Game</th>
              <th>Odds</th>
              <th>Score</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody id="fullBoard"></tbody>
        </table>
      </div>
    </section>
  </main>

  <script src="slate.js"></script>
</body>
</html>`;

const js = `let ALL_ROWS = [];
let ACTIVE_FILTER = "all";
let ACTIVE_GAME = "all";
let SEARCH = "";

const DATA_URLS = [
  "./data/top_hr_plays.json",
  "./data/top_plays.json",
  "./data/hr_board.json",
  "./data/master_hr_model.json",
  "./data/consensus_engine.json",
  "./data/hr_sweep_board_all_games.json"
];

async function getFirstJson() {
  let merged = [];

  for (const url of DATA_URLS) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;

      const data = await response.json();
      const rows = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : [];

      if (rows.length) {
        merged = merged.concat(rows);
      }
    } catch {}
  }

  return dedupeRows(merged);
}

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    const key = [
      getPlayer(row),
      getTeam(row),
      getPitcher(row),
      getGame(row)
    ].join("|").toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalizeRow(row));
  }

  return out;
}

function normalizeRow(row) {
  const score = getScore(row);

  return {
    raw: row,
    player: getPlayer(row),
    team: getTeam(row),
    pitcher: getPitcher(row),
    game: getGame(row),
    odds: clean(row.odds || row.best_odds || row.price || row.line || ""),
    score,
    ev: num(row.ev || row.edge || row.value_score || row.ev_percent || 0),
    barrel: num(row.barrel_rate || row.barrel_pct || row.barrel || row.brl || 0),
    hardHit: num(row.hard_hit_rate || row.hh_pct || row.hard_hit || row.hh || 0),
    park: num(row.park_score || row.park_factor_score || row.park_boost || 0),
    weather: num(row.weather_score || row.weather_boost || row.wind_boost || 0),
    hand: clean(row.pitcher_hand || row.hand || row.p_throws || ""),
    era: clean(row.pitcher_era || row.era || ""),
    tags: []
  };
}

function getScore(row) {
  const candidates = [
    row.score,
    row.final_score,
    row.model_score,
    row.hr_score,
    row.consensus_score,
    row.prob,
    row.probability
  ];

  for (const value of candidates) {
    const n = num(value, null);
    if (n !== null && n > 0) return n;
  }

  return 50;
}

function getPlayer(row) {
  return clean(row.player || row.name || row.batter || row.player_name || "Unknown Player");
}

function getTeam(row) {
  return clean(row.team || row.player_team || row.batting_team || "");
}

function getPitcher(row) {
  return clean(row.pitcher || row.opposing_pitcher || row.probable_pitcher || row.sp || "Unknown Pitcher");
}

function getGame(row) {
  return clean(row.game || row.matchup || row.game_label || "");
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : fallback;
}

function clean(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function shortTeam(team) {
  const map = {
    "New York Yankees": "NYY",
    "New York Mets": "NYM",
    "Boston Red Sox": "BOS",
    "Toronto Blue Jays": "TOR",
    "Baltimore Orioles": "BAL",
    "Tampa Bay Rays": "TB",
    "Detroit Tigers": "DET",
    "Cleveland Guardians": "CLE",
    "Kansas City Royals": "KC",
    "Minnesota Twins": "MIN",
    "Chicago White Sox": "CWS",
    "Houston Astros": "HOU",
    "Texas Rangers": "TEX",
    "Seattle Mariners": "SEA",
    "Athletics": "ATH",
    "Los Angeles Angels": "LAA",
    "Philadelphia Phillies": "PHI",
    "Atlanta Braves": "ATL",
    "Miami Marlins": "MIA",
    "Washington Nationals": "WSH",
    "Chicago Cubs": "CHC",
    "Milwaukee Brewers": "MIL",
    "St. Louis Cardinals": "STL",
    "Cincinnati Reds": "CIN",
    "Pittsburgh Pirates": "PIT",
    "Los Angeles Dodgers": "LAD",
    "San Diego Padres": "SD",
    "San Francisco Giants": "SF",
    "Arizona Diamondbacks": "ARI",
    "Colorado Rockies": "COL"
  };

  return map[team] || team;
}

function makeTags(row) {
  const tags = [];

  if (row.score >= 82) tags.push(["CORE", "core"]);
  if (row.score >= 70) tags.push(["DANGER", "danger"]);
  if (row.score >= 60 && row.score < 70) tags.push(["WATCH", "danger"]);
  if (row.ev > 0) tags.push(["VALUE", "value"]);
  if (row.barrel >= 12) tags.push(["BRL 12+", "hot"]);
  if (row.hardHit >= 50) tags.push(["HH 50+", "crusher"]);
  if (row.park > 0) tags.push(["PARK", "value"]);
  if (row.weather > 0) tags.push(["WEATHER", "hot"]);
  if (String(row.odds).includes("+")) tags.push([String(row.odds), "value"]);

  if (!tags.length) tags.push(["MODEL", "danger"]);

  return tags.slice(0, 6);
}

function hydrateTags(rows) {
  return rows.map(row => ({
    ...row,
    tags: makeTags(row)
  }));
}

function rowMatchesFilter(row) {
  if (ACTIVE_FILTER === "all") return true;

  if (ACTIVE_FILTER === "core") return row.score >= 82;
  if (ACTIVE_FILTER === "danger") return row.score >= 70;
  if (ACTIVE_FILTER === "value") return row.ev > 0 || String(row.odds).includes("+");
  if (ACTIVE_FILTER === "stack") return pitcherGroupCount(row.pitcher) >= 3;
  if (ACTIVE_FILTER === "weather") return row.weather > 0;

  return true;
}

function pitcherGroupCount(pitcher) {
  return ALL_ROWS.filter(row => row.pitcher === pitcher).length;
}

function rowMatchesGame(row) {
  if (ACTIVE_GAME === "all") return true;
  return row.game === ACTIVE_GAME;
}

function rowMatchesSearch(row) {
  if (!SEARCH) return true;

  const haystack = [
    row.player,
    row.team,
    row.pitcher,
    row.game,
    row.odds
  ].join(" ").toLowerCase();

  return haystack.includes(SEARCH.toLowerCase());
}

function filteredRows() {
  return ALL_ROWS
    .filter(rowMatchesFilter)
    .filter(rowMatchesGame)
    .filter(rowMatchesSearch)
    .sort((a, b) => b.score - a.score);
}

function groupByPitcher(rows) {
  const groups = new Map();

  for (const row of rows) {
    if (!groups.has(row.pitcher)) groups.set(row.pitcher, []);
    groups.get(row.pitcher).push(row);
  }

  return [...groups.entries()]
    .map(([pitcher, bats]) => {
      const avgScore = bats.reduce((sum, row) => sum + row.score, 0) / Math.max(bats.length, 1);
      const best = Math.max(...bats.map(row => row.score));
      return {
        pitcher,
        bats: bats.sort((a, b) => b.score - a.score).slice(0, 8),
        vuln: Math.round((avgScore * .55) + (best * .45))
      };
    })
    .sort((a, b) => b.vuln - a.vuln);
}

function renderTop(rows) {
  const groups = groupByPitcher(rows);
  const games = [...new Set(ALL_ROWS.map(row => row.game).filter(Boolean))];

  const avg = rows.reduce((sum, row) => sum + row.score, 0) / Math.max(rows.length, 1);

  document.getElementById("powerScore").textContent = Math.round(avg);
  document.getElementById("coreBats").textContent = ALL_ROWS.filter(row => row.score >= 82).length;
  document.getElementById("dangerBats").textContent = ALL_ROWS.filter(row => row.score >= 70).length;
  document.getElementById("valueLooks").textContent = ALL_ROWS.filter(row => row.ev > 0 || String(row.odds).includes("+")).length;
  document.getElementById("stackGames").textContent = groupByPitcher(ALL_ROWS).filter(group => group.bats.length >= 3).length;
  document.getElementById("slateGames").textContent = games.length || groupByPitcher(ALL_ROWS).length;

  document.getElementById("vulnList").innerHTML = groups.slice(0, 6).map((group, index) => \`
    <div class="vuln-item" data-pitcher="\${escapeAttr(group.pitcher)}">
      <div class="rank">#\${index + 1}</div>
      <div>
        <div class="vuln-name">\${safe(group.pitcher)}</div>
        <div class="vuln-sub">\${group.bats.length} flagged bats</div>
      </div>
      <div class="vuln-score">\${group.vuln}</div>
    </div>
  \`).join("");

  document.querySelectorAll(".vuln-item").forEach(item => {
    item.addEventListener("click", () => {
      SEARCH = item.dataset.pitcher || "";
      document.getElementById("searchInput").value = SEARCH;
      render();
    });
  });
}

function renderGameTabs() {
  const games = ["all", ...new Set(ALL_ROWS.map(row => row.game).filter(Boolean))];

  document.getElementById("gameTabs").innerHTML = games.map(game => \`
    <div class="game-tab \${ACTIVE_GAME === game ? "active" : ""}" data-game="\${escapeAttr(game)}">
      \${game === "all" ? "All Games" : safe(game)}
    </div>
  \`).join("");

  document.querySelectorAll(".game-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      ACTIVE_GAME = tab.dataset.game;
      render();
    });
  });
}

function renderCards(rows) {
  const groups = groupByPitcher(rows).slice(0, 12);

  document.getElementById("cardsGrid").innerHTML = groups.map(group => {
    const top = group.bats[0] || {};
    const game = top.game || "Slate matchup";
    const team = top.team || "";
    const hand = top.hand || "";
    const era = top.era || "--";

    return \`
      <article class="match-card">
        <div class="match-main">
          <div>
            <div class="pitcher-line">
              <div class="avatar">\${safe(initials(group.pitcher))}</div>
              <div>
                <div class="pitcher-name">\${safe(group.pitcher)}</div>
                <div class="pitcher-meta">\${safe(game)}</div>
              </div>
            </div>
          </div>

          <div class="vuln-box">\${group.vuln}</div>
        </div>

        <div class="stat-strip">
          <div class="strip-stat">
            <label>Team</label>
            <strong>\${safe(shortTeam(team))}</strong>
          </div>
          <div class="strip-stat">
            <label>Hand</label>
            <strong>\${safe(hand || "--")}</strong>
          </div>
          <div class="strip-stat">
            <label>ERA</label>
            <strong>\${safe(era || "--")}</strong>
          </div>
          <div class="strip-stat">
            <label>Bats</label>
            <strong>\${group.bats.length}</strong>
          </div>
        </div>

        <div class="danger-zone">
          <div class="danger-title">Danger Bats</div>

          \${group.bats.map((row, index) => \`
            <div class="batter">
              <div class="batter-rank">#\${index + 1}</div>
              <div>
                <div class="batter-name">\${safe(row.player)}</div>
                <div class="batter-note">\${safe(row.team)}  •  \${safe(row.odds || "No odds")}</div>
                <div class="tag-wrap">
                  \${row.tags.map(([label, type]) => \`<span class="tag tag-\${type}">\${safe(label)}</span>\`).join("")}
                </div>
              </div>
              <div class="batter-score">\${Math.round(row.score)}</div>
            </div>
          \`).join("")}
        </div>
      </article>
    \`;
  }).join("");
}

function renderFullBoard(rows) {
  document.getElementById("fullBoard").innerHTML = rows.slice(0, 100).map((row, index) => \`
    <tr>
      <td class="rank">#\${index + 1}</td>
      <td><strong>\${safe(row.player)}</strong></td>
      <td>\${safe(shortTeam(row.team))}</td>
      <td>\${safe(row.pitcher)}</td>
      <td>\${safe(row.game)}</td>
      <td>\${safe(row.odds || "No odds")}</td>
      <td class="vuln-score">\${Math.round(row.score)}</td>
      <td>
        <div class="tag-wrap">
          \${row.tags.map(([label, type]) => \`<span class="tag tag-\${type}">\${safe(label)}</span>\`).join("")}
        </div>
      </td>
    </tr>
  \`).join("");
}

function render() {
  const rows = filteredRows();

  renderTop(rows);
  renderGameTabs();
  renderCards(rows);
  renderFullBoard(rows);
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttr(value) {
  return safe(value).replace(/"/g, "&quot;");
}

function setupControls() {
  document.querySelectorAll(".filter-pill").forEach(button => {
    button.addEventListener("click", () => {
      ACTIVE_FILTER = button.dataset.filter;

      document.querySelectorAll(".filter-pill").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      render();
    });
  });

  document.getElementById("searchInput").addEventListener("input", event => {
    SEARCH = event.target.value;
    render();
  });
}

function setupDate() {
  const now = new Date();

  document.getElementById("slateDate").textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  document.getElementById("slateUpdated").textContent = "Updated " + now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

getFirstJson().then(rows => {
  ALL_ROWS = hydrateTags(rows);
  setupDate();
  setupControls();
  render();
}).catch(error => {
  console.error(error);
});
`;

fs.writeFileSync(path.join(WEBSITE, "slate.html"), html);
fs.writeFileSync(path.join(WEBSITE, "slate.js"), js);

console.log("Interactive slate page rebuilt.");
