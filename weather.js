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