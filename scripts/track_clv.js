import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const ARG_DATE = process.argv[2];
const DATE = ARG_DATE || new Date().toISOString().slice(0, 10);

const HISTORY_ROOT = path.join(ROOT, "history", DATE);
const OUT_DIR = path.join(ROOT, "exports", "clv");

const OUT_CSV = path.join(OUT_DIR, `clv_report_${DATE}.csv`);
const OUT_JSON = path.join(OUT_DIR, `clv_report_${DATE}.json`);
const OUT_SUMMARY = path.join(OUT_DIR, `clv_summary_${DATE}.txt`);

const CURRENT_LINE_FILES = [
  "data/best_lines.csv",
  "exports/best_lines.csv",
  "best_lines.csv",
  "data/hr_odds_flat.csv",
  "exports/hr_odds_flat.csv",
  "hr_odds_flat.csv"
];

const ARCHIVE_BOARD_FILES = [
  {
    board: "HR",
    files: [
      "exports/hr_board.csv",
      "data/hr_board.csv",
      "hr_board.csv"
    ]
  },
  {
    board: "HITS",
    files: [
      "exports/hits_board.csv",
      "data/hits_board.csv",
      "hits_board.csv"
    ]
  },
  {
    board: "TB",
    files: [
      "exports/tb_board.csv",
      "data/tb_board.csv",
      "tb_board.csv"
    ]
  }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function normalizeMarket(value = "") {
  const text = String(value).toLowerCase();

  if (text.includes("home") || text.includes("hr")) return "HR";
  if (text.includes("hit") && !text.includes("strike")) return "HITS";
  if (text.includes("total") || text.includes("tb")) return "TB";

  return text
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
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

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return "";
}

function parseAmericanOdds(value) {
  const text = String(value || "")
    .replace("+", "")
    .replace("−", "-")
    .trim();

  const odds = Number(text);

  if (!Number.isFinite(odds) || odds === 0) return null;

  return odds;
}

function americanToDecimal(odds) {
  if (!odds) return null;

  if (odds > 0) return 1 + odds / 100;

  return 1 + 100 / Math.abs(odds);
}

function americanToImplied(odds) {
  if (!odds) return null;

  if (odds > 0) return 100 / (odds + 100);

  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function impliedToAmerican(prob) {
  if (!prob || prob <= 0 || prob >= 1) return null;

  if (prob > 0.5) {
    return Math.round((-100 * prob) / (1 - prob));
  }

  return Math.round((100 * (1 - prob)) / prob);
}

function clvPercent(openOdds, closeOdds) {
  const openDec = americanToDecimal(openOdds);
  const closeDec = americanToDecimal(closeOdds);

  if (!openDec || !closeDec) return null;

  return ((openDec / closeDec) - 1) * 100;
}

function findLatestArchiveFolder() {
  if (!fs.existsSync(HISTORY_ROOT)) return null;

  const folders = fs.readdirSync(HISTORY_ROOT)
    .map(name => path.join(HISTORY_ROOT, name))
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

function findCurrentLineFile() {
  for (const file of CURRENT_LINE_FILES) {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) return full;
  }

  return null;
}

function buildClosingLineMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const name = getField(row, [
      "name",
      "player",
      "batter",
      "player_name",
      "description"
    ]);

    if (!name) continue;

    const rawMarket = getField(row, [
      "board",
      "market",
      "prop",
      "type",
      "bet_type",
      "outcome"
    ]);

    const market = normalizeMarket(rawMarket || "HR");

    const odds = parseAmericanOdds(getField(row, [
      "odds",
      "best_odds",
      "price",
      "line_odds",
      "american_odds"
    ]));

    if (!odds) continue;

    const book = getField(row, [
      "book",
      "sportsbook",
      "source",
      "bookmaker",
      "line_source"
    ]);

    const key = `${normalizeName(name)}|${market}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        name,
        market,
        closing_odds: odds,
        closing_book: book
      });
      continue;
    }

    if (odds > existing.closing_odds) {
      map.set(key, {
        name,
        market,
        closing_odds: odds,
        closing_book: book
      });
    }
  }

  return map;
}

function gradeClvForBoard(rows, boardType, closingMap) {
  const output = [];

  for (const row of rows) {
    const name = getField(row, [
      "name",
      "player",
      "batter",
      "player_name"
    ]);

    if (!name) continue;

    const openOdds = parseAmericanOdds(getField(row, [
      "odds",
      "best_odds",
      "price",
      "line_odds"
    ]));

    if (!openOdds) continue;

    const market = normalizeMarket(boardType);
    const key = `${normalizeName(name)}|${market}`;
    const close = closingMap.get(key);

    const closeOdds = close?.closing_odds || null;

    const openImplied = americanToImplied(openOdds);
    const closeImplied = americanToImplied(closeOdds);

    const clv = closeOdds ? clvPercent(openOdds, closeOdds) : null;

    let result = "NO CLOSING LINE";

    if (clv !== null) {
      if (clv > 0.01) result = "POSITIVE CLV";
      else if (clv < -0.01) result = "NEGATIVE CLV";
      else result = "FLAT";
    }

    output.push({
      date: DATE,
      board: boardType,
      result,
      name,
      team: getField(row, ["team", "player_team"]),
      opponent: getField(row, ["opponent", "opp"]),
      pitcher: getField(row, ["pitcher", "probable_pitcher", "opposing_pitcher"]),
      tier: getField(row, ["tier", "bucket"]),
      rank: getField(row, ["rank"]),
      score: getField(row, ["score", "model_score", "hr_score"]),
      opening_odds: openOdds,
      closing_odds: closeOdds || "",
      closing_book: close?.closing_book || "",
      opening_implied_pct: openImplied ? (openImplied * 100).toFixed(2) : "",
      closing_implied_pct: closeImplied ? (closeImplied * 100).toFixed(2) : "",
      fair_close_number: closeImplied ? impliedToAmerican(closeImplied) : "",
      clv_pct: clv !== null ? clv.toFixed(2) : "",
      line_movement: closeOdds ? closeOdds - openOdds : ""
    });
  }

  return output;
}

function summarize(rows) {
  const graded = rows.filter(row => row.result !== "NO CLOSING LINE");

  const positive = graded.filter(row => row.result === "POSITIVE CLV").length;
  const negative = graded.filter(row => row.result === "NEGATIVE CLV").length;
  const flat = graded.filter(row => row.result === "FLAT").length;

  const avgClv = graded.length
    ? graded.reduce((sum, row) => sum + Number(row.clv_pct || 0), 0) / graded.length
    : 0;

  const byBoard = {};

  for (const row of graded) {
    const key = row.board;

    if (!byBoard[key]) {
      byBoard[key] = {
        board: key,
        plays: 0,
        positive: 0,
        negative: 0,
        flat: 0,
        clvSum: 0
      };
    }

    byBoard[key].plays++;
    byBoard[key].clvSum += Number(row.clv_pct || 0);

    if (row.result === "POSITIVE CLV") byBoard[key].positive++;
    if (row.result === "NEGATIVE CLV") byBoard[key].negative++;
    if (row.result === "FLAT") byBoard[key].flat++;
  }

  const boardSummary = Object.values(byBoard).map(row => ({
    board: row.board,
    plays: row.plays,
    positive: row.positive,
    negative: row.negative,
    flat: row.flat,
    positive_rate: row.plays ? `${((row.positive / row.plays) * 100).toFixed(1)}%` : "0.0%",
    avg_clv_pct: row.plays ? `${(row.clvSum / row.plays).toFixed(2)}%` : "0.00%"
  }));

  return {
    date: DATE,
    total_with_closing_lines: graded.length,
    positive_clv: positive,
    negative_clv: negative,
    flat,
    positive_clv_rate: graded.length ? `${((positive / graded.length) * 100).toFixed(1)}%` : "0.0%",
    average_clv_pct: `${avgClv.toFixed(2)}%`,
    by_board: boardSummary
  };
}

function buildSummaryText(summary) {
  const lines = [];

  lines.push("THE SLIP LAB CLV SUMMARY");
  lines.push(`Date: ${summary.date}`);
  lines.push("");
  lines.push(`Plays with closing lines: ${summary.total_with_closing_lines}`);
  lines.push(`Positive CLV: ${summary.positive_clv}`);
  lines.push(`Negative CLV: ${summary.negative_clv}`);
  lines.push(`Flat: ${summary.flat}`);
  lines.push(`Positive CLV rate: ${summary.positive_clv_rate}`);
  lines.push(`Average CLV: ${summary.average_clv_pct}`);
  lines.push("");
  lines.push("By board:");

  for (const row of summary.by_board) {
    lines.push(`${row.board}: ${row.positive}/${row.plays} positive | ${row.positive_rate} | Avg CLV ${row.avg_clv_pct}`);
  }

  return lines.join("\n");
}

function main() {
  ensureDir(OUT_DIR);

  const archiveFolder = findLatestArchiveFolder();

  if (!archiveFolder) {
    console.error(`No history archive found for ${DATE}`);
    console.error(`Expected: ${HISTORY_ROOT}`);
    process.exit(1);
  }

  const currentLineFile = findCurrentLineFile();

  if (!currentLineFile) {
    console.error("No current line file found.");
    console.error("Run your odds scripts first, then run this CLV tracker close to game time.");
    process.exit(1);
  }

  console.log("");
  console.log("THE SLIP LAB CLV TRACKER");
  console.log("Date:", DATE);
  console.log("Archive:", archiveFolder);
  console.log("Closing line source:", currentLineFile);

  const closingRows = readCsvSafe(currentLineFile);
  const closingMap = buildClosingLineMap(closingRows);

  console.log("Closing lines loaded:", closingMap.size);

  const allRows = [];

  for (const board of ARCHIVE_BOARD_FILES) {
    const file = findFirstExisting(archiveFolder, board.files);

    if (!file) {
      console.log(`${board.board} archive board not found`);
      continue;
    }

    const rows = readCsvSafe(file);
    const graded = gradeClvForBoard(rows, board.board, closingMap);

    allRows.push(...graded);

    console.log(`${board.board} rows checked:`, graded.length);
  }

  const summary = summarize(allRows);

  fs.writeFileSync(OUT_CSV, toCsv(allRows));
  fs.writeFileSync(OUT_JSON, JSON.stringify({ date: DATE, rows: allRows, summary }, null, 2));
  fs.writeFileSync(OUT_SUMMARY, buildSummaryText(summary));

  console.log("");
  console.log("CLV TRACKING COMPLETE");
  console.log("Rows:", allRows.length);
  console.log("Positive CLV rate:", summary.positive_clv_rate);
  console.log("Average CLV:", summary.average_clv_pct);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);
  console.log("Saved:", OUT_SUMMARY);
}

main();
