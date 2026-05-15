import path from "path";
import fs from "fs";
import {
  EXPORT_DIR,
  ensureDir,
  readCSV,
  writeCSV,
  num
} from "./normalize_utils.js";

ensureDir(EXPORT_DIR);

const INPUT = path.join(EXPORT_DIR, "hr_model.csv");
const CSV_OUT = path.join(EXPORT_DIR, "hr_board.csv");
const JSON_OUT = path.join(EXPORT_DIR, "hr_board.json");
const TXT_OUT = path.join(EXPORT_DIR, "hr_board.txt");

function oddsText(row) {
  const odds = String(row.odds || "").trim();
  if (!odds) return "";
  return odds.startsWith("-") ? odds : `+${odds}`;
}

function cleanTier(row) {
  return row.tier || "WATCH";
}

const rows = readCSV(INPUT)
  .filter(r => num(r.final_score || r.score) > 0)
  .sort((a, b) => num(b.final_score || b.score) - num(a.final_score || a.score))
  .map((r, i) => ({
    rank: i + 1,
    player: r.name,
    team: r.team,
    game: r.game,
    odds: oddsText(r),
    book: r.book || "",
    score: r.final_score || r.score,
    tier: cleanTier(r),
    trend: r.trend_label || r.trend || "",
    pitcher: r.pitcher || "",
    pitcher_attack: r.pitcher_attack_tag || "",
    park: r.ballpark || r.park || "",
    park_label: r.park_label || "",
    weather: r.weather_desc || "",
    trusted_books: r.trusted_books || "",
    odds_quality: r.odds_quality || ""
  }));

writeCSV(CSV_OUT, rows);
fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2), "utf8");

const lines = rows.slice(0, 30).map(r => {
  return `${r.rank}. ${r.player} | ${r.team} | ${r.tier} | Score ${r.score} | ${r.odds} ${r.book} | ${r.game}`;
});

fs.writeFileSync(TXT_OUT, lines.join("\n") + "\n", "utf8");

console.log("Done.");
console.log(`Rows exported: ${rows.length}`);
console.log(`CSV: ${CSV_OUT}`);
console.log(`JSON: ${JSON_OUT}`);
console.log(`TXT: ${TXT_OUT}`);
console.table(rows.slice(0, 20));