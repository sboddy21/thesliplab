const axios = require("axios");

async function searchPlayer(playerName) {
  try {

    const url =
      `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`;

    const response = await axios.get(url);

    const players = response.data.people || [];

    if (players.length === 0) {
      console.log("No player found.");
      return;
    }

    players.forEach(player => {
      console.log("\n====================");
      console.log(`Name: ${player.fullName}`);
      console.log(`ID: ${player.id}`);
      console.log(`Position: ${player.primaryPosition?.name}`);
      console.log(`Team: ${player.currentTeam?.name}`);
    });

  } catch (error) {
    console.error("ERROR:", error.message);
  }
}

searchPlayer("Aaron Judge");