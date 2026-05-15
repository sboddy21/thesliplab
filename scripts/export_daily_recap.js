import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const ARG_DATE = process.argv[2];
const DATE = ARG_DATE || new Date().toISOString().slice(0, 10);

const RESULTS_DIR = path.join(ROOT, "exports", "results");
const CLV_DIR = path.join(ROOT, "exports", "clv");
const OUT_DIR = path.join(ROOT, "exports", "recaps");

const GRADED_CSV = path.join(RESULTS_DIR, `graded_results_${DATE}.csv`);
const CLV_CSV = path.join(CLV_DIR, `clv_report_${DATE}.csv`);

const OUT_TXT = path.join(OUT_DIR, `daily_recap_${DATE}.txt`);
const OUT_X = path.join(OUT_DIR, `x_daily_recap_${DATE}.txt`);
const OUT_DISCORD = path.join(OUT_DIR, `discord_daily_recap_${DATE}.txt`);
const OUT_CSV = path.join(OUT_DIR, `daily_recap_summary_${DATE}.csv`);
const OUT_JSON = path.join(OUT_DIR, `daily_recap_${DATE}.json`);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function pct(value) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function units(value) {
  if (!Number.isFinite(value)) return "0.00u";
  return `${value.toFixed(2)}u`;
}

function moneyOdds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n > 0 ? `+${n}` : `${n}`;
}

function groupBy(rows, keyFn) {
  const map = new Map();

  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  return map;
}

function summarizeResults(rows) {
  const graded = rows.filter(row => row.status === "GRADED");

  const wins = graded.filter(row => row.result === "WIN");
  const losses = graded.filter(row => row.result === "LOSS");

  const risked = graded.reduce((sum, row) => sum + Number(row.units_risked || 0), 0);
  const profit = graded.reduce((sum, row) => sum + Number(row.profit_units || 0), 0);

  const byBoard = [];

  for (const [board, boardRows] of groupBy(graded, row => row.board || "UNKNOWN")) {
    const boardWins = boardRows.filter(row => row.result === "WIN");
    const boardRisked = boardRows.reduce((sum, row) => sum + Number(row.units_risked || 0), 0);
    const boardProfit = boardRows.reduce((sum, row) => sum + Number(row.profit_units || 0), 0);

    byBoard.push({
      board,
      plays: boardRows.length,
      wins: boardWins.length,
      losses: boardRows.length - boardWins.length,
      hit_rate: boardRows.length ? boardWins.length / boardRows.length : 0,
      risked: boardRisked,
      profit: boardProfit,
      roi: boardRisked ? boardProfit / boardRisked : 0
    });
  }

  byBoard.sort((a, b) => b.profit - a.profit);

  const byTier = [];

  for (const [key, tierRows] of groupBy(graded, row => `${row.board || "UNKNOWN"} | ${row.tier || "NO TIER"}`)) {
    const tierWins = tierRows.filter(row => row.result === "WIN");
    const tierRisked = tierRows.reduce((sum, row) => sum + Number(row.units_risked || 0), 0);
    const tierProfit = tierRows.reduce((sum, row) => sum + Number(row.profit_units || 0), 0);

    const [board, tier] = key.split(" | ");

    byTier.push({
      board,
      tier,
      plays: tierRows.length,
      wins: tierWins.length,
      losses: tierRows.length - tierWins.length,
      hit_rate: tierRows.length ? tierWins.length / tierRows.length : 0,
      risked: tierRisked,
      profit: tierProfit,
      roi: tierRisked ? tierProfit / tierRisked : 0
    });
  }

  byTier.sort((a, b) => b.profit - a.profit);

  const topWins = wins
    .map(row => ({
      board: row.board,
      name: row.name,
      team: row.team,
      tier: row.tier,
      odds: Number(row.odds || 0),
      profit: Number(row.profit_units || 0),
      actual: row.actual,
      target: row.target
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 8);

  const worstLosses = losses
    .map(row => ({
      board: row.board,
      name: row.name,
      team: row.team,
      tier: row.tier,
      odds: Number(row.odds || 0),
      score: Number(row.score || 0),
      actual: row.actual,
      target: row.target
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    total_plays: graded.length,
    wins: wins.length,
    losses: losses.length,
    hit_rate: graded.length ? wins.length / graded.length : 0,
    risked,
    profit,
    roi: risked ? profit / risked : 0,
    by_board: byBoard,
    by_tier: byTier,
    top_wins: topWins,
    worst_losses: worstLosses
  };
}

function summarizeClv(rows) {
  const graded = rows.filter(row => row.result && row.result !== "NO CLOSING LINE");

  const positive = graded.filter(row => row.result === "POSITIVE CLV");
  const negative = graded.filter(row => row.result === "NEGATIVE CLV");
  const flat = graded.filter(row => row.result === "FLAT");

  const avgClv = graded.length
    ? graded.reduce((sum, row) => sum + Number(row.clv_pct || 0), 0) / graded.length
    : 0;

  const topClv = graded
    .map(row => ({
      board: row.board,
      name: row.name,
      team: row.team,
      opening_odds: Number(row.opening_odds || 0),
      closing_odds: Number(row.closing_odds || 0),
      clv_pct: Number(row.clv_pct || 0)
    }))
    .sort((a, b) => b.clv_pct - a.clv_pct)
    .slice(0, 8);

  const byBoard = [];

  for (const [board, boardRows] of groupBy(graded, row => row.board || "UNKNOWN")) {
    const boardPositive = boardRows.filter(row => row.result === "POSITIVE CLV");
    const boardAvg = boardRows.length
      ? boardRows.reduce((sum, row) => sum + Number(row.clv_pct || 0), 0) / boardRows.length
      : 0;

    byBoard.push({
      board,
      plays: boardRows.length,
      positive: boardPositive.length,
      positive_rate: boardRows.length ? boardPositive.length / boardRows.length : 0,
      avg_clv: boardAvg
    });
  }

  byBoard.sort((a, b) => b.avg_clv - a.avg_clv);

  return {
    total_with_closing_lines: graded.length,
    positive: positive.length,
    negative: negative.length,
    flat: flat.length,
    positive_rate: graded.length ? positive.length / graded.length : 0,
    avg_clv: avgClv,
    by_board: byBoard,
    top_clv: topClv
  };
}

function buildPlainRecap(resultSummary, clvSummary) {
  const lines = [];

  lines.push("THE SLIP LAB DAILY RECAP");
  lines.push(`Date: ${DATE}`);
  lines.push("");
  lines.push("RESULTS");
  lines.push(`Total graded plays: ${resultSummary.total_plays}`);
  lines.push(`Wins: ${resultSummary.wins}`);
  lines.push(`Losses: ${resultSummary.losses}`);
  lines.push(`Hit rate: ${pct(resultSummary.hit_rate * 100)}`);
  lines.push(`Profit: ${units(resultSummary.profit)}`);
  lines.push(`ROI: ${pct(resultSummary.roi * 100)}`);
  lines.push("");

  lines.push("BOARD BREAKDOWN");
  for (const row of resultSummary.by_board) {
    lines.push(`${row.board}: ${row.wins}/${row.plays} | ${pct(row.hit_rate * 100)} | ${units(row.profit)} | ROI ${pct(row.roi * 100)}`);
  }

  lines.push("");
  lines.push("TOP WINS");
  if (resultSummary.top_wins.length) {
    for (const row of resultSummary.top_wins) {
      lines.push(`${row.board}: ${row.name} ${moneyOdds(row.odds)} | ${units(row.profit)} | ${row.actual}/${row.target}`);
    }
  } else {
    lines.push("No winning plays found.");
  }

  lines.push("");
  lines.push("CLV");
  lines.push(`Tracked lines: ${clvSummary.total_with_closing_lines}`);
  lines.push(`Positive CLV: ${clvSummary.positive}`);
  lines.push(`Positive CLV rate: ${pct(clvSummary.positive_rate * 100)}`);
  lines.push(`Average CLV: ${pct(clvSummary.avg_clv)}`);

  lines.push("");
  lines.push("TOP CLV MOVES");
  if (clvSummary.top_clv.length) {
    for (const row of clvSummary.top_clv) {
      lines.push(`${row.board}: ${row.name} ${moneyOdds(row.opening_odds)} to ${moneyOdds(row.closing_odds)} | ${pct(row.clv_pct)}`);
    }
  } else {
    lines.push("No CLV rows found.");
  }

  return lines.join("\n");
}

function buildXPost(resultSummary, clvSummary) {
  const bestBoard = resultSummary.by_board[0];

  const topWin = resultSummary.top_wins[0];
  const topClv = clvSummary.top_clv[0];

  const lines = [];

  lines.push(`THE SLIP LAB DAILY RECAP`);
  lines.push(`${DATE}`);
  lines.push("");
  lines.push(`Tracked plays: ${resultSummary.total_plays}`);
  lines.push(`Record: ${resultSummary.wins}W ${resultSummary.losses}L`);
  lines.push(`ROI: ${pct(resultSummary.roi * 100)}`);
  lines.push(`Profit: ${units(resultSummary.profit)}`);

  if (bestBoard) {
    lines.push("");
    lines.push(`Best board: ${bestBoard.board}`);
    lines.push(`${bestBoard.wins}/${bestBoard.plays} hit | ${units(bestBoard.profit)}`);
  }

  if (topWin) {
    lines.push("");
    lines.push(`Best hit: ${topWin.name} ${moneyOdds(topWin.odds)}`);
  }

  if (clvSummary.total_with_closing_lines) {
    lines.push("");
    lines.push(`Positive CLV: ${pct(clvSummary.positive_rate * 100)}`);
    lines.push(`Avg CLV: ${pct(clvSummary.avg_clv)}`);
  }

  if (topClv) {
    lines.push(`Best CLV: ${topClv.name} ${moneyOdds(topClv.opening_odds)} to ${moneyOdds(topClv.closing_odds)}`);
  }

  lines.push("");
  lines.push("Tracked. Graded. No fake records.");

  return lines.join("\n");
}

function buildDiscordPost(resultSummary, clvSummary) {
  const lines = [];

  lines.push("**THE SLIP LAB DAILY RECAP**");
  lines.push(`**Date:** ${DATE}`);
  lines.push("");
  lines.push("**Results**");
  lines.push(`Plays: ${resultSummary.total_plays}`);
  lines.push(`Record: ${resultSummary.wins}W ${resultSummary.losses}L`);
  lines.push(`Hit Rate: ${pct(resultSummary.hit_rate * 100)}`);
  lines.push(`Profit: ${units(resultSummary.profit)}`);
  lines.push(`ROI: ${pct(resultSummary.roi * 100)}`);
  lines.push("");

  lines.push("**Board Breakdown**");
  for (const row of resultSummary.by_board.slice(0, 5)) {
    lines.push(`${row.board}: ${row.wins}/${row.plays} | ${pct(row.hit_rate * 100)} | ${units(row.profit)} | ROI ${pct(row.roi * 100)}`);
  }

  lines.push("");
  lines.push("**Top Wins**");
  if (resultSummary.top_wins.length) {
    for (const row of resultSummary.top_wins.slice(0, 5)) {
      lines.push(`${row.board}: ${row.name} ${moneyOdds(row.odds)} | ${units(row.profit)}`);
    }
  } else {
    lines.push("No winning plays found.");
  }

  lines.push("");
  lines.push("**CLV**");
  lines.push(`Positive CLV Rate: ${pct(clvSummary.positive_rate * 100)}`);
  lines.push(`Average CLV: ${pct(clvSummary.avg_clv)}`);

  if (clvSummary.top_clv.length) {
    lines.push("");
    lines.push("**Top CLV Moves**");
    for (const row of clvSummary.top_clv.slice(0, 5)) {
      lines.push(`${row.board}: ${row.name} ${moneyOdds(row.opening_odds)} to ${moneyOdds(row.closing_odds)} | ${pct(row.clv_pct)}`);
    }
  }

  return lines.join("\n");
}

function buildSummaryCsvRows(resultSummary, clvSummary) {
  const rows = [];

  rows.push({
    date: DATE,
    category: "OVERALL",
    board: "ALL",
    metric: "plays",
    value: resultSummary.total_plays
  });

  rows.push({
    date: DATE,
    category: "OVERALL",
    board: "ALL",
    metric: "record",
    value: `${resultSummary.wins}W ${resultSummary.losses}L`
  });

  rows.push({
    date: DATE,
    category: "OVERALL",
    board: "ALL",
    metric: "roi",
    value: pct(resultSummary.roi * 100)
  });

  rows.push({
    date: DATE,
    category: "OVERALL",
    board: "ALL",
    metric: "profit",
    value: units(resultSummary.profit)
  });

  rows.push({
    date: DATE,
    category: "CLV",
    board: "ALL",
    metric: "positive_clv_rate",
    value: pct(clvSummary.positive_rate * 100)
  });

  rows.push({
    date: DATE,
    category: "CLV",
    board: "ALL",
    metric: "average_clv",
    value: pct(clvSummary.avg_clv)
  });

  for (const row of resultSummary.by_board) {
    rows.push({
      date: DATE,
      category: "BOARD",
      board: row.board,
      metric: "summary",
      value: `${row.wins}/${row.plays} | ${pct(row.hit_rate * 100)} | ${units(row.profit)} | ROI ${pct(row.roi * 100)}`
    });
  }

  return rows;
}

function main() {
  ensureDir(OUT_DIR);

  if (!fs.existsSync(GRADED_CSV)) {
    console.error(`Missing graded results file: ${GRADED_CSV}`);
    console.error("Run this first:");
    console.error(`node scripts/grade_daily_results.js ${DATE}`);
    process.exit(1);
  }

  const resultRows = readCsvSafe(GRADED_CSV);
  const clvRows = readCsvSafe(CLV_CSV);

  const resultSummary = summarizeResults(resultRows);
  const clvSummary = summarizeClv(clvRows);

  const recapText = buildPlainRecap(resultSummary, clvSummary);
  const xPost = buildXPost(resultSummary, clvSummary);
  const discordPost = buildDiscordPost(resultSummary, clvSummary);
  const csvRows = buildSummaryCsvRows(resultSummary, clvSummary);

  const json = {
    date: DATE,
    results: resultSummary,
    clv: clvSummary
  };

  fs.writeFileSync(OUT_TXT, recapText);
  fs.writeFileSync(OUT_X, xPost);
  fs.writeFileSync(OUT_DISCORD, discordPost);
  fs.writeFileSync(OUT_CSV, toCsv(csvRows));
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2));

  console.log("");
  console.log("DAILY RECAP EXPORT COMPLETE");
  console.log("Date:", DATE);
  console.log("Saved:", OUT_TXT);
  console.log("Saved:", OUT_X);
  console.log("Saved:", OUT_DISCORD);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);
}

main();
