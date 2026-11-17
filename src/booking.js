// Meeting requests from the Contact page.
//
//   GET  /api/booking/slots?type=<id>   open times for a meeting type
//   POST /api/booking/request           a visitor asks for a time
//   GET  /api/booking/review?t=<token>  Htoo's page: the request, Confirm / Decline
//   POST /api/booking/review            what Htoo chose
//
// Open times are the weekly hours in content/site.json ("booking") minus
// whatever is busy on Google Calendar. A request books nothing: it emails
// Htoo a link to the review page. Pressing Confirm there creates the calendar
// event with a Google Meet link and emails the visitor.
//
// Nothing is stored. The review link carries the request itself, signed with
// a secret, so it cannot be forged or altered.
//
// Google Calendar needs three secrets (see README, "Booking"):
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN. Without them
// the hours in site.json are offered as they are and no event is created.

import { booking as cfg } from "./booking-config.js";

const enc = new TextEncoder();
const DAY = 86400000;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function handleBooking(request, env, url, ctx, mail) {
  const path = url.pathname.replace(/\/$/, "");
  try {
    if (path === "/api/booking/slots" && request.method === "GET") return await slotsResponse(env, url);
    if (path === "/api/booking/request" && request.method === "POST") return await requestMeeting(request, env, url, ctx, mail);
    if (path === "/api/booking/review" && request.method === "GET") return await reviewPage(env, url);
    if (path === "/api/booking/review" && request.method === "POST") return await reviewAction(request, env, url, mail);
  } catch (err) {
    console.error("booking failed:", err && err.message);
    return json({ success: false, error: "Something went wrong" }, 500);
  }
  return json({ success: false, error: "Not found" }, 404);
}

// ---------------------------------------------------------------- time zones
// Offset of a zone from UTC at a given instant, in milliseconds.
function zoneOffset(ms, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(ms));
  const p = Object.fromEntries(parts.map((x) => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
// The instant at which a wall clock in `tz` reads the given date and time.
function zonedTime(y, m, d, h, min, tz) {
  const wall = Date.UTC(y, m - 1, d, h, min);
  let ms = wall - zoneOffset(wall, tz);
  ms = wall - zoneOffset(ms, tz);
  return ms;
}
function validZone(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}
function formatWhen(ms, tz) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ms)).replace(/ at /, ", ");
}
function zoneName(ms, tz) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName");
  return part ? `${part.value}, ${tz.replace(/_/g, " ")}` : tz;
}

// ---------------------------------------------------------------- open times
const typeOf = (id) => cfg.types.find((t) => t.id === id);

async function openSlots(env, type, now = Date.now()) {
  const tz = cfg.timezone, step = cfg.slotMinutes * 60000, length = type.minutes * 60000;
  const earliest = now + cfg.noticeHours * 3600000;
  const starts = [];
  for (let i = 0; i <= cfg.daysAhead; i++) {
    // Noon UTC of each day, read in Htoo's zone, gives that day's date there.
    const at = new Date(now + i * DAY + zoneOffset(now + i * DAY, tz));
    const y = at.getUTCFullYear(), m = at.getUTCMonth() + 1, d = at.getUTCDate();
    for (const [from, to] of cfg.hours[WEEKDAYS[at.getUTCDay()]] || []) {
      const [fh, fm] = from.split(":").map(Number), [th, tm] = to.split(":").map(Number);
      const end = zonedTime(y, m, d, th, tm, tz);
      for (let s = zonedTime(y, m, d, fh, fm, tz); s + length <= end; s += step) if (s >= earliest) starts.push(s);
    }
  }
  if (!starts.length) return { starts, calendar: false };
  let busy = null;
  if (googleReady(env)) {
    try { busy = await freeBusy(env, starts[0], starts[starts.length - 1] + length); } catch (err) { console.error("freebusy failed:", err && err.message); }
  }
  const pad = (cfg.bufferMinutes || 0) * 60000;
  const free = busy ? starts.filter((s) => !busy.some(([a, b]) => s < b + pad && s + length > a - pad)) : starts;
  return { starts: free, calendar: !!busy };
}

async function slotsResponse(env, url) {
  const type = typeOf(url.searchParams.get("type"));
  if (!type) return json({ success: false, error: "Unknown meeting type" }, 400);
  const { starts, calendar } = await openSlots(env, type);
  return json({ success: true, timezone: cfg.timezone, minutes: type.minutes, calendar, slots: starts.map((s) => new Date(s).toISOString()) });
}

// ---------------------------------------------------------------- Google Calendar
const googleReady = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
const apiBase = (env) => env.GOOGLE_API_BASE || "https://www.googleapis.com";

async function googleToken(env) {
  const res = await fetch(env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  return (await res.json()).access_token;
}
async function google(env, method, path, body) {
  const res = await fetch(apiBase(env) + path, {
    method,
    headers: { authorization: `Bearer ${await googleToken(env)}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}
const calendars = (env) => (env.GOOGLE_CALENDAR_IDS || "primary").split(",").map((s) => s.trim()).filter(Boolean);

async function freeBusy(env, from, to) {
  const res = await google(env, "POST", "/calendar/v3/freeBusy", { timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), items: calendars(env).map((id) => ({ id })) });
  if (!res.ok) throw new Error(`Google freeBusy ${res.status}`);
  const data = await res.json();
  return Object.values(data.calendars || {}).flatMap((c) => (c.busy || []).map((b) => [Date.parse(b.start), Date.parse(b.end)]));
}

// Creates the event with a Meet link and invites the visitor. The event id
// comes from the request, so confirming twice finds the first event again.
async function createEvent(env, req, type, token) {
  const id = "hk" + (await sha256Hex(token)).slice(0, 40);
  const cal = encodeURIComponent(calendars(env)[0]);
  const body = {
    id,
    summary: `${type.name}: ${req.n} and Htoo Myat Kyaw`,
    description: `${type.name} (${type.minutes} minutes), booked on htoomyatkyaw.com.${req.o ? `\n\nNote from ${req.n}:\n${req.o}` : ""}`,
    start: { dateTime: new Date(req.s).toISOString() },
    end: { dateTime: new Date(req.s + type.minutes * 60000).toISOString() },
    attendees: [{ email: req.e, displayName: req.n }],
    conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    reminders: { useDefault: true },
  };
  let res = await google(env, "POST", `/calendar/v3/calendars/${cal}/events?conferenceDataVersion=1&sendUpdates=all`, body);
  let again = false;
  if (res.status === 409) { again = true; res = await google(env, "GET", `/calendar/v3/calendars/${cal}/events/${id}`); }
  if (!res.ok) throw new Error(`Google event ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const ev = await res.json();
  const meet = ev.hangoutLink || ((ev.conferenceData && ev.conferenceData.entryPoints) || []).map((p) => p.uri).find((u) => /^https:\/\/meet\.google\.com\//.test(u || "")) || "";
  return { meet, link: ev.htmlLink || "", again };
}

// ---------------------------------------------------------------- signed links
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function sha256Hex(s) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmacKey(env) {
  const secret = env.BOOKING_SECRET || env.RESEND_API_KEY || env.GOOGLE_CLIENT_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey("raw", enc.encode("booking:" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(env, payload) {
  const key = await hmacKey(env);
  if (!key) return null;
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return body + "." + b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body))));
}
async function verify(env, token) {
  const key = await hmacKey(env);
  const [body, mac] = String(token || "").split(".");
  if (!key || !body || !mac) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", key, fromB64url(mac), enc.encode(body)))) return null;
    return JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch { return null; }
}

// ---------------------------------------------------------------- a visitor asks
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);

async function requestMeeting(request, env, url, ctx, mail) {
  if (!mail.allowed(request, env, url)) return json({ success: false, error: "Forbidden" }, 403);
  if (env.CONTACT_RATE_LIMIT) {
    const { success } = await env.CONTACT_RATE_LIMIT.limit({ key: "book:" + (request.headers.get("cf-connecting-ip") || "unknown") });
    if (!success) return json({ success: false, error: "Too many requests. Please try again in a minute." }, 429);
  }
  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: "Could not read the request" }, 400); }
  if (!body || typeof body !== "object") return json({ success: false, error: "Could not read the request" }, 400);
  if (body.website) return json({ success: true }); // honeypot

  const type = typeOf(body.type);
  const start = Date.parse(body.start);
  const name = clean(body.name, 80).replace(/[\r\n]+/g, " "), email = clean(body.email, 200), note = clean(body.note, 1000);
  const tz = validZone(body.timezone) ? String(body.timezone).slice(0, 60) : cfg.timezone;
  if (!type || !Number.isFinite(start)) return json({ success: false, error: "Please pick a meeting type and a time." }, 400);
  if (!name) return json({ success: false, error: "Please add your name." }, 400);
  if (!/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(email)) return json({ success: false, error: "That email doesn't look right." }, 400);

  const { starts } = await openSlots(env, type);
  if (!starts.includes(start)) return json({ success: false, error: "That time was just taken. Please pick another.", taken: true }, 409);

  const req = { v: 1, t: type.id, s: start, n: name, e: email, o: note, z: tz, c: Date.now() };
  const token = await sign(env, req);
  if (!token) return json({ success: false, error: "Booking is not set up yet. Please use the form below." }, 503);
  const review = `${url.origin}/api/booking/review?t=${token}`;

  const sent = await mail.owner(env, "bookingOwner", {
    visitor_name: name, visitor_email: email, meeting_type: type.name, duration: String(type.minutes),
    when_owner: formatWhen(start, cfg.timezone), owner_zone: zoneName(start, cfg.timezone),
    when: formatWhen(start, tz), timezone: zoneName(start, tz),
    note_line: note ? `Their note: ${note}` : "", review_url: review,
  }, email);
  if (!sent) return json({ success: false, error: "Could not send the request. Please use the form below." }, 502);

  ctx.waitUntil(mail.visitor(env, "bookingRequest", email, visitorVars(req, type)));
  return json({ success: true });
}

function visitorVars(req, type, extra = {}) {
  const first = ((req.n.split(/\s+/)[0] || "").match(/^[\p{L}][\p{L}'-]{0,29}$/u) || ["there"])[0];
  return { first_name: first, meeting_type: type.name, duration: String(type.minutes), when: formatWhen(req.s, req.z), timezone: zoneName(req.s, req.z), ...extra };
}

// ---------------------------------------------------------------- Htoo reviews
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function page(title, color, inner) {
  const C = { cyan: ["#36c5f0", "#a4e5f8"], yellow: ["#ecb22e", "#f5dda1"], pink: ["#e01e5a", "#fabed1"], green: ["#2fbc81", "#a1dfc5"] }[color];
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Htoo Myat Kyaw</title>
<link rel="icon" href="/brand/favicon-dark.png">
<style>
@font-face{font-family:Flux;src:url(/_v2/framerusercontent.com/assets/fROf9QsA0Xgfcctq630ByO5kbg.woff2) format("woff2");font-weight:100 1000;font-display:swap}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:#f7f7f7;background-image:linear-gradient(rgba(17,18,18,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(17,18,18,.06) 1px,transparent 1px);background-size:50px 50px;color:#111212;font:500 16px/1.5 "Inter Display",Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
main{width:100%;max-width:560px;background:#fff;border:2px solid #111212}
header{padding:28px 24px 22px;background:${C[1]};border-bottom:2px solid #111212}
header small{font:500 13px/1 "DM Mono",ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.02em}
h1{margin:14px 0 0;font:1000 clamp(40px,11vw,64px)/.85 Flux,Impact,sans-serif;letter-spacing:-.02em;text-transform:uppercase}
section{padding:24px}
dl{margin:0 0 20px;display:grid;grid-template-columns:auto 1fr;gap:10px 18px}
dt{font:500 12px/1.9 "DM Mono",ui-monospace,Menlo,monospace;text-transform:uppercase;color:#767777}
dd{margin:0;overflow-wrap:anywhere}
p{margin:0 0 16px}
.note{padding:12px 14px;background:#f7f7f7;border-left:4px solid ${C[0]};white-space:pre-wrap;overflow-wrap:anywhere}
.status{padding:10px 12px;border:1.5px solid #111212;font-size:14.5px}
.status.ok{background:#a1dfc5}.status.warn{background:#fabed1}.status.off{background:#f5dda1}
.row{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
button,.btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border:2px solid #111212;background:#111212;color:#fff;font:500 15px/1 "DM Mono",ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.02em;text-decoration:none;cursor:pointer}
button.ghost,.btn.ghost{background:#fff;color:#111212}
button:active{transform:scale(.97)}
form{margin:0}
footer{display:flex;height:8px}footer i{flex:1}
a{color:inherit}
</style></head><body><main><header><small>htoomyatkyaw.com · meetings</small><h1>${esc(title)}</h1></header><section>${inner}</section><footer><i style="background:#36c5f0"></i><i style="background:#ecb22e"></i><i style="background:#e01e5a"></i><i style="background:#2fbc81"></i></footer></main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

function details(req, type) {
  return `<dl><dt>Who</dt><dd>${esc(req.n)}<br><a href="mailto:${esc(req.e)}">${esc(req.e)}</a></dd>
<dt>What</dt><dd>${esc(type.name)}, ${type.minutes} minutes</dd>
<dt>When</dt><dd>${esc(formatWhen(req.s, cfg.timezone))}<br><span style="color:#767777">${esc(zoneName(req.s, cfg.timezone))}</span></dd>
<dt>For them</dt><dd>${esc(formatWhen(req.s, req.z))}<br><span style="color:#767777">${esc(zoneName(req.s, req.z))}</span></dd></dl>
${req.o ? `<p class="note">${esc(req.o)}</p>` : ""}`;
}

async function reviewPage(env, url) {
  const token = url.searchParams.get("t");
  const req = await verify(env, token), type = req && typeOf(req.t);
  if (!req || !type) return page("Link not valid", "pink", "<p>This link is incomplete or has been changed. Open the newest request email and use its button.</p>");
  if (req.s < Date.now()) return page("Time passed", "yellow", details(req, type) + "<p>The time they asked for has already passed. Reply to their email to find a new one.</p>");

  let status = '<p class="status off">Google Calendar is not connected, so I could not check this time against your calendar.</p>';
  if (googleReady(env)) {
    try {
      const busy = await freeBusy(env, req.s, req.s + type.minutes * 60000);
      status = busy.length ? '<p class="status warn">Something is now on your calendar at this time. You can still confirm, or decline and let them pick again.</p>' : '<p class="status ok">Your calendar is free at this time.</p>';
    } catch { status = '<p class="status off">I could not reach Google Calendar just now.</p>'; }
  }
  const form = (action, label, cls) => `<form method="post" action="/api/booking/review"><input type="hidden" name="t" value="${esc(token)}"><input type="hidden" name="action" value="${action}"><button class="${cls}" type="submit">${label}</button></form>`;
  return page("Meeting request", "cyan", details(req, type) + status + `<div class="row">${form("confirm", "Confirm", "")}${form("decline", "Decline", "ghost")}</div>
<p style="margin:18px 0 0;font-size:14px;color:#767777">Confirm adds it to your calendar with a Google Meet link and emails ${esc(req.n.split(/\s+/)[0])} the confirmation. Decline emails them a link to pick another time.</p>`);
}

async function reviewAction(request, env, url, mail) {
  const form = await request.formData();
  const token = String(form.get("t") || ""), action = String(form.get("action") || "");
  const req = await verify(env, token), type = req && typeOf(req.t);
  if (!req || !type) return page("Link not valid", "pink", "<p>This link is incomplete or has been changed.</p>");
  if (req.s < Date.now()) return page("Time passed", "yellow", details(req, type) + "<p>The time they asked for has already passed.</p>");

  if (action === "decline") {
    const ok = await mail.visitor(env, "bookingDeclined", req.e, visitorVars(req, type));
    return page("Declined", "yellow", details(req, type) + (ok ? `<p>${esc(req.n)} has been emailed a link to pick another time.</p>` : `<p class="status warn">The email to ${esc(req.n)} did not send. Please write to them yourself.</p>`));
  }
  if (action !== "confirm") return page("Link not valid", "pink", "<p>Nothing was changed.</p>");

  let meet = env.MEET_LINK || "", eventLink = "", again = false, calendarNote = "";
  if (googleReady(env)) {
    try {
      const ev = await createEvent(env, req, type, token);
      meet = ev.meet || meet; eventLink = ev.link; again = ev.again;
    } catch (err) {
      console.error("event failed:", err && err.message);
      calendarNote = '<p class="status warn">Google Calendar did not accept the event, so it is not on your calendar. The confirmation email was still sent.</p>';
    }
  }
  const end = req.s + type.minutes * 60000, stamp = (ms) => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const addLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${type.name}: ${req.n}`)}&dates=${stamp(req.s)}/${stamp(end)}&add=${encodeURIComponent(req.e)}`;
  if (again) return page("Already confirmed", "green", details(req, type) + `<p>This meeting was confirmed earlier, so nothing was sent again.</p>${meet ? `<div class="row"><a class="btn" href="${esc(meet)}">Open Google Meet</a></div>` : ""}`);

  const ok = await mail.visitor(env, meet ? "bookingConfirmed" : "bookingConfirmedNoLink", req.e, visitorVars(req, type, { meet_url: meet }));
  return page("Confirmed", "green", details(req, type) + calendarNote
    + (ok ? `<p>${esc(req.n)} has been emailed the confirmation${meet ? " with the Google Meet link" : ""}.</p>` : `<p class="status warn">The confirmation email to ${esc(req.n)} did not send. Please write to them yourself.</p>`)
    + (eventLink ? "<p>It is on your calendar, and Google has sent them an invitation.</p>" : "")
    + `<div class="row">${meet ? `<a class="btn" href="${esc(meet)}">Open Google Meet</a>` : ""}${eventLink ? `<a class="btn ghost" href="${esc(eventLink)}">Open in Calendar</a>` : `<a class="btn ghost" href="${esc(addLink)}">Add to my calendar</a>`}</div>`);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
