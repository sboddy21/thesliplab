
(function () {
  var MAP = {
    "top-plays": [
      "top plays",
      "top hr plays",
      "probability board",
      "core plays"
    ],
    "value-plays": [
      "value plays",
      "value watch",
      "best value",
      "value"
    ],
    "stacks": [
      "hr stacks",
      "same game stacks",
      "stack builder",
      "stacks"
    ]
  };

  function cleanText(value) {
    return String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();
  }

  function isBadElement(el) {
    if (!el) return true;
    if (el.closest(".tsl-site-header")) return true;
    if (el.closest("header")) return true;
    if (el.closest("nav")) return true;
    if (["SCRIPT", "STYLE", "LINK", "META", "HEAD"].includes(el.tagName)) return true;

    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return true;

    return false;
  }

  function scoreElement(el, section) {
    if (isBadElement(el)) return -9999;

    var text = cleanText(el.innerText || el.textContent);
    if (!text) return -9999;

    var words = MAP[section] || [];
    var score = 0;

    for (var i = 0; i < words.length; i++) {
      var phrase = words[i];

      if (text === phrase) score += 500;
      else if (text.startsWith(phrase)) score += 260;
      else if (text.includes(phrase)) score += 120;
    }

    if (score <= 0) return -9999;

    var tag = el.tagName.toLowerCase();
    var cls = cleanText(el.className);
    var rect = el.getBoundingClientRect();
    var top = rect.top + window.pageYOffset;

    if (/h[1-6]/.test(tag)) score += 220;
    if (tag === "section") score += 100;
    if (cls.includes("section")) score += 80;
    if (cls.includes("card")) score += 35;
    if (cls.includes("value") && section === "value-plays") score += 180;
    if (cls.includes("stack") && section === "stacks") score += 180;
    if (cls.includes("top") && section === "top-plays") score += 120;
    if (cls.includes("nav") || cls.includes("header")) score -= 800;

    if (top < 160) score -= 700;
    if (rect.height > window.innerHeight * 1.7) score -= 250;
    if (text.length > 1000) score -= 150;

    return score;
  }

  function findBest(section) {
    var elements = Array.prototype.slice.call(
      document.querySelectorAll("h1,h2,h3,h4,section,article,.card,.panel,.section,.grid,.content-block,div")
    );

    var best = null;
    var bestScore = -9999;

    elements.forEach(function (el) {
      var score = scoreElement(el, section);

      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    });

    if (!best || bestScore < 1) return null;

    var container =
      best.closest("section") ||
      best.closest("article") ||
      best.closest(".section") ||
      best.closest(".panel") ||
      best.closest(".card") ||
      best;

    if (container && !isBadElement(container)) {
      var containerTop = container.getBoundingClientRect().top + window.pageYOffset;
      var bestTop = best.getBoundingClientRect().top + window.pageYOffset;

      if (containerTop > 120 && containerTop <= bestTop) return container;
    }

    return best;
  }

  function scrollToSection(section) {
    var target = findBest(section);

    if (!target) {
      console.warn("No scroll target found for", section);
      return;
    }

    var header = document.querySelector(".tsl-site-header");
    var offset = header ? header.offsetHeight + 24 : 120;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;

    if (top < 0) top = 0;

    window.scrollTo({
      top: top,
      behavior: "smooth"
    });

    history.replaceState(null, "", "#" + section);
  }

  function handleClick(event) {
    var link = event.target.closest("a");
    if (!link) return;

    var section = link.getAttribute("data-scroll-section") || "";
    var href = link.getAttribute("href") || "";

    if (!section) {
      if (href.includes("top-plays")) section = "top-plays";
      if (href.includes("value-plays")) section = "value-plays";
      if (href.includes("stacks")) section = "stacks";
    }

    if (!section) return;

    event.preventDefault();

    setTimeout(function () {
      scrollToSection(section);
    }, 150);

    setTimeout(function () {
      scrollToSection(section);
    }, 800);
  }

  document.addEventListener("click", handleClick, true);

  window.addEventListener("load", function () {
    var section = location.hash.replace("#", "");

    if (section === "top-plays" || section === "value-plays" || section === "stacks") {
      setTimeout(function () {
        scrollToSection(section);
      }, 900);
    }
  });

  window.tslScrollToSection = scrollToSection;
})();
