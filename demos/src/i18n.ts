// Bilingual UI strings: English, Simplified Chinese, Traditional Chinese.
import { settings } from './settings';

export interface Tri {
  en: string;
  zhs: string;
  zht: string;
}

/** Pick the right variant for the current UI language + script. */
export function tx(t: Tri): string {
  const s = settings();
  if (s.lang === 'en') return t.en;
  return s.script === 'trad' ? t.zht : t.zhs;
}

/** Chinese variant only (used for narration/captions shown alongside English). */
export function zh(t: Tri): string {
  return settings().script === 'trad' ? t.zht : t.zhs;
}

const tri = (en: string, zhs: string, zht: string): Tri => ({ en, zhs, zht });

export const STR = {
  tagline: tri('Where Chinese characters come from', '汉字从哪里来', '漢字從哪裡來'),
  prototype: tri('Prototype', '演示版', '演示版'),
  prototypeNote: tri(
    'Throwaway demo to show the plan. Art, sound and content are placeholders.',
    '这是展示思路的演示版，图画、声音和内容都还是草稿。',
    '這是展示思路的演示版，圖畫、聲音和內容都還是草稿。',
  ),
  theaterTitle: tri('Evolution Theater', '汉字演变剧场', '漢字演變劇場'),
  theaterDesc: tri(
    'Watch any of the 36 characters grow from a picture into the character we write today.',
    '看36个汉字从一幅画，一步步变成今天的字。',
    '看36個漢字從一幅畫，一步步變成今天的字。',
  ),
  storyTitle: tri('Story Time', '故事时间', '故事時間'),
  storyDesc: tri(
    'Characters come alive and act out a story, just like the 1984 film “Thirty-Six Characters”.',
    '汉字活起来演故事，就像1984年的动画片《三十六个字》。',
    '漢字活起來演故事，就像1984年的動畫片《三十六個字》。',
  ),
  learnTitle: tri('Learn', '学习', '學習'),
  learnDesc: tri('Bite-sized lessons, games, stars and stickers.', '小小课程、游戏、星星和贴纸。', '小小課程、遊戲、星星和貼紙。'),
  bookTitle: tri('Sticker Book', '贴纸册', '貼紙冊'),
  bookDesc: tri('Every character you learn becomes a sticker.', '每学会一个字，就得到一张贴纸。', '每學會一個字，就得到一張貼紙。'),
  mascotHello: tri(
    'Hi, I’m Gugu! Long ago, people carved the first characters on turtle shells like mine.',
    '你好，我是龟龟！很久以前，人们把最早的汉字刻在像我这样的龟壳上。',
    '你好，我是龜龜！很久以前，人們把最早的漢字刻在像我這樣的龜殼上。',
  ),
  home: tri('Home', '首页', '首頁'),
  soundOn: tri('Sound on', '声音开', '聲音開'),
  soundOff: tri('Sound off', '声音关', '聲音關'),
  langToggle: tri('Switch language', '切换语言', '切換語言'),
  scriptToggle: tri('Simplified / Traditional', '简体 / 繁体', '簡體 / 繁體'),
  play: tri('Play', '播放', '播放'),
  pause: tri('Pause', '暂停', '暫停'),
  replay: tri('Replay', '重播', '重播'),
  speed: tri('Speed', '速度', '速度'),
  script: tri('Script', '脚本', '腳本'),
  scriptNote: tri(
    'Every animation is generated live from a script like this. There are no video files. Steps light up as they play.',
    '每段动画都是由这样的脚本实时生成的，没有视频文件。正在播放的步骤会亮起来。',
    '每段動畫都是由這樣的腳本即時生成的，沒有影片檔案。正在播放的步驟會亮起來。',
  ),
  pickChar: tri('Pick a character', '选一个字', '選一個字'),
  youngChar: tri(
    'No ancient forms are known. This is a “young” character!',
    '没有古老的写法——这是一个“年轻”的字！',
    '沒有古老的寫法——這是一個「年輕」的字！',
  ),
  chapter: tri('Chapter', '第', '第'),
  narration: tri('Narration', '旁白', '旁白'),
  unit: tri('Unit', '单元', '單元'),
  start: tri('Start', '开始', '開始'),
  review: tri('Review', '复习', '複習'),
  storyNode: tri('Story', '故事', '故事'),
  lockedUnit: tri('Unlocks after the demo (v1.x)', '演示版之后开放 (v1.x)', '演示版之後開放 (v1.x)'),
  tryInTheater: tri('Preview these in the Evolution Theater', '可以先在演变剧场里看看', '可以先在演變劇場裡看看'),
  streak: tri('day streak', '天连续学习', '天連續學習'),
  continue: tri('Continue', '继续', '繼續'),
  check: tri('Check', '检查', '檢查'),
  correct: tri('Great job!', '太棒了！', '太棒了！'),
  wrong: tri('Not quite!', '差一点！', '差一點！'),
  answerIs: tri('Answer:', '答案：', '答案：'),
  quit: tri('Quit lesson', '退出课程', '退出課程'),
  newChar: tri('New character!', '新字！', '新字！'),
  qPicture: tri('Which character is this picture?', '这幅画是哪个字？', '這幅畫是哪個字？'),
  qAncient: tri(
    'This is how it was written long, long ago. Which character is it today?',
    '这是很久很久以前的写法。它今天是哪个字？',
    '這是很久很久以前的寫法。它今天是哪個字？',
  ),
  qListen: tri('Listen, then tap the character you hear.', '听一听，点出你听到的字。', '聽一聽，點出你聽到的字。'),
  qOrder: tri('Put its journey in order: oldest first!', '按时间排一排：最古老的在前！', '按時間排一排：最古老的在前！'),
  qTrace: tri('Trace it! Follow the strokes in order.', '描一描！按笔顺写。', '描一描！按筆順寫。'),
  qMatch: tri('Match each old character with today’s.', '把古文字和今天的字配对。', '把古文字和今天的字配對。'),
  tapToHear: tri('Tap to hear', '点我听', '點我聽'),
  oldest: tri('Oldest', '最古老', '最古老'),
  today: tri('Today', '今天', '今天'),
  traceDone: tri('Beautiful writing!', '写得真漂亮！', '寫得真漂亮！'),
  lessonDone: tri('Lesson complete!', '课程完成！', '課程完成！'),
  storyDone: tri('Story complete!', '故事看完了！', '故事看完了！'),
  newStickers: tri('New stickers for your book', '新贴纸', '新貼紙'),
  mistakes: tri('mistakes', '个错误', '個錯誤'),
  collected: tri('collected', '已收集', '已收集'),
  bookEmpty: tri('Finish lessons to collect stickers!', '完成课程来收集贴纸吧！', '完成課程來收集貼紙吧！'),
  resetProgress: tri('Reset progress', '重置进度', '重置進度'),
  resetConfirm: tri('Tap again to reset', '再点一次确认', '再點一次確認'),
  watchEvolution: tri('Watch its journey', '看它的演变', '看它的演變'),
  showMe: tri('👀 Show me', '👀 示范', '👀 示範'),
  artifactExact: tri('Copied from this very object', '就是从它上面描下来的', '就是從它上面描下來的'),
  artifactBook: tri('Found in this text', '这部文献里有它', '這部文獻裡有它'),
  artifactAppears: tri('This character is written here', '这上面写着这个字', '這上面寫著這個字'),
  artifactExample: tri('A real object from that time', '同一时代的真实文物', '同一時代的真實文物'),
  lookCloser: tri('Look closer', '仔细看看', '仔細看看'),
  realArtifacts: tri('Real artifacts on this journey', '这一路上的真实文物', '這一路上的真實文物'),
  photo: tri('Photo', '图片', '圖片'),
  catalogue: tri('Catalogue', '著录', '著錄'),
  viewSource: tri('Wikimedia Commons', '维基共享资源', '維基共享資源'),
  close: tri('Close', '关闭', '關閉'),
  circledHere: tri('Circled in red on this artifact', '文物上红圈标出的字', '文物上紅圈標出的字'),
  hideCircle: tri('Hide red circle', '隐藏红圈', '隱藏紅圈'),
  showCircle: tri('Show red circle', '显示红圈', '顯示紅圈'),
  compareGlyph: tri('On the artifact vs. our glyph', '文物原字 vs. 描摹字形', '文物原字 vs. 描摹字形'),
  speechUnavailable: tri('No Chinese voice on this device', '此设备没有中文语音', '此裝置沒有中文語音'),
} satisfies Record<string, Tri>;

export type StrKey = keyof typeof STR;

export function t(key: StrKey): string {
  return tx(STR[key]);
}
