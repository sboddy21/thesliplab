import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const PLAYER_FILES = [
  path.join(ROOT, "data", "player_stats.csv"),
  path.join(ROOT, "player_stats.csv"),
  path.join(ROOT, "exports", "player_stats.csv"),
];

const SHARP_FILES = [
  path.join(ROOT, "data", "sharp_action.csv"),
  path.join(ROOT, "data", "odds_movement.csv"),
  path.join(ROOT, "data", "line_movement.csv"),
  path.join(ROOT, "sharp_action.csv"),
  path.join(ROOT, "odds_movement.csv"),
  path.join(ROOT, "line_movement.csv"),
  path.join(ROOT, "exports", "sharp_action.csv"),
];

function exists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function firstExisting(files) {
  return files.find(exists) || null;
}

function splitCsvLine(line) {
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

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((x) => x.trim() !== "");
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((x) => x.trim());
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function stringifyCSV(rows) {
  if (!rows.length) return "";

  const headers = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) headers.push(key);
    }
  }

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ].join("\n") + "\n";
}

function readCSV(file) {
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function col(row, names) {
  const keys = Object.keys(row);
  const wanted = names.map(norm);

  for (const key of keys) {
    if (wanted.includes(norm(key))) return key;
  }

  for (const key of keys) {
    if (wanted.some((w) => norm(key).includes(w))) return key;
  }

  return null;
}

function playerKey(row) {
  const nameCol = col(row, ["name", "player", "batter", "player_name"]);
  const teamCol = col(row, ["team", "team_name", "player_team"]);

  return `${norm(nameCol ? row[nameCol] : "")}|${norm(teamCol ? row[teamCol] : "")}`;
}

function num(value) {
  const n = Number(String(value ?? "").replace("%", "").replace("+", "").trim());
  return Number.isFinite(n) ? n : null;
}

function americanToProb(odds) {
  const o = num(odds);
  if (o === null || o === 0) return null;

  if (o > 0) return 100 / (o + 100);
  return Math.abs(o) / (Math.abs(o) + 100);
}

function calcSharpBoost(row) {
  const boostCol = col(row, ["sharp_boost", "steam_boost", "movement_boost", "boost"]);

  if (boostCol) {
    const value = num(row[boostCol]);
    if (value !== null) return value;
  }

  const openCol = col(row, ["open_odds", "opening_odds", "open"]);
  const currentCol = col(row, ["current_odds", "best_odds", "odds", "price"]);
  const handleCol = col(row, ["handle_pct", "money_pct", "money"]);
  const betCol = col(row, ["bet_pct", "ticket_pct", "bets"]);

  const openProb = openCol ? americanToProb(row[openCol]) : null;
  const currentProb = currentCol ? americanToProb(row[currentCol]) : null;
  const handle = handleCol ? num(row[handleCol]) : null;
  const bets = betCol ? num(row[betCol]) : null;

  let boost = 0;

  if (openProb !== null && currentProb !== null) {
    const move = (currentProb - openProb) * 100;

    if (move >= 4) boost += 7;
    else if (move >= 2.5) boost += 5;
    else if (move >= 1) boost += 2;
    else if (move <= -4) boost -= 6;
    else if (move <= -2.5) boost -= 4;
    else if (move <= -1) boost -= 2;
  }

  if (handle !== null && bets !== null) {
    const diff = handle - bets;

    if (diff >= 25) boost += 6;
    else if (diff >= 15) boost += 4;
    else if (diff >= 8) boost += 2;
  }

  return Math.max(-10, Math.min(12, boost));
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 15);
  const out = file.replace(/\.csv$/i, `_backup_${stamp}.csv`);
  fs.copyFileSync(file, out);
  return out;
}

function main() {
  const playerFile = firstExisting(PLAYER_FILES);

  if (!playerFile) {
    console.error("Could not find player_stats.csv");
    process.exit(1);
  }

  const sharpFile = firstExisting(SHARP_FILES);
  const playerRows = readCSV(playerFile);

  if (!sharpFile) {
    const updated = playerRows.map((row) => ({
      ...row,
      sharp_action_boost: row.sharp_action_boost || "0",
      sharp_action_match: row.sharp_action_match || "NO_SHARP_FILE",
      sharp_action_source: row.sharp_action_source || "",
    }));

    const backupFile = backup(playerFile);
    fs.writeFileSync(playerFile, stringifyCSV(updated), "utf8");

    console.log("Done.");
    console.log(`Rows: ${updated.length}`);
    console.log("Sharp source: none found");
    console.log(`Backup: ${backupFile}`);
    console.log(`Saved: ${playerFile}`);
    return;
  }

  const sharpRows = readCSV(sharpFile);
  const sharpMap = new Map();

  for (const row of sharpRows) {
    const key = playerKey(row);
    if (!key.startsWith("|")) sharpMap.set(key, row);
  }

  let matched = 0;

  const updated = playerRows.map((row) => {
    const match = sharpMap.get(playerKey(row));

    if (!match) {
      return {
        ...row,
        sharp_action_boost: "0",
        sharp_action_match: "NO_MATCH",
        sharp_action_source: path.relative(ROOT, sharpFile),
      };
    }

    matched++;

    return {
      ...row,
      sharp_action_boost: String(calcSharpBoost(match)),
      sharp_action_match: "MATCH",
      sharp_action_source: path.relative(ROOT, sharpFile),
    };
  });

  const backupFile = backup(playerFile);
  fs.writeFileSync(playerFile, stringifyCSV(updated), "utf8");

  console.log("Done.");
  console.log(`Rows: ${updated.length}`);
  console.log(`Matched: ${matched}`);
  console.log(`No match: ${updated.length - matched}`);
  console.log(`Sharp source: ${path.relative(ROOT, sharpFile)}`);
  console.log(`Backup: ${backupFile}`);
  console.log(`Saved: ${playerFile}`);
}

main();