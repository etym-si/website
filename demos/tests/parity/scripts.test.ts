import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evolutionScript } from '../../tools/compile/evolution.ts';
import { expandStory } from '../../tools/compile/stories.ts';
import { realContent } from '../helpers/content.ts';
import { golden, legacyStep, stripClips, tri, type Tri } from './normalize.ts';

const content = realContent();
const han = content.systems.get('han')!;

test('evolution scripts (full and compact) match today for all 36 characters, with 门 swinging its two door leaves open', () => {
  const legacy = golden<Record<string, { full: Record<string, unknown>[]; compact: Record<string, unknown>[] }>>('evolution');
  for (const [ch, scripts] of Object.entries(legacy)) {
    const sign = han.signs.get(ch)!;
    const full = stripClips(evolutionScript(content, han, sign));
    const compact = stripClips(evolutionScript(content, han, sign, { compact: true }));
    if (ch === '门') {
      assert.ok(full.some((s) => s.do === 'picture' && s.pic === 'han/门'), '门 full script shows gate picture');
      assert.ok(
        full.some((s) => s.do === 'together' && s.steps.some((p) => p.do === 'pose' && p.part === 'leaf-l') && s.steps.some((p) => p.do === 'pose' && p.part === 'leaf-r')),
        '门 full script swings leaf-l and leaf-r open',
      );
      assert.ok(compact.some((s) => s.do === 'picture' && s.pic === 'han/门'), '门 compact script shows gate picture');
      continue;
    }
    assert.deepEqual(full, scripts.full.map(legacyStep), `${ch} full`);
    assert.deepEqual(compact, scripts.compact.map(legacyStep), `${ch} compact`);
  }
});

test('the six story scripts match today, with Story 6 swinging 门 open', () => {
  const film = content.collections.get('film-36')!;
  const chapters = golden<{ unit: number; title: Tri; topic: Tri; script: Record<string, unknown>[] }[]>('chapters');
  for (const ch of chapters) {
    const unit = film.data.units.find((u) => (u.n ?? 0) === ch.unit)!;
    const story = film.stories.get(unit.story!)!;
    assert.deepEqual(story.data.title, tri(ch.title));
    assert.deepEqual(story.data.topic, tri(ch.topic));
    const expanded = stripClips(expandStory(content, film, story));
    if (ch.unit === 6) {
      assert.ok(expanded.some((s) => s.do === 'picture' && s.actor === 'gate' && s.pic === 'han/门'), 'Story 6 draws 门 gate picture');
      assert.ok(
        expanded.some((s) => s.do === 'together' && s.steps.some((p) => p.do === 'pose' && p.actor === 'gate' && p.part === 'leaf-l') && s.steps.some((p) => p.do === 'pose' && p.actor === 'gate' && p.part === 'leaf-r')),
        'Story 6 swings both gate leaves open',
      );
      continue;
    }
    assert.deepEqual(expanded, ch.script.map(legacyStep), story.data.id);
  }
});
