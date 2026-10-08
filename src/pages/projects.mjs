/**
 * PROJECTS index: intro, sticky filter bar (category chips + live search), result count (aria-live),
 * responsive grid of rich project cards and an empty state.
 *
 * Everything is rendered server-side: with JS disabled all cards are visible and the filter bar is
 * hidden (`.no-js` rule in projects.css). assets/js/pages/projects.js adds filtering, search, the FLIP
 * animation and the ?filter=…&q=… URL sync on top.
 *
 * Copy comes from ctx (content/*.json); the literals below are UI labels only (see LABELS).
 * Markup contract: src/COMPONENTS.md (2.10 + project card). Styles: assets/css/pages/projects.css.
 */
import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { html } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';

/** UI labels only. Everything else is content. */
const LABELS = {
  eyebrow: 'Portfolio',
  title: 'Projects',
  filterGroup: 'Filter projects',
  search: 'Search projects',
  searchPlaceholder: 'Search projects…',
  cta: 'View project',
  tags: 'Technologies',
  reset: 'Reset filters',
  emptyTitle: 'No projects match',
  emptyText: 'Try another keyword or pick a different category.',
  clear: 'Clear filters',
};

/** Technologies shown on a card before collapsing the rest into "+N". */
const MAX_TAGS = 4;
/** Cards that are above the fold on desktop (3 columns): loaded eagerly, the rest lazily. */
const EAGER_COUNT = 3;

// ---------------------------------------------------------------------------
// Image intrinsic size (read from the file header so width/height are always right)
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
      size = { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    } else if (head[0] === 0xff && head[1] === 0xd8) {
      const buf = Buffer.alloc(Math.min(statSync(file).size, 262144));
      readSync(fd, buf, 0, buf.length, 0);
      for (let i = 2; i < buf.length - 9; ) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
          break;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (!size) throw new Error(`projects.mjs: cannot read the dimensions of ${rel}`);
    sizeCache.set(rel, size);
    return size;
  } finally {
    closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function intro(ctx) {
  const labels = ctx.categories.map((c) => c.label);
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
  return html`
<header class="page-hero projects-hero">
  <div class="container projects-hero__inner">
    <p class="eyebrow"><span class="eyebrow__label">${LABELS.eyebrow}</span></p>
    <h1 class="page-hero__title projects-hero__title">${LABELS.title}</h1>
    <p class="page-hero__lede">${plural(ctx.projects.length, 'project')} across ${list}. Filter by category, or search by technology, client or keyword.</p>
  </div>
</header>`;
}

function toolbar(ctx) {
  const { categoriesWithAll } = ctx;
  return html`
    <div class="projects-toolbar" data-toolbar>
      <form class="projects-toolbar__form" role="search" data-search-form action="#" novalidate>
        <div class="filter-bar" data-filter-bar role="group" aria-label="${LABELS.filterGroup}">
          ${categoriesWithAll.map((c) => html`<button class="chip" type="button" data-filter="${c.id}" aria-pressed="${c.id === 'all' ? 'true' : 'false'}">${c.label} <span class="chip__count">${c.count}</span></button>`)}
          <label class="search-field">
            ${icon('search', { size: 18 })}
            <input type="search" data-search placeholder="${LABELS.searchPlaceholder}" aria-label="${LABELS.search}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" maxlength="80">
          </label>
        </div>
      </form>
    </div>
    <div class="projects-status" data-status>
      <p class="projects-count" data-result-count role="status" aria-live="polite" aria-atomic="true">${plural(ctx.projects.length, 'project')}</p>
      <button class="projects-reset" type="button" data-reset hidden>${LABELS.reset}</button>
    </div>`;
}

function card(ctx, p, index) {
  const { url, root } = ctx;
  const catLabel = Object.fromEntries(ctx.categories.map((c) => [c.id, c.label]));
  const { width, height } = imageSize(root, p.cover.src);
  const shown = p.technologies.slice(0, MAX_TAGS);
  const more = p.technologies.length - shown.length;
  const categoryLabels = p.categories.map((c) => catLabel[c] ?? c);
  const eager = index < EAGER_COUNT;
  // Haystack for the live search (lower-cased by the script): title, client, organisation, category
  // labels, summary and every technology (not only the four shown).
  const haystack = [p.title, p.subtitle, p.client, p.organization, ...categoryLabels, p.summary, ...p.technologies].filter(Boolean).join(' ');
  return html`
      <li data-reveal>
        <article class="project-card card projects-card" data-tilt data-project-card data-categories="${p.categories.join(' ')}" data-title="${p.title}" data-tags="${p.technologies.map((t) => t.toLowerCase()).join('|')}" data-search-text="${haystack}">
          <div class="project-card__media">
            <img src="${url(p.cover.src)}" width="${width}" height="${height}" alt="${p.cover.alt}" decoding="async"${eager ? '' : html` loading="lazy"`}>
          </div>
          <div class="project-card__body">
            <div class="project-card__meta">
              ${categoryLabels.map((label, i) => html`<span class="badge${i === 0 ? ' badge--accent' : ''}">${label}</span>`)}
              ${p.year ? html`<span class="project-card__year">${p.year}</span>` : ''}
            </div>
            <h2 class="project-card__title"><a class="project-card__link" href="${url(`projects/${p.slug}.html`)}">${p.title}</a></h2>
            <p class="project-card__client">${icon('briefcase', { size: 15 })}<span>${p.client}</span></p>
            <p class="project-card__summary">${p.summary}</p>
            <ul class="tag-list project-card__tags" aria-label="${LABELS.tags}">
              ${shown.map((t) => html`<li class="tag">${t}</li>`)}
              ${more > 0 ? html`<li class="tag" title="${p.technologies.slice(MAX_TAGS).join(', ')}">+${more}</li>` : ''}
            </ul>
            <span class="project-card__cta link-arrow" aria-hidden="true">${LABELS.cta}</span>
          </div>
        </article>
      </li>`;
}

function emptyState() {
  return html`
    <div class="empty-state projects-empty" data-empty hidden>
      <span class="projects-empty__icon" aria-hidden="true">${icon('search', { size: 28 })}</span>
      <p class="projects-empty__title" data-empty-title>${LABELS.emptyTitle}</p>
      <p>${LABELS.emptyText}</p>
      <button class="btn btn-ghost btn-sm" type="button" data-reset>${LABELS.clear}</button>
    </div>`;
}

export default function render(ctx) {
  const { site, projects, categories } = ctx;
  return {
    id: 'projects',
    path: 'projects.html',
    title: 'Projects',
    description: `${plural(projects.length, 'project')} by ${site.name} across ${categories.map((c) => c.label).join(', ')}.`,
    css: ['assets/css/pages/projects.css'],
    js: ['assets/js/pages/projects.js'],
    body: html`
${intro(ctx)}
<section class="section section--flush-top projects" aria-label="${LABELS.title}">
  <span class="section__blob" aria-hidden="true"></span>
  <div class="container">
    ${toolbar(ctx)}
    <ul class="project-grid projects-grid" role="list" data-project-grid data-reveal-stagger>
      ${projects.map((p, i) => card(ctx, p, i))}
    </ul>
    ${emptyState()}
  </div>
</section>`,
  };
}
