import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const resultsData = [
  {
    date: "2026-05-14",
    player: "Example Player",
    team: "NYY",
    market: "Home Run",
    odds_posted: "+420",
    closing_odds: "+380",
    result: "Pending",
    units: 0.25,
    profit: 0,
    clv: "+40",
    note: "Replace this row with official posted plays only"
  }
];

const resultsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Slip Lab Results</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    .results_wrap {
      max-width: 1180px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .results_hero {
      background: linear-gradient(135deg, rgba(0,255,136,0.14), rgba(0,0,0,0.45));
      border: 1px solid rgba(0,255,136,0.28);
      border-radius: 22px;
      padding: 28px;
      margin-bottom: 24px;
    }

    .results_hero h1 {
      margin: 0 0 10px;
      font-size: 42px;
      color: #ffffff;
    }

    .results_hero p {
      margin: 0;
      color: #b8c7bd;
      line-height: 1.5;
    }

    .results_stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .results_card {
      background: rgba(8, 14, 11, 0.92);
      border: 1px solid rgba(0,255,136,0.18);
      border-radius: 18px;
      padding: 18px;
    }

    .results_card span {
      display: block;
      color: #8fa39a;
      font-size: 13px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .results_card strong {
      color: #00ff88;
      font-size: 28px;
    }

    .results_table_wrap {
      overflow-x: auto;
      background: rgba(8, 14, 11, 0.92);
      border: 1px solid rgba(0,255,136,0.18);
      border-radius: 18px;
    }

    table.results_table {
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
    }

    .results_table th,
    .results_table td {
      text-align: left;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      color: #dce7e1;
      font-size: 14px;
    }

    .results_table th {
      color: #00ff88;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: rgba(0,255,136,0.06);
    }

    .badge_win,
    .badge_loss,
    .badge_pending {
      display: inline-block;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 800;
    }

    .badge_win {
      color: #001f11;
      background: #00ff88;
    }

    .badge_loss {
      color: #ffffff;
      background: #d94141;
    }

    .badge_pending {
      color: #111111;
      background: #ffd166;
    }

    .results_note {
      margin-top: 16px;
      color: #8fa39a;
      font-size: 13px;
      line-height: 1.5;
    }

    @media (max-width: 800px) {
      .results_stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .results_hero h1 {
        font-size: 32px;
      }
    }
  </style>
</head>
<body>
  <main class="results_wrap">
    <section class="results_hero">
      <h1>Official Results</h1>
      <p>
        This page only tracks official plays posted by The Slip Lab.
        Watchlist names, model leans, passes, and research cards are not counted as bets.
      </p>
    </section>

    <section class="results_stats">
      <div class="results_card">
        <span>Official Plays</span>
        <strong id="official_plays">0</strong>
      </div>
      <div class="results_card">
        <span>Record</span>
        <strong id="official_record">0-0</strong>
      </div>
      <div class="results_card">
        <span>Units</span>
        <strong id="official_units">0.00</strong>
      </div>
      <div class="results_card">
        <span>CLV Wins</span>
        <strong id="official_clv">0</strong>
      </div>
    </section>

    <section class="results_table_wrap">
      <table class="results_table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Player</th>
            <th>Team</th>
            <th>Market</th>
            <th>Posted Odds</th>
            <th>Closing Odds</th>
            <th>CLV</th>
            <th>Result</th>
            <th>Units</th>
            <th>Profit</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody id="results_body"></tbody>
      </table>
    </section>

    <p class="results_note">
      Results are updated from official posted plays only. This keeps the page honest and avoids counting every model output as a bet.
    </p>
  </main>

  <script src="results.js"></script>
</body>
</html>
`;

const resultsJs = `async function loadResults() {
  const response = await fetch("./data/results.json", { cache: "no-store" });
  const rows = await response.json();

  const graded = rows.filter(row => row.result === "Win" || row.result === "Loss");
  const wins = graded.filter(row => row.result === "Win").length;
  const losses = graded.filter(row => row.result === "Loss").length;
  const units = rows.reduce((sum, row) => sum + Number(row.profit || 0), 0);
  const clvWins = rows.filter(row => {
    const posted = parseAmerican(row.odds_posted);
    const closing = parseAmerican(row.closing_odds);
    if (posted === null || closing === null) return false;
    return posted > closing;
  }).length;

  document.getElementById("official_plays").textContent = rows.length;
  document.getElementById("official_record").textContent = wins + "-" + losses;
  document.getElementById("official_units").textContent = units.toFixed(2);
  document.getElementById("official_clv").textContent = clvWins;

  const body = document.getElementById("results_body");
  body.innerHTML = rows.map(row => {
    const badgeClass =
      row.result === "Win" ? "badge_win" :
      row.result === "Loss" ? "badge_loss" :
      "badge_pending";

    return \`
      <tr>
        <td>\${safe(row.date)}</td>
        <td>\${safe(row.player)}</td>
        <td>\${safe(row.team)}</td>
        <td>\${safe(row.market)}</td>
        <td>\${safe(row.odds_posted)}</td>
        <td>\${safe(row.closing_odds)}</td>
        <td>\${safe(row.clv)}</td>
        <td><span class="\${badgeClass}">\${safe(row.result)}</span></td>
        <td>\${safe(row.units)}</td>
        <td>\${Number(row.profit || 0).toFixed(2)}</td>
        <td>\${safe(row.note)}</td>
      </tr>
    \`;
  }).join("");
}

function parseAmerican(value) {
  if (!value) return null;
  const clean = String(value).replace("+", "").trim();
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
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
  document.getElementById("results_body").innerHTML = "<tr><td colspan='11'>Results failed to load.</td></tr>";
});
`;

fs.writeFileSync(path.join(ROOT, "results.html"), resultsHtml);
fs.writeFileSync(path.join(ROOT, "results.js"), resultsJs);
fs.writeFileSync(path.join(ROOT, "data", "results.json"), JSON.stringify(resultsData, null, 2));

const indexPath = path.join(ROOT, "index.html");

if (fs.existsSync(indexPath)) {
  let index = fs.readFileSync(indexPath, "utf8");

  if (!index.includes('href="results.html"')) {
    index = index.replace(
      /<\/nav>/i,
      '  <a href="results.html">Results</a>\\n</nav>'
    );
  }

  fs.writeFileSync(indexPath, index);
}

console.log("Results page created.");
console.log("Created results.html");
console.log("Created results.js");
console.log("Created data/results.json");
