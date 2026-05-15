import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));

const NAV = [
  ["Home", "index.html"],
  ["Top Plays", "index.html#top-plays"],
  ["Value", "index.html#value-plays"],
  ["Power Zones", "power-zones.html"],
  ["Stacks", "index.html#stacks"],
  ["Slate", "slate.html"],
  ["Weather", "weather.html"],
  ["Results", "results.html"]
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function write(file, data) {
  fs.writeFileSync(file, data);
}

function pageExists(href) {
  const clean = href.split("#")[0];
  if (!clean || clean === "index.html") return true;
  return fs.existsSync(path.join(ROOT, clean));
}

function safeHref(href) {
  if (pageExists(href)) return href;
  if (href === "slate.html") return "index.html#slate";
  if (href === "weather.html") return "index.html#weather";
  if (href === "results.html") return "index.html#results";
  return "index.html";
}

function headerFor(page) {
  const links = NAV.map(([label, href]) => {
    const fixed = safeHref(href);
    const base = fixed.split("#")[0];
    const active =
      page === base ||
      (page === "index.html" && fixed === "index.html")
        ? " active"
        : "";

    return `<a class="tsl-pill-link${active}" href="${fixed}">${label}</a>`;
  }).join("\n    ");

  return `<header class="tsl-site-header">
  <a class="tsl-brand" href="index.html">
    <div class="tsl-logo">TSL</div>
    <div>
      <div class="tsl-brand-title">The Slip Lab</div>
      <div class="tsl-brand-subtitle">MLB Home Run Intelligence</div>
    </div>
  </a>

  <nav class="tsl-pill-nav">
    ${links}
  </nav>
</header>`;
}

function removeOldTop(html) {
  html = html.replace(/\\n/g, "");
  html = html.replace(/<header[\s\S]*?<\/header>/gi, "");

  html = html.replace(
    /<body([^>]*)>\s*(?:<a[^>]*>TSL<\/a>|TSL|The Slip Lab|MLB Home Run Intelligence|Home|Top Plays|Value|Power Zones|Stacks|Slate|Weather|Results|\s|<br\s*\/?>|<\/?div[^>]*>|<\/?span[^>]*>)*\s*/i,
    "<body$1>\n"
  );

  html = html.replace(/stacks">Stacks/g, "Stacks");
  html = html.replace(/stacks&quot;&gt;Stacks/g, "Stacks");

  return html;
}

function installHeader(file) {
  const full = path.join(ROOT, file);
  let html = read(full);

  html = removeOldTop(html);

  const header = headerFor(file);

  if (/<body[^>]*>/i.test(html)) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n`);
  } else {
    html = `${header}\n${html}`;
  }

  write(full, html);
}

function ensureAnchor(html, id, words) {
  if (html.includes(`id="${id}"`)) return html;

  for (const word of words) {
    const regex = new RegExp(`(<[^>]+>\\s*)(${word})(\\s*<\\/[^>]+>)`, "i");
    if (regex.test(html)) {
      return html.replace(regex, `<div id="${id}" class="scroll-anchor"></div>\n$1$2$3`);
    }
  }

  return html;
}

function fixIndexAnchors() {
  const file = path.join(ROOT, "index.html");
  if (!fs.existsSync(file)) return;

  let html = read(file);

  html = html.replace(/<section id="top-plays" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="value-plays" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="stacks" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="slate" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="weather" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="results" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");

  html = ensureAnchor(html, "top-plays", ["Top HR Plays", "Top Plays", "Probability Board"]);
  html = ensureAnchor(html, "value-plays", ["Value Plays", "Value"]);
  html = ensureAnchor(html, "stacks", ["HR Stacks", "Stacks"]);
  html = ensureAnchor(html, "slate", ["Today's Slate", "Slate"]);

  write(file, html);
}

function fixPowerZonesJs() {
  const file = path.join(ROOT, "power-zones.js");
  if (!fs.existsSync(file)) return;

  let js = read(file);

  if (js.includes("function headshotUrl(player)")) {
    js = js.replace(
      /function headshotUrl\(player\) \{[\s\S]*?\n\}/,
      `function headshotUrl(player) {
  return (
    player?.headshot_url ||
    player?.headshot ||
    player?.player_image ||
    player?.mlb_headshot_url ||
    player?.image ||
    player?.photo ||
    ""
  );
}`
    );
  }

  js = js.replace(/this\.remove\(\); this\.parentElement\.innerHTML/g, "this.style.display='none'; this.parentElement.classList.add('photo-failed'); this.parentElement.innerHTML");

  write(file, js);
}

function fixPowerZonesData() {
  const file = path.join(ROOT, "data", "power_zones.json");
  if (!fs.existsSync(file)) return;

  let rows = JSON.parse(read(file));

  rows = rows.map(row => {
    const id = row.mlbam || row.mlbam_id || row.player_id || "";
    const url = id
      ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${id}/headshot/67/current`
      : row.headshot_url || row.headshot || row.player_image || row.mlb_headshot_url || "";

    return {
      ...row,
      mlbam: id,
      mlbam_id: id,
      player_id: id,
      headshot_url: url,
      headshot: url,
      player_image: url,
      mlb_headshot_url: url
    };
  });

  write(file, JSON.stringify(rows, null, 2));
}

function writeGlobalCss() {
  const css = `

/* THE SLIP LAB FINAL GLOBAL HEADER */
html {
  scroll-behavior: smooth;
}

.scroll-anchor {
  display: block;
  position: relative;
  top: -128px;
  visibility: hidden;
}

.tsl-site-header {
  width: 100%;
  min-height: 96px;
  padding: 18px 34px;
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: rgba(5, 7, 13, 0.96);
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  position: sticky;
  top: 0;
  z-index: 99999;
  backdrop-filter: blur(16px);
}

.tsl-brand {
  display: flex !important;
  align-items: center;
  gap: 14px;
  color: #ffffff !important;
  text-decoration: none !important;
  flex-shrink: 0;
}

.tsl-logo {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: #10ff7c;
  color: #06100b;
  display: grid;
  place-items: center;
  font-weight: 950;
  font-size: 16px;
  box-shadow: 0 0 30px rgba(16, 255, 124, 0.22);
}

.tsl-brand-title {
  color: #ffffff;
  font-size: 24px;
  line-height: 1;
  font-weight: 950;
}

.tsl-brand-subtitle {
  margin-top: 8px;
  color: #10ff7c;
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.tsl-pill-nav {
  display: flex !important;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.tsl-pill-link {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.09) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  padding: 12px 18px !important;
  border-radius: 999px !important;
  font-size: 14px !important;
  font-weight: 900 !important;
  line-height: 1 !important;
  text-decoration: none !important;
  text-transform: none !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.18);
  transition: 0.15s ease;
}

.tsl-pill-link:hover,
.tsl-pill-link.active {
  background: rgba(16, 255, 124, 0.18) !important;
  border-color: rgba(16, 255, 124, 0.48) !important;
  transform: translateY(-1px);
}

@media (max-width: 980px) {
  .tsl-site-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 18px;
  }

  .tsl-pill-nav {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .tsl-site-header {
    align-items: center;
  }

  .tsl-pill-nav {
    justify-content: center;
  }

  .tsl-pill-link {
    padding: 11px 14px !important;
    font-size: 13px !important;
  }
}
`;

  for (const name of ["style.css", "styles.css", "power-zones.css", "app.css"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;

    let old = read(file);
    old = old.replace(/\/\* THE SLIP LAB FINAL GLOBAL HEADER \*\/[\s\S]*$/g, "");
    old = old.replace(/\/\* HARD RESET GLOBAL HEADER \*\/[\s\S]*$/g, "");
    old = old.replace(/\/\* THE SLIP LAB GLOBAL PILL HEADER \*\/[\s\S]*$/g, "");
    old = old.replace(/\/\* FORCE HOMEPAGE PILL NAV \*\/[\s\S]*$/g, "");

    write(file, old + css);
  }
}

function audit() {
  const issues = [];

  for (const file of htmlFiles) {
    const html = read(path.join(ROOT, file));

    const headerCount = (html.match(/tsl-site-header/g) || []).length;
    if (headerCount !== 1) issues.push(`${file}: header count ${headerCount}`);

    if (html.includes("\\n")) issues.push(`${file}: contains literal slash n`);
    if (/MLB Home Run Intelligence\s*Home\s*Top Plays/i.test(html)) issues.push(`${file}: raw nav text may remain`);

    for (const [, href] of NAV) {
      const clean = href.split("#")[0];
      if (clean && clean.endsWith(".html") && !fs.existsSync(path.join(ROOT, clean))) {
        issues.push(`${file}: missing linked page ${clean}`);
      }
    }
  }

  const index = read(path.join(ROOT, "index.html"));
  for (const id of ["top-plays", "value-plays", "stacks"]) {
    if (!index.includes(`id="${id}"`)) issues.push(`index.html: missing anchor ${id}`);
  }

  const pz = path.join(ROOT, "data", "power_zones.json");
  if (fs.existsSync(pz)) {
    const rows = JSON.parse(read(pz));
    const withShots = rows.filter(r => r.headshot_url || r.headshot || r.player_image || r.mlb_headshot_url).length;
    if (rows.length && withShots === 0) issues.push("power_zones.json: no headshot fields populated");
  }

  console.log("");
  console.log("WEBSITE AUDIT");
  console.log("Pages checked:", htmlFiles.length);

  if (!issues.length) {
    console.log("Status: CLEAN");
  } else {
    console.log("Issues:");
    for (const issue of issues) console.log("  " + issue);
  }
}

for (const file of htmlFiles) installHeader(file);
fixIndexAnchors();
fixPowerZonesJs();
fixPowerZonesData();
writeGlobalCss();
audit();

console.log("");
console.log("Repair complete.");
