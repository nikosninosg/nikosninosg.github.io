#!/usr/bin/env node
/**
 * Zero-dependency, filesystem-based link/asset checker for the generated site.
 *
 *   node src/check-links.mjs
 *
 * Walks every generated *.html in the repo root, resolves local href / src / srcset / poster /
 * <meta http-equiv="refresh"> / canonical-relative targets against the file system (directory URLs
 * resolve to index.html), and verifies that #fragment ids exist in the target file. External URLs
 * (http, https, mailto, tel, data, javascript, protocol-relative) are skipped. Root-relative URLs ("/x")
 * resolve from the repo root. Prints broken ones as file:line and exits 1.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'src', 'content', 'assets']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith('.')) walk(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const isExternal = (u) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u);

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const src = readFileSync(file, 'utf8');
    const ids = new Set();
    for (const m of src.matchAll(/\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) ids.add(decode(m[1] ?? m[2]));
    idCache.set(file, ids);
  }
  return idCache.get(file);
}

function resolveTarget(fromFile, rawUrl, canonicalDir) {
  let [pathPart, ...rest] = rawUrl.split('#');
  const hash = rest.length ? rest.join('#') : null;
  pathPart = pathPart.split('?')[0];
  let abs;
  if (pathPart === '') abs = fromFile;
  else if (pathPart.startsWith('/')) abs = join(ROOT, decodeURIComponent(pathPart));
  else abs = resolve(dirname(fromFile), decodeURIComponent(pathPart));
  void canonicalDir;
  if (!abs.startsWith(ROOT)) return { ok: false, why: 'resolves outside the repository' };
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = join(abs, 'index.html');
  if (!existsSync(abs)) return { ok: false, why: 'file not found' };
  if (hash && hash !== 'top' && abs.endsWith('.html')) {
    if (!idsOf(abs).has(decodeURIComponent(hash))) return { ok: false, why: `no element with id "${hash}" in ${relative(ROOT, abs)}` };
  }
  return { ok: true };
}

/** Yield {url, line} for each local reference in an HTML source. */
function* references(src) {
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  // Ignore script/style/comment bodies (JSON-LD, inline JS and docs examples contain URLs that are not links).
  const masked = src.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, ' '));
  const tagRe = /<(a|link|img|script|source|video|audio|iframe|area|form|meta|use|image)\b([^>]*)>/gi;
  for (const tag of masked.matchAll(tagRe)) {
    const [, name, attrs] = tag;
    const base = tag.index;
    for (const m of attrs.matchAll(/\s([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const attr = m[1].toLowerCase();
      const value = decode(m[2] ?? m[3] ?? m[4] ?? '').trim();
      const line = lineAt(base + tag[0].indexOf(m[0]));
      if (['href', 'src', 'poster', 'action', 'data-src', 'xlink:href'].includes(attr)) {
        if (name.toLowerCase() === 'link' && attr === 'href' && /\brel\s*=\s*["']?(?:preconnect|dns-prefetch)/i.test(attrs)) continue;
        yield { url: value, line, attr };
      } else if (attr === 'srcset') {
        for (const part of value.split(',')) {
          const u = part.trim().split(/\s+/)[0];
          if (u) yield { url: u, line, attr };
        }
      } else if (attr === 'content' && name.toLowerCase() === 'meta' && /http-equiv\s*=\s*["']?refresh/i.test(attrs)) {
        const mm = value.match(/url\s*=\s*['"]?([^'";]+)/i);
        if (mm) yield { url: mm[1].trim(), line, attr: 'meta refresh' };
      }
    }
  }
}

const files = walk(ROOT).sort();
const broken = [];
let checked = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const { url, line, attr } of references(src)) {
    if (!url || isExternal(url)) continue;
    checked++;
    const r = resolveTarget(file, url);
    if (!r.ok) broken.push(`${relative(ROOT, file).split(sep).join('/')}:${line}  ${attr}="${url}"  ${r.why}`);
  }
}

if (broken.length) {
  console.error(`check-links: ${broken.length} broken reference(s) in ${files.length} file(s):\n`);
  for (const b of broken) console.error('  ' + b);
  process.exit(1);
}
console.log(`check-links: ${checked} local references in ${files.length} HTML files OK.`);
