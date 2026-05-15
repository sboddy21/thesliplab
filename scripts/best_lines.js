import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUTS = {
  sgo: "data/sgo_best_lines.csv",
  oldHr: "data/hr_odds_flat.csv"
};

const OUTPUT = "data/best_lines.csv";

function clean(value) {
  return String(value || "").trim();
}

function norm(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/jr$/g, "")
    .replace(/sr$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function num(value, fallback = 0) {
  const n = Number(String(value || "").replace("+", ""));
  return Number.isFinite(n) ? n : fallback;
}

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
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());

  return lines.map(line => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });

    return row;
  });
}

function csvEscape(value) {
  const str = String(value ?? "");

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function writeCsv(filePath, rows) {
  const headers = [
    "player",
    "player_key",
    "player_id",
    "team",
    "game",
    "event_id",
    "market",
    "line",
    "best_odds",
    "best_book",
    "book_count",
    "market_average_odds",
    "all_books",
    "source"
  ];

  const text = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ].join("\n");

  fs.mkdirSync(path.dirname(path.join(ROOT, filePath)), {
    recursive: true
  });

  fs.writeFileSync(path.join(ROOT, filePath), text);
}

function isBetterOdds(newOdds, oldOdds) {
  return num(newOdds) > num(oldOdds);
}

function makeKey(player, market, line) {
  return `${norm(player)}|${clean(market)}|${clean(line)}`;
}

function addLine(map, line) {
  if (!line.player || !line.market || !line.best_odds) return;

  const key = makeKey(line.player, line.market, line.line);

  if (!map.has(key)) {
    map.set(key, line);
    return;
  }

  const existing = map.get(key);

  if (isBetterOdds(line.best_odds, existing.best_odds)) {
    map.set(key, {
      ...existing,
      ...line,
      all_books: [existing.all_books, line.all_books]
        .filter(Boolean)
        .join(" | ")
    });
  }
}

function loadSgo(map) {
  const rows = parseCsv(path.join(ROOT, INPUTS.sgo));

  rows.forEach(row => {
    addLine(map, {
      player: clean(row.player),
      player_key: clean(row.player_key) || norm(row.player),
      player_id: clean(row.player_id),
      team: clean(row.team),
      game: clean(row.game),
      event_id: clean(row.event_id),
      market: clean(row.market),
      line: clean(row.line),
      best_odds: clean(row.best_odds),
      best_book: clean(row.best_book),
      book_count: clean(row.book_count),
      market_average_odds: clean(row.market_average_odds),
      all_books: clean(row.all_books),
      source: "SportsGameOdds"
    });
  });

  console.log("Loaded SGO lines:", rows.length);
}

function loadOldHrFallback(map) {
  const rows = parseCsv(path.join(ROOT, INPUTS.oldHr));

  rows.forEach(row => {
    const player = clean(row.player || row.name);
    const odds = clean(row.odds);
    const book = clean(row.book);

    if (!player || !odds || !book) return;

    addLine(map, {
      player,
      player_key: norm(player),
      player_id: "",
      team: "",
      game: clean(row.game),
      event_id: clean(row.game_id),
      market: "HR",
      line: "0.5",
      best_odds: odds,
      best_book: book,
      book_count: 1,
      market_average_odds: odds,
      all_books: `${book}:${num(odds) > 0 ? "+" : ""}${num(odds)}`,
      source: "The Odds API"
    });
  });

  console.log("Loaded old HR fallback lines:", rows.length);
}

function main() {
  const map = new Map();

  loadSgo(map);
  loadOldHrFallback(map);

  const rows = Array.from(map.values()).sort((a, b) => {
    if (a.market !== b.market) return a.market.localeCompare(b.market);
    return a.player.localeCompare(b.player);
  });

  writeCsv(OUTPUT, rows);

  const markets = rows.reduce((acc, row) => {
    acc[row.market] = (acc[row.market] || 0) + 1;
    return acc;
  }, {});

  const books = rows.reduce((acc, row) => {
    const book = clean(row.best_book);
    if (book) acc[book] = (acc[book] || 0) + 1;
    return acc;
  }, {});

  console.log("");
  console.log("BEST LINES MERGE COMPLETE");
  console.log("Rows:", rows.length);
  console.log("Markets:", markets);
  console.log("Best books:", books);
  console.log("Saved:", path.join(ROOT, OUTPUT));
}

main();