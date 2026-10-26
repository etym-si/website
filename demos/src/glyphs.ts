// Glyph data: loading (validated) and SVG construction.
// - Historical stages (oracle/bronze/seal/clerical): filled outlines from Wikimedia Commons (public domain).
// - Regular script (traditional + simplified): stroke outlines + medians from hanzi-writer-data (Arphic PL),
//   which lets us animate real stroke order.
import { s, nextId } from './dom';
import type { GlyphData } from '../shared/bundle-types.ts';
import type { StageId } from './data/stages';

export type HistStageId = 'oracle' | 'bronze' | 'seal' | 'clerical';
export interface GlyphPath {
  d: string;
  t?: string;
  mode?: 'stroke' | 'knockout';
  w?: number;
  rule?: 'evenodd';
}
export interface HistStage {
  stage: HistStageId;
  form: string;
  variant: string;
  src: string;
  box: [number, number, number, number];
  paths: GlyphPath[];
  /** Provenance from the Commons file: which artifact this glyph was traced from (e.g. "鐵180.2 合5216"). */
  prov?: { period: string; code: string; note: string };
}
export interface GlyphDoc {
  char: string;
  trad: string;
  stages: HistStage[];
  hanzi: string[];
}
export interface HanziData {
  strokes: string[];
  medians: [number, number][][];
}
/** A reference to one form of a character, as used in animation scripts. */
export interface GlyphSel {
  char: string;
  stage: Exclude<StageId, 'picture'>;
  index?: number; // nth occurrence of that stage (e.g. 草 has two seal forms)
}

export const INK = '#2b2522';
export const PAPER = '#f7f0e1';

const SAFE_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE\s,.+-]*$/;
const SAFE_T = /^[a-zA-Z0-9\s,.()+-]*$/;
const HIST: ReadonlySet<string> = new Set(['oracle', 'bronze', 'seal', 'clerical']);

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function validateGlyphDoc(v: unknown): GlyphDoc {
  const o = v as Record<string, unknown>;
  if (!o || !isStr(o.char) || !isStr(o.trad) || !Array.isArray(o.stages) || !Array.isArray(o.hanzi)) throw new Error('bad glyph doc');
  const stages = o.stages.map((st): HistStage => {
    const x = st as Record<string, unknown>;
    if (!isStr(x.stage) || !HIST.has(x.stage) || !isStr(x.form) || !isStr(x.variant) || !isStr(x.src)) throw new Error('bad stage');
    if (!Array.isArray(x.box) || x.box.length !== 4 || !x.box.every(isNum)) throw new Error('bad box');
    if (!Array.isArray(x.paths) || x.paths.length === 0) throw new Error('bad paths');
    const paths = x.paths.map((p): GlyphPath => {
      const q = p as Record<string, unknown>;
      if (!isStr(q.d) || !SAFE_D.test(q.d)) throw new Error('bad d');
      if (q.t !== undefined && (!isStr(q.t) || !SAFE_T.test(q.t))) throw new Error('bad transform');
      const mode = q.mode === 'stroke' || q.mode === 'knockout' ? q.mode : undefined;
      return { d: q.d, t: q.t as string | undefined, mode, w: isNum(q.w) ? q.w : undefined, rule: q.rule === 'evenodd' ? 'evenodd' : undefined };
    });
    const p = x.prov as Record<string, unknown> | undefined;
    const short = (v: unknown, n: number) => (isStr(v) ? v.slice(0, n) : '');
    const prov = p && typeof p === 'object' ? { period: short(p.period, 20), code: short(p.code, 12), note: short(p.note, 120) } : undefined;
    return { stage: x.stage as HistStageId, form: x.form, variant: x.variant, src: x.src, box: x.box as HistStage['box'], paths, prov };
  });
  return { char: o.char, trad: o.trad, stages, hanzi: o.hanzi.filter(isStr) };
}

function validateHanzi(v: unknown): HanziData {
  const o = v as Record<string, unknown>;
  if (!o || !Array.isArray(o.strokes) || !Array.isArray(o.medians) || o.strokes.length !== o.medians.length) throw new Error('bad hanzi');
  const strokes = o.strokes.map((d) => {
    if (!isStr(d) || !SAFE_D.test(d)) throw new Error('bad stroke');
    return d;
  });
  const medians = o.medians.map((pts) => {
    if (!Array.isArray(pts)) throw new Error('bad median');
    return pts.map((pt) => {
      if (!Array.isArray(pt) || pt.length !== 2 || !isNum(pt[0]) || !isNum(pt[1])) throw new Error('bad point');
      return [pt[0], pt[1]] as [number, number];
    });
  });
  return { strokes, medians };
}

const base = import.meta.env.BASE_URL;
const glyphCache = new Map<string, Promise<GlyphDoc>>();
const hanziCache = new Map<string, Promise<HanziData>>();

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(base + path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function loadGlyph(ch: string): Promise<GlyphDoc> {
  let p = glyphCache.get(ch);
  if (!p) {
    p = fetchJson(`glyphs/${encodeURIComponent(ch)}.json`).then(validateGlyphDoc);
    glyphCache.set(ch, p);
  }
  return p;
}

export function loadHanzi(ch: string): Promise<HanziData> {
  let p = hanziCache.get(ch);
  if (!p) {
    p = fetchJson(`hanzi/${encodeURIComponent(ch)}.json`).then(validateHanzi);
    hanziCache.set(ch, p);
  }
  return p;
}

export function findHist(doc: GlyphDoc, stage: string, index = 0): HistStage | undefined {
  return doc.stages.filter((x) => x.stage === stage)[index];
}

/** Built glyph, ready to animate. `wrap` is safe to animate with CSS transforms (it has no transform attribute). */
export interface GlyphInstance {
  kind: 'hist' | 'hanzi';
  wrap: SVGGElement;
  fills: SVGElement[];
  outlines: SVGPathElement[]; // hist: outline clones for the "sketch" pass
  strokes: { median: SVGPathElement; fill: SVGPathElement; len: number }[]; // hanzi: per-stroke parts
}

/** Historical glyph, normalized so its 300-unit box maps to a size×size square centered on (0,0). */
export function buildHist(st: Pick<HistStage, 'box' | 'paths'>, size: number, ink = INK): GlyphInstance {
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
export function buildHanzi(data: HanziData, size: number, ink = INK): GlyphInstance {
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

/** Resolve a script reference to a built (not yet animated) glyph instance. */
export async function buildSel(sel: GlyphSel, size: number, ink = INK): Promise<GlyphInstance> {
  const doc = await loadGlyph(sel.char);
  if (sel.stage === 'regular' || sel.stage === 'simplified') {
    const ch = sel.stage === 'regular' ? doc.trad : doc.char;
    return buildHanzi(await loadHanzi(ch), size, ink);
  }
  const st = findHist(doc, sel.stage, sel.index ?? 0);
  if (!st) throw new Error(`no ${sel.stage} form for ${sel.char}`);
  return buildHist(st, size, ink);
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

/** A standalone static SVG of one glyph form (quiz cards, sticker book). */
export async function staticGlyphSvg(sel: GlyphSel, px: number, ink = INK): Promise<SVGSVGElement> {
  const g = showInstant(await buildSel(sel, 100, ink));
  return s('svg', { viewBox: '-55 -55 110 110', width: px, height: px, class: 'glyph-svg', role: 'img', 'aria-hidden': 'true' }, g.wrap);
}
