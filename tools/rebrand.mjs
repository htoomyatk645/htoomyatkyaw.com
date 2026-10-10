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
// Each replacement is { find, replace, only?, near? }. Replacements run in order.
//   only  apply just to files whose path contains one of these strings.
//   near  for text that also appears elsewhere: a string (usually a Framer class
//         such as "framer-1x5adtx") marking the one element to change. In HTML
//         the first `>find<` after each occurrence of `near` is replaced; in JS
//         the `\`find\`` closest to it. findJs/findHtml override the matched
//         text per file type when the two are written differently.
//   split for HTML only: change the text only where it is rendered one <span>
//         per character (animated headings), not where it is plain.

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

function replaceNear(text, isHtml, { find, replace, near, findJs, findHtml }) {
  const target = isHtml ? `>${findHtml ?? find}<` : `\`${findJs ?? find}\``;
  const value = isHtml ? `>${replace}<` : `\`${replace}\``;
  const anchors = [];
  for (let at = text.indexOf(near); at !== -1; at = text.indexOf(near, at + 1)) anchors.push(at);
  let count = 0;
  for (const a of anchors.reverse()) {
    let pos = -1;
    if (isHtml) {
      const p = text.indexOf(target, a);
      if (p !== -1 && p - a < 4000) pos = p;
    } else {
      const from = Math.max(0, a - 1500);
      const windowText = text.slice(from, a + 1500);
      let best = Infinity;
      for (let p = windowText.indexOf(target); p !== -1; p = windowText.indexOf(target, p + 1)) {
        const d = Math.abs(from + p - a);
        if (d < best) { best = d; pos = from + p; }
      }
    }
    if (pos === -1) continue;
    text = text.slice(0, pos) + value + text.slice(pos + target.length);
    count++;
  }
  return { text, count };
}

const hits = config.replacements.map(() => 0);
for await (const file of files(SITE)) {
  let text = await fs.readFile(file, "utf8");
  const before = text;
  const isHtml = file.endsWith(".html");
  config.replacements.forEach((entry, n) => {
    const { find, replace, only, near } = entry;
    // Optional "only": apply just to files whose path contains one of these strings.
    if (only && !only.some((part) => file.includes(part))) return;
    if (near) {
      const r = replaceNear(text, isHtml, entry);
      hits[n] += r.count;
      if (!check) text = r.text;
      return;
    }
    if (entry.split) {
      if (!isHtml) return;
      const { out, count } = replaceSplitText(text, find, replace);
      hits[n] += count;
      if (!check) text = out;
      return;
    }
    const reps = variants(replace);
    variants(find).forEach((f, i) => {
      const count = text.split(f).length - 1;
      if (!count) return;
      hits[n] += count;
      if (!check) text = text.split(f).join(reps[i] ?? reps[0]);
    });
    if (isHtml) {
      const { out, count } = replaceSplitText(text, find, replace);
      if (count) { hits[n] += count; if (!check) text = out; }
    }
  });
  if (!check && text !== before) await fs.writeFile(file, text);
}

let missing = 0;
config.replacements.forEach(({ find, near }, n) => {
  const label = JSON.stringify(find.slice(0, 70)) + (near ? ` near ${near}` : "");
  if (!hits[n]) { missing++; console.log(`not found: ${label}`); }
  else console.log(`${String(hits[n]).padStart(4)}x ${label}`);
});
process.exit(check && missing ? 1 : 0);
