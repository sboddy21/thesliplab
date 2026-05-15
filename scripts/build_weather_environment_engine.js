import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const EXPORTS = path.join(ROOT, "exports");

const OUT_CSV = path.join(DATA, "weather_environment_engine.csv");
const OUT_JSON = path.join(DATA, "weather_environment_engine.json");
const OUT_EXPORT_CSV = path.join(EXPORTS, "weather_environment_engine.csv");
const OUT_EXPORT_JSON = path.join(EXPORTS, "weather_environment_engine.json");

function parse(line) {
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

function rows(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const headers = parse(lines[0]);

  return lines.slice(1).map(line => {
    const vals = parse(line);
    const row = {};
    headers.forEach((h, i) => row[h] = vals[i] || "");
    return row;
  });
}

function clean(v) {
  return String(v || "").trim();
}

function lower(v) {
  return clean(v).toLowerCase();
}

function num(v, fallback = 0) {
  const n = Number(String(v || "").replace(/[%,$+]/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function normName(v) {
  return lower(v)
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/’/g, "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function key(name, team = "") {
  return `${normName(name)}|${lower(team)}`;
}

function gameKey(game = "") {
  return lower(game)
    .replace(/\s+@\s+/g, " @ ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(v, min = 0, max = 99) {
  return Math.max(min, Math.min(max, v));
}

function round(v) {
  return Math.round(v * 10) / 10;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCSV(file, list) {
  if (!list.length) return;
  const headers = Object.keys(list[0]);
  const out = [
    headers.join(","),
    ...list.map(r => headers.map(h => csvEscape(r[h])).join(","))
  ];
  fs.writeFileSync(file, out.join("\n"));
}

function grade(score) {
  if (score >= 82) return "LAUNCH";
  if (score >= 70) return "BOOST";
  if (score >= 55) return "NEUTRAL";
  if (score >= 45) return "SUPPRESS";
  return "DEAD AIR";
}

function tempScore(temp) {
  if (!temp) return 50;

  let score = 50;

  if (temp >= 90) score += 18;
  else if (temp >= 82) score += 14;
  else if (temp >= 75) score += 9;
  else if (temp >= 68) score += 4;
  else if (temp >= 58) score += 0;
  else if (temp >= 48) score -= 6;
  else score -= 12;

  return clamp(score);
}

function windScore({ wind, windDeg, parkNote, weatherDesc }) {
  let score = 50;
  const note = lower(`${parkNote} ${weatherDesc}`);

  if (!wind) return score;

  if (
    note.includes("out") ||
    note.includes("blowing out") ||
    note.includes("to center") ||
    note.includes("to left") ||
    note.includes("to right")
  ) {
    score += Math.min(22, wind * 1.35);
  } else if (
    note.includes("in") ||
    note.includes("blowing in")
  ) {
    score -= Math.min(18, wind * 1.15);
  } else if (
    note.includes("cross") ||
    note.includes("left to right") ||
    note.includes("right to left")
  ) {
    score += Math.min(8, wind * 0.35);
  } else {
    if (wind >= 14) score += 4;
    else if (wind >= 9) score += 2;
  }

  if (windDeg >= 0) {
    if (wind >= 12) score += 2;
  }

  return clamp(score);
}

function roofAdjustment(venue, weatherDesc) {
  const text = lower(`${venue} ${weatherDesc}`);

  const domeParks = [
    "rogers centre",
    "tropicana",
    "minute maid",
    "loanDepot",
    "loandepot",
    "chase field",
    "globe life",
    "american family"
  ];

  if (domeParks.some(p => text.includes(lower(p)))) {
    return {
      roof: "DOME_OR_RETRACTABLE",
      adjustment: -4
    };
  }

  if (text.includes("roof closed")) {
    return {
      roof: "ROOF_CLOSED",
      adjustment: -6
    };
  }

  if (text.includes("roof open")) {
    return {
      roof: "ROOF_OPEN",
      adjustment: 2
    };
  }

  return {
    roof: "OPEN_AIR_OR_UNKNOWN",
    adjustment: 0
  };
}

function parkScore(row) {
  const hrPark = num(row.hr_park_score);
  const parkScore = num(row.park_score) || num(row.parkScore) || num(row.park_score_model);

  let score = 50;

  if (hrPark > 0) score += clamp((hrPark - 50) * 0.28, -12, 14);
  if (parkScore > 0) score += clamp((parkScore - 50) * 0.18, -8, 10);

  return clamp(score);
}

function vegasScore(total, boost) {
  let score = 50;

  if (total >= 11) score += 16;
  else if (total >= 10) score += 12;
  else if (total >= 9) score += 7;
  else if (total >= 8) score += 3;
  else if (total <= 7) score -= 7;

  score += clamp(boost, -6, 10);

  return clamp(score);
}

function finalEnvironmentScore({ temp, wind, park, vegas, roof, rawWeatherBoost }) {
  let score =
    temp * 0.26 +
    wind * 0.24 +
    park * 0.22 +
    vegas * 0.18 +
    50 * 0.10;

  score += roof.adjustment;
  score += clamp(rawWeatherBoost, -8, 10);

  return round(clamp(score));
}

function main() {
  fs.mkdirSync(EXPORTS, { recursive: true });

  const finalRows = rows(path.join(DATA, "final_hr_decision_engine.csv"));
  const playerRows = rows(path.join(DATA, "player_stats.csv"));
  const weatherRows = rows(path.join(DATA, "weather.csv"));
  const weatherBoostRows = rows(path.join(DATA, "weather_boost.csv"));
  const vegasRows = rows(path.join(DATA, "vegas_totals.csv"));

  const playerMap = new Map(playerRows.map(r => [key(r.name, r.team), r]));
  const weatherByGame = new Map();
  const vegasByGame = new Map();

  for (const r of [...weatherRows, ...weatherBoostRows]) {
    const g = clean(r.game || r.matchup || r.raw_game);
    if (g) weatherByGame.set(gameKey(g), r);
  }

  for (const r of vegasRows) {
    if (r.game) vegasByGame.set(gameKey(r.game), r);
  }

  const out = [];

  for (const row of finalRows) {
    const name = clean(row.name);
    const team = clean(row.team);
    const g = clean(row.game);
    const k = key(name, team);

    const ps = playerMap.get(k) || {};
    const wx = weatherByGame.get(gameKey(g)) || {};
    const vg = vegasByGame.get(gameKey(g)) || {};

    const temp = num(ps.weather_temp) || num(wx.temp) || num(wx.temperature) || num(wx.weather_temp);
    const wind = num(ps.weather_wind) || num(wx.wind) || num(wx.wind_speed) || num(wx.weather_wind);
    const windDeg = num(ps.weather_wind_deg) || num(wx.wind_deg) || num(wx.weather_wind_deg);
    const weatherDesc = clean(ps.weather_desc || wx.description || wx.weather_desc || wx.conditions);
    const venue = clean(ps.venue || ps.ballpark || ps.park || row.venue);
    const parkNote = clean(ps.park_note || wx.park_note || wx.note);

    const vegasTotal = num(ps.vegas_game_total) || num(row.vegas_total) || num(vg.vegas_total);
    const vegasBoost = num(ps.vegas_total_boost);
    const rawWeatherBoost = num(ps.weather_boost);

    const temp_component = tempScore(temp);
    const wind_component = windScore({
      wind,
      windDeg,
      parkNote,
      weatherDesc
    });
    const park_component = parkScore(ps);
    const vegas_component = vegasScore(vegasTotal, vegasBoost);
    const roof = roofAdjustment(venue, weatherDesc);

    const environment = finalEnvironmentScore({
      temp: temp_component,
      wind: wind_component,
      park: park_component,
      vegas: vegas_component,
      roof,
      rawWeatherBoost
    });

    out.push({
      rank: 0,
      name,
      team,
      opponent: row.opponent,
      game: g,
      pitcher: row.pitcher,
      odds: row.odds,
      final_hr_score: row.final_hr_score,
      decision_tier: row.decision_tier,
      temperature: temp,
      wind_speed: wind,
      wind_direction: windDeg,
      weather_desc: weatherDesc,
      venue,
      roof_status: roof.roof,
      vegas_total: vegasTotal,
      temp_score: round(temp_component),
      wind_score: round(wind_component),
      park_score: round(park_component),
      vegas_score: round(vegas_component),
      raw_weather_boost: round(rawWeatherBoost),
      weather_environment_score: environment,
      weather_environment_grade: grade(environment),
      note:
        environment >= 82
          ? "Premium HR weather environment"
          : environment >= 70
          ? "Weather supports carry"
          : environment >= 55
          ? "Neutral environment"
          : environment >= 45
          ? "Weather slightly suppresses power"
          : "Dead air HR environment"
    });
  }

  out.sort((a, b) => {
    if (b.weather_environment_score !== a.weather_environment_score) {
      return b.weather_environment_score - a.weather_environment_score;
    }
    return num(b.final_hr_score) - num(a.final_hr_score);
  });

  out.forEach((r, i) => r.rank = i + 1);

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_EXPORT_JSON, JSON.stringify(out, null, 2));
  writeCSV(OUT_CSV, out);
  writeCSV(OUT_EXPORT_CSV, out);

  const spread = {};
  for (const r of out) spread[r.weather_environment_grade] = (spread[r.weather_environment_grade] || 0) + 1;

  console.log("");
  console.log("THE SLIP LAB WEATHER ENVIRONMENT ENGINE COMPLETE");
  console.log(`Rows: ${out.length}`);
  console.log(`Saved: ${OUT_CSV}`);
  console.log(`Saved: ${OUT_JSON}`);
  console.log("Grade spread:", spread);
  console.log("");

  console.table(out.slice(0, 20).map(r => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    game: r.game,
    temp: r.temperature,
    wind: r.wind_speed,
    total: r.vegas_total,
    env: r.weather_environment_score,
    grade: r.weather_environment_grade
  })));
}

main();
