#!/usr/bin/env node
// Build the Journal, the case-study write-ups and the Services survey from the
// files in ./content.
//
//   node tools/build-content.mjs            published entries only
//   node tools/build-content.mjs --drafts   also build entries marked draft: true
//                                           (for local preview; do not deploy)
//
// How it fits the Framer mirror: site/blog.html, site/case-study.html and
// site/services.html are Framer pages. Each keeps its nav, heading and footer,
// and this script adds one #hk-content block to the HTML, outside Framer's
// React root. public/hk.js moves the block into the layout after the page
// hydrates. A post or case study is a copy of its index page served at
// /blog/<slug> or /case-study/<slug> with its own block, title and meta tags.
// Re-running is safe: earlier output is stripped first.
//
// Run it after `npm run rebrand` (which rewrites the Framer pages).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SITE = path.resolve(process.env.SITE_DIR || "site");
const CONTENT = path.resolve("content");
const DRAFTS = process.argv.includes("--drafts");
const ORIGIN = "https://htoomyatkyaw.com";
const config = JSON.parse(fs.readFileSync(path.join(CONTENT, "site.json"), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const read = (file) => fs.readFileSync(file, "utf8");

// Copy the shared stylesheet, script and media into the site.
for (const f of ["hk.css", "hk.js"]) fs.copyFileSync(path.join("public", f), path.join(SITE, f));
if (fs.existsSync(path.join(CONTENT, "media"))) fs.cpSync(path.join(CONTENT, "media"), path.join(SITE, "media"), { recursive: true });
const version = crypto.createHash("sha1").update(read("public/hk.css") + read("public/hk.js")).digest("hex").slice(0, 8);

// ---------------------------------------------------------------- content files
// A content file is "key: value" front matter between --- lines, then Markdown.
function load(dir) {
  const full = path.join(CONTENT, dir);
  return fs.readdirSync(full).filter((f) => f.endsWith(".md")).map((file) => {
    const m = read(path.join(full, file)).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) throw new Error(`${dir}/${file}: missing front matter`);
    const meta = Object.fromEntries(m[1].split("\n").filter((l) => /^\w+:/.test(l)).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
    return { ...meta, slug: file.replace(/\.md$/, ""), draft: meta.draft === "true", body: m[2] };
  }).filter((e) => DRAFTS || !e.draft);
}

// ---------------------------------------------------------------- Markdown
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[TODO:([^\]]*)\]/g, '<mark class="hk-todo">TODO:$1</mark>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

// Returns a list of parts: { html } for prose, or { block } for a full-width
// block (canvas, video) that a case study places outside the text column.
function markdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const parts = [];
  let html = "", h2 = 0;
  const flush = () => { if (html.trim()) parts.push({ html }); html = ""; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fence = line.match(/^:::(\w+)\s*(.*)$/);
    if (fence) {
      const inner = [];
      while (++i < lines.length && lines[i].trim() !== ":::") inner.push(lines[i]);
      const [, name, arg] = fence;
      if (name === "canvas") { flush(); parts.push({ block: canvas(arg, inner) }); }
      else if (name === "thread") { flush(); parts.push({ block: thread(inner) }); }
      else if (name === "phones") { flush(); parts.push({ block: phones(inner, arg) }); }
      else if (name === "flow") { flush(); parts.push({ block: flow(inner, arg) }); }
      else if (name === "lab") { flush(); parts.push({ block: lab(inner, arg) }); }
      else if (name === "video" || name === "image") { flush(); parts.push({ block: framed(name, arg, inner) }); }
      else html += `<div class="hk-note c-${{ note: "yellow", decision: "cyan", learned: "green" }[name] || "yellow"}" data-label="${esc(arg || name)}">${markdown(inner.join("\n")).map((p) => p.html).join("")}</div>`;
      continue;
    }
    const head = line.match(/^(#{2,3})\s+(.*)$/);
    if (head) {
      html += head[1].length === 2 ? `<h2 data-n="${String(++h2).padStart(2, "0")}">${inline(head[2])}</h2>` : `<h3>${inline(head[2])}</h3>`;
      continue;
    }
    if (/^---+$/.test(line.trim())) { html += "<hr>"; continue; }
    const list = line.match(/^(\s*)([-*]|\d+\.)\s+/);
    if (list) {
      const tag = /\d/.test(list[2]) ? "ol" : "ul", items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      i--;
      html += `<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`;
      continue;
    }
    if (line.startsWith(">")) {
      const quote = [];
      for (; i < lines.length && lines[i].startsWith(">"); i++) quote.push(lines[i].replace(/^>\s?/, ""));
      i--;
      html += `<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`;
      continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{2,3}\s|:::|>|\s*([-*]|\d+\.)\s)/.test(lines[i]); i++) para.push(lines[i].trim());
    i--;
    html += `<p>${inline(para.join(" "))}</p>`;
  }
  flush();
  return parts;
}

const HANDLES = '<i class="hk-h"></i><i class="hk-h"></i><i class="hk-h"></i><i class="hk-h"></i>';
const media = (src, alt) => /\.(mp4|webm|mov)$/i.test(src)
  ? `<video src="${esc(src)}" muted loop playsinline preload="metadata" aria-label="${esc(alt)}"></video>`
  : `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" draggable="false">`;

// :::video /media/x.mp4          A single framed video or image with a caption.
// Caption text
// :::
function framed(kind, src, inner) {
  const caption = inner.join(" ").trim();
  const tag = kind === "video" ? `<video src="${esc(src)}" controls muted loop playsinline preload="metadata"></video>` : `<img src="${esc(src)}" alt="${esc(caption)}" loading="lazy">`;
  return `<figure class="hk-framed" data-rise>${HANDLES}${tag}${caption ? `<figcaption>${inline(caption)}</figcaption>` : ""}</figure>`;
}

// :::thread            A text-message thread that plays as it scrolls into view.
// > a grey bubble from the other side
// < a blue bubble from the reader
// :::
function thread(inner) {
  const lines = inner.map((l) => l.match(/^\s*([<>])\s*(.*)$/)).filter(Boolean);
  return `<div class="hk-thread" data-thread role="group" aria-label="Text thread"><span class="hk-thread-top">Text thread</span>${lines.map((m) => `<p class="hk-b ${m[1] === ">" ? "in" : "out"}">${inline(m[2])}</p>`).join("")}<span class="hk-typing" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
}

// :::phones            Phone screenshots side by side, each with a caption.
// /media/file.jpg | Caption
// :::
function phones(inner, credit) {
  const items = inner.filter((l) => l.trim()).map((l) => l.split("|").map((s) => s.trim()));
  return `<div class="hk-phones" data-rise>${items.map(([src, cap]) => `<figure><span class="hk-phone-shot">${HANDLES}${/\.(mp4|webm)$/i.test(src) ? `<video src="${esc(src)}" poster="${esc(src.replace(/\.\w+$/, "-poster.jpg"))}" muted loop playsinline controls preload="none" data-autoplay aria-label="${esc(cap || "")}"></video>` : `<img src="${esc(src)}" alt="${esc(cap || "")}" loading="lazy">`}</span>${cap ? `<figcaption>${inline(cap)}</figcaption>` : ""}</figure>`).join("")}${credit ? `<p class="hk-credit">${inline(credit)}</p>` : ""}</div>`;
}

// :::flow Text for the way back to the start (optional)
// One step per line; start a line with * to highlight it.
// :::
function flow(inner, loop) {
  const steps = inner.filter((l) => l.trim()).map((l) => l.trim());
  return `<div class="hk-flow" data-rise><ol>${steps.map((s, i) => `<li${s.startsWith("*") ? ' class="key"' : ""} style="--i:${i}" data-rise><b>${String(i + 1).padStart(2, "0")}</b>${inline(s.replace(/^\*\s*/, ""))}</li>`).join("")}</ol>${loop ? `<p class="hk-flow-loop"><i>↺</i> ${inline(loop)}</p>` : ""}</div>`;
}

// :::lab /media/first.jpg | Caption for the starting screenshot
// cut: /media/shot.jpg | Title | Why
// add: /media/shot.jpg | Title | Why
// :::
// A list of changes. Opening one shows its screenshot in the phone beside the
// list (inside the item on a phone) with the reason under the title.
function lab(inner, arg) {
  const [first, firstCap] = (arg || "").split("|").map((x) => x.trim());
  const rows = inner.map((l) => l.match(/^\s*(cut|add):\s*(.*)$/)).filter(Boolean).map((m, i) => { const f = m[2].split("|").map((x) => x.trim()); return { i, kind: m[1], src: f[0], title: f[1], why: f.slice(2).join(" | ") }; });
  const group = (kind, label) => `<div class="hk-lab-group"><h4>${label}</h4>${rows.filter((r) => r.kind === kind).map((r) => `<div class="hk-lab-item ${r.kind}"><button type="button" data-lab-open="${r.i}" aria-expanded="false"><i>${kind === "cut" ? "✂" : "+"}</i><b>${inline(r.title)}</b></button><div class="hk-lab-panel"><div><img class="hk-lab-shot" src="${esc(r.src)}" alt="Screenshot of the current tour: ${esc(r.title)}" loading="lazy" width="600" height="1304"><p>${inline(r.why)}</p></div></div></div>`).join("")}</div>`;
  return `<div class="hk-lab" data-lab data-rise>
<div class="hk-lab-stage"><div class="hk-lab-phone">${HANDLES}<img class="on" data-lab-img="-1" src="${esc(first)}" alt="${esc(firstCap || "")}" width="600" height="1304">${rows.map((r) => `<img data-lab-img="${r.i}" src="${esc(r.src)}" alt="" loading="lazy" width="600" height="1304">`).join("")}</div>
<p class="hk-lab-cap" data-lab-cap data-first="${esc(firstCap || "")}">${esc(firstCap || "")}</p></div>
<div class="hk-lab-side">${group("cut", "What I cut")}${group("add", "What I added")}</div>
</div>`;
}

// :::canvas Board title
// frame: Label | /media/file.mp4 | 9:16      a frame (video or image) and its shape
// text: What this frame shows and why.       shown under the board on this stop
// note: yellow | A sticky note beside the frame (yellow, pink, cyan or green)
// pin: 50,20 | A numbered pin at 50% across, 20% down the frame
// :::
// Frames are laid out left to right; each frame is one stop on the tour.
function canvas(title, inner) {
  const frames = [];
  for (const raw of inner) {
    const m = raw.match(/^\s*(frame|text|note|pin):\s*(.*)$/);
    if (!m) continue;
    const f = m[2].split("|").map((s) => s.trim());
    if (m[1] === "frame") { frames.push({ label: f[0], src: f[1], ratio: f[2] || "16:9", text: [], notes: [], pins: [] }); continue; }
    const cur = frames[frames.length - 1];
    if (!cur) throw new Error("canvas: put a frame: line first");
    if (m[1] === "text") cur.text.push(m[2]);
    if (m[1] === "note") cur.notes.push(f.length > 1 ? { color: f[0], text: f.slice(1).join(" | ") } : { color: "yellow", text: f[0] });
    if (m[1] === "pin") { const [x, y] = f[0].split(",").map(Number); cur.pins.push({ x, y, text: f.slice(1).join(" | ") }); }
  }
  const FH = 560, TOP = 150, GAP = 170, NOTE_W = 220;
  let x = 110, pinNo = 0, world = "", panel = "";
  const tilt = [-2.2, 1.6, -1.1, 2.4];
  frames.forEach((fr, i) => {
    const [rw, rh] = fr.ratio.split(":").map(Number);
    const w = Math.round(FH * rw / rh);
    let right = x + w, ny = TOP + 10, notes = "";
    fr.notes.forEach((n, k) => {
      const h = 46 + Math.ceil(n.text.length / 25) * 19;
      notes += `<div class="hk-cv-sticky c-${esc(n.color)}" style="left:${x + w + 44}px;top:${ny}px;--r:${tilt[(i + k) % 4]}deg">${inline(n.text)}</div>`;
      ny += h + 22; right = x + w + 44 + NOTE_W;
    });
    const pins = fr.pins.map((p, k) => { pinNo++; p.no = pinNo; return `<button type="button" class="hk-cv-pin" data-pin="${pinNo}" style="left:${p.x}%;top:${p.y}%;--i:${k}" aria-label="Pin ${pinNo}: ${esc(p.text)}">${pinNo}</button>`; }).join("");
    world += `<section class="hk-cv-frame" style="left:${x}px;top:${TOP}px;width:${w}px;height:${FH}px" data-box="${x - 30},${TOP - 50},${right - x + 60},${FH + 90}" data-tight="${x - 10},${TOP - 40},${w + 20},${FH + 60}" aria-label="${esc(fr.label)}"><span class="hk-cv-label">${String(i + 1).padStart(2, "0")} ${esc(fr.label)}</span><div class="hk-cv-media">${media(fr.src, fr.label)}</div>${pins}${HANDLES}</section>${notes}`;
    if (i < frames.length - 1) world += `<span class="hk-cv-arrow" style="left:${right + 24}px;top:${TOP + FH / 2}px;width:${GAP - 48}px"></span>`;
    panel += `<div class="hk-cv-stop"><h3><small>${String(i + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}</small>${esc(fr.label)}</h3>${fr.text.map((t) => `<p>${inline(t)}</p>`).join("")}${fr.notes.length ? `<ul class="hk-cv-notes">${fr.notes.map((n) => `<li class="c-${esc(n.color)}">${inline(n.text)}</li>`).join("")}</ul>` : ""}${fr.pins.length ? `<ol>${fr.pins.map((p) => `<li data-pin-text="${p.no}"><b>${p.no}</b><span>${inline(p.text)}</span></li>`).join("")}</ol>` : ""}</div>`;
    x = right + GAP;
  });
  const W = x - GAP + 110, H = TOP + FH + 110;
  const overview = `<div class="hk-cv-stop on"><h3><small>BOARD</small>${esc(title)}</h3><p>${frames.length} frames. Drag to move around, pinch or hold Ctrl and scroll to zoom, or press Tour to walk through it step by step.</p></div>`;
  return `<figure class="hk-canvas" data-canvas data-rise>
<div class="hk-cv-bar"><span class="hk-cv-title">${esc(title)}</span><span class="hk-cv-tools"><button type="button" data-cv="prev" aria-label="Previous frame">←</button><span data-cv="count">ALL</span><button type="button" data-cv="next" aria-label="Next frame">→</button><button type="button" data-cv="tour">Tour</button><i class="hk-cv-sep"></i><button type="button" data-cv="out" aria-label="Zoom out">−</button><span data-cv="zoom">100%</span><button type="button" data-cv="in" aria-label="Zoom in">+</button><button type="button" data-cv="fit">Fit</button></span></div>
<div class="hk-cv-view" tabindex="0" role="group" aria-label="${esc(title)}: design board. Arrow keys move between frames."><div class="hk-cv-world" data-w="${W}" data-h="${H}" style="width:${W}px;height:${H}px">${world}<div class="hk-cv-cursor"><svg viewBox="0 0 18 18"><path d="M1 1l5.5 15 2.3-6.2L15 7.5z" fill="rgb(54,197,240)" stroke="rgb(17,18,18)" stroke-width="1.2" stroke-linejoin="round"/></svg><span>Htoo</span></div></div><span class="hk-cv-hint"><span class="hk-mouse">Drag to pan · Ctrl + scroll to zoom</span><span class="hk-touch">Drag sideways to pan · pinch to zoom</span></span></div>
<figcaption class="hk-cv-panel">${overview}${panel}</figcaption>
</figure>`;
}

// ---------------------------------------------------------------- page shell
const STRIP = /<!--hk:(head|body)-->[\s\S]*?<!--\/hk:\1-->/g;
function shell(file) { return read(path.join(SITE, file)).replace(STRIP, ""); }

function page(base, { slot, place = "append", hide = "", block, title, description, url, noindex }) {
  let html = base;
  if (title) {
    const set = (re, value) => { html = html.replace(re, (m, a, b) => a + esc(value) + b); };
    set(/(<title>)[^<]*(<\/title>)/, title);
    set(/(<meta property="og:title" content=")[^"]*(")/, title);
    set(/(<meta name="twitter:title" content=")[^"]*(")/, title);
    for (const name of ['name="description"', 'property="og:description"', 'name="twitter:description"']) set(new RegExp(`(<meta ${name} content=")[^"]*(")`), description);
    set(/(<link rel="canonical" href=")[^"]*(")/, ORIGIN + url);
    set(/(<meta property="og:url" content=")[^"]*(")/, ORIGIN + url);
    if (noindex) html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex">');
  }
  const head = `<!--hk:head--><link rel="stylesheet" href="/hk.css?v=${version}">${hide ? `<style>${hide}</style>` : ""}<noscript><style>#hk-content{display:block;padding:24px 16px}</style></noscript><!--/hk:head-->`;
  const body = `<!--hk:body--><div id="hk-content" data-slot="${slot}" data-place="${place}"${title ? ` data-title="${esc(title)}"` : ""}>${block}</div><script src="/hk.js?v=${version}" defer></script><!--/hk:body-->`;
  return html.replace("</head>", head + "</head>").replace("</body>", body + "</body>");
}

function write(file, html) {
  fs.mkdirSync(path.dirname(path.join(SITE, file)), { recursive: true });
  fs.writeFileSync(path.join(SITE, file), html);
}
// Remove pages in a folder that this run did not write (template posts, and
// entries that were deleted or turned back into drafts).
function prune(dir, keep) {
  const full = path.join(SITE, dir);
  if (!fs.existsSync(full)) return;
  for (const f of fs.readdirSync(full)) if (f.endsWith(".html") && !keep.includes(f.replace(/\.html$/, ""))) fs.rmSync(path.join(full, f));
}

const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const minutes = (text) => Math.max(1, Math.round(text.split(/\s+/).length / 220));
const draftBar = (e) => e.draft ? '<p class="hk-draft">Draft: built with --drafts for preview. Not part of the published site.</p>' : "";

// ---------------------------------------------------------------- journal
const cats = config.journal.categories;
const posts = load("journal").sort((a, b) => b.date.localeCompare(a.date));
for (const p of posts) if (!cats[p.category]) throw new Error(`journal/${p.slug}.md: unknown category "${p.category}"`);

const card = (p, i) => `<li data-cat="${p.category}" data-rise style="--i:${i % 4}"><a class="hk-card c-${cats[p.category].color}" href="/blog/${p.slug}"><span class="hk-card-top"><span class="hk-date">${fmtDate(p.date)}</span><span class="hk-tag c-${cats[p.category].color}">${esc(cats[p.category].name)}</span></span><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p><span class="hk-card-foot"><span>${minutes(p.body)} min read${p.draft ? " · draft" : ""}</span><b>Read →</b></span></a></li>`;

const blogShell = shell("blog.html");
const used = Object.keys(cats).filter((c) => posts.some((p) => p.category === c));
const journalBlock = `<div class="hk hk-journal">
<p class="hk-lede" data-rise>${esc(config.journal.intro)}</p>
${posts.length ? `<div class="hk-filters" data-filters role="group" aria-label="Filter posts by topic" data-rise><button type="button" data-cat="all" aria-pressed="true">All <sup>${posts.length}</sup></button>${used.map((c) => `<button type="button" class="c-${cats[c].color}" data-cat="${c}" aria-pressed="false">${esc(cats[c].name)} <sup>${posts.filter((p) => p.category === c).length}</sup></button>`).join("")}</div>
<ol class="hk-posts" data-posts>${posts.map(card).join("")}</ol>`
    : `<div class="hk-empty" data-rise><span class="hk-hand">${esc(config.journal.emptyTitle)}</span><p>${esc(config.journal.emptyText)}</p><p class="hk-tags" style="justify-content:center;margin-top:20px">${Object.values(cats).map((c) => `<span class="hk-tag c-${c.color}">${esc(c.name)}</span>`).join("")}</p></div>`}
</div>`;
write("blog.html", page(blogShell, { slot: ".framer-a06x9c", block: journalBlock }));

posts.forEach((p, i) => {
  const cat = cats[p.category];
  const others = posts.filter((o) => o !== p).sort((a, b) => (b.category === p.category) - (a.category === p.category)).slice(0, 3);
  const block = `<div class="hk">${draftBar(p)}<div class="hk-progress" data-progress></div>
<article class="hk-post">
<header class="hk-post-side" data-rise><a class="hk-back" href="/blog"><i>←</i> Journal</a><span class="hk-date">${fmtDate(p.date)}</span><span class="hk-tag c-${cat.color}">${esc(cat.name)}</span><h1>${esc(p.title)}</h1>${p.deck ? `<p class="hk-deck">${esc(p.deck)}</p>` : ""}<span class="hk-label">Summary</span><p class="hk-summary">${esc(p.summary)}</p><span class="hk-mono">${minutes(p.body)} min read</span></header>
<div class="hk-post-body" data-article data-rise style="--i:1"><div class="hk-prose">${markdown(p.body).map((x) => x.html || x.block).join("")}</div></div>
</article>
${others.length ? `<aside class="hk-more"><p class="hk-hand hk-more-h" data-rise><span>other articles</span></p><ol class="hk-posts">${others.map(card).join("")}</ol></aside>` : ""}</div>`;
  write(`blog/${p.slug}.html`, page(blogShell, {
    slot: ".framer-a06x9c", block, hide: ".framer-a06x9c>:not(#hk-content){display:none!important}.framer-6hr7jb{padding-top:0!important}",
    title: `${p.title} | Htoo Myat Kyaw`, description: p.summary, url: `/blog/${p.slug}`, noindex: p.draft,
  }));
});
prune("blog", posts.map((p) => p.slug));

// ---------------------------------------------------------------- case studies
const caseShell = shell("case-study.html");
const cases = load("case-studies");
const metaColors = ["yellow", "pink", "green", "cyan"];
for (const c of cases) {
  const meta = ["role", "timeline", "team", "platform"].filter((k) => c[k]);
  const body = markdown(c.body).map((x) => x.html ? `<div class="hk-prose" data-rise>${x.html}</div>` : x.block).join("\n");
  const block = `<article class="hk hk-case">${draftBar(c)}
<header class="hk-case-head"><div data-rise><a class="hk-back" href="/case-study"><i>←</i> Case studies</a><h1>${esc(c.title)}</h1><p class="hk-tagline">${esc(c.tagline || "")}</p><p class="hk-tags"><span class="hk-date">${esc(c.year || "")}</span>${(c.tags || "").split(",").filter(Boolean).map((t) => `<span class="hk-tag">${esc(t.trim())}</span>`).join("")}</p></div>
<dl class="hk-meta" data-rise style="--i:1">${meta.map((k, i) => `<div class="c-${metaColors[i]}"><dt>${k}</dt><dd>${esc(c[k])}</dd></div>`).join("")}</dl></header>
<div class="hk-case-body">${body}</div></article>`;
  write(`case-study/${c.slug}.html`, page(caseShell, {
    slot: ".framer-jgplzk", block, hide: ".framer-jgplzk>:not(#hk-content){display:none!important}",
    title: `${c.title} | Htoo Myat Kyaw`, description: c.tagline || "", url: `/case-study/${c.slug}`, noindex: c.draft,
  }));
}
prune("case-study", cases.map((c) => c.slug));

// ---------------------------------------------------------------- services
const adm = JSON.parse(read(path.join(CONTENT, "services", "admissions.json")));
const cli = JSON.parse(read(path.join(CONTENT, "services", "clients.json")));
const surveyBox = (sv, email) => `<div class="hk-survey" data-survey data-rise style="--i:1">${HANDLES}<script type="application/json">${JSON.stringify(sv).replace(/</g, "\\u003c")}</script>
<div class="hk-sv-top"><span>${esc(sv.title)}</span><span class="hk-sv-bar"><i></i></span><span data-sv="count"></span></div>
<div class="hk-sv-stage"></div>
<div class="hk-sv-nav"><button type="button" class="hk-sv-btn ghost" data-sv="back" hidden>← Back</button><span data-sv="hint"></span><button type="button" class="hk-sv-btn" data-sv="next">OK</button></div>
<noscript><p style="padding:24px">This form needs JavaScript. You can also email <a href="mailto:${esc(email)}">${esc(email)}</a>.</p></noscript></div>`;
const servicesBlock = `<section class="hk hk-cli" id="start-a-project"><div class="hk-adm-in">
<div class="hk-adm-copy" data-rise><span class="hk-hand">${esc(cli.kicker)}</span><h2>${cli.heading.map((l, i) => i === 0 ? `<em>${esc(l)}</em>` : esc(l)).join("<br>")}</h2>${cli.copy.map((t) => `<p>${inline(t)}</p>`).join("")}<ol class="hk-cli-next">${cli.next.map((t, i) => `<li><b>${String(i + 1).padStart(2, "0")}</b>${esc(t)}</li>`).join("")}</ol><small>${inline(cli.smallPrint)}</small></div>
${surveyBox(cli.survey, cli.email)}
</div></section>
<section class="hk hk-adm" id="admissions"><div class="hk-adm-in">
<div class="hk-adm-copy" data-rise><span class="hk-adm-no">${esc(adm.number)}</span><h2>${adm.heading.map((l, i) => i === 0 ? `<em>${esc(l)}</em>` : esc(l)).join("<br>")}</h2><span class="hk-hand">${esc(adm.kicker)}</span>${adm.copy.map((t) => `<p>${inline(t)}</p>`).join("")}<small>${inline(adm.smallPrint)}</small></div>
${surveyBox(adm.survey, adm.email)}
</div></section>`;
write("services.html", page(shell("services.html"), { slot: ".framer-3srzoz", place: "before", block: servicesBlock }));

// ---------------------------------------------------------------- contact
const ct = config.contact;
const bk = config.booking;
// The Worker reads the same hours and meeting types (src/booking.js).
fs.writeFileSync("src/booking-config.js", `// Generated by tools/build-content.mjs from content/site.json ("booking"). Do not edit.
export const booking = ${JSON.stringify({ timezone: bk.timezone, hours: bk.hours, slotMinutes: bk.slotMinutes, noticeHours: bk.noticeHours, daysAhead: bk.daysAhead, bufferMinutes: bk.bufferMinutes || 0, types: bk.types.map((t) => ({ id: t.id, name: t.name, minutes: t.minutes })) })};
`);
const bookBlock = `<div class="hk-book" id="book" data-book>
<script type="application/json">${JSON.stringify({ doneTitle: bk.doneTitle, doneText: bk.doneText, types: bk.types.map((t) => ({ id: t.id, name: t.name, minutes: t.minutes })) }).replace(/</g, "\\u003c")}</script>
<header data-rise><p class="hk-hand">${esc(bk.kicker)}</p><h2>${bk.heading.map((l, i) => i === 0 ? `<em>${esc(l)}</em>` : esc(l)).join(" ")}</h2><p>${esc(bk.intro)}</p></header>
<div class="hk-bk-card" data-rise style="--i:1">${HANDLES}
<div class="hk-bk-col"><h3><b>01</b>What kind of meeting?</h3><div class="hk-bk-types" role="group" aria-label="Kind of meeting">${bk.types.map((t) => `<button type="button" class="c-${t.color}" data-type="${esc(t.id)}" aria-pressed="false"><span><b>${esc(t.name)}</b><small>${t.minutes} min</small></span><em>${esc(t.blurb)}</em></button>`).join("")}</div></div>
<div class="hk-bk-col" data-step="day"><h3><b>02</b>Pick a day</h3><div class="hk-bk-cal"><div class="hk-bk-month"><button type="button" data-month="-1" aria-label="Earlier month">←</button><span data-month-label aria-live="polite"></span><button type="button" data-month="1" aria-label="Later month">→</button></div><div class="hk-bk-dow" aria-hidden="true"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="hk-bk-grid" data-grid></div></div><p class="hk-bk-hint" data-hint>Choose a kind of meeting to see open days.</p></div>
<div class="hk-bk-col" data-step="time"><h3><b>03</b>Pick a time</h3><div class="hk-bk-times" data-times></div>
<form class="hk-bk-form" data-form hidden novalidate><p class="hk-bk-sum" data-sum></p>
<label>Your name<input name="name" type="text" autocomplete="name" maxlength="80" required></label>
<label>Your email<input name="email" type="email" autocomplete="email" maxlength="200" required></label>
<label>Anything I should know first? <small>optional</small><textarea name="note" rows="3" maxlength="1000"></textarea></label>
<input class="hk-bk-hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
<p class="hk-bk-err" role="alert" data-err></p>
<button type="submit" class="hk-bk-send">Request this time</button><p class="hk-bk-small">Nothing is booked until I confirm. You'll get an email either way.</p></form></div>
<div class="hk-bk-done" data-done hidden><span class="hk-hand">${esc(bk.doneTitle)}</span><p class="hk-bk-sum" data-done-sum></p><p>${esc(bk.doneText)}</p></div>
</div><noscript><p>Booking needs JavaScript. You can use the form above instead.</p></noscript></div>`;
const contactBlock = `<section class="hk hk-contact" data-contact>
<div class="hk-ct-row" data-rise><p class="hk-hand">${esc(ct.startersTitle)}</p><div class="hk-ct-chips">${ct.starters.map((c) => c.href
    ? `<a class="hk-chip c-${c.color}" href="${esc(c.href)}">${esc(c.label)} <i>→</i></a>`
    : `<button type="button" class="hk-chip c-${c.color}" data-starter="${esc(c.text)}">${esc(c.label)}</button>`).join("")}</div></div>
${bookBlock}
<div class="hk-ct-grid">
<div data-rise><p class="hk-hand">${esc(ct.nextTitle)}</p><ol class="hk-ct-next">${ct.next.map((t, i) => `<li class="c-${["yellow", "pink", "cyan"][i % 3]}" style="--r:${[-2.5, 1.8, -1.2][i % 3]}deg;--i:${i}" data-rise><b>${String(i + 1).padStart(2, "0")}</b>${esc(t)}</li>`).join("")}</ol></div>
<div class="hk-ct-clock" data-rise style="--i:2" data-clock='${esc(JSON.stringify(ct.status))}'>${HANDLES}<span class="hk-mono">${esc(ct.clockLabel)}</span><span class="hk-ct-time" data-time>--:--</span><span class="hk-ct-status" data-status></span></div>
</div></section>`;
write("contact.html", page(shell("contact.html"), { slot: ".framer-1smnmk7", place: "before", block: contactBlock }));

// ---------------------------------------------------------------- playground
const pg = config.playground;
const playBlock = `<a class="hk hk-pg-jump" href="#mind-games" data-jump>${esc(pg.jump)} <i>↓</i></a>
<section class="hk hk-play" id="mind-games">
<header data-rise><span class="hk-hand">${esc(pg.kicker)}</span><h2>${pg.heading.map(esc).join("<br>")}</h2><p>${esc(pg.intro)}</p></header>
<div class="hk-games">${pg.games.map((g, i) => `<article class="hk-game c-${g.color}" data-game="${g.id}" data-rise style="--i:${i}">${HANDLES}
<h3><span class="hk-mono">${String(i + 1).padStart(2, "0")}</span>${esc(g.name)}</h3><p class="hk-game-rule">${esc(g.rule)}</p>
<div class="hk-game-stage" data-stage aria-live="polite"><button type="button" class="hk-game-go" data-go>Play</button></div>
<p class="hk-game-lesson" data-lesson hidden>${g.brain ? `<span class="hk-game-brain">${esc(g.brain)}</span>` : ""}${esc(g.lesson)}</p></article>`).join("")}</div></section>`;
write("play-ground.html", page(shell("play-ground.html"), { slot: ".framer-1smnmk7", place: "before", block: playBlock }));

console.log(`journal: ${posts.length} post(s)${DRAFTS ? " (drafts included)" : ""}; case studies: ${cases.length}; services: client form (${cli.survey.questions.length} questions), admissions survey (${adm.survey.questions.length})`);
