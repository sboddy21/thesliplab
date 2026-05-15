import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WEATHER_JS = path.join(ROOT, "website", "weather.js");
const WEATHER_HTML = path.join(ROOT, "website", "weather.html");

let js = fs.readFileSync(WEATHER_JS, "utf8");

const parkBlock = `
const PARK_DIMENSIONS = {
  "PNC Park": { lf: 325, lcf: 383, cf: 399, rcf: 375, rf: 320 },
  "Great American Ball Park": { lf: 328, lcf: 379, cf: 404, rcf: 370, rf: 325 },
  "Citi Field": { lf: 335, lcf: 358, cf: 408, rcf: 375, rf: 330 },
  "Target Field": { lf: 339, lcf: 377, cf: 404, rcf: 367, rf: 328 },
  "American Family Field": { lf: 344, lcf: 371, cf: 400, rcf: 374, rf: 345 },
  "Sutter Health Park": { lf: 330, lcf: 403, cf: 403, rcf: 380, rf: 325 },
  "Fenway Park": { lf: 310, lcf: 379, cf: 390, rcf: 420, rf: 302 },
  "Truist Park": { lf: 335, lcf: 385, cf: 400, rcf: 375, rf: 325 },
  "Rate Field": { lf: 330, lcf: 375, cf: 400, rcf: 375, rf: 335 },
  "Dodger Stadium": { lf: 330, lcf: 375, cf: 395, rcf: 375, rf: 330 },
  "Globe Life Field": { lf: 329, lcf: 372, cf: 407, rcf: 374, rf: 326 },
  "Rogers Centre": { lf: 328, lcf: 375, cf: 400, rcf: 375, rf: 328 },
  "Guaranteed Rate Field": { lf: 330, lcf: 377, cf: 400, rcf: 372, rf: 335 },
  "Daikin Park": { lf: 315, lcf: 362, cf: 409, rcf: 373, rf: 326 },
  "Oracle Park": { lf: 339, lcf: 399, cf: 391, rcf: 421, rf: 309 },
  "Yankee Stadium": { lf: 318, lcf: 399, cf: 408, rcf: 385, rf: 314 },
  "T-Mobile Park": { lf: 331, lcf: 378, cf: 401, rcf: 381, rf: 326 },
  "Coors Field": { lf: 347, lcf: 390, cf: 415, rcf: 375, rf: 350 },
  "Petco Park": { lf: 336, lcf: 390, cf: 396, rcf: 391, rf: 322 },
  "Wrigley Field": { lf: 355, lcf: 368, cf: 400, rcf: 368, rf: 353 },
  "Busch Stadium": { lf: 336, lcf: 375, cf: 400, rcf: 375, rf: 335 },
  "Citizens Bank Park": { lf: 329, lcf: 374, cf: 401, rcf: 369, rf: 330 },
  "loanDepot park": { lf: 344, lcf: 386, cf: 400, rcf: 387, rf: 335 },
  "Angel Stadium": { lf: 347, lcf: 390, cf: 396, rcf: 370, rf: 350 },
  "Kauffman Stadium": { lf: 330, lcf: 387, cf: 410, rcf: 387, rf: 330 },
  "Comerica Park": { lf: 345, lcf: 370, cf: 420, rcf: 365, rf: 330 },
  "Progressive Field": { lf: 325, lcf: 370, cf: 400, rcf: 375, rf: 325 },
  "Chase Field": { lf: 330, lcf: 374, cf: 407, rcf: 374, rf: 334 },
  "Tropicana Field": { lf: 315, lcf: 370, cf: 404, rcf: 370, rf: 322 },
  "Oriole Park at Camden Yards": { lf: 333, lcf: 364, cf: 410, rcf: 373, rf: 318 },
  "Nationals Park": { lf: 337, lcf: 377, cf: 402, rcf: 370, rf: 335 }
};

function parkDiagram(venue) {
  const p = PARK_DIMENSIONS[venue];

  if (!p) {
    return \`
      <div class="park-diagram missing">
        <div class="park-label">Park Dimensions</div>
        <div class="park-missing">Unavailable</div>
      </div>
    \`;
  }

  return \`
    <div class="park-diagram">
      <div class="park-label">Park Layout</div>
      <div class="mini-field">
        <span class="dim lf">\${p.lf}</span>
        <span class="dim lcf">\${p.lcf}</span>
        <span class="dim cf">\${p.cf}</span>
        <span class="dim rcf">\${p.rcf}</span>
        <span class="dim rf">\${p.rf}</span>
        <span class="diamond-base"></span>
      </div>
      <div class="dim-row">
        <span>LF</span><span>LCF</span><span>CF</span><span>RCF</span><span>RF</span>
      </div>
    </div>
  \`;
}
`;

if (!js.includes("const PARK_DIMENSIONS")) {
  js = parkBlock + "\n" + js;
}

js = js.replace(
  `<div class="wind-label">\\\${safe(row.wind_text)}</div>
        </div>
      </article>`,
  `<div class="wind-label">\\\${safe(row.wind_text)}</div>
        </div>

        <div class="park-cell">
          \\\${parkDiagram(row.venue)}
        </div>
      </article>`
);

fs.writeFileSync(WEATHER_JS, js);

let html = fs.readFileSync(WEATHER_HTML, "utf8");

html = html.replace(
  /grid-template-columns: 1\.65fr 1fr 1fr 1fr 1\.35fr;/g,
  "grid-template-columns: 1.45fr .85fr .85fr .85fr 1.1fr 1.5fr;"
);

const css = `
    .park-cell {
      padding: 14px;
      border-right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-left: 1px solid rgba(255,255,255,.10);
    }

    .park-diagram {
      width: 150px;
      text-align: center;
    }

    .park-label {
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .14em;
      font-weight: 900;
      margin-bottom: 8px;
    }

    .mini-field {
      position: relative;
      width: 132px;
      height: 92px;
      margin: 0 auto 6px;
      border: 1px solid rgba(0,255,136,.28);
      border-bottom: 0;
      border-radius: 70px 70px 12px 12px;
      background:
        radial-gradient(circle at 50% 90%, rgba(245,158,11,.42), transparent 18%),
        linear-gradient(180deg, rgba(0,255,136,.13), rgba(59,130,246,.10));
      overflow: hidden;
    }

    .mini-field:before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: -16px;
      width: 58px;
      height: 58px;
      background: rgba(245,158,11,.28);
      transform: translateX(-50%) rotate(45deg);
      border: 1px solid rgba(245,158,11,.35);
    }

    .diamond-base {
      position: absolute;
      left: 50%;
      bottom: 8px;
      width: 18px;
      height: 18px;
      background: rgba(255,255,255,.9);
      transform: translateX(-50%) rotate(45deg);
      opacity: .65;
    }

    .dim {
      position: absolute;
      font-size: 11px;
      font-weight: 900;
      color: #00ff88;
      text-shadow: 0 0 8px rgba(0,0,0,.7);
    }

    .dim.lf { left: 8px; bottom: 18px; }
    .dim.lcf { left: 25px; top: 26px; }
    .dim.cf { left: 50%; top: 8px; transform: translateX(-50%); color: #facc15; }
    .dim.rcf { right: 25px; top: 26px; }
    .dim.rf { right: 8px; bottom: 18px; }

    .dim-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 2px;
      color: #7c8a83;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .08em;
    }

    .park-missing {
      color: #64748b;
      font-size: 12px;
      padding: 22px 0;
    }
`;

if (!html.includes(".park-cell")) {
  html = html.replace("</style>", `${css}\n</style>`);
}

html = html.replace(
  /grid-template-columns: 1fr 1fr;/g,
  "grid-template-columns: 1fr;"
);

fs.writeFileSync(WEATHER_HTML, html);

console.log("Park dimensions added to weather page.");
