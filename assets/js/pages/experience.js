/**
 * pages/experience.js: print / "Save as PDF" behaviour for the CV page.
 *
 *  - Every [data-print] button opens the browser print dialog (the @media print rules in
 *    assets/css/pages/experience.css turn the page into a clean A4 CV).
 *  - Arriving with ?print=1 (the command palette's "Print CV" action) prints automatically,
 *    once, after web fonts are ready; the parameter is then removed so reloads do not re-trigger it.
 *
 * Everything else on the page works without JS, so the buttons are hidden under html.no-js.
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
