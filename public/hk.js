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
    $$("[data-thread]").forEach(threadBlock);
    $$("[data-lab]").forEach(labBlock);
    $$("[data-contact]").forEach(contact);
    $$("[data-game]").forEach(game);
    $$("[data-jump]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); $("#mind-games").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
      // The button is only useful while the games are off screen.
      if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { a.classList.toggle("gone", es[0].isIntersecting); }, { threshold: 0.05 }).observe($("#mind-games"));
    });
  }

  // ------------------------------------------------------------ text thread
  // Bubbles arrive one at a time, with typing dots before each grey one, the
  // first time the thread scrolls into view.
  function threadBlock(el) {
    var bubbles = $$(".hk-b", el), typing = $(".hk-typing", el);
    if (reduce || !("IntersectionObserver" in window)) return;
    el.classList.add("play");
    function show(i) {
      if (i >= bubbles.length) { el.classList.remove("typing"); return; }
      var b = bubbles[i], incoming = b.classList.contains("in");
      el.insertBefore(typing, b);
      el.classList.toggle("typing", incoming);
      setTimeout(function () {
        el.classList.remove("typing"); b.classList.add("shown");
        setTimeout(function () { show(i + 1); }, incoming ? 380 : 620);
      }, incoming ? Math.min(1500, 420 + b.textContent.length * 9) : 520);
    }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); show(0); } }, { threshold: 0.35 });
    io.observe(el);
  }

  // -------------------------------------------------------- cut-and-add lab
  function labBlock(el) {
    var buttons = $$("[data-lab-toggle]", el), noise = $("[data-noise]", el), help = $("[data-help]", el);
    function sync() {
      var cuts = 0, adds = 0, total = 0;
      buttons.forEach(function (b) {
        var on = b.getAttribute("aria-pressed") === "true", key = b.dataset.labToggle;
        el.classList.toggle(key, on);
        if (key.indexOf("cut") === 0) { total++; if (on) cuts++; } else if (on) adds++;
      });
      noise.textContent = total - cuts; help.textContent = adds;
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); sync(); });
    });
    $("[data-lab-reset]", el).addEventListener("click", function () { buttons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); sync(); });
    sync();
  }

  // ----------------------------------------------------------------- contact
  // Starter chips write an opening line into the Framer form's note field, and
  // the clock shows the time in Boston with a guess at what Htoo is doing.
  function contact(el) {
    $$("[data-starter]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        var box = document.querySelector("#main textarea");
        if (!box) return;
        // The field belongs to React: set the value through the native setter
        // and fire an input event so its state follows.
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, b.dataset.starter);
        box.dispatchEvent(new Event("input", { bubbles: true }));
        box.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        setTimeout(function () { box.focus({ preventScroll: true }); box.setSelectionRange(box.value.length, box.value.length); }, reduce ? 0 : 450);
      });
    });
    var clock = $("[data-clock]", el);
    if (!clock) return;
    var states = JSON.parse(clock.dataset.clock), time = $("[data-time]", clock), status = $("[data-status]", clock);
    function tick() {
      var now = new Date(), text = "";
      time.textContent = now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
      var hour = +now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }) % 24;
      states.forEach(function (s) { if (hour >= s[0]) text = s[1]; });
      status.textContent = text;
    }
    tick(); setInterval(tick, 20000);
  }

  // ------------------------------------------------------------------- games
  // Three one-minute experiments on the Playground page.
  function game(card) {
    var stage = $("[data-stage]", card), lesson = $("[data-lesson]", card), kind = card.dataset.game, timers = [];
    function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function clear() { timers.forEach(clearTimeout); timers = []; stage.textContent = ""; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function finish(big, small) {
      clear();
      stage.appendChild(h("strong", "hk-game-score", big)); stage.appendChild(h("span", "hk-game-note", small));
      var again = h("button", "hk-game-go ghost", "Play again"); again.type = "button"; again.addEventListener("click", start);
      stage.appendChild(again); lesson.hidden = false;
      if (!reduce && stage.animate) stage.firstChild.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 480, easing: "cubic-bezier(.34,1.56,.64,1)" });
    }
    function avg(a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : 0; }

    function stroop() {
      var names = ["PINK", "BLUE", "GREEN", "YELLOW"], inks = ["var(--hk-pink)", "var(--hk-cyan)", "var(--hk-green)", "var(--hk-yellow)"];
      var trial = 0, total = 10, same = [], diff = [], wrong = 0;
      function next() {
        clear();
        var gap = avg(diff) - avg(same);
        if (trial === total) return finish((gap > 0 ? "+" : "") + Math.abs(gap) + " ms", (gap > 0 ? "slower when the word and the ink disagreed" : "no slowdown when they disagreed. That is rare.") + (wrong ? " · " + wrong + " wrong" : ""));
        var w = Math.floor(Math.random() * 4), match = trial % 2 === 0, c = match ? w : (w + 1 + Math.floor(Math.random() * 3)) % 4, t0 = performance.now();
        trial++;
        stage.appendChild(h("span", "hk-game-note", trial + " / " + total));
        var word = h("strong", "hk-game-word", names[w]); word.style.color = inks[c]; stage.appendChild(word);
        var row = h("div", "hk-game-keys");
        names.forEach(function (n, i) {
          var b = h("button", "", n.charAt(0) + n.slice(1).toLowerCase()); b.type = "button"; b.style.setProperty("--k", inks[i]);
          b.addEventListener("click", function () { if (i === c) (match ? same : diff).push(performance.now() - t0); else wrong++; next(); });
          row.appendChild(b);
        });
        stage.appendChild(row);
      }
      next();
    }

    function span() {
      var len = 3;
      function round() {
        clear();
        var digits = []; for (var i = 0; i < len; i++) digits.push(Math.floor(Math.random() * 10));
        var show = h("strong", "hk-game-word", ""); stage.appendChild(h("span", "hk-game-note", len + " digits")); stage.appendChild(show);
        digits.forEach(function (d, i) {
          later(function () { show.textContent = d; if (!reduce && show.animate) show.animate([{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 220 }); }, 500 + i * 850);
          later(function () { show.textContent = ""; }, 500 + i * 850 + 650);
        });
        later(function () {
          clear();
          var form = h("form", "hk-game-form"), input = h("input"); input.inputMode = "numeric"; input.autocomplete = "off"; input.setAttribute("aria-label", "Type the digits"); input.placeholder = "Type them back";
          var ok = h("button", "hk-game-go", "Check"); form.appendChild(input); form.appendChild(ok); stage.appendChild(form); input.focus({ preventScroll: true });
          form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (input.value.replace(/\D/g, "") === digits.join("")) { len++; round(); }
            else finish((len - 1) + " digits", len - 1 < 3 ? "it was " + digits.join("") + ". Try once more." : "is your span today. The one you missed was " + digits.join(""));
          });
        }, 500 + len * 850 + 200);
      }
      round();
    }

    function react() {
      var times = [], tries = 5;
      function round() {
        clear();
        var pad = h("button", "hk-game-pad", "Wait for green…"); pad.type = "button"; stage.appendChild(pad);
        var t0 = 0;
        later(function () { pad.classList.add("go"); pad.textContent = "Click!"; t0 = performance.now(); }, 1200 + Math.random() * 2600);
        pad.addEventListener("pointerdown", function () {
          if (!t0) { clear(); var early = h("button", "hk-game-pad", "Too soon. Click to try again."); early.type = "button"; early.addEventListener("click", round); stage.appendChild(early); return; }
          times.push(performance.now() - t0);
          if (times.length === tries) return finish(avg(times) + " ms", "average over " + tries + " tries · best " + Math.round(Math.min.apply(null, times)) + " ms");
          round();
        });
      }
      round();
    }
    function start() { lesson.hidden = true; ({ stroop: stroop, span: span, react: react })[kind](); }
    $("[data-go]", card).addEventListener("click", start);
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
