import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const file = path.join(ROOT, "index.html");

let html = fs.readFileSync(file, "utf8");

html = html.replace(/<div id="top-plays" class="scroll-anchor"><\/div>\s*/g, "");
html = html.replace(/<div id="value-plays" class="scroll-anchor"><\/div>\s*/g, "");
html = html.replace(/<div id="stacks" class="scroll-anchor"><\/div>\s*/g, "");
html = html.replace(/<span id="top-plays" class="scroll-anchor"><\/span>/g, "");
html = html.replace(/<span id="value-plays" class="scroll-anchor"><\/span>/g, "");
html = html.replace(/<span id="stacks" class="scroll-anchor"><\/span>/g, "");

html = html.replace(/id="top-plays"/g, "");
html = html.replace(/id="value-plays"/g, "");
html = html.replace(/id="stacks"/g, "");

function addIdBeforeHeading(source, id, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const sectionRegex = new RegExp(
      `(<section[^>]*>[\\s\\S]{0,1200}?${escaped}[\\s\\S]*?<\\/section>)`,
      "i"
    );

    if (sectionRegex.test(source)) {
      return source.replace(sectionRegex, `<section id="${id}" class="tsl-scroll-target">$1</section>`);
    }

    const headingRegex = new RegExp(
      `(<h[1-6][^>]*>\\s*${escaped}\\s*<\\/h[1-6]>)`,
      "i"
    );

    if (headingRegex.test(source)) {
      return source.replace(headingRegex, `<div id="${id}" class="tsl-scroll-target"></div>\n$1`);
    }
  }

  return source;
}

html = addIdBeforeHeading(html, "top-plays", [
  "Top HR Plays",
  "Top Plays",
  "Probability Board"
]);

html = addIdBeforeHeading(html, "value-plays", [
  "Value HR Plays",
  "Value Plays",
  "Value"
]);

html = addIdBeforeHeading(html, "stacks", [
  "HR Stacks",
  "Stacks"
]);

html = html.replace(/href="index\.html#top-plays"/g, `href="#top-plays"`);
html = html.replace(/href="index\.html#value-plays"/g, `href="#value-plays"`);
html = html.replace(/href="index\.html#stacks"/g, `href="#stacks"`);

fs.writeFileSync(file, html);

console.log("top-plays count:", (html.match(/id="top-plays"/g) || []).length);
console.log("value-plays count:", (html.match(/id="value-plays"/g) || []).length);
console.log("stacks count:", (html.match(/id="stacks"/g) || []).length);
