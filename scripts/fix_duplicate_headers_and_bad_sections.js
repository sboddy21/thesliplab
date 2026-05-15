import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const pages = fs.readdirSync(ROOT).filter(file => file.endsWith(".html"));

const header = `
<header class="tsl-site-header">
  <a class="tsl-brand" href="index.html">
    <div class="tsl-logo">TSL</div>
    <div>
      <div class="tsl-brand-title">The Slip Lab</div>
      <div class="tsl-brand-subtitle">MLB Home Run Intelligence</div>
    </div>
  </a>

  <nav class="tsl-pill-nav">
    <a class="tsl-pill-link" href="index.html">Home</a>
    <a class="tsl-pill-link" href="index.html#top-plays">Top Plays</a>
    <a class="tsl-pill-link" href="index.html#value-plays">Value</a>
    <a class="tsl-pill-link" href="power-zones.html">Power Zones</a>
    <a class="tsl-pill-link" href="index.html#stacks">Stacks</a>
    <a class="tsl-pill-link" href="index.html#slate">Slate</a>
    <a class="tsl-pill-link" href="weather.html">Weather</a>
    <a class="tsl-pill-link" href="results.html">Results</a>
  </nav>
</header>
`;

function stripBadStuff(html) {
  html = html.replace(/\\n/g, "");

  html = html.replace(/<header class="tsl-site-header">[\s\S]*?<\/header>/g, "");
  html = html.replace(/<header class="site-header">[\s\S]*?<\/header>/g, "");
  html = html.replace(/<header class="tsl-top-nav">[\s\S]*?<\/header>/g, "");
  html = html.replace(/<header class="topbar">[\s\S]*?<\/header>/g, "");
  html = html.replace(/<header class="site-topbar">[\s\S]*?<\/header>/g, "");
  html = html.replace(/<header class="power-header">[\s\S]*?<\/header>/g, "");

  html = html.replace(/<div class="topbar">[\s\S]*?<\/div>/g, "");
  html = html.replace(/<div class="site-header">[\s\S]*?<\/div>/g, "");

  html = html.replace(/<section id="top-plays" class="home-anchor-section">[\s\S]*?<\/section>/g, "");
  html = html.replace(/<section id="value-plays" class="home-anchor-section">[\s\S]*?<\/section>/g, "");
  html = html.replace(/<section id="stacks" class="home-anchor-section">[\s\S]*?<\/section>/g, "");
  html = html.replace(/<section id="slate" class="home-anchor-section">[\s\S]*?<\/section>/g, "");
  html = html.replace(/<section id="weather" class="home-anchor-section">[\s\S]*?<\/section>/g, "");
  html = html.replace(/<section id="results" class="home-anchor-section">[\s\S]*?<\/section>/g, "");

  return html;
}

for (const page of pages) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, "utf8");

  html = stripBadStuff(html);

  html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}`);

  fs.writeFileSync(file, html);
  console.log("Fixed", page);
}

const css = `
.tsl-site-header {
  width: 100%;
  min-height: 96px;
  padding: 18px 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: rgba(5, 7, 13, 0.96);
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  position: sticky;
  top: 0;
  z-index: 9999;
  backdrop-filter: blur(16px);
}

.tsl-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
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
  display: flex;
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
}

.tsl-pill-link:hover {
  background: rgba(16, 255, 124, 0.18) !important;
  border-color: rgba(16, 255, 124, 0.48) !important;
}

@media (max-width: 980px) {
  .tsl-site-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 18px;
  }
}
`;

for (const cssFile of ["style.css", "styles.css", "power-zones.css", "app.css"]) {
  const full = path.join(ROOT, cssFile);
  if (!fs.existsSync(full)) continue;

  let old = fs.readFileSync(full, "utf8");
  old = old.replace(/\/\* THE SLIP LAB GLOBAL PILL HEADER \*\/[\s\S]*$/g, "");
  old = old.replace(/\/\* FORCE HOMEPAGE PILL NAV \*\/[\s\S]*$/g, "");
  old += "\n\n" + css;

  fs.writeFileSync(full, old);
  console.log("Updated CSS", cssFile);
}

console.log("Done. Duplicate headers removed.");
