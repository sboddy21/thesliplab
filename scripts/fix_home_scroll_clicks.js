import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const indexFile = path.join(ROOT, "index.html");

let html = fs.readFileSync(indexFile, "utf8");

html = html.replace(/<script src="home-scroll-fix\.js"><\/script>/g, "");

html = html.replace(
  /<\/body>/i,
  `  <script src="home-scroll-fix.js"></script>
</body>`
);

fs.writeFileSync(indexFile, html);

const js = `
(function () {
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) return false;

    var header = document.querySelector(".tsl-site-header");
    var offset = header ? header.offsetHeight + 24 : 120;
    var top = el.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({
      top: top,
      behavior: "smooth"
    });

    history.replaceState(null, "", "#" + id);
    return true;
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a");
    if (!link) return;

    var href = link.getAttribute("href") || "";

    if (
      href === "#value-plays" ||
      href === "index.html#value-plays" ||
      href.endsWith("/#value-plays")
    ) {
      e.preventDefault();
      scrollToId("value-plays");
    }

    if (
      href === "#stacks" ||
      href === "index.html#stacks" ||
      href.endsWith("/#stacks")
    ) {
      e.preventDefault();
      scrollToId("stacks");
    }

    if (
      href === "#top-plays" ||
      href === "index.html#top-plays" ||
      href.endsWith("/#top-plays")
    ) {
      e.preventDefault();
      scrollToId("top-plays");
    }
  });

  window.addEventListener("load", function () {
    var id = (window.location.hash || "").replace("#", "");
    if (id === "value-plays" || id === "stacks" || id === "top-plays") {
      setTimeout(function () {
        scrollToId(id);
      }, 250);
    }
  });
})();
`;

fs.writeFileSync(path.join(ROOT, "home-scroll-fix.js"), js);

console.log("Added forced homepage scroll handler.");
console.log("Check these exist:");
console.log("top-plays:", html.includes('id="top-plays"'));
console.log("value-plays:", html.includes('id="value-plays"'));
console.log("stacks:", html.includes('id="stacks"'));
