import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const EXPORT_DIR = path.join(ROOT, "exports");
const CONTENT_DIR = path.join(EXPORT_DIR, "content_engine");

const INPUT_FILE = path.join(EXPORT_DIR, "hr_model.csv");

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
  const n = Number(String(v ?? "").replaceAll(",", "").replace("%", "").replace("+", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function safe(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
    .filter(teamInGame)
    .filter((row) => String(get(row, ["match"])).toLowerCase() !== "no")
    .map((row) => ({
      name: get(row, ["name", "player", "batter"]),
      team: get(row, ["team", "Team"]),
      game: get(row, ["game", "Game"]),
      odds: get(row, ["odds", "best_odds", "price"]),
      score: num(get(row, ["final_score", "final", "score", "model"]), 0),
      pitcher: get(row, ["pitcher", "opposing_pitcher"]),
      implied: num(get(row, ["implied", "hr_prob", "prob"]), 0),
      grade: num(get(row, ["final_score", "final", "score", "model"]), 0) >= 60 ? "A+" :
        num(get(row, ["final_score", "final", "score", "model"]), 0) >= 52 ? "A" :
        num(get(row, ["final_score", "final", "score", "model"]), 0) >= 45 ? "B+" : "B"
    }))
    .filter((row) => row.score > 0);
}

function cardSvg(title, subtitle, rows, color = "#39ff14") {
  const display = rows.slice(0, 8);

  const items = display.map((row, i) => {
    const y = 190 + i * 86;
    return `
      <rect x="70" y="${y}" width="980" height="64" rx="20" fill="#101820" stroke="${color}" stroke-width="2"/>
      <text x="105" y="${y + 38}" fill="#ffffff" font-size="28" font-weight="900">${i + 1}. ${safe(row.name)}</text>
      <text x="105" y="${y + 58}" fill="#b7ffd0" font-size="19" font-weight="700">${safe(row.team)} | Score ${row.score.toFixed(1)} | ${safe(row.pitcher || "Pitcher N/A")}</text>
      <text x="955" y="${y + 42}" fill="${color}" font-size="29" font-weight="900" text-anchor="end">${row.odds ? "+" + String(row.odds).replace("+", "") : "N/A"}</text>
    `;
  }).join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="900" viewBox="0 0 1120 900">
  <rect width="1120" height="900" fill="#050912"/>
  <circle cx="1050" cy="75" r="280" fill="#17351f" opacity="0.55"/>
  <circle cx="100" cy="850" r="250" fill="#17351f" opacity="0.35"/>

  <text x="70" y="80" fill="#ffffff" font-size="43" font-weight="900">THE SLIP LAB</text>
  <text x="70" y="130" fill="${color}" font-size="34" font-weight="900">${safe(title)}</text>
  <text x="70" y="165" fill="#aeb7c2" font-size="22">${safe(subtitle)}</text>

  ${items}

  <text x="70" y="840" fill="#ffffff" font-size="24" font-weight="900">Free data backed looks. No paywall.</text>
  <text x="70" y="868" fill="#aeb7c2" font-size="18">Model output, not a guarantee. Bet responsibly.</text>
</svg>
`.trim();
}

function writeText(file, text) {
  fs.writeFileSync(file, text.trim() + "\n", "utf8");
}

function main() {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const rows = cleanRows(readCSV(INPUT_FILE));

  const top = [...rows].sort((a, b) => b.score - a.score);
  const value = [...rows].sort((a, b) => (b.score + num(b.odds) / 250) - (a.score + num(a.odds) / 250));
  const lotto = [...rows]
    .filter((row) => num(row.odds) >= 1800)
    .sort((a, b) => b.score - a.score);

  fs.writeFileSync(path.join(CONTENT_DIR, "top_hr_board.svg"), cardSvg("TOP HR BOARD", "Best clean model looks today", top));
  fs.writeFileSync(path.join(CONTENT_DIR, "value_watch.svg"), cardSvg("HR VALUE WATCH", "Best price plus model combinations", value));
  fs.writeFileSync(path.join(CONTENT_DIR, "lotto_slips.svg"), cardSvg("LOTTO HR WATCH", "Plus money swings with upside", lotto, "#ff4fd8"));

  writeText(path.join(CONTENT_DIR, "x_post_top_hr_board.txt"), `Top HR board is live.

${top.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} ${r.team} ${r.odds ? "+" + String(r.odds).replace("+", "") : ""}`).join("\n")}

Free data backed looks. No paywall.`);

  writeText(path.join(CONTENT_DIR, "x_post_value_watch.txt"), `HR value watch.

${value.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} ${r.team} ${r.odds ? "+" + String(r.odds).replace("+", "") : ""}`).join("\n")}

TAILING? LIKE RT COMMENT LOCKED`);

  writeText(path.join(CONTENT_DIR, "x_post_lotto_slips.txt"), `Lotto HR watch.

${lotto.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} ${r.team} ${r.odds ? "+" + String(r.odds).replace("+", "") : ""}`).join("\n")}

Sprinkles only. No paywall.`);

  writeText(path.join(CONTENT_DIR, "x_posts_all.txt"), [
    fs.readFileSync(path.join(CONTENT_DIR, "x_post_top_hr_board.txt"), "utf8"),
    fs.readFileSync(path.join(CONTENT_DIR, "x_post_value_watch.txt"), "utf8"),
    fs.readFileSync(path.join(CONTENT_DIR, "x_post_lotto_slips.txt"), "utf8")
  ].join("\n\n"));

  console.log("CONTENT ENGINE EXPORT COMPLETE");
  console.log(`Input: ${INPUT_FILE}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Saved folder: ${CONTENT_DIR}`);
}

main();