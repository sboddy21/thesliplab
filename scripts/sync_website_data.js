import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EXPORTS_DIR = path.join(ROOT, "exports");
const CONTENT_DIR = path.join(EXPORTS_DIR, "content_engine");
const WEBSITE_DATA_DIR = path.join(ROOT, "website", "data");

const TODAY = process.env.SLATE_DATE || new Date().toISOString().slice(0, 10);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function copyFile(source, target, required = true) {
  if (!exists(source)) {
    const label = required ? "MISSING REQUIRED" : "SKIPPED OPTIONAL";
    console.log(`${label}: ${path.relative(ROOT, source)}`);
    return false;
  }

  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  console.log(`COPIED: ${path.relative(ROOT, source)} -> ${path.relative(ROOT, target)}`);
  return true;
}

function readJsonSafe(file, fallback) {
  try {
    if (!exists(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function countJsonRows(file) {
  const value = readJsonSafe(file, []);
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value.rows)) return value.rows.length;
  if (Array.isArray(value.data)) return value.data.length;
  if (Array.isArray(value.plays)) return value.plays.length;
  if (Array.isArray(value.stacks)) return value.stacks.length;
  return Object.keys(value || {}).length;
}

function countCsvRows(file) {
  if (!exists(file)) return 0;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  return Math.max(0, lines.length - 1);
}

ensureDir(WEBSITE_DATA_DIR);

const requiredCopies = [
  [path.join(CONTENT_DIR, "top_hr_plays.json"), path.join(WEBSITE_DATA_DIR, "top_hr_plays.json")],
  [path.join(CONTENT_DIR, "value_hr_plays.json"), path.join(WEBSITE_DATA_DIR, "value_hr_plays.json")],
  [path.join(CONTENT_DIR, "top_hr_stacks.json"), path.join(WEBSITE_DATA_DIR, "top_hr_stacks.json")],
  [path.join(CONTENT_DIR, "tracking_summary.json"), path.join(WEBSITE_DATA_DIR, "tracking_summary.json")],
  [path.join(DATA_DIR, "weather.json"), path.join(WEBSITE_DATA_DIR, "weather.json")],
  [path.join(DATA_DIR, "live_slate_status.json"), path.join(WEBSITE_DATA_DIR, "live_slate_status.json")],
  [path.join(DATA_DIR, "consensus_engine.json"), path.join(WEBSITE_DATA_DIR, "consensus_engine.json")],
  [path.join(DATA_DIR, "simulation_engine.json"), path.join(WEBSITE_DATA_DIR, "simulation_engine.json")],
  [path.join(DATA_DIR, "same_game_hr_parlays.json"), path.join(WEBSITE_DATA_DIR, "same_game_hr_parlays.json")],
  [path.join(DATA_DIR, "hr_results.json"), path.join(WEBSITE_DATA_DIR, "hr_results.json")]
];

const optionalCopies = [
  [path.join(DATA_DIR, "player_stats.csv"), path.join(WEBSITE_DATA_DIR, "player_stats.csv")],
  [path.join(DATA_DIR, "pitcher_stats.csv"), path.join(WEBSITE_DATA_DIR, "pitcher_stats.csv")],
  [path.join(DATA_DIR, "weather.csv"), path.join(WEBSITE_DATA_DIR, "weather.csv")],
  [path.join(DATA_DIR, "consensus_engine.csv"), path.join(WEBSITE_DATA_DIR, "consensus_engine.csv")],
  [path.join(DATA_DIR, "same_game_hr_parlays.csv"), path.join(WEBSITE_DATA_DIR, "same_game_hr_parlays.csv")],
  [path.join(DATA_DIR, "hr_results.csv"), path.join(WEBSITE_DATA_DIR, "hr_results.csv")],
  [path.join(DATA_DIR, "backtesting_engine.json"), path.join(WEBSITE_DATA_DIR, "backtesting_engine.json")],
  [path.join(DATA_DIR, "backtesting_engine.csv"), path.join(WEBSITE_DATA_DIR, "backtesting_engine.csv")]
];

console.log("");
console.log("THE SLIP LAB WEBSITE DATA SYNC");
console.log(`Date: ${TODAY}`);
console.log("");

let missingRequired = 0;
let copiedRequired = 0;
let copiedOptional = 0;

for (const [source, target] of requiredCopies) {
  if (copyFile(source, target, true)) copiedRequired += 1;
  else missingRequired += 1;
}

for (const [source, target] of optionalCopies) {
  if (copyFile(source, target, false)) copiedOptional += 1;
}

const manifest = {
  slate_date: TODAY,
  updated_at: new Date().toISOString(),
  source: "github_actions_live_pipeline",
  copied_required_files: copiedRequired,
  copied_optional_files: copiedOptional,
  missing_required_files: missingRequired,
  counts: {
    top_hr_plays: countJsonRows(path.join(WEBSITE_DATA_DIR, "top_hr_plays.json")),
    value_hr_plays: countJsonRows(path.join(WEBSITE_DATA_DIR, "value_hr_plays.json")),
    top_hr_stacks: countJsonRows(path.join(WEBSITE_DATA_DIR, "top_hr_stacks.json")),
    weather_rows: countJsonRows(path.join(WEBSITE_DATA_DIR, "weather.json")),
    consensus_rows: countJsonRows(path.join(WEBSITE_DATA_DIR, "consensus_engine.json")),
    same_game_hr_parlays: countJsonRows(path.join(WEBSITE_DATA_DIR, "same_game_hr_parlays.json")),
    player_stats_rows: countCsvRows(path.join(WEBSITE_DATA_DIR, "player_stats.csv")),
    pitcher_stats_rows: countCsvRows(path.join(WEBSITE_DATA_DIR, "pitcher_stats.csv"))
  }
};

writeJson(path.join(WEBSITE_DATA_DIR, "site_last_updated.json"), manifest);
writeJson(path.join(WEBSITE_DATA_DIR, "manifest.json"), manifest);

console.log("");
console.log("WEBSITE DATA SYNC COMPLETE");
console.log(`Required copied: ${copiedRequired}`);
console.log(`Optional copied: ${copiedOptional}`);
console.log(`Missing required: ${missingRequired}`);
console.log(`Manifest: ${path.relative(ROOT, path.join(WEBSITE_DATA_DIR, "manifest.json"))}`);
console.table(manifest.counts);

if (missingRequired > 0) {
  console.log("");
  console.log("SYNC FAILED BECAUSE REQUIRED WEBSITE FILES WERE MISSING");
  process.exit(1);
}

console.log("");
