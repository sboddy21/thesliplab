import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WEBSITE = path.join(ROOT, "website");

const files = ["slate.html", "results.html"];

const css = `
<style id="tsl-nav-style">
.tsl-nav {
  position: sticky;
  top: 0;
  z-index: 9999;
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 34px;
  background: rgba(2,5,4,.96);
  border-bottom: 1px solid rgba(255,255,255,.09);
  backdrop-filter: blur(14px);
}

.tsl-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #fff;
  text-decoration: none;
}

.tsl-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #00ff88;
  color: #021108;
  display: grid;
  place-items: center;
  font-weight: 900;
}

.tsl-brand strong {
  display: block;
  font-size: 20px;
  line-height: 1;
}

.tsl-brand span {
  display: block;
  margin-top: 5px;
  color: #00ff88;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.tsl-links {
  display: flex;
  align-items: center;
  gap: 24px;
}

.tsl-links a {
  color: #cbd5e1;
  text-decoration: none;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.tsl-links a:hover,
.tsl-links a.active {
  color: #00ff88;
}

@media (max-width: 760px) {
  .tsl-nav {
    height: auto;
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
  }

  .tsl-links {
    width: 100%;
    overflow-x: auto;
    gap: 16px;
    padding-bottom: 4px;
  }

  .tsl-links a {
    white-space: nowrap;
  }
}
</style>
`;

function navFor(file) {
  return `
<header class="tsl-nav" id="tsl-site-nav">
  <a class="tsl-brand" href="index.html">
    <div class="tsl-logo">TSL</div>
    <div>
      <strong>The Slip Lab</strong>
      <span>MLB Home Run Intelligence</span>
    </div>
  </a>

  <nav class="tsl-links">
    <a href="index.html">Home</a>
    <a href="index.html#top-plays">Top Plays</a>
    <a href="index.html#value">Value</a>
    <a href="index.html#stacks">Stacks</a>
    <a href="slate.html" class="${file === "slate.html" ? "active" : ""}">Slate</a>
    <a href="results.html" class="${file === "results.html" ? "active" : ""}">Results</a>
  </nav>
</header>
`;
}

for (const file of files) {
  const full = path.join(WEBSITE, file);

  if (!fs.existsSync(full)) {
    console.log(`Missing ${file}`);
    continue;
  }

  let html = fs.readFileSync(full, "utf8");

  html = html.replace(/<style id="tsl-nav-style">[\s\S]*?<\/style>/g, "");
  html = html.replace(/<header class="tsl-nav" id="tsl-site-nav">[\s\S]*?<\/header>/g, "");

  html = html.replace(/<\/head>/i, `${css}\n</head>`);

  if (/<body[^>]*>/i.test(html)) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${navFor(file)}`);
  } else {
    html = html.replace(/<html[^>]*>/i, match => `${match}\n<body>\n${navFor(file)}`);
  }

  fs.writeFileSync(full, html);
  console.log(`Forced nav into ${file}`);
}

