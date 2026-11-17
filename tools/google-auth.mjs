#!/usr/bin/env node
// Connect the booking section on the Contact page to your Google Calendar.
//
//   npm run google-auth
//
// Run it once, on your own computer. It asks for the OAuth client ID and
// secret you created in Google Cloud (README, "Booking"), opens Google's
// sign-in page, and then saves three secrets on the Worker with
// `wrangler secret put`: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
// GOOGLE_REFRESH_TOKEN. Nothing is written to a file or printed.

import http from "node:http";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/`;
// Read busy times, and create the meeting events. Nothing else.
const SCOPES = ["https://www.googleapis.com/auth/calendar.freebusy", "https://www.googleapis.com/auth/calendar.events"];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const clientId = (await rl.question("OAuth client ID: ")).trim();
const clientSecret = (await rl.question("OAuth client secret: ")).trim();
rl.close();
if (!clientId || !clientSecret) { console.error("Both values are needed."); process.exit(1); }

const state = crypto.randomUUID();
const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: clientId, redirect_uri: REDIRECT, response_type: "code", scope: SCOPES.join(" "),
  access_type: "offline", prompt: "consent", state,
});

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, REDIRECT);
    if (u.pathname !== "/") { res.writeHead(404).end(); return; }
    const ok = u.searchParams.get("state") === state && u.searchParams.get("code");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<body style="font:16px system-ui;padding:40px">${ok ? "Connected. You can close this tab and go back to the terminal." : "That did not work: " + (u.searchParams.get("error") || "missing code")}</body>`);
    server.close();
    ok ? resolve(u.searchParams.get("code")) : reject(new Error(u.searchParams.get("error") || "no code returned"));
  }).listen(PORT, "127.0.0.1", () => {
    console.log("\nOpen this address in your browser and sign in with the Google account whose calendar you use:\n\n" + auth + "\n");
  });
});

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
});
const tokens = await res.json();
if (!res.ok || !tokens.refresh_token) { console.error("Google did not return a refresh token:", tokens.error_description || tokens.error || res.status); process.exit(1); }

for (const [name, value] of [["GOOGLE_CLIENT_ID", clientId], ["GOOGLE_CLIENT_SECRET", clientSecret], ["GOOGLE_REFRESH_TOKEN", tokens.refresh_token]]) {
  const put = spawnSync("npx", ["wrangler", "secret", "put", name], { input: value, stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" });
  if (put.status !== 0) { console.error(`Could not save ${name}.`); process.exit(1); }
}
console.log("\nDone. The booking section now reads your calendar and creates Google Meet links.");
