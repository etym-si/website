import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { commonsTitleFromUrl, importGlyphDir } from '../../tools/migrate/import-glyphs.ts';
import { DEMOS, TMP_DIR } from '../../tools/paths.ts';
import { fixtureCopy, loadFixture } from '../helpers/fixture.ts';

const LEGACY = path.join(DEMOS, 'tests', 'fixtures', 'legacy-glyphs');
const G17 = 'systems/egyptian/signs/G17.yaml';

test('commons titles are decoded from Python-quoted URLs', () => {
  assert.equal(commonsTitleFromUrl('https://commons.wikimedia.org/wiki/File%3A%E9%A6%AC-oracle.svg'), 'File:馬-oracle.svg');
  assert.equal(commonsTitleFromUrl('https://commons.wikimedia.org/wiki/File%3AHiero_G17.svg'), 'File:Hiero G17.svg');
});

test('legacy glyph JSON becomes the forms section of the matching sign', () => {
  const content = fixtureCopy();
  const signFile = path.join(content, G17);
  writeFileSync(signFile, readFileSync(signFile, 'utf8').replace(/\nforms:[\s\S]*$/, '\n'));
  const r = importGlyphDir({ dir: LEGACY, contentDir: content, system: 'egyptian' });
  assert.deepEqual(r, { written: ['G17.yaml'], unmatched: [], invalid: [] });
  const { content: set, diags } = loadFixture(content, true);
  assert.deepEqual(diags.lines(), []);
  const forms = set!.systems.get('egyptian')!.signs.get('G17')!.data.forms!;
  assert.equal(forms.length, 3);
  assert.equal(forms[0].commons, 'File:Hiero G17.svg');
  assert.equal(forms[0].provenance?.note, 'test note');
  assert.equal(forms[1].paths[0].mode, 'stroke');
});

test('unmatched and malformed files are reported, nothing is written in a dry run', () => {
  const dir = mkdtempSync(path.join(TMP_DIR, 'glyphs-'));
  writeFileSync(path.join(dir, 'G99.json'), readFileSync(path.join(LEGACY, 'G17.json'), 'utf8').replaceAll('𓅓', '𓅜'));
  writeFileSync(path.join(dir, 'bad.json'), '{"char": 1}');
  const content = fixtureCopy();
  const before = readFileSync(path.join(content, G17), 'utf8');
  const r = importGlyphDir({ dir, contentDir: content, system: 'egyptian', dryRun: true });
  assert.deepEqual(r, { written: [], unmatched: ['G99.json'], invalid: ['bad.json'] });
  assert.equal(readFileSync(path.join(content, G17), 'utf8'), before);
});
