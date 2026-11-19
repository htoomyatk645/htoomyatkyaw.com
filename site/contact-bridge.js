// Routes contact form submissions to this site's own /api/forms endpoint
// (src/worker.js) in case any Framer form URL survived the mirror rewrite.
(function () {
  var FRAMER_FORMS = /^https?:\/\/api\.framer\.com\/forms/;
  function reroute(url) {
    return typeof url === "string" && FRAMER_FORMS.test(url) ? url.replace(FRAMER_FORMS, "/api/forms") : url;
  }

  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === "string") input = reroute(input);
    else if (input instanceof URL) input = reroute(input.href);
    else if (input && input.url && FRAMER_FORMS.test(input.url)) input = new Request(reroute(input.url), input);
    return originalFetch.call(this, input, init);
  };

  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    arguments[1] = reroute(String(url));
    return originalOpen.apply(this, arguments);
  };

  // Plain HTML forms that still point at Framer.
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (form && form.action && FRAMER_FORMS.test(form.action)) form.action = reroute(form.action);
  }, true);
})();

// Owner sign-in. Clicking the profile photo in the nav (the only copy of that
// photo inside the fixed header) asks for the access code and opens the
// invite-link tool (src/invite.js). The code is checked on the server; it is
// not in this file.
(function () {
  var PHOTO = "tEtevi8JenLoBT4YdyPpWydOJg";
  function inHeader(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var p = getComputedStyle(n).position;
      if (p === "fixed" || p === "sticky") return true;
    }
    return false;
  }
  function navPhoto(target) {
    var img = target && target.closest && target.closest("img");
    if (!img) {
      // The click can land on a wrapper laid over the image.
      var box = target && target.closest && target.closest("div");
      img = box && box.querySelector && box.querySelector("img[src*='" + PHOTO + "']");
      if (img && img.getBoundingClientRect().width > 64) img = null;
    }
    return img && (img.getAttribute("src") || "").indexOf(PHOTO) !== -1 && inHeader(img) ? img : null;
  }

  var dialog;
  function open() {
    if (dialog) { dialog.style.display = "flex"; dialog.querySelector("input").focus(); return; }
    dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Owner sign-in");
    dialog.style.cssText = "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(17,18,18,.45)";
    var mono = "font:500 13px/1 'DM Mono',ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.02em";
    dialog.innerHTML =
      '<form style="width:100%;max-width:360px;background:#fff;border:2px solid #111212;color:#111212;font:500 16px/1.5 Inter,-apple-system,Helvetica,Arial,sans-serif">' +
      '<div style="padding:18px 20px;background:#a4e5f8;border-bottom:2px solid #111212;' + mono + '">Owner access</div>' +
      '<div style="padding:20px">' +
      '<label style="display:block;' + mono + ';font-size:12px;color:#767777">Access code' +
      '<input type="password" inputmode="numeric" autocomplete="current-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:12px 14px;border:2px solid #111212;border-radius:0;font:500 18px/1.2 Inter,sans-serif;letter-spacing:.1em;color:#111212;background:#fff"></label>' +
      '<p data-msg style="min-height:22px;margin:10px 0 0;font-size:14px;color:#e01e5a"></p>' +
      '<div style="display:flex;gap:10px;margin-top:10px">' +
      '<button type="submit" style="flex:1;min-height:46px;border:2px solid #111212;background:#111212;color:#fff;cursor:pointer;' + mono + '">Open</button>' +
      '<button type="button" data-close style="flex:1;min-height:46px;border:2px solid #111212;background:#fff;color:#111212;cursor:pointer;' + mono + '">Cancel</button>' +
      "</div></div></form>";
    document.body.appendChild(dialog);
    var form = dialog.querySelector("form"), input = dialog.querySelector("input"), msg = dialog.querySelector("[data-msg]");
    function close() { dialog.style.display = "none"; input.value = ""; msg.textContent = ""; }
    dialog.addEventListener("click", function (e) { if (e.target === dialog || e.target.hasAttribute("data-close")) close(); });
    dialog.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.style.color = "#767777"; msg.textContent = "Checking…";
      fetch("/api/booking/owner", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ code: input.value }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.success) { location.href = d.url; return; }
          msg.style.color = "#e01e5a"; msg.textContent = (d && d.error) || "That code is not right.";
          input.select();
        })
        .catch(function () { msg.style.color = "#e01e5a"; msg.textContent = "Could not check the code. Try again."; });
    });
    input.focus();
  }

  document.addEventListener("click", function (e) {
    if (!navPhoto(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    // Already signed in on this browser: go straight to the tool.
    fetch("/api/booking/owner", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.owner) location.href = "/api/booking/invite"; else open(); })
      .catch(open);
  }, true);
})();
