/**
 * hero.js: the three hero effects.
 *
 *   1. Typewriter     [data-typed='["Role", ...]']   human-paced typing/deleting, zero layout shift
 *   2. Text decode    [data-scramble-load] (once on load) and [data-scramble] (hover / focus)
 *   3. Canvas network canvas[data-network]           drifting nodes, distance links, pointer + pulses
 *
 * Everything is progressive enhancement: the HTML already contains the final text, so with JS off
 * (or under prefers-reduced-motion) the page is simply the static first state. Styles live in
 * assets/css/modules/hero.css. Contract: src/COMPONENTS.md section 2.7. Only init() is public.
 */
import { $$, prefersReducedMotion, clamp, debounce } from './core.js';

const rand = (min, max) => min + Math.random() * (max - min);
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Tiny helper: run `cb` whenever reduced-motion preference flips (older Safari: addListener). */
function onMotionPreferenceChange(cb) {
  if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', cb);
  else reducedQuery.addListener?.(cb);
}

/** Collected teardown callbacks, run on pagehide (bfcache friendly: pageshow re-inits). */
let cleanups = [];

// ===========================================================================
// 1. TYPEWRITER
// ===========================================================================
/**
 * Markup built (the element keeps its pre-rendered first role until this runs):
 *   <span data-typed>
 *     <span class="typed__live" aria-hidden="true"><span class="typed__text">Software Engineer</span><i class="typed__caret"></i></span>
 *     <span class="typed__ghost" aria-hidden="true">Software Engineer</span> ...one per role
 *     <span class="sr-only">Software Engineer, Developer, and Person</span>
 *   </span>
 * The element is an inline grid; the live text and every (invisible) ghost share ONE grid cell, so the
 * cell is always as wide as the longest role and as tall as one line. Nothing can shift, at any font
 * size or after the web font swaps in, because the browser does the measuring.
 */
function initTyped(el) {
  let roles;
  try {
    roles = JSON.parse(el.dataset.typed ?? '[]');
  } catch {
    return;
  }
  roles = Array.isArray(roles) ? roles.filter((r) => typeof r === 'string' && r.trim()) : [];
  if (roles.length < 2) return;

  const speed = Number(el.dataset.typedSpeed) || 70; // ms per character (average)
  const pause = Number(el.dataset.typedPause) || 1600; // ms a finished word stays on screen

  const make = (tag, className, text = '') => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  // Build lazily: under reduced motion we never touch the static markup.
  let textNode = null;
  let caret = null;
  function build() {
    if (textNode) return;
    const live = make('span', 'typed__live');
    live.setAttribute('aria-hidden', 'true');
    const text = make('span', 'typed__text', roles[0]);
    caret = make('span', 'typed__caret');
    caret.setAttribute('aria-hidden', 'true');
    live.append(text, caret);
    textNode = text.firstChild;

    const ghosts = roles.map((role) => {
      const ghost = make('span', 'typed__ghost', role);
      ghost.setAttribute('aria-hidden', 'true');
      return ghost;
    });
    // Screen readers get the full, static list once (the animated text is aria-hidden, no live region).
    const list = typeof Intl.ListFormat === 'function' ? new Intl.ListFormat('en', { type: 'conjunction' }).format(roles) : roles.join(', ');
    el.replaceChildren(live, ...ghosts, make('span', 'sr-only', list));
    el.dataset.typedReady = 'true';
  }

  // ---- state machine -------------------------------------------------------
  let index = 0; // current role
  let length = roles[0].length; // visible characters
  let phase = 'hold'; // hold -> delete -> gap -> type -> hold
  let timer = 0;
  let inView = true;
  let enabled = false;

  const render = () => {
    textNode.data = roles[index].slice(0, length);
  };
  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(tick, ms);
  };

  /** Delay before the NEXT character is typed, in ms. Human-ish: jitter, repeats, word and punctuation beats. */
  function typeDelay(role, typed) {
    const ch = role[typed - 1];
    const next = role[typed];
    let ms = speed * rand(0.55, 1.35);
    if (next && next === ch) ms *= 0.65; // double letters come out faster
    if (ch === ' ') ms *= 1.5; // tiny beat between words
    if (/[.,;:!?\-–—]/.test(ch)) ms += rand(120, 220); // punctuation
    if (Math.random() < 0.05) ms += rand(160, 320); // the occasional hesitation
    return ms;
  }

  function tick() {
    if (!enabled) return;
    switch (phase) {
      case 'hold': // the word has been on screen long enough
        phase = 'delete';
        el.classList.add('is-typing'); // caret stops blinking while it works
        schedule(rand(40, 90));
        break;
      case 'delete': // backspace is quicker than typing and speeds up a little
        length -= 1;
        render();
        if (length <= 0) {
          phase = 'gap';
          schedule(rand(260, 460));
        } else {
          schedule(speed * rand(0.28, 0.55));
        }
        break;
      case 'gap':
        index = (index + 1) % roles.length;
        phase = 'type';
        schedule(rand(80, 160));
        break;
      case 'type':
        length += 1;
        render();
        if (length >= roles[index].length) {
          phase = 'hold';
          el.classList.remove('is-typing');
          schedule(pause * rand(0.9, 1.25));
        } else {
          schedule(typeDelay(roles[index], length));
        }
        break;
    }
  }

  /** Run only while enabled (motion allowed) and the element is on screen in a visible tab. */
  let first = true;
  function sync() {
    const run = enabled && inView && !document.hidden;
    if (!run) {
      clearTimeout(timer);
      timer = 0;
      return;
    }
    if (timer) return;
    // First start: the pre-rendered role sits for one beat. Later resumes continue almost immediately.
    schedule(first ? pause : 250);
    first = false;
  }

  function enable() {
    build();
    el.classList.remove('is-static');
    enabled = true;
    sync();
  }
  function disable() {
    enabled = false;
    clearTimeout(timer);
    timer = 0;
    if (!textNode) return; // never built: markup is still the static first role
    // Back to the static first role (what no-JS / reduced motion shows).
    index = 0;
    length = roles[0].length;
    phase = 'hold';
    el.classList.remove('is-typing');
    el.classList.add('is-static');
    render();
  }

  const io = new IntersectionObserver(
    (entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      sync();
    },
    { threshold: 0 },
  );
  io.observe(el);

  const onVisibility = () => sync();
  const onPreference = () => (reducedQuery.matches ? disable() : enable());
  document.addEventListener('visibilitychange', onVisibility);
  onMotionPreferenceChange(onPreference);

  if (!prefersReducedMotion()) enable();

  cleanups.push(() => {
    clearTimeout(timer);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    reducedQuery.removeEventListener?.('change', onPreference);
  });
}

// ===========================================================================
// 2. TEXT DECODE / SCRAMBLE
// ===========================================================================
/**
 * Every letter becomes <span class="scr"> real letter + <span class="scr__g"> overlay glyph </span></span>.
 * The real letter always stays in the flow (so width, kerning and line breaks never change); while a
 * letter is unresolved it is `visibility:hidden` and the absolutely positioned, centred overlay glyph
 * shows random characters instead. Words are wrapped in nowrap spans so line breaks match the original.
 */
const POOLS = {
  upper: 'ABCDEGHKNOPRSUVXYZ',
  lower: 'aceghnopqsuvxyz',
  narrow: 'il|!1tfjr:;',
  wide: 'mwMWOQ%@',
  other: '#%&*+<>/=_~',
};
const kindOf = (ch) => {
  if ('iljtfr'.includes(ch) || /[.,:;'|!]/.test(ch)) return 'narrow';
  if ('mwMW'.includes(ch)) return 'wide';
  if (/[A-Z0-9]/.test(ch)) return 'upper';
  if (/[a-z]/.test(ch)) return 'lower';
  return 'other';
};
const glyphFor = (ch) => {
  const pool = POOLS[kindOf(ch)];
  return pool[(Math.random() * pool.length) | 0];
};

/** Split an element's text into word / letter spans. Returns the letter records (empty if not applicable). */
function prepareScramble(el, { hideFromAT }) {
  if (el._scr) return el._scr;
  // Only plain-text elements (a link with an svg inside is left alone unless it names a [data-scramble-text] child).
  const host = el.querySelector('[data-scramble-text]') ?? el;
  if (host.children.length > 0) return null;
  const text = host.textContent;
  if (!text.trim()) return null;

  const wrap = document.createElement('span');
  wrap.className = 'scr-wrap';
  if (hideFromAT) wrap.setAttribute('aria-hidden', 'true');
  const letters = [];
  let word = null;
  const flush = () => {
    if (word) wrap.append(word);
    word = null;
  };
  for (const ch of text) {
    if (/\s/.test(ch)) {
      flush();
      wrap.append(' ');
      continue;
    }
    word ??= Object.assign(document.createElement('span'), { className: 'scr-word' });
    const span = document.createElement('span');
    span.className = 'scr';
    span.append(ch);
    const glyph = document.createElement('span');
    glyph.className = 'scr__g';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = ch;
    span.append(glyph);
    word.append(span);
    letters.push({ span, glyph, ch, done: true, at: 0, tick: 0 });
  }
  flush();
  host.replaceChildren(wrap);
  el._scr = { letters };
  return el._scr;
}

/**
 * Decode `letters` over ~`duration` ms: a left-to-right wave with random per-letter offsets, glyphs
 * change every ~45ms. Resolves when every letter is back to its real character.
 */
function runScramble(state, duration = 900) {
  if (state.running) return;
  state.running = true;
  const { letters } = state;
  const spread = duration * 0.62; // how far apart the first and last letters resolve
  const start = performance.now();
  letters.forEach((l, i) => {
    l.done = false;
    l.at = (i / Math.max(1, letters.length - 1)) * spread + rand(0, duration * 0.3);
    l.tick = 0;
    l.span.classList.add('is-u');
  });

  const frame = (now) => {
    const elapsed = now - start;
    let pending = 0;
    for (const l of letters) {
      if (l.done) continue;
      if (elapsed >= l.at) {
        l.done = true;
        l.span.classList.remove('is-u');
        continue;
      }
      pending += 1;
      if (now - l.tick > 45) {
        l.tick = now;
        l.glyph.firstChild.data = glyphFor(l.ch);
      }
    }
    if (pending) requestAnimationFrame(frame);
    else state.running = false;
  };
  requestAnimationFrame(frame);
}

function initScramble({ onLoad = true } = {}) {
  // Hero name: once on load (not again when the page is restored from the bfcache).
  for (const el of onLoad ? $$('[data-scramble-load]') : []) {
    if (prefersReducedMotion()) break;
    const real = el.textContent.trim();
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', real); // stable name for screen readers
    const state = prepareScramble(el, { hideFromAT: true });
    if (!state) continue;
    // Wait for the web font so the (invisible) layout is final before the first letters flip.
    const go = () => runScramble(state, 950);
    const fonts = document.fonts?.ready;
    if (fonts) Promise.race([fonts, new Promise((r) => setTimeout(r, 400))]).then(go);
    else go();
  }

  // Hover / focus: links, buttons or any [data-scramble] element. Delegated, prepared lazily.
  const trigger = (event) => {
    if (prefersReducedMotion()) return;
    const target = event.target instanceof Element ? event.target.closest('[data-scramble]') : null;
    if (!target) return;
    if (event.type === 'pointerover' && target.contains(event.relatedTarget)) return;
    if (event.type === 'focusin' && !target.matches(':focus-visible')) return;
    const state = prepareScramble(target, { hideFromAT: false });
    if (state) runScramble(state, 420);
  };
  document.addEventListener('pointerover', trigger, { passive: true });
  document.addEventListener('focusin', trigger);
  cleanups.push(() => {
    document.removeEventListener('pointerover', trigger);
    document.removeEventListener('focusin', trigger);
  });
}

// ===========================================================================
// 3. CANVAS NETWORK
// ===========================================================================
const LINK_BUCKETS = 6; // line alpha is quantised so each bucket is ONE stroke() call
const HOT_BUCKETS = 4; // same for the brighter links near the pointer
const POINTER_RADIUS = 170;

/** Normalise any CSS colour into [r,g,b,a] via a throw-away canvas (it serialises every colour as #rrggbb or rgba()). */
const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function parseColor(value, fallback) {
  if (!probe || !value || !value.trim()) return fallback;
  probe.fillStyle = '#000';
  probe.fillStyle = value.trim();
  const out = String(probe.fillStyle);
  if (out[0] === '#') {
    const n = parseInt(out.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(out);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(',').map(Number);
    return [r, g, b, a];
  }
  // Exotic syntaxes (color(), oklch()): let the canvas rasterise it and read the pixel back.
  probe.clearRect(0, 0, 1, 1);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a.toFixed(3)})`;

function createNetwork(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return null;
  const hero = canvas.closest('[data-hero]') ?? canvas.parentElement;
  const rootStyle = document.documentElement;

  // ---- tunables -------------------------------------------------------------
  const density = Number(canvas.dataset.networkDensity) || 1;
  const cores = navigator.hardwareConcurrency || 8;
  const lowPower = cores <= 4;
  const frameInterval = lowPower ? 30 : 14; // ms: caps 120Hz screens at 60fps and weak CPUs at ~30fps
  const SPEED = [7, 19]; // px/s base drift

  // ---- state (typed arrays: nothing is allocated inside the frame loop) --------
  let width = 0;
  let height = 0;
  let dpr = 1;
  let count = 0;
  let linkDist = 140;
  const MAX = 90;
  const x = new Float32Array(MAX);
  const y = new Float32Array(MAX);
  const vx = new Float32Array(MAX); // base drift
  const vy = new Float32Array(MAX);
  const ox = new Float32Array(MAX); // pointer-induced velocity offset (decays)
  const oy = new Float32Array(MAX);
  const radius = new Float32Array(MAX);
  const kind = new Uint8Array(MAX); // 0 = accent-tinted node, 1 = violet
  const glow = new Float32Array(MAX); // 0..1 flash (pulse arrival / pointer proximity)

  // Segment scratch buffers for the batched link drawing.
  const segs = new Float32Array((MAX * (MAX - 1) * 4) / 2);
  const segBucket = new Int8Array((MAX * (MAX - 1)) / 2);
  let segCount = 0;

  // Pulses travelling along links.
  const P = 8;
  const pFrom = new Int16Array(P);
  const pTo = new Int16Array(P);
  const pT = new Float32Array(P);
  const pHops = new Int8Array(P);
  const pWait = new Float32Array(P).fill(1); // seconds until (re)spawn; <=0 and pActive=0 -> spawn
  const pActive = new Uint8Array(P);
  let pulseSlots = 0;
  const near = new Int16Array(MAX);

  const pointer = { x: -9999, y: -9999, cx: 0, cy: 0, active: false, strength: 0, sx: -9999, sy: -9999 };

  // ---- colours ----------------------------------------------------------------
  let colors = null;
  function readColors() {
    const css = getComputedStyle(rootStyle);
    const get = (name, fb) => parseColor(css.getPropertyValue(name), fb);
    const node = get('--network-node', [160, 240, 230, 0.75]);
    const line = get('--network-line', [45, 226, 198, 0.2]);
    const accent = get('--network-accent', [45, 226, 198, 1]);
    const violet = get('--accent-violet', [139, 124, 255, 1]);
    const bg = get('--bg', [5, 8, 10, 1]);
    const light = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] > 140; // light theme: calmer glows
    // Quantised line styles: alpha rises with closeness. Slight boost since the token is tuned for a static dot grid.
    const boost = light ? 1.5 : 1.55;
    const lines = Array.from({ length: LINK_BUCKETS }, (_, k) => rgba(line, Math.min(0.65, line[3] * boost * ((k + 0.6) / LINK_BUCKETS) ** 1.25)));
    const hot = Array.from({ length: HOT_BUCKETS }, (_, k) => rgba(accent, (light ? 0.22 : 0.26) + k * (light ? 0.16 : 0.18)));
    colors = {
      light,
      lines,
      hot,
      node: rgba(node, Math.min(1, node[3])),
      violet: rgba(violet, light ? 0.6 : 0.75),
      accent: rgba(accent, 1),
      glowAlpha: light ? 0.1 : 0.2,
    };
  }

  // ---- layout / population -----------------------------------------------------
  function targetCount() {
    let n = ((width * height) / 16000) * density;
    const small = width < 640;
    if (small) n *= 0.6;
    if (lowPower) n *= 0.75;
    return clamp(Math.round(n), small ? 16 : 24, MAX);
  }

  function spawnNode(i) {
    x[i] = rand(0, width);
    y[i] = rand(0, height);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(SPEED[0], SPEED[1]);
    vx[i] = Math.cos(angle) * speed;
    vy[i] = Math.sin(angle) * speed;
    ox[i] = oy[i] = glow[i] = 0;
    radius[i] = rand(1.1, 2.3);
    kind[i] = Math.random() < 0.14 ? 1 : 0;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === width && h === height && nextDpr === dpr && count) return;

    const sx = width ? w / width : 1;
    const sy = height ? h / height : 1;
    width = w;
    height = h;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    const target = targetCount();
    // Existing nodes keep their relative place; add / drop the difference.
    for (let i = 0; i < count && i < target; i++) {
      x[i] *= sx;
      y[i] *= sy;
    }
    for (let i = count; i < target; i++) spawnNode(i);
    count = target;
    linkDist = clamp(Math.sqrt((width * height) / count) * 1.25, 90, 170);
    pulseSlots = clamp(Math.round(count / 12), 3, P);
    for (let p = 0; p < P; p++) if (p >= pulseSlots) pActive[p] = 0;
    if (!running) draw();
  }

  // ---- simulation ----------------------------------------------------------------
  function update(dt) {
    // Pointer: ease strength in/out so nothing pops when the cursor enters or leaves.
    const target = pointer.active ? 1 : 0;
    pointer.strength += (target - pointer.strength) * Math.min(1, dt * 6);
    if (pointer.strength < 0.002) pointer.strength = 0;
    const px = pointer.x;
    const py = pointer.y;
    const damp = Math.exp(-dt * 2.4);
    const pr2 = POINTER_RADIUS * POINTER_RADIUS;
    const margin = 24;

    for (let i = 0; i < count; i++) {
      if (pointer.strength > 0) {
        const dx = px - x[i];
        const dy = py - y[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < pr2 && d2 > 1) {
          const d = Math.sqrt(d2);
          const t = 1 - d / POINTER_RADIUS; // 1 at the cursor, 0 at the edge of its influence
          // Close in: push away. Further out: a soft pull. Net effect: nodes orbit the cursor loosely.
          const f = (d < 70 ? -(1 - d / 70) * 55 : t * 22) * pointer.strength;
          ox[i] += (dx / d) * f * dt * 6;
          oy[i] += (dy / d) * f * dt * 6;
          if (glow[i] < t * 0.85) glow[i] = t * 0.85;
        }
      }
      ox[i] *= damp;
      oy[i] *= damp;
      x[i] += (vx[i] + ox[i]) * dt;
      y[i] += (vy[i] + oy[i]) * dt;
      // Soft bounce just outside the frame: reverse the drift, nudge the offset so it never sticks.
      if (x[i] < -margin) {
        x[i] = -margin;
        vx[i] = Math.abs(vx[i]);
      } else if (x[i] > width + margin) {
        x[i] = width + margin;
        vx[i] = -Math.abs(vx[i]);
      }
      if (y[i] < -margin) {
        y[i] = -margin;
        vy[i] = Math.abs(vy[i]);
      } else if (y[i] > height + margin) {
        y[i] = height + margin;
        vy[i] = -Math.abs(vy[i]);
      }
      glow[i] *= Math.exp(-dt * 2.2);
    }

    updatePulses(dt);
  }

  /** Fill `near` with the indices linked to node a (excluding `skip`); returns how many. */
  function neighbours(a, skip) {
    let n = 0;
    const l2 = linkDist * linkDist;
    for (let j = 0; j < count; j++) {
      if (j === a || j === skip) continue;
      const dx = x[j] - x[a];
      const dy = y[j] - y[a];
      if (dx * dx + dy * dy < l2) near[n++] = j;
    }
    return n;
  }

  function updatePulses(dt) {
    for (let p = 0; p < pulseSlots; p++) {
      if (!pActive[p]) {
        pWait[p] -= dt;
        if (pWait[p] > 0) continue;
        const a = (Math.random() * count) | 0;
        // Only spawn on-screen so the visitor sees them.
        const n = x[a] > 0 && x[a] < width && y[a] > 0 && y[a] < height ? neighbours(a, -1) : 0;
        if (!n) {
          pWait[p] = 0.25;
          continue;
        }
        pFrom[p] = a;
        pTo[p] = near[(Math.random() * n) | 0];
        pT[p] = 0;
        pHops[p] = 1 + ((Math.random() * 3) | 0);
        pActive[p] = 1;
        continue;
      }
      const a = pFrom[p];
      const b = pTo[p];
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > linkDist * 1.15) {
        // The link stretched too far while nodes drifted: drop the pulse.
        pActive[p] = 0;
        pWait[p] = rand(0.3, 1.2);
        continue;
      }
      pT[p] += (dt * 150) / Math.max(d, 24);
      if (pT[p] >= 1) {
        glow[b] = 1;
        if (--pHops[p] > 0 && Math.random() < 0.8) {
          const n = neighbours(b, a);
          if (n) {
            pFrom[p] = b;
            pTo[p] = near[(Math.random() * n) | 0];
            pT[p] = 0;
            continue;
          }
        }
        pActive[p] = 0;
        pWait[p] = rand(0.8, 3.2);
      }
    }
  }

  // ---- drawing ----------------------------------------------------------------------
  function draw() {
    if (!colors) readColors();
    ctx.clearRect(0, 0, width, height);

    // 1) collect link segments with their bucket (normal alpha bucket or hot bucket near the pointer)
    segCount = 0;
    const l2 = linkDist * linkDist;
    const hot = pointer.strength > 0.02;
    const pr = POINTER_RADIUS * 0.9;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const d2 = dx * dx + dy * dy;
        if (d2 >= l2) continue;
        const s = 1 - Math.sqrt(d2) / linkDist; // 0..1 closeness
        let bucket = Math.min(LINK_BUCKETS - 1, (s * LINK_BUCKETS) | 0);
        if (hot) {
          const mx = (x[i] + x[j]) / 2 - pointer.x;
          const my = (y[i] + y[j]) / 2 - pointer.y;
          const md2 = mx * mx + my * my;
          if (md2 < pr * pr) {
            const q = (1 - Math.sqrt(md2) / pr) * (0.45 + 0.55 * s) * pointer.strength;
            const hb = Math.min(HOT_BUCKETS - 1, (q * HOT_BUCKETS * 1.4) | 0);
            if (q > 0.04) bucket = LINK_BUCKETS + hb;
          }
        }
        const o = segCount * 4;
        segs[o] = x[i];
        segs[o + 1] = y[i];
        segs[o + 2] = x[j];
        segs[o + 3] = y[j];
        segBucket[segCount++] = bucket;
      }
    }

    // 2) one beginPath/stroke per bucket
    for (let b = 0; b < LINK_BUCKETS + HOT_BUCKETS; b++) {
      ctx.beginPath();
      let any = false;
      for (let s = 0; s < segCount; s++) {
        if (segBucket[s] !== b) continue;
        const o = s * 4;
        ctx.moveTo(segs[o], segs[o + 1]);
        ctx.lineTo(segs[o + 2], segs[o + 3]);
        any = true;
      }
      if (!any) continue;
      ctx.strokeStyle = b < LINK_BUCKETS ? colors.lines[b] : colors.hot[b - LINK_BUCKETS];
      ctx.lineWidth = b < LINK_BUCKETS ? 1 : 1.2;
      ctx.stroke();
    }

    // 3) pointer links: from the cursor to the closest nodes
    if (hot) {
      ctx.beginPath();
      const r = POINTER_RADIUS * 0.75;
      let any = false;
      for (let i = 0; i < count; i++) {
        const dx = x[i] - pointer.x;
        const dy = y[i] - pointer.y;
        if (dx * dx + dy * dy < r * r) {
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(x[i], y[i]);
          any = true;
        }
      }
      if (any) {
        ctx.strokeStyle = colors.hot[1];
        ctx.globalAlpha = 0.55 * pointer.strength;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 4) nodes: two batched fills (accent-tinted + violet)
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        if (kind[i] !== k) continue;
        ctx.moveTo(x[i] + radius[i], y[i]);
        ctx.arc(x[i], y[i], radius[i], 0, Math.PI * 2);
      }
      ctx.fillStyle = k === 0 ? colors.node : colors.violet;
      ctx.fill();
    }

    // 5) flashing nodes (pulse arrival / near the pointer): individual, but only a handful
    ctx.fillStyle = colors.accent;
    for (let i = 0; i < count; i++) {
      const g = glow[i];
      if (g < 0.04) continue;
      ctx.globalAlpha = g * colors.glowAlpha * 2.2;
      ctx.beginPath();
      ctx.arc(x[i], y[i], radius[i] + 3 + g * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, g * 1.1);
      ctx.beginPath();
      ctx.arc(x[i], y[i], radius[i] + g * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6) pulses: a short comet trail + halo + head
    ctx.strokeStyle = colors.accent;
    for (let p = 0; p < pulseSlots; p++) {
      if (!pActive[p]) continue;
      const a = pFrom[p];
      const b = pTo[p];
      const t = pT[p];
      const t0 = Math.max(0, t - 0.22);
      const hx = x[a] + (x[b] - x[a]) * t;
      const hy = y[a] + (y[b] - y[a]) * t;
      const tx = x[a] + (x[b] - x[a]) * t0;
      const ty = y[a] + (y[b] - y[a]) * t0;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = colors.glowAlpha;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(hx, hy, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- run loop --------------------------------------------------------------------------
  let running = false;
  let raf = 0;
  let last = 0;
  let inView = true;
  let reduced = prefersReducedMotion();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const elapsed = now - last;
    if (elapsed < frameInterval) return; // frame cap
    last = now;
    const dt = Math.min(elapsed / 1000, 0.05); // clamp so a stalled tab doesn't teleport nodes
    // Pointer position in canvas space: one rect read per frame, only while the cursor is around.
    if (pointer.active) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = pointer.cx - rect.left;
      pointer.y = pointer.cy - rect.top;
    }
    update(dt);
    draw();
  }

  function sync() {
    const shouldRun = !reduced && inView && !document.hidden && count > 0;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
    }
  }

  // ---- events ------------------------------------------------------------------------------
  const onMove = (e) => {
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
    pointer.active = true;
  };
  const onLeave = () => {
    pointer.active = false;
  };
  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerleave', onLeave, { passive: true });
  hero.addEventListener('pointercancel', onLeave, { passive: true });
  const onUp = (e) => e.pointerType === 'touch' && onLeave();
  hero.addEventListener('pointerup', onUp, { passive: true });

  const io = new IntersectionObserver((entries) => {
    inView = entries[entries.length - 1].isIntersecting;
    if (!inView) pointer.active = false;
    sync();
  });
  io.observe(hero);

  const ro = new ResizeObserver(debounce(() => resize(), 120));
  ro.observe(canvas);

  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);

  // Theme switch: re-read the CSS variables next frame (after the attribute change has been applied).
  const onTheme = () =>
    requestAnimationFrame(() => {
      readColors();
      if (!running) draw();
    });
  document.addEventListener('themechange', onTheme);

  const onMotion = () => {
    reduced = reducedQuery.matches;
    sync();
    if (reduced) {
      pointer.active = false;
      pointer.strength = 0;
      pActive.fill(0);
      draw(); // a single calm frame
    }
  };
  onMotionPreferenceChange(onMotion);

  readColors();
  resize(); // sizes the canvas, spawns nodes, paints the first (static) frame
  // Pre-warm so the first animated frame already has settled glow-free links; reduced motion stays untouched.
  sync();

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      hero.removeEventListener('pointercancel', onLeave);
      hero.removeEventListener('pointerup', onUp);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('themechange', onTheme);
      reducedQuery.removeEventListener?.('change', onMotion);
    },
    /** Debug / test hook. */
    stats: () => ({ count, linkDist, running, width, height, dpr, pulseSlots }),
  };
}

// ===========================================================================
// init
// ===========================================================================
function setup({ restored = false } = {}) {
  cleanups = [];
  for (const el of $$('[data-typed]')) initTyped(el);
  initScramble({ onLoad: !restored });
  for (const canvas of $$('canvas[data-network]')) {
    canvas.setAttribute('aria-hidden', 'true');
    const net = createNetwork(canvas);
    if (net) {
      cleanups.push(() => net.destroy());
      canvas._network = net; // handy in devtools: $0._network.stats()
    }
  }
}

export function init() {
  setup();
  // Tear everything down when the page is stored in the bfcache / unloaded; rebuild if it comes back.
  window.addEventListener('pagehide', () => {
    cleanups.forEach((fn) => fn());
    cleanups = [];
  });
  window.addEventListener('pageshow', (event) => {
    // Only a bfcache restore needs a fresh start (the first pageshow is the normal load).
    if (event.persisted && !cleanups.length) {
      setup({ restored: true });
    }
  });
}
