async function loadResults() {
  const response = await fetch("./data/results.json", { cache: "no-store" });
  const rows = await response.json();

  const graded = rows.filter(row => row.result === "Win" || row.result === "Loss");
  const wins = graded.filter(row => row.result === "Win").length;
  const losses = graded.filter(row => row.result === "Loss").length;
  const units = rows.reduce((sum, row) => sum + Number(row.profit || 0), 0);
  const clvWins = rows.filter(row => {
    const posted = parseAmerican(row.odds_posted);
    const closing = parseAmerican(row.closing_odds);
    if (posted === null || closing === null) return false;
    return posted > closing;
  }).length;

  document.getElementById("official_plays").textContent = rows.length;
  document.getElementById("official_record").textContent = wins + "-" + losses;
  document.getElementById("official_units").textContent = units.toFixed(2);
  document.getElementById("official_clv").textContent = clvWins;

  const body = document.getElementById("results_body");
  body.innerHTML = rows.map(row => {
    const badgeClass =
      row.result === "Win" ? "badge_win" :
      row.result === "Loss" ? "badge_loss" :
      "badge_pending";

    return `
      <tr>
        <td>${safe(row.date)}</td>
        <td>${safe(row.player)}</td>
        <td>${safe(row.team)}</td>
        <td>${safe(row.market)}</td>
        <td>${safe(row.odds_posted)}</td>
        <td>${safe(row.closing_odds)}</td>
        <td>${safe(row.clv)}</td>
        <td><span class="${badgeClass}">${safe(row.result)}</span></td>
        <td>${safe(row.units)}</td>
        <td>${Number(row.profit || 0).toFixed(2)}</td>
        <td>${safe(row.note)}</td>
      </tr>
    `;
  }).join("");
}

function parseAmerican(value) {
  if (!value) return null;
  const clean = String(value).replace("+", "").trim();
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
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

loadResults().catch(error => {
  console.error(error);
  document.getElementById("results_body").innerHTML = "<tr><td colspan='11'>Results failed to load.</td></tr>";
});
