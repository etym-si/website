import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { clipKey, legacyClipName, spokenText } from '../../tools/audio/clip-key.ts';
import { ConfigSchema } from '../../tools/content/schema.ts';
import { CONTENT_DIR } from '../../tools/paths.ts';

const config = ConfigSchema.parse(parse(readFileSync(path.join(CONTENT_DIR, 'config.yaml'), 'utf8')));

test('clip keys are sha256 over provider|voice|rate|text', () => {
  assert.equal(clipKey('edge-tts', 'zh-CN-XiaoxiaoNeural', '-15%', '马'), '9b9a9ac5ec51443b0b49b67b12fb3818d785fcdfcf61139c914a9232406f22ca');
});

test('spoken text follows the per-voice rules in config.yaml', () => {
  assert.equal(spokenText(config.voices['narr-en'], '石 shows a rock (口) at the foot of a cliff (厂).'), '石 shows a rock () at the foot of a cliff ().');
  assert.equal(spokenText(config.voices['narr-en'], 'In the yard beside the cottage, a plump little pig — 豕 — sniffs for acorns…'),
    'In the yard beside the cottage, a plump little pig , 豕 , sniffs for acorns...');
  assert.equal(spokenText(config.voices['narr-zh'], '上面是草字头“艹”，下面'), '上面是草字头，下面');
  assert.equal(spokenText(config.voices['pron-zh'], ' 马 '), '马');
});

test('legacy names reproduce scripts/fetch-tts.py', () => {
  assert.equal(legacyClipName('zh', '马'), 'zh-54f7965c13a5.mp3');
  assert.equal(legacyClipName('en', '石 shows a rock () at the foot of a cliff ().'), 'en-a5094a4d624e.mp3');
});
