import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const file = path.join(ROOT, "index.html");

let html = fs.readFileSync(file, "utf8");

html = html.replace(/id="stacks"/g, "");
html = html.replace(/<div class="tsl-scroll-target"><\/div>\s*/g, "");
html = html.replace(/<div id="stacks" class="tsl-scroll-target"><\/div>\s*/g, "");

const stackPatterns = [
  /(<section[^>]*class="[^"]*(?:stack|stacks)[^"]*"[^>]*>)/i,
  /(<div[^>]*class="[^"]*(?:stack|stacks)[^"]*"[^>]*>)/i,
  /(<h[1-6][^>]*>\s*(?:HR Stacks|Stacks)\s*<\/h[1-6]>)/i,
  /(<[^>]*>\s*(?:HR Stacks|Stacks)\s*<\/[^>]*>)/i
];

let fixed = false;

for (const pattern of stackPatterns) {
  if (pattern.test(html)) {
    html = html.replace(pattern, `<div id="stacks" class="tsl-scroll-target"></div>\n$1`);
    fixed = true;
    break;
  }
}

if (!fixed) {
  html = html.replace(
    /<\/main>/i,
    `<div id="stacks" class="tsl-scroll-target"></div>\n</main>`
  );
}

html = html.replace(/href="index\.html#stacks"/g, `href="#stacks"`);

fs.writeFileSync(file, html);

console.log("Stacks anchor count:", (html.match(/id="stacks"/g) || []).length);
console.log("Stacks anchor fixed:", fixed);
