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

/** UI labels only. Everything else is content. */
const LABELS = {
  lede: 'Where I have worked, what I studied and the certificates I have earned.',
  print: 'Print / Save as PDF',
  contact: 'Get in touch',
  jump: 'On this page',
  work: { eyebrow: 'Work', title: 'Professional experience' },
  education: { eyebrow: 'Education', title: 'Education' },
  certificates: { eyebrow: 'Certificates', title: 'Certificates & training' },
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
    <div class="xp-actions">
      <button class="btn btn-primary" type="button" data-print data-magnetic>${icon('print')}${LABELS.print}</button>
      <a class="btn btn-ghost" href="${url('contact.html')}" data-magnetic>${LABELS.contact}${icon('arrow-right')}</a>
    </div>
    <nav class="xp-jump" aria-label="${LABELS.jump}">
      <a class="chip" href="#work">${icon('briefcase', { size: 15 })}${LABELS.work.eyebrow}</a>
      <a class="chip" href="#education">${icon('graduation', { size: 15 })}${LABELS.education.eyebrow}</a>
      <a class="chip" href="#certificates">${icon('award', { size: 15 })}${LABELS.certificates.eyebrow}</a>
    </nav>
  </div>
</header>`;
}

function timelineItem(e, index) {
  const ongoing = e.end === 'present';
  const span = ongoing ? '' : duration(e.start, e.end);
  // Alternate the entrance direction on desktop; the page css flattens it to "up" on narrow screens.
  const reveal = index % 2 === 0 ? 'left' : 'right';
  return html`
        <li class="timeline-item xp-item" data-reveal="${reveal}" style="--i:${index + 1}">
          <span class="timeline-item__marker" aria-hidden="true"></span>
          <div class="timeline-item__card card">
            <p class="timeline-item__period xp-period">
              <span class="xp-pill">${icon('calendar', { size: 14 })}<span class="xp-pill__text">${e.period}</span></span>
              ${ongoing ? html`<span class="badge badge--success xp-current"><span class="badge__dot" aria-hidden="true"></span>${LABELS.current}</span>` : ''}
              ${span ? html`<span class="xp-duration">${span}</span>` : ''}
            </p>
            <h3 class="timeline-item__title">${e.role}</h3>
            <p class="timeline-item__org xp-org"><strong class="xp-company">${e.company}</strong><span class="xp-sep" aria-hidden="true"> · </span><span class="xp-loc">${icon('map-pin', { size: 14 })}${e.location}</span></p>
            <ul class="timeline-item__list xp-list">
              ${e.bullets.map((b) => html`<li>${b}</li>`)}
            </ul>
            <ul class="tag-list xp-tags" aria-label="${LABELS.technologies}">
              ${e.technologies.map((t) => html`<li class="tag">${t}</li>`)}
            </ul>
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
      ${eyebrow('02', LABELS.education.eyebrow)}
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
      ${eyebrow('03', LABELS.certificates.eyebrow)}
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
    description: `Work experience, education and certificates of ${site.name}, ${site.title}.`,
    css: ['assets/css/pages/experience.css'],
    js: ['assets/js/pages/experience.js'],
    body: html`
${printHeader(ctx)}
${intro(ctx)}
${work(ctx)}
${education(ctx)}
${certificates(ctx)}
${closingCta(ctx)}`,
  };
}
