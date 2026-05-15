import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const EXPORTS = path.join(ROOT, "exports");

const INPUTS = [
  path.join(EXPORTS, "hr_board.csv"),
  path.join(ROOT, "hr_board.csv"),
  path.join(ROOT, "hr_sweep_board_all_games.csv"),
  path.join(EXPORTS, "the_slip_lab_full_board.csv")
];

const OUT = path.join(EXPORTS, "mispriced_hr_players.csv");
const OUT_POST = path.join(EXPORTS, "mispriced_x_post.txt");

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && q && n === '"') { cell += '"'; i++; }
    else if (c === '"') q = !q;
    else if (c === "," && !q) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && n === "\n") i++;
      row.push(cell);
      if (row.some(x => x.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function pick(r, keys) {
  for (const k of keys) {
    const key = k.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (r[key] !== undefined && String(r[key]).trim() !== "") return r[key];
  }
  return "";
}

function num(v) {
  const n = Number(String(v ?? "").replace(/[+,%]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function implied(odds) {
  const o = num(odds);
  if (!o) return null;
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}

function dec(odds) {
  const o = num(odds);
  if (!o) return null;
  return o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
}

function fair(prob) {
  if (!prob || prob <= 0 || prob >= 1) return "";
  return prob >= .5 ? Math.round((prob / (1 - prob)) * -100) : `+${Math.round(((1 - prob) / prob) * 100)}`;
}

function modelProb(r) {
  const direct = num(pick(r, ["model_probability", "model_prob", "hr_probability", "probability", "prob"]));
  if (direct) return direct > 1 ? direct / 100 : direct;

  const score = num(pick(r, ["score", "hr_score", "final_score", "model_score"]));
  if (!score) return null;

  return Math.max(.025, Math.min(.18, .03 + score * .00145));
}

function csv(rows) {
  if (!rows.length) return "";
  const h = Object.keys(rows[0]);
  return [
    h.join(","),
    ...rows.map(r => h.map(k => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(","))
  ].join("\n");
}

function main() {
  if (!fs.existsSync(EXPORTS)) fs.mkdirSync(EXPORTS, { recursive: true });

  const input = INPUTS.find(f => fs.existsSync(f));
  if (!input) throw new Error("No HR board found.");

  const rows = parseCSV(fs.readFileSync(input, "utf8"));
  const out = [];

  let noOdds = 0, noProb = 0, noPlayer = 0;

  for (const r of rows) {
    const player = pick(r, ["player", "name", "batter", "hitter"]);
    const team = pick(r, ["team", "player_team", "batter_team"]);
    const pitcher = pick(r, ["pitcher", "opposing_pitcher", "starter"]);
    const odds = pick(r, ["best_odds", "odds", "hr_odds", "american_odds", "price"]);
    const book = pick(r, ["book", "sportsbook", "bookmaker", "source", "line_source"]) || "Best Available";

    if (!player) { noPlayer++; continue; }

    const ip = implied(odds);
    if (!ip) { noOdds++; continue; }

    const mp = modelProb(r);
    if (!mp) { noProb++; continue; }

    const ev = mp * dec(odds) - 1;
    const edge = mp - ip;
    const score = num(pick(r, ["score", "hr_score", "final_score", "model_score"]));

    out.push({
      rank: 0,
      player,
      team,
      pitcher,
      best_odds: String(odds).startsWith("+") || String(odds).startsWith("-") ? odds : `+${odds}`,
      book,
      implied_probability: `${(ip * 100).toFixed(2)}%`,
      model_probability: `${(mp * 100).toFixed(2)}%`,
      fair_odds: fair(mp),
      edge: `${(edge * 100).toFixed(2)}%`,
      ev: `${(ev * 100).toFixed(1)}%`,
      hr_score: score ?? "",
      label: edge >= .04 ? "STRONG MISPRICE" : edge >= .02 ? "GOOD VALUE" : edge > 0 ? "SMALL EDGE" : "OVERPRICED"
    });
  }

  out.sort((a, b) => num(b.ev) - num(a.ev));
  out.forEach((r, i) => r.rank = i + 1);

  fs.writeFileSync(OUT, csv(out));

  const top = out.filter(r => r.label !== "OVERPRICED").slice(0, 5);
  fs.writeFileSync(OUT_POST, [
    "🚨 MOST MISPRICED HR PLAYERS TODAY 🚨",
    "",
    ...top.flatMap(p => [
      `${p.rank}. ${p.player} ${p.best_odds}`,
      `Model fair price: ${p.fair_odds}`,
      `Edge: ${p.edge}`,
      ""
    ]),
    "Not guarantees. Just where the model thinks the book price is wrong.",
    "The Slip Lab"
  ].join("\n"));

  console.log("Input:", input);
  console.log("Rows read:", rows.length);
  console.log("Rows exported:", out.length);
  console.log("Skipped no player:", noPlayer);
  console.log("Skipped no odds:", noOdds);
  console.log("Skipped no model prob or score:", noProb);
  console.log("Saved:", OUT);
  console.log("Saved:", OUT_POST);
  console.table(out.slice(0, 10));
}

main();
