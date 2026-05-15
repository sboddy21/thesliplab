import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const PLAYER_FILE = path.join(DATA, "player_stats.csv");
const VEGAS_FILE = path.join(DATA, "vegas_totals.csv");

function splitCSV(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];

    if (c === '"' && q && n === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

function readCSV(file) {
  const raw = fs.readFileSync(file, "utf8").trim();
  const lines = raw.split(/\r?\n/);

  const headers = splitCSV(lines[0]);

  return lines.slice(1).map(line => {
    const vals = splitCSV(line);

    return Object.fromEntries(
      headers.map((h, i) => [h, vals[i] || ""])
    );
  });
}

function writeCSV(file, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const lines = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const val = String(r[h] ?? "");
        if (val.includes(",") || val.includes('"')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",")
    )
  ];

  fs.writeFileSync(file, lines.join("\n"));
}

function normalizeGame(game = "") {
  return game
    .toLowerCase()
    .replace(/\s+@\s+/g, " @ ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function vegasBoost(total) {
  total = Number(total);

  if (total >= 11) return 10;
  if (total >= 10) return 8;
  if (total >= 9) return 5;
  if (total >= 8) return 2;
  if (total <= 7) return -2;

  return 0;
}

const players = readCSV(PLAYER_FILE);
const vegas = readCSV(VEGAS_FILE);

const vegasMap = new Map();

for (const row of vegas) {
  const key = normalizeGame(row.game);

  vegasMap.set(key, {
    total: row.vegas_total,
    source: row.source
  });
}

let matched = 0;
let noMatch = 0;

for (const row of players) {
  const key = normalizeGame(row.game);

  const hit = vegasMap.get(key);

  if (hit) {
    matched++;

    row.vegas_game_total = hit.total;
    row.vegas_total_boost = vegasBoost(hit.total).toFixed(1);
    row.vegas_total_match = "MATCH";
    row.vegas_total_source = hit.source;
  } else {
    noMatch++;

    row.vegas_game_total = "";
    row.vegas_total_boost = "0.0";
    row.vegas_total_match = "NO_MATCH";
  }
}

writeCSV(PLAYER_FILE, players);

console.log("");
console.log("THE SLIP LAB VEGAS TOTALS MERGE COMPLETE");
console.log(`Rows: ${players.length}`);
console.log(`Vegas games: ${vegas.length}`);
console.log(`Matched rows: ${matched}`);
console.log(`No match rows: ${noMatch}`);
console.log("");

console.table(
  players.slice(0, 20).map(r => ({
    name: r.name,
    game: r.game,
    total: r.vegas_game_total,
    boost: r.vegas_total_boost,
    match: r.vegas_total_match
  }))
);
