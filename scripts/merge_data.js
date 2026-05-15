import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const ODDS_FILE = path.join(DATA_DIR, "hr_odds_flat.csv");
const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const PITCHER_FILE = path.join(DATA_DIR, "pitcher_stats.csv");
const PARK_FILE = path.join(DATA_DIR, "park_factors.csv");
const WEATHER_FILE = path.join(DATA_DIR, "weather_boost.csv");
const LINEUP_FILE = path.join(DATA_DIR, "lineups.csv");

const OUT_FILE = path.join(process.cwd(), "hr_sweep_board.csv");

const MAX_REALISTIC_HR_ODDS = 5000;
const MIN_REALISTIC_HR_ODDS = 100;

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map(h => h.trim());

  return lines.map(line => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] ?? "");
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      insideQuotes = !insideQuotes;
    } else if (c === "," && !insideQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";

  const str = String(value);

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll(" jr", "")
    .replaceAll(" sr", "")
    .replaceAll(" iii", "")
    .replaceAll(" ii", "")
    .replace(/\s+/g, " ");
}

function americanToDecimal(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n)) return null;

  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function evPercent(modelProbability, odds) {
  const p = Number(modelProbability) / 100;
  const decimal = americanToDecimal(odds);

  if (!Number.isFinite(p) || !decimal) return 0;

  const ev = p * (decimal - 1) - (1 - p);
  return ev * 100;
}

function indexByName(rows, field = "name") {
  const map = new Map();

  for (const row of rows) {
    const key = cleanName(row[field]);
    if (key) map.set(key, row);
  }

  return map;
}

function indexByGame(rows) {
  const map = new Map();

  for (const row of rows) {
    if (row.game) map.set(row.game, row);
    if (row.venue) map.set(row.venue, row);
  }

  return map;
}

function filterPregameRows(rows) {
  const now = Date.now();

  return rows.filter(row => {
    if (!row.commence_time) return true;

    const gameTime = new Date(row.commence_time).getTime();

    if (!Number.isFinite(gameTime)) return true;

    return gameTime > now;
  });
}

function getMarketInput(playerName, oddsRows) {
  const target = cleanName(playerName);

  const matches = oddsRows
    .filter(row => cleanName(row.player) === target)
    .map(row => ({
      odds: num(row.odds, null),
      game: row.game,
      home_team: row.home_team,
      away_team: row.away_team
    }))
    .filter(row => {
      return (
        Number.isFinite(row.odds) &&
        row.odds >= MIN_REALISTIC_HR_ODDS &&
        row.odds <= MAX_REALISTIC_HR_ODDS
      );
    });

  if (!matches.length) return null;

  const bestMarket = matches.reduce((a, b) => b.odds > a.odds ? b : a);
  const averageMarketOdds =
    matches.reduce((sum, r) => sum + r.odds, 0) / matches.length;

  return {
    internal_market_odds: Math.round(bestMarket.odds),
    internal_average_market_odds: Math.round(averageMarketOdds),
    internal_market_count: matches.length,
    game: bestMarket.game,
    home_team: bestMarket.home_team,
    away_team: bestMarket.away_team
  };
}

function getTier(row) {
  const odds = row.internal_market_odds;
  const prob = row.model_probability;
  const ev = row.internal_ev;
  const count = row.internal_market_count;

  if (odds >= 2500) return "LOTTO";

  if (
    odds <= 600 &&
    prob >= 11.5 &&
    ev >= -25 &&
    count >= 2
  ) {
    return "SAFEST";
  }

  if (
    odds > 600 &&
    odds <= 1200 &&
    prob >= 8.5 &&
    count >= 2
  ) {
    return "VALUE";
  }

  if (
    odds > 1200 &&
    odds < 2500 &&
    prob >= 5.5
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

function confidenceGrade(row) {
  if (row.internal_market_count < 2) return "C";
  if (row.tier === "LOTTO") return "LOTTO";
  if (row.tier === "SAFEST" && row.model_probability >= 13) return "A";
  if (row.tier === "VALUE") return "B";
  if (row.tier === "LEVERAGE") return "C";
  return "C";
}

function buildBoard() {
  const allOddsRows = parseCsv(ODDS_FILE);
  const playerRows = parseCsv(PLAYER_FILE);
  const pitcherRows = parseCsv(PITCHER_FILE);
  const parkRows = parseCsv(PARK_FILE);
  const weatherRows = parseCsv(WEATHER_FILE);
  const lineupRows = parseCsv(LINEUP_FILE);

  if (!allOddsRows.length) {
    console.error("No odds found. Run full_sweep.js first.");
    process.exit(1);
  }

  const oddsRows = filterPregameRows(allOddsRows);

  if (!oddsRows.length) {
    console.error("No pregame odds left. All games may have started.");
    fs.writeFileSync(OUT_FILE, "");
    return [];
  }

  const playerMap = indexByName(playerRows, "name");
  const pitcherMap = indexByGame(pitcherRows);
  const parkMap = indexByGame(parkRows);
  const weatherMap = indexByGame(weatherRows);
  const lineupMap = indexByName(lineupRows, "name");

  const uniquePlayers = [
    ...new Set(
      oddsRows
        .map(r => r.player)
        .filter(Boolean)
    )
  ];

  const board = [];

  for (const playerName of uniquePlayers) {
    const marketData = getMarketInput(playerName, oddsRows);
    if (!marketData) continue;

    const player = playerMap.get(cleanName(playerName)) || {};
    const lineup = lineupMap.get(cleanName(playerName)) || {};
    const park = parkMap.get(marketData.game) || {};
    const weather = weatherMap.get(marketData.game) || {};
    const pitcher = pitcherMap.get(marketData.game) || {};

    const hr = num(player.hr, 4);
    const pa = num(player.pa, 0);
    const hrPerPa = num(player.hr_per_pa, 0);
    const ops = num(player.ops, 0.620);
    const slg = num(player.slg, 0.320);
    const barrel = num(player.barrel_pct, 3);
    const hardHit = num(player.hard_hit_pct, 28);
    const xslg = num(player.xslg, slg);
    const avgExitVelocity = num(player.avg_exit_velocity, 85);
    const avgLaunchAngle = num(player.avg_launch_angle, 10);

    const lineupSpot = num(lineup.lineup_spot, num(player.lineup_spot, 8));
    const lineupStatus = lineup.lineup_status || "projected";

    const pitcherEra = num(pitcher.pitcher_era, 4.20);
    const pitcherHrAllowed = num(pitcher.pitcher_hr_allowed, 1);
    const pitcherWhip = num(pitcher.pitcher_whip, 1.30);

    const parkBoost = num(park.park_boost, 0);
    const weatherBoost = num(weather.weather_boost, 0);
    const weatherLabel = weather.weather_label || "";
    const roofFlag = weather.roof_flag || "";

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
      marketData.internal_market_odds >= 3500 ? 34 :
      marketData.internal_market_odds >= 2500 ? 28 :
      marketData.internal_market_odds >= 1800 ? 20 :
      marketData.internal_market_odds >= 1200 ? 13 :
      marketData.internal_market_odds >= 800 ? 7 :
      marketData.internal_market_odds >= 600 ? 3 :
      0;

    const modelScore =
      powerScore +
      pitcherAttack +
      lineupBoost +
      parkBoost +
      weatherBoost -
      oddsPenalty;

    const rawProbability = modelScore / 12.5;

    const probabilityCap =
      marketData.internal_market_odds >= 3500 ? 4.8 :
      marketData.internal_market_odds >= 2500 ? 5.8 :
      marketData.internal_market_odds >= 1800 ? 7.2 :
      marketData.internal_market_odds >= 1200 ? 8.8 :
      marketData.internal_market_odds >= 800 ? 10.5 :
      marketData.internal_market_odds >= 600 ? 12 :
      marketData.internal_market_odds >= 450 ? 14 :
      17;

    const modelProbability = Math.max(
      2.2,
      Math.min(probabilityCap, rawProbability)
    );

    const internalEv = evPercent(modelProbability, marketData.internal_market_odds);

    const row = {
      name: playerName,
      team: player.team || lineup.team || "",
      game: marketData.game,
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
      pitcher_era: pitcherEra.toFixed(2),
      pitcher_hr_allowed: pitcherHrAllowed,
      pitcher_whip: pitcherWhip.toFixed(2),
      park_boost: parkBoost,
      temp: weather.temp || "",
      humidity: weather.humidity || "",
      wind_speed: weather.wind_speed || "",
      wind_text: weather.wind_text || "",
      weather_boost: weatherBoost,
      weather_label: weatherLabel,
      roof_flag: roofFlag,
      model_score: modelScore.toFixed(2),
      model_probability: modelProbability.toFixed(2),
      internal_ev: internalEv,
      internal_market_odds: marketData.internal_market_odds,
      internal_market_count: marketData.internal_market_count
    };

    row.tier = getTier({
      internal_market_odds: marketData.internal_market_odds,
      model_probability: modelProbability,
      internal_ev: internalEv,
      internal_market_count: marketData.internal_market_count
    });

    row.confidence = confidenceGrade({
      internal_market_count: marketData.internal_market_count,
      tier: row.tier,
      model_probability: modelProbability
    });

    const evForRank = Math.max(Math.min(internalEv, 12), -30);

    row.rank_score = (
      tierWeight(row.tier) +
      modelProbability * 6 +
      modelScore * 0.5 +
      evForRank * 0.4 +
      marketData.internal_market_count * 2
    ).toFixed(2);

    board.push(row);
  }

  board.sort((a, b) => {
    const tierDiff = tierWeight(b.tier) - tierWeight(a.tier);
    if (tierDiff !== 0) return tierDiff;

    return num(b.rank_score) - num(a.rank_score);
  });

  return board.map((row, i) => ({
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
    "rank_score",
    "confidence",
    "tier"
  ];

  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ];

  fs.writeFileSync(OUT_FILE, lines.join("\n"));
}

function main() {
  const allOddsRows = parseCsv(ODDS_FILE);
  const pregameOddsRows = filterPregameRows(allOddsRows);

  const board = buildBoard();
  writeBoard(board);

  const tiers = {};

  for (const row of board) {
    tiers[row.tier] = (tiers[row.tier] || 0) + 1;
  }

  const pregameGames = new Set(
    pregameOddsRows
      .map(r => r.game)
      .filter(Boolean)
  );

  console.log("Done.");
  console.log("Pregame games:", pregameGames.size);
  console.log("Rows:", board.length);
  console.log("Saved:", OUT_FILE);
  console.log("Tier spread:", tiers);
  console.log("Top 10:");

  console.table(
    board.slice(0, 10).map(r => ({
      rank: r.rank,
      name: r.name,
      game: r.game,
      prob: r.model_probability,
      wind: r.wind_text,
      weather: r.weather_boost,
      lineup: r.lineup_spot,
      status: r.lineup_status,
      score: r.rank_score,
      tier: r.tier
    }))
  );
}

main();