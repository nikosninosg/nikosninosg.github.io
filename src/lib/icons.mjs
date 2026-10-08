/**
 * Inline SVG icon set. Every glyph is drawn on a 24x24 grid with a 1.75 stroke,
 * round caps/joins and `currentColor`, so icons inherit text colour and theme.
 * github / linkedin are simplified filled brand glyphs; fiverr / upwork are
 * simple monogram-style stroke glyphs (not official logos).
 *
 *   icon('github')                          -> decorative (aria-hidden)
 *   icon('mail', { size: 18, class: 'x' })
 *   icon('check', { title: 'Copied' })      -> role="img" + <title> (meaningful)
 *
 * Unknown names throw at build time so typos never ship.
 */
import { Raw, escapeAttr, escapeHtml } from './html.mjs';

/** Shorthand: one <path>. */
const p = (d) => `<path d="${d}"/>`;
/** Shorthand: several paths. */
const ps = (...ds) => ds.map(p).join('');
const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const rect = (x, y, w, h, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

/** Names whose glyph is a filled shape rather than a stroked outline. */
const FILLED = new Set(['github', 'linkedin']);

const GLYPHS = {
  // ---- facts / meta ----
  cake: ps('M4 21h16', 'M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7', 'M5 16.5c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 2 1', 'M12 12V9', 'M12 3.2c1 1 1.3 2 0 3.1-1.3-1.1-1-2.1 0-3.1z'),
  link: ps('M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1', 'M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1'),
  globe: circle(12, 12, 9) + ps('M3 12h18', 'M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z'),
  flag: ps('M5 21V4', 'M5 4h11l-2 4 2 4H5'),
  'map-pin': p('M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z') + circle(12, 9.5, 2.5),
  mail: rect(3, 5, 18, 14, 2.5) + p('M3.5 7.5l8.5 6 8.5-6'),

  // ---- brands ----
  github: p('M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z'),
  linkedin: p('M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'),
  // monogram "fi" with a dot
  fiverr: ps('M6 20V9.5A4 4 0 0 1 10 5.5h2.5', 'M3.5 10.5H12', 'M16 10.5V20') + circle(16, 6.2, 0.6),
  // monogram "Up": a U and a p whose bowl is tangent to the stem
  upwork: ps('M3.5 5.5v6a3.5 3.5 0 0 0 7 0v-6', 'M14.5 9v11') + circle(17.5, 12, 3),

  // ---- work / education ----
  briefcase: rect(3, 7, 18, 13, 2.5) + ps('M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'M3 13h18', 'M11 13v1.5h2V13'),
  graduation: ps('M2 9l10-5 10 5-10 5z', 'M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5', 'M22 9v6'),
  award: circle(12, 9, 6) + p('M8.5 14l-1.5 7 5-3 5 3-1.5-7'),
  shield: ps('M12 3l8 3v5.5c0 4.7-3.2 8.2-8 9.5-4.8-1.3-8-4.8-8-9.5V6z', 'M8.5 12l2.5 2.5 4.5-5'),
  cloud: p('M6.5 18.5a4.5 4.5 0 0 1-.4-8.98 6 6 0 0 1 11.6 1.5 3.75 3.75 0 0 1-.5 7.48z'),
  gauge: ps('M3.5 16a8.5 8.5 0 1 1 17 0', 'M3.5 16h2', 'M18.5 16h2', 'M12 16l3.5-4.5', 'M12 7.5V9') + circle(12, 16, 1),
  users: circle(9, 8, 3.5) + ps('M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6', 'M15.5 4.8a3.2 3.2 0 0 1 0 6.4', 'M17 14.2c2.6.5 4.5 2.5 4.5 5.8'),
  presentation: ps('M3 4h18', 'M4.5 4v11h15V4', 'M12 15v4.5', 'M8.5 21l3.5-1.5 3.5 1.5', 'M8 12l2.5-2.5 2 2L16 8'),
  megaphone: ps('M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1z', 'M18.5 9a4 4 0 0 1 0 6', 'M7 14l1 5h2.5l-1-4.5'),
  rocket: ps('M12 2.5c3 2.2 4.5 5.5 4.5 9.5v3.5h-9V12c0-4 1.5-7.3 4.5-9.5z', 'M7.5 13l-3 3.5V19l3-1.5', 'M16.5 13l3 3.5V19l-3-1.5', 'M10 18.5c0 1.5.8 3 2 3.5 1.2-.5 2-2 2-3.5') + circle(12, 9.5, 1.7),
  lightbulb: ps('M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'),
  calendar: rect(3.5, 5, 17, 15.5, 2.5) + ps('M3.5 10h17', 'M8 3v4', 'M16 3v4'),

  // ---- soft skills ----
  brain: ps('M12 5v14', 'M12 5a3 3 0 0 0-5.7 1.3A3.5 3.5 0 0 0 4.5 12a3.5 3.5 0 0 0 1.8 5.7A3 3 0 0 0 12 19', 'M12 5a3 3 0 0 1 5.7 1.3A3.5 3.5 0 0 1 19.5 12a3.5 3.5 0 0 1-1.8 5.7A3 3 0 0 1 12 19', 'M8 10.5c1 0 2-.5 2.5-1.5', 'M16 10.5c-1 0-2-.5-2.5-1.5', 'M8 14.5c1 0 2 .5 2.5 1.5', 'M16 14.5c-1 0-2 .5-2.5 1.5'),
  sliders: ps('M4 7h8', 'M16 7h4', 'M4 17h3', 'M11 17h9') + circle(14, 7, 2) + circle(9, 17, 2),
  message: p('M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'),
  focus: ps('M4 8V6a2 2 0 0 1 2-2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M20 16v2a2 2 0 0 1-2 2h-2', 'M8 20H6a2 2 0 0 1-2-2v-2') + circle(12, 12, 3),
  workflow: rect(3, 3, 7, 7, 1.5) + rect(14, 14, 7, 7, 1.5) + p('M6.5 10v4a3 3 0 0 0 3 3H14'),
  clock: circle(12, 12, 9) + p('M12 7v5l3.5 2'),
  puzzle: p('M10 5.5V4a2 2 0 1 1 4 0v1.5h4.5V10H17a2 2 0 1 1 0 4h1.5v5.5H14V18a2 2 0 1 0-4 0v1.5H5.5V14H7a2 2 0 1 0 0-4H5.5V5.5H10z'),
  'user-check': circle(9, 8, 3.5) + ps('M2.5 20c0-3.6 2.9-6 6.5-6 1.2 0 2.3.3 3.2.7', 'M15.5 17.5l2 2 4-4.5'),
  target: circle(12, 12, 9) + circle(12, 12, 5) + circle(12, 12, 1),
  handshake: ps('M2.5 8.5l3-.5v8l-3-.5z', 'M21.5 8.5l-3-.5v8l3-.5z', 'M5.5 9l4-1.5 2.5 1.2 3-1.2 3.5 1.5', 'M5.5 15l3 .5 3.5 3 1.5-1.2 1.5 1.2 3-3', 'M9.5 11.5l2.5 2 2.5-2'),

  // ---- tech ----
  layers: ps('M12 3l9 5-9 5-9-5z', 'M3 12.5l9 5 9-5', 'M3 16.5l9 5 9-5'),
  code: ps('M8 7l-5 5 5 5', 'M16 7l5 5-5 5', 'M13.5 5l-3 14'),
  terminal: rect(3, 4.5, 18, 15, 2.5) + ps('M7 10l3 2.5L7 15', 'M12.5 15H17'),
  database: ps('M20 6c0 1.66-3.58 3-8 3S4 7.66 4 6s3.58-3 8-3 8 1.34 8 3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'),
  cpu: rect(6, 6, 12, 12, 2) + rect(9.5, 9.5, 5, 5, 1) + ps('M9 2.5V6', 'M15 2.5V6', 'M9 18v3.5', 'M15 18v3.5', 'M2.5 9H6', 'M2.5 15H6', 'M18 9h3.5', 'M18 15h3.5'),
  server: rect(3, 4, 18, 7, 2) + rect(3, 13, 18, 7, 2) + ps('M7 7.5h.01', 'M7 16.5h.01'),
  chart: ps('M4 4v16h16', 'M8 16v-4', 'M12 16V8', 'M16 16v-5'),
  monitor: rect(3, 4, 18, 12, 2) + ps('M8 20h8', 'M12 16v4'),
  image: rect(3, 4, 18, 16, 2.5) + circle(9, 9.5, 1.7) + p('M3.5 17l5-5 4 4 3-3 5 5'),
  folder: p('M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),

  // ---- actions / UI ----
  external: ps('M14 4h6v6', 'M20 4l-9 9', 'M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10'),
  download: ps('M12 4v11', 'M7.5 10.5L12 15l4.5-4.5', 'M4 19.5h16'),
  print: ps('M7 9V3.5h10V9', 'M7 17H5.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H17') + rect(7, 14, 10, 6.5, 0.5),
  moon: p('M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z'),
  sun: circle(12, 12, 4) + ps('M12 2.5V5', 'M12 19v2.5', 'M2.5 12H5', 'M19 12h2.5', 'M5.3 5.3l1.8 1.8', 'M16.9 16.9l1.8 1.8', 'M5.3 18.7l1.8-1.8', 'M16.9 7.1l1.8-1.8'),
  search: circle(11, 11, 6.5) + p('M16 16l4.5 4.5'),
  'arrow-right': ps('M4 12h16', 'M13.5 5.5L20 12l-6.5 6.5'),
  'arrow-left': ps('M20 12H4', 'M10.5 5.5L4 12l6.5 6.5'),
  'arrow-up': ps('M12 20V4', 'M5.5 10.5L12 4l6.5 6.5'),
  'arrow-down': ps('M12 4v16', 'M5.5 13.5L12 20l6.5-6.5'),
  check: p('M4.5 12.5l5 5 10-11'),
  copy: rect(9, 9, 11.5, 11.5, 2) + p('M15 9V6.5a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2H9'),
  x: ps('M6 6l12 12', 'M18 6L6 18'),
  menu: ps('M4 7h16', 'M4 12h16', 'M4 17h16'),
  sparkles: ps('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z', 'M5 3.5l.5 1.3 1.3.5-1.3.5L5 7l-.5-1.2-1.3-.5 1.3-.5z'),
  quote: ps('M9.5 7.5C6.8 8 5 9.9 5 12.8V17h4.5v-4.5H7c.1-1.6 1-2.6 2.5-3z', 'M19 7.5c-2.7.5-4.5 2.4-4.5 5.3V17H19v-4.5h-2.5c.1-1.6 1-2.6 2.5-3z'),
  'chevron-left': p('M14.5 5.5L8 12l6.5 6.5'),
  'chevron-right': p('M9.5 5.5L16 12l-6.5 6.5'),
  play: p('M7 4.5v15l12-7.5z'),
  pause: rect(6.5, 5, 3.5, 14, 1) + rect(14, 5, 3.5, 14, 1),
};

export const ICON_NAMES = Object.freeze(Object.keys(GLYPHS));

/**
 * @param {string} name icon key (see ICON_NAMES)
 * @param {{size?: number, class?: string, title?: string}} [opts]
 * @returns {Raw} inline SVG markup
 */
export function icon(name, { size = 20, class: className = '', title = '' } = {}) {
  const glyph = GLYPHS[name];
  if (glyph === undefined) {
    throw new Error(`icon(): unknown icon "${name}". Known: ${ICON_NAMES.join(', ')}`);
  }
  const filled = FILLED.has(name);
  const paint = filled
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  const cls = `icon icon-${name}${className ? ` ${escapeAttr(className)}` : ''}`;
  const a11y = title ? `role="img" aria-label="${escapeAttr(title)}"` : 'aria-hidden="true" focusable="false"';
  const titleEl = title ? `<title>${escapeHtml(title)}</title>` : '';
  return new Raw(
    `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${paint} ${a11y}>${titleEl}${glyph}</svg>`,
  );
}

/** True when `name` is a valid icon key (used by content validation). */
export const hasIcon = (name) => Object.hasOwn(GLYPHS, name);
