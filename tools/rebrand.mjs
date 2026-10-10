#!/usr/bin/env node
// Apply the copy changes in tools/rebrand.json to the mirrored site.
//
// Framer pages render their text twice: in the server HTML and in the page's
// JS module (used when it hydrates). Each replacement is applied to both, so
// the HTML in ./site and every JS module under ./site/_ext get the same text.
//
//   node tools/rebrand.mjs          apply
//   node tools/rebrand.mjs --check  list replacements whose "find" text is missing
//
// Each replacement is { find, replace, only? }; "only" limits it to files whose
// path contains one of the given strings. Replacements run in order.

import fs from "node:fs/promises";
import path from "node:path";

const SITE = path.resolve(process.env.SITE_DIR || "site");
const config = JSON.parse(await fs.readFile(process.env.REBRAND || "tools/rebrand.json", "utf8"));
const check = process.argv.includes("--check");

async function* files(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (/\.(html?|m?js|json|xml|txt)$/i.test(entry.name)) yield file;
  }
}

// Animated headings are server-rendered one <span> per character, grouped in a
// nowrap <span> per word. Find those runs, replace inside their text, and
// rebuild the same markup for the new words.
const SPLIT_RUN = /(?:<span style="white-space:nowrap">(?:<span style="[^"]*">[^<]*<\/span>)+<\/span>[ ]?)+/g;
const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const encode = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function replaceSplitText(html, find, replace) {
  let count = 0;
  const out = html.replace(SPLIT_RUN, (run) => {
    const words = [...run.matchAll(/<span style="white-space:nowrap">((?:<span style="[^"]*">[^<]*<\/span>)+)<\/span>/g)]
      .map((w) => [...w[1].matchAll(/>([^<]*)</g)].map((c) => decode(c[1])).join(""));
    const text = words.join(" ");
    if (!text.includes(find)) return run;
    count += text.split(find).length - 1;
    const style = run.match(/<span style="(display:[^"]*)">/)[1];
    const trailing = run.endsWith(" ") ? " " : "";
    return text.split(find).join(replace).split(" ").filter(Boolean)
      .map((word) => `<span style="white-space:nowrap">${[...word].map((c) => `<span style="${style}">${encode(c)}</span>`).join("")}</span>`)
      .join(" ") + trailing;
  });
  return { out, count };
}

// Text in JS modules can be JSON-escaped; match both forms.
const variants = (s) => [...new Set([s, JSON.stringify(s).slice(1, -1)])];

const hits = new Map(config.replacements.map((r) => [r.find, 0]));
for await (const file of files(SITE)) {
  let text = await fs.readFile(file, "utf8");
  const before = text;
  for (const { find, replace, only } of config.replacements) {
    // Optional "only": apply just to files whose path contains one of these strings.
    if (only && !only.some((part) => file.includes(part))) continue;
    const reps = variants(replace);
    variants(find).forEach((f, i) => {
      const count = text.split(f).length - 1;
      if (!count) return;
      hits.set(find, hits.get(find) + count);
      if (!check) text = text.split(f).join(reps[i] ?? reps[0]);
    });
  }
  if (file.endsWith(".html")) {
    for (const { find, replace, only } of config.replacements) {
      if (only && !only.some((part) => file.includes(part))) continue;
      const { out, count } = replaceSplitText(text, find, replace);
      if (count) { hits.set(find, hits.get(find) + count); if (!check) text = out; }
    }
  }
  if (!check && text !== before) await fs.writeFile(file, text);
}

let missing = 0;
for (const [find, count] of hits) {
  if (!count) { missing++; console.log(`not found: ${JSON.stringify(find.slice(0, 80))}`); }
  else console.log(`${String(count).padStart(4)}x ${JSON.stringify(find.slice(0, 80))}`);
}
process.exit(check && missing ? 1 : 0);
