/**
 * Shared entry point (ES module, loaded on every page).
 *
 * Every feature lives in its own module under ./modules/. They are loaded with dynamic import()
 * and initialised one by one inside their own try/catch, so a module that is missing, fails to
 * parse or throws can never break the others (or the page: all content works without JS).
 *
 * Page-specific scripts (assets/js/pages/<page>.js) are separate <script type="module"> tags
 * added by the page module's `js: []`; they may import helpers from ./modules/core.js.
 *
 * Init order matters only where noted: core first (toast region, [data-copy]), then theme
 * (so the toggle is live before anything else), then the rest.
 */
const MODULES = [
  { name: 'core', load: () => import('./modules/core.js') },
  { name: 'theme', load: () => import('./modules/theme.js') },
  { name: 'header', load: () => import('./modules/header.js') },
  { name: 'reveal', load: () => import('./modules/reveal.js') },
  { name: 'pointer-fx', load: () => import('./modules/pointer-fx.js') },
  { name: 'hero', load: () => import('./modules/hero.js') },
  { name: 'palette', load: () => import('./modules/palette.js') },
  // Loaded only on pages that actually contain the hook (saves bytes elsewhere).
  { name: 'carousel', when: '[data-carousel]', load: () => import('./modules/carousel.js') },
  { name: 'lightbox', when: '[data-lightbox]', load: () => import('./modules/lightbox.js') },
];

async function boot() {
  if (document.readyState === 'loading') {
    await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  // Load in parallel, then init sequentially in declared order.
  const active = MODULES.filter((m) => !m.when || document.querySelector(m.when));
  const loaded = await Promise.allSettled(active.map((m) => m.load()));

  loaded.forEach((result, i) => {
    const { name } = active[i];
    if (result.status === 'rejected') {
      console.error(`[main] module "${name}" failed to load:`, result.reason);
      return;
    }
    const fail = (err) => console.error(`[main] module "${name}" failed to initialise:`, err);
    try {
      // init() may be async; catch rejections too.
      Promise.resolve(result.value.init?.()).catch(fail);
    } catch (err) {
      fail(err);
    }
  });

  // Hook for CSS entrance choreography ("start the hero intro once scripts are up").
  document.documentElement.classList.add('is-ready');
}

boot();
