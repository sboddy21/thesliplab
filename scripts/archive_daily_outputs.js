import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EXPORT_DIR = path.join(ROOT, "exports");

const now = new Date();
const month = now.getMonth() + 1;
const day = now.getDate();

const FOLDER_NAME = `MLB${month}${day}`;

const DAILY_ROOT = path.join(ROOT, "daily");
const DAILY_DIR = path.join(DAILY_ROOT, FOLDER_NAME);

const DAILY_DATA = path.join(DAILY_DIR, "data");
const DAILY_EXPORTS = path.join(DAILY_DIR, "exports");
const DAILY_CONTENT = path.join(DAILY_DIR, "content_engine");
const DAILY_FINAL_BOARDS = path.join(DAILY_DIR, "final_hr_boards");

const DATA_FILES = [
  "player_stats.csv",
  "master_hr_model.csv",
  "weather.csv",
  "live_slate_status.csv",
  "matchup_intelligence.csv",
  "player_handedness.csv",
  "pitcher_splits_engine.csv",
  "per_pitch_matchup_engine.csv",
  "weather_environment_engine.csv",
  "consensus_engine.csv",
  "correlation_engine.csv",
  "hr_stack_builder.csv",
  "same_game_hr_parlays.csv",
  "simulation_engine.csv",
  "simulated_hr_stacks.csv",
  "hr_results.csv",
  "backtesting_engine.csv",
  "stack_backtesting_engine.csv"
];

const EXPORT_FILES = [
  "simulation_report.txt",
  "same_game_hr_parlays.txt",
  "phase9_backtesting_report.txt"
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(src, dest) {
  if (!fs.existsSync(src)) return false;

  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function copyDirSafe(src, dest) {
  if (!fs.existsSync(src)) return 0;

  ensureDir(dest);

  let copied = 0;

  for (const item of fs.readdirSync(src)) {
    const from = path.join(src, item);
    const to = path.join(dest, item);
    const stat = fs.statSync(from);

    if (stat.isDirectory()) {
      copied += copyDirSafe(from, to);
    } else {
      fs.copyFileSync(from, to);
      copied++;
    }
  }

  return copied;
}

ensureDir(DAILY_DIR);
ensureDir(DAILY_DATA);
ensureDir(DAILY_EXPORTS);
ensureDir(DAILY_CONTENT);
ensureDir(DAILY_FINAL_BOARDS);

let copiedData = 0;
let copiedExports = 0;
let copiedContent = 0;
let copiedBoards = 0;

for (const file of DATA_FILES) {
  const src = path.join(DATA_DIR, file);
  const dest = path.join(DAILY_DATA, file);

  if (copyFileSafe(src, dest)) copiedData++;
}

for (const file of EXPORT_FILES) {
  const src = path.join(EXPORT_DIR, file);
  const dest = path.join(DAILY_EXPORTS, file);

  if (copyFileSafe(src, dest)) copiedExports++;
}

copiedContent += copyDirSafe(
  path.join(EXPORT_DIR, "content_engine"),
  DAILY_CONTENT
);

copiedBoards += copyDirSafe(
  path.join(EXPORT_DIR, "final_hr_boards"),
  DAILY_FINAL_BOARDS
);

const summary = [
  "THE SLIP LAB DAILY ARCHIVE",
  "",
  `Folder: ${FOLDER_NAME}`,
  `Created: ${new Date().toISOString()}`,
  "",
  `Data files copied: ${copiedData}`,
  `Export files copied: ${copiedExports}`,
  `Content files copied: ${copiedContent}`,
  `Final board files copied: ${copiedBoards}`,
  "",
  "Folder structure:",
  "",
  `${FOLDER_NAME}/data`,
  `${FOLDER_NAME}/exports`,
  `${FOLDER_NAME}/content_engine`,
  `${FOLDER_NAME}/final_hr_boards`,
  ""
].join("\n");

fs.writeFileSync(path.join(DAILY_DIR, "README.txt"), summary);

console.log("");
console.log("THE SLIP LAB DAILY ARCHIVE COMPLETE");
console.log("Saved folder:", DAILY_DIR);
console.log("Data files copied:", copiedData);
console.log("Export files copied:", copiedExports);
console.log("Content files copied:", copiedContent);
console.log("Final board files copied:", copiedBoards);
console.log("");
