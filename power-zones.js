const DATA_CANDIDATES = [
  "./data/power_zones.json",
  "./data/top_hr_plays.json",
  "./data/value_hr_plays.json",
  "./data/slate_intelligence.json"
];

let allPlayers = [];
let activeFilter = "ALL";
let activePlayer = null;
let activeTab = "overview";

const grid = document.getElementById("cardsGrid");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const updatedAt = document.getElementById("updatedAt");
const modal = document.getElementById("modalBackdrop");

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) < 1 && n !== 0) return n.toFixed(digits).replace(/^0/, "");
  return n.toFixed(digits);
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return n.toFixed(1) + "%";
}

function odds(value) {
  if (!value && value !== 0) return "N/A";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n > 0 ? "+" + n : String(n);
}

function cleanText(value) {
  return String(value || "").trim();
}

function getPlayerName(row) {
  return cleanText(row.player || row.name || row.batter || row.hitter || row.player_name || "Unknown Player");
}

function getTeam(row) {
  return cleanText(row.team || row.player_team || row.abbr || row.team_abbr || "");
}

function getPitcher(row) {
  return cleanText(row.pitcher || row.opposing_pitcher || row.probable_pitcher || row.starter || "Unknown Pitcher");
}

function getGame(row) {
  return cleanText(row.game || row.matchup || row.game_label || row.away_home || "");
}

function getPark(row) {
  return cleanText(row.venue || row.park || row.ballpark || row.stadium || "");
}

function getScore(row) {
  return num(
    row.score ??
    row.final_score ??
    row.hr_score ??
    row.model_score ??
    row.power_score ??
    row.consensus_score ??
    row.rating ??
    row.rank_score,
    50
  );
}

function getIso(row) {
  return num(
    row.iso ??
    row.ISO ??
    row.player_iso ??
    row.season_iso ??
    row.recent_iso ??
    row.iso_2026 ??
    row.hitter_iso,
    0
  );
}

function getSlg(row) {
  return num(
    row.slg ??
    row.SLG ??
    row.player_slg ??
    row.season_slg ??
    row.recent_slg ??
    row.slg_2026 ??
    row.hitter_slg,
    0
  );
}

function getHr(row) {
  return num(
    row.hr ??
    row.HR ??
    row.season_hr ??
    row.home_runs ??
    row.hr_2026 ??
    row.hitter_hr ??
    row.recent_hr,
    0
  );
}

function getGrade(row) {
  const raw = cleanText(row.tier || row.label || row.grade || row.bucket || row.tag || row.play_type || "").toUpperCase();
  const score = getScore(row);
  const oddsNumber = num(row.odds ?? row.best_odds ?? row.hr_odds, 0);

  if (raw.includes("CORE") || raw.includes("ELITE") || raw.includes("SAFEST") || score >= 78) return "CORE";
  if (raw.includes("DANGER") || raw.includes("BAD") || raw.includes("TRAP") || raw.includes("FADE")) return "DANGER";
  if (raw.includes("VALUE") || raw.includes("EDGE") || raw.includes("PLUS") || score >= 68 || oddsNumber >= 450) return "VALUE";
  if (raw.includes("SLEEPER") || raw.includes("LOTTO") || raw.includes("LONG")) return "SLEEPER";

  return "VALUE";
}

function getZone(row) {
  const zone = cleanText(row.zone || row.best_zone || row.hot_zone || "");
  if (zone) return zone;
  const score = Math.max(5, Math.min(9, Math.round(getScore(row) / 10)));
  return score + " zone";
}

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function headshotUrl(player) {
  if (!player?.mlbam) return "";
  return "https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/" + player.mlbam + "/headshot/67/current";
}

function playerAvatar(player, size = "card") {
  const url = headshotUrl(player);
  const fallback = initials(player.player);

  if (!url) {
    return `<div class="player-photo-fallback ${size}">${fallback}</div>`;
  }

  return `
    <div class="player-photo-wrap ${size}">
      <img
        class="player-photo"
        src="${url}"
        alt="${player.player}"
        loading="lazy"
        onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\'player-photo-fallback ${size}\'>${fallback}</div>';"
      />
    </div>
  `;
}

function normalizeRow(row, index) {
  return {
    id: index + "-" + getPlayerName(row).replace(/\s+/g, "_"),
    raw: row,
    player: getPlayerName(row),
    team: getTeam(row),
    pitcher: getPitcher(row),
    game: getGame(row),
    park: getPark(row),
    score: getScore(row),
    iso: getIso(row),
    slg: getSlg(row),
    hr: getHr(row),
    odds: row.odds ?? row.best_odds ?? row.hr_odds ?? "",
    grade: getGrade(row),
    zone: getZone(row),
    handedness: cleanText(row.handedness || row.bats || row.batter_hand || ""),
    lineup: cleanText(row.lineup || row.lineup_spot || row.batting_order || ""),
    pitcherHand: cleanText(row.pitcher_hand || row.p_hand || row.throws || row.pitcher_throws || row.starter_hand || ""),
    era: cleanText(row.era || row.pitcher_era || row.starter_era || row.opposing_pitcher_era || ""),
    weather: cleanText(row.weather_label || row.weather || row.weather_boost_label || row.environment || ""),
    wind: cleanText(row.wind_text || row.wind || row.wind_label || ""),
    barrel: num(row.barrel_pct ?? row.barrel_percent ?? row.barrel ?? row.barrel_rate ?? row.barrelPct, 0),
    hardhit: num(row.hard_hit_pct ?? row.hardhit_pct ?? row.hard_hit ?? row.hard_hit_rate ?? row.hardHitPct, 0),
    xwoba: num(row.xwoba ?? row.xwOBA ?? row.expected_woba ?? row.xwoba_value, 0),
    ev: num(row.ev ?? row.edge ?? row.expected_value ?? row.value_edge ?? row.model_edge, 0),
    rank: index + 1
  };
}

async function readJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    return Array.isArray(payload)
      ? payload
      : payload.rows || payload.players || payload.data || payload.plays || payload.games || [];
  } catch {
    return [];
  }
}

function keyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function playerKey(row) {
  return keyName(row.player || row.name || row.batter || row.hitter || row.player_name);
}

function gameKey(row) {
  return keyName(row.game || row.matchup || row.game_label || row.away_home || row.away_team + row.home_team);
}

function mergeRows(base, extra) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(extra || {})) {
    const current = merged[key];
    const missing =
      current === undefined ||
      current === null ||
      current === "" ||
      current === "N/A" ||
      current === 0 ||
      current === "0" ||
      current === "0.000";

    if (missing && value !== undefined && value !== null && value !== "") {
      merged[key] = value;
    }
  }

  return merged;
}

async function loadMergedRows() {
  const allFiles = await Promise.all(DATA_CANDIDATES.map(readJson));

  const primary = [
    ...allFiles[0],
    ...allFiles[1],
    ...allFiles[2]
  ];

  const extras = allFiles.flat();

  const byPlayer = new Map();
  const byGame = new Map();

  for (const row of extras) {
    const pk = playerKey(row);
    const gk = gameKey(row);

    if (pk) byPlayer.set(pk, mergeRows(byPlayer.get(pk) || {}, row));
    if (gk) byGame.set(gk, mergeRows(byGame.get(gk) || {}, row));
  }

  const seen = new Set();
  const merged = [];

  for (const row of primary) {
    const pk = playerKey(row);
    if (!pk || seen.has(pk)) continue;

    let next = { ...row };

    if (byPlayer.has(pk)) next = mergeRows(next, byPlayer.get(pk));

    const gk = gameKey(next);
    if (gk && byGame.has(gk)) next = mergeRows(next, byGame.get(gk));

    merged.push(next);
    seen.add(pk);
  }

  return merged;
}

async function loadData() {
  const rows = await loadMergedRows();

  let normalized = rows
    .map(normalizeRow)
    .filter(player => player.player !== "Unknown Player");

  normalized.sort((a, b) => b.score - a.score);

  normalized = normalized.map((player, index) => {
    if (!player.raw.tier && !player.raw.label && !player.raw.grade && !player.raw.bucket && !player.raw.tag) {
      if (index < 10) player.grade = "CORE";
      else if (index < 25) player.grade = "VALUE";
      else if (index < 45) player.grade = "SLEEPER";
      else player.grade = "DANGER";
    }

    return player;
  });

  allPlayers = normalized;

  updatedAt.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  render();
}

function filteredPlayers() {
  const q = cleanText(searchInput.value).toLowerCase();

  let rows = allPlayers.filter(player => {
    const matchesFilter = activeFilter === "ALL" || player.grade === activeFilter;
    const haystack = [player.player, player.team, player.pitcher, player.game, player.park, player.grade].join(" ").toLowerCase();
    return matchesFilter && (!q || haystack.includes(q));
  });

  const sortBy = sortSelect.value;

  rows.sort((a, b) => {
    if (sortBy === "hr") return b.hr - a.hr;
    if (sortBy === "slg") return b.slg - a.slg;
    if (sortBy === "iso") return b.iso - a.iso;
    if (sortBy === "odds") return num(b.odds, -999) - num(a.odds, -999);
    return b.score - a.score;
  });

  return rows;
}

function gradeClass(grade) {
  return "grade-" + grade.toLowerCase();
}

function renderCard(player) {
  return `
    <article class="player-card">
      <div class="card-head">
        <div class="card-player-main">
          ${playerAvatar(player, "card")}
          <div>
            <div class="player-name" data-id="${player.id}">${player.player}</div>
            <div class="card-sub">${player.team} ${player.handedness ? "• " + player.handedness : ""} ${player.lineup ? "• #" + player.lineup + " Spot" : ""}</div>
          </div>
        </div>
        <div class="grade-pill ${gradeClass(player.grade)}">${player.grade}</div>
      </div>

      <div class="card-sub"><span class="zone-pill">⚡ ${player.zone}</span></div>

      <div class="stat-grid">
        <div class="stat"><span>HR</span><strong>${player.hr || "0"}</strong></div>
        <div class="stat"><span>ISO</span><strong>${fmt(player.iso)}</strong></div>
        <div class="stat"><span>SLG</span><strong>${fmt(player.slg)}</strong></div>
      </div>

      <div class="pitcher-box">
        <div class="box-label">VS TODAY'S PITCHER</div>
        <div class="pitcher-name">${player.pitcher}</div>
        <div class="pitcher-meta">
          <span class="mini">${player.pitcherHand || "P"}</span>
          <span class="mini">${player.era ? player.era + " ERA" : "ERA N/A"}</span>
          <span class="mini">${odds(player.odds)}</span>
          <span class="mini">Score ${player.score.toFixed(1)}</span>
        </div>
      </div>

      <div class="card-foot">
        <span>${player.game || player.park || "Today's slate"}</span>
        <button class="profile-btn" data-id="${player.id}">PROFILE</button>
      </div>
    </article>
  `;
}

function render() {
  const rows = filteredPlayers();

  if (!allPlayers.length) {
    grid.innerHTML = "<div style='color:#ff6b6b;padding:22px'>No player data loaded. Check top_hr_plays.json, value_hr_plays.json, and slate_intelligence.json.</div>";
    return;
  }

  if (!rows.length) {
    grid.innerHTML = "<div style='color:#ff6b6b;padding:22px'>No players match this filter. Click All or clear the search.</div>";
    return;
  }

  grid.innerHTML = rows.map(renderCard).join("");

  document.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("click", () => openPlayer(el.dataset.id));
  });
}

function openPlayer(id) {
  activePlayer = allPlayers.find(player => player.id === id);
  if (!activePlayer) return;

  activeTab = "overview";
  modal.classList.add("open");
  renderModal();
}

function renderModal() {
  const p = activePlayer;
  if (!p) return;

  document.getElementById("modalInitials").outerHTML = playerAvatar(p, "modal");
  document.getElementById("modalName").textContent = p.player;
  document.getElementById("modalSub").textContent = `${p.team} • ${p.grade} • vs ${p.pitcher}`;
  document.getElementById("modalBadge").textContent = p.score.toFixed(1);

  document.getElementById("modalMetrics").innerHTML = [
    ["ISO", fmt(p.iso)],
    ["SLG", fmt(p.slg)],
    ["HR", p.hr],
    ["ODDS", odds(p.odds)],
    ["BARREL", pct(p.barrel)],
    ["HARD HIT", pct(p.hardhit)],
    ["xWOBA", fmt(p.xwoba)],
    ["EV", pct(p.ev)]
  ].map(([label, value]) => `
    <div class="modal-metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === activeTab);
  });

  document.getElementById("tabContent").innerHTML = renderTab(p);
}

function renderTab(p) {
  if (activeTab === "matchup") {
    return `
      <div class="tab-card">
        <h3>Matchup Intelligence</h3>
        <div class="detail-grid">
          <div class="detail"><span>Pitcher</span><strong>${p.pitcher}</strong></div>
          <div class="detail"><span>Pitcher Hand</span><strong>${p.pitcherHand || "N/A"}</strong></div>
          <div class="detail"><span>Pitcher ERA</span><strong>${p.era || "N/A"}</strong></div>
          <div class="detail"><span>Game</span><strong>${p.game || "N/A"}</strong></div>
        </div>
        <p>This profile highlights whether the hitter power indicators line up with the opposing starter and game context.</p>
      </div>
    `;
  }

  if (activeTab === "power") {
    return `
      <div class="tab-card">
        <h3>Power Profile</h3>
        <div class="detail-grid">
          <div class="detail"><span>Home Runs</span><strong>${p.hr}</strong></div>
          <div class="detail"><span>ISO</span><strong>${fmt(p.iso)}</strong></div>
          <div class="detail"><span>SLG</span><strong>${fmt(p.slg)}</strong></div>
          <div class="detail"><span>Zone Tag</span><strong>${p.zone}</strong></div>
          <div class="detail"><span>Barrel</span><strong>${pct(p.barrel)}</strong></div>
          <div class="detail"><span>Hard Hit</span><strong>${pct(p.hardhit)}</strong></div>
        </div>
      </div>
    `;
  }

  if (activeTab === "weather") {
    return `
      <div class="tab-card">
        <h3>Environment</h3>
        <div class="detail-grid">
          <div class="detail"><span>Park</span><strong>${p.park || "N/A"}</strong></div>
          <div class="detail"><span>Weather</span><strong>${p.weather || "N/A"}</strong></div>
          <div class="detail"><span>Wind</span><strong>${p.wind || "N/A"}</strong></div>
          <div class="detail"><span>Game</span><strong>${p.game || "N/A"}</strong></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="tab-card">
      <h3>Slip Lab Read</h3>
      <p><strong>${p.player}</strong> grades as <strong>${p.grade}</strong> with a Slip Score of <strong>${p.score.toFixed(1)}</strong>. The profile is built from power output, matchup strength, pitcher vulnerability, odds context, and game environment.</p>
      <div class="detail-grid">
        <div class="detail"><span>Team</span><strong>${p.team || "N/A"}</strong></div>
        <div class="detail"><span>Lineup</span><strong>${p.lineup || "N/A"}</strong></div>
        <div class="detail"><span>Best Price</span><strong>${odds(p.odds)}</strong></div>
        <div class="detail"><span>Power Zone</span><strong>${p.zone}</strong></div>
      </div>
    </div>
  `;
}

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    render();
  });
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;
    renderModal();
  });
});

document.getElementById("closeModal").addEventListener("click", () => {
  modal.classList.remove("open");
});

modal.addEventListener("click", e => {
  if (e.target === modal) modal.classList.remove("open");
});

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
document.getElementById("refreshBtn").addEventListener("click", loadData);

loadData();
