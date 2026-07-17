/* Theme engine — shared by every demo page, single file per portal.
   Must be loaded synchronously as the FIRST script in <head>, before the
   HIP-RUNTIME-BOOTSTRAP marker comment, any theme CSS, or the real markup.

   There is exactly ONE html file per portal. It always contains the real
   hi-* HIP markup. This script decides, at load time, how that markup gets
   rendered:

     theme = "hip"               -> inject the real HIF runtime script tag
                                     (document.write, same attrs the static
                                     tag used to have) so hi-* elements
                                     hydrate natively, unchanged from before.

     theme = "classic"           -> do NOT inject the HIF runtime. Instead,
                                     load themes/classic/classic.css +
                                     themes/classic/classic-theme.js, which
                                     re-skin the SAME real markup in place
                                     (icon injection + tag/attribute CSS
                                     selectors) without hydrating hi-*.

   Theme choice precedence: ?theme= query param > stored preference > "hip".
   Switching themes reloads the current page (safe, since un-injecting an
   already-hydrated HIF runtime isn't possible) rather than navigating to a
   different file. */
(function () {
  var STORAGE_KEY = "eab_theme";

  function getRequestedTheme() {
    var params = new URLSearchParams(location.search);
    var fromParam = params.get("theme");
    if (fromParam === "classic" || fromParam === "hip") return fromParam;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "classic" || stored === "hip") return stored;
    } catch (e) {
      /* localStorage unavailable (e.g. privacy mode) — fall through */
    }
    return "hip";
  }

  var theme = getRequestedTheme();
  document.documentElement.setAttribute("data-theme", theme);

  if (theme === "hip") {
    // Recreate the exact static bootstrap that used to live in each file's
    // <head>. document.write is safe here because this script itself is a
    // blocking, synchronously-parsed <script> tag encountered before the
    // HIP-RUNTIME-BOOTSTRAP marker comment in the document.
    document.write(
      '<script src="https://cdn.dev.eab.com/hif/latest/index.js" auto-start ' +
        'release="prod" system-load-core system-load-baseline system-load-ds ' +
        'system-load-os library-stop-dragula library-stop-moment></' +
        "script>"
    );
    document.write(
      "<script>$ip.flags.load([" +
        '["/eip/hi-form/default-to-rest", true],' +
        '["/pip/pi-ip/insert-css-after-script", true],' +
        '["/eip/hi-http/enable-xss-purification-response", false]' +
        "]);</" +
        "script>"
    );
  } else {
    // Classic: skip the HIF runtime entirely. The hip-fouc-guard rule hides
    // #app until x-hif="initialized" is set by that runtime — since it's
    // never loading, un-hide manually and load the Classic re-skin engine
    // once the real markup has parsed.
    document.write(
      '<style>body:not([x-hif="initialized"]) main#app,' +
        'body:not([x-hif="initialized"]) yi-view-footer,' +
        'body:not([x-hif="initialized"]) .iface-index__page ' +
        "{ visibility: visible !important; }</style>"
    );
    document.write('<link rel="stylesheet" href="../themes/classic/classic.css">');
    document.write('<script src="../themes/classic/classic-icons-data.js"></' + "script>");
    document.write('<script src="../themes/classic/classic-theme.js" defer></' + "script>");
  }

  function setTheme(nextTheme) {
    if (nextTheme !== "classic" && nextTheme !== "hip") return;
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (e) {
      /* ignore */
    }
    var params = new URLSearchParams(location.search);
    params.set("theme", nextTheme);
    location.search = params.toString();
  }

  function activeTheme() {
    return theme;
  }

  window.EAB_setTheme = setTheme;
  window.EAB_activeTheme = activeTheme;
})();
