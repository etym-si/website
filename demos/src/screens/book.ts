import { h } from '../dom';
import { t, tx } from '../i18n';
import { settings } from '../settings';
import { header } from '../ui/common';
import { BY_CHAR, UNITS, displayChar } from '../data/chars';
import { progress, resetProgress } from '../progress';
import { staticGlyphSvg, loadGlyph } from '../glyphs';

export function renderBook(root: HTMLElement): () => void {
  const p = progress();
  const script = settings().script;
  const total = UNITS.reduce((n, u) => n + u.chars.length, 0);
  let armed = false;
  const reset = h('button', {
    type: 'button', class: 'btn btn-ghost small',
    onclick: () => {
      if (!armed) { armed = true; reset.textContent = t('resetConfirm'); return; }
      resetProgress();
      location.hash = '#/learn';
    },
  }, t('resetProgress'));

  const grids = UNITS.map((u) => {
    const cells = u.chars.map((ch) => {
      const got = p.stickers.includes(ch);
      const art = h('span', { class: 'sticker-art' });
      // the oldest form we have, as a little ink stamp
      loadGlyph(ch).then(async (doc) => {
        const st = doc.stages[0];
        const svg = await staticGlyphSvg(st ? { char: ch, stage: st.stage } : { char: ch, stage: 'regular' }, 54, got ? '#b8321f' : '#9b9187');
        art.appendChild(svg);
      }).catch(() => {});
      return h('a', {
        class: `sticker ${got ? 'got' : 'missing'}`, href: `#/theater/${encodeURIComponent(ch)}`, style: { '--u': u.color },
        'aria-label': got ? `${ch} ${BY_CHAR[ch].pinyin}` : '?',
      }, art, h('span', { class: 'sticker-char', lang: 'zh' }, got ? displayChar(BY_CHAR[ch], script) : '?'),
      got ? h('span', { class: 'sticker-pinyin' }, BY_CHAR[ch].pinyin) : null);
    });
    return h('section', { class: 'book-unit' },
      h('h2', { style: { color: u.color } }, `${t('unit')} ${u.n} · ${tx(u.title)}`),
      h('div', { class: 'sticker-grid' }, ...cells));
  });

  root.replaceChildren(
    header({ showStats: true }),
    h('main', { class: 'book' },
      h('h1', { class: 'page-title' }, `📒 ${t('bookTitle')}`),
      h('p', { class: 'book-count' }, `${p.stickers.length} / ${total} ${t('collected')}`, p.stickers.length === 0 ? ` · ${t('bookEmpty')}` : ''),
      ...grids,
      h('div', { class: 'book-foot' }, reset)),
  );
  return () => {};
}
