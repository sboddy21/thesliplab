import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const SEASON = Number(process.env.MLB_SEASON || new Date().getFullYear());
const OUT_CSV = path.join(DATA_DIR, "bullpen_stats.csv");
const OUT_JSON = path.join(DATA_DIR, "bullpen_stats.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 TheSlipLab/1.0" }
  });

  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function getTeams() {
  const url = `https://statsapi.mlb.com/api/v1/teams?sportId=1&season=${SEASON}`;
  const json = await getJson(url);
  return json.teams || [];
}

async function getTeamPitchingStats(teamId) {
  const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching&season=${SEASON}`;
  const json = await getJson(url);
  return json?.stats?.[0]?.splits?.[0]?.stat || {};
}

function parseInnings(ip = "0") {
  const text = String(ip);
  const [whole, partial] = text.split(".");
  const outs = Number(partial || 0);
  return Number(whole || 0) + outs / 3;
}

function buildBullpenScore({ era, whip, hrPer9, bbPer9, kPer9, hitsPer9 }) {
  const score =
    50 +
    (era - 4.10) * 7.0 +
    (whip - 1.30) * 22 +
    (hrPer9 - 1.05) * 18 +
    (bbPer9 - 3.30) * 3.2 +
    (hitsPer9 - 8.40) * 2.0 -
    (kPer9 - 8.60) * 2.4;

  return clamp(score, 15, 95);
}

function grade(score) {
  if (score >= 78) return "ATTACK";
  if (score >= 64) return "LIVE";
  if (score >= 48) return "NEUTRAL";
  if (score >= 35) return "RESPECT";
  return "AVOID";
}

async function main() {
  ensureDir(DATA_DIR);

  console.log("");
  console.log("THE SLIP LAB BULLPEN STATS");
  console.log("Season:", SEASON);

  const teams = await getTeams();
  const rows = [];

  for (const team of teams) {
    const stat = await getTeamPitchingStats(team.id);

    const innings = parseInnings(stat.inningsPitched || "0");
    const hr = num(stat.homeRuns, 0);
    const walks = num(stat.baseOnBalls, 0);
    const strikeouts = num(stat.strikeOuts, 0);
    const hits = num(stat.hits, 0);
    const runs = num(stat.runs, 0);
    const era = num(stat.era, 4.10);
    const whip = num(stat.whip, 1.30);

    const hrPer9 = innings ? (hr / innings) * 9 : 1.05;
    const bbPer9 = innings ? (walks / innings) * 9 : 3.30;
    const kPer9 = innings ? (strikeouts / innings) * 9 : 8.60;
    const hitsPer9 = innings ? (hits / innings) * 9 : 8.40;
    const runsPer9 = innings ? (runs / innings) * 9 : 4.40;

    const attackScore = buildBullpenScore({
      era,
      whip,
      hrPer9,
      bbPer9,
      kPer9,
      hitsPer9
    });

    rows.push({
      season: SEASON,
      team_id: team.id,
      team: team.name,
      abbreviation: team.abbreviation,
      league: team.league?.name || "",
      division: team.division?.name || "",
      innings_pitched: stat.inningsPitched || "",
      era: era.toFixed(2),
      whip: whip.toFixed(2),
      hits,
      runs,
      earned_runs: stat.earnedRuns || "",
      home_runs: hr,
      walks,
      strikeouts,
      hr_per_9: hrPer9.toFixed(2),
      bb_per_9: bbPer9.toFixed(2),
      k_per_9: kPer9.toFixed(2),
      hits_per_9: hitsPer9.toFixed(2),
      runs_per_9: runsPer9.toFixed(2),
      bullpen_attack_score: attackScore.toFixed(2),
      bullpen_quality_grade: grade(attackScore)
    });
  }

  rows.sort((a, b) => Number(b.bullpen_attack_score) - Number(a.bullpen_attack_score));

  fs.writeFileSync(OUT_CSV, toCsv(rows));
  fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2));

  console.log("");
  console.log("BULLPEN STATS COMPLETE");
  console.log("Rows:", rows.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);

  console.table(
    rows.slice(0, 15).map(row => ({
      team: row.team,
      era: row.era,
      whip: row.whip,
      hr9: row.hr_per_9,
      score: row.bullpen_attack_score,
      grade: row.bullpen_quality_grade
    }))
  );
}

main().catch(err => {
  console.error("");
  console.error("BULLPEN STATS FAILED");
  console.error(err.message);
  process.exit(1);
});
