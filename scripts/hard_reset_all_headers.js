import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const files = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));

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
    <a href="index.html">Home</a>
    <a href="index.html#top-plays">Top Plays</a>
    <a href="index.html#value-plays">Value</a>
    <a href="power-zones.html">Power Zones</a>
    <a href="index.html#stacks">Stacks</a>
    <a href="index.html#slate">Slate</a>
    <a href="weather.html">Weather</a>
    <a href="results.html">Results</a>
  </nav>
</header>
`;

function cleanHtml(html) {
  html = html.replace(/\\n/g, "");

  html = html.replace(/<header[\s\S]*?<\/header>/gi, "");
  html = html.replace(/<nav[\s\S]*?<\/nav>/gi, match => {
    if (match.includes("filter") || match.includes("tabs")) return match;
    return "";
  });

  html = html.replace(/<section id="top-plays" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="value-plays" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="stacks" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="slate" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="weather" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");
  html = html.replace(/<section id="results" class="home-anchor-section">[\s\S]*?<\/section>/gi, "");

  html = html.replace(
    /<body([^>]*)>[\s\S]*?(?=<main|<section|<div class="hero|<div class="page|<div class="container|<div class="weather|<div class="results|<div class="power|<div id="app)/i,
    `<body$1>\n${header}\n`
  );

  if (!html.includes("tsl-site-header")) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n`);
  }

  return html;
}

for (const file of files) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  html = cleanHtml(html);
  fs.writeFileSync(full, html);
  console.log("Cleaned", file);
}

const cssBlock = `

/* HARD RESET GLOBAL HEADER */
body > header:not(.tsl-site-header),
body > .site-header:not(.tsl-site-header),
body > .topbar,
body > .site-topbar,
body > .power-header,
body > .nav,
body > .navbar {
  display: none !important;
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
  display: flex;
  align-items: center;
  gap: 14px;
  color: #ffffff;
  text-decoration: none;
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

.tsl-pill-nav a {
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
}

.tsl-pill-nav a:hover {
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

  let css = fs.readFileSync(full, "utf8");
  css = css.replace(/\/\* HARD RESET GLOBAL HEADER \*\/[\s\S]*$/g, "");
  css += cssBlock;
  fs.writeFileSync(full, css);
  console.log("Updated CSS", cssFile);
}

console.log("Hard header reset complete.");
