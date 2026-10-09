/**
 * Helpers shared by several page modules (not a page itself, build.mjs never imports it directly).
 * Styles for everything emitted here: assets/css/pages/shared.css (add it to the page's `css` list).
 * Copy comes from ctx; the literals are UI labels only.
 */
import { html } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';

export const SHARED_CSS = 'assets/css/pages/shared.css';

export function eyebrow(index, label) {
  return html`<p class="eyebrow"><span class="eyebrow__index">${index}</span><span class="eyebrow__label">${label}</span></p>`;
}

/** "PDF · 351 KB" from ctx.cv (null when the content has no CV). */
export function cvNote(cv) {
  if (!cv) return '';
  return [cv.format, cv.sizeKB ? `${cv.sizeKB} KB` : ''].filter(Boolean).join(' · ');
}

/** Primary "Download CV" button with a PDF/size note inside it. Plain link (no tracking attributes). */
export function cvButton(ctx, { size = 'lg', label = 'Download CV', magnetic = true } = {}) {
  const { cv } = ctx;
  if (!cv) return '';
  const sizeCls = size ? ` btn-${size}` : '';
  return html`<a class="btn btn-primary${sizeCls} cv-btn" href="${ctx.url(cv.href)}" download${magnetic ? html` data-magnetic` : ''}>${icon('download')}<span class="cv-btn__label">${label}</span><span class="cv-btn__note">${cvNote(cv)}</span></a>`;
}

/** Compact CV download row/card used in the about and experience headers. */
export function cvCard(ctx, { cta = 'Download' } = {}) {
  const { cv } = ctx;
  if (!cv) return '';
  const updated = cv.updated ? html`<span class="cv-card__updated">Updated ${cv.updated}</span>` : '';
  return html`
<div class="cv-card card card--flat">
  <span class="cv-card__icon" aria-hidden="true">${icon('download', { size: 22 })}</span>
  <div class="cv-card__text">
    <p class="cv-card__title">${cv.label}</p>
    <p class="cv-card__meta"><span>${cvNote(cv)}</span>${updated}</p>
  </div>
  <a class="btn btn-primary btn-sm cv-card__btn" href="${ctx.url(cv.href)}" download>${icon('download')}${cta}<span class="sr-only"> ${cv.label}, ${cvNote(cv)}</span></a>
</div>`;
}

/**
 * Soft skills as ONE inline line: a real list, dot-separated, wraps gracefully. The dot belongs to the LEFT of each
 * item and the list is pulled left inside a clipping wrapper, so a dot that lands at the start of a wrapped line is
 * clipped and nothing ever dangles at the end of a line (see .softline in assets/css/pages/shared.css).
 */
export function softLine(ctx, { label = 'Soft skills', className = '' } = {}) {
  const items = ctx.softSkills ?? [];
  if (!items.length) return '';
  return html`<div class="softline-wrap"><ul class="softline ${className}" role="list" aria-label="${label}">${items.map((s) => html`<li class="softline__item">${s.name}</li>`)}</ul></div>`;
}

/** Testimonial role line: "Role" + (company as external link when t.url exists, plain text otherwise). */
export function quoteRole(t) {
  const company = t.company
    ? t.url
      ? html`<a class="quote__company" href="${t.url}" target="_blank" rel="noopener noreferrer">${t.company}<span class="sr-only"> (opens in a new tab)</span></a>`
      : html`<span class="quote__company">${t.company}</span>`
    : '';
  return html`<span class="quote__role">${t.role}${company ? html`<span class="quote__sep" aria-hidden="true"> · </span>` : ''}${company}</span>`;
}

/**
 * Soft skills as icon pills (About page): same list semantics as softLine(), but each item is a rounded pill with
 * its content icon. Wraps naturally; no separators needed.
 */
export function softPills(ctx, { label = 'Soft skills' } = {}) {
  const items = ctx.softSkills ?? [];
  if (!items.length) return '';
  return html`<ul class="softpills" role="list" aria-label="${label}" data-reveal-stagger>${items.map((s) => html`<li class="softpill" data-reveal><span class="softpill__icon" aria-hidden="true">${icon(s.icon, { size: 18 })}</span><span class="softpill__name">${s.name}</span></li>`)}</ul>`;
}
