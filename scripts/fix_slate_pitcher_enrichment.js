import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WEBSITE_DATA = path.join(ROOT, "website", "data");
const SLATE_PATH = path.join(WEBSITE_DATA, "slate_intelligence.json");
const SEASON = 2026;

function key(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

function todayEastern() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

async function getPitcherInfoFromMlb() {
  const today = todayEastern();

  const scheduleUrl =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=probablePitcher`;

  const schedule = await fetchJson(scheduleUrl);
  const games = schedule?.dates?.[0]?.games || [];

  const pitchers = [];

  for (const game of games) {
    const awayPitcher = game?.teams?.away?.probablePitcher;
    const homePitcher = game?.teams?.home?.probablePitcher;

    if (awayPitcher?.id) pitchers.push(awayPitcher);
    if (homePitcher?.id) pitchers.push(homePitcher);
  }

  const unique = [...new Map(pitchers.map(p => [p.id, p])).values()];
  const lookup = new Map();

  for (const pitcher of unique) {
    try {
      const personUrl =
        `https://statsapi.mlb.com/api/v1/people/${pitcher.id}?hydrate=stats(group=[pitching],type=[season],season=${SEASON})`;

      const data = await fetchJson(personUrl);
      const person = data?.people?.[0] || {};
      const stat = person?.stats?.[0]?.splits?.[0]?.stat || {};

      const name = person.fullName || pitcher.fullName || "";
      const hand =
        person?.pitchHand?.code ||
        person?.pitchHand?.description ||
        "";

      const era = stat.era || "";
      const whip = stat.whip || "";
      const innings = stat.inningsPitched || "";

      lookup.set(key(name), {
        pitcher_hand: hand,
        pitcher_era: era,
        whip,
        innings
      });
    } catch {}
  }

  return lookup;
}

async function main() {
  if (!fs.existsSync(SLATE_PATH)) {
    console.error("Missing website/data/slate_intelligence.json");
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(SLATE_PATH, "utf8"));
  const pitcherLookup = await getPitcherInfoFromMlb();

  const updated = rows.map(row => {
    const info = pitcherLookup.get(key(row.pitcher)) || {};

    return {
      ...row,
      pitcher_hand: row.pitcher_hand || info.pitcher_hand || "",
      pitcher_era: row.pitcher_era || info.pitcher_era || "",
      whip: row.whip || info.whip || "",
      innings: row.innings || info.innings || ""
    };
  });

  fs.writeFileSync(SLATE_PATH, JSON.stringify(updated, null, 2));

  const summary = {
    updated_at: new Date().toISOString(),
    rows: updated.length,
    with_hand: updated.filter(r => r.pitcher_hand).length,
    with_era: updated.filter(r => r.pitcher_era).length
  };

  fs.writeFileSync(
    path.join(WEBSITE_DATA, "slate_pitcher_enrichment_summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("SLATE PITCHER ENRICHMENT FIXED");
  console.log("Rows:", summary.rows);
  console.log("With hand:", summary.with_hand);
  console.log("With ERA:", summary.with_era);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
