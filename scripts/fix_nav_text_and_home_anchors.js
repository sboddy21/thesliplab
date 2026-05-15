import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));

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
    <a href="slate.html">Slate</a>
    <a href="weather.html">Weather</a>
    <a href="results.html">Results</a>
  </nav>
</header>
`;

function cleanTopJunk(html) {
  html = html.replace(/\\n/g, "");

  html = html.replace(/<header[\s\S]*?<\/header>/gi, "");

  html = html.replace(
    /<body([^>]*)>[\s\S]*?(?=<main|<section|<div class="hero|<div class="weather|<div class="results|<div class="power|<div class="container|<div id="app")/i,
    `<body$1>\n${header}\n`
  );

  if (!html.includes("tsl-site-header")) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n`);
  }

  return html;
}

for (const file of htmlFiles) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  html = cleanTopJunk(html);
  fs.writeFileSync(full, html);
  console.log("Cleaned", file);
}

const indexFile = path.join(ROOT, "index.html");
let index = fs.readFileSync(indexFile, "utf8");

index = index.replace(/id="top-plays"/g, "");
index = index.replace(/id="value-plays"/g, "");
index = index.replace(/id="stacks"/g, "");
index = index.replace(/id="slate"/g, "");

index = index.replace(/(<section[^>]*class="[^"]*(?:top|plays|probability|board)[^"]*"[^>]*>)/i, `<div id="top-plays" class="scroll-anchor"></div>\n$1`);
index = index.replace(/(<section[^>]*class="[^"]*(?:value)[^"]*"[^>]*>)/i, `<div id="value-plays" class="scroll-anchor"></div>\n$1`);
index = index.replace(/(<section[^>]*class="[^"]*(?:stack|stacks)[^"]*"[^>]*>)/i, `<div id="stacks" class="scroll-anchor"></div>\n$1`);

if (!index.includes('id="top-plays"')) {
  index = index.replace(/Probability Board/i, `<span id="top-plays" class="scroll-anchor"></span>Probability Board`);
}

if (!index.includes('id="value-plays"')) {
  index = index.replace(/Value Plays/i, `<span id="value-plays" class="scroll-anchor"></span>Value Plays`);
}

if (!index.includes('id="stacks"')) {
  index = index.replace(/HR Stacks|Stacks/i, `<span id="stacks" class="scroll-anchor"></span>$&`);
}

fs.writeFileSync(indexFile, index);

const cssBlock = `

html {
  scroll-behavior: smooth;
}

.scroll-anchor {
  display: block;
  position: relative;
  top: -120px;
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
  css = css.replace(/html \{[\s\S]*?scroll-behavior: smooth;[\s\S]*?\}/g, "");
  css = css.replace(/\.scroll-anchor[\s\S]*?\}/g, "");
  css = css.replace(/\.tsl-site-header[\s\S]*?@media \(max-width: 980px\)[\s\S]*?\}\s*\}/g, "");
  css += cssBlock;

  fs.writeFileSync(full, css);
  console.log("Updated CSS", cssFile);
}

console.log("Fixed raw nav text and homepage anchors.");
