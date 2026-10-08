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
 * Without JS every card is visible and the filter UI is hidden by `.no-js` rules in projects.css.
 */
import { $, $$, on, debounce, prefersReducedMotion } from '../modules/core.js';

const grid = $('[data-project-grid]');
const bar = $('[data-filter-bar]');
const input = $('[data-search]');

if (grid && bar && input) init();

function init() {
  const form = input.closest('form');
  const countEl = $('[data-result-count]');
  const resetBtns = $$('[data-reset]');
  const emptyEl = $('[data-empty]');
  const emptyTitle = $('[data-empty-title]');
  const chips = $$('[data-filter]', bar);
  const labels = new Map(chips.map((c) => [c.dataset.filter, c.firstChild.textContent.trim()]));

  /** Lower-case, accent-free, trimmed: the same normalisation for haystacks and queries. */
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const items = $$('[data-project-card]', grid).map((el) => ({
    el,
    li: el.closest('li'),
    cats: (el.dataset.categories ?? '').split(/\s+/).filter(Boolean),
    hay: norm(`${el.dataset.searchText ?? ''} ${el.dataset.title ?? ''} ${(el.dataset.tags ?? '').replaceAll('|', ' ')}`),
  }));
  const total = items.length;

  const state = { filter: 'all', q: '' };
  const tokens = () => norm(state.q).split(/\s+/).filter(Boolean);
  const isFiltered = () => state.filter !== 'all' || tokens().length > 0;

  const matches = (item, filter, words) =>
    (filter === 'all' || item.cats.includes(filter)) && words.every((w) => item.hay.includes(w));

  // ------------------------------------------------------------------ URL
  /** Read ?filter / ?q, falling back to legacy hashes (#ai, #filter-ai, #portfolio-ai). */
  function readUrl() {
    const params = new URLSearchParams(location.search);
    let filter = (params.get('filter') ?? '').toLowerCase();
    let fromHash = false;
    if (!labels.has(filter)) {
      const hash = decodeURIComponent(location.hash.slice(1)).toLowerCase().replace(/^(?:portfolio-|filter-)/, '');
      filter = labels.has(hash) ? hash : 'all';
      fromHash = filter !== 'all';
    }
    return { filter, q: (params.get('q') ?? '').trim().slice(0, 80), fromHash };
  }

  function writeUrl({ clearHash = false } = {}) {
    try {
      const url = new URL(location.href);
      if (state.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', state.filter);
      if (tokens().length) url.searchParams.set('q', state.q.trim());
      else url.searchParams.delete('q');
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

  /** The grid just got shorter: if the reader had scrolled into it, bring the first result back under the sticky bar. */
  function keepResultsInView() {
    const bar = $('[data-toolbar]');
    if (!bar) return;
    const barBottom = bar.getBoundingClientRect().bottom;
    const gap = grid.getBoundingClientRect().top - barBottom;
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

    const setVisibility = () => {
      lis.forEach((li) => { li.hidden = !keep.has(li); });
      if (emptyEl) emptyEl.hidden = keep.size > 0;
    };

    if (instant) {
      setVisibility();
      return;
    }

    // From here on the grid is "live": the scroll-reveal styles must not fight the animations below.
    grid.dataset.live = '';

    const leaving = shown.filter((li) => !keep.has(li));
    const staying = shown.filter((li) => keep.has(li));
    const entering = lis.filter((li) => keep.has(li) && li.hidden);
    if (!leaving.length && !entering.length) return; // same set: nothing moves

    // 1) leaving cards fade out while the layout is still intact
    if (leaving.length) {
      await settled(leaving.map((li) => play(li, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 150, easing: 'ease-out', fill: 'forwards' })));
      if (id !== runId) return; // superseded: the newer run cancels these animations
    }

    // 2) change the layout, then glide the survivors from their old cell and fade the newcomers in
    setVisibility();
    cancelRunning();
    const slide = { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' };
    for (const li of staying) {
      const a = first.get(li);
      const b = li.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) play(li, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], slide);
    }
    entering.forEach((li, i) => {
      play(li, [{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], {
        duration: 420, delay: Math.min(i, 8) * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards',
      });
    });
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

  // ------------------------------------------------------------------ events
  on(bar, 'click', (event) => {
    const chip = event.target instanceof Element ? event.target.closest('[data-filter]') : null;
    if (chip && chip.dataset.filter !== state.filter) setState({ filter: chip.dataset.filter });
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
  input.value = state.q;
  apply({ animate: false });
  // Normalise the address bar once: drop a legacy hash / invalid params, keep valid ones.
  if (initial.fromHash || location.search) writeUrl({ clearHash: initial.fromHash });
}
