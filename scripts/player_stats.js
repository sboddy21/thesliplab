import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const SEASON = Number(process.env.MLB_SEASON || new Date().getFullYear());
const TODAY = process.env.SLATE_DATE || new Date().toISOString().slice(0, 10);

const ODDS_CANDIDATES = [
  path.join(DATA_DIR, "hr_odds_clean.csv"),
  path.join(DATA_DIR, "best_lines.csv"),
  path.join(DATA_DIR, "hr_odds_flat.csv"),
  path.join(ROOT, "hr_odds_clean.csv"),
  path.join(ROOT, "best_lines.csv")
];

const STATCAST_FILE = path.join(DATA_DIR, "statcast_batter_stats.csv");
const OUT_FILE = path.join(DATA_DIR, "player_stats.csv");
const INVALID_FILE = path.join(DATA_DIR, "player_stats_invalid_source_rows.csv");
const BACKUP_FILE = path.join(DATA_DIR, "player_stats_before_rewrite_backup.csv");

const MLB_SCHEDULE_URL = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${TODAY}&hydrate=probablePitcher,team,linescore`;

const TEAM_ALIASES = {
  "arizona diamondbacks": "Arizona Diamondbacks",
  "diamondbacks": "Arizona Diamondbacks",
  "ari": "Arizona Diamondbacks",

  "athletics": "Athletics",
  "oakland athletics": "Athletics",
  "oakland": "Athletics",
  "ath": "Athletics",
  "oak": "Athletics",

  "atlanta braves": "Atlanta Braves",
  "braves": "Atlanta Braves",
  "atl": "Atlanta Braves",

  "baltimore orioles": "Baltimore Orioles",
  "orioles": "Baltimore Orioles",
  "bal": "Baltimore Orioles",

  "boston red sox": "Boston Red Sox",
  "red sox": "Boston Red Sox",
  "bos": "Boston Red Sox",

  "chicago cubs": "Chicago Cubs",
  "cubs": "Chicago Cubs",
  "chc": "Chicago Cubs",

  "chicago white sox": "Chicago White Sox",
  "white sox": "Chicago White Sox",
  "cws": "Chicago White Sox",

  "cincinnati reds": "Cincinnati Reds",
  "reds": "Cincinnati Reds",
  "cin": "Cincinnati Reds",

  "cleveland guardians": "Cleveland Guardians",
  "guardians": "Cleveland Guardians",
  "cle": "Cleveland Guardians",

  "colorado rockies": "Colorado Rockies",
  "rockies": "Colorado Rockies",
  "col": "Colorado Rockies",

  "detroit tigers": "Detroit Tigers",
  "tigers": "Detroit Tigers",
  "det": "Detroit Tigers",

  "houston astros": "Houston Astros",
  "astros": "Houston Astros",
  "hou": "Houston Astros",

  "kansas city royals": "Kansas City Royals",
  "royals": "Kansas City Royals",
  "kc": "Kansas City Royals",
  "kcr": "Kansas City Royals",

  "los angeles angels": "Los Angeles Angels",
  "la angels": "Los Angeles Angels",
  "angels": "Los Angeles Angels",
  "laa": "Los Angeles Angels",

  "los angeles dodgers": "Los Angeles Dodgers",
  "la dodgers": "Los Angeles Dodgers",
  "dodgers": "Los Angeles Dodgers",
  "lad": "Los Angeles Dodgers",

  "miami marlins": "Miami Marlins",
  "marlins": "Miami Marlins",
  "mia": "Miami Marlins",

  "milwaukee brewers": "Milwaukee Brewers",
  "brewers": "Milwaukee Brewers",
  "mil": "Milwaukee Brewers",

  "minnesota twins": "Minnesota Twins",
  "twins": "Minnesota Twins",
  "min": "Minnesota Twins",

  "new york mets": "New York Mets",
  "ny mets": "New York Mets",
  "mets": "New York Mets",
  "nym": "New York Mets",

  "new york yankees": "New York Yankees",
  "ny yankees": "New York Yankees",
  "yankees": "New York Yankees",
  "nyy": "New York Yankees",

  "philadelphia phillies": "Philadelphia Phillies",
  "phillies": "Philadelphia Phillies",
  "phi": "Philadelphia Phillies",

  "pittsburgh pirates": "Pittsburgh Pirates",
  "pirates": "Pittsburgh Pirates",
  "pit": "Pittsburgh Pirates",

  "san diego padres": "San Diego Padres",
  "padres": "San Diego Padres",
  "sd": "San Diego Padres",
  "sdp": "San Diego Padres",

  "san francisco giants": "San Francisco Giants",
  "giants": "San Francisco Giants",
  "sf": "San Francisco Giants",
  "sfg": "San Francisco Giants",

  "seattle mariners": "Seattle Mariners",
  "mariners": "Seattle Mariners",
  "sea": "Seattle Mariners",

  "st louis cardinals": "St. Louis Cardinals",
  "st. louis cardinals": "St. Louis Cardinals",
  "cardinals": "St. Louis Cardinals",
  "stl": "St. Louis Cardinals",

  "tampa bay rays": "Tampa Bay Rays",
  "rays": "Tampa Bay Rays",
  "tb": "Tampa Bay Rays",
  "tbr": "Tampa Bay Rays",

  "texas rangers": "Texas Rangers",
  "rangers": "Texas Rangers",
  "tex": "Texas Rangers",

  "toronto blue jays": "Toronto Blue Jays",
  "blue jays": "Toronto Blue Jays",
  "tor": "Toronto Blue Jays",

  "washington nationals": "Washington Nationals",
  "nationals": "Washington Nationals",
  "was": "Washington Nationals",
  "wsh": "Washington Nationals"
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value = "") {
  return normalizeText(value)
    .replace(/\bjunior\b/g, "jr")
    .replace(/\bsenior\b/g, "sr")
    .replace(/\bjr\b/g, "")
    .replace(/\bsr\b/g, "")
    .replace(/\biii\b/g, "")
    .replace(/\bii\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalTeam(value = "") {
  const key = normalizeText(value);
  return TEAM_ALIASES[key] || String(value || "").trim();
}

function teamKey(value = "") {
  return normalizeText(canonicalTeam(value));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some(v => String(v).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h => String(h).trim());

  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) headers.push(key);
    }
  }

  const escape = value => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(","))
  ].join("\n");
}

function readCsvSafe(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return "";
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace("+", "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseAmericanOdds(value) {
  const n = num(value, null);
  if (!Number.isFinite(n) || n === 0) return "";
  return n;
}

function impliedFromAmerican(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n === 0) return "";

  if (n > 0) return (100 / (n + 100)) * 100;
  return (Math.abs(n) / (Math.abs(n) + 100)) * 100;
}

function findOddsFile() {
  for (const file of ODDS_CANDIDATES) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 TheSlipLab/1.0"
    }
  });

  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);

  return res.json();
}

async function getScheduleContext() {
  const schedule = await getJson(MLB_SCHEDULE_URL);
  const games = schedule?.dates?.[0]?.games || [];

  const teamGameMap = new Map();
  const gameTextMap = new Map();

  for (const game of games) {
    const gamePk = game.gamePk;
    const status = game?.status?.detailedState || "";
    const venue = game?.venue?.name || "";
    const gameDate = game?.gameDate || "";
    const awayTeam = game?.teams?.away?.team?.name || "";
    const homeTeam = game?.teams?.home?.team?.name || "";
    const awayProbable = game?.teams?.away?.probablePitcher?.fullName || "";
    const homeProbable = game?.teams?.home?.probablePitcher?.fullName || "";
    const awayProbableId = game?.teams?.away?.probablePitcher?.id || "";
    const homeProbableId = game?.teams?.home?.probablePitcher?.id || "";

    const gameLabel = `${awayTeam} @ ${homeTeam}`;

    const awayContext = {
      date: TODAY,
      season: SEASON,
      game_pk: gamePk,
      game: gameLabel,
      game_date: gameDate,
      game_status: status,
      venue,
      team: awayTeam,
      opponent: homeTeam,
      home_away: "away",
      is_home: "0",
      pitcher: homeProbable,
      probable_pitcher: homeProbable,
      opposing_pitcher: homeProbable,
      pitcher_mlbam: homeProbableId,
      opponent_probable_pitcher: homeProbable,
      opponent_probable_pitcher_mlbam: homeProbableId,
      team_probable_pitcher: awayProbable,
      team_probable_pitcher_mlbam: awayProbableId
    };

    const homeContext = {
      date: TODAY,
      season: SEASON,
      game_pk: gamePk,
      game: gameLabel,
      game_date: gameDate,
      game_status: status,
      venue,
      team: homeTeam,
      opponent: awayTeam,
      home_away: "home",
      is_home: "1",
      pitcher: awayProbable,
      probable_pitcher: awayProbable,
      opposing_pitcher: awayProbable,
      pitcher_mlbam: awayProbableId,
      opponent_probable_pitcher: awayProbable,
      opponent_probable_pitcher_mlbam: awayProbableId,
      team_probable_pitcher: homeProbable,
      team_probable_pitcher_mlbam: homeProbableId
    };

    teamGameMap.set(teamKey(awayTeam), awayContext);
    teamGameMap.set(teamKey(homeTeam), homeContext);

    gameTextMap.set(normalizeText(gameLabel), { awayContext, homeContext });
    gameTextMap.set(normalizeText(`${homeTeam} @ ${awayTeam}`), { awayContext: homeContext, homeContext: awayContext });
    gameTextMap.set(normalizeText(`${awayTeam} at ${homeTeam}`), { awayContext, homeContext });
    gameTextMap.set(normalizeText(`${homeTeam} at ${awayTeam}`), { awayContext: homeContext, homeContext: awayContext });
  }

  return { games, teamGameMap, gameTextMap };
}

async function getPitcherHands(ids) {
  const map = new Map();
  const unique = [...new Set(ids.filter(Boolean))];

  for (const id of unique) {
    try {
      const json = await getJson(`https://statsapi.mlb.com/api/v1/people/${id}`);
      const person = json?.people?.[0];
      const hand = person?.pitchHand?.code || "";
      map.set(String(id), hand);
    } catch {
      map.set(String(id), "");
    }
  }

  return map;
}

function loadStatcastMap() {
  const rows = readCsvSafe(STATCAST_FILE);
  const map = new Map();

  for (const row of rows) {
    const name = getField(row, ["name", "last_name, first_name", "player_name"]);
    const mlbam = getField(row, ["mlbam", "player_id", "batter"]);
    const keyName = normalizeName(name);

    if (keyName) map.set(keyName, row);
    if (mlbam) map.set(String(mlbam), row);
  }

  return map;
}

function statcastField(row, names) {
  return getField(row || {}, names);
}

function scorePlayer({ odds, statcast }) {
  const implied = impliedFromAmerican(odds);
  const barrel = num(statcastField(statcast, ["barrel_pct", "barrel_batted_rate", "barrel%"]), 0);
  const hardHit = num(statcastField(statcast, ["hard_hit_pct", "hard_hit_percent", "hardhit_pct"]), 0);
  const avgEv = num(statcastField(statcast, ["avg_ev", "exit_velocity_avg", "avg_exit_velocity"]), 0);
  const xslg = num(statcastField(statcast, ["xslg", "est_slg", "estimated_slg"]), 0);
  const flyBall = num(statcastField(statcast, ["flyball_pct", "fb_pct", "fly_ball_pct"]), 0);

  let score =
    35 +
    barrel * 1.25 +
    hardHit * 0.32 +
    Math.max(0, avgEv - 86) * 1.8 +
    xslg * 18 +
    flyBall * 0.08;

  if (implied !== "") score += Math.max(0, 24 - implied) * 0.45;

  return Math.max(0, Math.min(99, score));
}

function extractName(row) {
  return getField(row, [
    "name",
    "player",
    "batter",
    "player_name",
    "description",
    "participant",
    "outcome_name"
  ]);
}

function extractTeam(row) {
  return canonicalTeam(getField(row, [
    "team",
    "player_team",
    "participant_team",
    "team_name",
    "home_team",
    "away_team"
  ]));
}

function extractGame(row) {
  return getField(row, [
    "game",
    "event",
    "matchup",
    "game_name",
    "description_game",
    "event_name"
  ]);
}

function extractBook(row) {
  return getField(row, [
    "book",
    "sportsbook",
    "bookmaker",
    "source",
    "line_source"
  ]);
}

function extractOdds(row) {
  return parseAmericanOdds(getField(row, [
    "odds",
    "best_odds",
    "price",
    "line_odds",
    "american_odds"
  ]));
}

function resolveContext(row, scheduleContext) {
  const rawTeam = extractTeam(row);
  const rawGame = extractGame(row);
  const tKey = teamKey(rawTeam);

  if (tKey && scheduleContext.teamGameMap.has(tKey)) {
    return scheduleContext.teamGameMap.get(tKey);
  }

  const gameKey = normalizeText(rawGame);
  const pair = scheduleContext.gameTextMap.get(gameKey);

  if (pair && rawTeam) {
    const awayTeam = pair.awayContext.team;
    const homeTeam = pair.homeContext.team;

    if (teamKey(rawTeam) === teamKey(awayTeam)) return pair.awayContext;
    if (teamKey(rawTeam) === teamKey(homeTeam)) return pair.homeContext;
  }

  return null;
}

function validTodayGame(context) {
  return Boolean(context?.game_pk && context?.opponent);
}

function mainRow(row, index, context, pitcherHands, statcastMap) {
  const name = extractName(row);
  const odds = extractOdds(row);
  const book = extractBook(row);
  const mlbam = getField(row, ["mlbam", "player_id", "batter", "participant_id"]);

  const statcast =
    statcastMap.get(String(mlbam)) ||
    statcastMap.get(normalizeName(name)) ||
    null;

  const implied = impliedFromAmerican(odds);
  const score = scorePlayer({ odds, statcast });
  const pitcherHand = pitcherHands.get(String(context.pitcher_mlbam || "")) || "";

  return {
    rank: index + 1,
    date: TODAY,
    season: SEASON,
    name,
    mlbam,
    team: context.team,
    opponent: context.opponent,
    game: context.game,
    game_pk: context.game_pk,
    game_date: context.game_date,
    game_status: context.game_status,
    venue: context.venue,
    home_away: context.home_away,
    is_home: context.is_home,
    pitcher: context.pitcher,
    probable_pitcher: context.probable_pitcher,
    opposing_pitcher: context.opposing_pitcher,
    pitcher_mlbam: context.pitcher_mlbam,
    pitcher_hand: pitcherHand,
    opponent_probable_pitcher: context.opponent_probable_pitcher,
    opponent_probable_pitcher_mlbam: context.opponent_probable_pitcher_mlbam,
    team_probable_pitcher: context.team_probable_pitcher,
    team_probable_pitcher_mlbam: context.team_probable_pitcher_mlbam,
    odds,
    book,
    implied: implied === "" ? "" : implied.toFixed(2),
    score: score.toFixed(2),
    statcast: statcast ? "matched_local" : "missing",
    barrel_pct: statcastField(statcast, ["barrel_pct", "barrel_batted_rate", "barrel%"]),
    hard_hit_pct: statcastField(statcast, ["hard_hit_pct", "hard_hit_percent", "hardhit_pct"]),
    avg_ev: statcastField(statcast, ["avg_ev", "exit_velocity_avg", "avg_exit_velocity"]),
    xslg: statcastField(statcast, ["xslg", "est_slg", "estimated_slg"]),
    xwoba: statcastField(statcast, ["xwoba", "est_woba", "estimated_woba"]),
    launch_angle: statcastField(statcast, ["launch_angle_avg", "avg_launch_angle", "launch_angle"]),
    raw_team: extractTeam(row),
    raw_game: extractGame(row),
    odds_source_row: JSON.stringify(row)
  };
}

async function main() {
  ensureDir(DATA_DIR);

  const oddsFile = findOddsFile();

  if (!oddsFile) {
    console.error("No odds file found.");
    console.error("Expected one of:");
    for (const file of ODDS_CANDIDATES) console.error(file);
    process.exit(1);
  }

  if (fs.existsSync(OUT_FILE)) {
    fs.copyFileSync(OUT_FILE, BACKUP_FILE);
  }

  const oddsRows = readCsvSafe(oddsFile);
  const scheduleContext = await getScheduleContext();

  const pitcherIds = [];

  for (const context of scheduleContext.teamGameMap.values()) {
    if (context.pitcher_mlbam) pitcherIds.push(context.pitcher_mlbam);
  }

  const pitcherHands = await getPitcherHands(pitcherIds);
  const statcastMap = loadStatcastMap();

  const validRows = [];
  const invalidRows = [];

  for (const row of oddsRows) {
    const name = extractName(row);
    const context = resolveContext(row, scheduleContext);

    if (!name) {
      invalidRows.push({
        player: "",
        team: extractTeam(row),
        game: extractGame(row),
        reason: "MISSING_PLAYER_NAME",
        raw: JSON.stringify(row)
      });
      continue;
    }

    if (!context || !validTodayGame(context)) {
      invalidRows.push({
        player: name,
        team: extractTeam(row),
        game: extractGame(row),
        reason: "ODDS_GAME_NOT_ON_TODAY_MLB_SCHEDULE",
        raw: JSON.stringify(row)
      });
      continue;
    }

    validRows.push({
      source: row,
      context
    });
  }

  const rows = validRows
    .map((item, index) => mainRow(item.source, index, item.context, pitcherHands, statcastMap))
    .sort((a, b) => num(b.score) - num(a.score))
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));

  fs.writeFileSync(OUT_FILE, toCsv(rows));
  fs.writeFileSync(INVALID_FILE, toCsv(invalidRows));

  const statcastMatches = rows.filter(row => row.statcast === "matched_local").length;
  const statcastMisses = rows.filter(row => row.statcast !== "matched_local").length;
  const missingPitchers = rows.filter(row => !row.pitcher).length;

  console.log("Done.");
  console.log("Season:", SEASON);
  console.log("Date:", TODAY);
  console.log("Odds source:", oddsFile);
  console.log("Odds rows:", oddsRows.length);
  console.log("Verified player rows:", rows.length);
  console.log("Rejected provider rows:", invalidRows.length);
  console.log("Statcast matches:", statcastMatches);
  console.log("Statcast misses:", statcastMisses);
  console.log("Missing opposing pitchers:", missingPitchers);
  console.log("Statcast file:", STATCAST_FILE);
  console.log("Saved:", OUT_FILE);
  console.log("Rejected rows:", INVALID_FILE);

  console.table(
    rows.slice(0, 25).map(row => ({
      rank: row.rank,
      name: row.name,
      team: row.team,
      opponent: row.opponent,
      pitcher: row.pitcher,
      hand: row.pitcher_hand,
      game: row.game,
      odds: row.odds,
      book: row.book,
      implied: row.implied,
      score: row.score,
      statcast: row.statcast
    }))
  );

  if (invalidRows.length) {
    console.log("Rejected sample:");
    console.table(
      invalidRows.slice(0, 20).map(row => ({
        player: row.player,
        team: row.team,
        game: row.game,
        reason: row.reason
      }))
    );
  }
}

main().catch(err => {
  console.error("player_stats.js failed");
  console.error(err.message);
  process.exit(1);
});
