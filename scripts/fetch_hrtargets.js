const axios = require("axios");
const cheerio = require("cheerio");

async function inspectHRTargets() {
  try {
    const url = "https://hrtargets.com";

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const $ = cheerio.load(response.data);

    console.log("Connected to HRTargets.");
    console.log("Page title:", $("title").text());
    console.log("\nVisible page text preview:\n");

    const text = $("body").text().replace(/\s+/g, " ").trim();

    console.log(text.substring(0, 3000));
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}

inspectHRTargets();