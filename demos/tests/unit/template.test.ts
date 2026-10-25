import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, leftovers, TemplateError } from '../../tools/compile/template.ts';
import { realContent } from '../helpers/content.ts';

const content = realContent();

test('fills placeholders per locale, falling back for missing locales', () => {
  const out = fill(content, { en: 'This {sign} is {name}.', 'zh-Hans': '这个“{sign}”是{name}。' }, { sign: '马', name: { en: 'a horse', 'zh-Hans': '马儿' } }, 't');
  assert.deepEqual(out, { en: 'This 马 is a horse.', 'zh-Hans': '这个“马”是马儿。', 'zh-Hant': '这个“马”是马儿。' });
});

test('keeps the runtime token {shown} and rejects unknown placeholders', () => {
  assert.equal(fill(content, { en: '{shown} is here' }, {}, 't').en, '{shown} is here');
  assert.throws(() => fill(content, { en: 'oops {nmae}' }, {}, 'han/马 oracle'), (e: unknown) => e instanceof TemplateError && /han\/马 oracle: unknown placeholder \{nmae\}/.test(e.message));
  assert.deepEqual(leftovers('a {shown} b {x} c'), ['{x}']);
});
