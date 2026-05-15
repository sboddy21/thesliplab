import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const PLAYER_STATS_FILE = path.join(DATA_DIR, "player_stats.csv");
const PITCH_TYPE_FILE = path.join(DATA_DIR, "pitch_type_matchups.csv");
const OUT_FILE = path.join(DATA_DIR, "player_stats.csv");
const BACKUP_FILE = path.join(DATA_DIR, "player_stats_before_pitch_type.csv");

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\bjunior\b/g, "jr")
    .replace(/\bsenior\b/g, "sr")
    .replace(/\bjr\b/g, "")
    .replace(/\bsr\b/g, "")
    .replace(/\biii\b/g, "")
    .replace(/\bii\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
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

function makeKey(name, pitcher) {
  return `${normalizeName(name)}|${normalizeName(pitcher)}`;
}

function main() {
  if (!fs.existsSync(PLAYER_STATS_FILE)) {
    console.error("Missing player_stats.csv");
    console.error("Run player_stats.js first.");
    process.exit(1);
  }

  if (!fs.existsSync(PITCH_TYPE_FILE)) {
    console.error("Missing pitch_type_matchups.csv");
    console.error("Run pitch_type_matchups.js first.");
    process.exit(1);
  }

  const playerRows = readCsvSafe(PLAYER_STATS_FILE);
  const pitchRows = readCsvSafe(PITCH_TYPE_FILE);

  const pitchMap = new Map();

  for (const row of pitchRows) {
    const name = getField(row, ["name", "player", "batter", "player_name"]);
    const pitcher = getField(row, ["pitcher", "probable_pitcher", "opposing_pitcher"]);

    if (!name || !pitcher) continue;

    pitchMap.set(makeKey(name, pitcher), row);
  }

  const merged = [];
  let matched = 0;
  let missing = 0;

  for (const row of playerRows) {
    const name = getField(row, ["name", "player", "batter", "player_name"]);
    const pitcher = getField(row, [
      "pitcher",
      "probable_pitcher",
      "opposing_pitcher",
      "starter",
      "opp_pitcher"
    ]);

    const match = pitchMap.get(makeKey(name, pitcher));

    if (match) {
      matched++;

      merged.push({
        ...row,
        pitch_type_score: match.pitch_type_score || "",
        pitch_type_grade: match.pitch_type_grade || "",
        primary_pitch_match: match.primary_pitch_match || "",
        primary_pitch_usage_pct: match.primary_pitch_usage_pct || "",
        primary_pitch_hitter_score: match.primary_pitch_hitter_score || "",
        primary_pitch_pitcher_weakness: match.primary_pitch_pitcher_weakness || "",
        best_hitter_pitch: match.best_hitter_pitch || "",
        best_hitter_pitch_score: match.best_hitter_pitch_score || "",
        weakest_pitcher_pitch: match.weakest_pitcher_pitch || "",
        weakest_pitcher_pitch_score: match.weakest_pitcher_pitch_score || "",
        pitcher_primary_mix: match.pitcher_primary_mix || "",
        hitter_pitch_sample: match.hitter_pitch_sample || "",
        pitcher_pitch_sample: match.pitcher_pitch_sample || "",
        pitch_type_note: match.matchup_note || ""
      });
    } else {
      missing++;

      merged.push({
        ...row,
        pitch_type_score: "",
        pitch_type_grade: "NO MATCH",
        primary_pitch_match: "",
        primary_pitch_usage_pct: "",
        primary_pitch_hitter_score: "",
        primary_pitch_pitcher_weakness: "",
        best_hitter_pitch: "",
        best_hitter_pitch_score: "",
        weakest_pitcher_pitch: "",
        weakest_pitcher_pitch_score: "",
        pitcher_primary_mix: "",
        hitter_pitch_sample: "",
        pitcher_pitch_sample: "",
        pitch_type_note: "No pitch type matchup row found"
      });
    }
  }

  fs.copyFileSync(PLAYER_STATS_FILE, BACKUP_FILE);
  fs.writeFileSync(OUT_FILE, toCsv(merged));

  console.log("");
  console.log("PITCH TYPE MATCHUPS MERGED");
  console.log("Player rows:", playerRows.length);
  console.log("Pitch type rows:", pitchRows.length);
  console.log("Matched:", matched);
  console.log("Missing:", missing);
  console.log("Backup saved:", BACKUP_FILE);
  console.log("Updated:", OUT_FILE);

  console.table(
    merged.slice(0, 12).map(row => ({
      name: getField(row, ["name", "player"]),
      pitcher: getField(row, ["pitcher", "probable_pitcher", "opposing_pitcher"]),
      pitch_type_score: row.pitch_type_score,
      pitch_type_grade: row.pitch_type_grade,
      primary_pitch: row.primary_pitch_match
    }))
  );
}

main();
