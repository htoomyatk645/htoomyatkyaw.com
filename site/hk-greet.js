/* Right-to-left typewriter for the Arabic greeting on the avatar hover card.
   The card is rendered by the page bundle, so watch for it and replay on every show. */
(() => {
  const TEXT = "السلام عليكم";
  const STEP = 90; // ms per letter
  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ar", { granularity: "grapheme" }) : null;
  const count = [...(seg ? seg.segment(TEXT) : TEXT)].length;
  const shown = new WeakMap();
  const find = () => [...document.querySelectorAll("a")].find(a => a.textContent.trim() === TEXT);
  const visible = a => {
    const r = a.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = a; e && e !== document.body; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (c.visibility === "hidden" || c.display === "none" || parseFloat(c.opacity) < 0.05) return false;
    }
    return true;
  };
  const play = a => {
    a.style.direction = "rtl";
    a.style.display = "inline-block";
    a.style.whiteSpace = "nowrap";
    if (a._hkAnim) a._hkAnim.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // reveal from the right edge to the left, one letter at a time
    a._hkAnim = a.animate(
      [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: STEP * count, easing: `steps(${count}, end)`, fill: "backwards" }
    );
  };
  setInterval(() => {
    const a = find();
    if (!a) return;
    const v = visible(a);
    if (v && !shown.get(a)) play(a);
    shown.set(a, v);
  }, 80);
})();
