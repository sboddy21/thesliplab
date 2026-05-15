import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");

fs.mkdirSync(EXPORTS, { recursive: true });

const OUT_CSV = path.join(EXPORTS, "early_hr_looks.csv");
const OUT_JSON = path.join(EXPORTS, "early_hr_looks.json");
const OUT_TXT = path.join(EXPORTS, "early_hr_looks.txt");

function readSafe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function splitCsv(line) {
  const out = [];
  let cur = "";
  let quote = false;

  for (const ch of line) {
    if (ch === '"') quote = !quote;
    else if (ch === "," && !quote) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur);
  return out.map(v => v.trim().replace(/^"|"$/g, ""));
}

function readCsv(file) {
  const raw = readSafe(file);
  if (!raw.trim()) return [];

  const lines = raw.trim().split(/\r?\n/);
  const headers = splitCsv(lines.shift());

  return lines.map(line => {
    const vals = splitCsv(line);
    const row = {};
    headers.forEach((h, i) => row[h] = vals[i] ?? "");
    return row;
  });
}

function n(v, fallback = 0) {
  const x = Number(String(v ?? "").replace("%", "").replace("+", ""));
  return Number.isFinite(x) ? x : fallback;
}

function esc(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const consensus = readCsv(path.join(DATA, "consensus_engine.csv"));
const sim = readCsv(path.join(DATA, "simulation_engine.csv"));
const results = readCsv(path.join(DATA, "hr_results.csv"));

const simByPlayer = new Map();
for (const r of sim) {
  const player = r.player || r.name || "";
  const team = r.team || "";
  if (player) simByPlayer.set(`${player}|${team}`, r);
}

const yesterdayWinners = new Set(
  results
    .filter(r => String(r.hr || "").toUpperCase() === "YES")
    .map(r => r.player || r.name)
    .filter(Boolean)
);

const rows = [];

for (const r of consensus) {
  const player = r.player || "";
  const team = r.team || "";
  if (!player || !team) continue;

  const s = simByPlayer.get(`${player}|${team}`) || {};

  const consensusScore = n(r.consensus_score, 50);
  const matchupScore = n(r.matchup_score, 50);
  const splitsScore = n(r.pitcher_splits_score, 50);
  const pitchScore = n(r.per_pitch_score, 50);
  const weatherScore = n(r.weather_environment_score, 50);
  const marketScore = n(r.market_score, 50);
  const ceilingScore = n(r.ceiling_score, 50);
  const greenLights = n(r.green_lights, 0);
  const redFlags = n(r.red_flags, 0);

  const odds = n(r.odds || s.odds, 0);
  const prob = n(s.prob, 0);
  const ev = n(s.ev, 0);

  let earlyScore =
    consensusScore * 0.38 +
    matchupScore * 0.14 +
    splitsScore * 0.14 +
    pitchScore * 0.14 +
    ceilingScore * 0.08 +
    marketScore * 0.06 +
    weatherScore * 0.04 +
    greenLights * 2.25 -
    redFlags * 4;

  if (odds >= 400) earlyScore += 2.5;
  if (odds >= 550) earlyScore += 2.5;
  if (ev > 0) earlyScore += 4;

  if (yesterdayWinners.has(player)) earlyScore -= 8;

  let label = "WATCHLIST";
  if (earlyScore >= 78) label = "EARLY CORE";
  else if (earlyScore >= 72) label = "EARLY LEAN";
  else if (odds >= 500 && earlyScore >= 66) label = "VALUE LOOK";

  rows.push({
    player,
    team,
    game: r.game || "",
    pitcher: r.pitcher || "",
    odds,
    probability: s.prob || "",
    fair: s.fair || "",
    ev: s.ev || "",
    consensus_score: consensusScore.toFixed(2),
    matchup_score: matchupScore.toFixed(2),
    pitcher_splits_score: splitsScore.toFixed(2),
    per_pitch_score: pitchScore.toFixed(2),
    weather_environment_score: weatherScore.toFixed(2),
    market_score: marketScore.toFixed(2),
    green_lights: greenLights,
    red_flags: redFlags,
    early_score: earlyScore.toFixed(2),
    label,
    yesterday_hr_penalty: yesterdayWinners.has(player) ? "YES" : "NO"
  });
}

rows.sort((a, b) => n(b.early_score) - n(a.early_score));

const final = [];
const gameCount = new Map();
const teamCount = new Map();

for (const r of rows) {
  const game = r.game || "UNKNOWN";
  const team = r.team || "UNKNOWN";

  if ((gameCount.get(game) || 0) >= 4) continue;
  if ((teamCount.get(team) || 0) >= 2) continue;

  final.push({ rank: final.length + 1, ...r });

  gameCount.set(game, (gameCount.get(game) || 0) + 1);
  teamCount.set(team, (teamCount.get(team) || 0) + 1);

  if (final.length >= 20) break;
}

const headers = Object.keys(final[0] || {});
const csv = [
  headers.join(","),
  ...final.map(r => headers.map(h => esc(r[h])).join(","))
].join("\n");

const txt = [
  "THE SLIP LAB EARLY HR LOOKS",
  "",
  "Not final plays. These are early watchlist bats before confirmed lineups, late odds movement, and final pitcher checks.",
  "",
  ...final.slice(0, 10).map(r =>
    `${r.rank}. ${r.player} | ${r.team} | vs ${r.pitcher} | +${r.odds} | ${r.label} | Score ${r.early_score}`
  )
].join("\n");

fs.writeFileSync(OUT_CSV, csv);
fs.writeFileSync(OUT_JSON, JSON.stringify(final, null, 2));
fs.writeFileSync(OUT_TXT, txt);

console.log("\nTHE SLIP LAB EARLY HR LOOKS COMPLETE");
console.log("Input consensus rows:", consensus.length);
console.log("Output rows:", final.length);
console.log("Saved:", OUT_CSV);
console.log("Saved:", OUT_JSON);
console.log("Saved:", OUT_TXT);
console.table(final.slice(0, 12).map(r => ({
  rank: r.rank,
  player: r.player,
  team: r.team,
  odds: r.odds,
  score: r.early_score,
  label: r.label,
  penalty: r.yesterday_hr_penalty
})));
