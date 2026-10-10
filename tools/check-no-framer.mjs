#!/usr/bin/env node
// Fail if anything in ./site still references Framer-hosted URLs.
import fs from "node:fs";
import path from "node:path";

const pattern = /https?:(\\?\/){2}([a-z0-9-]+\.)*(framer\.(com|app|website|ai)|framerusercontent\.com|framerstatic\.com)/gi;
const hits = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(html?|m?js|css|json|xml|txt|svg)$/i.test(e.name)) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(pattern)) hits.push(`${f}: ${m[0]}`);
    }
  }
})("site");
if (hits.length) {
  console.error(hits.slice(0, 50).join("\n") + "\nFramer references remain in ./site (above).");
  process.exit(1);
}
console.log("No Framer-hosted URLs in ./site.");
