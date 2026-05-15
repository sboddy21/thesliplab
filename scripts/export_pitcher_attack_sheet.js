import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const EXPORT_DIR = path.join(ROOT, "exports");

const PITCHER_FILE = path.join(DATA_DIR, "pitcher_stats.csv");
const XLSX_FILE = path.join(EXPORT_DIR, "pitcher_attack_sheet.xlsx");
const CSV_FILE = path.join(EXPORT_DIR, "pitcher_attack_sheet.csv");

const LEAGUE = {
  era: 4.20,
  whip: 1.30,
  xfip: 4.15,
  k9: 8.50,
  bb9: 3.10,
  hr9: 1.10,
  last3: 4.20
};

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
  const parsed = parseCSV(fs.readFileSync(file, "utf8"));
  const headers = parsed[0].map((h) => h.trim());

  return parsed.slice(1).map((cells) => {
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function writeCSV(file, headers, rows) {
  const out = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))
  ].join("\n");

  fs.writeFileSync(file, out + "\n", "utf8");
}

function get(row, keys) {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function toNumber(v, fallback = null) {
  if (v === undefined || v === null) return fallback;

  const cleaned = String(v)
    .replaceAll(",", "")
    .replace("%", "")
    .trim();

  if (!cleaned) return fallback;
  if (cleaned.toUpperCase() === "N/A") return fallback;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function display(v, decimals = 2) {
  const n = toNumber(v, null);
  if (n === null) return "N/A";
  return Number(n.toFixed(decimals));
}

function round(v, digits = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "N/A";
  return Number(n.toFixed(digits));
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function realPitcherName(name) {
  const s = String(name || "").trim();
  if (!s) return false;
  if (s.toUpperCase() === "N/A") return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  return s.length >= 4;
}

function regress(value, leagueAvg, innings, strength = 35) {
  if (value === null) return null;

  const ip = Math.max(0, innings || 0);
  const weight = ip / (ip + strength);

  return value * weight + leagueAvg * (1 - weight);
}

function starterConfidence(gs, innings) {
  const gsScore = gs >= 8 ? 1 : gs >= 5 ? 0.88 : gs >= 3 ? 0.74 : gs >= 1 ? 0.55 : 0.35;
  const ipScore = innings >= 45 ? 1 : innings >= 30 ? 0.9 : innings >= 18 ? 0.75 : innings >= 10 ? 0.6 : 0.45;

  return Math.min(gsScore, ipScore);
}

function samplePenalty(innings, gs) {
  let penalty = 0;

  if (innings < 10) penalty += 18;
  else if (innings < 18) penalty += 12;
  else if (innings < 30) penalty += 7;
  else if (innings < 45) penalty += 3;

  if (gs === 0) penalty += 14;
  else if (gs < 3) penalty += 8;
  else if (gs < 5) penalty += 4;

  return penalty;
}

function calculateAttack(row) {
  const innings = toNumber(get(row, ["innings"]), 0);
  const gs = toNumber(get(row, ["gs", "GS", "games_started"]), 0);

  const rawEra = toNumber(get(row, ["era", "ERA"]), null);
  const rawWhip = toNumber(get(row, ["whip", "WHIP"]), null);
  const rawXfip = toNumber(get(row, ["xfip", "xFIP", "XFIP"]), null);
  const rawK9 = toNumber(get(row, ["k9", "K/9"]), null);
  const rawBb9 = toNumber(get(row, ["bb9", "BB/9"]), null);
  const rawHr9 = toNumber(get(row, ["hr9", "HR/9", "hr_per_9"]), null);
  const rawLast3 = toNumber(get(row, ["last_3", "Last 3"]), null);
  const teamSo = toNumber(get(row, ["team_so", "Team SO"]), null);

  const era = regress(rawEra, LEAGUE.era, innings, 35);
  const whip = regress(rawWhip, LEAGUE.whip, innings, 35);
  const xfip = regress(rawXfip, LEAGUE.xfip, innings, 35);
  const k9 = regress(rawK9, LEAGUE.k9, innings, 30);
  const bb9 = regress(rawBb9, LEAGUE.bb9, innings, 30);
  const hr9 = regress(rawHr9, LEAGUE.hr9, innings, 45);
  const last3 = regress(rawLast3, LEAGUE.last3, innings, 20);

  let score = 50;
  let inputs = 0;

  if (era !== null) {
    inputs++;
    score += (era - LEAGUE.era) * 7.0;
  }

  if (whip !== null) {
    inputs++;
    score += (whip - LEAGUE.whip) * 28;
  }

  if (xfip !== null) {
    inputs++;
    score += (xfip - LEAGUE.xfip) * 8.5;
  }

  if (hr9 !== null) {
    inputs++;
    score += (hr9 - LEAGUE.hr9) * 24;
  }

  if (bb9 !== null) {
    inputs++;
    score += (bb9 - LEAGUE.bb9) * 5.5;
  }

  if (k9 !== null) {
    inputs++;
    score -= (k9 - LEAGUE.k9) * 3.5;
  }

  if (last3 !== null) {
    inputs++;
    score += (last3 - LEAGUE.last3) * 2.5;
  }

  if (teamSo !== null) {
    if (teamSo <= 7.2) score += 4;
    else if (teamSo >= 9.2) score -= 5;
  }

  const confidence = starterConfidence(gs, innings);
  const penalty = samplePenalty(innings, gs);

  score = 50 + (score - 50) * confidence;
  score -= penalty;

  if (inputs < 4) score = Math.min(score, 35);
  if (gs === 0) score = Math.min(score, 45);
  if (innings < 10) score = Math.min(score, 48);

  return clamp(score);
}

function attackTag(score) {
  if (score >= 75) return "ATTACK";
  if (score >= 58) return "LIVE";
  if (score >= 43) return "NEUTRAL";
  return "AVOID";
}

function fillForTag(tag) {
  if (tag === "ATTACK") return "FFFF9900";
  if (tag === "LIVE") return "FF00D5FF";
  if (tag === "NEUTRAL") return "FFFFE699";
  return "FFD9D9D9";
}

async function main() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const pitcherRows = readCSV(PITCHER_FILE);

  const rows = pitcherRows
    .filter((row) => realPitcherName(get(row, ["pitcher", "Pitcher"])))
    .map((row) => {
      const attack = calculateAttack(row);

      return {
        Pitcher: get(row, ["pitcher", "Pitcher"]),
        "Opposing Team": get(row, ["opponent", "Opponent"]),
        GS: display(get(row, ["gs", "GS", "games_started"]), 0),
        IP: display(get(row, ["innings"]), 1),
        xFIP: display(get(row, ["xfip", "xFIP", "XFIP"]), 2),
        "Team SO": display(get(row, ["team_so", "Team SO"]), 2),
        "Last 3": display(get(row, ["last_3", "Last 3"]), 2),
        "K/9": display(get(row, ["k9", "K/9"]), 2),
        "BB/9": display(get(row, ["bb9", "BB/9"]), 2),
        "HR/9": display(get(row, ["hr9", "HR/9", "hr_per_9"]), 2),
        Attack: round(attack, 1),
        Tag: attackTag(attack)
      };
    })
    .sort((a, b) => toNumber(b.Attack, 0) - toNumber(a.Attack, 0));

  const headers = [
    "Pitcher",
    "Opposing Team",
    "GS",
    "IP",
    "xFIP",
    "Team SO",
    "Last 3",
    "K/9",
    "BB/9",
    "HR/9",
    "Attack",
    "Tag"
  ];

  writeCSV(CSV_FILE, headers, rows);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pitcher Attack");

  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: h === "Pitcher" ? 24 : h === "Opposing Team" ? 22 : 11
  }));

  rows.forEach((row) => sheet.addRow(row));

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" }
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.eachCell((cell, colNumber) => {
      const column = headers[colNumber - 1];

      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber <= 2 ? "left" : "center"
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } }
      };

      if (column === "Tag") {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fillForTag(String(cell.value || "")) }
        };
      }

      if (cell.value === "N/A") {
        cell.font = { italic: true, color: { argb: "FF777777" } };
      }
    });
  });

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "L1" };

  await workbook.xlsx.writeFile(XLSX_FILE);

  console.log("Pitcher attack sheet complete.");
  console.log(`Rows: ${rows.length}`);
  console.log(`CSV: ${CSV_FILE}`);
  console.log(`XLSX: ${XLSX_FILE}`);
}

main().catch((err) => {
  console.error("export_pitcher_attack_sheet.js failed");
  console.error(err);
  process.exit(1);
});