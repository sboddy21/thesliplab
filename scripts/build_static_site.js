import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

function removeDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  for (const item of fs.readdirSync(src)) {
    const from = path.join(src, item);
    const to = path.join(dest, item);
    const stat = fs.statSync(from);

    if (stat.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

removeDir(DIST);
fs.mkdirSync(DIST, { recursive: true });

const rootFiles = [
  "index.html",
  "weather.html",
  "slate.html",
  "results.html",
  "parlay.html",
  "app.js",
  "weather.js",
  "slate.js",
  "results.js",
  "parlay.js",
  "styles.css",
  "parlay.css"
];

for (const file of rootFiles) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) copyFile(src, path.join(DIST, file));
}

copyDir(path.join(ROOT, "data"), path.join(DIST, "data"));
copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
copyDir(path.join(ROOT, "public"), path.join(DIST, "public"));

console.log("THE SLIP LAB STATIC BUILD COMPLETE");
console.log("Output folder: dist");
