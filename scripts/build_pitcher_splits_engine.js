import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");

const OUT_CSV = path.join(DATA, "pitcher_splits_engine.csv");
const OUT_JSON = path.join(DATA, "pitcher_splits_engine.json");
const OUT_EXPORT_CSV = path.join(EXPORTS, "pitcher_splits_engine.csv");
const OUT_EXPORT_JSON = path.join(EXPORTS, "pitcher_splits_engine.json");

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

function num(v, fallback = 0) {
  const n = Number(String(v || "").replace(/[%,$+]/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
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

function key(name) {
  return normName(name);
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

function handLabel(v) {
  const h = lower(v);
  if (h === "l" || h.includes("left")) return "L";
  if (h === "r" || h.includes("right")) return "R";
  if (h === "s" || h.includes("switch")) return "S";
  return "";
}

function vulnerabilityGrade(score) {
  if (score >= 85) return "TARGET";
  if (score >= 75) return "ATTACK";
  if (score >= 65) return "PLUS";
  if (score >= 55) return "NEUTRAL";
  if (score >= 45) return "THIN";
  return "AVOID";
}

function splitAdvantage(batterHand, pitcherHand) {
  if (!batterHand || !pitcherHand) return 50;

  if (batterHand === "S") return 58;

  if (batterHand === "L" && pitcherHand === "R") return 62;
  if (batterHand === "R" && pitcherHand === "L") return 62;

  if (batterHand === "L" && pitcherHand === "L") return 43;
  if (batterHand === "R" && pitcherHand === "R") return 50;

  return 50;
}

function calculatePitcherVulnerability(row) {
  const era = num(row.pitcher_era);
  const whip = num(row.pitcher_whip);
  const xfip = num(row.pitcher_xfip);
  const k9 = num(row.pitcher_k9);
  const bb9 = num(row.pitcher_bb9);
  const hr9 = num(row.pitcher_hr9);
  const attack = num(row.pitcher_attack_score) || num(row.pAtk);

  let score = 50;

  if (attack > 0) score += clamp((attack - 50) * 0.45, -14, 22);
  if (hr9 > 0) score += clamp((hr9 - 1.05) * 12, -10, 24);
  if (era > 0) score += clamp((era - 4.00) * 3.3, -8, 14);
  if (whip > 0) score += clamp((whip - 1.25) * 18, -8, 12);
  if (xfip > 0) score += clamp((xfip - 4.10) * 3.2, -8, 12);
  if (k9 > 0) score += clamp((8.5 - k9) * 1.25, -8, 8);
  if (bb9 > 0) score += clamp((bb9 - 3.0) * 1.2, -4, 7);

  return clamp(score);
}

function calculateBatterPower(row) {
  const barrel = num(row.barrel_rate) || num(row.barrel_pct);
  const hardHit = num(row.hard_hit_rate) || num(row.hard_hit_pct);
  const xslg = num(row.xslg);
  const slg = num(row.slg);
  const iso = num(row.iso);
  const contact = num(row.contact) || num(row.contact_score);

  let score = 50;

  if (contact > 0) score += clamp((contact - 50) * 0.35, -12, 22);
  if (barrel > 0) score += clamp((barrel - 8) * 2.2, -10, 24);
  if (hardHit > 0) score += clamp((hardHit - 40) * 0.65, -8, 16);
  if (xslg > 0) score += clamp((xslg - 0.410) * 50, -8, 13);
  if (slg > 0) score += clamp((slg - 0.410) * 45, -8, 12);
  if (iso > 0) score += clamp((iso - 0.160) * 90, -8, 15);

  return clamp(score);
}

function main() {
  fs.mkdirSync(EXPORTS, { recursive: true });

  const master = rows(path.join(DATA, "master_hr_model.csv"));
  const matchup = rows(path.join(DATA, "matchup_intelligence.csv"));
  const playerStats = rows(path.join(DATA, "player_stats.csv"));
  const handedness = rows(path.join(DATA, "player_handedness.csv"));

  const matchupMap = new Map();
  for (const r of matchup) {
    matchupMap.set(`${normName(r.name)}|${lower(r.team)}`, r);
  }

  const playerMap = new Map();
  for (const r of playerStats) {
    playerMap.set(`${normName(r.name)}|${lower(r.team)}`, r);
  }

  const handednessMap = new Map();
  for (const r of handedness) {
    handednessMap.set(`${normName(r.name)}|${lower(r.team)}`, r);
    handednessMap.set(normName(r.name), r);
  }

  const out = [];

  for (const row of master) {
    const name = clean(row.name);
    const team = clean(row.team);
    const mapKey = `${normName(name)}|${lower(team)}`;

    const mi = matchupMap.get(mapKey) || {};
    const ps = playerMap.get(mapKey) || {};
    const hand = handednessMap.get(mapKey) || handednessMap.get(normName(name)) || {};

    const batterHand = handLabel(hand.batter_hand || row.handedness || ps.batter_hand || ps.hand || ps.stand);
    const pitcherHand = handLabel(row.pitcher_hand || ps.pitcher_hand);

    const splitScore = splitAdvantage(batterHand, pitcherHand);
    const pitcherVulnerability = calculatePitcherVulnerability({
      ...ps,
      ...row
    });

    const batterPower = calculateBatterPower({
      ...row,
      ...mi,
      ...ps
    });

    const pitcherAttack = num(row.pitcher_attack_score) || num(ps.pitcher_attack_score) || num(ps.pAtk);
    const pitchTypeScore = num(row.pitch_type_score) || num(ps.pitch_type_score);
    const environment = num(mi.env) || num(row.environment_score) || 50;
    const contact = num(mi.contact) || num(row.statcast_score) || 50;

    const splitEngineScore = round(clamp(
      batterPower * 0.26 +
      pitcherVulnerability * 0.26 +
      splitScore * 0.18 +
      pitchTypeScore * 0.12 +
      environment * 0.10 +
      contact * 0.08
    ));

    out.push({
      rank: 0,
      name,
      team,
      opponent: row.opponent,
      game: row.game,
      batter_hand: batterHand,
      pitcher: row.pitcher,
      pitcher_hand: pitcherHand,
      odds: row.best_hr_odds,
      barrel_rate: row.barrel_rate,
      hard_hit_rate: row.hard_hit_rate,
      pitcher_hr9: row.pitcher_hr9 || ps.pitcher_hr9,
      pitcher_era: row.pitcher_era || ps.pitcher_era,
      pitcher_whip: ps.pitcher_whip || "",
      pitcher_xfip: ps.pitcher_xfip || "",
      pitcher_k9: ps.pitcher_k9 || "",
      pitcher_bb9: ps.pitcher_bb9 || "",
      pitcher_attack_score: round(pitcherAttack),
      batter_power_score: round(batterPower),
      pitcher_vulnerability_score: round(pitcherVulnerability),
      handedness_split_score: round(splitScore),
      pitch_type_score: round(pitchTypeScore),
      environment_score: round(environment),
      contact_score: round(contact),
      split_engine_score: splitEngineScore,
      split_grade: vulnerabilityGrade(splitEngineScore),
      matchup_intel_score: mi.intel || "",
      matchup_grade: mi.grade || "",
      master_score: row.composite_score,
      master_tier: row.tier
    });
  }

  out.sort((a, b) => {
    if (b.split_engine_score !== a.split_engine_score) {
      return b.split_engine_score - a.split_engine_score;
    }
    return num(b.master_score) - num(a.master_score);
  });

  out.forEach((r, i) => r.rank = i + 1);

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_EXPORT_JSON, JSON.stringify(out, null, 2));
  writeCSV(OUT_CSV, out);
  writeCSV(OUT_EXPORT_CSV, out);

  const spread = {};
  for (const r of out) spread[r.split_grade] = (spread[r.split_grade] || 0) + 1;

  console.log("");
  console.log("THE SLIP LAB PITCHER SPLITS ENGINE COMPLETE");
  console.log(`Rows: ${out.length}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log("Grade spread:", spread);
  console.log("");

  console.table(out.slice(0, 20).map(r => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    hand: r.batter_hand,
    pitcher: r.pitcher,
    pHand: r.pitcher_hand,
    odds: r.odds,
    power: r.batter_power_score,
    vuln: r.pitcher_vulnerability_score,
    split: r.handedness_split_score,
    pitch: r.pitch_type_score,
    score: r.split_engine_score,
    grade: r.split_grade
  })));
}

main();
