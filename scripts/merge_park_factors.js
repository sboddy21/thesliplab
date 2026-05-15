import path from "path";
import {
  DATA_DIR,
  readCSV,
  writeCSV,
  backupFile,
  normalizeTeam
} from "./normalize_utils.js";

const PLAYER_FILE = path.join(DATA_DIR, "player_stats.csv");

const PARKS = {
  "arizona diamondbacks": {
    park: "Chase Field",
    hr_park_score: 60,
    park_label: "BOOST",
    park_note: "Good HR environment"
  },
  "atlanta braves": {
    park: "Truist Park",
    hr_park_score: 58,
    park_label: "SLIGHT_BOOST",
    park_note: "Slight HR boost"
  },
  "baltimore orioles": {
    park: "Camden Yards",
    hr_park_score: 42,
    park_label: "NEUTRAL",
    park_note: "Slight HR suppressor"
  },
  "boston red sox": {
    park: "Fenway Park",
    hr_park_score: 52,
    park_label: "NEUTRAL",
    park_note: "Neutral HR environment"
  },
  "chicago cubs": {
    park: "Wrigley Field",
    hr_park_score: 61,
    park_label: "WEATHER_DEPENDENT",
    park_note: "Wind sensitive HR park"
  },
  "chicago white sox": {
    park: "Rate Field",
    hr_park_score: 62,
    park_label: "BOOST",
    park_note: "HR friendly"
  },
  "cincinnati reds": {
    park: "Great American Ball Park",
    hr_park_score: 78,
    park_label: "POWER_BOOST",
    park_note: "Major HR boost"
  },
  "cleveland guardians": {
    park: "Progressive Field",
    hr_park_score: 47,
    park_label: "NEUTRAL",
    park_note: "Neutral to slight suppressor"
  },
  "colorado rockies": {
    park: "Coors Field",
    hr_park_score: 96,
    park_label: "MEGA_BOOST",
    park_note: "Best run environment"
  },
  "detroit tigers": {
    park: "Comerica Park",
    hr_park_score: 34,
    park_label: "SUPPRESSOR",
    park_note: "HR suppressor"
  },
  "houston astros": {
    park: "Daikin Park",
    hr_park_score: 59,
    park_label: "SLIGHT_BOOST",
    park_note: "Slight HR boost"
  },
  "kansas city royals": {
    park: "Kauffman Stadium",
    hr_park_score: 36,
    park_label: "SUPPRESSOR",
    park_note: "HR suppressor"
  },
  "los angeles angels": {
    park: "Angel Stadium",
    hr_park_score: 53,
    park_label: "NEUTRAL",
    park_note: "Neutral"
  },
  "los angeles dodgers": {
    park: "Dodger Stadium",
    hr_park_score: 52,
    park_label: "SLIGHT_BOOST",
    park_note: "Slight HR boost"
  },
  "miami marlins": {
    park: "loanDepot park",
    hr_park_score: 44,
    park_label: "NEUTRAL",
    park_note: "Slight HR suppressor"
  },
  "milwaukee brewers": {
    park: "American Family Field",
    hr_park_score: 65,
    park_label: "BOOST",
    park_note: "Good HR park"
  },
  "minnesota twins": {
    park: "Target Field",
    hr_park_score: 50,
    park_label: "NEUTRAL",
    park_note: "Neutral"
  },
  "new york mets": {
    park: "Citi Field",
    hr_park_score: 43,
    park_label: "NEUTRAL",
    park_note: "Slight suppressor"
  },
  "new york yankees": {
    park: "Yankee Stadium",
    hr_park_score: 70,
    park_label: "BOOST",
    park_note: "HR friendly"
  },
  "athletics": {
    park: "Sutter Health Park",
    hr_park_score: 55,
    park_label: "NEUTRAL",
    park_note: "Neutral"
  },
  "philadelphia phillies": {
    park: "Citizens Bank Park",
    hr_park_score: 73,
    park_label: "POWER_BOOST",
    park_note: "HR friendly"
  },
  "pittsburgh pirates": {
    park: "PNC Park",
    hr_park_score: 39,
    park_label: "SUPPRESSOR",
    park_note: "HR suppressor"
  },
  "san diego padres": {
    park: "Petco Park",
    hr_park_score: 46,
    park_label: "NEUTRAL",
    park_note: "Neutral to slight suppressor"
  },
  "san francisco giants": {
    park: "Oracle Park",
    hr_park_score: 18,
    park_label: "DEAD_ZONE",
    park_note: "HR suppressor"
  },
  "seattle mariners": {
    park: "T-Mobile Park",
    hr_park_score: 45,
    park_label: "NEUTRAL",
    park_note: "Slight suppressor"
  },
  "st louis cardinals": {
    park: "Busch Stadium",
    hr_park_score: 40,
    park_label: "SUPPRESSOR",
    park_note: "HR suppressor"
  },
  "tampa bay rays": {
    park: "George M. Steinbrenner Field",
    hr_park_score: 63,
    park_label: "BOOST",
    park_note: "HR friendly"
  },
  "texas rangers": {
    park: "Globe Life Field",
    hr_park_score: 56,
    park_label: "SLIGHT_BOOST",
    park_note: "Slight HR boost"
  },
  "toronto blue jays": {
    park: "Rogers Centre",
    hr_park_score: 62,
    park_label: "BOOST",
    park_note: "Good HR park"
  },
  "washington nationals": {
    park: "Nationals Park",
    hr_park_score: 51,
    park_label: "NEUTRAL",
    park_note: "Neutral"
  }
};

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

function homeTeamFromGame(game = "") {
  const parts = String(game).split("@").map(x => x.trim());
  if (parts.length !== 2) return "";
  return parts[1];
}

const rows = readCSV(PLAYER_FILE);

let matched = 0;
let missing = 0;

const updated = rows.map(row => {
  const homeTeam = homeTeamFromGame(row.game);
  const park = PARKS[teamKey(homeTeam)];

  if (!park) {
    missing++;

    return {
      ...row,
      park: "",
      ballpark: "",
      home_team: homeTeam,
      hr_park_score: "52.00",
      parkScore: "52.00",
      park_score: "52.00",
      park_label: "NEUTRAL",
      park_note: "No park factor match",
      park_match_type: "NO_MATCH"
    };
  }

  matched++;

  return {
    ...row,
    park: park.park,
    ballpark: park.park,
    home_team: homeTeam,
    hr_park_score: Number(park.hr_park_score).toFixed(2),
    parkScore: Number(park.hr_park_score).toFixed(2),
    park_score: Number(park.hr_park_score).toFixed(2),
    park_label: park.park_label,
    park_note: park.park_note,
    park_match_type: "MATCH"
  };
});

const backup = backupFile(PLAYER_FILE);
writeCSV(PLAYER_FILE, updated);

console.log("Park factor merge complete.");
console.log(`Rows: ${rows.length}`);
console.log(`Matched: ${matched}`);
console.log(`Missing: ${missing}`);
console.log(`Backup: ${backup || "none"}`);
console.log(`Updated: ${PLAYER_FILE}`);

console.table(updated.slice(0, 30).map(r => ({
  name: r.name,
  team: r.team,
  game: r.game,
  home: r.home_team,
  park: r.park,
  score: r.hr_park_score,
  label: r.park_label,
  match: r.park_match_type
})));