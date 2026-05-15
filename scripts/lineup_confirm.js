import path from "path";
import {
  DATA_DIR,
  readCSV,
  writeCSV,
  normalizeName,
  normalizeTeam,
  num
} from "./normalize_utils.js";

const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const LINEUP_FILE = path.join(DATA_DIR, "lineups.csv");

const TEAM_ALIASES = {
  ari: "arizona diamondbacks",
  atl: "atlanta braves",
  bal: "baltimore orioles",
  bos: "boston red sox",
  chc: "chicago cubs",
  cws: "chicago white sox",
  cin: "cincinnati reds",
  cle: "cleveland guardians",
  col: "colorado rockies",
  det: "detroit tigers",
  hou: "houston astros",
  kc: "kansas city royals",
  laa: "los angeles angels",
  lad: "los angeles dodgers",
  mia: "miami marlins",
  mil: "milwaukee brewers",
  min: "minnesota twins",
  nym: "new york mets",
  nyy: "new york yankees",
  phi: "philadelphia phillies",
  pit: "pittsburgh pirates",
  sd: "san diego padres",
  sea: "seattle mariners",
  sf: "san francisco giants",
  stl: "st louis cardinals",
  tb: "tampa bay rays",
  tex: "texas rangers",
  tor: "toronto blue jays",
  wsh: "washington nationals",
  was: "washington nationals",
  oak: "athletics",
  ath: "athletics"
};

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

function teamKey(value = "") {
  const raw = String(value || "")
    .replace(/_MLB$/i, "")
    .replace(/_/g, " ")
    .replace(/\./g, "")
    .trim()
    .toLowerCase();

  return normalizeTeam(TEAM_ALIASES[raw] || raw);
}

function gameKey(value = "") {
  const parts = String(value || "")
    .split("@")
    .map(x => teamKey(x.trim()))
    .filter(Boolean);

  if (parts.length !== 2) return "";

  return `${parts[0]} @ ${parts[1]}`;
}

function orderValue(row) {
  const raw = getField(row, [
    "lineup",
    "batting_order",
    "battingOrder",
    "batting order",
    "order",
    "spot",
    "slot",
    "batting_position",
    "position_in_order"
  ]);

  const n = num(raw);

  if (n >= 1 && n <= 9) return String(n);

  return "";
}

function statusValue(row) {
  const raw = String(getField(row, [
    "lineup_status",
    "status",
    "confirmed",
    "is_confirmed",
    "lineup_confirmed"
  ]) || "").toLowerCase();

  if (!raw) return "confirmed";
  if (raw.includes("true")) return "confirmed";
  if (raw.includes("confirm")) return "confirmed";
  if (raw.includes("start")) return "confirmed";
  if (raw.includes("match")) return "confirmed";
  if (raw.includes("project")) return "projected";

  return raw;
}

function lineupBoost(order, matchType) {
  const n = num(order);

  if (!n) return 0;
  if (matchType === "name_only_review") return 0;

  if (n <= 2) return 7;
  if (n <= 5) return 10;
  if (n <= 7) return 3;

  return -2;
}

const players = readCSV(PLAYER_FILE);
const lineups = readCSV(LINEUP_FILE);

const byStrict = new Map();
const byNameTeam = new Map();
const byMlbam = new Map();
const byNameOnly = new Map();

for (const row of lineups) {
  const playerName = getField(row, [
    "name",
    "player",
    "player_name",
    "batter",
    "fullName",
    "full_name"
  ]);

  const teamRaw = getField(row, [
    "team",
    "player_team",
    "team_name",
    "club",
    "club_name",
    "abbr"
  ]);

  const gameRaw = getField(row, [
    "game",
    "matchup",
    "event",
    "game_name"
  ]);

  const mlbam = String(getField(row, [
    "mlbam",
    "player_id",
    "playerId",
    "id",
    "mlb_id"
  ]) || "").trim();

  if (!playerName && !mlbam) continue;

  const payload = {
    lineup: orderValue(row),
    lineup_status: statusValue(row),
    lineup_source_name: playerName,
    lineup_source_team: teamRaw,
    lineup_source_game: gameRaw
  };

  const normalizedName = normalizeName(playerName);
  const normalizedTeam = teamKey(teamRaw);
  const normalizedGame = gameKey(gameRaw);

  if (mlbam) byMlbam.set(mlbam, payload);

  if (normalizedName && normalizedTeam && normalizedGame) {
    byStrict.set(`${normalizedName}|${normalizedTeam}|${normalizedGame}`, payload);
  }

  if (normalizedName && normalizedTeam) {
    byNameTeam.set(`${normalizedName}|${normalizedTeam}`, payload);
  }

  if (normalizedName && !byNameOnly.has(normalizedName)) {
    byNameOnly.set(normalizedName, payload);
  }
}

let mlbamMatches = 0;
let strictMatches = 0;
let nameTeamMatches = 0;
let nameOnlyMatches = 0;
let noMatch = 0;

const updated = players.map(row => {
  const playerName = row.name || row.player || "";
  const normalizedName = normalizeName(playerName);
  const normalizedTeam = teamKey(row.team || "");
  const normalizedGame = gameKey(row.game || "");
  const mlbam = String(row.mlbam || "").trim();

  let hit = null;
  let matchType = "none";

  if (mlbam && byMlbam.has(mlbam)) {
    hit = byMlbam.get(mlbam);
    matchType = "mlbam";
    mlbamMatches++;
  } else if (byStrict.has(`${normalizedName}|${normalizedTeam}|${normalizedGame}`)) {
    hit = byStrict.get(`${normalizedName}|${normalizedTeam}|${normalizedGame}`);
    matchType = "strict_name_team_game";
    strictMatches++;
  } else if (byNameTeam.has(`${normalizedName}|${normalizedTeam}`)) {
    hit = byNameTeam.get(`${normalizedName}|${normalizedTeam}`);
    matchType = "name_team";
    nameTeamMatches++;
  } else if (byNameOnly.has(normalizedName)) {
    hit = byNameOnly.get(normalizedName);
    matchType = "name_only_review";
    nameOnlyMatches++;
  }

  if (!hit) {
    noMatch++;

    return {
      ...row,
      lineup: "",
      lineup_status: "unconfirmed",
      lineup_match_type: "none",
      lineup_boost: "0",
      lineup_source_name: "",
      lineup_source_team: "",
      lineup_source_game: ""
    };
  }

  const order = hit.lineup || "";
  const boost = lineupBoost(order, matchType);
  const safeStatus = matchType === "name_only_review" ? "review_only" : hit.lineup_status || "confirmed";

  return {
    ...row,
    lineup: order,
    lineup_status: safeStatus,
    lineup_match_type: matchType,
    lineup_boost: String(boost),
    lineup_source_name: hit.lineup_source_name || "",
    lineup_source_team: hit.lineup_source_team || "",
    lineup_source_game: hit.lineup_source_game || ""
  };
});

writeCSV(PLAYER_FILE, updated);

console.log("Lineup confirmation complete.");
console.log(`Rows: ${players.length}`);
console.log(`Lineup rows read: ${lineups.length}`);
console.log(`MLBAM matches: ${mlbamMatches}`);
console.log(`Strict name team game matches: ${strictMatches}`);
console.log(`Name team matches: ${nameTeamMatches}`);
console.log(`Name only review matches: ${nameOnlyMatches}`);
console.log(`No match: ${noMatch}`);
console.log(`Saved: ${PLAYER_FILE}`);

console.table(updated.slice(0, 30).map(r => ({
  name: r.name,
  team: r.team,
  lineup: r.lineup,
  status: r.lineup_status,
  match: r.lineup_match_type,
  boost: r.lineup_boost
})));