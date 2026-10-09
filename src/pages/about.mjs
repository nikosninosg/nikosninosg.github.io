/**
 * ABOUT page: intro hero with jump links, bio + portrait + quick facts + key-characteristic callout,
 * the full skills section (one accent-coloured card per category), soft skills, testimonials carousel
 * and a "where next" closing section.
 *
 * Copy comes from ctx (content/*.json); the literals below are UI labels only (see LABELS).
 * Markup contract: src/COMPONENTS.md. Styles: assets/css/pages/about.css (page-scoped, `about-*` / `skill-*`).
 */
import { existsSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { html } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { SHARED_CSS, cvCard, softLine, quoteRole } from './_shared.mjs';

/** UI labels only. Everything else is content. */
const LABELS = {
  eyebrow: 'About',
  greeting: "Hi, I'm",
  jump: 'On this page',
  profile: { eyebrow: 'Profile', title: 'Who I am' },
  facts: 'Quick facts',
  findMe: 'Find me',
  skills: { eyebrow: 'Skills', title: 'Languages, tools & libraries' },
  soft: { eyebrow: 'Strengths', title: 'Soft skills', lede: 'The habits that make the technical work land.' },
  testimonials: { eyebrow: 'Testimonials', title: 'Kind words' },
  next: { eyebrow: 'Next', title: 'Where to next?', lede: 'The rest of the story is a click away.' },
};

/** Skill category -> icon + accent token (the CSS reads `data-accent`). */
const CATEGORY_STYLE = {
  Languages: { icon: 'code', accent: 'teal' },
  Technologies: { icon: 'terminal', accent: 'green' },
  Libraries: { icon: 'layers', accent: 'violet' },
};
const ACCENTS = ['teal', 'green', 'violet'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** JPEG/PNG intrinsic size from the file header so width/height are always correct. */
function imageSize(root, rel) {
  const file = join(root, rel);
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(32);
    readSync(fd, head, 0, 32, 0);
    if (head.readUInt32BE(0) === 0x89504e47) return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    const buf = Buffer.alloc(Math.min(statSync(file).size, 262144));
    readSync(fd, buf, 0, buf.length, 0);
    for (let i = 2; i < buf.length - 9; ) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    throw new Error(`about.mjs: cannot read the dimensions of ${rel}`);
  } finally {
    closeSync(fd);
  }
}

/** Portrait: the resized me-900.jpg when it exists (plus me.jpg in srcset), otherwise me.jpg. */
function portrait(ctx) {
  const full = 'assets/img/me.jpg';
  const small = 'assets/img/me-900.jpg';
  const hasSmall = existsSync(join(ctx.root, small));
  const main = hasSmall ? small : full;
  const { width, height } = imageSize(ctx.root, main);
  return {
    src: ctx.url(main),
    width,
    height,
    srcset: hasSmall ? `${ctx.url(small)} ${imageSize(ctx.root, small).width}w, ${ctx.url(full)} ${imageSize(ctx.root, full).width}w` : null,
  };
}

/** Decorative 1-3 letter monogram for a skill (no external logos): "TypeScript" -> TS, "Scikit-Learn" -> SL, "Python" -> Py. */
function monogram(name) {
  const words = name.split(/[\s\-_.]+/).filter(Boolean);
  const parts = words.flatMap((w) => w.match(/[A-Z]+(?![a-z])|[A-Z][a-z]*|[a-z]+/g) ?? [w]);
  if (parts.length > 1) return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const w = parts[0] ?? name;
  return w === w.toUpperCase() ? w.slice(0, 3) : w[0].toUpperCase() + (w[1] ?? '').toLowerCase();
}

const initialsOf = (name) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

/** "https://nikosninosg.github.io" -> "nikosninosg.github.io" (display only; the href keeps the full URL). */
const stripProtocol = (v) => v.replace(/^https?:\/\//, '').replace(/\/$/, '');

function eyebrow(index, label) {
  return html`<p class="eyebrow"><span class="eyebrow__index">${index}</span><span class="eyebrow__label">${label}</span></p>`;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
function hero(ctx) {
  const { site } = ctx;
  const jumps = [
    ['#profile', LABELS.profile.eyebrow],
    ['#skills', LABELS.skills.eyebrow],
    ['#soft-skills', LABELS.soft.eyebrow],
    ['#testimonials', LABELS.testimonials.eyebrow],
  ];
  return html`
<header class="page-hero about-hero">
  <div class="container about-hero__inner">
    <p class="eyebrow"><span class="eyebrow__label">${LABELS.eyebrow}</span></p>
    <h1 class="page-hero__title about-hero__title">${LABELS.greeting} <span class="text-gradient">${site.shortName}</span>.</h1>
    <p class="page-hero__lede">${site.title} based in ${site.location}. ${site.tagline}.</p>
    ${cvCard(ctx)}
    <nav class="about-jump" aria-label="${LABELS.jump}">
      <ul class="cluster gap-sm" role="list">
        ${jumps.map(([href, label]) => html`<li><a class="chip chip--mono" href="${href}">${label}</a></li>`)}
      </ul>
    </nav>
  </div>
</header>`;
}

function profile(ctx) {
  const { site } = ctx;
  const photo = portrait(ctx);
  const kc = site.about.keyCharacteristic;
  const [lead, ...rest] = site.about.paragraphs;
  return html`
<section class="section section--flush-top about-bio" id="profile" aria-labelledby="profile-title">
  <span class="section__blob" aria-hidden="true"></span>
  <div class="container about-bio__grid">
    <div class="about-bio__media" data-reveal="left">
      <div class="about-bio__sticky">
        <figure class="photo-frame about-bio__frame" data-tilt>
          <img class="photo-frame__img" src="${photo.src}"${photo.srcset ? html` srcset="${photo.srcset}" sizes="(min-width: 900px) 440px, 80vw"` : ''} width="${photo.width}" height="${photo.height}" alt="Portrait of ${site.name}" decoding="async" fetchpriority="high">
          <figcaption class="about-bio__tag">
            <span class="badge__dot" aria-hidden="true"></span>
            <span>${site.location}</span>
          </figcaption>
        </figure>
      </div>
    </div>

    <div class="about-bio__body" data-reveal-stagger>
      <header class="section-head" data-reveal>
        ${eyebrow('01', LABELS.profile.eyebrow)}
        <h2 class="section-title" id="profile-title">${LABELS.profile.title}</h2>
      </header>

      <div class="about-bio__text" data-reveal>
        <p class="about-bio__lead">${lead}</p>
        ${rest.map((p) => html`<p>${p}</p>`)}
      </div>

      <aside class="callout callout--accent about-bio__callout" data-reveal>
        <p class="callout__label">${kc.label}</p>
        <p class="callout__text">${kc.text}</p>
      </aside>

      <div class="about-bio__facts" data-reveal>
        <h3 class="about-label">${LABELS.facts}</h3>
        <dl class="about-facts" data-reveal-stagger>
          ${site.facts.map((f) => html`
          <div class="about-fact card card--flat" data-reveal>
            <span class="about-fact__icon">${icon(f.icon, { size: 18 })}</span>
            <dt class="about-fact__label">${f.label}</dt>
            <dd class="about-fact__value">${/^https?:\/\//.test(f.value)
              ? html`<a href="${f.value}">${stripProtocol(f.value)}</a>`
              : f.value}</dd>
          </div>`)}
        </dl>
      </div>

      <div class="about-bio__social" data-reveal>
        <span class="about-label">${LABELS.findMe}</span>
        <ul class="about-social" role="list">
          ${site.socials.map((s) => html`<li><a class="icon-btn" href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.label} (opens in a new tab)" title="${s.label}" data-magnetic>${icon(s.id, { size: 18 })}</a></li>`)}
          <li><a class="icon-btn" href="mailto:${site.email}" aria-label="Email ${site.email}" title="Email" data-magnetic>${icon('mail', { size: 18 })}</a></li>
        </ul>
      </div>
    </div>
  </div>
</section>`;
}

function skills(ctx) {
  const { skills: groups } = ctx;
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return html`
<section class="section section--alt about-skills" id="skills" aria-labelledby="skills-title">
  <span class="section__blob section__blob--violet" aria-hidden="true"></span>
  <div class="container">
    <header class="section-head section-head--split" data-reveal>
      ${eyebrow('02', LABELS.skills.eyebrow)}
      <h2 class="section-title" id="skills-title">${LABELS.skills.title}</h2>
      <p class="section-lede"><span class="mono">${total}</span> skills across <span class="mono">${groups.length}</span> categories.</p>
    </header>
    <div class="grid skill-board" data-reveal-stagger>
      ${groups.map((g, i) => {
        const style = CATEGORY_STYLE[g.category] ?? { icon: 'code', accent: ACCENTS[i % ACCENTS.length] };
        const slug = g.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return html`
      <article class="card skill-card" data-accent="${style.accent}" data-reveal aria-labelledby="skill-${slug}">
        <header class="skill-card__head">
          <span class="skill-card__icon">${icon(style.icon, { size: 22 })}</span>
          <div class="skill-card__heading">
            <h3 class="skill-card__title" id="skill-${slug}">${g.category}</h3>
          </div>
        </header>
        <ul class="skill-list" role="list">
          ${g.items.map((s) => {
            const label = html`<span class="skill__mono" aria-hidden="true">${monogram(s.name)}</span><span class="skill__name">${s.name}</span>`;
            return s.url
              ? html`<li><a class="skill" href="${s.url}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (opens in a new tab)</span>${icon('external', { size: 15, class: 'skill__go' })}</a></li>`
              : html`<li><span class="skill">${label}</span></li>`;
          })}
        </ul>
      </article>`;
      })}
    </div>
  </div>
</section>`;
}

function softSkills(ctx) {
  return html`
<section class="section about-soft" id="soft-skills" aria-labelledby="soft-title">
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow('03', LABELS.soft.eyebrow)}
      <h2 class="section-title" id="soft-title">${LABELS.soft.title}</h2>
      <p class="section-lede">${LABELS.soft.lede}</p>
    </header>
    <div class="soft-line" data-reveal>
      ${softLine(ctx, { label: LABELS.soft.title })}
    </div>
  </div>
</section>`;
}

function testimonials(ctx) {
  const { testimonials: items } = ctx;
  return html`
<section class="section section--alt about-quotes" id="testimonials" aria-labelledby="testimonials-title">
  <div class="container">
    <header class="section-head section-head--center" data-reveal>
      ${eyebrow('04', LABELS.testimonials.eyebrow)}
      <h2 class="section-title" id="testimonials-title">${LABELS.testimonials.title}</h2>
    </header>
  </div>
  <div class="container" data-reveal>
    <div class="carousel" data-carousel data-autoplay="7500" role="region" aria-roledescription="carousel" aria-label="Testimonials">
      <div class="carousel__track" data-carousel-track tabindex="0">
        ${items.map((t, i) => html`
        <article class="carousel__slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${items.length}">
          <figure class="quote card">
            ${icon('quote', { size: 32 })}
            <blockquote class="quote__text"><p>${t.quote}</p></blockquote>
            <figcaption class="quote__author">
              <span class="quote__avatar" aria-hidden="true">${initialsOf(t.name)}</span>
              <span class="quote__who"><strong>${t.name}</strong>${quoteRole(t)}</span>
            </figcaption>
          </figure>
        </article>`)}
      </div>
      <div class="carousel__controls">
        <button class="icon-btn" type="button" data-carousel-prev aria-label="Previous testimonial">${icon('chevron-left', { size: 18 })}</button>
        <div class="carousel__dots" data-carousel-dots></div>
        <button class="icon-btn" type="button" data-carousel-next aria-label="Next testimonial">${icon('chevron-right', { size: 18 })}</button>
        <button class="icon-btn" type="button" data-carousel-toggle aria-label="Pause autoplay" aria-pressed="false">
          <span class="carousel__toggle-icon carousel__toggle-icon--pause">${icon('pause', { size: 16 })}</span>
          <span class="carousel__toggle-icon carousel__toggle-icon--play">${icon('play', { size: 16 })}</span>
        </button>
      </div>
    </div>
  </div>
</section>`;
}

/** Closing section: three big link cards. The numbers are derived from content, never typed in. */
function whereNext(ctx) {
  const { url, experience, education, certificates, projects, engagements } = ctx;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const cards = [
    { href: 'experience.html', icon: 'briefcase', title: 'Experience', meta: [plural(experience.length, 'role'), ...(engagements?.length ? [plural(engagements.length, 'engagement')] : []), plural(education.length, 'degree'), plural(certificates.length, 'certificate')] },
    { href: 'projects.html', icon: 'folder', title: 'Projects', meta: [plural(projects.length, 'project')] },
    { href: 'contact.html', icon: 'mail', title: 'Contact', meta: ["Let's talk"], primary: true },
  ];
  return html`
<section class="section about-next" aria-labelledby="next-title">
  <div class="container">
    <header class="section-head" data-reveal>
      ${eyebrow('05', LABELS.next.eyebrow)}
      <h2 class="section-title" id="next-title">${LABELS.next.title}</h2>
      <p class="section-lede">${LABELS.next.lede}</p>
    </header>
    <ul class="grid next-grid" role="list" data-reveal-stagger>
      ${cards.map((c) => html`
      <li data-reveal>
        <a class="next-card card card--interactive${c.primary ? ' card--glow next-card--primary' : ''}" href="${url(c.href)}">
          <span class="next-card__icon">${icon(c.icon, { size: 22 })}</span>
          <span class="next-card__title">${c.title}</span>
          <span class="next-card__meta">${c.meta.join(' · ')}</span>
          <span class="next-card__arrow" aria-hidden="true">${icon('arrow-right', { size: 20 })}</span>
        </a>
      </li>`)}
    </ul>
  </div>
</section>`;
}

export default function render(ctx) {
  const { site } = ctx;
  return {
    id: 'about',
    path: 'about.html',
    title: 'About',
    description: site.about.paragraphs[0],
    css: [SHARED_CSS, 'assets/css/pages/about.css'],
    js: [],
    breadcrumbs: [{ name: 'About', path: 'about.html' }],
    body: html`
${hero(ctx)}
${profile(ctx)}
${skills(ctx)}
${softSkills(ctx)}
${testimonials(ctx)}
${whereNext(ctx)}`,
  };
}
