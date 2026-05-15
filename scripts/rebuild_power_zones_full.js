import fs from "fs";
import path from "path";

const SITE = process.cwd();
const PROJECT = path.resolve(SITE, "..");
const OUT = path.join(SITE, "data", "power_zones.json");

function exists(file) {
  return fs.existsSync(file);
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
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

  const headers = splitCSV(lines[0]).map(x => x.trim());
  return lines.slice(1).map(line => {
    const values = splitCSV(line);
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] ?? "");
    return row;
  });
}

function rowsFrom(file) {
  if (!exists(file)) return [];

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

function key(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row, names) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function number(row, names, fallback = null) {
  const value = pick(row, names);
  if (value === "") return fallback;

  const n = Number(String(value).replace("%", "").replace("+", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function mergeRow(target, row) {
  for (const [k, v] of Object.entries(row || {})) {
    if (v === undefined || v === null || v === "") continue;

    const current = target[k];
    const missing =
      current === undefined ||
      current === null ||
      current === "" ||
      current === 0 ||
      current === "0" ||
      current === "0.000";

    if (missing) target[k] = v;
  }

  return target;
}

const sourcePaths = [
  path.join(SITE, "data", "top_hr_plays.json"),
  path.join(SITE, "data", "value_hr_plays.json"),
  path.join(SITE, "data", "slate_intelligence.json"),
  path.join(SITE, "data", "weather_page.json"),

  path.join(PROJECT, "data", "master_hr_model.csv"),
  path.join(PROJECT, "data", "master_hr_model.json"),
  path.join(PROJECT, "data", "consensus_engine.csv"),
  path.join(PROJECT, "data", "consensus_engine.json"),
  path.join(PROJECT, "data", "player_stats.csv"),
  path.join(PROJECT, "data", "player_stats.json"),
  path.join(PROJECT, "data", "advanced_hitter_stats.csv"),
  path.join(PROJECT, "data", "advanced_hitter_stats.json"),
  path.join(PROJECT, "data", "pitch_type_matchups.csv"),
  path.join(PROJECT, "data", "per_pitch_matchup_engine.csv"),
  path.join(PROJECT, "data", "pitcher_stats.csv"),
  path.join(PROJECT, "data", "weather.csv"),
  path.join(PROJECT, "exports", "early_hr_looks.csv"),
  path.join(PROJECT, "exports", "early_hr_looks.json"),
  path.join(PROJECT, "exports", "hr_board.csv"),
  path.join(PROJECT, "exports", "hr_board.json"),
  path.join(PROJECT, "hr_sweep_board_all_games.csv"),
  path.join(PROJECT, "hr_board.csv")
];

const allRows = [];
for (const file of sourcePaths) {
  const rows = rowsFrom(file);
  if (rows.length) {
    console.log("Loaded", rows.length, "from", file);
    allRows.push(...rows);
  }
}

const byPlayer = new Map();

for (const row of allRows) {
  const name = pick(row, [
    "player",
    "name",
    "batter",
    "hitter",
    "player_name",
    "Player",
    "Name"
  ]);

  if (!name) continue;

  const id = key(name);
  const current = byPlayer.get(id) || {};
  current.player = current.player || name;
  mergeRow(current, row);
  byPlayer.set(id, current);
}

let players = [...byPlayer.values()].map(row => {
  const score = number(row, [
    "score",
    "Score",
    "final_score",
    "hr_score",
    "model_score",
    "consensus_score",
    "power_score",
    "rating"
  ], 50);

  return {
    player: pick(row, ["player", "name", "batter", "hitter", "player_name", "Player", "Name"]),
    team: pick(row, ["team", "Team", "player_team", "team_abbr", "abbr"]),
    pitcher: pick(row, ["pitcher", "Pitcher", "opposing_pitcher", "probable_pitcher", "starter"]),
    pitcher_hand: pick(row, ["pitcher_hand", "p_hand", "throws", "pitcher_throws", "starter_hand"]),
    era: pick(row, ["era", "pitcher_era", "starter_era", "opposing_pitcher_era"]),
    game: pick(row, ["game", "Game", "matchup", "game_label"]),
    venue: pick(row, ["venue", "park", "ballpark", "stadium"]),
    lineup: pick(row, ["lineup", "lineup_spot", "batting_order"]),
    handedness: pick(row, ["handedness", "bats", "batter_hand"]),
    odds: pick(row, ["odds", "best_odds", "hr_odds", "price"]),
    score,
    zone: pick(row, ["zone", "best_zone", "hot_zone"]) || Math.max(5, Math.min(9, Math.round(score / 10))) + " zone",
    raw_tier: pick(row, ["tier", "label", "grade", "bucket", "tag"]),
    hr: number(row, ["hr", "HR", "season_hr", "home_runs", "hr_2026", "hitter_hr"], null),
    iso: number(row, ["iso", "ISO", "player_iso", "season_iso", "hitter_iso", "iso_2026"], null),
    slg: number(row, ["slg", "SLG", "player_slg", "season_slg", "hitter_slg", "slg_2026"], null),
    barrel_pct: number(row, ["barrel_pct", "barrel_percent", "barrel", "barrel_rate", "barrelPct"], null),
    hard_hit_pct: number(row, ["hard_hit_pct", "hardhit_pct", "hard_hit", "hard_hit_rate", "hardHitPct"], null),
    xwoba: number(row, ["xwoba", "xwOBA", "expected_woba"], null),
    ev: number(row, ["ev", "edge", "expected_value", "model_edge"], null),
    weather_label: pick(row, ["weather_label", "weather", "environment"]),
    wind_text: pick(row, ["wind_text", "wind", "wind_label"])
  };
}).filter(p => p.player);

players.sort((a, b) => b.score - a.score);

players = players.map((p, index) => {
  const raw = String(p.raw_tier || "").toUpperCase();

  let grade = "VALUE";

  if (raw.includes("CORE") || raw.includes("ELITE") || raw.includes("SAFEST")) grade = "CORE";
  else if (raw.includes("DANGER") || raw.includes("FADE") || raw.includes("BAD")) grade = "DANGER";
  else if (raw.includes("SLEEPER") || raw.includes("LOTTO") || raw.includes("LONG")) grade = "SLEEPER";
  else if (index < 12) grade = "CORE";
  else if (index < 30) grade = "VALUE";
  else if (index < 48) grade = "SLEEPER";
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
