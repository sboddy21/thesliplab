import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const weatherJsPath = path.join(ROOT, "weather.js");
const weatherHtmlPath = path.join(ROOT, "weather.html");

let weatherJs = fs.existsSync(weatherJsPath) ? fs.readFileSync(weatherJsPath, "utf8") : "";
let weatherHtml = fs.existsSync(weatherHtmlPath) ? fs.readFileSync(weatherHtmlPath, "utf8") : "";

const parkOverlayCode = `
function getParkDimensionsByVenue(venue = "") {
  const key = String(venue).toLowerCase();

  const parks = {
    "target field": { lf: 339, lcf: 377, cf: 411, rcf: 367, rf: 328 },
    "daikin park": { lf: 315, lcf: 362, cf: 409, rcf: 373, rf: 326 },
    "sutter health park": { lf: 330, lcf: 388, cf: 403, rcf: 388, rf: 325 },
    "truist park": { lf: 335, lcf: 385, cf: 400, rcf: 375, rf: 325 },
    "globe life field": { lf: 329, lcf: 372, cf: 407, rcf: 374, rf: 326 },
    "rogers centre": { lf: 328, lcf: 375, cf: 400, rcf: 375, rf: 328 },
    "progressive field": { lf: 325, lcf: 370, cf: 405, rcf: 375, rf: 325 },
    "wrigley field": { lf: 355, lcf: 368, cf: 400, rcf: 368, rf: 353 },
    "fenway park": { lf: 310, lcf: 379, cf: 390, rcf: 380, rf: 302 },
    "yankee stadium": { lf: 318, lcf: 399, cf: 408, rcf: 385, rf: 314 },
    "dodger stadium": { lf: 330, lcf: 375, cf: 395, rcf: 375, rf: 330 },
    "oracle park": { lf: 339, lcf: 399, cf: 391, rcf: 421, rf: 309 },
    "coors field": { lf: 347, lcf: 390, cf: 415, rcf: 375, rf: 350 },
    "citizens bank park": { lf: 329, lcf: 374, cf: 401, rcf: 369, rf: 330 },
    "citi field": { lf: 335, lcf: 385, cf: 408, rcf: 398, rf: 330 },
    "pnc park": { lf: 325, lcf: 389, cf: 399, rcf: 375, rf: 320 },
    "petco park": { lf: 336, lcf: 390, cf: 396, rcf: 391, rf: 322 },
    "busch stadium": { lf: 336, lcf: 375, cf: 400, rcf: 375, rf: 335 },
    "american family field": { lf: 344, lcf: 371, cf: 400, rcf: 374, rf: 345 },
    "kauffman stadium": { lf: 330, lcf: 387, cf: 410, rcf: 387, rf: 330 },
    "comerica park": { lf: 345, lcf: 370, cf: 420, rcf: 365, rf: 330 },
    "chase field": { lf: 330, lcf: 374, cf: 407, rcf: 374, rf: 334 },
    "angel stadium": { lf: 347, lcf: 390, cf: 396, rcf: 370, rf: 350 },
    "t-mobile park": { lf: 331, lcf: 378, cf: 401, rcf: 381, rf: 326 },
    "nationals park": { lf: 337, lcf: 377, cf: 402, rcf: 370, rf: 335 },
    "great american ball park": { lf: 328, lcf: 379, cf: 404, rcf: 370, rf: 325 },
    "loanDepot park": { lf: 344, lcf: 386, cf: 400, rcf: 387, rf: 335 },
    "oriole park": { lf: 333, lcf: 384, cf: 410, rcf: 373, rf: 318 },
    "rate field": { lf: 330, lcf: 375, cf: 400, rcf: 375, rf: 335 },
    "steinbrenner": { lf: 318, lcf: 399, cf: 408, rcf: 385, rf: 314 }
  };

  for (const name of Object.keys(parks)) {
    if (key.includes(name.toLowerCase())) return parks[name];
  }

  return { lf: 330, lcf: 375, cf: 400, rcf: 375, rf: 330 };
}

function renderSlipParkOutline(venue = "", windText = "") {
  const d = getParkDimensionsByVenue(venue);

  return \`
    <div class="slip-park-mini">
      <svg viewBox="0 0 260 190" class="slip-park-svg" aria-label="Park dimensions">
        <defs>
          <radialGradient id="slipGrass" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stop-color="rgba(0,255,140,.30)" />
            <stop offset="100%" stop-color="rgba(0,255,140,.06)" />
          </radialGradient>
        </defs>

        <path d="M130 178 L23 78 Q130 8 237 78 Z" class="slip-park-outfield"></path>
        <path d="M130 178 L92 140 L130 102 L168 140 Z" class="slip-park-infield"></path>

        <line x1="130" y1="178" x2="23" y2="78" class="slip-park-line"></line>
        <line x1="130" y1="178" x2="74" y2="38" class="slip-park-line"></line>
        <line x1="130" y1="178" x2="130" y2="16" class="slip-park-line"></line>
        <line x1="130" y1="178" x2="186" y2="38" class="slip-park-line"></line>
        <line x1="130" y1="178" x2="237" y2="78" class="slip-park-line"></line>

        <text x="20" y="73" class="slip-park-text">LF \${d.lf}</text>
        <text x="54" y="35" class="slip-park-text">LC \${d.lcf}</text>
        <text x="111" y="18" class="slip-park-text">CF \${d.cf}</text>
        <text x="171" y="35" class="slip-park-text">RC \${d.rcf}</text>
        <text x="213" y="73" class="slip-park-text">RF \${d.rf}</text>

        <circle cx="130" cy="178" r="4" class="slip-park-base"></circle>
        <circle cx="92" cy="140" r="3" class="slip-park-base"></circle>
        <circle cx="130" cy="102" r="3" class="slip-park-base"></circle>
        <circle cx="168" cy="140" r="3" class="slip-park-base"></circle>
      </svg>
      <div class="slip-park-caption">\${venue || "MLB Park"}</div>
      <div class="slip-park-wind">\${windText || ""}</div>
    </div>
  \`;
}
`;

if (!weatherJs.includes("function getParkDimensionsByVenue")) {
  weatherJs = parkOverlayCode + "\n\n" + weatherJs;
}

weatherJs = weatherJs.replace(
  /<div class="weather-wind-icon">[\s\S]*?<\/div>/g,
  "${renderSlipParkOutline(game.venue || game.park || game.ballpark || '', game.wind_text || game.windText || game.wind || '')}"
);

weatherJs = weatherJs.replace(
  /<div class="wind-icon">[\s\S]*?<\/div>/g,
  "${renderSlipParkOutline(game.venue || game.park || game.ballpark || '', game.wind_text || game.windText || game.wind || '')}"
);

weatherJs = weatherJs.replace(
  /<div class="park-outline">[\s\S]*?<\/div>/g,
  "${renderSlipParkOutline(game.venue || game.park || game.ballpark || '', game.wind_text || game.windText || game.wind || '')}"
);

fs.writeFileSync(weatherJsPath, weatherJs);

const css = `
<style>
.slip-park-mini {
  width: 190px;
  min-width: 190px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.slip-park-svg {
  width: 185px;
  height: 135px;
  display: block;
  filter: drop-shadow(0 0 18px rgba(0,255,140,.18));
}

.slip-park-outfield {
  fill: url(#slipGrass);
  stroke: rgba(0,255,140,.9);
  stroke-width: 3;
}

.slip-park-infield {
  fill: rgba(194,130,61,.48);
  stroke: rgba(255,255,255,.34);
  stroke-width: 1.6;
}

.slip-park-line {
  stroke: rgba(255,255,255,.22);
  stroke-width: 1.2;
  stroke-dasharray: 4 5;
}

.slip-park-base {
  fill: #fff;
}

.slip-park-text {
  fill: #fff;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .02em;
  paint-order: stroke;
  stroke: #020403;
  stroke-width: 4px;
}

.slip-park-caption {
  color: #b77cff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.1;
  margin-top: 1px;
}

.slip-park-wind {
  color: rgba(255,255,255,.70);
  font-size: 10px;
  line-height: 1.15;
  margin-top: 3px;
  max-width: 170px;
}

.weather-card .slip-park-mini,
.weather-row .slip-park-mini {
  margin-left: auto;
}

@media (max-width: 900px) {
  .slip-park-mini {
    width: 100%;
    min-width: 100%;
  }

  .slip-park-svg {
    width: 100%;
    max-width: 240px;
    height: auto;
  }
}
</style>
`;

if (!weatherHtml.includes(".slip-park-mini")) {
  weatherHtml = weatherHtml.replace("</head>", `${css}\n</head>`);
}

fs.writeFileSync(weatherHtmlPath, weatherHtml);

console.log("THE SLIP LAB WEATHER PARK OUTLINES FIXED");
console.log("Updated: weather.js");
console.log("Updated: weather.html");
