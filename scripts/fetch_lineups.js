import path from "path";
import {
  DATA_DIR,
  ensureDir,
  writeCSV,
  fetchJSON,
  todayET,
  normalizeTeam
} from "./normalize_utils.js";

ensureDir(DATA_DIR);

const DATE = process.env.SLATE_DATE || todayET();
const OUT = path.join(DATA_DIR, "lineups.csv");

const TEAM_ABBR = {
  "Arizona Diamondbacks": "ARI",
  "Atlanta Braves": "ATL",
  "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS",
  "Chicago Cubs": "CHC",
  "Chicago White Sox": "CWS",
  "Cincinnati Reds": "CIN",
  "Cleveland Guardians": "CLE",
  "Colorado Rockies": "COL",
  "Detroit Tigers": "DET",
  "Houston Astros": "HOU",
  "Kansas City Royals": "KC",
  "Los Angeles Angels": "LAA",
  "Los Angeles Dodgers": "LAD",
  "Miami Marlins": "MIA",
  "Milwaukee Brewers": "MIL",
  "Minnesota Twins": "MIN",
  "New York Mets": "NYM",
  "New York Yankees": "NYY",
  "Athletics": "ATH",
  "Philadelphia Phillies": "PHI",
  "Pittsburgh Pirates": "PIT",
  "San Diego Padres": "SD",
  "San Francisco Giants": "SF",
  "Seattle Mariners": "SEA",
  "St. Louis Cardinals": "STL",
  "Tampa Bay Rays": "TB",
  "Texas Rangers": "TEX",
  "Toronto Blue Jays": "TOR",
  "Washington Nationals": "WSH"
};

function battingOrderValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";

  if (n >= 100) {
    const spot = Math.floor(n / 100);
    if (spot >= 1 && spot <= 9) return String(spot);
  }

  if (n >= 1 && n <= 9) return String(n);

  return "";
}

async function getSchedule() {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${DATE}&hydrate=team`;
  const json = await fetchJSON(url);
  const games = [];

  for (const d of json.dates || []) {
    for (const g of d.games || []) {
      const away = g.teams?.away?.team?.name || "";
      const home = g.teams?.home?.team?.name || "";

      if (!away || !home) continue;

      games.push({
        gamePk: g.gamePk,
        away,
        home,
        awayAbbr: TEAM_ABBR[away] || "",
        homeAbbr: TEAM_ABBR[home] || "",
        game: `${away} @ ${home}`,
        matchup: `${TEAM_ABBR[away] || away} @ ${TEAM_ABBR[home] || home}`
      });
    }
  }

  return games;
}

function extractTeamPlayers(boxscore, side, game) {
  const teamBlock = boxscore.teams?.[side];
  const teamName = side === "away" ? game.away : game.home;
  const opponent = side === "away" ? game.home : game.away;
  const abbr = side === "away" ? game.awayAbbr : game.homeAbbr;

  const rows = [];
  const players = teamBlock?.players || {};

  for (const value of Object.values(players)) {
    const person = value.person || {};
    const name = person.fullName || "";
    const mlbam = person.id || "";
    const order = battingOrderValue(value.battingOrder);

    if (!name || !mlbam) continue;

    rows.push({
      name,
      player: name,
      player_name: name,
      mlbam,
      player_id: mlbam,
      team: teamName,
      abbr,
      team_key: normalizeTeam(teamName),
      opponent,
      game: game.game,
      matchup: game.matchup,
      lineup: order,
      batting_order: order,
      battingOrder: order,
      raw_batting_order: value.battingOrder || "",
      lineup_status: order ? "confirmed" : "team_roster_no_order",
      status: order ? "confirmed" : "team_roster_no_order",
      source: "mlb_boxscore"
    });
  }

  return rows;
}

const games = await getSchedule();
const rows = [];

let checked = 0;
let rowsWithOrder = 0;
let rowsWithoutOrder = 0;

for (const game of games) {
  checked++;

  try {
    const boxscore = await fetchJSON(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`);

    const awayRows = extractTeamPlayers(boxscore, "away", game);
    const homeRows = extractTeamPlayers(boxscore, "home", game);

    for (const row of [...awayRows, ...homeRows]) {
      if (row.lineup) rowsWithOrder++;
      else rowsWithoutOrder++;

      rows.push(row);
    }
  } catch {}
}

writeCSV(OUT, rows);

console.log("Done.");
console.log(`Date: ${DATE}`);
console.log(`Games checked: ${checked}`);
console.log(`Lineup rows saved: ${rows.length}`);
console.log(`Rows with batting order: ${rowsWithOrder}`);
console.log(`Rows without batting order: ${rowsWithoutOrder}`);
console.log(`Saved: ${OUT}`);

console.table(rows.slice(0, 30).map(r => ({
  name: r.name,
  team: r.team,
  game: r.game,
  lineup: r.lineup,
  status: r.lineup_status
})));