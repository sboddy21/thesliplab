
const grid = document.getElementById("resultsGrid");
const lastUpdated = document.getElementById("lastUpdated");
const hrCount = document.getElementById("hrCount");
const feedStatus = document.getElementById("feedStatus");
const refreshBtn = document.getElementById("refreshResults");

function todayEt() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  return parts.find(p => p.type === "year").value + "-" +
    parts.find(p => p.type === "month").value + "-" +
    parts.find(p => p.type === "day").value;
}

function playerImg(id) {
  return id
    ? "https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/" + id + "/headshot/67/current"
    : "";
}

function hrCard(hr) {
  const img = playerImg(hr.playerId);

  return `
    <article class="hr-result-card">
      <div class="hr-player-top">
        <div class="hr-photo-wrap">
          ${img ? `<img src="${img}" alt="${hr.player}" onerror="this.style.display='none'">` : ""}
        </div>
        <div>
          <h3>${hr.player}</h3>
          <p>${hr.team} vs ${hr.opponent}</p>
        </div>
        <div class="hr-badge">HR</div>
      </div>

      <div class="hr-result-stats">
        <div><span>Inning</span><strong>${hr.inning}</strong></div>
        <div><span>Score</span><strong>${hr.score}</strong></div>
        <div><span>RBI</span><strong>${hr.rbi}</strong></div>
      </div>

      <p class="hr-description">${hr.description}</p>
      <p class="hr-venue">${hr.venue}</p>
    </article>
  `;
}

async function getSchedule() {
  const url = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + todayEt();
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return data?.dates?.[0]?.games || [];
}

async function getGameHr(game) {
  const feed = "https://statsapi.mlb.com/api/v1.1/game/" + game.gamePk + "/feed/live";
  const res = await fetch(feed, { cache: "no-store" });
  const data = await res.json();

  const plays = data?.liveData?.plays?.allPlays || [];
  const home = data?.gameData?.teams?.home?.name || "";
  const away = data?.gameData?.teams?.away?.name || "";
  const venue = data?.gameData?.venue?.name || "";

  const hrs = [];

  for (const play of plays) {
    const event = play?.result?.event || "";
    if (event !== "Home Run") continue;

    const batter = play?.matchup?.batter || {};
    const battingTeam = play?.about?.isTopInning ? away : home;
    const opponent = play?.about?.isTopInning ? home : away;

    hrs.push({
      player: batter.fullName || "Unknown Player",
      playerId: batter.id || "",
      team: battingTeam,
      opponent,
      venue,
      inning: (play?.about?.halfInning || "") + " " + (play?.about?.inning || ""),
      score: (play?.result?.awayScore ?? 0) + "-" + (play?.result?.homeScore ?? 0),
      rbi: play?.result?.rbi ?? "",
      description: play?.result?.description || "Home Run"
    });
  }

  return hrs;
}

async function loadHrResults() {
  try {
    feedStatus.textContent = "Live";
    grid.innerHTML = '<article class="hr-result-card">Loading live HR results...</article>';

    const games = await getSchedule();
    const all = [];

    for (const game of games) {
      const hrs = await getGameHr(game);
      all.push(...hrs);
    }

    lastUpdated.textContent = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });

    hrCount.textContent = all.length;

    if (!all.length) {
      grid.innerHTML = '<article class="hr-result-card">No home runs found yet from today\'s MLB live feed.</article>';
      return;
    }

    grid.innerHTML = all.map(hrCard).join("");
  } catch (err) {
    console.error(err);
    feedStatus.textContent = "Error";
    grid.innerHTML = '<article class="hr-result-card">Could not load live HR results from MLB Stats API.</article>';
  }
}

refreshBtn.addEventListener("click", loadHrResults);
loadHrResults();
setInterval(loadHrResults, 60000);
