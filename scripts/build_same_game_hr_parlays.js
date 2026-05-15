import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EXPORT_DIR = path.join(ROOT, "exports");

const IN_CSV = path.join(DATA_DIR, "hr_stack_builder.csv");

const OUT_CSV = path.join(DATA_DIR, "same_game_hr_parlays.csv");
const OUT_JSON = path.join(DATA_DIR, "same_game_hr_parlays.json");
const OUT_TXT = path.join(EXPORT_DIR, "same_game_hr_parlays.txt");

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

      if (row.some(x => clean(x) !== "")) rows.push(row);

      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);
    if (row.some(x => clean(x) !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map(h => clean(h));

  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = clean(r[i]));
    return obj;
  });
}

function toCSV(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  const esc = v => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return [
    headers.join(","),
    ...rows.map(r => headers.map(h => esc(r[h])).join(","))
  ].join("\n");
}

function readCSV(file) {
  if (!fs.existsSync(file)) {
    console.log("Missing:", file);
    return [];
  }

  return parseCSV(fs.readFileSync(file, "utf8"));
}

function impliedFromAmerican(odds) {
  const n = num(odds);

  if (!n) return 0;

  if (n > 0) return 100 / (n + 100);
  return Math.abs(n) / (Math.abs(n) + 100);
}

function payoutTier(score) {
  if (score >= 88) return "S+";
  if (score >= 80) return "S";
  if (score >= 72) return "A";
  if (score >= 64) return "B";
  return "C";
}

function confidence(score) {
  if (score >= 90) return "MAX";
  if (score >= 82) return "HIGH";
  if (score >= 72) return "STRONG";
  if (score >= 60) return "MODERATE";
  return "LOW";
}

function formatTicket(r, i) {
  return [
    `#${i + 1}`,
    `${r.players}`,
    `${r.game}`,
    `Type: ${r.stack_type}`,
    `Grade: ${r.parlay_grade}`,
    `Confidence: ${r.confidence}`,
    `Correlation: ${r.avg_correlation_score}`,
    `Stack Score: ${r.stack_score}`,
    `Environment: ${r.avg_environment_score}`,
    `Pitcher Collapse: ${r.avg_pitcher_collapse_score}`,
    `Risk: ${r.risk_profile}`,
    `Payout: ${r.payout_profile}`,
    ""
  ].join("\n");
}

const rows = readCSV(IN_CSV);

const parlays = [];

for (const r of rows) {
  const stackScore = num(r.stack_score);
  const corr = num(r.avg_correlation_score);
  const env = num(r.avg_environment_score);
  const collapse = num(r.avg_pitcher_collapse_score);
  const power = num(r.avg_batter_power_score);

  const players = clean(r.players)
    .split("+")
    .map(s => s.trim());

  const oddsPieces = clean(r.odds)
    .split("|")
    .map(s => s.trim());

  const implied = oddsPieces.map(p => {
    const match = p.match(/([+-]\d+)/);
    return match ? impliedFromAmerican(match[1]) : 0.12;
  });

  const combinedProb = implied.reduce((a, b) => a * b, 1);

  const synergyBoost =
    (corr * 0.0035) +
    (env * 0.0020) +
    (collapse * 0.0022);

  const adjustedProbability = combinedProb * (1 + synergyBoost);

  const parlayScore =
    stackScore * 0.46 +
    corr * 0.22 +
    env * 0.14 +
    collapse * 0.10 +
    power * 0.08;

  let risk = "BALANCED";

  if (r.stack_size === "4") risk = "AGGRESSIVE";
  if (num(r.avg_environment_score) < 58) risk = "HIGH_RISK";
  if (num(r.avg_correlation_score) >= 80) risk = "LOW_RISK";

  parlays.push({
    game: r.game,
    stack_type: r.stack_type,
    stack_size: r.stack_size,
    players: r.players,
    teams: r.teams,
    pitcher: r.pitcher,
    payout_profile: r.payout_profile,
    avg_correlation_score: corr.toFixed(2),
    avg_environment_score: env.toFixed(2),
    avg_pitcher_collapse_score: collapse.toFixed(2),
    avg_batter_power_score: power.toFixed(2),
    stack_score: stackScore.toFixed(2),
    combined_implied_probability: (combinedProb * 100).toFixed(4) + "%",
    adjusted_probability: (adjustedProbability * 100).toFixed(4) + "%",
    correlation_synergy_boost: (synergyBoost * 100).toFixed(2) + "%",
    parlay_score: parlayScore.toFixed(2),
    parlay_grade: payoutTier(parlayScore),
    confidence: confidence(parlayScore),
    risk_profile: risk,
    odds: r.odds
  });
}

parlays.sort((a, b) => num(b.parlay_score) - num(a.parlay_score));

fs.writeFileSync(OUT_CSV, toCSV(parlays));
fs.writeFileSync(OUT_JSON, JSON.stringify(parlays, null, 2));

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const txt = parlays
  .slice(0, 25)
  .map((r, i) => formatTicket(r, i))
  .join("\n============================\n\n");

fs.writeFileSync(OUT_TXT, txt);

console.log("PHASE 7 SAME GAME HR PARLAYS COMPLETE");
console.log("Parlays:", parlays.length);
console.log("Saved:", OUT_CSV);
console.log("Saved:", OUT_JSON);
console.log("Saved:", OUT_TXT);
