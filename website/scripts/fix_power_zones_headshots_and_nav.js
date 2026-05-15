import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const POWER_FILE = path.join(DATA_DIR, "power_zones.json");

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function write(file, data) {
  fs.writeFileSync(file, data);
}

function cleanName(name = "") {
  return String(name).replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function photoUrl(id) {
  return id
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${id}/headshot/67/current`
    : "";
}

async function findMlbId(name) {
  const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const json = await res.json();
    const people = Array.isArray(json.people) ? json.people : [];
    const exact = people.find(p => cleanName(p.fullName).toLowerCase() === cleanName(name).toLowerCase());
    return String((exact || people[0])?.id || "");
  } catch {
    return "";
  }
}

async function fixData() {
  if (!fs.existsSync(POWER_FILE)) {
    console.log("Missing data/power_zones.json");
    return;
  }

  const rows = JSON.parse(read(POWER_FILE));
  const cacheFile = path.join(DATA_DIR, "player_headshot_cache.json");
  const cache = fs.existsSync(cacheFile) ? JSON.parse(read(cacheFile)) : {};

  let fixed = 0;

  for (const row of rows) {
    const player = cleanName(row.player || row.name);
    let id = row.mlbam || row.mlbam_id || row.player_id || cache[player];

    if (!id) {
      id = await findMlbId(player);
      if (id) cache[player] = id;
    }

    const url = photoUrl(id);

    row.player = player;
    row.mlbam = id;
    row.mlbam_id = id;
    row.player_id = id;
    row.headshot_url = url;
    row.headshot = url;
    row.player_image = url;
    row.mlb_headshot_url = url;

    if (url) fixed++;
  }

  write(POWER_FILE, JSON.stringify(rows, null, 2));
  write(cacheFile, JSON.stringify(cache, null, 2));

  console.log("Power Zones rows:", rows.length);
  console.log("Rows with headshots:", fixed);
}

function fixPowerZonesJs() {
  const file = path.join(ROOT, "power-zones.js");
  if (!fs.existsSync(file)) return;

  let js = read(file);

  js = js.replace(
    /function headshotUrl\(player\) \{[\s\S]*?\n\}/,
    `function headshotUrl(player) {
  return (
    player?.headshot_url ||
    player?.headshot ||
    player?.player_image ||
    player?.mlb_headshot_url ||
    player?.image ||
    player?.photo ||
    ""
  );
}`
  );

  write(file, js);
  console.log("Updated power-zones.js headshotUrl()");
}

function addPowerZonesNav() {
  const files = ["index.html", "app.js", "style.css", "styles.css"];

  for (const name of files) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;

    let content = read(file);

    if (name === "index.html" && !content.includes("power-zones.html")) {
      content = content.replace(
        /(<body[^>]*>)/i,
        `$1
<header class="tsl-top-nav">
  <a href="index.html" class="tsl-nav-brand">The Slip Lab</a>
  <nav class="tsl-nav-links">
    <a href="index.html">Home</a>
    <a href="power-zones.html">Power Zones</a>
  </nav>
</header>`
      );
      write(file, content);
      console.log("Added Power Zones nav to index.html");
    }

    if ((name === "style.css" || name === "styles.css") && !content.includes(".tsl-top-nav")) {
      content += `

.tsl-top-nav {
  width: 100%;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(5, 8, 18, 0.92);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(14px);
}

.tsl-nav-brand {
  color: #ffffff;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-decoration: none;
}

.tsl-nav-links {
  display: flex;
  gap: 12px;
  align-items: center;
}

.tsl-nav-links a {
  color: #ffffff;
  text-decoration: none;
  font-weight: 800;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
}

.tsl-nav-links a:hover {
  background: rgba(25, 255, 130, 0.16);
  border-color: rgba(25, 255, 130, 0.45);
}

@media (max-width: 700px) {
  .tsl-top-nav {
    flex-direction: column;
    gap: 12px;
  }

  .tsl-nav-links {
    flex-wrap: wrap;
    justify-content: center;
  }
}
`;
      write(file, content);
      console.log("Added nav CSS to", name);
    }
  }
}

await fixData();
fixPowerZonesJs();
addPowerZonesNav();

console.log("DONE");
