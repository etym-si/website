import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evolutionScript } from '../../tools/compile/evolution.ts';
import { expandStory } from '../../tools/compile/stories.ts';
import { realContent } from '../helpers/content.ts';
import { golden, legacyStep, stripClips, tri, type Tri } from './normalize.ts';

const content = realContent();
const han = content.systems.get('han')!;

test('evolution scripts (full and compact) match today for all 36 characters', () => {
  const legacy = golden<Record<string, { full: Record<string, unknown>[]; compact: Record<string, unknown>[] }>>('evolution');
  for (const [ch, scripts] of Object.entries(legacy)) {
    const sign = han.signs.get(ch)!;
    assert.deepEqual(stripClips(evolutionScript(content, han, sign)), scripts.full.map(legacyStep), `${ch} full`);
    assert.deepEqual(stripClips(evolutionScript(content, han, sign, { compact: true })), scripts.compact.map(legacyStep), `${ch} compact`);
  }
});

test('the six story scripts match today', () => {
  const film = content.collections.get('film-36')!;
  const chapters = golden<{ unit: number; title: Tri; topic: Tri; script: Record<string, unknown>[] }[]>('chapters');
  for (const ch of chapters) {
    const unit = film.data.units.find((u) => (u.n ?? 0) === ch.unit)!;
    const story = film.stories.get(unit.story!)!;
    assert.deepEqual(story.data.title, tri(ch.title));
    assert.deepEqual(story.data.topic, tri(ch.topic));
    assert.deepEqual(stripClips(expandStory(content, film, story)), ch.script.map(legacyStep), story.data.id);
  }
});
