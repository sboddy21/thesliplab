import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");
const CONTENT = path.join(EXPORTS, "final_hr_boards");

fs.mkdirSync(EXPORTS, { recursive: true });
fs.mkdirSync(CONTENT, { recursive: true });

const INPUT = path.join(DATA, "final_hr_decision_engine.csv");

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

function num(v) {
  const n = Number(String(v || "").replace(/[%,$+]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCSV(file, list) {
  if (!list.length) {
    fs.writeFileSync(file, "");
    return;
  }

  const headers = Object.keys(list[0]);
  const out = [
    headers.join(","),
    ...list.map(r => headers.map(h => csvEscape(r[h])).join(","))
  ];

  fs.writeFileSync(file, out.join("\n"));
}

function cleanBoard(list) {
  return list.map(r => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    opponent: r.opponent,
    pitcher: r.pitcher,
    odds: r.odds,
    book: r.book,
    final_hr_score: r.final_hr_score,
    decision_tier: r.decision_tier,
    confidence: r.confidence,
    agreement_count: r.agreement_count,
    signal_flags: r.signal_flags,
    master_score: r.master_score,
    matchup_score: r.matchup_score,
    split_score: r.split_score,
    per_pitch_score: r.per_pitch_score,
    primary_pitch_match: r.primary_pitch_match,
    primary_pitch_usage_pct: r.primary_pitch_usage_pct,
    note: r.note
  }));
}

function xLine(r) {
  return `${r.rank}. ${r.name} (${r.team}) vs ${r.pitcher} | ${r.odds} | Score ${r.final_hr_score} | ${r.decision_tier}`;
}

function writeText(file, title, list) {
  const lines = [];

  lines.push(title);
  lines.push("");
  lines.push("The Slip Lab HR Decision Engine");
  lines.push("");

  for (const r of list) {
    lines.push(xLine(r));
    if (r.signal_flags) lines.push(`Signals: ${r.signal_flags}`);
    if (r.primary_pitch_match) lines.push(`Pitch edge: ${r.primary_pitch_match} ${r.primary_pitch_usage_pct}%`);
    lines.push("");
  }

  fs.writeFileSync(file, lines.join("\n"));
}

const all = rows(INPUT).sort((a, b) => num(b.final_hr_score) - num(a.final_hr_score));

const elite = all.filter(r =>
  ["SLIP LAB ELITE", "CORE PLAY"].includes(r.decision_tier)
);

const strong = all.filter(r =>
  ["SLIP LAB ELITE", "CORE PLAY", "STRONG PLAY"].includes(r.decision_tier)
);

const value = all.filter(r =>
  r.decision_tier === "VALUE BOMB" ||
  (num(r.odds) >= 450 && num(r.final_hr_score) >= 70)
);

const playable = all.filter(r =>
  ["SLIP LAB ELITE", "CORE PLAY", "STRONG PLAY", "PLAYABLE", "VALUE BOMB"].includes(r.decision_tier)
);

const lotto = all.filter(r =>
  num(r.odds) >= 650 &&
  num(r.final_hr_score) >= 62
);

const safest = all.filter(r =>
  num(r.odds) <= 450 &&
  num(r.final_hr_score) >= 72
);

const top25 = all.slice(0, 25);

writeCSV(path.join(CONTENT, "final_hr_top_25.csv"), cleanBoard(top25));
writeCSV(path.join(CONTENT, "final_hr_elite_core.csv"), cleanBoard(elite));
writeCSV(path.join(CONTENT, "final_hr_strong_plays.csv"), cleanBoard(strong));
writeCSV(path.join(CONTENT, "final_hr_value_bombs.csv"), cleanBoard(value));
writeCSV(path.join(CONTENT, "final_hr_playable_board.csv"), cleanBoard(playable));
writeCSV(path.join(CONTENT, "final_hr_lotto_only.csv"), cleanBoard(lotto));
writeCSV(path.join(CONTENT, "final_hr_safest.csv"), cleanBoard(safest));

writeText(path.join(CONTENT, "x_elite_core.txt"), "HR ELITE / CORE PLAYS", elite.slice(0, 6));
writeText(path.join(CONTENT, "x_strong_plays.txt"), "HR STRONG PLAYS", strong.slice(0, 8));
writeText(path.join(CONTENT, "x_value_bombs.txt"), "HR VALUE BOMBS", value.slice(0, 8));
writeText(path.join(CONTENT, "x_safest.txt"), "HR SAFEST BOARD", safest.slice(0, 8));
writeText(path.join(CONTENT, "x_top_10.txt"), "HR TOP 10 BOARD", all.slice(0, 10));

console.log("");
console.log("THE SLIP LAB FINAL HR BOARDS EXPORT COMPLETE");
console.log(`Input rows: ${all.length}`);
console.log(`Top 25: ${top25.length}`);
console.log(`Elite/Core: ${elite.length}`);
console.log(`Strong: ${strong.length}`);
console.log(`Value Bombs: ${value.length}`);
console.log(`Playable: ${playable.length}`);
console.log(`Lotto: ${lotto.length}`);
console.log(`Safest: ${safest.length}`);
console.log(`Saved folder: ${CONTENT}`);
console.log("");

console.table(top25.slice(0, 12).map(r => ({
  rank: r.rank,
  name: r.name,
  team: r.team,
  pitcher: r.pitcher,
  odds: r.odds,
  score: r.final_hr_score,
  tier: r.decision_tier,
  conf: r.confidence
})));
