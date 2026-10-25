// "Real artifact" polaroid card + close-up dialog.
import { h } from '../dom';
import { t, tx } from '../i18n';
import { chime } from '../audio';
import type { ArtifactCredit, ArtifactRef } from '../data/artifacts';

const base = import.meta.env.BASE_URL;

function badge(kind: ArtifactRef['kind']): HTMLElement {
  const label = { exact: t('artifactExact'), book: t('artifactBook'), appears: t('artifactAppears'), example: t('artifactExample') }[kind];
  const icon = { exact: '✔', book: '📖', appears: '🔍', example: '📷' }[kind];
  return h('span', { class: `a-badge a-${kind}` }, `${icon} ${label}`);
}

function photo(img: ArtifactCredit, alt: string, cls = ''): HTMLImageElement {
  return h('img', { src: base + img.file, alt, width: img.w, height: img.h, loading: 'lazy', decoding: 'async', class: cls, referrerpolicy: 'no-referrer' });
}

function creditLine(img: ArtifactCredit): HTMLElement {
  // TODO(kids-safety): put a parental gate in front of external links in the real app.
  return h('p', { class: 'a-credit' },
    `${t('photo')}: ${img.author} · ${img.license} · `,
    h('a', { href: img.page, target: '_blank', rel: 'noopener noreferrer' }, `${t('viewSource')} ↗`));
}

let dialog: HTMLDialogElement | null = null;

/** Full-size view with the whole story, source reference and attribution. */
export function openArtifact(a: ArtifactRef): void {
  dialog?.remove();
  const close = h('button', { type: 'button', class: 'a-close', 'aria-label': t('close') }, '✕');
  dialog = h('dialog', { class: 'a-dialog', 'aria-label': tx(a.title) },
    close,
    h('div', { class: 'a-dialog-body' },
      h('div', { class: 'a-dialog-photos' }, photo(a.img, tx(a.title)), a.img2 ? photo(a.img2, tx(a.title)) : null),
      h('div', { class: 'a-dialog-text' },
        badge(a.kind),
        h('h3', {}, tx(a.title)),
        h('p', {}, tx(a.text)),
        a.source ? h('p', { class: 'a-source' }, `${t('catalogue')}: ${a.source}`) : null,
        creditLine(a.img),
        a.img2 ? creditLine(a.img2) : null)));
  const d = dialog;
  close.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // click on the backdrop
  d.addEventListener('close', () => d.remove());
  document.body.appendChild(d);
  d.showModal();
  chime('pop');
}

/** Small polaroid that slides in next to the animation whenever the journey reaches a new stage. */
export function artifactCard(): { el: HTMLElement; show: (a: ArtifactRef | null) => void } {
  const el = h('button', { type: 'button', class: 'artifact-card hidden', 'aria-haspopup': 'dialog' });
  let current: ArtifactRef | null = null;
  el.addEventListener('click', () => { if (current) openArtifact(current); });
  return {
    el,
    show(a) {
      current = a;
      if (!a) { el.classList.add('hidden'); return; }
      el.replaceChildren(
        photo(a.img, tx(a.title), 'a-thumb'),
        h('span', { class: 'a-meta' },
          badge(a.kind),
          h('span', { class: 'a-title' }, tx(a.title)),
          h('span', { class: 'a-more' }, `${t('lookCloser')} →`)));
      el.classList.remove('hidden');
      el.setAttribute('aria-label', `${tx(a.title)}. ${t('lookCloser')}`);
      el.animate([
        { opacity: 0, transform: 'translateX(-30px) rotate(-6deg)' },
        { opacity: 1, transform: 'translateX(0) rotate(-2deg)' }], { duration: 450, easing: 'cubic-bezier(.3,1.4,.6,1)' });
    },
  };
}

/** Compact list of every artifact on a character's journey. */
export function artifactList(items: { icon: string; a: ArtifactRef }[]): HTMLElement {
  return h('div', { class: 'a-list' },
    h('h3', {}, `🏺 ${t('realArtifacts')}`),
    h('ul', {}, ...items.map(({ icon, a }) =>
      h('li', {}, h('button', { type: 'button', class: 'a-row', onclick: () => openArtifact(a) },
        photo(a.img, '', 'a-row-thumb'),
        h('span', { class: 'a-row-text' }, h('span', { class: 'a-row-title' }, `${icon} ${tx(a.title)}`), badge(a.kind)))))));
}
