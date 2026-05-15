import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const HISTORY_DIR = path.join(ROOT, "history");
const RESULTS_DIR = path.join(ROOT, "exports", "results");
const CLV_DIR = path.join(ROOT, "exports", "clv");
const OUT_DIR = path.join(ROOT, "exports", "ml_training");

const OUT_CSV = path.join(OUT_DIR, "ml_training_dataset.csv");
const OUT_JSON = path.join(OUT_DIR, "ml_training_dataset.json");
const OUT_SUMMARY = path.join(OUT_DIR, "ml_training_summary.txt");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some(v => String(v).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h => String(h).trim());

  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  const escape = value => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(","))
  ].join("\n");
}

function readCsvSafe(file) {
  if (!file || !fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/ jr$/g, "")
    .replace(/ sr$/g, "")
    .replace(/ iii$/g, "")
    .replace(/ ii$/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return "";
}

function num(value, fallback = "") {
  const n = Number(String(value ?? "").replace("+", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function getDates() {
  if (!fs.existsSync(HISTORY_DIR)) return [];

  return fs.readdirSync(HISTORY_DIR)
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();
}

function getLatestArchiveForDate(date) {
  const dir = path.join(HISTORY_DIR, date);
  if (!fs.existsSync(dir)) return null;

  const folders = fs.readdirSync(dir)
    .map(name => path.join(dir, name))
    .filter(file => fs.statSync(file).isDirectory())
    .sort();

  return folders.at(-1) || null;
}

function findFirstExisting(baseDir, candidates) {
  for (const candidate of candidates) {
    const full = path.join(baseDir, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function makeKey(date, board, name) {
  return `${date}|${board}|${normalizeName(name)}`;
}

function loadResultsMap(date) {
  const file = path.join(RESULTS_DIR, `graded_results_${date}.csv`);
  const rows = readCsvSafe(file);
  const map = new Map();

  for (const row of rows) {
    const key = makeKey(date, getField(row, ["board"]), getField(row, ["name"]));
    map.set(key, row);
  }

  return map;
}

function loadClvMap(date) {
  const file = path.join(CLV_DIR, `clv_report_${date}.csv`);
  const rows = readCsvSafe(file);
  const map = new Map();

  for (const row of rows) {
    const key = makeKey(date, getField(row, ["board"]), getField(row, ["name"]));
    map.set(key, row);
  }

  return map;
}

function loadBoardRows(archiveFolder) {
  const boards = [
    {
      board: "HR",
      files: ["exports/hr_board.csv", "data/hr_board.csv", "hr_board.csv"]
    },
    {
      board: "HITS",
      files: ["exports/hits_board.csv", "data/hits_board.csv", "hits_board.csv"]
    },
    {
      board: "TB",
      files: ["exports/tb_board.csv", "data/tb_board.csv", "tb_board.csv"]
    }
  ];

  const all = [];

  for (const item of boards) {
    const file = findFirstExisting(archiveFolder, item.files);
    const rows = readCsvSafe(file);

    for (const row of rows) {
      all.push({
        board: item.board,
        row
      });
    }
  }

  return all;
}

function buildDataset() {
  const dates = getDates();
  const output = [];

  for (const date of dates) {
    const archiveFolder = getLatestArchiveForDate(date);
    if (!archiveFolder) continue;

    const resultsMap = loadResultsMap(date);
    const clvMap = loadClvMap(date);
    const boardRows = loadBoardRows(archiveFolder);

    for (const item of boardRows) {
      const row = item.row;
      const board = item.board;

      const name = getField(row, ["name", "player", "batter", "player_name"]);
      if (!name) continue;

      const key = makeKey(date, board, name);
      const result = resultsMap.get(key);
      const clv = clvMap.get(key);

      if (!result || result.status !== "GRADED") continue;

      const outcome = result.result === "WIN" ? 1 : 0;

      output.push({
        date,
        board,
        name,
        team: getField(row, ["team", "player_team"]),
        opponent: getField(row, ["opponent", "opp"]),
        pitcher: getField(row, ["pitcher", "probable_pitcher", "opposing_pitcher"]),
        tier: getField(row, ["tier", "bucket"]),
        rank: num(getField(row, ["rank"])),
        model_score: num(getField(row, ["score", "model_score", "hr_score"])),
        odds: num(getField(row, ["odds", "best_odds", "price", "line_odds"])),
        implied_prob: num(getField(row, ["implied_prob", "implied_probability", "book_implied"])),
        ev: num(getField(row, ["ev", "edge", "ev_pct"])),
        hr_score: num(getField(row, ["hr_score"])),
        hits_score: num(getField(row, ["hits_score"])),
        tb_score: num(getField(row, ["tb_score"])),
        trend_score: num(getField(row, ["trend_score", "recent_form_score"])),
        pitcher_attack_score: num(getField(row, ["pitcher_attack_score", "attack_score"])),
        park_score: num(getField(row, ["park_score", "park_factor_score"])),
        vegas_score: num(getField(row, ["vegas_score", "implied_total_score"])),
        weather_score: num(getField(row, ["weather_score", "wind_score"])),
        lineup_spot: num(getField(row, ["lineup", "lineup_spot", "batting_order"])),
        actual_hits: num(result.hits),
        actual_total_bases: num(result.total_bases),
        actual_home_runs: num(result.home_runs),
        at_bats: num(result.at_bats),
        result: result.result,
        outcome,
        profit_units: num(result.profit_units, 0),
        opening_odds: num(clv?.opening_odds),
        closing_odds: num(clv?.closing_odds),
        clv_pct: num(clv?.clv_pct),
        clv_result: clv?.result || "",
        data_source_archive: archiveFolder
      });
    }
  }

  return output;
}

function summarize(rows) {
  const byBoard = {};

  for (const row of rows) {
    if (!byBoard[row.board]) {
      byBoard[row.board] = {
        plays: 0,
        wins: 0,
        profit: 0
      };
    }

    byBoard[row.board].plays++;
    byBoard[row.board].wins += row.outcome === 1 ? 1 : 0;
    byBoard[row.board].profit += Number(row.profit_units || 0);
  }

  const lines = [];

  lines.push("THE SLIP LAB ML TRAINING DATASET");
  lines.push(`Created: ${new Date().toISOString()}`);
  lines.push(`Rows: ${rows.length}`);
  lines.push("");

  for (const board of Object.keys(byBoard).sort()) {
    const item = byBoard[board];
    const hitRate = item.plays ? (item.wins / item.plays) * 100 : 0;
    const roi = item.plays ? (item.profit / item.plays) * 100 : 0;

    lines.push(`${board}: ${item.wins}/${item.plays} hit | Hit Rate ${hitRate.toFixed(1)}% | ROI ${roi.toFixed(1)}%`);
  }

  lines.push("");
  lines.push("Use this file later for machine learning tuning:");
  lines.push(OUT_CSV);

  return lines.join("\n");
}

function main() {
  ensureDir(OUT_DIR);

  const rows = buildDataset();

  fs.writeFileSync(OUT_CSV, toCsv(rows));
  fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2));
  fs.writeFileSync(OUT_SUMMARY, summarize(rows));

  console.log("");
  console.log("ML TRAINING DATASET COMPLETE");
  console.log("Rows:", rows.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);
  console.log("Saved:", OUT_SUMMARY);
}

main();
