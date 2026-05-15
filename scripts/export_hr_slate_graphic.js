import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const EXPORT_DIR = path.join(ROOT, "exports");
const CONTENT_DIR = path.join(EXPORT_DIR, "content_engine");

const INPUT_FILES = [
  path.join(EXPORT_DIR, "hr_model.csv"),
  path.join(EXPORT_DIR, "hr_board.csv"),
  path.join(ROOT, "data", "player_stats.csv"),
];

const OUT_SVG = path.join(CONTENT_DIR, "hr_slate_overview.svg");
const OUT_TXT = path.join(CONTENT_DIR, "x_post_hr_slate_overview.txt");

const TODAY = new Date().toISOString().slice(0, 10);

const TEAM_ABBR = {
  "Arizona Diamondbacks": "ARI",
  "Athletics": "ATH",
  "Atlanta Braves": "ATL",
  "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS",
  "Chicago Cubs": "CHC",
  "Chicago White Sox": "CHW",
  "Cincinnati Reds": "CIN",
  "Cleveland Guardians": "CLE",
  "Colorado Rockies": "COL",
  "Detroit Tigers": "DET",
  "Houston Astros": "HOU",
  "Kansas City Royals": "KC",
  "Los Angeles Angels": "LAA",
  "Los Angeles Dodgers": "LAD",
  "Miami Marlins": "MIA",
  "Milwaukee Brewers": "MIL",
  "Minnesota Twins": "MIN",
  "New York Mets": "NYM",
  "New York Yankees": "NYY",
  "Philadelphia Phillies": "PHI",
  "Pittsburgh Pirates": "PIT",
  "San Diego Padres": "SD",
  "San Francisco Giants": "SF",
  "Seattle Mariners": "SEA",
  "St. Louis Cardinals": "STL",
  "Tampa Bay Rays": "TB",
  "Texas Rangers": "TEX",
  "Toronto Blue Jays": "TOR",
  "Washington Nationals": "WSH",
};

function exists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function firstExisting(files) {
  return files.find(exists) || null;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function splitCsvLine(line) {
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

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function readCSV(file) {
  return parseCSV(fs.readFileSync(file, "utf8"));
}

function text(value) {
  return String(value ?? "").trim();
}

function num(value) {
  const raw = text(value).replace("%", "").replace("+", "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function cleanKey(value) {
  return text(value)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getAny(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && text(row[name]) !== "") return row[name];
  }

  const keys = Object.keys(row);
  const wanted = names.map((x) => cleanKey(x).replace(/\s/g, ""));

  for (const key of keys) {
    const clean = cleanKey(key).replace(/\s/g, "");
    if (wanted.includes(clean) && text(row[key]) !== "") return row[key];
  }

  return "";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function teamAbbr(name) {
  return TEAM_ABBR[name] || name;
}

function shortGameName(game) {
  return text(game)
    .replace("New York Yankees", "NYY")
    .replace("New York Mets", "NYM")
    .replace("Baltimore Orioles", "BAL")
    .replace("Milwaukee Brewers", "MIL")
    .replace("Athletics", "ATH")
    .replace("Pittsburgh Pirates", "PIT")
    .replace("San Francisco Giants", "SF")
    .replace("Cleveland Guardians", "CLE")
    .replace("Minnesota Twins", "MIN")
    .replace("Philadelphia Phillies", "PHI")
    .replace("Washington Nationals", "WSH")
    .replace("Los Angeles Dodgers", "LAD")
    .replace("Los Angeles Angels", "LAA")
    .replace("Arizona Diamondbacks", "ARI")
    .replace("Chicago Cubs", "CHC")
    .replace("Chicago White Sox", "CHW")
    .replace("Kansas City Royals", "KC")
    .replace("San Diego Padres", "SD")
    .replace("St. Louis Cardinals", "STL")
    .replace("Tampa Bay Rays", "TB")
    .replace("Texas Rangers", "TEX")
    .replace("Toronto Blue Jays", "TOR")
    .replace("Seattle Mariners", "SEA")
    .replace("Boston Red Sox", "BOS")
    .replace("Atlanta Braves", "ATL")
    .replace("Colorado Rockies", "COL")
    .replace("Detroit Tigers", "DET")
    .replace("Houston Astros", "HOU")
    .replace("Miami Marlins", "MIA")
    .replace("Cincinnati Reds", "CIN")
    .replace(" @ ", " at ");
}

function shortNames(value) {
  const names = text(value).split(",").map((x) => x.trim()).filter(Boolean);
  return names.slice(0, 2).join(", ");
}

function safePlayer(row) {
  return {
    name: text(getAny(row, ["name", "player", "batter", "player_name"])),
    game: text(getAny(row, ["game", "matchup", "event"])),
    score: num(getAny(row, ["hr_model_score", "score", "final_score"])),
    vegasTotal: num(getAny(row, ["vegas_game_total", "game_total", "total"])),
    weatherBoost: num(getAny(row, ["weather_boost"])),
    parkBoost: num(getAny(row, ["park_factor_boost", "park_boost"])),
    pitcherAttack: num(getAny(row, ["pitcher_attack_score", "pitcher_attack_boost"])),
  };
}

function loadPlayers() {
  const inputFile = firstExisting(INPUT_FILES);

  if (!inputFile) {
    console.error("Could not find hr_model.csv, hr_board.csv, or player_stats.csv");
    process.exit(1);
  }

  const players = readCSV(inputFile)
    .map(safePlayer)
    .filter((row) => row.name && row.game);

  return { inputFile, players };
}

async function fetchScheduleGames() {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${TODAY}&hydrate=team`;
  const res = await fetch(url);

  if (!res.ok) return [];

  const data = await res.json();
  const games = [];

  for (const dateBlock of data?.dates || []) {
    for (const game of dateBlock?.games || []) {
      const away = game?.teams?.away?.team?.name || "";
      const home = game?.teams?.home?.team?.name || "";

      if (!away || !home) continue;

      games.push({
        game: `${teamAbbr(away)} at ${teamAbbr(home)}`,
        scheduleOnly: true,
      });
    }
  }

  return games;
}

function average(values) {
  const nums = values.filter((v) => Number.isFinite(v) && v !== 0);
  if (!nums.length) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function topPlayerNames(players) {
  return [...players]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ");
}

function projectedHrs(game) {
  if (game.scheduleOnly) return 1.9;

  const base = 1.4;
  const model = Math.max(0, game.avgScore - 40) * 0.045;
  const vegas = game.vegasTotal ? Math.max(0, game.vegasTotal - 7.5) * 0.24 : 0;
  const weather = game.avgWeatherBoost * 0.05;
  const park = game.avgParkBoost * 0.04;
  const attack = Math.max(0, game.avgPitcherAttack - 45) * 0.012;

  return Math.max(1.2, Math.min(4.6, base + model + vegas + weather + park + attack));
}

function grade(score) {
  if (score >= 82) return "ELITE";
  if (score >= 74) return "HOT";
  if (score >= 66) return "STRONG";
  if (score >= 58) return "LIVE";
  return "NORMAL";
}

function buildModelGames(players) {
  const map = new Map();

  for (const player of players) {
    const gameKey = shortGameName(player.game);
    if (!map.has(gameKey)) map.set(gameKey, []);
    map.get(gameKey).push(player);
  }

  const games = [];

  for (const [game, group] of map.entries()) {
    const avgScore = average(group.map((p) => p.score));
    const topScore = Math.max(...group.map((p) => p.score));
    const vegasTotal = average(group.map((p) => p.vegasTotal));
    const avgWeatherBoost = average(group.map((p) => p.weatherBoost));
    const avgParkBoost = average(group.map((p) => p.parkBoost));
    const avgPitcherAttack = average(group.map((p) => p.pitcherAttack));

    const envScore =
      avgScore * 0.46 +
      topScore * 0.15 +
      Math.max(0, vegasTotal - 7) * 4.8 +
      avgWeatherBoost * 1.6 +
      avgParkBoost * 1.2 +
      avgPitcherAttack * 0.1;

    const projected = projectedHrs({
      avgScore,
      vegasTotal,
      avgWeatherBoost,
      avgParkBoost,
      avgPitcherAttack,
      scheduleOnly: false,
    });

    games.push({
      game,
      avgScore,
      vegasTotal,
      envScore,
      projected,
      grade: grade(envScore),
      topPlayers: topPlayerNames(group),
      scheduleOnly: false,
    });
  }

  return games;
}

function mergeScheduleGames(modelGames, scheduleGames) {
  const map = new Map();

  for (const game of modelGames) {
    map.set(cleanKey(game.game), game);
  }

  for (const sched of scheduleGames) {
    const key = cleanKey(sched.game);
    if (map.has(key)) continue;

    map.set(key, {
      game: sched.game,
      avgScore: 0,
      vegasTotal: 0,
      envScore: 52,
      projected: 1.9,
      grade: "NORMAL",
      topPlayers: "Awaiting model data",
      scheduleOnly: true,
    });
  }

  return [...map.values()].sort((a, b) => b.projected - a.projected);
}

function colorForGrade(value) {
  const v = text(value).toUpperCase();
  if (v === "ELITE") return "#39ff14";
  if (v === "HOT") return "#ff9f1c";
  if (v === "STRONG") return "#00e5ff";
  if (v === "LIVE") return "#ffd166";
  return "#b8ffcc";
}

function svgSlate(games) {
  const width = 1600;
  const height = 700;
  const accent = "#39ff14";

  const top = games.slice(0, 15);
  const topEnv = games.slice(0, 6);
  const totalProjected = games.reduce((sum, g) => sum + g.projected, 0);

  const tiles = top.map((game, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);
    const x = 68 + col * 300;
    const y = 235 + row * 110;
    const color = colorForGrade(game.grade);

    return `
      <rect x="${x}" y="${y}" width="270" height="90" rx="16" fill="#101820" stroke="${color}" stroke-width="2"/>
      <text x="${x + 15}" y="${y + 23}" font-size="15" fill="#ffffff" font-family="Arial" font-weight="900">${escapeXml(shortGameName(game.game).slice(0, 25))}</text>
      <text x="${x + 15}" y="${y + 48}" font-size="20" fill="${color}" font-family="Arial" font-weight="900">${game.projected.toFixed(1)} Proj HRs</text>
      <text x="${x + 15}" y="${y + 68}" font-size="12" fill="#b8ffcc" font-family="Arial" font-weight="700">${game.scheduleOnly ? "Schedule only" : `Score ${game.avgScore.toFixed(1)} | Total ${game.vegasTotal ? game.vegasTotal.toFixed(1) : "N/A"}`}</text>
      <text x="${x + 15}" y="${y + 84}" font-size="10" fill="#9be7b0" font-family="Arial">${escapeXml(shortNames(game.topPlayers) || "Awaiting model data")}</text>
      <text x="${x + 250}" y="${y + 22}" font-size="10" fill="${color}" font-family="Arial" font-weight="900" text-anchor="end">${game.grade}</text>
    `;
  }).join("");

  const envLines = topEnv.map((game, index) => {
    const y = 111 + index * 18;
    return `
      <text x="1125" y="${y}" font-size="15" fill="#ffffff" font-family="Arial" font-weight="800">${index + 1}. ${escapeXml(shortGameName(game.game).slice(0, 22))}  ${game.projected.toFixed(1)}</text>
    `;
  }).join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="25%" r="80%">
      <stop offset="0%" stop-color="#1f3d2b"/>
      <stop offset="50%" stop-color="#07110c"/>
      <stop offset="100%" stop-color="#020403"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="32" y="28" width="1536" height="640" rx="34" fill="none" stroke="${accent}" stroke-width="4"/>

  <circle cx="1400" cy="90" r="145" fill="${accent}" opacity="0.07"/>
  <circle cx="180" cy="625" r="165" fill="${accent}" opacity="0.06"/>

  <text x="800" y="62" font-size="32" fill="${accent}" font-family="Arial" font-weight="900" text-anchor="middle" filter="url(#glow)">THE SLIP LAB</text>
  <text x="800" y="106" font-size="44" fill="#ffffff" font-family="Arial" font-weight="900" text-anchor="middle">HR SLATE OVERVIEW</text>
  <text x="800" y="139" font-size="20" fill="#b8ffcc" font-family="Arial" font-weight="700" text-anchor="middle">${todayLabel()} | ${games.length} Games Scored</text>

  <rect x="70" y="80" width="335" height="92" rx="20" fill="#101820" stroke="${accent}" stroke-width="2"/>
  <text x="238" y="113" font-size="19" fill="#b8ffcc" font-family="Arial" font-weight="900" text-anchor="middle">TOTAL PROJECTED HRS</text>
  <text x="238" y="151" font-size="36" fill="${accent}" font-family="Arial" font-weight="900" text-anchor="middle">${totalProjected.toFixed(1)}</text>

  <rect x="1090" y="80" width="430" height="132" rx="20" fill="#101820" stroke="#ffd166" stroke-width="2"/>
  <text x="1305" y="103" font-size="17" fill="#ffd166" font-family="Arial" font-weight="900" text-anchor="middle">TOP GAME ENVIRONMENTS</text>
  ${envLines}

  <line x1="70" y1="218" x2="1530" y2="218" stroke="${accent}" stroke-width="3" opacity="0.8"/>

  ${tiles}

  <text x="800" y="593" font-size="18" fill="#ffffff" font-family="Arial" font-weight="900" text-anchor="middle">Projected HRs use model data when available. Schedule only games are baseline estimates.</text>
  <text x="800" y="622" font-size="17" fill="#b8ffcc" font-family="Arial" font-weight="700" text-anchor="middle">Free picks. Data backed. No capper tax.</text>
</svg>`;
}

function xCaption(games) {
  const top = games.slice(0, 7);
  const totalProjected = games.reduce((sum, g) => sum + g.projected, 0);

  return [
    "🔥 HR SLATE OVERVIEW 🔥",
    "",
    `${totalProjected.toFixed(1)} total projected HRs across ${games.length} games.`,
    "",
    "Top game environments:",
    ...top.map((g) => `${g.game} | ${g.projected.toFixed(1)} projected HRs`),
    "",
    "Model data used where available. Schedule only games use baseline estimates.",
    "",
    "#MLB #HomeRunPicks #TheSlipLab",
  ].join("\n");
}

async function main() {
  ensureDir(EXPORT_DIR);
  ensureDir(CONTENT_DIR);

  const { inputFile, players } = loadPlayers();
  const modelGames = buildModelGames(players);
  const scheduleGames = await fetchScheduleGames();
  const games = mergeScheduleGames(modelGames, scheduleGames);

  const svg = svgSlate(games);

  fs.writeFileSync(OUT_SVG, svg, "utf8");
  fs.writeFileSync(OUT_TXT, xCaption(games) + "\n", "utf8");

  console.log("HR SLATE GRAPHIC EXPORT COMPLETE");
  console.log(`Input: ${inputFile}`);
  console.log(`Players read: ${players.length}`);
  console.log(`Model games scored: ${modelGames.length}`);
  console.log(`Schedule games found: ${scheduleGames.length}`);
  console.log(`Final games displayed: ${games.length}`);
  console.log(`SVG: ${OUT_SVG}`);
  console.log(`X post: ${OUT_TXT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});