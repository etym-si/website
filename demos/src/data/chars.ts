// The 36 characters of 《三十六个字》 (1984), in the film's order of appearance,
// grouped into six units of six. Each unit is one chapter of the film's story.
import type { Tri } from '../i18n';

export interface CharInfo {
  char: string; // simplified
  trad: string; // traditional (same as char when identical)
  pinyin: string;
  meaning: Tri; // en: gloss; zh: a common word containing the character
  fact: Tri; // one kid-friendly, historically grounded sentence or two
}

const c = (char: string, trad: string, pinyin: string, meaning: Tri, fact: Tri): CharInfo => ({ char, trad, pinyin, meaning, fact });
const m = (en: string, zhs: string, zht: string): Tri => ({ en, zhs, zht });

export const CHARS: CharInfo[] = [
  c('日', '日', 'rì', m('sun', '太阳', '太陽'), m(
    'The first 日 was a circle with a dot: the shining sun. Later the circle became a square, because squares are easier to carve and write.',
    '最早的“日”是一个圆圈，中间有一个点，就像发光的太阳。后来圆圈变成了方框，因为方框更容易刻，也更容易写。',
    '最早的「日」是一個圓圈，中間有一個點，就像發光的太陽。後來圓圈變成了方框，因為方框更容易刻，也更容易寫。')),
  c('山', '山', 'shān', m('mountain', '高山', '高山'), m(
    'Three peaks side by side make 山. The middle one is the tallest!',
    '三座山峰并排站着，就是“山”。中间那座最高！',
    '三座山峰並排站著，就是「山」。中間那座最高！')),
  c('水', '水', 'shuǐ', m('water', '河水', '河水'), m(
    'The wavy line in the middle is a flowing river, and the dots on each side are splashes of water.',
    '中间弯弯的线是流动的河水，两边的点是溅起的水花。',
    '中間彎彎的線是流動的河水，兩邊的點是濺起的水花。')),
  c('林', '林', 'lín', m('woods', '树林', '樹林'), m(
    'One tree is 木. Put two trees together and you get 林, a little wood!',
    '一棵树是“木”，两棵树在一起，就成了树林的“林”！',
    '一棵樹是「木」，兩棵樹在一起，就成了樹林的「林」！')),
  c('木', '木', 'mù', m('tree', '树木', '樹木'), m(
    '木 is a tree: branches reaching up on top, roots spreading out below.',
    '“木”是一棵树：上面是伸向天空的树枝，下面是向四周伸展的树根。',
    '「木」是一棵樹：上面是伸向天空的樹枝，下面是向四周伸展的樹根。')),
  c('鸟', '鳥', 'niǎo', m('bird', '小鸟', '小鳥'), m(
    'Find the beak, the eye, the wing and the tail! The ancient 鸟 is a bird standing sideways.',
    '找一找鸟嘴、眼睛、翅膀和尾巴！古代的“鸟”是一只侧身站着的小鸟。',
    '找一找鳥嘴、眼睛、翅膀和尾巴！古代的「鳥」是一隻側身站著的小鳥。')),

  c('象', '象', 'xiàng', m('elephant', '大象', '大象'), m(
    'See the long trunk at the top? Long ago, wild elephants lived in China, so people knew them well.',
    '看到顶上长长的鼻子了吗？很久以前，中国也有野生大象，所以古人很熟悉它们。',
    '看到頂上長長的鼻子了嗎？很久以前，中國也有野生大象，所以古人很熟悉牠們。')),
  c('草', '草', 'cǎo', m('grass', '小草', '小草'), m(
    'Grass was first drawn as little sprouts: 艸. Later, 早 was added underneath to hint at the sound.',
    '小草最早画成几棵小芽：艸。后来下面加了一个“早”，提示它的读音。',
    '小草最早畫成幾棵小芽：艸。後來下面加了一個「早」，提示它的讀音。')),
  c('田', '田', 'tián', m('field', '田地', '田地'), m(
    '田 is a field seen from above, divided by little paths into neat plots.',
    '“田”是从天上往下看的农田，被小路分成一块一块的。',
    '「田」是從天上往下看的農田，被小路分成一塊一塊的。')),
  c('竹', '竹', 'zhú', m('bamboo', '竹子', '竹子'), m(
    '竹 shows two bamboo twigs with their leaves hanging down.',
    '“竹”画的是两根竹枝，叶子垂了下来。',
    '「竹」畫的是兩根竹枝，葉子垂了下來。')),
  c('马', '馬', 'mǎ', m('horse', '骏马', '駿馬'), m(
    'The ancient 马 is a horse standing up on its tail! Writers turned animals sideways to fit them into narrow columns. You can still see the mane and legs in 馬.',
    '古代的“马”是一匹竖起来的马！为了写进窄窄的竖行，古人常把动物竖着写。繁体“馬”里还能看到马鬃和马腿。',
    '古代的「馬」是一匹豎起來的馬！為了寫進窄窄的豎行，古人常把動物豎著寫。「馬」字裡還能看到馬鬃和馬腿。')),
  c('夫', '夫', 'fū', m('grown-up man', '农夫', '農夫'), m(
    '夫 is 大 (a grown-up) with a line through the hair: a hairpin! Grown-up men in ancient China pinned up their hair.',
    '“夫”是“大”（一个大人）头上加一横——那是发簪！古时候，男子长大后要把头发束起来，插上簪子。',
    '「夫」是「大」（一個大人）頭上加一橫——那是髮簪！古時候，男子長大後要把頭髮束起來，插上簪子。')),

  c('刀', '刀', 'dāo', m('knife', '小刀', '小刀'), m(
    '刀 is a knife: a handle and a curved blade.',
    '“刀”是一把刀：有刀柄，还有弯弯的刀刃。',
    '「刀」是一把刀：有刀柄，還有彎彎的刀刃。')),
  c('舟', '舟', 'zhōu', m('boat', '小船', '小船'), m(
    '舟 is a small wooden boat. The lines across it are its planks.',
    '“舟”是一条小木船，中间的横线是一块块木板。',
    '「舟」是一條小木船，中間的橫線是一塊塊木板。')),
  c('鱼', '魚', 'yú', m('fish', '小鱼', '小魚'), m(
    'Head at the top, tail at the bottom: the ancient 鱼 is a fish swimming upward. The four dots at the bottom of 魚 were once its tail!',
    '头在上，尾巴在下：古代的“鱼”是一条往上游的鱼。繁体“魚”下面的四个点，原来是鱼尾巴！',
    '頭在上，尾巴在下：古代的「魚」是一條往上游的魚。「魚」下面的四個點，原來是魚尾巴！')),
  c('网', '網', 'wǎng', m('net', '渔网', '漁網'), m(
    '网 is a fishing net with crossing strings. Later people wrote 網, and simplified Chinese went back to the ancient 网!',
    '“网”是一张绳子交叉的渔网。后来人们写成“網”，简化字又回到了古老的“网”！',
    '「网」是一張繩子交叉的漁網。後來人們寫成「網」，簡化字又回到了古老的「网」！')),
  c('燕', '燕', 'yàn', m('swallow', '燕子', '燕子'), m(
    '燕 is a swallow flying with its wings spread wide and its forked tail behind.',
    '“燕”是一只张开翅膀飞翔的燕子，后面还有分叉的尾巴。',
    '「燕」是一隻張開翅膀飛翔的燕子，後面還有分叉的尾巴。')),
  c('云', '雲', 'yún', m('cloud', '白云', '白雲'), m(
    '云 is a curl of cloud. Later, 雨 (rain) was added on top to make 雲, and simplified Chinese went back to the ancient 云!',
    '“云”像一朵卷卷的云。后来上面加了“雨”，写成“雲”，简化字又回到了古老的“云”！',
    '「云」像一朵捲捲的雲。後來上面加了「雨」，寫成「雲」，簡化字又回到了古老的「云」！')),

  c('雨', '雨', 'yǔ', m('rain', '下雨', '下雨'), m(
    'The line on top is the sky, and the dots below are raindrops falling down.',
    '上面一横是天空，下面的点点是落下来的雨滴。',
    '上面一橫是天空，下面的點點是落下來的雨滴。')),
  c('伞', '傘', 'sǎn', m('umbrella', '雨伞', '雨傘'), m(
    '伞 is a “young” character, so there are no oracle-bone or bronze versions. But it still looks like an open umbrella!',
    '“伞”是一个“年轻”的字，没有甲骨文和金文。可它看起来还是像一把撑开的伞！',
    '「傘」是一個「年輕」的字，沒有甲骨文和金文。可它看起來還是像一把撐開的傘！')),
  c('石', '石', 'shí', m('stone', '石头', '石頭'), m(
    '石 shows a rock (口) at the foot of a cliff (厂).',
    '“石”画的是山崖（厂）下面的一块石头（口）。',
    '「石」畫的是山崖（厂）下面的一塊石頭（口）。')),
  c('火', '火', 'huǒ', m('fire', '火焰', '火焰'), m(
    'The oldest 火 looks like flames leaping up from a campfire.',
    '最古老的“火”就像篝火上向上跳动的火苗。',
    '最古老的「火」就像篝火上向上跳動的火苗。')),
  c('龟', '龜', 'guī', m('turtle', '乌龟', '烏龜'), m(
    '龟 has a head, a shell and feet. The oldest Chinese writing we have was carved on turtle shells and bones!',
    '“龟”有头、有壳、有脚。我们发现的最古老的汉字，就刻在龟甲和兽骨上！',
    '「龜」有頭、有殼、有腳。我們發現的最古老的漢字，就刻在龜甲和獸骨上！')),
  c('鹿', '鹿', 'lù', m('deer', '小鹿', '小鹿'), m(
    'Look at the branching antlers on top: that’s how you know it’s a deer!',
    '看顶上分叉的鹿角，一看就知道是“鹿”！',
    '看頂上分叉的鹿角，一看就知道是「鹿」！')),

  c('豕', '豕', 'shǐ', m('pig', '猪', '豬'), m(
    '豕 is a pig standing up, with a round belly and a short tail. Find 豕 inside 家 (home): a pig under a roof!',
    '“豕”是一头竖起来的猪，肚子圆圆，尾巴短短。“家”字里面就有“豕”——屋顶下养着猪！',
    '「豕」是一頭豎起來的豬，肚子圓圓，尾巴短短。「家」字裡面就有「豕」——屋頂下養著豬！')),
  c('叟', '叟', 'sǒu', m('old man', '老人', '老人'), m(
    'The ancient 叟 showed a hand holding a torch inside a house: searching! Later it came to mean “old man”, and 搜 took over the job of “search”.',
    '古代的“叟”是屋子里一只举着火把的手——在找东西！后来它被借来表示“老人”，“找”的意思就交给了“搜”。',
    '古代的「叟」是屋子裡一隻舉著火把的手——在找東西！後來它被借來表示「老人」，「找」的意思就交給了「搜」。')),
  c('虎', '虎', 'hǔ', m('tiger', '老虎', '老虎'), m(
    'The ancient 虎 is a tiger standing up, with a big open mouth, stripes and claws.',
    '古代的“虎”是一只竖起来的老虎，张着大嘴，身上有花纹，还有尖尖的爪子。',
    '古代的「虎」是一隻豎起來的老虎，張著大嘴，身上有花紋，還有尖尖的爪子。')),
  c('弓', '弓', 'gōng', m('bow', '弓箭', '弓箭'), m(
    '弓 is a bow for shooting arrows. Some of the oldest versions even show the string.',
    '“弓”是射箭用的弓，有些最古老的写法还画出了弓弦。',
    '「弓」是射箭用的弓，有些最古老的寫法還畫出了弓弦。')),
  c('舍', '舍', 'shè', m('hut', '房舍', '房舍'), m(
    '舍 is a simple hut: a pointed roof on top, a post in the middle and a base below.',
    '“舍”是一座简单的小屋：上面是尖尖的屋顶，中间是柱子，下面是地基。',
    '「舍」是一座簡單的小屋：上面是尖尖的屋頂，中間是柱子，下面是地基。')),
  c('羊', '羊', 'yáng', m('sheep', '山羊', '山羊'), m(
    '羊 is a sheep’s face seen from the front, with two curly horns on top.',
    '“羊”是从正面看的羊头，上面有两只弯弯的羊角。',
    '「羊」是從正面看的羊頭，上面有兩隻彎彎的羊角。')),

  c('花', '花', 'huā', m('flower', '花朵', '花朵'), m(
    'Long ago, flowers were written 華, a plant in full bloom. 花 came much later: 艹 (grass) on top and 化 to hint at the sound.',
    '很久以前，“花”写作“華”，像一株开满花的植物。“花”是后来才造的字：上面是草字头，下面的“化”提示读音。',
    '很久以前，「花」寫作「華」，像一株開滿花的植物。「花」是後來才造的字：上面是草字頭，下面的「化」提示讀音。')),
  c('门', '門', 'mén', m('gate', '大门', '大門'), m(
    '門 is a picture of a gate with two doors. The simplified 门 comes from a quick, flowing way of writing it.',
    '“門”画的是一扇有两块门板的大门。简化字“门”来自它快速连笔的写法。',
    '「門」畫的是一扇有兩塊門板的大門。簡化字「门」來自它快速連筆的寫法。')),
  c('犬', '犬', 'quǎn', m('dog', '小狗', '小狗'), m(
    '犬 is a dog standing up, with a thin body and its tail curled up.',
    '“犬”是一只竖起来的狗，身子瘦瘦的，尾巴向上卷着。',
    '「犬」是一隻豎起來的狗，身子瘦瘦的，尾巴向上捲著。')),
  c('子', '子', 'zǐ', m('child', '孩子', '孩子'), m(
    '子 is a baby with a big head and waving arms, its legs wrapped up in a blanket.',
    '“子”是一个大脑袋、挥着小手的婴儿，腿裹在襁褓里。',
    '「子」是一個大腦袋、揮著小手的嬰兒，腿裹在襁褓裡。')),
  c('女', '女', 'nǚ', m('woman', '女子', '女子'), m(
    '女 shows a woman kneeling, with her arms crossed in front of her.',
    '“女”画的是一位跪坐着、双手交叉放在身前的女子。',
    '「女」畫的是一位跪坐著、雙手交叉放在身前的女子。')),
  c('月', '月', 'yuè', m('moon', '月亮', '月亮'), m(
    '月 is a crescent moon. People drew it as a crescent so nobody would mix it up with the round sun, 日.',
    '“月”是一弯月牙。古人把月亮画成弯弯的月牙，这样就不会和圆圆的“日”弄混了。',
    '「月」是一彎月牙。古人把月亮畫成彎彎的月牙，這樣就不會和圓圓的「日」弄混了。')),
];

export const BY_CHAR: Record<string, CharInfo> = Object.fromEntries(CHARS.map((x) => [x.char, x]));

export interface Unit {
  n: number;
  title: Tri;
  chars: string[];
  color: string;
  playable: boolean; // v1 vertical slice: units 1–2
}

export const UNITS: Unit[] = [
  { n: 1, title: m('Morning in the Mountains', '山林的早晨', '山林的早晨'), chars: CHARS.slice(0, 6).map((x) => x.char), color: '#2fb67c', playable: true },
  { n: 2, title: m('The Horse Rider', '骑马的人', '騎馬的人'), chars: CHARS.slice(6, 12).map((x) => x.char), color: '#f08a24', playable: true },
  { n: 3, title: m('Gone Fishing', '去捕鱼', '去捕魚'), chars: CHARS.slice(12, 18).map((x) => x.char), color: '#3d8fe0', playable: false },
  { n: 4, title: m('The Storm', '暴风雨', '暴風雨'), chars: CHARS.slice(18, 24).map((x) => x.char), color: '#8b5cf6', playable: false },
  { n: 5, title: m('The Tiger', '老虎来了', '老虎來了'), chars: CHARS.slice(24, 30).map((x) => x.char), color: '#e8453c', playable: false },
  { n: 6, title: m('Home Again', '回家', '回家'), chars: CHARS.slice(30, 36).map((x) => x.char), color: '#d99a00', playable: false },
];

export type LessonKind = 'learn' | 'review' | 'story';
export interface Lesson {
  id: string;
  unit: number;
  kind: LessonKind;
  chars: string[]; // new chars (learn) or all unit chars (review/story)
}

export const LESSONS: Lesson[] = UNITS.flatMap((u) => [
  { id: `u${u.n}-l1`, unit: u.n, kind: 'learn' as const, chars: u.chars.slice(0, 2) },
  { id: `u${u.n}-l2`, unit: u.n, kind: 'learn' as const, chars: u.chars.slice(2, 4) },
  { id: `u${u.n}-l3`, unit: u.n, kind: 'learn' as const, chars: u.chars.slice(4, 6) },
  { id: `u${u.n}-review`, unit: u.n, kind: 'review' as const, chars: u.chars },
  { id: `u${u.n}-story`, unit: u.n, kind: 'story' as const, chars: u.chars },
]);

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

/** Display form for the current script setting. */
export function displayChar(info: CharInfo, script: 'simp' | 'trad'): string {
  return script === 'trad' ? info.trad : info.char;
}
