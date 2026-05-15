import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const RESULTS_PATH = path.join(
  ROOT,
  "website",
  "data",
  "results.json"
);

if (!fs.existsSync(RESULTS_PATH)) {
  console.error("results.json not found");
  process.exit(1);
}

const rows = JSON.parse(
  fs.readFileSync(RESULTS_PATH, "utf8")
);

function buildTags(row) {
  const tags = [];

  const hr = Number(row.home_runs || 0);
  const hits = Number(row.hits || 0);
  const rbi = Number(row.rbi || 0);

  if (hr >= 2) {
    tags.push({
      label: "MULTI HR",
      type: "hot"
    });
  }

  if (hits >= 3) {
    tags.push({
      label: "HOT BAT",
      type: "strong"
    });
  }

  if (rbi >= 3) {
    tags.push({
      label: "RBI GAME",
      type: "value"
    });
  }

  if (hits >= 2 && hr >= 1) {
    tags.push({
      label: "POWER GAME",
      type: "hot"
    });
  }

  if (row.team?.includes("Yankees")) {
    tags.push({
      label: "STACK TEAM",
      type: "stack"
    });
  }

  return tags;
}

const updated = rows.map(row => ({
  ...row,
  tags: buildTags(row)
}));

fs.writeFileSync(
  RESULTS_PATH,
  JSON.stringify(updated, null, 2)
);

console.log("RESULT TAGS ADDED");
console.log("Rows:", updated.length);
console.log("Saved:", RESULTS_PATH);
