// Cloudflare Worker for htoomyatkyaw.com
//
// - Serves the static site in ./site (bound as env.ASSETS).
// - Handles contact form submissions and emails them to the inbox
//   configured on the CONTACT_EMAIL send_email binding.

import { EmailMessage } from "cloudflare:email";
import { replies, topics } from "./auto-replies.js";
import { handleBooking } from "./booking.js";

const ASSET_PREFIX = "/_v2/";
const MAX_BODY_BYTES = 32 * 1024;
const MAX_FIELD_CHARS = 5000;

// Field names visitors never see; bots that fill them get a fake success.
const HONEYPOT_FIELDS = ["_gotcha", "website", "url", "company_website"];
// Hidden inputs the Framer form component adds as honeypots (its real fields
// are capitalised, e.g. "Email" and "Message").
const FRAMER_HONEYPOT_FIELDS = ["website", "company", "message", "subject", "title", "description", "feedback", "notes", "details", "remarks", "comments"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Pages reference their assets as /_v2/... while the files stay in
    // ./site/_ext. Early deploys sent /_ext/* with a one-year immutable cache,
    // and the rebranded files kept their names, so browsers that visited then
    // kept running the template's scripts; new URLs make them fetch fresh
    // copies. Bump the prefix (here, in wrangler.jsonc and in
    // tools/build-rebrand.py) if that ever happens again.
    if (url.pathname.startsWith(ASSET_PREFIX)) {
      url.pathname = "/_ext/" + url.pathname.slice(ASSET_PREFIX.length);
      if (url.pathname.endsWith(".framercms") && url.searchParams.has("range")) {
        return serveCmsRanges(request, env, url);
      }
      return env.ASSETS.fetch(new Request(url, request));
    }

    // /api/contact is our endpoint. /api/forms/* catches the mirrored Framer
    // form component, whose Framer API URL is rewritten to this path.
    if (url.pathname === "/api/contact" || url.pathname.startsWith("/api/forms/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
      return handleContact(request, env, url, ctx);
    }

    // Meeting requests from the Contact page (src/booking.js).
    if (url.pathname.startsWith("/api/booking/")) {
      return handleBooking(request, env, url, ctx, { allowed: isAllowedOrigin, owner: sendOwnerTemplate, visitor: sendVisitorTemplate });
    }

    // Framer's CMS client asks for byte ranges via ?range=a-b,c-d and expects
    // the requested slices concatenated in a 200 response.
    if (url.pathname.endsWith(".framercms") && url.searchParams.has("range")) {
      return serveCmsRanges(request, env, url);
    }

    // Journal posts and case studies are pages that tools/build-content.mjs
    // writes to ./site/blog/<slug>.html and ./site/case-study/<slug>.html.
    // Serve one if it exists. Otherwise the four template case-study slugs
    // (still linked from the cards) go to their standalone write-ups, and any
    // other slug goes back to its index page.
    const detail = url.pathname.match(/^\/(case-study|blog)\/([^/]+)\/?$/);
    if (detail) {
      const page = await env.ASSETS.fetch(request);
      if (page.status !== 404) return page;
      const live = {
        "north-light": `${url.origin}/under-the-hood`,
        stylebook: `${url.origin}/the-briefly-look`,
        homestead: `${url.origin}/seven-slides-a-day`,
        "meridian-health": "https://briefly.briefa.net",
      }[detail[1] === "case-study" ? detail[2] : ""];
      return Response.redirect(live || `${url.origin}/${detail[1]}`, 302);
    }

    return env.ASSETS.fetch(request);
  },
};

async function serveCmsRanges(request, env, url) {
  const ranges = url.searchParams.get("range").split(",").map((part) => part.split("-").map(Number));
  if (!ranges.every(([from, to]) => Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= from)) {
    return new Response("Bad range", { status: 400 });
  }
  const assetUrl = new URL(url.pathname, url.origin);
  const res = await env.ASSETS.fetch(new Request(assetUrl, { headers: request.headers }));
  if (!res.ok) return res;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const total = ranges.reduce((sum, [from, to]) => sum + (to - from + 1), 0);
  if (ranges.some(([, to]) => to >= bytes.length)) return new Response("Range out of bounds", { status: 416 });
  const out = new Uint8Array(total);
  let offset = 0;
  for (const [from, to] of ranges) {
    out.set(bytes.subarray(from, to + 1), offset);
    offset += to - from + 1;
  }
  return new Response(out, {
    // Not immutable: the CMS files keep their names when their content is edited.
    headers: { "content-type": "application/octet-stream", "cache-control": "public, max-age=0, must-revalidate" },
  });
}

async function handleContact(request, env, url, ctx) {
  if (!isAllowedOrigin(request, env, url)) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  if (env.CONTACT_RATE_LIMIT) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await env.CONTACT_RATE_LIMIT.limit({ key: ip });
    if (!success) return json({ success: false, error: "Too many requests" }, 429);
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return json({ success: false, error: "Message too large" }, 413);

  let fields;
  try {
    fields = await readFields(request);
  } catch {
    return json({ success: false, error: "Could not read form data" }, 400);
  }

  const honeypots = url.pathname.startsWith("/api/forms/") ? FRAMER_HONEYPOT_FIELDS : HONEYPOT_FIELDS;
  if (honeypots.some((name) => fields[name])) {
    return json({ success: true });
  }
  for (const name of honeypots) delete fields[name];
  // Framer's bot-check metadata (__framer_0, __framer_1, ...).
  for (const name of Object.keys(fields)) if (name.startsWith("__framer")) delete fields[name];

  const entries = Object.entries(fields)
    .map(([key, value]) => [key.slice(0, 100), String(value).slice(0, MAX_FIELD_CHARS)])
    .filter(([, value]) => value.trim() !== "");

  if (entries.length === 0) return json({ success: false, error: "Empty submission" }, 400);

  const replyTo = findEmail(entries);
  const name = findField(entries, /^(full[\s_-]?)?name$/i) || findField(entries, /name/i);
  // Forms on the site can label themselves with a "Form" field (the college
  // admissions survey does), so they are easy to tell apart in the inbox.
  const form = findField(entries, /^form$/i);
  const subject = `New ${form || "message"} from htoomyatkyaw.com${name ? ` — ${name}` : ""}`;

  const raw = buildMime({
    from: env.CONTACT_FROM,
    fromName: "htoomyatkyaw.com contact form",
    to: env.CONTACT_TO,
    replyTo,
    subject,
    text: formatText(entries, request),
  });

  try {
    await env.CONTACT_EMAIL.send(new EmailMessage(env.CONTACT_FROM, env.CONTACT_TO, raw));
  } catch (err) {
    console.error("send_email failed:", err && err.message);
    return json({ success: false, error: "Could not send message" }, 502);
  }

  // The visitor gets an automatic, branded confirmation. It is sent after the
  // response, and a failure here never fails the form.
  if (replyTo) ctx.waitUntil(sendAutoReply(env, { to: replyTo, name, form, entries }));

  return json({ success: true });
}

// Automatic reply to the person who wrote in (emails/templates.json, the
// templates marked "auto"). Only two things from the visitor go into it: a
// first name reduced to letters, and survey topics that match the survey's own
// options. Nothing else they typed is echoed back, so the form can't be used
// to send someone a message of the sender's choosing.
async function sendAutoReply(env, { to, name, form, entries }) {
  const reply = /admissions/i.test(form) ? replies.admissions : /project inquiry/i.test(form) ? replies.clients : replies.contact;
  const own = [env.CONTACT_TO, env.CONTACT_FROM, env.AUTO_REPLY_REPLY_TO].map((a) => (a || "").toLowerCase());
  if (!reply || own.includes(to.toLowerCase())) return;

  const first = ((name.split(/\s+/)[0] || "").match(/^[\p{L}][\p{L}'-]{0,29}$/u) || ["there"])[0];
  const asked = (findField(entries, /^needs help with$/i) || "").split(",").map((s) => s.trim());
  const picked = topics.filter((t) => asked.includes(t) && !/^(I |Not sure)/.test(t))
    .map((t) => t.replace(/^My /, "your ").replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()));
  const topicLine = picked.length ? `You asked for help with: ${picked.join(", ")}.` : "";
  const fill = (s, escape) => s
    .replace(/\{\{first_name\}\}/g, first)
    .replace(/<p[^>]*>\{\{topic_line\}\}<\/p>\n?/g, topicLine ? (m) => m.replace("{{topic_line}}", escape(topicLine)) : "")
    .replace(/\{\{topic_line\}\}\n\n/g, topicLine ? topicLine + "\n\n" : "");
  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const message = {
    from: env.CONTACT_FROM, fromName: "Htoo Myat Kyaw", to, replyTo: env.AUTO_REPLY_REPLY_TO || env.CONTACT_TO,
    subject: first === "there" ? reply.subject : `${reply.subject}, ${first}`,
    text: fill(reply.text, (s) => s), html: fill(reply.html, escapeHtml),
  };

  await deliver(env, message);
}

// Sends a message to someone outside the account: through Resend when its API
// key is set as a secret, otherwise through Cloudflare Email Sending.
async function deliver(env, message) {
  try {
    if (env.RESEND_API_KEY) {
      const res = await fetch((env.RESEND_API_BASE || "https://api.resend.com") + "/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: `${message.fromName} <${message.from}>`, to: [message.to], reply_to: message.replyTo,
          subject: message.subject, html: message.html, text: message.text, headers: { "Auto-Submitted": "auto-replied" },
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return true;
    }
    if (env.AUTO_REPLY) {
      await env.AUTO_REPLY.send(new EmailMessage(env.CONTACT_FROM, message.to, buildMime(message)));
      return true;
    }
  } catch (err) {
    console.error("auto-reply failed:", err && err.message);
  }
  return false;
}

// The booking emails (emails/templates.json, "auto": "booking..."). Every
// {{blank}} is filled from `vars`; a paragraph that is only an empty blank is
// dropped.
function fillTemplate(template, vars) {
  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fill = (s, escape) => s
    .replace(/<p[^>]*>\{\{(\w+)\}\}<\/p>\n?/g, (m, k) => (vars[k] ? m : ""))
    .replace(/^\{\{(\w+)\}\}\n\n/gm, (m, k) => (vars[k] ? m : ""))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? escape(String(vars[k])) : m));
  return { subject: fill(template.subject, (v) => v.replace(/[\r\n]+/g, " ")), text: fill(template.text, (v) => v), html: fill(template.html, escapeHtml) };
}

async function sendVisitorTemplate(env, key, to, vars) {
  if (!replies[key]) return false;
  return deliver(env, { from: env.CONTACT_FROM, fromName: "Htoo Myat Kyaw", to, replyTo: env.AUTO_REPLY_REPLY_TO || env.CONTACT_TO, ...fillTemplate(replies[key], vars) });
}

// To Htoo's own inbox, through the same binding as the contact form.
async function sendOwnerTemplate(env, key, vars, replyTo) {
  if (!replies[key]) return false;
  const raw = buildMime({ from: env.CONTACT_FROM, fromName: "htoomyatkyaw.com meetings", to: env.CONTACT_TO, replyTo, ...fillTemplate(replies[key], vars) });
  try {
    await env.CONTACT_EMAIL.send(new EmailMessage(env.CONTACT_FROM, env.CONTACT_TO, raw));
    return true;
  } catch (err) {
    console.error("send_email failed:", err && err.message);
    return false;
  }
}

function isAllowedOrigin(request, env, url) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients; rate limiting still applies
  const allowed = new Set([url.origin, ...(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)]);
  return allowed.has(origin);
}

async function readFields(request) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/json")) {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad json");
    // Some form libraries nest values under "data" or "fields".
    const source = isPlainObject(body.data) ? body.data : isPlainObject(body.fields) ? body.fields : body;
    return Object.fromEntries(
      Object.entries(source).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v ?? ""]),
    );
  }
  const form = await request.formData();
  const out = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue; // ignore file uploads
    out[key] = key in out ? `${out[key]}, ${value}` : value;
  }
  return out;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findField(entries, pattern) {
  const hit = entries.find(([key]) => pattern.test(key));
  return hit ? hit[1].replace(/[\r\n]+/g, " ").trim().slice(0, 100) : "";
}

function findEmail(entries) {
  const valid = (v) => /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(v.trim());
  const byKey = entries.find(([key, value]) => /e-?mail/i.test(key) && valid(value));
  const any = byKey || entries.find(([, value]) => valid(value));
  return any ? any[1].trim() : "";
}

function formatText(entries, request) {
  const width = Math.max(...entries.map(([key]) => key.length));
  const lines = entries.map(([key, value]) =>
    value.includes("\n") ? `${key}:\n${value}\n` : `${key.padEnd(width)} : ${value}`,
  );
  const meta = [
    `Sent: ${new Date().toUTCString()}`,
    `Page: ${request.headers.get("referer") || "unknown"}`,
    `Country: ${(request.cf && request.cf.country) || "unknown"}`,
  ];
  return `${lines.join("\n")}\n\n--\n${meta.join("\n")}\n`;
}

// Minimal RFC 5322 message; plain text body, UTF-8, base64-encoded.
function buildMime({ from, fromName, to, replyTo, subject, text, html }) {
  const boundary = `b${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `From: ${encodeWord(fromName)} <${from}>`,
    `To: <${to}>`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split("@")[1]}>`,
    "MIME-Version: 1.0",
    html ? "Auto-Submitted: auto-replied" : null,
    html ? `Content-Type: multipart/alternative; boundary="${boundary}"` : "Content-Type: text/plain; charset=UTF-8",
    html ? null : "Content-Transfer-Encoding: base64",
  ].filter(Boolean);
  if (!html) return `${headers.join("\r\n")}\r\n\r\n${base64Lines(text)}\r\n`;
  const part = (type, body) => `--${boundary}\r\nContent-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(body)}\r\n`;
  return `${headers.join("\r\n")}\r\n\r\n${part("text/plain", text)}${part("text/html", html)}--${boundary}--\r\n`;
}

function encodeWord(value) {
  const clean = value.replace(/[\r\n]+/g, " ");
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${toBase64(clean)}?=`;
}

function toBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64Lines(value) {
  return toBase64(value).replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
