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

  function initThemeMenu() {
    var active =
      typeof window.EAB_activeTheme === "function"
        ? window.EAB_activeTheme()
        : "hip";
    var label = active === "hip" ? "HI/P" : "Classic";

    document.querySelectorAll(".demo-menu__panel--theme").forEach(function (panel) {
      var currentNote = panel.querySelector("[data-theme-current]");
      if (currentNote) {
        currentNote.textContent = label + " — current";
      }
      panel.querySelectorAll("[data-theme-target]").forEach(function (btn) {
        var target = btn.getAttribute("data-theme-target");
        var isActive = target === active;
        btn.hidden = false;
        btn.disabled = isActive;
        btn.setAttribute("aria-current", isActive ? "true" : "false");
        btn.classList.toggle("demo-menu__link--current", isActive);
        btn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (isActive) return;
          if (typeof window.EAB_setTheme === "function") {
            window.EAB_setTheme(target);
          }
        };
      });
    });
  }

  function initDemoShell() {
    initDemoMenus();
    initThemeMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDemoShell);
  } else {
    initDemoShell();
  }
})();
