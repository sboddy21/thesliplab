import path from "path";
import {
  DATA_DIR,
  readCSV,
  writeCSV,
  fetchJSON,
  normalizeName,
  normalizeTeam,
  num,
  todayET
} from "./normalize_utils.js";

const SEASON = Number(process.env.SEASON || new Date().getFullYear());
const DATE = process.env.SLATE_DATE || todayET();

const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const OUT = path.join(DATA_DIR, "batter_game_logs.csv");

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

function ipNumber(value = "") {
  return num(String(value || "0").replace(".1", ".333").replace(".2", ".667"));
}

function totalBases(s) {
  const singles =
    num(s.hits) -
    num(s.doubles) -
    num(s.triples) -
    num(s.homeRuns);

  return Math.max(0, singles) +
    num(s.doubles) * 2 +
    num(s.triples) * 3 +
    num(s.homeRuns) * 4;
}

function opponentFromSplit(split, currentTeam) {
  const opponentName = split.opponent?.name || "";
  if (opponentName) return opponentName;

  return "";
}

async function getGameLogs(target) {
  const url = `https://statsapi.mlb.com/api/v1/people/${target.mlbam}/stats?stats=gameLog&group=hitting&season=${SEASON}`;
  const json = await fetchJSON(url);
  const splits = json.stats?.[0]?.splits || [];

  const rows = [];

  for (const split of splits) {
    const s = split.stat || {};
    const gameDate = split.date || "";

    if (!gameDate) continue;

    rows.push({
      name: target.name,
      player_key: normalizeName(target.name),
      mlbam: target.mlbam,
      team: target.team,
      team_key: teamKey(target.team),
      source_game: target.game,
      date: gameDate,
      opponent: opponentFromSplit(split, target.team),
      pa: num(s.plateAppearances),
      ab: num(s.atBats),
      hits: num(s.hits),
      singles: Math.max(0, num(s.hits) - num(s.doubles) - num(s.triples) - num(s.homeRuns)),
      doubles: num(s.doubles),
      triples: num(s.triples),
      hr: num(s.homeRuns),
      tb: totalBases(s),
      rbi: num(s.rbi),
      runs: num(s.runs),
      bb: num(s.baseOnBalls),
      so: num(s.strikeOuts),
      avg: s.avg || "",
      obp: s.obp || "",
      slg: s.slg || "",
      ops: s.ops || "",
      innings: ipNumber(s.inningsPlayed),
      match_key: `${target.mlbam}|${teamKey(target.team)}`
    });
  }

  return rows;
}

const players = readCSV(PLAYER_FILE);

const targetsByMlbam = new Map();

for (const row of players) {
  const mlbam = String(getField(row, ["mlbam", "player_id", "id"])).trim();
  const name = getField(row, ["name", "player"]);
  const team = getField(row, ["team"]);
  const game = getField(row, ["game"]);

  if (!mlbam || !name || !team) continue;

  if (!targetsByMlbam.has(mlbam)) {
    targetsByMlbam.set(mlbam, {
      mlbam,
      name,
      team,
      game
    });
  }
}

const targets = Array.from(targetsByMlbam.values());

const allRows = [];
let failed = 0;

for (const target of targets) {
  try {
    const logs = await getGameLogs(target);
    allRows.push(...logs);
  } catch (err) {
    failed++;
    console.log(`Game logs failed for ${target.name} ${target.mlbam}: ${err.message || err}`);
  }
}

const sorted = allRows.sort((a, b) => {
  if (a.name !== b.name) return a.name.localeCompare(b.name);
  return String(b.date).localeCompare(String(a.date));
});

writeCSV(OUT, sorted);

console.log("Done.");
console.log(`Season: ${SEASON}`);
console.log(`Date: ${DATE}`);
console.log(`Target players from player_stats: ${targets.length}`);
console.log(`Game log rows: ${sorted.length}`);
console.log(`Failed pulls: ${failed}`);
console.log(`Saved: ${OUT}`);

console.table(sorted.slice(0, 25).map(r => ({
  name: r.name,
  mlbam: r.mlbam,
  team: r.team,
  date: r.date,
  opponent: r.opponent,
  pa: r.pa,
  hits: r.hits,
  hr: r.hr,
  tb: r.tb,
  so: r.so
})));