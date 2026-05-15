import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUT_FILES = [
  "hits_board.csv",
  "tb_board.csv",
  "hr_sweep_board_all_games.csv"
];

const OUTPUT_FILE = "data/recent_form.csv";
const CACHE_FILE = "data/recent_form_cache.json";

const SEASON = new Date().getFullYear();

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
  const headers = splitCsvLine(lines.shift());

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
  const str = String(value ?? "");

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function clean(value) {
  return String(value || "").trim();
}

function norm(value) {
  return clean(value).toLowerCase();
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getFirst(row, keys, fallback = "") {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }

  return fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCache() {
  const filePath = path.join(ROOT, CACHE_FILE);

  if (!fs.existsSync(filePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  const filePath = path.join(ROOT, CACHE_FILE);

  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });

  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "TheSlipLabMLBModel/1.0"
    }
  });

  if (!res.ok) {
    throw new Error(`Request failed ${res.status}`);
  }

  return res.json();
}

async function searchPlayerId(name, cache) {
  const key = `player_id:${norm(name)}`;

  if (cache[key]) return cache[key];

  const encoded = encodeURIComponent(name);
  const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encoded}&sportIds=1&active=true`;

  try {
    const data = await fetchJson(url);
    const people = Array.isArray(data.people) ? data.people : [];

    if (!people.length) {
      cache[key] = null;
      return null;
    }

    const exact = people.find(p => norm(p.fullName) === norm(name));
    const player = exact || people[0];

    cache[key] = player.id || null;
    return cache[key];
  } catch {
    cache[key] = null;
    return null;
  }
}

async function fetchGameLog(playerId, cache) {
  const key = `game_log:${playerId}:${SEASON}`;

  if (cache[key]) return cache[key];

  const url =
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats` +
    `?stats=gameLog&group=hitting&season=${SEASON}`;

  try {
    const data = await fetchJson(url);
    const splits = data?.stats?.[0]?.splits || [];

    cache[key] = splits;
    return splits;
  } catch {
    cache[key] = [];
    return [];
  }
}

function calcTotalBases(stat) {
  const doubles = toNum(stat.doubles);
  const triples = toNum(stat.triples);
  const hr = toNum(stat.homeRuns);
  const hits = toNum(stat.hits);

  const singles = Math.max(0, hits - doubles - triples - hr);

  return singles + doubles * 2 + triples * 3 + hr * 4;
}

function summarizeWindow(games, size) {
  const sample = games.slice(0, size);

  const gamesPlayed = sample.length;
  const atBats = sample.reduce((sum, g) => sum + toNum(g.stat?.atBats), 0);
  const plateAppearances = sample.reduce(
    (sum, g) => sum + toNum(g.stat?.plateAppearances),
    0
  );

  const hits = sample.reduce((sum, g) => sum + toNum(g.stat?.hits), 0);
  const homeRuns = sample.reduce((sum, g) => sum + toNum(g.stat?.homeRuns), 0);
  const strikeOuts = sample.reduce((sum, g) => sum + toNum(g.stat?.strikeOuts), 0);
  const walks = sample.reduce((sum, g) => sum + toNum(g.stat?.baseOnBalls), 0);
  const totalBases = sample.reduce((sum, g) => sum + calcTotalBases(g.stat || {}), 0);

  const avg = atBats > 0 ? hits / atBats : 0;
  const tbPerGame = gamesPlayed > 0 ? totalBases / gamesPlayed : 0;
  const hitRate = gamesPlayed > 0 ? sample.filter(g => toNum(g.stat?.hits) > 0).length / gamesPlayed : 0;
  const tbTwoRate = gamesPlayed > 0 ? sample.filter(g => calcTotalBases(g.stat || {}) >= 2).length / gamesPlayed : 0;
  const tbThreeRate = gamesPlayed > 0 ? sample.filter(g => calcTotalBases(g.stat || {}) >= 3).length / gamesPlayed : 0;
  const tbFourRate = gamesPlayed > 0 ? sample.filter(g => calcTotalBases(g.stat || {}) >= 4).length / gamesPlayed : 0;
  const hrRate = gamesPlayed > 0 ? sample.filter(g => toNum(g.stat?.homeRuns) > 0).length / gamesPlayed : 0;
  const kRate = plateAppearances > 0 ? strikeOuts / plateAppearances : 0;
  const walkRate = plateAppearances > 0 ? walks / plateAppearances : 0;

  return {
    games: gamesPlayed,
    at_bats: atBats,
    plate_appearances: plateAppearances,
    hits,
    total_bases: totalBases,
    home_runs: homeRuns,
    strikeouts: strikeOuts,
    walks,
    avg,
    tb_per_game: tbPerGame,
    hit_rate: hitRate,
    two_tb_rate: tbTwoRate,
    three_tb_rate: tbThreeRate,
    four_tb_rate: tbFourRate,
    hr_rate: hrRate,
    k_rate: kRate,
    walk_rate: walkRate
  };
}

function scoreRecentForm(w3, w5, w7, w15) {
  let score = 50;

  score += w3.hit_rate * 12;
  score += w5.hit_rate * 10;
  score += w7.hit_rate * 8;

  score += w3.two_tb_rate * 12;
  score += w5.two_tb_rate * 9;
  score += w7.two_tb_rate * 7;

  score += w3.three_tb_rate * 8;
  score += w5.three_tb_rate * 6;

  score += w3.hr_rate * 8;
  score += w5.hr_rate * 5;

  score += Math.min(w5.tb_per_game * 5, 12);
  score += Math.min(w7.tb_per_game * 3, 10);

  score -= w3.k_rate * 10;
  score -= w5.k_rate * 7;

  return Math.max(0, Math.min(99, Math.round(score)));
}

function getFormTag(score) {
  if (score >= 85) return "HEATER";
  if (score >= 72) return "STRONG";
  if (score >= 58) return "STABLE";
  if (score >= 45) return "COLD";
  return "SLUMP";
}

function collectPlayers() {
  const players = new Map();

  INPUT_FILES.forEach(file => {
    const rows = parseCsv(path.join(ROOT, file));

    rows.forEach(row => {
      const name = clean(getFirst(row, ["name", "player", "batter"]));
      const team = clean(getFirst(row, ["team", "team_abbr"]));

      if (!name) return;

      const key = `${norm(name)}|${norm(team)}`;

      if (!players.has(key)) {
        players.set(key, {
          name,
          team
        });
      }
    });
  });

  return Array.from(players.values());
}

function formatPct(value) {
  return (value * 100).toFixed(1);
}

function buildOutputRow(player, playerId, w3, w5, w7, w15, formScore) {
  return {
    name: player.name,
    team: player.team,
    player_id: playerId || "",
    form_score: formScore,
    form_tag: getFormTag(formScore),

    last_3_games: w3.games,
    last_3_avg: w3.avg.toFixed(3),
    last_3_hits: w3.hits,
    last_3_tb: w3.total_bases,
    last_3_tb_per_game: w3.tb_per_game.toFixed(2),
    last_3_hit_rate: formatPct(w3.hit_rate),
    last_3_2tb_rate: formatPct(w3.two_tb_rate),
    last_3_3tb_rate: formatPct(w3.three_tb_rate),
    last_3_4tb_rate: formatPct(w3.four_tb_rate),
    last_3_hr_rate: formatPct(w3.hr_rate),
    last_3_k_rate: formatPct(w3.k_rate),

    last_5_games: w5.games,
    last_5_avg: w5.avg.toFixed(3),
    last_5_hits: w5.hits,
    last_5_tb: w5.total_bases,
    last_5_tb_per_game: w5.tb_per_game.toFixed(2),
    last_5_hit_rate: formatPct(w5.hit_rate),
    last_5_2tb_rate: formatPct(w5.two_tb_rate),
    last_5_3tb_rate: formatPct(w5.three_tb_rate),
    last_5_4tb_rate: formatPct(w5.four_tb_rate),
    last_5_hr_rate: formatPct(w5.hr_rate),
    last_5_k_rate: formatPct(w5.k_rate),

    last_7_games: w7.games,
    last_7_avg: w7.avg.toFixed(3),
    last_7_hits: w7.hits,
    last_7_tb: w7.total_bases,
    last_7_tb_per_game: w7.tb_per_game.toFixed(2),
    last_7_hit_rate: formatPct(w7.hit_rate),
    last_7_2tb_rate: formatPct(w7.two_tb_rate),
    last_7_3tb_rate: formatPct(w7.three_tb_rate),
    last_7_4tb_rate: formatPct(w7.four_tb_rate),
    last_7_hr_rate: formatPct(w7.hr_rate),
    last_7_k_rate: formatPct(w7.k_rate),

    last_15_games: w15.games,
    last_15_avg: w15.avg.toFixed(3),
    last_15_hits: w15.hits,
    last_15_tb: w15.total_bases,
    last_15_tb_per_game: w15.tb_per_game.toFixed(2),
    last_15_hit_rate: formatPct(w15.hit_rate),
    last_15_2tb_rate: formatPct(w15.two_tb_rate),
    last_15_3tb_rate: formatPct(w15.three_tb_rate),
    last_15_4tb_rate: formatPct(w15.four_tb_rate),
    last_15_hr_rate: formatPct(w15.hr_rate),
    last_15_k_rate: formatPct(w15.k_rate)
  };
}

function writeCsv(rows) {
  const headers = [
    "name",
    "team",
    "player_id",
    "form_score",
    "form_tag",

    "last_3_games",
    "last_3_avg",
    "last_3_hits",
    "last_3_tb",
    "last_3_tb_per_game",
    "last_3_hit_rate",
    "last_3_2tb_rate",
    "last_3_3tb_rate",
    "last_3_4tb_rate",
    "last_3_hr_rate",
    "last_3_k_rate",

    "last_5_games",
    "last_5_avg",
    "last_5_hits",
    "last_5_tb",
    "last_5_tb_per_game",
    "last_5_hit_rate",
    "last_5_2tb_rate",
    "last_5_3tb_rate",
    "last_5_4tb_rate",
    "last_5_hr_rate",
    "last_5_k_rate",

    "last_7_games",
    "last_7_avg",
    "last_7_hits",
    "last_7_tb",
    "last_7_tb_per_game",
    "last_7_hit_rate",
    "last_7_2tb_rate",
    "last_7_3tb_rate",
    "last_7_4tb_rate",
    "last_7_hr_rate",
    "last_7_k_rate",

    "last_15_games",
    "last_15_avg",
    "last_15_hits",
    "last_15_tb",
    "last_15_tb_per_game",
    "last_15_hit_rate",
    "last_15_2tb_rate",
    "last_15_3tb_rate",
    "last_15_4tb_rate",
    "last_15_hr_rate",
    "last_15_k_rate"
  ];

  const text = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ].join("\n");

  const outputPath = path.join(ROOT, OUTPUT_FILE);

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true
  });

  fs.writeFileSync(outputPath, text);
}

async function main() {
  const cache = loadCache();
  const players = collectPlayers();

  console.log("");
  console.log("RECENT FORM ENGINE");
  console.log("Players found:", players.length);

  const outputRows = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];

    console.log(`[${i + 1}/${players.length}] ${player.name}`);

    const playerId = await searchPlayerId(player.name, cache);

    if (!playerId) {
      const empty = summarizeWindow([], 15);
      outputRows.push(buildOutputRow(player, "", empty, empty, empty, empty, 0));
      continue;
    }

    await sleep(60);

    const gameLog = await fetchGameLog(playerId, cache);

    const games = gameLog
      .filter(g => g?.stat)
      .sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

    const w3 = summarizeWindow(games, 3);
    const w5 = summarizeWindow(games, 5);
    const w7 = summarizeWindow(games, 7);
    const w15 = summarizeWindow(games, 15);

    const formScore = scoreRecentForm(w3, w5, w7, w15);

    outputRows.push(buildOutputRow(player, playerId, w3, w5, w7, w15, formScore));

    await sleep(60);
  }

  outputRows.sort((a, b) => {
    return toNum(b.form_score) - toNum(a.form_score);
  });

  writeCsv(outputRows);
  saveCache(cache);

  console.log("");
  console.log("Done.");
  console.log("Saved:", path.join(ROOT, OUTPUT_FILE));
}

main();