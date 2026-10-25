import { h } from '../dom';
import { t, tx } from '../i18n';
import { settings } from '../settings';
import { header, mascot } from '../ui/common';
import { BY_CHAR, LESSONS, UNITS, displayChar, type Lesson } from '../data/chars';
import { isUnlocked, progress } from '../progress';

function nodeLabel(l: Lesson): { icon: string; text: string } {
  const script = settings().script;
  if (l.kind === 'review') return { icon: '★', text: t('review') };
  if (l.kind === 'story') return { icon: '🎬', text: t('storyNode') };
  return { icon: l.chars.map((c) => displayChar(BY_CHAR[c], script)).join(''), text: '' };
}

export function renderPath(root: HTMLElement): () => void {
  const p = progress();
  const script = settings().script;
  const firstOpen = LESSONS.find((l) => UNITS[l.unit - 1].playable && isUnlocked(l) && !p.done[l.id]);
  const units = UNITS.map((u) => {
    const banner = h('div', { class: 'unit-banner', style: { background: u.color } },
      h('div', {},
        h('div', { class: 'unit-n' }, `${t('unit')} ${u.n}`),
        h('div', { class: 'unit-title' }, tx(u.title))),
      h('div', { class: 'unit-chars', lang: 'zh' }, u.chars.map((c) => displayChar(BY_CHAR[c], script)).join(' ')));
    if (!u.playable) {
      return h('section', { class: 'unit locked', style: { '--u': u.color } }, banner,
        h('div', { class: 'unit-locked' },
          h('span', { class: 'lock' }, '🔒'),
          h('span', {}, t('lockedUnit')),
          h('a', { href: `#/theater/${encodeURIComponent(u.chars[0])}`, class: 'link' }, `🎭 ${t('tryInTheater')}`)));
    }
    const lessons = LESSONS.filter((l) => l.unit === u.n);
    const nodes = lessons.map((l, i) => {
      const unlocked = isUnlocked(l);
      const stars = p.done[l.id] ?? 0;
      const isCurrent = l === firstOpen;
      const { icon, text } = nodeLabel(l);
      const state = stars ? 'done' : isCurrent ? 'current' : unlocked ? 'open' : 'locked';
      const offset = [0, 70, 100, 70, 0][i % 5];
      const btn = h('button', {
        type: 'button', class: `node node-${l.kind} ${state}`, 'aria-label': `${text || icon} ${state}`, disabled: !unlocked,
        style: { '--x': `${offset}px` },
        onclick: () => { location.hash = `#/lesson/${l.id}`; },
      },
        h('span', { class: 'node-icon', lang: 'zh' }, icon),
        stars ? h('span', { class: 'node-stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)) : null);
      return h('div', { class: 'node-wrap', style: { '--x': `${offset}px` } },
        isCurrent ? h('div', { class: 'start-bubble' }, t('start')) : null,
        btn,
        text ? h('div', { class: 'node-text' }, text) : null);
    });
    return h('section', { class: 'unit', style: { '--u': u.color } }, banner, h('div', { class: 'nodes' }, ...nodes));
  });

  root.replaceChildren(
    header({ showStats: true }),
    h('main', { class: 'path' },
      h('div', { class: 'path-col' }, ...units),
      h('aside', { class: 'path-side' }, mascot(120), h('p', { class: 'bubble' }, t('mascotHello')))),
  );
  root.querySelector('.node.current')?.scrollIntoView({ block: 'center' });
  return () => {};
}
