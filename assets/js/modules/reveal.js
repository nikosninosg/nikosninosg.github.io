/**
 * reveal.js: scroll reveal, count-up numbers and the scroll-driven timeline.
 * Hook contract: src/COMPONENTS.md section 2.5 and "Changes by JS agents".
 *
 *   [data-reveal]            up (default) | left | right | zoom | fade, `.is-visible` is added once
 *   [data-delay="120"]       extra delay in ms          -> --reveal-delay
 *   [data-reveal-stagger]    parent: direct [data-reveal] children get a cascading delay
 *   [data-count="16"]        count-up (data-suffix, data-decimals, data-duration, data-locale)
 *   [data-timeline]          writes --timeline-progress (0..1) and marks .timeline-item.is-active / .is-current
 *
 * Safety model (nothing may ever stay hidden):
 *   - CSS hides [data-reveal] only under html.js.reveal-ready, which this module adds once it is
 *     certain the animation can run (IntersectionObserver available, no reduced motion).
 *   - Elements already on screen (or scrolled past) at init are marked visible BEFORE the class is
 *     added, so nothing flashes.
 *   - If the observer never reports back within 4s, everything is revealed.
 *   - Printing reveals everything; going reduced-motion at runtime reveals everything.
 */
import { $, $$, clamp, prefersReducedMotion, rafThrottle } from './core.js';

const FALLBACK_MS = 4000;
const DEFAULT_STAGGER = 70; // ms between siblings of a [data-reveal-stagger] parent
const MAX_STAGGER = 560; // cap for the static (index based) delay

const root = document.documentElement;
const num = (value, fallback) => (Number.isFinite(parseFloat(value)) ? parseFloat(value) : fallback);

let revealIO = null;
let sawIOCallback = false;
const pending = new Set(); // [data-reveal] elements not shown yet

// ---------------------------------------------------------------------------
// Reveal
// ---------------------------------------------------------------------------
function show(el) {
  el.classList.add('is-visible');
  pending.delete(el);
  revealIO?.unobserve(el);
}

function showAll() {
  for (const el of [...pending]) show(el);
  revealIO?.disconnect();
}

/**
 * Write --reveal-index / --reveal-delay. Stagger parents give each direct [data-reveal] child a
 * static index based delay (used for the first paint); while scrolling it is refined per batch
 * (see onReveal) so a card in row 3 does not wait for the six cards above it.
 */
function assignDelays(scope) {
  for (const parent of $$('[data-reveal-stagger]', scope)) {
    const step = num(parent.dataset.stagger, DEFAULT_STAGGER);
    let index = 0;
    for (const child of parent.children) {
      if (!child.hasAttribute('data-reveal')) continue;
      child.style.setProperty('--reveal-index', index);
      if (!child.hasAttribute('data-delay')) child.style.setProperty('--reveal-delay', `${Math.min(index * step, MAX_STAGGER)}ms`);
      index += 1;
    }
  }
  for (const el of $$('[data-reveal][data-delay]', scope)) {
    el.style.setProperty('--reveal-delay', `${Math.max(0, num(el.dataset.delay, 0))}ms`);
  }
}

function onReveal(entries) {
  sawIOCallback = true;
  const hits = entries.filter((e) => e.isIntersecting).map((e) => e.target);
  if (!hits.length) return;

  // Cascade siblings that appear in the same batch (same stagger parent), in document order.
  const groups = new Map();
  for (const el of hits) {
    const parent = el.parentElement;
    if (!parent?.hasAttribute('data-reveal-stagger') || el.hasAttribute('data-delay')) continue;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  }
  for (const [parent, list] of groups) {
    const step = num(parent.dataset.stagger, DEFAULT_STAGGER);
    list.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    list.forEach((el, i) => el.style.setProperty('--reveal-delay', `${Math.min(i * step, MAX_STAGGER)}ms`));
  }
  hits.forEach(show);
}

/**
 * IntersectionObserver never reports elements that were jumped over (anchor links, fast scrollbar
 * drags): they would stay hidden above the viewport. This cheap scroll check catches them.
 */
const sweepAbove = rafThrottle(() => {
  for (const el of [...pending]) {
    if (el.getBoundingClientRect().bottom < 0) show(el);
  }
  if (!pending.size) window.removeEventListener('scroll', sweepAbove);
});

/** Start observing [data-reveal] elements inside `scope`. Safe to call again for dynamic content. */
export function refresh(scope = document) {
  const els = $$('[data-reveal]:not(.is-visible)', scope).filter((el) => !pending.has(el));
  if (!els.length) return;
  assignDelays(scope);

  if (!revealIO) {
    // Without IntersectionObserver or with reduced motion there is nothing to animate.
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const vh = window.innerHeight;
  const late = [];
  for (const el of els) {
    // On screen or already scrolled past: visible immediately, no transition, no flash.
    if (el.getBoundingClientRect().top < vh) el.classList.add('is-visible');
    else late.push(el);
  }
  root.classList.add('reveal-ready'); // hide-until-visible starts here (idempotent)
  for (const el of late) {
    pending.add(el);
    revealIO.observe(el);
  }
  if (pending.size) window.addEventListener('scroll', sweepAbove, { passive: true });
}

function initReveal() {
  const animate = !prefersReducedMotion() && 'IntersectionObserver' in window;
  if (animate) {
    // threshold 0 + a small bottom margin: works for elements taller than the viewport too.
    revealIO = new IntersectionObserver(onReveal, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    // Safety net: if the observer is silent (it normally answers once per element right away), reveal all.
    setTimeout(() => {
      if (!sawIOCallback) showAll();
    }, FALLBACK_MS);
  }
  refresh();
  if (animate) root.classList.add('reveal-ready'); // also drives the timeline rail (no-op when refresh() did it)
  window.addEventListener('beforeprint', showAll);

  // The user can switch reduced motion on while the page is open.
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener?.('change', () => {
    if (mql.matches) showAll();
  });
}

// ---------------------------------------------------------------------------
// Count-up
// ---------------------------------------------------------------------------
const easeOutQuart = (t) => 1 - (1 - t) ** 4;
const counters = new WeakMap(); // el -> { frame, original, fmt, target, suffix, duration }

function counterConfig(el) {
  let cfg = counters.get(el);
  if (cfg) return cfg;
  const target = parseFloat(el.dataset.count);
  if (!Number.isFinite(target)) return null;
  const decimals = clamp(Math.round(num(el.dataset.decimals, 0)), 0, 6);
  let fmt;
  try {
    fmt = new Intl.NumberFormat(el.dataset.locale || 'en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } catch {
    fmt = new Intl.NumberFormat('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  cfg = {
    frame: 0,
    // The server-rendered text (final value + suffix) is restored at the end, so it is always exact.
    original: el.textContent,
    format: (value) => `${fmt.format(value)}${el.dataset.suffix ?? ''}`,
    target,
    duration: Math.max(200, num(el.dataset.duration, 1400)),
  };
  counters.set(el, cfg);
  return cfg;
}

function finishCount(el) {
  const cfg = counters.get(el);
  if (!cfg) return;
  cancelAnimationFrame(cfg.frame);
  cfg.frame = 0;
  el.textContent = cfg.original;
}

/** (Re)start the count-up on one element. Restart-safe: a running animation is cancelled first. */
export function countUp(el) {
  const cfg = counterConfig(el);
  if (!cfg) return;
  cancelAnimationFrame(cfg.frame);
  if (prefersReducedMotion()) return finishCount(el);

  // Wait for the element's own reveal delay so number and card appear together.
  const delay = el.closest('[data-reveal]') ? num(getComputedStyle(el.closest('[data-reveal]')).getPropertyValue('--reveal-delay'), 0) : 0;
  const start = performance.now() + delay;
  const tick = (now) => {
    const t = clamp((now - start) / cfg.duration, 0, 1);
    if (t >= 1) return finishCount(el);
    el.textContent = cfg.format(cfg.target * easeOutQuart(t));
    cfg.frame = requestAnimationFrame(tick);
  };
  el.textContent = cfg.format(0);
  cfg.frame = requestAnimationFrame(tick);
}

function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;
  window.addEventListener('beforeprint', () => els.forEach(finishCount));
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return; // keep the final values

  let answered = false;
  const io = new IntersectionObserver(
    (entries) => {
      answered = true;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        countUp(entry.target);
      }
    },
    { threshold: 0.4, rootMargin: '0px 0px -5% 0px' },
  );
  for (const el of els) {
    if (!counterConfig(el)) continue;
    el.textContent = counterConfig(el).format(0);
    io.observe(el);
  }
  // If the observer is silent, never leave zeros on screen.
  setTimeout(() => {
    if (!answered) els.forEach(finishCount);
  }, FALLBACK_MS);
}

// ---------------------------------------------------------------------------
// Timeline: scroll-driven line fill + active items
// ---------------------------------------------------------------------------
/**
 * The "reading line" sits at the viewport centre (override with data-timeline-offset="0.4").
 * progress = how far the line has travelled down the rail; an item is .is-active once its marker
 * is above the line, the last such item is also .is-current.
 */
const timelines = [];
const liveTimelines = new Set();

function updateTimeline(tl) {
  const vh = window.innerHeight;
  const rail = tl.line.getBoundingClientRect();
  let ref = vh * tl.offset;
  // Pinned to the bottom of the page with the whole rail on screen: the line cannot go lower, so finish it.
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  if (atBottom && rail.bottom <= vh) ref = Math.max(ref, rail.bottom);

  const progress = clamp((ref - rail.top) / (rail.height || 1), 0, 1);
  if (Math.abs(progress - tl.progress) > 0.0005) {
    tl.progress = progress;
    tl.el.style.setProperty('--timeline-progress', progress.toFixed(4));
  }

  let current = null;
  for (const item of tl.items) {
    const marker = item.marker.getBoundingClientRect();
    const passed = marker.top + marker.height / 2 <= ref;
    item.el.classList.toggle('is-active', passed);
    item.el.classList.remove('is-current');
    if (passed) current = item.el;
  }
  current?.classList.add('is-current');
}

const updateLive = rafThrottle(() => liveTimelines.forEach(updateTimeline));

function initTimelines() {
  const els = $$('[data-timeline]');
  if (!els.length) return;

  const animate = !prefersReducedMotion();
  for (const el of els) {
    const items = $$('.timeline-item', el).map((item) => ({ el: item, marker: $('.timeline-item__marker', item) ?? item }));
    if (!animate) {
      // Static: CSS keeps the full rail; just mark every stop as reached.
      items.forEach((item) => item.el.classList.add('is-active'));
      continue;
    }
    timelines.push({
      el,
      items,
      line: $('.timeline__line', el) ?? el,
      offset: clamp(num(el.dataset.timelineOffset, 0.5), 0.1, 0.9),
      progress: -1,
    });
  }
  if (!timelines.length) return;

  // Only timelines near the viewport are measured while scrolling.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const tl = timelines.find((t) => t.el === entry.target);
        if (!tl) continue;
        if (entry.isIntersecting) {
          liveTimelines.add(tl);
          updateTimeline(tl);
        } else {
          liveTimelines.delete(tl);
          updateTimeline(tl); // settle at 0 / 1 once it is out of view
        }
      }
    },
    { rootMargin: '25% 0px 25% 0px' },
  );
  timelines.forEach((tl) => io.observe(tl.el));
  timelines.forEach(updateTimeline);

  window.addEventListener('scroll', updateLive, { passive: true });
  window.addEventListener('resize', updateLive, { passive: true });
  // Layout shifts from late fonts / images move the rail: re-measure.
  window.addEventListener('load', updateLive, { once: true });
  document.fonts?.ready.then(updateLive);
}

export function init() {
  initReveal();
  initCounters();
  initTimelines();
}
