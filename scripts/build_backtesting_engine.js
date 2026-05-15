import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EXPORT_DIR = path.join(ROOT, "exports");
const TRACKING_DIR = path.join(DATA_DIR, "tracking");

const TODAY = new Date().toISOString().slice(0, 10);

const FILES = {
  simulation: path.join(DATA_DIR, "simulation_engine.csv"),
  stacks: path.join(DATA_DIR, "simulated_hr_stacks.csv"),
  results: path.join(DATA_DIR, "hr_results.csv"),
  tracker: path.join(TRACKING_DIR, "phase9_hr_tracking.csv"),
  stackTracker: path.join(TRACKING_DIR, "phase9_stack_tracking.csv")
};

const OUT_CSV = path.join(DATA_DIR, "backtesting_engine.csv");
const OUT_JSON = path.join(DATA_DIR, "backtesting_engine.json");
const OUT_STACK_CSV = path.join(DATA_DIR, "stack_backtesting_engine.csv");
const OUT_REPORT = path.join(EXPORT_DIR, "phase9_backtesting_report.txt");

function clean(v) {
  return String(v ?? "").trim();
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
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

function writeCSV(file, rows) {
  fs.writeFileSync(file, toCSV(rows));
}

function first(row, names, fallback = "") {
  for (const n of names) {
    if (row && row[n] !== undefined && clean(row[n]) !== "") return row[n];
  }
  return fallback;
}

function americanToDecimal(odds) {
  const o = num(odds);
  if (!o) return 0;
  if (o > 0) return 1 + o / 100;
  return 1 + 100 / Math.abs(o);
}

function impliedFromAmerican(odds) {
  const o = num(odds);
  if (!o) return 0;
  if (o > 0) return 100 / (o + 100);
  return Math.abs(o) / (Math.abs(o) + 100);
}

function playerResultKey(row) {
  const date = first(row, ["date", "game_date"], TODAY);
  const player = first(row, ["player", "name", "batter", "hitter"]);
  const game = first(row, ["game", "matchup", "game_key"]);
  return `${key(date)}|${key(player)}|${key(game)}`;
}

function stackKey(row) {
  const date = first(row, ["date", "game_date"], TODAY);
  const players = first(row, ["players", "stack_players"]);
  const game = first(row, ["game", "matchup", "game_key"]);
  return `${key(date)}|${key(players)}|${key(game)}`;
}

function resultLookup(rows) {
  const map = new Map();

  for (const r of rows) {
    const date = first(r, ["date", "game_date"], TODAY);
    const player = first(r, ["player", "name", "batter", "hitter"]);
    const game = first(r, ["game", "matchup", "game_key"]);
    if (!player || !game) continue;

    const hrRaw = first(r, ["hr", "home_run", "hit_hr", "result", "outcome"], "");
    let hit = "";

    if (["1", "yes", "y", "true", "hr", "hit", "win"].includes(key(hrRaw))) hit = "YES";
    else if (["0", "no", "n", "false", "loss", "miss"].includes(key(hrRaw))) hit = "NO";

    map.set(`${key(date)}|${key(player)}|${key(game)}`, {
      hit,
      raw: r
    });
  }

  return map;
}

function snapshotPlayerRows(simRows) {
  return simRows.map(r => {
    const odds = first(r, ["odds"]);
    const prob = num(first(r, ["adjusted_hr_probability", "raw_hr_probability"])) / 100;
    const decimal = americanToDecimal(odds);
    const ev = decimal ? prob * decimal - 1 : 0;

    return {
      date: TODAY,
      player: r.player,
      team: r.team,
      game: r.game,
      pitcher: r.pitcher,
      odds,
      decimal_odds: decimal ? decimal.toFixed(4) : "",
      market_implied_probability: first(r, ["market_implied_probability"]),
      model_probability: first(r, ["adjusted_hr_probability"]),
      model_fair_odds: r.model_fair_odds,
      ev_percent: r.ev_percent || (ev * 100).toFixed(2) + "%",
      edge_vs_market: r.edge_vs_market,
      consensus_score: r.consensus_score,
      composite_sim_score: r.composite_sim_score,
      correlation_score: r.correlation_score,
      probability_tier: r.probability_tier,
      value_label: r.value_label,
      betting_tier: r.betting_tier,
      consensus_decision: r.consensus_decision,
      consensus_confidence: r.consensus_confidence,
      result: "",
      profit_1u: "",
      clv_percent: "",
      closing_odds: ""
    };
  });
}

function snapshotStackRows(stackRows) {
  return stackRows.map(r => {
    return {
      date: TODAY,
      game: r.game,
      stack_size: r.stack_size,
      players: r.players,
      teams: r.teams,
      pitcher: r.pitcher,
      simulation_stack_type: r.simulation_stack_type,
      avg_player_hr_probability: r.avg_player_hr_probability,
      simulated_any_hr_probability: r.simulated_any_hr_probability,
      adjusted_all_hr_probability: r.adjusted_all_hr_probability,
      simulation_stack_score: r.simulation_stack_score,
      simulation_stack_grade: r.simulation_stack_grade,
      payout_profile: r.payout_profile,
      result: "",
      profit_1u: ""
    };
  });
}

function mergeSnapshots(existing, incoming, keyFn) {
  const map = new Map();

  for (const r of existing) {
    const k = keyFn(r);
    if (k) map.set(k, r);
  }

  for (const r of incoming) {
    const k = keyFn(r);
    if (!k) continue;

    if (!map.has(k)) {
      map.set(k, r);
    } else {
      const old = map.get(k);
      map.set(k, {
        ...r,
        result: old.result || r.result || "",
        profit_1u: old.profit_1u || r.profit_1u || "",
        clv_percent: old.clv_percent || r.clv_percent || "",
        closing_odds: old.closing_odds || r.closing_odds || ""
      });
    }
  }

  return [...map.values()];
}

function applyResults(trackerRows, resultRows) {
  const lookup = resultLookup(resultRows);

  let graded = 0;

  const out = trackerRows.map(r => {
    const k = playerResultKey(r);
    const found = lookup.get(k);

    if (!found || !found.hit) return r;

    const odds = num(r.odds);
    const decimal = americanToDecimal(odds);

    let profit = 0;

    if (found.hit === "YES") profit = decimal ? decimal - 1 : 0;
    if (found.hit === "NO") profit = -1;

    graded++;

    return {
      ...r,
      result: found.hit,
      profit_1u: profit.toFixed(4)
    };
  });

  return { rows: out, graded };
}

function summarizeBy(rows, field) {
  const map = new Map();

  for (const r of rows) {
    const group = clean(r[field]) || "UNKNOWN";

    if (!map.has(group)) {
      map.set(group, {
        group,
        bets: 0,
        wins: 0,
        losses: 0,
        pending: 0,
        profit: 0,
        avg_model_probability: 0,
        avg_ev: 0,
        items: []
      });
    }

    const bucket = map.get(group);
    const result = clean(r.result).toUpperCase();

    bucket.bets++;

    if (result === "YES") bucket.wins++;
    else if (result === "NO") bucket.losses++;
    else bucket.pending++;

    bucket.profit += num(r.profit_1u);
    bucket.items.push(r);
  }

  const out = [];

  for (const b of map.values()) {
    const graded = b.wins + b.losses;
    const hitRate = graded ? b.wins / graded : 0;
    const roi = graded ? b.profit / graded : 0;
    const avgProb = avg(b.items.map(r => num(r.model_probability) / 100));
    const avgEv = avg(b.items.map(r => num(r.ev_percent) / 100));

    out.push({
      group_by: field,
      group: b.group,
      bets: b.bets,
      graded,
      wins: b.wins,
      losses: b.losses,
      pending: b.pending,
      hit_rate: graded ? (hitRate * 100).toFixed(2) + "%" : "",
      profit_1u: b.profit.toFixed(4),
      roi: graded ? (roi * 100).toFixed(2) + "%" : "",
      avg_model_probability: avgProb ? (avgProb * 100).toFixed(2) + "%" : "",
      avg_ev: avgEv ? (avgEv * 100).toFixed(2) + "%" : ""
    });
  }

  out.sort((a, b) => num(b.roi) - num(a.roi));

  return out;
}

function calibrationBuckets(rows) {
  const buckets = [
    { name: "0 to 5%", min: 0, max: 0.05 },
    { name: "5 to 8%", min: 0.05, max: 0.08 },
    { name: "8 to 11%", min: 0.08, max: 0.11 },
    { name: "11 to 14%", min: 0.11, max: 0.14 },
    { name: "14 to 17%", min: 0.14, max: 0.17 },
    { name: "17 to 20%", min: 0.17, max: 0.20 },
    { name: "20% plus", min: 0.20, max: 1 }
  ];

  const out = [];

  for (const b of buckets) {
    const items = rows.filter(r => {
      const p = num(r.model_probability) / 100;
      return p >= b.min && p < b.max;
    });

    const graded = items.filter(r => ["YES", "NO"].includes(clean(r.result).toUpperCase()));
    const wins = graded.filter(r => clean(r.result).toUpperCase() === "YES").length;
    const losses = graded.length - wins;
    const hitRate = graded.length ? wins / graded.length : 0;
    const avgProb = avg(items.map(r => num(r.model_probability) / 100));
    const profit = graded.reduce((sum, r) => sum + num(r.profit_1u), 0);

    out.push({
      group_by: "calibration_bucket",
      group: b.name,
      bets: items.length,
      graded: graded.length,
      wins,
      losses,
      pending: items.length - graded.length,
      hit_rate: graded.length ? (hitRate * 100).toFixed(2) + "%" : "",
      expected_hit_rate: avgProb ? (avgProb * 100).toFixed(2) + "%" : "",
      calibration_gap: graded.length ? ((hitRate - avgProb) * 100).toFixed(2) + "%" : "",
      profit_1u: profit.toFixed(4),
      roi: graded.length ? ((profit / graded.length) * 100).toFixed(2) + "%" : ""
    });
  }

  return out;
}

function avg(values) {
  const good = values.filter(v => Number.isFinite(v));
  if (!good.length) return 0;
  return good.reduce((a, b) => a + b, 0) / good.length;
}

ensureDir(DATA_DIR);
ensureDir(EXPORT_DIR);
ensureDir(TRACKING_DIR);

const simRows = readCSV(FILES.simulation);
const stackRows = readCSV(FILES.stacks);
const resultRows = readCSV(FILES.results);

if (!simRows.length) {
  console.log("Missing simulation_engine.csv. Run build_simulation_engine.js first.");
  process.exit(1);
}

const existingTracker = readCSV(FILES.tracker);
const incomingTracker = snapshotPlayerRows(simRows);
let trackerRows = mergeSnapshots(existingTracker, incomingTracker, playerResultKey);

const resultApplied = applyResults(trackerRows, resultRows);
trackerRows = resultApplied.rows;

const existingStackTracker = readCSV(FILES.stackTracker);
const incomingStackTracker = snapshotStackRows(stackRows);
const stackTrackerRows = mergeSnapshots(existingStackTracker, incomingStackTracker, stackKey);

writeCSV(FILES.tracker, trackerRows);
writeCSV(FILES.stackTracker, stackTrackerRows);

const summaries = [
  ...summarizeBy(trackerRows, "betting_tier"),
  ...summarizeBy(trackerRows, "probability_tier"),
  ...summarizeBy(trackerRows, "value_label"),
  ...summarizeBy(trackerRows, "consensus_decision"),
  ...calibrationBuckets(trackerRows)
];

writeCSV(OUT_CSV, summaries);
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generated_at: new Date().toISOString(),
  tracking_rows: trackerRows.length,
  graded_results_applied: resultApplied.graded,
  summaries
}, null, 2));

const stackSummary = summarizeBy(stackTrackerRows, "simulation_stack_grade");
writeCSV(OUT_STACK_CSV, stackSummary);

const gradedRows = trackerRows.filter(r => ["YES", "NO"].includes(clean(r.result).toUpperCase()));
const totalProfit = gradedRows.reduce((sum, r) => sum + num(r.profit_1u), 0);
const wins = gradedRows.filter(r => clean(r.result).toUpperCase() === "YES").length;
const losses = gradedRows.length - wins;
const hitRate = gradedRows.length ? wins / gradedRows.length : 0;
const roi = gradedRows.length ? totalProfit / gradedRows.length : 0;

const report = [
  "THE SLIP LAB PHASE 9 BACKTESTING REPORT",
  "",
  `Date: ${TODAY}`,
  `Tracked player rows: ${trackerRows.length}`,
  `Tracked stack rows: ${stackTrackerRows.length}`,
  `Results file found: ${resultRows.length ? "YES" : "NO"}`,
  `Results applied this run: ${resultApplied.graded}`,
  "",
  "OVERALL GRADED PERFORMANCE",
  "",
  `Graded bets: ${gradedRows.length}`,
  `Wins: ${wins}`,
  `Losses: ${losses}`,
  `Hit rate: ${gradedRows.length ? (hitRate * 100).toFixed(2) + "%" : ""}`,
  `Profit at 1u flat: ${totalProfit.toFixed(4)}u`,
  `ROI: ${gradedRows.length ? (roi * 100).toFixed(2) + "%" : ""}`,
  "",
  "TOP GROUP SUMMARIES",
  "",
  ...summaries.slice(0, 25).map(r => {
    return `${r.group_by} | ${r.group} | Bets: ${r.bets} | Graded: ${r.graded} | Hit: ${r.hit_rate || "pending"} | ROI: ${r.roi || "pending"} | Profit: ${r.profit_1u}`;
  }),
  "",
  "FILES CREATED",
  "",
  "data/tracking/phase9_hr_tracking.csv",
  "data/tracking/phase9_stack_tracking.csv",
  "data/backtesting_engine.csv",
  "data/stack_backtesting_engine.csv",
  "exports/phase9_backtesting_report.txt",
  ""
].join("\n");

fs.writeFileSync(OUT_REPORT, report);

console.log("");
console.log("THE SLIP LAB PHASE 9 BACKTESTING ENGINE COMPLETE");
console.log("Tracked player rows:", trackerRows.length);
console.log("Tracked stack rows:", stackTrackerRows.length);
console.log("Results file found:", resultRows.length ? "YES" : "NO");
console.log("Results applied:", resultApplied.graded);
console.log("Saved:", FILES.tracker);
console.log("Saved:", FILES.stackTracker);
console.log("Saved:", OUT_CSV);
console.log("Saved:", OUT_JSON);
console.log("Saved:", OUT_STACK_CSV);
console.log("Saved:", OUT_REPORT);
console.log("");

console.table(summaries.slice(0, 20));
