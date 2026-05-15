import fs from "fs";
import path from "path";
import "dotenv/config";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const OUT_CSV = path.join(DATA, "vegas_totals.csv");
const OUT_JSON = path.join(DATA, "vegas_totals.json");

const API_KEY = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY;

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCSV(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(file, "");
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))
  ];

  fs.writeFileSync(file, lines.join("\n") + "\n");
}

function avg(nums) {
  const clean = nums.filter(n => Number.isFinite(n));
  if (!clean.length) return 0;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

async function main() {
  if (!API_KEY) {
    console.error("Missing ODDS_API_KEY in .env");
    process.exit(1);
  }

  fs.mkdirSync(DATA, { recursive: true });

  const url =
    "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds" +
    `?apiKey=${API_KEY}` +
    "&regions=us" +
    "&markets=totals" +
    "&oddsFormat=american";

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    console.error("Failed to fetch Vegas totals");
    console.error("Status:", res.status);
    console.error(text);
    process.exit(1);
  }

  const events = await res.json();
  const rows = [];

  for (const event of events) {
    const totals = [];

    for (const book of event.bookmakers || []) {
      for (const market of book.markets || []) {
        if (market.key !== "totals") continue;

        for (const outcome of market.outcomes || []) {
          const point = Number(outcome.point);
          if (Number.isFinite(point) && point >= 5 && point <= 15) {
            totals.push(point);
          }
        }
      }
    }

    const consensus = avg(totals);

    rows.push({
      event_id: event.id,
      commence_time: event.commence_time,
      away_team: event.away_team,
      home_team: event.home_team,
      game: `${event.away_team} @ ${event.home_team}`,
      vegas_total: consensus ? consensus.toFixed(1) : "",
      books_count: totals.length,
      source: "the_odds_api_totals"
    });
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2));
  writeCSV(OUT_CSV, rows);

  console.log("");
  console.log("THE SLIP LAB VEGAS TOTALS FETCH COMPLETE");
  console.log(`Games: ${rows.length}`);
  console.log(`With totals: ${rows.filter(r => r.vegas_total).length}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log("");

  console.table(rows.slice(0, 15));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
