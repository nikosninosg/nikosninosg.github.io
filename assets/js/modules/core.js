/**
 * core.js: tiny shared utilities + the toast and copy-to-clipboard components.
 * Other modules and page scripts import from here:  import { $, on, toast } from '../modules/core.js'
 */

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
/** querySelector shorthand. */
export const $ = (selector, root = document) => root.querySelector(selector);
/** querySelectorAll -> real array. */
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** addEventListener that returns an unsubscribe function. */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/**
 * Event delegation: handler(event, matchedElement) for events whose target is inside `selector`.
 * Returns an unsubscribe function.
 */
export function delegate(root, type, selector, handler, options) {
  const listener = (event) => {
    const start = event.target instanceof Element ? event.target : null;
    const match = start?.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  };
  root.addEventListener(type, listener, options);
  return () => root.removeEventListener(type, listener, options);
}

/** Run fn once the DOM is parsed (immediately if it already is). */
export function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
/** Live check (the user can change the OS setting while the page is open). */
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** True for mouse/trackpad devices; tilt / magnetic / spotlight effects are gated on this. */
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** localStorage that never throws (private mode, blocked storage, previews). */
export const storage = {
  get(key, fallback = null) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// ---------------------------------------------------------------------------
// Timing / maths
// ---------------------------------------------------------------------------
/** Coalesce calls to at most one per animation frame (uses the latest arguments). */
export function rafThrottle(fn) {
  let frame = 0;
  let lastArgs;
  const throttled = (...args) => {
    lastArgs = args;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fn(...lastArgs);
    });
  };
  throttled.cancel = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  return throttled;
}

export function debounce(fn, wait = 150) {
  let timer = 0;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Map value from [inMin, inMax] to [outMin, outMax] (not clamped). */
export const mapRange = (value, inMin, inMax, outMin, outMax) => outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * IntersectionObserver convenience: cb(entry, observer) when `el` enters the viewport.
 * With once:true (default) the element is unobserved after the first hit. Falls back to calling
 * cb immediately where IntersectionObserver is unavailable. Returns a disconnect function.
 */
export function inView(el, cb, { threshold = 0.15, rootMargin = '0px 0px -8% 0px', once = true } = {}) {
  if (!('IntersectionObserver' in window)) {
    cb({ target: el, isIntersecting: true, intersectionRatio: 1 }, null);
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        cb(entry, observer);
        if (once) observer.unobserve(entry.target);
      }
    },
    { threshold, rootMargin },
  );
  observer.observe(el);
  return () => observer.disconnect();
}

// ---------------------------------------------------------------------------
// Toast: window.toast(message, { type: 'info'|'success'|'error', duration })
// ---------------------------------------------------------------------------
const MAX_TOASTS = 3;
let toastRegion = null;

function ensureToastRegion() {
  if (toastRegion?.isConnected) return toastRegion;
  toastRegion = document.createElement('div');
  toastRegion.className = 'toast-region';
  toastRegion.setAttribute('data-toast-region', '');
  toastRegion.setAttribute('role', 'status');
  toastRegion.setAttribute('aria-live', 'polite');
  toastRegion.setAttribute('aria-atomic', 'false');
  document.body.append(toastRegion);
  return toastRegion;
}

/** Show a short message. Uses textContent only (never HTML). Returns the toast element. */
export function toast(message, { type = 'info', duration = 2800 } = {}) {
  const region = ensureToastRegion();
  while (region.children.length >= MAX_TOASTS) region.firstElementChild.remove();

  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.type = type;
  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'toast__message';
  text.textContent = message;
  el.append(icon, text);
  region.append(el);

  // Next frame so the enter transition runs.
  requestAnimationFrame(() => el.classList.add('is-in'));

  const dismiss = () => {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 400);
  };
  const timer = setTimeout(dismiss, duration);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
  return el;
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------
/** Copy text; resolves true/false. Uses the async Clipboard API, falling back to execCommand. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** [data-copy="text"] (or the element's own text when empty) copies on click, then toasts. */
function initCopy() {
  delegate(document, 'click', '[data-copy]', async (event, el) => {
    event.preventDefault();
    const value = el.dataset.copy || el.textContent.trim();
    const ok = await copyText(value);
    if (ok) {
      toast(el.dataset.copyMessage || 'Copied to clipboard', { type: 'success' });
      el.dataset.copied = 'true';
      const label = el.querySelector('[data-copy-label]');
      const original = label?.textContent;
      if (label && el.dataset.copiedLabel) label.textContent = el.dataset.copiedLabel;
      setTimeout(() => {
        delete el.dataset.copied;
        if (label && original !== undefined) label.textContent = original;
      }, 1800);
      el.dispatchEvent(new CustomEvent('copied', { bubbles: true, detail: { value } }));
    } else {
      toast('Could not copy automatically. Please copy it manually.', { type: 'error', duration: 4000 });
    }
  });
}

function greet() {
  if (window.__greeted) return;
  window.__greeted = true;
  console.log(
    '%c Hi there, fellow engineer %c\nThe source is open: https://github.com/nikosninosg/nikosninosg.github.io\nThe site is plain HTML, CSS and JS built by a tiny zero-dependency generator.',
    'background:#2de2c6;color:#05080a;padding:2px 6px;border-radius:4px;font-weight:600',
    'color:inherit',
  );
}

export function init() {
  ensureToastRegion();
  window.toast = toast;
  initCopy();
  greet();
}
