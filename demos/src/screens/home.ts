import { h } from '../dom';
import { t, tx } from '../i18n';
import { header, mascot } from '../ui/common';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { CATALOG, defaultCollectionId, loadCollection, loadSign, system } from '../content';
import { signSource } from '../play-source';
import type { Step } from '../../shared/bundle-types.ts';

const FIRST_500_DESC = {
  en: 'Explore 500 foundational characters across 50 themed units — people, nature, animals, tools & home.',
  'zh-Hans': '探索50个主题单元里的500个基础汉字：人物、自然、动物、工具与家园。',
  'zh-Hant': '探索50個主題單元裡的500個基礎漢字：人物、自然、動物、工具與家園。',
};

function card(href: string, icon: string, title: string, desc: string, cls: string): HTMLElement {
  return h('a', { href, class: `card ${cls}` },
    h('span', { class: 'card-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'card-title' }, title),
    h('span', { class: 'card-desc' }, desc));
}

export function renderHome(root: HTMLElement): () => void {
  const stageBox = h('div', { class: 'teaser', 'aria-hidden': 'true' });
  const first500 = CATALOG.collections.find((c) => c.id === 'first-500');
  root.replaceChildren(
    header(),
    h('main', { class: 'home' },
      h('section', { class: 'hero' },
        h('div', { class: 'hero-left' },
          h('h1', {}, t('tagline')),
          h('div', { class: 'hero-mascot' }, mascot(110), h('p', { class: 'bubble' }, t('mascotHello')))),
        stageBox),
      h('nav', { class: 'cards' },
        card('#/theater', '🎭', t('theaterTitle'), t('theaterDesc'), 'c1'),
        first500
          ? card('#/theater/first-500', '📚', tx(first500.title), tx(FIRST_500_DESC), 'c5')
          : null,
        card('#/story', '🎬', t('storyTitle'), t('storyDesc'), 'c2'),
        card('#/learn', '🐢', t('learnTitle'), t('learnDesc'), 'c3'),
        card('#/book', '📒', t('bookTitle'), t('bookDesc'), 'c4')),
      h('p', { class: 'proto-note' }, t('prototypeNote')),
      h('p', { class: 'credits' },
        'Glyphs: Wikimedia Commons Ancient Chinese Characters Project (public domain) · Stroke data: hanzi-writer-data (Arphic PL) · Inspired by 《三十六个字》 (1984)')),
  );

  // Teaser: silently loop quick evolutions of the default collection's featured signs.
  const stage = new Stage(stageBox, { label: 'teaser' });
  const player = new Player(stage);
  let alive = true;
  (async () => {
    const coll = await loadCollection(defaultCollectionId());
    const keys = (coll.featured.length ? coll.featured : coll.units[0]?.signs ?? []).filter((k) => coll.signs[k]);
    for (let i = 0; alive && keys.length; i = (i + 1) % keys.length) {
      const b = await loadSign(coll.signs[keys[i]]);
      const script: Step[] = b.scripts.compact.filter((st) => st.do !== 'say' && st.do !== 'caption' && st.do !== 'tag');
      script.push({ do: 'wait', ms: 1500 });
      if (!(await player.play(script, signSource(b, system(b.system), { audio: false })))) break;
    }
  })().catch(() => { /* teaser is decorative */ });

  return () => {
    alive = false;
    player.stop();
  };
}
