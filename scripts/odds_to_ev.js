import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const BEST_LINES_FILE = "data/best_lines.csv";

const FILES = [
  {
    file: "hits_board.csv",
    type: "hits"
  },
  {
    file: "tb_board.csv",
    type: "tb"
  },
  {
    file: "hr_sweep_board_all_games.csv",
    type: "hr"
  }
];

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"' && line[i + 1] === '"') {
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

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      headers: [],
      rows: []
    };
  }

  const text = fs.readFileSync(filePath, "utf8").trim();

  if (!text) {
    return {
      headers: [],
      rows: []
    };
  }

  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());

  return {
    headers,
    rows: lines.map(line => {
      const values = splitCsvLine(line);
      const row = {};

      headers.forEach((h, i) => {
        row[h] = values[i] ?? "";
      });

      return row;
    })
  };
}

function csvEscape(value) {
  const str = String(value ?? "");

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function writeCsv(filePath, headers, rows) {
  const text = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ].join("\n");

  fs.writeFileSync(filePath, text);
}

function clean(value) {
  return String(value || "").trim();
}

function norm(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\bjr\b/g, "")
    .replace(/\bsr\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function num(value, fallback = 0) {
  const n = Number(String(value || "").replace("+", ""));
  return Number.isFinite(n) ? n : fallback;
}

function get(row, keys, fallback = "") {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }

  return fallback;
}

function makeKey(player, market) {
  return `${norm(player)}|${clean(market)}`;
}

function impliedProbability(odds) {
  const o = num(odds);

  if (!o) return 0;

  if (o > 0) {
    return 100 / (o + 100);
  }

  return Math.abs(o) / (Math.abs(o) + 100);
}

function americanToDecimal(odds) {
  const o = num(odds);

  if (!o) return 0;

  if (o > 0) {
    return 1 + o / 100;
  }

  return 1 + 100 / Math.abs(o);
}

function calcEV(probability, odds) {
  const decimalOdds = americanToDecimal(odds);

  if (!decimalOdds) return 0;

  return probability * (decimalOdds - 1) - (1 - probability);
}

function modelProbability(score, type, market = "") {
  const s = num(score);

  if (type === "hr" || market === "HR") {
    return Math.min(0.45, Math.max(0.01, s / 100));
  }

  if (market === "4+ TB") {
    return Math.min(0.38, Math.max(0.03, s / 100));
  }

  if (market === "3+ TB") {
    return Math.min(0.52, Math.max(0.05, s / 100));
  }

  if (market === "2+ TB") {
    return Math.min(0.72, Math.max(0.08, s / 100));
  }

  if (type === "hits" || market === "1+ Hit") {
    return Math.min(0.82, Math.max(0.10, s / 100));
  }

  return Math.min(0.75, Math.max(0.01, s / 100));
}

function buildBestLineMap(rows) {
  const map = new Map();

  rows.forEach(row => {
    const player = clean(get(row, ["player", "name"]));
    const market = clean(get(row, ["market"]));

    if (!player || !market) return;

    const key = makeKey(player, market);

    map.set(key, {
      player,
      market,
      line: clean(get(row, ["line"])),
      best_odds: clean(get(row, ["best_odds"])),
      best_book: clean(get(row, ["best_book"])),
      book_count: clean(get(row, ["book_count"])),
      market_average_odds: clean(get(row, ["market_average_odds"])),
      all_books: clean(get(row, ["all_books"])),
      source: clean(get(row, ["source"]))
    });
  });

  return map;
}

function findLine(bestLineMap, player, market) {
  const exact = bestLineMap.get(makeKey(player, market));

  if (exact) return exact;

  const playerNorm = norm(player);

  for (const [key, value] of bestLineMap.entries()) {
    if (key.startsWith(`${playerNorm}|`) && value.market === market) {
      return value;
    }
  }

  return null;
}

function addHeaders(headers, extraHeaders) {
  const out = [...headers];

  extraHeaders.forEach(h => {
    if (!out.includes(h)) out.push(h);
  });

  return out;
}

function applyEv(row, config, market, score) {
  const line = findLine(config.bestLineMap, get(row, ["name", "player", "batter"]), market);

  row.ev_market = market;

  if (!line) {
    row.best_odds = "";
    row.best_book = "";
    row.book_count = "";
    row.market_average_odds = "";
    row.all_books = "";
    row.implied_probability = "";
    row.model_probability = "";
    row.edge = "";
    row.ev = "";
    row.line_source = "NO LINE";
    return row;
  }

  const implied = impliedProbability(line.best_odds);
  const modelProb = modelProbability(score, config.type, market);
  const edge = modelProb - implied;
  const ev = calcEV(modelProb, line.best_odds);

  row.best_odds = line.best_odds;
  row.best_book = line.best_book;
  row.book_count = line.book_count;
  row.market_average_odds = line.market_average_odds;
  row.all_books = line.all_books;
  row.implied_probability = (implied * 100).toFixed(1);
  row.model_probability = (modelProb * 100).toFixed(1);
  row.edge = (edge * 100).toFixed(1);
  row.ev = (ev * 100).toFixed(1);
  row.line_source = line.source || "best_lines";

  return row;
}

function processHits(parsed, bestLineMap) {
  const headers = addHeaders(parsed.headers, [
    "ev_market",
    "best_odds",
    "best_book",
    "book_count",
    "market_average_odds",
    "all_books",
    "implied_probability",
    "model_probability",
    "edge",
    "ev",
    "line_source"
  ]);

  const rows = parsed.rows.map(row => {
    const score = num(get(row, ["hits_score", "score", "hit_score", "model_score"]));

    return applyEv(
      row,
      {
        type: "hits",
        bestLineMap
      },
      "1+ Hit",
      score
    );
  });

  return {
    headers,
    rows
  };
}

function processHr(parsed, bestLineMap) {
  const headers = addHeaders(parsed.headers, [
    "ev_market",
    "best_odds",
    "best_book",
    "book_count",
    "market_average_odds",
    "all_books",
    "implied_probability",
    "model_probability",
    "edge",
    "ev",
    "line_source"
  ]);

  const rows = parsed.rows.map(row => {
    const score = num(get(row, ["score", "hr_score", "model_score"]));

    return applyEv(
      row,
      {
        type: "hr",
        bestLineMap
      },
      "HR",
      score
    );
  });

  return {
    headers,
    rows
  };
}

function processTb(parsed, bestLineMap) {
  const headers = addHeaders(parsed.headers, [
    "two_best_odds",
    "two_best_book",
    "two_implied_probability",
    "two_model_probability",
    "two_edge",
    "two_ev",
    "three_best_odds",
    "three_best_book",
    "three_implied_probability",
    "three_model_probability",
    "three_edge",
    "three_ev",
    "four_best_odds",
    "four_best_book",
    "four_implied_probability",
    "four_model_probability",
    "four_edge",
    "four_ev",
    "best_ev_market",
    "best_ev",
    "best_ev_odds",
    "best_ev_book",
    "best_ev_all_books",
    "line_source"
  ]);

  const rows = parsed.rows.map(row => {
    const name = get(row, ["name", "player", "batter"]);

    const markets = [
      {
        label: "two",
        market: "2+ TB",
        score: num(get(row, ["two_tb_score", "two", "2_tb_score"]))
      },
      {
        label: "three",
        market: "3+ TB",
        score: num(get(row, ["three_tb_score", "three", "3_tb_score"]))
      },
      {
        label: "four",
        market: "4+ TB",
        score: num(get(row, ["four_tb_score", "four", "4_tb_score"]))
      }
    ];

    const evOptions = [];

    markets.forEach(item => {
      const line = findLine(bestLineMap, name, item.market);

      if (!line) {
        row[`${item.label}_best_odds`] = "";
        row[`${item.label}_best_book`] = "";
        row[`${item.label}_implied_probability`] = "";
        row[`${item.label}_model_probability`] = "";
        row[`${item.label}_edge`] = "";
        row[`${item.label}_ev`] = "";
        return;
      }

      const implied = impliedProbability(line.best_odds);
      const modelProb = modelProbability(item.score, "tb", item.market);
      const edge = modelProb - implied;
      const ev = calcEV(modelProb, line.best_odds);

      row[`${item.label}_best_odds`] = line.best_odds;
      row[`${item.label}_best_book`] = line.best_book;
      row[`${item.label}_implied_probability`] = (implied * 100).toFixed(1);
      row[`${item.label}_model_probability`] = (modelProb * 100).toFixed(1);
      row[`${item.label}_edge`] = (edge * 100).toFixed(1);
      row[`${item.label}_ev`] = (ev * 100).toFixed(1);

      evOptions.push({
        market: item.market,
        ev,
        odds: line.best_odds,
        book: line.best_book,
        all_books: line.all_books
      });
    });

    const best = evOptions.sort((a, b) => b.ev - a.ev)[0];

    if (best) {
      row.best_ev_market = best.market;
      row.best_ev = (best.ev * 100).toFixed(1);
      row.best_ev_odds = best.odds;
      row.best_ev_book = best.book;
      row.best_ev_all_books = best.all_books;
      row.line_source = "SportsGameOdds";
    } else {
      row.best_ev_market = "";
      row.best_ev = "";
      row.best_ev_odds = "";
      row.best_ev_book = "";
      row.best_ev_all_books = "";
      row.line_source = "NO LINE";
    }

    return row;
  });

  return {
    headers,
    rows
  };
}

function processFile(config, bestLineMap) {
  const fullPath = path.join(ROOT, config.file);
  const parsed = parseCsv(fullPath);

  if (!parsed.rows.length) {
    console.log("No rows:", config.file);
    return;
  }

  let processed;

  if (config.type === "hits") {
    processed = processHits(parsed, bestLineMap);
  } else if (config.type === "tb") {
    processed = processTb(parsed, bestLineMap);
  } else {
    processed = processHr(parsed, bestLineMap);
  }

  writeCsv(fullPath, processed.headers, processed.rows);

  const withLines = processed.rows.filter(row => {
    if (config.type === "tb") return row.best_ev_market;
    return row.best_odds;
  }).length;

  console.log(`Updated EV: ${config.file}`);
  console.log(`Rows with lines: ${withLines}/${processed.rows.length}`);
}

function main() {
  const bestLinesPath = path.join(ROOT, BEST_LINES_FILE);
  const bestLines = parseCsv(bestLinesPath).rows;

  if (!bestLines.length) {
    console.error("No best lines found.");
    console.error("Run node scripts/sgo_lines.js and node scripts/best_lines.js first.");
    process.exit(1);
  }

  const bestLineMap = buildBestLineMap(bestLines);

  console.log("");
  console.log("ODDS TO EV");
  console.log("Best lines loaded:", bestLines.length);

  FILES.forEach(file => {
    processFile(
      {
        ...file
      },
      bestLineMap
    );
  });

  console.log("");
  console.log("ODDS + EV COMPLETE");
}

main();