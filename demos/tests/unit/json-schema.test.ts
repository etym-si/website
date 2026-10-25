import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderJsonSchemas } from '../../tools/content/json-schema.ts';
import { CONTENT_DIR } from '../../tools/paths.ts';

test('content/_schema is up to date (run npm run schema)', () => {
  for (const [name, text] of renderJsonSchemas(['en', 'zh-Hans', 'zh-Hant'])) {
    assert.equal(readFileSync(path.join(CONTENT_DIR, '_schema', name), 'utf8'), text, name);
  }
});
