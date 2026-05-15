import fs from "fs";
import path from "path";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const EXPORTS_DIR = path.join(ROOT_DIR, "exports");

const OUT_JSON = path.join(DATA_DIR, "master_hr_model.json");
const OUT_CSV = path.join(DATA_DIR, "master_hr_model.csv");
const OUT_EXPORT_JSON = path.join(EXPORTS_DIR, "master_hr_model.json");
const OUT_EXPORT_CSV = path.join(EXPORTS_DIR, "master_hr_model.csv");

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readFileSafe(filePath) {
  if (!exists(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur);
  return out;
}

function readCSV(filePath) {
  const raw = readFileSafe(filePath);
  if (!raw.trim()) return [];

  const lines = raw.split(/\r?\n/).filter(line => line.trim() !== "");
  if (!lines.length) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return cleanString(value).toLowerCase();
}

function num(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const cleaned = String(value).replace(/[%,$+]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function first(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return fallback;
}

function normalizeName(value) {
  let s = lower(value)
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/’/g, "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (s.includes(",")) {
    const parts = s.split(",").map(x => x.trim()).filter(Boolean);
    if (parts.length === 2) s = `${parts[1]} ${parts[0]}`;
  }

  return s;
}

function nameVariants(value) {
  const base = normalizeName(value);
  const parts = base.split(" ").filter(Boolean);
  const variants = new Set();

  if (base) variants.add(base);

  if (parts.length >= 2) {
    variants.add(`${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}`);
  }

  return [...variants];
}

function normalizeTeam(value) {
  return lower(value)
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function playerKey(name, team = "") {
  const n = normalizeName(name);
  const t = normalizeTeam(team);
  return t ? `${n}|${t}` : n;
}

function matchupKey(batter, pitcher) {
  return `${normalizeName(batter)}|${normalizeName(pitcher)}`;
}

function indexByPlayer(rows, nameKeys, teamKeys = []) {
  const map = new Map();

  for (const row of rows) {
    const team = first(row, teamKeys);

    for (const key of nameKeys) {
      const rawName = row[key];
      if (!rawName) continue;

      for (const variant of nameVariants(rawName)) {
        const exact = playerKey(variant, team);
        const loose = playerKey(variant);

        if (team) map.set(exact, row);
        if (!map.has(loose)) map.set(loose, row);
      }
    }
  }

  return map;
}

function indexByPitcher(rows, pitcherKeys) {
  const map = new Map();

  for (const row of rows) {
    const pitcher = first(row, pitcherKeys);
    if (!pitcher) continue;
    map.set(normalizeName(pitcher), row);
  }

  return map;
}

function indexByMatchup(rows, batterKeys, pitcherKeys) {
  const map = new Map();

  for (const row of rows) {
    const batter = first(row, batterKeys);
    const pitcher = first(row, pitcherKeys);
    if (!batter || !pitcher) continue;
    map.set(matchupKey(batter, pitcher), row);
  }

  return map;
}

function getFromIndex(index, name, team = "") {
  return index.get(playerKey(name, team)) || index.get(playerKey(name)) || null;
}

function indexById(rows, idKeys) {
  const map = new Map();

  for (const row of rows) {
    for (const key of idKeys) {
      const id = cleanString(row[key]);
      if (id) map.set(id, row);
    }
  }

  return map;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCSV(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "");
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ];

  fs.writeFileSync(filePath, lines.join("\n"));
}

function clamp(value, min = 0, max = 99) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function americanToImplied(odds) {
  const o = num(odds);
  if (!o) return 0;
  if (o > 0) return 100 / (o + 100) * 100;
  return Math.abs(o) / (Math.abs(o) + 100) * 100;
}

function normalizeRate(value) {
  const n = num(value);
  if (!n) return 0;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

function normalizeSlash(value) {
  const n = num(value);
  if (!n) return 0;
  if (n > 5) return n / 1000;
  return n;
}

function scaleScore(value) {
  const n = num(value);

  if (n <= 0) return 0;
  if (n <= 1) return n * 100;
  if (n <= 10) return n * 10;

  // The Slip Lab older model scores are usually on a 0 to 40 scale.
  // Example: 34.5 should grade like an 80 plus, not a 34.5.
  if (n <= 40) return clamp(n * 2.45, 0, 99);

  // Scores between 40 and 60 are usually compressed model scores.
  if (n <= 60) return clamp(n * 1.55, 0, 99);

  if (n <= 100) return n;

  return clamp(n / 10, 0, 99);
}

function firstUseful(rowList, keys, fallback = "") {
  for (const row of rowList) {
    for (const key of keys) {
      if (!row) continue;
      const value = row[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== "" &&
        Number(String(value).replace(/[%,$+]/g, "").trim()) !== 0
      ) {
        return value;
      }
    }
  }

  return fallback;
}

function statcastScore({ barrelRate, hardHitRate, launchAngle, flyballRate, iso, slg, xslg }) {
  const brl = normalizeRate(barrelRate);
  const hh = normalizeRate(hardHitRate);
  const fb = normalizeRate(flyballRate);
  const la = num(launchAngle);
  const isoN = normalizeSlash(iso);
  const slgN = normalizeSlash(slg);
  const xslgN = normalizeSlash(xslg);

  const hasAny = brl > 0 || hh > 0 || fb > 0 || la > 0 || isoN > 0 || slgN > 0 || xslgN > 0;
  if (!hasAny) return 55;

  let score = 50;

  if (brl > 0) score += clamp((brl - 8) * 2.4, -8, 24);
  if (hh > 0) score += clamp((hh - 39) * 0.75, -7, 17);
  if (fb > 0) score += clamp((fb - 32) * 0.45, -5, 12);
  if (isoN > 0) score += clamp((isoN - 0.160) * 95, -7, 18);
  if (slgN > 0) score += clamp((slgN - 0.410) * 48, -5, 12);
  if (xslgN > 0) score += clamp((xslgN - 0.410) * 52, -5, 12);

  if (la >= 12 && la <= 24) score += 7;
  else if (la >= 8 && la <= 30) score += 3;
  else if (la > 0) score -= 3;

  return clamp(score, 35, 99);
}

function marketScore({ bestOdds, impliedProbability, ev, edge }) {
  let implied = num(impliedProbability);
  if (!implied && bestOdds) implied = americanToImplied(bestOdds);

  let score = 45;

  if (bestOdds) {
    if (bestOdds <= 300) score += 22;
    else if (bestOdds <= 400) score += 18;
    else if (bestOdds <= 500) score += 13;
    else if (bestOdds <= 650) score += 8;
    else if (bestOdds <= 850) score += 3;
    else score -= 3;
  }

  score += clamp((implied - 10) * 2.5, -10, 20);
  score += clamp(num(ev) * 0.09, -10, 16);
  score += clamp(num(edge) * 0.18, -8, 14);

  return clamp(score, 0, 99);
}

function matchupScore({
  pitcherHr9,
  pitcherEra,
  pitcherAttackScore,
  parkFactor,
  weatherBoost,
  vegasTotal,
  recentFormScore,
  trendScore,
  pitchTypeScore,
  bullpenScore
}) {
  let score = 45;

  score += clamp(scaleScore(pitcherAttackScore) * 0.30, 0, 28);
  score += clamp((pitcherHr9 - 1.0) * 9, -8, 18);
  score += clamp((pitcherEra - 4.00) * 3, -8, 12);

  if (parkFactor > 0) {
    if (parkFactor > 10) score += clamp((parkFactor - 100) * 0.25, -8, 12);
    else score += clamp((parkFactor - 1) * 45, -8, 12);
  }

  score += clamp(weatherBoost, -8, 12);
  score += clamp((vegasTotal - 8) * 3.5, -7, 12);
  score += clamp(scaleScore(recentFormScore) * 0.12, 0, 12);
  score += clamp(scaleScore(trendScore) * 0.10, 0, 10);
  score += clamp(scaleScore(pitchTypeScore) * 0.13, 0, 13);
  score += clamp(scaleScore(bullpenScore) * 0.08, 0, 8);

  return clamp(score, 0, 99);
}

function finalComposite({
  existingHrScore,
  existingModelScore,
  statScore,
  market,
  matchup,
  ev,
  edge,
  bestOdds,
  lineupSpot
}) {
  const hr = scaleScore(existingHrScore);
  const model = scaleScore(existingModelScore);

  let score = 0;
  let weight = 0;

  if (hr > 0) {
    score += hr * 0.28;
    weight += 0.28;
  }

  if (model > 0) {
    score += model * 0.16;
    weight += 0.16;
  }

  score += statScore * 0.24;
  score += market * 0.16;
  score += matchup * 0.16;
  weight += 0.56;

  if (weight > 0) score = score / weight;

  const spot = num(lineupSpot);
  if (spot >= 1 && spot <= 4) score += 4;
  else if (spot >= 5 && spot <= 6) score += 1.5;
  else if (spot >= 8) score -= 3;

  if (num(ev) > 0) score += clamp(num(ev) * 0.025, 0, 5);
  if (num(edge) > 0) score += clamp(num(edge) * 0.05, 0, 4);

  if (bestOdds >= 700 && score >= 70) score -= 5;
  if (bestOdds >= 900 && score >= 65) score -= 7;

  return round1(clamp(score, 0, 99));
}

function safeTier(score, ev, odds) {
  if (score >= 85) return "ELITE";
  if (score >= 75) return "STRONG";
  if (score >= 65 && ev > 0) return "VALUE";
  if (score >= 65) return "GOOD";
  if (score >= 55) return "STANDARD";
  if (odds >= 600 && score >= 48) return "LOTTO";
  if (score >= 45) return "WATCH";
  return "DEEP FADE";
}

function safeConfidence(score, lineupStatus, oddsFound) {
  let c = score;

  if (lower(lineupStatus).includes("confirmed")) c += 4;
  if (lower(lineupStatus).includes("projected")) c -= 2;
  if (!oddsFound) c -= 8;

  if (c >= 80) return "HIGH";
  if (c >= 67) return "MEDIUM";
  if (c >= 52) return "LOW";
  return "SPECULATIVE";
}

function main() {
  if (!exists(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const files = {
    playerStats: path.join(DATA_DIR, "player_stats.csv"),
    pitcherStats: path.join(DATA_DIR, "pitcher_stats.csv"),
    advancedHitters: path.join(DATA_DIR, "advanced_hitter_stats.csv"),
    statcastBatters: path.join(DATA_DIR, "statcast_batter_stats.csv"),
    weatherBoost: path.join(DATA_DIR, "weather_boost.csv"),
    weather: path.join(DATA_DIR, "weather.csv"),
    recentForm: path.join(DATA_DIR, "recent_form.csv"),
    pitchTypes: path.join(DATA_DIR, "pitch_type_matchups.csv"),
    bullpenUsage: path.join(DATA_DIR, "bullpen_usage.csv"),
    bestLines: path.join(DATA_DIR, "best_lines.csv"),
    hrBoard: path.join(EXPORTS_DIR, "hr_board.csv"),
    pitcherAttack: path.join(EXPORTS_DIR, "pitcher_attack_sheet.csv"),
    hrModel: path.join(EXPORTS_DIR, "hr_model.csv")
  };

  const playerStats = readCSV(files.playerStats);
  const pitcherStats = readCSV(files.pitcherStats);
  const advancedHitters = readCSV(files.advancedHitters);
  const statcastBatters = readCSV(files.statcastBatters);
  const weatherBoost = readCSV(files.weatherBoost);
  const weather = readCSV(files.weather);
  const recentForm = readCSV(files.recentForm);
  const pitchTypes = readCSV(files.pitchTypes);
  const bullpenUsage = readCSV(files.bullpenUsage);
  const bestLines = readCSV(files.bestLines);
  const hrBoard = readCSV(files.hrBoard);
  const pitcherAttack = readCSV(files.pitcherAttack);
  const hrModel = readCSV(files.hrModel);

  const hrBoardIndex = indexByPlayer(hrBoard, ["name", "player", "batter"], ["team"]);
  const hrModelIndex = indexByPlayer(hrModel, ["name", "player", "batter"], ["team"]);
  const recentIndex = indexByPlayer(recentForm, ["name", "player", "batter"], ["team"]);
  const bestLinesIndex = indexByPlayer(bestLines, ["name", "player", "batter", "description"], ["team"]);
  const advancedIndex = indexByPlayer(advancedHitters, ["name", "player", "batter", "last_name, first_name"], ["team"]);
  const statcastIndex = indexByPlayer(statcastBatters, ["name", "player", "batter", "player_key", "last_name, first_name"], ["team"]);
  const advancedIdIndex = indexById(advancedHitters, ["player_id", "mlbam"]);
  const statcastIdIndex = indexById(statcastBatters, ["mlbam", "player_id"]);

  const pitcherIndex = indexByPitcher(pitcherStats, ["pitcher", "name", "starter"]);
  const attackPitcherIndex = indexByPitcher(pitcherAttack, ["pitcher", "opposing_pitcher", "starter"]);
  const pitchTypeIndex = indexByMatchup(pitchTypes, ["batter", "name", "player"], ["pitcher", "opposing_pitcher", "starter"]);

  const weatherIndex = new Map();
  for (const row of [...weatherBoost, ...weather]) {
    const game = first(row, ["game", "matchup"]);
    const team = first(row, ["team", "home_team", "away_team"]);
    if (game) weatherIndex.set(lower(game), row);
    if (team) weatherIndex.set(normalizeTeam(team), row);
  }

  const bullpenIndex = new Map();
  for (const row of bullpenUsage) {
    const team = first(row, ["team"]);
    if (team) bullpenIndex.set(normalizeTeam(team), row);
  }

  const baseRows = playerStats.length ? playerStats : hrBoard;
  const master = [];

  for (const p of baseRows) {
    const name = cleanString(first(p, ["name", "player", "batter"]));
    if (!name) continue;

    const team = cleanString(first(p, ["team"]));
    const opponent = cleanString(first(p, ["opponent", "opp", "away_team", "home_team"]));
    const pitcher = cleanString(first(p, ["pitcher", "opposing_pitcher", "starter"]));

    const hr = getFromIndex(hrBoardIndex, name, team) || {};
    const hm = getFromIndex(hrModelIndex, name, team) || {};
    const rf = getFromIndex(recentIndex, name, team) || {};
    const bl = getFromIndex(bestLinesIndex, name, team) || {};
    const mlbam = cleanString(first(p, ["mlbam", "player_id"]));
    const adv = advancedIdIndex.get(mlbam) || getFromIndex(advancedIndex, name, team) || {};
    const sc = statcastIdIndex.get(mlbam) || getFromIndex(statcastIndex, name, team) || {};
    const ps = pitcherIndex.get(normalizeName(pitcher)) || {};
    const pa = attackPitcherIndex.get(normalizeName(pitcher)) || {};
    const pt = pitchTypeIndex.get(matchupKey(name, pitcher)) || {};

    const game = cleanString(first(p, ["game", "matchup"]) || first(hr, ["game", "matchup"]));
    const wx = weatherIndex.get(lower(game)) || weatherIndex.get(normalizeTeam(team)) || {};
    const bp = bullpenIndex.get(normalizeTeam(opponent)) || {};

    const bestOdds = num(first(hr, ["odds", "best_odds", "hr_odds"], first(bl, ["odds", "best_odds", "price"])));
    const bestBook = cleanString(first(hr, ["book", "best_book", "sportsbook"], first(bl, ["book", "best_book", "sportsbook"])));
    const implied = num(first(hr, ["implied_probability", "implied", "imp_prob"], first(bl, ["implied_probability", "implied", "imp_prob"]))) || americanToImplied(bestOdds);
    const ev = num(first(hr, ["ev"], first(bl, ["ev"])));
    const edge = num(first(hr, ["edge"], first(bl, ["edge"])));

    const barrelRate = firstUseful([sc, p, adv, hr], ["barrel_rate", "barrel%", "barrel_pct", "brl_percent", "brl", "barrels"]);
    const hardHitRate = firstUseful([sc, p, adv, hr], ["hard_hit_rate", "hard_hit%", "hard_hit_pct", "hh_percent", "hh"]);
    const launchAngle = firstUseful([p, adv, sc, hr], ["launch_angle", "launch_angle_avg", "avg_launch_angle", "la"]);
    const flyballRate = firstUseful([sc, p, adv, hr], ["flyball_rate", "fb_rate", "fb%", "fb_pct", "fly_ball_rate", "flyball_pct"]);
    const iso = firstUseful([p, adv, sc, hr], ["iso", "ISO", "isolated_power"]);
    const slg = firstUseful([p, adv, sc, hr], ["slg", "SLG", "slugging"]);
    const xslg = firstUseful([p, adv, sc, hr], ["xslg", "xSLG", "expected_slugging", "est_slg"]);

    const pitcherEra = num(first(ps, ["era", "ERA"], first(pa, ["era", "ERA"])));
    const pitcherHr9 = num(first(ps, ["hr9", "hr_per_9", "HR/9"], first(pa, ["hr9", "hr_per_9", "HR/9"])));
    const pitcherHand = cleanString(first(ps, ["hand", "pitcher_hand"], first(pa, ["hand", "pitcher_hand"])));
    const pitcherAttackScore = num(first(pa, ["score", "pitcher_attack_score", "attack_score"], first(p, ["pitcher_attack_score"])));

    const parkFactor = num(first(p, ["park_factor"], first(wx, ["park_factor", "pf"])), 1);
    const weatherBoostScore = num(first(p, ["weather_boost"], first(wx, ["weather_boost", "boost", "hr_env"])));
    const vegasTotal = num(first(p, ["vegas_total", "total"], first(hr, ["vegas_total", "total"])));
    const recentFormScore = num(first(rf, ["recent_form_score", "form_score", "score"], first(p, ["recent_form_score"])));
    const trendScore = num(first(p, ["trend_score"], first(rf, ["trend_score"])));
    const pitchTypeScore = num(first(pt, ["score", "pitch_type_score", "matchup_score"]));
    const bullpenScore = num(first(bp, ["score", "bullpen_score"]));

    const existingHrScore = num(first(hr, ["score", "hr_score"], first(hm, ["hr_score", "score"])));

    const existingModelScore = num(first(
      p,
      ["final_score", "score", "model_score"],
      first(hm, ["model_score", "score"], first(hr, ["score", "hr_score"]))
    ));

    const rawStatcastScore = num(first(p, ["statcast_score", "statcast", "power_score"], first(hr, ["statcast_score", "statcast", "power_score"])));

    let statScore = statcastScore({
      barrelRate,
      hardHitRate,
      launchAngle,
      flyballRate,
      iso,
      slg,
      xslg
    });

    if (
      statScore === 55 &&
      rawStatcastScore > 0
    ) {
      statScore = scaleScore(rawStatcastScore);
    }

    const market = marketScore({
      bestOdds,
      impliedProbability: implied,
      ev,
      edge
    });

    const matchup = matchupScore({
      pitcherHr9,
      pitcherEra,
      pitcherAttackScore,
      parkFactor,
      weatherBoost: weatherBoostScore,
      vegasTotal,
      recentFormScore,
      trendScore,
      pitchTypeScore,
      bullpenScore
    });

    const lineupSpot = cleanString(first(p, ["lineup", "lineup_spot", "batting_order"], first(hr, ["lineup", "lineup_spot"])));
    const lineupStatus = cleanString(first(p, ["lineup_status", "confirmed"], first(hr, ["lineup_status", "confirmed"])));

    const compositeScore = finalComposite({
      existingHrScore,
      existingModelScore,
      statScore,
      market,
      matchup,
      ev,
      edge,
      bestOdds,
      lineupSpot
    });

    master.push({
      generated_at: new Date().toISOString(),
      date: cleanString(first(p, ["date"], first(hr, ["date"]))),
      name,
      team,
      opponent,
      game,
      lineup_spot: lineupSpot,
      lineup_status: lineupStatus,
      handedness: cleanString(first(p, ["hand", "batter_hand", "stand"], first(hr, ["hand", "batter_hand", "stand"]))),

      pitcher,
      pitcher_hand: pitcherHand,
      pitcher_era: pitcherEra,
      pitcher_hr9: pitcherHr9,
      pitcher_attack_score: pitcherAttackScore,

      best_hr_odds: bestOdds,
      best_book: bestBook,
      implied_probability: round1(implied),
      ev,
      edge,

      barrel_rate: normalizeRate(barrelRate),
      hard_hit_rate: normalizeRate(hardHitRate),
      launch_angle: num(launchAngle),
      flyball_rate: normalizeRate(flyballRate),
      iso: normalizeSlash(iso),
      slg: normalizeSlash(slg),
      xslg: normalizeSlash(xslg),

      park_factor: parkFactor,
      weather_boost: weatherBoostScore,
      vegas_total: vegasTotal,
      recent_form_score: recentFormScore,
      trend_score: trendScore,
      pitch_type_score: pitchTypeScore,
      bullpen_score: bullpenScore,

      statcast_score: round1(statScore),
      market_score: round1(market),
      matchup_score: round1(matchup),
      hr_score: round1(scaleScore(existingHrScore)),
      model_score: round1(scaleScore(existingModelScore)),
      player_final_score: round1(num(first(p, ["final_score"]))),
      composite_score: compositeScore,

      tier: safeTier(compositeScore, ev, bestOdds),
      confidence: safeConfidence(compositeScore, lineupStatus, Boolean(bestOdds)),
      source_rank: num(first(hr, ["rank"], first(hm, ["rank"])))
    });
  }

  master.sort((a, b) => {
    if (b.composite_score !== a.composite_score) return b.composite_score - a.composite_score;
    if (b.hr_score !== a.hr_score) return b.hr_score - a.hr_score;
    return b.ev - a.ev;
  });

  const ranked = master.map((row, i) => ({
    rank: i + 1,
    ...row
  }));

  fs.writeFileSync(OUT_JSON, JSON.stringify(ranked, null, 2));
  fs.writeFileSync(OUT_EXPORT_JSON, JSON.stringify(ranked, null, 2));
  writeCSV(OUT_CSV, ranked);
  writeCSV(OUT_EXPORT_CSV, ranked);

  const tierCounts = ranked.reduce((acc, row) => {
    acc[row.tier] = (acc[row.tier] || 0) + 1;
    return acc;
  }, {});

  console.log("");
  console.log("THE SLIP LAB MASTER HR MODEL COMPLETE");
  console.log(`Rows: ${ranked.length}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_EXPORT_JSON}`);
  console.log(`Saved: ${OUT_EXPORT_CSV}`);
  console.log("Tier spread:", tierCounts);
  console.log("");

  console.table(
    ranked.slice(0, 20).map(r => ({
      rank: r.rank,
      name: r.name,
      team: r.team,
      pitcher: r.pitcher,
      odds: r.best_hr_odds,
      brl: r.barrel_rate,
      hh: r.hard_hit_rate,
      raw: r.hr_score,
      final: r.player_final_score,
      stat: r.statcast_score,
      market: r.market_score,
      matchup: r.matchup_score,
      score: r.composite_score,
      tier: r.tier,
      confidence: r.confidence
    }))
  );
}

main();
