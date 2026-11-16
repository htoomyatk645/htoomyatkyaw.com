// Behaviour for the content tools/build-content.mjs writes into the Journal,
// Case Study and Services pages.
//
// Each of those pages is a Framer page (nav, heading, footer) plus one
// #hk-content block that sits outside Framer's React root in the HTML. Once
// the page has hydrated, mount() moves the block into its place in the layout
// (data-slot, data-place) and keeps it there if React re-renders around it.
(function () {
  var node = document.getElementById("hk-content");
  if (!node) return;
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, el) { return (el || node).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || node).querySelectorAll(sel)); };
  root.classList.add("hk-js");

  // ------------------------------------------------------------------ mount
  var started = Date.now(), ready = false;
  function hydrated(el) {
    for (var k in el) if (k.indexOf("__reactFiber") === 0 || k.indexOf("__reactProps") === 0) return true;
    return Date.now() - started > 4000;
  }
  function mount() {
    var slot = document.querySelector(node.dataset.slot);
    if (!slot || !hydrated(slot)) return;
    var before = node.dataset.place === "before";
    var parent = before ? slot.parentNode : slot;
    if (before ? node.nextElementSibling !== slot : node.parentNode !== parent) {
      if (before) parent.insertBefore(node, slot); else parent.appendChild(node);
    }
    if (node.dataset.title && document.title !== node.dataset.title) document.title = node.dataset.title;
    if (!ready) { ready = true; node.classList.add("on"); init(); }
  }
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; mount(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  var poll = setInterval(function () { mount(); if (ready) clearInterval(poll); }, 120);
  mount();

  function init() {
    reveal();
    $$("[data-filters]").forEach(filters);
    $$("[data-progress]").forEach(progress);
    $$("[data-canvas]").forEach(canvas);
    $$("[data-survey]").forEach(survey);
  }

  // ------------------------------------------------------------ scroll reveal
  function reveal() {
    var items = $$("[data-rise]");
    if (reduce || !("IntersectionObserver" in window)) { items.forEach(function (el) { el.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  // ---------------------------------------------------------- journal filters
  function filters(bar) {
    var list = $("[data-posts]"), empty = $("[data-empty]");
    var buttons = $$("button", bar), items = $$("li", list);
    function apply(cat, push) {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cat === cat)); });
      // FLIP: remember where each card is, change the set, then animate the move.
      var first = items.map(function (li) { return li.getBoundingClientRect(); });
      var shown = 0;
      items.forEach(function (li) {
        var on = cat === "all" || li.dataset.cat === cat;
        li.classList.toggle("out", !on);
        if (on) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      if (!reduce) items.forEach(function (li, i) {
        if (li.classList.contains("out") || !li.animate) return;
        var last = li.getBoundingClientRect(), dx = first[i].left - last.left, dy = first[i].top - last.top;
        var was = first[i].width > 0;
        li.animate(was ? [{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }]
          : [{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }],
          { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
      });
      if (push) try { history.replaceState(null, "", cat === "all" ? location.pathname : "#" + cat); } catch (e) {}
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { apply(b.dataset.cat, true); }); });
    var start = location.hash.slice(1);
    if (start && buttons.some(function (b) { return b.dataset.cat === start; })) apply(start);
  }

  // --------------------------------------------------------- reading progress
  function progress(bar) {
    var article = $("[data-article]");
    document.body.appendChild(bar);
    function update() {
      var r = article.getBoundingClientRect(), total = r.height - innerHeight * 0.6;
      var done = Math.min(1, Math.max(0, (innerHeight * 0.4 - r.top) / Math.max(1, total)));
      bar.style.transform = "scaleX(" + done + ")";
      bar.style.display = document.body.contains(node) ? "" : "none";
    }
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();
  }

  // ------------------------------------------------------------------ canvas
  // The board's layout (frames, sticky notes, pins) is absolute-positioned
  // HTML written at build time. This adds the camera: drag to pan, pinch or
  // ctrl+scroll to zoom, and a tour that flies from one frame to the next.
  function canvas(fig) {
    var view = $(".hk-cv-view", fig), world = $(".hk-cv-world", fig), cursor = $(".hk-cv-cursor", fig);
    var frames = $$(".hk-cv-frame", fig), stops = $$(".hk-cv-stop", fig), count = $("[data-cv=count]", fig), zoomLabel = $("[data-cv=zoom]", fig);
    var W = +world.dataset.w, H = +world.dataset.h;
    var cam = { x: 0, y: 0, k: 1 }, at = -1;
    function paint(fly) {
      view.classList.toggle("fly", !!fly && !reduce);
      world.style.transform = "translate(" + cam.x + "px," + cam.y + "px) scale(" + cam.k + ")";
      zoomLabel.textContent = Math.round(cam.k * 100) + "%";
    }
    function fit(x, y, w, h, fly) {
      var vw = view.clientWidth, vh = view.clientHeight, pad = vw < 600 ? 28 : 64;
      cam.k = Math.min(1.25, (vw - pad * 2) / w, (vh - pad * 2) / h);
      cam.x = (vw - w * cam.k) / 2 - x * cam.k;
      cam.y = (vh - h * cam.k) / 2 - y * cam.k;
      paint(fly);
    }
    function overview(fly) { go(-1); fit(0, 0, W, H, fly); }
    function go(i, fly) {
      at = i;
      frames.forEach(function (f, n) {
        f.classList.toggle("is-active", n === i);
        var v = f.querySelector("video");
        if (v) { if (n === i) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); }
      });
      stops.forEach(function (s, n) { s.classList.toggle("on", n === (i < 0 ? 0 : i + 1)); });
      count.textContent = i < 0 ? "ALL" : (i + 1) + " / " + frames.length;
      cursor.classList.toggle("on", i >= 0);
      if (i < 0) return;
      var f = frames[i], b = (view.clientWidth < 600 ? f.dataset.tight : f.dataset.box).split(",").map(Number);
      fit(b[0], b[1], b[2], b[3], fly);
      var pin = f.querySelector(".hk-cv-pin");
      var cx = f.offsetLeft + (pin ? pin.offsetLeft + 20 : f.offsetWidth * 0.84);
      var cy = f.offsetTop + (pin ? pin.offsetTop + 22 : f.offsetHeight * 0.16);
      cursor.style.transform = "translate(" + cx + "px," + cy + "px) scale(" + 1 / cam.k + ")";
    }
    function step(d) { view.classList.add("used"); go((at + d + frames.length + (at < 0 && d < 0 ? 1 : 0)) % frames.length, true); }
    function zoom(factor, px, py) {
      var k = Math.min(3, Math.max(0.15, cam.k * factor));
      px = px == null ? view.clientWidth / 2 : px; py = py == null ? view.clientHeight / 2 : py;
      cam.x = px - (px - cam.x) * (k / cam.k); cam.y = py - (py - cam.y) * (k / cam.k); cam.k = k;
    }
    $$("[data-cv]", fig).forEach(function (b) {
      if (b.tagName !== "BUTTON") return;
      b.addEventListener("click", function () {
        var a = b.dataset.cv;
        if (a === "next" || a === "tour") step(1); else if (a === "prev") step(-1);
        else if (a === "fit") overview(true);
        else { zoom(a === "in" ? 1.3 : 1 / 1.3); paint(true); }
      });
    });

    // Pan with one pointer, pinch with two. A press that does not move is a click.
    var pts = {}, moved = 0, last = null, pinch = 0;
    function ids() { return Object.keys(pts); }
    view.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".hk-cv-pin")) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY }; moved = 0;
      if (ids().length === 1) last = { x: e.clientX, y: e.clientY };
      if (ids().length === 2) pinch = dist();
    });
    function dist() { var a = pts[ids()[0]], b = pts[ids()[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    view.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var n = ids().length, r = view.getBoundingClientRect();
      if (n === 2) {
        var d = dist(), a = pts[ids()[0]], b = pts[ids()[1]];
        zoom(d / (pinch || d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch = d; moved = 9; paint();
      } else if (n === 1 && last) {
        var dx = e.clientX - last.x, dy = e.clientY - last.y;
        // On touch, a mostly vertical drag scrolls the page instead of the board.
        if (e.pointerType === "touch" && !moved && Math.abs(dy) > Math.abs(dx)) { delete pts[e.pointerId]; return; }
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4) {
          if (!view.classList.contains("drag")) { view.classList.add("drag", "used"); try { view.setPointerCapture(e.pointerId); } catch (err) {} }
          cam.x += dx; cam.y += dy; paint();
        }
        last = { x: e.clientX, y: e.clientY };
      }
    });
    function up(e) {
      var wasClick = pts[e.pointerId] && moved <= 4;
      delete pts[e.pointerId]; view.classList.remove("drag");
      if (wasClick && e.type === "pointerup") {
        var f = e.target.closest(".hk-cv-frame");
        if (f) { view.classList.add("used"); go(frames.indexOf(f), true); }
      }
    }
    view.addEventListener("pointerup", up); view.addEventListener("pointercancel", up);
    view.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); view.classList.add("used");
      var r = view.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top); paint();
    }, { passive: false });
    view.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "0" || e.key === "Escape") overview(true);
    });

    // A pin and its line in the panel light up together.
    $$(".hk-cv-pin", fig).forEach(function (pin) {
      var item = $('[data-pin-text="' + pin.dataset.pin + '"]', fig);
      function set(on) { pin.classList.toggle("on", on); if (item) item.classList.toggle("on", on); }
      pin.addEventListener("pointerenter", function () { set(true); });
      pin.addEventListener("pointerleave", function () { set(false); });
      pin.addEventListener("focus", function () { set(true); });
      pin.addEventListener("blur", function () { set(false); });
      pin.addEventListener("click", function () { var f = pin.closest(".hk-cv-frame"); if (frames.indexOf(f) !== at) go(frames.indexOf(f), true); });
      if (item) { item.addEventListener("pointerenter", function () { set(true); }); item.addEventListener("pointerleave", function () { set(false); }); }
    });

    overview(false);
    addEventListener("resize", function () { if (at < 0) overview(false); else go(at, false); });
    // First time the board scrolls into view, fly to the first frame.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        setTimeout(function () { if (at < 0 && !view.classList.contains("used")) go(0, true); }, 500);
      }, { threshold: 0.55 });
      io.observe(view);
    }
  }

  // ------------------------------------------------------------------ survey
  // One question at a time. Enter moves on, letter keys pick an option, and
  // the answers are emailed through the site's /api/contact endpoint.
  function survey(el) {
    var cfg = JSON.parse($("script[type='application/json']", el).textContent);
    var qs = cfg.questions, KEY = "hk-survey-" + cfg.id, answers = {};
    try { answers = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
    var stage = $(".hk-sv-stage", el), bar = $(".hk-sv-bar i", el), counter = $("[data-sv=count]", el);
    var nextBtn = $("[data-sv=next]", el), backBtn = $("[data-sv=back]", el), hint = $("[data-sv=hint]", el);
    var at = 0, sending = false, steps = [];
    function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function pad(n) { return (n < 10 ? "0" : "") + n; }

    qs.forEach(function (q, i) {
      var step = h("div", "hk-sv-step");
      var title = h("h3", "hk-sv-q"); title.id = "hk-q-" + i;
      title.appendChild(h("small", "", pad(i + 1) + " →" + (q.required ? "" : "  optional")));
      title.appendChild(document.createTextNode(q.label));
      step.appendChild(title);
      if (q.help) step.appendChild(h("p", "hk-sv-help", q.help));
      if (q.type === "choice" || q.type === "multi") {
        var box = h("div", "hk-sv-opts"); box.setAttribute("role", "group"); box.setAttribute("aria-labelledby", title.id);
        q.options.forEach(function (opt, n) {
          var b = h("button", "hk-sv-opt"); b.type = "button";
          b.appendChild(h("kbd", "", String.fromCharCode(65 + n))); b.appendChild(h("span", "", opt));
          var cur = answers[q.id];
          b.setAttribute("aria-pressed", String(q.type === "multi" ? (cur || []).indexOf(opt) >= 0 : cur === opt));
          b.addEventListener("click", function () {
            if (q.type === "multi") {
              var list = (answers[q.id] || []).slice(), p = list.indexOf(opt);
              if (p >= 0) list.splice(p, 1); else list.push(opt);
              answers[q.id] = list; b.setAttribute("aria-pressed", String(p < 0));
            } else {
              answers[q.id] = opt;
              $$(".hk-sv-opt", box).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
              setTimeout(next, 260);
            }
            save();
          });
          box.appendChild(b);
        });
        step.appendChild(box);
      } else {
        var input = h(q.type === "long" ? "textarea" : "input");
        if (q.type !== "long") input.type = q.type === "email" ? "email" : "text";
        input.placeholder = q.placeholder || "Type your answer"; input.value = answers[q.id] || "";
        input.setAttribute("aria-labelledby", title.id); input.maxLength = q.type === "long" ? 3000 : 200;
        if (q.autocomplete) input.autocomplete = q.autocomplete;
        input.addEventListener("input", function () { answers[q.id] = input.value; save(); err(step, ""); });
        step.appendChild(input);
      }
      step.appendChild(h("p", "hk-sv-err")); step.lastChild.setAttribute("role", "alert");
      stage.appendChild(step); steps.push(step);
    });
    var done = h("div", "hk-sv-step hk-sv-done");
    done.appendChild(h("span", "hk-hand", cfg.doneTitle)); done.appendChild(h("p", "", cfg.doneText));
    stage.appendChild(done); steps.push(done);

    function save() { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch (e) {} }
    function err(step, msg) { $(".hk-sv-err", step).textContent = msg; }
    function valid(q) {
      var v = answers[q.id], blank = v == null || (typeof v === "string" ? !v.trim() : !v.length);
      if (blank) return q.required ? "This one is needed so I can help." : "";
      if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "That email doesn't look right.";
      return "";
    }
    function show(i, focus) {
      at = i;
      steps.forEach(function (s, n) { s.classList.toggle("on", n === i); s.classList.toggle("past", n < i); s.inert = n !== i; });
      var finished = i >= qs.length;
      bar.style.transform = "scaleX(" + (finished ? 1 : i / qs.length) + ")";
      counter.textContent = finished ? "DONE" : pad(i + 1) + " / " + pad(qs.length);
      backBtn.hidden = i === 0 || finished; nextBtn.hidden = finished; hint.hidden = finished;
      if (finished) return;
      nextBtn.textContent = i === qs.length - 1 ? "Send" : "OK";
      hint.textContent = qs[i].type === "long" ? "Shift + Enter for a new line" : qs[i].type === "multi" ? "Pick any, then Enter" : "Press Enter";
      if (focus) setTimeout(function () { var f = steps[i].querySelector("input,textarea,button"); if (f) f.focus({ preventScroll: true }); }, 380);
    }
    function next() {
      if (sending || at >= qs.length) return;
      var msg = valid(qs[at]); err(steps[at], msg);
      if (msg) { if (!reduce && steps[at].animate) steps[at].animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 280 }); return; }
      if (at < qs.length - 1) return show(at + 1, true);
      send();
    }
    function send() {
      sending = true; nextBtn.disabled = true; nextBtn.textContent = "Sending";
      var body = { Form: cfg.subject };
      qs.forEach(function (q) { var v = answers[q.id]; if (v && v.length) body[q.short || q.label] = Array.isArray(v) ? v.join(", ") : v.trim(); });
      fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.success) throw new Error(j.error || "failed"); }); })
        .then(function () { try { localStorage.removeItem(KEY); } catch (e) {} show(qs.length); confetti(); })
        .catch(function () { err(steps[at], cfg.errorText); nextBtn.textContent = "Try again"; })
        .then(function () { sending = false; nextBtn.disabled = false; });
    }
    function confetti() {
      if (reduce) return;
      var box = h("div", "hk-confetti"), colors = ["var(--hk-cyan)", "var(--hk-yellow)", "var(--hk-pink)", "var(--hk-green)"];
      for (var i = 0; i < 36; i++) {
        var p = h("i"); p.style.left = Math.random() * 100 + "%"; p.style.background = colors[i % 4];
        p.style.setProperty("--d", Math.random() * 0.5 + "s"); p.style.setProperty("--x", (Math.random() * 160 - 80) + "px");
        p.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg"); if (i % 3 === 0) p.style.borderRadius = "50%";
        box.appendChild(p);
      }
      el.appendChild(box); setTimeout(function () { box.remove(); }, 2600);
    }
    nextBtn.addEventListener("click", next);
    backBtn.addEventListener("click", function () { if (at > 0) show(at - 1, true); });
    el.addEventListener("keydown", function (e) {
      if (at >= qs.length) return;
      var q = qs[at], typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if (e.key === "Enter" && !(q.type === "long" && e.shiftKey) && !e.isComposing) {
        // Enter on a focused option button should press it, not skip ahead.
        if (e.target.classList.contains("hk-sv-opt") && q.type === "choice") return;
        if (e.target === nextBtn || e.target === backBtn) return;
        e.preventDefault(); next();
      } else if (!typing && q.options && /^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        var b = $$(".hk-sv-opt", steps[at])[e.key.toUpperCase().charCodeAt(0) - 65];
        if (b) { e.preventDefault(); b.click(); }
      }
    });
    // Resume where a returning visitor left off.
    var resume = 0; while (resume < qs.length - 1 && !valid(qs[resume]) && answers[qs[resume].id] != null && String(answers[qs[resume].id]).length) resume++;
    show(resume, false);
  }
})();
