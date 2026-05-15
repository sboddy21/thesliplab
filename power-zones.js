const DATA_URL = "./data/power_zones.json?ts=" + Date.now();

let allRows = [];
let rankedRows = [];
let activeFilter = "ALL";

const grid = document.getElementById("pzGrid");
const search = document.getElementById("pzSearch");
const sort = document.getElementById("pzSort");
const updated = document.getElementById("pzUpdated");
const refresh = document.getElementById("pzRefresh");
const drawer = document.getElementById("pzDrawer");
const drawerContent = document.getElementById("pzDrawerContent");
const closeBtn = document.getElementById("pzClose");
const closeBackdrop = document.getElementById("pzCloseBackdrop");

function initials(name = "") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "TSL";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  if (!text) return true;
  if (["#", "-", "--", "n/a", "na", "nan", "null", "undefined", "pending", "live pending"].includes(text.toLowerCase())) return true;
  return false;
}

function cleanValue(value, fallback = "") {
  if (isEmptyValue(value)) return isEmptyValue(fallback) ? "" : fallback;
  return value;
}

function fmt(value, fallback = "0") {
  const clean = cleanValue(value, fallback);
  return clean === "" ? fallback : clean;
}

function decimal(value, fallback = "") {
  if (isEmptyValue(value)) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(3).replace(/^0/, "");
}

function number(value, fallback = 0) {
  const n = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : fallback;
}

function pct(value, fallback = "") {
  if (isEmptyValue(value)) return fallback;
  const n = number(value, NaN);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(1) + "%";
}

function score(row) {
  const n = Number(row.score || row.slip_score || row.power_score || row.consensus_score || 0);
  return Number.isFinite(n) ? n : 0;
}

function bucket(row) {
  const rank = Number(row.power_rank || 9999);
  if (rank <= 25) return "CORE";
  if (rank <= 75) return "DANGER";
  if (rank <= 150) return "VALUE";
  return "SLEEPER";
}

function grade(row) {
  return bucket(row);
}

function headshot(row) {
  return row.headshot_url || row.headshot || row.player_image || row.mlb_headshot_url || "";
}

function photo(row, size = "small") {
  const url = headshot(row);
  const fallback = initials(row.player || row.name);

  if (!url) return `<div class="pz-avatar ${size}">${fallback}</div>`;

  return `<div class="pz-photo-wrap ${size}"><img src="${escapeHtml(url)}" alt="${escapeHtml(row.player || "Player")}" onerror="this.parentElement.outerHTML='<div class=&quot;pz-avatar ${size}&quot;>${fallback}</div>'"></div>`;
}

function filterMatches(row) {
  const f = String(activeFilter || "ALL").toUpperCase();
  if (f === "ALL") return true;
  return bucket(row) === f;
}

function matchRow(row) {
  const q = search.value.trim().toLowerCase();

  if (!filterMatches(row)) return false;
  if (!q) return true;

  return [row.player, row.name, row.team, row.opponent, row.pitcher, row.venue, row.game]
    .some(value => String(value || "").toLowerCase().includes(q));
}

function sortedRows(rows) {
  const key = sort.value;

  return [...rows].sort((a, b) => {
    if (key === "hr") return number(b.hr) - number(a.hr);
    if (key === "iso") return number(b.iso) - number(a.iso);
    if (key === "slg") return number(b.slg) - number(a.slg);
    return Number(a.power_rank || 9999) - Number(b.power_rank || 9999);
  });
}

function hrProbability(row) {
  const raw = String(row.adjusted_hr_probability || row.hr_probability || "").replace("%", "");
  if (raw && Number.isFinite(Number(raw))) return Number(raw);
  return Math.max(2.5, Math.min(24, 4 + ((score(row) - 20) / 79) * 16));
}

function riskLabel(row) {
  const p = hrProbability(row);
  if (p >= 16) return "High";
  if (p >= 11) return "Moderate";
  return "Watch";
}

function tagList(row) {
  const tags = [];
  const iso = number(row.iso);
  const slg = number(row.slg);
  const hr = number(row.hr || row.home_runs);
  const s = score(row);

  tags.push(grade(row));
  if (hr >= 20) tags.push(`${hr} HR`);
  if (iso >= 0.220) tags.push("ISO Power");
  if (slg >= 0.500) tags.push("Slug Profile");
  if (s >= 75) tags.push("Pitcher Attack");
  if (!isEmptyValue(row.lineup)) tags.push(`#${row.lineup} Spot`);

  return tags.slice(0, 6);
}

function card(row) {
  const g = grade(row);

  return `
    <article class="pz-card" data-player="${escapeHtml(row.player || row.name || "")}">
      <div class="pz-card-top">
        ${photo(row)}
        <div>
          <h3>${escapeHtml(row.player || row.name || "Unknown Player")}</h3>
          <p>${escapeHtml(fmt(row.team, "Team"))} • #${escapeHtml(fmt(row.lineup, "-"))} Spot</p>
        </div>
        <span class="pz-grade">${g}</span>
      </div>

      <div class="pz-zone">⚡ ${escapeHtml(fmt(row.zone, "Power Zone"))}</div>

      <div class="pz-stat-grid">
        <div><span>HR</span><strong>${escapeHtml(fmt(row.hr))}</strong></div>
        <div><span>ISO</span><strong>${escapeHtml(decimal(row.iso, ".000"))}</strong></div>
        <div><span>SLG</span><strong>${escapeHtml(decimal(row.slg, ".000"))}</strong></div>
      </div>

      <div class="pz-pitcher">
        <span>Vs Today's Pitcher</span>
        <strong>${escapeHtml(fmt(row.pitcher, "Unknown Pitcher"))}</strong>
        <div class="pz-tags">
          <em>${escapeHtml(fmt(row.pitcher_hand, "P"))}</em>
          <em>ERA ${escapeHtml(fmt(row.era, "N/A"))}</em>
          <em>Odds ${escapeHtml(fmt(row.odds, "N/A"))}</em>
          <em>Score ${score(row).toFixed(1)}</em>
        </div>
      </div>

      <div class="pz-card-bottom">
        <small>${escapeHtml(fmt(row.game, ""))}</small>
        <button class="pz-profile" type="button">Profile</button>
      </div>
    </article>
  `;
}

function profileTags(row) {
  return tagList(row).map(tag => `<span>${escapeHtml(tag)}</span>`).join("");
}

function statCard(label, value, cls = "") {
  const clean = cleanValue(value);
  if (clean === "") return "";
  return `<div class="profile-stat ${cls}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(clean)}</strong></div>`;
}

function statLine(label, value) {
  const clean = cleanValue(value);
  if (clean === "") return "";
  return `<p class="profile-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(clean)}</strong></p>`;
}

function miniStat(label, value) {
  const clean = cleanValue(value);
  if (clean === "") return "";
  return `<div><strong>${escapeHtml(clean)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function openDrawer(row) {
  const player = row.player || row.name || "Unknown Player";
  const probability = hrProbability(row);
  const iso = decimal(row.iso);
  const slg = decimal(row.slg);
  const avg = decimal(row.avg);
  const obp = decimal(row.obp);
  const ops = decimal(row.ops);
  const hr = cleanValue(row.hr || row.home_runs, "0");
  const kRate = pct(row.k_rate || row.k_pct || row.strikeout_rate);
  const bbRate = pct(row.bb_rate || row.bb_pct || row.walk_rate);
  const season = fmt(row.stat_season, "2026");
  const pitcherSeason = fmt(row.pitcher_stat_season, "2026");
  const pitcher = fmt(row.pitcher, "Pitcher N/A");

  drawerContent.innerHTML = `
    <div class="profile-hero">
      ${photo(row, "large")}
      <div class="profile-title-block">
        <div class="profile-rank">#${escapeHtml(row.power_rank || "")} Power Zone</div>
        <h2>${escapeHtml(player)}</h2>
        <p>${escapeHtml(fmt(row.bat_side, "B"))}${row.position ? ` • ${escapeHtml(row.position)}` : ""} • #${escapeHtml(fmt(row.lineup, "-"))} Spot • vs ${escapeHtml(pitcher)} (${escapeHtml(fmt(row.pitcher_hand, "P"))})</p>
      </div>
      <div class="profile-score-card">
        <strong>${score(row).toFixed(1)}</strong>
        <span>Slip Score</span>
      </div>
    </div>

    <div class="profile-tag-row">${profileTags(row)}</div>

    <section class="profile-panel probability-panel">
      <div>
        <span>Projected HR Probability</span>
        <strong>${probability.toFixed(1)}%</strong>
        <p>Model estimate from player power, park context, pitcher vulnerability, handedness, and current slate rank.</p>
      </div>
      <em>${riskLabel(row)}</em>
    </section>

    <section class="profile-grid">
      ${statCard("ISO", iso, "violet")}
      ${statCard("SLG", slg, "orange")}
      ${statCard("HR", hr, "pink")}
      ${statCard("OPS", ops, "blue")}
      ${statCard("AVG", avg)}
      ${statCard("OBP", obp)}
      ${statCard("K%", kRate, "yellow")}
      ${statCard("BB%", bbRate, "blue")}
      ${statCard("Pitcher ERA", cleanValue(row.era), "orange")}
      ${statCard("Pitcher HR Allowed", cleanValue(row.pitcher_hr_allowed), "pink")}
      ${statCard("Weather", cleanValue(row.weather_label || row.condition), "blue")}
      ${statCard("Fair Odds", cleanValue(row.model_fair_odds || row.fair_odds), "yellow")}
    </section>

    <section class="profile-panel">
      <h3>Recent Form</h3>
      <div class="profile-mini-row">
        ${miniStat("HR Last 7", row.recent_hr || row.last_7_hr)}
        ${miniStat("AVG Last 7", row.recent_avg || row.last_7_avg)}
        ${miniStat("OPS Last 7", row.recent_ops || row.last_7_ops)}
      </div>
    </section>

    <section class="profile-split-panels">
      <div>
        <h3>This Year (${escapeHtml(season)})</h3>
        ${statLine("HR", hr)}
        ${statLine("AVG", avg)}
        ${statLine("OBP", obp)}
        ${statLine("SLG", slg)}
        ${statLine("ISO", iso)}
        ${statLine("OPS", ops)}
      </div>
      <div>
        <h3>Pitcher Profile (${escapeHtml(pitcherSeason)})</h3>
        ${statLine("Pitcher", pitcher)}
        ${statLine("Hand", row.pitcher_hand)}
        ${statLine("ERA", row.era)}
        ${statLine("HR Allowed", row.pitcher_hr_allowed)}
        ${statLine("Matchup", row.game)}
      </div>
    </section>

    <section class="profile-panel">
      <h3>Batting Spot Performance</h3>
      <div class="spot-card">
        <strong>Batting #${escapeHtml(fmt(row.lineup, "-"))}</strong>
        <p>Spot level production is ready for the next data layer. This section will connect to lineup spot splits, recent game logs, and confirmed lineup feeds.</p>
      </div>
    </section>

    <section class="pz-read profile-panel">
      <h3>Slip Lab Read</h3>
      <p>${escapeHtml(player)} ranks #${escapeHtml(row.power_rank || "")} on today’s board. The profile is powered by live MLB player stats, matchup strength against ${escapeHtml(pitcher)}, park context, and slate wide HR pressure. ${grade(row)} means this bat sits inside the strongest bucket for today’s live board.</p>
    </section>
  `;

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("pz-drawer-lock");
}

function render() {
  const rows = sortedRows(rankedRows.filter(matchRow));

  if (!rows.length) {
    grid.innerHTML = '<div class="pz-empty">No Power Zones match this search.</div>';
    return;
  }

  grid.innerHTML = rows.map(card).join("");

  document.querySelectorAll(".pz-card").forEach(cardEl => {
    cardEl.addEventListener("click", () => {
      const player = cardEl.getAttribute("data-player");
      const row = rankedRows.find(r => String(r.player || r.name) === player);
      if (row) openDrawer(row);
    });
  });
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("pz-drawer-lock");
}

async function loadData() {
  grid.innerHTML = '<div class="pz-empty">Loading Power Zones...</div>';
  updated.textContent = "Loading data";

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load power_zones.json");

    const data = await res.json();
    allRows = Array.isArray(data) ? data : data.rows || data.players || [];
    rankedRows = [...allRows]
      .sort((a, b) => score(b) - score(a))
      .map((row, index) => ({ ...row, power_rank: index + 1 }));

    updated.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    render();
  } catch (err) {
    console.error(err);
    updated.textContent = "Data error";
    grid.innerHTML = '<div class="pz-empty">Power Zones data could not load. Check data/power_zones.json.</div>';
  }
}

document.querySelectorAll(".pz-filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pz-filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = String(btn.dataset.filter || "ALL").toUpperCase();
    render();
  });
});

search.addEventListener("input", render);
sort.addEventListener("change", render);
refresh.addEventListener("click", loadData);
closeBtn.addEventListener("click", closeDrawer);
closeBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDrawer();
});

loadData();