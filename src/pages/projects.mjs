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
import { html, raw } from '../lib/html.mjs';
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
  groupEyebrow: 'Projects',
  featured: { eyebrow: 'Flagship', title: 'Featured' },
  viewGroup: 'View: grid / list',
  viewGrid: 'Grid',
  viewList: 'List',
  featuredBadge: 'Featured',
};

/** Own-drawn 24x24 stroke glyphs for the view toggle (icons.mjs is not ours to extend). */
const VIEW_ICONS = {
  grid: raw('<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>'),
  list: raw('<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>'),
};

/** Technologies shown on a card (calm cards: no "+N" chip; the full list is on the detail page and in search). */
const MAX_TAGS = 3;
/** Cards that are above the fold (the flagship block): loaded eagerly, the rest lazily. */
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
          <div class="view-toggle" role="group" aria-label="${LABELS.viewGroup}" data-view-toggle>
            <button class="view-toggle__btn" type="button" data-view="grid" aria-pressed="true">${VIEW_ICONS.grid}<span>${LABELS.viewGrid}</span></button>
            <button class="view-toggle__btn" type="button" data-view="list" aria-pressed="false">${VIEW_ICONS.list}<span>${LABELS.viewList}</span></button>
          </div>
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
  const categoryLabels = p.categories.map((c) => catLabel[c] ?? c);
  const eager = index < EAGER_COUNT;
  const when = p.period ?? p.year;
  // Haystack for the live search (lower-cased by the script): title, client, organisation, category
  // labels, summary and every technology (not only the ones shown).
  const haystack = [p.title, p.subtitle, p.client, p.organization, p.period, ...categoryLabels, p.summary, ...p.technologies].filter(Boolean).join(' ');
  return html`
      <li data-reveal>
        <article class="project-card card projects-card" data-tilt data-project-card data-group="${p.group}" data-flagship="${p.flagship ? 'true' : 'false'}" data-order="${p.order}" data-categories="${p.categories.join(' ')}" data-title="${p.title}" data-tags="${p.technologies.map((t) => t.toLowerCase()).join('|')}" data-search-text="${haystack}">
          <div class="project-card__media">
            <img src="${url(p.cover.src)}" width="${width}" height="${height}" alt="${p.cover.alt}" decoding="async"${eager ? '' : html` loading="lazy"`}>
          </div>
          <div class="project-card__body">
            <div class="project-card__meta">
              <span class="projects-card__badges">
                <span class="badge badge--accent">${categoryLabels[0]}</span>
                ${categoryLabels.slice(1).map((label) => html`<span class="badge projects-card__badge-more">${label}</span>`)}
                ${p.flagship ? html`<span class="badge badge--featured">${icon('sparkles', { size: 12 })}${LABELS.featuredBadge}</span>` : ''}
              </span>
              ${when ? html`<span class="project-card__year">${when}</span>` : ''}
            </div>
            <h3 class="project-card__title"><a class="project-card__link" href="${url(`projects/${p.slug}.html`)}">${p.title}</a></h3>
            <p class="project-card__client">${icon('briefcase', { size: 15 })}<span>${p.client}${when ? html`<span class="projects-card__when"> · ${when}</span>` : ''}</span></p>
            <p class="project-card__summary">${p.summary}</p>
            <ul class="tag-list project-card__tags" aria-label="${LABELS.tags}">
              ${shown.map((t) => html`<li class="tag">${t}</li>`)}
            </ul>
            <span class="project-card__cta link-arrow" aria-hidden="true">${LABELS.cta}</span>
          </div>
        </article>
      </li>`;
}

/** One headed block of cards. `kind` is "featured" or a group id; JS moves cards between lists when filtering. */
function block(ctx, { kind, eyebrow, title, projects, firstIndex }) {
  return html`
    <section class="projects-group projects-group--${kind}" data-group-section="${kind}" aria-labelledby="projects-${kind}-title"${projects.length ? '' : raw(' hidden')}>
      <header class="section-head projects-group__head">
        <p class="eyebrow"><span class="eyebrow__label">${eyebrow}</span></p>
        <h2 class="section-title projects-group__title" id="projects-${kind}-title">${title}<span class="projects-group__count" data-group-count>${projects.length}</span></h2>
      </header>
      <ul class="project-grid projects-grid projects-grid--${kind}" role="list" data-project-grid data-group-list="${kind}">
        ${projects.map((p, i) => card(ctx, p, firstIndex + i))}
      </ul>
    </section>`;
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
  const { site, projects, categories, flagshipProjects, projectGroups } = ctx;
  // Default (and no-JS) layout: flagship projects in the Featured block, the rest in their group.
  const rest = (g) => g.projects.filter((p) => !p.flagship);
  const blocks = [
    block(ctx, { kind: 'featured', eyebrow: LABELS.featured.eyebrow, title: LABELS.featured.title, projects: flagshipProjects, firstIndex: 0 }),
    ...projectGroups.map((g) => block(ctx, { kind: g.id, eyebrow: LABELS.groupEyebrow, title: g.label, projects: rest(g), firstIndex: EAGER_COUNT })),
  ];
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
    <div class="projects-body" data-projects data-view="grid">
      ${blocks}
    </div>
    ${emptyState()}
  </div>
</section>`,
  };
}
