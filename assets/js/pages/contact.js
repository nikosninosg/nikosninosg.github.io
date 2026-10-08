/**
 * pages/contact.js: progressive enhancement for the contact form.
 *
 * Without JS the form is a plain POST to formsubmit.co (see src/pages/contact.mjs). With JS we
 *   - take over validation (native constraint API + friendly inline messages, aria-invalid / aria-describedby),
 *   - POST the data with fetch() to the AJAX endpoint (data-ajax-endpoint) and show the result inline,
 *   - drive the status panels through data-state="idle|success|error" on [data-form-card],
 *   - show the success panel when the no-JS flow lands back here with ?sent=1.
 */
import { $, $$, toast } from '../modules/core.js';

const card = $('[data-form-card]');
const form = $('[data-contact-form]', card ?? document);

if (card && form) init();

function init() {
  const endpoint = form.dataset.ajaxEndpoint;
  const submit = $('[data-submit]', form);
  const submitLabel = $('[data-submit-label]', form);
  const idleLabel = submitLabel.textContent;
  const counter = $('[data-counter]', form);
  const message = form.elements.message;
  const messageMax = Number(form.dataset.messageMax) || message.maxLength;
  const touched = new WeakSet();
  let sending = false;

  // From now on we own validation: no native bubbles, our messages are inline and accessible.
  form.noValidate = true;
  setState('idle');

  // ---------------------------------------------------------------- validation
  /** Returns an error message for the control, or '' when it is fine. */
  function problem(control) {
    const { validity } = control;
    const value = control.value.trim();
    switch (control.name) {
      case 'name':
        if (!value) return 'Please tell me your name.';
        if (value.length < control.minLength) return `Your name needs at least ${control.minLength} characters.`;
        return '';
      case 'email':
        if (!value) return 'Please enter your email so I can reply.';
        // The built-in type check accepts "a@b"; also require a dot in the domain.
        if (validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'That does not look like a valid email address.';
        return '';
      case 'message':
        if (!value) return 'Please write a message.';
        if (value.length < control.minLength) return `Please add a few more details (at least ${control.minLength} characters).`;
        return '';
      default:
        return validity.valid ? '' : control.validationMessage;
    }
  }

  function show(control, error) {
    const field = control.closest('[data-field]');
    const out = $(`#${control.id}-error`, form);
    out.textContent = error;
    field.classList.toggle('is-invalid', Boolean(error));
    field.classList.toggle('is-valid', !error && control.value.trim() !== '' && touched.has(control));
    if (error) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  }

  const validate = (control) => {
    const error = problem(control);
    show(control, error);
    return !error;
  };

  const controls = () => $$('input.input, textarea.textarea', form);

  // Validate when leaving a field; once a field is flagged, re-check live so the message clears as soon as it is fixed.
  form.addEventListener('focusout', (event) => {
    const control = event.target;
    if (!(control instanceof HTMLElement) || !control.matches('input.input, textarea.textarea')) return;
    touched.add(control);
    validate(control);
  });

  form.addEventListener('input', (event) => {
    const control = event.target;
    if (control === message) updateCounter();
    if (control instanceof HTMLElement && control.getAttribute('aria-invalid') === 'true') validate(control);
    // A new attempt supersedes an old failure message.
    if (card.dataset.state === 'error') setState('idle');
  });

  // ---------------------------------------------------------------- counter
  function updateCounter() {
    const length = message.value.length;
    counter.textContent = `${length} / ${messageMax}`;
    counter.dataset.state = length >= messageMax ? 'limit' : length >= messageMax * 0.9 ? 'near' : '';
  }
  updateCounter();

  // ---------------------------------------------------------------- state
  function setState(state, { focus = false } = {}) {
    card.dataset.state = state;
    if (!focus || state === 'idle') return;
    const panel = $(`[data-panel="${state}"]`, card);
    // Next frame: the panel was display:none a moment ago and cannot take focus yet.
    requestAnimationFrame(() => {
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }

  function setBusy(busy) {
    sending = busy;
    submit.setAttribute('aria-busy', String(busy));
    submit.setAttribute('aria-disabled', String(busy));
    submitLabel.textContent = busy ? 'Sending…' : idleLabel;
  }

  // ---------------------------------------------------------------- submit
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;

    const invalid = controls().filter((control) => {
      touched.add(control);
      return !validate(control);
    });
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const data = new FormData(form);
    // Honeypot filled: a bot. Pretend all is well and send nothing.
    if (data.get('_honey')) return finish(true);

    setBusy(true);
    setState('idle');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
        signal: controller.signal,
      });
      // formsubmit answers { success: "true" | "false", message } as JSON.
      const result = await response.json().catch(() => ({}));
      const ok = response.ok && String(result.success ?? 'true') !== 'false';
      finish(ok);
    } catch {
      finish(false);
    } finally {
      clearTimeout(timer);
    }
  });

  function finish(ok) {
    setBusy(false);
    if (ok) {
      form.reset();
      controls().forEach((control) => {
        touched.delete(control);
        show(control, '');
        control.closest('[data-field]').classList.remove('is-valid');
      });
      updateCounter();
      setState('success', { focus: true });
      toast('Message sent. Thank you!', { type: 'success' });
    } else {
      setState('error', { focus: true });
      toast('Message could not be sent', { type: 'error', duration: 4000 });
    }
  }

  // "Send another message": back to the empty form.
  $('[data-form-reset]', card)?.addEventListener('click', () => {
    setState('idle');
    form.elements.name.focus();
  });

  // ---------------------------------------------------------------- no-JS return path
  const params = new URLSearchParams(location.search);
  if (params.get('sent') === '1') {
    params.delete('sent');
    const query = params.toString();
    // Drop the flag (and the #form-sent hash that powers the CSS-only fallback) so a reload shows a fresh form.
    history.replaceState(history.state, '', location.pathname + (query ? `?${query}` : ''));
    setState('success', { focus: true });
  }
}
