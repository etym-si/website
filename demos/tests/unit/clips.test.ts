import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClipResolver } from '../../tools/audio/clips.ts';
import { readMediaManifest } from '../../tools/audio/media.ts';
import { evolutionScript } from '../../tools/compile/evolution.ts';
import { expandStory } from '../../tools/compile/stories.ts';
import { MEDIA_DIR } from '../../tools/paths.ts';
import { realContent } from '../helpers/content.ts';

const content = realContent();
const han = content.systems.get('han')!;

test('narration gets one clip per locale; zh-Hant reuses the zh-Hans audio; pronunciations reuse one clip', () => {
  const r = new ClipResolver(content, readMediaManifest(MEDIA_DIR), MEDIA_DIR);
  const steps = r.attach(evolutionScript(content, han, han.signs.get('马')!));
  const says = steps.filter((s) => s.do === 'say');
  const narration = says.find((s) => s.lang === 'ui')!;
  assert.equal(Object.keys(narration.clip!).length, 3);
  assert.equal(narration.clip!['zh-Hant'], narration.clip!['zh-Hans']);
  assert.notEqual(narration.clip!.en, narration.clip!['zh-Hans']);
  const pron = says.find((s) => s.lang === 'zh')!;
  assert.deepEqual(new Set(Object.values(pron.clip!)), new Set([r.pronunciation('马')]));
  const sections = r.sectionKeys(steps, [r.pronunciation('马')!]);
  assert.deepEqual(sections.map((s) => s.id), ['en', 'zh']);
  assert.equal(sections[0].keys[0], r.pronunciation('马'));
  assert.ok(sections[1].keys.includes(r.pronunciation('马')!));
  assert.equal(r.missing.size, 0);
});

test('every narration line and pronunciation of the film corpus has a master clip', () => {
  const r = new ClipResolver(content, readMediaManifest(MEDIA_DIR), MEDIA_DIR);
  for (const s of han.signs.values()) {
    r.attach(evolutionScript(content, han, s));
    r.attach(evolutionScript(content, han, s, { compact: true }));
  }
  const film = content.collections.get('film-36')!;
  for (const st of film.stories.values()) r.attach(expandStory(content, film, st));
  assert.deepEqual([...r.missing.values()], []);
});

test('lines without a master are reported, not attached', () => {
  const r = new ClipResolver(content, { v: 1, clips: {} }, MEDIA_DIR);
  const [say] = r.attach([{ do: 'say', text: { en: 'New line', 'zh-Hans': '新句子', 'zh-Hant': '新句子' }, lang: 'ui', wait: true }]);
  assert.equal(say.do === 'say' && say.clip, undefined);
  assert.deepEqual(new Set([...r.missing.values()].map((m) => m.text)), new Set(['New line', '新句子']));
  assert.ok([...r.missing.values()].some((m) => m.voice === 'en-US-AvaMultilingualNeural' && m.rate === '-4%' && m.spoken === 'New line'));
});
