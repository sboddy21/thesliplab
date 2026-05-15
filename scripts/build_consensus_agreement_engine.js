import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");

const OUT_CSV = path.join(DATA, "consensus_agreement_engine.csv");
const OUT_JSON = path.join(DATA, "consensus_agreement_engine.json");
const OUT_EXPORT_CSV = path.join(EXPORTS, "consensus_agreement_engine.csv");
const OUT_EXPORT_JSON = path.join(EXPORTS, "consensus_agreement_engine.json");

function parse(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];

    if (c === '"' && q && n === '"') {
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

function rows(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const headers = parse(lines[0]);

  return lines.slice(1).map(line => {
    const vals = parse(line);
    const row = {};
    headers.forEach((h, i) => row[h] = vals[i] || "");
    return row;
  });
}

function clean(v) {
  return String(v || "").trim();
}

function lower(v) {
  return clean(v).toLowerCase();
}

function normName(v) {
  return lower(v)
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/’/g, "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function key(name, team = "") {
  return `${normName(name)}|${lower(team)}`;
}

function num(v, fallback = 0) {
  const n = Number(String(v || "").replace(/[%,$+]/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min = 0, max = 99) {
  return Math.max(min, Math.min(max, v));
}

function round(v) {
  return Math.round(v * 10) / 10;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCSV(file, list) {
  if (!list.length) return;
  const headers = Object.keys(list[0]);
  const out = [
    headers.join(","),
    ...list.map(r => headers.map(h => csvEscape(r[h])).join(","))
  ];
  fs.writeFileSync(file, out.join("\n"));
}

function tierScore(tier) {
  const t = lower(tier);

  if (t.includes("elite")) return 95;
  if (t.includes("core")) return 88;
  if (t.includes("target")) return 88;
  if (t.includes("attack")) return 82;
  if (t.includes("strong")) return 80;
  if (t.includes("plus")) return 72;
  if (t.includes("good")) return 68;
  if (t.includes("playable")) return 66;
  if (t.includes("value bomb")) return 72;
  if (t.includes("standard")) return 62;
  if (t.includes("neutral")) return 56;
  if (t.includes("watch")) return 54;
  if (t.includes("thin")) return 46;
  if (t.includes("lotto")) return 52;
  if (t.includes("avoid")) return 35;
  if (t.includes("pass")) return 25;

  return 50;
}

function impliedFromAmerican(odds) {
  const o = num(odds);
  if (!o) return 0;
  if (o > 0) return 100 / (o + 100) * 100;
  return Math.abs(o) / (Math.abs(o) + 100) * 100;
}

function scoreToModelProbability(score) {
  const s = clamp(num(score), 0, 99);
  return round(2.2 + (s / 99) * 12.8);
}

function consensusLabel(score, agreement, disagreement) {
  if (score >= 88 && agreement >= 4 && disagreement <= 1) return "FULL CONSENSUS";
  if (score >= 80 && agreement >= 3) return "STRONG CONSENSUS";
  if (score >= 72 && agreement >= 3) return "GOOD CONSENSUS";
  if (score >= 66 && agreement >= 2) return "MIXED LEAN";
  if (score >= 58) return "WATCHLIST";
  return "NO CONSENSUS";
}

function volatilityLabel(range, odds) {
  if (range >= 28 || odds >= 900) return "HIGH";
  if (range >= 18 || odds >= 650) return "MEDIUM";
  return "LOW";
}

function buildFlags({ finalScore, master, matchup, split, pitch, odds, edge, value, range }) {
  const flags = [];

  if (finalScore >= 88 && master >= 80 && matchup >= 72 && split >= 75 && pitch >= 78) flags.push("NUKE_FLAG");
  if (finalScore >= 82 && master >= 78 && pitch >= 75) flags.push("CORE_FLAG");
  if (odds >= 450 && finalScore >= 72) flags.push("VALUE_FLAG");
  if (odds >= 650 && pitch >= 75 && split >= 72) flags.push("LADDER_FLAG");
  if (finalScore >= 70 && odds >= 700 && master < 78) flags.push("STEALTH_FLAG");
  if (edge >= 3.5 || value >= 70) flags.push("MARKET_EDGE");
  if (range >= 25) flags.push("VOLATILE");

  return flags;
}

function main() {
  fs.mkdirSync(EXPORTS, { recursive: true });

  const finalRows = rows(path.join(DATA, "final_hr_decision_engine.csv"));
  const masterRows = rows(path.join(DATA, "master_hr_model.csv"));
  const matchupRows = rows(path.join(DATA, "matchup_intelligence.csv"));
  const splitRows = rows(path.join(DATA, "pitcher_splits_engine.csv"));
  const pitchRows = rows(path.join(DATA, "per_pitch_matchup_engine.csv"));

  const masterMap = new Map(masterRows.map(r => [key(r.name, r.team), r]));
  const matchupMap = new Map(matchupRows.map(r => [key(r.name, r.team), r]));
  const splitMap = new Map(splitRows.map(r => [key(r.name, r.team), r]));
  const pitchMap = new Map(pitchRows.map(r => [key(r.name, r.team), r]));

  const out = [];

  for (const row of finalRows) {
    const name = clean(row.name);
    const team = clean(row.team);
    const k = key(name, team);

    const master = masterMap.get(k) || {};
    const matchup = matchupMap.get(k) || {};
    const split = splitMap.get(k) || {};
    const pitch = pitchMap.get(k) || {};

    const odds = num(row.odds);

    const finalScore = num(row.final_hr_score);
    const masterScore = num(row.master_score) || num(master.composite_score) || tierScore(row.master_tier || master.tier);
    const matchupScore = num(row.matchup_score) || num(matchup.intel) || tierScore(row.matchup_grade || matchup.grade);
    const splitScore = num(row.split_score) || num(split.split_engine_score) || tierScore(row.split_grade || split.split_grade);
    const pitchScore = num(row.per_pitch_score) || num(pitch.per_pitch_score) || tierScore(row.per_pitch_grade || pitch.per_pitch_grade);

    const scores = [masterScore, matchupScore, splitScore, pitchScore].filter(x => x > 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : finalScore;
    const min = scores.length ? Math.min(...scores) : finalScore;
    const max = scores.length ? Math.max(...scores) : finalScore;
    const range = max - min;

    const agreement =
      (masterScore >= 75 ? 1 : 0) +
      (matchupScore >= 70 ? 1 : 0) +
      (splitScore >= 70 ? 1 : 0) +
      (pitchScore >= 70 ? 1 : 0);

    const disagreement =
      (masterScore < 62 ? 1 : 0) +
      (matchupScore < 58 ? 1 : 0) +
      (splitScore < 58 ? 1 : 0) +
      (pitchScore < 58 ? 1 : 0);

    const modelProb = scoreToModelProbability(finalScore);
    const implied = impliedFromAmerican(odds);
    const edge = round(modelProb - implied);

    const value = clamp(
      50 +
      edge * 3 +
      (odds >= 450 ? 6 : 0) +
      (odds >= 650 ? 4 : 0) +
      (agreement >= 3 ? 6 : 0) -
      (disagreement >= 2 ? 8 : 0)
    );

    const consensusStrength = round(clamp(
      avg * 0.40 +
      finalScore * 0.35 +
      agreement * 6 -
      disagreement * 7 -
      range * 0.35
    ));

    const flags = buildFlags({
      finalScore,
      master: masterScore,
      matchup: matchupScore,
      split: splitScore,
      pitch: pitchScore,
      odds,
      edge,
      value,
      range
    });

    out.push({
      rank: 0,
      name,
      team,
      opponent: row.opponent,
      game: row.game,
      pitcher: row.pitcher,
      odds,
      book: row.book,
      final_hr_score: round(finalScore),
      decision_tier: row.decision_tier,
      confidence: row.confidence,
      consensus_score: consensusStrength,
      consensus_label: consensusLabel(consensusStrength, agreement, disagreement),
      agreement_count: agreement,
      disagreement_count: disagreement,
      model_score_avg: round(avg),
      model_score_min: round(min),
      model_score_max: round(max),
      model_score_range: round(range),
      volatility: volatilityLabel(range, odds),
      model_probability_est: modelProb,
      market_implied_probability: round(implied),
      market_edge_points: edge,
      value_score: round(value),
      sharp_flag: flags.includes("MARKET_EDGE") ? "YES" : "NO",
      nuke_flag: flags.includes("NUKE_FLAG") ? "YES" : "NO",
      core_flag: flags.includes("CORE_FLAG") ? "YES" : "NO",
      value_flag: flags.includes("VALUE_FLAG") ? "YES" : "NO",
      ladder_flag: flags.includes("LADDER_FLAG") ? "YES" : "NO",
      stealth_flag: flags.includes("STEALTH_FLAG") ? "YES" : "NO",
      all_flags: flags.join("|"),
      master_score: round(masterScore),
      matchup_score: round(matchupScore),
      split_score: round(splitScore),
      per_pitch_score: round(pitchScore),
      primary_pitch_match: row.primary_pitch_match || pitch.primary_pitch_match || "",
      primary_pitch_usage_pct: row.primary_pitch_usage_pct || pitch.primary_pitch_usage_pct || "",
      signal_flags: row.signal_flags,
      note:
        agreement >= 4
          ? "All model layers agree"
          : agreement === 3
          ? "Three layer agreement"
          : agreement === 2
          ? "Two layer lean"
          : "Thin agreement"
    });
  }

  out.sort((a, b) => {
    if (b.consensus_score !== a.consensus_score) return b.consensus_score - a.consensus_score;
    if (b.final_hr_score !== a.final_hr_score) return b.final_hr_score - a.final_hr_score;
    return b.value_score - a.value_score;
  });

  out.forEach((r, i) => r.rank = i + 1);

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_EXPORT_JSON, JSON.stringify(out, null, 2));
  writeCSV(OUT_CSV, out);
  writeCSV(OUT_EXPORT_CSV, out);

  const spread = {};
  for (const r of out) spread[r.consensus_label] = (spread[r.consensus_label] || 0) + 1;

  console.log("");
  console.log("THE SLIP LAB CONSENSUS AGREEMENT ENGINE COMPLETE");
  console.log(`Rows: ${out.length}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log("Consensus spread:", spread);
  console.log("");

  console.table(out.slice(0, 25).map(r => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    pitcher: r.pitcher,
    odds: r.odds,
    final: r.final_hr_score,
    consensus: r.consensus_score,
    label: r.consensus_label,
    agree: r.agreement_count,
    edge: r.market_edge_points,
    value: r.value_score,
    vol: r.volatility,
    flags: r.all_flags
  })));
}

main();
