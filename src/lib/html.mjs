/**
 * Tiny, dependency-free HTML templating helpers.
 *
 *   html`<a href="${url}">${label}</a>`   -> every interpolation is escaped
 *   raw('<b>trusted</b>')                 -> opt out of escaping (trusted markup only)
 *
 * `html` returns a Raw instance, so results nest freely:
 *   html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`
 *
 * Interpolation rules
 *   - Raw (from raw() or a nested html``)  -> inserted untouched
 *   - Array                                -> each item rendered by these same rules, then joined with ''
 *   - null / undefined / false / true      -> '' (so `${cond && html`…`}` and `${cond ? a : b}` just work)
 *   - everything else                      -> String(value), HTML-escaped (text AND attribute safe)
 */

/** Marker class for trusted, already-escaped markup. */
export class Raw {
  constructor(value) {
    this.value = String(value);
  }
  toString() {
    return this.value;
  }
}

export const isRaw = (v) => v instanceof Raw;

/** Mark a string as trusted markup. Never pass content-derived data through this. */
export const raw = (str) => (isRaw(str) ? str : new Raw(str ?? ''));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape for HTML text nodes. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Escape for HTML attribute values (same rules; named separately for intent). */
export const escapeAttr = escapeHtml;

/** Render any interpolation value to a safe string. */
function renderValue(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

/** Tagged template: escapes interpolations, returns Raw. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new Raw(out);
}

/** Convert any html``/Raw/string-safe value into a plain string (strings are escaped). */
export const toString = (value) => renderValue(value);

/**
 * Build an attribute string from an object, e.g. attrs({class:'a', hidden:true, 'data-x':null})
 * -> ` class="a" hidden`. Values are escaped; false/null/undefined are omitted; true renders a bare attribute.
 */
export function attrs(map = {}) {
  let out = '';
  for (const [key, value] of Object.entries(map)) {
    if (value === false || value === null || value === undefined) continue;
    if (!/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(key)) throw new Error(`attrs(): invalid attribute name "${key}"`);
    out += value === true ? ` ${key}` : ` ${key}="${escapeAttr(value)}"`;
  }
  return new Raw(out);
}

const LINE_SEP = new RegExp('\\u2028', 'g');
const PARA_SEP = new RegExp('\\u2029', 'g');

/** Serialise data for a <script type="application/json"> / ld+json block (safe against </script> and U+2028/9). */
export function json(data, space) {
  const str = JSON.stringify(data, null, space)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEP, '\\u2028')
    .replace(PARA_SEP, '\\u2029');
  return new Raw(str);
}

/** JS string/value literal that is safe inside an inline <script> (no raw "<", ">", "&", U+2028/9). */
export function jsLiteral(value) {
  return json(value).value;
}

/** Lower-case, ASCII, hyphen-separated slug. */
export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format "YYYY-MM" (or "YYYY") as "Jul 2022". "present" stays "Present".
 * Anything unrecognised is returned unchanged.
 */
export function formatDate(value) {
  if (!value) return '';
  if (String(value).toLowerCase() === 'present') return 'Present';
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(String(value));
  if (!m) return String(value);
  const month = m[2] ? MONTHS[Number(m[2]) - 1] : null;
  return month ? `${month} ${m[1]}` : m[1];
}

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i;

/**
 * Join a URL prefix ("", "../", "/") with a repo-root-relative path.
 * Absolute URLs (https:, mailto:, //host), fragments and queries are returned untouched.
 */
export function joinUrl(base, path = '') {
  const p = String(path);
  if (ABSOLUTE.test(p)) return p;
  const clean = p.replace(/^(?:\.\/)+/, '').replace(/^\/+/, '');
  const out = `${base}${clean}`;
  return out === '' ? './' : out;
}
