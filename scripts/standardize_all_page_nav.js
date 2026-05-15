import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const htmlFiles = fs
  .readdirSync(ROOT)
  .filter(file => file.endsWith(".html"));

const navLinks = [
  { label: "Home", href: "index.html" },
  { label: "Top Plays", href: "index.html#top-plays" },
  { label: "Value", href: "index.html#value-plays" },
  { label: "Power Zones", href: "power-zones.html" },
  { label: "Stacks", href: "index.html#stacks" },
  { label: "Slate", href: "index.html#slate" },
  { label: "Weather", href: "weather.html" },
  { label: "Results", href: "results.html" }
];

function pageExists(href) {
  if (!href.endsWith(".html")) return true;
  return fs.existsSync(path.join(ROOT, href));
}

function cleanHref(href) {
  if (href === "weather.html" && !pageExists(href)) return "index.html#weather";
  if (href === "results.html" && !pageExists(href)) return "index.html#results";
  return href;
}

function activeClass(file, href) {
  const base = href.split("#")[0];
  if (file === "index.html" && href === "index.html") return " active";
  if (file !== "index.html" && base === file) return " active";
  return "";
}

function buildHeader(file) {
  const links = navLinks
    .map(link => {
      const href = cleanHref(link.href);
      return `<a class="tsl-pill-link${activeClass(file, href)}" href="${href}">${link.label}</a>`;
    })
    .join("\n      ");

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

function replaceHeader(html, file) {
  html = html.replace(/\\n/g, "");

  html = html.replace(/<header class="tsl-site-header">[\s\S]*?<\/header>/g, "");
  html = html.replace(/<header class="site-header">[\s\S]*?<\/header>/g, "");
  html = html.replace(/<header class="tsl-top-nav">[\s\S]*?<\/header>/g, "");

  const header = buildHeader(file);

  if (/<body[^>]*>/i.test(html)) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${header}`);
  } else {
    html = `${header}\n${html}`;
  }

  return html;
}

for (const file of htmlFiles) {
  const full = path.join(ROOT, file);
  const oldHtml = fs.readFileSync(full, "utf8");
  const newHtml = replaceHeader(oldHtml, file);
  fs.writeFileSync(full, newHtml);
  console.log("Updated", file);
}

const cssBlock = `

/* THE SLIP LAB GLOBAL PILL HEADER */
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
  z-index: 999;
  backdrop-filter: blur(16px);
}

.tsl-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  color: #ffffff;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.tsl-pill-link {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: 12px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
  text-transform: none;
  text-decoration: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.18);
  transition: 0.15s ease;
}

.tsl-pill-link:hover,
.tsl-pill-link.active {
  color: #ffffff;
  background: rgba(16, 255, 124, 0.18);
  border-color: rgba(16, 255, 124, 0.48);
  transform: translateY(-1px);
}

@media (max-width: 980px) {
  .tsl-site-header {
    padding: 18px;
    flex-direction: column;
    align-items: flex-start;
  }

  .tsl-pill-nav {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .tsl-site-header {
    align-items: center;
  }

  .tsl-brand {
    justify-content: center;
  }

  .tsl-pill-nav {
    justify-content: center;
  }

  .tsl-pill-link {
    padding: 11px 14px;
    font-size: 13px;
  }
}
`;

const cssFiles = ["style.css", "styles.css", "power-zones.css", "app.css"].filter(file =>
  fs.existsSync(path.join(ROOT, file))
);

if (!cssFiles.includes("style.css")) {
  fs.writeFileSync(path.join(ROOT, "style.css"), "");
  cssFiles.push("style.css");
}

for (const file of cssFiles) {
  const full = path.join(ROOT, file);
  let css = fs.readFileSync(full, "utf8");

  css = css.replace(/\/\* THE SLIP LAB GLOBAL PILL HEADER \*\/[\s\S]*$/g, "");
  css += cssBlock;

  fs.writeFileSync(full, css);
  console.log("Updated CSS", file);
}

console.log("All page navs standardized.");
