/**
 * pages/projects.js: category filter + live search for the project grid.
 *
 *  - Chips ([data-filter]) and the search box ([data-search]) combine: a card shows when it is in the
 *    chosen category AND every word of the query is found in its haystack (title, client, organisation,
 *    category labels, summary, all technologies; accents and case ignored).
 *  - FLIP animation: leaving cards fade out, the cards that stay glide to their new grid cell, entering
 *    cards fade/scale in. Reduced motion = instant. A new change interrupts a running one cleanly.
 *  - URL sync with history.replaceState: ?filter=ai&q=python. Honoured on load; old-style hashes
 *    (#ai, #filter-web ...) are mapped to ?filter= and removed from the address bar.
 *  - Keyboard: Left/Right/Home/End move between chips, Esc clears the search. ("/" opens the command
 *    palette, so it is deliberately not bound here.)
 *
 * Structure: a Featured block (flagship cards) + one list per group (professional, academic). Every card
 * is one <li> that this script moves between lists: while at least two flagship projects match, they live
 * in the Featured block; otherwise they drop into their own group as ordinary cards. Empty sections hide and
 * the counts in the headings follow the visible cards.
 *
 *  - View toggle (grid / list): [data-view-toggle] buttons set [data-projects][data-view]; persisted in
 *    localStorage ('projects-view') and ?view=list (URL wins over storage). Switching crossfades.
 *
 * Without JS every card is visible, grouped, and the filter/toggle UI is hidden by `.no-js` rules in projects.css.
 */
import { $, $$, on, debounce, prefersReducedMotion } from '../modules/core.js';

const VIEW_KEY = 'projects-view';
/** Flagship cards stay in the Featured block only while at least this many of them match. */
const MIN_FEATURED = 2;

const root = $('[data-projects]');
const bar = $('[data-filter-bar]');
const input = $('[data-search]');

if (root && bar && input) init();

function init() {
  const form = input.closest('form');
  const countEl = $('[data-result-count]');
  const resetBtns = $$('[data-reset]');
  const emptyEl = $('[data-empty]');
  const emptyTitle = $('[data-empty-title]');
  const chips = $$('[data-filter]', bar);
  const viewBtns = $$('[data-view]', bar);
  const labels = new Map(chips.map((c) => [c.dataset.filter, c.firstChild.textContent.trim()]));

  /** Lower-case, accent-free, trimmed: the same normalisation for haystacks and queries. */
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  // Sections: "featured" + one per group, each with its own list and live count.
  const sections = $$('[data-group-section]', root).map((el) => ({
    id: el.dataset.groupSection,
    el,
    list: $('[data-group-list]', el),
    count: $('[data-group-count]', el),
  }));
  const listOf = Object.fromEntries(sections.map((sec) => [sec.id, sec.list]));

  const items = $$('[data-project-card]', root).map((el) => ({
    el,
    li: el.closest('li'),
    cats: (el.dataset.categories ?? '').split(/\s+/).filter(Boolean),
    group: el.dataset.group,
    flagship: el.dataset.flagship === 'true',
    order: Number(el.dataset.order) || 0,
    hay: norm(`${el.dataset.searchText ?? ''} ${el.dataset.title ?? ''} ${(el.dataset.tags ?? '').replaceAll('|', ' ')}`),
  }));
  const total = items.length;

  const state = { filter: 'all', q: '', view: 'grid' };
  const tokens = () => norm(state.q).split(/\s+/).filter(Boolean);
  const isFiltered = () => state.filter !== 'all' || tokens().length > 0;

  const matches = (item, filter, words) =>
    (filter === 'all' || item.cats.includes(filter)) && words.every((w) => item.hay.includes(w));

  // ------------------------------------------------------------------ view (persisted)
  const readStoredView = () => {
    try {
      return localStorage.getItem(VIEW_KEY);
    } catch {
      return null;
    }
  };
  const storeView = (view) => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* private mode: the choice just will not stick */
    }
  };
  const validView = (v) => (v === 'list' || v === 'grid' ? v : null);

  // ------------------------------------------------------------------ URL
  /** Read ?filter / ?q / ?view, falling back to legacy hashes (#ai, #filter-ai, #portfolio-ai). */
  function readUrl() {
    const params = new URLSearchParams(location.search);
    let filter = (params.get('filter') ?? '').toLowerCase();
    let fromHash = false;
    if (!labels.has(filter)) {
      const hash = decodeURIComponent(location.hash.slice(1)).toLowerCase().replace(/^(?:portfolio-|filter-)/, '');
      filter = labels.has(hash) ? hash : 'all';
      fromHash = filter !== 'all';
    }
    return { filter, q: (params.get('q') ?? '').trim().slice(0, 80), view: validView(params.get('view')), fromHash };
  }

  function writeUrl({ clearHash = false } = {}) {
    try {
      const url = new URL(location.href);
      if (state.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', state.filter);
      if (tokens().length) url.searchParams.set('q', state.q.trim());
      else url.searchParams.delete('q');
      if (state.view === 'list') url.searchParams.set('view', 'list');
      else url.searchParams.delete('view');
      if (clearHash) url.hash = '';
      history.replaceState(history.state, '', url);
    } catch {
      /* sandboxed / file:// previews: the URL is a nicety, never a requirement */
    }
  }

  // ------------------------------------------------------------------ UI that follows the state
  const plural = (n) => `${n} project${n === 1 ? '' : 's'}`;

  function paintControls(visibleCount) {
    const words = tokens();
    for (const chip of chips) {
      const id = chip.dataset.filter;
      chip.setAttribute('aria-pressed', String(id === state.filter));
      // Facet counts follow the search, so a chip always tells how many results it would give.
      const n = items.filter((it) => matches(it, id, words)).length;
      const badge = $('.chip__count', chip);
      if (badge) badge.textContent = String(n);
      chip.toggleAttribute('data-none', n === 0);
    }
    if (countEl) countEl.textContent = isFiltered() ? `${visibleCount} of ${plural(total)}` : plural(total);
    resetBtns.forEach((btn) => {
      if (!btn.closest('[data-empty]')) btn.hidden = !isFiltered();
    });
    if (emptyTitle) {
      const q = state.q.trim();
      const cat = state.filter === 'all' ? '' : ` in ${labels.get(state.filter)}`;
      emptyTitle.textContent = `No projects match${q ? ` “${q}”` : ''}${cat}`;
    }
  }

  function paintView() {
    root.dataset.view = state.view;
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  }

  /**
   * Put every card in its list (Featured block or own group), ordered by `order`, and hide what does not
   * match. Counts and section visibility follow. Moving a node keeps it alive (focus, image, listeners).
   */
  function place(keep) {
    const featuredOn = items.filter((it) => it.flagship && keep.has(it.li)).length >= MIN_FEATURED && !!listOf.featured;
    const buckets = new Map(sections.map((sec) => [sec.id, []]));
    for (const it of items) {
      const target = featuredOn && it.flagship ? 'featured' : it.group;
      (buckets.get(target) ?? buckets.get(it.group)).push(it);
    }
    for (const sec of sections) {
      const list = buckets.get(sec.id).sort((a, b) => a.order - b.order);
      list.forEach((it, i) => {
        if (sec.list.children[i] !== it.li) sec.list.insertBefore(it.li, sec.list.children[i] ?? null);
      });
      let visible = 0;
      for (const it of list) {
        it.li.hidden = !keep.has(it.li);
        if (!it.li.hidden) visible++;
      }
      sec.el.hidden = visible === 0;
      if (sec.count) sec.count.textContent = String(visible);
    }
    if (emptyEl) emptyEl.hidden = keep.size > 0;
  }

  // ------------------------------------------------------------------ applying a change
  let runId = 0;
  let running = [];
  const cancelRunning = () => {
    running.forEach((a) => a.cancel());
    running = [];
  };
  const play = (el, keyframes, options) => {
    const anim = el.animate(keyframes, options);
    running.push(anim);
    return anim;
  };
  const settled = (anims) => Promise.allSettled(anims.map((a) => a.finished));

  /** The page just got shorter: if the reader had scrolled into it, bring the first result back under the sticky bar. */
  function keepResultsInView() {
    const toolbar = $('[data-toolbar]');
    if (!toolbar) return;
    const gap = root.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom;
    if (gap < 0) window.scrollBy({ top: gap - 16, behavior: 'smooth' });
  }

  async function apply({ animate = true } = {}) {
    const id = ++runId;
    const words = tokens();
    const keep = new Set(items.filter((it) => matches(it, state.filter, words)).map((it) => it.li));
    paintControls(keep.size);

    const lis = items.map((it) => it.li);
    const shown = lis.filter((li) => !li.hidden);
    const instant = !animate || prefersReducedMotion() || document.hidden || shown.length === 0;

    // FLIP "first": measured *before* cancelling anything, so an interrupted glide continues from where it is.
    const first = new Map(shown.map((li) => [li, li.getBoundingClientRect()]));
    cancelRunning();

    if (instant) {
      place(keep);
      return;
    }

    // From here on the grid is "live": the scroll-reveal styles must not fight the animations below.
    root.dataset.live = '';

    const leaving = shown.filter((li) => !keep.has(li));
    const staying = shown.filter((li) => keep.has(li));
    const entering = lis.filter((li) => keep.has(li) && li.hidden);

    // 1) leaving cards fade out while the layout is still intact
    if (leaving.length) {
      await settled(leaving.map((li) => play(li, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 150, easing: 'ease-out', fill: 'forwards' })));
      if (id !== runId) return; // superseded: the newer run cancels these animations
    }

    // 2) change the layout, then glide the survivors from their old cell and fade the newcomers in.
    //    A card that changed size (Featured <-> regular) cannot glide cleanly: it fades in instead.
    place(keep);
    cancelRunning();
    const slide = { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' };
    const fadeIn = (li, i) =>
      play(li, [{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], {
        duration: 420, delay: Math.min(i, 8) * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards',
      });
    let n = 0;
    for (const li of staying) {
      const a = first.get(li);
      const b = li.getBoundingClientRect();
      if (Math.abs(a.width - b.width) > 8) {
        fadeIn(li, n++);
        continue;
      }
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) play(li, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], slide);
    }
    entering.forEach((li) => fadeIn(li, n++));
    keepResultsInView();
    if (!keep.size && emptyEl) {
      // `fill: backwards` keeps the first frame during the delay
      emptyEl.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
    }
  }

  function setState(next, { animate = true, clearHash = false } = {}) {
    state.filter = next.filter ?? state.filter;
    state.q = next.q ?? state.q;
    if (input.value !== state.q) input.value = state.q;
    writeUrl({ clearHash });
    return apply({ animate });
  }

  /** Grid <-> list: the cards change shape completely, so crossfade the whole body instead of gliding each card. */
  function setView(view, { animate = true, persist = true } = {}) {
    if (view === state.view) return;
    state.view = view;
    if (persist) storeView(view);
    writeUrl();
    cancelRunning();
    paintView();
    if (!animate || prefersReducedMotion() || document.hidden) return;
    root.dataset.live = '';
    play(root, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  // ------------------------------------------------------------------ events
  on(bar, 'click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const chip = target?.closest('[data-filter]');
    if (chip && chip.dataset.filter !== state.filter) setState({ filter: chip.dataset.filter });
    const view = target?.closest('[data-view]');
    if (view && validView(view.dataset.view)) setView(view.dataset.view);
  });

  // Left/Right/Home/End move focus between the chips (they stay individually tabbable: they are toggles).
  on(bar, 'keydown', (event) => {
    const current = event.target instanceof Element ? event.target.closest('[data-filter]') : null;
    if (!current || event.altKey || event.ctrlKey || event.metaKey) return;
    const i = chips.indexOf(current);
    const target = { ArrowRight: chips[(i + 1) % chips.length], ArrowLeft: chips[(i - 1 + chips.length) % chips.length], Home: chips[0], End: chips.at(-1) }[event.key];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  });

  const onType = debounce(() => setState({ q: input.value }), 120);
  on(input, 'input', onType);
  on(input, 'keydown', (event) => {
    if (event.key !== 'Escape' || !input.value) return;
    event.preventDefault();
    onType.cancel();
    setState({ q: '' });
  });
  // "Search" key on mobile keyboards: apply now and dismiss the keyboard.
  on(form, 'submit', (event) => {
    event.preventDefault();
    onType.cancel();
    setState({ q: input.value });
    input.blur();
  });

  resetBtns.forEach((btn) =>
    on(btn, 'click', () => {
      onType.cancel();
      setState({ filter: 'all', q: '' });
      // The button that was clicked is about to hide: park focus on the "All" chip.
      chips[0]?.focus({ preventScroll: true });
    }),
  );

  // In-page navigation to projects.html#ai (e.g. a link on this page) while already here.
  on(window, 'hashchange', () => {
    const { filter, fromHash } = readUrl();
    if (fromHash && filter !== state.filter) setState({ filter }, { clearHash: true });
  });

  // ------------------------------------------------------------------ initial state
  const initial = readUrl();
  state.filter = initial.filter;
  state.q = initial.q;
  state.view = initial.view ?? validView(readStoredView()) ?? 'grid';
  input.value = state.q;
  paintView();
  apply({ animate: false });
  // Normalise the address bar once: drop a legacy hash / invalid params, keep valid ones.
  if (initial.fromHash || location.search) writeUrl({ clearHash: initial.fromHash });
}
