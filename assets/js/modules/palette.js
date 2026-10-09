/**
 * palette.js: accessible command palette (<dialog data-palette>).
 *
 * Data comes from <script id="palette-data"> (see src/COMPONENTS.md 2.3); the DOM skeleton is emitted
 * by layout.mjs. This module only renders results into [data-palette-list] and drives the dialog.
 *
 * Opening:  Ctrl/Cmd+K anywhere (toggles), "/" when not typing, any [data-palette-open].
 * Closing:  Esc, backdrop click (press AND release on the backdrop), choosing an item.
 * ARIA:     input role=combobox (aria-expanded / aria-controls / aria-activedescendant) drives a
 *           role=listbox of role=option items, grouped with role=group; a live region reports the count.
 * Matching: every whitespace-separated token must match. Titles accept subsequence ("pbi" -> "Power BI"),
 *           hints and keywords (client / technologies) accept substrings at word starts.
 * Memory:   the last 3 chosen items are kept in sessionStorage and listed first for an empty query.
 */
import { $, $$, copyText, delegate, on, prefersReducedMotion, toast } from './core.js';

const RECENT_KEY = 'palette:recent';
const RECENT_MAX = 3;
const RESULT_MAX = 40;
const GROUPS = [
  { id: 'recent', label: 'Recent' },
  { id: 'pages', label: 'Pages' },
  { id: 'projects', label: 'Projects' },
  { id: 'actions', label: 'Actions' },
];

// ---------------------------------------------------------------------------
// Icons: the few glyphs palette-data can reference (same drawings as src/lib/icons.mjs).
// ---------------------------------------------------------------------------
const p = (d) => `<path d="${d}"/>`;
const ps = (...ds) => ds.map(p).join('');
const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const rect = (x, y, w, h, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

const GLYPHS = {
  rocket: ps('M12 2.5c3 2.2 4.5 5.5 4.5 9.5v3.5h-9V12c0-4 1.5-7.3 4.5-9.5z', 'M7.5 13l-3 3.5V19l3-1.5', 'M16.5 13l3 3.5V19l-3-1.5', 'M10 18.5c0 1.5.8 3 2 3.5 1.2-.5 2-2 2-3.5') + circle(12, 9.5, 1.7),
  'user-check': circle(9, 8, 3.5) + ps('M2.5 20c0-3.6 2.9-6 6.5-6 1.2 0 2.3.3 3.2.7', 'M15.5 17.5l2 2 4-4.5'),
  briefcase: rect(3, 7, 18, 13, 2.5) + ps('M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'M3 13h18', 'M11 13v1.5h2V13'),
  folder: p('M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  mail: rect(3, 5, 18, 14, 2.5) + p('M3.5 7.5l8.5 6 8.5-6'),
  moon: p('M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z'),
  sun: circle(12, 12, 4) + ps('M12 2.5V5', 'M12 19v2.5', 'M2.5 12H5', 'M19 12h2.5', 'M5.3 5.3l1.8 1.8', 'M16.9 16.9l1.8 1.8', 'M5.3 18.7l1.8-1.8', 'M16.9 7.1l1.8-1.8'),
  copy: rect(9, 9, 11.5, 11.5, 2) + p('M15 9V6.5a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2H9'),
  print: ps('M7 9V3.5h10V9', 'M7 17H5.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H17') + rect(7, 14, 10, 6.5, 0.5),
  external: ps('M14 4h6v6', 'M20 4l-9 9', 'M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10'),
  download: ps('M12 4v11', 'M7.5 10.5L12 15l4.5-4.5', 'M4 19.5h16'),
  sliders: ps('M4 7h8', 'M16 7h4', 'M4 17h3', 'M11 17h9') + circle(14, 7, 2) + circle(9, 17, 2),
  sparkles: ps('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z', 'M5 3.5l.5 1.3 1.3.5-1.3.5L5 7l-.5-1.2-1.3-.5 1.3-.5z'),
  'arrow-right': ps('M4 12h16', 'M13.5 5.5L20 12l-6.5 6.5'),
  github: p('M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z'),
  linkedin: p('M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'),
  fiverr: ps('M6 20V9.5A4 4 0 0 1 10 5.5h2.5', 'M3.5 10.5H12', 'M16 10.5V20') + circle(16, 6.2, 0.6),
  upwork: ps('M3.5 5.5v6a3.5 3.5 0 0 0 7 0v-6', 'M14.5 9v11') + circle(17.5, 12, 3),
};
const FILLED = new Set(['github', 'linkedin']);

function iconSvg(name) {
  const glyph = GLYPHS[name] ?? GLYPHS['arrow-right'];
  const paint = FILLED.has(name)
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" ${paint} aria-hidden="true" focusable="false">${glyph}</svg>`;
}

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------
const isWordStart = (text, i) => i === 0 || !/[a-z0-9]/i.test(text[i - 1]);

/** All indexes of `needle` in `hay` (both lowercase). */
function* occurrences(hay, needle) {
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) yield i;
}

/**
 * Match one lowercase token against `text`.
 * Returns { score, positions } (positions = matched character indexes) or null.
 * `subsequence` additionally allows scattered matches, bounded so junk does not slip through.
 */
function matchToken(text, token, { subsequence = false, wordStartOnly = false } = {}) {
  const hay = text.toLowerCase();

  // 1) contiguous substring; prefer one that starts a word
  let best = -1;
  for (const i of occurrences(hay, token)) {
    if (isWordStart(hay, i)) {
      best = i;
      break;
    }
    if (best === -1 && !wordStartOnly) best = i;
  }
  if (best !== -1) {
    let score = 600 - best * 3 - (hay.length - token.length);
    if (isWordStart(hay, best)) score += 250;
    if (best === 0) score += 150;
    if (hay.length === token.length) score += 300;
    return { score, positions: Array.from({ length: token.length }, (_, k) => best + k) };
  }
  if (!subsequence || token.length < 2) return null;

  // 2) subsequence. Two greedy strategies from each anchor: earliest characters, and "prefer word
  //    starts" (initialisms such as "bib" -> "BI in a Box"). Scattered matches are accepted only when
  //    compact (gap budget) or when every matched character starts a word.
  let result = null;
  for (let start = hay.indexOf(token[0]); start !== -1; start = hay.indexOf(token[0], start + 1)) {
    // anchors: any word start; short tokens must start a word (otherwise "con" would match "produCtiON")
    if (!isWordStart(hay, start) && (token.length <= 3 || start !== hay.indexOf(token[0]))) continue;
    for (const preferWordStart of [false, true]) {
      const positions = [start];
      let at = start;
      for (let k = 1; k < token.length; k++) {
        let next = -1;
        if (preferWordStart) {
          for (let i = hay.indexOf(token[k], at + 1); i !== -1; i = hay.indexOf(token[k], i + 1)) {
            if (isWordStart(hay, i)) {
              next = i;
              break;
            }
          }
        }
        at = next !== -1 ? next : hay.indexOf(token[k], at + 1);
        if (at === -1) break;
        positions.push(at);
      }
      if (positions.length < token.length) continue;
      const span = positions[positions.length - 1] - start + 1;
      const initialism = positions.every((pos) => isWordStart(hay, pos));
      if (span > token.length + 4 && !initialism) continue;
      let score = 120 - (span - token.length) * 6 - start * 2;
      positions.forEach((pos, k) => {
        if (isWordStart(hay, pos)) score += 22;
        if (k > 0 && pos === positions[k - 1] + 1) score += 14;
      });
      if (!result || score > result.score) result = { score, positions };
    }
  }
  return result;
}

/** Word of `text` that contains index `i` (used to show *why* a keyword matched). */
function wordAt(text, i) {
  let a = i;
  let b = i;
  while (a > 0 && !/\s/.test(text[a - 1])) a--;
  while (b < text.length && !/\s/.test(text[b])) b++;
  return { word: text.slice(a, b), offset: i - a };
}

/**
 * Score an item for the tokens. Returns { score, title: Set, hint: Set, via } or null.
 * `via` = { word, start, length } when only the keywords matched (shown in place of the hint).
 */
function scoreItem(item, tokens) {
  let total = 0;
  const titleHits = new Set();
  const hintHits = new Set();
  let via = null;
  for (const token of tokens) {
    const inTitle = matchToken(item.title, token, { subsequence: true });
    const inHint = item.hint ? matchToken(item.hint, token, { wordStartOnly: true }) : null;
    const inKeywords = item.keywords ? matchToken(item.keywords, token, { wordStartOnly: token.length < 3 }) : null;
    const options = [
      inTitle && { score: inTitle.score * 1.0, apply: () => inTitle.positions.forEach((n) => titleHits.add(n)) },
      inHint && { score: inHint.score * 0.55, apply: () => inHint.positions.forEach((n) => hintHits.add(n)) },
      inKeywords && {
        score: inKeywords.score * 0.5,
        apply: () => {
          const { word, offset } = wordAt(item.keywords, inKeywords.positions[0]);
          via = { word, start: offset, length: token.length };
        },
      },
    ].filter(Boolean);
    if (!options.length) return null; // every token must match somewhere
    options.sort((a, b) => b.score - a.score);
    total += options[0].score;
    options[0].apply();
  }
  if (titleHits.size || hintHits.size) via = null; // visible text already explains the match
  return { score: total + (item.current ? -40 : 0), title: titleHits, hint: hintHits, via };
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
/** Append `text` to `parent`, wrapping characters whose index is in `hits` in <mark>. */
function appendHighlighted(parent, text, hits) {
  if (!hits?.size) {
    parent.append(text);
    return;
  }
  let run = '';
  let marked = false;
  const flush = () => {
    if (!run) return;
    if (marked) {
      const mark = document.createElement('mark');
      mark.textContent = run;
      parent.append(mark);
    } else {
      parent.append(run);
    }
    run = '';
  };
  [...text].forEach((ch, i) => {
    const hit = hits.has(i);
    if (hit !== marked) {
      flush();
      marked = hit;
    }
    run += ch;
  });
  flush();
}

const el = (tag, className, attrs = {}) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

const isEditable = (target) =>
  target instanceof Element &&
  (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]') !== null);

const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform ?? navigator.platform ?? '');

// ---------------------------------------------------------------------------
// Session memory (never throws)
// ---------------------------------------------------------------------------
function readRecent() {
  try {
    const value = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((k) => typeof k === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(key) {
  try {
    const next = [key, ...readRecent().filter((k) => k !== key)].slice(0, RECENT_MAX);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: recents are a nicety only */
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
const pathOf = (url) => {
  try {
    return new URL(url, location.href).pathname.replace(/\/index\.html$/, '/');
  } catch {
    return '';
  }
};

async function runToggleTheme() {
  try {
    const theme = await import('./theme.js');
    if (typeof theme.toggleTheme === 'function') {
      theme.toggleTheme();
    } else {
      throw new Error('toggleTheme missing');
    }
  } catch {
    // theme.js unavailable: flip the attribute so the action still does something sensible.
    const root = document.documentElement;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
  }
  toast(`${document.documentElement.dataset.theme === 'light' ? 'Light' : 'Dark'} theme on`, { type: 'info', duration: 1800 });
}

async function runCopy(value) {
  const ok = await copyText(value);
  if (ok) toast(`Copied ${value}`, { type: 'success' });
  else toast('Could not copy automatically. Please copy it manually.', { type: 'error', duration: 4000 });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function init() {
  const dialog = $('[data-palette]');
  const dataEl = $('#palette-data');
  if (!dialog || !dataEl) return;

  // Platform-aware key hint, independent of whether the palette can run.
  if (isApple) $$('[data-kbd-mod]').forEach((node) => (node.textContent = '⌘'));

  let data;
  try {
    data = JSON.parse(dataEl.textContent);
  } catch (err) {
    console.error('[palette] invalid #palette-data', err);
    return;
  }
  const input = $('[data-palette-input]', dialog);
  const list = $('[data-palette-list]', dialog);
  const emptyEl = $('[data-palette-empty]', dialog);
  if (!input || !list || typeof dialog.showModal !== 'function') {
    $$('[data-palette-open]').forEach((btn) => (btn.hidden = true));
    return;
  }

  const placeholder = input.placeholder;

  // Result-count live region (the combobox itself is not announced as results change).
  const status = el('div', 'sr-only', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  dialog.append(status);
  $$('[data-palette-open]').forEach((btn) => btn.setAttribute('aria-haspopup', 'dialog'));

  // ---- items ----------------------------------------------------------------
  const here = pathOf(location.href);
  const items = [];
  const add = (group, raw, extra = {}) => {
    items.push({
      key: `${group}:${raw.id}`,
      group,
      id: raw.id,
      title: raw.title,
      hint: raw.hint ?? '',
      keywords: raw.keywords ?? '',
      icon: raw.icon,
      raw,
      current: group === 'pages' && raw.id === data.current,
      ...extra,
    });
  };
  (data.pages ?? []).forEach((it) => add('pages', it));
  (data.projects ?? []).forEach((it) => add('projects', it));
  (data.actions ?? []).forEach((it) => add('actions', it));
  if (data.projects?.length) {
    add('actions', { id: 'random-project', title: 'Go to a random project', icon: 'sparkles', hint: 'Feeling lucky', keywords: 'surprise shuffle lucky portfolio', action: 'random' });
  }

  add('actions', { id: 'cookie-settings', title: 'Cookie settings', icon: 'sliders', hint: 'Analytics', keywords: 'privacy consent analytics cookies gdpr', action: 'cookie-settings' });

  /** Items whose label depends on live state (theme). */
  const refresh = (item) => {
    if (item.raw.action === 'toggle-theme') {
      const light = document.documentElement.dataset.theme === 'light';
      item.title = light ? 'Switch to dark theme' : 'Switch to light theme';
      item.icon = light ? 'moon' : 'sun';
      item.hint ||= 'Theme';
    }
    if (item.group === 'pages') item.hint = item.current ? 'Current page' : item.raw.hint ?? '';
    if (item.raw.action === 'open' && item.raw.external && !item.raw.hint) item.hint = 'New tab';
  };

  // ---- state ------------------------------------------------------------------
  let opener = null;
  let results = []; // [{ item, match }] in display order
  let activeIndex = -1;
  let closing = null; // Promise while the close animation runs
  let pointerDownOnBackdrop = false;
  let lastPointer = [0, 0];

  const optionId = (i) => `palette-option-${i}`;
  const optionEls = () => $$('[role="option"]', list);

  // ---- rendering ------------------------------------------------------------------
  function compute(query) {
    items.forEach(refresh);
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const buckets = new Map();
    const push = (groupId, entry) => {
      if (!buckets.has(groupId)) buckets.set(groupId, []);
      buckets.get(groupId).push(entry);
    };

    if (!tokens.length) {
      const recent = readRecent()
        .map((key) => items.find((it) => it.key === key))
        .filter(Boolean);
      recent.forEach((item) => push('recent', { item, match: null }));
      const seen = new Set(recent);
      items.filter((it) => !seen.has(it)).forEach((item) => push(item.group, { item, match: null }));
    } else {
      for (const item of items) {
        const match = scoreItem(item, tokens);
        if (match) push(item.group, { item, match });
      }
      for (const entries of buckets.values()) entries.sort((a, b) => b.match.score - a.match.score);
    }

    // Groups: fixed order for the empty query, best-match first while searching.
    const order = GROUPS.filter((g) => buckets.has(g.id));
    if (tokens.length) order.sort((a, b) => buckets.get(b.id)[0].match.score - buckets.get(a.id)[0].match.score);
    const sections = [];
    let remaining = RESULT_MAX;
    for (const group of order) {
      const entries = buckets.get(group.id).slice(0, remaining);
      if (!entries.length) break;
      remaining -= entries.length;
      sections.push({ group, entries });
    }
    return sections;
  }

  function renderItem(entry, index) {
    const { item, match } = entry;
    const li = el('li', 'palette__item', { role: 'option', id: optionId(index), 'aria-selected': 'false', 'data-index': String(index) });
    if (item.current) li.setAttribute('aria-current', 'page');
    const iconEl = el('span', 'palette__item-icon', { 'aria-hidden': 'true' });
    iconEl.innerHTML = iconSvg(item.icon); // trusted constant glyphs only
    const title = el('span', 'palette__item-title');
    appendHighlighted(title, item.title, match?.title);
    li.append(iconEl, title);
    if (match?.via) {
      const hint = el('span', 'palette__item-hint');
      const { word, start, length } = match.via;
      appendHighlighted(hint, word, new Set(Array.from({ length }, (_, k) => start + k)));
      li.append(hint);
    } else if (item.hint) {
      const hint = el('span', 'palette__item-hint');
      appendHighlighted(hint, item.hint, match?.hint);
      li.append(hint);
    }
    return li;
  }

  function render(query) {
    const sections = compute(query);
    results = sections.flatMap((s) => s.entries);
    const fragment = document.createDocumentFragment();
    let index = 0;
    sections.forEach(({ group, entries }) => {
      const section = el('li', 'palette__section', { role: 'presentation' });
      const heading = el('div', 'palette__group', { id: `palette-group-${group.id}`, role: 'presentation' });
      heading.textContent = group.label;
      const ul = el('ul', 'palette__items', { role: 'group', 'aria-labelledby': heading.id });
      entries.forEach((entry) => ul.append(renderItem(entry, index++)));
      section.append(heading, ul);
      fragment.append(section);
    });
    list.replaceChildren(fragment);

    const has = results.length > 0;
    list.hidden = !has;
    emptyEl.hidden = has;
    if (!has) emptyEl.textContent = `No results for “${query.trim()}”. Try another search.`;
    input.setAttribute('aria-expanded', String(has));
    status.textContent = query.trim() ? (has ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No results') : '';
    setActive(has ? 0 : -1, { scroll: false });
    list.scrollTop = 0;
  }

  function setActive(index, { scroll = true } = {}) {
    const options = optionEls();
    activeIndex = index;
    options.forEach((opt, i) => opt.setAttribute('aria-selected', String(i === index)));
    if (index < 0 || !options[index]) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', options[index].id);
    if (!scroll) return;
    if (index === 0) list.scrollTop = 0; // reveal the first group heading too
    else options[index].scrollIntoView({ block: 'nearest' });
  }

  const move = (delta) => {
    if (!results.length) return;
    setActive((activeIndex + delta + results.length) % results.length);
  };

  // ---- open / close --------------------------------------------------------------------
  function lockScroll(lock) {
    const root = document.documentElement;
    if (lock) {
      // Keep the layout from jumping when the scrollbar disappears.
      root.style.setProperty('--palette-sbw', `${Math.max(0, window.innerWidth - root.clientWidth)}px`);
      root.classList.add('palette-open');
    } else {
      root.classList.remove('palette-open');
      root.style.removeProperty('--palette-sbw');
    }
  }

  function open(from) {
    if (dialog.open && !closing) return;
    if (closing) finishClose(); // reopened mid-animation
    // Another modal (lightbox, mobile menu) owns the screen: stay out of its way.
    if ($$('dialog[open]').some((d) => d !== dialog)) return;
    opener = from ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null);
    input.value = '';
    input.placeholder = window.innerWidth < 600 ? 'Search or jump to…' : placeholder;
    render('');
    lockScroll(true);
    dialog.classList.remove('is-closing');
    dialog.showModal();
    input.focus({ preventScroll: true });
    input.select();
  }

  function finishClose() {
    dialog.classList.remove('is-closing');
    if (dialog.open) dialog.close();
    lockScroll(false);
    closing = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  /** Animated close; resolves once the dialog is really closed and focus is back on the opener. */
  function close() {
    if (!dialog.open) return Promise.resolve();
    if (closing) return closing;
    if (prefersReducedMotion()) {
      finishClose();
      return Promise.resolve();
    }
    dialog.classList.add('is-closing');
    closing = new Promise((resolve) => {
      const box = $('.palette__box', dialog);
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        box?.removeEventListener('animationend', end);
        if (closing) finishClose();
        resolve();
      };
      const timer = setTimeout(end, 260); // safety net if animationend never fires
      box?.addEventListener('animationend', end);
    });
    return closing;
  }

  // The native Esc path: take over so the close animation plays.
  on(dialog, 'cancel', (event) => {
    event.preventDefault();
    close();
  });
  // Closed some other way (form method=dialog, devtools): clean up.
  on(dialog, 'close', () => {
    if (!closing) {
      dialog.classList.remove('is-closing');
      lockScroll(false);
    }
  });

  // ---- running an item -----------------------------------------------------------------------
  async function run(item) {
    writeRecent(item.key);
    const { raw } = item;

    // External links must open from the user gesture, so do that before the close animation.
    if (raw.action === 'open' && raw.external) {
      window.open(raw.url, '_blank', 'noopener,noreferrer');
      close();
      return;
    }
    await close();

    if (item.group === 'pages' || item.group === 'projects') {
      if (pathOf(raw.url) === here && !new URL(raw.url, location.href).hash) window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      else location.assign(raw.url);
      return;
    }
    if (raw.download && raw.url) {
      // Trigger a real download from the user gesture (temporary <a download>).
      const a = document.createElement('a');
      a.href = raw.url;
      a.download = '';
      a.rel = 'noopener';
      document.body.append(a);
      a.click();
      a.remove();
      toast('Downloading CV…', { type: 'success', duration: 2200 });
      return;
    }
    switch (raw.action) {
      case 'cookie-settings':
        document.dispatchEvent(new CustomEvent('consent:open'));
        break;
      case 'toggle-theme':
        await runToggleTheme();
        break;
      case 'copy':
        await runCopy(raw.value ?? raw.hint ?? '');
        break;
      case 'open':
        location.assign(raw.url);
        break;
      case 'print':
        if (document.body.dataset.page === 'experience') requestAnimationFrame(() => window.print());
        else location.assign(raw.url);
        break;
      case 'random': {
        const others = data.projects.filter((pr) => pathOf(pr.url) !== here);
        const pick = others[Math.floor(Math.random() * others.length)];
        if (pick) location.assign(pick.url);
        break;
      }
      default:
        if (raw.url) location.assign(raw.url);
    }
  }

  // ---- events --------------------------------------------------------------------------------------
  on(input, 'input', () => render(input.value));

  on(dialog, 'keydown', (event) => {
    if (event.isComposing) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'PageDown':
        event.preventDefault();
        setActive(Math.min(results.length - 1, activeIndex + 6));
        break;
      case 'PageUp':
        event.preventDefault();
        setActive(Math.max(0, activeIndex - 6));
        break;
      case 'Home':
        event.preventDefault();
        if (results.length) setActive(0);
        break;
      case 'End':
        event.preventDefault();
        if (results.length) setActive(results.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (results[activeIndex]) run(results[activeIndex].item);
        break;
      case 'Tab':
        event.preventDefault(); // the input is the only stop; keep focus from leaking to the page
        break;
      default:
    }
  });

  // Mouse: hover selects (pointermove only, so a list scrolling under a still cursor does not steal selection).
  on(list, 'pointermove', (event) => {
    if (event.clientX === lastPointer[0] && event.clientY === lastPointer[1]) return;
    lastPointer = [event.clientX, event.clientY];
    const option = event.target instanceof Element ? event.target.closest('[role="option"]') : null;
    if (option && Number(option.dataset.index) !== activeIndex) setActive(Number(option.dataset.index), { scroll: false });
  });
  // Keep focus in the input when pressing on an option.
  on(list, 'pointerdown', (event) => event.preventDefault());
  on(list, 'click', (event) => {
    const option = event.target instanceof Element ? event.target.closest('[role="option"]') : null;
    if (option && results[Number(option.dataset.index)]) run(results[Number(option.dataset.index)].item);
  });

  // Backdrop: the <dialog> is full-viewport, so a target of the dialog itself means "outside the box".
  on(dialog, 'pointerdown', (event) => (pointerDownOnBackdrop = event.target === dialog));
  on(dialog, 'click', (event) => {
    if (event.target === dialog && pointerDownOnBackdrop) close();
    pointerDownOnBackdrop = false;
  });

  // The "esc" key cap is also a close button for touch users.
  $('.palette__search .kbd', dialog)?.addEventListener('click', () => close());

  // Triggers.
  delegate(document, 'click', '[data-palette-open]', (event, trigger) => {
    event.preventDefault();
    open(trigger);
  });

  on(document, 'keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const key = event.key.toLowerCase();
    if (key === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      if (dialog.open) close();
      else open();
    } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !dialog.open && !isEditable(event.target)) {
      event.preventDefault();
      open();
    }
  });
}
