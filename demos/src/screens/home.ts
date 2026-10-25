import { h } from '../dom';
import { t } from '../i18n';
import { header, mascot } from '../ui/common';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { evolutionScript } from '../engine/scripts';
import { loadGlyph } from '../glyphs';
import type { Step } from '../engine/script';

const TEASER = ['日', '马', '山', '鸟', '象', '木'];

function card(href: string, icon: string, title: string, desc: string, cls: string): HTMLElement {
  return h('a', { href, class: `card ${cls}` },
    h('span', { class: 'card-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'card-title' }, title),
    h('span', { class: 'card-desc' }, desc));
}

export function renderHome(root: HTMLElement): () => void {
  const stageBox = h('div', { class: 'teaser', 'aria-hidden': 'true' });
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
        card('#/story', '🎬', t('storyTitle'), t('storyDesc'), 'c2'),
        card('#/learn', '🐢', t('learnTitle'), t('learnDesc'), 'c3'),
        card('#/book', '📒', t('bookTitle'), t('bookDesc'), 'c4')),
      h('p', { class: 'proto-note' }, t('prototypeNote')),
      h('p', { class: 'credits' },
        'Glyphs: Wikimedia Commons Ancient Chinese Characters Project (public domain) · Stroke data: hanzi-writer-data (Arphic PL) · Inspired by 《三十六个字》 (1984)')),
  );

  // Teaser: silently loop quick evolutions on the home page.
  const stage = new Stage(stageBox, { label: 'teaser' });
  const player = new Player(stage);
  let alive = true;
  (async () => {
    for (let i = 0; alive; i = (i + 1) % TEASER.length) {
      const doc = await loadGlyph(TEASER[i]);
      const script: Step[] = evolutionScript(doc, { compact: true }).filter((st) => st.do !== 'say' && st.do !== 'caption' && st.do !== 'tag');
      script.push({ do: 'wait', ms: 1500 });
      if (!(await player.play(script))) break;
    }
  })().catch(() => { /* teaser is decorative */ });

  return () => {
    alive = false;
    player.stop();
  };
}
