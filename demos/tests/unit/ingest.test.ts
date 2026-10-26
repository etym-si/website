import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { CONTENT_DIR, TMP_DIR } from '../../tools/paths.ts';
import { CREDIT_MARKER, writeCredit } from '../../tools/content/credit-writer.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { loadContent } from '../../tools/content/load.ts';
import { makeSchemas } from '../../tools/content/schema.ts';
import { formsFromResults, glyphPlan, selectSigns, type GlyphResult } from '../../tools/ingest/glyphs.ts';
import { applyPhotoResults, photoJobs, selectArtifacts } from '../../tools/ingest/photos.ts';
import { realContent } from '../helpers/content.ts';

test('glyph jobs come from journeys: default stages, per-sign forms and variants, empty journeys', () => {
  const content = realContent();
  const plans = glyphPlan(content, selectSigns(content, ['han/马', 'han/草', 'han/网', 'han/伞'], false));
  const titles = (i: number) => plans[i].entries.map((e) => e.job.candidates.map((c) => c.title));
  assert.deepEqual(titles(0), [
    ['File:馬-oracle.svg'],
    ['File:馬-bronze.svg', 'File:馬-bronze-shang.svg'],
    ['File:馬-seal.svg'],
    ['File:馬-clerical-han.svg', 'File:馬-clerical.svg', 'File:馬-slip.svg', 'File:馬-silk.svg'],
  ]);
  assert.deepEqual(titles(1), [['File:艸-seal.svg'], ['File:草-seal.svg']]);
  assert.deepEqual(titles(2)[3], ['File:网-clerical.svg', 'File:网-slip.svg', 'File:网-silk.svg']);
  assert.deepEqual(titles(3), []);
  assert.equal(plans[0].entries[1].job.id, 'han/马#1');
  assert.throws(() => selectSigns(content, ['马'], false), /unknown sign 马/);
  assert.throws(() => selectSigns(content, ['han/鹤'], false), /unknown sign han\/鹤/);
});

test('re-running glyph ingest on the film corpus asks for exactly the committed forms', () => {
  const content = realContent();
  assert.equal(selectSigns(content, [], false).length, 0); // every film sign has a forms section
  const plans = glyphPlan(content, selectSigns(content, [], true));
  assert.equal(plans.length, 36);
  for (const p of plans) {
    const forms = p.sign.data.forms ?? [];
    assert.equal(p.entries.length, forms.length, p.sign.key);
    p.entries.forEach((e, i) => {
      assert.deepEqual([e.stage, e.form], [forms[i].stage, forms[i].form], p.sign.key);
      assert.ok(e.job.candidates.some((c) => c.title === forms[i].commons && c.variant === forms[i].variant), `${p.sign.key}: ${forms[i].commons}`);
    });
  }
});

test('adapter results become schema-checked forms in journey order; misses and bad geometry are reported', () => {
  const content = realContent();
  const [plan] = glyphPlan(content, selectSigns(content, ['han/马'], false));
  const { Form } = makeSchemas(content.locales);
  const hit = (id: string, variant: string, title: string): GlyphResult => ({
    id, variant, title, provenance: { period: '商', code: '', note: '合5216' }, box: [0, 0, 300, 300], paths: [{ d: 'M0 0 L10 10 Z' }],
  });
  const results = new Map<string, GlyphResult>([
    ['han/马#0', hit('han/马#0', 'oracle', 'File:馬-oracle.svg')],
    ['han/马#1', { id: 'han/马#1', error: 'no Commons file' }],
    ['han/马#2', { ...hit('han/马#2', 'seal', 'File:馬-seal.svg'), paths: [{ d: 'M0 0 url(#x)' }] }],
    ['han/马#3', hit('han/马#3', 'clerical', 'File:馬-clerical.svg')],
  ]);
  const { forms, problems } = formsFromResults(plan, results, Form);
  assert.deepEqual(forms.map((f) => [f.stage, f.form, f.variant, f.commons]), [
    ['oracle', '馬', 'oracle', 'File:馬-oracle.svg'],
    ['clerical', '馬', 'clerical', 'File:馬-clerical.svg'],
  ]);
  assert.deepEqual(problems, [
    'bronze 馬: no Commons file (tried File:馬-bronze.svg, File:馬-bronze-shang.svg)',
    'seal 馬: File:馬-seal.svg rejected (paths.0.d: path data has unexpected characters)',
  ]);
});

test('the credit writer adds its marker, replaces an old credit and keeps everything else', () => {
  const text = readFileSync(path.join(CONTENT_DIR, 'artifacts', 'heji6057.yaml'), 'utf8');
  const credit = parse(text).credit;
  const once = writeCredit(text, credit);
  assert.equal(once, text.replace('\ncredit:\n', `\n#${CREDIT_MARKER}\ncredit:\n`));
  assert.equal(writeCredit(once, credit), once);
  const changed = writeCredit(once, { ...credit, author: 'Someone Else' });
  assert.equal(parse(changed).credit.author, 'Someone Else');
  assert.equal(changed.split(CREDIT_MARKER).length, 2);
  const small = writeCredit('# about this artifact\nid: demo # the id\ntitle: { en: Demo }\n', credit);
  assert.ok(small.startsWith(`# about this artifact\nid: demo # the id\ntitle: { en: Demo }\n#${CREDIT_MARKER}\ncredit:\n  author: `), small);
});

test('photo jobs come from artifact files, and results are schema-checked before a credit is written', () => {
  const content = realContent();
  assert.equal(selectArtifacts(content, [], false).length, 0); // every migrated artifact has its photo and credit
  assert.deepEqual(photoJobs(selectArtifacts(content, ['heji6057'], true), true), [
    { id: 'heji6057', title: 'File:Shang Inscribed Ox Scapula (for divination).jpg', file: 'heji6057.jpg', refresh: true },
  ]);
  assert.throws(() => selectArtifacts(content, ['nope'], false), /unknown artifact nope/);

  const dir = path.join(TMP_DIR, 'ingest-photos');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });
  cpSync(CONTENT_DIR, dir, { recursive: true });
  const copy = loadContent(dir, new Diags())!;
  const page = 'https://commons.wikimedia.org/wiki/File%3AX.jpg';
  const problems = applyPhotoResults(copy, [
    { id: 'heji6057', author: 'A. Photographer', license: 'CC0', page, width: 800, height: 600 },
    { id: 'zhiyong', author: 'B', license: 'CC BY-NC 2.0', page, width: 1, height: 1 },
    { id: 'shuowen', error: 'missing File:Shuowen Jiezi, by Xu Xuan.png' },
  ]);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^zhiyong: credit rejected/);
  assert.equal(problems[1], 'shuowen: missing File:Shuowen Jiezi, by Xu Xuan.png');
  const heji = parse(readFileSync(path.join(dir, 'artifacts', 'heji6057.yaml'), 'utf8'));
  assert.deepEqual(heji.credit, { author: 'A. Photographer', license: 'CC0', page, width: 800, height: 600 });
  assert.equal(readFileSync(path.join(dir, 'artifacts', 'zhiyong.yaml'), 'utf8'), readFileSync(path.join(CONTENT_DIR, 'artifacts', 'zhiyong.yaml'), 'utf8'));
});
