// Cloudflare Worker for htoomyatkyaw.com
//
// - Serves the static site in ./site (bound as env.ASSETS).
// - Handles contact form submissions and emails them to the inbox
//   configured on the CONTACT_EMAIL send_email binding.

import { EmailMessage } from "cloudflare:email";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_FIELD_CHARS = 5000;

// Field names visitors never see; bots that fill them get a fake success.
const HONEYPOT_FIELDS = ["_gotcha", "website", "url", "company_website"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // /api/contact is our endpoint. /api/forms/* catches the mirrored Framer
    // form component, whose Framer API URL is rewritten to this path.
    if (url.pathname === "/api/contact" || url.pathname.startsWith("/api/forms/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
      return handleContact(request, env, url);
    }

    // Framer's CMS client asks for byte ranges via ?range=a-b,c-d and expects
    // the requested slices concatenated in a 200 response.
    if (url.pathname.endsWith(".framercms") && url.searchParams.has("range")) {
      return serveCmsRanges(request, env, url);
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
    headers: { "content-type": "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
  });
}

async function handleContact(request, env, url) {
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

  if (HONEYPOT_FIELDS.some((name) => fields[name])) {
    return json({ success: true });
  }
  for (const name of HONEYPOT_FIELDS) delete fields[name];

  const entries = Object.entries(fields)
    .map(([key, value]) => [key.slice(0, 100), String(value).slice(0, MAX_FIELD_CHARS)])
    .filter(([, value]) => value.trim() !== "");

  if (entries.length === 0) return json({ success: false, error: "Empty submission" }, 400);

  const replyTo = findEmail(entries);
  const name = findField(entries, /^(full[\s_-]?)?name$/i) || findField(entries, /name/i);
  const subject = `New message from htoomyatkyaw.com${name ? ` — ${name}` : ""}`;

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

  return json({ success: true });
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
function buildMime({ from, fromName, to, replyTo, subject, text }) {
  const headers = [
    `From: ${encodeWord(fromName)} <${from}>`,
    `To: <${to}>`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split("@")[1]}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);
  return `${headers.join("\r\n")}\r\n\r\n${base64Lines(text)}\r\n`;
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
