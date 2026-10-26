import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMOS } from '../../tools/paths.ts';
import { newSignFile, newSignYaml } from '../../tools/new-sign.ts';
import { realContent } from '../helpers/content.ts';
import { fixtureCopy, loadFixture } from '../helpers/fixture.ts';

const NEW = path.join(DEMOS, 'tools', 'new-sign.ts');

test('a han skeleton has every required field, empty', () => {
  const han = realContent().systems.get('han')!.data;
  assert.equal(newSignYaml(han, '鹤', 'en'), [
    '# yaml-language-server: $schema=../../../_schema/sign.schema.json',
    'id: 鹤',
    'status: draft',
    'text: { Hans: 鹤, Hant: 鹤 }',
    "readings: { pinyin: '' }",
    "meaning: { en: '' }",
    "fact: { en: '' }",
    'journey: default',
    '',
  ].join('\n'));
  assert.match(newSignYaml(han, '后-後', 'en'), /^text: \{ Hans: 后, Hant: 後 \}$/m);
});

test('ids are checked before they become file names, and existing files are refused', () => {
  const content = realContent();
  const han = content.systems.get('han')!.data;
  for (const bad of ['../x', 'a/b', 'horse', '马马', '.马', '马 ']) assert.ok('error' in newSignFile(content.root, han, bad), bad);
  assert.match((newSignFile(content.root, han, '马') as { error: string }).error, /already exists/);
  assert.deepEqual(newSignFile(content.root, han, '鹤'), { file: path.join(content.root, 'systems', 'han', 'signs', '鹤.yaml') });
});

test('npm run new writes a skeleton that the checker then asks to fill in, and never overwrites', () => {
  const dir = fixtureCopy();
  const run = () => spawnSync(process.execPath, [NEW, 'egyptian', 'D21', '--content', dir], { encoding: 'utf8' });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.match(readFileSync(path.join(dir, 'systems', 'egyptian', 'signs', 'D21.yaml'), 'utf8'), /^text: \{ Egyp: '' \}$/m);
  const { diags } = loadFixture(dir);
  assert.ok(diags.errors.some((d) => d.file.endsWith('D21.yaml')), diags.lines().join('\n'));
  const again = run();
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
});
