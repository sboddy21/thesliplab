import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const DATA_DIR = path.join(ROOT, "data");
const EXPORT_DIR = path.join(ROOT, "exports");
const CONTENT_DIR = path.join(EXPORT_DIR, "content_engine");

const FILES = {
  simulation: path.join(DATA_DIR, "simulation_engine.csv"),
  stacks: path.join(DATA_DIR, "simulated_hr_stacks.csv"),
  backtesting: path.join(DATA_DIR, "backtesting_engine.csv")
};

const OUT = {
  topPlaysJSON: path.join(CONTENT_DIR, "top_hr_plays.json"),
  valuePlaysJSON: path.join(CONTENT_DIR, "value_hr_plays.json"),
  stacksJSON: path.join(CONTENT_DIR, "top_hr_stacks.json"),
  trackingJSON: path.join(CONTENT_DIR, "tracking_summary.json"),

  topPlaysHTML: path.join(CONTENT_DIR, "top_hr_plays.html"),
  valuePlaysHTML: path.join(CONTENT_DIR, "value_hr_plays.html"),
  stacksHTML: path.join(CONTENT_DIR, "top_hr_stacks.html"),

  xPostsTXT: path.join(CONTENT_DIR, "x_posts.txt"),
  slateReportTXT: path.join(CONTENT_DIR, "daily_slate_report.txt")
};

function clean(v) {
  return String(v ?? "").trim();
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && q && n === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === "," && !q) {
      row.push(cur);
      cur = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && n === "\n") i++;
      row.push(cur);

      if (row.some(x => clean(x) !== "")) {
        rows.push(row);
      }

      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);

    if (row.some(x => clean(x) !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) return [];

  const headers = rows.shift().map(h => clean(h));

  return rows.map(r => {
    const obj = {};

    headers.forEach((h, i) => {
      obj[h] = clean(r[i]);
    });

    return obj;
  });
}

function readCSV(file) {
  if (!fs.existsSync(file)) return [];
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function saveTXT(file, text) {
  fs.writeFileSync(file, text);
}

function htmlPage(title, cards) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>

<style>
body{
  background:#0a0a0a;
  color:white;
  font-family:Arial;
  padding:30px;
}

h1{
  font-size:42px;
  margin-bottom:30px;
}

.grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
  gap:20px;
}

.card{
  background:#141414;
  border:1px solid #2c2c2c;
  border-radius:16px;
  padding:20px;
}

.player{
  font-size:28px;
  font-weight:bold;
  margin-bottom:8px;
}

.team{
  color:#9ca3af;
  margin-bottom:14px;
}

.metric{
  margin:6px 0;
}

.badge{
  display:inline-block;
  background:#16a34a;
  color:white;
  padding:6px 10px;
  border-radius:10px;
  margin-top:10px;
  font-size:13px;
}
</style>
</head>

<body>

<h1>${title}</h1>

<div class="grid">
${cards.join("\n")}
</div>

</body>
</html>
`;
}

ensureDir(CONTENT_DIR);

const simRows = readCSV(FILES.simulation);
const stackRows = readCSV(FILES.stacks);
const backtestingRows = readCSV(FILES.backtesting);

if (!simRows.length) {
  console.log("Missing simulation_engine.csv");
  process.exit(1);
}

const topProbability = [...simRows]
  .sort((a, b) => num(b.adjusted_hr_probability) - num(a.adjusted_hr_probability))
  .slice(0, 20);

const valuePlays = [...simRows]
  .filter(r =>
    [
      "BETTABLE_VALUE",
      "VALUE_LEAN",
      "HIGH_PROBABILITY_PLAY",
      "PROBABILITY_PLAY"
    ].includes(clean(r.betting_tier))
  )
  .sort((a, b) => num(b.ev_percent) - num(a.ev_percent))
  .slice(0, 20);

const topStacks = [...stackRows]
  .sort((a, b) => num(b.simulation_stack_score) - num(a.simulation_stack_score))
  .slice(0, 25);

saveJSON(OUT.topPlaysJSON, topProbability);
saveJSON(OUT.valuePlaysJSON, valuePlays);
saveJSON(OUT.stacksJSON, topStacks);
saveJSON(OUT.trackingJSON, backtestingRows);

const topCards = topProbability.map(r => `
<div class="card">
  <div class="player">${r.player}</div>
  <div class="team">${r.team}</div>

  <div class="metric">HR Probability: ${r.adjusted_hr_probability}</div>
  <div class="metric">Odds: ${r.odds}</div>
  <div class="metric">Fair Odds: ${r.model_fair_odds}</div>
  <div class="metric">Pitcher: ${r.pitcher}</div>

  <div class="badge">${r.betting_tier}</div>
</div>
`);

const valueCards = valuePlays.map(r => `
<div class="card">
  <div class="player">${r.player}</div>
  <div class="team">${r.team}</div>

  <div class="metric">EV: ${r.ev_percent}</div>
  <div class="metric">HR Probability: ${r.adjusted_hr_probability}</div>
  <div class="metric">Odds: ${r.odds}</div>
  <div class="metric">Fair Odds: ${r.model_fair_odds}</div>

  <div class="badge">${r.value_label}</div>
</div>
`);

const stackCards = topStacks.map(r => `
<div class="card">
  <div class="player">${r.players}</div>
  <div class="team">${r.game}</div>

  <div class="metric">Any HR Probability: ${r.simulated_any_hr_probability}</div>
  <div class="metric">All HR Probability: ${r.adjusted_all_hr_probability}</div>
  <div class="metric">Stack Score: ${r.simulation_stack_score}</div>

  <div class="badge">${r.simulation_stack_grade}</div>
</div>
`);

saveTXT(
  OUT.topPlaysHTML,
  htmlPage("THE SLIP LAB — TOP HR PLAYS", topCards)
);

saveTXT(
  OUT.valuePlaysHTML,
  htmlPage("THE SLIP LAB — VALUE HR PLAYS", valueCards)
);

saveTXT(
  OUT.stacksHTML,
  htmlPage("THE SLIP LAB — TOP HR STACKS", stackCards)
);

const xPosts = [
  "THE SLIP LAB — TOP HR PLAYS",
  "",
  ...topProbability.slice(0, 5).map((r, i) => {
    return `${i + 1}. ${r.player} (${r.team})
HR Probability: ${r.adjusted_hr_probability}
Odds: ${r.odds}
Pitcher: ${r.pitcher}`;
  }),

  "",
  "THE SLIP LAB — VALUE HR PLAYS",
  "",
  ...valuePlays.slice(0, 5).map((r, i) => {
    return `${i + 1}. ${r.player}
EV: ${r.ev_percent}
Odds: ${r.odds}
Fair: ${r.model_fair_odds}`;
  }),

  "",
  "THE SLIP LAB — TOP HR STACKS",
  "",
  ...topStacks.slice(0, 5).map((r, i) => {
    return `${i + 1}. ${r.players}
All HR: ${r.adjusted_all_hr_probability}
Grade: ${r.simulation_stack_grade}`;
  })
].join("\n");

saveTXT(OUT.xPostsTXT, xPosts);

const slateReport = [
  "THE SLIP LAB DAILY SLATE REPORT",
  "",
  "TOP HR PROBABILITY PLAYS",
  "",

  ...topProbability.slice(0, 10).map((r, i) => {
    return `${i + 1}. ${r.player} | ${r.team}
HR Probability: ${r.adjusted_hr_probability}
Odds: ${r.odds}
Pitcher: ${r.pitcher}
Tier: ${r.betting_tier}
`;
  }),

  "",
  "BEST VALUE HR PLAYS",
  "",

  ...valuePlays.slice(0, 10).map((r, i) => {
    return `${i + 1}. ${r.player}
EV: ${r.ev_percent}
Odds: ${r.odds}
Fair Odds: ${r.model_fair_odds}
`;
  }),

  "",
  "TOP HR STACK ENVIRONMENTS",
  "",

  ...topStacks.slice(0, 10).map((r, i) => {
    return `${i + 1}. ${r.players}
Game: ${r.game}
Any HR: ${r.simulated_any_hr_probability}
All HR: ${r.adjusted_all_hr_probability}
Grade: ${r.simulation_stack_grade}
`;
  })
].join("\n");

saveTXT(OUT.slateReportTXT, slateReport);

console.log("");
console.log("THE SLIP LAB PHASE 13 CONTENT AUTOMATION COMPLETE");
console.log("");

console.log("Saved:");
Object.values(OUT).forEach(v => console.log(v));

console.log("");

console.table(
  topProbability.slice(0, 10).map(r => ({
    player: r.player,
    team: r.team,
    prob: r.adjusted_hr_probability,
    odds: r.odds,
    fair: r.model_fair_odds,
    tier: r.betting_tier
  }))
);

