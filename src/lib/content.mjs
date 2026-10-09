/**
 * Loads, validates and derives everything the page renderers need from /content.
 *
 *   const ctx = loadContent();      // throws ContentError (all problems listed) if anything is off
 *
 * ctx = {
 *   root, year, warnings,
 *   site,                // content/site.json with `stats` resolved to numbers
 *   nav,                 // [{id, label, path, icon}]  (path is repo-root-relative; pass through ctx.url())
 *   experience, education, certificates,
 *   skills,              // [{category, items:[{name,url?}]}]
 *   softSkills,          // = site.softSkills
 *   testimonials,        // [{quote,name,role,company?,url?,image?}]
 *   engagements,         // content/engagements.json, newest first: [{id,title,client,country?,period,start,end,summary,technologies?}]
 *   languages,           // content/languages.json: [{language,level,details?}]
 *   cv,                  // {href,label,format,sizeKB (computed from the real file),updated}
 *   projects,            // sorted by `order`
 *   featuredProjects,    // projects with featured:true (sorted by `order`)
 *   categories,          // [{id,label,count}] real categories only, fixed order
 *   categoriesWithAll,   // same, with {id:'all', label:'All', count} first
 *   projectBySlug,       // plain object: slug -> project
 *   getProject(slug),    // throws on unknown slug
 *   prevNext(slug),      // {prev, next}  (circular, by `order`)
 *   paletteData,         // {pages, projects, actions}; urls are repo-root-relative (layout rebases them)
 * }
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { hasIcon } from './icons.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT_DIR = join(ROOT, 'content');

/** Fixed category vocabulary + display order (same grouping as the old index filters). */
export const CATEGORY_LABELS = { ai: 'AI', telecom: 'Telecom', web: 'Web', iot: 'IoT', simulation: 'Simulation' };
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

/** Primary navigation. `path` is repo-root-relative. */
export const NAV = [
  { id: 'home', label: 'Home', path: 'index.html', icon: 'rocket' },
  { id: 'about', label: 'About', path: 'about.html', icon: 'user-check' },
  { id: 'experience', label: 'Experience', path: 'experience.html', icon: 'briefcase' },
  { id: 'projects', label: 'Projects', path: 'projects.html', icon: 'folder' },
  { id: 'contact', label: 'Contact', path: 'contact.html', icon: 'mail' },
];

// Any subset is fine (the site currently lists only github + linkedin); the id selects the icon.
const SOCIAL_IDS = ['github', 'linkedin', 'fiverr', 'upwork'];
const SUMMARY_MAX = 170;

export class ContentError extends Error {
  constructor(problems) {
    super(`Content validation failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ContentError';
    this.problems = problems;
  }
}

// ---------------------------------------------------------------------------
// Tiny validation toolkit. Every message names the file and the JSON path.
// ---------------------------------------------------------------------------
function checker(file, problems, warnings) {
  const fail = (path, msg) => problems.push(`${file} → ${path}: ${msg}`);
  const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const c = {
    fail,
    warn: (path, msg) => warnings.push(`${file} → ${path}: ${msg}`),
    obj(v, path) {
      if (kind(v) !== 'object') return fail(path, `expected an object, got ${kind(v)}`), false;
      return true;
    },
    arr(v, path, { min = 0 } = {}) {
      if (!Array.isArray(v)) return fail(path, `expected an array, got ${kind(v)}`), false;
      if (v.length < min) return fail(path, `expected at least ${min} item(s)`), false;
      return true;
    },
    str(v, path, { optional = false, pattern, max } = {}) {
      if (v === undefined && optional) return true;
      if (typeof v !== 'string' || v.trim() === '') return fail(path, `required non-empty string (got ${v === undefined ? 'nothing' : kind(v)})`), false;
      if (pattern && !pattern.test(v)) return fail(path, `"${v}" does not match ${pattern}`), false;
      if (max && v.length > max) c.warn(path, `${v.length} chars, recommended max ${max}`);
      return true;
    },
    strArr(v, path, opts = {}) {
      if (v === undefined && opts.optional) return true;
      if (!c.arr(v, path, opts)) return false;
      return v.map((s, i) => c.str(s, `${path}[${i}]`)).every(Boolean);
    },
    num(v, path) {
      if (typeof v !== 'number' || !Number.isFinite(v)) return fail(path, `expected a number, got ${kind(v)}`), false;
      return true;
    },
    bool(v, path) {
      if (typeof v !== 'boolean') return fail(path, `expected true/false, got ${kind(v)}`), false;
      return true;
    },
    icon(v, path) {
      if (!c.str(v, path)) return false;
      if (!hasIcon(v)) return fail(path, `unknown icon "${v}" (see ICON_NAMES in src/lib/icons.mjs)`), false;
      return true;
    },
    url(v, path, { optional = false } = {}) {
      if (v === undefined && optional) return true;
      if (!c.str(v, path)) return false;
      try {
        new URL(v);
        return true;
      } catch {
        return fail(path, `"${v}" is not an absolute URL`), false;
      }
    },
    image(v, path) {
      if (!c.obj(v, path)) return false;
      const a = c.str(v.src, `${path}.src`);
      const b = c.str(v.alt, `${path}.alt`);
      if (a && !existsSync(join(ROOT, v.src))) fail(`${path}.src`, `file "${v.src}" does not exist in the repo`);
      return a && b;
    },
  };
  return c;
}

function readJson(file, problems) {
  try {
    return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  } catch (err) {
    problems.push(`${file}: ${err.code === 'ENOENT' ? 'file is missing' : `invalid JSON (${err.message})`}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Per-file validators
// ---------------------------------------------------------------------------
function validateSite(s, c) {
  if (!c.obj(s, '$')) return;
  ['name', 'shortName', 'initials', 'email', 'location', 'title', 'tagline', 'heroPrefix', 'intro', 'formEndpoint', 'formAjaxEndpoint'].forEach((k) => c.str(s[k], k));
  c.str(s.nationality, 'nationality', { optional: true });
  c.url(s.url, 'url');
  c.url(s.formEndpoint, 'formEndpoint');
  c.url(s.formAjaxEndpoint, 'formAjaxEndpoint');
  c.strArr(s.roles, 'roles', { min: 1 });
  if (c.obj(s.cv, 'cv')) {
    ['href', 'label', 'format', 'updated'].forEach((k) => c.str(s.cv[k], `cv.${k}`));
    if (typeof s.cv.href === 'string' && !existsSync(join(ROOT, s.cv.href))) c.fail('cv.href', `file "${s.cv.href}" does not exist in the repo`);
  }
  if (c.arr(s.socials, 'socials', { min: 1 })) {
    s.socials.forEach((x, i) => {
      if (!c.obj(x, `socials[${i}]`)) return;
      if (c.str(x.id, `socials[${i}].id`) && !SOCIAL_IDS.includes(x.id)) c.fail(`socials[${i}].id`, `must be one of ${SOCIAL_IDS.join('|')}`);
      c.str(x.label, `socials[${i}].label`);
      c.url(x.url, `socials[${i}].url`);
    });
  }
  if (c.arr(s.facts, 'facts')) {
    s.facts.forEach((x, i) => {
      if (!c.obj(x, `facts[${i}]`)) return;
      c.str(x.label, `facts[${i}].label`);
      c.str(x.value, `facts[${i}].value`);
      c.icon(x.icon, `facts[${i}].icon`);
    });
  }
  if (c.obj(s.about, 'about')) {
    c.strArr(s.about.paragraphs, 'about.paragraphs', { min: 1 });
    if (c.obj(s.about.keyCharacteristic, 'about.keyCharacteristic')) {
      c.str(s.about.keyCharacteristic.label, 'about.keyCharacteristic.label');
      c.str(s.about.keyCharacteristic.text, 'about.keyCharacteristic.text');
    }
  }
  if (c.arr(s.softSkills, 'softSkills')) {
    s.softSkills.forEach((x, i) => {
      if (!c.obj(x, `softSkills[${i}]`)) return;
      c.str(x.name, `softSkills[${i}].name`);
      c.icon(x.icon, `softSkills[${i}].icon`);
    });
  }
  if (c.arr(s.stats, 'stats')) {
    s.stats.forEach((x, i) => {
      if (!c.obj(x, `stats[${i}]`)) return;
      c.str(x.label, `stats[${i}].label`);
      c.icon(x.icon, `stats[${i}].icon`);
      c.str(x.suffix, `stats[${i}].suffix`, { optional: true });
      const ok = typeof x.value === 'number' || ['auto:projects', 'auto:technologies', 'auto:certificates'].includes(x.value);
      if (!ok) c.fail(`stats[${i}].value`, 'must be a number or "auto:projects|auto:technologies|auto:certificates"');
    });
  }
  if (c.obj(s.seo, 'seo')) {
    c.str(s.seo.description, 'seo.description');
    c.strArr(s.seo.keywords, 'seo.keywords');
  }
  if (c.obj(s.analytics, 'analytics')) {
    c.str(s.analytics.gtm, 'analytics.gtm');
    c.str(s.analytics.ga4, 'analytics.ga4');
  }
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

function validateExperience(list, c) {
  if (!c.arr(list, '$', { min: 1 })) return;
  list.forEach((x, i) => {
    const at = `[${i}]`;
    if (!c.obj(x, at)) return;
    ['id', 'role', 'company', 'location', 'period'].forEach((k) => c.str(x[k], `${at}.${k}`));
    c.str(x.start, `${at}.start`, { pattern: YM });
    c.str(x.end, `${at}.end`, { pattern: /^(\d{4}-(0[1-9]|1[0-2])|present)$/ });
    c.strArr(x.bullets, `${at}.bullets`);
    c.strArr(x.technologies, `${at}.technologies`);
    c.str(x.summary, `${at}.summary`, { optional: true });
    if (x.kind !== undefined && !['work', 'volunteering'].includes(x.kind)) c.fail(`${at}.kind`, 'must be "work" or "volunteering"');
  });
}

const PERIOD_END = /^(\d{4}-(0[1-9]|1[0-2])|present)$/;

function validateEngagements(list, c) {
  if (!c.arr(list, '$', { min: 1 })) return;
  let prev = '';
  list.forEach((x, i) => {
    const at = `[${i}]`;
    if (!c.obj(x, at)) return;
    ['id', 'title', 'client', 'period', 'summary'].forEach((k) => c.str(x[k], `${at}.${k}`));
    c.str(x.country, `${at}.country`, { optional: true });
    c.str(x.start, `${at}.start`, { pattern: YM });
    c.str(x.end, `${at}.end`, { pattern: PERIOD_END });
    c.strArr(x.technologies, `${at}.technologies`, { optional: true });
    if (typeof x.start === 'string' && prev && x.start > prev) c.fail(`${at}.start`, `list must be newest first (by start); "${x.start}" comes after "${prev}"`);
    if (typeof x.start === 'string') prev = x.start;
  });
}

function validateLanguages(list, c) {
  if (!c.arr(list, '$', { min: 1 })) return;
  list.forEach((x, i) => {
    if (!c.obj(x, `[${i}]`)) return;
    ['language', 'level'].forEach((k) => c.str(x[k], `[${i}].${k}`));
    c.strArr(x.details, `[${i}].details`, { optional: true });
  });
}

function validateEducation(list, c) {
  if (!c.arr(list, '$', { min: 1 })) return;
  list.forEach((x, i) => {
    const at = `[${i}]`;
    if (!c.obj(x, at)) return;
    ['id', 'degree', 'school', 'location', 'period'].forEach((k) => c.str(x[k], `${at}.${k}`));
    c.strArr(x.bullets, `${at}.bullets`);
    ['grade', 'thesis', 'honors'].forEach((k) => c.str(x[k], `${at}.${k}`, { optional: true }));
  });
}

function validateCertificates(list, c) {
  if (!c.arr(list, '$', { min: 1 })) return;
  list.forEach((x, i) => {
    const at = `[${i}]`;
    if (!c.obj(x, at)) return;
    ['id', 'title', 'issuer', 'description'].forEach((k) => c.str(x[k], `${at}.${k}`));
    c.str(x.date, `${at}.date`, { pattern: /^(0[1-9]|1[0-2])\/\d{4}$/ });
    c.icon(x.icon, `${at}.icon`);
    c.str(x.hours, `${at}.hours`, { optional: true });
  });
}

function validateSkills(list, c) {
  if (!c.arr(list, '$', { min: 1 })) return;
  list.forEach((g, i) => {
    if (!c.obj(g, `[${i}]`)) return;
    c.str(g.category, `[${i}].category`);
    if (!c.arr(g.items, `[${i}].items`, { min: 1 })) return;
    g.items.forEach((it, j) => {
      if (!c.obj(it, `[${i}].items[${j}]`)) return;
      c.str(it.name, `[${i}].items[${j}].name`);
      c.url(it.url, `[${i}].items[${j}].url`, { optional: true });
    });
  });
}

function validateTestimonials(list, c) {
  if (!c.arr(list, '$', { min: 1 })) return;
  list.forEach((x, i) => {
    if (!c.obj(x, `[${i}]`)) return;
    ['quote', 'name', 'role'].forEach((k) => c.str(x[k], `[${i}].${k}`));
    c.str(x.company, `[${i}].company`, { optional: true });
    c.url(x.url, `[${i}].url`, { optional: true });
    if (x.image !== undefined) c.image(x.image, `[${i}].image`); // optional extension
  });
}

function validateProject(p, c, fileSlug) {
  if (!c.obj(p, '$')) return;
  if (c.str(p.slug, 'slug', { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }) && p.slug !== fileSlug) {
    c.fail('slug', `"${p.slug}" must equal the file name "${fileSlug}"`);
  }
  ['title', 'client'].forEach((k) => c.str(p[k], k));
  ['subtitle', 'organization', 'year', 'period', 'role'].forEach((k) => c.str(p[k] === undefined ? p[k] : String(p[k]), k, { optional: true }));
  c.str(p.summary, 'summary', { max: SUMMARY_MAX });
  if (c.strArr(p.categories, 'categories', { min: 1 })) {
    p.categories.forEach((x, i) => {
      if (!CATEGORY_ORDER.includes(x)) c.fail(`categories[${i}]`, `"${x}" is not one of ${CATEGORY_ORDER.join('|')}`);
    });
  }
  c.strArr(p.description, 'description', { min: 1 });
  c.strArr(p.contributions, 'contributions');
  c.strArr(p.technologies, 'technologies');
  if (c.arr(p.links, 'links')) {
    p.links.forEach((l, i) => {
      if (!c.obj(l, `links[${i}]`)) return;
      c.str(l.label, `links[${i}].label`);
      c.url(l.url, `links[${i}].url`);
    });
  }
  c.image(p.cover, 'cover');
  if (c.arr(p.gallery, 'gallery')) {
    p.gallery.forEach((g, i) => {
      if (c.image(g, `gallery[${i}]`)) c.str(g.caption, `gallery[${i}].caption`, { optional: true });
    });
  }
  c.bool(p.featured, 'featured');
  c.num(p.order, 'order');
  c.strArr(p.legacyPaths, 'legacyPaths');
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------
export function loadContent() {
  const problems = [];
  const warnings = [];
  const run = (file, validate, ...extra) => {
    const data = readJson(file, problems);
    if (data !== undefined) validate(data, checker(file, problems, warnings), ...extra);
    return data;
  };

  const site = run('content/site.json', validateSite);
  const experience = run('content/experience.json', validateExperience);
  const education = run('content/education.json', validateEducation);
  const certificates = run('content/certificates.json', validateCertificates);
  const skills = run('content/skills.json', validateSkills);
  const testimonials = run('content/testimonials.json', validateTestimonials);
  const engagements = run('content/engagements.json', validateEngagements);
  const languages = run('content/languages.json', validateLanguages);

  const projectFiles = existsSync(join(CONTENT_DIR, 'projects'))
    ? readdirSync(join(CONTENT_DIR, 'projects')).filter((f) => f.endsWith('.json')).sort()
    : [];
  if (projectFiles.length === 0) problems.push('content/projects/: no project JSON files found');
  const projectsRaw = projectFiles.map((f) => run(`content/projects/${f}`, validateProject, basename(f, '.json')));

  // Cross-file checks that need every file parsed.
  const slugs = new Set();
  projectsRaw.forEach((p, i) => {
    if (p?.slug) {
      if (slugs.has(p.slug)) problems.push(`content/projects/${projectFiles[i]} → slug: duplicate slug "${p.slug}"`);
      slugs.add(p.slug);
    }
  });
  for (const [file, list] of [['experience', experience], ['education', education], ['certificates', certificates], ['engagements', engagements]]) {
    if (!Array.isArray(list)) continue;
    const seen = new Set();
    list.forEach((x, i) => {
      if (x?.id && seen.has(x.id)) problems.push(`content/${file}.json → [${i}].id: duplicate id "${x.id}"`);
      seen.add(x?.id);
    });
  }

  if (problems.length) throw new ContentError(problems);

  // ---- derive ----------------------------------------------------------
  const projects = [...projectsRaw].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const featuredProjects = projects.filter((p) => p.featured);

  const categories = CATEGORY_ORDER.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    count: projects.filter((p) => p.categories.includes(id)).length,
  })).filter((x) => x.count > 0);
  const categoriesWithAll = [{ id: 'all', label: 'All', count: projects.length }, ...categories];

  // auto:technologies = number of distinct skills listed on the Skills section (matches old "Technologies" counter intent).
  const technologyCount = new Set(skills.flatMap((g) => g.items.map((i) => i.name.toLowerCase()))).size;
  const auto = { projects: projects.length, technologies: technologyCount, certificates: certificates.length };
  const stats = site.stats.map((s) => ({
    ...s,
    value: typeof s.value === 'number' ? s.value : auto[s.value.slice('auto:'.length)],
  }));
  const resolvedSite = { ...site, stats };
  const cvFile = join(ROOT, site.cv.href);
  const cv = { ...site.cv, sizeKB: Math.max(1, Math.round(statSync(cvFile).size / 1024)) };

  const projectBySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));
  const getProject = (slug) => {
    if (!projectBySlug[slug]) throw new Error(`getProject(): unknown project slug "${slug}"`);
    return projectBySlug[slug];
  };
  const prevNext = (slug) => {
    const i = projects.findIndex((p) => p.slug === slug);
    if (i < 0) throw new Error(`prevNext(): unknown project slug "${slug}"`);
    return { prev: projects[(i - 1 + projects.length) % projects.length], next: projects[(i + 1) % projects.length] };
  };

  return {
    root: ROOT,
    // Footer year. Pinned by content/site.json "copyrightYear" so --check stays green across New Year;
    // SITE_BUILD_YEAR (env) overrides it, and the current year is only the fallback when neither is set.
    year: Number(process.env.SITE_BUILD_YEAR) || Number(site.copyrightYear) || new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000 || Date.now()).getFullYear(),
    warnings,
    site: resolvedSite,
    nav: NAV,
    experience: experience.map((x) => ({ kind: 'work', ...x })), // kind defaults to 'work'
    education,
    certificates,
    skills,
    softSkills: site.softSkills,
    testimonials,
    engagements,
    languages,
    cv,
    projects,
    featuredProjects,
    categories,
    categoriesWithAll,
    projectBySlug,
    getProject,
    prevNext,
    paletteData: buildPaletteData(resolvedSite, projects, cv),
  };
}

/** Command-palette data. URLs are repo-root-relative or absolute; layout.mjs rebases them per page. */
function buildPaletteData(site, projects, cv) {
  const pages = NAV.map((n) => ({ id: n.id, title: n.label, url: n.path, icon: n.icon, hint: 'Page' }));
  const projectItems = projects.map((p) => ({
    id: p.slug,
    title: p.title,
    url: `projects/${p.slug}.html`,
    icon: 'folder',
    hint: p.categories.map((c) => CATEGORY_LABELS[c]).join(' · '),
    keywords: [p.client, p.organization, ...p.technologies].filter(Boolean).join(' '),
  }));
  const actions = [
    { id: 'toggle-theme', title: 'Toggle theme', icon: 'moon', action: 'toggle-theme', keywords: 'dark light mode appearance' },
    { id: 'copy-email', title: 'Copy email address', icon: 'copy', action: 'copy', value: site.email, hint: site.email, keywords: 'mail contact' },
    { id: 'send-email', title: 'Send an email', icon: 'mail', action: 'open', url: `mailto:${site.email}`, hint: site.email, keywords: 'write contact' },
    ...site.socials.map((s) => ({ id: `open-${s.id}`, title: `Open ${s.label}`, icon: s.id, action: 'open', url: s.url, external: true, keywords: 'social profile' })),
    { id: 'download-cv', title: `${cv.label} (${cv.format})`, icon: 'download', action: 'open', url: cv.href, download: true, hint: `${cv.format} · ${cv.sizeKB} KB`, keywords: 'resume cv pdf download' },
    { id: 'print-cv', title: 'Print / Save CV as PDF', icon: 'print', action: 'print', url: 'experience.html?print=1', keywords: 'resume download pdf' },
  ];
  return { pages, projects: projectItems, actions };
}
