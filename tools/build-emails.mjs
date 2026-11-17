#!/usr/bin/env node
// Build the email templates in emails/templates.json.
//
//   node tools/build-emails.mjs
//
// Writes, for each template, emails/out/<id>.html (table layout with inline
// styles, which is what mail clients need) and emails/out/<id>.txt, plus
// emails/gallery.html: one page to pick a template, fill in the {{blanks}} and
// copy the result.
//
// Mail clients don't load web fonts, so the pixel-font heading of each email is
// a picture: site/email/<word>-<colour>.png, drawn here with the site's Flux
// font and served from htoomyatkyaw.com once the site is deployed.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ORIGIN = "https://htoomyatkyaw.com";
const { sender, templates } = JSON.parse(fs.readFileSync("emails/templates.json", "utf8"));
const FLUX = fs.readFileSync("site/_ext/framerusercontent.com/assets/fROf9QsA0Xgfcctq630ByO5kbg.woff2").toString("base64");
const INK = "#111212", MUTE = "#767777", LINE = "#ededed";
const COLORS = { cyan: ["#36c5f0", "#a4e5f8"], yellow: ["#ecb22e", "#f5dda1"], pink: ["#e01e5a", "#fabed1"], green: ["#2fbc81", "#a1dfc5"] };
const SANS = "'Inter Display',Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'DM Mono','SF Mono',Menlo,Consolas,'Courier New',monospace";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const bannerFile = (t) => `${slug(t.banner)}-${t.color}.png`;
const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

// ---------------------------------------------------------------- banners
fs.mkdirSync("site/email", { recursive: true });
fs.mkdirSync("emails/out", { recursive: true });
const exe = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 600, height: 190 }, deviceScaleFactor: 2 });
const banners = {};
for (const t of templates) {
  const file = bannerFile(t);
  if (banners[file]) continue;
  const [strong, tint] = COLORS[t.color];
  const word = t.banner.toUpperCase();
  const size = Math.min(96, Math.floor(470 / (word.length * 0.56)));
  await page.setContent(`<style>
@font-face{font-family:Flux;src:url(data:font/woff2;base64,${FLUX});font-weight:1000}
*{margin:0;box-sizing:border-box}
body{width:600px;height:190px;background:${tint};background-image:linear-gradient(rgba(17,18,18,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(17,18,18,.07) 1px,transparent 1px);background-size:50px 50px;background-position:-1px -1px;display:flex;align-items:center;justify-content:center;gap:18px;overflow:hidden}
.box{position:relative;padding:20px 22px 14px;border:2px solid ${INK};background:rgba(255,255,255,.55)}
.w{font:1000 ${size}px/0.8 Flux;letter-spacing:-.025em;color:${INK};white-space:nowrap}
.h{position:absolute;width:12px;height:12px;background:#fff;border:2px solid ${INK}}
.s{flex:none;width:44px;height:44px;background:${strong}}
.s1{clip-path:polygon(50% 0,63% 37%,100% 50%,63% 63%,50% 100%,37% 63%,0 50%,37% 37%);transform:rotate(-12deg)}
.s2{border-radius:50% 50% 50% 0;transform:rotate(14deg)}
</style><i class="s s1"></i><div class="box"><div class="w">${esc(word)}</div><i class="h" style="left:-7px;top:-7px"></i><i class="h" style="right:-7px;top:-7px"></i><i class="h" style="left:-7px;bottom:-7px"></i><i class="h" style="right:-7px;bottom:-7px"></i></div><i class="s s2"></i>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join("site/email", file), png);
  banners[file] = "data:image/png;base64," + png.toString("base64");
}
await browser.close();
// The gallery shows the portrait from a data URI too (it cannot load other sites).
banners.__portrait = "data:image/png;base64," + fs.readFileSync("site/brand/portrait-mark.png").toString("base64");

// ---------------------------------------------------------------- one email
function html(t) {
  const [strong, tint] = COLORS[t.color];
  const p = `margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK}`;
  const body = t.body.map((b) => {
    if (typeof b === "string") return `<p style="${p}">${rich(b)}</p>`;
    if (b.list) return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">${b.list.map((li) => `<tr><td valign="top" style="padding:3px 10px 3px 0;font-family:${MONO};font-size:13px;line-height:1.9;color:${strong}">&#9632;</td><td valign="top" style="padding:3px 0;font-family:${SANS};font-size:16px;line-height:1.5;color:${INK}">${rich(li)}</td></tr>`).join("")}</table>`;
    if (b.button) return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px"><tr><td bgcolor="${INK}" style="background:${INK}"><a href="${esc(b.button.url)}" style="display:inline-block;padding:13px 20px;font-family:${MONO};font-size:14px;line-height:1;letter-spacing:.02em;text-transform:uppercase;color:#ffffff;text-decoration:none">${esc(b.button.label)} &rarr;</a></td></tr></table>`;
    return "";
  }).join("\n");
  const host = sender.site.replace(/^https?:\/\//, "");
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(t.preheader || (typeof t.body[1] === "string" ? t.body[1] : "").replace(/\*\*/g, "").slice(0, 110))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f7f7" style="background:#f7f7f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border:2px solid ${INK}">
<tr><td style="padding:12px 18px;border-bottom:2px solid ${INK}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${MONO};font-size:13px;line-height:1;letter-spacing:.02em;text-transform:uppercase;color:${INK}"><img src="${ORIGIN}/brand/portrait-mark.png" width="26" height="26" alt="" style="vertical-align:middle;border-radius:50%;margin-right:10px">${esc(sender.name)}</td>
<td align="right" style="font-family:${MONO};font-size:12px;line-height:1;text-transform:uppercase"><a href="${esc(sender.site)}" style="color:${MUTE};text-decoration:none">${esc(host)}</a></td></tr></table></td></tr>
<tr><td bgcolor="${tint}" style="background:${tint};border-bottom:2px solid ${INK};font-size:0;line-height:0"><img src="${ORIGIN}/email/${bannerFile(t)}" width="600" alt="${esc(t.banner)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;font-family:${MONO};font-size:28px;line-height:60px;color:${INK};text-align:center;text-transform:uppercase"></td></tr>
<tr><td style="padding:30px 28px 10px">
${body}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 20px"><tr><td style="padding:14px 0 0;border-top:1px dashed #b9b9b9">
<p style="margin:0 0 3px;font-family:${SANS};font-size:16px;line-height:1.4;font-weight:600;color:${INK}">${esc(sender.name)}</p>
<p style="margin:0 0 3px;font-family:${SANS};font-size:14px;line-height:1.4;color:${MUTE}">${esc(sender.role)}</p>
<p style="margin:0;font-family:${MONO};font-size:13px;line-height:1.6"><a href="mailto:${esc(sender.email)}" style="color:${INK}">${esc(sender.email)}</a> &nbsp;&middot;&nbsp; <a href="${esc(sender.site)}" style="color:${INK}">${esc(host)}</a></p>
</td></tr></table>
</td></tr>
<tr><td style="font-size:0;line-height:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${Object.values(COLORS).map(([c]) => `<td width="25%" height="8" bgcolor="${c}" style="background:${c};height:8px;font-size:0;line-height:0">&nbsp;</td>`).join("")}</tr></table></td></tr>
</table>
<p style="margin:14px 0 0;font-family:${MONO};font-size:11px;line-height:1.5;color:${MUTE};text-transform:uppercase">Briefly is live on the App Store &nbsp;&middot;&nbsp; <a href="${esc(sender.briefly)}" style="color:${MUTE}">${esc(sender.briefly.replace(/^https?:\/\//, ""))}</a></p>
</td></tr></table>`;
}

function text(t) {
  const lines = t.body.map((b) => typeof b === "string" ? b.replace(/\*\*/g, "") : b.list ? b.list.map((li) => "- " + li.replace(/\*\*/g, "")).join("\n") : `${b.button.label}: ${b.button.url}`);
  return `${lines.join("\n\n")}\n\n--\n${sender.name}\n${sender.role}\n${sender.email} · ${sender.site.replace(/^https?:\/\//, "")}\n`;
}

const data = templates.map((t) => {
  const h = html(t), x = text(t);
  fs.writeFileSync(`emails/out/${t.id}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.subject)}</title></head><body style="margin:0;padding:0;background:#f7f7f7">\n${h}\n</body></html>\n`);
  fs.writeFileSync(`emails/out/${t.id}.txt`, `Subject: ${t.subject}\n\n${x}`);
  return { id: t.id, group: t.group, name: t.name, when: t.when, color: t.color, subject: t.subject, html: h, text: x, banner: bannerFile(t) };
});

// ---------------------------------------------------------------- automatic replies
// Templates marked "auto" are sent by the Worker itself (src/worker.js) when a
// form comes in. They go into a module the Worker imports. The Worker fills
// {{first_name}} and {{topic_line}}; the list of survey topics lets it accept
// only answers the survey really offers.
const options = (file, id) => JSON.parse(fs.readFileSync(file, "utf8")).survey.questions.find((q) => q.id === id).options;
const topicList = [...options("content/services/admissions.json", "help"), ...options("content/services/clients.json", "service")];
const auto = Object.fromEntries(templates.filter((t) => t.auto).map((t) => [t.auto, { subject: t.subject, html: html(t), text: text(t) }]));
fs.writeFileSync("src/auto-replies.js", `// Generated by tools/build-emails.mjs from emails/templates.json. Do not edit.
export const topics = ${JSON.stringify(topicList)};
export const replies = ${JSON.stringify(auto)};
`);

// ---------------------------------------------------------------- gallery
const gallery = fs.readFileSync("emails/gallery.src.html", "utf8")
  .replace("__FLUX__", FLUX)
  .replace("__DATA__", () => JSON.stringify({ origin: ORIGIN, banners, templates: data }).replace(/</g, "\\u003c"));
fs.writeFileSync("emails/gallery.html", gallery);
console.log(`${templates.length} templates, ${Object.keys(banners).length - 1} banners -> emails/out, site/email, emails/gallery.html, src/auto-replies.js`);
