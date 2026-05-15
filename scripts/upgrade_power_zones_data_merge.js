import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const jsPath = path.join(ROOT, "power-zones.js");

let js = fs.readFileSync(jsPath, "utf8");

js = js.replace(
`const DATA_CANDIDATES = [
  "./data/top_hr_plays.json",
  "./data/slate_intelligence.json",
  "./data/value_hr_plays.json"
];`,
`const DATA_CANDIDATES = [
  "./data/top_hr_plays.json",
  "./data/value_hr_plays.json",
  "./data/slate_intelligence.json",
  "./data/slate_intelligence_summary.json",
  "./data/weather_page.json",
  "./data/weather_summary.json",
  "./data/park_dimensions.json"
];`
);

js = js.replace(
`async function loadFirstAvailable() {
  for (const url of DATA_CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : payload.rows || payload.players || payload.data || payload.plays || [];
      if (rows.length) return rows;
    } catch {}
  }
  return [];
}`,
`async function readJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    return Array.isArray(payload)
      ? payload
      : payload.rows || payload.players || payload.data || payload.plays || payload.games || [];
  } catch {
    return [];
  }
}

function keyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function playerKey(row) {
  return keyName(row.player || row.name || row.batter || row.hitter || row.player_name);
}

function gameKey(row) {
  return keyName(row.game || row.matchup || row.game_label || row.away_home || row.away_team + row.home_team);
}

function mergeRows(base, extra) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(extra || {})) {
    const current = merged[key];
    const missing =
      current === undefined ||
      current === null ||
      current === "" ||
      current === "N/A" ||
      current === 0 ||
      current === "0" ||
      current === "0.000";

    if (missing && value !== undefined && value !== null && value !== "") {
      merged[key] = value;
    }
  }

  return merged;
}

async function loadMergedRows() {
  const allFiles = await Promise.all(DATA_CANDIDATES.map(readJson));

  const primary = [
    ...allFiles[0],
    ...allFiles[1],
    ...allFiles[2]
  ];

  const extras = allFiles.flat();

  const byPlayer = new Map();
  const byGame = new Map();

  for (const row of extras) {
    const pk = playerKey(row);
    const gk = gameKey(row);

    if (pk) byPlayer.set(pk, mergeRows(byPlayer.get(pk) || {}, row));
    if (gk) byGame.set(gk, mergeRows(byGame.get(gk) || {}, row));
  }

  const seen = new Set();
  const merged = [];

  for (const row of primary) {
    const pk = playerKey(row);
    if (!pk || seen.has(pk)) continue;

    let next = { ...row };

    if (byPlayer.has(pk)) next = mergeRows(next, byPlayer.get(pk));

    const gk = gameKey(next);
    if (gk && byGame.has(gk)) next = mergeRows(next, byGame.get(gk));

    merged.push(next);
    seen.add(pk);
  }

  return merged;
}`
);

js = js.replace(
`async function loadData() {
  const rows = await loadFirstAvailable();
  allPlayers = rows.map(normalizeRow).filter(player => player.player !== "Unknown Player");
  updatedAt.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  render();
}`,
`async function loadData() {
  const rows = await loadMergedRows();
  allPlayers = rows.map(normalizeRow).filter(player => player.player !== "Unknown Player");
  updatedAt.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  render();
}`
);

js = js.replace(
`function getIso(row) {
  return num(row.iso ?? row.ISO ?? row.player_iso ?? row.season_iso, 0);
}

function getSlg(row) {
  return num(row.slg ?? row.SLG ?? row.player_slg ?? row.season_slg, 0);
}

function getHr(row) {
  return num(row.hr ?? row.HR ?? row.season_hr ?? row.home_runs ?? row.hr_2026, 0);
}`,
`function getIso(row) {
  return num(
    row.iso ??
    row.ISO ??
    row.player_iso ??
    row.season_iso ??
    row.recent_iso ??
    row.iso_2026 ??
    row.hitter_iso,
    0
  );
}

function getSlg(row) {
  return num(
    row.slg ??
    row.SLG ??
    row.player_slg ??
    row.season_slg ??
    row.recent_slg ??
    row.slg_2026 ??
    row.hitter_slg,
    0
  );
}

function getHr(row) {
  return num(
    row.hr ??
    row.HR ??
    row.season_hr ??
    row.home_runs ??
    row.hr_2026 ??
    row.hitter_hr ??
    row.recent_hr,
    0
  );
}`
);

js = js.replace(
`    pitcherHand: cleanText(row.pitcher_hand || row.p_hand || row.throws || ""),
    era: cleanText(row.era || row.pitcher_era || ""),
    weather: cleanText(row.weather_label || row.weather || ""),
    wind: cleanText(row.wind_text || row.wind || ""),
    barrel: num(row.barrel_pct ?? row.barrel_percent ?? row.barrel, 0),
    hardhit: num(row.hard_hit_pct ?? row.hardhit_pct ?? row.hard_hit, 0),
    xwoba: num(row.xwoba ?? row.xwOBA, 0),
    ev: num(row.ev ?? row.edge ?? row.expected_value, 0),`,
`    pitcherHand: cleanText(row.pitcher_hand || row.p_hand || row.throws || row.pitcher_throws || row.starter_hand || ""),
    era: cleanText(row.era || row.pitcher_era || row.starter_era || row.opposing_pitcher_era || ""),
    weather: cleanText(row.weather_label || row.weather || row.weather_boost_label || row.environment || ""),
    wind: cleanText(row.wind_text || row.wind || row.wind_label || ""),
    barrel: num(row.barrel_pct ?? row.barrel_percent ?? row.barrel ?? row.barrel_rate ?? row.barrelPct, 0),
    hardhit: num(row.hard_hit_pct ?? row.hardhit_pct ?? row.hard_hit ?? row.hard_hit_rate ?? row.hardHitPct, 0),
    xwoba: num(row.xwoba ?? row.xwOBA ?? row.expected_woba ?? row.xwoba_value, 0),
    ev: num(row.ev ?? row.edge ?? row.expected_value ?? row.value_edge ?? row.model_edge, 0),`
);

fs.writeFileSync(jsPath, js);

console.log("POWER ZONES DATA MERGE UPGRADED");
console.log("Updated: power-zones.js");
