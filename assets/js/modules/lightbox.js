/**
 * lightbox.js: accessible image viewer for galleries (loaded by main.js only when [data-lightbox] exists).
 *
 * Markup contract (src/COMPONENTS.md 2.9):
 *   <ul data-lightbox>
 *     <li><a|button data-lightbox-src="full.png" data-lightbox-alt="…" data-lightbox-caption="…"><img …></a></li>
 *   </ul>
 * Every [data-lightbox] container is its own gallery; its [data-lightbox-src] descendants are the slides.
 * Triggers should be real links (href = the image) so that without JS, or with a modified click
 * (ctrl/cmd/shift/middle), the browser simply opens the image itself.
 *
 * Builds ONE <dialog class="lightbox" data-lightbox-dialog> on first use and appends it to <body>.
 *   - native modal <dialog>: inert page behind it, Esc closes, focus is trapped (plus a Tab wrap fallback)
 *   - ArrowLeft / ArrowRight / Home / End, prev + next buttons, wrap-around
 *   - touch: horizontal swipe with drag feedback (vertical scroll and pinch-zoom stay native)
 *   - click on the backdrop (anything that is not image, caption or a button) closes
 *   - neighbours are preloaded, the current image is decoded before it is swapped in (spinner after 160ms)
 *   - scroll lock on <html> without layout jump, focus returns to the thumbnail of the slide you ended on
 *   - opens with a short "grow from the thumbnail" animation; everything animated is skipped under reduced motion
 */

const MAX_UPSCALE = 1.5; // small screenshots may be shown up to 1.5x their pixel size
const SWIPE_DISTANCE = 56; // px
const SWIPE_VELOCITY = 0.5; // px/ms
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const svg = (path) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
const ICONS = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  prev: svg('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5"/>'),
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad2 = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// State (a single viewer exists per page)
// ---------------------------------------------------------------------------
let ui = null; // DOM references, built lazily
let items = []; // [{ el, src, alt, caption }] of the open gallery
let index = 0;
let token = 0; // bumped on every navigation so a slow image never overwrites a newer one
let natural = { w: 0, h: 0 };
let scrollLock = null;
let closing = false;
const loaded = new Map(); // src -> Promise<HTMLImageElement> (also keeps preloaded images referenced)

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------
function load(src) {
  if (!loaded.has(src)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    // decode() rejects for broken images; resolve either way and let the caller inspect naturalWidth
    loaded.set(src, img.decode().then(() => img, () => img));
  }
  return loaded.get(src);
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
function build() {
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('data-lightbox-dialog', '');
  dialog.setAttribute('aria-label', 'Image viewer');
  dialog.innerHTML = `
    <div class="lightbox__stage" data-lightbox-stage>
      <figure class="lightbox__figure">
        <img class="lightbox__img" alt="" decoding="async">
        <figcaption class="lightbox__caption" hidden></figcaption>
      </figure>
      <span class="lightbox__spinner" aria-hidden="true"></span>
    </div>
    <button class="lightbox__btn lightbox__close" type="button" aria-label="Close image viewer">${ICONS.close}</button>
    <button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous image">${ICONS.prev}</button>
    <button class="lightbox__btn lightbox__next" type="button" aria-label="Next image">${ICONS.next}</button>
    <p class="lightbox__counter"><span data-lightbox-count aria-hidden="true"></span><span class="sr-only" data-lightbox-live aria-live="polite" aria-atomic="true"></span></p>`;
  document.body.append(dialog);

  const q = (sel) => dialog.querySelector(sel);
  ui = {
    dialog,
    stage: q('.lightbox__stage'),
    figure: q('.lightbox__figure'),
    img: q('.lightbox__img'),
    caption: q('.lightbox__caption'),
    close: q('.lightbox__close'),
    prev: q('.lightbox__prev'),
    next: q('.lightbox__next'),
    counter: q('.lightbox__counter'),
    count: q('[data-lightbox-count]'),
    live: q('[data-lightbox-live]'),
  };

  ui.close.addEventListener('click', requestClose);
  ui.prev.addEventListener('click', () => go(-1));
  ui.next.addEventListener('click', () => go(1));
  // Esc: take over from the browser so the closing animation and focus return always run
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    requestClose();
  });
  dialog.addEventListener('close', onClosed);
  dialog.addEventListener('keydown', onKeydown);
  // Backdrop click: the stage fills the screen, so "outside the image / caption / buttons" means the stage or the dialog itself
  dialog.addEventListener('click', (e) => {
    if (swipe.suppressClick) return;
    if (e.target === dialog || e.target === ui.stage) requestClose();
  });
  initSwipe();
  new ResizeObserver(() => dialog.open && fit()).observe(ui.stage);
}

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------
function open(group, trigger) {
  if (!ui) build();
  items = [...group.querySelectorAll('[data-lightbox-src]')].map((el) => ({
    el,
    src: el.dataset.lightboxSrc,
    alt: el.dataset.lightboxAlt ?? el.querySelector('img')?.alt ?? '',
    caption: el.dataset.lightboxCaption ?? '',
  }));
  const start = Math.max(0, items.findIndex((i) => i.el === trigger));
  const many = items.length > 1;
  ui.prev.hidden = ui.next.hidden = ui.counter.hidden = !many;

  closing = false;
  ui.dialog.classList.remove('is-closing');
  lockScroll();
  ui.dialog.showModal();
  ui.close.focus({ preventScroll: true });
  show(start, { first: true });
}

/** Animated close (skipped under reduced motion); the real dialog.close() happens when it has finished. */
function requestClose() {
  if (closing || !ui.dialog.open) return;
  closing = true;
  if (reducedMotion()) return ui.dialog.close();
  ui.dialog.classList.add('is-closing');
  const done = () => ui.dialog.open && ui.dialog.close();
  ui.dialog.addEventListener('animationend', done, { once: true });
  setTimeout(done, 260); // safety net if animationend never fires
}

function onClosed() {
  unlockScroll();
  token++; // cancel any pending load
  ui.dialog.classList.remove('is-closing');
  ui.dialog.removeAttribute('data-loading');
  ui.img.removeAttribute('src');
  closing = false;
  // return focus to the thumbnail of the slide the viewer ended on (not necessarily the one that opened it)
  const target = items[index]?.el;
  target?.focus({ preventScroll: false });
  items = [];
}

/** Lock page scroll and compensate for the vanished scrollbar so nothing shifts sideways. */
function lockScroll() {
  const root = document.documentElement;
  const bar = window.innerWidth - root.clientWidth;
  scrollLock = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
  root.style.overflow = 'hidden';
  if (bar > 0) root.style.paddingRight = `${bar}px`;
}

function unlockScroll() {
  if (!scrollLock) return;
  const root = document.documentElement;
  root.style.overflow = scrollLock.overflow;
  root.style.paddingRight = scrollLock.paddingRight;
  scrollLock = null;
}

// ---------------------------------------------------------------------------
// Showing a slide
// ---------------------------------------------------------------------------
function go(step) {
  if (items.length < 2) return;
  show(index + step, { dir: Math.sign(step) });
}

async function show(i, { dir = 0, first = false } = {}) {
  index = (i + items.length) % items.length;
  const item = items[index];
  const mine = ++token;

  ui.count.textContent = `${pad2(index + 1)} / ${pad2(items.length)}`;
  ui.live.textContent = `Image ${index + 1} of ${items.length}${item.alt ? `: ${item.alt}` : ''}`;

  // only show the spinner when loading is actually slow (cached images swap instantly, no flicker)
  const spinner = setTimeout(() => mine === token && ui.dialog.setAttribute('data-loading', 'true'), 160);
  const pic = await load(item.src);
  clearTimeout(spinner);
  if (mine !== token) return;
  ui.dialog.removeAttribute('data-loading');

  natural = { w: pic.naturalWidth || 1, h: pic.naturalHeight || 1 };
  ui.img.src = item.src;
  ui.img.alt = item.alt;
  ui.caption.textContent = item.caption;
  ui.caption.hidden = !item.caption;
  fit();

  if (!reducedMotion()) {
    if (first) growFromThumbnail(item.el);
    else if (dir) {
      ui.figure.animate(
        [{ opacity: 0, transform: `translateX(${dir * 36}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 280, easing: EASE },
      );
    } else {
      ui.figure.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE });
    }
  }

  // warm the cache for both neighbours so arrow-key browsing is instant
  if (items.length > 1) {
    load(items[(index + 1) % items.length].src);
    load(items[(index - 1 + items.length) % items.length].src);
  }
}

/** FLIP: start from the thumbnail's rectangle and ease to the final one. */
function growFromThumbnail(trigger) {
  const thumb = trigger?.querySelector('img');
  if (!thumb) return;
  const from = thumb.getBoundingClientRect();
  const to = ui.img.getBoundingClientRect();
  if (!from.width || !to.width) return;
  const origin = 'top left';
  ui.img.animate(
    [
      { transformOrigin: origin, transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: 0.4 },
      { transformOrigin: origin, transform: 'none', opacity: 1 },
    ],
    { duration: 420, easing: EASE },
  );
  ui.caption.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 160, easing: EASE, fill: 'backwards' });
}

/** Size the image (never cropped, up to MAX_UPSCALE) so image + caption fill the stage. Runs on load and resize. */
function fit() {
  if (!ui.dialog.open || !natural.w) return;
  const { clientWidth: w, clientHeight: h } = ui.stage;
  const gap = ui.caption.hidden ? 0 : parseFloat(getComputedStyle(ui.figure).rowGap) || 0;
  const place = () => {
    const room = h - (ui.caption.hidden ? 0 : ui.caption.offsetHeight) - gap;
    const scale = Math.min(w / natural.w, room / natural.h, MAX_UPSCALE);
    ui.img.style.width = `${Math.max(1, Math.floor(natural.w * scale))}px`;
    ui.img.style.height = `${Math.max(1, Math.floor(natural.h * scale))}px`;
  };
  place();
  place(); // the caption wraps differently once the image width changed; one more pass settles it
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------
function onKeydown(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      go(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      go(1);
      break;
    case 'Home':
      e.preventDefault();
      show(0);
      break;
    case 'End':
      e.preventDefault();
      show(items.length - 1);
      break;
    case 'Tab': {
      // <dialog> already traps focus; this keeps Tab inside the buttons even in browsers that let it escape to the chrome
      const stops = [ui.close, ui.prev, ui.next].filter((b) => !b.hidden);
      const at = stops.indexOf(document.activeElement);
      if (e.shiftKey && at <= 0) {
        e.preventDefault();
        stops.at(-1).focus();
      } else if (!e.shiftKey && at === stops.length - 1) {
        e.preventDefault();
        stops[0].focus();
      }
      break;
    }
    default:
  }
}

// ---------------------------------------------------------------------------
// Touch swipe (pointer events; mouse is ignored, it has the buttons and arrow keys)
// ---------------------------------------------------------------------------
const swipe = { start: null, dx: 0, dragging: false, suppressClick: false };

function initSwipe() {
  const { stage, figure } = ui;

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || items.length < 2) return;
    if ((window.visualViewport?.scale ?? 1) > 1.05) return; // pinch-zoomed: let the user pan instead
    swipe.start = { x: e.clientX, y: e.clientY, t: performance.now() };
    swipe.dx = 0;
    swipe.dragging = false;
  });

  stage.addEventListener('pointermove', (e) => {
    if (!swipe.start) return;
    const dx = e.clientX - swipe.start.x;
    const dy = e.clientY - swipe.start.y;
    if (!swipe.dragging) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      swipe.dragging = true;
      try {
        stage.setPointerCapture(e.pointerId); // keep receiving moves if the finger leaves the stage
      } catch {
        /* pointer no longer active: harmless */
      }
    }
    swipe.dx = dx;
    figure.style.transition = 'none';
    figure.style.transform = `translateX(${dx}px)`;
    figure.style.opacity = String(1 - Math.min(Math.abs(dx) / (stage.clientWidth * 0.9), 0.55));
  });

  const end = (e) => {
    const s = swipe.start;
    swipe.start = null;
    if (!swipe.dragging || !s) return;
    swipe.dragging = false;
    // the click that follows pointerup must not count as a backdrop click
    swipe.suppressClick = true;
    setTimeout(() => (swipe.suppressClick = false), 0);

    const velocity = swipe.dx / Math.max(1, performance.now() - s.t);
    const commit = e.type === 'pointerup' && (Math.abs(swipe.dx) > SWIPE_DISTANCE || Math.abs(velocity) > SWIPE_VELOCITY);
    figure.style.transition = '';
    figure.style.transform = '';
    figure.style.opacity = '';
    if (commit) go(swipe.dx < 0 ? 1 : -1);
    else if (!reducedMotion()) {
      figure.animate([{ transform: `translateX(${swipe.dx}px)` }, { transform: 'none' }], { duration: 240, easing: EASE });
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
export function init() {
  // No <dialog> support: leave the links alone, they open the image itself.
  if (typeof HTMLDialogElement !== 'function' || !('showModal' in HTMLDialogElement.prototype)) return;

  document.addEventListener('click', (e) => {
    // let ctrl/cmd/shift/middle clicks keep their native "open in new tab/window" meaning
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const trigger = e.target.closest?.('[data-lightbox-src]');
    const group = trigger?.closest('[data-lightbox]');
    if (!trigger || !group) return;
    e.preventDefault();
    open(group, trigger);
  });
}
