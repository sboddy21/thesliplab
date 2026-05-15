import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");

const OUT_JSON = path.join(DATA, "matchup_intelligence.json");
const OUT_CSV = path.join(DATA, "matchup_intelligence.csv");

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

function normalizeName(v) {
  let s = lower(v)
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

function nameVariants(v) {
  const base = normalizeName(v);
  const parts = base.split(" ").filter(Boolean);
  const set = new Set();

  if (base) set.add(base);

  if (parts.length >= 2) {
    set.add(`${parts[parts.length - 1]} ${parts.slice(0, -1).join(" ")}`);
  }

  return [...set];
}

function clamp(v, min = 0, max = 99) {
  return Math.max(min, Math.min(max, v));
}

function round(v) {
  return Math.round(v * 10) / 10;
}

function key(name, team = "") {
  return `${normalizeName(name)}|${lower(team)}`;
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
  if (score >= 75) return "ATTACK";
  if (score >= 65) return "PLUS";
  if (score >= 55) return "NEUTRAL";
  if (score >= 45) return "THIN";
  return "AVOID";
}

const master = rows(path.join(DATA, "master_hr_model.csv"));
const playerStats = rows(path.join(DATA, "player_stats.csv"));
const statcast = rows(path.join(DATA, "statcast_batter_stats.csv"));
const recent = rows(path.join(DATA, "recent_form.csv"));

const playerMap = new Map();
const statcastMap = new Map();
const recentMap = new Map();

for (const r of playerStats) {
  playerMap.set(key(r.name, r.team), r);
}

for (const r of statcast) {
  for (const v of nameVariants(r.player)) {
    statcastMap.set(v, r);
  }

  if (r.player_key) {
    statcastMap.set(normalizeName(r.player_key), r);
  }
}

for (const r of recent) {
  recentMap.set(key(r.name, r.team), r);
}

const out = [];

for (const row of master) {
  const name = clean(row.name);
  const team = clean(row.team);

  const ps = playerMap.get(key(name, team)) || {};
  const sc = statcastMap.get(normalizeName(name)) || {};
  const rf = recentMap.get(key(name, team)) || {};

  const brl = num(row.barrel_rate) || num(sc.barrel_pct) || num(ps.barrel_pct);
  const hh = num(row.hard_hit_rate) || num(sc.hard_hit_pct) || num(ps.hard_hit_pct);
  const avgEv = num(sc.avg_ev) || num(ps.avg_ev);
  const flyball = num(row.flyball_rate) || num(sc.flyball_pct);
  const sweetSpot = num(sc.sweet_spot_pct);

  let contact = 50;
  if (brl > 0) contact += clamp((brl - 8) * 2.5, -10, 25);
  if (hh > 0) contact += clamp((hh - 40) * 0.8, -10, 20);
  if (avgEv > 0) contact += clamp((avgEv - 88) * 1.8, -8, 14);
  if (flyball > 0) contact += clamp((flyball - 32) * 0.45, -8, 12);
  if (sweetSpot > 0) contact += clamp((sweetSpot - 33) * 0.35, -5, 8);
  contact = clamp(contact);

  const pitcherScore = clamp(
    num(row.pitcher_damage_score) ||
    num(row.pitcher_attack_score) ||
    num(ps.pitcher_attack_score) ||
    50
  );

  const env = clamp(
    50 +
    (num(ps.hr_park_score) - 50) * 0.18 +
    num(ps.weather_boost) * 0.4 +
    (num(ps.bullpen_attack_score) - 50) * 0.12 +
    num(ps.vegas_total_boost) * 0.3
  );

  const hasRecent =
    Object.keys(rf).length > 0 ||
    num(ps.l5_hr) > 0 ||
    num(ps.l10_hr) > 0 ||
    num(ps.l5_tbpg) > 0 ||
    num(ps.l10_tbpg) > 0;

  const recentScore = hasRecent
    ? clamp(
        50 +
        num(ps.l5_hr) * 6 +
        num(ps.l10_hr) * 2.5 +
        num(rf.last_5_hr_rate) * 0.18 +
        num(rf.last_15_hr_rate) * 0.08 +
        (num(rf.last_5_tb_per_game) - 1.5) * 5 +
        (num(rf.last_15_tb_per_game) - 1.2) * 3 +
        (num(rf.form_score) - 50) * 0.15
      )
    : 50;

  const market =
    num(row.market_score) ||
    num(ps.market_score) ||
    60;

  const intel = round(
    contact * 0.26 +
    pitcherScore * 0.24 +
    env * 0.18 +
    recentScore * 0.16 +
    market * 0.16
  );

  out.push({
    rank: 0,
    name,
    team,
    pitcher: row.pitcher,
    odds: row.odds || row.best_hr_odds,
    brl: round(brl),
    hh: round(hh),
    contact: round(contact),
    pitcherScore: round(pitcherScore),
    env: round(env),
    recent: round(recentScore),
    intel,
    grade: grade(intel)
  });
}

out.sort((a, b) => b.intel - a.intel);
out.forEach((r, i) => r.rank = i + 1);

fs.mkdirSync(EXPORTS, { recursive: true });

fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
writeCSV(OUT_CSV, out);

fs.writeFileSync(path.join(EXPORTS, "matchup_intelligence.json"), JSON.stringify(out, null, 2));
writeCSV(path.join(EXPORTS, "matchup_intelligence.csv"), out);

const spread = {};
for (const r of out) spread[r.grade] = (spread[r.grade] || 0) + 1;

console.log("");
console.log("THE SLIP LAB MATCHUP INTELLIGENCE COMPLETE");
console.log(`Rows: ${out.length}`);
console.log(`Saved: ${OUT_CSV}`);
console.log(`Saved: ${OUT_JSON}`);
console.log("Grade spread:", spread);
console.log("");

console.table(
  out.slice(0, 20).map(r => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    pitcher: r.pitcher,
    odds: r.odds,
    brl: r.brl,
    hh: r.hh,
    contact: r.contact,
    env: r.env,
    recent: r.recent,
    intel: r.intel,
    grade: r.grade
  }))
);
