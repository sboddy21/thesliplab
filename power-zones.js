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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name = "") {
  return String(name).split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "TSL";
}

function isBlank(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  return !text || ["#", "-", "--", "n/a", "na", "nan", "null", "undefined", "pending", "live pending"].includes(text.toLowerCase());
}

function clean(value, fallback = "") {
  if (isBlank(value)) return isBlank(fallback) ? "" : fallback;
  return String(value).trim();
}

function fmt(value, fallback = "0") {
  return clean(value, fallback);
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : fallback;
}

function decimal(value) {
  if (isBlank(value)) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return clean(value);
  return n.toFixed(3).replace(/^0/, "");
}

function pct(value) {
  if (isBlank(value)) return "";
  const n = num(value, NaN);
  if (!Number.isFinite(n)) return clean(value);
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
  const wh = size === "large" ? 78 : 54;
  const base = `width:${wh}px;height:${wh}px;border-radius:999px;overflow:hidden;display:grid;place-items:center;flex:0 0 auto;background:#10ffcf;color:#04100a;font-weight:950;`;
  if (!url) return `<div style="${base}">${fallback}</div>`;
  return `<div style="${base}"><img src="${escapeHtml(url)}" alt="${escapeHtml(row.player || "Player")}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='${fallback}'"></div>`;
}

function matchRow(row) {
  const q = search.value.trim().toLowerCase();
  if (activeFilter !== "ALL" && grade(row) !== activeFilter) return false;
  if (!q) return true;
  return [row.player, row.name, row.team, row.opponent, row.pitcher, row.venue, row.game].some(value => String(value || "").toLowerCase().includes(q));
}

function sortedRows(rows) {
  const key = sort.value;
  return [...rows].sort((a, b) => {
    if (key === "hr") return num(b.hr) - num(a.hr);
    if (key === "iso") return num(b.iso) - num(a.iso);
    if (key === "slg") return num(b.slg) - num(a.slg);
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
  const iso = num(row.iso);
  const slg = num(row.slg);
  const hr = num(row.hr || row.home_runs);
  const s = score(row);
  tags.push(grade(row));
  if (hr >= 20) tags.push(`${hr} HR`);
  if (iso >= 0.220) tags.push("ISO Power");
  if (slg >= 0.500) tags.push("Slug Profile");
  if (s >= 75) tags.push("Pitcher Attack");
  if (!isBlank(row.lineup)) tags.push(`#${row.lineup} Spot`);
  return tags.slice(0, 6);
}

function card(row) {
  return `
    <article class="pz-card" data-player="${escapeHtml(row.player || row.name || "")}">
      <div class="pz-card-top">
        ${photo(row)}
        <div>
          <h3>${escapeHtml(row.player || row.name || "Unknown Player")}</h3>
          <p>${escapeHtml(fmt(row.team, "Team"))} • #${escapeHtml(fmt(row.lineup, "-"))} Spot</p>
        </div>
        <span class="pz-grade">${grade(row)}</span>
      </div>
      <div class="pz-zone">⚡ ${escapeHtml(fmt(row.zone, "Power Zone"))}</div>
      <div class="pz-stat-grid">
        <div><span>HR</span><strong>${escapeHtml(fmt(row.hr))}</strong></div>
        <div><span>ISO</span><strong>${escapeHtml(decimal(row.iso) || ".000")}</strong></div>
        <div><span>SLG</span><strong>${escapeHtml(decimal(row.slg) || ".000")}</strong></div>
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

function tagChip(tag) {
  return `<span style="display:inline-flex;align-items:center;border:1px solid rgba(16,255,124,.32);background:rgba(16,255,124,.1);color:#10ff7c;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:950;margin:0 7px 7px 0;">${escapeHtml(tag)}</span>`;
}

function statBox(label, value) {
  const v = clean(value);
  if (!v) return "";
  return `<div style="border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);border-radius:14px;padding:13px;min-width:0;"><span style="display:block;color:rgba(255,255,255,.55);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">${escapeHtml(label)}</span><strong style="display:block;color:#fff;font-size:18px;font-weight:950;word-break:break-word;">${escapeHtml(v)}</strong></div>`;
}

function line(label, value) {
  const v = clean(value);
  if (!v) return "";
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-top:1px solid rgba(255,255,255,.08);padding:9px 0;"><span style="display:block;color:rgba(255,255,255,.6);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;">${escapeHtml(label)}</span><strong style="display:block;color:#fff;font-size:15px;font-weight:950;text-align:right;word-break:break-word;">${escapeHtml(v)}</strong></div>`;
}

function panel(title, body) {
  return `<section style="border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.28);border-radius:18px;padding:18px;margin-top:16px;"><h3 style="margin:0 0 12px;color:#fff;font-size:18px;font-weight:950;">${escapeHtml(title)}</h3>${body}</section>`;
}

function mini(label, value) {
  const v = clean(value);
  if (!v) return "";
  return `<div style="border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);border-radius:14px;padding:13px;"><strong style="display:block;color:#fff;font-size:18px;font-weight:950;">${escapeHtml(v)}</strong><span style="display:block;margin-top:5px;color:rgba(255,255,255,.55);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(label)}</span></div>`;
}

function openDrawer(row) {
  const player = row.player || row.name || "Unknown Player";
  const probability = hrProbability(row);
  const iso = decimal(row.iso);
  const slg = decimal(row.slg);
  const avg = decimal(row.avg);
  const obp = decimal(row.obp);
  const ops = decimal(row.ops);
  const hr = clean(row.hr || row.home_runs, "0");
  const kRate = pct(row.k_rate || row.k_pct || row.strikeout_rate);
  const bbRate = pct(row.bb_rate || row.bb_pct || row.walk_rate);
  const season = fmt(row.stat_season, "2026");
  const pitcherSeason = fmt(row.pitcher_stat_season, "2026");
  const pitcher = fmt(row.pitcher, "Pitcher N/A");
  const recent = [mini("HR Last 7", row.recent_hr || row.last_7_hr), mini("AVG Last 7", row.recent_avg || row.last_7_avg), mini("OPS Last 7", row.recent_ops || row.last_7_ops)].join("") || `<p style="margin:0;color:rgba(255,255,255,.66);font-weight:750;">Recent form data is still building from live game logs.</p>`;

  drawerContent.innerHTML = `
    <div style="display:grid;grid-template-columns:82px minmax(0,1fr) 98px;gap:16px;align-items:center;margin-bottom:18px;">
      ${photo(row, "large")}
      <div style="min-width:0;">
        <div style="color:rgba(255,255,255,.72);font-weight:950;font-size:13px;margin-bottom:8px;">#${escapeHtml(row.power_rank || "")} Power Zone</div>
        <h2 style="margin:0 0 8px;font-size:32px;line-height:1;color:#fff;">${escapeHtml(player)}</h2>
        <p style="margin:0;color:rgba(255,255,255,.7);font-weight:850;line-height:1.45;">${escapeHtml(fmt(row.bat_side, "B"))}${row.position ? ` • ${escapeHtml(row.position)}` : ""} • #${escapeHtml(fmt(row.lineup, "-"))} Spot • vs ${escapeHtml(pitcher)} (${escapeHtml(fmt(row.pitcher_hand, "P"))})</p>
      </div>
      <div style="border:1px solid rgba(255,92,147,.42);background:rgba(255,92,147,.12);border-radius:18px;padding:12px;text-align:center;"><strong style="display:block;color:#ff5c93;font-size:25px;">${score(row).toFixed(1)}</strong><span style="display:block;margin-top:3px;color:rgba(255,255,255,.68);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;">Slip Score</span></div>
    </div>

    <div style="display:flex;flex-wrap:wrap;margin-bottom:16px;">${tagList(row).map(tagChip).join("")}</div>

    <section style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.28);border-radius:18px;padding:18px;margin-top:16px;">
      <div>
        <span style="display:block;color:rgba(255,255,255,.58);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.09em;">Projected HR Probability</span>
        <strong style="display:block;margin-top:6px;color:#fff;font-size:26px;">${probability.toFixed(1)}%</strong>
        <p style="margin:10px 0 0;color:rgba(255,255,255,.78);font-weight:750;line-height:1.55;">Model estimate from player power, park context, pitcher vulnerability, handedness, and current slate rank.</p>
      </div>
      <em style="font-style:normal;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);border-radius:999px;padding:8px 11px;color:#fff;font-weight:950;">${riskLabel(row)}</em>
    </section>

    <section style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px;">
      ${statBox("ISO", iso)}${statBox("SLG", slg)}${statBox("HR", hr)}${statBox("OPS", ops)}${statBox("AVG", avg)}${statBox("OBP", obp)}${statBox("K%", kRate)}${statBox("BB%", bbRate)}${statBox("Pitcher ERA", row.era)}${statBox("Pitcher HR Allowed", row.pitcher_hr_allowed)}${statBox("Weather", row.weather_label || row.condition)}${statBox("Fair Odds", row.model_fair_odds || row.fair_odds)}
    </section>

    ${panel("Recent Form", `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">${recent}</div>`)}

    <section style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px;">
      <div style="border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.28);border-radius:18px;padding:18px;"><h3 style="margin:0 0 12px;color:#fff;font-size:18px;">This Year (${escapeHtml(season)})</h3>${line("HR", hr)}${line("AVG", avg)}${line("OBP", obp)}${line("SLG", slg)}${line("ISO", iso)}${line("OPS", ops)}</div>
      <div style="border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.28);border-radius:18px;padding:18px;"><h3 style="margin:0 0 12px;color:#fff;font-size:18px;">Pitcher Profile (${escapeHtml(pitcherSeason)})</h3>${line("Pitcher", pitcher)}${line("Hand", row.pitcher_hand)}${line("ERA", row.era)}${line("HR Allowed", row.pitcher_hr_allowed)}${line("Matchup", row.game)}</div>
    </section>

    ${panel("Batting Spot Performance", `<strong style="display:block;color:#ff8a2a;font-size:17px;">Batting #${escapeHtml(fmt(row.lineup, "-"))}</strong><p style="margin:10px 0 0;color:rgba(255,255,255,.78);font-weight:750;line-height:1.55;">Spot level production is ready for the next data layer. This section will connect to lineup spot splits, recent game logs, and confirmed lineup feeds.</p>`)}
    ${panel("Slip Lab Read", `<p style="margin:0;color:rgba(255,255,255,.78);font-weight:750;line-height:1.55;">${escapeHtml(player)} ranks #${escapeHtml(row.power_rank || "")} on today’s board. The profile is powered by live MLB player stats, matchup strength against ${escapeHtml(pitcher)}, park context, and slate wide HR pressure. ${grade(row)} means this bat sits inside the strongest bucket for today’s live board.</p>`)}
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
    rankedRows = [...allRows].sort((a, b) => score(b) - score(a)).map((row, index) => ({ ...row, power_rank: index + 1 }));
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
