// Invite links: a time Htoo has already agreed with someone, sent as a link.
//
//   GET  /api/booking/owner          is this browser signed in?
//   POST /api/booking/owner          the access code from the profile-photo
//                                    prompt; signs this browser in
//   GET  /api/booking/invite         Htoo's tool: pick a meeting type, day and
//   POST /api/booking/invite         time, get a link (sign in, create, sign out)
//   GET  /meet/<code>                the guest's page: the agreed time and a
//   POST /meet                       form for their name and email
//                                    (/meet?i=<token> is the older, longer form
//                                    of the same link and still works)
//
// The guest's details go through the same review step as a normal booking:
// Htoo gets the "Meeting request" email, presses Confirm, and the guest gets
// the confirmation with the Meet link. An invite skips the open-hours check,
// because the time was agreed directly.
//
// Only Htoo can make links. The tool asks for the access code, which is the
// Worker secret BOOKING_ADMIN_KEY (never in this repository), and then keeps
// the browser signed in for 30 days with an HttpOnly cookie. Nothing is
// stored: invite links and the cookie are signed, so they cannot be forged.
//
// A link's code is 14 characters: 10 bytes, base64url. Byte 0 is the meeting
// type, bytes 1-3 the start in minutes since 2026-01-01 UTC, and bytes 4-9 the
// first six bytes of an HMAC over those four.

import { booking as cfg } from "./booking-config.js";
import { clean, esc, formatWhen, hmacKey, json, page as basePage, sign, typeOf, validZone, verify, visitorVars, zonedTime, zoneName } from "./booking.js";

const COOKIE = "hk_owner";
// "same-origin" rather than the review page's "no-referrer": with no referrer
// at all, browsers send "Origin: null" on form posts and the origin check fails.
const page = (title, color, inner, extra = "", headers = {}) => basePage(title, color, inner, extra, { "referrer-policy": "same-origin", ...headers });
const SESSION_DAYS = 30;
const enc = new TextEncoder();

export async function handleInvite(request, env, url, ctx, mail, path) {
  const m = request.method;
  if (path === "/api/booking/owner" && m === "GET") return json({ owner: await isOwner(request, env) });
  if (path === "/api/booking/owner" && m === "POST") return ownerLogin(request, env, url, mail);
  if (path === "/api/booking/invite" && (m === "GET" || m === "POST")) return inviteTool(request, env, url, mail);
  if (path === "/meet" && m === "GET") return guestPage(env, url.searchParams.get("i"));
  if (path.startsWith("/meet/") && m === "GET") return guestPage(env, decodeURIComponent(path.slice(6)));
  if (path === "/meet" && m === "POST") return guestSubmit(request, env, url, ctx, mail);
  return null;
}

// ---------------------------------------------------------------- owner sign-in
async function codeMatches(env, code) {
  if (!env.BOOKING_ADMIN_KEY || !code) return false;
  // Compare digests, so the time taken says nothing about the code.
  const key = await crypto.subtle.importKey("raw", enc.encode("owner-code"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const d = async (s) => new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(String(s))));
  const [a, b] = await Promise.all([d(code), d(env.BOOKING_ADMIN_KEY)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function limited(request, env) {
  if (!env.CONTACT_RATE_LIMIT) return false;
  const { success } = await env.CONTACT_RATE_LIMIT.limit({ key: "owner:" + (request.headers.get("cf-connecting-ip") || "unknown") });
  return !success;
}

async function sessionCookie(env, url) {
  const token = await sign(env, { k: "owner", x: Date.now() + SESSION_DAYS * 86400000 }, "owner");
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}
const signOutCookie = (url) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}`;

async function isOwner(request, env) {
  const raw = (request.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return false;
  const s = await verify(env, raw.slice(COOKIE.length + 1), "owner");
  return !!(s && s.k === "owner" && s.x > Date.now());
}

// From the prompt that opens when Htoo clicks the profile photo in the nav.
async function ownerLogin(request, env, url, mail) {
  if (!mail.allowed(request, env, url)) return json({ success: false, error: "Forbidden" }, 403);
  if (!env.BOOKING_ADMIN_KEY) return json({ success: false, error: "The access code is not set up yet." }, 503);
  if (await limited(request, env)) return json({ success: false, error: "Too many tries. Wait a minute." }, 429);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (!(await codeMatches(env, clean(body && body.code, 100)))) return json({ success: false, error: "That code is not right." }, 401);
  return new Response(JSON.stringify({ success: true, url: "/api/booking/invite" }), {
    headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": await sessionCookie(env, url) },
  });
}

// ---------------------------------------------------------------- Htoo's tool
function codeForm(error = "") {
  return `${error ? `<p class="status warn">${esc(error)}</p>` : ""}<p>Enter your access code to make invite links.</p>
<form method="post" action="/api/booking/invite"><input type="hidden" name="action" value="login">
<label>Access code<input name="code" type="password" inputmode="numeric" autocomplete="current-password" required autofocus></label>
<div class="row"><button type="submit">Open</button></div></form>`;
}

function todayIn(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Yangon", "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

function createForm(v = {}) {
  const type = v.type || "hello", zone = v.zone || cfg.timezone;
  const options = cfg.types.map((t) => `<option value="${esc(t.id)}"${t.id === type ? " selected" : ""}>${esc(t.name)} (${t.minutes} min)</option>`).join("");
  return `<form method="post" action="/api/booking/invite"><input type="hidden" name="action" value="create">
<label>Meeting<select name="type">${options}</select></label>
<div class="pair"><label>Day<input name="date" type="date" min="${todayIn(zone)}" value="${esc(v.date || "")}" required></label>
<label>Time<input name="time" type="time" step="300" value="${esc(v.time || "")}" required></label></div>
<label>Time zone of that time<input name="zone" list="zones" value="${esc(zone)}" required></label>
<datalist id="zones">${ZONES.map((z) => `<option value="${z}">`).join("")}</datalist>
<div class="row"><button type="submit">Create link</button></div></form>
<form method="post" action="/api/booking/invite" style="margin-top:18px"><input type="hidden" name="action" value="logout"><button class="link" type="submit">Sign out of this browser</button></form>`;
}

const copyScript = `<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-copy]");if(!b)return;var i=document.getElementById(b.dataset.copy);i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).catch(function(){document.execCommand("copy")});b.textContent="Copied";setTimeout(function(){b.textContent="Copy link"},1600)});</script>`;

async function inviteTool(request, env, url, mail) {
  if (!env.BOOKING_ADMIN_KEY) return page("Not set up", "yellow", "<p>Set the access code first: <code>npx wrangler secret put BOOKING_ADMIN_KEY</code>, then deploy.</p>");
  const owner = await isOwner(request, env);

  if (request.method === "GET") return owner ? page("Invite link", "cyan", createForm()) : page("Owner only", "pink", codeForm());

  if (!mail.allowed(request, env, url)) return page("Not allowed", "pink", "<p>That request came from another site.</p>");
  const form = await request.formData();
  const action = String(form.get("action") || "");

  if (action === "login") {
    if (await limited(request, env)) return page("Owner only", "pink", codeForm("Too many tries. Wait a minute."));
    if (!(await codeMatches(env, clean(form.get("code"), 100)))) return page("Owner only", "pink", codeForm("That code is not right."));
    return page("Invite link", "cyan", createForm(), "", { "set-cookie": await sessionCookie(env, url) });
  }
  if (action === "logout") return page("Signed out", "yellow", '<p>This browser is signed out. Click your profile photo on the site to sign in again.</p><div class="row"><a class="btn" href="/">Back to the site</a></div>', "", { "set-cookie": signOutCookie(url) });
  if (!owner) return page("Owner only", "pink", codeForm());
  if (action !== "create") return page("Invite link", "cyan", createForm());

  const v = { type: String(form.get("type") || ""), date: String(form.get("date") || ""), time: String(form.get("time") || ""), zone: clean(form.get("zone"), 60) };
  const type = typeOf(v.type);
  const d = v.date.match(/^(\d{4})-(\d{2})-(\d{2})$/), t = v.time.match(/^(\d{2}):(\d{2})/);
  const fail = (msg) => page("Invite link", "cyan", `<p class="status warn">${esc(msg)}</p>` + createForm(v));
  if (!type) return fail("Pick a meeting type.");
  if (!validZone(v.zone)) return fail("That time zone is not one I know. Use a name like America/New_York.");
  if (!d || !t) return fail("Pick a day and a time.");
  const start = zonedTime(+d[1], +d[2], +d[3], +t[1], +t[2], v.zone);
  if (!(start > Date.now())) return fail("That time has already passed.");

  const code = await shortCode(env, type, start);
  if (!code) return fail(start >= EPOCH + 0xffffff * 60000 ? "That date is too far ahead." : "Signing is not set up (BOOKING_SECRET is missing).");
  const link = `${url.origin}/meet/${code}`;

  const result = `<p class="status ok">Link ready. Send it to them; it works until the meeting time.</p>
<dl><dt>What</dt><dd>${esc(type.name)}, ${type.minutes} minutes</dd>
<dt>When</dt><dd>${esc(formatWhen(start, cfg.timezone))}<br><span class="muted">${esc(zoneName(start, cfg.timezone))}</span></dd>
${v.zone !== cfg.timezone ? `<dt>For them</dt><dd>${esc(formatWhen(start, v.zone))}<br><span class="muted">${esc(zoneName(start, v.zone))}</span></dd>` : ""}</dl>
<label>Link<input id="invite-link" readonly value="${esc(link)}" onfocus="this.select()"></label>
<div class="row"><button type="button" data-copy="invite-link">Copy link</button><a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Preview</a></div>
<hr><p class="muted">Make another</p>`;
  return page("Invite link", "green", result + createForm({ type: v.type, zone: v.zone }), copyScript);
}

// ---------------------------------------------------------------- the guest
const EPOCH = Date.UTC(2026, 0, 1);
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function mac6(env, bytes) {
  const key = await hmacKey(env, "invite");
  return key && new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes)).slice(0, 6);
}
async function shortCode(env, type, start) {
  const n = Math.round((start - EPOCH) / 60000), t = cfg.types.indexOf(type);
  if (n < 0 || n > 0xffffff || t < 0 || t > 255) return null;
  const body = new Uint8Array([t, n >> 16, (n >> 8) & 255, n & 255]), mac = await mac6(env, body);
  return mac && b64url([...body, ...mac]);
}
async function readShort(env, code) {
  if (!/^[A-Za-z0-9_-]{14}$/.test(code || "")) return null;
  const bytes = Uint8Array.from(atob(code.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const mac = await mac6(env, bytes.slice(0, 4));
  if (!mac) return null;
  let diff = 0;
  for (let i = 0; i < 6; i++) diff |= mac[i] ^ bytes[4 + i];
  const type = cfg.types[bytes[0]];
  if (diff || !type) return null;
  return { k: "invite", t: type.id, s: EPOCH + ((bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) * 60000, z: cfg.timezone };
}

async function readInvite(env, token) {
  const inv = String(token || "").includes(".") ? await verify(env, token, "invite") : await readShort(env, token);
  const type = inv && inv.k === "invite" && typeOf(inv.t);
  return type ? { inv, type } : null;
}

const localScript = (ms) => `<script>(function(){var z;try{z=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}if(!z)return;var f=document.querySelector("input[name=tz]");if(f)f.value=z;var el=document.getElementById("local");if(!el)return;var d=new Date(${ms});var w=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"}).format(d).replace(/ at /,", ");var n=(new Intl.DateTimeFormat("en-US",{timeZoneName:"short"}).formatToParts(d).find(function(p){return p.type==="timeZoneName"})||{}).value;el.innerHTML="";el.appendChild(document.createTextNode(w));var s=document.createElement("span");s.className="muted";s.style.display="block";s.textContent=(n?n+", ":"")+z.replace(/_/g," ")+" (your time)";el.appendChild(s)})();</script>`;

function guestForm(token, inv, type, v = {}, error = "") {
  const first = (inv.n || "").split(/\s+/)[0];
  return `${error ? `<p class="status warn">${esc(error)}</p>` : ""}<p>Hi ${first ? esc(first) : "there"}, this is the time we agreed on. Add your details and I'll send the confirmation with a Google Meet link.</p>
<dl><dt>What</dt><dd>${esc(type.name)}, ${type.minutes} minutes</dd>
<dt>When</dt><dd id="local">${esc(formatWhen(inv.s, inv.z))}<span class="muted" style="display:block">${esc(zoneName(inv.s, inv.z))}</span></dd>
<dt>With</dt><dd>Htoo Myat Kyaw</dd></dl>
<form method="post" action="/meet"><input type="hidden" name="i" value="${esc(token)}"><input type="hidden" name="tz" value="${esc(inv.z)}">
<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<label>Your name<input name="name" maxlength="80" autocomplete="name" value="${esc(v.name ?? inv.n ?? "")}" required></label>
<label>Your email<input name="email" type="email" maxlength="200" autocomplete="email" value="${esc(v.email || "")}" required></label>
<label>Anything I should know? (optional)<textarea name="note" maxlength="1000">${esc(v.note || "")}</textarea></label>
<div class="row"><button type="submit">Request this time</button></div></form>`;
}

async function guestPage(env, token) {
  const got = await readInvite(env, token);
  if (!got) return page("Link not valid", "pink", "<p>This link is incomplete or has been changed. Please ask me for a new one.</p>");
  const { inv, type } = got;
  if (inv.s < Date.now()) return page("Time passed", "yellow", '<p>The time on this link has already passed. Reply to me to find a new one, or <a href="/contact">book another time</a>.</p>');
  return page(type.name, "cyan", guestForm(token, inv, type), localScript(inv.s));
}

async function guestSubmit(request, env, url, ctx, mail) {
  if (!mail.allowed(request, env, url)) return page("Not allowed", "pink", "<p>That request came from another site.</p>");
  if (env.CONTACT_RATE_LIMIT) {
    const { success } = await env.CONTACT_RATE_LIMIT.limit({ key: "book:" + (request.headers.get("cf-connecting-ip") || "unknown") });
    if (!success) return page("Slow down", "yellow", "<p>Too many requests. Please go back and try again in a minute.</p>");
  }
  const form = await request.formData();
  const token = String(form.get("i") || "");
  const got = await readInvite(env, token);
  if (!got) return page("Link not valid", "pink", "<p>This link is incomplete or has been changed. Please ask me for a new one.</p>");
  const { inv, type } = got;
  if (inv.s < Date.now()) return page("Time passed", "yellow", "<p>The time on this link has already passed. Reply to me to find a new one.</p>");
  if (form.get("website")) return page("Request sent", "green", "<p>Thank you. You'll get an email soon.</p>"); // honeypot

  const v = { name: clean(form.get("name"), 80).replace(/[\r\n]+/g, " "), email: clean(form.get("email"), 200), note: clean(form.get("note"), 1000) };
  const tz = validZone(form.get("tz")) ? String(form.get("tz")).slice(0, 60) : inv.z;
  const again = (msg) => page(type.name, "cyan", guestForm(token, inv, type, v, msg), localScript(inv.s));
  if (!v.name) return again("Please add your name.");
  if (!/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(v.email)) return again("That email doesn't look right.");

  const req = { v: 1, t: type.id, s: inv.s, n: v.name, e: v.email, o: v.note, z: tz, c: Date.now(), i: 1 };
  const review = await sign(env, req);
  if (!review) return again("Booking is not set up yet. Please email me instead.");

  const sent = await mail.owner(env, "bookingOwner", {
    visitor_name: v.name, visitor_email: v.email, meeting_type: type.name, duration: String(type.minutes),
    when_owner: formatWhen(inv.s, cfg.timezone), owner_zone: zoneName(inv.s, cfg.timezone),
    when: formatWhen(inv.s, tz), timezone: zoneName(inv.s, tz),
    note_line: `Booked through your invite link, for the time you agreed.${v.note ? ` Their note: ${v.note}` : ""}`,
    review_url: `${url.origin}/api/booking/review?t=${review}`,
  }, v.email);
  if (!sent) return again("The request did not go through. Please try again, or email me directly.");

  ctx.waitUntil(mail.visitor(env, "bookingRequest", v.email, visitorVars(req, type)));
  return page("Request sent", "green", `<dl><dt>What</dt><dd>${esc(type.name)}, ${type.minutes} minutes</dd>
<dt>When</dt><dd>${esc(formatWhen(inv.s, tz))}<span class="muted" style="display:block">${esc(zoneName(inv.s, tz))}</span></dd></dl>`
    + `<p>Thanks, ${esc(v.name.split(/\s+/)[0])}. I'll confirm shortly, and you'll get an email at ${esc(v.email)} with the Google Meet link.</p>`);
}
