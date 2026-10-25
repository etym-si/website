// Script stages along a character's journey, oldest → newest.
import type { Tri } from '../i18n';

export type StageId = 'picture' | 'oracle' | 'bronze' | 'seal' | 'clerical' | 'regular' | 'simplified';

export interface StageMeta {
  id: StageId;
  name: Tri;
  era: Tri;
  icon: string;
  color: string;
}

const m = (en: string, zhs: string, zht: string): Tri => ({ en, zhs, zht });

export const STAGES: StageMeta[] = [
  { id: 'picture', icon: '🖍️', color: '#f5b82e', name: m('Picture', '图画', '圖畫'), era: m('Long, long ago', '很久很久以前', '很久很久以前') },
  { id: 'oracle', icon: '🐢', color: '#c9824a', name: m('Oracle bone script', '甲骨文', '甲骨文'),
    era: m('~3,200 years ago · carved on turtle shells & bones', '约3200年前 · 刻在龟甲和兽骨上', '約3200年前 · 刻在龜甲和獸骨上') },
  { id: 'bronze', icon: '🔔', color: '#3f9b8f', name: m('Bronze script', '金文', '金文'),
    era: m('~3,000 years ago · cast on bronze pots & bells', '约3000年前 · 铸在青铜器上', '約3000年前 · 鑄在青銅器上') },
  { id: 'seal', icon: '🏯', color: '#e8453c', name: m('Seal script', '篆书', '篆書'),
    era: m('~2,200 years ago · the First Emperor made one writing for all', '约2200年前 · 秦始皇统一文字', '約2200年前 · 秦始皇統一文字') },
  { id: 'clerical', icon: '🎋', color: '#7a8b2e', name: m('Clerical script', '隶书', '隸書'),
    era: m('~2,000 years ago · quick brush writing on bamboo & silk', '约2000年前 · 写在竹简和帛上的毛笔字', '約2000年前 · 寫在竹簡和帛上的毛筆字') },
  { id: 'regular', icon: '🖌️', color: '#3a2e2a', name: m('Regular script', '楷书', '楷書'),
    era: m('~1,800 years ago → today', '约1800年前到今天', '約1800年前到今天') },
  { id: 'simplified', icon: '✨', color: '#4aa3df', name: m('Simplified', '简体字', '簡體字'),
    era: m('1950s · fewer strokes, easier to write', '1950年代 · 笔画更少，更好写', '1950年代 · 筆畫更少，更好寫') },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, StageMeta>;

/** Where a "clerical" stage glyph actually came from (Commons variant), for honest labelling. */
export const VARIANT_NOTE: Record<string, Tri> = {
  slip: m('from bamboo slips', '出自竹简', '出自竹簡'),
  silk: m('from silk manuscripts', '出自帛书', '出自帛書'),
  'clerical-han': m('Han dynasty', '汉代', '漢代'),
  clerical: m('Han dynasty', '汉代', '漢代'),
  'bronze-shang': m('Shang dynasty bronze', '商代金文', '商代金文'),
};
