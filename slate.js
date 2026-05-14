let ALL_ROWS = [];
let ACTIVE_FILTER = "all";
let ACTIVE_GAME = "all";
let SEARCH = "";

const DATA_URLS = [
  "./data/top_hr_plays.json",
  "./data/top_plays.json",
  "./data/hr_board.json",
  "./data/master_hr_model.json",
  "./data/consensus_engine.json",
  "./data/hr_sweep_board_all_games.json"
];

async function getFirstJson() {
  let merged = [];

  for (const url of DATA_URLS) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;

      const data = await response.json();
      const rows = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : [];

      if (rows.length) {
        merged = merged.concat(rows);
      }
    } catch {}
  }

  return dedupeRows(merged);
}

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    const key = [
      getPlayer(row),
      getTeam(row),
      getPitcher(row),
      getGame(row)
    ].join("|").toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalizeRow(row));
  }

  return out;
}

function normalizeRow(row) {
  const score = getScore(row);

  return {
    raw: row,
    player: getPlayer(row),
    team: getTeam(row),
    pitcher: getPitcher(row),
    game: getGame(row),
    odds: clean(row.odds || row.best_odds || row.price || row.line || ""),
    score,
    ev: num(row.ev || row.edge || row.value_score || row.ev_percent || 0),
    barrel: num(row.barrel_rate || row.barrel_pct || row.barrel || row.brl || 0),
    hardHit: num(row.hard_hit_rate || row.hh_pct || row.hard_hit || row.hh || 0),
    park: num(row.park_score || row.park_factor_score || row.park_boost || 0),
    weather: num(row.weather_score || row.weather_boost || row.wind_boost || 0),
    hand: clean(row.pitcher_hand || row.hand || row.p_throws || ""),
    era: clean(row.pitcher_era || row.era || ""),
    tags: []
  };
}

function getScore(row) {
  const candidates = [
    row.score,
    row.final_score,
    row.model_score,
    row.hr_score,
    row.consensus_score,
    row.prob,
    row.probability
  ];

  for (const value of candidates) {
    const n = num(value, null);
    if (n !== null && n > 0) return n;
  }

  return 50;
}

function getPlayer(row) {
  return clean(row.player || row.name || row.batter || row.player_name || "Unknown Player");
}

function getTeam(row) {
  return clean(row.team || row.player_team || row.batting_team || "");
}

function getPitcher(row) {
  return clean(row.pitcher || row.opposing_pitcher || row.probable_pitcher || row.sp || "Unknown Pitcher");
}

function getGame(row) {
  return clean(row.game || row.matchup || row.game_label || "");
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : fallback;
}

function clean(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function shortTeam(team) {
  const map = {
    "New York Yankees": "NYY",
    "New York Mets": "NYM",
    "Boston Red Sox": "BOS",
    "Toronto Blue Jays": "TOR",
    "Baltimore Orioles": "BAL",
    "Tampa Bay Rays": "TB",
    "Detroit Tigers": "DET",
    "Cleveland Guardians": "CLE",
    "Kansas City Royals": "KC",
    "Minnesota Twins": "MIN",
    "Chicago White Sox": "CWS",
    "Houston Astros": "HOU",
    "Texas Rangers": "TEX",
    "Seattle Mariners": "SEA",
    "Athletics": "ATH",
    "Los Angeles Angels": "LAA",
    "Philadelphia Phillies": "PHI",
    "Atlanta Braves": "ATL",
    "Miami Marlins": "MIA",
    "Washington Nationals": "WSH",
    "Chicago Cubs": "CHC",
    "Milwaukee Brewers": "MIL",
    "St. Louis Cardinals": "STL",
    "Cincinnati Reds": "CIN",
    "Pittsburgh Pirates": "PIT",
    "Los Angeles Dodgers": "LAD",
    "San Diego Padres": "SD",
    "San Francisco Giants": "SF",
    "Arizona Diamondbacks": "ARI",
    "Colorado Rockies": "COL"
  };

  return map[team] || team;
}

function makeTags(row) {
  const tags = [];

  if (row.score >= 82) tags.push(["CORE", "core"]);
  if (row.score >= 70) tags.push(["DANGER", "danger"]);
  if (row.score >= 60 && row.score < 70) tags.push(["WATCH", "danger"]);
  if (row.ev > 0) tags.push(["VALUE", "value"]);
  if (row.barrel >= 12) tags.push(["BRL 12+", "hot"]);
  if (row.hardHit >= 50) tags.push(["HH 50+", "crusher"]);
  if (row.park > 0) tags.push(["PARK", "value"]);
  if (row.weather > 0) tags.push(["WEATHER", "hot"]);
  if (String(row.odds).includes("+")) tags.push([String(row.odds), "value"]);

  if (!tags.length) tags.push(["MODEL", "danger"]);

  return tags.slice(0, 6);
}

function hydrateTags(rows) {
  return rows.map(row => ({
    ...row,
    tags: makeTags(row)
  }));
}

function rowMatchesFilter(row) {
  if (ACTIVE_FILTER === "all") return true;

  if (ACTIVE_FILTER === "core") return row.score >= 82;
  if (ACTIVE_FILTER === "danger") return row.score >= 70;
  if (ACTIVE_FILTER === "value") return row.ev > 0 || String(row.odds).includes("+");
  if (ACTIVE_FILTER === "stack") return pitcherGroupCount(row.pitcher) >= 3;
  if (ACTIVE_FILTER === "weather") return row.weather > 0;

  return true;
}

function pitcherGroupCount(pitcher) {
  return ALL_ROWS.filter(row => row.pitcher === pitcher).length;
}

function rowMatchesGame(row) {
  if (ACTIVE_GAME === "all") return true;
  return row.game === ACTIVE_GAME;
}

function rowMatchesSearch(row) {
  if (!SEARCH) return true;

  const haystack = [
    row.player,
    row.team,
    row.pitcher,
    row.game,
    row.odds
  ].join(" ").toLowerCase();

  return haystack.includes(SEARCH.toLowerCase());
}

function filteredRows() {
  return ALL_ROWS
    .filter(rowMatchesFilter)
    .filter(rowMatchesGame)
    .filter(rowMatchesSearch)
    .sort((a, b) => b.score - a.score);
}

function groupByPitcher(rows) {
  const groups = new Map();

  for (const row of rows) {
    if (!groups.has(row.pitcher)) groups.set(row.pitcher, []);
    groups.get(row.pitcher).push(row);
  }

  return [...groups.entries()]
    .map(([pitcher, bats]) => {
      const avgScore = bats.reduce((sum, row) => sum + row.score, 0) / Math.max(bats.length, 1);
      const best = Math.max(...bats.map(row => row.score));
      return {
        pitcher,
        bats: bats.sort((a, b) => b.score - a.score).slice(0, 8),
        vuln: Math.round((avgScore * .55) + (best * .45))
      };
    })
    .sort((a, b) => b.vuln - a.vuln);
}

function renderTop(rows) {
  const groups = groupByPitcher(rows);
  const games = [...new Set(ALL_ROWS.map(row => row.game).filter(Boolean))];

  const avg = rows.reduce((sum, row) => sum + row.score, 0) / Math.max(rows.length, 1);

  document.getElementById("powerScore").textContent = Math.round(avg);
  document.getElementById("coreBats").textContent = ALL_ROWS.filter(row => row.score >= 82).length;
  document.getElementById("dangerBats").textContent = ALL_ROWS.filter(row => row.score >= 70).length;
  document.getElementById("valueLooks").textContent = ALL_ROWS.filter(row => row.ev > 0 || String(row.odds).includes("+")).length;
  document.getElementById("stackGames").textContent = groupByPitcher(ALL_ROWS).filter(group => group.bats.length >= 3).length;
  document.getElementById("slateGames").textContent = games.length || groupByPitcher(ALL_ROWS).length;

  document.getElementById("vulnList").innerHTML = groups.slice(0, 6).map((group, index) => `
    <div class="vuln-item" data-pitcher="${escapeAttr(group.pitcher)}">
      <div class="rank">#${index + 1}</div>
      <div>
        <div class="vuln-name">${safe(group.pitcher)}</div>
        <div class="vuln-sub">${group.bats.length} flagged bats</div>
      </div>
      <div class="vuln-score">${group.vuln}</div>
    </div>
  `).join("");

  document.querySelectorAll(".vuln-item").forEach(item => {
    item.addEventListener("click", () => {
      SEARCH = item.dataset.pitcher || "";
      document.getElementById("searchInput").value = SEARCH;
      render();
    });
  });
}

function renderGameTabs() {
  const games = ["all", ...new Set(ALL_ROWS.map(row => row.game).filter(Boolean))];

  document.getElementById("gameTabs").innerHTML = games.map(game => `
    <div class="game-tab ${ACTIVE_GAME === game ? "active" : ""}" data-game="${escapeAttr(game)}">
      ${game === "all" ? "All Games" : safe(game)}
    </div>
  `).join("");

  document.querySelectorAll(".game-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      ACTIVE_GAME = tab.dataset.game;
      render();
    });
  });
}

function renderCards(rows) {
  const groups = groupByPitcher(rows).slice(0, 12);

  document.getElementById("cardsGrid").innerHTML = groups.map(group => {
    const top = group.bats[0] || {};
    const game = top.game || "Slate matchup";
    const team = top.team || "";
    const hand = top.hand || "";
    const era = top.era || "--";

    return `
      <article class="match-card">
        <div class="match-main">
          <div>
            <div class="pitcher-line">
              <div class="avatar">${safe(initials(group.pitcher))}</div>
              <div>
                <div class="pitcher-name">${safe(group.pitcher)}</div>
                <div class="pitcher-meta">${safe(game)}</div>
              </div>
            </div>
          </div>

          <div class="vuln-box">${group.vuln}</div>
        </div>

        <div class="stat-strip">
          <div class="strip-stat">
            <label>Team</label>
            <strong>${safe(shortTeam(team))}</strong>
          </div>
          <div class="strip-stat">
            <label>Hand</label>
            <strong>${safe(hand || "--")}</strong>
          </div>
          <div class="strip-stat">
            <label>ERA</label>
            <strong>${safe(era || "--")}</strong>
          </div>
          <div class="strip-stat">
            <label>Bats</label>
            <strong>${group.bats.length}</strong>
          </div>
        </div>

        <div class="danger-zone">
          <div class="danger-title">Danger Bats</div>

          ${group.bats.map((row, index) => `
            <div class="batter">
              <div class="batter-rank">#${index + 1}</div>
              <div>
                <div class="batter-name">${safe(row.player)}</div>
                <div class="batter-note">${safe(row.team)}  •  ${safe(row.odds || "No odds")}</div>
                <div class="tag-wrap">
                  ${row.tags.map(([label, type]) => `<span class="tag tag-${type}">${safe(label)}</span>`).join("")}
                </div>
              </div>
              <div class="batter-score">${Math.round(row.score)}</div>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderFullBoard(rows) {
  document.getElementById("fullBoard").innerHTML = rows.slice(0, 100).map((row, index) => `
    <tr>
      <td class="rank">#${index + 1}</td>
      <td><strong>${safe(row.player)}</strong></td>
      <td>${safe(shortTeam(row.team))}</td>
      <td>${safe(row.pitcher)}</td>
      <td>${safe(row.game)}</td>
      <td>${safe(row.odds || "No odds")}</td>
      <td class="vuln-score">${Math.round(row.score)}</td>
      <td>
        <div class="tag-wrap">
          ${row.tags.map(([label, type]) => `<span class="tag tag-${type}">${safe(label)}</span>`).join("")}
        </div>
      </td>
    </tr>
  `).join("");
}

function render() {
  const rows = filteredRows();

  renderTop(rows);
  renderGameTabs();
  renderCards(rows);
  renderFullBoard(rows);
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

function escapeAttr(value) {
  return safe(value).replace(/"/g, "&quot;");
}

function setupControls() {
  document.querySelectorAll(".filter-pill").forEach(button => {
    button.addEventListener("click", () => {
      ACTIVE_FILTER = button.dataset.filter;

      document.querySelectorAll(".filter-pill").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      render();
    });
  });

  document.getElementById("searchInput").addEventListener("input", event => {
    SEARCH = event.target.value;
    render();
  });
}

function setupDate() {
  const now = new Date();

  document.getElementById("slateDate").textContent = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  document.getElementById("slateUpdated").textContent = "Updated " + now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

getFirstJson().then(rows => {
  ALL_ROWS = hydrateTags(rows);
  setupDate();
  setupControls();
  render();
}).catch(error => {
  console.error(error);
});
