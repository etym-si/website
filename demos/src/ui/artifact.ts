// "Real artifact" polaroid card + close-up dialog with red highlight circles & zoomed carving comparison.
import { h, s } from '../dom';
import { t, tx } from '../i18n';
import { chime } from '../audio';
import { buildHist, showInstant } from '../glyphs';
import type { ArtifactCredit, ArtifactMark, ArtifactRef } from '../data/artifacts';

const base = import.meta.env.BASE_URL;

function badge(kind: ArtifactRef['kind']): HTMLElement {
  const label = { exact: t('artifactExact'), book: t('artifactBook'), appears: t('artifactAppears'), example: t('artifactExample') }[kind];
  const icon = { exact: '✔', book: '📖', appears: '🔍', example: t('artifactExample') && '📷' }[kind];
  return h('span', { class: `a-badge a-${kind}` }, `${icon} ${label}`);
}

function photo(img: ArtifactCredit, alt: string, cls = ''): HTMLImageElement {
  return h('img', { src: base + img.file, alt, width: img.w, height: img.h, loading: 'lazy', decoding: 'async', class: cls, referrerpolicy: 'no-referrer' });
}

function drawMark(img: ArtifactCredit, m: ArtifactMark, viewSpan: number, dashed = false): SVGGElement {
  const cx = (m.x + m.w / 2) * img.w;
  const cy = (m.y + m.h / 2) * img.h;
  const pad = Math.max(img.w, img.h) * 0.011;
  const rx = (m.w * img.w) / 2 + pad;
  const ry = (m.h * img.h) / 2 + pad;
  const sw = Math.max(2.5, viewSpan * 0.0095);
  return s('g', { class: 'a-mark' },
    s('ellipse', {
      cx, cy, rx, ry,
      fill: dashed ? 'none' : 'rgba(232, 69, 60, 0.12)',
      stroke: '#fff8e7',
      'stroke-opacity': '0.92',
      'stroke-width': sw * 1.9,
    }),
    s('ellipse', {
      cx, cy, rx, ry,
      fill: 'none',
      stroke: '#e8453c',
      'stroke-width': sw,
      'stroke-dasharray': dashed ? `${sw * 2.2} ${sw * 1.4}` : undefined,
      class: 'a-mark-ring',
    }));
}

/** Full artifact SVG with red circle overlay(s) in exact image coordinates. */
function markedPhotoSvg(img: ArtifactCredit, alt: string, marks: ArtifactMark[], cls = ''): SVGSVGElement {
  const span = Math.max(img.w, img.h);
  return s('svg', { viewBox: `0 0 ${img.w} ${img.h}`, class: `a-svg ${cls}`, role: 'img', 'aria-label': alt },
    s('image', { href: base + img.file, width: img.w, height: img.h }),
    ...marks.map((m) => drawMark(img, m, span)));
}

/** 4:3 thumbnail framed around the first marked character so the red circle is always in view. */
function markedThumbSvg(img: ArtifactCredit, alt: string, marks: ArtifactMark[], cls = '', aspect = 0.75): SVGSVGElement {
  const m = marks[0];
  const vw = Math.min(img.w, Math.max(img.w * 0.62, m.w * img.w * 5.2));
  const vh = Math.min(img.h, vw * aspect);
  const cx = (m.x + m.w / 2) * img.w;
  const cy = (m.y + m.h / 2) * img.h;
  const vx = Math.max(0, Math.min(img.w - vw, cx - vw / 2));
  const vy = Math.max(0, Math.min(img.h - vh, cy - vh / 2));
  const span = Math.max(vw, vh);
  return s('svg', {
    viewBox: `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`,
    preserveAspectRatio: 'xMidYMid slice',
    class: `a-svg ${cls}`,
    role: 'img',
    'aria-label': alt,
  },
    s('image', { href: base + img.file, width: img.w, height: img.h }),
    ...marks.map((mk) => drawMark(img, mk, span)));
}

/** Close-up square crop around a single marked character + side-by-side comparison with our glyph. */
function buildCompare(a: ArtifactRef, fullSvg: SVGSVGElement): HTMLElement {
  const marks = a.marks ?? [];
  let hidden = false;
  const toggleBtn = h('button', {
    type: 'button',
    class: 'a-circle-toggle',
    onclick: () => {
      hidden = !hidden;
      fullSvg.classList.toggle('hide-marks', hidden);
      toggleBtn.textContent = `⭕ ${hidden ? t('showCircle') : t('hideCircle')}`;
    },
  }, `⭕ ${t('hideCircle')}`);

  const items = marks.map((m) => {
    const { img } = a;
    const mw = m.w * img.w;
    const mh = m.h * img.h;
    const span = Math.min(Math.min(img.w, img.h), Math.max(mw, mh) * 2.6);
    const cx = (m.x + m.w / 2) * img.w;
    const cy = (m.y + m.h / 2) * img.h;
    const vx = Math.max(0, Math.min(img.w - span, cx - span / 2));
    const vy = Math.max(0, Math.min(img.h - span, cy - span / 2));
    const zoomSvg = s('svg', {
      viewBox: `${vx.toFixed(1)} ${vy.toFixed(1)} ${span.toFixed(1)} ${span.toFixed(1)}`,
      class: 'a-zoom-svg',
      role: 'img',
      'aria-label': m.label ? tx(m.label) : tx(a.title),
    },
      s('image', { href: base + img.file, width: img.w, height: img.h }),
      drawMark(img, m, span, true));

    const glyphNode = a.hist
      ? s('svg', { viewBox: '-55 -55 110 110', class: 'a-compare-glyph', 'aria-hidden': 'true' }, showInstant(buildHist(a.hist, 100)).wrap)
      : h('span', { class: 'a-compare-char' }, a.disp ?? '');

    return h('div', { class: 'a-zoom-item' },
      h('div', { class: 'a-zoom-pair' },
        zoomSvg,
        h('span', { class: 'a-zoom-arrow', 'aria-hidden': 'true' }, '→'),
        h('div', { class: 'a-zoom-glyph-box' }, glyphNode)),
      m.label ? h('span', { class: 'a-zoom-label' }, tx(m.label)) : null);
  });

  return h('div', { class: 'a-compare' },
    h('div', { class: 'a-compare-head' },
      h('span', { class: 'a-compare-title' }, `🔍 ${t('compareGlyph')}`),
      toggleBtn),
    h('div', { class: 'a-zoom-list' }, ...items));
}

function creditLine(img: ArtifactCredit): HTMLElement {
  // TODO(kids-safety): put a parental gate in front of external links in the real app.
  return h('p', { class: 'a-credit' },
    `${t('photo')}: ${img.author} · ${img.license} · `,
    h('a', { href: img.page, target: '_blank', rel: 'noopener noreferrer' }, `${t('viewSource')} ↗`));
}

let dialog: HTMLDialogElement | null = null;

/** Full-size view with the whole story, red circle overlay, zoomed comparison, and attribution. */
export function openArtifact(a: ArtifactRef, onModal?: (open: boolean) => void): void {
  dialog?.remove();
  const close = h('button', { type: 'button', class: 'a-close', 'aria-label': t('close') }, '✕');
  const hasMarks = Boolean(a.marks && a.marks.length > 0);
  const mainVisual = hasMarks
    ? markedPhotoSvg(a.img, tx(a.title), a.marks!, 'a-full-svg')
    : photo(a.img, tx(a.title));
  const compareBox = hasMarks && mainVisual instanceof SVGSVGElement ? buildCompare(a, mainVisual) : null;

  dialog = h('dialog', { class: 'a-dialog', 'aria-label': tx(a.title) },
    close,
    h('div', { class: 'a-dialog-body' },
      h('div', { class: 'a-dialog-photos' }, mainVisual, a.img2 ? photo(a.img2, tx(a.title)) : null),
      h('div', { class: 'a-dialog-text' },
        badge(a.kind),
        h('h3', {}, tx(a.title)),
        h('p', {}, tx(a.text)),
        compareBox,
        a.source ? h('p', { class: 'a-source' }, `${t('catalogue')}: ${a.source}`) : null,
        creditLine(a.img),
        a.img2 ? creditLine(a.img2) : null)));
  const d = dialog;
  close.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // click on the backdrop
  d.addEventListener('close', () => { d.remove(); onModal?.(false); });
  document.body.appendChild(d);
  onModal?.(true);
  d.showModal();
  chime('pop');
}

/** Small polaroid that slides in next to the animation whenever the journey reaches a new stage. */
export function artifactCard(onModal?: (open: boolean) => void): { el: HTMLElement; show: (a: ArtifactRef | null) => void } {
  const el = h('button', { type: 'button', class: 'artifact-card hidden', 'aria-haspopup': 'dialog' });
  let current: ArtifactRef | null = null;
  el.addEventListener('click', () => { if (current) openArtifact(current, onModal); });
  return {
    el,
    show(a) {
      current = a;
      if (!a) { el.classList.add('hidden'); return; }
      const thumb = a.marks?.length
        ? markedThumbSvg(a.img, tx(a.title), a.marks, 'a-thumb')
        : photo(a.img, tx(a.title), 'a-thumb');
      el.replaceChildren(
        thumb,
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
export function artifactList(items: { icon: string; a: ArtifactRef }[], onModal?: (open: boolean) => void): HTMLElement {
  return h('div', { class: 'a-list' },
    h('h3', {}, `🏺 ${t('realArtifacts')}`),
    h('ul', {}, ...items.map(({ icon, a }) => {
      const rowThumb = a.marks?.length
        ? markedThumbSvg(a.img, '', a.marks, 'a-row-thumb', 1)
        : photo(a.img, '', 'a-row-thumb');
      return h('li', {}, h('button', { type: 'button', class: 'a-row', onclick: () => openArtifact(a, onModal) },
        rowThumb,
        h('span', { class: 'a-row-text' }, h('span', { class: 'a-row-title' }, `${icon} ${tx(a.title)}`), badge(a.kind))));
    })));
}
