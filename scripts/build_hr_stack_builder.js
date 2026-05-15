import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const IN_CSV = path.join(DATA_DIR, "correlation_engine.csv");
const OUT_CSV = path.join(DATA_DIR, "hr_stack_builder.csv");
const OUT_JSON = path.join(DATA_DIR, "hr_stack_builder.json");

function clean(v) {
  return String(v ?? "").trim();
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
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
  if (!fs.existsSync(file)) {
    console.log("Missing input:", file);
    return [];
  }

  return parseCSV(fs.readFileSync(file, "utf8"));
}

function combo(items, size) {
  const out = [];

  function walk(start, picked) {
    if (picked.length === size) {
      out.push([...picked]);
      return;
    }

    for (let i = start; i < items.length; i++) {
      picked.push(items[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  }

  walk(0, []);
  return out;
}

function avg(values) {
  const good = values.map(v => num(v, null)).filter(v => v !== null && Number.isFinite(v));
  if (!good.length) return 0;
  return good.reduce((a, b) => a + b, 0) / good.length;
}

function uniq(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function getStackType(players) {
  const teams = uniq(players.map(p => p.team));

  if (teams.length === 1) return "TEAMMATE_HR_STACK";
  if (teams.length === 2) return "GAME_ENVIRONMENT_STACK";

  return "MIXED_GAME_STACK";
}

function lineupBonus(players) {
  const orders = players.map(p => num(p.lineup, 99)).filter(n => n > 0 && n < 99);

  if (orders.length !== players.length) return 2;

  const spread = Math.max(...orders) - Math.min(...orders);

  if (spread <= 2) return 8;
  if (spread <= 4) return 5;
  if (spread <= 6) return 3;

  return 1;
}

function oddsLabel(players) {
  const odds = players.map(p => num(p.odds)).filter(Boolean);
  const avgOdds = avg(odds);

  if (!avgOdds) return "NO_ODDS";
  if (avgOdds >= 900) return "HIGH_PAYOUT";
  if (avgOdds >= 600) return "PLUS_VALUE";
  if (avgOdds >= 350) return "BALANCED";

  return "CHALKY";
}

function stackGrade(score) {
  if (score >= 86) return "ELITE_STACK";
  if (score >= 76) return "STRONG_STACK";
  if (score >= 66) return "PLAYABLE_STACK";
  if (score >= 56) return "THIN_STACK";

  return "DEEP_ONLY";
}

const rows = readCSV(IN_CSV);

const groups = new Map();

for (const r of rows) {
  const game = clean(r.game);
  const player = clean(r.player);

  if (!game || !player) continue;

  if (!groups.has(game)) groups.set(game, []);
  groups.get(game).push(r);
}

const stacks = [];

for (const [game, players] of groups.entries()) {
  const sorted = players
    .filter(p => clean(p.player))
    .sort((a, b) => {
      const bScore = num(b.correlation_score) + num(b.environment_score) * 0.2 + num(b.pitcher_collapse_score) * 0.2;
      const aScore = num(a.correlation_score) + num(a.environment_score) * 0.2 + num(a.pitcher_collapse_score) * 0.2;
      return bScore - aScore;
    })
    .slice(0, 12);

  if (sorted.length < 2) continue;

  for (const size of [2, 3, 4]) {
    if (sorted.length < size) continue;

    for (const group of combo(sorted, size)) {
      const environmentScore = avg(group.map(p => p.environment_score));
      const collapseScore = avg(group.map(p => p.pitcher_collapse_score));
      const powerScore = avg(group.map(p => p.batter_power_score));
      const corrScore = avg(group.map(p => p.correlation_score));

      const lineBonus = lineupBonus(group);
      const teams = uniq(group.map(p => p.team));
      const sameTeamBonus = teams.length === 1 ? 7 : 2;
      const weatherBoost = avg(group.map(p => p.weather_boost));
      const vegasTotal = avg(group.map(p => p.vegas_total));

      const environmentBonus =
        (vegasTotal >= 9 ? 5 : vegasTotal >= 8.5 ? 3 : 0) +
        (weatherBoost >= 2 ? 4 : weatherBoost >= 1 ? 2 : 0);

      const stackScore =
        corrScore * 0.38 +
        environmentScore * 0.22 +
        collapseScore * 0.18 +
        powerScore * 0.12 +
        lineBonus +
        sameTeamBonus +
        environmentBonus;

      stacks.push({
        stack_id: `${game} | ${size} MAN | ${group.map(p => p.player).join(" + ")}`,
        game,
        stack_size: size,
        stack_type: getStackType(group),
        players: group.map(p => p.player).join(" + "),
        teams: teams.join(" / "),
        pitcher: uniq(group.map(p => p.pitcher)).join(" / "),
        odds: group.map(p => `${p.player} ${p.odds || ""}`.trim()).join(" | "),
        avg_correlation_score: corrScore.toFixed(2),
        avg_environment_score: environmentScore.toFixed(2),
        avg_pitcher_collapse_score: collapseScore.toFixed(2),
        avg_batter_power_score: powerScore.toFixed(2),
        avg_vegas_total: vegasTotal ? vegasTotal.toFixed(2) : "",
        avg_weather_boost: weatherBoost ? weatherBoost.toFixed(2) : "",
        lineup_correlation_bonus: lineBonus.toFixed(2),
        same_team_bonus: sameTeamBonus.toFixed(2),
        environment_bonus: environmentBonus.toFixed(2),
        stack_score: stackScore.toFixed(2),
        stack_grade: stackGrade(stackScore),
        payout_profile: oddsLabel(group)
      });
    }
  }
}

stacks.sort((a, b) => num(b.stack_score) - num(a.stack_score));

fs.writeFileSync(OUT_CSV, toCSV(stacks));
fs.writeFileSync(OUT_JSON, JSON.stringify(stacks, null, 2));

console.log("PHASE 7 HR STACK BUILDER COMPLETE");
console.log("Input players:", rows.length);
console.log("Games:", groups.size);
console.log("Stacks:", stacks.length);
console.log("Saved:", OUT_CSV);
console.log("Saved:", OUT_JSON);
