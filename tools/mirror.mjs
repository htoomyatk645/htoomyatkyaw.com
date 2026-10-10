#!/usr/bin/env node
// Mirror a published Framer site into ./site so it can be served without any
// request to Framer's servers.
//
//   node tools/mirror.mjs https://nudge-folio.framer.website/
//
// 1. Crawls every same-origin page (links + sitemap.xml) in headless Chromium,
//    scrolling each page so lazy images/videos/chunks load, and records every
//    request that goes to a remote host.
// 2. Saves each page's server-rendered HTML to site/<path>/index.html.
// 3. Downloads every remote asset (JS modules, fonts, images, videos, JSON)
//    to site/_ext/<host>/<path>, then keeps scanning the downloaded HTML/JS/CSS
//    for more remote URLs and relative module imports until nothing new turns up.
// 4. Rewrites remote URLs to the local /_ext/... paths, strips Framer analytics,
//    the editor bar and the "Made in Framer" badge, and points the Framer form
//    API at the site's own /api/forms endpoint (handled by src/worker.js).

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const START = new URL(process.argv[2] || "https://nudge-folio.framer.website/");
const OUT = path.resolve(process.argv[3] || "site");
const SITE_URL = process.env.SITE_URL || "https://htoomyatkyaw.com";
const EXT_PREFIX = "/_ext";

// Requests to these hosts are dropped rather than mirrored.
const DROP_HOSTS = [/(^|\.)framer\.com$/, /(^|\.)framer\.app$/, /(^|\.)framer\.website$/, /google-analytics\.com$/, /googletagmanager\.com$/];
// URLs found by scanning file text are only mirrored from these asset hosts;
// anything else (social links, XML namespaces) is left alone. Requests the
// browser actually makes are mirrored from any host not in DROP_HOSTS.
const ASSET_HOSTS = new Set(["framerusercontent.com", "fonts.gstatic.com", "fonts.googleapis.com"]);
// Framer's form endpoint, rewritten to our own Worker route.
const FORM_API = /https?:\/\/api\.framer\.com\/forms/g;

const TEXT_EXT = /\.(m?js|css|json|html?|svg|txt|xml|webmanifest)$/i;

const assets = new Map(); // remote URL (no query) -> local path
const pages = new Set();
// Playwright sends even loopback traffic through a proxy, so only use one for remote sites.
const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(START.hostname);
const proxy = process.env.HTTPS_PROXY && !isLocal ? { server: process.env.HTTPS_PROXY } : undefined;

const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: "block", proxy });
const api = context.request;

function isRemoteAsset(u) {
  if (!/^https?:$/.test(u.protocol)) return false;
  if (u.host === START.host) return false;
  return !DROP_HOSTS.some((re) => re.test(u.hostname));
}

function localPathFor(u) {
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index";
  // Google Fonts CSS has no extension; give it one so it gets the right MIME type.
  if (u.hostname === "fonts.googleapis.com") p = `${p}-${hash(u.search)}.css`;
  return `${EXT_PREFIX}/${u.hostname}${p}`;
}

function hash(s) {
  let h = 5381;
  for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

function assetKey(u) {
  // Framer image variants differ only by ?scale-down-to / ?width; mirror the original.
  return u.hostname === "fonts.googleapis.com" ? u.href : `${u.origin}${u.pathname}`;
}

function noteAsset(href, { trusted = false } = {}) {
  let u;
  try { u = new URL(href); } catch { return; }
  if (!isRemoteAsset(u)) return;
  if (!trusted && !ASSET_HOSTS.has(u.hostname)) return;
  const key = assetKey(u);
  if (!assets.has(key)) assets.set(key, null);
}

// "/" -> index.html, "/about" -> about.html, so URLs stay slash-less like Framer's.
function pageFile(u) {
  const p = decodeURIComponent(u.pathname).replace(/\/+$/, "");
  if (!p) return path.join(OUT, "index.html");
  return path.join(OUT, path.extname(p) ? p : `${p}.html`);
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  });
}

async function crawl() {
  const queue = [START.href];
  try {
    const res = await api.get(new URL("/sitemap.xml", START).href);
    if (res.ok()) for (const m of (await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = new URL(m[1].trim());
      queue.push(new URL(u.pathname, START).href);
    }
  } catch {}

  const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
  const page = await context.newPage();
  page.on("request", (req) => noteAsset(req.url(), { trusted: true }));

  while (queue.length) {
    const href = queue.shift().split("#")[0];
    const u = new URL(href);
    if (u.host !== START.host || pages.has(u.pathname)) continue;
    pages.add(u.pathname);
    console.log("page", u.pathname);

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto(href, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => console.warn("  goto:", e.message));
      await autoScroll(page);
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
    for (const l of links) {
      try {
        const lu = new URL(l);
        if (lu.host === START.host && !pages.has(lu.pathname)) queue.push(lu.origin + lu.pathname);
      } catch {}
    }

    // Save the server-rendered HTML (hydrates the same way Framer's does).
    const res = await api.get(href);
    const html = await res.text();
    scanText(html, href);
    const file = pageFile(u);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, html);
  }

  // Framer's 404 page.
  const nf = await api.get(new URL("/404", START).href).catch(() => null);
  if (nf) {
    const html = await nf.text();
    scanText(html, START.href);
    await fs.writeFile(path.join(OUT, "404.html"), html);
  }
  await page.close();
}

// Find remote URLs (plain, JSON-escaped, or in CSS url()) and relative module imports.
function scanText(text, baseHref) {
  const unescaped = text.replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
  for (const m of unescaped.matchAll(/https?:\/\/[a-z0-9.-]+(?::\d+)?\/[^\s"'`)<>\\]*/gi)) noteAsset(m[0]);
  // Framer CMS data: new URL(`./x.framercms`, `https://framerusercontent.com/modules/…`).href.replace(`/modules/`, `/cms/`)
  for (const m of unescaped.matchAll(/new URL\(\s*[`"'](\.\/[^`"']+\.framercms)[`"']\s*,\s*[`"'](https:\/\/framerusercontent\.com\/modules\/[^`"']+)[`"']/g)) {
    noteAsset(new URL(m[1], m[2]).href.replace("/modules/", "/cms/"), { trusted: true });
  }
  if (/\.(m?js)$/.test(new URL(baseHref).pathname)) {
    for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["'](\.\.?\/[^"']+)["']/g)) {
      noteAsset(new URL(m[1], baseHref).href, { trusted: true });
    }
  }
  if (/\.css$/.test(new URL(baseHref).pathname)) {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (!m[1].startsWith("data:")) noteAsset(new URL(m[1], baseHref).href, { trusted: true });
    }
  }
}

async function downloadAll() {
  let round = 0;
  for (;;) {
    const pending = [...assets].filter(([, v]) => v === null).map(([k]) => k);
    if (!pending.length) break;
    console.log(`download round ${++round}: ${pending.length} assets`);
    await pool(pending, 8, async (href) => {
      const u = new URL(href);
      const local = localPathFor(u);
      assets.set(href, local);
      const res = await api.get(href, { timeout: 120000 }).catch((e) => ({ error: e }));
      if (res.error || !res.ok()) {
        console.warn("  failed", href, res.error ? res.error.message : res.status());
        assets.set(href, false);
        return;
      }
      const body = await res.body();
      const file = path.join(OUT, local);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
      if (TEXT_EXT.test(file) || /text|javascript|json|css/.test(res.headers()["content-type"] || "")) {
        scanText(body.toString("utf8"), href);
      }
    });
  }
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

function rewrite(text, { html = false } = {}) {
  const map = (url, escaped) => {
    let u;
    try { u = new URL(escaped ? url.replace(/\\\//g, "/") : url); } catch { return url; }
    if (u.host === START.host) {
      const local = u.pathname + u.search + u.hash;
      return escaped ? local.replace(/\//g, "\\/") : local;
    }
    const local = assets.get(assetKey(u));
    if (!local) return url;
    return escaped ? local.replace(/\//g, "\\/") : local;
  };
  let out = text
    .replace(FORM_API, "/api/forms")
    .replace(new RegExp(`siteCanonicalURL:([\`"])${START.origin.replace(/[.]/g, "\\.")}`, "g"), `siteCanonicalURL:$1${SITE_URL}`)
    .replace(new RegExp(`${START.origin.replace(/[.]/g, "\\.")}(?=[\`"'])`, "g"), "/")
    .replace(/https?:\/\/[a-z0-9.-]+(?::\d+)?\/[^\s"'`)<>\\]*/gi, (m) => map(m, false))
    .replace(/https?:\\\/\\\/[a-z0-9.-]+(?::\d+)?(?:\\\/[^\s"'`)<>\\]*)+/gi, (m) => map(m, true));

  out = html ? cleanHtml(cleanJs(out)) : cleanJs(out);
  return out;
}

// Framer runtime pieces that would call home: the on-page editor bar (loaded
// from framer.com), and the free-plan "Made in Framer" badge link. (The badge
// container itself stays in the HTML because React hydrates into it; CSS
// added in cleanHtml hides it.) Remaining
// framer.com URLs are only text in dev warnings or template links.
function cleanJs(js) {
  return js
    // new URL(rel, base) needs an absolute base; rewritten bases are root-relative.
    .replace(/(new URL\([^,()]+,)([`"'])\/_ext\//g, "$1location.origin+$2/_ext/")
    .replace(/EditorBar:([\w$]+)===void 0\?void 0:/g, "EditorBar:void 0,__editorBarDisabled:$1===void 0?void 0:")
    .replace(/await import\(`https:\/\/framer\.com\/edit\/init\.mjs`\)/g, "({createEditorBar:()=>()=>null})")
    .replace(/https?:\/\/(www\.)?framer\.com\/r\/badge\/[^`"']*/g, "/")
    .replace(/https?:\/\/(www\.)?framer\.com\/?(?=[`"'])/g, "/")
    .replace(/ ?\(?https?:\/\/(www\.)?framer\.com\/[^\s`"'()$]*\)?/g, "");
}

function cleanHtml(html) {
  return html
    .replace(/<!--\s*Made in Framer[\s\S]*?-->/gi, "")
    .replace(/<!--\s*Published[\s\S]*?-->/gi, "")
    .replace(/<meta[^>]+name="generator"[^>]*>/gi, "")
    .replace(/<meta[^>]+name="framer-[^"]*"[^>]*>/gi, "")
    .replace(/<script[^>]*src="[^"]*(events\.framer\.com|framer\.com\/(edit|m\/|bootstrap))[^"]*"[^>]*><\/script>/gi, "")
    .replace(/<link[^>]+href="https?:\/\/[^"]*framer\.com[^"]*"[^>]*>/gi, "")
    .replace(/<link[^>]+rel="(preconnect|dns-prefetch)"[^>]*>/gi, "")
    .replace(/<script>[^<]*__framer_force_showing_editorbar_since[^<]*<\/script>/g, "")
    .replace(/(<link[^>]+rel="canonical"[^>]+href=")\/?([^"]*)(")/i, `$1${SITE_URL}/$2$3`)
    .replace(/(<meta[^>]+property="og:url"[^>]+content=")\/?([^"]*)(")/i, `$1${SITE_URL}/$2$3`)
    .replace(/(<meta[^>]+(?:property="og:image"|name="twitter:image")[^>]+content=")(\/[^"]*)(")/gi, `$1${SITE_URL}$2$3`)
    .replace("</head>", `<style>#__framer-badge-container{display:none!important}</style><script src="/contact-bridge.js"></script></head>`);
}

async function rewriteFiles(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await rewriteFiles(file); continue; }
    if (!TEXT_EXT.test(entry.name) && !file.includes(`${path.sep}fonts.googleapis.com${path.sep}`)) continue;
    const text = await fs.readFile(file, "utf8");
    const out = rewrite(text, { html: /\.html?$/i.test(entry.name) });
    if (out !== text) await fs.writeFile(file, out);
  }
}

await fs.mkdir(OUT, { recursive: true });
await crawl();
await fs.cp(path.resolve("public"), OUT, { recursive: true });
await downloadAll();
await rewriteFiles(OUT);
await browser.close();

const MANIFEST = path.resolve(process.env.MANIFEST || "tools/mirror-manifest.json");
await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
await fs.writeFile(MANIFEST, JSON.stringify({
  source: START.href,
  pages: [...pages].sort(),
  assets: Object.fromEntries([...assets].sort()),
}, null, 2));
const failed = [...assets].filter(([, v]) => v === false);
console.log(`\n${pages.size} pages, ${assets.size - failed.length} assets mirrored, ${failed.length} failed`);
