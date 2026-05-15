import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

const TODAY = process.env.SLATE_DATE || new Date().toISOString().slice(0, 10);
const SEASON = Number(process.env.MLB_SEASON || new Date(TODAY).getFullYear());
const LOOKBACK_DAYS = Number(process.env.BULLPEN_USAGE_DAYS || 3);

const OUT_CSV = path.join(DATA_DIR, "bullpen_usage.csv");
const OUT_JSON = path.join(DATA_DIR, "bullpen_usage.json");

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

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
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

function initTeam(team) {
  return {
    date: TODAY,
    season: SEASON,
    team_id: team.id,
    team: team.name,
    abbreviation: team.abbreviation,
    bullpen_games_last_3: 0,
    bullpen_pitchers_used: 0,
    bullpen_total_pitches: 0,
    bullpen_total_outs: 0,
    bullpen_innings: 0,
    relievers_20_plus_pitches: 0,
    relievers_25_plus_pitches: 0,
    relievers_30_plus_pitches: 0,
    relievers_back_to_back: 0,
    relievers_used_multiple_times: 0,
    high_usage_relievers: "",
    fatigue_score: 0,
    fatigue_grade: "UNKNOWN"
  };
}

function fatigueGrade(score) {
  if (score >= 78) return "EXHAUSTED";
  if (score >= 64) return "TIRED";
  if (score >= 50) return "WATCH";
  if (score >= 36) return "NORMAL";
  return "FRESH";
}

async function main() {
  ensureDir(DATA_DIR);

  const start = ymd(addDays(new Date(TODAY), -LOOKBACK_DAYS));
  const end = ymd(addDays(new Date(TODAY), -1));

  console.log("");
  console.log("THE SLIP LAB BULLPEN USAGE");
  console.log("Today:", TODAY);
  console.log("Season:", SEASON);
  console.log("Usage window:", start, "to", end);

  const teamJson = await getJson(`https://statsapi.mlb.com/api/v1/teams?sportId=1&season=${SEASON}`);
  const teams = teamJson.teams || [];

  const teamMap = new Map();

  for (const team of teams) {
    teamMap.set(team.id, initTeam(team));
  }

  const relieverUsage = new Map();

  for (let i = LOOKBACK_DAYS; i >= 1; i--) {
    const date = ymd(addDays(new Date(TODAY), -i));

    console.log("Checking:", date);

    const schedule = await getJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`);
    const games = schedule?.dates?.[0]?.games || [];

    for (const game of games) {
      const box = await getJson(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`);

      for (const side of ["home", "away"]) {
        const team = box?.teams?.[side]?.team;
        const players = box?.teams?.[side]?.players || {};
        const teamRow = teamMap.get(team?.id);

        if (!teamRow) continue;

        let bullpenUsedThisGame = false;

        for (const key of Object.keys(players)) {
          const player = players[key];
          const pitching = player?.stats?.pitching;

          if (!pitching) continue;

          const gamesStarted = num(pitching.gamesStarted, 0);
          const pitchesThrown = num(pitching.pitchesThrown, 0);
          const outs = num(pitching.outs, 0);

          if (pitchesThrown <= 0) continue;
          if (gamesStarted > 0) continue;

          bullpenUsedThisGame = true;

          const relieverName = player?.person?.fullName || "";
          const relieverKey = `${team.id}|${relieverName}`;

          if (!relieverUsage.has(relieverKey)) {
            relieverUsage.set(relieverKey, {
              team_id: team.id,
              team: team.name,
              name: relieverName,
              appearances: 0,
              total_pitches: 0,
              total_outs: 0,
              dates: []
            });
          }

          const usage = relieverUsage.get(relieverKey);
          usage.appearances++;
          usage.total_pitches += pitchesThrown;
          usage.total_outs += outs;
          usage.dates.push(date);

          teamRow.bullpen_pitchers_used++;
          teamRow.bullpen_total_pitches += pitchesThrown;
          teamRow.bullpen_total_outs += outs;

          if (pitchesThrown >= 20) teamRow.relievers_20_plus_pitches++;
          if (pitchesThrown >= 25) teamRow.relievers_25_plus_pitches++;
          if (pitchesThrown >= 30) teamRow.relievers_30_plus_pitches++;
        }

        if (bullpenUsedThisGame) teamRow.bullpen_games_last_3++;
      }
    }
  }

  for (const usage of relieverUsage.values()) {
    const teamRow = teamMap.get(usage.team_id);
    if (!teamRow) continue;

    if (usage.appearances >= 2) {
      teamRow.relievers_used_multiple_times++;
    }

    const uniqueDates = [...new Set(usage.dates)].sort();

    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        teamRow.relievers_back_to_back++;
        break;
      }
    }
  }

  const highUsageByTeam = new Map();

  for (const usage of relieverUsage.values()) {
    if (usage.total_pitches >= 35 || usage.appearances >= 2) {
      if (!highUsageByTeam.has(usage.team_id)) highUsageByTeam.set(usage.team_id, []);
      highUsageByTeam.get(usage.team_id).push(
        `${usage.name} ${usage.total_pitches} pitches ${usage.appearances} app`
      );
    }
  }

  const rows = [];

  for (const teamRow of teamMap.values()) {
    teamRow.bullpen_innings = (teamRow.bullpen_total_outs / 3).toFixed(1);

    const pitches = teamRow.bullpen_total_pitches;
    const innings = teamRow.bullpen_total_outs / 3;
    const used = teamRow.bullpen_pitchers_used;
    const games = teamRow.bullpen_games_last_3;

    const fatigueScore =
      30 +
      (pitches - 120) * 0.16 +
      (innings - 8) * 2.0 +
      (used - 7) * 2.0 +
      (games - 2) * 4.0 +
      teamRow.relievers_20_plus_pitches * 2.0 +
      teamRow.relievers_25_plus_pitches * 2.5 +
      teamRow.relievers_30_plus_pitches * 3.5 +
      teamRow.relievers_back_to_back * 4.0 +
      teamRow.relievers_used_multiple_times * 2.5;

    teamRow.fatigue_score = clamp(fatigueScore, 12, 95).toFixed(2);
    teamRow.fatigue_grade = fatigueGrade(Number(teamRow.fatigue_score));
    teamRow.high_usage_relievers = (highUsageByTeam.get(teamRow.team_id) || []).slice(0, 10).join(" | ");

    rows.push(teamRow);
  }

  rows.sort((a, b) => Number(b.fatigue_score) - Number(a.fatigue_score));

  fs.writeFileSync(OUT_CSV, toCsv(rows));
  fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2));

  console.log("");
  console.log("BULLPEN USAGE COMPLETE");
  console.log("Rows:", rows.length);
  console.log("Saved:", OUT_CSV);
  console.log("Saved:", OUT_JSON);

  console.table(
    rows.slice(0, 15).map(row => ({
      team: row.team,
      pitches: row.bullpen_total_pitches,
      innings: row.bullpen_innings,
      used: row.bullpen_pitchers_used,
      b2b: row.relievers_back_to_back,
      score: row.fatigue_score,
      grade: row.fatigue_grade
    }))
  );
}

main().catch(err => {
  console.error("");
  console.error("BULLPEN USAGE FAILED");
  console.error(err.message);
  process.exit(1);
});
