# nikosninosg.github.io

Personal CV and portfolio of **Nikos Georgopoulos Ninos**: <https://nikosninosg.github.io>

The site is plain HTML, CSS and vanilla JavaScript (no frameworks, no runtime dependencies).
The HTML is **generated** from JSON content by a tiny zero-dependency Node script and committed,
so GitHub Pages simply serves the files from the `main` branch root.

## Structure

```
index.html about.html experience.html projects.html contact.html 404.html   generated pages
projects/<slug>.html                                                        generated, one per project
projects/ai/bi-in-a-box.html                                                generated redirect stub for an old URL
sitemap.xml robots.txt .nojekyll                                            generated / static
content/                  <- the ONLY place you edit text
  site.json               name, tagline, socials, about text, soft skills, stats, SEO, analytics ids, form endpoints
  experience.json         work history (newest first)
  education.json          degrees
  certificates.json       certificates
  skills.json             skill groups (Languages / Technologies / Libraries)
  testimonials.json       quotes
  projects/<slug>.json    one file per project
src/
  build.mjs               generator entry point (build, --check, --watch, --serve, --clean-stale)
  lib/html.mjs            html`` template tag (escapes everything), raw(), helpers (+ html.test.mjs)
  lib/content.mjs         loads + validates content, derives stats / categories / palette data
  lib/layout.mjs          <head>, header, footer, command palette, page shell
  lib/icons.mjs           inline SVG icon set
  lib/imagesize.mjs       PNG/JPEG header reader (og:image width/height)
  pages/*.mjs             one renderer per page (home, about, experience, projects, project, contact, notfound)
  COMPONENTS.md           markup / JS hooks / CSS class contract between pages, CSS and scripts
assets/
  css/                    tokens.css, base.css, components.css, modules/*.css, pages/*.css
  js/                     main.js (shared entry), modules/*.js (features), pages/*.js (per page)
  img/                    images (portfolio screenshots, portrait, icons, social card)
```

Never edit the generated `.html`, `sitemap.xml` or `robots.txt` by hand: the next build overwrites them.

## Editing content

Open the relevant file in `content/` and change the text. All strings are plain text (no HTML).
Paragraphs are arrays of strings. Icon names (`"icon": "shield"`) must exist in `src/lib/icons.mjs`
(run the build; it names the exact file and JSON path if something is wrong).

Then rebuild:

```sh
node src/build.mjs
```

Every file in `content/` may carry a `_notes` array: it records what was changed relative to the old site and is never rendered.

Stats on the home page (`site.json` -> `stats`) can be automatic: `"auto:projects"`, `"auto:technologies"`
(distinct entries in `skills.json`), `"auto:certificates"`, or a plain number such as `3`.

## Adding a project

1. Copy any `content/projects/*.json` to `content/projects/<new-slug>.json`.
2. Set `slug` to the file name (lower-case, hyphens). Fill in `title`, `client`, `summary` (max ~170 characters),
   `description` (array of paragraphs), `contributions`, `technologies`, `links`.
3. `categories`: one or more of `ai`, `telecom`, `web`, `simulation` (the first one is the primary).
4. Put images under `assets/img/portfolio/...` and reference them relative to the repo root:
   `cover: {"src": "assets/img/portfolio/web/foo/foo.jpg", "alt": "…"}`, optional `gallery: [{src, alt, caption}]`.
5. `order` controls sorting, `featured: true` shows it on the home page, `legacyPaths` creates redirects from old URLs.
6. Run `node src/build.mjs`. The project page, card in the grid, command-palette entry, prev/next links and
   sitemap entry are created automatically.

## Build, preview, check

Requires Node 18+ (developed on Node 24). No `npm install` needed.

```sh
node src/build.mjs                  # build everything into the repo root
node src/build.mjs --check          # exit 1 if committed output differs from the sources (use before committing)
node src/build.mjs --watch          # rebuild on changes in content/ and src/
node src/build.mjs --serve [port]   # build + watch + local server (default http://127.0.0.1:4000)
node src/build.mjs --clean-stale    # list generated pages that are no longer produced (add --delete to remove)
node src/lib/html.test.mjs          # unit tests for the escaping helpers
```

The same commands are available as `npm run build | check | watch | dev | stale | test`.
Output is deterministic (no timestamps), which is what makes `--check` reliable. The footer year is pinned by
`copyrightYear` in `content/site.json` (bump it yearly; `SITE_BUILD_YEAR` overrides it, and the current year is
only used when neither is set).

## Deployment

GitHub Pages serves the repository root of `main` directly: there is no CI build.
Workflow: edit `content/` (or `src/`, `assets/`), run `node src/build.mjs`, commit **both** the sources and
the regenerated HTML, push. `.nojekyll` stops Pages from running Jekyll over the repo, and `404.html` is used
automatically for unknown URLs (it uses root-absolute asset URLs so it works at any depth).

## Design tokens

All colours, spacing, type scale, radii, shadows, easing and z-index values are CSS custom properties defined in
`assets/css/tokens.css` (dark theme by default; `html[data-theme="light"]` overrides them). Fonts: Inter (body),
Space Grotesk (headings), JetBrains Mono (labels). Accent gradient: teal `#2de2c6` to green `#18d26e`, violet
`#8b7cff` as a rare secondary. Motion uses `cubic-bezier(.2,.8,.2,1)` at 160/280/560 ms and is fully disabled
under `prefers-reduced-motion`. Change a token once and every page follows.
The class names and `data-*` hooks that tie markup, CSS and JS together are documented in `src/COMPONENTS.md`.

## Behaviour notes

* Shared scripts live in `assets/js/modules/` and are loaded by `assets/js/main.js` (`reveal.js` exports `init`, `refresh(scope)` and `countUp(el)`).
* Theme toggle: click switches dark/light; Shift-click or Alt-click returns to "follow system". The inline head script sets `data-theme` before first paint.
* Command palette: `Ctrl/Cmd+K` or `/`. Header: hides on scroll down (opt out with `data-hide-on-scroll="false"`), optional `[data-spy]` scroll-spy.
* Everything is readable without JS; reveal animations only hide content under `html.js.reveal-ready`.

## Privacy and external requests

The only third-party requests are Google Fonts, Google Tag Manager / GA4 (ids in `content/site.json`) and the
contact form endpoint (formsubmit.co). Theme preference is stored in `localStorage` under the key `theme`.

## Content schema (additions, October 2026 CV update)

* `site.json`: `cv` block `{href, label, format, updated}` (the build fails if `href` does not exist; `ctx.cv.sizeKB` is computed from the real file). The Birthday fact, the Customers stat and the Fiverr/Upwork socials were removed. Do not add phone numbers or birth dates anywhere.
* `experience.json`: optional `kind` (`"work"` default, or `"volunteering"`).
* `engagements.json` (new): `[{id, title, client, country?, period, start:"YYYY-MM", end:"YYYY-MM"|"present", summary, technologies?}]`, newest first by `start` (validated).
* `languages.json` (new): `[{language, level, details?:[string]}]`.
* `certificates.json`: optional `hours` string (e.g. `"80 hours"`).
* `testimonials.json`: optional `company` and `url` (absolute).
* `skills.json`: four groups (Languages, Technologies, Libraries, Workflow & testing); items `{name, url?}`.
* `projects/<slug>.json`: optional `period` string (e.g. `"2024 – 2025"`); new category `iot` (label "IoT", after `web`).
* Command palette: action `download-cv` `{action:'open', url:<cv href>, download:true, hint:'PDF · NN KB'}`.

`ctx` exposes: `cv`, `engagements`, `languages`, `experience` (each entry has `kind`), plus the existing fields.

## Analytics consent

Google Tag Manager / GA4 (IDs in `content/site.json` -> `analytics`) load **only after the visitor accepts**.
`src/lib/layout.mjs` (`analyticsHead`) emits a tiny inline loader: it sets Google Consent Mode v2 defaults to
`denied` and defines `window.loadAnalytics()`, which sends `consent update -> granted` and then injects `gtm.js` and
`gtag.js`. It runs at page load only when `localStorage.consent === 'granted'`. The GTM `<noscript><iframe>` is
deliberately not emitted (it would load GTM without consent).
`assets/js/modules/consent.js` + `assets/css/modules/consent.css` render the non-modal banner (Accept and Decline have
equal weight; privacy details and data controller in a `<details>`). The choice is stored in `localStorage.consent`
(`granted` / `denied`). The footer "Cookie settings" button and the command-palette action reopen the banner;
Decline sends `consent update -> denied`, sets `ga-disable-<id>` and best-effort expires `_ga*` cookies.
The copy lives in `renderConsent()` in `layout.mjs`.

## Favicon and icons

`assets/img/icon.svg` is the brand mark (rounded square, teal-to-green gradient, "N" as a four-node graph, heavier than
the header version so it stays crisp at 16 px). `icon-32/192/512.png`, `apple-touch-icon-180.png` (opaque, padded) and
`favicon.ico` (32 px PNG inside an ICO) are rendered from it with headless Chrome; to change the design edit the SVG
and re-render at those sizes.

## CV download

The header "CV" pill, the mobile-menu item, the footer link, the About/Home buttons and the palette action all read
`ctx.cv` (from `content/site.json` -> `cv`). To replace the CV, overwrite the PDF at `cv.href`, update `cv.updated`
and run `node src/build.mjs` (the size shown is computed from the file).

## CI

`.github/workflows/ci.yml` runs on push and pull requests to `main`: `node src/lib/html.test.mjs`,
`node src/build.mjs --check` (fails when generated HTML is stale) and `node src/check-links.mjs` (zero-dependency
checker: local href/src/srcset/meta-refresh targets and `#fragment` ids must exist). `npm run check` runs the last two locally.
