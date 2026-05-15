import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const filesToCheck = [
  "index.html",
  "app.js",
  "style.css",
  "styles.css"
];

function read(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function write(file, content) {
  fs.writeFileSync(path.join(ROOT, file), content);
}

for (const file of filesToCheck) {
  let content = read(file);
  if (!content) continue;

  const original = content;

  content = content
    .replace(/<a[^>]*href=["']#tracking["'][^>]*>.*?<\/a>/gis, "")
    .replace(/<button[^>]*data-page=["']tracking["'][^>]*>.*?<\/button>/gis, "")
    .replace(/<section[^>]*id=["']tracking["'][\s\S]*?<\/section>/gis, "")
    .replace(/<section[^>]*class=["'][^"']*tracking[^"']*["'][\s\S]*?<\/section>/gis, "")
    .replace(/Tracking/g, "About")
    .replace(/#tracking/g, "#about");

  if (content !== original) {
    write(file, content);
    console.log(`Updated ${file}`);
  }
}

console.log("Tracking removed.");
