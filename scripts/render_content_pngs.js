import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const CONTENT_DIR = path.join(ROOT, "exports", "content_engine");
const TMP_DIR = path.join(CONTENT_DIR, "_render_tmp");

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

function exists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function findChrome() {
  const chrome = CHROME_CANDIDATES.find(exists);

  if (!chrome) {
    console.error("Could not find Chrome or Edge.");
    process.exit(1);
  }

  return chrome;
}

function getSvgSize(svgText) {
  const widthMatch = svgText.match(/width="([0-9.]+)"/i);
  const heightMatch = svgText.match(/height="([0-9.]+)"/i);

  return {
    width: widthMatch ? Number(widthMatch[1]) : 1600,
    height: heightMatch ? Number(heightMatch[1]) : 900,
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fileUrl(file) {
  return `file://${file}`;
}

function renderSvg(chrome, svgFile) {
  const svgText = fs.readFileSync(svgFile, "utf8");
  const { width, height } = getSvgSize(svgText);

  const baseName = path.basename(svgFile, ".svg");
  const htmlFile = path.join(TMP_DIR, `${baseName}.html`);
  const pngFile = svgFile.replace(/\.svg$/i, ".png");

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #020403;
    }

    svg {
      display: block;
      width: ${width}px;
      height: ${height}px;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
${svgText}
</body>
</html>
`;

  fs.writeFileSync(htmlFile, html, "utf8");

  if (exists(pngFile)) fs.unlinkSync(pngFile);

  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${pngFile}`,
    fileUrl(htmlFile),
  ], {
    stdio: "ignore",
  });

  return pngFile;
}

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error("Could not find exports/content_engine");
    process.exit(1);
  }

  ensureDir(TMP_DIR);

  const chrome = findChrome();

  const svgFiles = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.toLowerCase().endsWith(".svg"))
    .map((file) => path.join(CONTENT_DIR, file));

  if (!svgFiles.length) {
    console.error("No SVG files found in exports/content_engine");
    process.exit(1);
  }

  console.log("Rendering PNGs with Chrome HTML wrapper...");
  console.log(`SVG files found: ${svgFiles.length}`);

  for (const svgFile of svgFiles) {
    const pngFile = renderSvg(chrome, svgFile);
    console.log(`Saved: ${pngFile}`);
  }

  console.log("Done.");
}

main();