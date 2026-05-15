import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(DATA_DIR, "power_zones.json");

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function cleanName(name = "") {
  return String(name)
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headshotUrl(id) {
  if (!id) return "";
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${id}/headshot/67/current`;
}

async function findMlbamId(playerName) {
  const name = cleanName(playerName);
  if (!name) return "";

  const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return "";

    const json = await res.json();
    const people = Array.isArray(json.people) ? json.people : [];

    const exact = people.find(p => cleanName(p.fullName).toLowerCase() === name.toLowerCase());
    const match = exact || people[0];

    return match?.id ? String(match.id) : "";
  } catch {
    return "";
  }
}

async function main() {
  const rows = readJson(OUT_FILE);

  if (!rows.length) {
    console.log("No power_zones.json found or file is empty.");
    process.exit(1);
  }

  const cacheFile = path.join(DATA_DIR, "player_headshot_cache.json");
  const cache = fs.existsSync(cacheFile) ? readJson(cacheFile) : {};

  let added = 0;
  let missing = 0;

  const rebuilt = [];

  for (const row of rows) {
    const player = cleanName(row.player || row.name);
    let mlbam = row.mlbam || row.mlbam_id || row.player_id || row.id || cache[player];

    if (!mlbam) {
      mlbam = await findMlbamId(player);
      if (mlbam) {
        cache[player] = mlbam;
        added++;
      }
    }

    if (!mlbam) missing++;

    const photo = headshotUrl(mlbam);

    rebuilt.push({
      ...row,
      player,
      mlbam,
      mlbam_id: mlbam,
      player_id: mlbam,
      headshot_url: photo,
      headshot: photo,
      player_image: photo,
      mlb_headshot_url: photo
    });
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(rebuilt, null, 2));
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));

  console.log("POWER ZONES HEADSHOT REBUILD COMPLETE");
  console.log("Rows:", rebuilt.length);
  console.log("New MLBAM IDs added:", added);
  console.log("Still missing IDs:", missing);
  console.log("Saved:", OUT_FILE);
  console.log("Cache:", cacheFile);
}

main();
