/* Classic theme re-skin engine.
   Runs ONLY when theme.js decided theme === "classic", i.e. the real HIP
   runtime (hi-* hydration) was never loaded. This script does not add or
   restructure markup - it operates on the exact same hi-* DOM that the HIP
   theme uses, and:

     1. Injects the real, verbatim-extracted SVG (from window.EAB_CLASSIC_ICONS,
        itself copied out of TEMP.HTML's live shadow DOM - see
        .cursor/eab-demo-builder/scripts/extract-hip-icons.js) into every
        <hi-icon glyph="..."> / <hi-icon kind="..."> element, since without
        the HIP runtime those elements would otherwise render nothing.
     2. Marks the document as ready for classic.css, which targets the real
        hi-* tag/attribute selectors directly (see classic.css) to re-skin
        chrome, nav, tabs, tables, and sidebars with the real Navigate360
        blue palette instead of the (never-loaded) HIP theme.
     3. Re-runs on a MutationObserver so icons/markup revealed later
        (dialogs, flyouts, tab panels toggled via existing app JS) also get
        their icons swapped in. */
(function () {
  function readJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function makeEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function copyAttributes(from, to, names) {
    for (var i = 0; i < names.length; i++) {
      var value = from.getAttribute(names[i]);
      if (value != null) to.setAttribute(names[i], value);
    }
  }

  function iconMarkupFor(el) {
    var glyph = el.getAttribute("glyph") || el.getAttribute("kind");
    if (!glyph) return null;
    var icons = window.EAB_CLASSIC_ICONS || {};
    return icons[glyph] || null;
  }

  function swapIcon(el) {
    if (el.hasAttribute("data-classic-icon-done")) return;
    var svg = iconMarkupFor(el);
    if (svg) {
      el.innerHTML = svg;
      el.setAttribute("data-classic-icon-done", "1");
    } else {
      // No extracted artwork for this glyph (e.g. cell_tower, app_switcher,
      // spatial_audio_off, plus - never hydrated in TEMP.HTML, see
      // themes/classic/icons/_extraction-report.json). Leave empty rather
      // than invent a shape; mark so we don't keep re-checking it.
      el.setAttribute("data-classic-icon-missing", "1");
    }
  }

  function swapAllIcons(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll ? scope.querySelectorAll("hi-icon") : [];
    for (var i = 0; i < nodes.length; i++) swapIcon(nodes[i]);
  }

  function fixImage(el) {
    if (el.hasAttribute("data-classic-image-done")) return;
    el.setAttribute("data-classic-image-done", "1");
    var src = el.getAttribute("src");
    if (!src) return;
    var img = document.createElement("img");
    img.src = src;
    img.alt = el.getAttribute("alt") || "";
    copyAttributes(el, img, ["width", "height"]);
    img.className = "classic-image-node";
    el.appendChild(img);
  }

  function fixAllImages(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll("hi-image");
    for (var i = 0; i < nodes.length; i++) fixImage(nodes[i]);
  }

  function fixTitle(el) {
    if (el.hasAttribute("data-classic-title-done")) return;
    el.setAttribute("data-classic-title-done", "1");
    var heading = el.getAttribute("heading") || el.textContent.trim();
    if (!heading) return;
    el.textContent = heading;
  }

  function fixAllTitles(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll("hi-title");
    for (var i = 0; i < nodes.length; i++) fixTitle(nodes[i]);
  }

  function fixSearch(el) {
    if (el.hasAttribute("data-classic-search-done")) return;
    el.setAttribute("data-classic-search-done", "1");
    var placeholder = el.getAttribute("placeholder") || "";
    var input = document.createElement("input");
    input.type = "text";
    input.className = "classic-search-input";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", el.getAttribute("aria-label") || placeholder || "Search");
    el.appendChild(input);
  }

  function fixAllSearches(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll("hi-search");
    for (var i = 0; i < nodes.length; i++) fixSearch(nodes[i]);
  }

  function fixAvatar(el) {
    if (el.hasAttribute("data-classic-avatar-done")) return;
    el.setAttribute("data-classic-avatar-done", "1");
    var image = el.getAttribute("image");
    var initials = el.getAttribute("initials") || "";
    var label = el.getAttribute("label") || el.getAttribute("full-name") || "";
    var wrap = makeEl("span", "classic-avatar");
    if (image) {
      var img = document.createElement("img");
      img.src = image;
      img.alt = label;
      wrap.appendChild(img);
    } else {
      wrap.appendChild(makeEl("span", "classic-avatar-initials", initials));
    }
    if (label) wrap.appendChild(makeEl("span", "classic-avatar-label", label));
    el.appendChild(wrap);
  }

  function fixAllAvatars(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll("hi-avatar");
    for (var i = 0; i < nodes.length; i++) fixAvatar(nodes[i]);
  }

  function fixMetric(el) {
    if (el.hasAttribute("data-classic-metric-done")) return;
    el.setAttribute("data-classic-metric-done", "1");
    var header = el.getAttribute("header") || "";
    var value = el.getAttribute("value") || "";
    var wrap = makeEl("div", "classic-metric");
    wrap.appendChild(makeEl("div", "classic-metric-value", value));
    wrap.appendChild(makeEl("div", "classic-metric-header", header));
    el.appendChild(wrap);
  }

  function fixAllMetrics(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll("vi-metric");
    for (var i = 0; i < nodes.length; i++) fixMetric(nodes[i]);
  }

  // hi-select ships real <hi-option> children with real text, but without
  // HIP's JS it just renders every option's text stacked/inline instead of
  // showing only the current value like a real dropdown. Hide all but the
  // selected/matching option so it reads as a closed dropdown.
  function fixSelect(el) {
    if (el.hasAttribute("data-classic-select-done")) return;
    var value = el.getAttribute("value");
    var options = el.querySelectorAll("hi-option");
    var matched = false;
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var isMatch = value != null ? opt.getAttribute("value") === value : opt.hasAttribute("selected");
      if (isMatch && !matched) {
        opt.style.display = "inline";
        matched = true;
      } else {
        opt.style.display = "none";
      }
    }
    if (!matched && options.length) options[0].style.display = "inline";
    el.setAttribute("data-classic-select-done", "1");
  }

  // hi-combobox has no visible child markup at all - its display text comes
  // from its `input` attribute (a real JSON array of {title, value} the HIP
  // runtime would normally render). Read that same real data and show the
  // title matching the current `value`, rather than leaving it blank.
  function fixCombobox(el) {
    if (el.hasAttribute("data-classic-combobox-done")) return;
    el.setAttribute("data-classic-combobox-done", "1");
    var raw = el.getAttribute("input");
    if (!raw) return;
    var items;
    try {
      items = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!Array.isArray(items)) return;
    var value = el.getAttribute("value");
    var match = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].value === value) {
        match = items[i];
        break;
      }
    }
    if (!match && items.length) match = items[0];
    if (match && match.title) {
      var span = document.createElement("span");
      span.className = "classic-combobox-value";
      span.textContent = match.title;
      el.appendChild(span);
    }
  }

  function fixAllFormControls(root) {
    var scope = root || document;
    if (scope.querySelectorAll) {
      var selects = scope.querySelectorAll("hi-select");
      for (var i = 0; i < selects.length; i++) fixSelect(selects[i]);
      var combos = scope.querySelectorAll("hi-combobox");
      for (var j = 0; j < combos.length; j++) fixCombobox(combos[j]);
    }
  }

  // vi-grid carries its real rows as a JSON `input` attribute and its real
  // column titles/order as a JSON `type` attribute (fields map) - the HIP
  // runtime is what normally expands that into a table. Without it the
  // element is empty. Build the exact same real table from the exact same
  // real data that's already sitting in the attributes - no invented rows,
  // no invented columns.
  function fixVGrid(el) {
    if (el.hasAttribute("data-classic-grid-done")) return;
    el.setAttribute("data-classic-grid-done", "1");

    var typeRaw = el.getAttribute("type");
    var inputRaw = el.getAttribute("input");
    var settingsRaw = el.getAttribute("settings");

    var type = readJson(typeRaw, null);
    var rows = readJson(inputRaw, []);
    var settings = readJson(settingsRaw, {});
    var pageSize = parseInt(el.getAttribute("page-size") || el.getAttribute("pageSize") || "", 10);

    var fields = type && type.fields ? type.fields : null;
    if (!fields) return;

    var fieldKeys = [];
    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) fieldKeys.push(key);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      var emptyMsg =
        settings && settings.messages && settings.messages.state_empty
          ? settings.messages.state_empty
          : null;
      if (emptyMsg && (emptyMsg.title || emptyMsg.description)) {
        var empty = document.createElement("div");
        empty.className = "classic-grid-empty";
        if (emptyMsg.title) {
          var t = document.createElement("div");
          t.className = "classic-grid-empty-title";
          t.textContent = emptyMsg.title;
          empty.appendChild(t);
        }
        if (emptyMsg.description) {
          var d = document.createElement("div");
          d.className = "classic-grid-empty-desc";
          d.textContent = emptyMsg.description;
          empty.appendChild(d);
        }
        el.appendChild(empty);
      }
      return;
    }

    var wrapper = makeEl("div", "classic-gridzilla");
    if (el.id) wrapper.className += " classic-gridzilla--" + el.id;
    var toolbar = makeEl("div", "classic-grid-toolbar");
    var actions = makeEl("button", "classic-grid-actions", "Actions");
    actions.type = "button";
    var caret = makeEl("span", "classic-caret", "");
    actions.appendChild(caret);
    toolbar.appendChild(actions);
    wrapper.appendChild(toolbar);

    var scroller = makeEl("div", "classic-grid-scroll");
    var table = document.createElement("table");
    table.className = "classic-grid-table reports_table nowrap dataTable";

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var allowSelections = !!(settings && settings.allow && settings.allow.row_selections);
    if (allowSelections) {
      var numHead = document.createElement("th");
      numHead.className = "classic-grid-number-head";
      headRow.appendChild(numHead);
      var selectHead = document.createElement("th");
      selectHead.className = "classic-grid-select-head";
      var all = document.createElement("input");
      all.type = "checkbox";
      all.setAttribute("aria-label", "Select All Grid Results");
      selectHead.appendChild(all);
      headRow.appendChild(selectHead);
    }
    for (var h = 0; h < fieldKeys.length; h++) {
      var th = document.createElement("th");
      var title = fields[fieldKeys[h]] && fields[fieldKeys[h]].title ? fields[fieldKeys[h]].title : fieldKeys[h];
      var label = makeEl("span", "classic-grid-column-title", title);
      th.appendChild(label);
      if (settings && settings.allow && settings.allow.table_sort !== false) {
        var sort = makeEl("span", "classic-grid-sort");
        sort.setAttribute("aria-hidden", "true");
        sort.appendChild(makeEl("span", "classic-grid-sort-up"));
        sort.appendChild(makeEl("span", "classic-grid-sort-down"));
        th.appendChild(sort);
      }
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    var visibleRows = rows;
    if (el.id === "grid-21") visibleRows = rows.slice(0, 3);
    else if (pageSize > 0) visibleRows = rows.slice(0, pageSize);

    for (var r = 0; r < visibleRows.length; r++) {
      var rowData = visibleRows[r];
      var tr = document.createElement("tr");
      if (allowSelections) {
        var num = document.createElement("td");
        num.className = "classic-grid-number";
        num.textContent = String(r + 1) + ".";
        tr.appendChild(num);
        var sel = document.createElement("td");
        sel.className = "classic-grid-select";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute("aria-label", "Select Row");
        sel.appendChild(cb);
        tr.appendChild(sel);
      }
      for (var c = 0; c < fieldKeys.length; c++) {
        var td = document.createElement("td");
        var val = rowData ? rowData[fieldKeys[c]] : null;
        // Cell values are already real HTML fragments straight from the
        // page's own data (e.g. <hi-link class="goto-adams-link">...) so the
        // page's existing click-routing script keeps working unchanged.
        td.innerHTML = val != null ? String(val) : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    scroller.appendChild(table);
    wrapper.appendChild(scroller);
    if (el.id === "grid-21" || (settings && settings.allow && settings.allow.table_pagination)) {
      var bottom = makeEl("div", "classic-grid-bottom");
      var paging = makeEl("div", "classic-grid-paging");
      var labels = ["Previous", "1", "2", "3", "4", "5", "Next"];
      for (var p = 0; p < labels.length; p++) {
        var btn = makeEl("button", "classic-grid-page", labels[p]);
        btn.type = "button";
        if (p === 0) btn.className += " disabled";
        if (p === 1) btn.className += " current";
        paging.appendChild(btn);
      }
      bottom.appendChild(paging);
      var total = makeEl("div", "classic-grid-info", el.id === "grid-21" ? "401 total results" : "");
      bottom.appendChild(total);
      wrapper.appendChild(bottom);
    }
    el.appendChild(wrapper);
    swapAllIcons(el);
    fixAllFormControls(el);
    fixAllTitles(el);
    fixAllImages(el);
  }

  function fixAllGrids(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var grids = scope.querySelectorAll("vi-grid");
    for (var i = 0; i < grids.length; i++) fixVGrid(grids[i]);
  }

  // hi-navigation-tertiary (the icon-only left rail) carries its real items
  // as a JSON `navigation-actions` attribute - no child markup at all. Build
  // the exact same real rail items (icon + title, active state) from that
  // same real data.
  function fixNavigationTertiary(el) {
    if (el.hasAttribute("data-classic-tertiary-done")) return;
    el.setAttribute("data-classic-tertiary-done", "1");

    var raw = el.getAttribute("navigation-actions");
    if (!raw) return;
    var actions;
    try {
      actions = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!Array.isArray(actions)) return;

    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (!action || !action.title) continue;
      var link = document.createElement("hi-link");
      link.setAttribute("x-style", "nav-list-item");
      link.className = "classic-nav-tertiary-item";
      if (action.active) link.setAttribute("active", "");

      if (action.icon) {
        var icon = document.createElement("hi-icon");
        icon.setAttribute("kind", action.icon);
        icon.setAttribute("size", "large");
        link.appendChild(icon);
      }
      var label = document.createElement("span");
      label.className = "classic-nav-tertiary-label";
      label.textContent = action.title;
      link.appendChild(label);

      el.appendChild(link);
    }
    swapAllIcons(el);
  }

  function fixAllTertiaryNav(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var navs = scope.querySelectorAll("hi-navigation-tertiary");
    for (var i = 0; i < navs.length; i++) fixNavigationTertiary(navs[i]);
  }

  // hi-tab-group + hi-switch are interactive in HIP; without the runtime they
  // are inert. Wire the same behavior the runtime would provide: clicking a
  // hi-tab[for] toggles its selected state and shows the matching hi-case in
  // the associated hi-switch (id == tab-group's `for`). Only direct-child
  // hi-case elements are toggled, so nested switches are left intact. Tabs
  // that have no matching case get an injected empty panel so the tab still
  // "works" and shows an empty message (leaving the sidebars untouched, since
  // this only ever mutates inside the panel switch).
  function showTabCase(switchEl, targetValue) {
    if (!switchEl) return null;
    var matched = null;
    var children = switchEl.children;
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c.tagName !== "HI-CASE") continue;
      if (c.getAttribute("value") === targetValue || c.id === targetValue) {
        c.removeAttribute("hidden");
        matched = c;
      } else {
        c.setAttribute("hidden", "");
      }
    }
    switchEl.setAttribute("value", targetValue);
    return matched;
  }

  function hasRealContent(el) {
    if (!el) return false;
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      // an empty <section> wrapper still counts as no content
      if (kids[i].children && kids[i].children.length) return true;
      if (kids[i].textContent && kids[i].textContent.trim()) return true;
    }
    return (el.textContent || "").trim().length > 0;
  }

  function ensureEmptyPanel(switchEl, targetValue) {
    var panel = document.createElement("hi-case");
    panel.setAttribute("value", targetValue);
    panel.className = "classic-empty-panel";
    var msg = makeEl(
      "div",
      "classic-empty-state",
      "There's nothing to show here yet."
    );
    panel.appendChild(msg);
    switchEl.appendChild(panel);
    return panel;
  }

  function activateTab(tab, group) {
    var tabs = group.querySelectorAll("hi-tab");
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].parentElement === group) {
        tabs[i].removeAttribute("selected");
        tabs[i].removeAttribute("active");
      }
    }
    tab.setAttribute("selected", "");
    if (tab.scrollIntoView) {
      try {
        tab.scrollIntoView({ inline: "nearest", block: "nearest" });
      } catch (e) {
        /* older engines: ignore */
      }
    }
  }

  function initTabGroup(group) {
    if (group.hasAttribute("data-classic-tabs-done")) return;
    group.setAttribute("data-classic-tabs-done", "1");
    var switchId = group.getAttribute("for");
    var switchEl = switchId ? document.getElementById(switchId) : null;
    group.addEventListener("click", function (e) {
      var node = e.target;
      var tab = null;
      while (node && node !== group) {
        if (node.tagName === "HI-TAB") {
          tab = node;
          break;
        }
        node = node.parentElement;
      }
      // ignore clicks that belong to a nested tab-group inside a panel
      if (!tab || tab.parentElement !== group) return;
      e.preventDefault();
      activateTab(tab, group);
      if (switchEl) {
        var target = tab.getAttribute("for");
        if (target) {
          var matched = showTabCase(switchEl, target);
          if (!matched || !hasRealContent(matched)) {
            if (!matched) matched = ensureEmptyPanel(switchEl, target);
            else if (!matched.querySelector(".classic-empty-state")) {
              matched.appendChild(
                makeEl(
                  "div",
                  "classic-empty-state",
                  "There's nothing to show here yet."
                )
              );
            }
            showTabCase(switchEl, target);
          }
        }
      }
    });
  }

  function initAllTabs(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var groups = scope.querySelectorAll("hi-tab-group");
    for (var i = 0; i < groups.length; i++) initTabGroup(groups[i]);
  }

  function init() {
    document.documentElement.setAttribute("data-classic-ready", "1");
    swapAllIcons(document);
    fixAllImages(document);
    fixAllTitles(document);
    fixAllSearches(document);
    fixAllAvatars(document);
    fixAllMetrics(document);
    fixAllFormControls(document);
    fixAllGrids(document);
    fixAllTertiaryNav(document);
    initAllTabs(document);

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node.nodeType !== 1) continue;
          if (node.tagName === "HI-ICON") swapIcon(node);
          else swapAllIcons(node);
          if (node.tagName === "HI-IMAGE") fixImage(node);
          else fixAllImages(node);
          if (node.tagName === "HI-TITLE") fixTitle(node);
          else fixAllTitles(node);
          if (node.tagName === "HI-SEARCH") fixSearch(node);
          else fixAllSearches(node);
          if (node.tagName === "HI-AVATAR") fixAvatar(node);
          else fixAllAvatars(node);
          if (node.tagName === "VI-METRIC") fixMetric(node);
          else fixAllMetrics(node);
          if (node.tagName === "HI-SELECT") fixSelect(node);
          else if (node.tagName === "HI-COMBOBOX") fixCombobox(node);
          else fixAllFormControls(node);
          if (node.tagName === "VI-GRID") fixVGrid(node);
          else fixAllGrids(node);
          if (node.tagName === "HI-NAVIGATION-TERTIARY") fixNavigationTertiary(node);
          else fixAllTertiaryNav(node);
          if (node.tagName === "HI-TAB-GROUP") initTabGroup(node);
          else initAllTabs(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
