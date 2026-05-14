async function loadResults() {

  const [rowsRes, summaryRes] = await Promise.all([
    fetch("./data/results.json", { cache: "no-store" }),
    fetch("./data/results_summary.json", { cache: "no-store" })
  ]);

  const rows = await rowsRes.json();
  const summary = await summaryRes.json();

  document.getElementById("finishedGames").textContent = summary.finished_games || 0;
  document.getElementById("totalGames").textContent = summary.total_games || 0;
  document.getElementById("hrHitters").textContent = summary.home_run_hitters || 0;

  const updated = new Date(summary.updated_at);

  document.getElementById("updatedAt").textContent =
    updated.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

  const body = document.getElementById("resultsBody");

  body.innerHTML = rows.map((row, index) => {

    const tags = [];

    if (row.home_runs >= 2) {
      tags.push('<span class="tag tag-hot">MULTI HR</span>');
    }

    if (row.rbi >= 3) {
      tags.push('<span class="tag tag-strong">RBI GAME</span>');
    }

    if (row.hits >= 3) {
      tags.push('<span class="tag tag-value">HOT BAT</span>');
    }

    return `
      <tr>

        <td class="score-yellow">
          ${index + 1}
        </td>

        <td>

          <div class="player-cell">

            <div class="player-name">
              ${row.player}
            </div>

            <div class="player-meta">
              ${row.game}
            </div>

          </div>

        </td>

        <td class="team">
          ${row.team}
        </td>

        <td>
          ${row.opponent}
        </td>

        <td>
          ${row.venue}
        </td>

        <td>
          <span class="hr-pill">
            ${row.home_runs}
          </span>
        </td>

        <td class="score-green">
          ${row.hits}
        </td>

        <td>
          ${row.rbi}
        </td>

        <td>
          ${row.at_bats}
        </td>

        <td>
          ${tags.join("")}
        </td>

      </tr>
    `;

  }).join("");

}

loadResults();
