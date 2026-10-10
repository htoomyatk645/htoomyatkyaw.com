# htoomyatkyaw.com

Portfolio site for Htoo Myat Kyaw. It runs on Cloudflare Workers (static assets plus a small Worker for the contact form). Nothing is loaded from Framer.

## Layout

| Path | What it is |
| --- | --- |
| `site/` | The built site that gets deployed: HTML, JS modules, fonts, images and videos. Mirrored assets live under `site/_ext/<original-host>/…`. |
| `public/` | Hand-written files that are copied into `site/` on every mirror (`contact-bridge.js`, `_headers`, `robots.txt`). |
| `src/worker.js` | Serves `site/`, and handles `POST /api/contact` and `POST /api/forms/*` by emailing the submission to `htoo.m.kyaw645@gmail.com`. It also answers the `?range=` byte-range requests that Framer's CMS client makes for `*.framercms` files. |
| `wrangler.jsonc` | Worker config: custom domains, the email binding and the rate limit. |
| `tools/mirror.mjs` | Crawls the Framer site, downloads every asset and rewrites the URLs to local paths. |
| `tools/rebrand.mjs` + `rebrand.json` | Find/replace copy changes, applied to both the page HTML and the JS modules (the two must match or React swaps the old text back in on load). It also handles headings that are server-rendered one `<span>` per character. An entry can be limited to certain files with `"only"`. |
| `tools/compare.mjs` | Takes side-by-side screenshots of the original and the copy at 390px and 1440px, pixel-diffs them, and flags any request that leaves the site. |
| `tools/check-no-framer.sh` | Fails if `site/` still references any Framer host. `npm run deploy` runs it first. |

## Workflow

```sh
npm install
npm run mirror            # crawl the Framer site into site/
npm run rebrand           # apply tools/rebrand.json
npm run check             # no Framer URLs left
npm run dev &             # local Worker at http://localhost:8787
npm run compare           # screenshots + diffs in compare/
npm run deploy            # wrangler deploy
```

## Editing copy

Text lives in two places: the page HTML in `site/*.html` and the page's JS module under `site/_ext/framerusercontent.com/sites/…`. Add a `{ "find": …, "replace": … }` entry to `tools/rebrand.json` and run `npm run rebrand`. Run `node tools/rebrand.mjs --check` first to confirm each `find` string exists. Don't use backticks or `${` in replacement text (it ends up inside JS template literals).

The case studies and journal posts come from Framer's CMS, which is stored in binary files (`site/_ext/framerusercontent.com/cms/*.framercms`). The find/replace tool can't safely edit them.

## Contact form

The mirrored Framer form (Message, then Email) posts multipart form data to Framer's forms API. The mirror rewrites that URL to `/api/forms/…`, and `public/contact-bridge.js` also catches any form request that was missed. The Worker checks the request (allowed origin, honeypot fields including the hidden ones Framer's form adds, 32 KB size limit, 5 requests per minute per IP) and strips Framer's `__framer_*` bot-check fields. It then sends a plain-text email through Cloudflare Email Routing:

- From: `contact@htoomyatkyaw.com`
- To: `htoo.m.kyaw645@gmail.com` (fixed by the binding, so the form can't be used to email anyone else)
- Reply-To: the visitor's email address, so you can answer straight from your inbox

### One-time Cloudflare setup

1. Add `htoomyatkyaw.com` to your Cloudflare account and point the registrar's nameservers at Cloudflare.
2. Open **Email → Email Routing** and click **Enable**. Cloudflare adds the MX/SPF/DKIM records.
3. Under **Destination addresses**, add `htoo.m.kyaw645@gmail.com` and click the link in the verification email.
4. Run `npx wrangler login`, then `npm run deploy`. The `routes` in `wrangler.jsonc` attach `htoomyatkyaw.com` and `www.htoomyatkyaw.com` as custom domains.
5. Send a test message:

   ```sh
   curl -X POST https://htoomyatkyaw.com/api/contact \
     -H 'content-type: application/json' \
     -d '{"name":"Test","email":"you@example.com","message":"Hello from the contact form"}'
   ```

   It should return `{"success":true}` and the email should arrive in your inbox. Watch the Worker logs with `npx wrangler tail`.
