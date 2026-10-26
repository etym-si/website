// Glyph rendering from compiled data (no fetching here; bundles are loaded by src/content.ts).
// - Historical stages: filled outlines from Wikimedia Commons (public domain).
// - Regular script (traditional + simplified): stroke outlines + medians from hanzi-writer-data (Arphic PL),
//   which lets us animate real stroke order.
import { s, nextId } from './dom';
import type { FormB, GlyphData, StrokesB } from '../shared/bundle-types.ts';

export const INK = '#2b2522';
export const PAPER = '#f7f0e1';

/** Built glyph, ready to animate. `wrap` is safe to animate with CSS transforms (it has no transform attribute). */
export interface GlyphInstance {
  kind: 'hist' | 'hanzi';
  wrap: SVGGElement;
  fills: SVGElement[];
  outlines: SVGPathElement[]; // hist: outline clones for the "sketch" pass
  strokes: { median: SVGPathElement; fill: SVGPathElement; len: number }[]; // hanzi: per-stroke parts
}

/** Historical glyph, normalized so its box maps to a size×size square centered on (0,0). */
export function buildHist(st: Pick<FormB, 'box' | 'paths'>, size: number, ink = INK): GlyphInstance {
  const [bx, by, bw, bh] = st.box;
  const k = size / Math.max(bw, bh);
  const inner = s('g', { transform: `scale(${k}) translate(${-(bx + bw / 2)},${-(by + bh / 2)})` });
  const fills: SVGElement[] = [];
  const outlines: SVGPathElement[] = [];
  for (const p of st.paths) {
    const common = { d: p.d, transform: p.t, 'fill-rule': p.rule };
    if (p.mode === 'stroke') {
      const el = s('path', { ...common, fill: 'none', stroke: ink, 'stroke-width': p.w ?? 4, 'stroke-linecap': 'round', pathLength: 1, class: 'g-fill g-stroke' });
      fills.push(el);
      outlines.push(el);
      inner.appendChild(el);
      continue;
    }
    const fill = s('path', { ...common, fill: p.mode === 'knockout' ? PAPER : ink, class: 'g-fill' });
    fills.push(fill);
    inner.appendChild(fill);
    if (p.mode !== 'knockout') {
      const ol = s('path', { ...common, fill: 'none', stroke: ink, 'stroke-width': 2.6 / k, 'stroke-linejoin': 'round', pathLength: 1, class: 'g-outline' });
      outlines.push(ol);
      inner.appendChild(ol);
    }
  }
  const wrap = s('g', { class: 'glyph hist' }, inner);
  return { kind: 'hist', wrap, fills, outlines, strokes: [] };
}

function polylineLength(pts: [number, number][]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Regular-script glyph from hanzi-writer data: each stroke = clipPath(outline) + wide median line. */
export function buildHanzi(data: StrokesB, size: number, ink = INK): GlyphInstance {
  const k = size / 1024;
  const inner = s('g', { transform: `scale(${k}) translate(-512,-512) translate(0,900) scale(1,-1)` });
  const defs = s('defs');
  inner.appendChild(defs);
  const strokes: GlyphInstance['strokes'] = [];
  const fills: SVGElement[] = [];
  data.strokes.forEach((d, i) => {
    const id = nextId('stk');
    defs.appendChild(s('clipPath', { id }, s('path', { d })));
    const pts = data.medians[i];
    const md = 'M' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L');
    const median = s('path', {
      d: md, fill: 'none', stroke: ink, 'stroke-width': 150, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'clip-path': `url(#${id})`, pathLength: 1, class: 'g-median',
    });
    const fill = s('path', { d, fill: ink, class: 'g-fill' });
    inner.appendChild(median);
    inner.appendChild(fill);
    fills.push(fill);
    strokes.push({ median, fill, len: polylineLength(pts) });
  });
  const wrap = s('g', { class: 'glyph hanzi' }, inner);
  return { kind: 'hanzi', wrap, fills, outlines: [], strokes };
}

/** Make a built glyph fully visible with no animation (for quizzes, stickers, instant scene setup). */
export function showInstant(g: GlyphInstance): GlyphInstance {
  g.outlines.forEach((o) => {
    if (o.classList.contains('g-stroke')) o.style.strokeDashoffset = '0';
    else o.style.opacity = '0';
  });
  g.strokes.forEach((x) => { x.median.style.opacity = '0'; });
  g.fills.forEach((f) => { f.style.opacity = '1'; });
  g.wrap.classList.add('shown');
  return g;
}

/** Build a compiled glyph: a Commons form (sketch-then-ink) or regular-script stroke data (stroke order). */
export function glyphFromData(data: GlyphData, size: number, ink = INK): GlyphInstance {
  return data.kind === 'paths' ? buildHist(data.form, size, ink) : buildHanzi(data.strokes, size, ink);
}

/** A standalone static SVG of a compiled glyph (quiz cards, sticker book). */
export function staticGlyph(data: GlyphData, px: number, ink = INK): SVGSVGElement {
  const g = showInstant(glyphFromData(data, 100, ink));
  return s('svg', { viewBox: '-55 -55 110 110', width: px, height: px, class: 'glyph-svg', role: 'img', 'aria-hidden': 'true' }, g.wrap);
}
