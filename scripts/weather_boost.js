import fs from "fs";
import path from "path";
import "dotenv/config";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");

const PLAYER_FILE = path.join(DATA, "player_stats.csv");
const WEATHER_FILE = path.join(DATA, "weather.csv");
const WEATHER_JSON = path.join(DATA, "weather.json");

const API_KEY =
  process.env.OPENWEATHER_API_KEY ||
  process.env.OPENWEATHER_KEY ||
  process.env.OPENWEATHERMAP_API_KEY ||
  process.env.WEATHER_API_KEY ||
  "";

const TEAM_STADIUMS = {
  "Arizona Diamondbacks": { park: "Chase Field", city: "Phoenix", lat: 33.4455, lon: -112.0667, roof: true },
  "Atlanta Braves": { park: "Truist Park", city: "Atlanta", lat: 33.8907, lon: -84.4677, roof: false },
  "Baltimore Orioles": { park: "Camden Yards", city: "Baltimore", lat: 39.2839, lon: -76.6217, roof: false },
  "Boston Red Sox": { park: "Fenway Park", city: "Boston", lat: 42.3467, lon: -71.0972, roof: false },
  "Chicago Cubs": { park: "Wrigley Field", city: "Chicago", lat: 41.9484, lon: -87.6553, roof: false },
  "Chicago White Sox": { park: "Guaranteed Rate Field", city: "Chicago", lat: 41.83, lon: -87.6339, roof: false },
  "Cincinnati Reds": { park: "Great American Ball Park", city: "Cincinnati", lat: 39.0979, lon: -84.5082, roof: false },
  "Cleveland Guardians": { park: "Progressive Field", city: "Cleveland", lat: 41.4962, lon: -81.6852, roof: false },
  "Colorado Rockies": { park: "Coors Field", city: "Denver", lat: 39.7559, lon: -104.9942, roof: false },
  "Detroit Tigers": { park: "Comerica Park", city: "Detroit", lat: 42.339, lon: -83.0485, roof: false },
  "Houston Astros": { park: "Daikin Park", city: "Houston", lat: 29.7573, lon: -95.3555, roof: true },
  "Kansas City Royals": { park: "Kauffman Stadium", city: "Kansas City", lat: 39.0517, lon: -94.4803, roof: false },
  "Los Angeles Angels": { park: "Angel Stadium", city: "Anaheim", lat: 33.8003, lon: -117.8827, roof: false },
  "Los Angeles Dodgers": { park: "Dodger Stadium", city: "Los Angeles", lat: 34.0739, lon: -118.24, roof: false },
  "Miami Marlins": { park: "LoanDepot Park", city: "Miami", lat: 25.7781, lon: -80.2197, roof: true },
  "Milwaukee Brewers": { park: "American Family Field", city: "Milwaukee", lat: 43.028, lon: -87.9712, roof: true },
  "Minnesota Twins": { park: "Target Field", city: "Minneapolis", lat: 44.9817, lon: -93.2776, roof: false },
  "New York Mets": { park: "Citi Field", city: "New York", lat: 40.7571, lon: -73.8458, roof: false },
  "New York Yankees": { park: "Yankee Stadium", city: "New York", lat: 40.8296, lon: -73.9262, roof: false },
  "Athletics": { park: "Sutter Health Park", city: "Sacramento", lat: 38.5804, lon: -121.513, roof: false },
  "Philadelphia Phillies": { park: "Citizens Bank Park", city: "Philadelphia", lat: 39.9061, lon: -75.1665, roof: false },
  "Pittsburgh Pirates": { park: "PNC Park", city: "Pittsburgh", lat: 40.4469, lon: -80.0057, roof: false },
  "San Diego Padres": { park: "Petco Park", city: "San Diego", lat: 32.7073, lon: -117.1566, roof: false },
  "Seattle Mariners": { park: "T-Mobile Park", city: "Seattle", lat: 47.5914, lon: -122.3325, roof: true },
  "San Francisco Giants": { park: "Oracle Park", city: "San Francisco", lat: 37.7786, lon: -122.3893, roof: false },
  "St. Louis Cardinals": { park: "Busch Stadium", city: "St. Louis", lat: 38.6226, lon: -90.1928, roof: false },
  "Tampa Bay Rays": { park: "George M. Steinbrenner Field", city: "Tampa", lat: 27.9799, lon: -82.5067, roof: false },
  "Texas Rangers": { park: "Globe Life Field", city: "Arlington", lat: 32.7473, lon: -97.0842, roof: true },
  "Toronto Blue Jays": { park: "Rogers Centre", city: "Toronto", lat: 43.6414, lon: -79.3894, roof: true },
  "Washington Nationals": { park: "Nationals Park", city: "Washington", lat: 38.873, lon: -77.0074, roof: false }
};

function splitCSV(line) {
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

function readCSV(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = splitCSV(lines[0]);

  return lines.slice(1).map(line => {
    const vals = splitCSV(line);
    const row = {};
    headers.forEach((h, i) => row[h] = vals[i] || "");
    return row;
  });
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCSV(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(file, "");
    return;
  }

  const headers = [];
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!headers.includes(k)) headers.push(k);
    }
  }

  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))
  ];

  fs.writeFileSync(file, lines.join("\n") + "\n");
}

function clean(v) {
  return String(v || "").trim();
}

function num(v, fallback = 0) {
  const n = Number(String(v || "").replace(/[%,$+]/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function normalizeGame(game = "") {
  return clean(game)
    .toLowerCase()
    .replace(/\s+@\s+/g, " @ ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGame(game = "") {
  const parts = clean(game).split(/\s+@\s+/);
  if (parts.length !== 2) return null;

  return {
    away: clean(parts[0]),
    home: clean(parts[1])
  };
}

function windText(speed, deg) {
  if (!speed) return "Calm";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round((deg % 360) / 22.5) % 16;
  return `${Math.round(speed)} MPH Wind ${dirs[index]}`;
}

function roofLabel(stadium) {
  if (!stadium?.roof) return "OPEN_AIR";
  return "ROOF_OR_RETRACTABLE";
}

function weatherBoost({ temp, humidity, wind, roof }) {
  let boost = 0;

  if (roof) {
    return {
      boost: 0,
      label: "Roof controlled"
    };
  }

  if (temp >= 88) boost += 5;
  else if (temp >= 80) boost += 4;
  else if (temp >= 72) boost += 2;
  else if (temp < 55) boost -= 2;
  else if (temp < 45) boost -= 4;

  if (humidity >= 65 && temp >= 70) boost += 1;
  if (humidity <= 30) boost -= 1;

  if (wind >= 15) boost += 3;
  else if (wind >= 10) boost += 2;
  else if (wind >= 6) boost += 1;

  let label = "Neutral";

  if (boost >= 7) label = "Major HR boost";
  else if (boost >= 4) label = "HR boost";
  else if (boost >= 1) label = "Mild boost";
  else if (boost <= -3) label = "Weather suppress";
  else if (boost < 0) label = "Mild suppress";

  return {
    boost,
    label
  };
}

async function fetchWeather(stadium) {
  const url =
    "https://api.openweathermap.org/data/2.5/weather" +
    `?lat=${stadium.lat}` +
    `&lon=${stadium.lon}` +
    "&units=imperial" +
    `&appid=${API_KEY}`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }

  return await res.json();
}

async function main() {
  const started = Date.now();

  if (!API_KEY) {
    console.error("Missing OPENWEATHER_API_KEY in .env");
    process.exit(1);
  }

  if (!fs.existsSync(PLAYER_FILE)) {
    console.error(`Missing player file: ${PLAYER_FILE}`);
    process.exit(1);
  }

  const players = readCSV(PLAYER_FILE);
  const games = new Map();

  for (const row of players) {
    const game = clean(row.game);
    const parsed = parseGame(game);
    if (!parsed) continue;

    const stadium = TEAM_STADIUMS[parsed.home];
    if (!stadium) continue;

    games.set(normalizeGame(game), {
      game,
      home_team: parsed.home,
      away_team: parsed.away,
      stadium
    });
  }

  const weatherRows = [];

  for (const item of games.values()) {
    const { game, home_team, away_team, stadium } = item;

    let temp = 0;
    let humidity = 0;
    let wind = 0;
    let windDeg = 0;
    let desc = "";

    try {
      const data = await fetchWeather(stadium);
      temp = num(data?.main?.temp);
      humidity = num(data?.main?.humidity);
      wind = num(data?.wind?.speed);
      windDeg = num(data?.wind?.deg);
      desc = clean(data?.weather?.[0]?.description);
    } catch (err) {
      console.log(`Weather fetch failed for ${game}: ${err.message}`);
    }

    const boost = weatherBoost({
      temp,
      humidity,
      wind,
      roof: stadium.roof
    });

    weatherRows.push({
      game,
      home_team,
      away_team,
      venue: stadium.park,
      city: stadium.city,
      temp: temp.toFixed(1),
      humidity,
      wind_speed: wind.toFixed(1),
      wind_deg: windDeg,
      wind_text: stadium.roof ? "Roof Stadium" : windText(wind, windDeg),
      weather_desc: desc,
      weather_boost: boost.boost,
      weather_label: boost.label,
      roof_flag: stadium.roof ? 1 : 0,
      roof_status: roofLabel(stadium),
      fetched_at: new Date().toISOString()
    });
  }

  const weatherMap = new Map(weatherRows.map(r => [normalizeGame(r.game), r]));

  let matched = 0;
  let noMatch = 0;

  for (const row of players) {
    const wx = weatherMap.get(normalizeGame(row.game));

    if (wx) {
      matched++;
      row.weather_boost = wx.weather_boost;
      row.weather_match = "MATCH";
      row.weather_temp = wx.temp;
      row.weather_humidity = wx.humidity;
      row.weather_wind = wx.wind_speed;
      row.weather_wind_deg = wx.wind_deg;
      row.weather_desc = wx.weather_desc;
      row.weather_label = wx.weather_label;
      row.weather_park = wx.venue;
      row.weather_roof_flag = wx.roof_flag;
      row.weather_roof_status = wx.roof_status;
    } else {
      noMatch++;
      row.weather_boost = row.weather_boost || 0;
      row.weather_match = "NO_MATCH";
    }
  }

  writeCSV(WEATHER_FILE, weatherRows);
  fs.writeFileSync(WEATHER_JSON, JSON.stringify(weatherRows, null, 2));
  writeCSV(PLAYER_FILE, players);

  const runtime = ((Date.now() - started) / 1000).toFixed(2);

  console.log("");
  console.log("THE SLIP LAB WEATHER BOOST COMPLETE");
  console.log(`Games: ${games.size}`);
  console.log(`Weather rows: ${weatherRows.length}`);
  console.log(`Matched player rows: ${matched}`);
  console.log(`No match rows: ${noMatch}`);
  console.log(`Runtime: ${runtime}s`);
  console.log(`Saved: ${WEATHER_FILE}`);
  console.log(`Saved: ${WEATHER_JSON}`);
  console.log(`Updated: ${PLAYER_FILE}`);
  console.log("");

  console.table(weatherRows.slice(0, 15).map(r => ({
    game: r.game,
    venue: r.venue,
    temp: r.temp,
    wind: r.wind_speed,
    humidity: r.humidity,
    boost: r.weather_boost,
    label: r.weather_label,
    roof: r.roof_status
  })));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
