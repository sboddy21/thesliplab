import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function write(file, data) {
  fs.writeFileSync(file, data);
}

const htmlFile = path.join(ROOT, "index.html");
let html = read(htmlFile);

html = html.replace(/\\n/g, "");

html = html.replace(
  /<nav class="main-nav">[\s\S]*?<\/nav>/,
  `<nav class="main-nav home-pill-nav">
    <a href="index.html">Home</a>
    <a href="#top-plays">Top Plays</a>
    <a href="#value">Value</a>
    <a href="power-zones.html">Power Zones</a>
    <a href="#stacks">Stacks</a>
    <a href="#slate">Slate</a>
    <a href="#weather">Weather</a>
    <a href="#results">Results</a>
  </nav>`
);

write(htmlFile, html);

const cssBlock = `

/* FORCE HOMEPAGE PILL NAV */
.home-pill-nav,
.main-nav {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 12px !important;
  flex-wrap: wrap !important;
}

.home-pill-nav a,
.main-nav a,
.site-header nav a {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.09) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  padding: 12px 18px !important;
  border-radius: 999px !important;
  font-size: 14px !important;
  font-weight: 900 !important;
  letter-spacing: 0 !important;
  line-height: 1 !important;
  text-transform: none !important;
  text-decoration: none !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.18) !important;
}

.home-pill-nav a:hover,
.main-nav a:hover,
.site-header nav a:hover {
  color: #ffffff !important;
  background: rgba(16, 255, 124, 0.18) !important;
  border-color: rgba(16, 255, 124, 0.45) !important;
}

@media (max-width: 900px) {
  .home-pill-nav,
  .main-nav {
    justify-content: center !important;
  }
}
`;

const cssFiles = [
  "style.css",
  "styles.css",
  "app.css",
  "power-zones.css"
];

for (const name of cssFiles) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;

  let css = read(file);
  css = css.replace(/\/\* FORCE HOMEPAGE PILL NAV \*\/[\s\S]*$/g, "");
  css += cssBlock;
  write(file, css);
  console.log("Updated", name);
}

console.log("Forced homepage nav pills.");
