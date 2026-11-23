/* Right-to-left typewriter for the Arabic greeting on the avatar hover card.
   The card is rendered by the page bundle, so watch for it and replay on every show.
   The link's own layout is left alone: the reveal is a clip on its block parent,
   measured in pixels from the link's box. */
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
    const box = a.closest("p") || a.parentElement;
    if (!box || !box.animate) return;
    if (box._hkAnim) box._hkAnim.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const b = box.getBoundingClientRect(), t = a.getBoundingClientRect();
    const from = Math.max(0, t.right - b.left), to = Math.max(0, t.left - b.left);
    // hide everything left of the text's right edge, then uncover leftwards letter by letter
    box._hkAnim = box.animate(
      [{ clipPath: `inset(0 0 0 ${from}px)` }, { clipPath: `inset(0 0 0 ${to}px)` }],
      { duration: STEP * count, easing: `steps(${count}, end)` }
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
