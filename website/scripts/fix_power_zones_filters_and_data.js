import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const jsPath = path.join(ROOT, "power-zones.js");

let js = fs.readFileSync(jsPath, "utf8");

js = js.replace(
/function getGrade\(row\) \{[\s\S]*?\n\}/,
`function getGrade(row) {
  const raw = cleanText(row.tier || row.label || row.grade || row.bucket || row.tag || row.play_type || "").toUpperCase();
  const score = getScore(row);
  const oddsNumber = num(row.odds ?? row.best_odds ?? row.hr_odds, 0);

  if (raw.includes("CORE") || raw.includes("ELITE") || raw.includes("SAFEST") || score >= 78) return "CORE";
  if (raw.includes("DANGER") || raw.includes("BAD") || raw.includes("TRAP") || raw.includes("FADE")) return "DANGER";
  if (raw.includes("VALUE") || raw.includes("EDGE") || raw.includes("PLUS") || score >= 68 || oddsNumber >= 450) return "VALUE";
  if (raw.includes("SLEEPER") || raw.includes("LOTTO") || raw.includes("LONG")) return "SLEEPER";

  return "VALUE";
}`
);

js = js.replace(
/function getScore\(row\) \{[\s\S]*?\n\}/,
`function getScore(row) {
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
}`
);

js = js.replace(
/function filteredPlayers\(\) \{[\s\S]*?return rows;\n\}/,
`function filteredPlayers() {
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
}`
);

js = js.replace(
/function render\(\) \{[\s\S]*?\n\}/,
`function render() {
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
}`
);

js = js.replace(
/async function loadData\(\) \{[\s\S]*?\n\}/,
`async function loadData() {
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
}`
);

fs.writeFileSync(jsPath, js);

console.log("POWER ZONES FILTERS AND DATA FIXED");
console.log("Updated: power-zones.js");
