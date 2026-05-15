import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUTS = {
  hr: "hr_sweep_board_all_games.csv",
  hits: "hits_board.csv",
  tb: "tb_board.csv"
};

const OUTPUTS = {
  csv: "exports/matchup_labels.csv",
  json: "exports/matchup_labels.json",
  hrJson: "exports/hr_matchups.json",
  hitsJson: "exports/hits_matchups.json",
  tbJson: "exports/tb_matchups.json"
};

const LABELS = {
  elite: "ELITE",
  hot: "HOT",
  favorable: "FAVORABLE",
  cold: "COLD",
  dead: "DEAD"
};

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map(h => h.trim());

  return lines.map(line => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });

    return row;
  });
}

function csvEscape(value) {
  const str = String(value ?? "");

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function clean(value) {
  return String(value || "").trim();
}

function num(value, fallback = 0) {
  const raw = String(value ?? "")
    .replace("%", "")
    .replace("+", "")
    .trim();

  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function round(value) {
  return Number(value.toFixed(2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function get(row, keys, fallback = "") {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }

  return fallback;
}

function getEv(row) {
  return num(get(row, ["ev", "internal_ev"], 0));
}

function getEdge(row) {
  return num(get(row, ["edge"], 0));
}

function getLabelPriority(label) {
  const value = clean(label).toUpperCase();

  if (value === LABELS.elite) return 5;
  if (value === LABELS.hot) return 4;
  if (value === LABELS.favorable) return 3;
  if (value === LABELS.cold) return 2;
  if (value === LABELS.dead) return 1;

  return 0;
}

function matchupGrade(label, score) {
  const n = num(score);

  if (label === LABELS.elite) return "A_PLUS";
  if (label === LABELS.hot && n >= 88) return "A";
  if (label === LABELS.hot) return "A_LOW";
  if (label === LABELS.favorable && n >= 76) return "B_PLUS";
  if (label === LABELS.favorable) return "B";
  if (label === LABELS.cold) return "C";
  return "D";
}

function reasonJoin(reasons) {
  return reasons
    .filter(Boolean)
    .slice(0, 6)
    .join(" | ");
}

function scoreEv(row) {
  const ev = getEv(row);

  if (ev >= 300) return 6;
  if (ev >= 150) return 5;
  if (ev >= 80) return 4;
  if (ev >= 40) return 3;
  if (ev >= 15) return 2;
  if (ev >= 0) return 1;
  if (ev <= -30) return -5;
  if (ev <= -10) return -3;

  return 0;
}

function scoreEdge(row) {
  const edge = getEdge(row);

  if (edge >= 40) return 5;
  if (edge >= 25) return 4;
  if (edge >= 15) return 3;
  if (edge >= 8) return 2;
  if (edge >= 0) return 1;
  if (edge <= -15) return -5;
  if (edge <= -5) return -3;

  return 0;
}

function scoreLineup(row) {
  const spot = num(get(row, ["lineup_spot", "lineup"], 99), 99);

  if (spot === 1) return 5;
  if (spot === 2) return 5;
  if (spot === 3) return 5;
  if (spot === 4) return 4;
  if (spot === 5) return 2;
  if (spot === 6) return 0;
  if (spot === 7) return -2;
  if (spot === 8) return -4;
  if (spot === 9) return -5;

  return 0;
}

function scoreWeather(row, propType) {
  const weatherBoost = num(get(row, ["weather_boost", "weather"], 0));
  const wind = clean(get(row, ["wind_text", "wind"], "")).toLowerCase();

  let score = weatherBoost;

  if (propType === "HR" || propType === "TOTAL_BASES") {
    if (wind.includes("out")) score += 3;
    if (wind.includes("strong")) score += 2;
    if (wind.includes("in from")) score -= 5;
  }

  return clamp(score, -7, 7);
}

function normalizeScore(value, oldMin, oldMax, newMin = 0, newMax = 100) {
  const n = num(value);

  if (oldMax === oldMin) return newMin;

  const scaled = ((n - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
  return clamp(scaled, newMin, newMax);
}

function scoreOddsRisk(row) {
  const odds = Math.abs(num(get(row, ["best_odds", "internal_market_odds"], 0)));

  if (!odds) return 0;

  if (odds >= 4000) return -8;
  if (odds >= 3000) return -6;
  if (odds >= 2200) return -4;
  if (odds >= 1600) return -2;
  if (odds <= 800) return 2;

  return 0;
}

function scoreHrRaw(row) {
  const rankScore = num(get(row, ["rank_score"], 0));
  const modelScore = num(get(row, ["model_score"], 0));
  const modelProbability = num(get(row, ["model_probability", "prob"], 0));
  const barrel = num(get(row, ["barrel_pct"], 0));
  const hardHit = num(get(row, ["hard_hit_pct"], 0));
  const xslg = num(get(row, ["xslg"], 0));
  const pitcherHr = num(get(row, ["pitcher_hr_allowed"], 0));

  const base =
    normalizeScore(modelProbability, 2, 15, 0, 38) +
    normalizeScore(rankScore || modelScore, 100, 600, 0, 24) +
    normalizeScore(barrel, 3, 18, 0, 12) +
    normalizeScore(hardHit, 25, 55, 0, 9) +
    normalizeScore(xslg, 0.300, 0.650, 0, 8) +
    normalizeScore(pitcherHr, 0, 10, 0, 5);

  const total =
    base +
    scoreEv(row) +
    scoreEdge(row) +
    scoreLineup(row) +
    scoreWeather(row, "HR") +
    scoreOddsRisk(row);

  return round(clamp(total, 0, 100));
}

function scoreHitRaw(row) {
  const modelScore = num(get(row, ["hits_score", "score"], 0));
  const avg = num(get(row, ["avg"], 0));
  const hitRate = num(get(row, ["hit_rate"], 0));
  const kRate = num(get(row, ["strikeout_rate"], 0));
  const bip = num(get(row, ["ball_in_play_rate"], 0));
  const whip = num(get(row, ["pitcher_whip"], 0));
  const hitsAllowed = num(get(row, ["pitcher_hits_allowed"], 0));

  const base =
    normalizeScore(modelScore, 60, 99, 0, 42) +
    normalizeScore(avg, 0.190, 0.340, 0, 12) +
    normalizeScore(hitRate, 18, 33, 0, 12) +
    normalizeScore(35 - kRate, 0, 25, 0, 10) +
    normalizeScore(bip, 50, 75, 0, 8) +
    normalizeScore(whip, 0.95, 1.65, 0, 6) +
    normalizeScore(hitsAllowed, 10, 50, 0, 4);

  const total =
    base +
    scoreEv(row) +
    scoreEdge(row) +
    scoreLineup(row) +
    scoreWeather(row, "HITS") * 0.3;

  return round(clamp(total, 0, 100));
}

function scoreTbRaw(row, marketScore, prop) {
  const slg = num(get(row, ["slg"], 0));
  const xslg = num(get(row, ["xslg"], 0));
  const tbPerAb = num(get(row, ["total_bases_per_at_bat"], 0));
  const tbPerHit = num(get(row, ["total_bases_per_hit"], 0));
  const barrel = num(get(row, ["barrel_pct"], 0));
  const hardHit = num(get(row, ["hard_hit_pct"], 0));
  const pitcherHr = num(get(row, ["pitcher_hr_allowed"], 0));

  const propPenalty =
    prop === "4+ TB" ? -9 :
    prop === "3+ TB" ? -4 :
    0;

  const base =
    normalizeScore(marketScore, 55, 99, 0, 44) +
    normalizeScore(slg, 0.300, 0.600, 0, 10) +
    normalizeScore(xslg, 0.300, 0.650, 0, 10) +
    normalizeScore(tbPerAb, 0.250, 0.650, 0, 9) +
    normalizeScore(tbPerHit, 1.10, 2.20, 0, 7) +
    normalizeScore(barrel, 3, 18, 0, 6) +
    normalizeScore(hardHit, 25, 55, 0, 5) +
    normalizeScore(pitcherHr, 0, 10, 0, 3);

  const total =
    base +
    scoreEv(row) +
    scoreEdge(row) +
    scoreLineup(row) +
    scoreWeather(row, "TOTAL_BASES") * 0.5 +
    propPenalty;

  return round(clamp(total, 0, 100));
}

function buildHrReasons(row, score) {
  const reasons = [];

  const prob = num(get(row, ["model_probability", "prob"], 0));
  const barrel = num(get(row, ["barrel_pct"], 0));
  const hardHit = num(get(row, ["hard_hit_pct"], 0));
  const xslg = num(get(row, ["xslg"], 0));
  const pitcherHr = num(get(row, ["pitcher_hr_allowed"], 0));
  const ev = getEv(row);
  const edge = getEdge(row);
  const wind = clean(get(row, ["wind_text", "wind"], ""));

  if (prob >= 10) reasons.push("Strong HR probability");
  else if (prob >= 7) reasons.push("Playable HR probability");

  if (barrel >= 12) reasons.push("Strong barrel profile");
  if (hardHit >= 45) reasons.push("Hard contact profile");
  if (xslg >= 0.500) reasons.push("Strong xSLG");
  if (pitcherHr >= 5) reasons.push("Pitcher allows HR damage");
  if (ev >= 50) reasons.push("Positive EV");
  if (edge >= 15) reasons.push("Positive edge");
  if (wind) reasons.push(wind);

  if (!reasons.length) reasons.push("Weak HR matchup profile");

  return reasonJoin(reasons);
}

function buildHitReasons(row) {
  const reasons = [];

  const avg = num(get(row, ["avg"], 0));
  const hitRate = num(get(row, ["hit_rate"], 0));
  const kRate = num(get(row, ["strikeout_rate"], 0));
  const bip = num(get(row, ["ball_in_play_rate"], 0));
  const whip = num(get(row, ["pitcher_whip"], 0));
  const hitsAllowed = num(get(row, ["pitcher_hits_allowed"], 0));
  const ev = getEv(row);
  const edge = getEdge(row);

  if (avg >= 0.280) reasons.push("Strong batting average");
  if (hitRate >= 28) reasons.push("High hit rate");
  if (kRate <= 18) reasons.push("Low strikeout risk");
  if (bip >= 65) reasons.push("Strong ball in play profile");
  if (whip >= 1.35) reasons.push("Pitcher traffic risk");
  if (hitsAllowed >= 35) reasons.push("Pitcher allows contact");
  if (ev >= 50) reasons.push("Positive EV");
  if (edge >= 15) reasons.push("Positive edge");

  if (!reasons.length) reasons.push("Weak hit matchup profile");

  return reasonJoin(reasons);
}

function buildTbReasons(row, market) {
  const reasons = [];

  const slg = num(get(row, ["slg"], 0));
  const xslg = num(get(row, ["xslg"], 0));
  const tbPerAb = num(get(row, ["total_bases_per_at_bat"], 0));
  const tbPerHit = num(get(row, ["total_bases_per_hit"], 0));
  const barrel = num(get(row, ["barrel_pct"], 0));
  const hardHit = num(get(row, ["hard_hit_pct"], 0));
  const pitcherHr = num(get(row, ["pitcher_hr_allowed"], 0));
  const ev = getEv(row);
  const edge = getEdge(row);

  reasons.push(`Best market: ${market}`);

  if (slg >= 0.450) reasons.push("Strong slugging profile");
  if (xslg >= 0.480) reasons.push("Strong xSLG");
  if (tbPerAb >= 0.450) reasons.push("Strong total bases per at bat");
  if (tbPerHit >= 1.60) reasons.push("Extra base hit upside");
  if (barrel >= 10) reasons.push("Barrel upside");
  if (hardHit >= 42) reasons.push("Hard contact profile");
  if (pitcherHr >= 5) reasons.push("Pitcher allows damage");
  if (ev >= 50) reasons.push("Positive EV");
  if (edge >= 15) reasons.push("Positive edge");

  return reasonJoin(reasons);
}

function buildHrMatchups(rows) {
  return rows.map(row => ({
    prop_type: "HR",
    name: get(row, ["name"]),
    team: get(row, ["team"]),
    game: get(row, ["game"]),
    commence_time: get(row, ["commence_time"]),
    raw_matchup_score: scoreHrRaw(row),
    matchup_label: "",
    matchup_grade: "",
    matchup_score: 0,
    model_score: get(row, ["model_score", "rank_score"]),
    model_probability: get(row, ["model_probability"]),
    best_market: "HR",
    best_odds: get(row, ["best_odds", "internal_market_odds"]),
    best_book: get(row, ["best_book"]),
    ev: get(row, ["ev", "internal_ev"]),
    edge: get(row, ["edge"]),
    lineup_spot: get(row, ["lineup_spot", "lineup"]),
    lineup_status: get(row, ["lineup_status", "status"]),
    pitcher: get(row, ["opposing_pitcher", "pitcher"]),
    weather: get(row, ["weather_label"]),
    wind: get(row, ["wind_text", "wind"]),
    tier: get(row, ["tier"]),
    confidence: get(row, ["confidence"]),
    matchup_reason: "",
    source_file: INPUTS.hr
  }));
}

function buildHitMatchups(rows) {
  return rows.map(row => ({
    prop_type: "HITS",
    name: get(row, ["name"]),
    team: get(row, ["team"]),
    game: get(row, ["game"]),
    commence_time: get(row, ["commence_time"]),
    raw_matchup_score: scoreHitRaw(row),
    matchup_label: "",
    matchup_grade: "",
    matchup_score: 0,
    model_score: get(row, ["hits_score", "score"]),
    model_probability: get(row, ["model_probability"]),
    best_market: "1+ Hit",
    best_odds: get(row, ["best_odds"]),
    best_book: get(row, ["best_book"]),
    ev: get(row, ["ev"]),
    edge: get(row, ["edge"]),
    lineup_spot: get(row, ["lineup_spot", "lineup"]),
    lineup_status: get(row, ["lineup_status", "status"]),
    pitcher: get(row, ["opposing_pitcher", "pitcher"]),
    weather: get(row, ["weather"]),
    wind: get(row, ["wind"]),
    tier: get(row, ["tier"]),
    confidence: get(row, ["confidence"]),
    matchup_reason: "",
    source_file: INPUTS.hits
  }));
}

function buildTbMatchups(rows) {
  const out = [];

  for (const row of rows) {
    const markets = [
      {
        prop: "2+ TB",
        score: num(get(row, ["two_tb_score", "two"], 0)),
        tier: get(row, ["two_tb_tier", "tier"]),
        confidence: get(row, ["two_tb_confidence", "confidence"])
      },
      {
        prop: "3+ TB",
        score: num(get(row, ["three_tb_score", "three"], 0)),
        tier: get(row, ["three_tb_tier", "tier"]),
        confidence: get(row, ["three_tb_confidence", "confidence"])
      },
      {
        prop: "4+ TB",
        score: num(get(row, ["four_tb_score", "four"], 0)),
        tier: get(row, ["four_tb_tier", "tier"]),
        confidence: get(row, ["four_tb_confidence", "confidence"])
      }
    ];

    for (const market of markets) {
      if (market.score <= 0) continue;
      if (clean(market.tier).toUpperCase() === "PASS") continue;

      const isModelOnly = market.prop === "3+ TB" || market.prop === "4+ TB";

      out.push({
        prop_type: "TOTAL_BASES",
        name: get(row, ["name"]),
        team: get(row, ["team"]),
        game: get(row, ["game"]),
        commence_time: get(row, ["commence_time"]),
        raw_matchup_score: scoreTbRaw(row, market.score, market.prop),
        matchup_label: "",
        matchup_grade: "",
        matchup_score: 0,
        model_score: round(market.score),
        model_probability: "",
        best_market: market.prop,
        best_odds: isModelOnly ? "" : get(row, ["best_odds"]),
        best_book: isModelOnly ? "MODEL ONLY" : get(row, ["best_book"]),
        ev: isModelOnly ? "" : get(row, ["ev"]),
        edge: isModelOnly ? "" : get(row, ["edge"]),
        lineup_spot: get(row, ["lineup_spot", "lineup"]),
        lineup_status: get(row, ["lineup_status", "status"]),
        pitcher: get(row, ["opposing_pitcher", "pitcher"]),
        weather: get(row, ["weather"]),
        wind: get(row, ["wind"]),
        tier: market.tier,
        confidence: market.confidence,
        matchup_reason: "",
        source_file: INPUTS.tb
      });
    }
  }

  return out;
}

function labelByPercentile(rows) {
  const sorted = [...rows].sort((a, b) => {
    return num(b.raw_matchup_score) - num(a.raw_matchup_score);
  });

  const count = sorted.length;

  if (!count) return [];

  return sorted.map((row, index) => {
    const pct = (index + 1) / count;

    let label = LABELS.dead;

    if (pct <= 0.08) label = LABELS.elite;
    else if (pct <= 0.25) label = LABELS.hot;
    else if (pct <= 0.60) label = LABELS.favorable;
    else if (pct <= 0.85) label = LABELS.cold;

    return {
      ...row,
      matchup_label: label,
      matchup_grade: matchupGrade(label, row.raw_matchup_score),
      matchup_score: row.raw_matchup_score
    };
  });
}

function applyReasons(rows) {
  return rows.map(row => {
    let reason = "";

    if (row.prop_type === "HR") {
      reason = buildHrReasons(row, row.matchup_score);
    } else if (row.prop_type === "HITS") {
      reason = buildHitReasons(row);
    } else if (row.prop_type === "TOTAL_BASES") {
      reason = buildTbReasons(row, row.best_market);
    }

    return {
      ...row,
      matchup_reason: reason
    };
  });
}

function sortMatchups(rows) {
  return rows.sort((a, b) => {
    const labelDiff =
      getLabelPriority(b.matchup_label) - getLabelPriority(a.matchup_label);

    if (labelDiff !== 0) return labelDiff;

    return num(b.matchup_score) - num(a.matchup_score);
  });
}

function addRanks(rows) {
  return rows.map((row, i) => ({
    rank: i + 1,
    ...row
  }));
}

function writeCsv(rows) {
  const headers = [
    "rank",
    "prop_type",
    "name",
    "team",
    "game",
    "commence_time",
    "matchup_label",
    "matchup_grade",
    "matchup_score",
    "raw_matchup_score",
    "model_score",
    "model_probability",
    "best_market",
    "best_odds",
    "best_book",
    "ev",
    "edge",
    "lineup_spot",
    "lineup_status",
    "pitcher",
    "weather",
    "wind",
    "tier",
    "confidence",
    "matchup_reason",
    "source_file"
  ];

  const text = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(header => csvEscape(row[header])).join(",")
    )
  ].join("\n");

  fs.mkdirSync(path.join(ROOT, "exports"), {
    recursive: true
  });

  fs.writeFileSync(path.join(ROOT, OUTPUTS.csv), text);
}

function writeJson(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });

  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
}

function countLabels(rows) {
  const counts = {};

  for (const row of rows) {
    const key = `${row.prop_type}_${row.matchup_label}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

function main() {
  const hrRows = parseCsv(path.join(ROOT, INPUTS.hr));
  const hitRows = parseCsv(path.join(ROOT, INPUTS.hits));
  const tbRows = parseCsv(path.join(ROOT, INPUTS.tb));

  const hrMatchups = addRanks(sortMatchups(applyReasons(labelByPercentile(buildHrMatchups(hrRows)))));
  const hitMatchups = addRanks(sortMatchups(applyReasons(labelByPercentile(buildHitMatchups(hitRows)))));
  const tbMatchups = addRanks(sortMatchups(applyReasons(labelByPercentile(buildTbMatchups(tbRows)))));

  const allMatchups = addRanks(
    sortMatchups([
      ...hrMatchups.map(({ rank, ...row }) => row),
      ...hitMatchups.map(({ rank, ...row }) => row),
      ...tbMatchups.map(({ rank, ...row }) => row)
    ])
  );

  writeCsv(allMatchups);
  writeJson(path.join(ROOT, OUTPUTS.json), allMatchups);
  writeJson(path.join(ROOT, OUTPUTS.hrJson), hrMatchups);
  writeJson(path.join(ROOT, OUTPUTS.hitsJson), hitMatchups);
  writeJson(path.join(ROOT, OUTPUTS.tbJson), tbMatchups);

  console.log("");
  console.log("MATCHUP LABELS COMPLETE");
  console.log("HR rows:", hrMatchups.length);
  console.log("Hits rows:", hitMatchups.length);
  console.log("TB rows:", tbMatchups.length);
  console.log("All rows:", allMatchups.length);
  console.log("Saved:", path.join(ROOT, OUTPUTS.csv));
  console.log("Saved:", path.join(ROOT, OUTPUTS.json));
  console.log("Saved:", path.join(ROOT, OUTPUTS.hrJson));
  console.log("Saved:", path.join(ROOT, OUTPUTS.hitsJson));
  console.log("Saved:", path.join(ROOT, OUTPUTS.tbJson));
  console.log("Label counts:", countLabels(allMatchups));

  console.table(
    allMatchups.slice(0, 20).map(row => ({
      rank: row.rank,
      type: row.prop_type,
      name: row.name,
      prop: row.best_market,
      label: row.matchup_label,
      score: row.matchup_score,
      team: row.team,
      book: row.best_book,
      odds: row.best_odds
    }))
  );
}

main();