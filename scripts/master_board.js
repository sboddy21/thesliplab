const axios = require("axios");

const SEASON = 2026;

async function getStats(playerId, group) {
  const url =
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=${group}&season=${SEASON}`;

  const response = await axios.get(url);
  return response.data.stats?.[0]?.splits?.[0]?.stat || {};
}

function lineupBonus(spot) {
  if (spot <= 2) return 20;
  if (spot <= 5) return 15;
  if (spot <= 7) return 5;
  return 0;
}

async function scoreHitter(hitter, pitcherId, gameLabel) {
  const hitterStats = await getStats(hitter.id, "hitting");
  const pitcherStats = await getStats(pitcherId, "pitching");

  const hitterHR = Number(hitterStats.homeRuns || 0);
  const hitterOPS = Number(hitterStats.ops || 0);
  const pitcherERA = Number(pitcherStats.era || 0);
  const pitcherHR = Number(pitcherStats.homeRuns || 0);
  const pitcherWHIP = Number(pitcherStats.whip || 0);

  const score =
    hitterHR * 2 +
    hitterOPS * 100 +
    pitcherERA * 5 +
    pitcherHR * 3 +
    pitcherWHIP * 15 +
    lineupBonus(hitter.spot);

  return {
    game: gameLabel,
    team: hitter.team,
    name: hitter.name,
    spot: hitter.spot,
    score,
    hr: hitterHR,
    ops: hitterOPS,
    opposingPitcherId: pitcherId
  };
}

async function runMasterBoard() {
  const slateUrl =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher,lineups";

  const response = await axios.get(slateUrl);
  const games = response.data.dates?.[0]?.games || [];

  const board = [];

  for (const game of games) {
    const awayTeam = game.teams.away.team.name;
    const homeTeam = game.teams.home.team.name;

    const awayPitcher = game.teams.away.probablePitcher;
    const homePitcher = game.teams.home.probablePitcher;

    const awayLineup = game.lineups?.awayPlayers || [];
    const homeLineup = game.lineups?.homePlayers || [];

    const gameLabel = `${awayTeam} vs ${homeTeam}`;

    if (!awayPitcher?.id || !homePitcher?.id) {
      continue;
    }

    if (awayLineup.length === 0 || homeLineup.length === 0) {
      continue;
    }

    for (let i = 0; i < awayLineup.length; i++) {
      const player = awayLineup[i];

      board.push(
        await scoreHitter(
          {
            name: player.fullName,
            id: player.id,
            spot: i + 1,
            team: awayTeam
          },
          homePitcher.id,
          gameLabel
        )
      );
    }

    for (let i = 0; i < homeLineup.length; i++) {
      const player = homeLineup[i];

      board.push(
        await scoreHitter(
          {
            name: player.fullName,
            id: player.id,
            spot: i + 1,
            team: homeTeam
          },
          awayPitcher.id,
          gameLabel
        )
      );
    }
  }

  board.sort((a, b) => b.score - a.score);

  console.log("\n===== FULL AUTOMATED HR MASTER BOARD =====\n");

  board.slice(0, 40).forEach((player, index) => {
    let tier = "RISKIER";

    if (player.score >= 150) tier = "ELITE";
    else if (player.score >= 130) tier = "STRONG";
    else if (player.score >= 115) tier = "VALUE";

    console.log(`${index + 1}. ${player.name}`);
    console.log(`Team: ${player.team}`);
    console.log(`Game: ${player.game}`);
    console.log(`Lineup Spot: ${player.spot}`);
    console.log(`HR: ${player.hr}`);
    console.log(`OPS: ${player.ops}`);
    console.log(`Score: ${player.score.toFixed(2)}`);
    console.log(`Tier: ${tier}`);
    console.log("");
  });
}

runMasterBoard();