const DATA_URL = "./data/weather_page.json";

const PARKS = {
  "Target Field": {
    shape: "M100 144 L34 78 L68 38 L102 28 L132 31 L166 68 L137 104 L118 144 Z",
    lf: 339,
    lcf: 377,
    cf: 411,
    rcf: 367,
    rf: 328
  },
  "Daikin Park": {
    shape: "M100 144 L31 77 L58 41 L80 29 L120 28 L151 47 L170 82 L137 111 L116 144 Z",
    lf: 315,
    lcf: 362,
    cf: 409,
    rcf: 373,
    rf: 326
  },
  "Sutter Health Park": {
    shape: "M100 144 L33 80 L63 43 L86 30 L127 34 L164 70 L137 107 L118 144 Z",
    lf: 330,
    lcf: 388,
    cf: 403,
    rcf: 388,
    rf: 325
  },
  "Truist Park": {
    shape: "M100 144 L33 80 L64 42 L92 30 L126 34 L166 72 L137 109 L118 144 Z",
    lf: 335,
    lcf: 385,
    cf: 400,
    rcf: 375,
    rf: 325
  },
  "Globe Life Field": {
    shape: "M100 144 L33 80 L67 42 L91 31 L130 33 L168 72 L138 110 L118 144 Z",
    lf: 329,
    lcf: 372,
    cf: 407,
    rcf: 374,
    rf: 326
  },
  "Rogers Centre": {
    shape: "M100 144 L31 82 Q100 25 169 82 L138 111 L118 144 Z",
    lf: 328,
    lcf: 375,
    cf: 400,
    rcf: 375,
    rf: 328
  },
  "Comerica Park": {
    shape: "M100 144 L27 81 L61 44 L92 29 L132 32 L170 75 L137 108 L118 144 Z",
    lf: 345,
    lcf: 370,
    cf: 420,
    rcf: 365,
    rf: 330
  },
  "Oracle Park": {
    shape: "M100 144 L34 82 L64 41 L86 31 L121 30 L153 51 L176 84 L138 110 L118 144 Z",
    lf: 339,
    lcf: 399,
    cf: 391,
    rcf: 421,
    rf: 309
  },
  "PNC Park": {
    shape: "M100 144 L32 83 L58 41 L82 29 L122 31 L166 76 L136 110 L118 144 Z",
    lf: 325,
    lcf: 389,
    cf: 399,
    rcf: 375,
    rf: 320
  },
  "Fenway Park": {
    shape: "M100 144 L25 83 L25 48 L74 31 L121 33 L168 76 L136 109 L118 144 Z",
    lf: 310,
    lcf: 379,
    cf: 390,
    rcf: 380,
    rf: 302
  },
  "Yankee Stadium": {
    shape: "M100 144 L28 82 L63 42 L91 29 L130 32 L170 78 L138 110 L118 144 Z",
    lf: 318,
    lcf: 399,
    cf: 408,
    rcf: 385,
    rf: 314
  },
  "Citi Field": {
    shape: "M100 144 L31 81 L63 40 L90 29 L128 34 L169 78 L138 111 L118 144 Z",
    lf: 335,
    lcf: 385,
    cf: 408,
    rcf: 398,
    rf: 330
  },
  "Dodger Stadium": {
    shape: "M100 144 L33 82 L64 43 L94 31 L126 34 L167 78 L138 111 L118 144 Z",
    lf: 330,
    lcf: 375,
    cf: 395,
    rcf: 375,
    rf: 330
  },
  "Progressive Field": {
    shape: "M100 144 L33 82 L64 42 L91 30 L128 33 L167 77 L138 110 L118 144 Z",
    lf: 325,
    lcf: 370,
    cf: 405,
    rcf: 375,
    rf: 325
  },
  "Wrigley Field": {
    shape: "M100 144 L29 82 L60 42 L91 29 L127 33 L170 80 L137 111 L118 144 Z",
    lf: 355,
    lcf: 368,
    cf: 400,
    rcf: 368,
    rf: 353
  },
  "Coors Field": {
    shape: "M100 144 L24 84 L56 43 L91 27 L133 32 L174 80 L138 111 L118 144 Z",
    lf: 347,
    lcf: 390,
    cf: 415,
    rcf: 375,
    rf: 350
  },
  "Petco Park": {
    shape: "M100 144 L31 82 L62 41 L91 30 L127 33 L168 77 L139 111 L118 144 Z",
    lf: 336,
    lcf: 390,
    cf: 396,
    rcf: 391,
    rf: 322
  },
  "Busch Stadium": {
    shape: "M100 144 L32 82 L64 43 L92 30 L126 34 L168 78 L138 111 L118 144 Z",
    lf: 336,
    lcf: 375,
    cf: 400,
    rcf: 375,
    rf: 335
  },
  "American Family Field": {
    shape: "M100 144 L31 82 L61 42 L91 30 L128 33 L168 79 L138 111 L118 144 Z",
    lf: 344,
    lcf: 371,
    cf: 400,
    rcf: 374,
    rf: 345
  },
  "Kauffman Stadium": {
    shape: "M100 144 L27 82 Q100 19 173 82 L138 111 L118 144 Z",
    lf: 330,
    lcf: 387,
    cf: 410,
    rcf: 387,
    rf: 330
  },
  "Chase Field": {
    shape: "M100 144 L31 82 L64 43 L92 30 L128 34 L168 78 L138 111 L118 144 Z",
    lf: 330,
    lcf: 374,
    cf: 407,
    rcf: 374,
    rf: 334
  },
  "Angel Stadium": {
    shape: "M100 144 L29 82 L60 41 L91 30 L127 34 L168 78 L138 111 L118 144 Z",
    lf: 347,
    lcf: 390,
    cf: 396,
    rcf: 370,
    rf: 350
  },
  "T-Mobile Park": {
    shape: "M100 144 L32 82 L62 42 L91 30 L128 34 L168 79 L138 111 L118 144 Z",
    lf: 331,
    lcf: 378,
    cf: 401,
    rcf: 381,
    rf: 326
  },
  "Nationals Park": {
    shape: "M100 144 L31 82 L62 42 L92 30 L128 34 L168 79 L138 111 L118 144 Z",
    lf: 337,
    lcf: 377,
    cf: 402,
    rcf: 370,
    rf: 335
  },
  "Great American Ball Park": {
    shape: "M100 144 L32 82 L62 41 L92 29 L128 34 L168 78 L138 111 L118 144 Z",
    lf: 328,
    lcf: 379,
    cf: 404,
    rcf: 370,
    rf: 325
  },
  "loanDepot park": {
    shape: "M100 144 L30 82 L61 41 L91 30 L128 34 L169 78 L138 111 L118 144 Z",
    lf: 344,
    lcf: 386,
    cf: 400,
    rcf: 387,
    rf: 335
  },
  "Oriole Park at Camden Yards": {
    shape: "M100 144 L31 82 L63 42 L91 30 L128 34 L168 78 L138 111 L118 144 Z",
    lf: 333,
    lcf: 384,
    cf: 410,
    rcf: 373,
    rf: 318
  },
  "Rate Field": {
    shape: "M100 144 L32 82 L63 42 L92 30 L128 34 L168 78 L138 111 L118 144 Z",
    lf: 330,
    lcf: 375,
    cf: 400,
    rcf: 375,
    rf: 335
  },
  "George M. Steinbrenner Field": {
    shape: "M100 144 L28 82 L63 42 L91 29 L130 32 L170 78 L138 110 L118 144 Z",
    lf: 318,
    lcf: 399,
    cf: 408,
    rcf: 385,
    rf: 314
  }
};

const DEFAULT_PARK = {
  shape: "M100 144 L32 82 L64 42 L92 30 L128 34 L168 78 L138 111 L118 144 Z",
  lf: 330,
  lcf: 375,
  cf: 400,
  rcf: 375,
  rf: 330
};

function norm(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getPark(venue) {
  const key = norm(venue);
  for (const [name, park] of Object.entries(PARKS)) {
    if (key.includes(norm(name)) || norm(name).includes(key)) return park;
  }
  return DEFAULT_PARK;
}

function getStatus(game) {
  if (Number(game.roof_flag || game.roofFlag || 0) === 1 || /roof/i.test(game.weather_label || "")) return "roof";
  if (Number(game.precip || 0) >= 60) return "delay";
  return "clear";
}

function getWeatherIcon(game) {
  const label = String(game.weather_label || game.weather || "").toLowerCase();
  if (getStatus(game) === "roof") return "🏟️";
  if (label.includes("cloud")) return "☁️";
  if (label.includes("rain") || label.includes("delay")) return "🌧️";
  return "☀️";
}

function shortGame(game) {
  const away = game.away_abbr || game.away_team_abbr || game.away || String(game.away_team || "").split(" ").pop().slice(0, 3).toUpperCase();
  const home = game.home_abbr || game.home_team_abbr || game.home || String(game.home_team || "").split(" ").pop().slice(0, 3).toUpperCase();
  return String(away).toUpperCase() + " @\n" + String(home).toUpperCase();
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function arrowRotation(game) {
  const text = String(game.wind_text || game.windText || "").toLowerCase();
  if (text.includes("out")) return 0;
  if (text.includes("in")) return 180;
  if (text.includes("left")) return 270;
  if (text.includes("right")) return 90;
  const deg = Number(game.wind_deg || game.windDeg || 0);
  return Number.isFinite(deg) ? deg : 0;
}

function renderParkSvg(game) {
  const venue = game.venue || game.park || game.ballpark || "";
  const park = getPark(venue);
  const rotation = arrowRotation(game);
  const warnClass = Number(game.precip || 0) >= 60 ? " park-warning" : "";

  return `
    <svg class="park-svg" viewBox="0 0 200 160" role="img" aria-label="${venue} park outline">
      <defs>
        <radialGradient id="arrowGradient" cx="50%" cy="45%" r="58%">
          <stop offset="0%" stop-color="#66a8ff"></stop>
          <stop offset="100%" stop-color="#1457d9"></stop>
        </radialGradient>
      </defs>

      <path class="park-glow" d="${park.shape}"></path>
      <path class="park-fill" d="${park.shape}"></path>
      <path class="park-outline${warnClass}" d="${park.shape}"></path>

      <path class="infield" d="M100 144 L76 121 L100 98 L124 121 Z"></path>
      <circle class="base" cx="100" cy="144" r="2.7"></circle>
      <circle class="base" cx="76" cy="121" r="2.2"></circle>
      <circle class="base" cx="100" cy="98" r="2.2"></circle>
      <circle class="base" cx="124" cy="121" r="2.2"></circle>

      <text class="dimension-text" x="36" y="88">${park.lf}</text>
      <text class="dimension-sub" x="36" y="100">LF</text>

      <text class="dimension-text" x="67" y="39">${park.lcf}</text>
      <text class="dimension-sub" x="67" y="51">L-CF</text>

      <text class="dimension-text" x="100" y="23">${park.cf}</text>

      <text class="dimension-text" x="134" y="39">${park.rcf}</text>
      <text class="dimension-sub" x="134" y="51">R-CF</text>

      <text class="dimension-text" x="164" y="88">${park.rf}</text>
      <text class="dimension-sub" x="164" y="100">RF</text>

      <g transform="translate(100 84) rotate(${rotation})">
        <circle class="wind-arrow-circle" cx="0" cy="0" r="20"></circle>
        <path class="wind-arrow" d="M-7 2 L0 -12 L7 2 L3 2 L3 12 L-3 12 L-3 2 Z"></path>
      </g>
    </svg>
  `;
}

function renderCard(game) {
  const status = getStatus(game);
  const venue = game.venue || game.park || game.ballpark || "";
  const temp = Math.round(Number(game.temp || game.temperature || 0));
  const precip = Math.round(Number(game.precip || game.precipitation || 0));
  const windSpeed = Math.round(Number(game.wind_speed || game.windSpeed || 0));
  const windText = game.wind_text || game.windText || game.wind || "";
  const time = game.game_time || game.time || formatTime(game.commence_time);

  return `
    <article class="weather-card ${status}">
      <div class="weather-cell game-cell">
        <div class="game-title">${shortGame(game)}</div>
        <div class="park-name">${venue}</div>
        <div class="game-time">${time}</div>
      </div>

      <div class="weather-cell icon-cell">
        <div class="weather-icon">${getWeatherIcon(game)}</div>
        <div class="icon-label">${status === "roof" ? "ROOF\nCONTROLLED" : "HR\nBOOST"}</div>
      </div>

      <div class="weather-cell metric-cell">
        <div class="metric-value">${temp}°F</div>
        <div class="metric-label">TEMP</div>
      </div>

      <div class="weather-cell metric-cell">
        <div class="metric-value">${precip}%</div>
        <div class="metric-label">PRECIP</div>
      </div>

      <div class="weather-cell park-cell">
        ${renderParkSvg(game)}
      </div>

      <div class="weather-cell wind-cell">
        <div class="wind-main">${windSpeed}</div>
        <div class="wind-unit">MPH</div>
        <div class="wind-text">${windText}</div>
      </div>
    </article>
  `;
}

async function loadWeather() {
  const grid = document.getElementById("weatherGrid");
  if (!grid) return;

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    const payload = await response.json();
    const games = Array.isArray(payload) ? payload : payload.games || payload.rows || payload.data || [];

    grid.innerHTML = games.map(renderCard).join("");
  } catch (error) {
    grid.innerHTML = '<div style="color:#ff6b6b;padding:20px;">Weather data could not load.</div>';
    console.error(error);
  }
}

loadWeather();
