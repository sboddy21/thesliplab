import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const API_KEY = process.env.ODDS_API_KEY;
const SPORT = "baseball_mlb";
const MARKET = "batter_home_runs";
const OUT_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(OUT_DIR, "hr_odds_flat.csv");

const BOOKS = [
  "fanduel",
  "draftkings",
  "betmgm",
  "caesars",
  "fanatics"
];

function csvEscape(value = "") {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCSV(file, rows) {
  const headers = [
    "game_id",
    "commence_time",
    "home_team",
    "away_team",
    "game",
    "book_key",
    "book",
    "market",
    "player",
    "odds"
  ];

  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ];

  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
}

function cleanPlayer(name = "") {
  return String(name)
    .normalize("NFKD")
    .replace(/[^\w\s'.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getEvents() {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT}/events`;

  const res = await axios.get(url, {
    params: { apiKey: API_KEY },
    timeout: 30000
  });

  return res.data || [];
}

async function getOdds(eventId) {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT}/events/${eventId}/odds`;

  try {
    const res = await axios.get(url, {
      params: {
        apiKey: API_KEY,
        regions: "us",
        markets: MARKET,
        oddsFormat: "american",
        bookmakers: BOOKS.join(",")
      },
      timeout: 30000
    });

    return res.data || null;
  } catch (err) {
    console.log(`Odds fetch failed for ${eventId}: ${err.response?.status || err.message}`);
    return null;
  }
}

function flatten(event, oddsData) {
  const rows = [];

  for (const book of oddsData?.bookmakers || []) {
    if (!BOOKS.includes(book.key)) continue;

    for (const market of book.markets || []) {
      if (market.key !== MARKET) continue;

      for (const outcome of market.outcomes || []) {
        if (!outcome.name || outcome.price === undefined) continue;

        rows.push({
          game_id: event.id,
          commence_time: event.commence_time,
          home_team: event.home_team,
          away_team: event.away_team,
          game: `${event.away_team} @ ${event.home_team}`,
          book_key: book.key,
          book: book.title,
          market: MARKET,
          player: cleanPlayer(outcome.name),
          odds: outcome.price
        });
      }
    }
  }

  return rows;
}

async function main() {
  if (!API_KEY) {
    console.error("Missing ODDS_API_KEY in .env");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("");
  console.log("THE SLIP LAB FULL HR ODDS SWEEP");
  console.log("");

  const events = await getEvents();
  console.log(`Events returned: ${events.length}`);

  const allRows = [];
  const gameSummaries = [];

  for (const event of events) {
    const game = `${event.away_team} @ ${event.home_team}`;
    const odds = await getOdds(event.id);
    const rows = flatten(event, odds);

    allRows.push(...rows);

    gameSummaries.push({
      game,
      rows: rows.length,
      books: new Set(rows.map(r => r.book_key)).size
    });

    console.log(`${game}: ${rows.length} HR rows`);
  }

  writeCSV(OUT_FILE, allRows);

  const uniqueGames = new Set(allRows.map(r => r.game));
  const uniquePlayers = new Set(allRows.map(r => r.player));

  console.log("");
  console.log("FULL HR ODDS SWEEP COMPLETE");
  console.log(`Games with HR odds: ${uniqueGames.size}`);
  console.log(`Unique players: ${uniquePlayers.size}`);
  console.log(`Rows saved: ${allRows.length}`);
  console.log(`Saved: ${OUT_FILE}`);
  console.log("");

  console.table(gameSummaries);
}

main().catch(err => {
  console.error(err.response?.data || err.message || err);
  process.exit(1);
});