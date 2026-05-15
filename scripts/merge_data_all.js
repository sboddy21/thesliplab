import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const ODDS_FILE = path.join(DATA_DIR, "hr_odds_flat.csv");
const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const PITCHER_FILE = path.join(DATA_DIR, "pitcher_stats.csv");
const PARK_FILE = path.join(DATA_DIR, "park_factors.csv");
const WEATHER_FILE = path.join(DATA_DIR, "weather_boost.csv");
const LINEUP_FILE = path.join(DATA_DIR, "lineups.csv");

const OUT_FILE = path.join(process.cwd(), "hr_sweep_board_all_games.csv");

const MAX_REALISTIC_HR_ODDS = 5000;
const MIN_REALISTIC_HR_ODDS = 100;

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();

  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map(h => h.trim());

  return lines.map(line => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });

    return row;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";

  const str = String(value);

  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n")
  ) {
    return `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeName(name) {
  return clean(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(".", "")
    .replace(/\bjr\b/g, "")
    .replace(/\bsr\b/g, "")
    .replace(/\biii\b/g, "")
    .replace(/\bii\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeam(team) {
  return clean(team)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(".", "")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function num(value, fallback = 0) {
  const n = Number(
    String(value || "")
      .replace("%", "")
      .replace(",", "")
      .trim()
  );

  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function splitGameTeams(game) {
  const parts = clean(game).split("@");

  return {
    away_team: clean(parts[0]),
    home_team: clean(parts[1])
  };
}

function gameFromTeams(awayTeam, homeTeam) {
  if (!awayTeam || !homeTeam) return "";
  return `${awayTeam} @ ${homeTeam}`;
}

function americanToDecimal(odds) {
  const n = Number(odds);

  if (!Number.isFinite(n)) return null;

  return n > 0
    ? 1 + n / 100
    : 1 + 100 / Math.abs(n);
}

function evPercent(modelProbability, odds) {
  const p = Number(modelProbability) / 100;
  const decimal = americanToDecimal(odds);

  if (!Number.isFinite(p) || !decimal) {
    return 0;
  }

  return (p * (decimal - 1) - (1 - p)) * 100;
}

function buildNameMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = normalizeName(row.name);

    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(row);
  }

  return map;
}

function buildWeatherMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const game = clean(row.game);

    if (!game) continue;

    map.set(game, row);
  }

  return map;
}

function buildParkMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const game = clean(row.game);

    if (!game) continue;

    map.set(game, row);
  }

  return map;
}

function buildPitcherRows(rows) {
  return rows.map(row => ({
    ...row,
    game: clean(row.game),
    pitcher_team: clean(row.pitcher_team || row.team),
    opponent_team: clean(row.opponent_team)
  }));
}

function teamMatches(a, b) {
  const x = normalizeTeam(a);
  const y = normalizeTeam(b);

  if (!x || !y) return false;
  if (x === y) return true;

  return x.includes(y) || y.includes(x);
}

function pickRowForPlayer(rows, game, team) {
  if (!rows || !rows.length) return {};

  const exact = rows.find(row => {
    return (
      clean(row.game) === game &&
      teamMatches(row.team, team)
    );
  });

  if (exact) return exact;

  const sameGame = rows.find(row => {
    return clean(row.game) === game;
  });

  if (sameGame) return sameGame;

  return rows[0] || {};
}

function deriveTeamFromGameSide(row) {
  const game =
    clean(row.game) ||
    gameFromTeams(
      clean(row.away_team),
      clean(row.home_team)
    );

  const { away_team, home_team } = splitGameTeams(game);

  const explicit =
    clean(row.team) ||
    clean(row.player_team);

  if (explicit) return explicit;

  const description = clean(
    row.description ||
    row.market_description ||
    row.market ||
    row.label
  ).toLowerCase();

  if (
    home_team &&
    description.includes(home_team.toLowerCase())
  ) {
    return home_team;
  }

  if (
    away_team &&
    description.includes(away_team.toLowerCase())
  ) {
    return away_team;
  }

  return "";
}

function getMarketRows(playerName, oddsRows) {
  const target = normalizeName(playerName);

  return oddsRows
    .filter(row => normalizeName(row.player) === target)
    .map(row => {
      const game =
        clean(row.game) ||
        gameFromTeams(
          clean(row.away_team),
          clean(row.home_team)
        );

      return {
        odds: num(row.odds, null),
        game,
        team: deriveTeamFromGameSide(row),
        home_team: clean(row.home_team) || splitGameTeams(game).home_team,
        away_team: clean(row.away_team) || splitGameTeams(game).away_team,
        commence_time: clean(row.commence_time)
      };
    })
    .filter(row => {
      return (
        Number.isFinite(row.odds) &&
        row.odds >= MIN_REALISTIC_HR_ODDS &&
        row.odds <= MAX_REALISTIC_HR_ODDS &&
        row.game
      );
    });
}

function getBestMarket(rows) {
  if (!rows.length) return null;

  return rows.reduce((a, b) => {
    return b.odds > a.odds ? b : a;
  });
}

function resolveTeam({
  playerName,
  game,
  marketTeam,
  playerRow,
  lineupRow,
  awayTeam,
  homeTeam
}) {
  const lineupTeam = clean(lineupRow.team);
  const playerTeam = clean(playerRow.team);

  if (lineupTeam) return lineupTeam;
  if (playerTeam) return playerTeam;
  if (marketTeam) return marketTeam;

  const playerKey = normalizeName(playerName);

  const obviousAway =
    playerKey.includes(normalizeName(awayTeam));

  const obviousHome =
    playerKey.includes(normalizeName(homeTeam));

  if (obviousAway) return awayTeam;
  if (obviousHome) return homeTeam;

  return "";
}

function getOpposingPitcher({
  pitcherRows,
  game,
  hitterTeam,
  awayTeam,
  homeTeam
}) {
  const opponentTeam =
    teamMatches(hitterTeam, awayTeam)
      ? homeTeam
      : teamMatches(hitterTeam, homeTeam)
      ? awayTeam
      : "";

  if (!opponentTeam) {
    return {};
  }

  const direct = pitcherRows.find(row => {
    return (
      clean(row.game) === game &&
      teamMatches(row.pitcher_team, opponentTeam)
    );
  });

  if (direct) return direct;

  const byOpponent = pitcherRows.find(row => {
    return (
      clean(row.game) === game &&
      teamMatches(row.opponent_team, hitterTeam)
    );
  });

  if (byOpponent) return byOpponent;

  return {};
}

function getTier({
  odds,
  probability,
  ev,
  marketCount
}) {
  if (odds >= 2500) return "LOTTO";

  if (
    odds <= 600 &&
    probability >= 11.5 &&
    ev >= -25 &&
    marketCount >= 2
  ) {
    return "SAFEST";
  }

  if (
    odds > 600 &&
    odds <= 1200 &&
    probability >= 8.5 &&
    marketCount >= 2
  ) {
    return "VALUE";
  }

  if (
    odds > 1200 &&
    odds < 2500 &&
    probability >= 5.5
  ) {
    return "LEVERAGE";
  }

  return "STANDARD";
}

function tierWeight(tier) {
  if (tier === "SAFEST") return 400;
  if (tier === "VALUE") return 300;
  if (tier === "LEVERAGE") return 200;
  if (tier === "STANDARD") return 100;
  if (tier === "LOTTO") return 0;

  return 0;
}

function confidenceGrade({
  tier,
  marketCount,
  probability
}) {
  if (marketCount < 2) return "C";
  if (tier === "LOTTO") return "LOTTO";
  if (tier === "SAFEST" && probability >= 13) return "A";
  if (tier === "VALUE") return "B";
  if (tier === "LEVERAGE") return "C";

  return "C";
}

function buildBoard() {
  const oddsRows = parseCsv(ODDS_FILE);
  const playerRows = parseCsv(PLAYER_FILE);
  const pitcherRows = buildPitcherRows(parseCsv(PITCHER_FILE));
  const parkRows = parseCsv(PARK_FILE);
  const weatherRows = parseCsv(WEATHER_FILE);
  const lineupRows = parseCsv(LINEUP_FILE);

  const playerMap = buildNameMap(playerRows);
  const lineupMap = buildNameMap(lineupRows);
  const weatherMap = buildWeatherMap(weatherRows);
  const parkMap = buildParkMap(parkRows);

  const uniquePlayers = [
    ...new Set(
      oddsRows
        .map(row => clean(row.player))
        .filter(Boolean)
    )
  ];

  const board = [];

  for (const playerName of uniquePlayers) {
    const marketRows = getMarketRows(playerName, oddsRows);

    if (!marketRows.length) continue;

    const bestMarket = getBestMarket(marketRows);

    if (!bestMarket) continue;

    const game = bestMarket.game;
    const awayTeam = bestMarket.away_team || splitGameTeams(game).away_team;
    const homeTeam = bestMarket.home_team || splitGameTeams(game).home_team;

    const nameKey = normalizeName(playerName);

    const marketTeam = clean(bestMarket.team);

    const playerRow = pickRowForPlayer(
      playerMap.get(nameKey),
      game,
      marketTeam
    );

    const lineupRow = pickRowForPlayer(
      lineupMap.get(nameKey),
      game,
      marketTeam || playerRow.team
    );

    const team = resolveTeam({
      playerName,
      game,
      marketTeam,
      playerRow,
      lineupRow,
      awayTeam,
      homeTeam
    });

    const weather = weatherMap.get(game) || {};
    const park = parkMap.get(game) || {};

    const pitcher = getOpposingPitcher({
      pitcherRows,
      game,
      hitterTeam: team,
      awayTeam,
      homeTeam
    });

    const hr = num(playerRow.hr, 4);
    const pa = num(playerRow.pa, 0);
    const hrPerPa = num(playerRow.hr_per_pa, 0);

    const ops = num(playerRow.ops, 0.620);
    const slg = num(playerRow.slg, 0.320);
    const barrel = num(playerRow.barrel_pct, 3);
    const hardHit = num(playerRow.hard_hit_pct, 28);
    const xslg = num(playerRow.xslg, slg);
    const avgExitVelocity = num(playerRow.avg_exit_velocity, 85);
    const avgLaunchAngle = num(playerRow.avg_launch_angle, 10);

    const lineupSpot = num(
      lineupRow.lineup_spot,
      num(playerRow.lineup_spot, 8)
    );

    const lineupStatus =
      lineupRow.lineup_status ||
      "projected";

    const pitcherEra = num(pitcher.pitcher_era, 4.20);
    const pitcherHrAllowed = num(pitcher.pitcher_hr_allowed, 1);
    const pitcherWhip = num(pitcher.pitcher_whip, 1.30);

    const parkBoost = num(park.park_boost, 0);
    const weatherBoost = num(weather.weather_boost, 0);

    const lineupBoost =
      lineupSpot === 1 ? 5 :
      lineupSpot === 2 ? 6 :
      lineupSpot === 3 ? 8 :
      lineupSpot === 4 ? 9 :
      lineupSpot === 5 ? 6 :
      lineupSpot === 6 ? 3 :
      lineupSpot === 7 ? 1 :
      0;

    const powerScore =
      hr * 1.45 +
      ops * 34 +
      slg * 36 +
      xslg * 18 +
      barrel * 1.95 +
      hardHit * 0.45 +
      avgExitVelocity * 0.18 +
      avgLaunchAngle * 0.12 +
      hrPerPa * 120;

    const pitcherAttack =
      pitcherEra * 1.7 +
      pitcherHrAllowed * 4 +
      pitcherWhip * 3;

    const oddsPenalty =
      bestMarket.odds >= 3500 ? 34 :
      bestMarket.odds >= 2500 ? 28 :
      bestMarket.odds >= 1800 ? 20 :
      bestMarket.odds >= 1200 ? 13 :
      bestMarket.odds >= 800 ? 7 :
      bestMarket.odds >= 600 ? 3 :
      0;

    const modelScore =
      powerScore +
      pitcherAttack +
      lineupBoost +
      parkBoost +
      weatherBoost -
      oddsPenalty;

    const probabilityCap =
      bestMarket.odds >= 3500 ? 4.8 :
      bestMarket.odds >= 2500 ? 5.8 :
      bestMarket.odds >= 1800 ? 7.2 :
      bestMarket.odds >= 1200 ? 8.8 :
      bestMarket.odds >= 800 ? 10.5 :
      bestMarket.odds >= 600 ? 12 :
      bestMarket.odds >= 450 ? 14 :
      17;

    const modelProbability = clamp(
      modelScore / 12.5,
      2.2,
      probabilityCap
    );

    const internalEv = evPercent(
      modelProbability,
      bestMarket.odds
    );

    const tier = getTier({
      odds: bestMarket.odds,
      probability: modelProbability,
      ev: internalEv,
      marketCount: marketRows.length
    });

    const confidence = confidenceGrade({
      tier,
      marketCount: marketRows.length,
      probability: modelProbability
    });

    const evForRank = clamp(
      internalEv,
      -30,
      12
    );

    const rankScore =
      tierWeight(tier) +
      modelProbability * 6 +
      modelScore * 0.5 +
      evForRank * 0.4 +
      marketRows.length * 2;

    board.push({
      name: playerName,
      team,
      game,
      commence_time: bestMarket.commence_time || "",
      venue: park.venue || weather.venue || "",

      lineup_spot: lineupSpot,
      lineup_status: lineupStatus,

      hr,
      pa,
      hr_per_pa: hrPerPa ? hrPerPa.toFixed(4) : "",

      ops: ops.toFixed(3),
      slg: slg.toFixed(3),
      barrel_pct: barrel.toFixed(1),
      hard_hit_pct: hardHit.toFixed(1),
      xslg: xslg.toFixed(3),
      avg_exit_velocity: avgExitVelocity.toFixed(1),
      avg_launch_angle: avgLaunchAngle.toFixed(1),

      opposing_pitcher: pitcher.pitcher_name || pitcher.pitcher || "",
      pitcher_team: pitcher.pitcher_team || pitcher.team || "",
      pitcher_era: pitcherEra.toFixed(2),
      pitcher_hr_allowed: pitcherHrAllowed,
      pitcher_whip: pitcherWhip.toFixed(2),

      park_boost: parkBoost,

      temp: weather.temp || "",
      humidity: weather.humidity || "",
      wind_speed: weather.wind_speed || "",
      wind_text: weather.wind_text || "",
      weather_boost: weatherBoost,
      weather_label: weather.weather_label || "",
      roof_flag: weather.roof_flag || "",

      model_score: modelScore.toFixed(2),
      model_probability: modelProbability.toFixed(2),

      internal_ev: internalEv.toFixed(2),
      internal_market_odds: bestMarket.odds,
      internal_market_count: marketRows.length,

      rank_score: rankScore.toFixed(2),
      confidence,
      tier
    });
  }

  const deduped = [];
  const seen = new Set();

  for (const row of board) {
    const key = [
      normalizeName(row.name),
      clean(row.game)
    ].join("|");

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(row);
  }

  deduped.sort((a, b) => {
    const tierDiff =
      tierWeight(b.tier) -
      tierWeight(a.tier);

    if (tierDiff !== 0) return tierDiff;

    return num(b.rank_score) - num(a.rank_score);
  });

  return deduped.map((row, i) => ({
    rank: i + 1,
    ...row
  }));
}

function writeBoard(rows) {
  const headers = [
    "rank",
    "name",
    "team",
    "game",
    "commence_time",
    "venue",

    "lineup_spot",
    "lineup_status",

    "hr",
    "pa",
    "hr_per_pa",

    "ops",
    "slg",
    "barrel_pct",
    "hard_hit_pct",
    "xslg",
    "avg_exit_velocity",
    "avg_launch_angle",

    "opposing_pitcher",
    "pitcher_team",
    "pitcher_era",
    "pitcher_hr_allowed",
    "pitcher_whip",

    "park_boost",

    "temp",
    "humidity",
    "wind_speed",
    "wind_text",
    "weather_boost",
    "weather_label",
    "roof_flag",

    "model_score",
    "model_probability",

    "internal_ev",
    "internal_market_odds",
    "internal_market_count",

    "rank_score",
    "confidence",
    "tier"
  ];

  const lines = [
    headers.join(","),
    ...rows.map(row =>
      headers
        .map(h => csvEscape(row[h]))
        .join(",")
    )
  ];

  fs.writeFileSync(
    OUT_FILE,
    lines.join("\n")
  );
}

function main() {
  const board = buildBoard();

  writeBoard(board);

  const games = new Set(
    board
      .map(row => row.game)
      .filter(Boolean)
  );

  const tiers = {};

  for (const row of board) {
    tiers[row.tier] =
      (tiers[row.tier] || 0) + 1;
  }

  console.log("Done.");
  console.log("All games:", games.size);
  console.log("Rows:", board.length);
  console.log("Saved:", OUT_FILE);
  console.log("Tier spread:", tiers);

  console.table(
    board.slice(0, 20).map(row => ({
      rank: row.rank,
      name: row.name,
      team: row.team,
      game: row.game,
      lineup: row.lineup_spot,
      pitcher: row.opposing_pitcher,
      prob: row.model_probability,
      odds: row.internal_market_odds,
      ev: row.internal_ev,
      score: row.rank_score,
      tier: row.tier
    }))
  );
}

main();