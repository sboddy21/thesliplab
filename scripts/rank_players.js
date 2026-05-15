const axios = require("axios");

async function getStats(playerId, group) {
  const url =
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=${group}&season=2026`;

  const response = await axios.get(url);

  return response.data.stats?.[0]?.splits?.[0]?.stat || {};
}

function impliedProbability(odds) {
  return 100 / (odds + 100);
}

async function scoreHitter(hitter, pitcherId) {

  const hitterStats = await getStats(hitter.id, "hitting");
  const pitcherStats = await getStats(pitcherId, "pitching");

  const hitterHR = Number(hitterStats.homeRuns || 0);
  const hitterOPS = Number(hitterStats.ops || 0);

  const pitcherERA = Number(pitcherStats.era || 0);
  const pitcherHR = Number(pitcherStats.homeRuns || 0);
  const pitcherWHIP = Number(pitcherStats.whip || 0);

  let lineupBonus = 0;

  if (hitter.spot <= 2) lineupBonus = 20;
  else if (hitter.spot <= 5) lineupBonus = 15;
  else if (hitter.spot <= 7) lineupBonus = 5;

  const modelScore =
    (hitterHR * 2) +
    (hitterOPS * 100) +
    (pitcherERA * 5) +
    (pitcherHR * 3) +
    (pitcherWHIP * 15) +
    lineupBonus;

  const impliedProb = impliedProbability(hitter.odds);

  const valueScore =
    modelScore * (1 / impliedProb);

  return {
    name: hitter.name,
    spot: hitter.spot,
    odds: hitter.odds,
    impliedProb,
    modelScore,
    valueScore
  };
}

async function runSweep() {

  const opposingPitcherId = 680732;

  const hitters = [
    {
      spot: 7,
      name: "Luke Raley",
      id: 670042,
      odds: 360
    },
    {
      spot: 3,
      name: "Julio Rodríguez",
      id: 677594,
      odds: 490
    },
    {
      spot: 5,
      name: "Randy Arozarena",
      id: 668227,
      odds: 630
    },
    {
      spot: 2,
      name: "Cal Raleigh",
      id: 663728,
      odds: 320
    },
    {
      spot: 4,
      name: "Josh Naylor",
      id: 647304,
      odds: 540
    },
    {
      spot: 8,
      name: "Dominic Canzone",
      id: 686527,
      odds: 520
    }
  ];

  const results = [];

  for (const hitter of hitters) {

    const scored = await scoreHitter(
      hitter,
      opposingPitcherId
    );

    results.push(scored);
  }

  results.sort((a, b) => b.valueScore - a.valueScore);

  console.log("\n===== VALUE HR BOARD =====\n");

  results.forEach((player, index) => {

    console.log(`${index + 1}. ${player.name}`);
    console.log(`Lineup Spot: ${player.spot}`);
    console.log(`Odds: +${player.odds}`);
    console.log(
      `Implied Probability: ${(player.impliedProb * 100).toFixed(1)}%`
    );
    console.log(
      `Model Score: ${player.modelScore.toFixed(2)}`
    );
    console.log(
      `Value Score: ${player.valueScore.toFixed(2)}`
    );

    console.log("");
  });
}

runSweep();