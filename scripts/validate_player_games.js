import path from "path";
import {
  DATA_DIR,
  readCSV,
  writeCSV,
  normalizeName,
  normalizeTeam,
  fetchJSON,
  todayET,
  teamInGame
} from "./normalize_utils.js";

const SEASON = Number(process.env.SEASON || new Date().getFullYear());
const DATE = process.env.SLATE_DATE || todayET();

const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const INVALID_FILE = path.join(DATA_DIR, "player_stats_invalid_game_rows.csv");

const TEAM_ALIASES = new Map([
  ["athletics", "Athletics"],
  ["oakland athletics", "Athletics"],
  ["sacramento athletics", "Athletics"],
  ["st louis cardinals", "St. Louis Cardinals"],
  ["st. louis cardinals", "St. Louis Cardinals"]
]);

function teamKey(value = "") {
  return normalizeTeam(
    String(value)
      .replace(/_MLB$/i, "")
      .replace(/_/g, " ")
      .replace(/\bSTLOUIS\b/i, "ST LOUIS")
  );
}

function canonicalTeam(value = "") {
  const key = teamKey(value);
  return TEAM_ALIASES.get(key) || String(value || "").replace(/_MLB$/i, "").replace(/_/g, " ").trim();
}

async function getSchedule() {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${DATE}&hydrate=team`;
  const json = await fetchJSON(url);
  const games = [];

  for (const d of json.dates || []) {
    for (const g of d.games || []) {
      const away = g.teams?.away?.team?.name || "";
      const home = g.teams?.home?.team?.name || "";
      const awayId = g.teams?.away?.team?.id;
      const homeId = g.teams?.home?.team?.id;

      if (!away || !home) continue;

      games.push({
        away,
        home,
        awayId,
        homeId,
        game: `${away} @ ${home}`,
        key: `${teamKey(away)} @ ${teamKey(home)}`
      });
    }
  }

  return games;
}

async function getRosterSet(schedule) {
  const set = new Set();

  for (const game of schedule) {
    for (const team of [
      { id: game.awayId, name: game.away },
      { id: game.homeId, name: game.home }
    ]) {
      if (!team.id) continue;

      try {
        const url = `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=active&season=${SEASON}`;
        const json = await fetchJSON(url);

        for (const item of json.roster || []) {
          const name = item.person?.fullName || "";
          if (!name) continue;
          set.add(`${normalizeName(name)}|${teamKey(team.name)}`);
        }
      } catch {}
    }
  }

  return set;
}

function gameKey(game = "") {
  return String(game || "")
    .split("@")
    .map(x => teamKey(x.trim()))
    .join(" @ ");
}

const rows = readCSV(PLAYER_FILE);
const schedule = await getSchedule();
const rosterSet = await getRosterSet(schedule);

const scheduleGames = new Set(schedule.map(g => g.key));

const kept = [];
const removed = [];

for (const row of rows) {
  const player = row.name || row.player || "";
  const team = canonicalTeam(row.team || "");
  const game = row.game || "";

  let reason = "";

  if (!player) reason = "MISSING_PLAYER";
  else if (!team) reason = "MISSING_TEAM";
  else if (!game || !String(game).includes("@")) reason = "MISSING_GAME";
  else if (!scheduleGames.has(gameKey(game))) reason = "GAME_NOT_ON_TODAY_MLB_SCHEDULE";
  else if (!teamInGame(team, game)) reason = "TEAM_NOT_IN_GAME";
  else if (!rosterSet.has(`${normalizeName(player)}|${teamKey(team)}`)) reason = "PLAYER_NOT_ON_TEAM_ACTIVE_ROSTER";

  if (reason) {
    removed.push({
      ...row,
      invalid_reason: reason
    });
  } else {
    kept.push({
      ...row,
      team
    });
  }
}

writeCSV(PLAYER_FILE, kept);
writeCSV(INVALID_FILE, removed);

console.log("Player game validation complete.");
console.log(`Season: ${SEASON}`);
console.log(`Date: ${DATE}`);
console.log(`Original rows: ${rows.length}`);
console.log(`Kept rows: ${kept.length}`);
console.log(`Removed rows: ${removed.length}`);
console.log(`Updated: ${PLAYER_FILE}`);
console.log(`Invalid rows: ${INVALID_FILE}`);

if (removed.length) {
  console.table(removed.slice(0, 30).map(r => ({
    name: r.name || r.player,
    team: r.team,
    game: r.game,
    reason: r.invalid_reason
  })));
}