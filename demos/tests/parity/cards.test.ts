import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSignCards } from '../../tools/compile/cards.ts';
import { signTimeline } from '../../tools/compile/timeline.ts';
import { realContent } from '../helpers/content.ts';
import { compiledCard, golden, legacyCard } from './normalize.ts';

type Event = { stage: string; index: number; card: Parameters<typeof legacyCard>[0] };

test('every artifact card matches today, for all 36 characters in 简 and 繁', () => {
  const content = realContent();
  const han = content.systems.get('han')!;
  const legacy = golden<Record<string, Record<'simp' | 'trad', Event[]>>>('cards');
  let compared = 0;
  for (const [ch, scripts] of Object.entries(legacy)) {
    const sign = han.signs.get(ch)!;
    const cards = resolveSignCards(content, han, sign, (id) => `data/photos/${id}.jpg`, signTimeline(han, sign));
    for (const script of ['simp', 'trad'] as const) {
      const shown = script === 'trad' ? sign.data.text.Hant : sign.data.text.Hans;
      for (const ev of scripts[script]) {
        assert.deepEqual(compiledCard(cards[ev.stage]?.[ev.index], shown), legacyCard(ev.card), `${ch} ${script} ${ev.stage}#${ev.index}`);
        compared++;
      }
    }
  }
  assert.equal(compared, 344); // 36 signs × 2 scripts × every stage event (picture, each form, regular, simplified)
});
