import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SLATE_JS = path.join(ROOT, "website", "slate.js");

let js = fs.readFileSync(SLATE_JS, "utf8");

js = js.replace(
  /const DATA_URLS = \[[\s\S]*?\];/,
  `const DATA_URLS = [
  "./data/slate_intelligence.json"
];`
);

js = js.replace(
  /hand: clean\(row\.pitcher_hand \|\| row\.hand \|\| row\.p_throws \|\| row\.pitcher_throws \|\| ""\),/g,
  `hand: clean(row.pitcher_hand || row.hand || row.p_throws || row.pitcher_throws || ""),`
);

js = js.replace(
  /era: clean\(row\.pitcher_era \|\| row\.era \|\| row\.season_era \|\| ""\),/g,
  `era: clean(row.pitcher_era || row.era || row.season_era || ""),`
);

fs.writeFileSync(SLATE_JS, js);

console.log("Slate display fields fixed.");
