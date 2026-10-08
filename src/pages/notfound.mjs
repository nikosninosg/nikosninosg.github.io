/**
 * 404 page -> 404.html.
 *
 * GitHub Pages serves 404.html for ANY missing URL, at any depth (/a/b/c). Relative URLs would break
 * there, so build.mjs renders this page with ctx.base === '/': ctx.url('assets/x.css') -> '/assets/x.css'.
 * Every link and asset below therefore goes through ctx.url(), never a hand-written relative path.
 *
 * Playful bits (all pure CSS/SVG, static under prefers-reduced-motion; styles in assets/css/pages/notfound.css):
 *   - a glitching gradient "404" whose zero is a small network ring with one node that lost its link
 *   - the requested path echoed like a terminal response and a "did you mean" guess, both from a tiny inline script
 *   - buttons home / projects / contact, a command-palette hint and a few suggested destinations
 */
import { html, raw } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';

/** UI labels only. Names and project titles come from content. */
const LABELS = {
  eyebrow: 'Error 404',
  title: 'This page drifted off the network',
  lede: 'The link may be broken, or the page has moved. No harm done: pick a way back below.',
  home: 'Back home',
  projects: 'See projects',
  contact: 'Say hello',
  hintBefore: 'Or press',
  hintAfter: 'to search the whole site',
  paletteButton: 'Open search',
  guess: 'Did you mean',
  jump: 'Or jump straight to',
  pages: 'Pages',
  work: 'Selected work',
  pathFallback: 'the-page-you-wanted',
};

/** Decorative network "0": a ring of nodes with one that lost its link. Positions are computed here, not data. */
function zero() {
  const cx = 55, cy = 60, rx = 46, ry = 50, count = 9, lost = 2;
  const at = (i, k = 1) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    return [(cx + Math.cos(a) * rx * k).toFixed(1), (cy + Math.sin(a) * ry * k).toFixed(1)];
  };
  const nodes = Array.from({ length: count }, (_, i) => at(i, i === lost ? 1.28 : 1));
  const link = (a, b) => html`<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}"/>`;
  // Ring links skip the lost node; one dashed stub reaches toward it from the previous node.
  const ring = nodes.map((_, i) => [i, (i + 1) % count]).filter(([a, b]) => a !== lost && b !== lost);
  const chords = [[0, 4], [1, 6], [3, 7], [5, 8]];
  const stub = [(lost + count - 1) % count, lost];
  return html`
    <svg class="nf__zero" viewBox="0 0 110 120" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nf-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color:var(--accent)"/>
          <stop offset="1" style="stop-color:var(--accent-2)"/>
        </linearGradient>
      </defs>
      <g class="nf__links">${ring.map(([a, b]) => link(a, b))}</g>
      <g class="nf__chords">${chords.map(([a, b]) => link(a, b))}</g>
      <g class="nf__stub">${link(...stub)}</g>
      <circle class="nf__packet" r="3.2"/>
      <g class="nf__nodes">${nodes.map(([x, y], i) => html`<circle class="${i === lost ? 'is-lost' : ''}" cx="${x}" cy="${y}" r="${i % 3 === 0 ? 5 : 3.6}" style="--i:${i}"/>`)}</g>
    </svg>`;
}

/** Echo the requested path + guess the closest destination. No data leaves the page; textContent only. */
const SCRIPT = `(function(){var p=location.pathname;var el=document.querySelector('[data-nf-path]');if(el)el.textContent=p.length>56?p.slice(0,55)+'\\u2026':p;var t=decodeURIComponent(p).toLowerCase().split(/[^a-z0-9]+/).filter(function(w){return w.length>2&&w!=='html'});if(!t.length)return;var best=null,top=0;document.querySelectorAll('[data-match]').forEach(function(a){var m=a.getAttribute('data-match'),s=0;t.forEach(function(w){if(m.indexOf(w)>-1)s++});if(s>top){top=s;best=a}});var g=document.querySelector('[data-nf-guess]');if(best&&g){best.classList.add('is-guess');var l=g.querySelector('a');l.href=best.getAttribute('href');l.textContent=best.getAttribute('data-label');g.hidden=false}})();`;

export default function render(ctx) {
  const { url, nav, featuredProjects } = ctx;
  const pages = nav.filter((n) => !['home', 'contact'].includes(n.id));
  const norm = (...parts) => parts.filter(Boolean).join(' ').toLowerCase();

  return {
    id: 'notfound',
    nav: null,
    path: '404.html',
    title: 'Page not found',
    description: 'The page you were looking for does not exist.',
    noindex: true,
    css: ['assets/css/pages/notfound.css'],
    js: [],
    body: html`
<section class="nf" aria-labelledby="nf-title">
  <div class="nf__bg" aria-hidden="true"></div>
  <div class="container nf__inner">
    <p class="nf__code" aria-hidden="true">
      <span class="nf__digit" data-text="4">4</span>
      ${zero()}
      <span class="nf__digit" data-text="4">4</span>
    </p>
    <p class="eyebrow"><span class="eyebrow__label">${LABELS.eyebrow}</span></p>
    <h1 class="nf__title" id="nf-title">${LABELS.title}</h1>
    <p class="nf__lede">${LABELS.lede}</p>
    <p class="nf__req"><code><span class="nf__req-method">GET</span> <span class="nf__req-path" data-nf-path>${LABELS.pathFallback}</span> <span class="nf__req-status">404 Not Found</span></code></p>
    <p class="nf__guess" data-nf-guess hidden>${LABELS.guess} <a href="${url('')}"></a>?</p>

    <div class="nf__actions">
      <a class="btn btn-primary btn-lg" href="${url('')}" data-magnetic>${icon('arrow-left')}${LABELS.home}</a>
      <a class="btn btn-ghost btn-lg" href="${url('projects.html')}" data-magnetic>${LABELS.projects}</a>
      <a class="btn btn-ghost btn-lg" href="${url('contact.html')}" data-magnetic>${LABELS.contact}</a>
    </div>

    <p class="nf__hint">
      <span>${LABELS.hintBefore}</span>
      <kbd class="kbd"><span data-kbd-mod>Ctrl</span><span>K</span></kbd>
      <span>${LABELS.hintAfter}</span>
      <button class="btn btn-ghost btn-sm nf__search" type="button" data-palette-open>${icon('search')}${LABELS.paletteButton}</button>
    </p>

    <nav class="nf__jump" aria-label="${LABELS.jump}">
      <h2 class="nf__jump-title">${LABELS.jump}</h2>
      <ul class="nf__chips" role="list">
        ${pages.map((n) => html`<li><a class="chip" href="${url(n.path)}" data-match="${norm(n.label, n.id)}" data-label="${n.label}">${icon(n.icon, { size: 15 })}${n.label}</a></li>`)}
        ${featuredProjects.map((p) => html`<li><a class="chip" href="${url(`projects/${p.slug}.html`)}" data-match="${norm(p.title, p.slug, p.client)}" data-label="${p.title}">${icon('folder', { size: 15 })}${p.title}</a></li>`)}
      </ul>
    </nav>
  </div>
</section>
<script>${raw(SCRIPT)}</script>`,
  };
}
