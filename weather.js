const grid = document.getElementById("weatherGrid");
const refreshBtn = document.getElementById("weatherRefresh");

const PARKS = {
  "Target Field": [339, 377, 411, 367, 328],
  "Daikin Park": [315, 362, 409, 373, 326],
  "Sutter Health Park": [330, 388, 403, 388, 325],
  "Truist Park": [335, 385, 400, 375, 325],
  "Globe Life Field": [329, 372, 407, 374, 326],
  "Rogers Centre": [328, 375, 400, 375, 328],
  "Guaranteed Rate Field": [330, 375, 400, 375, 335],
  "Citi Field": [335, 385, 408, 398, 330],
  "Yankee Stadium": [318, 399, 408, 385, 314],
  "Dodger Stadium": [330, 375, 400, 375, 330],
  "Great American Ball Park": [328, 379, 404, 370, 325],
  "PNC Park": [325, 389, 399, 375, 320],
  "American Family Field": [344, 371, 400, 374, 345]
};

function csvParse(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];

  const headers = lines.shift().split(",").map(h => h.trim());

  return lines.map(line => {
    const cells = [];
    let current = "";
    let quote = false;

    for (const char of line) {
      if (char === '"') quote = !quote;
      else if (char === "," && !quote) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    cells.push(current);

    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] || "").trim());
    return row;
  });
}

async function loadAnyWeatherData() {
  const files = [
    "./data/weather.json",
    "./data/weather_boost.json",
    "./data/weather_environment_engine.json",
    "./data/weather.csv",
    "./data/weather_boost.csv",
    "./data/weather_environment_engine.csv"
  ];

  for (const file of files) {
    try {
      const res = await fetch(file + "?ts=" + Date.now(), { cache: "no-store" });
      if (!res.ok) continue;

      if (file.endsWith(".json")) {
        const json = await res.json();
        if (Array.isArray(json)) return json;
        if (Array.isArray(json.rows)) return json.rows;
        if (Array.isArray(json.games)) return json.games;
      } else {
        const text = await res.text();
        const rows = csvParse(text);
        if (rows.length) return rows;
      }
    } catch {}
  }

  return [];
}

function shortGame(row) {
  const away = row.away_team || row.away || "";
  const home = row.home_team || row.home || "";

  if (away && home) {
    return `${abbr(away)} @${abbr(home)}`;
  }

  const game = row.game || row.matchup || "";
  if (game.includes("@")) {
    const parts = game.split("@");
    return `${abbr(parts[0])} @${abbr(parts[1])}`;
  }

  return game || "MLB Game";
}

function abbr(name = "") {
  const map = {
    "Miami Marlins": "MIA",
    "Minnesota Twins": "MIN",
    "Seattle Mariners": "SEA",
    "Houston Astros": "HOU",
    "St. Louis Cardinals": "STL",
    "Athletics": "ATH",
    "Chicago Cubs": "CHC",
    "Atlanta Braves": "ATL",
    "Arizona Diamondbacks": "ARI",
    "Texas Rangers": "TEX",
    "Tampa Bay Rays": "TB",
    "Toronto Blue Jays": "TOR",
    "Kansas City Royals": "KC",
    "Chicago White Sox": "CWS",
    "Detroit Tigers": "DET",
    "New York Mets": "NYM"
  };

  const clean = String(name).trim();
  return map[clean] || clean.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
}

function venue(row) {
  return row.venue || row.ballpark || row.park || "Ballpark";
}

function temp(row) {
  const val = row.temp || row.temperature || row.game_temp || row.temp_f || "";
  return val ? `${Math.round(Number(val))}°F` : "N/A";
}

function precip(row) {
  const val = row.precip || row.precipitation || row.precip_pct || row.rain_pct || "0";
  return `${Math.round(Number(val) || 0)}%`;
}

function roof(row) {
  const txt = `${row.roof || row.roof_flag || row.weather_label || row.label || ""}`.toLowerCase();
  return txt.includes("roof") || txt === "1" || txt.includes("closed");
}

function risk(row) {
  const txt = `${row.weather_label || row.label || row.condition || ""}`.toLowerCase();
  const p = Number(row.precip || row.precipitation || row.precip_pct || 0);

  if (roof(row)) return "roof";
  if (txt.includes("delay") || p >= 45) return "delay";
  if (txt.includes("watch") || p >= 25) return "watch";
  return "clear";
}

function label(row) {
  if (roof(row)) return "Roof Controlled";
  const txt = row.weather_label || row.label || row.condition || "";
  if (txt) return txt;
  return "HR Boost";
}

function icon(row) {
  if (roof(row)) return "🏟️";
  if (risk(row) === "delay") return "⛈️";
  if (risk(row) === "watch") return "🌥️";
  return "☀️";
}

function dimensions(park) {
  return PARKS[park] || [330, 375, 400, 375, 330];
}

function parkSvg(park, windText = "") {
  const d = dimensions(park);
  const up = String(windText).toLowerCase().includes("out") || String(windText).includes("↑");
  const arrow = up ? "↑" : "↓";

  return `
    <svg class="park-svg" viewBox="0 0 180 150" role="img">
      <polygon points="25,95 55,30 90,22 125,30 155,95 90,132" fill="rgba(16,255,124,0.22)" stroke="#7dffb2" stroke-width="3"/>
      <polygon points="90,132 62,105 90,78 118,105" fill="#b98237" stroke="#ffd18a" stroke-width="2"/>
      <circle cx="90" cy="72" r="24" fill="#2f80ff"/>
      <text x="90" y="82" text-anchor="middle" font-size="34" fill="#fff" font-weight="900">${arrow}</text>
      <text x="23" y="100" fill="#fff" font-size="12" font-weight="900">${d[0]}</text>
      <text x="50" y="42" fill="#fff" font-size="12" font-weight="900">${d[1]}</text>
      <text x="88" y="20" fill="#fff" font-size="12" font-weight="900">${d[2]}</text>
      <text x="124" y="42" fill="#fff" font-size="12" font-weight="900">${d[3]}</text>
      <text x="151" y="100" fill="#fff" font-size="12" font-weight="900">${d[4]}</text>
    </svg>
  `;
}

function card(row) {
  const cls = risk(row);
  const park = venue(row);

  return `
    <article class="weather-card ${cls}">
      <div class="weather-inner">
        <div class="weather-cell">
          <div class="matchup">${shortGame(row)}</div>
          <div class="venue">${park}</div>
        </div>

        <div class="weather-cell">
          <div class="weather-icon">${icon(row)}</div>
          <div class="weather-label">${label(row)}</div>
        </div>

        <div class="weather-cell">
          <div class="big-stat">${temp(row)}</div>
          <div class="weather-label">Temp</div>
        </div>

        <div class="weather-cell">
          <div class="big-stat">${precip(row)}</div>
          <div class="weather-label">Precip</div>
        </div>

        <div class="weather-cell">
          ${parkSvg(park, row.wind_text || row.wind || "")}
        </div>
      </div>
    </article>
  `;
}

async function renderWeather() {
  grid.innerHTML = '<div class="weather-empty">Loading weather board...</div>';

  const rows = await loadAnyWeatherData();

  if (!rows.length) {
    grid.innerHTML = '<div class="weather-empty">No weather data found. Run the weather export or add weather data to website/data.</div>';
    return;
  }

  grid.innerHTML = rows.map(card).join("");
}

refreshBtn.addEventListener("click", renderWeather);
renderWeather();
