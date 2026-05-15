import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function write(file, data) {
  fs.writeFileSync(file, data);
}

const pages = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));

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
    <a class="tsl-pill-link" href="slate.html">Slate</a>
    <a class="tsl-pill-link" href="weather.html">Weather</a>
    <a class="tsl-pill-link" href="results.html">Results</a>
  </nav>
</header>
`;

function removeTopJunk(html) {
  html = html.replace(/\\n/g, "");
  html = html.replace(/<header[\s\S]*?<\/header>/gi, "");

  html = html.replace(
    /<body([^>]*)>[\s\S]*?(?=<main|<section|<div class="results-page"|<div class="weather|<div class="power|<div class="hero|<div class="container|<div id="app")/i,
    `<body$1>\n${header}\n`
  );

  if (!html.includes("tsl-site-header")) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n`);
  }

  return html;
}

for (const page of pages) {
  const file = path.join(ROOT, page);
  let html = read(file);
  html = removeTopJunk(html);

  if (page === "results.html" && !html.includes('<main class="results-page">')) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n<main class="results-page">`);
    html = html.replace(/<\/body>/i, `</main>\n</body>`);
  }

  write(file, html);
  console.log("Cleaned", page);
}

const globalCss = `
/* THE SLIP LAB SITE RESET */
* {
  box-sizing: border-box;
}

html {
  background: #05070d;
  color: #ffffff;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 10%, rgba(16, 255, 124, 0.12), transparent 34%),
    radial-gradient(circle at 90% 4%, rgba(113, 45, 255, 0.12), transparent 30%),
    #05070d !important;
  color: #ffffff !important;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow-x: hidden;
}

a {
  color: inherit;
}

.tsl-site-header {
  width: 100%;
  min-height: 96px;
  padding: 18px 28px;
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
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
  white-space: nowrap;
}

.tsl-pill-nav {
  display: flex !important;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  max-width: calc(100vw - 360px);
}

.tsl-pill-link {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.09) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  padding: 11px 15px !important;
  border-radius: 999px !important;
  font-size: 13px !important;
  font-weight: 900 !important;
  line-height: 1 !important;
  text-decoration: none !important;
  text-transform: none !important;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.18);
  transition: 0.15s ease;
}

.tsl-pill-link:hover,
.tsl-pill-link.active {
  background: rgba(16, 255, 124, 0.18) !important;
  border-color: rgba(16, 255, 124, 0.48) !important;
  transform: translateY(-1px);
}

.results-page {
  padding: 34px;
  color: #ffffff;
  background: transparent !important;
}

.results-grid:empty::after {
  content: "Loading live MLB results...";
  display: block;
  padding: 24px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 22px;
  background: rgba(255,255,255,0.055);
  color: rgba(255,255,255,0.68);
  font-weight: 900;
}

#resultsGrid {
  min-height: 120px;
}

@media (max-width: 1180px) {
  .tsl-site-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .tsl-pill-nav {
    max-width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 700px) {
  .tsl-site-header {
    padding: 18px;
    align-items: center;
  }

  .tsl-brand {
    justify-content: center;
  }

  .tsl-pill-nav {
    justify-content: center;
  }

  .tsl-brand-subtitle {
    white-space: normal;
  }
}
`;

for (const cssFile of ["style.css", "styles.css", "results.css", "weather.css", "power-zones.css", "app.css"]) {
  const file = path.join(ROOT, cssFile);
  if (!fs.existsSync(file)) continue;

  let css = read(file);
  css = css.replace(/\/\* THE SLIP LAB SITE RESET \*\/[\s\S]*$/g, "");
  css += "\n\n" + globalCss;
  write(file, css);
  console.log("Updated CSS", cssFile);
}

const pzJsFile = path.join(ROOT, "power-zones.js");
if (fs.existsSync(pzJsFile)) {
  let js = read(pzJsFile);

  if (!js.includes("No Power Zones match")) {
    js += `

document.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () {
    var grid = document.querySelector(".power-grid, #powerGrid, .cards-grid, .players-grid");
    if (!grid) return;

    var observer = new MutationObserver(function () {
      var hasCards = grid.children && grid.children.length > 0;
      var existing = document.querySelector(".tsl-empty-power-zones");

      if (!hasCards && !existing) {
        var empty = document.createElement("div");
        empty.className = "tsl-empty-power-zones";
        empty.textContent = "No Power Zones match this search.";
        grid.appendChild(empty);
      }

      if (hasCards && existing && grid.children.length > 1) {
        existing.remove();
      }
    });

    observer.observe(grid, { childList: true });
  }, 700);
});
`;
  }

  write(pzJsFile, js);
}

console.log("Final layout repair complete.");
