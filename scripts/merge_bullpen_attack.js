import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const PLAYER_STATS_FILE = path.join(DATA_DIR, "player_stats.csv");
const BULLPEN_STATS_FILE = path.join(DATA_DIR, "bullpen_stats.csv");
const BULLPEN_USAGE_FILE = path.join(DATA_DIR, "bullpen_usage.csv");

const OUT_FILE = path.join(DATA_DIR, "player_stats.csv");
const BACKUP_FILE = path.join(DATA_DIR, "player_stats_before_bullpen.csv");

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some(v => String(v).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h => String(h).trim());

  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) headers.push(key);
    }
  }

  const escape = value => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(","))
  ].join("\n");
}

function readCsvSafe(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return "";
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace("+", "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finalGrade(score) {
  if (score >= 78) return "ATTACK";
  if (score >= 64) return "LIVE";
  if (score >= 48) return "NEUTRAL";
  if (score >= 35) return "RESPECT";
  return "AVOID";
}

function buildMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const team = getField(row, ["team", "name"]);
    const abbr = getField(row, ["abbreviation"]);

    if (team) map.set(normalizeText(team), row);
    if (abbr) map.set(normalizeText(abbr), row);
  }

  return map;
}

function main() {
  if (!fs.existsSync(PLAYER_STATS_FILE)) {
    console.error("Missing player_stats.csv");
    process.exit(1);
  }

  if (!fs.existsSync(BULLPEN_STATS_FILE)) {
    console.error("Missing bullpen_stats.csv");
    console.error("Run node scripts/bullpen_stats.js first.");
    process.exit(1);
  }

  if (!fs.existsSync(BULLPEN_USAGE_FILE)) {
    console.error("Missing bullpen_usage.csv");
    console.error("Run node scripts/bullpen_usage.js first.");
    process.exit(1);
  }

  const playerRows = readCsvSafe(PLAYER_STATS_FILE);
  const bullpenStats = readCsvSafe(BULLPEN_STATS_FILE);
  const bullpenUsage = readCsvSafe(BULLPEN_USAGE_FILE);

  const statsMap = buildMap(bullpenStats);
  const usageMap = buildMap(bullpenUsage);

  let matched = 0;
  let missing = 0;

  const merged = playerRows.map(row => {
    const opponent = getField(row, ["opponent", "opp"]);
    const key = normalizeText(opponent);

    const stats = statsMap.get(key);
    const usage = usageMap.get(key);

    if (stats || usage) matched++;
    else missing++;

    const qualityAttack = num(stats?.bullpen_attack_score, 50);
    const fatigue = num(usage?.fatigue_score, 35);

    const bullpenAttackScore = clamp(
      qualityAttack * 0.58 + fatigue * 0.42,
      12,
      95
    );

    return {
      ...row,
      bullpen_attack_score: bullpenAttackScore.toFixed(2),
      bullpen_grade: finalGrade(bullpenAttackScore),
      bullpen_quality_score: stats?.bullpen_attack_score || "",
      bullpen_quality_grade: stats?.bullpen_quality_grade || "",
      bullpen_fatigue_score: usage?.fatigue_score || "",
      bullpen_fatigue_grade: usage?.fatigue_grade || "",
      bullpen_total_pitches_last_3: usage?.bullpen_total_pitches || "",
      bullpen_innings_last_3: usage?.bullpen_innings || "",
      bullpen_pitchers_used_last_3: usage?.bullpen_pitchers_used || "",
      bullpen_relievers_20_plus: usage?.relievers_20_plus_pitches || "",
      bullpen_relievers_25_plus: usage?.relievers_25_plus_pitches || "",
      bullpen_relievers_30_plus: usage?.relievers_30_plus_pitches || "",
      bullpen_back_to_back_relievers: usage?.relievers_back_to_back || "",
      bullpen_high_usage_relievers: usage?.high_usage_relievers || "",
      bullpen_era: stats?.era || "",
      bullpen_whip: stats?.whip || "",
      bullpen_hr_per_9: stats?.hr_per_9 || "",
      bullpen_k_per_9: stats?.k_per_9 || "",
      bullpen_note: stats || usage
        ? `Opponent bullpen ${finalGrade(bullpenAttackScore)} | Quality ${stats?.bullpen_quality_grade || "NA"} | Fatigue ${usage?.fatigue_grade || "NA"}`
        : "No bullpen match found"
    };
  });

  fs.copyFileSync(PLAYER_STATS_FILE, BACKUP_FILE);
  fs.writeFileSync(OUT_FILE, toCsv(merged));

  console.log("");
  console.log("BULLPEN ATTACK MERGED");
  console.log("Player rows:", playerRows.length);
  console.log("Matched:", matched);
  console.log("Missing:", missing);
  console.log("Backup saved:", BACKUP_FILE);
  console.log("Updated:", OUT_FILE);

  console.table(
    merged.slice(0, 20).map(row => ({
      name: getField(row, ["name", "player"]),
      opponent: row.opponent,
      bullpen_score: row.bullpen_attack_score,
      grade: row.bullpen_grade,
      quality: row.bullpen_quality_grade,
      fatigue: row.bullpen_fatigue_grade,
      hr9: row.bullpen_hr_per_9
    }))
  );
}

main();
