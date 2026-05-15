import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const TRACKING_DIR = path.join(DATA_DIR, "tracking");

const TRACKING_FILE = path.join(TRACKING_DIR, "phase9_hr_tracking.csv");
const OUT_CSV = path.join(DATA_DIR, "hr_results.csv");
const OUT_JSON = path.join(DATA_DIR, "hr_results.json");

const TODAY = new Date().toISOString().slice(0, 10);

function clean(v) {
  return String(v ?? "").trim();
}

function key(v) {
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && q && n === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === "," && !q) {
      row.push(cur);
      cur = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && n === "\n") i++;
      row.push(cur);
      if (row.some(x => clean(x) !== "")) rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);
    if (row.some(x => clean(x) !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map(h => clean(h));

  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = clean(r[i]);
    });
    return obj;
  });
}

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);

  const esc = v => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return [
    headers.join(","),
    ...rows.map(r => headers.map(h => esc(r[h])).join(","))
  ].join("\n");
}

function readCSV(file) {
  if (!fs.existsSync(file)) return [];
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

async function fetchJSON(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status}: ${url}`);
  }

  return await res.json();
}

function normalizeGameFromTeams(away, home) {
  return `${away} @ ${home}`;
}

function gameKeyFromRow(row) {
  return key(row.game);
}

function playerKey(name) {
  return key(name);
}

function getDateRows(rows) {
  const dates = unique(rows.map(r => r.date || TODAY));
  return dates;
}

function isFinalGame(game) {
  const status = clean(game?.status?.detailedState).toLowerCase();
  const abstractState = clean(game?.status?.abstractGameState).toLowerCase();

  return (
    abstractState === "final" ||
    status.includes("final") ||
    status.includes("game over")
  );
}

async function getSchedule(date) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  const json = await fetchJSON(url);
  return json?.dates?.[0]?.games || [];
}

async function getBoxscore(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
  return await fetchJSON(url);
}

function collectHomeRunsFromBoxscore(boxscore) {
  const homers = new Map();

  const teams = ["away", "home"];

  for (const side of teams) {
    const players = boxscore?.teams?.[side]?.players || {};

    for (const playerObj of Object.values(players)) {
      const person = playerObj?.person || {};
      const name = clean(person.fullName);
      const batting = playerObj?.stats?.batting || {};
      const hr = Number(batting.homeRuns || 0);

      if (!name) continue;

      homers.set(playerKey(name), {
        player: name,
        home_runs: hr,
        hit: hr > 0 ? "YES" : "NO"
      });
    }
  }

  return homers;
}

async function main() {
  const trackingRows = readCSV(TRACKING_FILE);

  if (!trackingRows.length) {
    console.log("Missing tracking file or no rows:");
    console.log(TRACKING_FILE);
    console.log("Run node scripts/build_backtesting_engine.js first.");
    process.exit(1);
  }

  const dates = getDateRows(trackingRows);
  const gameMaps = new Map();

  for (const date of dates) {
    console.log(`Checking MLB schedule for ${date}`);

    const games = await getSchedule(date);

    for (const game of games) {
      const away = clean(game?.teams?.away?.team?.name);
      const home = clean(game?.teams?.home?.team?.name);
      const gameName = normalizeGameFromTeams(away, home);

      gameMaps.set(`${key(date)}|${key(gameName)}`, {
        date,
        game,
        gameName,
        gamePk: game.gamePk,
        final: isFinalGame(game)
      });
    }
  }

  const boxscoreCache = new Map();
  const results = [];

  let matchedGames = 0;
  let finalGames = 0;
  let pendingGames = 0;
  let matchedPlayers = 0;

  for (const row of trackingRows) {
    const date = row.date || TODAY;
    const game = row.game;
    const player = row.player;

    const gk = `${key(date)}|${gameKeyFromRow(row)}`;
    const gameInfo = gameMaps.get(gk);

    if (!gameInfo) {
      results.push({
        date,
        player,
        game,
        hr: "",
        home_runs: "",
        game_status: "NO_GAME_MATCH",
        source: "MLB_STATS_API"
      });
      continue;
    }

    matchedGames++;

    if (!gameInfo.final) {
      pendingGames++;
      results.push({
        date,
        player,
        game,
        hr: "",
        home_runs: "",
        game_status: "PENDING",
        source: "MLB_STATS_API"
      });
      continue;
    }

    finalGames++;

    if (!boxscoreCache.has(gameInfo.gamePk)) {
      const boxscore = await getBoxscore(gameInfo.gamePk);
      boxscoreCache.set(gameInfo.gamePk, collectHomeRunsFromBoxscore(boxscore));
    }

    const homerMap = boxscoreCache.get(gameInfo.gamePk);
    const found = homerMap.get(playerKey(player));

    if (!found) {
      results.push({
        date,
        player,
        game,
        hr: "",
        home_runs: "",
        game_status: "PLAYER_NOT_FOUND",
        source: "MLB_STATS_API"
      });
      continue;
    }

    matchedPlayers++;

    results.push({
      date,
      player,
      game,
      hr: found.hit,
      home_runs: found.home_runs,
      game_status: "FINAL",
      source: "MLB_STATS_API"
    });
  }

  fs.writeFileSync(OUT_CSV, toCSV(results));
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  const graded = results.filter(r => r.hr === "YES" || r.hr === "NO").length;
  const winners = results.filter(r => r.hr === "YES").length;
  const losses = results.filter(r => r.hr === "NO").length;

  console.log("");
  console.log("THE SLIP LAB HR RESULTS COMPLETE");
  console.log("Tracking rows:", trackingRows.length);
  console.log("Matched games:", matchedGames);
  console.log("Final game rows:", finalGames);
  console.log("Pending game rows:", pendingGames);
  console.log("Matched players:", matchedPlayers);
  console.log("Graded rows:", graded);
  console.log("HR winners:", winners);
  console.log("HR losses:", losses);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);
  console.log("");

  console.table(results.slice(0, 20));
}

main().catch(err => {
  console.error("");
  console.error("HR RESULTS FAILED");
  console.error(err.message);
  process.exit(1);
});
