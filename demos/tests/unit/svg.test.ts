import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSvg, sanitizePicture, serializeSvg, wrapPicture } from '../../tools/content/svg.ts';

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">${inner}</svg>`;

test('accepts shapes, presentation attributes, animation classes and data-part', () => {
  const r = sanitizePicture(wrap('<g class="pic pic-sun" data-part="door-left"><path d="M0 0 L10 10Z" fill="#e8453c" stroke-width="7"/><circle cx="1" cy="2" r="3" opacity="0.5"/></g>'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.tree, [['g', { class: 'pic pic-sun', 'data-part': 'door-left' }, [['path', { d: 'M0 0 L10 10Z', fill: '#e8453c', 'stroke-width': '7' }, []], ['circle', { cx: '1', cy: '2', r: '3', opacity: '0.5' }, []]]]]);
});

test('rejects scripts, event handlers, href, style, url() and foreign elements', () => {
  for (const [inner, why] of [
    ['<script/>', 'element <script> is not allowed'],
    ['<script>alert(1)</script>', 'text content is not allowed'],
    ['<g onclick="x"/>', 'attribute onclick is not allowed'],
    ['<g style="fill:red"/>', 'attribute style is not allowed'],
    ['<path d="M0 0" fill="url(#a)"/>', 'attribute fill="url(#a)" is not allowed'],
    ['<image href="x.png"/>', 'element <image> is not allowed'],
    ['<use href="#a"/>', 'element <use> is not allowed'],
    ['<foreignObject/>', 'element <foreignObject> is not allowed'],
    ['<g><!-- hi --></g>', 'comments, doctypes and processing instructions are not allowed'],
    ['<g data-part="Bad Part"/>', 'attribute data-part="Bad Part" is not allowed'],
    ['<path data-part="x" d="M0 0"/>', 'attribute data-part is not allowed on <path>'],
  ] as const) {
    const r = sanitizePicture(wrap(inner));
    assert.equal(r.ok, false, inner);
    assert.ok(!r.ok && r.error.includes(why), `${inner} → ${!r.ok && r.error}`);
  }
  assert.equal(sanitizePicture('<svg viewBox="0 0 300 300"><g/></svg>').ok, false); // missing xmlns
});

test('pretty printing round-trips', () => {
  const tree = parseSvg(wrap('<g class="pic"><rect x="1" y="2" width="3" height="4" rx="1"/></g>'))[2];
  assert.deepEqual(parseSvg(wrapPicture(tree))[2], tree);
  assert.equal(serializeSvg(tree[0]), '<g class="pic"><rect x="1" y="2" width="3" height="4" rx="1"/></g>');
});
