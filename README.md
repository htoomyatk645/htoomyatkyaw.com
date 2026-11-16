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
| `tools/cms-edit.mjs` + `cms-edits.json` | Edits Framer's binary CMS data (case-study titles, taglines, tags, dates) and re-points the index files. `--list <chunk>` prints every field. |
| `tools/make-images.py` + `brand/` | Builds the site's portraits, case-study covers, logos, favicons and share image from the photos and Briefly logos in `brand/`. Each image keeps its template file name and aspect ratio, cropped around the subject. |
| `content/` | The Journal posts, case-study write-ups and the admissions survey, as Markdown and JSON. See "Journal, case studies and services" below. |
| `tools/build-content.mjs` | Builds `content/` into `site/` (`npm run content`). |
| `public/hk.css`, `public/hk.js` | Styles and behaviour for that content: scroll reveals, journal filters, the case-study canvas and the survey. |
| `tools/check-no-framer.mjs` | Fails if `site/` still references any Framer host. `npm run deploy` runs it first. |

## Workflow

```sh
npm install
npm run mirror            # crawl the Framer site into site/ (unmodified copy)
node tools/cms-edit.mjs   # case-study card data
node tools/og/render.mjs        # share image: tools/og/og.html -> brand/og.png (only when it changes)
python3 tools/make-images.py   # photos and logos from brand/
npm run rebrand           # apply tools/rebrand.json
npm run content           # journal, case studies, admissions survey (content/ -> site/)
npm run check             # no Framer URLs left
npm run dev &             # local Worker at http://localhost:8787
npm run compare           # screenshots + diffs in compare/
npm run deploy            # wrangler deploy
```

## Editing copy

Text lives in two places: the page HTML in `site/*.html` and the page's JS module under `site/_ext/framerusercontent.com/sites/…`. Add a `{ "find": …, "replace": … }` entry to `tools/rebrand.json` and run `npm run rebrand`. Run `node tools/rebrand.mjs --check` first to confirm each `find` string exists. Don't use backticks or `${` in replacement text (it ends up inside JS template literals).

The rebrand edits are not idempotent, so always apply them to an unmodified mirror (`git checkout <mirror commit> -- site`, then the steps above).

The case studies and journal posts come from Framer's CMS, stored in binary files (`site/_ext/framerusercontent.com/cms/*.framercms`); edit those with `tools/cms-edit.mjs`. Each page also embeds a snapshot of the same CMS values ("handover" data), which `rebrand.json` keeps in step.

## Journal, case studies and services

`/blog`, `/case-study`, `/services`, `/contact` and `/play-ground` are Framer pages with content added by `npm run content`. Each page keeps its nav, heading and footer; the script adds one block to the HTML and `hk.js` moves it into the layout once the page has loaded. Links to these three sections do a full page load (the site script in `tools/build-rebrand.py` handles that), because the added content is not part of the Framer bundle.

**Journal.** One Markdown file per post in `content/journal/`. The file name is the URL (`why-briefly-stays-audio.md` becomes `/blog/why-briefly-stays-audio`).

```
---
title: Why Briefly stays audio
date: 2026-11-16
category: building-briefly
summary: One or two sentences shown on the card and beside the post.
draft: true
---
Markdown: ## headings, lists, > quotes, **bold**, [links](https://…), and
:::note Label … ::: for a callout.
```

Posts with `draft: true` are left out of the site. Set it to `false` (or delete the line) and run `npm run content` to publish. `npm run content:drafts` builds drafts too, for a local look with `npm run dev`; run `npm run content` again before deploying. `[TODO: …]` marks a spot that still needs your own detail. Categories and the intro line are in `content/site.json`.

**Case studies.** One Markdown file per write-up in `content/case-studies/`, served at `/case-study/<file name>`. `example-canvas.md` is a draft that uses every block; copy it to start a new one. Put videos and images in `content/media/` (they are copied to `/media/`).

- `:::canvas Title` … `:::` is a board the visitor can drag, zoom and tour. Inside it, `frame: Label | /media/file.mp4 | 9:16` adds a video or image, and the lines after it belong to that frame: `text:` (the explanation shown under the board), `note: yellow | …` (a sticky note; yellow, pink, cyan or green) and `pin: 50,20 | …` (a numbered pin at 50% across, 20% down).
- `:::video /media/file.mp4` … `:::` is a single framed video with a caption. `:::image` does the same for a picture.
- `:::decision Label` and `:::learned Label` are coloured callouts.

The four cards on `/case-study` still open the standalone write-ups (the `LIVE` map in `tools/build-rebrand.py` and `src/worker.js`). To point a card at a new write-up instead, change its entry in both.

**Contact and Playground.** `npm run content` also adds a section under the contact form (message starters, what happens next, a Boston clock) and three small experiments under the Playground photo board. Their wording is in `content/site.json` under `contact` and `playground`.

**Services.** The four services, the process steps and the FAQ are Framer text, edited in `tools/build-rebrand.py`. The "Free college admissions help" section and its survey come from `content/services/admissions.json`: edit the copy and the `questions` list there. Answers are emailed through `/api/contact` with the subject "College admissions help request".

The template's own blog posts and case-study pages are removed from `site/` by `npm run content`, so `npm run compare` no longer has those pages to compare.

## Emails

`emails/templates.json` holds every email: who it is from, and for each template a subject, a heading word and colour, and the body. `npm run emails` (part of `npm run deploy`) builds:

- `emails/out/<id>.html` and `.txt`: each email as mail-safe HTML and plain text.
- `site/email/*.png`: the pixel-font headings as pictures (mail apps don't load web fonts), served from the live site.
- `emails/gallery.html`: a page to pick a template, fill in the `{{blanks}}` and copy it into Gmail.
- `src/auto-replies.js`: the two templates marked `"auto"`, which the Worker sends by itself.

**Automatic replies.** When someone uses the contact form or finishes the admissions survey, the Worker emails you as before and then sends that person a confirmation: `auto-contact` or `auto-admissions`. It adds their first name and, for the survey, the topics they picked. Nothing else they typed is repeated back. Replies to it go to the address in `AUTO_REPLY_REPLY_TO` (`wrangler.jsonc`).

Delivery to visitors needs one of these, set up once:

1. Cloudflare Email Sending switched on for `htoomyatkyaw.com` in the Cloudflare dashboard (Email section), so the `AUTO_REPLY` binding may send to any address. Email Routing alone only delivers to your own verified addresses.
2. Or a [Resend](https://resend.com) account with `htoomyatkyaw.com` verified, and its key saved with `npx wrangler secret put RESEND_API_KEY`. When that secret exists the Worker uses Resend.

Until one of them is in place the forms keep working and you still get every submission; the confirmation is skipped and `npx wrangler tail` shows "auto-reply failed".

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

## Copy vs. original

`npm run compare` was run against the unmodified mirror (before the rebrand) at 390px (phone) and 1440px (desktop). On both sides the clock is frozen, `Math.random` is seeded, and the page is captured one screen at a time, so animations land in the same state. `compare/*.png` shows original | copy | diff for each page. The full results are in `compare/report.json`.

38/38 pass (threshold: ≤ 0.5% of pixels differ, identical page height, no requests leaving the site). The largest difference, the home page on phone, comes from the template's continuously rotating sticker landing a fraction of a degree apart between captures.

| Page | Viewport | Pixels differing | Height (orig / copy) | Outside requests | Result |
| --- | --- | --- | --- | --- | --- |
| `/` | phone | 0.482% | 6053 / 6053 | 0 | pass |
| `/` | desktop | 0.148% | 7862 / 7862 | 0 | pass |
| `/about` | phone | 0.006% | 5655 / 5655 | 0 | pass |
| `/about` | desktop | 0.022% | 5887 / 5887 | 0 | pass |
| `/blog` | phone | 0.388% | 3984 / 3984 | 0 | pass |
| `/blog` | desktop | 0.147% | 3088 / 3088 | 0 | pass |
| `/blog/a-greener-workspace` | phone | 0.042% | 5263 / 5263 | 0 | pass |
| `/blog/a-greener-workspace` | desktop | 0.054% | 4866 / 4866 | 0 | pass |
| `/blog/beyond-the-screen` | phone | 0.055% | 5321 / 5321 | 0 | pass |
| `/blog/beyond-the-screen` | desktop | 0.019% | 4792 / 4792 | 0 | pass |
| `/blog/everyday-beauty` | phone | 0.039% | 5283 / 5283 | 0 | pass |
| `/blog/everyday-beauty` | desktop | 0.015% | 4773 / 4773 | 0 | pass |
| `/blog/geometry-builds-trust` | phone | 0.044% | 5292 / 5292 | 0 | pass |
| `/blog/geometry-builds-trust` | desktop | 0.017% | 4792 / 4792 | 0 | pass |
| `/blog/ideas-need-silence` | phone | 0.049% | 5370 / 5370 | 0 | pass |
| `/blog/ideas-need-silence` | desktop | 0.013% | 4907 / 4907 | 0 | pass |
| `/blog/materials-and-memory` | phone | 0.067% | 5262 / 5262 | 0 | pass |
| `/blog/materials-and-memory` | desktop | 0.057% | 4722 / 4722 | 0 | pass |
| `/blog/the-creative-desk` | phone | 0.382% | 5242 / 5242 | 0 | pass |
| `/blog/the-creative-desk` | desktop | 0.183% | 4699 / 4699 | 0 | pass |
| `/blog/the-power-of-focus` | phone | 0.154% | 5184 / 5184 | 0 | pass |
| `/blog/the-power-of-focus` | desktop | 0.046% | 4699 / 4699 | 0 | pass |
| `/case-study` | phone | 0.034% | 3418 / 3418 | 0 | pass |
| `/case-study` | desktop | 0.02% | 3445 / 3445 | 0 | pass |
| `/case-study/homestead` | phone | 0.125% | 9275 / 9275 | 0 | pass |
| `/case-study/homestead` | desktop | 0.087% | 11871 / 11871 | 0 | pass |
| `/case-study/meridian-health` | phone | 0.195% | 9330 / 9330 | 0 | pass |
| `/case-study/meridian-health` | desktop | 0.014% | 11996 / 11996 | 0 | pass |
| `/case-study/north-light` | phone | 0.049% | 8211 / 8211 | 0 | pass |
| `/case-study/north-light` | desktop | 0.005% | 10359 / 10359 | 0 | pass |
| `/case-study/stylebook` | phone | 0.062% | 8819 / 8819 | 0 | pass |
| `/case-study/stylebook` | desktop | 0.004% | 11051 / 11051 | 0 | pass |
| `/contact` | phone | 0% | 844 / 844 | 0 | pass |
| `/contact` | desktop | 0.004% | 900 / 900 | 0 | pass |
| `/play-ground` | phone | 0% | 844 / 844 | 0 | pass |
| `/play-ground` | desktop | 0% | 900 / 900 | 0 | pass |
| `/services` | phone | 0.015% | 10877 / 10877 | 0 | pass |
| `/services` | desktop | 0.015% | 10380 / 10380 | 0 | pass |
