import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const HISTORY_DIR = path.join(ROOT, "history");

const today = new Date().toISOString().slice(0, 10);
const stamp = new Date().toISOString().replace(/[:.]/g, "_");

const OUT_DIR = path.join(HISTORY_DIR, today, stamp);

const COPY_TARGETS = [
  "data",
  "exports"
];

const ROOT_FILES = [
  "hr_board.csv",
  "hits_board.csv",
  "tb_board.csv",
  "hr_sweep_board_all_games.csv",
  "the_slip_lab_full_board.csv",
  "best_lines.csv",
  "weather.csv",
  "lineups.csv",
  "pitcher_stats.csv",
  "player_stats.csv"
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileSafe(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function copyDirSafe(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;

  let copied = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copied += copyDirSafe(src, dest);
    } else {
      copyFileSafe(src, dest);
      copied++;
    }
  }

  return copied;
}

ensureDir(OUT_DIR);

let copied = 0;

for (const folder of COPY_TARGETS) {
  copied += copyDirSafe(
    path.join(ROOT, folder),
    path.join(OUT_DIR, folder)
  );
}

for (const file of ROOT_FILES) {
  if (copyFileSafe(path.join(ROOT, file), path.join(OUT_DIR, file))) {
    copied++;
  }
}

const manifest = {
  archived_at: new Date().toISOString(),
  date: today,
  folder: OUT_DIR,
  copied_files: copied
};

fs.writeFileSync(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

console.log("DAILY HISTORY ARCHIVE COMPLETE");
console.log("Date:", today);
console.log("Files copied:", copied);
console.log("Saved:", OUT_DIR);
