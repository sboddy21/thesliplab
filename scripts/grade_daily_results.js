import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const ARG_DATE = process.argv[2];
const DATE = ARG_DATE || new Date().toISOString().slice(0, 10);

const HISTORY_ROOT = path.join(ROOT, "history", DATE);
const OUT_DIR = path.join(ROOT, "exports", "results");
const OUT_CSV = path.join(OUT_DIR, `graded_results_${DATE}.csv`);
const OUT_JSON = path.join(OUT_DIR, `graded_results_${DATE}.json`);
const OUT_SUMMARY = path.join(OUT_DIR, `results_summary_${DATE}.txt`);

const MLB_SCHEDULE_URL = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${DATE}&hydrate=team,probablePitcher,linescore`;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/ jr$/g, "")
    .replace(/ sr$/g, "")
    .replace(/ iii$/g, "")
    .replace(/ ii$/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeam(value = "") {
  return String(value)
    .toLowerCase()
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

  const headers = Object.keys(rows[0]);

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

function findLatestArchiveFolder() {
  if (!fs.existsSync(HISTORY_ROOT)) return null;

  const folders = fs.readdirSync(HISTORY_ROOT)
    .map(name => path.join(HISTORY_ROOT, name))
    .filter(file => fs.statSync(file).isDirectory())
    .sort();

  return folders.at(-1) || null;
}

function findFirstExisting(baseDir, candidates) {
  for (const candidate of candidates) {
    const full = path.join(baseDir, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return "";
}

function parseAmericanOdds(value) {
  const text = String(value || "").replace("+", "").trim();
  const odds = Number(text);
  if (!Number.isFinite(odds) || odds === 0) return null;
  return odds;
}

function profitForOneUnit(odds) {
  if (!odds) return 0;
  if (odds > 0) return odds / 100;
  return 100 / Math.abs(odds);
}

function parseTbTarget(row) {
  const prop = String(
    getField(row, ["prop", "market", "best", "play", "bet", "type"])
  );

  const match = prop.match(/(\d+)\s*\+?\s*TB/i);
  if (match) return Number(match[1]);

  const target = Number(getField(row, ["tb_target", "target", "line"]));
  if (Number.isFinite(target) && target > 0) return target;

  return 1;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function getMlbPlayerResults() {
  const schedule = await getJson(MLB_SCHEDULE_URL);

  const games = schedule?.dates?.[0]?.games || [];
  const playerMap = new Map();

  for (const game of games) {
    const gamePk = game.gamePk;
    const status = game?.status?.detailedState || "";
    const boxUrl = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
    const box = await getJson(boxUrl);

    const teams = ["home", "away"];

    for (const side of teams) {
      const teamName = box?.teams?.[side]?.team?.name || "";
      const players = box?.teams?.[side]?.players || {};

      for (const key of Object.keys(players)) {
        const player = players[key];
        const name = player?.person?.fullName || "";
        const batting = player?.stats?.batting || {};

        if (!name) continue;

        const results = {
          date: DATE,
          game_pk: gamePk,
          game_status: status,
          name,
          player_key: normalizeName(name),
          team: teamName,
          team_key: normalizeTeam(teamName),
          at_bats: Number(batting.atBats || 0),
          hits: Number(batting.hits || 0),
          doubles: Number(batting.doubles || 0),
          triples: Number(batting.triples || 0),
          home_runs: Number(batting.homeRuns || 0),
          total_bases: Number(batting.totalBases || 0),
          rbi: Number(batting.rbi || 0),
          runs: Number(batting.runs || 0),
          walks: Number(batting.baseOnBalls || 0),
          strikeouts: Number(batting.strikeOuts || 0)
        };

        playerMap.set(results.player_key, results);
      }
    }
  }

  return playerMap;
}

function gradeBoard(rows, boardType, playerResults) {
  const graded = [];

  for (const row of rows) {
    const name = getField(row, ["name", "player", "batter", "player_name"]);
    if (!name) continue;

    const key = normalizeName(name);
    const result = playerResults.get(key);

    const odds = parseAmericanOdds(getField(row, ["odds", "best_odds", "price", "line_odds"]));

    let hit = false;
    let status = "NO RESULT";
    let actual = "";
    let target = "";

    if (result) {
      status = "GRADED";

      if (boardType === "HR") {
        actual = result.home_runs;
        target = 1;
        hit = result.home_runs >= 1;
      }

      if (boardType === "HITS") {
        actual = result.hits;
        target = 1;
        hit = result.hits >= 1;
      }

      if (boardType === "TB") {
        const tbTarget = parseTbTarget(row);
        actual = result.total_bases;
        target = tbTarget;
        hit = result.total_bases >= tbTarget;
      }
    }

    const unitsRisked = status === "GRADED" ? 1 : 0;
    const profit = status !== "GRADED"
      ? 0
      : hit
        ? profitForOneUnit(odds)
        : -1;

    graded.push({
      date: DATE,
      board: boardType,
      status,
      result: status === "GRADED" ? (hit ? "WIN" : "LOSS") : "NO RESULT",
      name,
      team: getField(row, ["team", "player_team"]),
      opponent: getField(row, ["opponent", "opp"]),
      pitcher: getField(row, ["pitcher", "probable_pitcher", "opposing_pitcher"]),
      tier: getField(row, ["tier", "bucket"]),
      rank: getField(row, ["rank"]),
      score: getField(row, ["score", "model_score", "hr_score"]),
      odds: odds || "",
      target,
      actual,
      hits: result?.hits ?? "",
      total_bases: result?.total_bases ?? "",
      home_runs: result?.home_runs ?? "",
      at_bats: result?.at_bats ?? "",
      units_risked: unitsRisked.toFixed(2),
      profit_units: profit.toFixed(2)
    });
  }

  return graded;
}

function summarize(rows) {
  const groups = {};

  for (const row of rows) {
    if (row.status !== "GRADED") continue;

    const key = `${row.board} | ${row.tier || "NO TIER"}`;

    if (!groups[key]) {
      groups[key] = {
        board: row.board,
        tier: row.tier || "NO TIER",
        plays: 0,
        wins: 0,
        losses: 0,
        risked: 0,
        profit: 0
      };
    }

    groups[key].plays++;
    if (row.result === "WIN") groups[key].wins++;
    if (row.result === "LOSS") groups[key].losses++;
    groups[key].risked += Number(row.units_risked || 0);
    groups[key].profit += Number(row.profit_units || 0);
  }

  return Object.values(groups).map(g => ({
    ...g,
    hit_rate: g.plays ? `${((g.wins / g.plays) * 100).toFixed(1)}%` : "0.0%",
    roi: g.risked ? `${((g.profit / g.risked) * 100).toFixed(1)}%` : "0.0%",
    profit_units: g.profit.toFixed(2)
  }));
}

function summaryText(summaryRows, allRows) {
  const graded = allRows.filter(r => r.status === "GRADED");
  const wins = graded.filter(r => r.result === "WIN").length;
  const risked = graded.reduce((sum, r) => sum + Number(r.units_risked || 0), 0);
  const profit = graded.reduce((sum, r) => sum + Number(r.profit_units || 0), 0);

  const lines = [];

  lines.push(`THE SLIP LAB RESULTS SUMMARY`);
  lines.push(`Date: ${DATE}`);
  lines.push("");
  lines.push(`Total graded plays: ${graded.length}`);
  lines.push(`Wins: ${wins}`);
  lines.push(`Losses: ${graded.length - wins}`);
  lines.push(`Hit rate: ${graded.length ? ((wins / graded.length) * 100).toFixed(1) : "0.0"}%`);
  lines.push(`Units risked: ${risked.toFixed(2)}`);
  lines.push(`Profit units: ${profit.toFixed(2)}`);
  lines.push(`ROI: ${risked ? ((profit / risked) * 100).toFixed(1) : "0.0"}%`);
  lines.push("");
  lines.push("Breakdown:");

  for (const row of summaryRows) {
    lines.push(`${row.board} | ${row.tier}: ${row.wins}/${row.plays} | ${row.hit_rate} | ROI ${row.roi} | ${row.profit_units}u`);
  }

  return lines.join("\n");
}

async function main() {
  ensureDir(OUT_DIR);

  const archiveFolder = findLatestArchiveFolder();

  if (!archiveFolder) {
    console.error(`No archive folder found for ${DATE}`);
    console.error(`Expected: ${HISTORY_ROOT}`);
    process.exit(1);
  }

  const hrFile = findFirstExisting(archiveFolder, [
    "exports/hr_board.csv",
    "data/hr_board.csv",
    "hr_board.csv"
  ]);

  const hitsFile = findFirstExisting(archiveFolder, [
    "exports/hits_board.csv",
    "data/hits_board.csv",
    "hits_board.csv"
  ]);

  const tbFile = findFirstExisting(archiveFolder, [
    "exports/tb_board.csv",
    "data/tb_board.csv",
    "tb_board.csv"
  ]);

  console.log("");
  console.log("THE SLIP LAB RESULTS GRADER");
  console.log("Date:", DATE);
  console.log("Archive:", archiveFolder);

  const playerResults = await getMlbPlayerResults();

  console.log("MLB player results loaded:", playerResults.size);

  const allGraded = [];

  if (hrFile) {
    const rows = readCsvSafe(hrFile);
    allGraded.push(...gradeBoard(rows, "HR", playerResults));
    console.log("HR rows graded:", rows.length);
  } else {
    console.log("HR board not found");
  }

  if (hitsFile) {
    const rows = readCsvSafe(hitsFile);
    allGraded.push(...gradeBoard(rows, "HITS", playerResults));
    console.log("Hits rows graded:", rows.length);
  } else {
    console.log("Hits board not found");
  }

  if (tbFile) {
    const rows = readCsvSafe(tbFile);
    allGraded.push(...gradeBoard(rows, "TB", playerResults));
    console.log("TB rows graded:", rows.length);
  } else {
    console.log("TB board not found");
  }

  const summaryRows = summarize(allGraded);

  fs.writeFileSync(OUT_CSV, toCsv(allGraded));
  fs.writeFileSync(OUT_JSON, JSON.stringify({ date: DATE, rows: allGraded, summary: summaryRows }, null, 2));
  fs.writeFileSync(OUT_SUMMARY, summaryText(summaryRows, allGraded));

  console.log("");
  console.log("RESULTS GRADING COMPLETE");
  console.log("Rows:", allGraded.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);
  console.log("Saved:", OUT_SUMMARY);
}

main().catch(err => {
  console.error("");
  console.error("RESULTS GRADER FAILED");
  console.error(err.message);
  process.exit(1);
});
