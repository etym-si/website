import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leftovers } from '../../tools/compile/template.ts';
import { matchCatalogue, namesNote, resolveSignCards } from '../../tools/compile/cards.ts';
import { signTimeline } from '../../tools/compile/timeline.ts';
import { realContent } from '../helpers/content.ts';

const content = realContent();
const han = content.systems.get('han')!;
const url = (id: string) => `data/photos/${id}.jpg`;
const cards = (ch: string) => { const s = han.signs.get(ch)!; return resolveSignCards(content, han, s, url, signTimeline(han, s)); };

test('aliases name a note by prefix or by whole token', () => {
  assert.ok(namesNote('大盂鼎', '大盂鼎 (early Western Zhou); taken from 雩'));
  assert.ok(namesNote('合6057', '菁1.1 合6057 賓組'));
  assert.ok(!namesNote('合6057', '合60571'));
});

test('rule order picks the honest card kind', () => {
  const kind = (ch: string, stage: string, i = 0) => cards(ch)[stage]?.[i]?.kind;
  assert.equal(kind('田', 'oracle'), 'exact');      // traced from Heji 6057 (artifact alias)
  assert.equal(kind('日', 'oracle'), 'appears');    // circled on the Zheng scapula (occurrence)
  assert.equal(kind('刀', 'oracle'), 'example');    // Heji 22474 (catalogue source, no photo of it)
  assert.equal(kind('子', 'oracle'), 'example');    // other catalogue note (stage example with when.note)
  assert.equal(kind('雨', 'bronze'), 'exact');      // Da Yu ding
  assert.equal(kind('马', 'bronze'), 'appears');    // circled on the Da Yu rubbing, traced from 彔伯
  assert.equal(kind('日', 'bronze'), 'example');    // Shi Hu gui (vessel entry)
  assert.equal(kind('水', 'clerical'), 'book');     // Shuihudi “Eighteen Qin Statutes” has its own photo
  assert.equal(kind('田', 'clerical'), 'example');  // Shuihudi document without its own photo
  assert.equal(kind('草', 'seal', 1), 'book');      // Shuowen, second seal form
  assert.equal(kind('鸟', 'regular'), 'book');      // Thousand Character Classic line
  assert.equal(kind('舍', 'regular'), 'appears');   // circled on Zhiyong's page
  assert.equal(kind('马', 'regular'), 'example');
  assert.equal(cards('马').picture, undefined);
  assert.equal(cards('马').simplified, undefined);
});

test('cards carry the vessel name into the traced-from sentence and keep {shown} for the reader’s script', () => {
  assert.match(cards('马').bronze[0]!.text.en, /^Our 马 glyph was traced from the lid of Lord Lu’s gui \(彔伯\)\. You can also spot 马/);
  assert.match(cards('鸟').regular[0]!.text['zh-Hant'], /^「\{shown\}」是《千字文》/);
});

test('no placeholder is ever left in a compiled card', () => {
  for (const s of han.signs.values()) {
    for (const list of Object.values(resolveSignCards(content, han, s, url, signTimeline(han, s)))) {
      for (const c of list) {
        if (!c) continue;
        const markTexts = c.marks?.flatMap((m) => (m.label ? Object.values(m.label) : [])) ?? [];
        for (const t of [...Object.values(c.title), ...Object.values(c.text), ...markTexts]) {
          assert.deepEqual(leftovers(t), [], `${s.key}: ${t}`);
        }
      }
    }
  }
});

test('two catalogues matching one note is an error; literal overrides win', () => {
  const heji = content.sources.get('heji')!;
  content.sources.set('heji-copy', { ...heji, data: { ...heji.data, id: 'heji-copy' } });
  try {
    assert.throws(() => matchCatalogue(content, 'han.oracle', '甲3085 合22474 子組'), /matches more than one han\.oracle source: heji, heji-copy/);
  } finally {
    content.sources.delete('heji-copy');
  }
  const 马 = han.signs.get('马')!;
  const saved = 马.data.cards;
  马.data.cards = { regular: { kind: 'book', artifact: 'zhiyong', title: { en: 'T' }, text: { en: 'Override for {sign}' } } };
  try {
    assert.equal(resolveSignCards(content, han, 马, url, ['regular']).regular[0]!.text['zh-Hant'], 'Override for 马');
  } finally {
    马.data.cards = saved;
  }
});
