import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const WEBSITE_DATA = path.join(ROOT, "website", "data");

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return rows;

  const headers = splitCsvLine(lines[0]).map(h => h.trim());

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  out.push(current);
  return out;
}

function readCsv(file) {
  const full = path.join(DATA, file);
  if (!fs.existsSync(full)) return [];
  return parseCsv(fs.readFileSync(full, "utf8"));
}

function readJson(file) {
  const full = path.join(DATA, file);
  if (!fs.existsSync(full)) return [];
  const parsed = JSON.parse(fs.readFileSync(full, "utf8"));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  return [];
}

function key(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function first(row, fields, fallback = "") {
  for (const field of fields) {
    if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== "") {
      return row[field];
    }
  }
  return fallback;
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : fallback;
}

function buildPitcherLookup() {
  const files = [
    "pitcher_stats.csv",
    "pitcher_attack.csv",
    "pitcher_splits_engine.csv",
    "pitcher_attack.json",
    "pitcher_splits_engine.json"
  ];

  const lookup = new Map();

  for (const file of files) {
    const rows = file.endsWith(".csv") ? readCsv(file) : readJson(file);

    for (const row of rows) {
      const name = first(row, [
        "pitcher",
        "name",
        "player_name",
        "pitcher_name",
        "probable_pitcher",
        "opposing_pitcher"
      ]);

      if (!name) continue;

      const k = key(name);
      const existing = lookup.get(k) || {};

      lookup.set(k, {
        ...existing,
        pitcher: name,
        pitcher_hand: first(row, [
          "pitcher_hand",
          "throws",
          "p_throws",
          "hand",
          "throw_hand",
          "pitcher_throws"
        ], existing.pitcher_hand || ""),
        pitcher_era: first(row, [
          "era",
          "pitcher_era",
          "season_era",
          "ERA"
        ], existing.pitcher_era || ""),
        whip: first(row, [
          "whip",
          "pitcher_whip",
          "WHIP"
        ], existing.whip || ""),
        k_rate: first(row, [
          "k_rate",
          "strikeout_rate",
          "k_pct",
          "K%"
        ], existing.k_rate || ""),
        barrel_allowed: first(row, [
          "barrel_allowed",
          "barrel_pct_allowed",
          "brl_allowed",
          "brl_pct"
        ], existing.barrel_allowed || ""),
        hard_hit_allowed: first(row, [
          "hard_hit_allowed",
          "hard_hit_pct_allowed",
          "hh_allowed",
          "hh_pct"
        ], existing.hard_hit_allowed || "")
      });
    }
  }

  return lookup;
}

function loadBoardRows() {
  const candidates = [
    "master_hr_model.json",
    "consensus_engine.json",
    "top_hr_plays.json",
    "hr_board.json",
    "master_hr_model.csv",
    "consensus_engine.csv",
    "hr_board.csv"
  ];

  let rows = [];

  for (const file of candidates) {
    const full = path.join(DATA, file);
    const websiteFull = path.join(WEBSITE_DATA, file);

    if (fs.existsSync(full)) {
      const loaded = file.endsWith(".csv") ? readCsv(file) : readJson(file);
      rows = rows.concat(loaded);
    } else if (fs.existsSync(websiteFull)) {
      const parsed = JSON.parse(fs.readFileSync(websiteFull, "utf8"));
      rows = rows.concat(Array.isArray(parsed) ? parsed : parsed.rows || []);
    }
  }

  return rows;
}

function normalizeRow(row, pitcherLookup) {
  const pitcher = first(row, [
    "pitcher",
    "opposing_pitcher",
    "probable_pitcher",
    "sp",
    "starter"
  ], "Unknown Pitcher");

  const pitcherInfo = pitcherLookup.get(key(pitcher)) || {};

  return {
    player: first(row, ["player", "name", "batter", "player_name"], "Unknown Player"),
    team: first(row, ["team", "player_team", "batting_team"], ""),
    game: first(row, ["game", "matchup", "game_label"], ""),
    pitcher,
    pitcher_hand: first(row, ["pitcher_hand", "hand", "p_throws"], pitcherInfo.pitcher_hand || ""),
    pitcher_era: first(row, ["pitcher_era", "era"], pitcherInfo.pitcher_era || ""),
    whip: first(row, ["whip", "pitcher_whip"], pitcherInfo.whip || ""),
    k_rate: first(row, ["k_rate", "strikeout_rate", "k_pct"], pitcherInfo.k_rate || ""),
    barrel_allowed: first(row, ["barrel_allowed", "barrel_pct_allowed"], pitcherInfo.barrel_allowed || ""),
    hard_hit_allowed: first(row, ["hard_hit_allowed", "hard_hit_pct_allowed"], pitcherInfo.hard_hit_allowed || ""),
    odds: first(row, ["odds", "best_odds", "price", "line"], ""),
    score: num(first(row, ["score", "final_score", "model_score", "hr_score", "consensus_score"], 50), 50),
    ev: num(first(row, ["ev", "edge", "value_score", "ev_percent"], 0), 0),
    barrel: num(first(row, ["barrel_rate", "barrel_pct", "barrel", "brl"], 0), 0),
    hardHit: num(first(row, ["hard_hit_rate", "hh_pct", "hard_hit", "hh"], 0), 0),
    weather: num(first(row, ["weather_score", "weather_boost", "wind_boost"], 0), 0),
    park: num(first(row, ["park_score", "park_factor_score", "park_boost"], 0), 0)
  };
}

function dedupe(rows) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    const k = [
      row.player,
      row.team,
      row.pitcher,
      row.game
    ].join("|").toLowerCase();

    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }

  return out;
}

function main() {
  if (!fs.existsSync(WEBSITE_DATA)) fs.mkdirSync(WEBSITE_DATA, { recursive: true });

  const pitcherLookup = buildPitcherLookup();
  const rawRows = loadBoardRows();

  const rows = dedupe(
    rawRows
      .map(row => normalizeRow(row, pitcherLookup))
      .filter(row => row.player && row.player !== "Unknown Player")
      .sort((a, b) => b.score - a.score)
  );

  const summary = {
    updated_at: new Date().toISOString(),
    rows: rows.length,
    pitchers_enriched: [...pitcherLookup.keys()].length,
    with_pitcher_hand: rows.filter(r => r.pitcher_hand).length,
    with_pitcher_era: rows.filter(r => r.pitcher_era).length
  };

  fs.writeFileSync(
    path.join(WEBSITE_DATA, "slate_intelligence.json"),
    JSON.stringify(rows, null, 2)
  );

  fs.writeFileSync(
    path.join(WEBSITE_DATA, "slate_intelligence_summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("SLATE INTELLIGENCE DATA EXPORTED");
  console.log("Rows:", summary.rows);
  console.log("Pitchers enriched:", summary.pitchers_enriched);
  console.log("With hand:", summary.with_pitcher_hand);
  console.log("With ERA:", summary.with_pitcher_era);
  console.log("Saved: website/data/slate_intelligence.json");
}

main();
