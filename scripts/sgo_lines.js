import "dotenv/config";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const API_KEY = process.env.SGO_API_KEY;

const OUT_RAW = "data/sgo_odds_raw.json";
const OUT_LINES = "data/sgo_best_lines.csv";

const BASE_URL = "https://api.sportsgameodds.com/v2/events";

const LEAGUE_ID = "MLB";

const BOOKMAKERS = [
  "fanduel",
  "draftkings",
  "betmgm",
  "caesars",
  "espnbet",
  "bovada",
  "williamhill",
  "betonline",
  "betrivers"
];

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

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    "all_books"
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

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(path.join(ROOT, filePath)), {
    recursive: true
  });

  fs.writeFileSync(path.join(ROOT, filePath), JSON.stringify(data, null, 2));
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    console.error("");
    console.error("SportsGameOdds request failed");
    console.error("Status:", res.status);
    console.error(text);
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error("Could not parse SportsGameOdds response");
    console.error(text);
    return null;
  }
}

function buildUrl(cursor = "") {
  const params = new URLSearchParams();

  params.set("apiKey", API_KEY);
  params.set("leagueID", LEAGUE_ID);
  params.set("oddsAvailable", "true");

  if (cursor) {
    params.set("cursor", cursor);
  }

  return `${BASE_URL}?${params.toString()}`;
}

async function fetchAllEvents() {
  const all = [];
  let cursor = "";
  let page = 1;

  while (true) {
    const url = buildUrl(cursor);

    console.log(`Fetching SportsGameOdds page ${page}`);

    const data = await fetchJson(url);

    if (!data) break;

    const events = Array.isArray(data.data) ? data.data : [];

    all.push(...events);

    if (!data.nextCursor) break;

    cursor = data.nextCursor;
    page += 1;

    if (page > 25) break;
  }

  return all;
}

function getGameName(event) {
  const home =
    event?.teams?.home?.names?.long ||
    event?.teams?.home?.name ||
    event?.homeTeam ||
    event?.home_team ||
    "";

  const away =
    event?.teams?.away?.names?.long ||
    event?.teams?.away?.name ||
    event?.awayTeam ||
    event?.away_team ||
    "";

  if (away && home) return `${away} @ ${home}`;

  return event?.eventID || event?.id || "";
}

function getEventId(event) {
  return event.eventID || event.id || "";
}

function flattenObjectValues(obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.values(obj);
}

function findPlayerById(event, playerId) {
  const collections = [
    event.players,
    event.playersByID,
    event.statEntities,
    event.participants,
    event.entities
  ];

  for (const collection of collections) {
    if (!collection) continue;

    if (Array.isArray(collection)) {
      const found = collection.find(item => {
        return (
          clean(item.playerID) === playerId ||
          clean(item.statEntityID) === playerId ||
          clean(item.id) === playerId ||
          clean(item.entityID) === playerId
        );
      });

      if (found) return found;
    }

    if (typeof collection === "object") {
      const direct = collection[playerId];

      if (direct) return direct;

      const found = flattenObjectValues(collection).find(item => {
        return (
          clean(item.playerID) === playerId ||
          clean(item.statEntityID) === playerId ||
          clean(item.id) === playerId ||
          clean(item.entityID) === playerId
        );
      });

      if (found) return found;
    }
  }

  return null;
}

function getPlayerNameFromEntity(entity, playerId) {
  if (!entity) return playerId;

  return (
    entity.name ||
    entity.fullName ||
    entity.names?.long ||
    entity.names?.full ||
    entity.displayName ||
    entity.playerName ||
    playerId
  );
}

function getPlayerTeamFromEntity(entity) {
  if (!entity) return "";

  return (
    entity.team ||
    entity.teamID ||
    entity.teamName ||
    entity.team?.names?.long ||
    entity.team?.name ||
    ""
  );
}

function parseOddId(oddId) {
  const parts = clean(oddId).split("-");

  return {
    statId: parts[0] || "",
    statEntityId: parts[1] || "",
    periodId: parts[2] || "",
    betTypeId: parts[3] || "",
    sideId: parts[4] || ""
  };
}

function getLineValue(oddData, bookData) {
  return (
    bookData?.spread ??
    bookData?.line ??
    bookData?.points ??
    bookData?.point ??
    bookData?.total ??
    oddData?.spread ??
    oddData?.line ??
    oddData?.points ??
    oddData?.point ??
    oddData?.total ??
    ""
  );
}

function classifyMarket(oddId, oddData, bookData) {
  const parsed = parseOddId(oddId);

  if (
    parsed.statId === "batting_homeRuns" &&
    parsed.betTypeId === "yn" &&
    parsed.sideId === "yes"
  ) {
    return {
      market: "HR",
      line: "0.5"
    };
  }

  if (
    parsed.statId === "batting_hits" &&
    parsed.betTypeId === "yn" &&
    parsed.sideId === "yes"
  ) {
    return {
      market: "1+ Hit",
      line: "0.5"
    };
  }

  if (
    parsed.statId === "batting_totalBases" &&
    parsed.betTypeId === "ou" &&
    parsed.sideId === "over"
  ) {
    const rawLine = getLineValue(oddData, bookData);
    const lineText = clean(rawLine);
    const lineNum = num(lineText, null);

    if (lineNum === 1.5) {
      return {
        market: "2+ TB",
        line: "1.5"
      };
    }

    if (lineNum === 2.5) {
      return {
        market: "3+ TB",
        line: "2.5"
      };
    }

    if (lineNum === 3.5) {
      return {
        market: "4+ TB",
        line: "3.5"
      };
    }

    if (!lineText) {
      return {
        market: "2+ TB",
        line: "1.5"
      };
    }

    return {
      market: "TB",
      line: lineText
    };
  }

  return null;
}

function getBookOdds(bookData) {
  const odds =
    bookData?.odds ??
    bookData?.price ??
    bookData?.americanOdds ??
    bookData?.american ??
    "";

  return num(String(odds).replace("+", ""), null);
}

function getBookMap(oddData) {
  return (
    oddData?.byBookmaker ||
    oddData?.byBook ||
    oddData?.bookmakers ||
    oddData?.sportsbooks ||
    {}
  );
}

function addLine(map, line) {
  if (!line.player || !line.market || !line.book || line.odds === null) return;

  const key = [norm(line.player), line.market, line.line].join("|");

  if (!map.has(key)) {
    map.set(key, {
      player: line.player,
      player_key: norm(line.player),
      player_id: line.player_id,
      team: line.team,
      game: line.game,
      event_id: line.event_id,
      market: line.market,
      line: line.line,
      best_odds: line.odds,
      best_book: line.book,
      all: []
    });
  }

  const current = map.get(key);

  current.all.push({
    book: line.book,
    odds: line.odds
  });

  if (line.odds > current.best_odds) {
    current.best_odds = line.odds;
    current.best_book = line.book;
  }
}

function averageOdds(values) {
  if (!values.length) return "";
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getOddsObject(event) {
  return event.odds || event.oddsByID || event.markets || {};
}

function extractLines(events) {
  const map = new Map();

  for (const event of events) {
    const eventId = getEventId(event);
    const game = getGameName(event);
    const oddsObject = getOddsObject(event);

    for (const [oddId, oddData] of Object.entries(oddsObject)) {
      const parsed = parseOddId(oddId);

      if (!parsed.statEntityId || parsed.statEntityId === "all") continue;

      const bookMap = getBookMap(oddData);

      for (const [bookKeyRaw, bookData] of Object.entries(bookMap)) {
        const bookKey = clean(bookKeyRaw).toLowerCase();

        if (!BOOKMAKERS.includes(bookKey)) continue;

        const odds = getBookOdds(bookData);

        if (odds === null) continue;

        const marketInfo = classifyMarket(oddId, oddData, bookData);

        if (!marketInfo) continue;

        const playerEntity = findPlayerById(event, parsed.statEntityId);
        const player = clean(getPlayerNameFromEntity(playerEntity, parsed.statEntityId));
        const team = clean(getPlayerTeamFromEntity(playerEntity));

        addLine(map, {
          event_id: eventId,
          game,
          player,
          player_id: parsed.statEntityId,
          team,
          market: marketInfo.market,
          line: marketInfo.line,
          book: bookKey,
          odds
        });
      }
    }
  }

  return map;
}

function rowsFromMap(map) {
  return Array.from(map.values())
    .map(item => {
      const sortedBooks = item.all.sort((a, b) => b.odds - a.odds);

      return {
        player: item.player,
        player_key: item.player_key,
        player_id: item.player_id,
        team: item.team,
        game: item.game,
        event_id: item.event_id,
        market: item.market,
        line: item.line,
        best_odds: item.best_odds,
        best_book: item.best_book,
        book_count: item.all.length,
        market_average_odds: averageOdds(item.all.map(x => x.odds)),
        all_books: sortedBooks
          .map(x => `${x.book}:${x.odds > 0 ? "+" : ""}${x.odds}`)
          .join(" | ")
      };
    })
    .sort((a, b) => {
      if (a.market !== b.market) return a.market.localeCompare(b.market);
      return a.player.localeCompare(b.player);
    });
}

function printCoverage(rows) {
  const byBook = {};
  const byMarket = {};

  rows.forEach(row => {
    byMarket[row.market] = (byMarket[row.market] || 0) + 1;

    clean(row.all_books)
      .split("|")
      .map(x => x.trim())
      .filter(Boolean)
      .forEach(part => {
        const book = part.split(":")[0];
        byBook[book] = (byBook[book] || 0) + 1;
      });
  });

  console.log("");
  console.log("Markets:", byMarket);
  console.log("Books:", byBook);
}

async function main() {
  if (!API_KEY) {
    console.error("Missing SGO_API_KEY in .env");
    process.exit(1);
  }

  console.log("");
  console.log("SPORTSGAMEODDS LINE SWEEP");
  console.log("League:", LEAGUE_ID);
  console.log("Books:", BOOKMAKERS.join(", "));

  const events = await fetchAllEvents();

  writeJson(OUT_RAW, events);

  const map = extractLines(events);
  const rows = rowsFromMap(map);

  writeCsv(OUT_LINES, rows);

  console.log("");
  console.log("Done.");
  console.log("Events:", events.length);
  console.log("Best line rows:", rows.length);
  console.log("Saved:", path.join(ROOT, OUT_RAW));
  console.log("Saved:", path.join(ROOT, OUT_LINES));

  printCoverage(rows);
}

main();