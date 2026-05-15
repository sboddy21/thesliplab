import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const ADVANCED_FILE = path.join(DATA_DIR, "advanced_hitter_stats.csv");
const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const LINEUP_FILE = path.join(DATA_DIR, "lineups.csv");
const PITCHER_FILE = path.join(DATA_DIR, "pitcher_stats.csv");
const WEATHER_FILE = path.join(DATA_DIR, "weather_boost.csv");

const OUT_FILE = path.join(process.cwd(), "tb_board.csv");

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

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

function num(value, fallback = 0) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
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

function indexByName(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.name) continue;

    map.set(cleanName(row.name), row);
  }

  return map;
}

function indexWeather(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.game) continue;

    map.set(row.game, row);
  }

  return map;
}

function getOpposingPitcher(game, hitterTeam, pitcherRows) {
  return pitcherRows.find(row => {
    return (
      row.game === game &&
      row.opponent_team === hitterTeam
    );
  });
}

function lineupScore2TB(spot) {
  if (spot === 1) return 11;
  if (spot === 2) return 11;
  if (spot === 3) return 9;
  if (spot === 4) return 7;
  if (spot === 5) return 4;
  if (spot === 6) return 0;
  if (spot === 7) return -5;
  if (spot === 8) return -9;

  return -13;
}

function lineupScore3TB(spot) {
  if (spot === 1) return 7;
  if (spot === 2) return 9;
  if (spot === 3) return 9;
  if (spot === 4) return 8;
  if (spot === 5) return 4;
  if (spot === 6) return 0;
  if (spot === 7) return -6;
  if (spot === 8) return -10;

  return -14;
}

function lineupScore4TB(spot) {
  if (spot === 1) return 4;
  if (spot === 2) return 6;
  if (spot === 3) return 9;
  if (spot === 4) return 9;
  if (spot === 5) return 5;
  if (spot === 6) return 1;
  if (spot === 7) return -6;
  if (spot === 8) return -10;

  return -15;
}

function tier2TB(score) {
  if (score >= 86) return "ANCHOR";
  if (score >= 78) return "SAFE";
  if (score >= 70) return "VALUE";

  return "PASS";
}

function tier3TB(score) {
  if (score >= 82) return "ANCHOR";
  if (score >= 74) return "SAFE";
  if (score >= 66) return "VALUE";

  return "PASS";
}

function tier4TB(score) {
  if (score >= 78) return "ANCHOR";
  if (score >= 70) return "SAFE";
  if (score >= 62) return "VALUE";

  return "PASS";
}

function confidence(score) {
  if (score >= 88) return "A";
  if (score >= 80) return "B";
  if (score >= 72) return "C";

  return "D";
}

function clampScore(value) {
  return Math.max(0, Math.min(99, value));
}

function bestMarketByScore(score2, score3, score4) {
  const adjusted2 = score2;
  const adjusted3 = score3 - 7;
  const adjusted4 = score4 - 16;

  if (adjusted4 >= adjusted3 && adjusted4 >= adjusted2) {
    return "4+ TB";
  }

  if (adjusted3 >= adjusted2) {
    return "3+ TB";
  }

  return "2+ TB";
}

function buildBoard() {
  const advancedRows = parseCsv(ADVANCED_FILE);
  const playerRows = parseCsv(PLAYER_FILE);
  const lineupRows = parseCsv(LINEUP_FILE);
  const pitcherRows = parseCsv(PITCHER_FILE);
  const weatherRows = parseCsv(WEATHER_FILE);

  const advancedMap = indexByName(advancedRows);
  const playerMap = indexByName(playerRows);
  const weatherMap = indexWeather(weatherRows);

  const board = [];

  for (const lineup of lineupRows) {
    if (lineup.lineup_status !== "confirmed") continue;

    const advanced = advancedMap.get(cleanName(lineup.name));
    const player = playerMap.get(cleanName(lineup.name)) || {};

    if (!advanced || advanced.stat_status !== "ok") continue;

    const pitcher = getOpposingPitcher(
      lineup.game,
      lineup.team,
      pitcherRows
    );

    const weather = weatherMap.get(lineup.game) || {};

    const spot = num(lineup.lineup_spot, 9);

    const avg = num(advanced.avg, 0.240);
    const obp = num(advanced.obp, 0.300);
    const ops = num(advanced.ops, 0.680);
    const slg = num(advanced.slg, 0.380);

    const strikeoutRate = num(advanced.strikeout_rate, 24);
    const hitRate = num(advanced.hit_rate, 24);
    const extraBaseHitRate = num(advanced.extra_base_hit_rate, 25);
    const totalBasesPerHit = num(advanced.total_bases_per_hit, 1.35);
    const totalBasesPerAtBat = num(advanced.total_bases_per_at_bat, 0.350);
    const plateAppearances = num(advanced.plate_appearances, 0);
    const atBats = num(advanced.at_bats, 0);
    const homeRuns = num(advanced.home_runs, 0);

    const barrel = num(player.barrel_pct, 4);
    const hardHit = num(player.hard_hit_pct, 32);
    const ev = num(player.avg_exit_velocity, 86);
    const launch = num(player.avg_launch_angle, 10);
    const xslg = num(player.xslg, slg);

    const pitcherEra = num(pitcher?.pitcher_era, 4.20);
    const pitcherWhip = num(pitcher?.pitcher_whip, 1.30);
    const pitcherHrAllowed = num(pitcher?.pitcher_hr_allowed, 4);
    const pitcherHitsAllowed = num(pitcher?.pitcher_hits_allowed, 35);

    const weatherBoost = num(weather.weather_boost, 0);

    const samplePenalty =
      plateAppearances < 20 ? 18 :
      plateAppearances < 50 ? 11 :
      plateAppearances < 100 ? 5 :
      0;

    const kPenalty2 =
      strikeoutRate >= 34 ? 12 :
      strikeoutRate >= 30 ? 8 :
      strikeoutRate >= 26 ? 5 :
      strikeoutRate <= 16 ? -4 :
      0;

    const kPenalty3 =
      strikeoutRate >= 34 ? 10 :
      strikeoutRate >= 30 ? 7 :
      strikeoutRate >= 26 ? 4 :
      strikeoutRate <= 16 ? -2 :
      0;

    const kPenalty4 =
      strikeoutRate >= 36 ? 9 :
      strikeoutRate >= 32 ? 6 :
      strikeoutRate >= 28 ? 3 :
      0;

    const pitcherWhipScore =
      pitcherWhip >= 1.55 ? 6 :
      pitcherWhip >= 1.40 ? 4 :
      pitcherWhip >= 1.25 ? 2 :
      pitcherWhip <= 1.05 ? -5 :
      pitcherWhip <= 1.15 ? -2 :
      0;

    const pitcherEraScore =
      pitcherEra >= 5.00 ? 5 :
      pitcherEra >= 4.25 ? 3 :
      pitcherEra <= 2.50 ? -5 :
      pitcherEra <= 3.20 ? -2 :
      0;

    const pitcherHrScore =
      pitcherHrAllowed >= 8 ? 6 :
      pitcherHrAllowed >= 5 ? 4 :
      pitcherHrAllowed <= 1 ? -4 :
      0;

    const pitcherHitsScore =
      pitcherHitsAllowed >= 45 ? 4 :
      pitcherHitsAllowed >= 35 ? 2 :
      pitcherHitsAllowed <= 15 ? -4 :
      0;

    const hrPerPa =
      plateAppearances > 0
        ? homeRuns / plateAppearances
        : 0;

    const ceilingBonus =
      barrel >= 18 ? 8 :
      barrel >= 13 ? 5 :
      barrel >= 9 ? 2 :
      0;

    const hrProfileBonus =
      hrPerPa >= 0.07 ? 8 :
      hrPerPa >= 0.045 ? 5 :
      hrPerPa >= 0.03 ? 2 :
      0;

    const score2TB = clampScore(
      avg * 48 +
      obp * 26 +
      hitRate * 0.42 +
      ops * 8 +
      slg * 12 +
      xslg * 10 +
      totalBasesPerAtBat * 30 +
      totalBasesPerHit * 3 +
      hardHit * 0.08 +
      ev * 0.03 +
      pitcherWhipScore +
      pitcherEraScore +
      pitcherHitsScore +
      lineupScore2TB(spot) +
      weatherBoost * 0.20 -
      kPenalty2 -
      samplePenalty
    );

    const score3TB = clampScore(
      avg * 22 +
      obp * 12 +
      ops * 12 +
      slg * 22 +
      xslg * 22 +
      extraBaseHitRate * 0.18 +
      totalBasesPerAtBat * 34 +
      totalBasesPerHit * 5 +
      barrel * 0.28 +
      hardHit * 0.12 +
      ev * 0.04 +
      pitcherWhipScore +
      pitcherEraScore +
      pitcherHrScore +
      pitcherHitsScore +
      lineupScore3TB(spot) +
      weatherBoost * 0.30 -
      kPenalty3 -
      samplePenalty -
      12
    );

    const score4TB = clampScore(
      ops * 11 +
      slg * 24 +
      xslg * 25 +
      extraBaseHitRate * 0.16 +
      totalBasesPerAtBat * 28 +
      totalBasesPerHit * 5 +
      barrel * 0.65 +
      hardHit * 0.18 +
      ev * 0.06 +
      launch * 0.06 +
      pitcherEraScore +
      pitcherHrScore +
      ceilingBonus +
      hrProfileBonus +
      lineupScore4TB(spot) +
      weatherBoost * 0.50 -
      kPenalty4 -
      samplePenalty -
      28
    );

    const bestMarket = bestMarketByScore(
      score2TB,
      score3TB,
      score4TB
    );

    const bestScore =
      bestMarket === "4+ TB"
        ? score4TB
        : bestMarket === "3+ TB"
        ? score3TB
        : score2TB;

    const twoTier = tier2TB(score2TB);
    const threeTier = tier3TB(score3TB);
    const fourTier = tier4TB(score4TB);

    if (
      twoTier === "PASS" &&
      threeTier === "PASS" &&
      fourTier === "PASS"
    ) {
      continue;
    }

    board.push({
      name: lineup.name,
      team: lineup.team,
      game: lineup.game,
      commence_time: weather.commence_time || "",
      lineup_spot: spot,

      avg: avg.toFixed(3),
      obp: obp.toFixed(3),
      ops: ops.toFixed(3),
      slg: slg.toFixed(3),
      xslg: xslg.toFixed(3),

      strikeout_rate: strikeoutRate.toFixed(1),
      hit_rate: hitRate.toFixed(1),
      extra_base_hit_rate: extraBaseHitRate.toFixed(1),
      total_bases_per_hit: totalBasesPerHit.toFixed(2),
      total_bases_per_at_bat: totalBasesPerAtBat.toFixed(3),
      plate_appearances: plateAppearances,
      at_bats: atBats,
      home_runs: homeRuns,

      barrel_pct: barrel.toFixed(1),
      hard_hit_pct: hardHit.toFixed(1),
      avg_exit_velocity: ev.toFixed(1),
      avg_launch_angle: launch.toFixed(1),

      opposing_pitcher: pitcher?.pitcher_name || "",
      pitcher_era: pitcherEra.toFixed(2),
      pitcher_whip: pitcherWhip.toFixed(2),
      pitcher_hr_allowed: pitcherHrAllowed,
      pitcher_hits_allowed: pitcherHitsAllowed,

      weather: weather.weather_label || "",
      wind: weather.wind_text || "",

      two_tb_score: score2TB.toFixed(2),
      two_tb_tier: twoTier,
      two_tb_confidence: confidence(score2TB),

      three_tb_score: score3TB.toFixed(2),
      three_tb_tier: threeTier,
      three_tb_confidence: confidence(score3TB),

      four_tb_score: score4TB.toFixed(2),
      four_tb_tier: fourTier,
      four_tb_confidence: confidence(score4TB),

      best_market: bestMarket,
      best_score: bestScore.toFixed(2)
    });
  }

  return board
    .sort((a, b) => num(b.best_score) - num(a.best_score))
    .map((row, i) => ({
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
    "lineup_spot",

    "avg",
    "obp",
    "ops",
    "slg",
    "xslg",

    "strikeout_rate",
    "hit_rate",
    "extra_base_hit_rate",
    "total_bases_per_hit",
    "total_bases_per_at_bat",
    "plate_appearances",
    "at_bats",
    "home_runs",

    "barrel_pct",
    "hard_hit_pct",
    "avg_exit_velocity",
    "avg_launch_angle",

    "opposing_pitcher",
    "pitcher_era",
    "pitcher_whip",
    "pitcher_hr_allowed",
    "pitcher_hits_allowed",

    "weather",
    "wind",

    "two_tb_score",
    "two_tb_tier",
    "two_tb_confidence",

    "three_tb_score",
    "three_tb_tier",
    "three_tb_confidence",

    "four_tb_score",
    "four_tb_tier",
    "four_tb_confidence",

    "best_market",
    "best_score"
  ];

  const lines = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => csvEscape(row[h])).join(",")
    )
  ];

  fs.writeFileSync(OUT_FILE, lines.join("\n"));
}

function main() {
  const board = buildBoard();

  writeBoard(board);

  console.log("Done.");
  console.log("Rows:", board.length);
  console.log("Saved:", OUT_FILE);

  console.table(
    board.slice(0, 20).map(r => ({
      rank: r.rank,
      name: r.name,
      team: r.team,
      game: r.game,
      commence_time: r.commence_time,
      lineup: r.lineup_spot,
      best: r.best_market,
      score: r.best_score,
      two: r.two_tb_score,
      three: r.three_tb_score,
      four: r.four_tb_score,
      pitcher: r.opposing_pitcher
    }))
  );
}

main();