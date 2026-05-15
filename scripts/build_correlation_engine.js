import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EXPORT_DIR = path.join(ROOT, "exports");

const INPUTS = [
  path.join(DATA_DIR, "master_hr_model.csv"),
  path.join(DATA_DIR, "consensus_engine.csv"),
  path.join(DATA_DIR, "weather_environment_engine.csv"),
  path.join(DATA_DIR, "matchup_intelligence.csv"),
  path.join(DATA_DIR, "pitcher_splits_engine.csv"),
  path.join(DATA_DIR, "per_pitch_matchup_engine.csv"),
  path.join(DATA_DIR, "player_handedness_engine.csv")
];

const OUT_CSV = path.join(DATA_DIR, "correlation_engine.csv");
const OUT_JSON = path.join(DATA_DIR, "correlation_engine.json");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function clean(v) {
  return String(v ?? "").trim();
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function key(v) {
  return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

function readCSV(file) {
  if (!fs.existsSync(file)) return [];
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function first(row, names, fallback = "") {
  for (const n of names) {
    if (row[n] !== undefined && clean(row[n]) !== "") return row[n];
  }
  return fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function avg(values) {
  const good = values.map(v => num(v, null)).filter(v => v !== null && Number.isFinite(v));
  if (!good.length) return 0;
  return good.reduce((a, b) => a + b, 0) / good.length;
}

function loadIndexed(file, keyBuilder) {
  const rows = readCSV(file);
  const map = new Map();
  for (const r of rows) {
    const k = keyBuilder(r);
    if (k) map.set(k, r);
  }
  return map;
}

function playerGameKey(row) {
  const player = key(first(row, ["player", "name", "batter", "hitter"]));
  const game = key(first(row, ["game", "matchup", "game_key"]));
  return player && game ? `${player}|${game}` : "";
}

function gameKey(row) {
  return key(first(row, ["game", "matchup", "game_key"]));
}

function pitcherGameKey(row) {
  const pitcher = key(first(row, ["pitcher", "opposing_pitcher", "starter"]));
  const game = key(first(row, ["game", "matchup", "game_key"]));
  return pitcher && game ? `${pitcher}|${game}` : "";
}

function getModelRows() {
  for (const file of INPUTS) {
    if (fs.existsSync(file)) {
      const rows = readCSV(file);
      if (rows.length && file.includes("master_hr_model")) return rows;
    }
  }

  const fallbackFiles = [
    path.join(DATA_DIR, "final_hr_board.csv"),
    path.join(DATA_DIR, "hr_board.csv"),
    path.join(EXPORT_DIR, "final_hr_boards.csv")
  ];

  for (const file of fallbackFiles) {
    if (fs.existsSync(file)) {
      const rows = readCSV(file);
      if (rows.length) return rows;
    }
  }

  return [];
}

function scoreEnvironment(row, weatherRow, consensusRow) {
  const vegasTotal = num(first(row, ["vegas_total", "total", "game_total"], first(consensusRow || {}, ["vegas_total", "total", "game_total"], 0)));
  const weatherBoost = num(first(row, ["weather_boost", "weather_score"], first(weatherRow || {}, ["weather_boost", "weather_score"], 0)));
  const parkBoost = num(first(row, ["park_boost", "park_factor", "hr_park_factor"], 0));
  const consensusScore = num(first(row, ["consensus_score", "agreement_score"], first(consensusRow || {}, ["consensus_score", "agreement_score"], 0)));

  let score = 50;
  score += clamp((vegasTotal - 8) * 5, -10, 18);
  score += clamp(weatherBoost * 4, -8, 16);
  score += clamp(parkBoost * 2, -8, 12);
  score += clamp((consensusScore - 50) * 0.18, -8, 12);

  return clamp(score, 0, 100);
}

function scorePitcherCollapse(row, splitRow, pitchRow) {
  const pitcherAttack = num(first(row, ["pitcher_attack_score", "pitcher_score", "attack_score"], 0));
  const splitScore = num(first(splitRow || {}, ["pitcher_splits_score", "split_score", "hr_split_score"], 0));
  const pitchScore = num(first(pitchRow || {}, ["per_pitch_score", "pitch_matchup_score", "pitch_type_score"], 0));
  const hardContact = num(first(row, ["hard_hit_pct", "hardhit_pct", "hard_hit"], 0));
  const barrel = num(first(row, ["barrel_pct", "barrel"], 0));

  let score = 35;
  score += clamp(pitcherAttack * 0.35, 0, 35);
  score += clamp(splitScore * 0.2, 0, 20);
  score += clamp(pitchScore * 0.2, 0, 20);
  score += clamp(hardContact * 0.12, 0, 8);
  score += clamp(barrel * 0.45, 0, 10);

  return clamp(score, 0, 100);
}

function scoreBatterPower(row, handedRow, matchupRow) {
  const modelScore = num(first(row, ["final_score", "hr_score", "score", "model_score"], 0));
  const matchupScore = num(first(matchupRow || {}, ["matchup_score", "matchup_intelligence_score", "hr_matchup_score"], 0));
  const handedScore = num(first(handedRow || {}, ["handedness_score", "platoon_score", "split_score"], 0));
  const barrel = num(first(row, ["barrel_pct", "barrel"], 0));
  const xslg = num(first(row, ["xslg", "xSLG"], 0));

  let score = 0;
  score += modelScore * 0.45;
  score += matchupScore * 0.2;
  score += handedScore * 0.15;
  score += clamp(barrel * 1.1, 0, 15);
  score += clamp(xslg * 12, 0, 10);

  return clamp(score, 0, 100);
}

function label(score) {
  if (score >= 82) return "ELITE_CORRELATION";
  if (score >= 72) return "STRONG_CORRELATION";
  if (score >= 62) return "STACKABLE";
  if (score >= 50) return "NEUTRAL";
  return "NEGATIVE_CORRELATION";
}

ensureDir(DATA_DIR);
ensureDir(EXPORT_DIR);

const modelRows = getModelRows();

const consensus = loadIndexed(path.join(DATA_DIR, "consensus_engine.csv"), playerGameKey);
const weather = loadIndexed(path.join(DATA_DIR, "weather_environment_engine.csv"), gameKey);
const matchup = loadIndexed(path.join(DATA_DIR, "matchup_intelligence.csv"), playerGameKey);
const splits = loadIndexed(path.join(DATA_DIR, "pitcher_splits_engine.csv"), pitcherGameKey);
const pitch = loadIndexed(path.join(DATA_DIR, "per_pitch_matchup_engine.csv"), playerGameKey);
const handed = loadIndexed(path.join(DATA_DIR, "player_handedness_engine.csv"), playerGameKey);

const rows = [];

for (const r of modelRows) {
  const pgk = playerGameKey(r);
  const gk = gameKey(r);
  const pitcher = first(r, ["pitcher", "opposing_pitcher", "starter"]);
  const pk = pitcher && gk ? `${key(pitcher)}|${gk}` : "";

  const weatherRow = weather.get(gk) || {};
  const consensusRow = consensus.get(pgk) || {};
  const matchupRow = matchup.get(pgk) || {};
  const splitRow = splits.get(pk) || {};
  const pitchRow = pitch.get(pgk) || {};
  const handedRow = handed.get(pgk) || {};

  const batterPower = scoreBatterPower(r, handedRow, matchupRow);
  const environment = scoreEnvironment(r, weatherRow, consensusRow);
  const pitcherCollapse = scorePitcherCollapse(r, splitRow, pitchRow);

  const team = first(r, ["team", "player_team", "batting_team"]);
  const opp = first(r, ["opponent", "opp", "opposing_team"]);
  const game = first(r, ["game", "matchup", "game_key"]);
  const player = first(r, ["player", "name", "batter", "hitter"]);
  const odds = first(r, ["odds", "best_odds", "hr_odds"], "");
  const book = first(r, ["book", "sportsbook", "best_book"], "");
  const lineup = first(r, ["lineup", "batting_order", "order"], "");

  const vegasTotal = num(first(r, ["vegas_total", "total", "game_total"], first(consensusRow, ["vegas_total", "total", "game_total"], 0)));
  const weatherBoost = num(first(r, ["weather_boost", "weather_score"], first(weatherRow, ["weather_boost", "weather_score"], 0)));

  const sameGameBoost = clamp((environment - 50) * 0.25, -8, 14);
  const collapseBoost = clamp((pitcherCollapse - 50) * 0.28, -8, 14);
  const powerBoost = clamp((batterPower - 50) * 0.35, -12, 18);

  const correlationScore = clamp(50 + sameGameBoost + collapseBoost + powerBoost, 0, 100);

  rows.push({
    player,
    team,
    opponent: opp,
    game,
    pitcher,
    lineup,
    odds,
    book,
    batter_power_score: batterPower.toFixed(2),
    environment_score: environment.toFixed(2),
    pitcher_collapse_score: pitcherCollapse.toFixed(2),
    vegas_total: vegasTotal || "",
    weather_boost: weatherBoost || "",
    correlation_score: correlationScore.toFixed(2),
    correlation_tier: label(correlationScore),
    same_game_stack_flag: correlationScore >= 62 ? "YES" : "NO",
    negative_correlation_flag: correlationScore < 50 ? "YES" : "NO"
  });
}

rows.sort((a, b) => num(b.correlation_score) - num(a.correlation_score));

fs.writeFileSync(OUT_CSV, toCSV(rows));
fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2));

console.log("PHASE 7 CORRELATION ENGINE COMPLETE");
console.log("Rows:", rows.length);
console.log("Saved:", OUT_CSV);
console.log("Saved:", OUT_JSON);
