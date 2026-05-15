import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_CSV = path.join(DATA_DIR, "full_slate_player_pool.csv");
const OUT_JSON = path.join(DATA_DIR, "full_slate_player_pool.json");

const today = new Date().toISOString().slice(0, 10);

const SCHEDULE_URL =
  `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=probablePitcher,team`;

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed ${res.status}: ${url}`);
  return await res.json();
}

function clean(value) {
  return String(value || "").trim();
}

function abbreviation(teamName = "") {
  const map = {
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

  return map[teamName] || teamName.split(" ").pop().slice(0, 3).toUpperCase();
}

function getBattingOrder(boxscoreTeam) {
  const players = boxscoreTeam?.players || {};
  const battingOrder = boxscoreTeam?.battingOrder || [];

  return battingOrder
    .map((id, index) => {
      const key = `ID${id}`;
      const player = players[key];
      if (!player?.person?.fullName) return null;

      return {
        name: player.person.fullName,
        mlbam: player.person.id,
        lineup_spot: index + 1,
        position: player.position?.abbreviation || "",
        status: "confirmed"
      };
    })
    .filter(Boolean);
}

function getRosterHitters(boxscoreTeam) {
  const players = boxscoreTeam?.players || {};

  return Object.values(players)
    .filter(p => p?.person?.fullName)
    .filter(p => {
      const type = p.position?.type || "";
      const code = p.position?.code || "";
      return type !== "Pitcher" && code !== "1";
    })
    .map(p => ({
      name: p.person.fullName,
      mlbam: p.person.id,
      lineup_spot: "",
      position: p.position?.abbreviation || "",
      status: "roster"
    }));
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const schedule = await fetchJson(SCHEDULE_URL);
  const games = schedule?.dates?.[0]?.games || [];

  const rows = [];

  for (const game of games) {
    const gamePk = game.gamePk;
    const awayTeam = clean(game.teams?.away?.team?.name);
    const homeTeam = clean(game.teams?.home?.team?.name);
    const awayAbbr = abbreviation(awayTeam);
    const homeAbbr = abbreviation(homeTeam);
    const gameLabel = `${awayTeam} @ ${homeTeam}`;
    const venue = clean(game.venue?.name);
    const commenceTime = clean(game.gameDate);

    const awayPitcher =
      clean(game.teams?.home?.probablePitcher?.fullName);

    const homePitcher =
      clean(game.teams?.away?.probablePitcher?.fullName);

    const boxscoreUrl =
      `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;

    let boxscore = null;

    try {
      boxscore = await fetchJson(boxscoreUrl);
    } catch {
      boxscore = null;
    }

    const awayBox = boxscore?.teams?.away;
    const homeBox = boxscore?.teams?.home;

    let awayHitters = getBattingOrder(awayBox);
    let homeHitters = getBattingOrder(homeBox);

    if (!awayHitters.length) awayHitters = getRosterHitters(awayBox);
    if (!homeHitters.length) homeHitters = getRosterHitters(homeBox);

    for (const hitter of awayHitters) {
      rows.push({
        date: today,
        game_pk: gamePk,
        game: gameLabel,
        commence_time: commenceTime,
        team: awayTeam,
        team_abbr: awayAbbr,
        opponent: homeTeam,
        opponent_abbr: homeAbbr,
        venue,
        home_away: "away",
        name: hitter.name,
        player: hitter.name,
        mlbam: hitter.mlbam,
        lineup_spot: hitter.lineup_spot,
        position: hitter.position,
        lineup_status: hitter.status,
        pitcher: awayPitcher,
        opposing_pitcher: awayPitcher
      });
    }

    for (const hitter of homeHitters) {
      rows.push({
        date: today,
        game_pk: gamePk,
        game: gameLabel,
        commence_time: commenceTime,
        team: homeTeam,
        team_abbr: homeAbbr,
        opponent: awayTeam,
        opponent_abbr: awayAbbr,
        venue,
        home_away: "home",
        name: hitter.name,
        player: hitter.name,
        mlbam: hitter.mlbam,
        lineup_spot: hitter.lineup_spot,
        position: hitter.position,
        lineup_status: hitter.status,
        pitcher: homePitcher,
        opposing_pitcher: homePitcher
      });
    }
  }

  const unique = [];
  const seen = new Set();

  for (const row of rows) {
    const key = `${row.game_pk}|${row.team}|${row.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  const headers = [
    "date",
    "game_pk",
    "game",
    "commence_time",
    "team",
    "team_abbr",
    "opponent",
    "opponent_abbr",
    "venue",
    "home_away",
    "name",
    "player",
    "mlbam",
    "lineup_spot",
    "position",
    "lineup_status",
    "pitcher",
    "opposing_pitcher"
  ];

  fs.writeFileSync(
    OUT_CSV,
    [
      headers.join(","),
      ...unique.map(row => headers.map(h => csvEscape(row[h])).join(","))
    ].join("\n")
  );

  fs.writeFileSync(OUT_JSON, JSON.stringify(unique, null, 2));

  console.log("");
  console.log("THE SLIP LAB FULL SLATE PLAYER POOL COMPLETE");
  console.log("Date:", today);
  console.log("Games:", games.length);
  console.log("Players:", unique.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);

  console.table(
    unique.slice(0, 25).map(r => ({
      player: r.name,
      team: r.team_abbr,
      spot: r.lineup_spot,
      status: r.lineup_status,
      pitcher: r.pitcher
    }))
  );
}

main();
