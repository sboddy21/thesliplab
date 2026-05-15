import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const WEBSITE_DIR = path.join(ROOT, "website");
const WEBSITE_DATA = path.join(WEBSITE_DIR, "data");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  out.push(current);
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function shortTeam(team) {
  const map = {
    "Arizona Diamondbacks": "ARI",
    "Atlanta Braves": "ATL",
    "Baltimore Orioles": "BAL",
    "Boston Red Sox": "BOS",
    "Chicago Cubs": "CHC",
    "Chicago White Sox": "CWS",
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
    "Athletics": "ATH",
    "Philadelphia Phillies": "PHI",
    "Pittsburgh Pirates": "PIT",
    "San Diego Padres": "SD",
    "San Francisco Giants": "SF",
    "Seattle Mariners": "SEA",
    "St. Louis Cardinals": "STL",
    "Tampa Bay Rays": "TB",
    "Texas Rangers": "TEX",
    "Toronto Blue Jays": "TOR",
    "Washington Nationals": "WSH"
  };

  return map[team] || team;
}

function classifyWeather(row) {
  const temp = num(row.temp);
  const precip = num(row.precip || row.precipitation || row.rain_chance);
  const wind = num(row.wind_speed);
  const roof = String(row.roof_flag || "").trim() === "1";

  if (roof) return "roof";
  if (precip >= 70) return "delay";
  if (precip >= 35) return "watch";
  if (temp >= 75 && wind >= 10) return "boost";
  return "clear";
}

function windDirectionLabel(text, deg) {
  const raw = String(text || "").trim();
  if (raw) return raw;

  const d = num(deg, null);
  if (d === null) return "Wind data";

  if (d >= 337.5 || d < 22.5) return "Wind N";
  if (d < 67.5) return "Wind NE";
  if (d < 112.5) return "Wind E";
  if (d < 157.5) return "Wind SE";
  if (d < 202.5) return "Wind S";
  if (d < 247.5) return "Wind SW";
  if (d < 292.5) return "Wind W";
  return "Wind NW";
}

function normalizeRows(rows) {
  return rows.map(row => {
    const status = classifyWeather(row);
    const temp = Math.round(num(row.temp));
    const humidity = Math.round(num(row.humidity));
    const wind = Math.round(num(row.wind_speed));
    const precip = Math.round(num(row.precip || row.precipitation || row.rain_chance));
    const home = row.home_team || "";
    const away = row.away_team || "";

    return {
      game: row.game || `${away} @ ${home}`,
      home_team: home,
      away_team: away,
      home_abbr: shortTeam(home),
      away_abbr: shortTeam(away),
      venue: row.venue || "",
      city: row.city || "",
      commence_time: row.commence_time || "",
      temp,
      humidity,
      precip,
      wind_speed: wind,
      wind_text: windDirectionLabel(row.wind_text, row.wind_deg),
      weather_label: row.weather_label || "",
      weather_boost: num(row.weather_boost),
      roof_flag: String(row.roof_flag || "").trim() === "1",
      status
    };
  });
}

function main() {
  ensureDir(WEBSITE_DATA);

  const weatherPath = path.join(DATA_DIR, "weather.csv");

  if (!fs.existsSync(weatherPath)) {
    console.error("Missing data/weather.csv");
    process.exit(1);
  }

  const rows = normalizeRows(parseCsv(fs.readFileSync(weatherPath, "utf8")));

  const summary = {
    updated_at: new Date().toISOString(),
    games: rows.length,
    clear: rows.filter(r => r.status === "clear").length,
    boost: rows.filter(r => r.status === "boost").length,
    watch: rows.filter(r => r.status === "watch").length,
    delay: rows.filter(r => r.status === "delay").length,
    roof: rows.filter(r => r.status === "roof").length
  };

  fs.writeFileSync(
    path.join(WEBSITE_DATA, "weather_page.json"),
    JSON.stringify(rows, null, 2)
  );

  fs.writeFileSync(
    path.join(WEBSITE_DATA, "weather_summary.json"),
    JSON.stringify(summary, null, 2)
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>The Slip Lab Weather</title>
  <link rel="stylesheet" href="styles.css"/>

  <style>
    body {
      margin: 0;
      background:
        radial-gradient(circle at 20% 0%, rgba(0,255,136,.10), transparent 30%),
        linear-gradient(180deg, #050807 0%, #020403 100%);
      color: #f8fafc;
      font-family: Inter, Arial, sans-serif;
    }

    .tsl-nav {
      position: sticky;
      top: 0;
      z-index: 9999;
      height: 78px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 34px;
      background: rgba(2,5,4,.96);
      border-bottom: 1px solid rgba(255,255,255,.09);
      backdrop-filter: blur(14px);
    }

    .tsl-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      color: #fff;
      text-decoration: none;
    }

    .tsl-logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #00ff88;
      color: #021108;
      display: grid;
      place-items: center;
      font-weight: 900;
    }

    .tsl-brand strong {
      display: block;
      font-size: 20px;
      line-height: 1;
    }

    .tsl-brand span {
      display: block;
      margin-top: 5px;
      color: #00ff88;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .tsl-links {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .tsl-links a {
      color: #cbd5e1;
      text-decoration: none;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .tsl-links a:hover,
    .tsl-links a.active {
      color: #00ff88;
    }

    .weather-shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 34px 20px 90px;
    }

    .weather-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      margin-bottom: 26px;
    }

    .kicker {
      color: #00ff88;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .24em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    h1 {
      margin: 0;
      font-size: clamp(34px, 5vw, 58px);
      letter-spacing: -.05em;
      line-height: .98;
    }

    h1 span {
      color: #00ff88;
    }

    .copy {
      color: #9ca3af;
      max-width: 760px;
      line-height: 1.65;
      margin-top: 14px;
      font-size: 15px;
    }

    .date-box {
      min-width: 220px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(7,12,10,.82);
      border-radius: 18px;
      padding: 18px;
    }

    .date-box label {
      display: block;
      color: #7c8a83;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .14em;
      margin-bottom: 8px;
    }

    .date-box strong {
      font-size: 18px;
    }

    .summary {
      border: 1px solid rgba(255,255,255,.08);
      background:
        linear-gradient(180deg, rgba(13,21,18,.92), rgba(5,8,7,.96));
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 18px;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      color: #9ca3af;
      font-size: 12px;
      margin-top: 14px;
    }

    .dot {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 999px;
      margin-right: 7px;
    }

    .green {
      background: #22c55e;
    }

    .gold {
      background: #facc15;
    }

    .orange {
      background: #f97316;
    }

    .red {
      background: #ef4444;
    }

    .blue {
      background: #38bdf8;
    }

    .weather-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .weather-card {
      display: grid;
      grid-template-columns: 1.65fr 1fr 1fr 1fr 1.35fr;
      min-height: 112px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.04);
      border-radius: 12px;
      overflow: hidden;
    }

    .weather-card.clear,
    .weather-card.boost {
      box-shadow: inset 4px 0 0 #22c55e;
      background: linear-gradient(90deg, rgba(34,197,94,.16), rgba(255,255,255,.035));
    }

    .weather-card.watch {
      box-shadow: inset 4px 0 0 #facc15;
      background: linear-gradient(90deg, rgba(250,204,21,.16), rgba(255,255,255,.035));
    }

    .weather-card.delay {
      box-shadow: inset 4px 0 0 #f97316;
      background: linear-gradient(90deg, rgba(249,115,22,.18), rgba(255,255,255,.035));
    }

    .weather-card.roof {
      box-shadow: inset 4px 0 0 #38bdf8;
      background: linear-gradient(90deg, rgba(56,189,248,.14), rgba(255,255,255,.035));
    }

    .cell {
      padding: 18px;
      border-right: 1px solid rgba(255,255,255,.10);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    .cell:first-child {
      align-items: flex-start;
    }

    .cell:last-child {
      border-right: 0;
    }

    .teams {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: .02em;
    }

    .time {
      color: #cbd5e1;
      margin-left: 8px;
      font-weight: 600;
      font-size: 13px;
    }

    .venue {
      color: #c084fc;
      font-size: 12px;
      margin-top: 9px;
    }

    .weather-icon {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      display: grid;
      place-items: center;
      font-size: 28px;
    }

    .big {
      font-size: 24px;
      font-weight: 900;
    }

    .label {
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .14em;
      margin-top: 6px;
      font-weight: 900;
    }

    .field {
      width: 82px;
      height: 82px;
      border-radius: 18px 18px 36px 36px;
      background:
        radial-gradient(circle at 50% 65%, rgba(59,130,246,.85), rgba(30,64,175,.75) 35%, transparent 37%),
        linear-gradient(135deg, rgba(168,85,247,.34), rgba(59,130,246,.20));
      border: 1px solid rgba(168,85,247,.45);
      transform: rotate(45deg);
      position: relative;
      margin-bottom: 8px;
    }

    .arrow {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      transform: rotate(-45deg);
      font-size: 28px;
      font-weight: 900;
      color: #fff;
    }

    .wind-label {
      color: #cbd5e1;
      font-size: 12px;
      text-align: center;
    }

    @media (max-width: 1000px) {
      .weather-grid {
        grid-template-columns: 1fr;
      }

      .weather-top {
        align-items: flex-start;
        flex-direction: column;
      }
    }

    @media (max-width: 760px) {
      .tsl-nav {
        height: auto;
        align-items: flex-start;
        flex-direction: column;
        gap: 14px;
        padding: 16px;
      }

      .tsl-links {
        width: 100%;
        overflow-x: auto;
        gap: 16px;
        padding-bottom: 4px;
      }

      .weather-card {
        grid-template-columns: 1fr 1fr;
      }

      .cell {
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
    }
  </style>
</head>

<body>
  <header class="tsl-nav">
    <a class="tsl-brand" href="index.html">
      <div class="tsl-logo">TSL</div>
      <div>
        <strong>The Slip Lab</strong>
        <span>MLB Home Run Intelligence</span>
      </div>
    </a>

    <nav class="tsl-links">
      <a href="index.html">Home</a>
      <a href="index.html#top-plays">Top Plays</a>
      <a href="index.html#value">Value</a>
      <a href="index.html#stacks">Stacks</a>
      <a href="slate.html">Slate</a>
      <a href="weather.html" class="active">Weather</a>
      <a href="results.html">Results</a>
    </nav>
  </header>

  <main class="weather-shell">
    <section class="weather-top">
      <div>
        <div class="kicker">MLB Weather</div>
        <h1>Weather <span>Report</span></h1>
        <p class="copy">
          Game level weather, temperature, precipitation, roof status, and wind conditions for today’s MLB slate.
        </p>
      </div>

      <div class="date-box">
        <label>Report Date</label>
        <strong id="reportDate">Loading...</strong>
        <p class="copy" id="updatedAt" style="margin: 8px 0 0; font-size: 12px;"></p>
      </div>
    </section>

    <section class="summary">
      <div class="kicker">Summary</div>
      <div class="legend">
        <span><i class="dot green"></i> Clear</span>
        <span><i class="dot gold"></i> Weather Watch</span>
        <span><i class="dot orange"></i> Delay Risk</span>
        <span><i class="dot blue"></i> Roof</span>
      </div>
    </section>

    <section class="weather-grid" id="weatherGrid"></section>
  </main>

  <script src="weather.js"></script>
</body>
</html>`;

  const js = `async function loadWeather() {
  const [rowsRes, summaryRes] = await Promise.all([
    fetch("./data/weather_page.json", { cache: "no-store" }),
    fetch("./data/weather_summary.json", { cache: "no-store" })
  ]);

  const rows = await rowsRes.json();
  const summary = await summaryRes.json();

  const now = new Date(summary.updated_at || Date.now());

  document.getElementById("reportDate").textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  document.getElementById("updatedAt").textContent =
    "Updated " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  document.getElementById("weatherGrid").innerHTML = rows.map(row => {
    const icon = getIcon(row);
    const arrow = getArrow(row.wind_text);
    const time = formatTime(row.commence_time);

    return \`
      <article class="weather-card \${row.status}">
        <div class="cell">
          <div>
            <span class="teams">\${safe(row.away_abbr)} @ \${safe(row.home_abbr)}</span>
            <span class="time">\${safe(time)}</span>
          </div>
          <div class="venue">\${safe(row.venue)}</div>
        </div>

        <div class="cell">
          <div class="weather-icon">\${icon}</div>
          <div class="label">\${safe(row.weather_label || row.status)}</div>
        </div>

        <div class="cell">
          <div class="big">\${safe(row.temp)}°F</div>
          <div class="label">Temp</div>
        </div>

        <div class="cell">
          <div class="big">\${safe(row.precip)}%</div>
          <div class="label">Precip</div>
        </div>

        <div class="cell">
          <div class="field">
            <div class="arrow">\${arrow}</div>
          </div>
          <div class="big">\${safe(row.wind_speed)}</div>
          <div class="label">MPH</div>
          <div class="wind-label">\${safe(row.wind_text)}</div>
        </div>
      </article>
    \`;
  }).join("");
}

function getIcon(row) {
  if (row.roof_flag) return "🏟️";
  if (row.precip >= 60) return "🌧️";
  if (row.precip >= 25) return "🌦️";
  if (row.temp >= 75) return "☀️";
  return "☁️";
}

function getArrow(text) {
  const t = String(text || "").toUpperCase();

  if (t.includes("N")) return "⬆";
  if (t.includes("S")) return "⬇";
  if (t.includes("E")) return "➡";
  if (t.includes("W")) return "⬅";

  return "↗";
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

loadWeather().catch(error => {
  console.error(error);
  document.getElementById("weatherGrid").innerHTML =
    "<p>Weather failed to load.</p>";
});`;

  fs.writeFileSync(path.join(WEBSITE_DIR, "weather.html"), html);
  fs.writeFileSync(path.join(WEBSITE_DIR, "weather.js"), js);

  const indexPath = path.join(WEBSITE_DIR, "index.html");

  if (fs.existsSync(indexPath)) {
    let index = fs.readFileSync(indexPath, "utf8");

    if (!index.includes('href="weather.html"')) {
      index = index.replace(
        /<a href="slate.html">Slate<\/a>/,
        '<a href="slate.html">Slate</a><a href="weather.html">Weather</a>'
      );
    }

    fs.writeFileSync(indexPath, index);
  }

  console.log("WEATHER PAGE BUILT");
  console.log("Games:", rows.length);
  console.log("Saved: website/weather.html");
  console.log("Saved: website/weather.js");
  console.log("Saved: website/data/weather_page.json");
}

main();
