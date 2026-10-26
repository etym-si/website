import { h } from '../dom';
import { signText, t, tx } from '../i18n';
import { header } from '../ui/common';
import { defaultCollectionId, loadCollection, loadSign, system } from '../content';
import { staticGlyph } from '../glyphs';
import { firstGlyph } from '../play-source';
import { progress, resetProgress } from '../progress';
import { collectionTabs } from './path';

export function renderBook(root: HTMLElement, collectionId: string): () => void {
  let alive = true;
  const main = h('main', { class: 'book' }, h('h1', { class: 'page-title' }, `📒 ${t('bookTitle')}`));
  root.replaceChildren(header({ showStats: true }), main);
  // Sticker stamps load their sign bundle only when they scroll into view (collections can be large).
  const loaders = new Map<Element, () => void>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      loaders.get(e.target)?.();
      loaders.delete(e.target);
    }
  }, { rootMargin: '200px' });
  void loadCollection(collectionId).catch(() => loadCollection(defaultCollectionId())).then((coll) => {
    if (!alive) return;
    const sys = system(coll.system);
    const got = new Set(progress().stickers);
    const keys = coll.units.flatMap((u) => u.signs);
    const collected = keys.filter((k) => got.has(k)).length;
    let armed = false;
    const reset = h('button', {
      type: 'button', class: 'btn btn-ghost small',
      onclick: () => {
        if (!armed) { armed = true; reset.textContent = t('resetConfirm'); return; }
        resetProgress();
        location.hash = `#/learn/${coll.id}`;
      },
    }, t('resetProgress'));
    const grids = coll.units.map((u) => {
      const cells = u.signs.map((key) => {
        const sum = coll.signs[key];
        const have = got.has(key);
        const art = h('span', { class: 'sticker-art' });
        // the oldest form we have, as a little ink stamp
        loaders.set(art, () => {
          void loadSign(sum).then((b) => {
            const g = firstGlyph(b, sys);
            if (g && alive) art.appendChild(staticGlyph(g, 54, have ? '#b8321f' : '#9b9187'));
          }).catch(() => {});
        });
        io.observe(art);
        return h('a', {
          class: `sticker ${have ? 'got' : 'missing'}`, href: `#/theater/${coll.system}/${encodeURIComponent(sum.id)}`, style: { '--u': u.color },
          'aria-label': have ? `${signText(sum.text)} ${sum.reading}` : '?',
        }, art, h('span', { class: 'sticker-char', lang: 'zh' }, have ? signText(sum.text) : '?'),
        have ? h('span', { class: 'sticker-pinyin' }, sum.reading) : null);
      });
      return h('section', { class: 'book-unit' },
        h('h2', { style: { color: u.color } }, `${t('unit')} ${u.n} · ${tx(u.title)}`),
        h('div', { class: 'sticker-grid' }, ...cells));
    });
    const tabs = collectionTabs(coll.id, (id) => `#/book/${id}`);
    main.append(
      ...(tabs ? [tabs] : []),
      h('p', { class: 'book-count' }, `${collected} / ${keys.length} ${t('collected')}`, collected === 0 ? ` · ${t('bookEmpty')}` : ''),
      ...grids,
      h('div', { class: 'book-foot' }, reset),
    );
  });
  return () => {
    alive = false;
    io.disconnect();
  };
}
