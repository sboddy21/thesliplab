import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const LINEUPS_FILE = path.join(DATA_DIR, "lineups.csv");
const MASTER_MODEL_FILE = path.join(DATA_DIR, "master_hr_model.csv");

const OUT_CSV = path.join(DATA_DIR, "advanced_hitter_stats.csv");
const OUT_JSON = path.join(DATA_DIR, "advanced_hitter_stats.json");

const MLB_SEARCH_URL = name =>
  `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}`;

const MLB_HITTER_STATS_URL = playerId =>
  `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=hitting`;

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

  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n")
  ) {
    return `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll(" jr", "")
    .replaceAll(" sr", "")
    .replaceAll(" iii", "")
    .replaceAll(" ii", "")
    .replace(/\s+/g, " ");
}

async function fetchJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return await res.json();
}

async function searchPlayer(name) {
  try {
    const data = await fetchJson(MLB_SEARCH_URL(name));
    const people = data.people || [];

    if (!people.length) return null;

    const exact = people.find(
      p => cleanName(p.fullName) === cleanName(name)
    );

    return exact || people[0];
  } catch {
    return null;
  }
}

async function getHitterStats(playerId) {
  try {
    const data = await fetchJson(MLB_HITTER_STATS_URL(playerId));
    const stat = data?.stats?.[0]?.splits?.[0]?.stat || {};

    const plateAppearances = num(stat.plateAppearances);
    const atBats = num(stat.atBats);
    const hits = num(stat.hits);
    const doubles = num(stat.doubles);
    const triples = num(stat.triples);
    const homeRuns = num(stat.homeRuns);
    const walks = num(stat.baseOnBalls);
    const strikeouts = num(stat.strikeOuts);
    const totalBases = num(stat.totalBases);

    const singles =
      hits - doubles - triples - homeRuns;

    const slugging =
      atBats > 0
        ? (
            (
              singles +
              doubles * 2 +
              triples * 3 +
              homeRuns * 4
            ) / atBats
          ).toFixed(3)
        : "0.000";

    const iso =
      atBats > 0
        ? (
            (
              doubles +
              (triples * 2) +
              (homeRuns * 3)
            ) / atBats
          ).toFixed(3)
        : "0.000";

    return {
      avg: stat.avg || ".000",
      obp: stat.obp || ".000",
      ops: stat.ops || ".000",
      slg: slugging,
      iso,
      hits,
      doubles,
      triples,
      home_runs: homeRuns,
      extra_base_hits: doubles + triples + homeRuns,
      total_bases: totalBases,
      rbi: num(stat.rbi),
      walks,
      strikeouts,
      plate_appearances: plateAppearances,
      at_bats: atBats,
      strikeout_rate:
        plateAppearances > 0
          ? ((strikeouts / plateAppearances) * 100).toFixed(1)
          : "0.0",
      walk_rate:
        plateAppearances > 0
          ? ((walks / plateAppearances) * 100).toFixed(1)
          : "0.0",
      hit_rate:
        atBats > 0
          ? ((hits / atBats) * 100).toFixed(1)
          : "0.0",
      total_bases_per_at_bat:
        atBats > 0
          ? (totalBases / atBats).toFixed(3)
          : "0.000"
    };
  } catch {
    return null;
  }
}

async function main() {
  const lineupRows = parseCsv(LINEUPS_FILE);
  const modelRows = parseCsv(MASTER_MODEL_FILE);

  const uniquePlayers = new Map();

  for (const row of lineupRows) {
    const name = row.name || row.player;
    if (!name) continue;

    uniquePlayers.set(cleanName(name), {
      name,
      team: row.team || "",
      game: row.game || "",
      lineup_spot: row.lineup_spot || ""
    });
  }

  for (const row of modelRows) {
    const name = row.name || row.player;
    if (!name) continue;

    const key = cleanName(name);

    if (!uniquePlayers.has(key)) {
      uniquePlayers.set(key, {
        name,
        team: row.team || "",
        game: row.game || "",
        lineup_spot: row.lineup_spot || ""
      });
    }
  }

  console.log("");
  console.log("THE SLIP LAB ADVANCED HITTER STATS");
  console.log("Players:", uniquePlayers.size);

  const rows = [];

  for (const hitter of uniquePlayers.values()) {
    console.log("Checking:", hitter.name);

    const player = await searchPlayer(hitter.name);

    if (!player?.id) {
      rows.push({
        ...hitter,
        player_id: "",
        avg: ".000",
        obp: ".000",
        ops: ".000",
        slg: "0.000",
        iso: "0.000",
        hits: 0,
        doubles: 0,
        triples: 0,
        home_runs: 0,
        extra_base_hits: 0,
        total_bases: 0,
        rbi: 0,
        walks: 0,
        strikeouts: 0,
        plate_appearances: 0,
        at_bats: 0,
        strikeout_rate: "0.0",
        walk_rate: "0.0",
        hit_rate: "0.0",
        total_bases_per_at_bat: "0.000",
        stat_status: "player not found"
      });

      continue;
    }

    const stats = await getHitterStats(player.id);

    if (!stats) {
      rows.push({
        ...hitter,
        player_id: player.id,
        avg: ".000",
        obp: ".000",
        ops: ".000",
        slg: "0.000",
        iso: "0.000",
        hits: 0,
        doubles: 0,
        triples: 0,
        home_runs: 0,
        extra_base_hits: 0,
        total_bases: 0,
        rbi: 0,
        walks: 0,
        strikeouts: 0,
        plate_appearances: 0,
        at_bats: 0,
        strikeout_rate: "0.0",
        walk_rate: "0.0",
        hit_rate: "0.0",
        total_bases_per_at_bat: "0.000",
        stat_status: "stats unavailable"
      });

      continue;
    }

    rows.push({
      ...hitter,
      player_id: player.id,
      ...stats,
      stat_status: "ok"
    });
  }

  const headers = Object.keys(rows[0] || {});

  const csvLines = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => csvEscape(row[h])).join(",")
    )
  ];

  fs.writeFileSync(OUT_CSV, csvLines.join("\n"));
  fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2));

  console.log("");
  console.log("ADVANCED HITTER STATS COMPLETE");
  console.log("Rows:", rows.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);

  console.table(
    rows.slice(0, 20).map(r => ({
      name: r.name,
      team: r.team,
      hr: r.home_runs,
      iso: r.iso,
      slg: r.slg,
      ops: r.ops,
      status: r.stat_status
    }))
  );
}

main();
