import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WEBSITE_DATA_DIR = path.join(ROOT, "website", "data");
const WEBSITE_DIR = path.join(ROOT, "website");

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
const todayStr = `${yyyy}-${mm}-${dd}`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed ${res.status}: ${url}`);
  }
  return res.json();
}

function playerStatsFromBoxscore(boxscore, side) {
  const players = boxscore?.teams?.[side]?.players || {};
  return Object.values(players)
    .map(player => {
      const batting = player?.stats?.batting || {};
      return {
        id: player?.person?.id,
        name: player?.person?.fullName || "",
        hr: Number(batting.homeRuns || 0),
        hits: Number(batting.hits || 0),
        rbi: Number(batting.rbi || 0),
        atBats: Number(batting.atBats || 0)
      };
    })
    .filter(player => player.name);
}

async function main() {
  ensureDir(WEBSITE_DATA_DIR);

  const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${todayStr}&hydrate=team,venue`;
  const schedule = await fetchJson(scheduleUrl);

  const games = schedule?.dates?.[0]?.games || [];
  const finishedGames = games.filter(game => {
    const status = game?.status?.abstractGameState || "";
    const detailed = game?.status?.detailedState || "";
    return status === "Final" || detailed === "Final";
  });

  const rows = [];

  for (const game of finishedGames) {
    const gamePk = game.gamePk;
    const boxscoreUrl = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
    const boxscore = await fetchJson(boxscoreUrl);

    const awayTeam = game?.teams?.away?.team?.name || "";
    const homeTeam = game?.teams?.home?.team?.name || "";
    const venue = game?.venue?.name || "";
    const gameLabel = `${awayTeam} @ ${homeTeam}`;

    const awayPlayers = playerStatsFromBoxscore(boxscore, "away")
      .filter(player => player.hr > 0)
      .map(player => ({
        date: todayStr,
        game: gameLabel,
        player: player.name,
        team: awayTeam,
        opponent: homeTeam,
        venue,
        home_runs: player.hr,
        hits: player.hits,
        rbi: player.rbi,
        at_bats: player.atBats,
        result: "HR"
      }));

    const homePlayers = playerStatsFromBoxscore(boxscore, "home")
      .filter(player => player.hr > 0)
      .map(player => ({
        date: todayStr,
        game: gameLabel,
        player: player.name,
        team: homeTeam,
        opponent: awayTeam,
        venue,
        home_runs: player.hr,
        hits: player.hits,
        rbi: player.rbi,
        at_bats: player.atBats,
        result: "HR"
      }));

    rows.push(...awayPlayers, ...homePlayers);
  }

  rows.sort((a, b) => {
    if (b.home_runs !== a.home_runs) return b.home_runs - a.home_runs;
    return a.player.localeCompare(b.player);
  });

  const summary = {
    date: todayStr,
    finished_games: finishedGames.length,
    total_games: games.length,
    home_run_hitters: rows.length,
    updated_at: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(WEBSITE_DATA_DIR, "results.json"),
    JSON.stringify(rows, null, 2)
  );

  fs.writeFileSync(
    path.join(WEBSITE_DATA_DIR, "results_summary.json"),
    JSON.stringify(summary, null, 2)
  );

  const resultsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Slip Lab Results</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="site-header">
    <div class="brand">
      <div class="logo">TSL</div>
      <div>
        <h1>The Slip Lab</h1>
        <p>MLB Home Run Intelligence</p>
      </div>
    </div>

    <nav>
      <a href="index.html">Home</a>
      <a href="index.html#top-plays">Top Plays</a>
      <a href="index.html#value">Value</a>
      <a href="index.html#stacks">Stacks</a>
      <a href="results.html">Results</a>
    </nav>
  </header>

  <main class="results-page">
    <section class="results-hero">
      <p class="eyebrow">Daily Results</p>
      <h2>MLB Home Run Results</h2>
      <p>
        Finished games only. This page shows players who have already hit home runs today.
        It is not a betting record unless a player was officially posted by The Slip Lab.
      </p>
    </section>

    <section class="results-stats">
      <div class="results-card">
        <span>Finished Games</span>
        <strong id="finishedGames">0</strong>
      </div>
      <div class="results-card">
        <span>Total Games</span>
        <strong id="totalGames">0</strong>
      </div>
      <div class="results-card">
        <span>HR Hitters</span>
        <strong id="hrHitters">0</strong>
      </div>
      <div class="results-card">
        <span>Updated</span>
        <strong id="updatedAt">Pending</strong>
      </div>
    </section>

    <section class="results-table-card">
      <div class="table-heading">
        <div>
          <p class="eyebrow">Finished Game Data</p>
          <h3>Players With Home Runs</h3>
        </div>
      </div>

      <div class="table-scroll">
        <table class="results-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Player</th>
              <th>Team</th>
              <th>Opponent</th>
              <th>Game</th>
              <th>Venue</th>
              <th>HR</th>
              <th>Hits</th>
              <th>RBI</th>
              <th>AB</th>
            </tr>
          </thead>
          <tbody id="resultsBody">
            <tr>
              <td colspan="10">Loading results...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="site-note">
      The Slip Lab is for informational and entertainment purposes only.
    </p>
  </main>

  <script src="results.js"></script>
</body>
</html>
`;

  const resultsJs = `async function loadResults() {
  const [rowsResponse, summaryResponse] = await Promise.all([
    fetch("./data/results.json", { cache: "no-store" }),
    fetch("./data/results_summary.json", { cache: "no-store" })
  ]);

  const rows = await rowsResponse.json();
  const summary = await summaryResponse.json();

  document.getElementById("finishedGames").textContent = summary.finished_games ?? 0;
  document.getElementById("totalGames").textContent = summary.total_games ?? 0;
  document.getElementById("hrHitters").textContent = summary.home_run_hitters ?? rows.length ?? 0;
  document.getElementById("updatedAt").textContent = formatTime(summary.updated_at);

  const body = document.getElementById("resultsBody");

  if (!rows.length) {
    body.innerHTML = "<tr><td colspan='10'>No home runs from finished games yet.</td></tr>";
    return;
  }

  body.innerHTML = rows.map(row => \`
    <tr>
      <td>\${safe(row.date)}</td>
      <td><strong>\${safe(row.player)}</strong></td>
      <td>\${safe(row.team)}</td>
      <td>\${safe(row.opponent)}</td>
      <td>\${safe(row.game)}</td>
      <td>\${safe(row.venue)}</td>
      <td><span class="hr-pill">\${safe(row.home_runs)}</span></td>
      <td>\${safe(row.hits)}</td>
      <td>\${safe(row.rbi)}</td>
      <td>\${safe(row.at_bats)}</td>
    </tr>
  \`).join("");
}

function formatTime(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

loadResults().catch(error => {
  console.error(error);
  document.getElementById("resultsBody").innerHTML =
    "<tr><td colspan='10'>Results failed to load.</td></tr>";
});
`;

  fs.writeFileSync(path.join(WEBSITE_DIR, "results.html"), resultsHtml);
  fs.writeFileSync(path.join(WEBSITE_DIR, "results.js"), resultsJs);

  const stylePath = path.join(WEBSITE_DIR, "style.css");
  if (fs.existsSync(stylePath)) {
    let css = fs.readFileSync(stylePath, "utf8");

    if (!css.includes(".results-page")) {
      css += `

.results-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 72px 20px 40px;
}

.results-hero {
  border: 1px solid rgba(0, 255, 136, 0.22);
  background:
    radial-gradient(circle at top left, rgba(0, 255, 136, 0.16), transparent 35%),
    rgba(12, 15, 14, 0.94);
  border-radius: 24px;
  padding: 32px;
  margin-bottom: 22px;
  box-shadow: 0 0 40px rgba(0, 255, 136, 0.05);
}

.results-hero h2 {
  font-size: clamp(34px, 5vw, 56px);
  margin: 0 0 12px;
  color: #ffffff;
  letter-spacing: -0.04em;
}

.results-hero p {
  max-width: 760px;
  color: #aeb8b3;
  line-height: 1.6;
}

.eyebrow {
  color: #00ff88;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin: 0 0 12px;
}

.results-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 22px;
}

.results-card {
  background: rgba(12, 15, 14, 0.94);
  border: 1px solid rgba(0, 255, 136, 0.18);
  border-radius: 18px;
  padding: 20px;
}

.results-card span {
  display: block;
  color: #8e9994;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 10px;
}

.results-card strong {
  color: #00ff88;
  font-size: 30px;
  line-height: 1;
}

.results-table-card {
  background: rgba(12, 15, 14, 0.94);
  border: 1px solid rgba(0, 255, 136, 0.18);
  border-radius: 22px;
  overflow: hidden;
}

.table-heading {
  padding: 24px 24px 10px;
}

.table-heading h3 {
  color: #ffffff;
  font-size: 26px;
  margin: 0;
}

.table-scroll {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

.results-table th,
.results-table td {
  padding: 15px 18px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  color: #d9e2dd;
  font-size: 14px;
}

.results-table th {
  color: #00ff88;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(0, 255, 136, 0.06);
}

.results-table tr:last-child td {
  border-bottom: none;
}

.hr-pill {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: 34px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #00ff88;
  color: #04110a;
  font-weight: 900;
}

.site-note {
  color: #7f8a85;
  text-align: center;
  margin: 30px 0 0;
  font-size: 14px;
}

@media (max-width: 820px) {
  .results-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .results-hero {
    padding: 24px;
  }
}
`;
      fs.writeFileSync(stylePath, css);
    }
  }

  console.log("THE SLIP LAB RESULTS DATA COMPLETE");
  console.log(`Date: ${todayStr}`);
  console.log(`Total games: ${games.length}`);
  console.log(`Finished games: ${finishedGames.length}`);
  console.log(`HR hitters: ${rows.length}`);
  console.log(`Saved: ${path.join(WEBSITE_DATA_DIR, "results.json")}`);
  console.log(`Saved: ${path.join(WEBSITE_DATA_DIR, "results_summary.json")}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
