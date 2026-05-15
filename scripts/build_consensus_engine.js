import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const FILES = {
  matchup: path.join(DATA_DIR, "matchup_intelligence.csv"),
  pitcherSplits: path.join(DATA_DIR, "pitcher_splits_engine.csv"),
  perPitch: path.join(DATA_DIR, "per_pitch_matchup_engine.csv"),
  weather: path.join(DATA_DIR, "weather_environment_engine.csv"),
  playerStats: path.join(DATA_DIR, "player_stats.csv"),
  master: path.join(DATA_DIR, "master_hr_model.csv")
};

const OUT_CSV = path.join(DATA_DIR, "consensus_engine.csv");
const OUT_JSON = path.join(DATA_DIR, "consensus_engine.json");

function clean(v) {
  return String(v ?? "").trim();
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function key(v) {
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
  if (!fs.existsSync(file)) return [];
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function first(row, names, fallback = "") {
  for (const n of names) {
    if (row && row[n] !== undefined && clean(row[n]) !== "") return row[n];
  }
  return fallback;
}

function playerName(row) {
  return first(row, ["name", "player", "batter", "hitter"]);
}

function teamName(row) {
  return first(row, ["team", "player_team", "batting_team"]);
}

function gameName(row) {
  return first(row, ["game", "matchup", "game_key"]);
}

function pitcherName(row) {
  return first(row, ["pitcher", "opposing_pitcher", "starter"]);
}

function playerGameKey(row) {
  const p = key(playerName(row));
  const g = key(gameName(row));
  return p && g ? `${p}|${g}` : "";
}

function playerPitcherKey(row) {
  const p = key(playerName(row));
  const pit = key(pitcherName(row));
  return p && pit ? `${p}|${pit}` : "";
}

function playerTeamKey(row) {
  const p = key(playerName(row));
  const t = key(teamName(row));
  return p && t ? `${p}|${t}` : "";
}

function playerOnlyKey(row) {
  return key(playerName(row));
}

function indexRows(rows) {
  const byPlayerGame = new Map();
  const byPlayerPitcher = new Map();
  const byPlayerTeam = new Map();
  const byPlayer = new Map();

  for (const r of rows) {
    const pg = playerGameKey(r);
    const pp = playerPitcherKey(r);
    const pt = playerTeamKey(r);
    const po = playerOnlyKey(r);

    if (pg) byPlayerGame.set(pg, r);
    if (pp) byPlayerPitcher.set(pp, r);
    if (pt) byPlayerTeam.set(pt, r);
    if (po) byPlayer.set(po, r);
  }

  return { byPlayerGame, byPlayerPitcher, byPlayerTeam, byPlayer };
}

function lookup(index, base) {
  return (
    index.byPlayerGame.get(playerGameKey(base)) ||
    index.byPlayerPitcher.get(playerPitcherKey(base)) ||
    index.byPlayerTeam.get(playerTeamKey(base)) ||
    index.byPlayer.get(playerOnlyKey(base)) ||
    {}
  );
}

function gradeToScore(grade) {
  const g = clean(grade).toUpperCase();

  if (g.includes("ELITE")) return 90;
  if (g.includes("ATTACK")) return 84;
  if (g.includes("PLUS")) return 74;
  if (g.includes("STRONG")) return 72;
  if (g.includes("PLAYABLE")) return 66;
  if (g.includes("NEUTRAL")) return 55;
  if (g.includes("THIN")) return 42;
  if (g.includes("SUPPRESS")) return 38;
  if (g.includes("AVOID")) return 25;
  if (g.includes("FADE")) return 20;

  return 50;
}

function scoreFrom(row, directNames, gradeNames = ["grade"]) {
  for (const name of directNames) {
    const value = first(row, [name]);
    if (value !== "") return num(value);
  }

  for (const name of gradeNames) {
    const grade = first(row, [name]);
    if (grade !== "") return gradeToScore(grade);
  }

  return 50;
}

function getMatchupScore(row) {
  return scoreFrom(row, [
    "intel",
    "matchup_intelligence",
    "matchup_score",
    "matchup_intelligence_score",
    "hr_matchup_score",
    "score"
  ]);
}

function getPitcherSplitScore(row) {
  return scoreFrom(row, [
    "split_engine_score",
    "pitcher_attack_score",
    "pitcher_vulnerability_score",
    "handedness_split_score",
    "score",
    "split",
    "pitcher_splits_score",
    "split_score",
    "hr_split_score"
  ], ["split_grade", "grade"]);
}

function getPerPitchScore(row) {
  return scoreFrom(row, [
    "score",
    "per_pitch_score",
    "pitch_matchup_score",
    "pitch_type_score",
    "arsenal_score"
  ]);
}

function getWeatherScore(row) {
  return scoreFrom(row, [
    "env",
    "environment_score",
    "weather_environment_score",
    "weather_score",
    "score"
  ]);
}

function getMarketScore(row) {
  const odds = num(first(row, ["odds", "best_odds", "hr_odds"]), 0);
  const ev = num(first(row, ["ev", "edge", "value", "ev_pct"]), 0);
  const vegasBoost = num(first(row, ["vegas_boost", "total_boost", "game_total_boost", "boost"]), 0);
  const weatherBoost = num(first(row, ["weather_boost"]), 0);

  let score = 50;

  if (odds > 0) {
    if (odds <= 250) score += 12;
    else if (odds <= 400) score += 9;
    else if (odds <= 600) score += 6;
    else if (odds <= 850) score += 3;
    else score -= 2;
  }

  score += clamp(ev * 0.08, -10, 16);
  score += clamp(vegasBoost * 2, 0, 14);
  score += clamp(weatherBoost * 2, -6, 10);

  return clamp(score, 0, 100);
}

function agreementGrade(score) {
  if (score >= 84) return "UNANIMOUS";
  if (score >= 76) return "STRONG_AGREEMENT";
  if (score >= 68) return "POSITIVE_AGREEMENT";
  if (score >= 60) return "MIXED_POSITIVE";
  if (score >= 52) return "MIXED";
  if (score >= 44) return "WEAK";
  return "FADE";
}

function confidenceGrade(score, greenLights, redFlags) {
  if (score >= 82 && greenLights >= 4 && redFlags === 0) return "HIGH";
  if (score >= 74 && greenLights >= 3 && redFlags === 0) return "MEDIUM_HIGH";
  if (score >= 66 && greenLights >= 3) return "MEDIUM";
  if (score >= 58 && greenLights >= 2) return "LOW_MEDIUM";
  return "LOW";
}

function decision(score, greenLights, redFlags) {
  if (score >= 82 && greenLights >= 4 && redFlags === 0) return "CORE_PLAY";
  if (score >= 74 && greenLights >= 3 && redFlags === 0) return "STRONG_PLAY";
  if (score >= 66 && greenLights >= 3) return "PLAYABLE";
  if (score >= 60 && greenLights >= 2) return "LEANS_PLAYABLE";
  if (redFlags >= 2) return "FADE";
  return "THIN";
}

function getBaseRows() {
  const sources = [
    readCSV(FILES.playerStats),
    readCSV(FILES.master),
    readCSV(FILES.matchup),
    readCSV(FILES.pitcherSplits),
    readCSV(FILES.perPitch),
    readCSV(FILES.weather)
  ];

  for (const rows of sources) {
    if (rows.length) return rows;
  }

  return [];
}

const baseRows = getBaseRows();

const matchupIndex = indexRows(readCSV(FILES.matchup));
const splitsIndex = indexRows(readCSV(FILES.pitcherSplits));
const perPitchIndex = indexRows(readCSV(FILES.perPitch));
const weatherIndex = indexRows(readCSV(FILES.weather));
const playerStatsIndex = indexRows(readCSV(FILES.playerStats));
const masterIndex = indexRows(readCSV(FILES.master));

const out = [];

let matchedMatchup = 0;
let matchedSplits = 0;
let matchedPerPitch = 0;
let matchedWeather = 0;

for (const base of baseRows) {
  const player = playerName(base);
  if (!player) continue;

  const matchup = lookup(matchupIndex, base);
  const splits = lookup(splitsIndex, base);
  const perPitch = lookup(perPitchIndex, base);
  const weather = lookup(weatherIndex, base);
  const playerStats = lookup(playerStatsIndex, base);
  const master = lookup(masterIndex, base);

  if (Object.keys(matchup).length) matchedMatchup++;
  if (Object.keys(splits).length) matchedSplits++;
  if (Object.keys(perPitch).length) matchedPerPitch++;
  if (Object.keys(weather).length) matchedWeather++;

  const team =
    teamName(base) ||
    teamName(matchup) ||
    teamName(splits) ||
    teamName(perPitch) ||
    teamName(weather);

  const game =
    gameName(base) ||
    gameName(matchup) ||
    gameName(splits) ||
    gameName(perPitch) ||
    gameName(weather);

  const pitcher =
    pitcherName(base) ||
    pitcherName(matchup) ||
    pitcherName(splits) ||
    pitcherName(perPitch) ||
    pitcherName(weather);

  const odds = first(base, ["odds", "best_odds", "hr_odds"], first(matchup, ["odds"], first(splits, ["odds"], first(perPitch, ["odds"]))));

  const matchupScore = getMatchupScore(matchup);
  const splitScore = getPitcherSplitScore(splits);
  const perPitchScore = getPerPitchScore(perPitch);
  const weatherScore = getWeatherScore(weather);
  const marketScore = getMarketScore({ ...playerStats, ...master, ...base });

  const scores = [matchupScore, splitScore, perPitchScore, weatherScore, marketScore];

  const rawConsensus =
    matchupScore * 0.25 +
    splitScore * 0.25 +
    perPitchScore * 0.23 +
    weatherScore * 0.10 +
    marketScore * 0.17;

  const floorScore = Math.min(...scores);
  const ceilingScore = Math.max(...scores);
  const agreementSpread = ceilingScore - floorScore;
  const agreementPenalty = clamp(agreementSpread * 0.05, 0, 4.5);

  const greenLights = scores.filter(s => s >= 66).length;
  const redFlags = scores.filter(s => s < 45).length;

  const greenLightBonus = clamp(greenLights * 1.4, 0, 5);
  const redFlagPenalty = clamp(redFlags * 3.5, 0, 10);

  const consensusScore = clamp(rawConsensus - agreementPenalty + greenLightBonus - redFlagPenalty, 0, 100);

  out.push({
    rank: 0,
    player,
    team,
    game,
    pitcher,
    odds,
    matchup_score: matchupScore.toFixed(2),
    pitcher_splits_score: splitScore.toFixed(2),
    per_pitch_score: perPitchScore.toFixed(2),
    weather_environment_score: weatherScore.toFixed(2),
    market_score: marketScore.toFixed(2),
    green_lights: greenLights,
    red_flags: redFlags,
    floor_score: floorScore.toFixed(2),
    ceiling_score: ceilingScore.toFixed(2),
    agreement_spread: agreementSpread.toFixed(2),
    agreement_penalty: agreementPenalty.toFixed(2),
    consensus_score: consensusScore.toFixed(2),
    agreement_grade: agreementGrade(consensusScore),
    confidence: confidenceGrade(consensusScore, greenLights, redFlags),
    decision: decision(consensusScore, greenLights, redFlags),
    matchup_matched: Object.keys(matchup).length ? "YES" : "NO",
    splits_matched: Object.keys(splits).length ? "YES" : "NO",
    per_pitch_matched: Object.keys(perPitch).length ? "YES" : "NO",
    weather_matched: Object.keys(weather).length ? "YES" : "NO"
  });
}

out.sort((a, b) => num(b.consensus_score) - num(a.consensus_score));
out.forEach((r, i) => r.rank = i + 1);

fs.writeFileSync(OUT_CSV, toCSV(out));
fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));

const spread = out.reduce((acc, r) => {
  acc[r.decision] = (acc[r.decision] || 0) + 1;
  return acc;
}, {});

console.log("");
console.log("THE SLIP LAB CONSENSUS ENGINE COMPLETE");
console.log("Rows:", out.length);
console.log("Matched matchup:", matchedMatchup);
console.log("Matched pitcher splits:", matchedSplits);
console.log("Matched per pitch:", matchedPerPitch);
console.log("Matched weather:", matchedWeather);
console.log("Saved:", OUT_CSV);
console.log("Saved:", OUT_JSON);
console.log("Decision spread:", spread);
console.log("");

console.table(out.slice(0, 20).map(r => ({
  rank: r.rank,
  player: r.player,
  team: r.team,
  pitcher: r.pitcher,
  odds: r.odds,
  matchup: r.matchup_score,
  splits: r.pitcher_splits_score,
  pitch: r.per_pitch_score,
  weather: r.weather_environment_score,
  market: r.market_score,
  consensus: r.consensus_score,
  decision: r.decision,
  confidence: r.confidence
})));
