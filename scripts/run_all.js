import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const DATA_DIR = path.join(ROOT, "data");
const EXPORTS_DIR = path.join(ROOT, "exports");
const WEBSITE_DATA_DIR = path.join(ROOT, "website", "data");

const TODAY = process.env.SLATE_DATE || new Date().toISOString().slice(0, 10);

const PIPELINE = [
  // Fresh source layer. These must run before any model, merge, stack, or website export step.
  "sgo_lines.js",
  "best_lines.js",
  "clean_hr_odds.js",
  "odds_to_ev.js",
  "pitcher_stats.js",
  "player_stats.js",
  "game_logs.js",
  "merge_trends.js",
  "weather_boost.js",
  "merge_vegas_totals.js",
  "filter_live_slate.js",

  // Model layer.
  "merge_pitcher_attack.js",
  "merge_park_factors.js",
  "build_matchup_intelligence.js",
  "build_player_handedness.js",
  "build_pitcher_splits_engine.js",
  "build_per_pitch_matchup_engine.js",
  "build_weather_environment_engine.js",
  "build_consensus_engine.js",

  // Correlation, stacks, simulations, tracking.
  "build_correlation_engine.js",
  "build_hr_stack_builder.js",
  "build_same_game_hr_parlays.js",
  "build_simulation_engine.js",
  "build_hr_results.js",
  "build_backtesting_engine.js",

  // Website and content layer.
  "build_content_automation_engine.js",
  "export_final_hr_decision_boards.js",
  "sync_website_data.js",
  "archive_daily_outputs.js"
];

function line() {
  console.log("\n============================================================\n");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function removeIfExists(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function prepFreshRun() {
  ensureDir(DATA_DIR);
  ensureDir(EXPORTS_DIR);
  ensureDir(WEBSITE_DATA_DIR);

  // Do not let yesterday's public website files survive a failed or partial run.
  removeIfExists(path.join(EXPORTS_DIR, "content_engine"));
  removeIfExists(WEBSITE_DATA_DIR);
  ensureDir(WEBSITE_DATA_DIR);

  const stamp = {
    slate_date: TODAY,
    started_at: new Date().toISOString(),
    source: "github_actions_live_pipeline",
    note: "Website data is cleared before each run so stale cards cannot carry forward."
  };

  fs.writeFileSync(
    path.join(WEBSITE_DATA_DIR, "site_last_updated.json"),
    JSON.stringify(stamp, null, 2)
  );
}

function runScript(script) {
  const file = path.join(SCRIPTS_DIR, script);

  if (!fs.existsSync(file)) {
    console.log(`SKIPPED: ${script} not found`);
    return true;
  }

  line();
  console.log(`RUNNING: ${script}`);
  line();

  const result = spawnSync("node", [file], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      SLATE_DATE: TODAY,
      MLB_SEASON: process.env.MLB_SEASON || new Date().getFullYear().toString()
    }
  });

  if (result.status !== 0) {
    console.log("");
    console.log(`FAILED: ${script}`);
    console.log(`Exit code: ${result.status}`);
    return false;
  }

  console.log("");
  console.log(`DONE: ${script}`);
  return true;
}

console.log("");
console.log("THE SLIP LAB LIVE MLB PIPELINE");
console.log(`Slate date: ${TODAY}`);
console.log("Fresh source scripts run first. Website data is wiped before rebuild.");
console.log("");

prepFreshRun();

let failed = false;

for (const script of PIPELINE) {
  const ok = runScript(script);

  if (!ok) {
    failed = true;
    break;
  }
}

line();

if (failed) {
  console.log("PIPELINE STOPPED BECAUSE A SCRIPT FAILED");
  process.exit(1);
}

console.log("THE SLIP LAB LIVE PIPELINE COMPLETE");
console.log("");
console.log("Fresh source outputs:");
console.log("data/sgo_best_lines.csv");
console.log("data/best_lines.csv");
console.log("data/hr_odds_clean.csv");
console.log("data/player_stats.csv");
console.log("data/pitcher_stats.csv");
console.log("data/weather.csv");
console.log("");
console.log("Core model outputs:");
console.log("data/consensus_engine.csv");
console.log("data/correlation_engine.csv");
console.log("data/hr_stack_builder.csv");
console.log("data/same_game_hr_parlays.csv");
console.log("");
console.log("Website outputs:");
console.log("website/data/top_hr_plays.json");
console.log("website/data/value_hr_plays.json");
console.log("website/data/top_hr_stacks.json");
console.log("website/data/site_last_updated.json");
console.log("");
