import { h } from '../dom';
import { signText, t, tx } from '../i18n';
import { header, mascot } from '../ui/common';
import { CATALOG, defaultCollectionId, loadCollection } from '../content';
import { isUnlocked, progress } from '../progress';
import type { CollectionBundle, LessonB } from '../../shared/bundle-types.ts';

const glyphs = (coll: CollectionBundle, keys: string[], sep = '') => keys.map((k) => signText(coll.signs[k]?.text ?? {})).join(sep);
const theaterHref = (key: string) => `#/theater/${key.slice(0, key.indexOf('/'))}/${encodeURIComponent(key.slice(key.indexOf('/') + 1))}`;

function nodeLabel(coll: CollectionBundle, l: LessonB): { icon: string; text: string } {
  if (l.kind === 'review') return { icon: '★', text: t('review') };
  if (l.kind === 'story') return { icon: '🎬', text: t('storyNode') };
  return { icon: glyphs(coll, l.signs), text: '' };
}

/** Collection tabs, shown only when more than one collection is published. */
export function collectionTabs(current: string, href: (id: string) => string): HTMLElement | null {
  if (CATALOG.collections.length < 2) return null;
  return h('div', { class: 'tabs', role: 'tablist' }, ...CATALOG.collections.map((c) =>
    h('a', { href: href(c.id), role: 'tab', class: `tab ${c.id === current ? 'on' : ''}`, 'aria-selected': String(c.id === current) }, tx(c.title))));
}

export function renderPath(root: HTMLElement, collectionId: string): () => void {
  let alive = true;
  const col = h('div', { class: 'path-col' });
  root.replaceChildren(
    header({ showStats: true }),
    h('main', { class: 'path' },
      col,
      h('aside', { class: 'path-side' }, mascot(120), h('p', { class: 'bubble' }, t('mascotHello')))),
  );
  void loadCollection(collectionId).catch(() => loadCollection(defaultCollectionId())).then((coll) => {
    if (!alive) return;
    const p = progress();
    const playable = (l: LessonB) => coll.units.find((u) => u.n === l.unit)?.playable ?? false;
    const firstOpen = coll.lessons.find((l) => playable(l) && isUnlocked(l, coll.lessons) && !p.done[l.id]);
    const units = coll.units.map((u) => {
      const banner = h('div', { class: 'unit-banner', style: { background: u.color } },
        h('div', {},
          h('div', { class: 'unit-n' }, `${t('unit')} ${u.n}`),
          h('div', { class: 'unit-title' }, tx(u.title))),
        h('div', { class: 'unit-chars', lang: 'zh' }, glyphs(coll, u.signs, ' ')));
      if (!u.playable) {
        return h('section', { class: 'unit locked', style: { '--u': u.color } }, banner,
          h('div', { class: 'unit-locked' },
            h('span', { class: 'lock' }, '🔒'),
            h('span', {}, t('lockedUnit')),
            h('a', { href: theaterHref(u.signs[0]), class: 'link' }, `🎭 ${t('tryInTheater')}`)));
      }
      const nodes = coll.lessons.filter((l) => l.unit === u.n).map((l, i) => {
        const unlocked = isUnlocked(l, coll.lessons);
        const stars = p.done[l.id] ?? 0;
        const isCurrent = l === firstOpen;
        const { icon, text } = nodeLabel(coll, l);
        const state = stars ? 'done' : isCurrent ? 'current' : unlocked ? 'open' : 'locked';
        const offset = [0, 70, 100, 70, 0][i % 5];
        const btn = h('button', {
          type: 'button', class: `node node-${l.kind} ${state}`, 'aria-label': `${text || icon} ${state}`, disabled: !unlocked,
          style: { '--x': `${offset}px` },
          onclick: () => { location.hash = `#/lesson/${coll.id}/${l.id.slice(coll.id.length + 1)}`; },
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
    const tabs = collectionTabs(coll.id, (id) => `#/learn/${id}`);
    col.replaceChildren(...(tabs ? [tabs] : []), ...units);
    root.querySelector('.node.current')?.scrollIntoView({ block: 'center' });
  });
  return () => { alive = false; };
}
