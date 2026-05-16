import fs from "fs";
import path from "path";
import https from "https";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

const LIVE_DATA = {
  "power_zones.json": "https://raw.githubusercontent.com/sboddy21/mlb-sweeper/main/website/data/power_zones.json",
  "site_last_updated.json": "https://raw.githubusercontent.com/sboddy21/mlb-sweeper/main/website/data/site_last_updated.json",
  "manifest.json": "https://raw.githubusercontent.com/sboddy21/mlb-sweeper/main/website/data/manifest.json"
};

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return;
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

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "TheSlipLabBuild" } }, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          fetchText(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Fetch failed ${response.statusCode}: ${url}`));
          response.resume();
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

async function writeLiveData() {
  const dataDir = path.join(DIST, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  for (const [fileName, url] of Object.entries(LIVE_DATA)) {
    try {
      const text = await fetchText(`${url}?v=${Date.now()}`);
      JSON.parse(text);
      fs.writeFileSync(path.join(dataDir, fileName), text);
      console.log(`LIVE DATA: ${fileName}`);
    } catch (error) {
      console.log(`LIVE DATA SKIPPED: ${fileName} ${error.message}`);
    }
  }
}

rm(DIST);
fs.mkdirSync(DIST, { recursive: true });

for (const file of fs.readdirSync(ROOT)) {
  if (
    file.endsWith(".html") ||
    file.endsWith(".js") ||
    file.endsWith(".css") ||
    file === "vercel.json"
  ) {
    copyFile(path.join(ROOT, file), path.join(DIST, file));
  }
}

copyDir(path.join(ROOT, "data"), path.join(DIST, "data"));
copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
await writeLiveData();

console.log("THE SLIP LAB STATIC BUILD COMPLETE");
console.log("Output folder: dist");
