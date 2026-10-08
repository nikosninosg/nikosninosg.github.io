/**
 * header.js: everything that moves in the site chrome.
 *
 *   [data-header]      data-scrolled ("true"/"false"), data-hidden (hide on scroll down, show on scroll up),
 *                      data-nav-open ("true"/"false")
 *   [data-progress]    --progress (0..1), the scroll progress bar
 *   [data-nav-pill]    --pill-x / --pill-w + data-visible: sliding highlight behind the nav links
 *   [data-nav-toggle]  mobile menu (aria-expanded, html.nav-open scroll lock, Esc / outside / link / resize closes)
 *   [data-to-top]      back-to-top button (data-visible after 600px)
 *   [data-kbd-mod]     "Ctrl" -> "⌘" on Apple platforms
 *   [data-spy]         optional in-page scroll-spy: <a href="#id"> links inside it get aria-current="location"
 *
 * All scroll work happens in one rAF-throttled passive listener that reads first and writes second,
 * so scrolling never forces layout. Everything is optional: with JS off the CSS fallbacks take over.
 */
import { $, $$, on, delegate, rafThrottle, debounce, clamp, prefersReducedMotion } from './core.js';

const SCROLLED_AT = 8; // px before the glass bar appears
const HIDE_AFTER = 240; // px of scrolling before the header may hide
const HIDE_DELTA = 6; // px of downward movement that counts as "scrolling down" (filters jitter)
const SHOW_DELTA = 4; // px of upward movement that brings it back
const TO_TOP_AT = 600;
const DESKTOP = '(min-width: 900px)';

const attr = (el, name, value) => {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value); // skip no-op style invalidations
};

export function init() {
  const header = $('[data-header]');
  if (!header) {
    initKbdHints();
    return;
  }
  const nav = $('[data-nav]', header);
  const menu = initMenu(header, nav);
  const pill = initPill(nav);
  initScroll(header, menu);
  initToTop();
  initKbdHints();
  initSpy();
  return { menu, pill };
}

// ---------------------------------------------------------------------------
// Scroll: scrolled state, hide/show, progress bar, back-to-top visibility
// ---------------------------------------------------------------------------
function initScroll(header, menu) {
  const progress = $('[data-progress]', header);
  const toTop = $('[data-to-top]');
  const canHide = header.dataset.hideOnScroll !== 'false'; // pages can opt out with data-hide-on-scroll="false"

  let lastY = window.scrollY;
  let hidden = false;
  let anchorY = lastY; // where the current scroll direction started (hysteresis)
  let direction = 0;
  let lastProgress = -1;
  let focusInside = false;

  const setHidden = (value) => {
    if (value === hidden) return;
    hidden = value;
    if (value) header.setAttribute('data-hidden', 'true');
    else header.removeAttribute('data-hidden');
  };

  const update = () => {
    // reads
    const y = Math.max(0, window.scrollY);
    const max = document.documentElement.scrollHeight - window.innerHeight;

    // writes
    attr(header, 'data-scrolled', y > SCROLLED_AT ? 'true' : 'false');

    if (progress) {
      const value = max > 0 ? clamp(y / max, 0, 1) : 0;
      const rounded = Math.round(value * 1000) / 1000;
      if (rounded !== lastProgress) {
        lastProgress = rounded;
        progress.style.setProperty('--progress', String(rounded));
      }
    }

    if (toTop) attr(toTop, 'data-visible', y > TO_TOP_AT ? 'true' : 'false');

    if (canHide) {
      const dir = Math.sign(y - lastY);
      if (dir !== 0 && dir !== direction) {
        direction = dir;
        anchorY = lastY;
      }
      const travelled = y - anchorY;
      if (y <= HIDE_AFTER || menu.isOpen() || focusInside) setHidden(false);
      else if (direction > 0 && travelled > HIDE_DELTA) setHidden(true);
      else if (direction < 0 && -travelled > SHOW_DELTA) setHidden(false);
    }
    lastY = y;
  };

  const onScroll = rafThrottle(update);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // Content height changes (images, fonts, accordions) move the progress ratio without any scroll.
  if ('ResizeObserver' in window) new ResizeObserver(onScroll).observe(document.body);

  // Keyboard users tabbing into a hidden header must see it (CSS also reveals it on :focus-within).
  on(header, 'focusin', (event) => {
    // :focus-visible = keyboard focus; a mouse-clicked button keeps focus but must not pin the header open.
    focusInside = event.target.matches(':focus-visible');
    if (focusInside) setHidden(false);
  });
  on(header, 'focusout', (event) => {
    if (!header.contains(event.relatedTarget)) focusInside = false;
  });
  // Restored scroll positions (reload, back/forward) arrive before any scroll event.
  window.addEventListener('pageshow', onScroll);

  update();
}

// ---------------------------------------------------------------------------
// Back to top
// ---------------------------------------------------------------------------
function initToTop() {
  delegate(document, 'click', '[data-to-top]', (event) => {
    event.preventDefault();
    // Explicit behaviour: CSS smooth-scroll is already gated on reduced motion, but be self-contained.
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // Move keyboard / screen-reader position to the top of the page content, without a second scroll.
    $('#main')?.focus({ preventScroll: true });
  });
}

// ---------------------------------------------------------------------------
// ⌘ instead of Ctrl on Apple platforms
// ---------------------------------------------------------------------------
function initKbdHints() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  if (!/mac|iphone|ipad|ipod/i.test(platform)) return;
  for (const el of $$('[data-kbd-mod]')) el.textContent = '⌘';
}

// ---------------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------------
function initMenu(header, nav) {
  const toggle = $('[data-nav-toggle]', header);
  const root = document.documentElement;
  const desktop = window.matchMedia(DESKTOP);
  // While the menu is open the rest of the page is made inert so Tab / screen readers stay in the header.
  const backdrop = () => $$('main, footer, [data-to-top]');

  let open = false;
  const isOpen = () => open;

  header.setAttribute('data-nav-open', 'false');
  if (!toggle || !nav) return { isOpen, close() {} };

  const focusables = () =>
    $$('a[href], button:not([disabled])', header).filter((el) => el.offsetParent !== null || el === toggle);

  function setOpen(next, { returnFocus = false } = {}) {
    if (next === open) return;
    open = next;
    header.setAttribute('data-nav-open', String(next));
    root.classList.toggle('nav-open', next);
    toggle.setAttribute('aria-expanded', String(next));
    toggle.setAttribute('aria-label', next ? 'Close menu' : 'Open menu');
    for (const el of backdrop()) el.toggleAttribute('inert', next);

    if (next) {
      // Move focus into the panel (first link, or the current page's link). The panel finishes its
      // opacity/visibility transition in the same frame, so wait one frame before focusing.
      const target = $('.nav-link[aria-current]', nav) || $('.nav-link', nav);
      requestAnimationFrame(() => open && target?.focus({ preventScroll: true }));
    } else if (returnFocus) {
      toggle.focus({ preventScroll: true });
    }
  }

  on(toggle, 'click', () => setOpen(!open, { returnFocus: false }));

  // Link click: let the browser navigate, but close first (same-page anchors / bfcache return).
  delegate(nav, 'click', 'a', () => setOpen(false));

  // Outside press closes. pointerdown (not click) so it also works on inert content, which swallows clicks.
  on(document, 'pointerdown', (event) => {
    if (open && !header.querySelector('.site-header__inner').contains(event.target)) setOpen(false);
  });

  on(document, 'keydown', (event) => {
    if (!open) return;
    if (event.key === 'Escape') {
      // A modal <dialog> (command palette) handles its own Esc.
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setOpen(false, { returnFocus: true });
    } else if (event.key === 'Tab') {
      // Keep Tab cycling inside the header while the menu is open.
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Opening the command palette from inside the open menu: get the menu out of the way first.
  delegate(header, 'click', '[data-palette-open]', () => setOpen(false));

  desktop.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
  // Coming back from bfcache with the menu state frozen open.
  window.addEventListener('pageshow', (event) => event.persisted && setOpen(false));

  return { isOpen, close: () => setOpen(false) };
}

// ---------------------------------------------------------------------------
// Sliding nav pill
// ---------------------------------------------------------------------------
function initPill(nav) {
  const pill = nav && $('[data-nav-pill]', nav);
  if (!pill) return null;
  const links = $$('.nav-link', nav);
  const desktop = window.matchMedia(DESKTOP);
  const active = () => $('.nav-link[aria-current]', nav);

  let hovered = null; // link under the mouse
  let focused = null; // link focused with the keyboard
  let placed = false;

  const target = () => hovered || focused || active();

  /** Measure `link` against the nav (rects, so sub-pixel widths and the pill's own offsets are exact). */
  function place(link, { instant = false } = {}) {
    if (!link || !desktop.matches) {
      pill.removeAttribute('data-visible');
      placed = false;
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    if (!navRect.width || !rect.width) return; // not laid out (hidden / fonts pending): try again later

    // First placement (or reappearing after being hidden) must not slide in from x=0.
    const noSlide = instant || !placed;
    if (noSlide) {
      pill.setAttribute('data-instant', '');
      // Two frames: the zero-duration style has to be applied once before animations come back.
      requestAnimationFrame(() => requestAnimationFrame(() => pill.removeAttribute('data-instant')));
    }
    pill.style.setProperty('--pill-x', `${(rect.left - navRect.left - nav.clientLeft).toFixed(2)}px`);
    pill.style.setProperty('--pill-w', `${rect.width.toFixed(2)}px`);
    pill.setAttribute('data-visible', 'true');
    placed = true;
  }

  const sync = (opts) => place(target(), opts);

  // Pointer: mouse/pen only, a tap on touch must not leave the pill stranded under the finger.
  delegate(nav, 'pointerover', '.nav-link', (event, link) => {
    if (event.pointerType === 'touch') return;
    hovered = link;
    sync();
  });
  on(nav, 'pointerleave', () => {
    hovered = null;
    sync();
  });

  // Keyboard focus follows the pill too; pointer focus (click) does not.
  delegate(nav, 'focusin', '.nav-link', (event, link) => {
    focused = link.matches(':focus-visible') ? link : null;
    sync();
  });
  delegate(nav, 'focusout', '.nav-link', () => {
    focused = null;
    sync();
  });

  // Clicking a link: park the pill there immediately so the cross-document view transition
  // (and the instant before the next page paints) shows the destination as active.
  delegate(nav, 'click', '.nav-link', (_, link) => {
    hovered = link;
    sync();
  });

  // Anything that can change link geometry re-measures without animating.
  const remeasure = rafThrottle(() => sync({ instant: true }));
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(remeasure);
    observer.observe(nav);
    links.forEach((link) => observer.observe(link));
  }
  window.addEventListener('resize', remeasure, { passive: true });
  desktop.addEventListener('change', remeasure);
  window.addEventListener('load', remeasure);
  // Web fonts swap in after first paint and change text widths.
  document.fonts?.ready.then(remeasure);
  document.fonts?.addEventListener?.('loadingdone', debounce(remeasure, 50));
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      hovered = focused = null;
      sync({ instant: true });
    }
  });

  sync({ instant: true });
  return { sync };
}

// ---------------------------------------------------------------------------
// Optional scroll-spy: <nav data-spy><a href="#a">..</a></nav> marks the link of the section in view
// ---------------------------------------------------------------------------
function initSpy() {
  const containers = $$('[data-spy]');
  if (!containers.length || !('IntersectionObserver' in window)) return;

  for (const container of containers) {
    const entries = $$('a[href^="#"]', container)
      .map((link) => ({ link, section: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
      .filter((entry) => entry.section);
    if (!entries.length) continue;

    const visible = new Set();
    const mark = () => {
      // The last section (document order) that touches the reading band wins.
      const current = [...entries].reverse().find((entry) => visible.has(entry.section));
      for (const { link } of entries) {
        if (current && link === current.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    };

    // A thin band ~18% down the viewport (just under the header, where anchor jumps land): whichever section covers it is "current".
    const observer = new IntersectionObserver(
      (changes) => {
        for (const change of changes) {
          if (change.isIntersecting) visible.add(change.target);
          else visible.delete(change.target);
        }
        mark();
      },
      { rootMargin: '-18% 0px -77% 0px', threshold: 0 },
    );
    entries.forEach(({ section }) => observer.observe(section));
  }
}
