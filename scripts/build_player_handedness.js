import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const MASTER = path.join(DATA, "master_hr_model.csv");
const OUT_CSV = path.join(DATA, "player_handedness.csv");
const OUT_JSON = path.join(DATA, "player_handedness.json");

function parse(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const n = line[i + 1];

    if (c === '"' && q && n === '"') {
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

function rows(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const headers = parse(lines[0]);

  return lines.slice(1).map(line => {
    const vals = parse(line);
    const row = {};
    headers.forEach((h, i) => row[h] = vals[i] || "");
    return row;
  });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCSV(file, list) {
  if (!list.length) return;
  const headers = Object.keys(list[0]);
  const out = [
    headers.join(","),
    ...list.map(r => headers.map(h => csvEscape(r[h])).join(","))
  ];
  fs.writeFileSync(file, out.join("\n"));
}

function clean(v) {
  return String(v || "").trim();
}

function normalizeName(v) {
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/’/g, "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function handCode(v) {
  const s = clean(v).toUpperCase();
  if (s === "L" || s.includes("LEFT")) return "L";
  if (s === "R" || s.includes("RIGHT")) return "R";
  if (s === "S" || s.includes("SWITCH")) return "S";
  return "";
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.json();
}

async function main() {
  const master = rows(MASTER);

  const wanted = new Map();

  for (const r of master) {
    const name = clean(r.name);
    const team = clean(r.team);
    if (!name) continue;
    wanted.set(normalizeName(name), { name, team });
  }

  console.log("");
  console.log("THE SLIP LAB PLAYER HANDEDNESS");
  console.log(`Players needed: ${wanted.size}`);
  console.log("Fetching MLB active player pool...");

  const seasons = [2026, 2025];
  const playerPool = [];

  for (const season of seasons) {
    try {
      const url = `https://statsapi.mlb.com/api/v1/sports/1/players?season=${season}`;
      const data = await fetchJson(url);
      if (Array.isArray(data.people)) playerPool.push(...data.people);
    } catch (err) {
      console.log(`Could not fetch season ${season}: ${err.message}`);
    }
  }

  const poolByName = new Map();

  for (const p of playerPool) {
    const fullName = clean(p.fullName);
    if (!fullName) continue;

    const k = normalizeName(fullName);

    if (!poolByName.has(k)) {
      poolByName.set(k, p);
    }
  }

  const out = [];

  for (const item of wanted.values()) {
    const match = poolByName.get(normalizeName(item.name));

    const batterHand = handCode(
      match?.batSide?.code ||
      match?.batSide?.description ||
      ""
    );

    const throwsHand = handCode(
      match?.pitchHand?.code ||
      match?.pitchHand?.description ||
      ""
    );

    out.push({
      name: item.name,
      team: item.team,
      mlbam: match?.id || "",
      batter_hand: batterHand,
      throws_hand: throwsHand,
      source: match ? "MLB_STATS_API" : "NO_MATCH"
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  writeCSV(OUT_CSV, out);

  const matched = out.filter(r => r.batter_hand).length;
  const missing = out.length - matched;

  console.log(`Rows: ${out.length}`);
  console.log(`Matched batter hand: ${matched}`);
  console.log(`Missing batter hand: ${missing}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log("");

  console.table(out.slice(0, 20));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
