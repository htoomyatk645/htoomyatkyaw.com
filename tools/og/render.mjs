// Render tools/og/og.html to brand/og.png (1200x630) for the link preview.
//   node tools/og/render.mjs
import { chromium } from "playwright";
import path from "node:path";
const page = await (await chromium.launch()).newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto("file://" + path.resolve("tools/og/og.html"));
await page.waitForSelector("body[data-ready]");
await page.screenshot({ path: "brand/og.png" });
console.log("brand/og.png");
process.exit(0);
