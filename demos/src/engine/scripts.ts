// Script generators and hand-authored scenes.
import type { Step } from './script';
import type { GlyphDoc } from '../glyphs';
import { PICTURES } from '../pictures';
import type { Tri } from '../i18n';
import { BY_CHAR } from '../data/chars';

const m = (en: string, zhs: string, zht: string): Tri => ({ en, zhs, zht });

/** Caption + narration (in the UI language), paced by the narrator or by reading time. */
const narr = (text: Tri): Step[] => [{ do: 'caption', text }, { do: 'say', text, lang: 'ui', wait: true }];

export interface EvoOptions {
  compact?: boolean; // lesson intro cards: quicker, fewer lines
}

/**
 * Evolution script for one character, generated from its glyph data:
 * picture → (rotate upright) → oracle drawn over the picture → bronze → seal → clerical → regular → simplified.
 */
export function evolutionScript(doc: GlyphDoc, opts: EvoOptions = {}): Step[] {
  const ch = doc.char;
  const info = BY_CHAR[ch];
  const pic = PICTURES[ch];
  const k = opts.compact ? 0.7 : 1;
  const A = 'hero';
  const steps: Step[] = [{ do: 'place', actor: A, at: [500, 320], size: 340 }];
  let hasGlyph = false;

  if (pic) {
    steps.push(
      { do: 'stage', stage: 'picture' },
      ...(opts.compact ? [] : narr(m('Long ago, people drew what they saw…', '很久很久以前，人们把看到的东西画下来……', '很久很久以前，人們把看到的東西畫下來……'))),
      { do: 'picture', actor: A, pic: ch },
      { do: 'wait', ms: 1100 * k },
    );
    if (pic.rotate) {
      steps.push(
        ...narr(m('To fit on narrow strips of bone, animals were stood up on end!', '为了写进窄窄的骨片，古人把动物竖起来写！', '為了寫進窄窄的骨片，古人把動物豎起來寫！')),
        { do: 'rotate', actor: A, deg: pic.rotate, ms: 1100 },
        { do: 'wait', ms: 600 * k },
      );
    }
  }

  if (doc.stages.length === 0) {
    steps.push(...narr(m('No ancient forms are known. This is a “young” character!', '没有古老的写法——这是一个“年轻”的字！', '沒有古老的寫法——這是一個「年輕」的字！')));
  }

  doc.stages.forEach((st, i) => {
    const index = doc.stages.slice(0, i).filter((x) => x.stage === st.stage).length;
    steps.push({ do: 'stage', stage: st.stage, variant: st.variant });
    if (i === 0 && st.stage === 'oracle' && !opts.compact) {
      steps.push(...narr(m('About 3,200 years ago, it was carved on turtle shells and bones like this:', '大约3200年前，它被刻在龟甲和兽骨上，是这样的：', '大約3200年前，它被刻在龜甲和獸骨上，是這樣的：')));
    }
    if (!hasGlyph) {
      steps.push({ do: 'draw', actor: A, glyph: { char: ch, stage: st.stage, index }, ms: 2100 * k });
      if (pic) steps.push({ do: 'clearPicture', actor: A, ms: 700 });
      hasGlyph = true;
    } else {
      steps.push({ do: 'swap', actor: A, glyph: { char: ch, stage: st.stage, index }, ms: 1500 * k });
    }
    steps.push({ do: 'wait', ms: 1000 * k });
  });

  steps.push({ do: 'stage', stage: 'regular' });
  if (hasGlyph) steps.push({ do: 'swap', actor: A, glyph: { char: ch, stage: 'regular' }, ms: 2600 * k });
  else {
    if (pic) steps.push({ do: 'clearPicture', actor: A, ms: 600 });
    steps.push({ do: 'draw', actor: A, glyph: { char: ch, stage: 'regular' }, ms: 2600 * k });
  }
  steps.push({ do: 'wait', ms: 900 * k });

  if (doc.trad !== doc.char) {
    steps.push(
      { do: 'stage', stage: 'simplified' },
      { do: 'caption', text: m(`In the 1950s, ${doc.trad} became ${doc.char}.`, `1950年代，“${doc.trad}”简化成了“${doc.char}”。`, `1950年代，「${doc.trad}」簡化成了「${doc.char}」。`) },
      { do: 'swap', actor: A, glyph: { char: ch, stage: 'simplified' }, ms: 1900 * k },
      { do: 'wait', ms: 900 * k },
    );
  }

  steps.push(
    { do: 'tag', actor: A, char: ch, hold: 600000, dx: 270, dy: 170 },
    { do: 'say', text: ch, lang: 'zh', wait: true },
  );
  if (info && !opts.compact) steps.push(...narr(info.fact));
  return steps;
}

// ---- Story chapters (Units 1–2), re-telling the opening of 《三十六个字》 with our own art ---------

const tagSay = (actor: string, char: string, dx = 0, dy = 0): Step => ({
  do: 'together', steps: [{ do: 'tag', actor, char, dx, dy }, { do: 'say', text: char, lang: 'zh' }],
});

export interface Chapter {
  title: Tri;
  unit: number;
  script: Step[];
}

const chapter1: Step[] = [
  { do: 'bg', tone: 'night', ms: 1 },
  ...narr(m('Long, long ago, before there were any books…', '很久很久以前，那时候还没有书……', '很久很久以前，那時候還沒有書……')),
  { do: 'place', actor: 'water', at: [500, 590], size: 100, back: true },
  { do: 'place', actor: 'mountain', at: [560, 380], size: 330 },
  { do: 'draw', actor: 'mountain', glyph: { char: '山', stage: 'oracle' }, ms: 1900 },
  { do: 'together', steps: [
    { do: 'wash', actor: 'mountain', color: '#6f9f8a', size: 400, opacity: 0.35, dy: 30 },
    { do: 'tag', actor: 'mountain', char: '山', dx: 240, dy: 120 },
    { do: 'say', text: '山', lang: 'zh' },
  ] },
  ...narr(m('Every morning, the sun climbed up over the mountains.', '每天早上，太阳从山后面升起来。', '每天早上，太陽從山後面升起來。')),
  { do: 'place', actor: 'sun', at: [330, 330], size: 120, back: true },
  { do: 'draw', actor: 'sun', glyph: { char: '日', stage: 'oracle' }, ms: 1200, color: '#b8321f' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'sun', color: '#e8453c', size: 150, opacity: 0.55 },
    { do: 'bg', tone: 'dawn', ms: 2600 },
    { do: 'move', actor: 'sun', to: [290, 115], ms: 3000, ease: 'cubic-bezier(.3,0,.3,1)' },
  ] },
  { do: 'together', steps: [tagSay('sun', '日', 120, 125), { do: 'bg', tone: 'paper', ms: 2200 }] },
  { do: 'ambient', actor: 'sun', motion: 'pulse' },
  ...narr(m('At the foot of the mountains, a river flowed.', '山脚下，一条小河哗哗地流。', '山腳下，一條小河嘩嘩地流。')),
  { do: 'place', actor: 'river', at: [500, 555], size: 150 },
  { do: 'draw', actor: 'river', glyph: { char: '水', stage: 'oracle' }, ms: 1400, color: '#1f5fa8' },
  tagSay('river', '水', 170, 90),
  { do: 'together', steps: [
    { do: 'rotate', actor: 'river', deg: 90, target: 'all', ms: 900 },
    { do: 'wash', actor: 'water', color: '#3d9be9', w: 1150, h: 120, opacity: 0.4, ms: 1400 },
    { do: 'place', actor: 'river2', at: [230, 560], size: 120 },
    { do: 'place', actor: 'river3', at: [770, 560], size: 120 },
  ] },
  { do: 'together', steps: [
    { do: 'show', actor: 'river2', glyph: { char: '水', stage: 'oracle' }, color: '#1f5fa8' },
    { do: 'show', actor: 'river3', glyph: { char: '水', stage: 'oracle' }, color: '#1f5fa8' },
    { do: 'rotate', actor: 'river2', deg: 90, target: 'all', ms: 1 },
    { do: 'rotate', actor: 'river3', deg: 90, target: 'all', ms: 1 },
  ] },
  { do: 'ambient', actor: 'river', motion: 'flow' },
  { do: 'ambient', actor: 'river2', motion: 'flow' },
  { do: 'ambient', actor: 'river3', motion: 'flow' },
  ...narr(m('By the river grew a tree…', '河边长着一棵树……', '河邊長著一棵樹……')),
  { do: 'place', actor: 'tree', at: [140, 370], size: 190 },
  { do: 'draw', actor: 'tree', glyph: { char: '木', stage: 'oracle' }, ms: 1400 },
  { do: 'together', steps: [{ do: 'wash', actor: 'tree', color: '#58b947', size: 210, opacity: 0.35, dy: -30 }, tagSay('tree', '木', 0, 0)] },
  { do: 'ambient', actor: 'tree', motion: 'sway' },
  ...narr(m('…then another, and another. Two trees together make a wood: 林!', '……一棵，又一棵。两棵树在一起，就是树林的“林”！', '……一棵，又一棵。兩棵樹在一起，就是樹林的「林」！')),
  { do: 'place', actor: 'wood', at: [850, 370], size: 230 },
  { do: 'draw', actor: 'wood', glyph: { char: '林', stage: 'oracle' }, ms: 1800 },
  { do: 'together', steps: [{ do: 'wash', actor: 'wood', color: '#58b947', size: 260, opacity: 0.35, dy: -30 }, tagSay('wood', '林', -40, 0)] },
  { do: 'ambient', actor: 'wood', motion: 'sway' },
  ...narr(m('A little bird woke up and flew across the sky.', '一只小鸟醒了，飞过天空。', '一隻小鳥醒了，飛過天空。')),
  { do: 'place', actor: 'bird', at: [120, 150], size: 100 },
  { do: 'draw', actor: 'bird', glyph: { char: '鸟', stage: 'oracle' }, ms: 1300 },
  tagSay('bird', '鸟', 110, 110),
  { do: 'move', actor: 'bird', to: [640, 95], ms: 2600, gait: 'fly' },
  { do: 'move', actor: 'bird', to: [848, 228], ms: 1300, gait: 'hop' },
  { do: 'ambient', actor: 'bird', motion: 'bob' },
  ...narr(m('Sun, mountain, water, tree, wood and bird: six pictures became six characters!', '太阳、高山、河水、树木、树林和小鸟：六幅画，变成了六个字！', '太陽、高山、河水、樹木、樹林和小鳥：六幅畫，變成了六個字！')),
  { do: 'wait', ms: 2500 },
];

const chapter2: Step[] = [
  ...narr(m('Past the woods there was a field…', '树林的另一边，是一片田地……', '樹林的另一邊，是一片田地……')),
  { do: 'place', actor: 'field', at: [745, 470], size: 190 },
  { do: 'draw', actor: 'field', glyph: { char: '田', stage: 'oracle' }, ms: 1500, color: '#6b4a1e' },
  { do: 'together', steps: [{ do: 'wash', actor: 'field', color: '#e3c66b', size: 270, opacity: 0.55 }, tagSay('field', '田', -160, 150)] },
  ...narr(m('…and soft green grass.', '……还有绿绿的小草。', '……還有綠綠的小草。')),
  { do: 'place', actor: 'grass1', at: [110, 555], size: 95 },
  { do: 'draw', actor: 'grass1', glyph: { char: '草', stage: 'seal', index: 0 }, ms: 1000, color: '#2f6f2a' },
  { do: 'together', steps: [
    { do: 'place', actor: 'grass2', at: [255, 565], size: 78 },
    { do: 'place', actor: 'grass3', at: [400, 555], size: 95 },
  ] },
  { do: 'together', steps: [
    { do: 'show', actor: 'grass2', glyph: { char: '草', stage: 'seal', index: 0 }, color: '#2f6f2a' },
    { do: 'show', actor: 'grass3', glyph: { char: '草', stage: 'seal', index: 0 }, color: '#2f6f2a' },
    { do: 'wash', actor: 'grass1', color: '#58b947', size: 120, opacity: 0.35 },
    { do: 'wash', actor: 'grass2', color: '#58b947', size: 100, opacity: 0.35 },
    { do: 'wash', actor: 'grass3', color: '#58b947', size: 120, opacity: 0.35 },
    tagSay('grass1', '草', 0, 10),
  ] },
  { do: 'ambient', actor: 'grass1', motion: 'sway' },
  { do: 'ambient', actor: 'grass2', motion: 'sway' },
  { do: 'ambient', actor: 'grass3', motion: 'sway' },
  ...narr(m('Tall bamboo swayed in the breeze.', '高高的竹子在风里摇摆。', '高高的竹子在風裡搖擺。')),
  { do: 'place', actor: 'bamboo', at: [905, 220], size: 180 },
  { do: 'draw', actor: 'bamboo', glyph: { char: '竹', stage: 'oracle' }, ms: 1400, color: '#2f6f2a' },
  { do: 'together', steps: [{ do: 'wash', actor: 'bamboo', color: '#6cbf4f', size: 220, opacity: 0.35 }, tagSay('bamboo', '竹', -150, 150)] },
  { do: 'ambient', actor: 'bamboo', motion: 'sway' },
  ...narr(m('Thump, thump, thump! A big elephant came by.', '咚、咚、咚！一头大象走了过来。', '咚、咚、咚！一頭大象走了過來。')),
  // Oracle script writes animals standing on their tails; in the story they get back on their feet to move.
  { do: 'place', actor: 'elephant', at: [1150, 330], size: 250 },
  { do: 'show', actor: 'elephant', glyph: { char: '象', stage: 'oracle' }, color: '#4a6fc0' },
  { do: 'rotate', actor: 'elephant', deg: -90, target: 'all', ms: 1 },
  { do: 'move', actor: 'elephant', to: [600, 320], ms: 3600, gait: 'walk', ease: 'ease-out' },
  tagSay('elephant', '象', 0, 40),
  { do: 'ambient', actor: 'elephant', motion: 'bob' },
  ...narr(m('Then a horse came trotting up…', '接着，一匹马跑了过来……', '接著，一匹馬跑了過來……')),
  { do: 'place', actor: 'horse', at: [300, 330], size: 220 },
  { do: 'draw', actor: 'horse', glyph: { char: '马', stage: 'oracle' }, ms: 1700, color: '#8a4b22' },
  tagSay('horse', '马', 0, 0),
  ...narr(m('In writing, the horse stands up tall. To run, it gets back on its four feet!', '写字的时候，马是竖着站的。要跑起来，就得四脚着地！', '寫字的時候，馬是豎著站的。要跑起來，就得四腳著地！')),
  { do: 'rotate', actor: 'horse', deg: -90, target: 'all', ms: 1000 },
  ...narr(m('Here comes a man with a hairpin in his hair. That is 夫!', '来了一个头上插着发簪的男人。这就是“夫”！', '來了一個頭上插著髮簪的男人。這就是「夫」！')),
  { do: 'place', actor: 'man', at: [100, 330], size: 165 },
  { do: 'draw', actor: 'man', glyph: { char: '夫', stage: 'oracle' }, ms: 1500 },
  tagSay('man', '夫', 0, 0),
  ...narr(m('He jumped onto his horse…', '他跳上了马……', '他跳上了馬……')),
  { do: 'together', steps: [
    { do: 'move', actor: 'man', to: [300, 228], ms: 900, gait: 'hop' },
    { do: 'scale', actor: 'man', to: 0.72, ms: 900 },
  ] },
  ...narr(m('…and off they galloped, clip-clop, clip-clop!', '……骑着马，嘚嘚嘚地跑远了！', '……騎著馬，嘚嘚嘚地跑遠了！')),
  { do: 'together', steps: [
    { do: 'move', actor: 'horse', to: [-220, 330], ms: 3600, gait: 'gallop', ease: 'ease-in' },
    { do: 'move', actor: 'man', to: [-220, 228], ms: 3600, gait: 'gallop', ease: 'ease-in' },
  ] },
  ...narr(m('Elephant, grass, field, bamboo, horse and man: six more characters!', '大象、小草、田地、竹子、马和夫：又是六个字！', '大象、小草、田地、竹子、馬和夫：又是六個字！')),
  { do: 'wait', ms: 2500 },
];

export const CHAPTERS: Chapter[] = [
  { unit: 1, title: m('Morning in the Mountains', '山林的早晨', '山林的早晨'), script: chapter1 },
  { unit: 2, title: m('The Horse Rider', '骑马的人', '騎馬的人'), script: chapter2 },
];

/** Narration off: keep the caption pacing (reading time) but don't speak; character pronunciations stay. */
export function withoutNarration(script: Step[]): Step[] {
  return script.map((st): Step => {
    if (st.do === 'say' && st.lang === 'ui') return { ...st, silent: true };
    if (st.do === 'together') return { ...st, steps: withoutNarration(st.steps) };
    return st;
  });
}
