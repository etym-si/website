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

      // Parity on structure: produced (stage, index) entries vs golden events
      const goldenNonEmpty = scripts[script].filter((ev) => ev.card !== null);
      const goldenKeys = goldenNonEmpty.map((ev) => `${ev.stage}#${ev.index}`).sort();
      const producedKeys = Object.entries(cards).flatMap(([stage, list]) =>
        list.map((c, index) => (c !== null ? `${stage}#${index}` : null)).filter((k): k is string => k !== null)
      ).sort();
      assert.deepEqual(producedKeys, goldenKeys, `${ch} ${script} (stage, index) entries mismatch`);

      for (const [stage, list] of Object.entries(cards)) {
        const goldenEventsForStage = scripts[script].filter((ev) => ev.stage === stage);
        assert.ok(goldenEventsForStage.length > 0, `${ch} ${script} unexpected stage ${stage} in compiled cards`);
        assert.equal(list.length, goldenEventsForStage.length, `${ch} ${script} ${stage} count mismatch`);
        list.forEach((c, i) => {
          if (c !== null && goldenEventsForStage[i]?.card === null) {
            assert.fail(`${ch} ${script} ${stage}#${i} produced unexpected non-null card`);
          }
        });
      }

      for (const ev of scripts[script]) {
        assert.deepEqual(compiledCard(cards[ev.stage]?.[ev.index], shown), legacyCard(ev.card), `${ch} ${script} ${ev.stage}#${ev.index}`);
        compared++;
      }
    }
  }
  assert.equal(compared, 344); // 36 signs × 2 scripts × every stage event (picture, each form, regular, simplified)
});
