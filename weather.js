
const PARK_DIMENSIONS = {
  "PNC Park": { lf: 325, lcf: 383, cf: 399, rcf: 375, rf: 320 },
  "Great American Ball Park": { lf: 328, lcf: 379, cf: 404, rcf: 370, rf: 325 },
  "Citi Field": { lf: 335, lcf: 358, cf: 408, rcf: 375, rf: 330 },
  "Target Field": { lf: 339, lcf: 377, cf: 404, rcf: 367, rf: 328 },
  "American Family Field": { lf: 344, lcf: 371, cf: 400, rcf: 374, rf: 345 },
  "Sutter Health Park": { lf: 330, lcf: 403, cf: 403, rcf: 380, rf: 325 },
  "Fenway Park": { lf: 310, lcf: 379, cf: 390, rcf: 420, rf: 302 },
  "Truist Park": { lf: 335, lcf: 385, cf: 400, rcf: 375, rf: 325 },
  "Rate Field": { lf: 330, lcf: 375, cf: 400, rcf: 375, rf: 335 },
  "Dodger Stadium": { lf: 330, lcf: 375, cf: 395, rcf: 375, rf: 330 },
  "Globe Life Field": { lf: 329, lcf: 372, cf: 407, rcf: 374, rf: 326 },
  "Rogers Centre": { lf: 328, lcf: 375, cf: 400, rcf: 375, rf: 328 },
  "Guaranteed Rate Field": { lf: 330, lcf: 377, cf: 400, rcf: 372, rf: 335 },
  "Daikin Park": { lf: 315, lcf: 362, cf: 409, rcf: 373, rf: 326 },
  "Oracle Park": { lf: 339, lcf: 399, cf: 391, rcf: 421, rf: 309 },
  "Yankee Stadium": { lf: 318, lcf: 399, cf: 408, rcf: 385, rf: 314 },
  "T-Mobile Park": { lf: 331, lcf: 378, cf: 401, rcf: 381, rf: 326 },
  "Coors Field": { lf: 347, lcf: 390, cf: 415, rcf: 375, rf: 350 },
  "Petco Park": { lf: 336, lcf: 390, cf: 396, rcf: 391, rf: 322 },
  "Wrigley Field": { lf: 355, lcf: 368, cf: 400, rcf: 368, rf: 353 },
  "Busch Stadium": { lf: 336, lcf: 375, cf: 400, rcf: 375, rf: 335 },
  "Citizens Bank Park": { lf: 329, lcf: 374, cf: 401, rcf: 369, rf: 330 },
  "loanDepot park": { lf: 344, lcf: 386, cf: 400, rcf: 387, rf: 335 },
  "Angel Stadium": { lf: 347, lcf: 390, cf: 396, rcf: 370, rf: 350 },
  "Kauffman Stadium": { lf: 330, lcf: 387, cf: 410, rcf: 387, rf: 330 },
  "Comerica Park": { lf: 345, lcf: 370, cf: 420, rcf: 365, rf: 330 },
  "Progressive Field": { lf: 325, lcf: 370, cf: 400, rcf: 375, rf: 325 },
  "Chase Field": { lf: 330, lcf: 374, cf: 407, rcf: 374, rf: 334 },
  "Tropicana Field": { lf: 315, lcf: 370, cf: 404, rcf: 370, rf: 322 },
  "Oriole Park at Camden Yards": { lf: 333, lcf: 364, cf: 410, rcf: 373, rf: 318 },
  "Nationals Park": { lf: 337, lcf: 377, cf: 402, rcf: 370, rf: 335 }
};

function parkDiagram(venue) {
  const p = PARK_DIMENSIONS[venue];

  if (!p) {
    return `
      <div class="park-diagram missing">
        <div class="park-label">Park Dimensions</div>
        <div class="park-missing">Unavailable</div>
      </div>
    `;
  }

  return `
    <div class="park-diagram">
      <div class="park-label">Park Layout</div>
      <div class="mini-field">
        <span class="dim lf">${p.lf}</span>
        <span class="dim lcf">${p.lcf}</span>
        <span class="dim cf">${p.cf}</span>
        <span class="dim rcf">${p.rcf}</span>
        <span class="dim rf">${p.rf}</span>
        <span class="diamond-base"></span>
      </div>
      <div class="dim-row">
        <span>LF</span><span>LCF</span><span>CF</span><span>RCF</span><span>RF</span>
      </div>
    </div>
  `;
}

async function loadWeather() {
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

    return `
      <article class="weather-card ${row.status}">
        <div class="cell">
          <div>
            <span class="teams">${safe(row.away_abbr)} @ ${safe(row.home_abbr)}</span>
            <span class="time">${safe(time)}</span>
          </div>
          <div class="venue">${safe(row.venue)}</div>
        </div>

        <div class="cell">
          <div class="weather-icon">${icon}</div>
          <div class="label">${safe(row.weather_label || row.status)}</div>
        </div>

        <div class="cell">
          <div class="big">${safe(row.temp)}°F</div>
          <div class="label">Temp</div>
        </div>

        <div class="cell">
          <div class="big">${safe(row.precip)}%</div>
          <div class="label">Precip</div>
        </div>

        <div class="cell">
          <div class="field">
            <div class="arrow">${arrow}</div>
          </div>
          <div class="big">${safe(row.wind_speed)}</div>
          <div class="label">MPH</div>
          <div class="wind-label">${safe(row.wind_text)}</div>
        </div>
      </article>
    `;
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
});