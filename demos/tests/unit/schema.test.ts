import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EGYPT_FIXTURE, fixtureCopy, loadFixture } from '../helpers/fixture.ts';
import { formatDiagnostic } from '../../tools/content/diagnostics.ts';

const G17 = 'systems/egyptian/signs/G17.yaml';
const base = readFileSync(`${EGYPT_FIXTURE}/${G17}`, 'utf8');

test('the Egyptian fixture loads and validates cleanly', () => {
  const { content, diags } = loadFixture(EGYPT_FIXTURE, true);
  assert.deepEqual(diags.lines(), []);
  const sys = content!.systems.get('egyptian')!;
  assert.equal(sys.signs.get('G17')!.key, 'egyptian/G17');
  assert.deepEqual(sys.signs.get('G17')!.ext, { kind: 'uniliteral', sound: 'm' });
});

test('unknown keys are errors located at file:line:col', () => {
  const dir = fixtureCopy({ [G17]: base.replace('meaning:', 'meanin:') });
  const lines = loadFixture(dir).diags.lines();
  assert.ok(lines.some((l) => /signs\/G17\.yaml:\d+:\d+ meanin: unknown key "meanin"/.test(l)), lines.join('\n'));
});

test('unknown locale keys are errors; missing translations are warnings, errors in strict mode', () => {
  const unknown = fixtureCopy({ [G17]: base.replace('zh-Hant: 貓頭鷹', 'zh-Hanz: 貓頭鷹') });
  assert.ok(loadFixture(unknown).diags.lines().some((l) => l.includes('meaning.zh-Hanz: unknown key')));
  const missing = fixtureCopy({ [G17]: base.replace(', zh-Hant: 貓頭鷹', '') });
  const lax = loadFixture(missing).diags;
  assert.equal(lax.errors.length, 0);
  assert.ok(lax.warnings.some((d) => formatDiagnostic(d).includes('meaning.zh-Hant: missing translation (falls back to zh-Hans)')));
  assert.ok(loadFixture(missing, true).diags.errors.length > 0);
});

test('values are range-checked', () => {
  const dir = fixtureCopy({ [G17]: base.replace('box: [0, 0, 100, 100]', 'box: [0, 0, -5, 100]') });
  assert.ok(loadFixture(dir).diags.errors.some((d) => d.path.startsWith('forms[0].box')));
});

test('optional sign fields: status, sources (https only), origin', () => {
  const ok = fixtureCopy({ [G17]: `${base}sources:\n  - { title: Gardiner sign list, url: 'https://en.wikipedia.org/wiki/Gardiner%27s_sign_list' }\n` });
  assert.equal(loadFixture(ok).diags.errors.length, 0);
  const bad = fixtureCopy({ [G17]: `${base}sources:\n  - { title: x, url: 'http://example.com' }\n` });
  assert.ok(loadFixture(bad).diags.errors.some((d) => d.message.includes('https')));
});
