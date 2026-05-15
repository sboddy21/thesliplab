import path from "path";
import {
  DATA_DIR,
  readCSV,
  writeCSV,
  backupFile,
  normalizeName,
  normalizeTeam,
  num,
  clamp
} from "./normalize_utils.js";

const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const LOG_FILE = path.join(DATA_DIR, "batter_game_logs.csv");
const MISSING_FILE = path.join(DATA_DIR, "trend_missing_rows.csv");

function teamKey(value = "") {
  return normalizeTeam(
    String(value || "")
      .replace(/_MLB$/i, "")
      .replace(/_/g, " ")
      .replace(/\./g, "")
      .replace(/\bSTLOUIS\b/i, "ST LOUIS")
      .replace(/\bST LOUIS\b/i, "ST LOUIS")
  );
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && String(row[name]).trim() !== "") return row[name];
  }

  const keys = Object.keys(row);

  for (const want of names) {
    const found = keys.find(k => normalizeName(k) === normalizeName(want));
    if (found && String(row[found]).trim() !== "") return row[found];
  }

  return "";
}

function avg(rows, field) {
  if (!rows.length) return 0;
  return rows.reduce((sum, r) => sum + num(r[field]), 0) / rows.length;
}

function sum(rows, field) {
  return rows.reduce((total, r) => total + num(r[field]), 0);
}

function trendScore(l5, l10) {
  const l5Hr = sum(l5, "hr");
  const l10Hr = sum(l10, "hr");
  const l5Tb = avg(l5, "tb");
  const l10Tb = avg(l10, "tb");
  const l5Hit = avg(l5, "hits");
  const l10Hit = avg(l10, "hits");
  const l5Pa = avg(l5, "pa");

  let score = 35;

  score += Math.min(28, l5Hr * 10);
  score += Math.min(22, l10Hr * 5);
  score += clamp((l5Tb - 0.8) * 12, 0, 22);
  score += clamp((l10Tb - 0.9) * 8, 0, 18);
  score += clamp((l5Hit - 0.5) * 10, 0, 12);
  score += clamp((l10Hit - 0.6) * 6, 0, 8);
  score += clamp((l5Pa - 3.0) * 4, 0, 8);

  return clamp(score, 0, 100);
}

function trendLabel(score) {
  const s = num(score);

  if (s >= 75) return "HOT";
  if (s >= 58) return "WARM";
  if (s >= 40) return "NEUTRAL";

  return "COLD";
}

function buildTrend(logs) {
  const sorted = logs
    .filter(r => num(r.pa) > 0)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const l5 = sorted.slice(0, 5);
  const l10 = sorted.slice(0, 10);
  const l15 = sorted.slice(0, 15);

  if (!l5.length) return null;

  const hot = trendScore(l5, l10);
  const label = trendLabel(hot);

  return {
    trend: label,
    trend_score: hot.toFixed(2),
    hot_score: hot.toFixed(2),
    l5_games: String(l5.length),
    l10_games: String(l10.length),
    l15_games: String(l15.length),
    l5_hr: String(sum(l5, "hr")),
    l10_hr: String(sum(l10, "hr")),
    l15_hr: String(sum(l15, "hr")),
    l5_hits: String(sum(l5, "hits")),
    l10_hits: String(sum(l10, "hits")),
    l5_tb: String(sum(l5, "tb")),
    l10_tb: String(sum(l10, "tb")),
    l5_tbpg: avg(l5, "tb").toFixed(2),
    l10_tbpg: avg(l10, "tb").toFixed(2),
    l5_hitpg: avg(l5, "hits").toFixed(2),
    l10_hitpg: avg(l10, "hits").toFixed(2),
    l5_papg: avg(l5, "pa").toFixed(2),
    l10_papg: avg(l10, "pa").toFixed(2),
    trend_last_game: sorted[0]?.date || "",
    trend_match_type: "mlbam_team"
  };
}

const players = readCSV(PLAYER_FILE);
const logs = readCSV(LOG_FILE);

const logsByMlbamTeam = new Map();
const logsByNameTeam = new Map();
const teamsByName = new Map();

for (const row of logs) {
  const mlbam = String(getField(row, ["mlbam", "player_id", "id"])).trim();
  const name = getField(row, ["name", "player"]);
  const team = getField(row, ["team"]);
  const nKey = normalizeName(name);
  const tKey = teamKey(team);

  if (nKey && tKey) {
    if (!teamsByName.has(nKey)) teamsByName.set(nKey, new Set());
    teamsByName.get(nKey).add(team);
  }

  if (mlbam && tKey) {
    const key = `${mlbam}|${tKey}`;
    if (!logsByMlbamTeam.has(key)) logsByMlbamTeam.set(key, []);
    logsByMlbamTeam.get(key).push(row);
  }

  if (nKey && tKey) {
    const key = `${nKey}|${tKey}`;
    if (!logsByNameTeam.has(key)) logsByNameTeam.set(key, []);
    logsByNameTeam.get(key).push(row);
  }
}

let mlbamMatches = 0;
let nameTeamMatches = 0;
let noMatch = 0;

const missing = [];

const updated = players.map(row => {
  const mlbam = String(getField(row, ["mlbam", "player_id", "id"])).trim();
  const name = getField(row, ["name", "player"]);
  const team = getField(row, ["team"]);
  const nKey = normalizeName(name);
  const tKey = teamKey(team);

  let playerLogs = [];
  let matchType = "";

  if (mlbam && logsByMlbamTeam.has(`${mlbam}|${tKey}`)) {
    playerLogs = logsByMlbamTeam.get(`${mlbam}|${tKey}`);
    matchType = "mlbam_team";
    mlbamMatches++;
  } else if (logsByNameTeam.has(`${nKey}|${tKey}`)) {
    playerLogs = logsByNameTeam.get(`${nKey}|${tKey}`);
    matchType = "exact_name_team";
    nameTeamMatches++;
  }

  const trend = buildTrend(playerLogs);

  if (!trend) {
    noMatch++;

    const availableTeams = Array.from(teamsByName.get(nKey) || []).join(" | ");

    missing.push({
      name,
      mlbam,
      team,
      game: row.game || "",
      reason: availableTeams ? "NAME_FOUND_BUT_TEAM_DID_NOT_MATCH" : "NO_LOG_MATCH",
      available_log_teams: availableTeams
    });

    return {
      ...row,
      trend: "NO_MATCH",
      trend_score: "0.00",
      hot_score: "0.00",
      l5_games: "0",
      l10_games: "0",
      l15_games: "0",
      l5_hr: "0",
      l10_hr: "0",
      l15_hr: "0",
      l5_hits: "0",
      l10_hits: "0",
      l5_tb: "0",
      l10_tb: "0",
      l5_tbpg: "0.00",
      l10_tbpg: "0.00",
      l5_hitpg: "0.00",
      l10_hitpg: "0.00",
      l5_papg: "0.00",
      l10_papg: "0.00",
      trend_last_game: "",
      trend_match_type: "NO_MATCH"
    };
  }

  return {
    ...row,
    ...trend,
    trend_match_type: matchType
  };
});

const backup = backupFile(PLAYER_FILE);
writeCSV(PLAYER_FILE, updated);
writeCSV(MISSING_FILE, missing);

console.log("Trend merge complete.");
console.log(`Player rows: ${players.length}`);
console.log(`Game log rows: ${logs.length}`);
console.log(`MLBAM team matches: ${mlbamMatches}`);
console.log(`Exact name and team fallback matches: ${nameTeamMatches}`);
console.log(`No match: ${noMatch}`);
console.log(`Backup: ${backup || "none"}`);
console.log(`Updated: ${PLAYER_FILE}`);
console.log(`Missing or rejected trends: ${MISSING_FILE}`);

console.table(updated.slice(0, 25).map(r => ({
  rank: r.rank,
  name: r.name,
  mlbam: r.mlbam,
  team: r.team,
  trend: r.trend,
  match: r.trend_match_type,
  hot: r.hot_score,
  l5_hr: r.l5_hr,
  l10_hr: r.l10_hr,
  l5_tbpg: r.l5_tbpg,
  l10_tbpg: r.l10_tbpg
})));

if (missing.length) {
  console.log("Missing or rejected trend sample:");
  console.table(missing.slice(0, 20));
}