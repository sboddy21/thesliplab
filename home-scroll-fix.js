(function () {
  function scrollToTarget(id) {
    var el = document.getElementById(id);
    if (!el) return;

    var header = document.querySelector(".tsl-site-header");
    var offset = header ? header.offsetHeight + 24 : 120;
    var top = el.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({ top: top, behavior: "smooth" });
    history.replaceState(null, "", "#" + id);
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a");
    if (!link) return;

    var href = link.getAttribute("href") || "";
    var id = "";

    if (href.includes("#top-plays")) id = "top-plays";
    if (href.includes("#value-plays")) id = "value-plays";
    if (href.includes("#stacks")) id = "stacks";

    if (!id) return;

    e.preventDefault();
    scrollToTarget(id);
  });

  window.addEventListener("load", function () {
    var id = location.hash.replace("#", "");
    if (["top-plays", "value-plays", "stacks"].includes(id)) {
      setTimeout(function () {
        scrollToTarget(id);
      }, 300);
    }
  });
})();
