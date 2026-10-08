/**
 * PROJECT DETAIL page: one case study per content/projects/<slug>.json (rendered by build.mjs as
 * render(ctx, project) at projects/<slug>.html, so ctx.base === '../').
 *
 * Layout: breadcrumb + hero (badges, title, subtitle, summary, cover in a glow frame) / two columns
 * (overview prose + numbered contributions | sticky meta panel) / screenshot gallery that opens the
 * shared lightbox / prev + next project cards / closing CTA.
 *
 * Content varies a lot between projects (gallery, contributions, links, year, subtitle are all optional),
 * so every block is conditional and the grid degrades to a single column. All text comes from the
 * content JSON; the only literals here are UI labels (LABELS). Markup contract: src/COMPONENTS.md.
 * Styles: assets/css/pages/project.css. Lightbox behaviour: assets/js/modules/lightbox.js.
 */
import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { html, raw } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';

/** UI labels only. Everything else is content. */
const LABELS = {
  home: 'Home',
  projects: 'Projects',
  breadcrumb: 'Breadcrumb',
  details: 'Project details',
  client: 'Client',
  organisation: 'Organisation',
  role: 'Role',
  year: 'Year',
  years: 'Years',
  category: 'Category',
  categories: 'Categories',
  links: 'Links',
  technologies: 'Technologies',
  newTab: '(opens in a new tab)',
  copyLink: 'Copy link',
  copiedLink: 'Link copied to clipboard',
  copied: 'Copied!',
  viewShots: 'View screenshots',
  overview: { eyebrow: 'Overview', title: 'About the project' },
  contributions: { eyebrow: 'Contributions', title: 'What I contributed' },
  gallery: { eyebrow: 'Screenshots', title: 'Screenshots', lede: 'Select an image to view it larger.' },
  expand: 'View larger',
  more: { eyebrow: 'Keep exploring', title: 'More projects', prev: 'Previous project', next: 'Next project', all: 'All projects' },
  cta: {
    title: 'Interested in something similar?',
    text: "Tell me about your idea or project and let's see how we can build it together.",
    action: 'Get in touch',
  },
};

// ---------------------------------------------------------------------------
// Image helpers: intrinsic size straight from the file header (PNG / JPEG), cached per build, so every
// <img> carries correct width/height and the layout never shifts. No dependencies.
// ---------------------------------------------------------------------------
const sizeCache = new Map();

function imageSize(root, rel) {
  if (sizeCache.has(rel)) return sizeCache.get(rel);
  const file = join(root, rel);
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(32);
    readSync(fd, head, 0, 32, 0);
    let size;
    if (head.readUInt32BE(0) === 0x89504e47) {
      // PNG: IHDR is always the first chunk: width/height are big-endian uint32 at offsets 16 and 20.
      size = { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    } else if (head[0] === 0xff && head[1] === 0xd8) {
      // JPEG: walk the marker segments until a Start-Of-Frame (SOFn) marker.
      const buf = Buffer.alloc(Math.min(statSync(file).size, 512 * 1024));
      readSync(fd, buf, 0, buf.length, 0);
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
          break;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (!size?.width || !size?.height) throw new Error(`project.mjs: cannot read the dimensions of ${rel} (only PNG and JPEG are supported)`);
    sizeCache.set(rel, size);
    return size;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const EXPAND_ICON = raw(
  '<svg class="icon icon-expand" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 4h5v5M9 20H4v-5M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>',
);

function eyebrow(index, label) {
  return html`<p class="eyebrow"><span class="eyebrow__index">${index}</span><span class="eyebrow__label">${label}</span></p>`;
}

/** Icon for an external link button, picked from the host (no per-project data needed). */
function linkIcon(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '') === 'github.com' ? 'github' : 'external';
  } catch {
    return 'external';
  }
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/**
 * Plain text -> array of strings and <a> elements: bare URLs inside content become real links.
 * (Text is escaped by html``; trailing punctuation is not part of the link.)
 */
function linkify(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[)\].,;:!?]+$/, '');
    parts.push(text.slice(last, m.index));
    parts.push(html`<a href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^https?:\/\//, '')}</a>`);
    last = m.index + url.length;
  }
  parts.push(text.slice(last));
  return parts;
}

/**
 * Description paragraphs -> prose. A short paragraph that ends with ":" ("File descriptions:") is a
 * lead-in for what follows, so it is set as a small heading instead of a paragraph.
 */
function prose(paragraphs) {
  return html`${paragraphs.map((text) =>
    /^[^.!?]{1,48}:$/.test(text.trim())
      ? html`<h3 class="project-prose__sub">${text.replace(/:$/, '')}</h3>`
      : html`<p>${linkify(text)}</p>`,
  )}`;
}

/**
 * Gallery layout, decided at build time because the real image ratios are known: images are grouped in
 * rows of two (the last row holds three when the count is odd, a lone image is centred) and each image
 * gets a share of a 48-column grid proportional to its aspect ratio, so the images of a row end up with
 * (almost exactly) the same height and nothing is cropped. The share allows for the column gap, using a
 * typical desktop container width; the small error at other widths is invisible.
 */
const GRID_COLS = 48;
const MIN_SPAN = 14;
const REF_WIDTH = 1100; // px, typical container width
const REF_GAP = 16; // px, the desktop column gap

function galleryRows(ratios) {
  const n = ratios.length;
  const sizes = n === 1 ? [1] : n % 2 === 0 ? Array(n / 2).fill(2) : [...Array((n - 3) / 2).fill(2), 3];
  const rows = [];
  let at = 0;
  for (const size of sizes) {
    const group = ratios.slice(at, at + size);
    const total = group.reduce((a, b) => a + b, 0);
    const height = (REF_WIDTH - (size - 1) * REF_GAP) / total; // common row height at the reference width
    const spans = group.map((r) => Math.max(MIN_SPAN, Math.round((GRID_COLS * (height * r + REF_GAP)) / (REF_WIDTH + REF_GAP))));
    // fix rounding so the row always adds up to the full grid
    let diff = GRID_COLS - spans.reduce((a, b) => a + b, 0);
    for (let i = 0; diff !== 0; i = (i + 1) % spans.length) {
      const step = Math.sign(diff);
      if (spans[i] + step >= MIN_SPAN) {
        spans[i] += step;
        diff -= step;
      }
    }
    rows.push(...spans.map((span) => ({ span, size })));
    at += size;
  }
  if (n === 1) rows[0] = { span: GRID_COLS * (2 / 3), size: 1 }; // centred, two thirds wide
  return rows;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
function breadcrumb(ctx, project) {
  const { url } = ctx;
  return html`
    <nav class="breadcrumb" aria-label="${LABELS.breadcrumb}">
      <ol class="breadcrumb__list">
        <li class="breadcrumb__item"><a class="breadcrumb__link" href="${url('index.html')}">${LABELS.home}</a></li>
        <li class="breadcrumb__item"><a class="breadcrumb__link" href="${url('projects.html')}">${LABELS.projects}</a></li>
        <li class="breadcrumb__item"><span class="breadcrumb__current" aria-current="page">${project.title}</span></li>
      </ol>
    </nav>`;
}

function categoryBadges(ctx, project, { asLinks = true } = {}) {
  const catLabel = Object.fromEntries(ctx.categories.map((c) => [c.id, c.label]));
  return project.categories.map((c, i) => {
    const cls = `badge${i === 0 ? ' badge--accent' : ''}`;
    // Link to the filtered grid (projects.js reads ?filter=); plain badge if linking is not wanted.
    return asLinks
      ? html`<a class="${cls} project-badge" href="${ctx.url(`projects.html?filter=${c}`)}">${catLabel[c] ?? c}</a>`
      : html`<span class="${cls}">${catLabel[c] ?? c}</span>`;
  });
}

function hero(ctx, project) {
  const { url, root } = ctx;
  const { width, height } = imageSize(root, project.cover.src);
  const [firstLink] = project.links;
  const hasGallery = project.gallery.length > 0;
  return html`
<header class="page-hero project-hero">
  <div class="container">
    ${breadcrumb(ctx, project)}
    <div class="project-hero__grid">
      <div class="project-hero__text">
        <p class="project-hero__badges" aria-label="${LABELS.categories}">${categoryBadges(ctx, project)}</p>
        <h1 class="project-hero__title">${project.title}</h1>
        ${project.subtitle ? html`<p class="project-hero__subtitle">${project.subtitle}</p>` : ''}
        <p class="project-hero__lede">${project.summary}</p>
        <p class="project-hero__client">
          <span class="project-hero__client-label">${LABELS.client}</span>
          <span class="project-hero__client-value">${project.client}</span>
        </p>
        ${firstLink || hasGallery
          ? html`
        <div class="project-hero__actions">
          ${firstLink
            ? html`<a class="btn btn-primary btn-lg" href="${firstLink.url}" target="_blank" rel="noopener noreferrer" data-magnetic>${icon(linkIcon(firstLink.url))}<span>${firstLink.label}<span class="sr-only"> ${LABELS.newTab}</span></span></a>`
            : ''}
          ${hasGallery
            ? html`<a class="btn btn-ghost btn-lg" href="#screenshots">${LABELS.viewShots}${icon('arrow-down')}</a>`
            : ''}
        </div>`
          : ''}
      </div>
      <figure class="project-cover">
        <span class="project-cover__glow" aria-hidden="true"></span>
        <img class="project-cover__img" src="${url(project.cover.src)}" width="${width}" height="${height}" alt="${project.cover.alt}" fetchpriority="high" decoding="async">
      </figure>
    </div>
  </div>
</header>`;
}

/** Sticky meta panel: short facts as a definition list, then links (buttons) and technologies (tags). */
function metaPanel(ctx, project) {
  const orgIsNew = project.organization && !project.client.toLowerCase().includes(project.organization.toLowerCase());
  const multiYear = project.year && /[,–-]/.test(project.year);
  const facts = [
    [LABELS.client, project.client],
    orgIsNew ? [LABELS.organisation, project.organization] : null,
    project.role ? [LABELS.role, project.role] : null,
    project.year ? [multiYear ? LABELS.years : LABELS.year, project.year] : null,
  ].filter(Boolean);
  return html`
<aside class="project-meta card card--flat" aria-labelledby="meta-title">
  <h2 class="project-meta__title" id="meta-title">${LABELS.details}</h2>
  <dl class="meta-list project-meta__list">
    ${facts.map(([label, value]) => html`
    <div class="meta-list__item"><dt class="meta-list__label">${label}</dt><dd class="meta-list__value">${value}</dd></div>`)}
    <div class="meta-list__item"><dt class="meta-list__label">${project.categories.length > 1 ? LABELS.categories : LABELS.category}</dt><dd class="meta-list__value project-meta__badges">${categoryBadges(ctx, project)}</dd></div>
  </dl>
  ${project.links.length
    ? html`
  <div class="project-meta__block">
    <h3 class="project-meta__label">${LABELS.links}</h3>
    <ul class="project-meta__links" role="list">
      ${project.links.map((l) => html`<li><a class="btn btn-ghost btn-sm project-meta__link" href="${l.url}" target="_blank" rel="noopener noreferrer">${icon(linkIcon(l.url))}<span>${l.label}<span class="sr-only"> ${LABELS.newTab}</span></span></a></li>`)}
    </ul>
  </div>`
    : ''}
  ${project.technologies.length
    ? html`
  <div class="project-meta__block">
    <h3 class="project-meta__label">${LABELS.technologies}</h3>
    <ul class="tag-list" role="list">${project.technologies.map((t) => html`<li class="tag">${t}</li>`)}</ul>
  </div>`
    : ''}
  <div class="project-meta__block project-meta__share">
    <button class="btn btn-ghost btn-sm" type="button" data-copy="${ctx.abs(`projects/${project.slug}.html`)}" data-copy-message="${LABELS.copiedLink}" data-copied-label="${LABELS.copied}">${icon('link')}<span data-copy-label>${LABELS.copyLink}</span></button>
  </div>
</aside>`;
}

function gallery(ctx, project, index) {
  const { url, root } = ctx;
  const items = project.gallery.map((g) => ({ ...g, ...imageSize(root, g.src) }));
  const rows = galleryRows(items.map((g) => g.width / g.height));
  return html`
<section class="section project-gallery" id="screenshots" aria-labelledby="screenshots-title">
  <span class="section__blob section__blob--violet" aria-hidden="true"></span>
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow(index, LABELS.gallery.eyebrow)}
      <h2 class="section-title" id="screenshots-title">${LABELS.gallery.title}</h2>
      <p class="section-lede">${LABELS.gallery.lede}</p>
    </header>
    <ul class="gallery project-gallery__grid" role="list" data-lightbox data-reveal-stagger>
      ${items.map((g, i) => html`
      <li class="project-gallery__cell" style="--span:${rows[i].span}" data-row="${rows[i].size}"${rows[i].size === 1 ? raw(' data-single') : ''} data-reveal="zoom">
        <figure class="project-gallery__figure">
          <a class="gallery__item project-gallery__item" href="${url(g.src)}" data-lightbox-src="${url(g.src)}" data-lightbox-alt="${g.alt}"${g.caption ? html` data-lightbox-caption="${g.caption}"` : ''}>
            <img src="${url(g.src)}" width="${g.width}" height="${g.height}" style="aspect-ratio:${g.width}/${g.height}" alt="${g.alt}" loading="lazy" decoding="async">
            <span class="project-gallery__expand" aria-hidden="true">${EXPAND_ICON}</span>
            <span class="sr-only">${LABELS.expand}</span>
          </a>
          ${g.caption ? html`<figcaption class="project-gallery__caption"><span class="project-gallery__no">${String(i + 1).padStart(2, '0')}</span>${g.caption}</figcaption>` : ''}
        </figure>
      </li>`)}
    </ul>
  </div>
</section>`;
}

function pagerCard(ctx, p, dir) {
  const { url, root } = ctx;
  const { width, height } = imageSize(root, p.cover.src);
  const label = dir === 'prev' ? LABELS.more.prev : LABELS.more.next;
  return html`
    <li class="project-pager__item" data-reveal>
      <article class="project-pager__card card card--interactive" data-dir="${dir}">
        <div class="project-pager__media"><img src="${url(p.cover.src)}" width="${width}" height="${height}" alt="" loading="lazy" decoding="async"></div>
        <div class="project-pager__body">
          <p class="project-pager__dir">${label}</p>
          <h3 class="project-pager__title"><a class="project-pager__link" rel="${dir}" href="${url(`projects/${p.slug}.html`)}">${p.title}</a></h3>
          <p class="project-pager__cats">${categoryBadges(ctx, p, { asLinks: false })}</p>
        </div>
      </article>
    </li>`;
}

function pager(ctx, project) {
  const { prev, next } = ctx.prevNext(project.slug);
  const { url } = ctx;
  const cards = prev.slug === next.slug ? [[next, 'next']] : [[prev, 'prev'], [next, 'next']];
  return html`
<section class="section section--tight project-more" aria-labelledby="more-title">
  <div class="container">
    <header class="project-more__head" data-reveal>
      <p class="eyebrow"><span class="eyebrow__label">${LABELS.more.eyebrow}</span></p>
      <h2 class="project-more__title" id="more-title">${LABELS.more.title}</h2>
    </header>
    <ul class="project-pager" role="list" data-reveal-stagger>
      ${cards.map(([p, dir]) => pagerCard(ctx, p, dir))}
    </ul>
    <p class="project-more__all" data-reveal><a class="btn btn-ghost" href="${url('projects.html')}">${icon('arrow-left')}${LABELS.more.all}</a></p>
  </div>
</section>`;
}

function closingCta(ctx) {
  const { site, url } = ctx;
  return html`
<section class="section section--tight project-cta" aria-labelledby="project-cta-title">
  <div class="container">
    <div class="cta-band" data-reveal="zoom">
      <h2 class="cta-band__title" id="project-cta-title">${LABELS.cta.title}</h2>
      <p class="cta-band__text">${LABELS.cta.text}</p>
      <div class="cta-band__actions">
        <a class="btn btn-primary btn-lg" href="${url('contact.html')}" data-magnetic>${LABELS.cta.action}${icon('arrow-right')}</a>
        <button class="btn btn-ghost btn-lg" type="button" data-copy="${site.email}" data-copy-message="Email address copied" data-copied-label="${LABELS.copied}" data-magnetic>${icon('copy')}<span data-copy-label>${site.email}</span></button>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
export default function render(ctx, project) {
  const { site } = ctx;
  const pagePath = `projects/${project.slug}.html`;
  const catLabel = Object.fromEntries(ctx.categories.map((c) => [c.id, c.label]));
  const hasContrib = project.contributions.length > 0;
  const hasGallery = project.gallery.length > 0;
  let n = 0;
  const idx = () => String(++n).padStart(2, '0');

  return {
    id: 'project',
    nav: 'projects',
    path: pagePath,
    title: project.title,
    description: project.summary,
    ogType: 'article',
    ogImage: project.cover.src,
    ogImageAlt: project.cover.alt,
    breadcrumbs: [
      { name: LABELS.home, path: 'index.html' },
      { name: LABELS.projects, path: 'projects.html' },
      { name: project.title, path: pagePath },
    ],
    // A schema.org description of the work itself (the breadcrumb list is emitted by the layout).
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: project.title,
        ...(project.subtitle ? { alternativeHeadline: project.subtitle } : {}),
        description: project.summary,
        url: ctx.abs(pagePath),
        image: ctx.abs(project.cover.src),
        author: { '@type': 'Person', name: site.name, url: ctx.abs('') },
        genre: project.categories.map((c) => catLabel[c] ?? c),
        keywords: project.technologies.join(', '),
        ...(project.organization ? { sourceOrganization: { '@type': 'Organization', name: project.organization } } : {}),
      },
    ],
    css: ['assets/css/pages/project.css'],
    js: [],
    body: html`
<article class="project">
${hero(ctx, project)}
<div class="section project-body">
  <span class="section__blob" aria-hidden="true"></span>
  <div class="container project-layout">
    <div class="project-main">
      <section class="project-section" aria-labelledby="overview-title" data-reveal>
        <header class="section-head">
          ${eyebrow(idx(), LABELS.overview.eyebrow)}
          <h2 class="section-title" id="overview-title">${LABELS.overview.title}</h2>
        </header>
        <div class="prose project-prose">${prose(project.description)}</div>
      </section>
      ${hasContrib
        ? html`
      <section class="project-section" aria-labelledby="contrib-title" data-reveal>
        <header class="section-head">
          ${eyebrow(idx(), LABELS.contributions.eyebrow)}
          <h2 class="section-title" id="contrib-title">${LABELS.contributions.title}</h2>
        </header>
        <ol class="numbered-list project-contrib">
          ${project.contributions.map((c) => html`<li>${c}</li>`)}
        </ol>
      </section>`
        : ''}
    </div>
    <div class="project-side">${metaPanel(ctx, project)}</div>
  </div>
</div>
${hasGallery ? gallery(ctx, project, idx()) : ''}
${pager(ctx, project)}
${closingCta(ctx)}
</article>`,
  };
}
