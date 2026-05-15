import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const ML_DIR = path.join(ROOT, "exports", "ml_training");
const OUT_DIR = path.join(ROOT, "exports", "model_analysis");

const INPUT_CSV = path.join(ML_DIR, "ml_training_dataset.csv");

const OUT_CSV = path.join(OUT_DIR, "model_performance_analysis.csv");
const OUT_JSON = path.join(OUT_DIR, "model_performance_analysis.json");
const OUT_TXT = path.join(OUT_DIR, "model_performance_summary.txt");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some(v => String(v).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h => String(h).trim());

  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  const escape = value => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(","))
  ].join("\n");
}

function readCsvSafe(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function num(value, fallback = null) {
  const n = Number(String(value ?? "").replace("+", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function pct(value) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function units(value) {
  if (!Number.isFinite(value)) return "0.00u";
  return `${value.toFixed(2)}u`;
}

function bucketNumber(value, buckets, fallback = "UNKNOWN") {
  const n = num(value);

  if (n === null) return fallback;

  for (const bucket of buckets) {
    if (n >= bucket.min && n <= bucket.max) return bucket.label;
  }

  return fallback;
}

function groupRows(rows, keyFn) {
  const map = new Map();

  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  return map;
}

function summarizeGroup(category, label, rows) {
  const plays = rows.length;
  const wins = rows.filter(row => Number(row.outcome) === 1).length;
  const losses = plays - wins;
  const profit = rows.reduce((sum, row) => sum + Number(row.profit_units || 0), 0);
  const avgScore = rows.reduce((sum, row) => sum + Number(row.model_score || 0), 0) / Math.max(plays, 1);
  const avgOdds = rows.reduce((sum, row) => sum + Number(row.odds || 0), 0) / Math.max(plays, 1);
  const avgClv = rows.reduce((sum, row) => sum + Number(row.clv_pct || 0), 0) / Math.max(plays, 1);
  const positiveClvRows = rows.filter(row => String(row.clv_result || "") === "POSITIVE CLV").length;

  return {
    category,
    label,
    plays,
    wins,
    losses,
    hit_rate: plays ? pct((wins / plays) * 100) : "0.0%",
    profit_units: profit.toFixed(2),
    roi: plays ? pct((profit / plays) * 100) : "0.0%",
    avg_model_score: avgScore.toFixed(2),
    avg_odds: avgOdds.toFixed(0),
    avg_clv_pct: avgClv.toFixed(2),
    positive_clv_rate: plays ? pct((positiveClvRows / plays) * 100) : "0.0%"
  };
}

function analyzeByCategory(rows, category, keyFn) {
  const grouped = groupRows(rows, keyFn);
  const output = [];

  for (const [label, group] of grouped.entries()) {
    output.push(summarizeGroup(category, label || "UNKNOWN", group));
  }

  output.sort((a, b) => Number(b.profit_units) - Number(a.profit_units));

  return output;
}

function buildAnalysis(rows) {
  const scoreBuckets = [
    { min: 95, max: 100, label: "95 to 100" },
    { min: 90, max: 94.99, label: "90 to 94" },
    { min: 85, max: 89.99, label: "85 to 89" },
    { min: 80, max: 84.99, label: "80 to 84" },
    { min: 70, max: 79.99, label: "70 to 79" },
    { min: 0, max: 69.99, label: "Under 70" }
  ];

  const oddsBuckets = [
    { min: -1000, max: -200, label: "-200 or shorter" },
    { min: -199, max: -101, label: "-199 to -101" },
    { min: 100, max: 249, label: "+100 to +249" },
    { min: 250, max: 399, label: "+250 to +399" },
    { min: 400, max: 549, label: "+400 to +549" },
    { min: 550, max: 749, label: "+550 to +749" },
    { min: 750, max: 999, label: "+750 to +999" },
    { min: 1000, max: 99999, label: "+1000 or longer" }
  ];

  const attackBuckets = [
    { min: 90, max: 100, label: "90 to 100" },
    { min: 80, max: 89.99, label: "80 to 89" },
    { min: 70, max: 79.99, label: "70 to 79" },
    { min: 60, max: 69.99, label: "60 to 69" },
    { min: 0, max: 59.99, label: "Under 60" }
  ];

  const clvBuckets = [
    { min: 10, max: 999, label: "+10% or better" },
    { min: 5, max: 9.99, label: "+5% to +9.9%" },
    { min: 1, max: 4.99, label: "+1% to +4.9%" },
    { min: -0.99, max: 0.99, label: "Flat" },
    { min: -4.99, max: -1, label: "-1% to -4.9%" },
    { min: -999, max: -5, label: "-5% or worse" }
  ];

  return [
    ...analyzeByCategory(rows, "BOARD", row => row.board),
    ...analyzeByCategory(rows, "TIER", row => `${row.board} | ${row.tier || "NO TIER"}`),
    ...analyzeByCategory(rows, "SCORE RANGE", row => bucketNumber(row.model_score, scoreBuckets)),
    ...analyzeByCategory(rows, "ODDS RANGE", row => bucketNumber(row.odds, oddsBuckets)),
    ...analyzeByCategory(rows, "PITCHER ATTACK RANGE", row => bucketNumber(row.pitcher_attack_score, attackBuckets)),
    ...analyzeByCategory(rows, "CLV RANGE", row => bucketNumber(row.clv_pct, clvBuckets)),
    ...analyzeByCategory(rows, "CLV RESULT", row => row.clv_result || "NO CLV"),
    ...analyzeByCategory(rows, "LINEUP SPOT", row => row.lineup_spot ? `Spot ${row.lineup_spot}` : "UNKNOWN"),
    ...analyzeByCategory(rows, "TEAM", row => row.team || "UNKNOWN"),
    ...analyzeByCategory(rows, "PITCHER", row => row.pitcher || "UNKNOWN")
  ];
}

function topRows(rows, count = 10) {
  return [...rows]
    .sort((a, b) => Number(b.profit_units) - Number(a.profit_units))
    .slice(0, count);
}

function worstRows(rows, count = 10) {
  return [...rows]
    .sort((a, b) => Number(a.profit_units) - Number(b.profit_units))
    .slice(0, count);
}

function buildSummaryText(rows, analysis) {
  const plays = rows.length;
  const wins = rows.filter(row => Number(row.outcome) === 1).length;
  const profit = rows.reduce((sum, row) => sum + Number(row.profit_units || 0), 0);

  const bestGroups = topRows(analysis, 12);
  const worstGroups = worstRows(analysis, 12);

  const lines = [];

  lines.push("THE SLIP LAB MODEL PERFORMANCE ANALYSIS");
  lines.push(`Created: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("OVERALL");
  lines.push(`Plays: ${plays}`);
  lines.push(`Wins: ${wins}`);
  lines.push(`Losses: ${plays - wins}`);
  lines.push(`Hit Rate: ${plays ? pct((wins / plays) * 100) : "0.0%"}`);
  lines.push(`Profit: ${units(profit)}`);
  lines.push(`ROI: ${plays ? pct((profit / plays) * 100) : "0.0%"}`);
  lines.push("");

  lines.push("BEST PERFORMING GROUPS");
  for (const row of bestGroups) {
    lines.push(`${row.category} | ${row.label}: ${row.wins}/${row.plays} | ROI ${row.roi} | ${units(Number(row.profit_units))}`);
  }

  lines.push("");
  lines.push("WORST PERFORMING GROUPS");
  for (const row of worstGroups) {
    lines.push(`${row.category} | ${row.label}: ${row.wins}/${row.plays} | ROI ${row.roi} | ${units(Number(row.profit_units))}`);
  }

  lines.push("");
  lines.push("FILES CREATED");
  lines.push(OUT_CSV);
  lines.push(OUT_JSON);
  lines.push(OUT_TXT);

  return lines.join("\n");
}

function main() {
  ensureDir(OUT_DIR);

  if (!fs.existsSync(INPUT_CSV)) {
    console.error("Missing ML training dataset.");
    console.error("Run this first:");
    console.error("node scripts/build_ml_training_dataset.js");
    process.exit(1);
  }

  const rows = readCsvSafe(INPUT_CSV);

  if (!rows.length) {
    console.error("ML training dataset is empty.");
    console.error("Grade results first, then rebuild the ML dataset.");
    process.exit(1);
  }

  const analysis = buildAnalysis(rows);

  fs.writeFileSync(OUT_CSV, toCsv(analysis));
  fs.writeFileSync(OUT_JSON, JSON.stringify({ rows, analysis }, null, 2));
  fs.writeFileSync(OUT_TXT, buildSummaryText(rows, analysis));

  console.log("");
  console.log("MODEL PERFORMANCE ANALYSIS COMPLETE");
  console.log("Training rows:", rows.length);
  console.log("Analysis rows:", analysis.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);
  console.log("Saved:", OUT_TXT);
}

main();
