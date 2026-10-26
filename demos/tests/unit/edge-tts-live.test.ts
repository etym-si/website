import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeXml,
  generateSecMsGecV2,
  normalizeSpokenText,
  validateTtsParams,
} from '../../shared/edge-tts-live.ts';

test('generateSecMsGecV2 matches the Python edge_tts.drm v2 reference token bit-for-bit', () => {
  assert.equal(
    generateSecMsGecV2(1761500000),
    '3B0053F432211953-F8A992C7D41228EAFE34CDF6B4F6811C7190932B75F119E5278B8510EEE03F41',
  );
});

test('validateTtsParams enforces the strict voice allow-list, rate format, and text length bounds', () => {
  const ok = validateTtsParams(new URLSearchParams({ voice: 'en-US-AvaNeural', rate: '-5%', text: 'Look at the sun: 日!' }));
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.voice, 'en-US-AvaNeural');
    assert.equal(ok.rate, '-5%');
    assert.equal(ok.text, 'Look at the sun!');
  }

  const badVoice = validateTtsParams(new URLSearchParams({ voice: 'evil-voice" onload="1', rate: '+0%', text: 'hi' }));
  assert.equal(badVoice.ok, false);

  const badRate = validateTtsParams(new URLSearchParams({ voice: 'en-US-AvaNeural', rate: 'fast', text: 'hi' }));
  assert.equal(badRate.ok, false);

  const emptyText = validateTtsParams(new URLSearchParams({ voice: 'en-US-AvaNeural', rate: '+0%', text: '   ' }));
  assert.equal(emptyText.ok, false);
});

test('escapeXml and normalizeSpokenText sanitize XML entities and CJK radical names', () => {
  assert.equal(escapeXml('a < b & "c" \'d\'\x0b'), 'a &lt; b &amp; &quot;c&quot; &apos;d&apos; ');
  assert.equal(normalizeSpokenText('zh-CN-XiaoxiaoNeural', '加上草字头“艹”'), '加上草字头');
});
