import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { clipPath, readMediaManifest } from '../../tools/audio/media.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { loadContent } from '../../tools/content/load.ts';
import { parseSvg, sanitizePicture } from '../../tools/content/svg.ts';
import { validateContent } from '../../tools/content/validate.ts';
import { formsFromLegacy } from '../../tools/migrate/import-glyphs.ts';
import { KNOWN_ORPHANS, mapLegacyClips, tri } from '../../tools/migrate/film36.ts';
import { CONTENT_DIR, DEMOS, GOLDEN_DIR, MEDIA_DIR } from '../../tools/paths.ts';

const golden = (n: string) => JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${n}.json`), 'utf8'));
const diags = new Diags();
const content = loadContent(CONTENT_DIR, diags)!;
if (content) validateContent(content, diags, { strict: true });
const han = content.systems.get('han')!;
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

test('migrated content validates cleanly in strict mode', () => {
  assert.deepEqual(diags.lines(), []);
});

test('every film character became a reviewed sign with the same texts', () => {
  const stories = golden('stories');
  for (const c of golden('chars')) {
    const s = han.signs.get(c.char)!.data;
    assert.deepEqual(s.text, { Hans: c.char, Hant: c.trad });
    assert.equal(s.readings.pinyin, c.pinyin);
    assert.deepEqual(s.meaning, tri(c.meaning));
    assert.deepEqual(s.fact, tri(c.fact));
    assert.equal(s.status, 'reviewed');
    const st = stories[c.char];
    for (const beat of ['topic', 'hook', 'rotate', 'early', 'turn', 'closer'] as const) {
      assert.deepEqual(s.story?.[beat], st[beat] ? tri(st[beat]) : undefined, `${c.char} ${beat}`);
    }
  }
});

test('forms are the legacy glyph data, unchanged', () => {
  for (const c of golden('chars')) {
    const legacy = JSON.parse(readFileSync(path.join(DEMOS, 'public', 'glyphs', `${c.char}.json`), 'utf8'));
    assert.deepEqual(han.signs.get(c.char)!.data.forms ?? [], formsFromLegacy(legacy), c.char);
  }
});

test('pictures round-trip through the sanitizer', () => {
  for (const [ch, p] of Object.entries<{ svg: string; rotate: number }>(golden('pictures'))) {
    const pic = han.signs.get(ch)!.data.picture!;
    assert.equal(pic.rotate, p.rotate);
    const r = sanitizePicture(pic.svg);
    const g = parseSvg(p.svg);
    delete g[1].xmlns;
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.tree, [g], ch);
  }
});

test('every referenced legacy clip is mapped and copied byte-for-byte', () => {
  const legacyDir = path.join(DEMOS, 'public', 'tts');
  const legacy = JSON.parse(readFileSync(path.join(DEMOS, 'src', 'data', 'tts-manifest.json'), 'utf8'));
  const { mapped, orphans } = mapLegacyClips(content.config.data, legacy, legacyDir);
  assert.equal(mapped.length, 546);
  assert.deepEqual(orphans, KNOWN_ORPHANS);
  const manifest = readMediaManifest(MEDIA_DIR);
  assert.equal(Object.keys(manifest.clips).length, 546);
  for (const m of mapped) {
    assert.equal(manifest.clips[m.key]?.text, m.spoken);
    assert.equal(sha(readFileSync(clipPath(MEDIA_DIR, m.key))), sha(readFileSync(path.join(legacyDir, m.legacy))), m.legacy);
  }
});

test('six stories, one per unit', () => {
  const film = content.collections.get('film-36')!;
  assert.deepEqual([...film.stories.keys()].sort(), ['casting-the-net', 'galloping-across-the-meadow', 'grandpa-chases-the-tiger', 'home-under-the-crescent-moon', 'shelter-under-the-cliff', 'sunrise-in-the-valley']);
  assert.deepEqual(film.data.units.map((u) => u.story), ['sunrise-in-the-valley', 'galloping-across-the-meadow', 'casting-the-net', 'shelter-under-the-cliff', 'grandpa-chases-the-tiger', 'home-under-the-crescent-moon']);
});
