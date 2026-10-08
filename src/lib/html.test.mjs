// Run with: node src/lib/html.test.mjs  (or `npm test`)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, raw, escapeHtml, escapeAttr, attrs, json, slugify, formatDate, joinUrl, toString } from './html.mjs';

test('interpolated values are escaped', () => {
  const evil = `<img src=x onerror="alert('x')"> & more`;
  const out = String(html`<p>${evil}</p>`);
  assert.equal(out, '<p>&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; more</p>');
});

test('attribute values cannot break out', () => {
  const out = String(html`<a href="${'" onclick="x'}">y</a>`);
  assert.ok(!out.includes('" onclick'));
  assert.ok(out.includes('&quot; onclick=&quot;x'));
});

test('raw() passes through untouched', () => {
  assert.equal(String(html`<div>${raw('<b>ok</b>')}</div>`), '<div><b>ok</b></div>');
});

test('nested html results are not double-escaped', () => {
  const inner = html`<li>${'a&b'}</li>`;
  assert.equal(String(html`<ul>${inner}</ul>`), '<ul><li>a&amp;b</li></ul>');
});

test('arrays are flattened and each item escaped unless raw', () => {
  const items = ['<x>', raw('<y>'), html`<z>${'<'}</z>`];
  assert.equal(String(html`${items}`), '&lt;x&gt;<y><z>&lt;</z>');
});

test('nullish / boolean values render nothing; 0 renders', () => {
  assert.equal(String(html`[${null}${undefined}${false}${true}${0}]`), '[0]');
  const flag = false;
  assert.equal(String(html`[${flag && html`<b>x</b>`}]`), '[]');
});

test('raw(raw(x)) is idempotent, escapeHtml of Raw-like string escapes', () => {
  const r = raw('<i>');
  assert.equal(raw(r), r);
  assert.equal(escapeHtml('<i>'), '&lt;i&gt;');
  assert.equal(escapeAttr(`"'`), '&quot;&#39;');
  assert.equal(toString('<'), '&lt;');
});

test('attrs() escapes values and drops falsy ones', () => {
  assert.equal(String(attrs({ class: 'a"b', hidden: true, id: null, 'data-x': 0 })), ' class="a&quot;b" hidden data-x="0"');
  assert.throws(() => attrs({ 'bad name': 1 }));
});

test('json() is safe inside <script>', () => {
  const out = String(json({ a: '</script><!--' }));
  assert.ok(!out.includes('</script>'));
  assert.deepEqual(JSON.parse(out), { a: '</script><!--' });
});

test('slugify / formatDate / joinUrl', () => {
  assert.equal(slugify('  Ténsion & Co. 2024! '), 'tension-co-2024');
  assert.equal(formatDate('2022-07'), 'Jul 2022');
  assert.equal(formatDate('present'), 'Present');
  assert.equal(formatDate('2022'), '2022');
  assert.equal(joinUrl('../', 'assets/a.css'), '../assets/a.css');
  assert.equal(joinUrl('', './about.html'), 'about.html');
  assert.equal(joinUrl('/', '/assets/a.css'), '/assets/a.css');
  assert.equal(joinUrl('../', 'https://x.io/a'), 'https://x.io/a');
  assert.equal(joinUrl('../', '#top'), '#top');
  assert.equal(joinUrl('../', 'mailto:a@b.c'), 'mailto:a@b.c');
  assert.equal(joinUrl('', ''), './');
});

test('jsLiteral is safe inside inline scripts', async () => {
  const { jsLiteral } = await import('./html.mjs');
  assert.equal(jsLiteral('a</script><b>'), '"a\\u003c/script\\u003e\\u003cb\\u003e"');
});
