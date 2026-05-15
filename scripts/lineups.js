import fs from "fs";
import path from "path";
import https from "https";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(DATA_DIR, "lineups.csv");

function todayDate() {
  return process.argv[2] || new Date().toISOString().slice(0, 10);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        let data = "";

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";

  const str = String(value);

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

function battingOrderToSpot(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "";

  return Math.floor(n / 100);
}

async function fetchSchedule(date) {
  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,probablePitcher`;

  return getJson(url);
}

async function fetchLiveFeed(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;

  return getJson(url);
}

function getRowsFromSide(feed, side) {
  const box = feed?.liveData?.boxscore?.teams?.[side];
  const team = feed?.gameData?.teams?.[side];

  if (!box || !team) return [];

  const players = Object.values(box.players || {});

  return players
    .filter(player => player?.battingOrder)
    .map(player => ({
      name: player?.person?.fullName || "",
      team: team?.name || "",
      game: `${feed?.gameData?.teams?.away?.name || ""} @ ${feed?.gameData?.teams?.home?.name || ""}`,
      lineup_spot: battingOrderToSpot(player.battingOrder),
      commence_time: feed?.gameData?.datetime?.dateTime || "",
      game_pk: feed?.gamePk || "",
      side,
      status: feed?.gameData?.status?.detailedState || "",
      confirmed: "yes"
    }))
    .filter(row => row.name && row.team && row.lineup_spot);
}

function writeCsv(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const headers = [
    "name",
    "team",
    "game",
    "lineup_spot",
    "commence_time",
    "game_pk",
    "side",
    "status",
    "confirmed"
  ];

  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ];

  fs.writeFileSync(OUT_FILE, lines.join("\n"));
}

async function main() {
  const date = todayDate();
  const schedule = await fetchSchedule(date);
  const games = schedule?.dates?.[0]?.games || [];

  const rows = [];

  for (const game of games) {
    try {
      const feed = await fetchLiveFeed(game.gamePk);

      rows.push(...getRowsFromSide(feed, "away"));
      rows.push(...getRowsFromSide(feed, "home"));
    } catch (err) {
      console.error("Failed game:", game.gamePk, err.message);
    }
  }

  rows.sort((a, b) => {
    return (
      String(a.commence_time).localeCompare(String(b.commence_time)) ||
      String(a.game).localeCompare(String(b.game)) ||
      Number(a.lineup_spot) - Number(b.lineup_spot)
    );
  });

  if (rows.length === 0) {
    console.log("Done.");
    console.log("Date:", date);
    console.log("Games:", games.length);
    console.log("Confirmed lineup rows: 0");
    console.log("MLB has not posted confirmed batting orders yet.");
    console.log("Existing lineups.csv was NOT overwritten.");
    return;
  }

  writeCsv(rows);

  console.log("Done.");
  console.log("Date:", date);
  console.log("Games:", games.length);
  console.log("Confirmed lineup rows:", rows.length);
  console.log("Saved:", OUT_FILE);

  console.table(
    rows.slice(0, 50).map(row => ({
      name: row.name,
      team: row.team,
      spot: row.lineup_spot,
      game: row.game,
      status: row.status
    }))
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});