/**
 * pages/experience.js: print / "Save as PDF" behaviour for the CV page.
 *
 *  - Every [data-print] button opens the browser print dialog (the @media print rules in
 *    assets/css/pages/experience.css turn the page into a clean A4 CV).
 *  - Arriving with ?print=1 (the command palette's "Print CV" action) prints automatically,
 *    once, after web fonts are ready; the parameter is then removed so reloads do not re-trigger it.
 *
 * Everything else on the page works without JS, so the buttons are hidden under html.no-js.
 *
 *  - Client engagements: the chip filter (data-eng-filter) hides the entries of other clients, hides year
 *    groups that end up empty and keeps the live count in sync. Without JS everything stays visible.
 *  - "Show more" <details> are opened while printing (and restored afterwards) so the printed CV is complete.
 */
const print = () => window.print();

document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-print]')) print();
});

const params = new URLSearchParams(location.search);
if (params.get('print') === '1') {
  // Strip the flag first so a reload (or the print dialog's own reflow) can never loop.
  params.delete('print');
  const query = params.toString();
  history.replaceState(history.state, '', location.pathname + (query ? `?${query}` : '') + location.hash);

  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  // Cap the wait: a stalled font request must not block printing forever.
  Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 3000))]).then(() => {
    // Two frames so layout with the final fonts has been committed before the dialog snapshots it.
    requestAnimationFrame(() => requestAnimationFrame(print));
  });
}

// ---------------------------------------------------------------- client engagements filter
const root = document.querySelector('[data-engagements]');
if (root) {
  const chips = [...root.querySelectorAll('[data-eng-filter]')];
  const entries = [...root.querySelectorAll('[data-eng]')];
  const years = [...root.querySelectorAll('[data-eng-year]')];
  const count = root.querySelector('[data-eng-count]');
  const empty = root.querySelector('[data-eng-empty]');

  const apply = (client) => {
    let shown = 0;
    for (const entry of entries) {
      const match = client === 'all' || entry.dataset.client === client;
      entry.hidden = !match;
      if (match) shown += 1;
    }
    for (const year of years) year.hidden = !year.querySelector('[data-eng]:not([hidden])');
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.engFilter === client));
    if (count) count.textContent = shown === entries.length ? `${entries.length} engagements` : `${shown} of ${entries.length} engagements`;
    if (empty) empty.hidden = shown > 0;
  };

  for (const chip of chips) chip.addEventListener('click', () => apply(chip.dataset.engFilter));
}

// ---------------------------------------------------------------- print: open every disclosure
let reopened = [];
window.addEventListener('beforeprint', () => {
  reopened = [...document.querySelectorAll('details:not([open])')];
  for (const d of reopened) d.open = true;
});
window.addEventListener('afterprint', () => {
  for (const d of reopened) d.open = false;
  reopened = [];
});
