import path from "path";
import {
  DATA_DIR,
  readCSV,
  writeCSV,
  normalizeName,
  normalizeTeam,
  num
} from "./normalize_utils.js";

const INPUTS = [
  path.join(DATA_DIR, "sgo_best_lines.csv"),
  path.join(DATA_DIR, "best_lines.csv")
];

const OUT = path.join(DATA_DIR, "hr_odds_clean.csv");
const REJECTS = path.join(DATA_DIR, "hr_odds_rejected.csv");

const TRUSTED_BOOKS = new Set([
  "fanduel",
  "draftkings",
  "betmgm",
  "fanatics",
  "caesars"
]);

const BOOK_DISPLAY = {
  fanduel: "FanDuel",
  draftkings: "DraftKings",
  betmgm: "BetMGM",
  fanatics: "Fanatics",
  caesars: "Caesars"
};

function cleanBook(v = "") {
  return String(v)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function displayBook(v = "") {
  return BOOK_DISPLAY[cleanBook(v)] || String(v || "").trim();
}

function oddsNum(v) {
  return num(String(v || "").replace("+", ""));
}

function median(values) {
  const arr = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function getField(row, names) {
  for (const n of names) {
    if (row[n] !== undefined && String(row[n]).trim() !== "") return row[n];
  }
  return "";
}

function normalizeTeamFromSGO(team = "") {
  return String(team || "")
    .replace(/_MLB$/i, "")
    .replace(/_/g, " ")
    .replace(/\bSTLOUIS\b/i, "ST LOUIS")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function isHRMarket(row) {
  const market = String(getField(row, ["market", "market_key", "prop", "bet_type", "stat"]) || "")
    .trim()
    .toUpperCase();

  return [
    "HR",
    "HOME RUN",
    "HOME_RUN",
    "BATTER_HOME_RUNS",
    "BATTER HOME RUNS"
  ].includes(market);
}

function parseAllBooks(v = "") {
  const out = [];

  for (const part of String(v || "").split("|")) {
    const clean = part.trim();
    if (!clean.includes(":")) continue;

    const splitAt = clean.lastIndexOf(":");
    const bookRaw = clean.slice(0, splitAt).trim();
    const oddsRaw = clean.slice(splitAt + 1).trim();

    const book = cleanBook(bookRaw);
    const odds = oddsNum(oddsRaw);

    if (!TRUSTED_BOOKS.has(book)) continue;
    if (!Number.isFinite(odds)) continue;
    if (odds < 100 || odds > 5000) continue;

    out.push({
      book,
      book_display: displayBook(book),
      odds
    });
  }

  return out;
}

function uniqueBookCount(candidates) {
  return new Set(candidates.map(c => c.book)).size;
}

function clusterSpread(candidates) {
  const odds = candidates.map(c => c.odds);
  const med = median(odds);
  if (!med) return 999;
  return (Math.max(...odds) - Math.min(...odds)) / med;
}

function sportsbookScore(candidates) {
  const books = new Set(candidates.map(c => c.book));
  let score = 0;

  if (books.has("fanduel")) score += 350;
  if (books.has("betmgm")) score += 300;
  if (books.has("draftkings")) score += 225;
  if (books.has("caesars")) score += 225;
  if (books.has("fanatics")) score += 175;

  return score;
}

function buildBestCluster(candidates) {
  const clusters = [];

  for (const base of candidates) {
    const cluster = candidates.filter(c => {
      const ratio = c.odds / base.odds;
      return ratio >= 0.72 && ratio <= 1.55;
    });

    if (uniqueBookCount(cluster) < 2) continue;

    const med = median(cluster.map(c => c.odds));
    const spread = clusterSpread(cluster);

    clusters.push({
      cluster,
      uniqueBooks: uniqueBookCount(cluster),
      median: med,
      spread,
      score:
        uniqueBookCount(cluster) * 10000 +
        sportsbookScore(cluster) -
        spread * 1000 -
        med * 0.08
    });
  }

  clusters.sort((a, b) => b.score - a.score);

  return clusters[0]?.cluster || [];
}

function dedupeClusterByBook(candidates) {
  const byBook = new Map();

  for (const c of candidates) {
    if (!byBook.has(c.book)) {
      byBook.set(c.book, c);
      continue;
    }

    const old = byBook.get(c.book);
    if (c.odds > old.odds) byBook.set(c.book, c);
  }

  return Array.from(byBook.values());
}

function qualityLabel(cluster, raw) {
  const spread = clusterSpread(cluster);
  const removed = raw.length - cluster.length;

  if (uniqueBookCount(cluster) >= 4 && spread <= 0.30 && removed === 0) return "CLEAN_CONSENSUS";
  if (uniqueBookCount(cluster) >= 3 && spread <= 0.45) return removed > 0 ? "CLEANED_CONSENSUS" : "NORMAL_CONSENSUS";
  if (uniqueBookCount(cluster) >= 2 && spread <= 0.60) return "USABLE_CONSENSUS";

  return "REJECT_WIDE_VARIANCE";
}

const accepted = [];
const rejected = [];

for (const file of INPUTS) {
  const rows = readCSV(file);

  for (const row of rows) {
    if (!isHRMarket(row)) continue;

    const player = getField(row, ["player", "name"]);
    const rawTeam = getField(row, ["team", "player_team"]);
    const team = normalizeTeamFromSGO(rawTeam);
    const game = getField(row, ["game", "matchup", "event"]);

    if (!player || !game) {
      rejected.push({
        player,
        team,
        game,
        reason: "MISSING_PLAYER_OR_GAME",
        source_file: path.basename(file)
      });
      continue;
    }

    const rawCandidates = parseAllBooks(getField(row, ["all_books"]));

    const bestBook = cleanBook(getField(row, ["best_book", "book"]));
    const bestOdds = oddsNum(getField(row, ["best_odds", "odds", "price"]));

    if (TRUSTED_BOOKS.has(bestBook) && bestOdds >= 100 && bestOdds <= 5000) {
      rawCandidates.push({
        book: bestBook,
        book_display: displayBook(bestBook),
        odds: bestOdds
      });
    }

    if (!rawCandidates.length) {
      rejected.push({
        player,
        team,
        game,
        reason: "NO_TRUSTED_BOOKS",
        source_file: path.basename(file)
      });
      continue;
    }

    let cluster = buildBestCluster(rawCandidates);
    cluster = dedupeClusterByBook(cluster);

    const quality = qualityLabel(cluster, rawCandidates);

    if (!cluster.length || quality === "REJECT_WIDE_VARIANCE") {
      rejected.push({
        player,
        team,
        game,
        reason: quality || "NO_VALID_CLUSTER",
        raw_books: rawCandidates.map(c => `${c.book_display}:+${c.odds}`).join(" | "),
        source_file: path.basename(file)
      });
      continue;
    }

    cluster.sort((a, b) => b.odds - a.odds);

    const best = cluster[0];
    const consensus = Math.round(median(cluster.map(c => c.odds)));

    accepted.push({
      player,
      player_key: normalizeName(player),
      team,
      team_key: normalizeTeam(team),
      game,
      game_key: normalizeTeam(game),
      market: "HR",
      line: "0.5",
      odds: best.odds,
      book: best.book_display,
      consensus_odds: consensus,
      trusted_books_count: uniqueBookCount(cluster),
      trusted_books: cluster.map(c => `${c.book_display}:+${c.odds}`).join(" | "),
      raw_books_seen: rawCandidates.map(c => `${c.book_display}:+${c.odds}`).join(" | "),
      removed_outliers: rawCandidates.length - cluster.length,
      odds_quality: quality,
      source_file: path.basename(file)
    });
  }
}

const deduped = new Map();

for (const row of accepted) {
  const key = `${normalizeName(row.player)}|${normalizeTeam(row.game)}`;

  if (!deduped.has(key)) {
    deduped.set(key, row);
    continue;
  }

  const old = deduped.get(key);

  const better =
    row.trusted_books_count > old.trusted_books_count ||
    (
      row.trusted_books_count === old.trusted_books_count &&
      row.odds > old.odds
    );

  if (better) deduped.set(key, row);
}

const finalRows = Array.from(deduped.values()).sort((a, b) => {
  if (b.trusted_books_count !== a.trusted_books_count) {
    return b.trusted_books_count - a.trusted_books_count;
  }

  return a.consensus_odds - b.consensus_odds;
});

writeCSV(OUT, finalRows);
writeCSV(REJECTS, rejected);

console.log("Clean HR odds complete.");
console.log(`Rows saved: ${finalRows.length}`);
console.log(`Rejected rows: ${rejected.length}`);
console.log(`Saved: ${OUT}`);
console.log(`Rejects: ${REJECTS}`);

console.table(finalRows.slice(0, 30).map(r => ({
  player: r.player,
  game: r.game,
  odds: r.odds,
  book: r.book,
  consensus: r.consensus_odds,
  books: r.trusted_books_count,
  removed: r.removed_outliers,
  quality: r.odds_quality,
  trusted: r.trusted_books
})));