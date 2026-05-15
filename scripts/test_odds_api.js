require("dotenv").config();

const axios = require("axios");

async function testOddsAPI() {
  try {

    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      console.log("Missing ODDS_API_KEY in .env");
      return;
    }

    const url =
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey=${apiKey}`;

    const response = await axios.get(url);

    console.log("\n===== MLB EVENTS =====\n");

    response.data.forEach((event, index) => {

      console.log(`${index + 1}. ${event.away_team} vs ${event.home_team}`);
      console.log(`Event ID: ${event.id}`);
      console.log(`Start Time: ${event.commence_time}`);
      console.log("");
    });

  } catch (error) {

    console.error("ERROR:");

    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testOddsAPI();