const axios = require("axios");

async function testFanDuel() {
  try {
    console.log("FanDuel scraper file is working.");
    console.log("Next step will be connecting this to MLB HR odds.");
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}

testFanDuel();