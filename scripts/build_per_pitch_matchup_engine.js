import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");

const OUT_CSV = path.join(DATA, "per_pitch_matchup_engine.csv");
const OUT_JSON = path.join(DATA, "per_pitch_matchup_engine.json");
const OUT_EXPORT_CSV = path.join(EXPORTS, "per_pitch_matchup_engine.csv");
const OUT_EXPORT_JSON = path.join(EXPORTS, "per_pitch_matchup_engine.json");

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
    headers.forEach((h, i) => {
      row[h] = vals[i] || "";
    });
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

function normPitch(v) {
  const p = lower(v);

  if (!p) return "";

  if (p.includes("4-seam") || p.includes("four-seam") || p === "ff") return "4-Seam Fastball";
  if (p.includes("sinker") || p === "si") return "Sinker";
  if (p.includes("slider") || p === "sl") return "Slider";
  if (p.includes("curve") || p === "cu" || p === "kc") return "Curveball";
  if (p.includes("change") || p === "ch") return "Changeup";
  if (p.includes("cutter") || p === "fc") return "Cutter";
  if (p.includes("split") || p === "fs") return "Splitter";
  if (p.includes("sweeper") || p === "st") return "Sweeper";

  return clean(v);
}

function key(name, team = "") {
  return `${normName(name)}|${lower(team)}`;
}

function matchupKey(name, pitcher) {
  return `${normName(name)}|${normName(pitcher)}`;
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

function grade(score) {
  if (score >= 88) return "NUKE SPOT";
  if (score >= 80) return "ATTACK";
  if (score >= 70) return "PLUS";
  if (score >= 58) return "NEUTRAL";
  if (score >= 48) return "THIN";
  return "AVOID";
}

function parsePitchMix(text) {
  const s = clean(text);
  if (!s) return [];

  return s
    .split("|")
    .map(x => x.trim())
    .filter(Boolean)
    .map(part => {
      const match = part.match(/(.+?)\s+([0-9.]+)%/);
      if (!match) {
        return {
          pitch: normPitch(part),
          usage: 0
        };
      }

      return {
        pitch: normPitch(match[1]),
        usage: num(match[2])
      };
    });
}

function pitchFamilyBoost(pitch) {
  const p = normPitch(pitch);

  if (p === "4-Seam Fastball") return 5;
  if (p === "Sinker") return 4;
  if (p === "Slider") return 2;
  if (p === "Cutter") return 2;
  if (p === "Sweeper") return 1;
  if (p === "Changeup") return 0;
  if (p === "Curveball") return 0;
  if (p === "Splitter") return 0;

  return 0;
}

function usageScore(usage) {
  if (usage >= 35) return 95;
  if (usage >= 28) return 88;
  if (usage >= 22) return 80;
  if (usage >= 16) return 70;
  if (usage >= 10) return 60;
  return 50;
}

function stabilizePitchMetric(value, sample = 0) {
  let v = num(value);

  if (!v) return 50;

  if (v >= 99) v = 94;
  else if (v >= 95) v = 90 + (v - 95) * 0.6;
  else if (v >= 90) v = 86 + (v - 90) * 0.8;
  else if (v >= 80) v = 76 + (v - 80) * 1.0;
  else if (v >= 70) v = 66 + (v - 70) * 1.0;
  else if (v >= 60) v = 57 + (v - 60) * 0.9;
  else v = 50 + (v - 50) * 0.85;

  if (sample > 0 && sample < 40) v = v * 0.72 + 50 * 0.28;
  else if (sample >= 40 && sample < 80) v = v * 0.84 + 50 * 0.16;
  else if (sample >= 80 && sample < 130) v = v * 0.92 + 50 * 0.08;

  return clamp(v, 35, 96);
}

function directOverlapScore({ primaryPitch, primaryUsage, hitterPitchScore, pitcherWeakness, bestHitterPitch, weakestPitcherPitch, bestHitterPitchScore, weakestPitcherPitchScore, hitterSample, pitcherSample }) {
  const primary = normPitch(primaryPitch);
  const best = normPitch(bestHitterPitch);
  const weak = normPitch(weakestPitcherPitch);

  const hitter = stabilizePitchMetric(hitterPitchScore, hitterSample);
  const weakness = stabilizePitchMetric(pitcherWeakness, pitcherSample);
  const bestScore = stabilizePitchMetric(bestHitterPitchScore, hitterSample);
  const weakScore = stabilizePitchMetric(weakestPitcherPitchScore, pitcherSample);

  let score = 50;

  score += clamp((hitter - 58) * 0.34, -12, 14);
  score += clamp((weakness - 58) * 0.32, -12, 14);
  score += clamp((bestScore - 62) * 0.13, -5, 6);
  score += clamp((weakScore - 62) * 0.13, -5, 6);

  score += clamp((usageScore(primaryUsage) - 65) * 0.10, 0, 4);
  score += pitchFamilyBoost(primary) * 0.35;

  if (primary && best && primary === best) score += 3.5;
  if (primary && weak && primary === weak) score += 3.5;
  if (best && weak && best === weak) score += 4;

  if (primaryUsage > 0 && primaryUsage < 15) score -= 4;
  if (primaryUsage > 0 && primaryUsage < 10) score -= 4;
  if (primaryUsage > 0 && primaryUsage < 6) score -= 5;

  if (hitterSample > 0 && hitterSample < 50) score -= 3;
  if (pitcherSample > 0 && pitcherSample < 50) score -= 3;

  return clamp(score, 35, 96);
}

function arsenalPressureScore(mix, hitterBestPitch, pitcherWeakPitch) {
  if (!mix.length) return 50;

  const best = normPitch(hitterBestPitch);
  const weak = normPitch(pitcherWeakPitch);

  let totalWeight = 0;
  let weighted = 0;

  for (const item of mix) {
    const pitch = normPitch(item.pitch);
    const usage = num(item.usage);

    let pitchScore = 50 + pitchFamilyBoost(pitch) * 0.40;

    if (pitch && best && pitch === best) pitchScore += 9;
    if (pitch && weak && pitch === weak) pitchScore += 9;

    if (usage >= 35) pitchScore += 5;
    else if (usage >= 25) pitchScore += 3;
    else if (usage >= 15) pitchScore += 1;

    const weight = usage || 5;
    weighted += pitchScore * weight;
    totalWeight += weight;
  }

  if (!totalWeight) return 50;
  return clamp(weighted / totalWeight);
}

function finalPitchScore(parts) {
  let score =
    parts.direct * 0.25 +
    parts.arsenal * 0.16 +
    parts.pitchTypeScore * 0.15 +
    parts.contact * 0.20 +
    parts.split * 0.10 +
    parts.market * 0.09 +
    parts.master * 0.05;

  if (
    parts.direct >= 82 &&
    parts.contact >= 82 &&
    parts.pitchTypeScore >= 78 &&
    parts.primaryUsage >= 18
  ) {
    score += 2.5;
  }

  if (
    parts.direct >= 88 &&
    parts.contact >= 88 &&
    parts.pitchTypeScore >= 85 &&
    parts.primaryUsage >= 25
  ) {
    score += 2.5;
  }

  if (parts.direct < 62 || parts.contact < 58) score -= 4;
  if (parts.primaryUsage > 0 && parts.primaryUsage < 10) score -= 4;
  if (parts.primaryUsage > 0 && parts.primaryUsage < 6) score -= 5;

  return round(clamp(score));
}

function main() {
  fs.mkdirSync(EXPORTS, { recursive: true });

  const master = rows(path.join(DATA, "master_hr_model.csv"));
  const playerStats = rows(path.join(DATA, "player_stats.csv"));
  const pitchTypes = rows(path.join(DATA, "pitch_type_matchups.csv"));
  const splits = rows(path.join(DATA, "pitcher_splits_engine.csv"));
  const matchupIntel = rows(path.join(DATA, "matchup_intelligence.csv"));

  const playerMap = new Map();
  for (const r of playerStats) {
    playerMap.set(key(r.name, r.team), r);
  }

  const pitchTypeMap = new Map();
  for (const r of pitchTypes) {
    const batter = clean(r.batter || r.name || r.player);
    const pitcher = clean(r.pitcher || r.opposing_pitcher || r.starter);
    if (batter && pitcher) pitchTypeMap.set(matchupKey(batter, pitcher), r);
  }

  const splitMap = new Map();
  for (const r of splits) {
    splitMap.set(key(r.name, r.team), r);
  }

  const intelMap = new Map();
  for (const r of matchupIntel) {
    intelMap.set(key(r.name, r.team), r);
  }

  const out = [];

  for (const row of master) {
    const name = clean(row.name);
    const team = clean(row.team);
    const pitcher = clean(row.pitcher);

    const ps = playerMap.get(key(name, team)) || {};
    const pt = pitchTypeMap.get(matchupKey(name, pitcher)) || {};
    const sp = splitMap.get(key(name, team)) || {};
    const mi = intelMap.get(key(name, team)) || {};

    const primaryPitch = clean(ps.primary_pitch_match || pt.primary_pitch_match);
    const primaryUsage = num(ps.primary_pitch_usage_pct || pt.primary_pitch_usage_pct);
    const hitterPitchScore = num(ps.primary_pitch_hitter_score || pt.primary_pitch_hitter_score);
    const pitcherWeakness = num(ps.primary_pitch_pitcher_weakness || pt.primary_pitch_pitcher_weakness);
    const bestHitterPitch = clean(ps.best_hitter_pitch || pt.best_hitter_pitch);
    const bestHitterPitchScore = num(ps.best_hitter_pitch_score || pt.best_hitter_pitch_score);
    const weakestPitcherPitch = clean(ps.weakest_pitcher_pitch || pt.weakest_pitcher_pitch);
    const weakestPitcherPitchScore = num(ps.weakest_pitcher_pitch_score || pt.weakest_pitcher_pitch_score);
    const pitcherPrimaryMix = clean(ps.pitcher_primary_mix || pt.pitcher_primary_mix);
    const hitterSample = num(ps.hitter_pitch_sample || pt.hitter_pitch_sample);
    const pitcherSample = num(ps.pitcher_pitch_sample || pt.pitcher_pitch_sample);

    const mix = parsePitchMix(pitcherPrimaryMix);

    const direct = directOverlapScore({
      primaryPitch,
      primaryUsage,
      hitterPitchScore,
      pitcherWeakness,
      bestHitterPitch,
      weakestPitcherPitch,
      bestHitterPitchScore,
      weakestPitcherPitchScore,
      hitterSample,
      pitcherSample
    });

    const arsenal = arsenalPressureScore(mix, bestHitterPitch, weakestPitcherPitch);
    const pitchTypeScore = num(row.pitch_type_score) || num(ps.pitch_type_score) || num(pt.score) || 50;
    const contact = num(mi.contact) || num(row.statcast_score) || 50;
    const split = num(sp.handedness_split_score) || 50;
    const market = num(row.market_score) || num(ps.market_score) || 60;
    const master = num(row.composite_score) || 60;

    const perPitchScore = finalPitchScore({
      direct,
      arsenal,
      pitchTypeScore,
      contact,
      split,
      market,
      master,
      primaryUsage
    });

    out.push({
      rank: 0,
      name,
      team,
      opponent: row.opponent,
      game: row.game,
      pitcher,
      odds: row.best_hr_odds,
      primary_pitch_match: normPitch(primaryPitch),
      primary_pitch_usage_pct: round(primaryUsage),
      primary_pitch_hitter_score: round(hitterPitchScore),
      primary_pitch_pitcher_weakness: round(pitcherWeakness),
      hitter_pitch_sample: round(hitterSample),
      pitcher_pitch_sample: round(pitcherSample),
      best_hitter_pitch: normPitch(bestHitterPitch),
      best_hitter_pitch_score: round(bestHitterPitchScore),
      weakest_pitcher_pitch: normPitch(weakestPitcherPitch),
      weakest_pitcher_pitch_score: round(weakestPitcherPitchScore),
      pitcher_primary_mix: pitcherPrimaryMix,
      direct_overlap_score: round(direct),
      arsenal_pressure_score: round(arsenal),
      pitch_type_score: round(pitchTypeScore),
      contact_score: round(contact),
      handedness_split_score: round(split),
      market_score: round(market),
      per_pitch_score: perPitchScore,
      per_pitch_grade: grade(perPitchScore),
      split_engine_score: sp.split_engine_score || "",
      matchup_intel_score: mi.intel || "",
      master_score: row.composite_score,
      master_tier: row.tier
    });
  }

  out.sort((a, b) => {
    if (b.per_pitch_score !== a.per_pitch_score) return b.per_pitch_score - a.per_pitch_score;
    return num(b.master_score) - num(a.master_score);
  });

  out.forEach((r, i) => r.rank = i + 1);

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_EXPORT_JSON, JSON.stringify(out, null, 2));
  writeCSV(OUT_CSV, out);
  writeCSV(OUT_EXPORT_CSV, out);

  const spread = {};
  for (const r of out) spread[r.per_pitch_grade] = (spread[r.per_pitch_grade] || 0) + 1;

  console.log("");
  console.log("THE SLIP LAB PER PITCH MATCHUP ENGINE COMPLETE");
  console.log(`Rows: ${out.length}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log("Grade spread:", spread);
  console.log("");

  console.table(out.slice(0, 20).map(r => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    pitcher: r.pitcher,
    odds: r.odds,
    pitch: r.primary_pitch_match,
    usage: r.primary_pitch_usage_pct,
    hitter: r.primary_pitch_hitter_score,
    weak: r.primary_pitch_pitcher_weakness,
    direct: r.direct_overlap_score,
    arsenal: r.arsenal_pressure_score,
    score: r.per_pitch_score,
    grade: r.per_pitch_grade
  })));
}

main();
