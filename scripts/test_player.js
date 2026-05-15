const axios = require("axios");

async function matchupScore() {
  try {

    // Aaron Judge
    const hitterId = 592450;

    // Example pitcher
    const pitcherId = 680732;

    const hitterURL =
      `https://statsapi.mlb.com/api/v1/people/${hitterId}/stats?stats=season&group=hitting&season=2026`;

    const pitcherURL =
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&group=pitching&season=2026`;

    const hitterResponse = await axios.get(hitterURL);
    const pitcherResponse = await axios.get(pitcherURL);

    const hitter =
      hitterResponse.data.stats?.[0]?.splits?.[0]?.stat;

    const pitcher =
      pitcherResponse.data.stats?.[0]?.splits?.[0]?.stat;

    const hitterHR = Number(hitter.homeRuns || 0);
    const hitterOPS = Number(hitter.ops || 0);

    const pitcherERA = Number(pitcher.era || 0);
    const pitcherHR = Number(pitcher.homeRuns || 0);
    const pitcherWHIP = Number(pitcher.whip || 0);

    // VERY basic scoring model
    const score =
      (hitterHR * 2) +
      (hitterOPS * 100) +
      (pitcherERA * 5) +
      (pitcherHR * 3) +
      (pitcherWHIP * 15);

    console.log("\n===== MATCHUP ANALYSIS =====\n");

    console.log(`Hitter HR: ${hitterHR}`);
    console.log(`Hitter OPS: ${hitterOPS}`);

    console.log(`Pitcher ERA: ${pitcherERA}`);
    console.log(`Pitcher HR Allowed: ${pitcherHR}`);
    console.log(`Pitcher WHIP: ${pitcherWHIP}`);

    console.log("\n===========================");
    console.log(`MATCHUP SCORE: ${score.toFixed(2)}`);

    if (score >= 170) {
      console.log("ELITE HR TARGET");
    } else if (score >= 140) {
      console.log("STRONG PLAY");
    } else {
      console.log("RISKIER PLAY");
    }

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}

matchupScore();