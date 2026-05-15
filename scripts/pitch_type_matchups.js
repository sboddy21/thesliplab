import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const CACHE_DIR = path.join(DATA_DIR, "statcast_pitch_cache");

const OUT_CSV = path.join(DATA_DIR, "pitch_type_matchups.csv");
const OUT_JSON = path.join(DATA_DIR, "pitch_type_matchups.json");

const PLAYER_STATS_FILE = path.join(DATA_DIR, "player_stats.csv");

const LOOKBACK_DAYS = Number(process.env.PITCH_TYPE_LOOKBACK_DAYS || 21);
const MIN_HITTER_PITCHES = Number(process.env.PITCH_TYPE_MIN_HITTER_PITCHES || 5);
const MIN_PITCHER_PITCHES = Number(process.env.PITCH_TYPE_MIN_PITCHER_PITCHES || 8);

const TODAY = new Date();
const START_DATE = new Date(TODAY);
START_DATE.setDate(START_DATE.getDate() - LOOKBACK_DAYS);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function flipLastFirstName(value = "") {
  const text = String(value || "").trim();

  if (!text.includes(",")) return text;

  const parts = text.split(",").map(v => v.trim()).filter(Boolean);

  if (parts.length < 2) return text;

  return `${parts.slice(1).join(" ")} ${parts[0]}`.trim();
}

function normalizeName(value = "") {
  const flipped = flipLastFirstName(value);

  return String(flipped)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\bjunior\b/g, "jr")
    .replace(/\bsenior\b/g, "sr")
    .replace(/\bjr\b/g, "")
    .replace(/\bsr\b/g, "")
    .replace(/\biii\b/g, "")
    .replace(/\bii\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

  const headers = Object.keys(rows[0]);

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
  const n = Number(String(value ?? "").replace("%", "").replace("+", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateChunks(startDate, endDate, chunkDays = 7) {
  const chunks = [];
  let start = new Date(startDate);

  while (start <= endDate) {
    let end = addDays(start, chunkDays - 1);
    if (end > endDate) end = new Date(endDate);

    chunks.push({
      start: ymd(start),
      end: ymd(end)
    });

    start = addDays(end, 1);
  }

  return chunks;
}

function statcastUrl(startDate, endDate, playerType) {
  const params = new URLSearchParams({
    all: "true",
    hfPT: "",
    hfAB: "",
    hfBBT: "",
    hfPR: "",
    hfZ: "",
    stadium: "",
    hfBBL: "",
    hfNewZones: "",
    hfGT: "R|",
    hfC: "",
    hfSea: "",
    hfSit: "",
    player_type: playerType,
    hfOuts: "",
    opponent: "",
    pitch_pfx: "",
    hfRO: "",
    home_road: "",
    hfFlag: "",
    hfPull: "",
    metric_1: "",
    hfInn: "",
    min_pitches: "0",
    min_results: "0",
    group_by: "name",
    sort_col: "pitches",
    player_event_sort: "api_p_release_speed",
    sort_order: "desc",
    min_pas: "0",
    type: "details"
  });

  params.set("game_date_gt", startDate);
  params.set("game_date_lt", endDate);

  return `https://baseballsavant.mlb.com/statcast_search/csv?${params.toString()}`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 TheSlipLab/1.0"
    }
  });

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status}: ${url}`);
  }

  return res.text();
}

function isBattedBall(row) {
  return Boolean(getField(row, ["bb_type"])) || String(getField(row, ["description"])).toLowerCase() === "hit_into_play";
}

function isHardHit(row) {
  return num(getField(row, ["launch_speed"]), 0) >= 95;
}

function isBarrel(row) {
  return String(getField(row, ["launch_speed_angle"])) === "6";
}

function isFlyBall(row) {
  const bb = String(getField(row, ["bb_type"])).toLowerCase();
  return bb === "fly_ball" || bb === "line_drive";
}

function isHomeRun(row) {
  return String(getField(row, ["events"])).toLowerCase() === "home_run";
}

function getPitchType(row) {
  return getField(row, ["pitch_name", "pitch_type"]) || "Unknown";
}

function initStat() {
  return {
    pitches: 0,
    batted_balls: 0,
    hard_hits: 0,
    barrels: 0,
    flyballs: 0,
    home_runs: 0,
    total_ev: 0,
    ev_count: 0,
    total_xslg: 0,
    xslg_count: 0,
    total_woba: 0,
    woba_count: 0,
    whiffs: 0,
    swings: 0
  };
}

function addPitchToStat(stat, row) {
  stat.pitches++;

  const description = String(getField(row, ["description"])).toLowerCase();
  const launchSpeedRaw = getField(row, ["launch_speed"]);
  const estimatedWobaRaw = getField(row, ["estimated_woba_using_speedangle"]);
  const estimatedSlugRaw = getField(row, ["estimated_slg_using_speedangle"]);

  const swingDescriptions = new Set([
    "swinging_strike",
    "swinging_strike_blocked",
    "foul",
    "foul_tip",
    "foul_bunt",
    "hit_into_play"
  ]);

  if (swingDescriptions.has(description)) stat.swings++;
  if (description.includes("swinging_strike")) stat.whiffs++;

  if (isBattedBall(row)) {
    stat.batted_balls++;

    const launchSpeed = launchSpeedRaw === "" ? null : num(launchSpeedRaw, null);
    const estimatedWoba = estimatedWobaRaw === "" ? null : num(estimatedWobaRaw, null);
    const estimatedSlug = estimatedSlugRaw === "" ? null : num(estimatedSlugRaw, null);

    if (launchSpeed !== null) {
      stat.total_ev += launchSpeed;
      stat.ev_count++;
    }

    if (estimatedWoba !== null) {
      stat.total_woba += estimatedWoba;
      stat.woba_count++;
    }

    if (estimatedSlug !== null) {
      stat.total_xslg += estimatedSlug;
      stat.xslg_count++;
    }

    if (isHardHit(row)) stat.hard_hits++;
    if (isBarrel(row)) stat.barrels++;
    if (isFlyBall(row)) stat.flyballs++;
    if (isHomeRun(row)) stat.home_runs++;
  }
}

function finalizeStat(stat, totalPitches) {
  const bbe = Math.max(stat.batted_balls, 1);
  const swings = Math.max(stat.swings, 1);

  return {
    pitches: stat.pitches,
    batted_balls: stat.batted_balls,
    pitch_usage_pct: totalPitches ? (stat.pitches / totalPitches) * 100 : 0,
    avg_ev: stat.ev_count ? stat.total_ev / stat.ev_count : 0,
    xwoba: stat.woba_count ? stat.total_woba / stat.woba_count : 0,
    xslg: stat.xslg_count ? stat.total_xslg / stat.xslg_count : 0,
    hard_hit_pct: (stat.hard_hits / bbe) * 100,
    barrel_pct: (stat.barrels / bbe) * 100,
    flyball_pct: (stat.flyballs / bbe) * 100,
    hr_per_bbe_pct: (stat.home_runs / bbe) * 100,
    whiff_pct: (stat.whiffs / swings) * 100,
    home_runs: stat.home_runs
  };
}

function addRowToProfiles(profiles, row) {
  const rawName = getField(row, ["player_name"]);
  if (!rawName) return;

  const displayName = flipLastFirstName(rawName);
  const key = normalizeName(rawName);
  const pitch = getPitchType(row);

  if (!profiles.has(key)) {
    profiles.set(key, {
      name: displayName,
      totalPitches: 0,
      byPitch: new Map()
    });
  }

  const profile = profiles.get(key);
  profile.totalPitches++;

  if (!profile.byPitch.has(pitch)) {
    profile.byPitch.set(pitch, initStat());
  }

  addPitchToStat(profile.byPitch.get(pitch), row);
}

async function buildProfiles(playerType) {
  const profiles = new Map();
  const chunks = dateChunks(START_DATE, TODAY, 7);

  for (const chunk of chunks) {
    const cacheFile = path.join(CACHE_DIR, `${playerType}_${chunk.start}_${chunk.end}.csv`);
    let text = "";

    if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 100) {
      text = fs.readFileSync(cacheFile, "utf8");
      console.log(`Cache hit ${playerType}: ${chunk.start} to ${chunk.end}`);
    } else {
      console.log(`Fetching ${playerType}: ${chunk.start} to ${chunk.end}`);
      text = await fetchText(statcastUrl(chunk.start, chunk.end, playerType));
      fs.writeFileSync(cacheFile, text);
    }

    const rows = parseCsv(text);
    console.log(`${playerType} rows ${chunk.start} to ${chunk.end}:`, rows.length);

    for (const row of rows) {
      addRowToProfiles(profiles, row);
    }
  }

  const finalProfiles = new Map();

  for (const [key, profile] of profiles.entries()) {
    const pitchMap = new Map();

    for (const [pitch, stat] of profile.byPitch.entries()) {
      pitchMap.set(pitch, finalizeStat(stat, profile.totalPitches));
    }

    finalProfiles.set(key, {
      name: profile.name,
      totalPitches: profile.totalPitches,
      byPitch: pitchMap
    });
  }

  return finalProfiles;
}

function scoreHitterVsPitch(hitterStat) {
  if (!hitterStat || hitterStat.pitches < MIN_HITTER_PITCHES) return 50;

  const score =
    45 +
    hitterStat.xslg * 22 +
    hitterStat.xwoba * 18 +
    hitterStat.barrel_pct * 1.15 +
    hitterStat.hard_hit_pct * 0.32 +
    hitterStat.flyball_pct * 0.18 +
    hitterStat.hr_per_bbe_pct * 1.6 -
    hitterStat.whiff_pct * 0.18;

  return clamp(score, 0, 100);
}

function scorePitcherWeakness(pitcherStat) {
  if (!pitcherStat || pitcherStat.pitches < MIN_PITCHER_PITCHES) return 50;

  const score =
    40 +
    pitcherStat.xslg * 24 +
    pitcherStat.xwoba * 20 +
    pitcherStat.barrel_pct * 1.35 +
    pitcherStat.hard_hit_pct * 0.35 +
    pitcherStat.flyball_pct * 0.20 +
    pitcherStat.hr_per_bbe_pct * 1.8 -
    pitcherStat.whiff_pct * 0.15;

  return clamp(score, 0, 100);
}

function getPitcherNameFromRow(row) {
  return getField(row, [
    "pitcher",
    "probable_pitcher",
    "opposing_pitcher",
    "starter",
    "opp_pitcher"
  ]);
}

function buildPitchTypeMatchup(row, hitterStats, pitcherStats) {
  const hitterName = getField(row, ["name", "player", "batter", "player_name"]);
  const pitcherName = getPitcherNameFromRow(row);

  if (!hitterName || !pitcherName) return null;

  const hitterKey = normalizeName(hitterName);
  const pitcherKey = normalizeName(pitcherName);

  const hitter = hitterStats.get(hitterKey);
  const pitcher = pitcherStats.get(pitcherKey);

  const base = {
    name: hitterName,
    team: getField(row, ["team", "player_team"]),
    opponent: getField(row, ["opponent", "opp"]),
    pitcher: pitcherName
  };

  if (!hitter || !pitcher) {
    let reason = "Missing hitter or pitcher pitch type data";

    if (!hitter && pitcher) reason = "Missing hitter pitch type data";
    if (hitter && !pitcher) reason = "Missing pitcher pitch type data";

    return {
      ...base,
      pitch_type_score: "",
      pitch_type_grade: "NO DATA",
      primary_pitch_match: "",
      primary_pitch_usage_pct: "",
      primary_pitch_hitter_score: "",
      primary_pitch_pitcher_weakness: "",
      best_hitter_pitch: "",
      best_hitter_pitch_score: "",
      weakest_pitcher_pitch: "",
      weakest_pitcher_pitch_score: "",
      pitcher_primary_mix: "",
      hitter_pitch_sample: hitter?.totalPitches || "",
      pitcher_pitch_sample: pitcher?.totalPitches || "",
      matchup_note: reason
    };
  }

  const pitcherPitchTypes = [...pitcher.byPitch.entries()]
    .filter(([, stat]) => stat.pitches >= MIN_PITCHER_PITCHES)
    .sort((a, b) => b[1].pitch_usage_pct - a[1].pitch_usage_pct);

  const hitterPitchTypes = [...hitter.byPitch.entries()]
    .filter(([, stat]) => stat.pitches >= MIN_HITTER_PITCHES)
    .map(([pitch, stat]) => ({
      pitch,
      stat,
      hitterScore: scoreHitterVsPitch(stat)
    }))
    .sort((a, b) => b.hitterScore - a.hitterScore);

  const pitcherWeakness = [...pitcher.byPitch.entries()]
    .filter(([, stat]) => stat.pitches >= MIN_PITCHER_PITCHES)
    .map(([pitch, stat]) => ({
      pitch,
      stat,
      weaknessScore: scorePitcherWeakness(stat)
    }))
    .sort((a, b) => b.weaknessScore - a.weaknessScore);

  let weightedScore = 0;
  let totalWeight = 0;
  const matchedDetails = [];

  for (const [pitch, pStat] of pitcherPitchTypes.slice(0, 5)) {
    const hStat = hitter.byPitch.get(pitch);
    if (!hStat || hStat.pitches < MIN_HITTER_PITCHES) continue;

    const hitterScore = scoreHitterVsPitch(hStat);
    const pitcherScore = scorePitcherWeakness(pStat);
    const usageWeight = Math.max(pStat.pitch_usage_pct, 1);
    const combined = hitterScore * 0.55 + pitcherScore * 0.45;

    weightedScore += combined * usageWeight;
    totalWeight += usageWeight;

    matchedDetails.push({
      pitch,
      usage: pStat.pitch_usage_pct,
      hitterScore,
      pitcherScore,
      combined
    });
  }

  const finalScore = totalWeight ? weightedScore / totalWeight : 50;

  let grade = "NEUTRAL";
  if (finalScore >= 82) grade = "ELITE MATCHUP";
  else if (finalScore >= 72) grade = "STRONG";
  else if (finalScore >= 62) grade = "LIVE";
  else if (finalScore <= 40) grade = "AVOID";

  const primaryMatch = matchedDetails.sort((a, b) => b.combined - a.combined)[0];
  const bestHitterPitch = hitterPitchTypes[0];
  const weakestPitcherPitch = pitcherWeakness[0];

  const pitcherMix = pitcherPitchTypes
    .slice(0, 4)
    .map(([pitch, stat]) => `${pitch} ${stat.pitch_usage_pct.toFixed(1)}%`)
    .join(" | ");

  const noteParts = [];

  if (primaryMatch) noteParts.push(`${hitterName} profiles best against ${primaryMatch.pitch}`);
  if (weakestPitcherPitch) noteParts.push(`${pitcherName} grades weakest on ${weakestPitcherPitch.pitch}`);
  if (bestHitterPitch && weakestPitcherPitch && bestHitterPitch.pitch === weakestPitcherPitch.pitch) noteParts.push("Direct pitch type overlap");

  return {
    ...base,
    pitch_type_score: finalScore.toFixed(2),
    pitch_type_grade: grade,
    primary_pitch_match: primaryMatch?.pitch || "",
    primary_pitch_usage_pct: primaryMatch ? primaryMatch.usage.toFixed(1) : "",
    primary_pitch_hitter_score: primaryMatch ? primaryMatch.hitterScore.toFixed(1) : "",
    primary_pitch_pitcher_weakness: primaryMatch ? primaryMatch.pitcherScore.toFixed(1) : "",
    best_hitter_pitch: bestHitterPitch?.pitch || "",
    best_hitter_pitch_score: bestHitterPitch ? bestHitterPitch.hitterScore.toFixed(1) : "",
    weakest_pitcher_pitch: weakestPitcherPitch?.pitch || "",
    weakest_pitcher_pitch_score: weakestPitcherPitch ? weakestPitcherPitch.weaknessScore.toFixed(1) : "",
    pitcher_primary_mix: pitcherMix,
    hitter_pitch_sample: hitter.totalPitches,
    pitcher_pitch_sample: pitcher.totalPitches,
    matchup_note: noteParts.join(" | ")
  };
}

async function main() {
  ensureDir(DATA_DIR);
  ensureDir(CACHE_DIR);

  if (!fs.existsSync(PLAYER_STATS_FILE)) {
    console.error(`Missing ${PLAYER_STATS_FILE}`);
    console.error("Run player_stats.js first.");
    process.exit(1);
  }

  console.log("");
  console.log("THE SLIP LAB PITCH TYPE MATCHUPS");
  console.log("Lookback days:", LOOKBACK_DAYS);
  console.log("Start:", ymd(START_DATE));
  console.log("End:", ymd(TODAY));

  const boardRows = readCsvSafe(PLAYER_STATS_FILE);

  console.log("Player rows:", boardRows.length);

  const hitterStats = await buildProfiles("batter");
  const pitcherStats = await buildProfiles("pitcher");

  console.log("Hitter profiles:", hitterStats.size);
  console.log("Pitcher profiles:", pitcherStats.size);

  const output = [];

  for (const row of boardRows) {
    const matchup = buildPitchTypeMatchup(row, hitterStats, pitcherStats);
    if (matchup) output.push(matchup);
  }

  output.sort((a, b) => num(b.pitch_type_score, -1) - num(a.pitch_type_score, -1));

  fs.writeFileSync(OUT_CSV, toCsv(output));
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2));

  console.log("");
  console.log("PITCH TYPE MATCHUPS COMPLETE");
  console.log("Rows:", output.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);

  const preview = output.slice(0, 15).map(row => ({
    name: row.name,
    pitcher: row.pitcher,
    score: row.pitch_type_score,
    grade: row.pitch_type_grade,
    pitch: row.primary_pitch_match,
    note: row.matchup_note
  }));

  console.table(preview);
}

main().catch(err => {
  console.error("");
  console.error("PITCH TYPE MATCHUPS FAILED");
  console.error(err.message);
  process.exit(1);
});
