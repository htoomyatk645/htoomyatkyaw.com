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
