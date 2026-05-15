import fs from "fs";
import path from "path";

const SITE = process.cwd();
const PROJECT = path.resolve(SITE, "..");
const OUT = path.join(SITE, "data", "power_zones.json");

function read(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function splitCSV(line) {
  const out = [];
  let cur = "";
  let quote = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];

    if (c === '"' && n === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      quote = !quote;
    } else if (c === "," && !quote) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const headers = splitCSV(lines[0]).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = splitCSV(line);
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] ?? "");
    return row;
  });
}

function rowsFrom(file) {
  if (!fs.existsSync(file)) return [];

  if (file.endsWith(".json")) {
    try {
      const raw = JSON.parse(read(file));
      return Array.isArray(raw) ? raw : raw.rows || raw.players || raw.data || raw.plays || raw.games || [];
    } catch {
      return [];
    }
  }

  if (file.endsWith(".csv")) return parseCSV(read(file));

  return [];
}

function clean(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function numberValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(String(value).replace("%", "").replace("+", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function number(row, keys, fallback = null) {
  return numberValue(pick(row, keys), fallback);
}

function nameOf(row) {
  return pick(row, ["name", "player", "batter", "hitter", "player_name", "Player", "Name"]);
}

function teamOf(row) {
  return pick(row, ["team", "Team", "player_team", "team_abbr", "abbr"]);
}

function playerKey(row) {
  return clean(nameOf(row)) + "|" + clean(teamOf(row));
}

function nameKey(row) {
  return clean(nameOf(row));
}

function mergePreferGood(base, extra) {
  const out = { ...base };

  for (const [key, value] of Object.entries(extra || {})) {
    if (value === undefined || value === null || value === "") continue;

    const current = out[key];
    const currentBad =
      current === undefined ||
      current === null ||
      current === "" ||
      current === "N/A" ||
      current === 0 ||
      current === "0" ||
      current === "0.000" ||
      current === "null";

    if (currentBad) out[key] = value;
  }

  return out;
}

const sourcePaths = [
  path.join(PROJECT, "data", "master_hr_model.csv"),
  path.join(PROJECT, "data", "master_hr_model.json"),
  path.join(PROJECT, "data", "player_stats.csv"),
  path.join(PROJECT, "data", "advanced_hitter_stats.csv"),
  path.join(PROJECT, "data", "consensus_engine.csv"),
  path.join(PROJECT, "data", "pitch_type_matchups.csv"),
  path.join(PROJECT, "data", "per_pitch_matchup_engine.csv"),
  path.join(PROJECT, "data", "pitcher_stats.csv"),
  path.join(PROJECT, "data", "weather.csv"),
  path.join(PROJECT, "exports", "hr_board.csv"),
  path.join(PROJECT, "exports", "hr_board.json"),
  path.join(PROJECT, "exports", "early_hr_looks.csv"),
  path.join(PROJECT, "exports", "early_hr_looks.json"),
  path.join(SITE, "data", "top_hr_plays.json"),
  path.join(SITE, "data", "value_hr_plays.json"),
  path.join(SITE, "data", "slate_intelligence.json"),
  path.join(SITE, "data", "weather_page.json")
];

const rows = [];

for (const file of sourcePaths) {
  const loaded = rowsFrom(file);
  if (loaded.length) {
    console.log("Loaded", loaded.length, "from", file);
    loaded.forEach(row => rows.push({ ...row, __source: file }));
  }
}

const byFull = new Map();
const byName = new Map();

for (const row of rows) {
  if (!nameOf(row)) continue;

  const fullKey = playerKey(row);
  const nKey = nameKey(row);

  if (fullKey && fullKey !== "|") {
    byFull.set(fullKey, mergePreferGood(byFull.get(fullKey) || {}, row));
  }

  if (nKey) {
    byName.set(nKey, mergePreferGood(byName.get(nKey) || {}, row));
  }
}

const primaryRows = rows.filter(row => {
  const src = row.__source || "";
  return (
    src.includes("master_hr_model") ||
    src.includes("hr_board") ||
    src.includes("top_hr_plays") ||
    src.includes("slate_intelligence")
  ) && nameOf(row);
});

const seen = new Set();

let players = primaryRows.map(row => {
  const fullKey = playerKey(row);
  const nKey = nameKey(row);
  if (seen.has(fullKey || nKey)) return null;
  seen.add(fullKey || nKey);

  let merged = { ...row };

  if (byFull.has(fullKey)) merged = mergePreferGood(merged, byFull.get(fullKey));
  if (byName.has(nKey)) merged = mergePreferGood(merged, byName.get(nKey));

  const score = number(merged, [
    "player_final_score",
    "composite_score",
    "final_score",
    "model_score",
    "hr_score",
    "score",
    "Score",
    "consensus_score",
    "power_score",
    "rating"
  ], 50);

  const rawTier = String(pick(merged, ["tier", "label", "grade", "bucket", "tag"])).toUpperCase();

  return {
    player: nameOf(merged),
    team: teamOf(merged),
    pitcher: pick(merged, ["pitcher", "Pitcher", "opposing_pitcher", "probable_pitcher", "starter"]),
    pitcher_hand: pick(merged, ["pitcher_hand", "p_hand", "throws", "pitcher_throws", "starter_hand"]),
    era: pick(merged, ["pitcher_era", "era", "starter_era", "opposing_pitcher_era"]),
    game: pick(merged, ["game", "Game", "matchup", "game_label"]),
    venue: pick(merged, ["venue", "park", "ballpark", "stadium"]),
    lineup: pick(merged, ["lineup_spot", "lineup", "batting_order"]),
    handedness: pick(merged, ["handedness", "bats", "batter_hand"]),
    odds: pick(merged, ["best_hr_odds", "odds", "best_odds", "hr_odds", "price"]),
    book: pick(merged, ["best_book", "book"]),
    score,
    zone: pick(merged, ["zone", "best_zone", "hot_zone"]) || Math.max(5, Math.min(9, Math.round(score / 10))) + " zone",
    raw_tier: rawTier,
    hr: number(merged, ["home_runs", "hr", "HR", "season_hr", "hr_2026", "hitter_hr", "l10_hr", "l15_hr", "l5_hr"], null),
    iso: number(merged, ["iso", "ISO", "player_iso", "season_iso", "hitter_iso", "iso_2026"], null),
    slg: number(merged, ["slg", "SLG", "player_slg", "season_slg", "hitter_slg", "slg_2026"], null),
    xslg: number(merged, ["xslg", "xSLG"], null),
    barrel_pct: number(merged, ["barrel_pct", "barrel_rate", "barrel_percent", "barrel", "barrelPct"], null),
    hard_hit_pct: number(merged, ["hard_hit_pct", "hard_hit_rate", "hardhit_pct", "hard_hit", "hardHitPct"], null),
    avg_ev: number(merged, ["avg_ev", "avg_exit_velocity", "average_exit_velocity"], null),
    xwoba: number(merged, ["xwoba", "xwOBA", "expected_woba"], null),
    ev: number(merged, ["ev", "edge", "expected_value", "model_edge"], null),
    weather_label: pick(merged, ["weather_label", "weather", "environment"]),
    wind_text: pick(merged, ["wind_text", "weather_wind", "wind", "wind_label"]),
    park_factor: number(merged, ["park_factor", "hr_park_score", "parkScore", "park_score"], null),
    pitcher_attack_score: number(merged, ["pitcher_attack_score", "pitcher_attack", "pAtk"], null),
    pitch_type_score: number(merged, ["pitch_type_score"], null),
    trend_score: number(merged, ["trend_score", "trend"], null)
  };
}).filter(Boolean);

players = players.filter(p => p.player && p.team);

players.sort((a, b) => b.score - a.score);

players = players.map((p, index) => {
  const raw = String(p.raw_tier || "").toUpperCase();

  let grade = "VALUE";

  if (raw.includes("CORE") || raw.includes("ELITE") || raw.includes("SAFEST")) grade = "CORE";
  else if (raw.includes("DANGER") || raw.includes("FADE") || raw.includes("BAD")) grade = "DANGER";
  else if (raw.includes("SLEEPER") || raw.includes("LOTTO") || raw.includes("LONG")) grade = "SLEEPER";
  else if (index < 12) grade = "CORE";
  else if (index < 30) grade = "VALUE";
  else if (index < 60) grade = "SLEEPER";
  else grade = "DANGER";

  return { ...p, grade };
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(players, null, 2));

console.log("");
console.log("POWER ZONES COMPLETE");
console.log("Players:", players.length);
console.log("Core:", players.filter(p => p.grade === "CORE").length);
console.log("Value:", players.filter(p => p.grade === "VALUE").length);
console.log("Sleeper:", players.filter(p => p.grade === "SLEEPER").length);
console.log("Danger:", players.filter(p => p.grade === "DANGER").length);
console.log("Saved:", OUT);

console.table(players.slice(0, 15).map(p => ({
  player: p.player,
  team: p.team,
  hr: p.hr,
  iso: p.iso,
  slg: p.slg,
  score: p.score,
  grade: p.grade
})));
