import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const indexFile = path.join(ROOT, "index.html");

let html = fs.readFileSync(indexFile, "utf8");

html = html.replace(/<div id="top-plays" class="[^"]*"><\/div>\s*/g, "");
html = html.replace(/<div id="value-plays" class="[^"]*"><\/div>\s*/g, "");
html = html.replace(/<div id="stacks" class="[^"]*"><\/div>\s*/g, "");

html = html.replace(/id="top-plays"/g, "");
html = html.replace(/id="value-plays"/g, "");
html = html.replace(/id="stacks"/g, "");

html = html.replace(/href="#top-plays"/g, 'href="javascript:void(0)" data-scroll-target="top-plays"');
html = html.replace(/href="index.html#top-plays"/g, 'href="javascript:void(0)" data-scroll-target="top-plays"');

html = html.replace(/href="#value-plays"/g, 'href="javascript:void(0)" data-scroll-target="value-plays"');
html = html.replace(/href="index.html#value-plays"/g, 'href="javascript:void(0)" data-scroll-target="value-plays"');

html = html.replace(/href="#stacks"/g, 'href="javascript:void(0)" data-scroll-target="stacks"');
html = html.replace(/href="index.html#stacks"/g, 'href="javascript:void(0)" data-scroll-target="stacks"');

html = html.replace(/<script src="home-scroll-fix\.js"><\/script>/g, "");

html = html.replace(
  /<\/body>/i,
  `  <script src="home-scroll-fix.js"></script>
</body>`
);

fs.writeFileSync(indexFile, html);

const js = `
(function () {
  function visibleText(el) {
    return (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
  }

  function scoreTarget(el, words) {
    var text = visibleText(el);
    if (!text) return 0;

    var score = 0;

    words.forEach(function (word) {
      if (text.includes(word)) score += 10;
    });

    if (el.tagName === "SECTION") score += 8;
    if (el.tagName === "MAIN") score -= 100;
    if (el.closest(".tsl-site-header")) score -= 100;
    if (el.className && String(el.className).toLowerCase().includes("card")) score += 3;
    if (el.className && String(el.className).toLowerCase().includes("section")) score += 4;
    if (el.className && String(el.className).toLowerCase().includes("stack")) score += 12;
    if (el.className && String(el.className).toLowerCase().includes("value")) score += 12;
    if (el.className && String(el.className).toLowerCase().includes("top")) score += 8;

    return score;
  }

  function findTarget(id) {
    var configs = {
      "top-plays": ["top plays", "top hr plays", "probability board", "core plays"],
      "value-plays": ["value plays", "value", "value watch"],
      "stacks": ["hr stacks", "stacks", "same game", "correlation"]
    };

    var words = configs[id] || [];
    var candidates = Array.prototype.slice.call(
      document.querySelectorAll("section, main > div, .section, .panel, .card, .grid, h1, h2, h3")
    );

    var best = null;
    var bestScore = 0;

    candidates.forEach(function (el) {
      if (el.closest(".tsl-site-header")) return;

      var s = scoreTarget(el, words);

      if (s > bestScore) {
        best = el;
        bestScore = s;
      }
    });

    return best;
  }

  function scrollToTarget(id) {
    var el = document.getElementById(id) || findTarget(id);
    if (!el) return;

    var header = document.querySelector(".tsl-site-header");
    var offset = header ? header.offsetHeight + 28 : 120;

    var top = el.getBoundingClientRect().top + window.pageYOffset - offset;
    if (top < 0) top = 0;

    window.scrollTo({
      top: top,
      behavior: "smooth"
    });

    history.replaceState(null, "", "#" + id);
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    if (!link) return;

    var target = link.getAttribute("data-scroll-target");

    if (!target) {
      var href = link.getAttribute("href") || "";
      if (href.includes("#top-plays")) target = "top-plays";
      if (href.includes("#value-plays")) target = "value-plays";
      if (href.includes("#stacks")) target = "stacks";
    }

    if (!target) return;

    event.preventDefault();

    setTimeout(function () {
      scrollToTarget(target);
    }, 50);
  });

  window.addEventListener("load", function () {
    var id = location.hash.replace("#", "");
    if (id === "top-plays" || id === "value-plays" || id === "stacks") {
      setTimeout(function () {
        scrollToTarget(id);
      }, 500);
    }
  });
})();
`;

fs.writeFileSync(path.join(ROOT, "home-scroll-fix.js"), js);

console.log("Clean homepage scroll reset complete.");
