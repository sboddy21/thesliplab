async function loadCSV(path) {
  const text = await fetch(path).then(r => r.text());

  const rows = [];
  let row = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && q && n === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      q = !q;
    } else if (c === "," && !q) {
      row.push(cur);
      cur = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && n === "\n") i++;
      row.push(cur);
      if (row.some(x => String(x).trim() !== "")) rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);
    if (row.some(x => String(x).trim() !== "")) rows.push(row);
  }

  const headers = rows.shift().map(h => h.trim());

  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = String(r[i] || "").trim());
    return obj;
  });
}

function num(v) {
  const n = Number(String(v || "").replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

function randomize(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function parlayCard(parlay, idx) {
  return `
    <article class="parlayCard">
      <div class="parlayTop">
        <div>
          <p class="eyebrow">Generated Parlay</p>
          <h2>#${idx + 1}</h2>
        </div>

        <div class="badge">${parlay.strategy}</div>
      </div>

      <div class="players">
        ${parlay.players.join("<br>")}
      </div>

      <div class="metrics">
        <div class="metric">
          <strong>${parlay.avgProb}%</strong>
          <span>Average HR Probability</span>
        </div>

        <div class="metric">
          <strong>${parlay.avgOdds}</strong>
          <span>Average Odds</span>
        </div>

        <div class="metric">
          <strong>${parlay.score}</strong>
          <span>Parlay Score</span>
        </div>

        <div class="metric">
          <strong>${parlay.games}</strong>
          <span>Games</span>
        </div>
      </div>
    </article>
  `;
}

let playerPool = [];

async function init() {
  const sim = await loadCSV("./data/simulation_engine.csv");

  playerPool = sim
    .filter(r => r.player)
    .map(r => ({
      name: r.player,
      team: r.team,
      game: r.game,
      pitcher: r.pitcher,
      odds: num(r.odds),
      prob: num(r.adjusted_hr_probability),
      score: num(r.composite_sim_score || r.consensus_score),
      ev: num(r.ev_percent),
      tier: r.betting_tier || "STANDARD"
    }))
    .filter(r => r.name && r.prob > 0)
    .sort((a, b) => b.prob - a.prob);

  document.getElementById("statusBox").innerHTML =
    `✅ ${playerPool.length} players loaded`;
}

function generateParlays() {
  const strategy = document.getElementById("strategy").value;
  const legs = Number(document.getElementById("legs").value);
  const count = Number(document.getElementById("count").value);
  const maxPerGame = Number(document.getElementById("maxPerGame").value);

  let filtered = [...playerPool];

  if (strategy === "probability") {
    filtered.sort((a, b) => b.prob - a.prob);
  } else if (strategy === "value") {
    filtered.sort((a, b) => b.ev - a.ev);
  } else if (strategy === "stacks") {
    filtered.sort((a, b) => b.score - a.score);
  } else if (strategy === "diversified") {
    filtered = randomize(filtered);
  } else {
    filtered.sort((a, b) => {
      const aScore = a.prob * 0.55 + a.score * 0.25 + Math.max(a.ev, -50) * 0.2;
      const bScore = b.prob * 0.55 + b.score * 0.25 + Math.max(b.ev, -50) * 0.2;
      return bScore - aScore;
    });
  }

  const parlays = [];

  for (let i = 0; i < count; i++) {
    const selected = [];
    const gameCount = {};
    const pool = strategy === "diversified" ? randomize(filtered) : randomize(filtered.slice(0, 60));

    for (const player of pool) {
      const game = player.game || "Unknown";

      if ((gameCount[game] || 0) >= maxPerGame) continue;

      selected.push(player);
      gameCount[game] = (gameCount[game] || 0) + 1;

      if (selected.length >= legs) break;
    }

    if (!selected.length) continue;

    const avgProb = selected.reduce((s, p) => s + p.prob, 0) / selected.length;
    const avgOdds = Math.round(selected.reduce((s, p) => s + p.odds, 0) / selected.length);
    const avgScore = Math.round(selected.reduce((s, p) => s + p.score, 0) / selected.length);

    parlays.push({
      strategy,
      players: selected.map(p => `${p.name} • ${p.team} • ${p.odds} • ${p.prob.toFixed(2)}%`),
      avgProb: avgProb.toFixed(2),
      avgOdds,
      score: avgScore,
      games: Object.keys(gameCount).length
    });
  }

  document.getElementById("parlayList").innerHTML =
    parlays.map(parlayCard).join("");

  document.getElementById("totalParlays").textContent = parlays.length;

  const avgProb = parlays.reduce((s, p) => s + Number(p.avgProb), 0) / parlays.length;
  const avgOdds = parlays.reduce((s, p) => s + Number(p.avgOdds), 0) / parlays.length;
  const avgScore = parlays.reduce((s, p) => s + Number(p.score), 0) / parlays.length;

  document.getElementById("avgProb").textContent = Number.isFinite(avgProb) ? avgProb.toFixed(2) + "%" : "0%";
  document.getElementById("avgOdds").textContent = Number.isFinite(avgOdds) ? Math.round(avgOdds) : "0";
  document.getElementById("avgScore").textContent = Number.isFinite(avgScore) ? Math.round(avgScore) : "0";
}

document.getElementById("generateBtn").addEventListener("click", generateParlays);

init();
