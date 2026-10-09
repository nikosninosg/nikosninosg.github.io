/**
 * HOME page: hero (typed role line, canvas network, profile card), stats strip, about teaser,
 * featured projects, skills marquee + category preview, experience preview, testimonials carousel
 * and a closing CTA band.
 *
 * All copy comes from ctx (content/*.json). The only literals here are UI labels (see LABELS);
 * edit them in one place. Markup contract: src/COMPONENTS.md. Styles: assets/css/pages/home.css.
 */
import { existsSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { html, raw } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';
import { SHARED_CSS, cvButton, softLine, quoteRole } from './_shared.mjs';

/** UI labels only. Everything else is content. */
const LABELS = {
  viewProjects: 'View projects',
  getInTouch: 'Get in touch',
  scroll: 'Scroll',
  findMe: 'Find me',
  about: { eyebrow: 'About', title: 'A bit about me', more: 'More about me', soft: 'Soft skills' },
  work: { eyebrow: 'Selected work', title: 'Featured projects', all: 'All projects', cta: 'View project' },
  skills: { eyebrow: 'Skills', title: 'Languages, tools & libraries' },
  experience: { eyebrow: 'Experience', title: 'Where I have worked', all: 'Full experience & education', present: 'Present' },
  testimonials: { eyebrow: 'Testimonials', title: 'Kind words' },
  cta: { title: "Let's build something together", text: 'Have a project, an idea or just want to say hi? My inbox is open.' },
};

/** Icon per skill category (falls back to "code"). */
/** Categories that are always shown in full (no "Show more"). */
const SHOW_ALL = new Set(['Technologies']);

/** Skill cards: Technologies top-left, Libraries top-right, then the remaining groups in content order. */
const SKILL_CARD_ORDER = ['Technologies', 'Libraries'];
const orderSkillGroups = (groups) => [
  ...SKILL_CARD_ORDER.map((n) => groups.find((g) => g.category === n)).filter(Boolean),
  ...groups.filter((g) => !SKILL_CARD_ORDER.includes(g.category)),
];

const SKILL_ICONS = { Languages: 'code', Technologies: 'terminal', Libraries: 'layers', 'Workflow & testing': 'workflow' };

const legacyRedirect = `(function(){var h=location.hash.slice(1);if(!h)return;var m={about:'about.html',resume:'about.html',skills:'about.html',facts:'about.html',experience:'experience.html',education:'experience.html#education',certificates:'experience.html#certificates',projects:'projects.html',portfolio:'projects.html',contact:'contact.html','contact-form':'contact.html#contact-form'};if(Object.prototype.hasOwnProperty.call(m,h))location.replace(m[h]);})();`;

// ---------------------------------------------------------------------------
// Image helpers (intrinsic size from the file header so width/height are always right)
// ---------------------------------------------------------------------------
const sizeCache = new Map();

function imageSize(root, rel) {
  if (sizeCache.has(rel)) return sizeCache.get(rel);
  const file = join(root, rel);
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(32);
    readSync(fd, head, 0, 32, 0);
    let size;
    if (head.readUInt32BE(0) === 0x89504e47) {
      size = { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    } else if (head[0] === 0xff && head[1] === 0xd8) {
      const buf = Buffer.alloc(Math.min(statSync(file).size, 262144));
      readSync(fd, buf, 0, buf.length, 0);
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
          break;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (!size) throw new Error(`home.mjs: cannot read the dimensions of ${rel}`);
    sizeCache.set(rel, size);
    return size;
  } finally {
    closeSync(fd);
  }
}

/** Portrait: use the resized me-900.jpg when it exists, otherwise me.jpg. */
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

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
function eyebrow(index, label) {
  return html`<p class="eyebrow"><span class="eyebrow__index">${index}</span><span class="eyebrow__label">${label}</span></p>`;
}

/** The little "profile.ts" card in the hero (decorative, aria-hidden, built from content only). */
function codeCard(ctx) {
  const { site, skills, experience, projects, certificates } = ctx;
  const current = experience.find((e) => e.end === 'present');
  const languages = (skills.find((g) => g.category === 'Languages') ?? skills[0]).items.map((i) => i.name);
  const s = (v) => html`<span class="tok-str">"${v}"</span>`;
  const pairs = (list) => Array.from({ length: Math.ceil(list.length / 2) }, (_, i) => list.slice(i * 2, i * 2 + 2));
  const row = (key, value) => html`  <span class="tok-prop">${key}</span>: ${value},`;
  const lines = [
    html`<span class="tok-key">const</span> <span class="tok-var">${site.shortName.toLowerCase()}</span> = {`,
    row('title', s(site.title)),
    row('location', s(site.location)),
    ...(current ? [row('currently', s(current.company))] : []),
    html`  <span class="tok-prop">stack</span>: [`,
    ...pairs(languages).map((p) => html`    ${p.map((l, i) => html`${i ? ', ' : ''}${s(l)}`)},`),
    html`  ],`,
    row('projects', html`<span class="tok-num">${projects.length}</span>`),
    row('certifications', html`<span class="tok-num">${certificates.length}</span>`),
    html`};`,
  ];
  return html`
      <aside class="hero__aside">
        <div class="code-card card" data-tilt aria-hidden="true">
          <div class="code-card__bar">
            <span class="code-card__dots"><i></i><i></i><i></i></span>
            <span class="code-card__file">profile.ts</span>
          </div>
          <pre class="code-card__body"><code>${lines.map((l, i) => html`${i ? '\n' : ''}${l}`)}<span class="code-card__cursor"></span></code></pre>
        </div>
      </aside>`;
}

function hero(ctx) {
  const { site, url } = ctx;
  return html`
<section class="hero" aria-labelledby="hero-title" data-hero>
  <div class="hero__bg" aria-hidden="true">
    <canvas data-network aria-hidden="true"></canvas>
  </div>
  <div class="container hero__inner">
    <div class="hero__content">
      <p class="hero__badge badge badge--accent"><span class="badge__dot"></span>${site.location}</p>
      <h1 class="hero__name" id="hero-title" data-scramble-load aria-label="${site.name}">${site.name}</h1>
      <p class="hero__role"><span class="hero__prefix">${site.heroPrefix}</span> <span data-typed="${JSON.stringify(site.roles)}">${site.roles[0]}</span></p>
      <p class="hero__intro">${site.intro}</p>
      <div class="hero__actions">
        <span class="hero__cv-inline">${cvButton(ctx)}</span>
        <a class="btn btn-ghost btn-lg" href="${url('projects.html')}" data-magnetic>${LABELS.viewProjects}${icon('arrow-right')}</a>
        <a class="btn btn-ghost btn-lg" href="${url('contact.html')}" data-magnetic>${LABELS.getInTouch}</a>
      </div>
      <div class="hero__socials">
        <span class="hero__socials-label">${LABELS.findMe}</span>
        <ul class="hero__socials-list">
          ${site.socials.map((s) => html`<li><a class="icon-btn" href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.label} (opens in a new tab)" data-magnetic>${icon(s.id, { size: 18 })}</a></li>`)}
          <li><a class="icon-btn" href="mailto:${site.email}" aria-label="Email ${site.email}" data-magnetic>${icon('mail', { size: 18 })}</a></li>
        </ul>
      </div>
    </div>
    ${codeCard(ctx)}
  </div>
  <a class="scroll-cue" href="#highlights"><span class="scroll-cue__label">${LABELS.scroll}</span><span class="scroll-cue__line" aria-hidden="true"></span></a>
</section>`;
}

function stats(ctx) {
  const { site } = ctx;
  return html`
<section class="section section--tight stats" id="highlights" aria-label="Highlights">
  <div class="container">
    <div class="grid grid--3 stats__grid" data-reveal-stagger>
      ${site.stats.map((s) => {
        const suffix = s.suffix ?? '';
        return html`
      <div class="stat" data-spotlight data-reveal>
        <span class="stat__icon">${icon(s.icon, { size: 20 })}</span>
        <span class="stat__value" data-count="${s.value}"${suffix ? html` data-suffix="${suffix}"` : ''}>${s.value}${suffix}</span>
        <span class="stat__label">${s.label}</span>
      </div>`;
      })}
    </div>
  </div>
</section>`;
}

function aboutTeaser(ctx) {
  const { site, url } = ctx;
  const photo = portrait(ctx);
  const kc = site.about.keyCharacteristic;
  return html`
<section class="section about-teaser" id="about-teaser" aria-labelledby="about-teaser-title">
  <span class="section__blob" aria-hidden="true"></span>
  <div class="container about-teaser__grid">
    <div class="about-teaser__media" data-reveal="left">
      <figure class="photo-frame">
        <img class="photo-frame__img" src="${photo.src}"${photo.srcset ? html` srcset="${photo.srcset}" sizes="(min-width: 900px) 440px, 80vw"` : ''} width="${photo.width}" height="${photo.height}" alt="Portrait of ${site.name}" loading="lazy" decoding="async">
      </figure>
    </div>
    <div class="about-teaser__body" data-reveal-stagger>
      <header class="section-head" data-reveal>
        ${eyebrow('01', LABELS.about.eyebrow)}
        <h2 class="section-title" id="about-teaser-title">${LABELS.about.title}</h2>
      </header>
      <p class="about-teaser__lead" data-reveal>${site.about.paragraphs[0]}</p>
      <aside class="callout callout--accent" data-reveal>
        <p class="callout__label">${kc.label}</p>
        <p class="callout__text">${kc.text}</p>
      </aside>
      <div class="about-teaser__skills" data-reveal>
        <p class="about-teaser__skills-label">${LABELS.about.soft}</p>
        ${softLine(ctx, { label: LABELS.about.soft })}
      </div>
      <p data-reveal><a class="link-arrow" href="${url('about.html')}">${LABELS.about.more}</a></p>
    </div>
  </div>
</section>`;
}

function projectCard(ctx, p) {
  const { url, root } = ctx;
  const catLabel = Object.fromEntries(ctx.categories.map((c) => [c.id, c.label]));
  const { width, height } = imageSize(root, p.cover.src);
  const shown = p.technologies.slice(0, 5);
  const more = p.technologies.length - shown.length;
  return html`
      <li data-reveal>
        <article class="project-card card" data-tilt>
          <div class="project-card__media">
            <img src="${url(p.cover.src)}" width="${width}" height="${height}" alt="${p.cover.alt}" loading="lazy" decoding="async">
          </div>
          <div class="project-card__body">
            <div class="project-card__meta">
              ${p.categories.map((c, i) => html`<span class="badge${i === 0 ? ' badge--accent' : ''}">${catLabel[c] ?? c}</span>`)}
              ${p.period ?? p.year ? html`<span>${p.period ?? p.year}</span>` : ''}
            </div>
            <h3 class="project-card__title"><a class="project-card__link" href="${url(`projects/${p.slug}.html`)}">${p.title}</a></h3>
            <p class="project-card__summary">${p.summary}</p>
            <ul class="tag-list project-card__tags" aria-label="Technologies">
              ${shown.map((t) => html`<li class="tag">${t}</li>`)}
              ${more > 0 ? html`<li class="tag">+${more}</li>` : ''}
            </ul>
            <span class="project-card__cta link-arrow" aria-hidden="true">${LABELS.work.cta}</span>
          </div>
        </article>
      </li>`;
}

function featured(ctx) {
  const { featuredProjects, categories, url } = ctx;
  const labels = categories.map((c) => c.label);
  const lede = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
  return html`
<section class="section" id="work" aria-labelledby="work-title">
  <div class="container">
    <header class="section-head section-head--split" data-reveal>
      ${eyebrow('02', LABELS.work.eyebrow)}
      <h2 class="section-title" id="work-title">${LABELS.work.title}</h2>
      <p class="section-lede">${lede}.</p>
      <a class="link-arrow" href="${url('projects.html')}">${LABELS.work.all}</a>
    </header>
    <ul class="grid grid--2 featured-grid" role="list" data-reveal-stagger>
      ${featuredProjects.map((p) => projectCard(ctx, p))}
    </ul>
  </div>
</section>`;
}

/** One marquee row. The tracks repeat the list so a track is always wider than the viewport. */
function marqueeRow(names, dir, duration, decorative = false) {
  const items = (hidden) => names.map((n) => html`<li class="marquee__item chip"${hidden ? raw(' aria-hidden="true"') : ''}>${n}</li>`);
  return html`
      <div class="marquee__row" data-dir="${dir}" style="--marquee-duration:${duration}s"${decorative ? raw(' aria-hidden="true"') : ''}>
        <ul class="marquee__track">${items(false)}${items(true)}</ul>
        <ul class="marquee__track" aria-hidden="true">${items(true)}${items(true)}</ul>
      </div>`;
}

function skills(ctx) {
  const { skills: all } = ctx;
  const groups = orderSkillGroups(all);
  const names = groups.flatMap((g) => g.items.map((i) => i.name));
  return html`
<section class="section section--alt skills" id="skills" aria-labelledby="skills-title">
  <span class="section__blob section__blob--violet" aria-hidden="true"></span>
  <div class="container">
    <header class="section-head section-head--center" data-reveal>
      ${eyebrow('03', LABELS.skills.eyebrow)}
      <h2 class="section-title" id="skills-title">${LABELS.skills.title}</h2>
    </header>
  </div>
  <div class="marquee skills__marquee" data-marquee aria-label="${LABELS.skills.eyebrow}">
    ${marqueeRow(names, 'left', 52)}
    ${marqueeRow([...names].reverse(), 'right', 60, true)}
  </div>
  <div class="container">
    <div class="grid grid--2 skills__cats" data-reveal-stagger>
      ${groups.map((g) => html`
      <article class="card skill-cat" data-reveal>
        <header class="skill-cat__head">
          <span class="skill-cat__icon">${icon(SKILL_ICONS[g.category] ?? 'code', { size: 20 })}</span>
          <h3 class="skill-cat__title">${g.category}</h3>
        </header>
        <ul class="cluster gap-sm skill-chips" role="list" data-skill-list${SHOW_ALL.has(g.category) ? raw(' data-skill-all') : ''}>
          ${g.items.map((i) => html`<li>${i.url
            ? html`<a class="chip chip--sm" href="${i.url}" target="_blank" rel="noopener noreferrer">${i.name}</a>`
            : html`<span class="chip chip--sm">${i.name}</span>`}</li>`)}
        </ul>
      </article>`)}
    </div>
  </div>
</section>`;
}

function experiencePreview(ctx) {
  const { experience, url } = ctx;
  return html`
<section class="section xp-preview" id="experience-preview" aria-labelledby="xp-title">
  <div class="container xp-layout">
    <header class="section-head xp-layout__intro" data-reveal>
      ${eyebrow('04', LABELS.experience.eyebrow)}
      <h2 class="section-title" id="xp-title">${LABELS.experience.title}</h2>
      <p class="xp-layout__action"><a class="btn btn-ghost" href="${url('experience.html')}">${LABELS.experience.all}${icon('arrow-right')}</a></p>
    </header>
    <div class="timeline timeline--single" data-timeline>
      <span class="timeline__line" aria-hidden="true"><span class="timeline__progress" data-timeline-progress></span></span>
      <ol class="timeline__list">
        ${experience.slice(0, 2).map((e) => {
          const tech = e.technologies.slice(0, 6);
          const more = e.technologies.length - tech.length;
          return html`
        <li class="timeline-item" data-reveal>
          <span class="timeline-item__marker" aria-hidden="true"></span>
          <div class="timeline-item__card card">
            <p class="timeline-item__period">${e.end === 'present' ? html`<span class="badge__dot xp-now" title="${LABELS.experience.present}" aria-hidden="true"></span>` : ''}<span>${e.period}</span></p>
            <h3 class="timeline-item__title">${e.role}</h3>
            <p class="timeline-item__org">${e.company} · ${e.location}</p>
            <ul class="timeline-item__list">
              ${e.bullets.slice(0, 3).map((b) => html`<li>${b}</li>`)}
            </ul>
            <ul class="tag-list" aria-label="Technologies">
              ${tech.map((t) => html`<li class="tag">${t}</li>`)}
              ${more > 0 ? html`<li class="tag">+${more}</li>` : ''}
            </ul>
          </div>
        </li>`;
        })}
      </ol>
    </div>
  </div>
</section>`;
}

function testimonials(ctx) {
  const { testimonials: items } = ctx;
  return html`
<section class="section section--alt testimonials" id="testimonials" aria-labelledby="testimonials-title">
  <div class="container">
    <header class="section-head section-head--center" data-reveal>
      ${eyebrow('05', LABELS.testimonials.eyebrow)}
      <h2 class="section-title" id="testimonials-title">${LABELS.testimonials.title}</h2>
    </header>
  </div>
  <div class="container" data-reveal>
    <div class="carousel" data-carousel data-autoplay="6500" role="region" aria-roledescription="carousel" aria-label="Testimonials">
      <div class="carousel__track" data-carousel-track tabindex="0">
        ${items.map((t, i) => html`
        <article class="carousel__slide" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${items.length}">
          <figure class="quote card">
            ${icon('quote', { size: 32 })}
            <blockquote class="quote__text"><p>${t.quote}</p></blockquote>
            <figcaption class="quote__author"><strong>${t.name}</strong>${quoteRole(t)}</figcaption>
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

function closingCta(ctx) {
  const { site, url } = ctx;
  return html`
<section class="section section--tight closing" aria-labelledby="cta-title">
  <div class="container">
    <div class="cta-band" data-reveal="zoom">
      <h2 class="cta-band__title" id="cta-title">${LABELS.cta.title}</h2>
      <p class="cta-band__text">${LABELS.cta.text}</p>
      <div class="cta-band__actions">
        <a class="btn btn-primary btn-lg" href="${url('contact.html')}" data-magnetic>${LABELS.getInTouch}${icon('arrow-right')}</a>
        <button class="btn btn-ghost btn-lg" type="button" data-copy="${site.email}" data-copy-message="Email address copied" data-copied-label="Copied!" data-magnetic>${icon('copy')}<span data-copy-label>${site.email}</span></button>
      </div>
    </div>
  </div>
</section>`;
}

export default function render(ctx) {
  const { site } = ctx;
  return {
    id: 'home',
    path: 'index.html',
    description: site.seo.description,
    css: [SHARED_CSS, 'assets/css/pages/home.css'],
    js: ['assets/js/pages/skills.js'],
    body: html`
<script>${raw(legacyRedirect)}</script>
${hero(ctx)}
${stats(ctx)}
${aboutTeaser(ctx)}
${featured(ctx)}
${skills(ctx)}
${experiencePreview(ctx)}
${testimonials(ctx)}
${closingCta(ctx)}`,
  };
}
