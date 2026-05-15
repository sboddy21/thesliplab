import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const indexFile = path.join(ROOT, "index.html");

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

let html = fs.readFileSync(indexFile, "utf8");

html = html.replace(/\\n/g, "");

const weatherHref = exists("weather.html") ? "weather.html" : "#weather";
const resultsHref = exists("results.html") ? "results.html" : "#results";
const slateHref = exists("slate.html") ? "slate.html" : "#slate";
const stacksHref = exists("stacks.html") ? "stacks.html" : "#stacks";

const nav = `<nav class="main-nav home-pill-nav">
  <a href="index.html">Home</a>
  <a href="#top-plays">Top Plays</a>
  <a href="#value-plays">Value</a>
  <a href="power-zones.html">Power Zones</a>
  <a href="${stacksHref}">Stacks</a>
  <a href="${slateHref}">Slate</a>
  <a href="${weatherHref}">Weather</a>
  <a href="${resultsHref}">Results</a>
</nav>`;

html = html.replace(/<nav class="main-nav[\s\S]*?<\/nav>/, nav);

const sectionMap = [
  ["top-plays", ["Probability Board", "Top Plays", "View Top Plays"]],
  ["value-plays", ["Value Plays", "Value Watch"]],
  ["stacks", ["HR Stacks", "Stacks"]],
  ["slate", ["Slate", "Today's Slate"]],
  ["weather", ["Weather"]],
  ["results", ["Results"]]
];

for (const [id, labels] of sectionMap) {
  if (html.includes(`id="${id}"`)) continue;

  let added = false;

  for (const label of labels) {
    const h2Regex = new RegExp(`<h2([^>]*)>${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h2>`, "i");
    const h3Regex = new RegExp(`<h3([^>]*)>${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h3>`, "i");

    if (h2Regex.test(html)) {
      html = html.replace(h2Regex, `<h2 id="${id}"$1>${label}</h2>`);
      added = true;
      break;
    }

    if (h3Regex.test(html)) {
      html = html.replace(h3Regex, `<h3 id="${id}"$1>${label}</h3>`);
      added = true;
      break;
    }
  }

  if (!added && !exists(`${id.replace("-plays", "")}.html`)) {
    html += `

<section id="${id}" class="home-anchor-section">
  <h2>${id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}</h2>
</section>
`;
  }
}

fs.writeFileSync(indexFile, html);

console.log("Fixed homepage nav links.");
console.log("Weather link:", weatherHref);
console.log("Results link:", resultsHref);
console.log("Slate link:", slateHref);
console.log("Stacks link:", stacksHref);
