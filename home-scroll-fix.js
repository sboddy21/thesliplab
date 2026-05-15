
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
