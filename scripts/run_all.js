import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, "scripts");

const PIPELINE = [
  "weather_boost.js",
  "merge_vegas_totals.js",
  "filter_live_slate.js",

  "build_matchup_intelligence.js",
  "build_player_handedness.js",
  "build_pitcher_splits_engine.js",
  "build_per_pitch_matchup_engine.js",
  "build_weather_environment_engine.js",
  "build_consensus_engine.js",

  "build_correlation_engine.js",
  "build_hr_stack_builder.js",
  "build_same_game_hr_parlays.js",

  "build_simulation_engine.js",
  "build_hr_results.js",
  "build_backtesting_engine.js",
  "build_content_automation_engine.js",

  "export_final_hr_decision_boards.js",
  "archive_daily_outputs.js"
];

function line() {
  console.log("\n============================================================\n");
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
    env: process.env
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
console.log("THE SLIP LAB FULL PIPELINE");
console.log("Running model, simulation, tracking, and content automation");
console.log("");

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

console.log("THE SLIP LAB PIPELINE COMPLETE");
console.log("");
console.log("Core model outputs:");
console.log("data/consensus_engine.csv");
console.log("data/correlation_engine.csv");
console.log("data/hr_stack_builder.csv");
console.log("data/same_game_hr_parlays.csv");
console.log("");
console.log("Simulation outputs:");
console.log("data/simulation_engine.csv");
console.log("data/simulated_hr_stacks.csv");
console.log("exports/simulation_report.txt");
console.log("");
console.log("Tracking outputs:");
console.log("data/hr_results.csv");
console.log("data/backtesting_engine.csv");
console.log("data/tracking/phase9_hr_tracking.csv");
console.log("exports/phase9_backtesting_report.txt");
console.log("");
console.log("Content outputs:");
console.log("exports/content_engine/top_hr_plays.json");
console.log("exports/content_engine/value_hr_plays.json");
console.log("exports/content_engine/top_hr_stacks.json");
console.log("exports/content_engine/x_posts.txt");
console.log("exports/content_engine/daily_slate_report.txt");
console.log("");
