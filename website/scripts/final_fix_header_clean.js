import fs from "fs";
import path from "path";

const ROOT = process.cwd();
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

function clean(html) {
  html = html.replace(/\\n/g, "");

  html = html.replace(/<header[\s\S]*?<\/header>/gi, "");

  html = html.replace(
    /<body([^>]*)>\s*(?:<a[^>]*>TSL<\/a>|TSL|The Slip Lab|MLB Home Run Intelligence|Home|Top Plays|Value|Power Zones|Stacks|Slate|Weather|Results|\s|<br\s*\/?>|<\/?div[^>]*>|<\/?span[^>]*>)*\s*/i,
    `<body$1>\n${header}\n`
  );

  if (!html.includes("tsl-site-header")) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}\n`);
  }

  return html;
}

for (const page of pages) {
  const full = path.join(ROOT, page);
  const old = fs.readFileSync(full, "utf8");
  const next = clean(old);
  fs.writeFileSync(full, next);
  console.log("Fixed", page);
}

const cssBlock = `

html {
  scroll-behavior: smooth;
}

.scroll-anchor {
  display: block;
  position: relative;
  top: -125px;
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

for (const name of ["style.css", "styles.css", "power-zones.css", "app.css"]) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;

  let css = fs.readFileSync(file, "utf8");
  css = css.replace(/html \{[\s\S]*?scroll-behavior: smooth;[\s\S]*?\}/g, "");
  css = css.replace(/\.scroll-anchor[\s\S]*?\}/g, "");
  css = css.replace(/\.tsl-site-header[\s\S]*?@media \(max-width: 980px\)[\s\S]*?\}\s*\}/g, "");
  css += cssBlock;

  fs.writeFileSync(file, css);
  console.log("Updated CSS", name);
}

console.log("Header fully cleaned.");
