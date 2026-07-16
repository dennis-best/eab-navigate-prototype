/* Demo menu bar — plain JS, not HI/P. */
(function () {
  function closeAllDemoMenus() {
    document.querySelectorAll(".demo-menu__panel").forEach(function (panel) {
      panel.hidden = true;
    });
    document.querySelectorAll(".demo-menu__toggle").forEach(function (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function initDemoMenus() {
    document.querySelectorAll(".demo-menu").forEach(function (menu) {
      var toggle = menu.querySelector(".demo-menu__toggle");
      var panel = menu.querySelector(".demo-menu__panel");
      if (!toggle || !panel) return;

      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = panel.hidden;
        closeAllDemoMenus();
        if (willOpen) {
          panel.hidden = false;
          toggle.setAttribute("aria-expanded", "true");
        }
      });

      panel.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    });

    document.addEventListener("click", closeAllDemoMenus);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllDemoMenus();
    });
  }

  window.EAB_closeDemoMenus = closeAllDemoMenus;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDemoMenus);
  } else {
    initDemoMenus();
  }
})();
