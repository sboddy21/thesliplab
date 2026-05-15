import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");

const OUT_CSV = path.join(DATA, "final_hr_decision_engine.csv");
const OUT_JSON = path.join(DATA, "final_hr_decision_engine.json");
const OUT_EXPORT_CSV = path.join(EXPORTS, "final_hr_decision_engine.csv");
const OUT_EXPORT_JSON = path.join(EXPORTS, "final_hr_decision_engine.json");

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

function num(v, fallback = 0) {
  const n = Number(String(v || "").replace(/[%,$+]/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
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

function decisionTier(score, odds, flags) {
  if (score >= 88 && flags >= 3) return "SLIP LAB ELITE";
  if (score >= 82 && flags >= 2) return "CORE PLAY";
  if (score >= 76) return "STRONG PLAY";
  if (score >= 70 && odds >= 450) return "VALUE BOMB";
  if (score >= 70) return "PLAYABLE";
  if (score >= 62 && odds >= 650) return "LOTTO ONLY";
  if (score >= 58) return "WATCH";
  return "PASS";
}

function confidence(score, agreementCount, odds) {
  let c = score;

  if (agreementCount >= 4) c += 5;
  else if (agreementCount === 3) c += 3;
  else if (agreementCount <= 1) c -= 5;

  if (odds >= 800) c -= 4;
  if (odds <= 350) c += 2;

  if (c >= 84) return "HIGH";
  if (c >= 74) return "MEDIUM";
  if (c >= 64) return "LOW";
  return "SPECULATIVE";
}

function gradeToScore(grade) {
  const g = lower(grade);

  if (g.includes("elite")) return 92;
  if (g.includes("core")) return 86;
  if (g.includes("target")) return 88;
  if (g.includes("attack")) return 82;
  if (g.includes("strong")) return 80;
  if (g.includes("plus")) return 72;
  if (g.includes("good")) return 68;
  if (g.includes("standard")) return 62;
  if (g.includes("neutral")) return 56;
  if (g.includes("thin")) return 48;
  if (g.includes("lotto")) return 52;
  if (g.includes("avoid")) return 38;
  if (g.includes("fade")) return 30;
  if (g.includes("pass")) return 25;

  return 50;
}

function valueScore(odds, modelScore) {
  let score = 50;

  if (odds <= 275) score += 8;
  else if (odds <= 400) score += 12;
  else if (odds <= 550) score += 14;
  else if (odds <= 750) score += 10;
  else if (odds <= 1000) score += 4;
  else score -= 4;

  if (modelScore >= 80 && odds >= 450) score += 10;
  if (modelScore >= 75 && odds >= 600) score += 8;
  if (modelScore < 65 && odds >= 800) score -= 8;

  return clamp(score);
}

function finalScore(parts) {
  let score =
    parts.master * 0.24 +
    parts.matchup * 0.20 +
    parts.splits * 0.18 +
    parts.perPitch * 0.20 +
    parts.market * 0.08 +
    parts.value * 0.06 +
    parts.recent * 0.04;

  if (parts.agreement >= 4) score += 4;
  else if (parts.agreement === 3) score += 2;
  else if (parts.agreement <= 1) score -= 4;

  if (parts.perPitch >= 80 && parts.splits >= 78 && parts.matchup >= 72) score += 3;
  if (parts.master >= 82 && parts.perPitch >= 78) score += 2;
  if (parts.perPitch < 58 || parts.matchup < 55) score -= 4;

  if (parts.odds >= 900 && score < 78) score -= 5;
  if (parts.odds >= 700 && parts.perPitch >= 78 && parts.splits >= 75) score += 2;

  return round(clamp(score));
}

function reasonFlags({ master, matchup, splits, perPitch, contact, env, recent, odds }) {
  const flags = [];

  if (master >= 80) flags.push("MASTER");
  if (matchup >= 72) flags.push("MATCHUP");
  if (splits >= 75) flags.push("SPLITS");
  if (perPitch >= 78) flags.push("PITCH");
  if (contact >= 80) flags.push("CONTACT");
  if (env >= 60) flags.push("ENV");
  if (recent >= 65) flags.push("FORM");
  if (odds >= 550 && perPitch >= 75) flags.push("VALUE");

  return flags;
}

function main() {
  fs.mkdirSync(EXPORTS, { recursive: true });

  const master = rows(path.join(DATA, "master_hr_model.csv"));
  const matchup = rows(path.join(DATA, "matchup_intelligence.csv"));
  const splits = rows(path.join(DATA, "pitcher_splits_engine.csv"));
  const perPitch = rows(path.join(DATA, "per_pitch_matchup_engine.csv"));

  const matchupMap = new Map(matchup.map(r => [key(r.name, r.team), r]));
  const splitsMap = new Map(splits.map(r => [key(r.name, r.team), r]));
  const pitchMap = new Map(perPitch.map(r => [key(r.name, r.team), r]));

  const out = [];

  for (const row of master) {
    const name = clean(row.name);
    const team = clean(row.team);
    const k = key(name, team);

    const mi = matchupMap.get(k) || {};
    const sp = splitsMap.get(k) || {};
    const pp = pitchMap.get(k) || {};

    const odds = num(row.best_hr_odds || pp.odds || mi.odds || sp.odds);

    const masterScore = num(row.composite_score) || gradeToScore(row.tier);
    const matchupScore = num(mi.intel) || num(mi.matchup_intel_score) || gradeToScore(mi.grade);
    const splitsScore = num(sp.split_engine_score) || gradeToScore(sp.split_grade);
    const perPitchScore = num(pp.per_pitch_score) || gradeToScore(pp.per_pitch_grade);
    const marketScore = num(row.market_score) || num(pp.market_score) || 60;
    const recentScore = num(mi.recent) || num(mi.recent_power_score) || num(row.recent_form_score) || 50;
    const contactScore = num(mi.contact) || num(mi.contact_score) || num(pp.contact_score) || num(row.statcast_score) || 50;
    const envScore = num(mi.env) || num(mi.environment_score) || num(sp.environment_score) || 50;
    const value = valueScore(odds, masterScore);

    const agreement =
      (masterScore >= 75 ? 1 : 0) +
      (matchupScore >= 70 ? 1 : 0) +
      (splitsScore >= 70 ? 1 : 0) +
      (perPitchScore >= 70 ? 1 : 0);

    const flags = reasonFlags({
      master: masterScore,
      matchup: matchupScore,
      splits: splitsScore,
      perPitch: perPitchScore,
      contact: contactScore,
      env: envScore,
      recent: recentScore,
      odds
    });

    const final = finalScore({
      master: masterScore,
      matchup: matchupScore,
      splits: splitsScore,
      perPitch: perPitchScore,
      market: marketScore,
      value,
      recent: recentScore,
      agreement,
      odds
    });

    const tier = decisionTier(final, odds, flags.length);
    const conf = confidence(final, agreement, odds);

    out.push({
      rank: 0,
      name,
      team,
      opponent: row.opponent,
      game: row.game,
      lineup_spot: row.lineup_spot,
      pitcher: row.pitcher,
      pitcher_hand: row.pitcher_hand,
      odds,
      book: row.best_book,
      final_hr_score: final,
      decision_tier: tier,
      confidence: conf,
      agreement_count: agreement,
      signal_flags: flags.join("|"),
      master_score: round(masterScore),
      master_tier: row.tier,
      matchup_score: round(matchupScore),
      matchup_grade: mi.grade || mi.matchup_grade || "",
      split_score: round(splitsScore),
      split_grade: sp.split_grade || "",
      per_pitch_score: round(perPitchScore),
      per_pitch_grade: pp.per_pitch_grade || "",
      contact_score: round(contactScore),
      environment_score: round(envScore),
      recent_score: round(recentScore),
      market_score: round(marketScore),
      value_score: round(value),
      barrel_rate: row.barrel_rate,
      hard_hit_rate: row.hard_hit_rate,
      primary_pitch_match: pp.primary_pitch_match || "",
      primary_pitch_usage_pct: pp.primary_pitch_usage_pct || "",
      best_hitter_pitch: pp.best_hitter_pitch || "",
      weakest_pitcher_pitch: pp.weakest_pitcher_pitch || "",
      pitcher_vulnerability_score: sp.pitcher_vulnerability_score || "",
      handedness_split_score: sp.handedness_split_score || "",
      note:
        flags.length >= 4
          ? "Multi-layer agreement"
          : flags.length >= 3
          ? "Strong layered support"
          : flags.length >= 2
          ? "Playable with selectivity"
          : "Thin profile"
    });
  }

  out.sort((a, b) => {
    if (b.final_hr_score !== a.final_hr_score) return b.final_hr_score - a.final_hr_score;
    return b.agreement_count - a.agreement_count;
  });

  out.forEach((r, i) => r.rank = i + 1);

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_EXPORT_JSON, JSON.stringify(out, null, 2));
  writeCSV(OUT_CSV, out);
  writeCSV(OUT_EXPORT_CSV, out);

  const spread = {};
  for (const r of out) spread[r.decision_tier] = (spread[r.decision_tier] || 0) + 1;

  console.log("");
  console.log("THE SLIP LAB FINAL HR DECISION ENGINE COMPLETE");
  console.log(`Rows: ${out.length}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log("Tier spread:", spread);
  console.log("");

  console.table(out.slice(0, 25).map(r => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    pitcher: r.pitcher,
    odds: r.odds,
    final: r.final_hr_score,
    tier: r.decision_tier,
    conf: r.confidence,
    agree: r.agreement_count,
    master: r.master_score,
    matchup: r.matchup_score,
    split: r.split_score,
    pitch: r.per_pitch_score,
    flags: r.signal_flags
  })));
}

main();
