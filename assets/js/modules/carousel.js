/**
 * carousel.js: enhances every [data-carousel] (markup contract: src/COMPONENTS.md 2.8).
 *
 * Native CSS scroll-snap does the scrolling and swiping. This module adds:
 *   - prev / next buttons (disabled at the ends), dots (click to go), optional pause/play toggle
 *   - the active slide, derived from scroll position ("slide closest to the track centre"), exposed as
 *     .is-active on the slide, aria-current on the dot and `data-index` on the carousel
 *   - autoplay (data-autoplay="ms") that only runs while it is polite to do so (see shouldPlay)
 *   - keyboard: Left/Right/Home/End while focus is inside the carousel
 *   - ARIA: aria-roledescription on the carousel and slides, "n of N" labels, live region politeness
 * Works with 1..N slides: with nothing to scroll, controls are hidden and autoplay never starts.
 */
import { $, $$, debounce, on, prefersReducedMotion, rafThrottle } from './core.js';

const DEFAULT_INTERVAL = 6000;
const SETTLE_MS = 140; // quiet time after the last scroll event before we consider the user "done"

function setup(root) {
  const track = $('[data-carousel-track]', root);
  if (!track) return;
  const slides = Array.from(track.children);
  if (!slides.length) return;

  const prevBtn = $('[data-carousel-prev]', root);
  const nextBtn = $('[data-carousel-next]', root);
  const dotsEl = $('[data-carousel-dots]', root);
  const toggleBtn = $('[data-carousel-toggle]', root);
  const controls = $('.carousel__controls', root);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const autoplayAttr = root.dataset.autoplay;
  const interval = autoplayAttr === undefined ? 0 : Number.parseInt(autoplayAttr, 10) || DEFAULT_INTERVAL;

  // ---- ARIA -----------------------------------------------------------------------
  root.setAttribute('aria-roledescription', 'carousel');
  if (!root.hasAttribute('role')) root.setAttribute('role', 'region');
  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    if (!slide.hasAttribute('aria-label')) slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
  });
  const label = root.getAttribute('aria-label');
  if (label && !track.hasAttribute('aria-label')) {
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', `${label} slides`);
  }

  // ---- dots -------------------------------------------------------------------------
  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel__dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    return dot;
  });
  dotsEl?.replaceChildren(...dots);

  // ---- state ----------------------------------------------------------------------------
  let index = 0;
  let timer = 0;
  let userPaused = false; // the pause/play toggle
  let hovered = false;
  let keyboardFocus = false;
  let pressed = false; // finger / mouse button down on the track
  let scrolling = false;
  let onScreen = true;
  let scrollable = true;

  // ---- geometry ----------------------------------------------------------------------------
  /** Index of the slide whose centre is closest to the track's centre. */
  function nearestIndex() {
    const box = track.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    let best = 0;
    let bestDistance = Infinity;
    slides.forEach((slide, i) => {
      const r = slide.getBoundingClientRect();
      const distance = Math.abs(r.left + r.width / 2 - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  /** Scroll the track (never the page) so slide `i` is centred. */
  function goTo(i, { behavior } = {}) {
    const target = Math.max(0, Math.min(slides.length - 1, i));
    const box = track.getBoundingClientRect();
    const r = slides[target].getBoundingClientRect();
    const left = track.scrollLeft + (r.left + r.width / 2) - (box.left + box.width / 2);
    track.scrollTo({ left, behavior: behavior ?? (reduced.matches ? 'auto' : 'smooth') });
    if (reduced.matches || behavior === 'auto') update(target); // no scroll events to wait for when instant
  }

  const step = (delta) => goTo(index + delta);

  // ---- UI sync ----------------------------------------------------------------------------------
  /** Disabling a focused button would drop focus to <body>: hand it to its sibling first. */
  function setDisabled(button, disabled, sibling) {
    if (!button || button.disabled === disabled) return;
    if (disabled && document.activeElement === button && sibling && !sibling.disabled) sibling.focus({ preventScroll: true });
    button.disabled = disabled;
  }

  function update(next = nearestIndex()) {
    const changed = next !== index;
    index = next;
    root.dataset.index = String(index);
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    setDisabled(prevBtn, index <= 0, nextBtn);
    setDisabled(nextBtn, index >= slides.length - 1, prevBtn);
    return changed;
  }

  /** Hide controls when there is nothing to scroll to (1 slide, or all slides fit). */
  function measure() {
    scrollable = slides.length > 1 && track.scrollWidth - track.clientWidth > 2;
    if (controls) controls.hidden = !scrollable;
    if (toggleBtn) toggleBtn.hidden = !interval || reduced.matches;
    update();
    evaluate();
  }

  // ---- autoplay ----------------------------------------------------------------------------------
  const shouldPlay = () =>
    interval > 0 &&
    scrollable &&
    !userPaused &&
    !reduced.matches &&
    !hovered &&
    !keyboardFocus &&
    !pressed &&
    !scrolling &&
    onScreen &&
    !document.hidden;

  function evaluate() {
    clearTimeout(timer);
    timer = 0;
    const playing = shouldPlay();
    // While nothing rotates by itself, announce slide changes; while it does, stay quiet (WAI-ARIA APG).
    track.setAttribute('aria-live', playing ? 'off' : 'polite');
    if (!playing) return;
    timer = window.setTimeout(() => {
      goTo(index + 1 >= slides.length ? 0 : index + 1);
    }, interval);
  }

  // ---- events ------------------------------------------------------------------------------------------
  const settle = debounce(() => {
    scrolling = false;
    update();
    evaluate();
  }, SETTLE_MS);

  const onScroll = rafThrottle(() => {
    scrolling = true;
    update();
    settle();
  });
  on(track, 'scroll', onScroll, { passive: true });

  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));

  toggleBtn?.addEventListener('click', () => {
    userPaused = !userPaused;
    toggleBtn.setAttribute('aria-pressed', String(userPaused)); // pressed = paused (CSS swaps the icon)
    evaluate();
  });
  toggleBtn?.setAttribute('aria-pressed', 'false');

  // Pause while the pointer is over it (mouse only: touch "hover" sticks after a tap).
  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') {
      hovered = true;
      evaluate();
    }
  });
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') {
      hovered = false;
      evaluate();
    }
  });
  // ... while a finger / button is down on the track (swiping)
  track.addEventListener('pointerdown', () => {
    pressed = true;
    evaluate();
  });
  const release = () => {
    if (!pressed) return;
    pressed = false;
    evaluate();
  };
  on(window, 'pointerup', release);
  on(window, 'pointercancel', release);

  // ... while keyboard focus is inside (:focus-visible ignores mouse clicks on the buttons)
  root.addEventListener('focusin', (e) => {
    keyboardFocus = e.target instanceof Element && e.target.matches(':focus-visible');
    evaluate();
  });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) {
      keyboardFocus = false;
      evaluate();
    }
  });

  // Keyboard: arrows anywhere inside; Home/End on the track.
  root.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !scrollable) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const rtl = getComputedStyle(root).direction === 'rtl';
    let handled = true;
    if (e.key === 'ArrowRight') step(rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') step(rtl ? 1 : -1);
    else if (e.key === 'Home' && e.target === track) goTo(0);
    else if (e.key === 'End' && e.target === track) goTo(slides.length - 1);
    else handled = false;
    if (handled) e.preventDefault();
  });

  // Offscreen / hidden tab / reduced-motion changes.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        evaluate();
      },
      { threshold: 0.3 },
    ).observe(root);
  }
  on(document, 'visibilitychange', evaluate);
  reduced.addEventListener('change', measure);

  // Responsive: slides-per-view / slide width changes with the viewport. Re-measure, and keep the
  // active slide centred (the CSS snap would otherwise settle on whatever is nearest after resize).
  if ('ResizeObserver' in window) {
    let lastWidth = track.clientWidth;
    new ResizeObserver(() => {
      const width = track.clientWidth;
      measure();
      if (width !== lastWidth) {
        lastWidth = width;
        goTo(index, { behavior: 'auto' });
      }
    }).observe(track);
  } else {
    on(window, 'resize', debounce(measure, 150));
  }

  measure();
}

export function init() {
  $$('[data-carousel]').forEach(setup);
}
