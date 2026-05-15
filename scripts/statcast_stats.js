import fs from "fs";
import path from "path";

const YEAR = new Date().getFullYear();

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(DATA_DIR, "statcast_batter_stats.csv");

const STATCAST_URL =
  "https://baseballsavant.mlb.com/leaderboard/custom" +
  `?year=${YEAR}` +
  "&type=batter" +
  "&filter=" +
  "&min=1" +
  "&selections=pa,home_run,barrel_batted_rate,hard_hit_percent,xslg,exit_velocity_avg,launch_angle_avg" +
  "&chart=false" +
  "&csv=true";

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      insideQuotes = !insideQuotes;
    } else if (c === "," && !insideQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  out.push(cur);
  return out;
}

function parseCsvText(text) {
  const clean = text.trim();

  if (!clean) return [];

  const lines = clean.split(/\r?\n/);
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

function pick(row, keys, fallback = "") {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }

  return fallback;
}

function num(value, fallback = 0) {
  const n = Number(String(value).replace("%", ""));
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  ensureDir();

  console.log("Fetching Statcast batter leaderboard...");
  console.log("Year:", YEAR);

  const res = await fetch(STATCAST_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("Statcast request failed.");
    console.error("Status:", res.status);
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  const rows = parseCsvText(text);

  if (!rows.length) {
    console.error("No Statcast rows returned.");
    console.error("URL used:");
    console.error(STATCAST_URL);
    process.exit(1);
  }

  const normalized = rows.map(row => {
    const name = pick(row, [
      "player_name",
      "last_name, first_name",
      "name",
      "player"
    ]);

    return {
      name,
      hr: num(pick(row, ["home_run", "hr", "home_runs"]), 0),
      pa: num(pick(row, ["pa", "plate_appearances"]), 0),
      barrel_pct: num(pick(row, ["barrel_batted_rate", "barrel_percent", "barrel_pct"]), 0),
      hard_hit_pct: num(pick(row, ["hard_hit_percent", "hard_hit_pct"]), 0),
      xslg: num(pick(row, ["xslg", "xSLG"]), 0),
      avg_exit_velocity: num(pick(row, ["exit_velocity_avg", "avg_exit_velocity"]), 0),
      avg_launch_angle: num(pick(row, ["launch_angle_avg", "avg_launch_angle"]), 0),
      source: "statcast"
    };
  }).filter(row => row.name);

  const headers = [
    "name",
    "hr",
    "pa",
    "barrel_pct",
    "hard_hit_pct",
    "xslg",
    "avg_exit_velocity",
    "avg_launch_angle",
    "source"
  ];

  const lines = [
    headers.join(","),
    ...normalized.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ];

  fs.writeFileSync(OUT_FILE, lines.join("\n"));

  console.log("Done.");
  console.log("Rows:", normalized.length);
  console.log("Saved:", OUT_FILE);
}

main();