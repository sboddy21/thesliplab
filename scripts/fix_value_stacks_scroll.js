import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const file = path.join(ROOT, "index.html");

let html = fs.readFileSync(file, "utf8");

html = html.replace(/id="value-plays"/g, "");
html = html.replace(/id="stacks"/g, "");

html = html.replace(
  /(<[^>]*>\s*Value Plays\s*<\/[^>]*>)/i,
  `<div id="value-plays" class="scroll-anchor"></div>\n$1`
);

html = html.replace(
  /(<[^>]*>\s*(?:HR Stacks|Stacks)\s*<\/[^>]*>)/i,
  `<div id="stacks" class="scroll-anchor"></div>\n$1`
);

html = html.replace(
  /href="index\.html#value-plays"/g,
  `href="#value-plays"`
);

html = html.replace(
  /href="index\.html#stacks"/g,
  `href="#stacks"`
);

fs.writeFileSync(file, html);

console.log("Value anchor exists:", html.includes('id="value-plays"'));
console.log("Stacks anchor exists:", html.includes('id="stacks"'));
