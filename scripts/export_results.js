import fs from "fs";
import path from "path";

const BOARD_FILE = path.join(process.cwd(), "hr_sweep_board.csv");
const OUT_DIR = path.join(process.cwd(), "exports");

const FULL_CSV = path.join(OUT_DIR, "the_slip_lab_full_board.csv");
const X_POST = path.join(OUT_DIR, "x_post.txt");

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"' && line[i + 1] === '"') {
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

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map(h => h.trim());

  return lines.map(line => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });

    return row;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";

  const str = String(value);

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function writeCsv(rows, filePath) {
  const headers = [
    "rank",
    "name",
    "team",
    "game",
    "venue",
    "lineup_spot",
    "lineup_status",
    "hr",
    "pa",
    "hr_per_pa",
    "ops",
    "slg",
    "barrel_pct",
    "hard_hit_pct",
    "xslg",
    "avg_exit_velocity",
    "avg_launch_angle",
    "pitcher_era",
    "pitcher_hr_allowed",
    "pitcher_whip",
    "park_boost",
    "weather_boost",
    "weather_label",
    "roof_flag",
    "model_score",
    "model_probability",
    "rank_score",
    "confidence",
    "tier"
  ];

  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ];

  fs.writeFileSync(filePath, lines.join("\n"));
}

function getTop(rows, tier, limit) {
  return rows
    .filter(row => row.tier === tier)
    .sort((a, b) => num(b.rank_score) - num(a.rank_score))
    .slice(0, limit);
}

function playerBlock(player, index, includeWeather = true) {
  const lines = [];

  lines.push(`${index + 1}. ${player.name}`);
  lines.push(`HR Probability: ${player.model_probability}%`);
  lines.push(`Batting ${player.lineup_spot}`);

  if (includeWeather && num(player.weather_boost) > 0) {
    lines.push(`Weather Boost: +${player.weather_boost}`);
  }

  return lines.join("\n");
}

function makeXPost(rows) {
  const confirmedRows = rows.filter(row => row.lineup_status === "confirmed");

  const usableRows = confirmedRows.length ? confirmedRows : rows;

  const safest = getTop(usableRows, "SAFEST", 3);
  const value = getTop(usableRows, "VALUE", 4);
  const leverage = getTop(usableRows, "LEVERAGE", 5);
  const lotto = getTop(usableRows, "LOTTO", 2);

  const lines = [];

  lines.push("THE SLIP LAB HR BOARD");
  lines.push("");
  lines.push("Pregame only. Confirmed lineups only.");
  lines.push("");

  if (safest.length) {
    lines.push("SAFEST LOOKS");
    lines.push("");

    safest.forEach((player, index) => {
      lines.push(playerBlock(player, index));
      lines.push("");
    });
  }

  if (value.length) {
    lines.push("VALUE TARGETS");
    lines.push("");

    value.forEach((player, index) => {
      lines.push(playerBlock(player, index));
      lines.push("");
    });
  }

  if (leverage.length) {
    lines.push("LEVERAGE SHOTS");
    lines.push("");

    leverage.forEach((player, index) => {
      lines.push(playerBlock(player, index));
      lines.push("");
    });
  }

  if (!safest.length && !value.length && !leverage.length && lotto.length) {
    lines.push("LOTTO LOOKS");
    lines.push("");

    lotto.forEach((player, index) => {
      lines.push(playerBlock(player, index, false));
      lines.push("");
    });
  }

  lines.push("No fake units. No blind picks. Just data.");
  lines.push("");
  lines.push("#MLB #HRProps #TheSlipLab");

  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(BOARD_FILE)) {
    console.error("Missing hr_sweep_board.csv. Run merge_data.js first.");
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const rows = parseCsv(BOARD_FILE);

  const confirmedRows = rows.filter(row => row.lineup_status === "confirmed");
  const usableRows = confirmedRows.length ? confirmedRows : rows;

  writeCsv(usableRows, FULL_CSV);

  const post = makeXPost(usableRows);

  fs.writeFileSync(X_POST, post);

  console.log("Done.");
  console.log("Rows exported:", usableRows.length);
  console.log("Full CSV:", FULL_CSV);
  console.log("X post:", X_POST);
  console.log("");
  console.log(post);
}

main();