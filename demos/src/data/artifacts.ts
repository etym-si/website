// Real artifacts behind each stage of a character's journey.
//
// Three honesty levels, always shown to the user:
//   exact   – our glyph was traced from THIS object (provenance from the Commons glyph file)
//   book    – the character is in this text (dictionary, manuscript, primer); the photo shows the text,
//             not necessarily the page/slip with our character
//   appears – this object really contains the character (verified transcription / museum description),
//             but our glyph was traced from another source
//   example – an object of the same kind and period, to show what the writing was on
import credits from './artifact-credits.json';
import type { Tri } from '../i18n';
import type { HistStage } from '../glyphs';
import type { StageId } from './stages';

export type ArtifactKind = 'exact' | 'book' | 'appears' | 'example';
export interface ArtifactCredit { file: string; w: number; h: number; title: string; license: string; author: string; page: string }
export interface ArtifactMark {
  /** Normalized 0..1 bounding box [x, y, w, h] on `img`. */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: Tri;
}
export interface ArtifactRef {
  kind: ArtifactKind;
  img: ArtifactCredit;
  img2?: ArtifactCredit;
  marks?: ArtifactMark[];
  hist?: HistStage;
  disp?: string;
  title: Tri;
  text: Tri;
  source?: string; // raw catalogue reference for grown-ups
}

const C = credits as Record<string, ArtifactCredit>;
const T = (en: string, zhs: string, zht: string): Tri => ({ en, zhs, zht });

// ---- oracle bones -----------------------------------------------------------------------------

const ORACLE_APPEARS: Record<string, { img: string; title: Tri; text: Tri; marks?: ArtifactMark[] }> = {
  日: { img: 'zheng-scapula', title: T('A big ox bone, National Museum of China', '大型牛骨刻辞（中国国家博物馆）', '大型牛骨刻辭（中國國家博物館）'),
    text: T('Look closely at the red circle: this bone says 三日, “on the third day”. The diviner Zheng carved it about 3,200 years ago.',
      '看红圈里：这块牛骨上写着“三日”，就是“第三天”。约3200年前，占卜师“争”刻下了它。',
      '看紅圈裡：這塊牛骨上寫著「三日」，就是「第三天」。約3200年前，占卜師「爭」刻下了它。'),
    marks: [{ x: 0.643, y: 0.748, w: 0.054, h: 0.030,
      label: T('日 (“day”) under 三 (“three”): 三日, “on the third day”', '“三”下面的“日”：“三日”（第三天）', '「三」下面的「日」：「三日」（第三天）') }] },
  月: { img: 'zheng-scapula', title: T('A big ox bone, National Museum of China', '大型牛骨刻辞（中国国家博物馆）', '大型牛骨刻辭（中國國家博物館）'),
    text: T('Look closely at the red circle: this bone says 五月, “in the fifth month”. The diviner Zheng carved it about 3,200 years ago.',
      '看红圈里：这块牛骨上写着“五月”。约3200年前，占卜师“争”刻下了它。',
      '看紅圈裡：這塊牛骨上寫著「五月」。約3200年前，占卜師「爭」刻下了它。'),
    marks: [{ x: 0.199, y: 0.663, w: 0.042, h: 0.060,
      label: T('月 (“month”) under 五 (“five”): 五月, “in the fifth month”', '“五”下面的弯月：“五月”', '「五」下面的彎月：「五月」') }] },
  鹿: { img: 'yh127-plastron', title: T('Turtle shell from pit YH127, Academia Sinica', 'YH127坑龟腹甲（中研院史语所）', 'YH127坑龜腹甲（中研院史語所）'),
    text: T('This turtle shell asks: “Will the king catch deer?” It was found in 1936 in one pit with about 17,000 inscribed shells!',
      '这片龟甲在问：“大王会捕到鹿吗？”它是1936年在一个坑里发现的，那个坑里有约一万七千片刻字的甲骨！',
      '這片龜甲在問：「大王會捕到鹿嗎？」它是1936年在一個坑裡發現的，那個坑裡有約一萬七千片刻字的甲骨！') },
  犬: { img: 'yh127-plastron', title: T('Turtle shell from pit YH127, Academia Sinica', 'YH127坑龟腹甲（中研院史语所）', 'YH127坑龜腹甲（中研院史語所）'),
    text: T('This turtle shell records offerings of dogs and sheep, and asks whether the king will catch deer.',
      '这片龟甲记录了用狗和羊献祭，还问大王会不会捕到鹿。',
      '這片龜甲記錄了用狗和羊獻祭，還問大王會不會捕到鹿。') },
  羊: { img: 'yh127-plastron', title: T('Turtle shell from pit YH127, Academia Sinica', 'YH127坑龟腹甲（中研院史语所）', 'YH127坑龜腹甲（中研院史語所）'),
    text: T('This turtle shell records offerings of sheep and dogs, and asks whether the king will catch deer.',
      '这片龟甲记录了用羊和狗献祭，还问大王会不会捕到鹿。',
      '這片龜甲記錄了用羊和狗獻祭，還問大王會不會捕到鹿。') },
};

const HEJI6057_MARKS: Record<string, ArtifactMark[]> = {
  田: [{ x: 0.418, y: 0.766, w: 0.052, h: 0.036,
    label: T('田 (“field”) in “侵我西鄙田” — invaded the fields on our western border', '“侵我西鄙田”（侵犯我们西边的农田）里的“田”', '「侵我西鄙田」（侵犯我們西邊的農田）裡的「田」') }],
};

function oracle(ch: string, st: HistStage): ArtifactRef {
  const note = st.prov?.note ?? '';
  const heji = note.match(/合(\d+)/)?.[1];
  if (heji === '6057') {
    return { kind: 'exact', img: C['heji6057'], marks: HEJI6057_MARKS[ch], source: note,
      title: T('Oracle bone No. 6057 (Heji)', '甲骨文合集 6057 号', '甲骨文合集 6057 號'),
      text: T(`This very ox bone! The ${ch} you just saw (circled in red) was copied right from it. It is about 3,200 years old and lives in the National Museum of China.`,
        `就是这块牛骨！刚才的“${ch}”（红圈处）就是从它上面描下来的。它已经约3200岁了，现藏中国国家博物馆。`,
        `就是這塊牛骨！剛才的「${ch}」（紅圈處）就是從它上面描下來的。它已經約3200歲了，現藏中國國家博物館。`) };
  }
  const appears = ORACLE_APPEARS[ch];
  if (appears) return { kind: 'appears', img: C[appears.img], marks: appears.marks, title: appears.title, text: appears.text, source: note || undefined };
  const firstBook = note.startsWith('鐵')
    ? T(' It was first printed in 1903 in “Tieyun Canggui”, the very first book of oracle bones!', '它最早印在1903年的《铁云藏龟》里——第一本甲骨文的书！', '它最早印在1903年的《鐵雲藏龜》裡——第一本甲骨文的書！')
    : T('', '', '');
  if (heji) {
    return { kind: 'example', img: C['heji6057'], source: note,
      title: T(`Copied from oracle bone No. ${heji}`, `描自甲骨文合集 ${heji} 号`, `描自甲骨文合集 ${heji} 號`),
      text: T(`This ${ch} was copied from oracle bone No. ${heji} in the big catalogue of oracle bones (甲骨文合集).${firstBook.en} The photo shows another bone from the same time.`,
        `这个“${ch}”描自《甲骨文合集》第${heji}号甲骨。${firstBook.zhs}照片是同一时代的另一块牛骨。`,
        `這個「${ch}」描自《甲骨文合集》第${heji}號甲骨。${firstBook.zht}照片是同一時代的另一塊牛骨。`) };
  }
  if (note) {
    return { kind: 'example', img: C['heji6057'], source: note,
      title: T(`Copied from oracle bone ${note}`, `描自甲骨 ${note}`, `描自甲骨 ${note}`),
      text: T(`This ${ch} was copied from a real oracle bone (catalogue ${note}). The photo shows another bone from the same time.`,
        `这个“${ch}”描自一片真正的甲骨（编号 ${note}）。照片是同一时代的另一块牛骨。`,
        `這個「${ch}」描自一片真正的甲骨（編號 ${note}）。照片是同一時代的另一塊牛骨。`) };
  }
  return { kind: 'example', img: C['heji6057'],
    title: T('Oracle bones', '甲骨', '甲骨'),
    text: T('Oracle bone script was carved on ox bones and turtle shells like this one, to ask about rain, harvests and hunting.',
      '甲骨文刻在这样的牛骨和龟甲上，用来占卜下雨、收成和打猎。',
      '甲骨文刻在這樣的牛骨和龜甲上，用來占卜下雨、收成和打獵。') };
}

// ---- bronzes ----------------------------------------------------------------------------------

interface Vessel { key: string; en: string; zh: string; kind: Tri; years: string }
const BOWL = T('a bronze food bowl', '青铜食器', '青銅食器');
const CAULDRON = T('a bronze cauldron', '青铜鼎', '青銅鼎');
const VESSELS: Vessel[] = [
  { key: '師虎簋', en: 'Shi Hu gui', zh: '师虎簋', kind: BOWL, years: '2,900' },
  { key: '沈子它簋蓋', en: 'lid of the Shenzi Ta gui', zh: '沈子它簋盖', kind: BOWL, years: '3,000' },
  { key: '田農鼎', en: 'Tian Nong ding', zh: '田农鼎', kind: CAULDRON, years: '3,000' },
  { key: '父丁孤竹罍', en: 'Fu Ding Guzhu lei', zh: '父丁孤竹罍', kind: T('a bronze wine jar', '青铜酒器', '青銅酒器'), years: '3,000' },
  { key: '彔伯', en: 'lid of Lord Lu’s gui', zh: '彔伯簋盖', kind: BOWL, years: '2,900' },
  { key: '師酉簋', en: 'Shi You gui', zh: '师酉簋', kind: BOWL, years: '2,900' },
  { key: '魚爵', en: 'Yu jue', zh: '鱼爵', kind: T('a bronze wine cup', '青铜酒杯', '青銅酒杯'), years: '3,000' },
  { key: '麥方鼎', en: 'Mai square ding', zh: '麦方鼎', kind: CAULDRON, years: '3,000' },
  { key: '龜父丙鼎', en: 'Gui Fu Bing ding', zh: '龟父丙鼎', kind: CAULDRON, years: '3,000' },
  { key: '羊作父乙卣', en: 'Yang you', zh: '羊作父乙卣', kind: T('a bronze wine bucket', '青铜酒器', '青銅酒器'), years: '3,000' },
];

const DAYU_MARKS: Record<string, { marks: ArtifactMark[]; phrase: Tri }> = {
  雨: {
    phrase: T('in the character 雩 (a rain-prayer ritual), which appears three times', '在“雩”（祈雨祭祀）字里出现了三次', '在「雩」（祈雨祭祀）字裡出現了三次'),
    marks: [
      { x: 0.714, y: 0.285, w: 0.038, h: 0.033, label: T('雨 at the top of 雩 (column 5: “雩殷正百辟”)', '第5行“雩”字上半部的“雨”（“雩殷正百辟”）', '第5行「雩」字上半部的「雨」（「雩殷正百辟」）') },
      { x: 0.836, y: 0.704, w: 0.039, h: 0.035, label: T('雨 at the top of 雩 (column 3: “在雩御事”)', '第3行“雩”字上半部的“雨”（“在雩御事”）', '第3行「雩」字上半部的「雨」（「在雩御事」）') },
      { x: 0.331, y: 0.356, w: 0.033, h: 0.031, label: T('雨 at the top of 雩 (column 13: “雩我其遹省”)', '第13行“雩”字上半部的“雨”（“雩我其遹省”）', '第13行「雩」字上半部的「雨」（「雩我其遹省」）') },
    ],
  },
  田: {
    phrase: T('in “殷邊侯、田” (column 5, right above 雩)', '在第5行的“殷边侯、田”里（就在“雩”字正上方）', '在第5行的「殷邊侯、田」裡（就在「雩」字正上方）'),
    marks: [{ x: 0.714, y: 0.241, w: 0.034, h: 0.031, label: T('田 in “殷邊侯、田” (column 5)', '第5行“殷边侯、田”里的“田”', '第5行「殷邊侯、田」裡的「田」') }],
  },
  马: {
    phrase: T('in “錫車馬” — the king rewarded Yu with a chariot and horses (column 14)', '在第14行的“锡车马”（赏赐车和马）里', '在第14行的「錫車馬」（賞賜車和馬）裡'),
    marks: [{ x: 0.270, y: 0.798, w: 0.036, h: 0.050, label: T('馬 (“horse”) right under 車 (“chariot”), column 14', '第14行“车”字正下方的“马”', '第14行「車」字正下方的「馬」') }],
  },
  夫: {
    phrase: T('in “六百又五十又九夫” (659 men) and “千又五十夫” (1,050 men) in columns 15–16', '在第15、16行的“六百又五十又九夫”和“千又五十夫”里', '在第15、16行的「六百又五十又九夫」和「千又五十夫」裡'),
    marks: [
      { x: 0.197, y: 0.675, w: 0.032, h: 0.050, label: T('夫 (“men”) in “六百又五十又九夫” — 659 men (column 15)', '第15行“六百又五十又九夫”（659人）里的“夫”', '第15行「六百又五十又九夫」（659人）裡的「夫」') },
      { x: 0.148, y: 0.672, w: 0.031, h: 0.050, label: T('夫 (“men”) in “千又五十夫” — 1,050 men (column 16)', '第16行“千又五十夫”（1050人）里的“夫”', '第16行「千又五十夫」（1050人）裡的「夫」') },
    ],
  },
  月: {
    phrase: T('in the opening words “隹九月” — in the ninth month (column 1)', '在第1行开头的“隹九月”（在九月）里', '在第1行開頭的「隹九月」（在九月）裡'),
    marks: [{ x: 0.933, y: 0.176, w: 0.031, h: 0.054, label: T('月 (“month”) in “隹九月” (column 1, 3rd character)', '第1行第3个字：“隹九月”里的“月”', '第1行第3個字：「隹九月」裡的「月」') }],
  },
};

const HUDING_MARKS: Record<string, ArtifactMark[]> = {
  门: [{ x: 0.118, y: 0.152, w: 0.039, h: 0.053,
    label: T('門 (“gate”) in “于王參門” — at the King’s Three Gates', '“于王参门”（在周王的三门）里的“门”', '「于王參門」（在周王的三門）裡的「門」') }],
};

function bronze(ch: string, st: HistStage): ArtifactRef {
  const note = st.prov?.note ?? '';
  const part = note.match(/taken from (\S)/)?.[1];
  const partTri = part
    ? T(` (it is the ${ch} part of the character ${part})`, `（取自“${part}”字里的“${ch}”）`, `（取自「${part}」字裡的「${ch}」）`)
    : T('', '', '');
  const dayu = DAYU_MARKS[ch];
  if (note.startsWith('大盂鼎')) {
    return { kind: 'exact', img: C['dayu-inscription'], img2: C['dayu-ding'], marks: dayu?.marks, source: note,
      title: T('The Da Yu ding (大盂鼎)', '大盂鼎', '大盂鼎'),
      text: T(`This ${ch} was copied from the Da Yu ding${partTri.en}, a giant bronze cauldron cast about 3,000 years ago. Look at the red circles on this ink rubbing of its inscription!`,
        `这个“${ch}”描自大盂鼎${partTri.zhs}。大盂鼎是约3000年前铸造的大青铜鼎，看拓片上的红圈！大盂鼎现藏中国国家博物馆。`,
        `這個「${ch}」描自大盂鼎${partTri.zht}。大盂鼎是約3000年前鑄造的大青銅鼎，看拓片上的紅圈！大盂鼎現藏中國國家博物館。`) };
  }
  if (note.startsWith('曶鼎')) {
    return { kind: 'exact', img: C['hu-ding-rubbing'], marks: HUDING_MARKS[ch], source: note,
      title: T('The Hu ding (曶鼎)', '曶鼎', '曶鼎'),
      text: T(`This ${ch} (circled in red) was copied from the Hu ding, a bronze cauldron from about 2,900 years ago. The cauldron itself is lost — only ink rubbings of its writing survive, like this one!`,
        `这个“${ch}”（红圈处）描自曶鼎，一件约2900年前的青铜鼎。鼎本身已经失传了，只留下像这样的铭文拓片！`,
        `這個「${ch}」（紅圈處）描自曶鼎，一件約2900年前的青銅鼎。鼎本身已經失傳了，只留下像這樣的銘文拓片！`) };
  }
  const v = VESSELS.find((x) => note.startsWith(x.key));
  if (dayu) {
    const tracedFrom = v
      ? T(`Our ${ch} glyph was traced from the ${v.en} (${v.key}). `, `动画里的“${ch}”描自${v.zh}。`, `動畫裡的「${ch}」描自${v.key}。`)
      : T('', '', '');
    return { kind: 'appears', img: C['dayu-inscription'], img2: C['dayu-ding'], marks: dayu.marks, source: note || undefined,
      title: T('The Da Yu ding (大盂鼎)', '大盂鼎铭文', '大盂鼎銘文'),
      text: T(`${tracedFrom.en}You can also spot ${ch} circled in red on this ink rubbing of the Da Yu ding (about 3,000 years old), ${dayu.phrase.en}!`,
        `${tracedFrom.zhs}在这张约3000年前的大盂鼎铭文拓片上，你也能在红圈里找到“${ch}”字——就${dayu.phrase.zhs}！`,
        `${tracedFrom.zht}在這張約3000年前的大盂鼎銘文拓片上，你也能在紅圈裡找到「${ch}」字——就${dayu.phrase.zht}！`) };
  }
  if (v) {
    return { kind: 'example', img: C['dayu-ding'], source: note,
      title: T(`Copied from the ${v.en}`, `描自${v.zh}`, `描自${v.key}`),
      text: T(`This ${ch} was copied from the writing on the ${v.en} (${v.key})${partTri.en}, ${v.kind.en} from about ${v.years} years ago. The photo shows the Da Yu ding, another bronze from that time.`,
        `这个“${ch}”描自${v.zh}${partTri.zhs}，它是约${v.years.replace(',', '')}年前的${v.kind.zhs}。照片是同时代的大盂鼎。`,
        `這個「${ch}」描自${v.key}${partTri.zht}，它是約${v.years.replace(',', '')}年前的${v.kind.zht}。照片是同時代的大盂鼎。`) };
  }
  return { kind: 'example', img: C['dayu-ding'],
    title: T('Bronze vessels', '青铜器', '青銅器'),
    text: T('Bronze script was cast into bronze cauldrons and bowls like this one, the Da Yu ding, about 3,000 years ago.',
      '金文是铸在青铜器上的文字，就像这件约3000年前的大盂鼎。',
      '金文是鑄在青銅器上的文字，就像這件約3000年前的大盂鼎。') };
}

// ---- seal: the Shuowen Jiezi ---------------------------------------------------------------------

function seal(): ArtifactRef {
  return { kind: 'book', img: C['shuowen'],
    title: T('Shuowen Jiezi (說文解字)', '《说文解字》', '《說文解字》'),
    text: T('Seal forms like this were collected in the Shuowen Jiezi, China’s first great character dictionary (about 100 CE). It explained 9,353 characters! Photo: a page from Xu Xuan’s edition.',
      '这样的篆书收录在《说文解字》里——中国第一部重要的字典（约公元100年），一共解释了9353个字！照片是徐铉校订本的一页。',
      '這樣的篆書收錄在《說文解字》裡——中國第一部重要的字典（約公元100年），一共解釋了9353個字！照片是徐鉉校訂本的一頁。') };
}

// ---- clerical: Qin bamboo slips (Shuihudi) and Han silk ------------------------------------------

const SHUIHUDI: Record<string, { en: string; zh: string; zht: string; img: string }> = {
  秦: { en: 'Eighteen Qin Statutes', zh: '秦律十八种', zht: '秦律十八種', img: 'qin-laws' },
  法: { en: 'Questions and Answers on the Law', zh: '法律答问', zht: '法律答問', img: 'qin-legal' },
  日甲: { en: 'Daybook A, an almanac of lucky days', zh: '日书甲种', zht: '日書甲種', img: 'qin-rishu' },
  語: { en: 'A Governor’s Letter', zh: '语书', zht: '語書', img: 'qin-slips' },
  雜: { en: 'Miscellaneous Qin Statutes', zh: '秦律杂抄', zht: '秦律雜抄', img: 'qin-slips' },
  為: { en: 'The Way of Being an Official', zh: '为吏之道', zht: '為吏之道', img: 'qin-slips' },
  封: { en: 'Models for Investigations', zh: '封诊式', zht: '封診式', img: 'qin-slips' },
};

function clerical(ch: string, st: HistStage): ArtifactRef {
  const note = st.prov?.note ?? '';
  const m = note.match(/^睡\.(日甲|秦|法|語|雜|為|封)(\d+)(背)?/);
  if (m) {
    const doc = SHUIHUDI[m[1]];
    const sameDoc = doc.img !== 'qin-slips';
    return { kind: sameDoc ? 'book' : 'example', img: C[doc.img], source: note,
      title: T(`Qin bamboo slip: “${doc.en}”`, `睡虎地秦简《${doc.zh}》`, `睡虎地秦簡《${doc.zht}》`),
      text: T(`This ${ch} was copied from bamboo slip No. ${m[2]} of “${doc.en}”, written with brush and ink around 217 BCE and found in 1975 in a Qin official’s tomb at Shuihudi. ${sameDoc ? 'Photo: slips of this same text.' : 'Photo: Qin bamboo slips.'}`,
        `这个“${ch}”描自睡虎地秦简《${doc.zh}》第${m[2]}简，约公元前217年用毛笔写成，1975年在一位秦朝官吏的墓中出土。${sameDoc ? '照片就是这部竹简。' : '照片是秦代竹简。'}`,
        `這個「${ch}」描自睡虎地秦簡《${doc.zht}》第${m[2]}簡，約公元前217年用毛筆寫成，1975年在一位秦朝官吏的墓中出土。${sameDoc ? '照片就是這部竹簡。' : '照片是秦代竹簡。'}`) };
  }
  if (st.variant === 'slip') {
    return { kind: 'example', img: C['qin-slips'],
      title: T('Bamboo slips', '竹简', '竹簡'),
      text: T('Around 2,200 years ago, people wrote with brushes on strips of bamboo like these, tied together into scrolls.',
        '约2200年前，人们用毛笔在这样的竹片上写字，再用绳子编成一卷。',
        '約2200年前，人們用毛筆在這樣的竹片上寫字，再用繩子編成一卷。') };
  }
  return { kind: 'example', img: C['mawangdui'],
    title: T('Han silk manuscript (Mawangdui)', '马王堆帛书', '馬王堆帛書'),
    text: T(`This ${ch} comes from Han-dynasty brush writing${st.variant === 'silk' ? ' on silk' : ''}, like this manuscript from the Mawangdui tombs (2nd century BCE).`,
      `这个“${ch}”来自汉代的毛笔字${st.variant === 'silk' ? '（写在丝绸上）' : ''}，就像这份马王堆出土的帛书（公元前2世纪）。`,
      `這個「${ch}」來自漢代的毛筆字${st.variant === 'silk' ? '（寫在絲綢上）' : ''}，就像這份馬王堆出土的帛書（公元前2世紀）。`) };
}

// ---- regular: the Thousand Character Classic ------------------------------------------------------

/** Lines of the 千字文 that contain each character (verified against the full text on Wikisource). */
const QIANZIWEN: Record<string, { zhs: string; zht: string; en: string; glossS: string; glossT: string }> = {
  日: { zht: '日月盈昃', zhs: '日月盈昃', en: 'The sun sets and the moon grows full.', glossS: '太阳偏西，月亮圆了又缺。', glossT: '太陽偏西，月亮圓了又缺。' },
  月: { zht: '日月盈昃', zhs: '日月盈昃', en: 'The sun sets and the moon grows full.', glossS: '太阳偏西，月亮圆了又缺。', glossT: '太陽偏西，月亮圓了又缺。' },
  水: { zht: '金生麗水', zhs: '金生丽水', en: 'Gold is found in the Li River.', glossS: '金子出产在丽水。', glossT: '金子出產在麗水。' },
  林: { zht: '林皋幸即', zhs: '林皋幸即', en: 'Wise people gladly retire to the woods by the water.', glossS: '高兴地退隐到山林水边。', glossT: '高興地退隱到山林水邊。' },
  木: { zht: '化被草木', zhs: '化被草木', en: 'Kindness reaches even the grass and the trees.', glossS: '仁德的教化连草木都受到了。', glossT: '仁德的教化連草木都受到了。' },
  草: { zht: '化被草木', zhs: '化被草木', en: 'Kindness reaches even the grass and the trees.', glossS: '仁德的教化连草木都受到了。', glossT: '仁德的教化連草木都受到了。' },
  鸟: { zht: '鳥官人皇', zhs: '鸟官人皇', en: 'The Bird Officials and the Human Emperor: a legendary king named his officials after birds!', glossS: '传说中用鸟名做官名的少昊，和人皇。', glossT: '傳說中用鳥名做官名的少昊，和人皇。' },
  象: { zht: '籃筍象床', zhs: '篮笋象床', en: 'Bamboo baskets and a bed decorated with ivory (elephant tusk).', glossS: '竹编的器具，象牙装饰的床。', glossT: '竹編的器具，象牙裝飾的床。' },
  田: { zht: '雞田赤城', zhs: '鸡田赤城', en: 'Jitian and Chicheng, faraway frontier towns.', glossS: '鸡田和赤城，都是边塞的地名。', glossT: '雞田和赤城，都是邊塞的地名。' },
  夫: { zht: '夫唱婦隨', zhs: '夫唱妇随', en: 'One sings and the other joins in: a happy home.', glossS: '夫妻和睦。', glossT: '夫妻和睦。' },
  鱼: { zht: '史魚秉直', zhs: '史鱼秉直', en: 'Shi Yu (“Historian Fish”) always told the truth.', glossS: '史鱼为人正直。', glossT: '史魚為人正直。' },
  云: { zht: '雲騰致雨', zhs: '云腾致雨', en: 'Clouds rise up and bring the rain.', glossS: '云气升腾，就下起雨来。', glossT: '雲氣升騰，就下起雨來。' },
  雨: { zht: '雲騰致雨', zhs: '云腾致雨', en: 'Clouds rise up and bring the rain.', glossS: '云气升腾，就下起雨来。', glossT: '雲氣升騰，就下起雨來。' },
  石: { zht: '昆池碣石', zhs: '昆池碣石', en: 'Kunming Lake and Jieshi (“Stone Tablet”) Mountain.', glossS: '昆明池和碣石山。', glossT: '昆明池和碣石山。' },
  火: { zht: '龍師火帝', zhs: '龙师火帝', en: 'The Dragon Master and the Fire Emperor, two legendary rulers.', glossS: '传说中的龙师伏羲和火帝神农。', glossT: '傳說中的龍師伏羲和火帝神農。' },
  舍: { zht: '丙舍傍啟', zhs: '丙舍傍启', en: 'Side halls open next to the palace.', glossS: '宫殿旁边的配殿打开着。', glossT: '宮殿旁邊的配殿打開著。' },
  羊: { zht: '詩讚羔羊', zhs: '诗赞羔羊', en: 'The Book of Songs praises the lambs.', glossS: '《诗经》里有赞美羔羊的诗。', glossT: '《詩經》裡有讚美羔羊的詩。' },
  门: { zht: '雁門紫塞', zhs: '雁门紫塞', en: 'Wild Goose Gate and the Purple Wall (the Great Wall).', glossS: '雁门关和长城。', glossT: '雁門關和長城。' },
  子: { zht: '猶子比兒', zhs: '犹子比儿', en: 'Treat your nephews and nieces like your own children.', glossS: '对待侄子要像对待自己的孩子一样。', glossT: '對待姪子要像對待自己的孩子一樣。' },
  女: { zht: '女慕貞絜', zhs: '女慕贞洁', en: 'Women admire goodness.', glossS: '女子敬慕美好的品德。', glossT: '女子敬慕美好的品德。' },
};

function regular(ch: string, disp: string): ArtifactRef {
  const q = QIANZIWEN[ch];
  if (ch === '舍') {
    // The photographed page really shows this line: 丙舍傍啓甲帳對楹肆筵 (regular + cursive columns).
    return { kind: 'appears', img: C['zhiyong'],
      marks: [
        { x: 0.270, y: 0.122, w: 0.185, h: 0.078, label: T('舍 in regular script (楷書): “丙舍傍啟” (3rd column from right)', '右边第3行楷书写的“舍”（“丙舍傍启”）', '右邊第3行楷書寫的「舍」（「丙舍傍啟」）') },
        { x: 0.045, y: 0.128, w: 0.150, h: 0.088, label: T('The same 舍 in cursive script (草書) in the column beside it!', '旁边第4行用草书写的同一个“舍”字！', '旁邊第4行用草書寫的同一個「舍」字！') },
      ],
      title: T('Thousand Character Classic (千字文)', '《千字文》', '《千字文》'),
      text: T('Spot it in the red circles! In this 1,400-year-old page by the monk Zhiyong, 舍 is the 2nd character of the third column from the right: “丙舍傍啟”, side halls open next to the palace. The column next to it shows the same words in fast cursive writing.',
        '看红圈里！在这页约1400年前智永写的《千字文》里，“舍”是右边第三行的第二个字：“丙舍傍启”。旁边那一行是同样的字，用草书写的。',
        '看紅圈裡！在這頁約1400年前智永寫的《千字文》裡，「舍」是右邊第三行的第二個字：「丙舍傍啟」。旁邊那一行是同樣的字，用草書寫的。') };
  }
  if (q) {
    return { kind: 'book', img: C['zhiyong'],
      title: T('Thousand Character Classic (千字文)', '《千字文》', '《千字文》'),
      text: T(`${disp} is one of the 1,000 characters in the Thousand Character Classic, a poem children learned from for more than 1,400 years: “${q.zht}”, ${q.en} Photo: Zhiyong’s copy, about 1,400 years old.`,
        `“${disp}”是《千字文》一千个字里的一个，一千四百多年来孩子们都用它识字：“${q.zhs}”——${q.glossS}照片是约1400年前智永写的《千字文》。`,
        `「${disp}」是《千字文》一千個字裡的一個，一千四百多年來孩子們都用它識字：「${q.zht}」——${q.glossT}照片是約1400年前智永寫的《千字文》。`) };
  }
  return { kind: 'example', img: C['zhiyong'],
    title: T('Thousand Character Classic (千字文)', '《千字文》', '《千字文》'),
    text: T('Regular script became the standard way to write. Photo: Zhiyong’s Thousand Character Classic, about 1,400 years old.',
      '楷书成了写字的标准。照片是约1400年前智永写的《千字文》。',
      '楷書成了寫字的標準。照片是約1400年前智永寫的《千字文》。') };
}

/** The artifact to show for a character at a given stage (null when there is nothing honest to show). */
export function artifactFor(ch: string, stage: StageId, hist: HistStage | undefined, disp: string): ArtifactRef | null {
  if (!C['heji6057']) return null; // artifacts not fetched
  let ref: ArtifactRef | null = null;
  switch (stage) {
    case 'oracle': ref = hist ? oracle(ch, hist) : null; break;
    case 'bronze': ref = hist ? bronze(ch, hist) : null; break;
    case 'seal': ref = seal(); break;
    case 'clerical': ref = hist ? clerical(ch, hist) : null; break;
    case 'regular': ref = regular(ch, disp); break;
  }
  if (ref) { ref.hist = hist; ref.disp = disp; }
  return ref;
}
