import path from "path";
import {
  DATA_DIR,
  EXPORT_DIR,
  ensureDir,
  readCSV,
  writeCSV,
  backupFile,
  num,
  clamp,
  score01
} from "./normalize_utils.js";

ensureDir(EXPORT_DIR);

const INPUT = path.join(DATA_DIR, "player_stats.csv");
const OUTPUT = path.join(EXPORT_DIR, "hr_model.csv");

function trendScore(row) {
  const l5hr = num(row.last_5_hr || row.l5_hr);
  const l10hr = num(row.last_10_hr || row.l10_hr);
  const l5tb = num(row.last_5_tb_per_game || row.l5_tbpg);
  const l10tb = num(row.last_10_tb_per_game || row.l10_tbpg);
  const hot = num(row.hot_streak_score || row.hot);

  const raw =
    l5hr * 12 +
    l10hr * 5 +
    score01(l5tb, 0.4, 3.2) * 0.25 +
    score01(l10tb, 0.4, 3.0) * 0.15 +
    hot * 0.30;

  return clamp(raw, 0, 100);
}

function marketScore(row) {
  return score01(row.implied, 1.5, 9.5);
}

function powerScore(row) {
  const pa = num(row.pa);
  const hr = num(row.hr);
  const hrRate = pa > 0 ? hr / pa * 100 : 0;

  return clamp(
    score01(hrRate, 1, 8) * 0.45 +
    score01(row.slg, 0.320, 0.700) * 0.35 +
    score01(row.ops, 0.650, 1.100) * 0.20,
    0,
    100
  );
}

function statcastScore(row) {
  const hasData = num(row.bbe) > 0 || num(row.barrel_pct) > 0 || num(row.hard_hit_pct) > 0;

  if (!hasData) return 55;

  return clamp(
    score01(row.barrel_pct, 3, 20) * 0.40 +
    score01(row.hard_hit_pct, 25, 60) * 0.25 +
    score01(row.avg_ev, 86, 94) * 0.15 +
    score01(row.max_ev, 103, 116) * 0.10 +
    score01(row.flyball_pct, 25, 52) * 0.10,
    0,
    100
  );
}

function pitcherScore(row) {
  return clamp(num(row.pitcher_attack_score || row.pAtk || row.attack_score), 35, 100);
}

function parkScore(row) {
  return clamp(num(row.park_score || row.parkScore || row.hr_park_score), 25, 100);
}

function weatherScore(row) {
  return clamp(num(row.weather_boost || row.weatherBoost || row.weather_score), 0, 12);
}

function vegasScore(row) {
  const total = num(row.vegas_game_total || row.game_total);
  if (!total) return 50;
  return score01(total, 6.5, 10.5);
}

function lineupScore(row) {
  const spot = num(row.lineup);

  if (!spot) return 50;
  if (spot <= 2) return 78;
  if (spot <= 5) return 95;
  if (spot <= 7) return 62;
  return 42;
}

function oddsQualityScore(row) {
  const books = num(row.trusted_books_count);
  const quality = String(row.odds_quality || "");

  let score = 60;

  if (books >= 4) score += 18;
  else if (books === 3) score += 10;
  else if (books === 2) score += 3;
  else score -= 8;

  if (quality.includes("CLEAN")) score += 10;
  if (quality.includes("NORMAL")) score += 5;
  if (quality.includes("USABLE")) score -= 2;

  return clamp(score, 35, 100);
}

function regressionPenalty(row) {
  let p = 0;

  if (num(row.pa) < 40) p += 5;
  if (num(row.trusted_books_count) < 2) p += 6;
  if (String(row.lineup_status || "").toLowerCase() !== "confirmed") p += 2;

  return clamp(p, 0, 15);
}

function finalScore(row) {
  const components = {
    market: marketScore(row),
    power: powerScore(row),
    statcast: statcastScore(row),
    trend: trendScore(row),
    pitcher: pitcherScore(row),
    park: parkScore(row),
    vegas: vegasScore(row),
    lineup: lineupScore(row),
    oddsQuality: oddsQualityScore(row)
  };

  const raw =
    components.market * 0.18 +
    components.power * 0.23 +
    components.statcast * 0.15 +
    components.trend * 0.13 +
    components.pitcher * 0.11 +
    components.park * 0.07 +
    components.vegas * 0.04 +
    components.lineup * 0.04 +
    components.oddsQuality * 0.05 +
    weatherScore(row);

  const widened = 50 + (raw - 50) * 1.18;
  const final = clamp(widened - regressionPenalty(row), 1, 99);

  return {
    ...components,
    final
  };
}

const rows = readCSV(INPUT);
const backup = backupFile(INPUT);

const scored = rows.map(row => {
  const s = finalScore(row);
  const final = s.final.toFixed(2);

  return {
    ...row,
    market_score: s.market.toFixed(2),
    power_score: s.power.toFixed(2),
    statcast_score: s.statcast.toFixed(2),
    trend_score: s.trend.toFixed(2),
    pitcher_score: s.pitcher.toFixed(2),
    park_score_model: s.park.toFixed(2),
    vegas_score: s.vegas.toFixed(2),
    lineup_score: s.lineup.toFixed(2),
    odds_quality_score: s.oddsQuality.toFixed(2),
    final_score: final,
    score: final,
    tier:
      num(final) >= 88 ? "ELITE" :
      num(final) >= 76 ? "STRONG" :
      num(final) >= 63 ? "SOLID" :
      num(final) >= 50 ? "WATCH" :
      "LONGSHOT"
  };
});

scored.sort((a, b) => num(b.final_score) - num(a.final_score));
scored.forEach((r, i) => r.rank = i + 1);

writeCSV(INPUT, scored);
writeCSV(OUTPUT, scored);

console.log("Done.");
console.log(`Rows scored: ${scored.length}`);
console.log(`Backup: ${backup || "none"}`);
console.log(`Saved: ${INPUT}`);
console.log(`Exported: ${OUTPUT}`);

console.table(scored.slice(0, 25).map(r => ({
  rank: r.rank,
  name: r.name,
  team: r.team,
  odds: r.odds,
  book: r.book,
  final: r.final_score,
  tier: r.tier,
  market: r.market_score,
  power: r.power_score,
  trend: r.trend_score,
  pitcher: r.pitcher_score
})));