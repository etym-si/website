import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GOLDEN_DIR } from '../../tools/paths.ts';

const read = (name: string) => JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${name}.json`), 'utf8'));

test('golden snapshots cover the whole film corpus', () => {
  const chars = read('chars') as { char: string; trad: string }[];
  assert.equal(chars.length, 36);
  const evolution = read('evolution');
  for (const c of chars) {
    assert.ok(evolution[c.char].full.length > 5, `full script for ${c.char}`);
    assert.ok(evolution[c.char].compact.length > 3, `compact script for ${c.char}`);
  }
  const cards = read('cards');
  assert.equal(Object.keys(cards).length, 36);
  const oracle田 = cards['田'].simp.find((e: { stage: string }) => e.stage === 'oracle');
  assert.equal(oracle田.card.kind, 'exact');
  const reg = (script: string) => cards['鸟'][script].find((e: { stage: string }) => e.stage === 'regular').card;
  assert.match(reg('simp').text.en, /^鸟 is one of/);
  assert.match(reg('trad').text.en, /^鳥 is one of/);
  assert.equal(read('chapters').length, 6);
  assert.equal(Object.keys(read('pictures')).length, 12);
  assert.equal(read('stages').stages.length, 7);
  const units = read('units');
  assert.equal(units.units.length, 6);
  assert.equal(units.lessons.length, 30);
  assert.equal(read('strings').tagline.en, 'Where Chinese characters come from');
  assert.equal(Object.keys(read('stories')).length, 36);
});
