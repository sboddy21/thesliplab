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
html = html.replace(/<header class="tsl-top-nav">[\s\S]*?<\/header>/g, "");

const nav = `
<header class="site-header">
  <div class="brand">
    <div class="logo">TSL</div>
    <div>
      <div class="brand-title">The Slip Lab</div>
      <div class="brand-subtitle">MLB Home Run Intelligence</div>
    </div>
  </div>

  <nav class="main-nav">
    <a href="index.html">Home</a>
    <a href="#top-plays">Top Plays</a>
    <a href="#value">Value</a>
    <a href="power-zones.html">Power Zones</a>
    <a href="#stacks">Stacks</a>
    <a href="#slate">Slate</a>
    <a href="#weather">Weather</a>
    <a href="#results">Results</a>
  </nav>
</header>
`;

html = html.replace(/<header[\s\S]*?<\/header>/, nav);

write(htmlFile, html);

const cssFiles = ["style.css", "styles.css", "app.css"];
let cssFile = cssFiles.map(f => path.join(ROOT, f)).find(f => fs.existsSync(f));

if (!cssFile) {
  cssFile = path.join(ROOT, "style.css");
  write(cssFile, "");
}

let css = read(cssFile);

css = css.replace(/\.tsl-top-nav[\s\S]*?@media \(max-width: 700px\)[\s\S]*?\}\s*\}/g, "");

css += `

.site-header {
  width: 100%;
  height: 92px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(5, 7, 13, 0.96);
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(16px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #10ff7c;
  color: #06100b;
  display: grid;
  place-items: center;
  font-weight: 950;
  box-shadow: 0 0 28px rgba(16, 255, 124, 0.22);
}

.brand-title {
  color: #ffffff;
  font-size: 22px;
  line-height: 1;
  font-weight: 950;
}

.brand-subtitle {
  margin-top: 6px;
  color: #10ff7c;
  font-size: 12px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.main-nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 26px;
}

.main-nav a {
  color: rgba(255, 255, 255, 0.68);
  text-decoration: none;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: color 0.15s ease, transform 0.15s ease;
}

.main-nav a:hover,
.main-nav a.active {
  color: #10ff7c;
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .site-header {
    height: auto;
    padding: 18px;
    flex-direction: column;
    gap: 18px;
  }

  .main-nav {
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
  }
}
`;

write(cssFile, css);

console.log("Homepage nav cleaned.");
console.log("Removed literal slash n.");
console.log("Added Power Zones into main nav.");
console.log("Updated:", htmlFile);
console.log("Updated:", cssFile);
