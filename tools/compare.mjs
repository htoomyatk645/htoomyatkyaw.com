#!/usr/bin/env node
// Screenshot the original site and the local copy side by side at phone and
// desktop widths, pixel-diff them, and check the copy makes no outside requests.
//
//   npx wrangler dev --port 8787 &
//   node tools/compare.mjs https://nudge-folio.framer.website http://localhost:8787
//
// Writes compare/<page>-<width>.png (original | copy | diff) and compare/report.json.

import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs/promises";
import path from "node:path";

const ORIGINAL = process.argv[2] || "https://nudge-folio.framer.website";
const COPY = process.argv[3] || "http://localhost:8787";
const OUT = path.resolve(process.env.COMPARE_DIR || "compare");
const WIDTHS = { phone: 390, desktop: 1440 };
const THRESHOLD = Number(process.env.DIFF_THRESHOLD || 0.5); // % of pixels allowed to differ

const manifest = JSON.parse(await fs.readFile(process.env.MANIFEST || "tools/mirror-manifest.json", "utf8"));
const pages = process.env.PAGES ? process.env.PAGES.split(",") : manifest.pages;
// Playwright sends even loopback traffic through a proxy, so only use one for remote sites.
const proxyFor = (base) =>
  process.env.HTTPS_PROXY && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname)
    ? { server: process.env.HTTPS_PROXY }
    : undefined;

const browser = await chromium.launch();
await fs.mkdir(OUT, { recursive: true });

async function shoot(base, pagePath, width, outside) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    proxy: proxyFor(base),
  });
  const page = await context.newPage();
  const baseHost = new URL(base).host;
  if (outside) page.on("request", (req) => {
    const u = new URL(req.url());
    if (/^https?:$/.test(u.protocol) && u.host !== baseHost) outside.add(u.href);
  });
  // Same virtual clock on both sides: the live clock, marquees and appear
  // animations all land in the same state.
  // Seeded Math.random so randomised decorations match too.
  await page.addInitScript(() => {
    let seed = 42;
    Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  });
  await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T12:00:01Z"));
  await page.goto(new URL(pagePath, base).href, { waitUntil: "networkidle", timeout: 60000 });
  await page.clock.runFor(3000);
  // Scroll through so every in-view animation fires, then return to the top.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 300) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.clock.runFor(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.addStyleTag({ content: "#__framer-badge-container{display:none!important} *{caret-color:transparent!important}" });
  await page.clock.runFor(5000);
  // Capture screen by screen (what a visitor sees, with in-view animations
  // settled) and stitch, rather than one full-page grab of off-screen content.
  const vh = page.viewportSize().height;
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const sheet = new PNG({ width, height: total });
  for (let y = 0; y < total; y += vh) {
    const top = Math.min(y, Math.max(0, total - vh));
    await page.evaluate((t) => window.scrollTo(0, t), top);
    await page.clock.runFor(2000);
    const tile = PNG.sync.read(await page.screenshot({ animations: "disabled" }));
    const rows = Math.min(vh, total - y);
    PNG.bitblt(tile, sheet, 0, y - top, width, rows, 0, y);
  }
  await context.close();
  return sheet;
}

function pad(img, width, height) {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height });
  out.data.fill(255);
  PNG.bitblt(img, out, 0, 0, Math.min(img.width, width), Math.min(img.height, height), 0, 0);
  return out;
}

const results = [];
for (const pagePath of pages) {
  for (const [label, width] of Object.entries(WIDTHS)) {
    const outside = new Set();
    const a = await shoot(ORIGINAL, pagePath, width);
    const b = await shoot(COPY, pagePath, width, outside);
    const w = Math.max(a.width, b.width);
    const h = Math.max(a.height, b.height);
    const A = pad(a, w, h);
    const B = pad(b, w, h);
    const diff = new PNG({ width: w, height: h });
    const changed = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.1 });
    const pct = (100 * changed) / (w * h);

    const gap = 16;
    const sheet = new PNG({ width: w * 3 + gap * 2, height: h });
    sheet.data.fill(255);
    PNG.bitblt(A, sheet, 0, 0, w, h, 0, 0);
    PNG.bitblt(B, sheet, 0, 0, w, h, w + gap, 0);
    PNG.bitblt(diff, sheet, 0, 0, w, h, (w + gap) * 2, 0);
    const name = `${pagePath.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "home"}-${label}.png`;
    await fs.writeFile(path.join(OUT, name), PNG.sync.write(sheet));

    const result = {
      page: pagePath, viewport: label, width,
      heights: { original: a.height, copy: b.height },
      diffPercent: Number(pct.toFixed(3)),
      pass: pct <= THRESHOLD && a.height === b.height && outside.size === 0,
      outsideRequests: [...outside],
      image: path.relative(process.cwd(), path.join(OUT, name)),
    };
    results.push(result);
    console.log(`${result.pass ? "PASS" : "FAIL"} ${pagePath} @${label}: ${result.diffPercent}% differ, heights ${a.height}/${b.height}, outside requests ${outside.size}`);
  }
}

await browser.close();
await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
