async function loadResults() {
  const [rowsResponse, summaryResponse] = await Promise.all([
    fetch("./data/results.json", { cache: "no-store" }),
    fetch("./data/results_summary.json", { cache: "no-store" })
  ]);

  const rows = await rowsResponse.json();
  const summary = await summaryResponse.json();

  document.getElementById("finishedGames").textContent = summary.finished_games ?? 0;
  document.getElementById("totalGames").textContent = summary.total_games ?? 0;
  document.getElementById("hrHitters").textContent = summary.home_run_hitters ?? rows.length ?? 0;
  document.getElementById("updatedAt").textContent = formatTime(summary.updated_at);

  const body = document.getElementById("resultsBody");

  if (!rows.length) {
    body.innerHTML = "<tr><td colspan='10'>No home runs from finished games yet.</td></tr>";
    return;
  }

  body.innerHTML = rows.map(row => `
    <tr>
      <td>${safe(row.date)}</td>
      <td><strong>${safe(row.player)}</strong></td>
      <td>${safe(row.team)}</td>
      <td>${safe(row.opponent)}</td>
      <td>${safe(row.game)}</td>
      <td>${safe(row.venue)}</td>
      <td><span class="hr-pill">${safe(row.home_runs)}</span></td>
      <td>${safe(row.hits)}</td>
      <td>${safe(row.rbi)}</td>
      <td>${safe(row.at_bats)}</td>
    </tr>
  `).join("");
}

function formatTime(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  document.getElementById("resultsBody").innerHTML =
    "<tr><td colspan='10'>Results failed to load.</td></tr>";
});
