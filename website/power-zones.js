
const DATA_URL = "./data/power_zones.json?ts=" + Date.now();

let allRows = [];
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

function fmt(value, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function decimal(value) {
  if (value === null || value === undefined || value === "") return ".000";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(3).replace(/^0/, "");
}

function pct(value) {
  if (value === null || value === undefined || value === "") return "0.0%";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(1) + "%";
}

function score(row) {
  const n = Number(row.score || row.slip_score || row.power_score || 0);
  return Number.isFinite(n) ? n : 0;
}

function grade(row) {
  return String(row.grade || row.tier || row.raw_tier || "CORE").toUpperCase();
}

function headshot(row) {
  return row.headshot_url || row.headshot || row.player_image || row.mlb_headshot_url || "";
}

function photo(row, size = "small") {
  const url = headshot(row);
  const fallback = initials(row.player || row.name);

  if (!url) return '<div class="pz-avatar ' + size + '">' + fallback + '</div>';

  return '<div class="pz-photo-wrap ' + size + '"><img src="' + url + '" alt="' + (row.player || "Player") + '" onerror="this.parentElement.outerHTML=\'<div class=&quot;pz-avatar ' + size + '&quot;>' + fallback + '</div>\'"></div>';
}

function matchRow(row) {
  const q = search.value.trim().toLowerCase();
  const g = grade(row);

  if (activeFilter !== "ALL" && g !== activeFilter) return false;
  if (!q) return true;

  return [
    row.player,
    row.name,
    row.team,
    row.opponent,
    row.pitcher,
    row.venue,
    row.game
  ].some(value => String(value || "").toLowerCase().includes(q));
}

function sortedRows(rows) {
  const key = sort.value;

  return [...rows].sort((a, b) => {
    if (key === "hr") return Number(b.hr || 0) - Number(a.hr || 0);
    if (key === "iso") return Number(b.iso || 0) - Number(a.iso || 0);
    if (key === "slg") return Number(b.slg || 0) - Number(a.slg || 0);
    return score(b) - score(a);
  });
}

function card(row) {
  const g = grade(row);

  return `
    <article class="pz-card" data-player="${row.player || row.name || ""}">
      <div class="pz-card-top">
        ${photo(row)}
        <div>
          <h3>${row.player || row.name || "Unknown Player"}</h3>
          <p>${row.team || "Team"} • #${fmt(row.lineup, "-")} Spot</p>
        </div>
        <span class="pz-grade">${g}</span>
      </div>

      <div class="pz-zone">⚡ ${fmt(row.zone, "Power Zone")}</div>

      <div class="pz-stat-grid">
        <div><span>HR</span><strong>${fmt(row.hr)}</strong></div>
        <div><span>ISO</span><strong>${decimal(row.iso)}</strong></div>
        <div><span>SLG</span><strong>${decimal(row.slg)}</strong></div>
      </div>

      <div class="pz-pitcher">
        <span>Vs Today's Pitcher</span>
        <strong>${fmt(row.pitcher, "Unknown Pitcher")}</strong>
        <div class="pz-tags">
          <em>${fmt(row.pitcher_hand, "P")}</em>
          <em>${fmt(row.era, "ERA N/A")}</em>
          <em>${fmt(row.odds, "Odds N/A")}</em>
          <em>Score ${score(row).toFixed(1)}</em>
        </div>
      </div>

      <div class="pz-card-bottom">
        <small>${fmt(row.game, "")}</small>
        <button class="pz-profile">Profile</button>
      </div>
    </article>
  `;
}

function render() {
  const rows = sortedRows(allRows.filter(matchRow));

  if (!rows.length) {
    grid.innerHTML = '<div class="pz-empty">No Power Zones match this search.</div>';
    return;
  }

  grid.innerHTML = rows.map(card).join("");

  document.querySelectorAll(".pz-card").forEach(cardEl => {
    cardEl.addEventListener("click", () => {
      const player = cardEl.getAttribute("data-player");
      const row = allRows.find(r => String(r.player || r.name) === player);
      if (row) openDrawer(row);
    });
  });
}

function openDrawer(row) {
  drawerContent.innerHTML = `
    <div class="pz-drawer-head">
      ${photo(row, "large")}
      <div>
        <h2>${row.player || row.name}</h2>
        <p>${row.team || ""} • ${grade(row)} • vs ${row.pitcher || "Pitcher N/A"}</p>
      </div>
      <strong class="pz-drawer-score">${score(row).toFixed(1)}</strong>
    </div>

    <div class="pz-drawer-stats">
      <div><span>ISO</span><strong>${decimal(row.iso)}</strong></div>
      <div><span>SLG</span><strong>${decimal(row.slg)}</strong></div>
      <div><span>HR</span><strong>${fmt(row.hr)}</strong></div>
      <div><span>Odds</span><strong>${fmt(row.odds, "N/A")}</strong></div>
      <div><span>Barrel</span><strong>${pct(row.barrel_pct)}</strong></div>
      <div><span>Hard Hit</span><strong>${pct(row.hard_hit_pct)}</strong></div>
    </div>

    <section class="pz-read">
      <h3>Slip Lab Read</h3>
      <p>${row.player || row.name} grades as ${grade(row)} with a Slip Score of ${score(row).toFixed(1)}. The profile is built from power output, matchup strength, pitcher vulnerability, odds context, and game environment.</p>
    </section>
  `;

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

async function loadData() {
  grid.innerHTML = '<div class="pz-empty">Loading Power Zones...</div>';
  updated.textContent = "Loading data";

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load power_zones.json");

    const data = await res.json();
    allRows = Array.isArray(data) ? data : data.rows || data.players || [];

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
    activeFilter = btn.dataset.filter;
    render();
  });
});

search.addEventListener("input", render);
sort.addEventListener("change", render);
refresh.addEventListener("click", loadData);
closeBtn.addEventListener("click", closeDrawer);
closeBackdrop.addEventListener("click", closeDrawer);

loadData();
