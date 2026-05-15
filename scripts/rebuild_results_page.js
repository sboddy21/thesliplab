import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WEBSITE = path.join(ROOT, "website");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>The Slip Lab Results</title>
  <link rel="stylesheet" href="styles.css"/>

  <style>
    body {
      background: #05070b;
      color: #ffffff;
      font-family: Inter, sans-serif;
      margin: 0;
    }

    .results-wrap {
      max-width: 1320px;
      margin: 0 auto;
      padding: 40px 20px 100px;
    }

    .results-header {
      margin-bottom: 32px;
    }

    .eyebrow {
      color: #00ff88;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: .18em;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .results-title {
      font-size: 48px;
      font-weight: 800;
      margin: 0 0 14px;
      letter-spacing: -.04em;
    }

    .results-subtitle {
      max-width: 900px;
      color: #94a3b8;
      line-height: 1.7;
      font-size: 15px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 18px;
      margin-top: 28px;
      margin-bottom: 28px;
    }

    .stat-card {
      background: linear-gradient(
        180deg,
        rgba(17,24,39,.96),
        rgba(7,10,16,.96)
      );

      border: 1px solid rgba(255,255,255,.06);

      border-radius: 18px;
      padding: 22px;
    }

    .stat-label {
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .14em;
      margin-bottom: 10px;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 800;
      color: #00ff88;
    }

    .results-table-card {
      background: linear-gradient(
        180deg,
        rgba(12,18,30,.96),
        rgba(6,9,15,.98)
      );

      border: 1px solid rgba(255,255,255,.06);
      border-radius: 22px;
      overflow: hidden;
    }

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 26px 28px;
      border-bottom: 1px solid rgba(255,255,255,.05);
    }

    .table-toolbar h3 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
    }

    .table-toolbar p {
      margin: 6px 0 0;
      color: #64748b;
      font-size: 13px;
    }

    .table-scroll {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1200px;
    }

    thead {
      background: rgba(255,255,255,.02);
    }

    th {
      text-align: left;
      padding: 18px 22px;
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .14em;
      border-bottom: 1px solid rgba(255,255,255,.05);
    }

    td {
      padding: 20px 22px;
      border-bottom: 1px solid rgba(255,255,255,.04);
      font-size: 14px;
      vertical-align: middle;
    }

    tbody tr {
      transition: background .15s ease;
    }

    tbody tr:hover {
      background: rgba(255,255,255,.03);
    }

    .player-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .player-name {
      font-weight: 700;
      color: #ffffff;
      font-size: 15px;
    }

    .player-meta {
      color: #64748b;
      font-size: 12px;
    }

    .team {
      font-weight: 700;
      color: #e2e8f0;
    }

    .hr-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: rgba(0,255,136,.12);
      color: #00ff88;
      font-weight: 800;
      border: 1px solid rgba(0,255,136,.35);
    }

    .score-green {
      color: #00ff88;
      font-weight: 800;
    }

    .score-yellow {
      color: #facc15;
      font-weight: 800;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
      margin-right: 6px;
    }

    .tag-hot {
      background: rgba(239,68,68,.14);
      color: #ff6b6b;
      border: 1px solid rgba(239,68,68,.35);
    }

    .tag-strong {
      background: rgba(0,255,136,.12);
      color: #00ff88;
      border: 1px solid rgba(0,255,136,.35);
    }

    .tag-value {
      background: rgba(250,204,21,.12);
      color: #facc15;
      border: 1px solid rgba(250,204,21,.35);
    }

    @media (max-width: 1000px) {
      .stats-grid {
        grid-template-columns: repeat(2,1fr);
      }

      .results-title {
        font-size: 36px;
      }
    }

    @media (max-width: 640px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>

<div class="results-wrap">

  <section class="results-header">

    <div class="eyebrow">
      Daily Results
    </div>

    <h1 class="results-title">
      MLB Home Run Results
    </h1>

    <div class="results-subtitle">
      Finished MLB games only. This dashboard tracks players that hit home runs today using live MLB game data integrated directly into The Slip Lab.
    </div>

  </section>

  <section class="stats-grid">

    <div class="stat-card">
      <div class="stat-label">Finished Games</div>
      <div class="stat-value" id="finishedGames">0</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Total Games</div>
      <div class="stat-value" id="totalGames">0</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">HR Hitters</div>
      <div class="stat-value" id="hrHitters">0</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Last Updated</div>
      <div class="stat-value" id="updatedAt">--</div>
    </div>

  </section>

  <section class="results-table-card">

    <div class="table-toolbar">
      <div>
        <h3>Players With Home Runs</h3>
        <p>Live MLB finished game results</p>
      </div>
    </div>

    <div class="table-scroll">

      <table>

        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Team</th>
            <th>Opponent</th>
            <th>Venue</th>
            <th>HR</th>
            <th>Hits</th>
            <th>RBI</th>
            <th>AB</th>
            <th>Tags</th>
          </tr>
        </thead>

        <tbody id="resultsBody"></tbody>

      </table>

    </div>

  </section>

</div>

<script src="results.js"></script>

</body>
</html>
`;

const js = `async function loadResults() {

  const [rowsRes, summaryRes] = await Promise.all([
    fetch("./data/results.json", { cache: "no-store" }),
    fetch("./data/results_summary.json", { cache: "no-store" })
  ]);

  const rows = await rowsRes.json();
  const summary = await summaryRes.json();

  document.getElementById("finishedGames").textContent = summary.finished_games || 0;
  document.getElementById("totalGames").textContent = summary.total_games || 0;
  document.getElementById("hrHitters").textContent = summary.home_run_hitters || 0;

  const updated = new Date(summary.updated_at);

  document.getElementById("updatedAt").textContent =
    updated.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

  const body = document.getElementById("resultsBody");

  body.innerHTML = rows.map((row, index) => {

    const tags = [];

    if (row.home_runs >= 2) {
      tags.push('<span class="tag tag-hot">MULTI HR</span>');
    }

    if (row.rbi >= 3) {
      tags.push('<span class="tag tag-strong">RBI GAME</span>');
    }

    if (row.hits >= 3) {
      tags.push('<span class="tag tag-value">HOT BAT</span>');
    }

    return \`
      <tr>

        <td class="score-yellow">
          \${index + 1}
        </td>

        <td>

          <div class="player-cell">

            <div class="player-name">
              \${row.player}
            </div>

            <div class="player-meta">
              \${row.game}
            </div>

          </div>

        </td>

        <td class="team">
          \${row.team}
        </td>

        <td>
          \${row.opponent}
        </td>

        <td>
          \${row.venue}
        </td>

        <td>
          <span class="hr-pill">
            \${row.home_runs}
          </span>
        </td>

        <td class="score-green">
          \${row.hits}
        </td>

        <td>
          \${row.rbi}
        </td>

        <td>
          \${row.at_bats}
        </td>

        <td>
          \${tags.join("")}
        </td>

      </tr>
    \`;

  }).join("");

}

loadResults();
`;

fs.writeFileSync(path.join(WEBSITE, "results.html"), html);
fs.writeFileSync(path.join(WEBSITE, "results.js"), js);

console.log("Premium results page rebuilt.");
