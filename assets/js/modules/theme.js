/**
 * theme.js: dark / light / system theme.
 *
 * The inline <head> script (src/lib/layout.mjs) has already resolved the theme before first paint
 * (no flash); this module takes over from there:
 *   - html[data-theme]       resolved theme ("dark" | "light"), what the CSS tokens key off
 *   - html[data-theme-pref]  what the user chose ("dark" | "light" | "system")
 *   - localStorage "theme"   persisted preference (every access is guarded)
 *   - <meta name="theme-color" data-theme-color="dark|light"> (x2) kept in sync with the choice
 *   - [data-theme-toggle]    click flips dark <-> light; aria-label always names the action;
 *                            Shift/Alt+click goes back to following the OS
 *   - document "themechange" CustomEvent, detail: { pref, theme } (the hero canvas listens to it)
 *
 * Public API (also imported by palette.js): getTheme(), setTheme(pref), toggleTheme().
 */
import { storage, delegate, toast } from './core.js';

const KEY = 'theme';
const PREFS = ['dark', 'light', 'system'];
// Keep in sync with THEME_COLORS in src/lib/layout.mjs (that file is the source of truth for the inline script).
const THEME_COLORS = { dark: '#05080a', light: '#f6faf9' };

const root = document.documentElement;
const osLight = window.matchMedia('(prefers-color-scheme: light)');

const isPref = (value) => PREFS.includes(value);
const resolve = (pref) => (pref === 'system' ? (osLight.matches ? 'light' : 'dark') : pref);

let pref = 'system';
let theme = 'dark';

/** Current state: `pref` is the user's choice, `theme` what is actually shown. */
export function getTheme() {
  return { pref, theme };
}

/** Write the state to the DOM (attributes, colour-scheme, meta theme-color, toggle labels). */
function paint() {
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-pref', pref);
  root.style.colorScheme = theme;

  // Explicit choice: both metas carry the same colour and lose their media query (so the browser
  // chrome follows the site, not the OS). "system": restore the two media-gated variants.
  for (const meta of document.querySelectorAll('meta[name="theme-color"][data-theme-color]')) {
    const variant = meta.dataset.themeColor;
    if (pref === 'system') {
      meta.setAttribute('content', THEME_COLORS[variant]);
      meta.setAttribute('media', `(prefers-color-scheme: ${variant})`);
    } else {
      meta.setAttribute('content', THEME_COLORS[theme]);
      meta.removeAttribute('media');
    }
  }

  // The label names the action the button will perform, so no aria-pressed (it would double-announce).
  const next = theme === 'dark' ? 'light' : 'dark';
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.setAttribute('aria-label', `Switch to ${next} theme`);
    button.setAttribute('title', `Switch to ${next} theme (Shift+click: follow system)`);
    button.removeAttribute('aria-pressed');
  }
}

/** Apply a preference. `persist:false` is used for changes that originate elsewhere (OS, other tab). */
function apply(nextPref, { persist = true, silent = false } = {}) {
  if (!isPref(nextPref)) return getTheme();
  const nextTheme = resolve(nextPref);
  const changed = nextPref !== pref || nextTheme !== theme;
  pref = nextPref;
  theme = nextTheme;
  if (persist) {
    // "system" is stored explicitly too, so a cleared choice survives and the inline script reads it back.
    storage.set(KEY, pref);
  }
  paint();
  if (changed && !silent) {
    document.dispatchEvent(new CustomEvent('themechange', { detail: { pref, theme } }));
  }
  return getTheme();
}

/** setTheme('dark' | 'light' | 'system'): persists and applies. Unknown values are ignored. */
export function setTheme(nextPref) {
  return apply(nextPref);
}

/** Flip the *resolved* theme and store it as an explicit preference. */
export function toggleTheme() {
  return apply(theme === 'dark' ? 'light' : 'dark');
}

export function init() {
  window.setTheme = setTheme;

  // Adopt whatever the inline script decided (it already read localStorage); fall back to storage
  // when that script is absent. Nothing is written here: first-time visitors stay on "system".
  const fromDom = root.getAttribute('data-theme-pref');
  const stored = storage.get(KEY);
  pref = isPref(fromDom) ? fromDom : isPref(stored) ? stored : 'system';
  theme = resolve(pref);
  paint();

  delegate(document, 'click', '[data-theme-toggle]', (event) => {
    if (event.shiftKey || event.altKey) {
      apply('system');
      toast('Theme now follows your system setting');
    } else {
      toggleTheme();
    }
  });

  // Follow the OS only while the user has not picked a side.
  osLight.addEventListener('change', () => {
    if (pref === 'system') apply('system', { persist: false });
  });

  // Another tab changed the preference: mirror it without writing back.
  window.addEventListener('storage', (event) => {
    if (event.key === KEY && isPref(event.newValue)) apply(event.newValue, { persist: false });
  });

  // Back/forward cache restores a page with its old DOM: re-sync with the stored choice.
  window.addEventListener('pageshow', (event) => {
    const saved = storage.get(KEY);
    if (event.persisted && isPref(saved) && saved !== pref) apply(saved, { persist: false });
  });
}
