import path from "path";
import {
  DATA_DIR,
  ensureDir,
  readCSV,
  writeCSV,
  fetchJSON,
  normalizeTeam,
  num,
  todayET
} from "./normalize_utils.js";

ensureDir(DATA_DIR);

const SEASON = Number(process.env.SEASON || new Date().getFullYear());
const DATE = process.env.SLATE_DATE || todayET();

const ODDS_FILE = path.join(DATA_DIR, "hr_odds_clean.csv");
const OUT = path.join(DATA_DIR, "pitcher_stats.csv");

function teamKey(value = "") {
  return normalizeTeam(
    String(value)
      .replace(/_MLB$/i, "")
      .replace(/_/g, " ")
      .replace(/\./g, "")
      .replace(/\bSTLOUIS\b/i, "ST LOUIS")
      .replace(/\bST\. LOUIS\b/i, "ST LOUIS")
  );
}

function gameKey(value = "") {
  const parts = String(value || "")
    .split("@")
    .map(x => teamKey(x.trim()))
    .filter(Boolean);

  if (parts.length !== 2) return "";

  return `${parts[0]} @ ${parts[1]}`;
}

function displayGameFromKey(key = "") {
  const parts = String(key).split(" @ ");
  if (parts.length !== 2) return key;

  return `${titleTeam(parts[0])} @ ${titleTeam(parts[1])}`;
}

function titleTeam(value = "") {
  const map = {
    athletics: "Athletics",
    "arizona diamondbacks": "Arizona Diamondbacks",
    "atlanta braves": "Atlanta Braves",
    "baltimore orioles": "Baltimore Orioles",
    "boston red sox": "Boston Red Sox",
    "chicago cubs": "Chicago Cubs",
    "chicago white sox": "Chicago White Sox",
    "cincinnati reds": "Cincinnati Reds",
    "cleveland guardians": "Cleveland Guardians",
    "colorado rockies": "Colorado Rockies",
    "detroit tigers": "Detroit Tigers",
    "houston astros": "Houston Astros",
    "kansas city royals": "Kansas City Royals",
    "los angeles angels": "Los Angeles Angels",
    "los angeles dodgers": "Los Angeles Dodgers",
    "miami marlins": "Miami Marlins",
    "milwaukee brewers": "Milwaukee Brewers",
    "minnesota twins": "Minnesota Twins",
    "new york mets": "New York Mets",
    "new york yankees": "New York Yankees",
    "philadelphia phillies": "Philadelphia Phillies",
    "pittsburgh pirates": "Pittsburgh Pirates",
    "san diego padres": "San Diego Padres",
    "san francisco giants": "San Francisco Giants",
    "seattle mariners": "Seattle Mariners",
    "st louis cardinals": "St. Louis Cardinals",
    "tampa bay rays": "Tampa Bay Rays",
    "texas rangers": "Texas Rangers",
    "toronto blue jays": "Toronto Blue Jays",
    "washington nationals": "Washington Nationals"
  };

  return map[teamKey(value)] || value;
}

function opponentFor(game, team) {
  const parts = String(game || "").split("@").map(x => x.trim());
  if (parts.length !== 2) return "";

  const away = parts[0];
  const home = parts[1];

  if (teamKey(away) === teamKey(team)) return home;
  if (teamKey(home) === teamKey(team)) return away;

  return "";
}

async function getFullSchedule() {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${DATE}&hydrate=team,probablePitcher`;
  const json = await fetchJSON(url);
  const games = [];

  for (const d of json.dates || []) {
    for (const g of d.games || []) {
      const away = g.teams?.away?.team?.name || "";
      const home = g.teams?.home?.team?.name || "";
      const awayPitcher = g.teams?.away?.probablePitcher || {};
      const homePitcher = g.teams?.home?.probablePitcher || {};

      if (!away || !home) continue;

      games.push({
        gamePk: g.gamePk,
        away,
        home,
        game: `${away} @ ${home}`,
        key: `${teamKey(away)} @ ${teamKey(home)}`,
        awayPitcherId: awayPitcher.id || "",
        awayPitcher: awayPitcher.fullName || "",
        homePitcherId: homePitcher.id || "",
        homePitcher: homePitcher.fullName || ""
      });
    }
  }

  return games;
}

function getSlateGameKeys() {
  const rows = readCSV(ODDS_FILE);
  const keys = new Set();

  for (const row of rows) {
    const key = gameKey(row.game || "");
    if (key) keys.add(key);
  }

  return keys;
}

async function getPitcherSeasonStats(playerId) {
  if (!playerId) return {};

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=pitching&season=${SEASON}`;
    const json = await fetchJSON(url);
    const s = json.stats?.[0]?.splits?.[0]?.stat || {};

    const ip = num(String(s.inningsPitched || "0").replace(".1", ".333").replace(".2", ".667"));
    const er = num(s.earnedRuns);
    const hits = num(s.hits);
    const walks = num(s.baseOnBalls);
    const strikeouts = num(s.strikeOuts);
    const homers = num(s.homeRuns);
    const gamesStarted = num(s.gamesStarted);

    const era = ip ? er * 9 / ip : num(s.era);
    const whip = ip ? (hits + walks) / ip : num(s.whip);
    const k9 = ip ? strikeouts * 9 / ip : num(s.strikeoutsPer9Inn);
    const bb9 = ip ? walks * 9 / ip : num(s.walksPer9Inn);
    const hr9 = ip ? homers * 9 / ip : num(s.homeRunsPer9);

    const xfipProxy = estimateXfip({
      k9,
      bb9,
      hr9,
      era,
      whip
    });

    return {
      ip: ip.toFixed(1),
      gs: gamesStarted,
      era: era.toFixed(2),
      whip: whip.toFixed(2),
      xfip: xfipProxy.toFixed(2),
      k9: k9.toFixed(2),
      bb9: bb9.toFixed(2),
      hr9: hr9.toFixed(2),
      strikeouts,
      walks,
      homers
    };
  } catch {
    return {};
  }
}

async function getLast3Era(playerId) {
  if (!playerId) return "";

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=pitching&season=${SEASON}`;
    const json = await fetchJSON(url);
    const splits = json.stats?.[0]?.splits || [];

    const startsOrApps = splits
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);

    let ip = 0;
    let er = 0;

    for (const split of startsOrApps) {
      const s = split.stat || {};
      ip += num(String(s.inningsPitched || "0").replace(".1", ".333").replace(".2", ".667"));
      er += num(s.earnedRuns);
    }

    if (!ip) return "";

    return (er * 9 / ip).toFixed(2);
  } catch {
    return "";
  }
}

function estimateXfip({ k9, bb9, hr9, era, whip }) {
  const kComponent = (9 - num(k9)) * 0.28;
  const bbComponent = (num(bb9) - 3) * 0.34;
  const hrComponent = (num(hr9) - 1.1) * 0.45;
  const whipComponent = (num(whip) - 1.25) * 1.25;

  const estimate = 4.15 + kComponent + bbComponent + hrComponent + whipComponent;

  if (Number.isFinite(estimate)) return Math.max(2.25, Math.min(6.75, estimate));

  return num(era) || 4.50;
}

async function getTeamStrikeoutRate(teamName) {
  try {
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${DATE}&hydrate=team`;
    const schedule = await fetchJSON(scheduleUrl);

    let teamId = "";

    for (const d of schedule.dates || []) {
      for (const g of d.games || []) {
        const away = g.teams?.away?.team;
        const home = g.teams?.home?.team;

        if (teamKey(away?.name) === teamKey(teamName)) teamId = away.id;
        if (teamKey(home?.name) === teamKey(teamName)) teamId = home.id;
      }
    }

    if (!teamId) return "";

    const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=${SEASON}`;
    const json = await fetchJSON(url);
    const s = json.stats?.[0]?.splits?.[0]?.stat || {};
    const pa = num(s.plateAppearances);
    const so = num(s.strikeOuts);

    if (!pa) return "";

    return (so / pa * 100 / 2.65).toFixed(2);
  } catch {
    return "";
  }
}

const schedule = await getFullSchedule();
const slateKeys = getSlateGameKeys();

const selectedGames = schedule.filter(g => slateKeys.has(g.key));

const rows = [];
let pitchersFetched = 0;
let pitchersMissing = 0;

const teamSOCache = new Map();

for (const game of selectedGames) {
  const pitcherEntries = [
    {
      pitcherId: game.awayPitcherId,
      pitcher: game.awayPitcher,
      team: game.away,
      opponent: game.home
    },
    {
      pitcherId: game.homePitcherId,
      pitcher: game.homePitcher,
      team: game.home,
      opponent: game.away
    }
  ];

  for (const p of pitcherEntries) {
    if (!p.pitcherId || !p.pitcher) {
      pitchersMissing++;

      rows.push({
        game: game.game,
        pitcher: "",
        pitcher_id: "",
        team: p.team,
        opponent: p.opponent,
        gs: "",
        ip: "",
        era: "",
        whip: "",
        xfip: "",
        teamSO: "",
        last3: "",
        k9: "",
        bb9: "",
        hr9: "",
        status: "missing_probable"
      });

      continue;
    }

    const stats = await getPitcherSeasonStats(p.pitcherId);
    const last3 = await getLast3Era(p.pitcherId);

    if (!teamSOCache.has(p.opponent)) {
      teamSOCache.set(p.opponent, await getTeamStrikeoutRate(p.opponent));
    }

    pitchersFetched++;

    rows.push({
      game: game.game,
      pitcher: p.pitcher,
      pitcher_id: p.pitcherId,
      team: p.team,
      opponent: p.opponent,
      gs: stats.gs ?? "",
      ip: stats.ip ?? "",
      era: stats.era ?? "",
      whip: stats.whip ?? "",
      xfip: stats.xfip ?? "",
      teamSO: teamSOCache.get(p.opponent) || "",
      last3: last3 || stats.era || "",
      k9: stats.k9 ?? "",
      bb9: stats.bb9 ?? "",
      hr9: stats.hr9 ?? "",
      status: "probable"
    });
  }
}

writeCSV(OUT, rows);

console.log("Done.");
console.log(`Season: ${SEASON}`);
console.log(`Date: ${DATE}`);
console.log(`Odds source: ${ODDS_FILE}`);
console.log(`Slate games from clean HR odds: ${slateKeys.size}`);
console.log(`Matched schedule games: ${selectedGames.length}`);
console.log(`Missing schedule games: ${Math.max(0, slateKeys.size - selectedGames.length)}`);
console.log(`Pitcher rows: ${rows.length}`);
console.log(`Pitcher stats fetched: ${pitchersFetched}`);
console.log(`Pitcher stats missing: ${pitchersMissing}`);
console.log(`Saved: ${OUT}`);

console.table(rows.map(r => ({
  game: r.game,
  pitcher: r.pitcher,
  team: r.team,
  opponent: r.opponent,
  gs: r.gs,
  era: r.era,
  whip: r.whip,
  xfip: r.xfip,
  teamSO: r.teamSO,
  last3: r.last3,
  k9: r.k9,
  bb9: r.bb9,
  hr9: r.hr9,
  status: r.status
})));