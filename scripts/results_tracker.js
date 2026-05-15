import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUT_PARLAY = "exports/parlay_builder.csv";

const OUTPUTS = {
  graded: "exports/graded_results.csv",
  history: "data/results_history.csv",
  roi: "exports/roi_tracker.csv",
  accuracy: "exports/model_accuracy.csv"
};

const UNIT_SIZE = 5;

function getDateArg() {
  const arg = process.argv.find(a => a.startsWith("--date="));

  if (arg) return arg.replace("--date=", "");

  return new Date().toISOString().slice(0, 10);
}

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

function writeCsv(filePath, rows, headers) {
  const text = [
    headers.join(","),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
  ].join("\n");

  fs.mkdirSync(path.dirname(path.join(ROOT, filePath)), {
    recursive: true
  });

  fs.writeFileSync(path.join(ROOT, filePath), text);
}

function appendCsv(filePath, rows, headers) {
  const fullPath = path.join(ROOT, filePath);

  fs.mkdirSync(path.dirname(fullPath), {
    recursive: true
  });

  const body = rows
    .map(row => headers.map(h => csvEscape(row[h])).join(","))
    .join("\n");

  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, [headers.join(","), body].join("\n"));
    return;
  }

  fs.appendFileSync(fullPath, `\n${body}`);
}

function clean(value) {
  return String(value || "").trim();
}

function norm(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/jr$/g, "")
    .replace(/sr$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function totalBases(stats) {
  const hits = num(stats.hits);
  const doubles = num(stats.doubles);
  const triples = num(stats.triples);
  const hr = num(stats.homeRuns);

  const singles = Math.max(0, hits - doubles - triples - hr);

  return singles + doubles * 2 + triples * 3 + hr * 4;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "TheSlipLabResultsTracker/1.0"
    }
  });

  if (!res.ok) {
    throw new Error(`Request failed ${res.status}: ${url}`);
  }

  return res.json();
}

async function fetchSchedule(date) {
  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`;

  const data = await fetchJson(url);

  const dates = data?.dates || [];

  return dates.flatMap(d => d.games || []);
}

async function fetchBoxScore(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;

  return fetchJson(url);
}

function collectHittersFromBoxscore(boxscore) {
  const playerMap = new Map();

  const teams = ["away", "home"];

  teams.forEach(side => {
    const team = boxscore?.teams?.[side];
    const teamName = team?.team?.name || "";
    const players = team?.players || {};

    Object.values(players).forEach(playerObj => {
      const person = playerObj?.person || {};
      const stats = playerObj?.stats?.batting || {};

      if (!person.fullName) return;

      const key = norm(person.fullName);

      playerMap.set(key, {
        player_id: person.id || "",
        name: person.fullName,
        team: teamName,
        hits: num(stats.hits),
        doubles: num(stats.doubles),
        triples: num(stats.triples),
        home_runs: num(stats.homeRuns),
        total_bases: totalBases(stats),
        at_bats: num(stats.atBats),
        plate_appearances: num(stats.plateAppearances),
        strikeouts: num(stats.strikeOuts),
        walks: num(stats.baseOnBalls)
      });
    });
  });

  return playerMap;
}

async function fetchResults(date) {
  const games = await fetchSchedule(date);
  const allPlayers = new Map();

  console.log("");
  console.log("RESULT TRACKER");
  console.log("Date:", date);
  console.log("Games found:", games.length);

  for (const game of games) {
    const gamePk = game.gamePk;

    if (!gamePk) continue;

    const status = game?.status?.abstractGameState || "";
    const detailedStatus = game?.status?.detailedState || "";

    console.log(`Checking game ${gamePk}: ${detailedStatus || status}`);

    const boxscore = await fetchBoxScore(gamePk);
    const players = collectHittersFromBoxscore(boxscore);

    for (const [key, value] of players.entries()) {
      allPlayers.set(key, value);
    }
  }

  return allPlayers;
}

function gradeProp(prop, stats) {
  const p = clean(prop).toUpperCase();

  if (!stats) {
    return {
      result: "NO DATA",
      hit: "",
      actual: ""
    };
  }

  if (p === "1+ HIT") {
    return {
      result: stats.hits >= 1 ? "WIN" : "LOSS",
      hit: stats.hits >= 1 ? 1 : 0,
      actual: stats.hits
    };
  }

  if (p === "2+ TB") {
    return {
      result: stats.total_bases >= 2 ? "WIN" : "LOSS",
      hit: stats.total_bases >= 2 ? 1 : 0,
      actual: stats.total_bases
    };
  }

  if (p === "3+ TB") {
    return {
      result: stats.total_bases >= 3 ? "WIN" : "LOSS",
      hit: stats.total_bases >= 3 ? 1 : 0,
      actual: stats.total_bases
    };
  }

  if (p === "4+ TB") {
    return {
      result: stats.total_bases >= 4 ? "WIN" : "LOSS",
      hit: stats.total_bases >= 4 ? 1 : 0,
      actual: stats.total_bases
    };
  }

  if (p === "HR") {
    return {
      result: stats.home_runs >= 1 ? "WIN" : "LOSS",
      hit: stats.home_runs >= 1 ? 1 : 0,
      actual: stats.home_runs
    };
  }

  return {
    result: "UNKNOWN PROP",
    hit: "",
    actual: ""
  };
}

function calcProfit(result, odds = "") {
  const americanOdds = num(odds, 0);

  if (result !== "WIN" && result !== "LOSS") return 0;

  if (!americanOdds) {
    return result === "WIN" ? UNIT_SIZE : -UNIT_SIZE;
  }

  if (result === "LOSS") return -UNIT_SIZE;

  if (americanOdds > 0) {
    return Number(((UNIT_SIZE * americanOdds) / 100).toFixed(2));
  }

  return Number(((UNIT_SIZE * 100) / Math.abs(americanOdds)).toFixed(2));
}

function gradeParlayRows(parlayRows, resultsMap, date) {
  return parlayRows.map(row => {
    const name = clean(row.name);
    const stats = resultsMap.get(norm(name));
    const grade = gradeProp(row.prop, stats);
    const profit = calcProfit(grade.result, row.odds);

    return {
      date,
      slip: row.slip,
      category: row.category,
      leg: row.leg,
      name: row.name,
      team: row.team,
      prop: row.prop,
      result: grade.result,
      hit: grade.hit,
      actual: grade.actual,
      hits: stats?.hits ?? "",
      total_bases: stats?.total_bases ?? "",
      home_runs: stats?.home_runs ?? "",
      score: row.score,
      raw_score: row.raw_score,
      form_score: row.form_score,
      form_tag: row.form_tag,
      form_boost: row.form_boost,
      tier: row.tier,
      confidence: row.confidence,
      lineup: row.lineup,
      source: row.source,
      odds: row.odds || "",
      unit_size: UNIT_SIZE,
      profit
    };
  });
}

function summarizeRoi(rows) {
  const groups = new Map();

  rows.forEach(row => {
    const keys = [
      `ALL|ALL`,
      `CATEGORY|${row.category}`,
      `PROP|${row.prop}`,
      `SOURCE|${row.source}`,
      `FORM|${row.form_tag}`
    ];

    keys.forEach(key => {
      if (!groups.has(key)) {
        groups.set(key, {
          group_type: key.split("|")[0],
          group: key.split("|")[1],
          bets: 0,
          wins: 0,
          losses: 0,
          no_data: 0,
          risked: 0,
          profit: 0
        });
      }

      const g = groups.get(key);

      g.bets += 1;

      if (row.result === "WIN") g.wins += 1;
      else if (row.result === "LOSS") g.losses += 1;
      else g.no_data += 1;

      if (row.result === "WIN" || row.result === "LOSS") {
        g.risked += UNIT_SIZE;
        g.profit += num(row.profit);
      }
    });
  });

  return Array.from(groups.values()).map(g => {
    const decided = g.wins + g.losses;
    const hitRate = decided > 0 ? (g.wins / decided) * 100 : 0;
    const roi = g.risked > 0 ? (g.profit / g.risked) * 100 : 0;

    return {
      group_type: g.group_type,
      group: g.group,
      bets: g.bets,
      wins: g.wins,
      losses: g.losses,
      no_data: g.no_data,
      hit_rate: hitRate.toFixed(1),
      risked: g.risked.toFixed(2),
      profit: g.profit.toFixed(2),
      roi: roi.toFixed(1)
    };
  });
}

function summarizeAccuracy(rows) {
  const zones = [
    {
      name: "90+",
      min: 90,
      max: 999
    },
    {
      name: "80 to 89.99",
      min: 80,
      max: 89.99
    },
    {
      name: "70 to 79.99",
      min: 70,
      max: 79.99
    },
    {
      name: "60 to 69.99",
      min: 60,
      max: 69.99
    },
    {
      name: "Below 60",
      min: 0,
      max: 59.99
    }
  ];

  return zones.map(zone => {
    const zoneRows = rows.filter(row => {
      const score = num(row.score);
      return score >= zone.min && score <= zone.max;
    });

    const wins = zoneRows.filter(row => row.result === "WIN").length;
    const losses = zoneRows.filter(row => row.result === "LOSS").length;
    const decided = wins + losses;
    const hitRate = decided > 0 ? (wins / decided) * 100 : 0;

    return {
      score_zone: zone.name,
      bets: zoneRows.length,
      wins,
      losses,
      hit_rate: hitRate.toFixed(1)
    };
  });
}

async function main() {
  const date = getDateArg();

  const parlayPath = path.join(ROOT, INPUT_PARLAY);

  if (!fs.existsSync(parlayPath)) {
    console.error("Missing:", INPUT_PARLAY);
    console.error("Run node scripts/parlay_builder.js first.");
    process.exit(1);
  }

  const parlayRows = parseCsv(parlayPath);

  if (!parlayRows.length) {
    console.error("No parlay rows found.");
    process.exit(1);
  }

  const resultsMap = await fetchResults(date);
  const gradedRows = gradeParlayRows(parlayRows, resultsMap, date);

  const resultHeaders = [
    "date",
    "slip",
    "category",
    "leg",
    "name",
    "team",
    "prop",
    "result",
    "hit",
    "actual",
    "hits",
    "total_bases",
    "home_runs",
    "score",
    "raw_score",
    "form_score",
    "form_tag",
    "form_boost",
    "tier",
    "confidence",
    "lineup",
    "source",
    "odds",
    "unit_size",
    "profit"
  ];

  writeCsv(OUTPUTS.graded, gradedRows, resultHeaders);
  appendCsv(OUTPUTS.history, gradedRows, resultHeaders);

  const roiRows = summarizeRoi(gradedRows);

  writeCsv(OUTPUTS.roi, roiRows, [
    "group_type",
    "group",
    "bets",
    "wins",
    "losses",
    "no_data",
    "hit_rate",
    "risked",
    "profit",
    "roi"
  ]);

  const accuracyRows = summarizeAccuracy(gradedRows);

  writeCsv(OUTPUTS.accuracy, accuracyRows, [
    "score_zone",
    "bets",
    "wins",
    "losses",
    "hit_rate"
  ]);

  console.log("");
  console.log("RESULT TRACKING COMPLETE");
  console.log("Date:", date);
  console.log("Rows graded:", gradedRows.length);
  console.log("Saved:", path.join(ROOT, OUTPUTS.graded));
  console.log("Saved:", path.join(ROOT, OUTPUTS.history));
  console.log("Saved:", path.join(ROOT, OUTPUTS.roi));
  console.log("Saved:", path.join(ROOT, OUTPUTS.accuracy));
}

main();