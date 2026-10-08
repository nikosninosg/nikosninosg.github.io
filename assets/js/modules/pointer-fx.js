/**
 * pointer-fx.js: pointer driven effects for mouse / trackpad / pen (never touch, never reduced motion).
 * Hook contract: src/COMPONENTS.md section 2.6.
 *
 *   .card, [data-spotlight]   --mx / --my (px, relative to the element) + .is-spotlit
 *   [data-tilt]               --tilt-x / --tilt-y (deg), --glare-x / --glare-y (%), .is-tilting, .is-tilt-on
 *                             data-tilt-max="6" (deg), data-tilt-glare (adds a .tilt-glare child)
 *   [data-magnetic]           --magnet-x / --magnet-y (px)
 *                             data-magnetic-strength=".25", data-magnetic-max="12" (px), data-magnetic-pad="28" (px)
 *
 * One passive pointermove listener on document; all work happens in a single rAF per frame, and
 * every layout read is done before the first write. Nothing here attaches listeners per element.
 */
import { prefersReducedMotion, finePointer } from './core.js';

const SPOT_SELECTOR = '.card, [data-spotlight]';
const DEFAULTS = { tiltMax: 6, magnetStrength: 0.25, magnetMax: 12, magnetPad: 28 };
const TILT_SETTLE_MS = 750; // a bit longer than the 650ms return transition in pointer.css

const num = (value, fallback) => (Number.isFinite(parseFloat(value)) ? parseFloat(value) : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let last = null; // { x, y, target } of the latest pointer position, null when the pointer left the window
let frame = 0;
let spotEl = null;
let tiltEl = null;
const tiltTimers = new WeakMap();
const magnets = new Map(); // el -> { x, y } offset currently applied

const enabled = () => finePointer() && !prefersReducedMotion();

// ---------------------------------------------------------------------------
// Spotlight
// ---------------------------------------------------------------------------
function setSpotlight(hit) {
  const el = hit?.closest?.(SPOT_SELECTOR) ?? null;
  if (el !== spotEl) {
    spotEl?.classList.remove('is-spotlit'); // --mx/--my stay, so the glow fades out where it was
    el?.classList.add('is-spotlit');
    spotEl = el;
  }
  if (el) {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(last.x - r.left).toFixed(1)}px`);
    el.style.setProperty('--my', `${(last.y - r.top).toFixed(1)}px`);
  }
}

// ---------------------------------------------------------------------------
// Tilt
// ---------------------------------------------------------------------------
function ensureGlare(el) {
  if (!el.hasAttribute('data-tilt-glare') || el.querySelector(':scope > .tilt-glare')) return;
  const glare = document.createElement('span');
  glare.className = 'tilt-glare';
  glare.setAttribute('aria-hidden', 'true');
  el.append(glare);
}

function releaseTilt(el) {
  el.classList.remove('is-tilting');
  el.style.setProperty('--tilt-x', '0deg');
  el.style.setProperty('--tilt-y', '0deg');
  // `is-tilt-on` keeps the 3D transform (and will-change) alive until the eased return finished, then
  // the element goes back to `transform: none` so its text is rasterised crisply at rest.
  clearTimeout(tiltTimers.get(el));
  tiltTimers.set(
    el,
    setTimeout(() => {
      if (el.classList.contains('is-tilting')) return;
      // Drop the 3D transform without animating "perspective(900px)" -> "none" (visually identical, but it
      // would otherwise run one more 650ms transition and keep the compositor layer alive).
      el.style.transition = 'none';
      el.classList.remove('is-tilt-on');
      void el.offsetWidth; // flush so the change applies without a transition
      el.style.transition = '';
    }, TILT_SETTLE_MS),
  );
}

function setTilt(hit) {
  const el = hit?.closest?.('[data-tilt]') ?? null;
  if (el !== tiltEl) {
    if (tiltEl) releaseTilt(tiltEl);
    tiltEl = el;
    if (el) {
      clearTimeout(tiltTimers.get(el));
      ensureGlare(el);
      el.classList.add('is-tilt-on', 'is-tilting');
    }
  }
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const max = num(el.dataset.tiltMax, DEFAULTS.tiltMax);
  const px = clamp((last.x - r.left) / r.width, 0, 1);
  const py = clamp((last.y - r.top) / r.height, 0, 1);
  el.style.setProperty('--tilt-x', `${((0.5 - py) * 2 * max).toFixed(2)}deg`); // pointer low -> top edge tips back
  el.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
  el.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
  el.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
}

// ---------------------------------------------------------------------------
// Magnetic
// ---------------------------------------------------------------------------
function updateMagnets() {
  const els = document.querySelectorAll('[data-magnetic]');
  if (!els.length) return;
  // A modal dialog (command palette, lightbox) covers the page: the buttons behind must stay still.
  const blocked = !last || document.querySelector('dialog[open]');

  // Read phase.
  const plan = [];
  for (const el of els) {
    const cur = magnets.get(el) ?? { x: 0, y: 0 };
    if (blocked) {
      if (cur.x || cur.y) plan.push({ el, x: 0, y: 0 });
      continue;
    }
    const r = el.getBoundingClientRect();
    const pad = num(el.dataset.magneticPad, DEFAULTS.magnetPad);
    // Centre of the element *without* the offset we applied, so the effect cannot feed back on itself.
    const cx = r.left + r.width / 2 - cur.x;
    const cy = r.top + r.height / 2 - cur.y;
    const near = last.x > r.left - pad - cur.x && last.x < r.right + pad - cur.x && last.y > r.top - pad - cur.y && last.y < r.bottom + pad - cur.y;
    let x = 0;
    let y = 0;
    if (near) {
      const strength = num(el.dataset.magneticStrength, DEFAULTS.magnetStrength);
      const max = num(el.dataset.magneticMax, DEFAULTS.magnetMax);
      x = clamp((last.x - cx) * strength, -max, max);
      y = clamp((last.y - cy) * strength, -max, max);
    }
    if (Math.abs(x - cur.x) > 0.1 || Math.abs(y - cur.y) > 0.1 || (!x && !y && (cur.x || cur.y))) plan.push({ el, x, y });
  }
  // Write phase.
  for (const { el, x, y } of plan) {
    el.style.setProperty('--magnet-x', `${x.toFixed(1)}px`);
    el.style.setProperty('--magnet-y', `${y.toFixed(1)}px`);
    if (x || y) magnets.set(el, { x, y });
    else magnets.delete(el);
  }
}

// ---------------------------------------------------------------------------
// Frame loop + events
// ---------------------------------------------------------------------------
function clearAll() {
  last = null;
  setSpotlight(null);
  setTilt(null);
  updateMagnets();
}

function run() {
  frame = 0;
  if (!enabled()) return clearAll();
  const hit = last?.target ?? null;
  if (last) {
    setSpotlight(hit);
    setTilt(hit);
  }
  updateMagnets();
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(run);
};

function onMove(event) {
  if (event.pointerType === 'touch') return;
  last = { x: event.clientX, y: event.clientY, target: event.target };
  schedule();
}

function onScroll() {
  // The page moved under a stationary pointer: re-hit-test at the same coordinates.
  if (!last) return;
  last.target = document.elementFromPoint(last.x, last.y);
  schedule();
}

export function init() {
  if (!('PointerEvent' in window)) return;
  document.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  // Pointer left the window (relatedTarget is null) or the tab lost focus: reset everything.
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget && event.pointerType !== 'touch') {
      clearAll();
    }
  });
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => document.hidden && clearAll());
  // Switching to reduced motion / a touch-only mode while the page is open.
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', clearAll);
}
