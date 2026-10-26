import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { asciiId, contentHash, hashedName, safeJoin } from '../../tools/compile/output.ts';

test('compiled file names are ASCII', () => {
  assert.equal(asciiId('马'), 'u9a6c');
  assert.equal(asciiId('后-後'), 'u540e-u5f8c');
  assert.equal(asciiId('G17'), 'G17');
});

test('names carry a stable content hash', () => {
  const bytes = new TextEncoder().encode('hello');
  assert.equal(contentHash(bytes), '2cf24dba5f');
  assert.equal(hashedName('u9a6c', 'json', bytes), 'u9a6c.2cf24dba5f.json');
});

test('output paths must stay inside the output root', () => {
  const root = path.resolve('/tmp/out');
  assert.equal(safeJoin(root, 'data/x.json'), path.join(root, 'data', 'x.json'));
  for (const bad of ['../x', '/etc/passwd', 'data/../../x', '']) assert.throws(() => safeJoin(root, bad), /escapes/);
});
