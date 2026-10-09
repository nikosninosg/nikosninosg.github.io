/**
 * EXPERIENCE page: intro + actions, animated work timeline, education, certificates, closing CTA.
 *
 * It doubles as the printable CV. The `.print-only` header block (name, contact line, profile, skills)
 * is hidden on screen and shown by the @media print rules in assets/css/pages/experience.css, which
 * turn the rest of the page into a compact, ATS-friendly A4 document.
 *
 * Text comes from content/*.json; the only literals here are UI labels (LABELS).
 * Markup contract: src/COMPONENTS.md (timeline hooks, section-head, card, badge, tag...).
 */
import { html } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { SHARED_CSS, cvCard, cvNote } from './_shared.mjs';

/** UI labels only. Everything else is content. */
/** Bullets shown before the "Show more" disclosure. */
const VISIBLE_BULLETS = 4;

const LABELS = {
  lede: 'Where I have worked, the client engagements I have delivered, what I studied and the certificates I have earned.',
  print: 'Print / Save as PDF',
  contact: 'Get in touch',
  jump: 'On this page',
  work: { eyebrow: 'Work', title: 'Professional experience' },
  engagements: {
    eyebrow: 'Engagements',
    title: 'Client engagements',
    lede: 'Projects delivered for telecom clients at Cognity, newest first. Filter by client or browse by year.',
    filter: 'Filter engagements by client',
    all: 'All',
    ongoing: 'Ongoing',
    more: 'More details',
    count: (n, total) => (n === total ? `${total} engagements` : `${n} of ${total} engagements`),
    empty: 'No engagements for this client.',
    started: 'Started',
  },
  education: { eyebrow: 'Education', title: 'Education' },
  certificates: { eyebrow: 'Certificates', title: 'Certificates & training' },
  languages: { eyebrow: 'Languages', title: 'Languages', details: 'Certificates' },
  volunteering: 'Volunteering',
  showMore: (n) => `Show ${n} more`,
  showLess: 'Show less',
  current: 'Current',
  technologies: 'Technologies',
  grade: 'Grade',
  thesis: 'Thesis',
  profile: 'Profile',
  skills: 'Skills',
  cta: { title: "Let's build something together", text: 'Have a project, an idea or just want to say hi? My inbox is open.' },
};

/**
 * Whole months covered by a finished role, counted inclusively ("2022-02" to "2022-06" = 5 months,
 * like most CVs and LinkedIn do). Deterministic: depends only on the content, never on today's date.
 * Ongoing roles ("present") get no duration; their period already reads "since MM/YYYY".
 */
function duration(start, end) {
  const m = (v) => /^(\d{4})-(\d{2})$/.exec(v ?? '');
  const [s, e] = [m(start), m(end)];
  if (!s || !e) return '';
  const months = (Number(e[1]) - Number(s[1])) * 12 + (Number(e[2]) - Number(s[2])) + 1;
  if (months < 1) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? 'mo' : 'mos'}`);
  return parts.join(' ');
}

/** "https://www.linkedin.com/in/x/" -> "linkedin.com/in/x" (visible text for the print header). */
const bare = (url) => String(url).replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

function eyebrow(index, label) {
  return html`<p class="eyebrow"><span class="eyebrow__index">${index}</span><span class="eyebrow__label">${label}</span></p>`;
}

/** Print-only CV header: identity + contact line, profile summary, compact skills. Hidden on screen. */
function printHeader(ctx) {
  const { site, skills } = ctx;
  const social = (id) => site.socials.find((s) => s.id === id);
  const links = [social('github'), social('linkedin')].filter(Boolean);
  return html`
<div class="print-only cv-head">
  <p class="cv-head__name">${site.name}</p>
  <p class="cv-head__title">${site.title}</p>
  <ul class="cv-head__contact" role="list">
    <li><a href="mailto:${site.email}">${site.email}</a></li>
    <li>${site.location}</li>
    <li><a href="${site.url}">${bare(site.url)}</a></li>
    ${links.map((s) => html`<li><a href="${s.url}">${bare(s.url)}</a></li>`)}
  </ul>
  <h2 class="cv-head__heading">${LABELS.profile}</h2>
  <p class="cv-head__profile">${site.intro}</p>
  <h2 class="cv-head__heading">${LABELS.skills}</h2>
  <ul class="cv-head__skills" role="list">
    ${skills.map((g) => html`<li><strong>${g.category}:</strong> ${g.items.map((i) => i.name).join(', ')}</li>`)}
  </ul>
</div>`;
}

function intro(ctx) {
  const { url } = ctx;
  return html`
<header class="page-hero xp-hero">
  <div class="container">
    <p class="eyebrow"><span class="eyebrow__label">Career</span></p>
    <h1 class="page-hero__title">Experience</h1>
    <p class="page-hero__lede">${LABELS.lede}</p>
    ${cvCard(ctx)}
    <div class="xp-actions">
      <button class="btn btn-ghost" type="button" data-print data-magnetic>${icon('print')}${LABELS.print}</button>
      <a class="btn btn-ghost" href="${url('contact.html')}" data-magnetic>${LABELS.contact}${icon('arrow-right')}</a>
    </div>
    <nav class="xp-jump" aria-label="${LABELS.jump}">
      <a class="chip" href="#work">${icon('briefcase', { size: 15 })}${LABELS.work.eyebrow}</a>
      ${ctx.engagements?.length ? html`<a class="chip" href="#engagements">${icon('workflow', { size: 15 })}${LABELS.engagements.eyebrow}</a>` : ''}
      <a class="chip" href="#education">${icon('graduation', { size: 15 })}${LABELS.education.eyebrow}</a>
      <a class="chip" href="#certificates">${icon('award', { size: 15 })}${LABELS.certificates.eyebrow}</a>
      ${ctx.languages?.length ? html`<a class="chip" href="#languages">${icon('globe', { size: 15 })}${LABELS.languages.eyebrow}</a>` : ''}
    </nav>
  </div>
</header>`;
}

function timelineItem(e, index) {
  const ongoing = e.end === 'present';
  const span = ongoing ? '' : duration(e.start, e.end);
  // Alternate the entrance direction on desktop; the page css flattens it to "up" on narrow screens.
  const reveal = index % 2 === 0 ? 'left' : 'right';
  const volunteering = e.kind === 'volunteering';
  const shown = e.bullets.slice(0, VISIBLE_BULLETS);
  const rest = e.bullets.slice(VISIBLE_BULLETS);
  return html`
        <li class="timeline-item xp-item${volunteering ? ' xp-item--volunteering' : ''}" data-reveal="${reveal}" style="--i:${index + 1}" data-kind="${e.kind ?? 'work'}">
          <span class="timeline-item__marker" aria-hidden="true"></span>
          <div class="timeline-item__card card">
            <p class="timeline-item__period xp-period">
              <span class="xp-pill">${icon('calendar', { size: 14 })}<span class="xp-pill__text">${e.period}</span></span>
              ${ongoing ? html`<span class="badge badge--success xp-current"><span class="badge__dot" aria-hidden="true"></span>${LABELS.current}</span>` : ''}
              ${span ? html`<span class="xp-duration">${span}</span>` : ''}
              ${volunteering ? html`<span class="badge xp-kind">${icon('handshake', { size: 13 })}${LABELS.volunteering}</span>` : ''}
            </p>
            <h3 class="timeline-item__title">${e.role}</h3>
            <p class="timeline-item__org xp-org"><strong class="xp-company">${e.company}</strong><span class="xp-sep" aria-hidden="true"> · </span><span class="xp-loc">${icon('map-pin', { size: 14 })}${e.location}</span></p>
            ${e.summary ? html`<p class="xp-summary">${e.summary}</p>` : ''}
            <ul class="timeline-item__list xp-list">
              ${shown.map((b) => html`<li>${b}</li>`)}
            </ul>
            ${rest.length ? html`
            <details class="xp-more">
              <summary class="xp-more__summary"><span class="xp-more__open">${LABELS.showMore(rest.length)}</span><span class="xp-more__close">${LABELS.showLess}</span>${icon('chevron-right', { size: 14 })}</summary>
              <ul class="timeline-item__list xp-list xp-list--rest">
                ${rest.map((b) => html`<li>${b}</li>`)}
              </ul>
            </details>` : ''}
            ${e.technologies?.length ? html`
            <ul class="tag-list xp-tags" aria-label="${LABELS.technologies}">
              ${e.technologies.map((t) => html`<li class="tag">${t}</li>`)}
            </ul>` : ''}
          </div>
        </li>`;
}

function work(ctx) {
  const { experience } = ctx;
  return html`
<section class="section xp-section xp-work" id="work" aria-labelledby="work-title">
  <span class="section__blob" aria-hidden="true"></span>
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow('01', LABELS.work.eyebrow)}
      <h2 class="section-title" id="work-title">${LABELS.work.title}</h2>
    </header>
    <div class="timeline" data-timeline>
      <span class="timeline__line" aria-hidden="true"><span class="timeline__progress" data-timeline-progress></span></span>
      <ol class="timeline__list">
        ${experience.map(timelineItem)}
      </ol>
    </div>
  </div>
</section>`;
}

/** First sentence + the rest, so a long description collapses to one readable line plus a disclosure. */
function splitSummary(text) {
  if (text.length < 190) return [text, ''];
  const m = /^(.{40,}?[.!?])\s+(?=[A-Z(])/.exec(text);
  return m ? [m[1], text.slice(m[0].length)] : [text, ''];
}

function engagementItem(e) {
  const [lead, rest] = splitSummary(e.summary);
  const ongoing = e.end === 'present';
  return html`
        <li class="eng" data-eng data-client="${e.client}">
          <div class="eng__meta">
            <p class="eng__period">${e.period}${ongoing ? html` <span class="badge badge--success eng__ongoing"><span class="badge__dot" aria-hidden="true"></span>${LABELS.engagements.ongoing}</span>` : ''}</p>
            <p class="eng__client"><span class="badge badge--accent">${e.client}</span>${e.country ? html`<span class="eng__country">${icon('map-pin', { size: 13 })}${e.country}</span>` : ''}</p>
          </div>
          <article class="eng__body card">
            <h4 class="eng__title">${e.title}</h4>
            <p class="eng__lead">${lead}</p>
            ${rest ? html`
            <details class="xp-more eng__more">
              <summary class="xp-more__summary"><span class="xp-more__open">${LABELS.engagements.more}</span><span class="xp-more__close">${LABELS.showLess}</span>${icon('chevron-right', { size: 14 })}</summary>
              <p class="eng__rest">${rest}</p>
            </details>` : ''}
            ${e.technologies?.length ? html`
            <ul class="tag-list eng__tags" aria-label="${LABELS.technologies}">
              ${e.technologies.map((t) => html`<li class="tag">${t}</li>`)}
            </ul>` : ''}
          </article>
        </li>`;
}

function engagements(ctx) {
  const items = ctx.engagements ?? [];
  if (!items.length) return '';
  const clients = [...new Set(items.map((e) => e.client))];
  const counts = Object.fromEntries(clients.map((c) => [c, items.filter((e) => e.client === c).length]));
  // Group by start year, keeping the content order (newest first) inside and between groups.
  const years = [];
  for (const e of items) {
    const y = String(e.start).slice(0, 4);
    let g = years.find((x) => x.year === y);
    if (!g) years.push((g = { year: y, items: [] }));
    g.items.push(e);
  }
  return html`
<section class="section section--alt xp-section xp-eng" id="engagements" aria-labelledby="eng-title" data-engagements>
  <span class="section__blob section__blob--violet" aria-hidden="true"></span>
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow('02', LABELS.engagements.eyebrow)}
      <h2 class="section-title" id="eng-title">${LABELS.engagements.title}</h2>
      <p class="section-lede">${LABELS.engagements.lede}</p>
    </header>
    <div class="eng-toolbar" data-eng-toolbar>
      <div class="filter-bar eng-filter" role="group" aria-label="${LABELS.engagements.filter}">
        <button class="chip" type="button" data-eng-filter="all" aria-pressed="true">${LABELS.engagements.all} <span class="chip__count">${items.length}</span></button>
        ${clients.map((c) => html`<button class="chip" type="button" data-eng-filter="${c}" aria-pressed="false">${c} <span class="chip__count">${counts[c]}</span></button>`)}
      </div>
      <p class="eng-count" data-eng-count role="status" aria-live="polite">${LABELS.engagements.count(items.length, items.length)}</p>
    </div>
    <div class="eng-years">
      ${years.map((g) => html`
      <section class="eng-year" data-eng-year aria-label="${LABELS.engagements.started} ${g.year}">
        <h3 class="eng-year__title"><span>${g.year}</span></h3>
        <ol class="eng-list">${g.items.map(engagementItem)}
        </ol>
      </section>`)}
    </div>
    <p class="eng-empty" data-eng-empty hidden>${LABELS.engagements.empty}</p>
  </div>
</section>`;
}

function educationCard(e) {
  return html`
      <li data-reveal>
        <article class="card edu-card">
          <header class="edu-card__head">
            <span class="edu-card__icon">${icon('graduation', { size: 22 })}</span>
            <p class="edu-card__period xp-pill">${icon('calendar', { size: 14 })}<span class="xp-pill__text">${e.period}</span></p>
          </header>
          <h3 class="edu-card__degree">${e.degree}</h3>
          <p class="edu-card__school">${e.school}</p>
          <p class="edu-card__loc xp-loc">${icon('map-pin', { size: 14 })}${e.location}</p>
          <ul class="xp-list">
            ${e.bullets.map((b) => html`<li>${b}</li>`)}
          </ul>
          ${e.thesis ? html`
          <div class="edu-card__thesis">
            <p class="edu-card__label">${LABELS.thesis}</p>
            <p>${e.thesis}</p>
          </div>` : ''}
          ${e.honors ? html`<p class="edu-card__honors">${e.honors}</p>` : ''}
          ${e.grade ? html`
          <p class="edu-card__grade"><span class="badge badge--accent">${LABELS.grade}</span><strong class="edu-card__grade-value">${e.grade}</strong></p>` : ''}
        </article>
      </li>`;
}

function education(ctx) {
  const { education: items } = ctx;
  return html`
<section class="section section--alt xp-section xp-education" id="education" aria-labelledby="education-title">
  <span class="section__blob section__blob--violet" aria-hidden="true"></span>
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow(ctx.engagements?.length ? '03' : '02', LABELS.education.eyebrow)}
      <h2 class="section-title" id="education-title">${LABELS.education.title}</h2>
    </header>
    <ul class="grid grid--2 edu-grid" role="list" data-reveal-stagger>
      ${items.map(educationCard)}
    </ul>
  </div>
</section>`;
}

function certificates(ctx) {
  const { certificates: items } = ctx;
  return html`
<section class="section xp-section xp-certs" id="certificates" aria-labelledby="certificates-title">
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow(ctx.engagements?.length ? '04' : '03', LABELS.certificates.eyebrow)}
      <h2 class="section-title" id="certificates-title">${LABELS.certificates.title}</h2>
    </header>
    <ul class="grid grid--3 cert-grid" role="list" data-reveal-stagger>
      ${items.map((c) => html`
      <li data-reveal>
        <article class="card cert-card">
          <header class="cert-card__head">
            <span class="cert-card__icon">${icon(c.icon, { size: 22 })}</span>
            <p class="cert-card__date">${c.date}</p>
          </header>
          <h3 class="cert-card__title">${c.title}</h3>
          <p class="cert-card__issuer">${c.issuer}</p>
          <p class="cert-card__desc">${c.description}</p>
          ${c.hours ? html`<p class="cert-card__hours">${icon('clock', { size: 14 })}<span>${c.hours}</span></p>` : ''}
        </article>
      </li>`)}
    </ul>
  </div>
</section>`;
}

function languages(ctx) {
  const items = ctx.languages ?? [];
  if (!items.length) return '';
  const n = ctx.engagements?.length ? '05' : '04';
  return html`
<section class="section section--alt xp-section xp-langs" id="languages" aria-labelledby="languages-title">
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow(n, LABELS.languages.eyebrow)}
      <h2 class="section-title" id="languages-title">${LABELS.languages.title}</h2>
    </header>
    <ul class="grid grid--2 lang-grid" role="list" data-reveal-stagger>
      ${items.map((l) => html`
      <li data-reveal>
        <article class="card lang-card">
          <header class="lang-card__head">
            <h3 class="lang-card__name">${l.language}</h3>
            <span class="badge badge--accent lang-card__level">${l.level}</span>
          </header>
          ${l.details?.length ? html`
          <ul class="lang-card__details" aria-label="${LABELS.languages.details}">
            ${l.details.map((d) => html`<li>${d}</li>`)}
          </ul>` : ''}
        </article>
      </li>`)}
    </ul>
  </div>
</section>`;
}

function closingCta(ctx) {
  const { url } = ctx;
  return html`
<section class="section section--tight xp-cta" aria-labelledby="xp-cta-title">
  <div class="container">
    <div class="cta-band" data-reveal="zoom">
      <h2 class="cta-band__title" id="xp-cta-title">${LABELS.cta.title}</h2>
      <p class="cta-band__text">${LABELS.cta.text}</p>
      <div class="cta-band__actions">
        <a class="btn btn-primary btn-lg" href="${url('contact.html')}" data-magnetic>${LABELS.contact}${icon('arrow-right')}</a>
        <button class="btn btn-ghost btn-lg" type="button" data-print data-magnetic>${icon('print')}${LABELS.print}</button>
      </div>
    </div>
  </div>
</section>`;
}

export default function render(ctx) {
  const { site } = ctx;
  return {
    id: 'experience',
    path: 'experience.html',
    title: 'Experience',
    description: `Work experience, client engagements, education, certificates and languages of ${site.name}, ${site.title}.`,
    css: [SHARED_CSS, 'assets/css/pages/experience.css'],
    js: ['assets/js/pages/experience.js'],
    body: html`
${printHeader(ctx)}
${intro(ctx)}
${work(ctx)}
${engagements(ctx)}
${education(ctx)}
${certificates(ctx)}
${languages(ctx)}
${closingCta(ctx)}`,
  };
}
