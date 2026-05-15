async function getJSON(path) {
  const response = await fetch(path);

  if (!response.ok) {
    return [];
  }

  return await response.json();
}

function safe(value, fallback = "") {
  return value === undefined || value === null || value === ""
    ? fallback
    : value;
}

function playCard(row, index) {
  return `
    <article class="card">
      <div class="rank">#${index + 1}</div>

      <div class="name">${safe(row.player)}</div>

      <div class="meta">
        ${safe(row.team)} vs ${safe(row.pitcher)}
      </div>

      <div class="metric">
        <span>HR Probability</span>
        <strong>${safe(row.adjusted_hr_probability)}</strong>
      </div>

      <div class="metric">
        <span>Odds</span>
        <strong>${safe(row.odds)}</strong>
      </div>

      <div class="metric">
        <span>Fair Odds</span>
        <strong>${safe(row.model_fair_odds)}</strong>
      </div>

      <div class="metric">
        <span>EV</span>
        <strong>${safe(row.ev_percent)}</strong>
      </div>

      <span class="badge">
        ${safe(row.betting_tier, row.probability_tier)}
      </span>
    </article>
  `;
}

function stackCard(row, index) {
  return `
    <article class="stackCard">
      <div>
        <div class="rank">#${index + 1}</div>

        <div class="stackPlayers">
          ${safe(row.players)}
        </div>

        <div class="stackMeta">
          ${safe(row.game)}
        </div>

        <span class="badge">
          ${safe(row.simulation_stack_grade)}
        </span>
      </div>

      <div class="stackStats">
        <div>
          <span>${safe(row.simulated_any_hr_probability)}</span>
          <p>Any HR</p>
        </div>

        <div>
          <span>${safe(row.adjusted_all_hr_probability)}</span>
          <p>All HR</p>
        </div>

        <div>
          <span>${safe(row.simulation_stack_score)}</span>
          <p>Score</p>
        </div>
      </div>
    </article>
  `;
}

function trackingCard(row) {
  return `
    <article class="trackingCard">
      <h3>${safe(row.group)}</h3>

      <p>Bets: ${safe(row.bets, "0")}</p>
      <p>Graded: ${safe(row.graded, "0")}</p>
      <p>Hit Rate: ${safe(row.hit_rate, "Pending")}</p>
      <p>ROI: ${safe(row.roi, "Pending")}</p>
    </article>
  `;
}

async function init() {
  const top = await getJSON("./data/top_hr_plays.json");
  const value = await getJSON("./data/value_hr_plays.json");
  const stacks = await getJSON("./data/top_hr_stacks.json");
  const tracking = await getJSON("./data/tracking_summary.json");

  document.getElementById("topCount").textContent = top.length;
  document.getElementById("valueCount").textContent = value.length;
  document.getElementById("stackCount").textContent = stacks.length;

  document.getElementById("statusTitle").textContent =
    "Today's Slate Loaded";

  document.getElementById("topPlays").innerHTML =
    top.slice(0, 12).map(playCard).join("");

  document.getElementById("valuePlays").innerHTML =
    value.slice(0, 12).map(playCard).join("");

  document.getElementById("stackPlays").innerHTML =
    stacks.slice(0, 12).map(stackCard).join("");

  const trackingRows = Array.isArray(tracking)
    ? tracking
    : tracking.summaries || [];

  document.getElementById("trackingCards").innerHTML =
    trackingRows.slice(0, 8).map(trackingCard).join("");
}

init();
