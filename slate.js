const DATA_URLS = [
  "./data/top_hr_plays.json",
  "./data/top_plays.json",
  "./data/hr_board.json",
  "./data/master_hr_model.json"
];

async function getFirstJson() {
  for (const url of DATA_URLS) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data) && data.length) return data;
      if (Array.isArray(data.rows) && data.rows.length) return data.rows;
    } catch {}
  }
  return [];
}

function num(value, fallback = 0) {
  const n = Number(value);
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
  const score = num(row.score || row.final_score || row.model_score);
  const odds = clean(row.odds || row.best_odds);
  const ev = num(row.ev || row.edge || row.value_score);
  const barrel = num(row.barrel_rate || row.barrel_pct || row.barrel);
  const hardHit = num(row.hard_hit_rate || row.hh_pct || row.hard_hit);

  if (score >= 80) tags.push(["CORE", "core"]);
  if (score >= 70) tags.push(["DANGER", "danger"]);
  if (ev > 0) tags.push(["VALUE", "value"]);
  if (barrel >= 12) tags.push(["BRL 12+", "hot"]);
  if (hardHit >= 50) tags.push(["HH 50+", "crusher"]);
  if (odds.includes("+")) tags.push([odds, "value"]);

  if (!tags.length) tags.push(["WATCH", "danger"]);
  return tags.slice(0, 5);
}

function groupByPitcher(rows) {
  const groups = new Map();

  for (const row of rows) {
    const pitcher = clean(row.pitcher || row.opposing_pitcher || row.probable_pitcher || "Unknown Pitcher");
    if (!groups.has(pitcher)) {
      groups.set(pitcher, []);
    }
    groups.get(pitcher).push(row);
  }

  return [...groups.entries()]
    .map(([pitcher, bats]) => {
      const avgScore = bats.reduce((sum, row) => sum + num(row.score || row.final_score || row.model_score), 0) / Math.max(bats.length, 1);
      return {
        pitcher,
        bats: bats
          .sort((a, b) => num(b.score || b.final_score || b.model_score) - num(a.score || a.final_score || a.model_score))
          .slice(0, 5),
        vuln: Math.round(avgScore || 50)
      };
    })
    .sort((a, b) => b.vuln - a.vuln)
    .slice(0, 8);
}

function render(rows) {
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

  const scored = rows.map(row => ({
    ...row,
    _score: num(row.score || row.final_score || row.model_score)
  }));

  const groups = groupByPitcher(scored);
  const games = [...new Set(scored.map(row => clean(row.game)).filter(Boolean))];

  document.getElementById("powerScore").textContent = Math.round(
    scored.reduce((sum, row) => sum + row._score, 0) / Math.max(scored.length, 1)
  );

  document.getElementById("coreBats").textContent = scored.filter(row => row._score >= 80).length;
  document.getElementById("dangerBats").textContent = scored.filter(row => row._score >= 70).length;
  document.getElementById("valueLooks").textContent = scored.filter(row => num(row.ev || row.edge || row.value_score) > 0).length;
  document.getElementById("stackGames").textContent = groups.filter(group => group.bats.length >= 3).length;
  document.getElementById("slateGames").textContent = games.length || groups.length;

  document.getElementById("vulnList").innerHTML = groups.slice(0, 5).map((group, index) => `
    <div class="vuln-item">
      <div class="rank">#${index + 1}</div>
      <div>
        <div class="vuln-name">${group.pitcher}</div>
        <div class="vuln-sub">${group.bats.length} flagged bats</div>
      </div>
      <div class="vuln-score">${group.vuln}</div>
    </div>
  `).join("");

  document.getElementById("gameTabs").innerHTML = games.slice(0, 12).map((game, index) => `
    <div class="game-tab ${index === 0 ? "active" : ""}">
      ${game}
    </div>
  `).join("");

  document.getElementById("cardsGrid").innerHTML = groups.slice(0, 10).map(group => {
    const top = group.bats[0] || {};
    const game = clean(top.game || "Slate matchup");
    const team = clean(top.team || "");
    const hand = clean(top.pitcher_hand || top.hand || "");
    const era = clean(top.pitcher_era || top.era || "--");
    const attack = group.vuln;

    return `
      <article class="match-card">
        <div class="match-main">
          <div>
            <div class="pitcher-line">
              <div class="avatar">${group.pitcher.split(" ").map(x => x[0]).join("").slice(0,2)}</div>
              <div>
                <div class="pitcher-name">${group.pitcher}</div>
                <div class="pitcher-meta">${game}</div>
              </div>
            </div>
          </div>

          <div class="vuln-box">${attack}</div>
        </div>

        <div class="stat-strip">
          <div class="strip-stat">
            <label>Team</label>
            <strong>${shortTeam(team)}</strong>
          </div>
          <div class="strip-stat">
            <label>Hand</label>
            <strong>${hand || "--"}</strong>
          </div>
          <div class="strip-stat">
            <label>ERA</label>
            <strong>${era}</strong>
          </div>
          <div class="strip-stat">
            <label>Bats</label>
            <strong>${group.bats.length}</strong>
          </div>
        </div>

        <div class="danger-zone">
          <div class="danger-title">Danger Bats</div>

          ${group.bats.map((row, index) => {
            const tags = makeTags(row);
            return `
              <div class="batter">
                <div class="batter-rank">#${index + 1}</div>
                <div>
                  <div class="batter-name">${clean(row.player || row.name)}</div>
                  <div class="batter-note">${clean(row.team)}  •  ${clean(row.odds || row.best_odds || "No odds")}</div>
                  <div class="tag-wrap">
                    ${tags.map(([label, type]) => `<span class="tag tag-${type}">${label}</span>`).join("")}
                  </div>
                </div>
                <div class="batter-score">${Math.round(num(row.score || row.final_score || row.model_score))}</div>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }).join("");
}

getFirstJson().then(rows => {
  render(rows);
}).catch(error => {
  console.error(error);
});
