import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const INDEX = path.join(ROOT, "index.html");

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function write(file, data) {
  fs.writeFileSync(file, data);
}

let html = read(INDEX);

html = html.replace(/<div id="value-plays"[^>]*><\/div>\s*/g, "");
html = html.replace(/id="value-plays"/g, "");

const valueMarkers = [
  /(<section[^>]*class="[^"]*value[^"]*"[^>]*>)/i,
  /(<div[^>]*class="[^"]*value[^"]*"[^>]*>)/i,
  /(<h[1-6][^>]*>\s*Value Plays\s*<\/h[1-6]>)/i,
  /(<h[1-6][^>]*>\s*Value Watch\s*<\/h[1-6]>)/i,
  /(<h[1-6][^>]*>\s*Best Value\s*<\/h[1-6]>)/i,
  /(<[^>]*>\s*Value Plays\s*<\/[^>]*>)/i,
  /(<[^>]*>\s*Value Watch\s*<\/[^>]*>)/i
];

let fixedValue = false;

for (const marker of valueMarkers) {
  if (marker.test(html)) {
    html = html.replace(marker, `<div id="value-plays" class="tsl-real-scroll-anchor"></div>\n$1`);
    fixedValue = true;
    break;
  }
}

if (!fixedValue) {
  const topIndex = html.search(/top plays|top hr plays|probability board/i);
  const stacksIndex = html.search(/hr stacks|stacks/i);

  if (topIndex > -1 && stacksIndex > topIndex) {
    html =
      html.slice(0, stacksIndex) +
      `<div id="value-plays" class="tsl-real-scroll-anchor"></div>\n` +
      html.slice(stacksIndex);
    fixedValue = true;
  }
}

html = html.replace(/href="javascript:void\(0\)" data-scroll-target="value-plays"/g, `href="#value-plays"`);
html = html.replace(/href="index\.html#value-plays"/g, `href="#value-plays"`);

html = html.replace(/<script src="home-scroll-fix\.js"><\/script>/g, "");
html = html.replace(/<\/body>/i, `  <script src="home-scroll-fix.js"></script>
</body>`);

write(INDEX, html);

const scrollJs = `
(function () {
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) return false;

    var header = document.querySelector(".tsl-site-header");
    var offset = header ? header.offsetHeight + 28 : 120;
    var top = el.getBoundingClientRect().top + window.pageYOffset - offset;

    if (top < 0) top = 0;

    window.scrollTo({ top: top, behavior: "smooth" });
    history.replaceState(null, "", "#" + id);
    return true;
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    if (!link) return;

    var href = link.getAttribute("href") || "";
    var target = link.getAttribute("data-scroll-target") || "";

    if (href.includes("#top-plays")) target = "top-plays";
    if (href.includes("#value-plays")) target = "value-plays";
    if (href.includes("#stacks")) target = "stacks";

    if (!target) return;

    event.preventDefault();
    scrollToId(target);
  });

  window.addEventListener("load", function () {
    var id = location.hash.replace("#", "");
    if (id === "top-plays" || id === "value-plays" || id === "stacks") {
      setTimeout(function () {
        scrollToId(id);
      }, 300);
    }
  });
})();
`;

write(path.join(ROOT, "home-scroll-fix.js"), scrollJs);

const cssFiles = ["style.css", "styles.css", "app.css", "power-zones.css"];

for (const cssFile of cssFiles) {
  const full = path.join(ROOT, cssFile);
  if (!fs.existsSync(full)) continue;

  let css = read(full);

  if (!css.includes(".tsl-real-scroll-anchor")) {
    css += `

.tsl-real-scroll-anchor {
  display: block;
  height: 1px;
  width: 100%;
  margin-top: -1px;
  scroll-margin-top: 130px;
}
`;
  }

  write(full, css);
}

const dataDir = path.join(ROOT, "data");
const resultFiles = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter(f => /result|tracking|history|settled|final/i.test(f))
  : [];

console.log("Value anchor fixed:", fixedValue);
console.log("Value anchor count:", (html.match(/id="value-plays"/g) || []).length);
console.log("");
console.log("Possible results data files:");
for (const file of resultFiles) {
  const full = path.join(dataDir, file);
  const stat = fs.statSync(full);
  console.log(file, "modified", stat.mtime.toLocaleString());
}
