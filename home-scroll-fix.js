(function () {
  function scrollToTarget(id) {
    var el = document.getElementById(id);
    if (!el) return;

    var header = document.querySelector(".tsl-site-header");
    var offset = header ? header.offsetHeight + 24 : 120;
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

    var href = link.getAttribute("href") || "";

    if (href.includes("#top-plays")) {
      event.preventDefault();
      scrollToTarget("top-plays");
      return;
    }

    if (href.includes("#value-plays")) {
      event.preventDefault();
      scrollToTarget("value-plays");
      return;
    }

    if (href.includes("#stacks")) {
      event.preventDefault();
      scrollToTarget("stacks");
      return;
    }
  });

  window.addEventListener("load", function () {
    var id = location.hash.replace("#", "");
    if (id === "top-plays" || id === "value-plays" || id === "stacks") {
      setTimeout(function () {
        scrollToTarget(id);
      }, 300);
    }
  });
})();
