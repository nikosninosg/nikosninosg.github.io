/**
 * CONTACT page: intro, direct-contact cards (email + copy, location, social profiles) and the
 * contact form.
 *
 * Form flow (see assets/js/pages/contact.js):
 *   - No JS: a plain POST to site.formEndpoint. formsubmit.co then redirects to `_next`
 *     (contact.html?sent=1#form-sent); the `:target` rule in contact.css reveals the success panel.
 *   - JS: the submit is intercepted and POSTed with fetch() to site.formAjaxEndpoint; the result is
 *     shown inline (success / error panel) without leaving the page.
 *
 * Copy that describes the owner (email, location, profile URLs) comes from content/site.json; the
 * literals below are UI labels and invitation copy only (see LABELS). Styles: assets/css/pages/contact.css.
 */
import { html } from '../lib/html.mjs';
import { icon } from '../lib/icons.mjs';

/** UI labels only. Everything about the owner is content. */
const LABELS = {
  eyebrow: 'Contact',
  title: ['Let’s build something', 'together'],
  lede: 'Have a project, an idea or a question about my work? Send me a message and let’s see what we can create.',
  jumpForm: 'Write a message',
  direct: { eyebrow: 'Direct', title: 'Reach me directly' },
  email: { label: 'Email', write: 'Email me', copy: 'Copy address', copied: 'Copied!', copyMessage: 'Email address copied' },
  location: { label: 'Based in' },
  elsewhere: { label: 'Find me elsewhere' },
  form: {
    eyebrow: 'Message',
    title: 'Send a message',
    intro: 'Fill in the form and it lands straight in my inbox.',
    optional: '(optional)',
    name: 'Your name',
    email: 'Your email',
    subject: 'Subject',
    message: 'Message',
    namePlaceholder: 'Jane Doe',
    emailPlaceholder: 'jane@example.com',
    subjectPlaceholder: 'What is this about?',
    messagePlaceholder: 'Tell me a bit about your project or idea…',
    send: 'Send message',
    sending: 'Sending…',
    honey: 'Leave this field empty',
    subjectLine: 'New message from nikosninosg.github.io',
  },
  success: { title: 'Message sent', text: 'Thank you for reaching out. I will reply to the email address you provided.', again: 'Send another message' },
  error: { title: 'The message could not be sent', text: 'Something went wrong on the way. Your text is still in the form, so you can try again, or write to me directly at' },
};

/** Limits shared by the markup (maxlength / minlength) and the script (data-* on the form). */
const LIMITS = { nameMin: 2, nameMax: 120, subjectMax: 160, messageMin: 10, messageMax: 2000 };

/** Short, human handle shown on a social card, derived from the profile URL (no invented data). */
function handleOf(social) {
  const { hostname, pathname } = new URL(social.url);
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return hostname.replace(/^www\./, '');
  return social.id === 'github' ? `@${segments[0]}` : segments.join('/');
}

function intro(ctx) {
  const { site } = ctx;
  // Decorative network (pure SVG; CSS animates the pulse). Node positions are fixed, not data.
  const nodes = [[40, 120], [120, 60], [210, 150], [300, 70], [360, 170], [150, 230], [260, 250], [60, 250], [330, 20]];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 4], [0, 7], [7, 5], [1, 3], [3, 8]];
  return html`
<header class="page-hero contact-hero">
  <div class="container contact-hero__inner">
    <div class="contact-hero__text">
      <p class="eyebrow"><span class="eyebrow__label">${LABELS.eyebrow}</span></p>
      <h1 class="page-hero__title contact-hero__title">${LABELS.title[0]} <span class="text-gradient">${LABELS.title[1]}</span>.</h1>
      <p class="page-hero__lede">${LABELS.lede}</p>
      <div class="cluster gap-sm contact-hero__actions">
        <a class="btn btn-primary" href="#contact-form" data-magnetic>${icon('message')}${LABELS.jumpForm}</a>
        <a class="btn btn-ghost" href="mailto:${site.email}" data-magnetic>${icon('mail')}${site.email}</a>
      </div>
    </div>
    <svg class="contact-hero__net" viewBox="0 0 400 280" aria-hidden="true" focusable="false">
      <g class="contact-hero__links">${links.map(([a, b]) => html`<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}"/>`)}</g>
      <g class="contact-hero__nodes">${nodes.map(([x, y], i) => html`<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 6 : 4}" style="--i:${i}"/>`)}</g>
    </svg>
  </div>
</header>`;
}

function emailCard(ctx) {
  const { site } = ctx;
  return html`
    <article class="card card--glow contact-card contact-card--email" data-reveal>
      <header class="contact-card__head">
        <span class="contact-card__icon">${icon('mail', { size: 20 })}</span>
        <h3 class="contact-card__label">${LABELS.email.label}</h3>
      </header>
      <p class="contact-card__value"><a href="mailto:${site.email}">${site.email}</a></p>
      <div class="cluster gap-sm contact-card__actions">
        <a class="btn btn-primary btn-sm" href="mailto:${site.email}">${icon('mail')}${LABELS.email.write}</a>
        <button class="btn btn-ghost btn-sm" type="button" data-copy="${site.email}" data-copy-message="${LABELS.email.copyMessage}" data-copied-label="${LABELS.email.copied}">${icon('copy')}<span data-copy-label>${LABELS.email.copy}</span></button>
      </div>
    </article>`;
}

function locationCard(ctx) {
  const { site } = ctx;
  return html`
    <article class="card contact-card contact-card--location" data-reveal>
      <header class="contact-card__head">
        <span class="contact-card__icon">${icon('map-pin', { size: 20 })}</span>
        <h3 class="contact-card__label">${LABELS.location.label}</h3>
      </header>
      <p class="contact-card__value contact-card__value--plain">${site.location}</p>
    </article>`;
}

function socialCards(ctx) {
  const { site } = ctx;
  if (!site.socials.length) return '';
  return html`
    <div class="contact-social" data-reveal>
      <h3 class="contact-social__title">${LABELS.elsewhere.label}</h3>
      <ul class="contact-social__list" role="list">
        ${site.socials.map((s) => html`
        <li>
          <a class="card card--interactive contact-social__link" href="${s.url}" target="_blank" rel="noopener noreferrer">
            <span class="contact-social__icon">${icon(s.id, { size: 20 })}</span>
            <span class="contact-social__text">
              <span class="contact-social__name">${s.label}<span class="sr-only"> (opens in a new tab)</span></span>
              <span class="contact-social__handle">${handleOf(s)}</span>
            </span>
            <span class="contact-social__go" aria-hidden="true">${icon('external', { size: 16 })}</span>
          </a>
        </li>`)}
      </ul>
    </div>`;
}

/** One labelled field. `control` is the prebuilt <input>/<textarea>; `extra` renders after the error line. */
function field({ id, label, optional = false, control, hint = null }) {
  return html`
        <div class="form-field contact-field" data-field>
          <div class="contact-field__top">
            <label class="form-field__label" for="${id}">${label}${optional ? html` <span class="contact-field__optional">${LABELS.form.optional}</span>` : ''}</label>
            ${hint}
          </div>
          ${control}
          <p class="form-field__error" id="${id}-error" role="alert"></p>
        </div>`;
}

function form(ctx) {
  const { site } = ctx;
  const f = LABELS.form;
  return html`
    <div class="card contact-form-card" id="contact-form" data-reveal data-form-card>
      <header class="contact-form-card__head">
        <p class="eyebrow"><span class="eyebrow__index">02</span><span class="eyebrow__label">${f.eyebrow}</span></p>
        <h2 class="contact-form-card__title">${f.title}</h2>
        <p class="contact-form-card__intro">${f.intro}</p>
      </header>

      <div class="form-status" data-form-status role="status" aria-live="polite">
        <div class="alert alert--success contact-panel contact-panel--success" id="form-sent" data-panel="success" tabindex="-1">
          <span class="contact-panel__icon">${icon('check', { size: 20 })}</span>
          <div class="contact-panel__body">
            <p class="contact-panel__title">${LABELS.success.title}</p>
            <p class="contact-panel__text">${LABELS.success.text}</p>
            <button class="btn btn-ghost btn-sm contact-panel__again" type="button" data-form-reset>${LABELS.success.again}</button>
          </div>
        </div>
        <div class="alert alert--error contact-panel contact-panel--error" data-panel="error" tabindex="-1">
          <span class="contact-panel__icon">${icon('x', { size: 20 })}</span>
          <div class="contact-panel__body">
            <p class="contact-panel__title">${LABELS.error.title}</p>
            <p class="contact-panel__text">${LABELS.error.text} <a href="mailto:${site.email}">${site.email}</a>.</p>
          </div>
        </div>
      </div>

      <form class="contact-form" data-contact-form action="${site.formEndpoint}" method="POST"
        data-ajax-endpoint="${site.formAjaxEndpoint}"
        data-name-min="${LIMITS.nameMin}" data-message-min="${LIMITS.messageMin}" data-message-max="${LIMITS.messageMax}">
        <input type="hidden" name="_subject" value="${f.subjectLine}">
        <input type="hidden" name="_captcha" value="false">
        <input type="hidden" name="_template" value="table">
        <input type="hidden" name="_next" value="${ctx.abs('contact.html')}?sent=1#form-sent">
        <!-- Honeypot: invisible to people, tempting to bots. -->
        <div class="sr-only" aria-hidden="true">
          <label>${f.honey}<input type="text" name="_honey" tabindex="-1" autocomplete="off"></label>
        </div>

        <div class="contact-form__grid">
          ${field({
            id: 'cf-name',
            label: f.name,
            control: html`<input class="input" id="cf-name" name="name" type="text" required minlength="${LIMITS.nameMin}" maxlength="${LIMITS.nameMax}" autocomplete="name" placeholder="${f.namePlaceholder}" aria-describedby="cf-name-error">`,
          })}
          ${field({
            id: 'cf-email',
            label: f.email,
            control: html`<input class="input" id="cf-email" name="email" type="email" required inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="${f.emailPlaceholder}" aria-describedby="cf-email-error">`,
          })}
        </div>
        ${field({
          id: 'cf-subject',
          label: f.subject,
          optional: true,
          control: html`<input class="input" id="cf-subject" name="subject" type="text" maxlength="${LIMITS.subjectMax}" autocomplete="off" placeholder="${f.subjectPlaceholder}" aria-describedby="cf-subject-error">`,
        })}
        ${field({
          id: 'cf-message',
          label: f.message,
          hint: html`<span class="contact-field__count" id="cf-message-count" data-counter aria-hidden="true">0 / ${LIMITS.messageMax}</span>`,
          control: html`<textarea class="textarea" id="cf-message" name="message" required minlength="${LIMITS.messageMin}" maxlength="${LIMITS.messageMax}" rows="6" placeholder="${f.messagePlaceholder}" aria-describedby="cf-message-error"></textarea>`,
        })}

        <div class="contact-form__actions">
          <button class="btn btn-primary btn-lg" type="submit" data-submit>
            <span data-submit-label>${f.send}</span>${icon('arrow-right')}
          </button>
        </div>
      </form>
    </div>`;
}

export default function render(ctx) {
  const { site } = ctx;
  return {
    id: 'contact',
    path: 'contact.html',
    title: 'Contact',
    description: `Get in touch with ${site.name}: email${site.socials.length ? `, ${site.socials.map((x) => x.label).join(' and ')}` : ''}, or send a message through the contact form.`,
    css: ['assets/css/pages/contact.css'],
    js: ['assets/js/pages/contact.js'],
    breadcrumbs: [{ name: 'Home', path: 'index.html' }, { name: 'Contact', path: 'contact.html' }],
    body: html`
${intro(ctx)}
<section class="section section--flush-top contact-main" aria-label="Contact options">
  <span class="section__blob" aria-hidden="true"></span>
  <div class="container contact-layout">
    <div class="contact-aside">
      <p class="eyebrow" data-reveal><span class="eyebrow__index">01</span><span class="eyebrow__label">${LABELS.direct.eyebrow}</span></p>
      <h2 class="contact-aside__title" data-reveal>${LABELS.direct.title}</h2>
      <div class="contact-aside__cards" data-reveal-stagger>
        ${emailCard(ctx)}
        ${locationCard(ctx)}
      </div>
      ${socialCards(ctx)}
    </div>
    ${form(ctx)}
  </div>
</section>`,
  };
}
