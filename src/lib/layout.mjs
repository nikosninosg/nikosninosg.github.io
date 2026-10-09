/**
 * Page shell: <head>, header, footer, command-palette dialog, scripts.
 * The markup produced here is the contract documented in src/COMPONENTS.md.
 *
 * Every URL emitted anywhere goes through pageCtx.url(path), which prefixes the
 * per-page `base` ('' for root pages, '../' for /projects/*, '/' for 404.html which
 * can be served from any depth on GitHub Pages). Do not rely on <base>.
 */
import { html, raw, json, jsLiteral, joinUrl } from './html.mjs';
import { icon } from './icons.mjs';
import { imageSize } from './imagesize.mjs';

/**
 * Brand mark: an "N" drawn as a tiny network graph (four nodes joined by the strokes of the letter).
 * Pure SVG (no text), so it never depends on a font. Animated on .brand:hover via CSS (components.css).
 */
const BRAND_MARK = raw(`<svg class="brand__glyph" viewBox="0 0 40 40" width="40" height="40" fill="none" aria-hidden="true" focusable="false">
  <path class="brand__stroke" d="M13 28V12l14 16V12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
  <g class="brand__nodes" fill="currentColor"><circle cx="13" cy="28" r="3.1"/><circle cx="13" cy="12" r="3.1"/><circle cx="27" cy="28" r="3.1"/><circle cx="27" cy="12" r="3.1"/></g>
</svg>`);

export const REPO_URL = 'https://github.com/nikosninosg/nikosninosg.github.io';
export const BRAND_NAME_SHORT = 'Nikos Georgopoulos Ninos';

/** Shared CSS, in cascade order (page CSS is appended last). */
export const SHARED_CSS = [
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/components.css',
  'assets/css/modules/header.css',
  'assets/css/modules/reveal.css',
  'assets/css/modules/hero.css',
  'assets/css/modules/palette.css',
  'assets/css/modules/toast.css',
  'assets/css/modules/consent.css',
  'assets/css/modules/pointer.css',
];

/** Shared JS modules loaded (dynamically) by assets/js/main.js; also modulepreloaded. */
export const JS_MODULES = ['core', 'theme', 'header', 'reveal', 'pointer-fx', 'hero', 'palette', 'consent'];

export const THEME_COLORS = { dark: '#05080a', light: '#f6faf9' };

/**
 * Build the per-page context passed to page render functions:
 * the shared ctx plus { base, path, url(path), abs(path) }.
 * `rootRelative` is for 404.html only (absolute site-root URLs such as /assets/…).
 */
export function createPageCtx(ctx, outPath, { rootRelative = false } = {}) {
  const depth = outPath.split('/').length - 1;
  const base = rootRelative ? '/' : '../'.repeat(depth);
  const siteUrl = ctx.site.url.replace(/\/+$/, '');
  return Object.assign(Object.create(ctx), {
    path: outPath,
    base,
    rootRelative,
    /** Repo-root-relative path -> URL valid from this page. External URLs / #hash / ?query pass through. */
    url: (path = '') => joinUrl(base, path),
    /** Repo-root-relative path -> absolute canonical URL (index.html collapses to the site root). */
    abs: (path = '') => absUrl(siteUrl, path),
  });
}

export function absUrl(siteUrl, path = '') {
  const clean = String(path).replace(/^\/+/, '');
  if (clean === '' || clean === 'index.html') return `${siteUrl}/`;
  return `${siteUrl}/${clean}`;
}

// ---------------------------------------------------------------------------
// <head> pieces
// ---------------------------------------------------------------------------

/** Runs before first paint: .js class, resolved theme, theme-color. Keep tiny and dependency-free. */
const THEME_SCRIPT = `(function(){var d=document.documentElement;d.className=d.className.replace('no-js','js');var p='system';try{var s=localStorage.getItem('theme');if(s==='light'||s==='dark'||s==='system')p=s}catch(e){}var t=p;if(p==='system'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}d.setAttribute('data-theme',t);d.setAttribute('data-theme-pref',p);d.style.colorScheme=t;if(p!=='system'){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute('content',t==='light'?'${THEME_COLORS.light}':'${THEME_COLORS.dark}');m[i].removeAttribute('media')}}})();`;

/**
 * Consent-gated analytics (GDPR / ePrivacy). Nothing from googletagmanager.com or google-analytics.com is
 * requested, and no Google cookie is set, until the visitor has accepted (localStorage 'consent' === 'granted').
 *  1. Google Consent Mode v2 defaults are set to "denied" before any tag exists.
 *  2. window.loadAnalytics() (called here when consent is already stored, or by modules/consent.js on Accept)
 *     sends consent 'update' -> granted and only then injects gtm.js and gtag.js.
 * The GTM <noscript><iframe> is intentionally NOT emitted: it would load GTM without consent.
 */
function analyticsHead(analytics) {
  const { gtm, ga4 } = analytics;
  const code = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}`
    + `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`
    + `window.analyticsIds={gtm:${jsLiteral(gtm)},ga4:${jsLiteral(ga4)}};`
    + `window.loadAnalytics=function(){if(window.analyticsLoaded)return;window.analyticsLoaded=true;`
    + `gtag('consent','update',{analytics_storage:'granted'});`
    + `dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`
    + `var d=document,f=d.getElementsByTagName('script')[0],a=d.createElement('script'),b=d.createElement('script');`
    + `a.async=b.async=true;a.setAttribute('data-analytics','gtm');b.setAttribute('data-analytics','gtag');`
    + `a.src='https://www.googletagmanager.com/gtm.js?id='+window.analyticsIds.gtm;`
    + `b.src='https://www.googletagmanager.com/gtag/js?id='+window.analyticsIds.ga4;`
    + `f.parentNode.insertBefore(a,f);f.parentNode.insertBefore(b,f);`
    + `gtag('js',new Date());gtag('config',window.analyticsIds.ga4)};`
    + `try{if(localStorage.getItem('consent')==='granted')window.loadAnalytics()}catch(e){}`;
  return html`
    <!-- Analytics: consent mode defaults + loader; tags are injected only after the visitor accepts -->
    <script>${raw(code)}</script>`;
}

function personJsonLd(pctx) {
  const { site, experience, education, skills } = pctx;
  const current = experience.find((e) => e.end === 'present');
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    url: pctx.abs(''),
    jobTitle: site.title,
    email: `mailto:${site.email}`,
    description: site.seo.description,
    homeLocation: { '@type': 'Place', name: site.location },
    sameAs: site.socials.map((s) => s.url),
    ...(current ? { worksFor: { '@type': 'Organization', name: current.company } } : {}),
    alumniOf: education.map((e) => ({ '@type': 'CollegeOrUniversity', name: e.school })),
    knowsAbout: skills.flatMap((g) => g.items.map((i) => i.name)),
  };
}

function jsonLdBlocks(pctx, page) {
  const blocks = [];
  if (page.id === 'home' || page.id === 'about') blocks.push(personJsonLd(pctx));
  if (page.id === 'home') {
    blocks.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: pctx.site.name, url: pctx.abs('') });
  }
  if (page.breadcrumbs?.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: page.breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: pctx.abs(b.path),
      })),
    });
  }
  blocks.push(...(page.jsonLd ?? []));
  return blocks.map((b) => html`<script type="application/ld+json">${json(b)}</script>`);
}

function renderHead(pctx, page) {
  const { site, url, abs } = pctx;
  const isHome = page.id === 'home';
  const title = page.fullTitle ?? (isHome ? `${site.name} — ${site.title}` : `${page.title} · ${site.name}`);
  const description = page.description ?? site.seo.description;
  const canonical = page.noindex ? null : abs(page.path);
  const ogImage = page.ogImage ? abs(page.ogImage) : abs('assets/img/og-card.png');
  const ogAlt = page.ogImageAlt ?? `${site.name} — ${site.title}`;
  // Default card is 1200x630; page images are measured from the file so og:image:width/height are always right.
  const ogSize = page.ogImage ? imageSize(page.ogImage) : { width: 1200, height: 630 };
  const twitterCard = ogSize && ogSize.width / ogSize.height >= 1.5 ? 'summary_large_image' : 'summary';
  const css = [...SHARED_CSS, ...(page.css ?? [])];

  return html`
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${isHome || page.id === 'about' ? html`<meta name="keywords" content="${site.seo.keywords.join(', ')}">` : ''}
  <meta name="author" content="${site.name}">
  ${page.noindex ? html`<meta name="robots" content="noindex, follow">` : html`<meta name="robots" content="index, follow, max-image-preview:large">`}
  ${canonical ? html`<link rel="canonical" href="${canonical}">` : ''}
  <meta name="color-scheme" content="dark light">
  <meta name="theme-color" content="${THEME_COLORS.dark}" media="(prefers-color-scheme: dark)" data-theme-color="dark">
  <meta name="theme-color" content="${THEME_COLORS.light}" media="(prefers-color-scheme: light)" data-theme-color="light">
  <script>${raw(THEME_SCRIPT)}</script>

  <meta property="og:type" content="${page.ogType ?? 'website'}">
  <meta property="og:site_name" content="${site.name}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${canonical ? html`<meta property="og:url" content="${canonical}">` : ''}
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:alt" content="${ogAlt}">
  ${ogSize ? html`<meta property="og:image:width" content="${ogSize.width}"><meta property="og:image:height" content="${ogSize.height}">` : ''}
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">

  <link rel="icon" href="${url('assets/img/icon.svg')}" type="image/svg+xml">
  <link rel="icon" type="image/png" sizes="32x32" href="${url('assets/img/icon-32.png')}">
  <link rel="icon" type="image/png" sizes="192x192" href="${url('assets/img/icon-192.png')}">
  <link rel="apple-touch-icon" sizes="180x180" href="${url('assets/img/apple-touch-icon-180.png')}">
  <link rel="sitemap" type="application/xml" href="${url('sitemap.xml')}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap">
  ${css.map((href) => html`<link rel="stylesheet" href="${url(href)}">`)}
  ${(page.preload ?? []).map((l) => html`<link rel="preload" as="${l.as}" href="${url(l.href)}"${l.type ? html` type="${l.type}"` : ''}>`)}
  ${JS_MODULES.map((m) => html`<link rel="modulepreload" href="${url(`assets/js/modules/${m}.js`)}">`)}
  ${jsonLdBlocks(pctx, page)}
  ${analyticsHead(site.analytics)}`;
}

// ---------------------------------------------------------------------------
// Header / footer / palette
// ---------------------------------------------------------------------------

/** Accessible name for the CV download controls, e.g. 'Download CV, PDF, 351 KB'. */
function cvLabel(cv) {
  return `Download CV, ${cv.format}, ${cv.sizeKB} KB`;
}

function renderHeader(pctx, page) {
  const { site, nav, url, cv } = pctx;
  const current = page.nav ?? page.id;
  return html`
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header" data-header>
  <div class="scroll-progress" data-progress aria-hidden="true"><span class="scroll-progress__bar" data-progress-bar></span></div>
  <div class="site-header__inner container">
    <a class="brand" href="${url('index.html')}" aria-label="${site.name} — home">
      <span class="brand__mark" aria-hidden="true">${BRAND_MARK}</span>
      <span class="brand__name">${site.name}</span>
    </a>
    <nav class="site-nav" id="site-nav" data-nav aria-label="Primary">
      <ul class="site-nav__list">
        ${nav.map((n) => {
          const state = n.id === page.id ? raw(' aria-current="page"') : n.id === current ? raw(' aria-current="true"') : '';
          return html`<li><a class="nav-link" href="${url(n.path)}"${state}>${n.label}</a></li>`;
        })}
        ${cv ? html`<li class="nav-cv"><a class="nav-cv__link" href="${url(cv.href)}" download aria-label="${cvLabel(cv)}" data-cv-download>${icon('download', { size: 18 })}<span>Download CV</span><span class="nav-cv__meta">${cv.format} · ${cv.sizeKB} KB</span></a></li>` : ''}
      </ul>
      <span class="nav-pill" data-nav-pill aria-hidden="true"></span>
    </nav>
    <div class="site-header__actions">
      <button class="icon-btn palette-trigger" type="button" data-palette-open aria-label="Open command palette" aria-keyshortcuts="Control+K Meta+K">
        ${icon('search', { size: 18 })}
        <kbd class="kbd" aria-hidden="true"><span data-kbd-mod>Ctrl</span><span>K</span></kbd>
      </button>
      <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Toggle colour theme">
        <span class="theme-toggle__icon theme-toggle__icon--sun">${icon('sun', { size: 18 })}</span>
        <span class="theme-toggle__icon theme-toggle__icon--moon">${icon('moon', { size: 18 })}</span>
      </button>
      ${cv ? html`<a class="icon-btn cv-btn" href="${url(cv.href)}" download aria-label="${cvLabel(cv)}" title="${cvLabel(cv)}" data-cv-download>${icon('download', { size: 18 })}<span class="cv-btn__text">CV</span></a>` : ''}
      <a class="btn btn-primary btn-sm header-cta" href="${url('contact.html')}">Let's talk</a>
      <button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
        <span class="nav-toggle__icon nav-toggle__icon--open">${icon('menu', { size: 20 })}</span>
        <span class="nav-toggle__icon nav-toggle__icon--close">${icon('x', { size: 20 })}</span>
      </button>
    </div>
  </div>
</header>`;
}

function renderFooter(pctx) {
  const { site, nav, url, year, cv } = pctx;
  return html`
<footer class="site-footer">
  <div class="container">
    <div class="site-footer__grid">
      <div class="site-footer__brand">
        <a class="brand" href="${url('index.html')}" aria-label="${site.name} — home">
          <span class="brand__mark" aria-hidden="true">${BRAND_MARK}</span>
          <span class="brand__name">${site.name}</span>
        </a>
        <p class="site-footer__blurb">${site.title} · ${site.tagline}. ${site.location}.</p>
      </div>
      <nav class="site-footer__col" aria-label="Footer">
        <h2 class="site-footer__heading">Sitemap</h2>
        <ul class="site-footer__list">
          ${nav.map((n) => html`<li><a class="link-arrow" href="${url(n.path)}">${n.label}</a></li>`)}
          ${cv ? html`<li><a class="link-arrow" href="${url(cv.href)}" download aria-label="${cvLabel(cv)}" data-cv-download>Download CV (${cv.format})</a></li>` : ''}
        </ul>
      </nav>
      <div class="site-footer__col">
        <h2 class="site-footer__heading">Elsewhere</h2>
        <ul class="site-footer__list site-footer__socials">
          ${site.socials.map((s) => html`<li><a class="social-link" href="${s.url}" target="_blank" rel="noopener noreferrer">${icon(s.id, { size: 18 })}<span>${s.label}</span></a></li>`)}
        </ul>
      </div>
    </div>
    <div class="site-footer__bottom">
      <p>&copy; ${year} ${site.name} <button class="cookie-settings" type="button" data-consent-open hidden>Cookie settings</button></p>
      <p class="site-footer__note">Hand-built with plain HTML, CSS and JS. <a class="link-arrow" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">View the source</a></p>
    </div>
  </div>
</footer>
<button class="to-top" type="button" data-to-top aria-label="Back to top">${icon('arrow-up', { size: 20 })}</button>`;
}

/** Command-palette dialog skeleton. palette.js fills [data-palette-list] from #palette-data. */
function renderPalette() {
  return html`
<dialog class="palette" data-palette aria-label="Command palette">
  <div class="palette__box">
    <div class="palette__search">
      ${icon('search', { size: 18 })}
      <input class="palette__input" data-palette-input type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" aria-label="Search pages, projects and actions" placeholder="Search pages, projects, actions…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <kbd class="kbd" aria-hidden="true">esc</kbd>
    </div>
    <ul class="palette__list" id="palette-list" role="listbox" aria-label="Results" data-palette-list></ul>
    <p class="palette__empty" data-palette-empty hidden>No results. Try another search.</p>
    <div class="palette__foot" aria-hidden="true">
      <span><kbd class="kbd">&uarr;</kbd><kbd class="kbd">&darr;</kbd> navigate</span>
      <span><kbd class="kbd">&crarr;</kbd> select</span>
      <span><kbd class="kbd">esc</kbd> close</span>
    </div>
  </div>
</dialog>`;
}

/**
 * Analytics consent banner (non-modal dialog). Hidden until assets/js/modules/consent.js decides to show it;
 * without JS it never shows, and without JS analytics never load either.
 */
function renderConsent({ site }) {
  return html`
<section class="consent" data-consent role="dialog" aria-modal="false" aria-labelledby="consent-title" aria-describedby="consent-text" hidden>
  <h2 class="consent__title" id="consent-title">Analytics &amp; cookies</h2>
  <p class="consent__text" id="consent-text">This site uses Google Analytics to understand how it is used. It only runs if you accept.</p>
  <details class="consent__more">
    <summary>Privacy details</summary>
    <p>If you accept, Google Analytics and Google Tag Manager set cookies and receive your IP address, page views and device information. If you decline, nothing is sent to Google and no analytics cookies are set. The data controller is ${site.name} (the site owner), contact: <a href="mailto:${site.email}">${site.email}</a>. You can change your choice at any time with &ldquo;Cookie settings&rdquo; in the footer.</p>
  </details>
  <div class="consent__actions">
    <button class="btn btn-ghost btn-sm" type="button" data-consent-choice="denied">Decline</button>
    <button class="btn btn-ghost btn-sm" type="button" data-consent-choice="granted">Accept</button>
  </div>
</section>`;
}

/** Palette data with every URL rebased for this page. */
function paletteJson(pctx, page) {
  const rebase = (item) => (item.url ? { ...item, url: pctx.url(item.url) } : item);
  const { pages, projects, actions } = pctx.paletteData;
  return { current: page.nav ?? page.id, pages: pages.map(rebase), projects: projects.map(rebase), actions: actions.map(rebase) };
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/**
 * Render a complete HTML document for `page` (the object returned by a page module).
 * @returns {string}
 */
export function renderDocument(pctx, page) {
  const { url } = pctx;
  const bodyClass = ['page-' + page.id, page.bodyClass].filter(Boolean).join(' ');
  return String(html`<!doctype html>
<!-- Generated by src/build.mjs from content/*.json — edit the sources, not this file. -->
<html lang="en" class="no-js">
<head>${renderHead(pctx, page)}
</head>
<body data-page="${page.id}" class="${bodyClass}">
${renderHeader(pctx, page)}
<main id="main" tabindex="-1">
${page.body}
</main>
${renderFooter(pctx)}
${renderPalette()}
${renderConsent(pctx)}
<script type="application/json" id="palette-data">${json(paletteJson(pctx, page))}</script>
<script type="module" src="${url('assets/js/main.js')}"></script>
${(page.js ?? []).map((src) => html`<script type="module" src="${url(src)}"></script>`)}
</body>
</html>
`);
}

/** Tiny redirect document for legacy URLs (meta refresh + JS replace + <a> fallback). */
export function renderRedirect({ site, fromPath, toPath }) {
  const siteUrl = site.url.replace(/\/+$/, '');
  const depth = fromPath.split('/').length - 1;
  const relTarget = joinUrl('../'.repeat(depth), toPath);
  const absTarget = absUrl(siteUrl, toPath);
  return String(html`<!doctype html>
<!-- Generated by src/build.mjs: legacy redirect for ${fromPath} -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting… · ${site.name}</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${absTarget}">
  <meta http-equiv="refresh" content="0; url=${relTarget}">
  <script>${raw(`location.replace(${jsLiteral(relTarget)}+location.search+location.hash);`)}</script>
</head>
<body>
  <p>This page has moved to <a href="${relTarget}">${absTarget}</a>.</p>
</body>
</html>
`);
}

