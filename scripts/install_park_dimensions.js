import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const dirs = [
  "data",
  "public",
  "public/js",
  "public/css",
  "scripts"
];

for (const dir of dirs) {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
}

const parks = [
  { team: "Arizona Diamondbacks", park: "Chase Field", left: 330, leftCenter: 374, center: 407, rightCenter: 374, right: 334 },
  { team: "Atlanta Braves", park: "Truist Park", left: 335, leftCenter: 385, center: 400, rightCenter: 375, right: 325 },
  { team: "Baltimore Orioles", park: "Oriole Park at Camden Yards", left: 333, leftCenter: 384, center: 410, rightCenter: 373, right: 318 },
  { team: "Boston Red Sox", park: "Fenway Park", left: 310, leftCenter: 379, center: 390, rightCenter: 380, right: 302 },
  { team: "Chicago Cubs", park: "Wrigley Field", left: 355, leftCenter: 368, center: 400, rightCenter: 368, right: 353 },
  { team: "Chicago White Sox", park: "Rate Field", left: 330, leftCenter: 375, center: 400, rightCenter: 375, right: 335 },
  { team: "Cincinnati Reds", park: "Great American Ball Park", left: 328, leftCenter: 379, center: 404, rightCenter: 370, right: 325 },
  { team: "Cleveland Guardians", park: "Progressive Field", left: 325, leftCenter: 370, center: 405, rightCenter: 375, right: 325 },
  { team: "Colorado Rockies", park: "Coors Field", left: 347, leftCenter: 390, center: 415, rightCenter: 375, right: 350 },
  { team: "Detroit Tigers", park: "Comerica Park", left: 345, leftCenter: 370, center: 420, rightCenter: 365, right: 330 },
  { team: "Houston Astros", park: "Daikin Park", left: 315, leftCenter: 362, center: 409, rightCenter: 373, right: 326 },
  { team: "Kansas City Royals", park: "Kauffman Stadium", left: 330, leftCenter: 387, center: 410, rightCenter: 387, right: 330 },
  { team: "Los Angeles Angels", park: "Angel Stadium", left: 347, leftCenter: 390, center: 396, rightCenter: 370, right: 350 },
  { team: "Los Angeles Dodgers", park: "Dodger Stadium", left: 330, leftCenter: 375, center: 395, rightCenter: 375, right: 330 },
  { team: "Miami Marlins", park: "loanDepot park", left: 344, leftCenter: 386, center: 400, rightCenter: 387, right: 335 },
  { team: "Milwaukee Brewers", park: "American Family Field", left: 344, leftCenter: 371, center: 400, rightCenter: 374, right: 345 },
  { team: "Minnesota Twins", park: "Target Field", left: 339, leftCenter: 377, center: 411, rightCenter: 367, right: 328 },
  { team: "New York Mets", park: "Citi Field", left: 335, leftCenter: 385, center: 408, rightCenter: 398, right: 330 },
  { team: "New York Yankees", park: "Yankee Stadium", left: 318, leftCenter: 399, center: 408, rightCenter: 385, right: 314 },
  { team: "Athletics", park: "Sutter Health Park", left: 330, leftCenter: 388, center: 403, rightCenter: 388, right: 325 },
  { team: "Philadelphia Phillies", park: "Citizens Bank Park", left: 329, leftCenter: 374, center: 401, rightCenter: 369, right: 330 },
  { team: "Pittsburgh Pirates", park: "PNC Park", left: 325, leftCenter: 389, center: 399, rightCenter: 375, right: 320 },
  { team: "San Diego Padres", park: "Petco Park", left: 336, leftCenter: 390, center: 396, rightCenter: 391, right: 322 },
  { team: "San Francisco Giants", park: "Oracle Park", left: 339, leftCenter: 399, center: 391, rightCenter: 421, right: 309 },
  { team: "Seattle Mariners", park: "T-Mobile Park", left: 331, leftCenter: 378, center: 401, rightCenter: 381, right: 326 },
  { team: "St. Louis Cardinals", park: "Busch Stadium", left: 336, leftCenter: 375, center: 400, rightCenter: 375, right: 335 },
  { team: "Tampa Bay Rays", park: "George M. Steinbrenner Field", left: 318, leftCenter: 399, center: 408, rightCenter: 385, right: 314 },
  { team: "Texas Rangers", park: "Globe Life Field", left: 329, leftCenter: 372, center: 407, rightCenter: 374, right: 326 },
  { team: "Toronto Blue Jays", park: "Rogers Centre", left: 328, leftCenter: 375, center: 400, rightCenter: 375, right: 328 },
  { team: "Washington Nationals", park: "Nationals Park", left: 337, leftCenter: 377, center: 402, rightCenter: 370, right: 335 }
];

fs.writeFileSync(
  path.join(ROOT, "data", "park_dimensions.json"),
  JSON.stringify(parks, null, 2)
);

const js = `
async function loadParkDimensions() {
  const mount =
    document.querySelector("[data-park-dimensions]") ||
    document.querySelector("#park-dimensions") ||
    document.querySelector(".park-dimensions");

  if (!mount) return;

  let parks = [];

  try {
    const res = await fetch("./data/park_dimensions.json");
    parks = await res.json();
  } catch (err) {
    mount.innerHTML = "<div class='slip-park-error'>Park dimensions could not load.</div>";
    return;
  }

  function renderPark(park) {
    mount.innerHTML = \`
      <section class="slip-park-card">
        <div class="slip-park-head">
          <div>
            <div class="slip-kicker">PARK DIMENSIONS</div>
            <h2>\${park.park}</h2>
            <p>\${park.team}</p>
          </div>
          <select id="slipParkSelect">
            \${parks.map(p => \`<option value="\${p.park}" \${p.park === park.park ? "selected" : ""}>\${p.park}</option>\`).join("")}
          </select>
        </div>

        <div class="slip-field-wrap">
          <svg class="slip-field-svg" viewBox="0 0 600 430" role="img" aria-label="Baseball park dimension overlay">
            <path d="M300 395 L75 170 Q300 35 525 170 Z" class="slip-outfield"/>
            <path d="M300 395 L220 315 L300 235 L380 315 Z" class="slip-infield"/>
            <circle cx="300" cy="395" r="7" class="slip-base"/>
            <circle cx="220" cy="315" r="6" class="slip-base"/>
            <circle cx="300" cy="235" r="6" class="slip-base"/>
            <circle cx="380" cy="315" r="6" class="slip-base"/>

            <text x="80" y="178" class="slip-dim-label">LF \${park.left}'</text>
            <text x="145" y="105" class="slip-dim-label">LC \${park.leftCenter}'</text>
            <text x="278" y="68" class="slip-dim-label">CF \${park.center}'</text>
            <text x="408" y="105" class="slip-dim-label">RC \${park.rightCenter}'</text>
            <text x="485" y="178" class="slip-dim-label">RF \${park.right}'</text>

            <line x1="300" y1="395" x2="75" y2="170" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="160" y2="95" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="300" y2="55" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="440" y2="95" class="slip-dim-line"/>
            <line x1="300" y1="395" x2="525" y2="170" class="slip-dim-line"/>
          </svg>
        </div>

        <div class="slip-park-grid">
          <div><span>Left</span><strong>\${park.left}'</strong></div>
          <div><span>Left Center</span><strong>\${park.leftCenter}'</strong></div>
          <div><span>Center</span><strong>\${park.center}'</strong></div>
          <div><span>Right Center</span><strong>\${park.rightCenter}'</strong></div>
          <div><span>Right</span><strong>\${park.right}'</strong></div>
        </div>
      </section>
    \`;

    document.querySelector("#slipParkSelect").addEventListener("change", e => {
      const next = parks.find(p => p.park === e.target.value);
      if (next) renderPark(next);
    });
  }

  renderPark(parks[0]);
}

document.addEventListener("DOMContentLoaded", loadParkDimensions);
`;

fs.writeFileSync(path.join(ROOT, "public", "js", "park_dimensions.js"), js.trim());

const css = `
.slip-park-card {
  background: #101114;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 22px;
  padding: 22px;
  color: #fff;
  margin: 24px 0;
}

.slip-park-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.slip-kicker {
  color: #9cff3a;
  font-size: 12px;
  letter-spacing: .12em;
  font-weight: 800;
}

.slip-park-head h2 {
  margin: 4px 0;
  font-size: 28px;
}

.slip-park-head p {
  margin: 0;
  color: rgba(255,255,255,.62);
}

#slipParkSelect {
  background: #050607;
  color: #fff;
  border: 1px solid rgba(156,255,58,.45);
  border-radius: 12px;
  padding: 10px 12px;
}

.slip-field-wrap {
  background: radial-gradient(circle at center, rgba(156,255,58,.16), rgba(255,255,255,.03));
  border-radius: 20px;
  padding: 12px;
  overflow: hidden;
}

.slip-field-svg {
  width: 100%;
  max-height: 470px;
}

.slip-outfield {
  fill: rgba(20, 120, 58, .45);
  stroke: rgba(156,255,58,.7);
  stroke-width: 3;
}

.slip-infield {
  fill: rgba(196, 130, 61, .45);
  stroke: rgba(255,255,255,.35);
  stroke-width: 2;
}

.slip-base {
  fill: #fff;
}

.slip-dim-line {
  stroke: rgba(255,255,255,.2);
  stroke-dasharray: 5 6;
}

.slip-dim-label {
  fill: #fff;
  font-size: 18px;
  font-weight: 900;
  paint-order: stroke;
  stroke: #050607;
  stroke-width: 4;
}

.slip-park-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.slip-park-grid div {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 12px;
}

.slip-park-grid span {
  display: block;
  color: rgba(255,255,255,.6);
  font-size: 12px;
}

.slip-park-grid strong {
  display: block;
  font-size: 22px;
  margin-top: 4px;
  color: #9cff3a;
}

.slip-park-error {
  color: #ff6b6b;
  padding: 20px;
}

@media (max-width: 760px) {
  .slip-park-head {
    flex-direction: column;
  }

  .slip-park-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;

fs.writeFileSync(path.join(ROOT, "public", "css", "park_dimensions.css"), css.trim());

const htmlFiles = fs.readdirSync(ROOT).filter(file => file.endsWith(".html"));

for (const file of htmlFiles) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");

  if (!html.includes("park_dimensions.css")) {
    html = html.replace("</head>", `  <link rel="stylesheet" href="./public/css/park_dimensions.css">\\n</head>`);
  }

  if (!html.includes("park_dimensions.js")) {
    html = html.replace("</body>", `  <script src="./public/js/park_dimensions.js"></script>\\n</body>`);
  }

  if (!html.includes("data-park-dimensions")) {
    html = html.replace("</main>", `\\n<section data-park-dimensions></section>\\n</main>`);
  }

  fs.writeFileSync(full, html);
}

console.log("THE SLIP LAB PARK DIMENSIONS INSTALLED");
console.log("Created: data/park_dimensions.json");
console.log("Created: public/js/park_dimensions.js");
console.log("Created: public/css/park_dimensions.css");
console.log("Updated HTML files:", htmlFiles.join(", ") || "none found");
