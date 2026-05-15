import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const ADVANCED_FILE = path.join(DATA_DIR, "advanced_hitter_stats.csv");
const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const LINEUP_FILE = path.join(DATA_DIR, "lineups.csv");
const PITCHER_FILE = path.join(DATA_DIR, "pitcher_stats.csv");
const WEATHER_FILE = path.join(DATA_DIR, "weather_boost.csv");

const OUT_FILE = path.join(process.cwd(), "hits_board.csv");

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

function clean(value) {
  return String(value || "").trim();
}

function cleanName(name) {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scale(value, min, max, points) {
  const n = num(value, min);

  if (max === min) return 0;

  return clamp(((n - min) / (max - min)) * points, 0, points);
}

function reverseScale(value, min, max, points) {
  const n = num(value, max);

  if (max === min) return 0;

  return clamp(((max - n) / (max - min)) * points, 0, points);
}

function lineupScore(spot) {
  if (spot === 1) return 7;
  if (spot === 2) return 7;
  if (spot === 3) return 6;
  if (spot === 4) return 4;
  if (spot === 5) return 2;
  if (spot === 6) return 0;
  if (spot === 7) return -4;
  if (spot === 8) return -7;
  if (spot === 9) return -9;

  return -10;
}

function getTier(score, spot) {
  if (score >= 88 && spot <= 4) return "ANCHOR";
  if (score >= 80 && spot <= 5) return "SAFE";
  if (score >= 72 && spot <= 6) return "VALUE";
  if (score >= 66 && spot <= 7) return "WATCH";

  return "PASS";
}

function confidence(score) {
  if (score >= 90) return "A";
  if (score >= 84) return "B";
  if (score >= 76) return "C";
  if (score >= 68) return "D";

  return "F";
}

function scoreContactProfile({
  avg,
  obp,
  hitRate,
  ballInPlayRate,
  strikeoutRate,
  plateAppearances
}) {
  const contact =
    scale(avg, 0.180, 0.330, 20) +
    scale(obp, 0.260, 0.410, 10) +
    scale(hitRate, 16, 33, 18) +
    scale(ballInPlayRate, 48, 76, 12) +
    reverseScale(strikeoutRate, 12, 36, 14);

  const samplePenalty =
    plateAppearances < 20 ? 14 :
    plateAppearances < 50 ? 8 :
    plateAppearances < 100 ? 4 :
    0;

  return contact - samplePenalty;
}

function scoreQualityProfile({
  ops,
  slg,
  xslg,
  hardHit,
  avgExitVelocity,
  walkRate
}) {
  return (
    scale(ops, 0.540, 0.930, 8) +
    scale(slg, 0.280, 0.560, 7) +
    scale(xslg, 0.280, 0.560, 7) +
    scale(hardHit, 24, 52, 5) +
    scale(avgExitVelocity, 82, 93, 4) +
    scale(walkRate, 4, 14, 3)
  );
}

function scorePitcherMatchup({
  pitcherEra,
  pitcherWhip,
  pitcherHitsAllowed,
  pitcherWalks
}) {
  const whipScore =
    pitcherWhip >= 1.55 ? 8 :
    pitcherWhip >= 1.40 ? 6 :
    pitcherWhip >= 1.25 ? 3 :
    pitcherWhip <= 1.05 ? -7 :
    pitcherWhip <= 1.15 ? -4 :
    0;

  const eraScore =
    pitcherEra >= 5.00 ? 4 :
    pitcherEra >= 4.25 ? 2 :
    pitcherEra <= 2.50 ? -5 :
    pitcherEra <= 3.20 ? -3 :
    0;

  const hitsScore =
    pitcherHitsAllowed >= 45 ? 4 :
    pitcherHitsAllowed >= 35 ? 2 :
    pitcherHitsAllowed <= 15 ? -5 :
    0;

  const walksScore =
    pitcherWalks >= 18 ? 2 :
    pitcherWalks >= 12 ? 1 :
    0;

  return whipScore + eraScore + hitsScore + walksScore;
}

function scoreWeather(weatherBoost) {
  return clamp(num(weatherBoost, 0) * 0.25, -2, 2);
}

function calculateHitsScore(inputs) {
  const contact = scoreContactProfile(inputs);
  const quality = scoreQualityProfile(inputs);
  const pitcher = scorePitcherMatchup(inputs);
  const lineup = lineupScore(inputs.spot);
  const weather = scoreWeather(inputs.weatherBoost);

  const raw =
    31 +
    contact +
    quality +
    pitcher +
    lineup +
    weather;

  return clamp(raw, 0, 96);
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

    const hitRate = num(advanced.hit_rate, 24);
    const strikeoutRate = num(advanced.strikeout_rate, 24);
    const walkRate = num(advanced.walk_rate, 8);
    const ballInPlayRate = num(advanced.ball_in_play_rate, 62);
    const plateAppearances = num(advanced.plate_appearances, 0);
    const atBats = num(advanced.at_bats, 0);

    const hardHit = num(player.hard_hit_pct, 32);
    const avgExitVelocity = num(player.avg_exit_velocity, 86);
    const xslg = num(player.xslg, slg);

    const pitcherEra = num(pitcher?.pitcher_era, 4.20);
    const pitcherWhip = num(pitcher?.pitcher_whip, 1.30);
    const pitcherHitsAllowed = num(pitcher?.pitcher_hits_allowed, 35);
    const pitcherWalks = num(pitcher?.pitcher_walks, 12);

    const weatherBoost = num(weather.weather_boost, 0);

    const finalScore = calculateHitsScore({
      avg,
      obp,
      ops,
      slg,
      hitRate,
      strikeoutRate,
      walkRate,
      ballInPlayRate,
      plateAppearances,
      hardHit,
      avgExitVelocity,
      xslg,
      pitcherEra,
      pitcherWhip,
      pitcherHitsAllowed,
      pitcherWalks,
      weatherBoost,
      spot
    });

    const tier = getTier(finalScore, spot);

    if (tier === "PASS") continue;

    board.push({
      name: lineup.name,
      team: lineup.team,
      game: lineup.game,
      commence_time: lineup.commence_time || weather.commence_time || "",
      lineup_spot: spot,

      avg: avg.toFixed(3),
      obp: obp.toFixed(3),
      ops: ops.toFixed(3),
      slg: slg.toFixed(3),
      hit_rate: hitRate.toFixed(1),
      strikeout_rate: strikeoutRate.toFixed(1),
      walk_rate: walkRate.toFixed(1),
      ball_in_play_rate: ballInPlayRate.toFixed(1),
      plate_appearances: plateAppearances,
      at_bats: atBats,

      hard_hit_pct: hardHit.toFixed(1),
      avg_exit_velocity: avgExitVelocity.toFixed(1),
      xslg: xslg.toFixed(3),

      opposing_pitcher: pitcher?.pitcher_name || "",
      pitcher_era: pitcherEra.toFixed(2),
      pitcher_whip: pitcherWhip.toFixed(2),
      pitcher_hits_allowed: pitcherHitsAllowed,
      pitcher_walks: pitcherWalks,

      weather: weather.weather_label || "",
      wind: weather.wind_text || "",

      hits_score: finalScore.toFixed(2),
      confidence: confidence(finalScore),
      tier
    });
  }

  return board
    .sort((a, b) => num(b.hits_score) - num(a.hits_score))
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
    "hit_rate",
    "strikeout_rate",
    "walk_rate",
    "ball_in_play_rate",
    "plate_appearances",
    "at_bats",

    "hard_hit_pct",
    "avg_exit_velocity",
    "xslg",

    "opposing_pitcher",
    "pitcher_era",
    "pitcher_whip",
    "pitcher_hits_allowed",
    "pitcher_walks",

    "weather",
    "wind",

    "hits_score",
    "confidence",
    "tier"
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
    board.slice(0, 25).map(row => ({
      rank: row.rank,
      name: row.name,
      team: row.team,
      game: row.game,
      lineup: row.lineup_spot,
      avg: row.avg,
      k: row.strikeout_rate,
      hitRate: row.hit_rate,
      pitcher: row.opposing_pitcher,
      score: row.hits_score,
      confidence: row.confidence,
      tier: row.tier
    }))
  );
}

main();