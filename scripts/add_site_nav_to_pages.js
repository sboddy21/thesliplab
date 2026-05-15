import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const WEBSITE = path.join(ROOT, "website");

const files = [
  "slate.html",
  "results.html"
];

const nav = `
<header class="tsl-nav">
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
    <a href="slate.html">Slate</a>
    <a href="results.html">Results</a>
  </nav>
</header>
`;

const css = `
<style>
  .tsl-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 76px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 34px;
    background: rgba(2, 5, 4, 0.92);
    border-bottom: 1px solid rgba(255,255,255,.08);
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

  .tsl-links a:hover {
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

for (const file of files) {
  const full = path.join(WEBSITE, file);

  if (!fs.existsSync(full)) {
    console.log(`Skipped missing ${file}`);
    continue;
  }

  let html = fs.readFileSync(full, "utf8");

  html = html.replace(/<header class="tsl-nav">[\s\S]*?<\/header>/, "");

  if (!html.includes(".tsl-nav")) {
    html = html.replace("</head>", `${css}\n</head>`);
  }

  html = html.replace("<body>", `<body>\n${nav}`);

  fs.writeFileSync(full, html);
  console.log(`Updated ${file}`);
}

console.log("Site navigation added.");
