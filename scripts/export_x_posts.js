import path from "path";
import fs from "fs";
import {
  EXPORT_DIR,
  ensureDir,
  readCSV,
  num
} from "./normalize_utils.js";

ensureDir(EXPORT_DIR);

const INPUT = path.join(EXPORT_DIR, "hr_model.csv");
const OUT = path.join(EXPORT_DIR, "x_post.txt");
const TOP_OUT = path.join(EXPORT_DIR, "x_top_hr_board.txt");
const VALUE_OUT = path.join(EXPORT_DIR, "x_value_watch.txt");

function oddsText(row) {
  const odds = String(row.odds || "").trim();
  if (!odds) return "";
  return odds.startsWith("-") ? odds : `+${odds}`;
}

const rows = readCSV(INPUT)
  .filter(r => num(r.final_score || r.score) > 0)
  .sort((a, b) => num(b.final_score || b.score) - num(a.final_score || a.score));

const top = rows.slice(0, 5);
const value = rows
  .filter(r => num(r.odds) >= 350)
  .slice(0, 5);

const topPost = [
  "THE SLIP LAB HR BOARD",
  "",
  ...top.map((r, i) => `${i + 1}. ${r.name} ${oddsText(r)} ${r.book || ""}`),
  "",
  "Clean odds only. FanDuel, DraftKings, BetMGM, Fanatics and Caesars.",
  "No offshore junk. No fake boosted lines."
].join("\n");

const valuePost = [
  "HR VALUE WATCH",
  "",
  ...value.map((r, i) => `${i + 1}. ${r.name} ${oddsText(r)} ${r.book || ""} | Score ${r.final_score || r.score}`),
  "",
  "These are not lotto guesses. These are filtered from trusted books only."
].join("\n");

fs.writeFileSync(OUT, topPost + "\n\n" + valuePost + "\n", "utf8");
fs.writeFileSync(TOP_OUT, topPost + "\n", "utf8");
fs.writeFileSync(VALUE_OUT, valuePost + "\n", "utf8");

console.log("X POST EXPORT COMPLETE");
console.log(`Input: ${INPUT}`);
console.log(`Rows: ${rows.length}`);
console.log(`Saved: ${OUT}`);
console.log(`Saved: ${TOP_OUT}`);
console.log(`Saved: ${VALUE_OUT}`);