import fs from "fs";
import path from "path";

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const EXPORT_DIR = path.join(ROOT, "exports");

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function cleanText(v = "") {
  return String(v ?? "").trim();
}

export function normalizeName(v = "") {
  return cleanText(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeTeam(v = "") {
  return cleanText(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && inQuotes && n === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      row.push(cur);
      cur = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && n === "\n") i++;
      row.push(cur);
      if (row.some(x => String(x).trim() !== "")) rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }

  row.push(cur);
  if (row.some(x => String(x).trim() !== "")) rows.push(row);

  if (!rows.length) return [];

  const headers = rows[0].map(h => cleanText(h));
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = r[i] ?? "";
    });
    return o;
  });
}

export function writeCSV(file, rows) {
  ensureDir(path.dirname(file));

  if (!rows.length) {
    fs.writeFileSync(file, "", "utf8");
    return;
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach(k => set.add(k));
      return set;
    }, new Set())
  );

  const out = [
    headers.join(","),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))
  ].join("\n");

  fs.writeFileSync(file, out + "\n", "utf8");
}

export function readCSV(file) {
  if (!fs.existsSync(file)) return [];
  return parseCSV(fs.readFileSync(file, "utf8"));
}

export function findFirstExisting(paths) {
  return paths.find(p => fs.existsSync(p)) || null;
}

export function americanToImplied(odds) {
  const n = Number(String(odds ?? "").replace("+", ""));
  if (!Number.isFinite(n) || n === 0) return 0;
  if (n > 0) return 100 / (n + 100) * 100;
  return Math.abs(n) / (Math.abs(n) + 100) * 100;
}

export function num(v, fallback = 0) {
  const n = Number(String(v ?? "").replace("%", "").replace("+", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(n, min = 0, max = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function score01(n, low, high) {
  const x = num(n, low);
  if (high === low) return 0;
  return clamp((x - low) / (high - low) * 100, 0, 100);
}

export function backupFile(file) {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:T]/g, "_").slice(0, 19);
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  const backup = `${base}_backup_${stamp}${ext}`;
  fs.copyFileSync(file, backup);
  return backup;
}

export async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "TheSlipLab/1.0" }
  });

  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return await res.json();
}

export async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "TheSlipLab/1.0" }
  });

  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return await res.text();
}

export function todayET() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(new Date());
}

export function gameTeams(game = "") {
  const parts = String(game).split("@").map(s => s.trim());
  if (parts.length !== 2) return { away: "", home: "" };
  return { away: parts[0], home: parts[1] };
}

export function sameName(a, b) {
  return normalizeName(a) === normalizeName(b);
}

export function teamInGame(team, game) {
  const t = normalizeTeam(team);
  const { away, home } = gameTeams(game);
  return t && (normalizeTeam(away) === t || normalizeTeam(home) === t);
}
