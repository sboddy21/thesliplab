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
        radial-gradient(circle at 20% 0%, rgba(0,255,136,.10), transparent 30%),
        linear-gradient(180deg, #050807 0%, #020403 100%);
      color: #f8fafc;
      font-family: Inter, Arial, sans-serif;
    }

    .lab-shell {
      max-width: 1220px;
      margin: 0 auto;
      padding: 34px 20px 90px;
    }

    .lab-top {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 26px;
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
      font-size: clamp(34px, 5vw, 58px);
      letter-spacing: -.05em;
      line-height: .95;
    }

    .lab-title span {
      color: #00ff88;
    }

    .lab-copy {
      color: #9ca3af;
      max-width: 760px;
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

    .mini-note {
      color: #6b7280;
      font-size: 12px;
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
      width: 18%;
    }

    .bar-gold {
      background: #facc15;
      width: 52%;
    }

    .bar-blue {
      background: #38bdf8;
      width: 21%;
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
      padding: 9px 13px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
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
      min-width: 112px;
      color: #9ca3af;
      font-size: 12px;
      padding: 9px 0;
      border-bottom: 2px solid transparent;
    }

    .game-tab.active {
      color: #ffffff;
      border-color: #00ff88;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
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
          A Slip Lab dashboard for identifying pitcher vulnerability, dangerous bats, matchup pressure, and power signals across the MLB slate.
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

    <section class="filter-row">
      <span class="filter-pill active">All Signals</span>
      <span class="filter-pill">Core</span>
      <span class="filter-pill">Danger</span>
      <span class="filter-pill">Value</span>
      <span class="filter-pill">Stack</span>
      <span class="filter-pill">Weather</span>
    </section>

    <section class="game-tabs" id="gameTabs"></section>

    <section class="cards-grid" id="cardsGrid"></section>
  </main>

  <script src="slate.js"></script>
</body>
</html>`;

const js = `const DATA_URLS = [
  "./data/top_hr_plays.json",
  "./data/top_plays.json",
  "./data/hr_board.json",
  "./data/master_hr_model.json"
];

async function getFirstJson() {
  for (const url of DATA_URLS) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data) && data.length) return data;
      if (Array.isArray(data.rows) && data.rows.length) return data.rows;
    } catch {}
  }
  return [];
}

function num(value, fallback = 0) {
  const n = Number(value);
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
  const score = num(row.score || row.final_score || row.model_score);
  const odds = clean(row.odds || row.best_odds);
  const ev = num(row.ev || row.edge || row.value_score);
  const barrel = num(row.barrel_rate || row.barrel_pct || row.barrel);
  const hardHit = num(row.hard_hit_rate || row.hh_pct || row.hard_hit);

  if (score >= 80) tags.push(["CORE", "core"]);
  if (score >= 70) tags.push(["DANGER", "danger"]);
  if (ev > 0) tags.push(["VALUE", "value"]);
  if (barrel >= 12) tags.push(["BRL 12+", "hot"]);
  if (hardHit >= 50) tags.push(["HH 50+", "crusher"]);
  if (odds.includes("+")) tags.push([odds, "value"]);

  if (!tags.length) tags.push(["WATCH", "danger"]);
  return tags.slice(0, 5);
}

function groupByPitcher(rows) {
  const groups = new Map();

  for (const row of rows) {
    const pitcher = clean(row.pitcher || row.opposing_pitcher || row.probable_pitcher || "Unknown Pitcher");
    if (!groups.has(pitcher)) {
      groups.set(pitcher, []);
    }
    groups.get(pitcher).push(row);
  }

  return [...groups.entries()]
    .map(([pitcher, bats]) => {
      const avgScore = bats.reduce((sum, row) => sum + num(row.score || row.final_score || row.model_score), 0) / Math.max(bats.length, 1);
      return {
        pitcher,
        bats: bats
          .sort((a, b) => num(b.score || b.final_score || b.model_score) - num(a.score || a.final_score || a.model_score))
          .slice(0, 5),
        vuln: Math.round(avgScore || 50)
      };
    })
    .sort((a, b) => b.vuln - a.vuln)
    .slice(0, 8);
}

function render(rows) {
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

  const scored = rows.map(row => ({
    ...row,
    _score: num(row.score || row.final_score || row.model_score)
  }));

  const groups = groupByPitcher(scored);
  const games = [...new Set(scored.map(row => clean(row.game)).filter(Boolean))];

  document.getElementById("powerScore").textContent = Math.round(
    scored.reduce((sum, row) => sum + row._score, 0) / Math.max(scored.length, 1)
  );

  document.getElementById("coreBats").textContent = scored.filter(row => row._score >= 80).length;
  document.getElementById("dangerBats").textContent = scored.filter(row => row._score >= 70).length;
  document.getElementById("valueLooks").textContent = scored.filter(row => num(row.ev || row.edge || row.value_score) > 0).length;
  document.getElementById("stackGames").textContent = groups.filter(group => group.bats.length >= 3).length;
  document.getElementById("slateGames").textContent = games.length || groups.length;

  document.getElementById("vulnList").innerHTML = groups.slice(0, 5).map((group, index) => \`
    <div class="vuln-item">
      <div class="rank">#\${index + 1}</div>
      <div>
        <div class="vuln-name">\${group.pitcher}</div>
        <div class="vuln-sub">\${group.bats.length} flagged bats</div>
      </div>
      <div class="vuln-score">\${group.vuln}</div>
    </div>
  \`).join("");

  document.getElementById("gameTabs").innerHTML = games.slice(0, 12).map((game, index) => \`
    <div class="game-tab \${index === 0 ? "active" : ""}">
      \${game}
    </div>
  \`).join("");

  document.getElementById("cardsGrid").innerHTML = groups.slice(0, 10).map(group => {
    const top = group.bats[0] || {};
    const game = clean(top.game || "Slate matchup");
    const team = clean(top.team || "");
    const hand = clean(top.pitcher_hand || top.hand || "");
    const era = clean(top.pitcher_era || top.era || "--");
    const attack = group.vuln;

    return \`
      <article class="match-card">
        <div class="match-main">
          <div>
            <div class="pitcher-line">
              <div class="avatar">\${group.pitcher.split(" ").map(x => x[0]).join("").slice(0,2)}</div>
              <div>
                <div class="pitcher-name">\${group.pitcher}</div>
                <div class="pitcher-meta">\${game}</div>
              </div>
            </div>
          </div>

          <div class="vuln-box">\${attack}</div>
        </div>

        <div class="stat-strip">
          <div class="strip-stat">
            <label>Team</label>
            <strong>\${shortTeam(team)}</strong>
          </div>
          <div class="strip-stat">
            <label>Hand</label>
            <strong>\${hand || "--"}</strong>
          </div>
          <div class="strip-stat">
            <label>ERA</label>
            <strong>\${era}</strong>
          </div>
          <div class="strip-stat">
            <label>Bats</label>
            <strong>\${group.bats.length}</strong>
          </div>
        </div>

        <div class="danger-zone">
          <div class="danger-title">Danger Bats</div>

          \${group.bats.map((row, index) => {
            const tags = makeTags(row);
            return \`
              <div class="batter">
                <div class="batter-rank">#\${index + 1}</div>
                <div>
                  <div class="batter-name">\${clean(row.player || row.name)}</div>
                  <div class="batter-note">\${clean(row.team)}  •  \${clean(row.odds || row.best_odds || "No odds")}</div>
                  <div class="tag-wrap">
                    \${tags.map(([label, type]) => \`<span class="tag tag-\${type}">\${label}</span>\`).join("")}
                  </div>
                </div>
                <div class="batter-score">\${Math.round(num(row.score || row.final_score || row.model_score))}</div>
              </div>
            \`;
          }).join("")}
        </div>
      </article>
    \`;
  }).join("");
}

getFirstJson().then(rows => {
  render(rows);
}).catch(error => {
  console.error(error);
});
`;

fs.writeFileSync(path.join(WEBSITE, "slate.html"), html);
fs.writeFileSync(path.join(WEBSITE, "slate.js"), js);

const indexPath = path.join(WEBSITE, "index.html");
if (fs.existsSync(indexPath)) {
  let index = fs.readFileSync(indexPath, "utf8");

  if (!index.includes('href="slate.html"')) {
    index = index.replace(
      /<a href="results.html">Results<\/a>/,
      '<a href="slate.html">Slate</a><a href="results.html">Results</a>'
    );
  }

  fs.writeFileSync(indexPath, index);
}

console.log("Slate intelligence page created.");
console.log("Created website/slate.html");
console.log("Created website/slate.js");
