// Script generators and hand-authored story chapters.
// Each character evolution and each story chapter has its own topic and storyline
// (never starting with generic "Long, long ago..." templates).
import type { Step } from './script';
import type { GlyphDoc } from '../glyphs';
import { PICTURES } from '../pictures';
import type { Tri } from '../i18n';
import { BY_CHAR } from '../data/chars';
import { CHAR_STORIES } from '../data/char-stories';

const m = (en: string, zhs: string, zht: string): Tri => ({ en, zhs, zht });

/** Caption + narration (in the UI language), paced by the narrator or by reading time. */
const narr = (text: Tri): Step[] => [{ do: 'caption', text }, { do: 'say', text, lang: 'ui', wait: true }];

export interface EvoOptions {
  compact?: boolean; // lesson intro cards: quicker, fewer lines
}

/**
 * Evolution script for one character, generated from its glyph data + its custom storyline in CHAR_STORIES:
 * picture → (rotate upright) → oracle drawn over the picture → bronze → seal → clerical → regular → simplified.
 */
export function evolutionScript(doc: GlyphDoc, opts: EvoOptions = {}): Step[] {
  const ch = doc.char;
  const info = BY_CHAR[ch];
  const story = CHAR_STORIES[ch];
  const pic = PICTURES[ch];
  const k = opts.compact ? 0.7 : 1;
  const A = 'hero';
  const steps: Step[] = [{ do: 'place', actor: A, at: [500, 320], size: 340 }];
  let hasGlyph = false;

  if (pic) {
    steps.push(
      { do: 'stage', stage: 'picture' },
      ...(opts.compact || !story ? [] : narr(story.hook)),
      { do: 'picture', actor: A, pic: ch },
      { do: 'wait', ms: 1000 * k },
    );
    if (pic.rotate) {
      steps.push(
        ...(story?.rotate ? narr(story.rotate) : []),
        { do: 'rotate', actor: A, deg: pic.rotate, ms: 1100 },
        { do: 'wait', ms: 600 * k },
      );
    }
  }

  // Pick one middle stage (prefer seal, else clerical or bronze) to deliver `story.turn`.
  const turnIdx = doc.stages.findIndex((s, i) => i > 0 && (s.stage === 'seal' || s.stage === 'clerical' || i === doc.stages.length - 1));

  doc.stages.forEach((st, i) => {
    const index = doc.stages.slice(0, i).filter((x) => x.stage === st.stage).length;
    steps.push({ do: 'stage', stage: st.stage, variant: st.variant });
    if (i === 0 && !opts.compact && story) {
      const firstLine = pic ? story.early : story.hook;
      if (firstLine) steps.push(...narr(firstLine));
    } else if (i === turnIdx && !opts.compact && story?.turn) {
      steps.push(...narr(story.turn));
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
  if (doc.stages.length === 0 && !pic && !opts.compact && story) {
    steps.push(...narr(story.hook));
  }
  if (hasGlyph) steps.push({ do: 'swap', actor: A, glyph: { char: ch, stage: 'regular' }, ms: 2600 * k });
  else {
    if (pic) steps.push({ do: 'clearPicture', actor: A, ms: 600 });
    steps.push({ do: 'draw', actor: A, glyph: { char: ch, stage: 'regular' }, ms: 2600 * k });
  }
  steps.push({ do: 'wait', ms: 900 * k });

  if (doc.trad !== doc.char) {
    const simpLine = m(
      `In modern simplified writing, ${doc.trad} is written ${doc.char}.`,
      `在现代简化字里，“${doc.trad}”写作“${doc.char}”。`,
      `在現代簡化字裡，「${doc.trad}」寫作「${doc.char}」。`,
    );
    steps.push(
      { do: 'stage', stage: 'simplified' },
      ...(opts.compact ? [{ do: 'caption' as const, text: simpLine }] : narr(simpLine)),
      { do: 'swap', actor: A, glyph: { char: ch, stage: 'simplified' }, ms: 1900 * k },
      { do: 'wait', ms: 900 * k },
    );
  }

  steps.push(
    { do: 'tag', actor: A, char: ch, hold: 600000, dx: 270, dy: 170 },
    { do: 'say', text: ch, lang: 'zh', wait: true },
  );
  if (!opts.compact) {
    const endLine = story?.closer ?? info?.fact;
    if (endLine) steps.push(...narr(endLine));
  }
  return steps;
}

// ---- Six story chapters (Units 1–6), each with its own topic & storyline -----------------------

const tagSay = (actor: string, char: string, dx = 0, dy = 0): Step => ({
  do: 'together', steps: [{ do: 'tag', actor, char, dx, dy }, { do: 'say', text: char, lang: 'zh' }],
});

export interface Chapter {
  title: Tri;
  topic: Tri;
  unit: number;
  script: Step[];
}

// Chapter 1 (Unit 1): Sunrise in the Valley — nature waking up at dawn
const chapter1: Step[] = [
  { do: 'bg', tone: 'night', ms: 1 },
  ...narr(m(
    'Shh… the mountain valley is still fast asleep under the stars. Three quiet peaks stand against the night sky: 山.',
    '嘘……星空下的山谷还在熟睡。三座安静的山峰立在夜空下，这就是“山”。',
    '噓……星空下的山谷還在熟睡。三座安靜的山峰立在夜空下，這就是「山」。',
  )),
  { do: 'place', actor: 'water', at: [500, 590], size: 100, back: true },
  { do: 'place', actor: 'mountain', at: [560, 380], size: 330 },
  { do: 'draw', actor: 'mountain', glyph: { char: '山', stage: 'oracle' }, ms: 1900 },
  { do: 'together', steps: [
    { do: 'wash', actor: 'mountain', color: '#6f9f8a', size: 400, opacity: 0.35, dy: 30 },
    { do: 'tag', actor: 'mountain', char: '山', dx: 240, dy: 120 },
    { do: 'say', text: '山', lang: 'zh' },
  ] },
  ...narr(m(
    'Look! Behind the eastern ridge, a warm red sun begins to climb: 日!',
    '看呀！东边的山脊后面，一轮红彤彤的太阳慢慢爬了上来：“日”！',
    '看呀！東邊的山脊後面，一輪紅彤彤的太陽慢慢爬了上來：「日」！',
  )),
  { do: 'place', actor: 'sun', at: [330, 330], size: 120, back: true },
  { do: 'draw', actor: 'sun', glyph: { char: '日', stage: 'oracle' }, ms: 1200, color: '#b8321f' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'sun', color: '#e8453c', size: 150, opacity: 0.55 },
    { do: 'bg', tone: 'dawn', ms: 2600 },
    { do: 'move', actor: 'sun', to: [290, 115], ms: 3000, ease: 'cubic-bezier(.3,0,.3,1)' },
  ] },
  { do: 'together', steps: [tagSay('sun', '日', 120, 125), { do: 'bg', tone: 'paper', ms: 2200 }] },
  { do: 'ambient', actor: 'sun', motion: 'pulse' },
  ...narr(m(
    'Warm sunlight melts the mountain snow, and a clear stream rushes down the valley: 水!',
    '温暖的阳光融化了山顶的积雪，清澈的溪水顺着山谷哗哗流淌：“水”！',
    '溫暖的陽光融化了山頂的積雪，清澈的溪水順著山谷嘩嘩流淌：「水」！',
  )),
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
  ...narr(m(
    'The cool river water gives a drink to a young tree on the bank: 木.',
    '甘甜的河水滋润着岸边的一棵小树：“木”。',
    '甘甜的河水滋潤著岸邊的一棵小樹：「木」。',
  )),
  { do: 'place', actor: 'tree', at: [140, 370], size: 190 },
  { do: 'draw', actor: 'tree', glyph: { char: '木', stage: 'oracle' }, ms: 1400 },
  { do: 'together', steps: [{ do: 'wash', actor: 'tree', color: '#58b947', size: 210, opacity: 0.35, dy: -30 }, tagSay('tree', '木', 0, 0)] },
  { do: 'ambient', actor: 'tree', motion: 'sway' },
  ...narr(m(
    'Across the stream, trees grow side by side into a shady green grove: 林!',
    '溪水对岸，一棵树挨着一棵树，长成了绿荫浓密的树林：“林”！',
    '溪水對岸，一棵樹挨著一棵樹，長成了綠蔭濃密的樹林：「林」！',
  )),
  { do: 'place', actor: 'wood', at: [850, 370], size: 230 },
  { do: 'draw', actor: 'wood', glyph: { char: '林', stage: 'oracle' }, ms: 1800 },
  { do: 'together', steps: [{ do: 'wash', actor: 'wood', color: '#58b947', size: 260, opacity: 0.35, dy: -30 }, tagSay('wood', '林', -40, 0)] },
  { do: 'ambient', actor: 'wood', motion: 'sway' },
  ...narr(m(
    'Woken by the morning light, a little songbird — 鸟 — darts from the single tree to build its nest in the woods!',
    '晨光叫醒了一只小鸟——“鸟”，它扇动翅膀，从独木飞向热闹的树林筑巢啦！',
    '晨光叫醒了一隻小鳥——「鳥」，牠扇動翅膀，從獨木飛向熱鬧的樹林築巢啦！',
  )),
  { do: 'place', actor: 'bird', at: [120, 150], size: 100 },
  { do: 'draw', actor: 'bird', glyph: { char: '鸟', stage: 'oracle' }, ms: 1300 },
  tagSay('bird', '鸟', 110, 110),
  { do: 'move', actor: 'bird', to: [640, 95], ms: 2600, gait: 'fly' },
  { do: 'move', actor: 'bird', to: [848, 228], ms: 1300, gait: 'hop' },
  { do: 'ambient', actor: 'bird', motion: 'bob' },
  ...narr(m(
    'What a bright morning! The valley is wide awake, and our bird has found its new home.',
    '多么明朗的早晨！山谷彻底醒来了，小鸟也在树林里安下了家。',
    '多麼明朗的早晨！山谷徹底醒來了，小鳥也在樹林裡安下了家。',
  )),
  { do: 'wait', ms: 2200 },
];

// Chapter 2 (Unit 2): Galloping Across the Meadow — a lively ride across the countryside
const chapter2: Step[] = [
  ...narr(m(
    'Follow the footpath out of the woods, and neat square farm plots open up before us: 田!',
    '顺着小路走出树林，眼前豁然开朗，是一块块方方正正的农田：“田”！',
    '順著小路走出樹林，眼前豁然開朗，是一塊塊方方正正的農田：「田」！',
  )),
  { do: 'place', actor: 'field', at: [745, 470], size: 190 },
  { do: 'draw', actor: 'field', glyph: { char: '田', stage: 'oracle' }, ms: 1500, color: '#6b4a1e' },
  { do: 'together', steps: [{ do: 'wash', actor: 'field', color: '#e3c66b', size: 270, opacity: 0.55 }, tagSay('field', '田', -160, 150)] },
  ...narr(m(
    'Along the border of the fields, tender green shoots of 草 carpet the meadow.',
    '田埂边上，嫩绿的小草芽铺满了草地，这就是“草”。',
    '田埂邊上，嫩綠的小草芽鋪滿了草地，這就是「草」。',
  )),
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
  ...narr(m(
    'By the corner of the field, slender stalks of 竹 rustle their drooping leaves in the breeze.',
    '田角边，几竿修长的竹子随风摇曳，竹叶轻轻垂下，这就是“竹”。',
    '田角邊，幾竿修長的竹子隨風搖曳，竹葉輕輕垂下，這就是「竹」。',
  )),
  { do: 'place', actor: 'bamboo', at: [905, 220], size: 180 },
  { do: 'draw', actor: 'bamboo', glyph: { char: '竹', stage: 'oracle' }, ms: 1400, color: '#2f6f2a' },
  { do: 'together', steps: [{ do: 'wash', actor: 'bamboo', color: '#6cbf4f', size: 220, opacity: 0.35 }, tagSay('bamboo', '竹', -150, 150)] },
  { do: 'ambient', actor: 'bamboo', motion: 'sway' },
  ...narr(m(
    'Thump, thump! Attracted by the sweet bamboo leaves, a friendly elephant — 象 — lumbers into the clearing.',
    '咚、咚！闻到清香的竹叶味，一头温顺的大象——“象”，迈着大步走进了空地。',
    '咚、咚！聞到清香的竹葉味，一頭溫順的大象——「象」，邁著大步走進了空地。',
  )),
  { do: 'place', actor: 'elephant', at: [1150, 330], size: 250 },
  { do: 'show', actor: 'elephant', glyph: { char: '象', stage: 'oracle' }, color: '#4a6fc0' },
  { do: 'rotate', actor: 'elephant', deg: -90, target: 'all', ms: 1 },
  { do: 'move', actor: 'elephant', to: [600, 320], ms: 3600, gait: 'walk', ease: 'ease-out' },
  tagSay('elephant', '象', 0, 40),
  { do: 'ambient', actor: 'elephant', motion: 'bob' },
  ...narr(m(
    'Neigh! A spirited brown horse — 马 — wants to race across the grass!',
    '咴咴——！一匹神气活现的骏马——“马”，想在草地上赛跑啦！',
    '咴咴——！一匹神氣活現的駿馬——「馬」，想在草地上賽跑啦！',
  )),
  { do: 'place', actor: 'horse', at: [300, 330], size: 220 },
  { do: 'draw', actor: 'horse', glyph: { char: '马', stage: 'oracle' }, ms: 1700, color: '#8a4b22' },
  tagSay('horse', '马', 0, 0),
  ...narr(m(
    'In oracle bone writing, the horse stands upright. To run, it drops onto all four hooves!',
    '在甲骨文里，马是竖着站的；要奔跑起来，它就四蹄落地！',
    '在甲骨文裡，馬是豎著站的；要奔跑起來，牠就四蹄落地！',
  )),
  { do: 'rotate', actor: 'horse', deg: -90, target: 'all', ms: 1000 },
  ...narr(m(
    'Out steps a grown man with a hairpin in his topknot: 夫!',
    '走来一位头顶束发插簪的大人：“夫”！',
    '走來一位頭頂束髮插簪的大人：「夫」！',
  )),
  { do: 'place', actor: 'man', at: [100, 330], size: 165 },
  { do: 'draw', actor: 'man', glyph: { char: '夫', stage: 'oracle' }, ms: 1500 },
  tagSay('man', '夫', 0, 0),
  ...narr(m(
    'With one nimble leap, he hops onto the horse’s back…',
    '他身手敏捷地一跃，跳上了马背……',
    '他身手敏捷地一躍，跳上了馬背……',
  )),
  { do: 'together', steps: [
    { do: 'move', actor: 'man', to: [300, 228], ms: 900, gait: 'hop' },
    { do: 'scale', actor: 'man', to: 0.72, ms: 900 },
  ] },
  ...narr(m(
    '…and away they gallop toward the river, hooves drumming clip-clop, clip-clop!',
    '……一人一马朝着大河的方向，哒哒哒地飞奔而去！',
    '……一人一馬朝著大河的方向，噠噠噠地飛奔而去！',
  )),
  { do: 'together', steps: [
    { do: 'move', actor: 'horse', to: [-220, 330], ms: 3600, gait: 'gallop', ease: 'ease-in' },
    { do: 'move', actor: 'man', to: [-220, 228], ms: 3600, gait: 'gallop', ease: 'ease-in' },
  ] },
  { do: 'wait', ms: 2000 },
];

// Chapter 3 (Unit 3): Casting the Net — a fishing trip on the river
const chapter3: Step[] = [
  ...narr(m(
    'Out on the wide river, a curling white cloud — 云 — drifts lazily across the blue sky.',
    '宽阔的大河上空，一朵卷曲的白云——“云”，慢悠悠地飘过蓝天。',
    '寬闊的大河上空，一朵捲曲的白雲——「雲」，慢悠悠地飄過藍天。',
  )),
  { do: 'place', actor: 'cloud', at: [240, 120], size: 150 },
  { do: 'draw', actor: 'cloud', glyph: { char: '云', stage: 'oracle' }, ms: 1400, color: '#3b6ea5' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'cloud', color: '#a8d5ff', size: 210, opacity: 0.45 },
    tagSay('cloud', '云', 120, 90),
  ] },
  { do: 'ambient', actor: 'cloud', motion: 'bob' },
  ...narr(m(
    'Swoosh! A fork-tailed swallow — 燕 — skims low over the water, chasing dragonflies.',
    '嗖！一只剪刀尾巴的小燕子——“燕”，贴着水面轻快地掠过。',
    '嗖！一隻剪刀尾巴的小燕子——「燕」，貼著水面輕快地掠過。',
  )),
  { do: 'place', actor: 'swallow', at: [820, 150], size: 150 },
  { do: 'draw', actor: 'swallow', glyph: { char: '燕', stage: 'oracle' }, ms: 1500 },
  tagSay('swallow', '燕', -130, 100),
  { do: 'move', actor: 'swallow', to: [520, 125], ms: 2200, gait: 'fly' },
  { do: 'ambient', actor: 'swallow', motion: 'bob' },
  ...narr(m(
    'On the riverbank, a fisherman uses a curved bronze knife — 刀 — to trim his hemp rope.',
    '河岸边，渔夫拿起一把弯弯的青铜小刀——“刀”，利落地割好麻绳。',
    '河岸邊，漁夫拿起一把彎彎的青銅小刀——「刀」，利落地割好麻繩。',
  )),
  { do: 'place', actor: 'knife', at: [140, 390], size: 150 },
  { do: 'draw', actor: 'knife', glyph: { char: '刀', stage: 'oracle' }, ms: 1300, color: '#5a4632' },
  tagSay('knife', '刀', 110, 90),
  ...narr(m(
    'He unties his wooden boat — 舟 — and glides out onto the sparkling river.',
    '他解开木板拼成的小船——“舟”，轻轻划向波光粼粼的河心。',
    '他解開木板拼成的小船——「舟」，輕輕划向波光粼粼的河心。',
  )),
  { do: 'place', actor: 'boat', at: [280, 480], size: 190 },
  { do: 'draw', actor: 'boat', glyph: { char: '舟', stage: 'oracle' }, ms: 1500, color: '#6b4a1e' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'boat', color: '#3d9be9', w: 900, h: 130, opacity: 0.32, dy: 65, ms: 1200 },
    tagSay('boat', '舟', 140, 80),
  ] },
  { do: 'rotate', actor: 'boat', deg: 90, target: 'all', ms: 900 },
  { do: 'move', actor: 'boat', to: [470, 490], ms: 2200, ease: 'ease-out' },
  { do: 'ambient', actor: 'boat', motion: 'flow' },
  ...narr(m(
    'Splash! Up from the waves leaps a plump silver fish: 鱼!',
    '哗啦！水波里跃起一条肥美的银鱼：“鱼”！',
    '嘩啦！水波裡躍起一條肥美的銀魚：「魚」！',
  )),
  { do: 'place', actor: 'fish', at: [790, 500], size: 165 },
  { do: 'draw', actor: 'fish', glyph: { char: '鱼', stage: 'oracle' }, ms: 1500, color: '#1f5fa8' },
  tagSay('fish', '鱼', -130, 90),
  { do: 'ambient', actor: 'fish', motion: 'bob' },
  ...narr(m(
    'With a wide swing, the fisherman casts his woven net — 网 — right over the water!',
    '渔夫用力一撒，绳结交错的渔网——“网”，稳稳地罩向水面！',
    '漁夫用力一撒，繩結交錯的漁網——「網」，穩穩地罩向水面！',
  )),
  { do: 'place', actor: 'net', at: [640, 340], size: 185 },
  { do: 'draw', actor: 'net', glyph: { char: '网', stage: 'oracle' }, ms: 1500 },
  tagSay('net', '网', -140, -90),
  { do: 'move', actor: 'net', to: [785, 485], ms: 1600, ease: 'ease-in-out' },
  ...narr(m(
    'Dinner is caught! Time to row back to shore before those clouds turn dark.',
    '捕到鱼啦！趁着天上的云还没变黑，快划船靠岸吧。',
    '捕到魚啦！趁著天上的雲還沒變黑，快划船靠岸吧。',
  )),
  { do: 'wait', ms: 2000 },
];

// Chapter 4 (Unit 4): Shelter Under the Cliff — keeping warm in a sudden rainstorm
const chapter4: Step[] = [
  { do: 'bg', tone: 'dawn', ms: 800 },
  ...narr(m(
    'Rumble… Pitter-patter! The sky darkens and heavy raindrops begin to fall: 雨!',
    '轰隆隆……淅淅沥沥！天空暗了下来，豆大的雨点落了下来：“雨”！',
    '轟隆隆……淅淅瀝瀝！天空暗了下來，豆大的雨點落了下來：「雨」！',
  )),
  { do: 'place', actor: 'rain', at: [300, 145], size: 190 },
  { do: 'draw', actor: 'rain', glyph: { char: '雨', stage: 'oracle' }, ms: 1500, color: '#1f5fa8' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'rain', color: '#4a90e2', size: 250, opacity: 0.38 },
    tagSay('rain', '雨', 140, 95),
  ] },
  ...narr(m(
    'Quick — pop open a round umbrella to keep the raindrops off our heads: 伞!',
    '快——啪地撑开一把圆雨伞，挡住漫天雨滴：“伞”！',
    '快——啪地撐開一把圓雨傘，擋住漫天雨滴：「傘」！',
  )),
  { do: 'place', actor: 'umbrella', at: [250, 390], size: 175 },
  { do: 'draw', actor: 'umbrella', glyph: { char: '伞', stage: 'regular' }, ms: 1600, color: '#b8321f' },
  tagSay('umbrella', '伞', 130, 80),
  ...narr(m(
    'Look ahead: an overhanging rock cliff with a boulder at its foot — 石 — makes a dry cave!',
    '看前面：突出的山崖下立着大石头——“石”，正好是个避雨的山洞！',
    '看前面：突出的山崖下立著大石頭——「石」，正好是個避雨的山洞！',
  )),
  { do: 'place', actor: 'stone', at: [770, 350], size: 240 },
  { do: 'draw', actor: 'stone', glyph: { char: '石', stage: 'oracle' }, ms: 1500, color: '#5a524c' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'stone', color: '#8c8275', size: 280, opacity: 0.35 },
    tagSay('stone', '石', -160, 100),
  ] },
  ...narr(m(
    'Under the dry cliff, we light dry twigs into a crackling campfire: 火!',
    '在干燥的山崖下，我们拢起枯枝，点起噼啪作响的篝火：“火”！',
    '在乾燥的山崖下，我們攏起枯枝，點起噼啪作響的篝火：「火」！',
  )),
  { do: 'place', actor: 'fire', at: [530, 490], size: 170 },
  { do: 'draw', actor: 'fire', glyph: { char: '火', stage: 'oracle' }, ms: 1400, color: '#d9381e' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'fire', color: '#ff7b29', size: 220, opacity: 0.5 },
    tagSay('fire', '火', 130, 80),
  ] },
  { do: 'ambient', actor: 'fire', motion: 'pulse' },
  ...narr(m(
    'Drawn by the cozy warmth, a little turtle — 龟 — pokes its head out beside the fire.',
    '暖融融的火光，吸引了一只背着硬壳的小乌龟——“龟”，慢吞吞地爬来烤火。',
    '暖融融的火光，吸引了一隻背著硬殼的小烏龜——「龜」，慢吞吞地爬來烤火。',
  )),
  { do: 'place', actor: 'turtle', at: [380, 540], size: 150 },
  { do: 'draw', actor: 'turtle', glyph: { char: '龟', stage: 'oracle' }, ms: 1600, color: '#2f6f2a' },
  tagSay('turtle', '龟', -120, 70),
  { do: 'ambient', actor: 'turtle', motion: 'bob' },
  ...narr(m(
    'And stepping softly out of the rain comes a gentle deer with branching antlers: 鹿!',
    '还有一头顶着分叉大角的梅花鹿——“鹿”，也轻巧地走进山崖下躲雨啦！',
    '還有一頭頂著分叉大角的梅花鹿——「鹿」，也輕巧地走進山崖下躲雨啦！',
  )),
  { do: 'place', actor: 'deer', at: [980, 490], size: 195 },
  { do: 'draw', actor: 'deer', glyph: { char: '鹿', stage: 'oracle' }, ms: 1600, color: '#8a4b22' },
  { do: 'rotate', actor: 'deer', deg: -90, target: 'all', ms: 800 },
  { do: 'move', actor: 'deer', to: [720, 500], ms: 2000, gait: 'walk' },
  tagSay('deer', '鹿', 120, 70),
  ...narr(m(
    'Outside the rain patters on, while inside the rocky shelter everyone is dry and warm.',
    '洞外雨声淅沥，山崖下火光融融，大家都暖洋洋的。',
    '洞外雨聲淅瀝，山崖下火光融融，大家都暖洋洋的。',
  )),
  { do: 'wait', ms: 2000 },
];

// Chapter 5 (Unit 5): Grandpa Chases the Tiger — protecting the mountain hut
const chapter5: Step[] = [
  { do: 'bg', tone: 'paper', ms: 500 },
  ...narr(m(
    'After the rain clears, we reach a cozy thatched cottage at the foot of the hill: 舍.',
    '雨过天晴，我们来到山脚下一座尖顶的小屋前：“舍”。',
    '雨過天晴，我們來到山腳下一座尖頂的小屋前：「舍」。',
  )),
  { do: 'place', actor: 'hut', at: [220, 340], size: 230 },
  { do: 'draw', actor: 'hut', glyph: { char: '舍', stage: 'bronze' }, ms: 1600, color: '#6b4a1e' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'hut', color: '#e3c66b', size: 260, opacity: 0.4 },
    tagSay('hut', '舍', -150, 90),
  ] },
  ...narr(m(
    'In the yard beside the cottage, a plump little pig — 豕 — sniffs for acorns…',
    '小屋旁的院子里，一头圆肚子的小猪——“豕”，正哼哼唧唧地找橡子吃……',
    '小屋旁的院子裡，一頭圓肚子的小豬——「豕」，正哼哼唧唧地找橡子吃……',
  )),
  { do: 'place', actor: 'pig', at: [440, 490], size: 155 },
  { do: 'draw', actor: 'pig', glyph: { char: '豕', stage: 'oracle' }, ms: 1400, color: '#8a4b22' },
  tagSay('pig', '豕', 0, 90),
  { do: 'ambient', actor: 'pig', motion: 'bob' },
  ...narr(m(
    '…while a gentle sheep with curly horns — 羊 — nibbles the fresh grass.',
    '……还有一只长着弯弯羊角的小羊——“羊”，正低头吃着鲜嫩的青草。',
    '……還有一隻長著彎彎羊角的小羊——「羊」，正低頭吃著鮮嫩的青草。',
  )),
  { do: 'place', actor: 'sheep', at: [610, 470], size: 160 },
  { do: 'draw', actor: 'sheep', glyph: { char: '羊', stage: 'oracle' }, ms: 1400 },
  tagSay('sheep', '羊', 110, 85),
  { do: 'ambient', actor: 'sheep', motion: 'sway' },
  ...narr(m(
    'Suddenly — ROAAAR! A fierce striped tiger — 虎 — creeps out of the forest toward the sheep!',
    '突然——嗷呜！一只张着大嘴的斑斓猛虎——“虎”，从林子里扑向小羊！',
    '突然——嗷嗚！一隻張著大嘴的斑斕猛虎——「虎」，從林子裡撲向小羊！',
  )),
  { do: 'place', actor: 'tiger', at: [920, 360], size: 220 },
  { do: 'draw', actor: 'tiger', glyph: { char: '虎', stage: 'oracle' }, ms: 1600, color: '#c85a17' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'tiger', color: '#f08a24', size: 250, opacity: 0.4 },
    tagSay('tiger', '虎', -140, -100),
  ] },
  { do: 'rotate', actor: 'tiger', deg: -90, target: 'all', ms: 800 },
  { do: 'move', actor: 'tiger', to: [780, 390], ms: 1400, gait: 'walk' },
  ...narr(m(
    'Out from the cottage steps a brave old grandfather — 叟 — holding a curved wooden bow: 弓!',
    '小屋里大步走出一位勇敢的老爷爷——“叟”，手里举着一张弯弯的木弓：“弓”！',
    '小屋裡大步走出一位勇敢的老爺爺——「叟」，手裡舉著一張彎彎的木弓：「弓」！',
  )),
  { do: 'place', actor: 'elder', at: [290, 260], size: 155 },
  { do: 'draw', actor: 'elder', glyph: { char: '叟', stage: 'regular' }, ms: 1500 },
  tagSay('elder', '叟', -120, -80),
  { do: 'place', actor: 'bow', at: [420, 255], size: 150 },
  { do: 'draw', actor: 'bow', glyph: { char: '弓', stage: 'oracle' }, ms: 1300, color: '#6b4a1e' },
  tagSay('bow', '弓', 110, -80),
  ...narr(m(
    'Twang! He snaps the bowstring, and the startled tiger bounds right back into the mountains!',
    '嘣！老爷爷拉响弓弦，吓得大老虎掉头逃回了深山！',
    '嘣！老爺爺拉響弓弦，嚇得大老虎掉頭逃回了深山！',
  )),
  { do: 'rotate', actor: 'tiger', deg: 90, target: 'all', ms: 500 },
  { do: 'move', actor: 'tiger', to: [1180, 320], ms: 2000, gait: 'gallop', ease: 'ease-in' },
  { do: 'wait', ms: 2000 },
];

// Chapter 6 (Unit 6): Home Under the Crescent Moon — returning to family at nightfall
const chapter6: Step[] = [
  { do: 'bg', tone: 'night', ms: 1200 },
  ...narr(m(
    'Evening settles softly over the village, and a silver crescent moon — 月 — rises in the starry sky.',
    '夜幕轻轻降临小村庄，一弯银亮的月牙——“月”，升上了星空。',
    '夜幕輕輕降臨小村莊，一彎銀亮的月牙——「月」，升上了星空。',
  )),
  { do: 'place', actor: 'moon', at: [820, 130], size: 150 },
  { do: 'draw', actor: 'moon', glyph: { char: '月', stage: 'oracle' }, ms: 1400, color: '#d99a00' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'moon', color: '#ffd966', size: 200, opacity: 0.55 },
    tagSay('moon', '月', -130, 80),
  ] },
  { do: 'ambient', actor: 'moon', motion: 'pulse' },
  ...narr(m(
    'Beside the garden path, fragrant night blossoms — 花 — sway in the moonlight.',
    '回家的小路旁，芬芳的花朵——“花”，在月光下轻轻摇曳。',
    '回家的小路旁，芬芳的花朵——「花」，在月光下輕輕搖曳。',
  )),
  { do: 'place', actor: 'flower', at: [160, 480], size: 165 },
  { do: 'draw', actor: 'flower', glyph: { char: '花', stage: 'bronze' }, ms: 1500, color: '#d43f5e' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'flower', color: '#ff8da1', size: 200, opacity: 0.4 },
    tagSay('flower', '花', 120, 80),
  ] },
  { do: 'ambient', actor: 'flower', motion: 'sway' },
  ...narr(m(
    'Ahead stands the tall double-leaf wooden gate of home: 门!',
    '前面就是自家院子那扇对称的两扇木大门：“门”！',
    '前面就是自家院子那扇對稱的兩扇木大門：「門」！',
  )),
  { do: 'place', actor: 'gate', at: [480, 370], size: 240 },
  { do: 'draw', actor: 'gate', glyph: { char: '门', stage: 'bronze' }, ms: 1600, color: '#6b4a1e' },
  tagSay('gate', '门', -150, -100),
  ...narr(m(
    'Woof, woof! Our loyal puppy — 犬 — trots out to the gate with its tail curled high!',
    '汪汪！忠实的小狗——“犬”，翘着卷尾巴跑到门口迎接啦！',
    '汪汪！忠實的小狗——「犬」，翹著捲尾巴跑到門口迎接啦！',
  )),
  { do: 'place', actor: 'dog', at: [320, 490], size: 155 },
  { do: 'draw', actor: 'dog', glyph: { char: '犬', stage: 'oracle' }, ms: 1400, color: '#8a4b22' },
  tagSay('dog', '犬', -120, 80),
  { do: 'ambient', actor: 'dog', motion: 'bob' },
  ...narr(m(
    'Inside the warm lamplight, a mother — 女 — kneels beside the cradle…',
    '温暖的灯光下，温柔的妈妈——“女”，端庄地坐在摇篮旁……',
    '溫暖的燈光下，溫柔的媽媽——「女」，端莊地坐在搖籃旁……',
  )),
  { do: 'place', actor: 'mother', at: [700, 420], size: 185 },
  { do: 'draw', actor: 'mother', glyph: { char: '女', stage: 'oracle' }, ms: 1500, color: '#b8321f' },
  { do: 'together', steps: [
    { do: 'wash', actor: 'mother', color: '#ffb366', size: 250, opacity: 0.42 },
    tagSay('mother', '女', -120, 90),
  ] },
  ...narr(m(
    '…and hugs her little baby — 子 — who waves both tiny hands before drifting off to sleep. Good night!',
    '……轻轻抱着挥舞小手的宝宝——“子”，哄他进入甜甜的梦乡。晚安啦！',
    '……輕輕抱著揮舞小手的寶寶——「子」，哄他進入甜甜的夢鄉。晚安啦！',
  )),
  { do: 'place', actor: 'child', at: [835, 430], size: 145 },
  { do: 'draw', actor: 'child', glyph: { char: '子', stage: 'oracle' }, ms: 1400, color: '#b8321f' },
  tagSay('child', '子', 110, 80),
  { do: 'move', actor: 'child', to: [755, 420], ms: 1400, gait: 'hop' },
  { do: 'wait', ms: 2400 },
];

export const CHAPTERS: Chapter[] = [
  { unit: 1, title: m('Sunrise in the Valley', '山谷的日出', '山谷的日出'), topic: m('Nature wakes up at dawn', '清晨苏醒的大自然', '清晨甦醒的大自然'), script: chapter1 },
  { unit: 2, title: m('Galloping Across the Meadow', '田野上的奔跑', '田野上的奔跑'), topic: m('A lively ride past the fields', '穿过农田与竹林的奔跑', '穿過農田與竹林的奔跑'), script: chapter2 },
  { unit: 3, title: m('Casting the Net', '小船去捕鱼', '小船去捕魚'), topic: m('A fishing trip on the river', '划着木船去河心撒网', '划著木船去河心撒網'), script: chapter3 },
  { unit: 4, title: m('Shelter Under the Cliff', '山崖下避雨', '山崖下避雨'), topic: m('Keeping warm in a sudden storm', '大雨里的篝火与伙伴', '大雨裡的篝火與夥伴'), script: chapter4 },
  { unit: 5, title: m('Grandpa Chases the Tiger', '爷爷吓跑大老虎', '爺爺嚇跑大老虎'), topic: m('Guarding the mountain cottage', '守护山脚下的农家小屋', '守護山腳下的農家小屋'), script: chapter5 },
  { unit: 6, title: m('Home Under the Crescent Moon', '月光下回家', '月光下回家'), topic: m('A warm family evening', '弯月下的小院与家人', '彎月下的小院與家人'), script: chapter6 },
];

/** Narration off: keep the caption pacing (reading time) but don't speak; character pronunciations stay. */
export function withoutNarration(script: Step[]): Step[] {
  return script.map((st): Step => {
    if (st.do === 'say' && st.lang === 'ui') return { ...st, silent: true };
    if (st.do === 'together') return { ...st, steps: withoutNarration(st.steps) };
    return st;
  });
}
