import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const EXPORT_DIR = path.join(ROOT, "exports");

const INPUT_FILE = path.join(EXPORT_DIR, "hr_model.csv");

const TOP_SVG = path.join(EXPORT_DIR, "x_graphic_top_hr_board.svg");
const VALUE_SVG = path.join(EXPORT_DIR, "x_graphic_value_watch.svg");

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && quoted && n === '"') {
      value += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (value.length || row.length) {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      }
      if (c === "\r" && n === "\n") i++;
    } else {
      value += c;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function readCSV(file) {
  if (!fs.existsSync(file)) {
    console.error(`Missing file: ${file}`);
    process.exit(1);
  }

  const parsed = parseCSV(fs.readFileSync(file, "utf8").trim());
  const headers = parsed[0].map((h) => h.trim());

  return parsed.slice(1).map((cells) => {
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function get(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replaceAll(",", "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function safe(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function short(v, max = 15) {
  const s = String(v || "");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function teamInGame(row) {
  const team = get(row, ["team", "Team"]);
  const game = get(row, ["game", "Game"]);
  if (!team || !game) return true;
  return game.toLowerCase().includes(team.toLowerCase());
}

function cleanRows(rows) {
  return rows
    .filter((row) => get(row, ["name", "player", "batter"]))
    .filter((row) => teamInGame(row))
    .filter((row) => String(get(row, ["match"])).toLowerCase() !== "no")
    .map((row) => {
      const score = num(get(row, ["final_score", "final", "score", "model"]), 0);
      const implied = num(get(row, ["implied", "hr_prob", "prob"]), 0);
      const odds = get(row, ["odds", "best_odds", "price"]);
      const ev = num(get(row, ["ev", "edge", "value_score"]), 0);

      return {
        name: get(row, ["name", "player", "batter"]),
        team: get(row, ["team", "Team"]),
        grade: score >= 60 ? "A+" : score >= 52 ? "A" : score >= 45 ? "B+" : score >= 38 ? "B" : "C",
        prob: implied ? `${implied.toFixed(2)}%` : "N/A",
        pitcher: get(row, ["pitcher", "opposing_pitcher"]),
        odds: odds ? `+${String(odds).replace("+", "")}` : "N/A",
        ev: ev ? ev.toFixed(1) : "N/A",
        score: score.toFixed(1)
      };
    })
    .filter((row) => row.score !== "0.0");
}

function makeSVG(title, subtitle, rows) {
  const display = rows.slice(0, 12);

  const width = 1600;
  const height = 1000;

  const headerY = 250;
  const rowHeight = 54;
  const startY = 305;

  const rowSvg = display.map((row, i) => {
    const y = startY + i * rowHeight;

    return `
      <rect x="60" y="${y - 38}" width="1280" height="${rowHeight}" fill="${i % 2 === 0 ? "#0b1118" : "#080d13"}" stroke="#1d2836"/>
      <text x="75" y="${y}" fill="#d7dee8" font-size="22">${i + 1}</text>
      <text x="145" y="${y}" fill="#f2f5f7" font-size="23" font-weight="800">${safe(short(row.name, 22))}</text>
      <text x="430" y="${y}" fill="#d7dee8" font-size="21">${safe(short(row.team, 16))}</text>
      <text x="555" y="${y}" fill="#39ff14" font-size="22">${safe(row.grade)}</text>
      <text x="705" y="${y}" fill="#d7dee8" font-size="21">${safe(row.prob)}</text>
      <text x="840" y="${y}" fill="#d7dee8" font-size="21">${safe(short(row.pitcher, 18))}</text>
      <text x="1065" y="${y}" fill="#d7dee8" font-size="21">${safe(row.odds)}</text>
      <text x="1185" y="${y}" fill="#39ff14" font-size="21">${safe(row.ev)}</text>
      <text x="1300" y="${y}" fill="#39ff14" font-size="21" text-anchor="end">${safe(row.score)}</text>
    `;
  }).join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#050912"/>
  <circle cx="1380" cy="160" r="300" fill="#0b4f24" opacity="0.35"/>
  <circle cx="120" cy="930" r="360" fill="#0b4f24" opacity="0.28"/>

  <text x="60" y="85" fill="#ffffff" font-size="44" font-weight="900">THE SLIP LAB</text>
  <text x="60" y="135" fill="#39ff14" font-size="34" font-weight="900">${safe(title)}</text>
  <text x="60" y="170" fill="#aeb7c2" font-size="24">${safe(subtitle)}</text>

  <rect x="60" y="220" width="1280" height="54" rx="14" fill="#111827" stroke="#223047"/>
  <text x="75" y="255" fill="#d7dee8" font-size="20" font-weight="800">Rank</text>
  <text x="145" y="255" fill="#d7dee8" font-size="20" font-weight="800">Batter</text>
  <text x="430" y="255" fill="#d7dee8" font-size="20" font-weight="800">Team</text>
  <text x="555" y="255" fill="#d7dee8" font-size="20" font-weight="800">Grade</text>
  <text x="705" y="255" fill="#d7dee8" font-size="20" font-weight="800">HR Prob</text>
  <text x="840" y="255" fill="#d7dee8" font-size="20" font-weight="800">Pitcher</text>
  <text x="1065" y="255" fill="#d7dee8" font-size="20" font-weight="800">Odds</text>
  <text x="1185" y="255" fill="#d7dee8" font-size="20" font-weight="800">EV</text>
  <text x="1300" y="255" fill="#d7dee8" font-size="20" font-weight="800" text-anchor="end">Score</text>

  ${rowSvg}

  <text x="60" y="930" fill="#ffffff" font-size="25" font-weight="900">Free data backed looks. No paywall.</text>
  <text x="60" y="960" fill="#aeb7c2" font-size="19">Model output, not a guarantee. Bet responsibly.</text>
  <text x="1250" y="930" fill="#39ff14" font-size="26" font-weight="900">@TheSlip_Lab</text>
  <text x="1250" y="960" fill="#aeb7c2" font-size="18">TAILING? LIKE RT COMMENT LOCKED</text>
</svg>
`.trim();
}

function main() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const rows = cleanRows(readCSV(INPUT_FILE));

  const top = [...rows].sort((a, b) => num(b.score) - num(a.score));
  const value = [...rows].sort((a, b) => {
    const aOdds = num(a.odds);
    const bOdds = num(b.odds);
    const aScore = num(a.score);
    const bScore = num(b.score);
    return bScore + bOdds / 200 - (aScore + aOdds / 200);
  });

  fs.writeFileSync(TOP_SVG, makeSVG("DAILY HR BOARD", "Best power profiles from today's clean model", top));
  fs.writeFileSync(VALUE_SVG, makeSVG("HR VALUE WATCH", "Best price plus model combinations", value));

  console.log("X GRAPHICS EXPORT COMPLETE");
  console.log(`Input: ${INPUT_FILE}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Saved SVG files:`);
  console.log(TOP_SVG);
  console.log(VALUE_SVG);
}

main();