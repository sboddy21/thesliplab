require("dotenv").config();

const axios = require("axios");

const API_KEY = process.env.ODDS_API_KEY;

async function getAllHROdds() {
  try {
    const eventsResponse = await axios.get(
      "https://api.the-odds-api.com/v4/sports/baseball_mlb/events",
      {
        params: {
          apiKey: API_KEY
        }
      }
    );

    const events = eventsResponse.data;

    console.log("\n===== CHECKING ALL BOOKS FOR HR PROPS =====\n");

    for (const event of events) {
      try {
        const oddsResponse = await axios.get(
          `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${event.id}/odds`,
          {
            params: {
              apiKey: API_KEY,
              regions: "us",
              markets: "batter_home_runs",
              oddsFormat: "american"
            }
          }
        );

        const books = oddsResponse.data.bookmakers || [];

        console.log("\n==============================");
        console.log(`${event.away_team} vs ${event.home_team}`);
        console.log("==============================");

        let found = false;

        books.forEach(book => {
          book.markets.forEach(market => {
            if (market.key === "batter_home_runs") {
              found = true;

              console.log(`\nSportsbook: ${book.title}`);

              market.outcomes.forEach(outcome => {
                console.log(
                  `${outcome.name} | ${
                    outcome.price > 0 ? "+" + outcome.price : outcome.price
                  }`
                );
              });
            }
          });
        });

        if (!found) {
          console.log("No HR props found yet.");
        }

      } catch (eventError) {
        console.log(`Skipping ${event.away_team} vs ${event.home_team}`);
      }
    }

  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
  }
}

getAllHROdds();