#!/usr/bin/env node
// Apply the copy changes in tools/rebrand.json to the mirrored site.
//
// Framer pages render their text twice: in the server HTML and in the page's
// JS module (used when it hydrates). Each replacement is applied to both, so
// the HTML in ./site and every JS module under ./site/_ext get the same text.
//
//   node tools/rebrand.mjs          apply
//   node tools/rebrand.mjs --check  list replacements whose "find" text is missing

import fs from "node:fs/promises";
import path from "node:path";

const SITE = path.resolve("site");
const config = JSON.parse(await fs.readFile("tools/rebrand.json", "utf8"));
const check = process.argv.includes("--check");

async function* files(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (/\.(html?|m?js|json|xml|txt)$/i.test(entry.name)) yield file;
  }
}

// Text in JS modules can be JSON-escaped; match both forms.
const variants = (s) => [...new Set([s, JSON.stringify(s).slice(1, -1)])];

const hits = new Map(config.replacements.map((r) => [r.find, 0]));
for await (const file of files(SITE)) {
  let text = await fs.readFile(file, "utf8");
  const before = text;
  for (const { find, replace } of config.replacements) {
    const reps = variants(replace);
    variants(find).forEach((f, i) => {
      const count = text.split(f).length - 1;
      if (!count) return;
      hits.set(find, hits.get(find) + count);
      if (!check) text = text.split(f).join(reps[i] ?? reps[0]);
    });
  }
  if (!check && text !== before) await fs.writeFile(file, text);
}

let missing = 0;
for (const [find, count] of hits) {
  if (!count) { missing++; console.log(`not found: ${JSON.stringify(find.slice(0, 80))}`); }
  else console.log(`${String(count).padStart(4)}x ${JSON.stringify(find.slice(0, 80))}`);
}
process.exit(check && missing ? 1 : 0);
