import path from "path";
import {
  DATA_DIR,
  readCSV,
  writeCSV,
  backupFile,
  normalizeTeam,
  num,
  clamp,
  score01
} from "./normalize_utils.js";

const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");
const PITCHER_FILE = path.join(DATA_DIR, "pitcher_stats.csv");

function teamKey(value = "") {
  return normalizeTeam(
    String(value)
      .replace(/_MLB$/i, "")
      .replace(/_/g, " ")
      .replace(/\./g, "")
      .replace(/\bSTLOUIS\b/i, "ST LOUIS")
      .replace(/\bST\. LOUIS\b/i, "ST LOUIS")
  );
}

function gameKey(value = "") {
  const parts = String(value || "")
    .split("@")
    .map(x => teamKey(x.trim()))
    .filter(Boolean);

  if (parts.length !== 2) return "";

  return `${parts[0]} @ ${parts[1]}`;
}

function attackScore(p) {
  const hr9 = score01(p.hr9, 0.4, 2.0);
  const whip = score01(p.whip, 0.95, 1.65);
  const era = score01(p.era, 2.8, 6.2);
  const xfip = score01(p.xfip, 3.2, 5.6);
  const bb9 = score01(p.bb9, 1.5, 5.0);
  const last3 = score01(p.last3, 1.8, 6.5);

  const raw =
    hr9 * 0.28 +
    whip * 0.18 +
    era * 0.14 +
    xfip * 0.18 +
    bb9 * 0.10 +
    last3 * 0.12;

  return clamp(raw, 1, 99);
}

function attackTag(score) {
  const s = num(score);

  if (s >= 72) return "ATTACK";
  if (s >= 56) return "LIVE";
  if (s >= 40) return "NEUTRAL";

  return "AVOID";
}

const players = readCSV(PLAYER_FILE);
const pitchers = readCSV(PITCHER_FILE);

const pitcherByGameTeam = new Map();

for (const p of pitchers) {
  const key = `${gameKey(p.game)}|${teamKey(p.team)}`;

  pitcherByGameTeam.set(key, {
    ...p,
    pitcher_attack_score: attackScore(p).toFixed(2)
  });
}

let matched = 0;
let noMatch = 0;

const updated = players.map(row => {
  const hitterTeam = teamKey(row.team);
  const gKey = gameKey(row.game);

  const gamePitchers = pitchers.filter(p => gameKey(p.game) === gKey);
  const opponentPitcher = gamePitchers.find(p => teamKey(p.team) !== hitterTeam);

  if (!opponentPitcher) {
    noMatch++;

    return {
      ...row,
      pitcher: "",
      pitcher_team: "",
      pitcher_status: "NO_MATCH",
      pitcher_attack_score: "35.00",
      pitcher_attack_tag: "AVOID",
      pAtk: "35.00",
      pitcher_match_type: "NO_MATCH"
    };
  }

  matched++;

  const scored = pitcherByGameTeam.get(`${gKey}|${teamKey(opponentPitcher.team)}`) || opponentPitcher;
  const score = scored.pitcher_attack_score || attackScore(scored).toFixed(2);
  const tag = attackTag(score);

  return {
    ...row,
    pitcher: scored.pitcher || scored.name || "",
    pitcher_team: scored.team || "",
    pitcher_status: scored.status || "",
    pitcher_gs: scored.gs || "",
    pitcher_ip: scored.ip || "",
    pitcher_era: scored.era || "",
    pitcher_whip: scored.whip || "",
    pitcher_xfip: scored.xfip || "",
    pitcher_team_so: scored.teamSO || "",
    pitcher_last3: scored.last3 || "",
    pitcher_k9: scored.k9 || "",
    pitcher_bb9: scored.bb9 || "",
    pitcher_hr9: scored.hr9 || "",
    pitcher_attack_score: score,
    pitcher_attack_tag: tag,
    pAtk: score,
    pitcher_match_type: "MATCH"
  };
});

const backup = backupFile(PLAYER_FILE);
writeCSV(PLAYER_FILE, updated);

console.log("Pitcher attack merge complete.");
console.log(`Player rows: ${players.length}`);
console.log(`Pitcher rows read: ${pitchers.length}`);
console.log(`Matched: ${matched}`);
console.log(`No match: ${noMatch}`);
console.log(`Backup: ${backup || "none"}`);
console.log(`Updated: ${PLAYER_FILE}`);

console.table(updated.slice(0, 30).map(r => ({
  name: r.name,
  team: r.team,
  game: r.game,
  pitcher: r.pitcher,
  pitcher_team: r.pitcher_team,
  score: r.pitcher_attack_score,
  tag: r.pitcher_attack_tag,
  match: r.pitcher_match_type
})));