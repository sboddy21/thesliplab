import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EXPORT_DIR = path.join(ROOT, "exports");

const FILES = {
  consensus: path.join(DATA_DIR, "consensus_engine.csv"),
  correlation: path.join(DATA_DIR, "correlation_engine.csv"),
  stacks: path.join(DATA_DIR, "hr_stack_builder.csv")
};

const OUT_PLAYER_CSV = path.join(DATA_DIR, "simulation_engine.csv");
const OUT_PLAYER_JSON = path.join(DATA_DIR, "simulation_engine.json");
const OUT_STACK_CSV = path.join(DATA_DIR, "simulated_hr_stacks.csv");
const OUT_STACK_JSON = path.join(DATA_DIR, "simulated_hr_stacks.json");
const OUT_TXT = path.join(EXPORT_DIR, "simulation_report.txt");

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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
    headers.forEach((h, i) => obj[h] = clean(r[i]));
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

function first(row, names, fallback = "") {
  for (const n of names) {
    if (row && row[n] !== undefined && clean(row[n]) !== "") return row[n];
  }
  return fallback;
}

function playerGameKey(row) {
  const player = key(first(row, ["player", "name", "batter", "hitter"]));
  const game = key(first(row, ["game", "matchup", "game_key"]));
  return player && game ? `${player}|${game}` : "";
}

function playerLookupKey(player, game) {
  return `${key(player)}|${key(game)}`;
}

function indexByPlayerGame(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = playerGameKey(r);
    if (k) map.set(k, r);
  }
  return map;
}

function americanToImplied(odds) {
  const o = num(odds, 0);
  if (!o) return 0;
  if (o > 0) return 100 / (o + 100);
  return Math.abs(o) / (Math.abs(o) + 100);
}

function fairOddsFromProb(prob) {
  const p = clamp(prob, 0.001, 0.999);
  if (p >= 0.5) return Math.round((p / (1 - p)) * -100);
  return Math.round(((1 - p) / p) * 100);
}

function evFromProbAndOdds(prob, odds) {
  const o = num(odds, 0);
  if (!o) return 0;

  const decimal = o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
  return prob * decimal - 1;
}

function estimatePlateAppearances(row) {
  const confidence = clean(row.confidence).toUpperCase();
  const decision = clean(row.decision).toUpperCase();
  const consensus = num(row.consensus_score);

  let pa = 4.05;

  if (decision.includes("STRONG")) pa += 0.18;
  if (decision.includes("CORE")) pa += 0.25;
  if (confidence.includes("HIGH")) pa += 0.12;
  if (consensus >= 74) pa += 0.08;
  if (consensus < 55) pa -= 0.12;

  return clamp(pa, 3.55, 4.85);
}

function modelProbability(row, corrRow) {
  const consensus = num(row.consensus_score);
  const matchup = num(row.matchup_score);
  const splits = num(row.pitcher_splits_score);
  const pitch = num(row.per_pitch_score);
  const weather = num(row.weather_environment_score);
  const market = num(row.market_score);
  const corr = num(first(corrRow, ["correlation_score"], 50));
  const odds = num(row.odds, 0);
  const marketImplied = americanToImplied(odds);

  const composite =
    consensus * 0.31 +
    matchup * 0.14 +
    splits * 0.18 +
    pitch * 0.16 +
    weather * 0.06 +
    market * 0.08 +
    corr * 0.07;

  let baseProb;

  if (composite >= 78) baseProb = 0.175;
  else if (composite >= 74) baseProb = 0.155 + (composite - 74) * 0.005;
  else if (composite >= 70) baseProb = 0.135 + (composite - 70) * 0.005;
  else if (composite >= 66) baseProb = 0.115 + (composite - 66) * 0.005;
  else if (composite >= 62) baseProb = 0.095 + (composite - 62) * 0.005;
  else if (composite >= 58) baseProb = 0.078 + (composite - 58) * 0.00425;
  else if (composite >= 54) baseProb = 0.062 + (composite - 54) * 0.004;
  else baseProb = 0.038 + Math.max(0, composite - 40) * 0.0017;

  const pa = estimatePlateAppearances(row);
  const paAdjustment = (pa - 4.05) * 0.014;

  let rawProb = baseProb + paAdjustment;

  if (weather >= 58) rawProb += 0.006;
  if (weather <= 46) rawProb -= 0.008;

  if (corr >= 58) rawProb += 0.005;
  if (corr <= 45) rawProb -= 0.004;

  if (odds > 0) {
    if (odds <= 275) rawProb += 0.012;
    else if (odds <= 375) rawProb += 0.008;
    else if (odds <= 500) rawProb += 0.004;
    else if (odds >= 800) rawProb -= 0.005;
  }

  rawProb = clamp(rawProb, 0.025, 0.235);

  let marketWeight = 0.18;

  if (odds > 0) {
    if (odds <= 275) marketWeight = 0.28;
    else if (odds <= 375) marketWeight = 0.24;
    else if (odds <= 500) marketWeight = 0.20;
    else if (odds <= 700) marketWeight = 0.16;
    else marketWeight = 0.12;
  }

  let adjustedProb = marketImplied
    ? rawProb * (1 - marketWeight) + marketImplied * marketWeight
    : rawProb;

  adjustedProb = clamp(adjustedProb, 0.025, 0.255);

  const bookTax = marketImplied ? clamp(marketImplied - adjustedProb, 0, 0.16) : 0;

  return {
    composite,
    rawProb,
    adjustedProb,
    marketImplied,
    bookTax
  };
}

function probabilityTier(prob) {
  if (prob >= 0.185) return "ELITE_PROBABILITY";
  if (prob >= 0.16) return "TOP_PROBABILITY";
  if (prob >= 0.135) return "STRONG_PROBABILITY";
  if (prob >= 0.11) return "PLAYABLE_PROBABILITY";
  if (prob >= 0.085) return "LEAN_PROBABILITY";
  return "THIN_PROBABILITY";
}

function valueLabel(ev, odds, prob, marketImplied) {
  if (!odds || !marketImplied) return "NO_MARKET";
  if (ev >= 0.15) return "PLUS_EV";
  if (ev >= 0.05) return "SMALL_EDGE";
  if (ev >= -0.08 && prob >= 0.13) return "FAIR_PRICE_PROBABILITY";
  if (ev >= -0.14 && prob >= 0.16) return "CHALK_BUT_LIVE";
  if (ev <= -0.30) return "OVERPRICED";
  if (ev <= -0.18) return "TAXED_PRICE";
  return "FAIR_OR_THIN";
}

function bettingTier(prob, ev, odds) {
  if (!odds) return "NO_ODDS";
  if (ev >= 0.12 && prob >= 0.09) return "BETTABLE_VALUE";
  if (ev >= 0.04 && prob >= 0.085) return "VALUE_LEAN";
  if (prob >= 0.17 && ev >= -0.16) return "HIGH_PROBABILITY_PLAY";
  if (prob >= 0.14 && ev >= -0.22) return "PROBABILITY_PLAY";
  if (prob >= 0.115 && ev >= -0.28) return "WATCHLIST";
  if (ev <= -0.30) return "PASS_OVERPRICED";
  return "PASS";
}

function stackPlayers(text) {
  return clean(text)
    .split("+")
    .map(s => clean(s))
    .filter(Boolean);
}

function avg(values) {
  const good = values.filter(v => Number.isFinite(v));
  if (!good.length) return 0;
  return good.reduce((a, b) => a + b, 0) / good.length;
}

function calibratedStackScore(stack, sims, anyHr, adjustedAllHr, corrBoost) {
  const size = num(stack.stack_size);
  const baseStack = num(stack.stack_score);
  const corr = num(stack.avg_correlation_score);
  const env = num(stack.avg_environment_score);
  const collapse = num(stack.avg_pitcher_collapse_score);
  const avgProb = avg(sims.map(s => s.prob));
  const avgEv = avg(sims.map(s => s.ev));

  let score =
    baseStack * 0.28 +
    corr * 0.18 +
    env * 0.13 +
    collapse * 0.13 +
    avgProb * 100 * 1.05 +
    anyHr * 100 * 0.28 +
    adjustedAllHr * 100 * 1.65 +
    corrBoost * 100 * 0.18 +
    clamp(avgEv * 0.04, -4, 5);

  if (size === 2) {
    if (adjustedAllHr >= 0.04) score += 12;
    else if (adjustedAllHr >= 0.03) score += 9;
    else if (adjustedAllHr >= 0.022) score += 6;
    else if (adjustedAllHr >= 0.016) score += 3;

    if (anyHr >= 0.32) score += 8;
    else if (anyHr >= 0.28) score += 6;
    else if (anyHr >= 0.24) score += 4;
    else if (anyHr >= 0.20) score += 2;
  }

  if (size === 3) {
    if (adjustedAllHr >= 0.0075) score += 12;
    else if (adjustedAllHr >= 0.005) score += 9;
    else if (adjustedAllHr >= 0.003) score += 6;
    else if (adjustedAllHr >= 0.0018) score += 3;

    if (anyHr >= 0.40) score += 8;
    else if (anyHr >= 0.34) score += 6;
    else if (anyHr >= 0.29) score += 4;
  }

  if (size === 4) {
    if (adjustedAllHr >= 0.0014) score += 12;
    else if (adjustedAllHr >= 0.0008) score += 9;
    else if (adjustedAllHr >= 0.00045) score += 6;
    else if (adjustedAllHr >= 0.00025) score += 3;

    if (anyHr >= 0.48) score += 8;
    else if (anyHr >= 0.42) score += 6;
    else if (anyHr >= 0.36) score += 4;
  }

  return clamp(score, 0, 100);
}

function stackGrade(score, anyHr, allHr, size) {
  const s = num(size);

  if (s === 2) {
    if (score >= 78 && allHr >= 0.032) return "SIM_ELITE_2MAN";
    if (score >= 70 && allHr >= 0.024) return "SIM_STRONG_2MAN";
    if (score >= 62 && allHr >= 0.016) return "SIM_PLAYABLE_2MAN";
    if (score >= 54 && anyHr >= 0.20) return "SIM_LEAN_2MAN";
    return "SIM_THIN_2MAN";
  }

  if (s === 3) {
    if (score >= 76 && allHr >= 0.006) return "SIM_ELITE_3MAN";
    if (score >= 68 && allHr >= 0.004) return "SIM_STRONG_3MAN";
    if (score >= 60 && allHr >= 0.0022) return "SIM_PLAYABLE_3MAN";
    if (score >= 52 && anyHr >= 0.30) return "SIM_LEAN_3MAN";
    return "SIM_THIN_3MAN";
  }

  if (s === 4) {
    if (score >= 74 && allHr >= 0.0011) return "SIM_ELITE_4MAN_LOTTO";
    if (score >= 66 && allHr >= 0.0007) return "SIM_STRONG_4MAN_LOTTO";
    if (score >= 58 && allHr >= 0.00035) return "SIM_PLAYABLE_4MAN_LOTTO";
    if (score >= 50 && anyHr >= 0.36) return "SIM_LEAN_4MAN_LOTTO";
    return "SIM_THIN_4MAN";
  }

  return "SIM_THIN_STACK";
}

function stackTypeLabel(size, anyHr, allHr) {
  const s = num(size);

  if (s === 2 && allHr >= 0.03) return "CORRELATED_2MAN_POWER_STACK";
  if (s === 2 && anyHr >= 0.25) return "2MAN_ANY_HR_ENVIRONMENT";
  if (s === 3 && allHr >= 0.004) return "CORRELATED_3MAN_LOTTO";
  if (s === 3 && anyHr >= 0.34) return "3MAN_GAME_ENVIRONMENT";
  if (s === 4 && allHr >= 0.0007) return "4MAN_DEEP_LOTTO";
  if (s === 4 && anyHr >= 0.42) return "4MAN_CHAOS_ENVIRONMENT";

  return "LOW_CORRELATION_STACK";
}

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const consensusRows = readCSV(FILES.consensus);
const correlationRows = readCSV(FILES.correlation);
const stackRows = readCSV(FILES.stacks);

const corrIndex = indexByPlayerGame(correlationRows);

const playerRows = [];

for (const row of consensusRows) {
  const corrRow = corrIndex.get(playerGameKey(row)) || {};
  const odds = num(row.odds, 0);

  const probs = modelProbability(row, corrRow);
  const ev = evFromProbAndOdds(probs.adjustedProb, odds);
  const fairOdds = fairOddsFromProb(probs.adjustedProb);
  const twoPlus = clamp(Math.pow(probs.adjustedProb, 2) * 0.42, 0, 0.065);

  playerRows.push({
    rank: 0,
    player: row.player,
    team: row.team,
    game: row.game,
    pitcher: row.pitcher,
    odds: row.odds,
    consensus_score: row.consensus_score,
    composite_sim_score: probs.composite.toFixed(2),
    correlation_score: first(corrRow, ["correlation_score"], ""),
    matchup_score: row.matchup_score,
    pitcher_splits_score: row.pitcher_splits_score,
    per_pitch_score: row.per_pitch_score,
    weather_environment_score: row.weather_environment_score,
    market_score: row.market_score,
    estimated_plate_appearances: estimatePlateAppearances(row).toFixed(2),
    raw_hr_probability: (probs.rawProb * 100).toFixed(2) + "%",
    adjusted_hr_probability: (probs.adjustedProb * 100).toFixed(2) + "%",
    no_hr_probability: ((1 - probs.adjustedProb) * 100).toFixed(2) + "%",
    two_plus_hr_probability: (twoPlus * 100).toFixed(3) + "%",
    market_implied_probability: probs.marketImplied ? (probs.marketImplied * 100).toFixed(2) + "%" : "",
    model_fair_odds: fairOdds,
    ev_percent: odds ? (ev * 100).toFixed(2) + "%" : "",
    edge_vs_market: probs.marketImplied ? ((probs.adjustedProb - probs.marketImplied) * 100).toFixed(2) + "%" : "",
    book_tax_estimate: probs.marketImplied ? (probs.bookTax * 100).toFixed(2) + "%" : "",
    probability_tier: probabilityTier(probs.adjustedProb),
    value_label: valueLabel(ev, odds, probs.adjustedProb, probs.marketImplied),
    betting_tier: bettingTier(probs.adjustedProb, ev, odds),
    consensus_decision: row.decision,
    consensus_confidence: row.confidence
  });
}

playerRows.sort((a, b) => {
  const order = {
    BETTABLE_VALUE: 7,
    VALUE_LEAN: 6,
    HIGH_PROBABILITY_PLAY: 5,
    PROBABILITY_PLAY: 4,
    WATCHLIST: 3,
    PASS: 2,
    PASS_OVERPRICED: 1,
    NO_ODDS: 0
  };

  const aRank = order[a.betting_tier] ?? 0;
  const bRank = order[b.betting_tier] ?? 0;

  if (bRank !== aRank) return bRank - aRank;
  return num(b.adjusted_hr_probability) - num(a.adjusted_hr_probability);
});

playerRows.forEach((r, i) => r.rank = i + 1);

const playerIndex = new Map();

for (const r of playerRows) {
  playerIndex.set(playerLookupKey(r.player, r.game), {
    prob: num(r.adjusted_hr_probability) / 100,
    rawProb: num(r.raw_hr_probability) / 100,
    ev: num(r.ev_percent),
    odds: num(r.odds),
    tier: r.betting_tier
  });
}

const stackSims = [];

for (const stack of stackRows) {
  const players = stackPlayers(stack.players);
  const game = stack.game;

  const sims = players
    .map(p => playerIndex.get(playerLookupKey(p, game)))
    .filter(Boolean);

  if (sims.length !== players.length) continue;

  const anyHr = 1 - sims.reduce((acc, p) => acc * (1 - p.prob), 1);
  const allHr = sims.reduce((acc, p) => acc * p.prob, 1);

  const corrBoost =
    num(stack.avg_correlation_score) * 0.0015 +
    num(stack.avg_environment_score) * 0.001 +
    num(stack.avg_pitcher_collapse_score) * 0.0011;

  const adjustedAllHr = allHr * (1 + corrBoost);
  const avgProb = avg(sims.map(s => s.prob));
  const avgEv = avg(sims.map(s => s.ev));

  const stackScore = calibratedStackScore(stack, sims, anyHr, adjustedAllHr, corrBoost);
  const grade = stackGrade(stackScore, anyHr, adjustedAllHr, stack.stack_size);
  const simType = stackTypeLabel(stack.stack_size, anyHr, adjustedAllHr);

  stackSims.push({
    rank: 0,
    game,
    stack_size: stack.stack_size,
    players: stack.players,
    teams: stack.teams,
    pitcher: stack.pitcher,
    stack_type: stack.stack_type,
    simulation_stack_type: simType,
    base_stack_score: stack.stack_score,
    avg_player_hr_probability: (avgProb * 100).toFixed(2) + "%",
    simulated_any_hr_probability: (anyHr * 100).toFixed(2) + "%",
    simulated_all_hr_probability: (allHr * 100).toFixed(4) + "%",
    adjusted_all_hr_probability: (adjustedAllHr * 100).toFixed(4) + "%",
    correlation_boost: (corrBoost * 100).toFixed(2) + "%",
    avg_ev_percent: avgEv.toFixed(2) + "%",
    simulation_stack_score: stackScore.toFixed(2),
    simulation_stack_grade: grade,
    payout_profile: stack.payout_profile
  });
}

stackSims.sort((a, b) => {
  const gradeOrder = {
    SIM_ELITE_2MAN: 9,
    SIM_STRONG_2MAN: 8,
    SIM_PLAYABLE_2MAN: 7,
    SIM_ELITE_3MAN: 7,
    SIM_STRONG_3MAN: 6,
    SIM_PLAYABLE_3MAN: 5,
    SIM_ELITE_4MAN_LOTTO: 5,
    SIM_STRONG_4MAN_LOTTO: 4,
    SIM_PLAYABLE_4MAN_LOTTO: 3,
    SIM_LEAN_2MAN: 3,
    SIM_LEAN_3MAN: 2,
    SIM_LEAN_4MAN_LOTTO: 1
  };

  const aGrade = gradeOrder[a.simulation_stack_grade] ?? 0;
  const bGrade = gradeOrder[b.simulation_stack_grade] ?? 0;

  if (bGrade !== aGrade) return bGrade - aGrade;
  return num(b.simulation_stack_score) - num(a.simulation_stack_score);
});

stackSims.forEach((r, i) => r.rank = i + 1);

fs.writeFileSync(OUT_PLAYER_CSV, toCSV(playerRows));
fs.writeFileSync(OUT_PLAYER_JSON, JSON.stringify(playerRows, null, 2));
fs.writeFileSync(OUT_STACK_CSV, toCSV(stackSims));
fs.writeFileSync(OUT_STACK_JSON, JSON.stringify(stackSims, null, 2));

const topProbability = [...playerRows]
  .sort((a, b) => num(b.adjusted_hr_probability) - num(a.adjusted_hr_probability))
  .slice(0, 20);

const topValue = [...playerRows]
  .filter(r => ["BETTABLE_VALUE", "VALUE_LEAN", "HIGH_PROBABILITY_PLAY", "PROBABILITY_PLAY", "WATCHLIST"].includes(r.betting_tier))
  .sort((a, b) => num(b.ev_percent) - num(a.ev_percent))
  .slice(0, 20);

const report = [
  "THE SLIP LAB PHASE 8 SIMULATION REPORT",
  "",
  "TOP HR PROBABILITY PLAYS",
  "",
  ...topProbability.map((r, i) => {
    return `${i + 1}. ${r.player} | ${r.team} | ${r.pitcher} | HR: ${r.adjusted_hr_probability} | Fair: ${r.model_fair_odds} | Odds: ${r.odds} | EV: ${r.ev_percent} | ${r.betting_tier}`;
  }),
  "",
  "TOP VALUE OR FAIR PRICE PLAYS",
  "",
  ...topValue.map((r, i) => {
    return `${i + 1}. ${r.player} | ${r.team} | ${r.pitcher} | EV: ${r.ev_percent} | HR: ${r.adjusted_hr_probability} | Fair: ${r.model_fair_odds} | Odds: ${r.odds} | ${r.betting_tier}`;
  }),
  "",
  "TOP SIMULATED SAME GAME HR STACKS",
  "",
  ...stackSims.slice(0, 25).map((r, i) => {
    return `${i + 1}. ${r.players} | ${r.game} | Score: ${r.simulation_stack_score} | All HR: ${r.adjusted_all_hr_probability} | Any HR: ${r.simulated_any_hr_probability} | ${r.simulation_stack_grade} | ${r.simulation_stack_type}`;
  }),
  ""
].join("\n");

fs.writeFileSync(OUT_TXT, report);

console.log("");
console.log("THE SLIP LAB PHASE 8 SIMULATION ENGINE COMPLETE");
console.log("Player simulations:", playerRows.length);
console.log("Stack simulations:", stackSims.length);
console.log("Saved:", OUT_PLAYER_CSV);
console.log("Saved:", OUT_PLAYER_JSON);
console.log("Saved:", OUT_STACK_CSV);
console.log("Saved:", OUT_STACK_JSON);
console.log("Saved:", OUT_TXT);
console.log("");

console.table(topProbability.slice(0, 15).map(r => ({
  rank: r.rank,
  player: r.player,
  team: r.team,
  odds: r.odds,
  consensus: r.consensus_score,
  composite: r.composite_sim_score,
  prob: r.adjusted_hr_probability,
  fair: r.model_fair_odds,
  ev: r.ev_percent,
  tier: r.betting_tier
})));

console.table(stackSims.slice(0, 15).map(r => ({
  rank: r.rank,
  players: r.players,
  game: r.game,
  score: r.simulation_stack_score,
  all_hr: r.adjusted_all_hr_probability,
  any_hr: r.simulated_any_hr_probability,
  grade: r.simulation_stack_grade,
  type: r.simulation_stack_type
})));
