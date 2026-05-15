import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");

const PLAYER_STATS = path.join(DATA_DIR, "player_stats.csv");
const OUT_STATUS = path.join(DATA_DIR, "live_slate_status.csv");
const OUT_JSON = path.join(DATA_DIR, "live_slate_status.json");

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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows.shift().map(h => clean(h));

  return {
    headers,
    rows: rows.map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = clean(r[i]));
      return obj;
    })
  };
}

function toCSV(rows, headers = null) {
  if (!rows.length && !headers) return "";

  const cols = headers || Object.keys(rows[0]);

  const esc = v => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return [
    cols.join(","),
    ...rows.map(r => cols.map(h => esc(r[h])).join(","))
  ].join("\n");
}

function readCSV(file) {
  if (!fs.existsSync(file)) return { headers: [], rows: [] };
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function first(row, names, fallback = "") {
  for (const n of names) {
    if (row && row[n] !== undefined && clean(row[n]) !== "") return row[n];
  }
  return fallback;
}

async function fetchJSON(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status}: ${url}`);
  }

  return await res.json();
}

function gameNameFromSchedule(game) {
  const away = clean(game?.teams?.away?.team?.name);
  const home = clean(game?.teams?.home?.team?.name);
  return `${away} @ ${home}`;
}

function classifyGame(game) {
  const detailed = clean(game?.status?.detailedState).toLowerCase();
  const abstractState = clean(game?.status?.abstractGameState).toLowerCase();
  const coded = clean(game?.status?.codedGameState).toLowerCase();

  if (abstractState === "final" || detailed.includes("final") || detailed.includes("game over")) {
    return "FINAL";
  }

  if (
    abstractState === "live" ||
    detailed.includes("in progress") ||
    coded === "i" ||
    coded === "m" ||
    coded === "n"
  ) {
    return "LIVE";
  }

  if (detailed.includes("postponed")) return "POSTPONED";
  if (detailed.includes("suspended")) return "SUSPENDED";
  if (detailed.includes("cancelled") || detailed.includes("canceled")) return "CANCELLED";
  if (detailed.includes("delayed")) return "DELAYED";

  if (
    abstractState === "preview" ||
    detailed.includes("scheduled") ||
    detailed.includes("pre game") ||
    detailed.includes("warmup") ||
    coded === "s" ||
    coded === "p"
  ) {
    return "UPCOMING";
  }

  return "UNKNOWN";
}

async function getSchedule(date) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;
  const json = await fetchJSON(url);
  return json?.dates?.[0]?.games || [];
}

function shouldKeep(status) {
  return status === "UPCOMING" || status === "DELAYED" || status === "UNKNOWN";
}

async function main() {
  ensureDir(DATA_DIR);
  ensureDir(SNAPSHOT_DIR);

  const parsed = readCSV(PLAYER_STATS);

  if (!parsed.rows.length) {
    console.log("Missing or empty data/player_stats.csv");
    process.exit(1);
  }

  const schedule = await getSchedule(TODAY);

  const statusMap = new Map();
  const statusRows = [];

  for (const game of schedule) {
    const gameName = gameNameFromSchedule(game);
    const status = classifyGame(game);
    const start = clean(game.gameDate);

    statusMap.set(key(gameName), {
      game: gameName,
      status,
      start,
      detailed_state: clean(game?.status?.detailedState),
      abstract_state: clean(game?.status?.abstractGameState)
    });

    statusRows.push({
      game: gameName,
      status,
      start,
      detailed_state: clean(game?.status?.detailedState),
      abstract_state: clean(game?.status?.abstractGameState)
    });
  }

  const backup = path.join(SNAPSHOT_DIR, `player_stats_before_live_slate_filter_${TODAY}.csv`);

  if (!fs.existsSync(backup)) {
    fs.copyFileSync(PLAYER_STATS, backup);
  }

  const kept = [];
  const removed = [];

  for (const row of parsed.rows) {
    const game = first(row, ["game", "matchup", "game_key"]);
    const found = statusMap.get(key(game));

    if (!found) {
      kept.push({
        ...row,
        live_slate_status: "NO_STATUS_MATCH"
      });
      continue;
    }

    if (shouldKeep(found.status)) {
      kept.push({
        ...row,
        live_slate_status: found.status
      });
    } else {
      removed.push({
        ...row,
        live_slate_status: found.status
      });
    }
  }

  const headers = [...parsed.headers];

  if (!headers.includes("live_slate_status")) {
    headers.push("live_slate_status");
  }

  fs.writeFileSync(PLAYER_STATS, toCSV(kept, headers));
  fs.writeFileSync(OUT_STATUS, toCSV(statusRows));
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    date: TODAY,
    original_rows: parsed.rows.length,
    kept_rows: kept.length,
    removed_rows: removed.length,
    backup,
    games: statusRows
  }, null, 2));

  console.log("");
  console.log("THE SLIP LAB LIVE SLATE FILTER COMPLETE");
  console.log("Date:", TODAY);
  console.log("Original rows:", parsed.rows.length);
  console.log("Kept rows:", kept.length);
  console.log("Removed rows:", removed.length);
  console.log("Backup:", backup);
  console.log("Updated:", PLAYER_STATS);
  console.log("Saved:", OUT_STATUS);
  console.log("Saved:", OUT_JSON);
  console.log("");

  const spread = statusRows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log("Game status spread:", spread);
  console.log("");

  console.table(statusRows.map(r => ({
    game: r.game,
    status: r.status,
    state: r.detailed_state
  })));
}

main().catch(err => {
  console.error("");
  console.error("LIVE SLATE FILTER FAILED");
  console.error(err.message);
  process.exit(1);
});
