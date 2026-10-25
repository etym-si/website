import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EGYPT_FIXTURE, fixtureCopy, loadFixture } from '../helpers/fixture.ts';

const read = (p: string) => readFileSync(`${EGYPT_FIXTURE}/${p}`, 'utf8');
const G17 = 'systems/egyptian/signs/G17.yaml';
const COLL = 'collections/egypt-demo/collection.yaml';
const msgs = (dir: string, strict = false) => loadFixture(dir, strict).diags.errors.map((d) => `${d.path}: ${d.message}`);

test('sign ids must match the file name and the system id rule', () => {
  assert.ok(msgs(fixtureCopy({ [G17]: read(G17).replace('id: G17', 'id: G18') })).some((m) => m.includes('must match the file name')));
  assert.ok(msgs(fixtureCopy({ 'systems/egyptian/signs/g17x.yaml': read(G17).replace('id: G17', 'id: g17x') })).some((m) => m.includes('does not match the egyptian sign id rule')));
});

test('collections must reference existing signs, at most once per collection', () => {
  assert.ok(msgs(fixtureCopy({ [COLL]: read(COLL).replace('signs: [G17]', 'signs: [G17, G99]') })).some((m) => m.includes('unknown sign egyptian/G99')));
  const twice = read(COLL) + `  - title: { en: Again, zh-Hans: 再来, zh-Hant: 再來 }\n    signs: [G17]\n`;
  assert.ok(msgs(fixtureCopy({ [COLL]: twice })).some((m) => m.includes('already appears in unit 1')));
});

test('every journey stage needs a form', () => {
  const noDemotic = read(G17).replace(/  - stage: demotic[\s\S]*$/, '');
  assert.ok(msgs(fixtureCopy({ [G17]: noDemotic })).some((m) => m.includes('journey stage demotic has no form')));
});

test('artifacts need their photo and a credit', () => {
  const art = [
    'id: owl-stela', 'stage: egyptian.hieroglyph', 'title: { en: An owl on a stela }',
    'image: { file: owl-stela.jpg, commons: "File:Owl stela.jpg" }', 'occurrences:', '  - sign: egyptian/G17', '    marks: [{ box: [0.1, 0.1, 0.2, 0.2] }]', '',
  ].join('\n');
  const errs = msgs(fixtureCopy({ 'artifacts/owl-stela.yaml': art }));
  assert.ok(errs.some((m) => m.includes('photo file owl-stela.jpg is missing')));
  assert.ok(errs.some((m) => m.includes('credit section missing')));
  const outside = art.replace('[0.1, 0.1, 0.2, 0.2]', '[0.9, 0.1, 0.2, 0.2]');
  assert.ok(msgs(fixtureCopy({ 'artifacts/owl-stela.yaml': outside })).some((m) => m.includes('within 0–1')));
});

test('pictures must pass the SVG sanitizer', () => {
  const pic = `picture:\n  rotate: 0\n  svg: |\n    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><g onclick="x"/></svg>\n`;
  assert.ok(msgs(fixtureCopy({ [G17]: read(G17).replace('journey:', `${pic}journey:`) })).some((m) => m.includes('attribute onclick is not allowed')));
});
