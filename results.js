const grid = document.getElementById("resultsGrid");
const lastUpdated = document.getElementById("lastUpdated");
const gameCount = document.getElementById("gameCount");
const feedStatus = document.getElementById("feedStatus");
const refreshBtn = document.getElementById("refreshResults");

function todayEt() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;

  return `${y}-${m}-${d}`;
}

function statusClass(game) {
  const detailed = game?.status?.detailedState || "";
  const abstract = game?.status?.abstractGameState || "";

  if (abstract === "Live") return "live";
  if (abstract === "Final" || detailed.toLowerCase().includes("final")) return "final";
  return "";
}

function statusText(game) {
  const status = game?.status || {};
  const linescore = game?.linescore || {};

  if (status.abstractGameState === "Live") {
    const inning = linescore.currentInningOrdinal || "";
    const half = linescore.inningHalf || "";
    return `${half} ${inning}`.trim() || "Live";
  }

  return status.detailedState || status.abstractGameState || "Scheduled";
}

function recordText(team) {
  const leagueRecord = team?.leagueRecord;
  if (!leagueRecord) return "";
  return `${leagueRecord.wins || 0}-${leagueRecord.losses || 0}`;
}

function card(game) {
  const away = game.teams.away;
  const home = game.teams.home;

  const awayScore = away.score ?? 0;
  const homeScore = home.score ?? 0;

  const venue = game?.venue?.name || "";
  const note = game?.status?.abstractGameState === "Preview"
    ? new Date(game.gameDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : venue;

  return `
    <article class="result-card">
      <div class="result-top">
        <strong>${venue || "MLB Game"}</strong>
        <span class="status-pill ${statusClass(game)}">${statusText(game)}</span>
      </div>

      <div class="team-row">
        <div>
          <div class="team-name">${away.team.name}</div>
          <div class="team-record">${recordText(away)}</div>
        </div>
        <div class="team-score">${awayScore}</div>
      </div>

      <div class="team-row">
        <div>
          <div class="team-name">${home.team.name}</div>
          <div class="team-record">${recordText(home)}</div>
        </div>
        <div class="team-score">${homeScore}</div>
      </div>

      <div class="game-note">${note || ""}</div>
    </article>
  `;
}

async function loadResults() {
  try {
    feedStatus.textContent = "Live";
    grid.innerHTML = "";

    const date = todayEt();
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore,venue,probablePitcher`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) throw new Error("MLB feed failed");

    const data = await res.json();
    const games = data?.dates?.[0]?.games || [];

    gameCount.textContent = games.length;
    lastUpdated.textContent = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });

    if (!games.length) {
      grid.innerHTML = `<article class="result-card">No MLB games found for today.</article>`;
      return;
    }

    grid.innerHTML = games.map(card).join("");
  } catch (error) {
    feedStatus.textContent = "Error";
    grid.innerHTML = `<article class="result-card">Live MLB results could not load. Try refreshing.</article>`;
    console.error(error);
  }
}

refreshBtn.addEventListener("click", loadResults);

loadResults();
setInterval(loadResults, 60000);
