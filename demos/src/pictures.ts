// Original, kid-friendly picture illustrations for the etym.si demo (Units 1–2) and the mascot Gugu.
//
// Every picture is assembled from SVG primitives with s() (createElementNS). Nothing is parsed from
// markup and all path data is written here. Coordinates live in a 300×300 box (mascot: 200×200).
// Style: flat, rounded shapes; outline #3a2e2a, 7px, round caps/joins; inner details 4–5px.
//
// Each main silhouette follows the layout of its oracle-bone glyph (see shots/pictures-overlay.png),
// so when the glyph is drawn over the picture, kids can see that the glyph IS the picture.
//
// Animation hooks (see pictures.css): .pic-rays, .pic-flow, .pic-stream, .pic-wing, .m-eye, .m-arm-r.
// Those groups never carry a transform attribute, so CSS transforms can animate them safely.

import { s } from './dom';

export interface PictureDef {
  /** Build the illustration inside a 300×300 box ((0,0)–(300,300)); keep ~20px margin. Return a fresh <g> each call. */
  build: () => SVGGElement;
  /** Degrees (clockwise) to rotate the picture about (150,150) so it lines up with the oracle-bone glyph. Oracle script writes most animals standing up (head at top, legs on the LEFT, back on the right), so an animal drawn facing LEFT in its natural pose needs rotate: 90. Use 0 when no rotation is needed. */
  rotate: number;
  /** Ambient motion hint the engine may use. */
  ambient?: 'glow' | 'flow' | 'sway' | 'flap' | 'bob';
}

// ───────────────────────────── palette & style ─────────────────────────────

const INK = '#3a2e2a';
const SW = 7; // main outline width
const DW = 4.5; // inner detail width

const COL = {
  sun: '#f5b82e',
  sunDeep: '#f39424',
  sunLight: '#ffd767',
  red: '#e8453c',
  sky: '#4aa3df',
  skyDark: '#2f7fc1',
  water: '#3d9be9',
  waterLight: '#8fd3ff',
  leaf: '#58b947',
  leafDark: '#2f8f3a',
  leafLight: '#8fd870',
  trunk: '#8b5a2b',
  earth: '#c98b4a',
  earthLight: '#dda66a',
  fieldY: '#e3c66b',
  fieldYDark: '#c9a443',
  fieldG: '#9ccc65',
  fieldGDark: '#6fa83f',
  bamboo: '#6cbf4f',
  elephant: '#5b7fc7',
  elephantDark: '#4867ab',
  elephantLight: '#8eaaf0',
  horse: '#b0703c',
  horseDark: '#8f5a2e',
  horseLight: '#d39a63',
  skin: '#f2c79a',
  clothes: '#4aa3df',
  clothesDark: '#2f78c4',
  turtle: '#7cc96b',
  turtleLight: '#a8e092',
  shell: '#c9824a',
  plate: '#e2a86b',
  white: '#ffffff',
  cream: '#fff4dc',
  blush: '#f48f86',
  hairShine: '#6f5a50',
} as const;

// ───────────────────────────── tiny drawing kit ─────────────────────────────

type Attr = Record<string, string | number>;
type Kid = SVGElement | null | undefined | false;
type Pt = readonly [number, number];
type Circ = readonly [number, number, number];
type Tube = readonly [string, number];

const ROUND: Attr = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const OUTLINE: Attr = { stroke: INK, 'stroke-width': SW, ...ROUND };

/** Round to 0.1 so generated path data stays short. */
const rd = (v: number): number => Math.round(v * 10) / 10;
/** "x y" pair for path data. */
const P = (x: number, y: number): string => `${rd(x)} ${rd(y)}`;

function g(cls: string | null, ...kids: Kid[]): SVGGElement {
  return s('g', cls ? { class: cls } : undefined, ...kids);
}
/** Fresh root group for a picture. */
function pic(name: string, ...kids: Kid[]): SVGGElement {
  return g(`pic pic-${name}`, ...kids);
}
/** Filled shape with the standard outline. */
function shape(d: string, fill: string, extra: Attr = {}): SVGPathElement {
  return s('path', { d, fill, ...OUTLINE, ...extra });
}
/** Filled shape, no outline. */
function flat(d: string, fill: string, extra: Attr = {}): SVGPathElement {
  return s('path', { d, fill, ...extra });
}
/** Stroke-only line. */
function line(d: string, w: number = SW, color: string = INK, extra: Attr = {}): SVGPathElement {
  return s('path', { d, fill: 'none', stroke: color, 'stroke-width': w, ...ROUND, ...extra });
}
function circle(cx: number, cy: number, r: number, fill: string, extra: Attr = {}): SVGCircleElement {
  return s('circle', { cx: rd(cx), cy: rd(cy), r: rd(r), fill, ...OUTLINE, ...extra });
}
function dot(cx: number, cy: number, r: number, fill: string, extra: Attr = {}): SVGCircleElement {
  return s('circle', { cx: rd(cx), cy: rd(cy), r: rd(r), fill, ...extra });
}
function oval(cx: number, cy: number, rx: number, ry: number, fill: string, extra: Attr = {}): SVGEllipseElement {
  return s('ellipse', { cx: rd(cx), cy: rd(cy), rx: rd(rx), ry: rd(ry), fill, ...OUTLINE, ...extra });
}
function flatOval(cx: number, cy: number, rx: number, ry: number, fill: string, extra: Attr = {}): SVGEllipseElement {
  return s('ellipse', { cx: rd(cx), cy: rd(cy), rx: rd(rx), ry: rd(ry), fill, ...extra });
}
/** Fill, then inner details, then the outline on top, so details never cover the outline. */
function layered(d: string, fill: string, ...inner: Kid[]): SVGGElement {
  return g(null, flat(d, fill), ...inner, line(d));
}
/** Outlined tubes (stems, trunks, limbs). All dark under-strokes first, so joints merge seamlessly. */
function tubes(color: string, parts: readonly Tube[]): SVGGElement {
  return g(null, ...parts.map(([d, w]) => line(d, w + SW * 2)), ...parts.map(([d, w]) => line(d, w, color)));
}
/** Cloud-like union of circles with a single outer outline. */
function blob(fill: string, circles: readonly Circ[]): SVGGElement {
  return g(null, ...circles.map(([x, y, r]) => dot(x, y, r + SW, INK)), ...circles.map(([x, y, r]) => dot(x, y, r, fill)));
}
/** Shiny cartoon eye. */
function eye(cx: number, cy: number, r: number): SVGGElement {
  return g(null, dot(cx, cy, r, INK), dot(cx - r * 0.32, cy - r * 0.36, r * 0.38, COL.white));
}
function blush(cx: number, cy: number, rx = 9, ry = 6): SVGEllipseElement {
  return flatOval(cx, cy, rx, ry, COL.blush, { opacity: 0.6 });
}
/** Point and unit tangent on a quadratic Bézier. */
function quadAt(p0: Pt, c: Pt, p1: Pt, t: number): { x: number; y: number; tx: number; ty: number } {
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
  const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
  const dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
  const dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, tx: dx / len, ty: dy / len };
}
/** A pointed leaf / grass blade from base to tip; `w` ≈ leaf width, `bend` curves it sideways. */
function leafD(base: Pt, tip: Pt, w: number, bend = 0): string {
  const [bx, by] = base;
  const [tx, ty] = tip;
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const nx = -(ty - by) / len;
  const ny = (tx - bx) / len;
  const mx = (bx + tx) / 2 + nx * bend;
  const my = (by + ty) / 2 + ny * bend;
  return `M${P(bx, by)} Q${P(mx + nx * w, my + ny * w)} ${P(tx, ty)} Q${P(mx - nx * w, my - ny * w)} ${P(bx, by)}Z`;
}
/** Midrib of a leaf drawn with leafD. */
function veinD(base: Pt, tip: Pt, bend = 0, inset = 0.18): string {
  const [bx, by] = base;
  const [tx, ty] = tip;
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const nx = -(ty - by) / len;
  const ny = (tx - bx) / len;
  const mx = (bx + tx) / 2 + nx * bend;
  const my = (by + ty) / 2 + ny * bend;
  const a = quadAt(base, [mx, my], tip, inset);
  const b = quadAt(base, [mx, my], tip, 1 - inset);
  const c = quadAt(base, [mx, my], tip, 0.5);
  return `M${P(a.x, a.y)} Q${P(2 * c.x - (a.x + b.x) / 2, 2 * c.y - (a.y + b.y) / 2)} ${P(b.x, b.y)}`;
}
function leaf(base: Pt, tip: Pt, w: number, bend: number, fill: string, vein: string): SVGGElement {
  return g(null, shape(leafD(base, tip, w, bend), fill), line(veinD(base, tip, bend), 3.5, vein));
}

// ───────────────────────────── 日 sun ─────────────────────────────
// Bronze 日 is a circle with a dot; oracle 日 a rounded box with a dash. Disc + center dot.

function sun(): SVGGElement {
  const c = 150;
  const rays: SVGElement[] = [];
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const isLong = i % 2 === 0;
    const r0 = 76;
    const r1 = isLong ? 129 : 115;
    const hw = isLong ? 17 : 13;
    // rounded-tip triangle: base hidden under the disc
    const bx1 = c + ux * r0 - uy * hw, by1 = c + uy * r0 + ux * hw;
    const bx2 = c + ux * r0 + uy * hw, by2 = c + uy * r0 - ux * hw;
    const tx = c + ux * r1, ty = c + uy * r1;
    const k = 10 / Math.hypot(tx - bx1, ty - by1);
    const d = `M${P(bx1, by1)} L${P(tx + (bx1 - tx) * k, ty + (by1 - ty) * k)} Q${P(tx, ty)} ${P(tx + (bx2 - tx) * k, ty + (by2 - ty) * k)} L${P(bx2, by2)}Z`;
    rays.push(shape(d, isLong ? COL.red : COL.sunDeep));
  }
  return pic('sun',
    g('pic-rays', ...rays),
    circle(c, c, 88, COL.sun),
    dot(c + 5, c + 5, 70, '#f8c544'),
    dot(c - 4, c - 4, 60, COL.sunLight),
    line('M 94 136 A 60 60 0 0 1 120 98', 10, COL.white, { opacity: 0.85 }),
    dot(90, 158, 4.5, COL.white, { opacity: 0.85 }),
    circle(c, c, 12, COL.red, { 'stroke-width': DW }),
    dot(c - 3.5, c - 3.5, 3.2, COL.white, { opacity: 0.9 }),
  );
}

// ───────────────────────────── 山 mountain ─────────────────────────────
// Three peaks, the middle one tallest, standing on one flat base line.

function peakD(ax: number, ay: number, lx: number, rx: number, by: number, rr = 13): string {
  const ll = Math.hypot(lx - ax, by - ay);
  const rl = Math.hypot(rx - ax, by - ay);
  const p1 = P(ax + ((lx - ax) * rr) / ll, ay + ((by - ay) * rr) / ll);
  const p2 = P(ax + ((rx - ax) * rr) / rl, ay + ((by - ay) * rr) / rl);
  return `M${P(lx, by)} L${p1} Q${P(ax, ay)} ${p2} L${P(rx, by)}Z`;
}
function snowD(ax: number, ay: number, lx: number, rx: number, by: number, depth: number, rr = 13): string {
  const t = depth / (by - ay);
  const y = ay + depth;
  const xl = ax + (lx - ax) * t;
  const xr = ax + (rx - ax) * t;
  const ll = Math.hypot(lx - ax, by - ay);
  const rl = Math.hypot(rx - ax, by - ay);
  const p1 = P(ax + ((lx - ax) * rr) / ll, ay + ((by - ay) * rr) / ll);
  const p2 = P(ax + ((rx - ax) * rr) / rl, ay + ((by - ay) * rr) / rl);
  let d = `M${P(xl, y)} L${p1} Q${P(ax, ay)} ${p2} L${P(xr, y)}`;
  const n = 3;
  const w = (xr - xl) / n;
  for (let i = 0; i < n; i++) {
    const x0 = xr - i * w;
    const x1 = xr - (i + 1) * w;
    d += ` Q${P((x0 + x1) / 2, y + 15)} ${P(x1, y)}`;
  }
  return `${d}Z`;
}

function mountain(): SVGGElement {
  const by = 244;
  const peak = (ax: number, ay: number, lx: number, rx: number, fill: string, shade: string, snow: number): SVGGElement =>
    layered(peakD(ax, ay, lx, rx, by), fill,
      flat(`M${P(ax, ay)} L${P(rx, by)} L${P(ax + (rx - ax) * 0.22, by)}Z`, shade),
      flat(snowD(ax, ay, lx, rx, by, snow), COL.white),
      flat(`M${P(ax + 3, ay + 6)} L${P(ax + (rx - ax) * (snow / (by - ay)), ay + snow)} L${P(ax + (rx - ax) * (snow / (by - ay)) * 0.45, ay + snow + 6)}Z`, '#d9eefb'),
    );
  return pic('mountain',
    peak(64, 80, 18, 126, COL.leafDark, '#257532', 32),
    peak(246, 86, 178, 282, COL.leafDark, '#257532', 32),
    peak(156, 42, 74, 240, COL.leaf, '#46a33a', 54),
    // little grass tufts on the slopes
    line('M 108 214 l 3 -8 l 3 8 l 3 -8 l 3 8 M 192 206 l 3 -8 l 3 8 l 3 -8 l 3 8 M 38 222 l 3 -8 l 3 8 l 3 -8 l 3 8', DW, '#2a7a33'),
    s('rect', { x: 16, y: 234, width: 268, height: 24, rx: 12, fill: COL.earth, ...OUTLINE }),
    line('M 40 246 h 22 M 128 246 h 34 M 220 246 h 26', DW, '#a86d34'),
  );
}

// ───────────────────────────── 水 water ─────────────────────────────
// A winding river (the S-curve of 水) with splash droplets on both sides.

const RIVER = 'M 165 28 C 145 56 124 86 130 118 C 136 150 168 165 166 200 C 164 235 142 256 133 276';

function drop(cx: number, cy: number, w: number, h: number, tilt: number): SVGGElement {
  const r = w / 2;
  const top = -h / 2;
  const cyc = h / 2 - r;
  const k = top + (h - r) * 0.38;
  const d = `M0 ${rd(top)} C${P(r * 0.35, k)} ${P(r, cyc - r * 0.95)} ${P(r, cyc)} A${rd(r)} ${rd(r)} 0 0 1 ${P(-r, cyc)} C${P(-r, cyc - r * 0.95)} ${P(-r * 0.35, k)} 0 ${rd(top)}Z`;
  return g('pic-flow',
    s('g', { transform: `translate(${cx} ${cy}) rotate(${tilt})` },
      shape(d, COL.waterLight),
      flatOval(-r * 0.36, cyc - r * 0.15, r * 0.2, r * 0.36, COL.white, { opacity: 0.9 })),
  );
}

function water(): SVGGElement {
  return pic('water',
    tubes(COL.water, [[RIVER, 32]]),
    // light ripples riding the current
    g('pic-flow', line(RIVER, 6, COL.waterLight, { 'stroke-dasharray': '18 24', class: 'pic-stream' })),
    drop(88, 90, 26, 46, 10),
    drop(196, 106, 26, 46, -8),
    drop(104, 234, 28, 52, 9),
    drop(213, 236, 28, 52, 4),
  );
}

// ───────────────────────────── 木 tree / 林 woods ─────────────────────────────
// Like the glyph: a trunk with a V of branches reaching up, and roots spreading down over a little hill.
// The branches are drawn in front of the leafy crown so the V stays visible.

interface TreeSpec {
  cx: number; // trunk x
  ground: number; // where the roots leave the trunk
  top: number; // top of the middle branch
  fork: number; // where the side branches leave the trunk
  tipL: Pt;
  tipR: Pt;
  roots: readonly Pt[];
  trunk: number;
  branch: number;
  root: number;
  crown: readonly Circ[]; // leafy crown (union of circles)
  leaf: string;
}

function treeWood(t: TreeSpec): Tube[] {
  const { cx, ground, top, fork, tipL, tipR } = t;
  const parts: Tube[] = [
    [`M${P(cx, ground + 2)} L${P(cx, fork + 4)}`, t.trunk],
    [`M${P(cx, fork + 10)} L${P(cx, top)}`, t.branch + 2],
    [`M${P(cx, fork + 8)} Q${P((cx + tipL[0]) / 2 + 4, (fork + tipL[1]) / 2 + 10)} ${P(tipL[0], tipL[1])}`, t.branch],
    [`M${P(cx, fork)} Q${P((cx + tipR[0]) / 2 - 4, (fork + tipR[1]) / 2 + 10)} ${P(tipR[0], tipR[1])}`, t.branch],
  ];
  for (const [x, y] of t.roots) {
    parts.push([`M${P(cx, ground - 6)} Q${P(cx + (x - cx) * 0.25, y - 8)} ${P(x, y)}`, t.root]);
  }
  return parts;
}

/** Leafy crown: a soft cloud with a few highlight dots. */
function crown(t: TreeSpec): SVGGElement {
  const lights: SVGElement[] = [];
  for (const [x, y, r] of t.crown) lights.push(dot(x - r * 0.38, y - r * 0.42, r * 0.2, COL.leafLight));
  return g(null, blob(t.leaf, t.crown), ...lights);
}

/** A rounded grassy hill for the trees to stand on. */
function hill(x0: number, x1: number, top: number, bottom: number): SVGGElement {
  const w = x1 - x0;
  const d = `M${P(x0, bottom)} C${P(x0 + w * 0.12, top + (bottom - top) * 0.2)} ${P(x0 + w * 0.3, top)} ${P(x0 + w / 2, top)} C${P(x1 - w * 0.3, top)} ${P(x1 - w * 0.12, top + (bottom - top) * 0.2)} ${P(x1, bottom)}Z`;
  const tufts: string[] = [];
  for (const [fx, fy] of [[0.16, 0.62], [0.84, 0.6], [0.32, 0.28], [0.7, 0.3]] as const) {
    const x = x0 + w * fx;
    const y = top + (bottom - top) * fy;
    tufts.push(`M${P(x - 6, y)} l 3 -8 l 3 8 l 3 -8 l 3 8`);
  }
  return g(null, shape(d, COL.fieldG), line(tufts.join(' '), DW, COL.fieldGDark));
}

function treeParts(t: TreeSpec): SVGGElement {
  return g(null, crown(t), tubes(COL.trunk, treeWood(t)));
}

function tree(): SVGGElement {
  const t: TreeSpec = {
    cx: 146, ground: 218, top: 50, fork: 118, tipL: [98, 62], tipR: [200, 56],
    roots: [[92, 262], [202, 258], [146, 272]], trunk: 24, branch: 13, root: 12,
    crown: [[146, 66, 42], [100, 80, 34], [192, 76, 34], [80, 112, 22], [212, 108, 22], [122, 114, 28], [172, 112, 28]],
    leaf: COL.leaf,
  };
  return pic('tree',
    hill(36, 264, 214, 276),
    treeParts(t),
    line(`M${P(t.cx - 4, 196)} v -20 M${P(t.cx + 5, 168)} v -14`, DW, '#6b431e'),
  );
}

function woods(): SVGGElement {
  const left: TreeSpec = {
    cx: 82, ground: 214, top: 50, fork: 120, tipL: [44, 74], tipR: [120, 60],
    roots: [[38, 262], [124, 256], [82, 272]], trunk: 20, branch: 11, root: 10,
    crown: [[82, 66, 34], [46, 86, 26], [118, 82, 26], [62, 112, 20], [104, 112, 20]],
    leaf: COL.leaf,
  };
  const right: TreeSpec = {
    cx: 208, ground: 214, top: 44, fork: 114, tipL: [168, 72], tipR: [250, 62],
    roots: [[164, 258], [258, 262], [208, 272]], trunk: 20, branch: 11, root: 10,
    crown: [[208, 60, 34], [172, 82, 26], [244, 78, 26], [188, 108, 20], [230, 106, 20]],
    leaf: '#4cad40',
  };
  return pic('woods',
    hill(18, 282, 210, 276),
    treeParts(left),
    treeParts(right),
  );
}

// ───────────────────────────── 鸟 bird ─────────────────────────────
// Standing upright, facing left: beak left, head on top, tail down at the back, legs below.

function bird(): SVGGElement {
  const body = 'M 128 80 C 110 108 108 152 122 188 C 134 216 158 234 186 230 C 212 226 224 198 222 160 C 220 124 206 96 186 80 Z';
  const wing = 'M 172 104 C 202 98 226 130 224 170 C 222 198 212 218 204 228 C 188 210 170 182 165 150 C 161 128 162 110 172 104 Z';
  const tail = 'M 194 210 C 210 226 226 240 244 248 C 238 262 220 266 208 258 C 206 268 190 272 180 262 C 182 246 184 228 184 214 Z';
  return pic('bird',
    shape(tail, COL.skyDark),
    line('M 196 236 L 214 254', DW, '#245f9c'),
    tubes(COL.sun, [
      ['M 150 226 L 147 266', 7], ['M 147 266 L 133 271', 6], ['M 147 266 L 146 276', 6], ['M 147 266 L 160 271', 6],
      ['M 172 228 L 175 266', 7], ['M 175 266 L 161 271', 6], ['M 175 266 L 175 276', 6], ['M 175 266 L 188 271', 6],
    ]),
    layered(body, COL.sky,
      flat('M 124 112 C 116 146 120 182 138 206 C 150 220 166 226 178 222 C 160 204 148 176 146 144 C 145 124 138 110 124 112 Z', '#bfe6ff')),
    g('pic-wing',
      shape(wing, COL.skyDark),
      line('M 182 128 C 200 140 208 162 206 188 M 172 150 C 184 164 192 182 194 204', DW, '#245f9c')),
    // a swept-back crest tuft, and the beak (the head covers their bases)
    shape('M 140 30 C 138 16 146 6 156 4 C 152 10 152 14 154 18 C 160 10 170 8 178 12 C 170 16 166 22 166 30 Z', COL.skyDark),
    shape('M 122 40 C 104 44 88 50 74 57 C 88 64 104 70 122 74 Z', COL.sun),
    line('M 84 57.5 L 116 57.5', 3.5, '#c98a12'),
    circle(150, 58, 37, COL.sky),
    eye(137, 52, 8.5),
    blush(129, 72, 8, 5),
  );
}

// ───────────────────────────── 象 elephant ─────────────────────────────
// Natural pose facing left, long curling trunk. rotate: 90 stands it up like the oracle glyph.

function elephant(): SVGGElement {
  const trunk = 'M 74 142 C 66 170 56 196 54 214 C 52 232 34 240 27 224';
  const trunkBase = 'M 82 132 C 76 150 70 168 64 184';
  const ear = 'M 130 72 C 176 62 198 110 184 146 C 174 172 140 174 126 154 C 114 136 114 90 130 72 Z';
  const leg = (x: number, y: number, w: number, h: number, fill: string): SVGRectElement =>
    s('rect', { x, y, width: w, height: h, rx: 13, fill, ...OUTLINE });
  return pic('elephant',
    leg(142, 166, 30, 68, COL.elephantDark),
    leg(224, 166, 30, 66, COL.elephantDark),
    // tail with a little tuft
    tubes(COL.elephant, [['M 258 130 C 272 138 280 152 277 170', 6]]),
    shape('M 277 166 C 287 172 286 188 277 192 C 268 188 267 172 277 166 Z', INK),
    leg(102, 168, 36, 72, COL.elephant),
    leg(186, 168, 36, 72, COL.elephant),
    oval(180, 138, 86, 64, COL.elephant),
    // toenails
    flatOval(112, 233, 5.5, 4, COL.cream), flatOval(127, 233, 5.5, 4, COL.cream),
    flatOval(196, 233, 5.5, 4, COL.cream), flatOval(211, 233, 5.5, 4, COL.cream),
    // trunk merges into the head: dark under-strokes, head, then trunk color on top
    line(trunk, 24 + SW * 2), line(trunkBase, 34 + SW * 2),
    circle(100, 112, 54, COL.elephant),
    line(trunk, 24, COL.elephant), line(trunkBase, 34, COL.elephant),
    line('M 57 182 q 10 4 20 2 M 53 200 q 10 4 19 2 M 51 216 q 8 4 16 2', DW, COL.elephantDark),
    layered(ear, COL.elephant,
      flat('M 136 86 C 168 80 184 114 174 140 C 166 158 144 160 136 146 C 128 132 128 100 136 86 Z', COL.elephantLight)),
    eye(80, 100, 8.5),
    line('M 69 83 q 9 -6 18 -1', 4, INK),
    blush(70, 124, 9, 6),
  );
}

// ───────────────────────────── 草 grass ─────────────────────────────
// 艸: two sprouts side by side, each like ψ: a stem, a tall middle blade, and two side blades that
// swing outward and then reach straight up.

/** A blade that follows the curve base → ctrl → tip (ctrl need not be symmetric). */
function bladeD(base: Pt, ctrl: Pt, tip: Pt, w: number): string {
  const len = Math.hypot(tip[0] - base[0], tip[1] - base[1]) || 1;
  const nx = -(tip[1] - base[1]) / len;
  const ny = (tip[0] - base[0]) / len;
  return `M${P(...base)} Q${P(ctrl[0] + nx * w, ctrl[1] + ny * w)} ${P(...tip)} Q${P(ctrl[0] - nx * w, ctrl[1] - ny * w)} ${P(...base)}Z`;
}
function blade(base: Pt, ctrl: Pt, tip: Pt, w: number, fill: string): SVGGElement {
  const a = quadAt(base, ctrl, tip, 0.2);
  const b = quadAt(base, ctrl, tip, 0.8);
  // vein: the same curve, trimmed at both ends (control point of the sub-curve = de Casteljau midpoint)
  const u = 0.2, v = 0.8;
  const cx = (1 - u) * (1 - v) * base[0] + ((1 - u) * v + u * (1 - v)) * ctrl[0] + u * v * tip[0];
  const cy = (1 - u) * (1 - v) * base[1] + ((1 - u) * v + u * (1 - v)) * ctrl[1] + u * v * tip[1];
  return g(null, shape(bladeD(base, ctrl, tip, w), fill), line(`M${P(a.x, a.y)} Q${P(cx, cy)} ${P(b.x, b.y)}`, 3.5, COL.leafDark));
}

function sprout(cx: number, dx: number): SVGGElement {
  return g(null,
    tubes(COL.leafDark, [[`M${P(cx + dx, 262)} Q${P(cx + dx * 0.3, 210)} ${P(cx, 160)}`, 9]]),
    blade([cx - 2, 164], [cx - 40, 150], [cx - 27, 70], 26, COL.leaf),
    blade([cx + 2, 164], [cx + 40, 150], [cx + 27, 72], 26, COL.leaf),
    blade([cx, 166], [cx + 4, 96], [cx + 1, 22], 26, '#69c254'),
  );
}

function grassPic(): SVGGElement {
  return pic('grass',
    sprout(112, -10),
    sprout(188, 10),
    layered('M 40 272 C 60 246 104 240 150 240 C 196 240 240 246 260 272 Z', COL.earth,
      oval(108, 258, 6, 4.5, COL.earthLight, { 'stroke-width': 3.5 }),
      oval(198, 256, 5, 4, COL.earthLight, { 'stroke-width': 3.5 }),
      oval(150, 262, 4, 3, COL.earthLight, { 'stroke-width': 3 })),
    // a tiny ladybug resting on a leaf
    s('g', { transform: 'translate(222 116) rotate(-8)' },
      dot(0, -10, 5.5, INK),
      oval(0, 0, 11, 12, COL.red, { 'stroke-width': 4 }),
      line('M 0 -11 V 11', 3),
      dot(-5, -3, 2.4, INK), dot(5, -3, 2.4, INK), dot(-4.5, 5, 2.2, INK), dot(4.5, 5, 2.2, INK)),
  );
}

// ───────────────────────────── 田 field ─────────────────────────────
// A field from above: four plots split by cross paths, like the square-with-a-cross glyph.

function field(): SVGGElement {
  const x0 = 28, y0 = 32, x1 = 274, y1 = 266;
  const cx = 154, cy = 146, gap = 10, inset = 14;
  type Rect = readonly [number, number, number, number];
  const furrows = ([ax, ay, bx, by]: Rect, vertical: boolean): string => {
    const out: string[] = [];
    if (vertical) for (let x = ax + 19; x < bx - 10; x += 19) out.push(`M${P(x, ay + 15)} V${rd(by - 15)}`);
    else for (let y = ay + 19; y < by - 10; y += 19) out.push(`M${P(ax + 15, y)} H${rd(bx - 15)}`);
    return out.join(' ');
  };
  const sprouts = ([ax, ay, bx, by]: Rect): string => {
    const out: string[] = [];
    for (let x = ax + 19; x < bx - 10; x += 19) {
      for (let y = ay + 24; y < by - 12; y += 22) out.push(`M${P(x - 5, y - 6)} Q${P(x - 1, y - 2)} ${P(x, y + 2)} Q${P(x + 1, y - 2)} ${P(x + 5, y - 6)}`);
    }
    return out.join(' ');
  };
  const plot = (r: Rect, crop: 'wheat' | 'greens', vertical: boolean): SVGGElement => {
    const [ax, ay, bx, by] = r;
    const fill = crop === 'wheat' ? COL.fieldY : COL.fieldG;
    const dark = crop === 'wheat' ? COL.fieldYDark : COL.fieldGDark;
    return g(null,
      s('rect', { x: ax, y: ay, width: bx - ax, height: by - ay, rx: 16, fill, ...OUTLINE, 'stroke-width': DW }),
      line(furrows(r, vertical), 4, dark, { opacity: crop === 'wheat' ? 0.8 : 0.5 }),
      crop === 'greens' ? line(sprouts(r), 3.5, COL.leafDark) : null,
    );
  };
  const A: Rect = [x0 + inset, y0 + inset, cx - gap, cy - gap];
  const B: Rect = [cx + gap, y0 + inset, x1 - inset, cy - gap];
  const C: Rect = [x0 + inset, cy + gap, cx - gap, y1 - inset];
  const D: Rect = [cx + gap, cy + gap, x1 - inset, y1 - inset];
  return pic('field',
    s('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 34, fill: COL.earth, ...OUTLINE }),
    plot(A, 'greens', true),
    plot(B, 'wheat', false),
    plot(C, 'wheat', true),
    plot(D, 'greens', false),
  );
}

// ───────────────────────────── 竹 bamboo ─────────────────────────────
// Two drooping bamboo twigs meeting at a node (the Λ of the glyph), leaves hanging from each end.

function bamboo(): SVGGElement {
  const apex: Pt = [150, 46];
  const footL: Pt = [88, 166];
  const footR: Pt = [212, 170];
  const cL: Pt = [108, 86];
  const cR: Pt = [194, 90];
  const caneL = `M${P(...apex)} Q${P(...cL)} ${P(...footL)}`;
  const caneR = `M${P(...apex)} Q${P(...cR)} ${P(...footR)}`;
  const canes: Tube[] = [['M 150 52 L 150 28', 14], [caneL, 17], [caneR, 17]];
  const nodes: string[] = ['M 137 46 h 26'];
  for (const [c, f] of [[cL, footL], [cR, footR]] as const) {
    for (const t of [0.4, 0.78]) {
      const q = quadAt(apex, c, f, t);
      nodes.push(`M${P(q.x - q.ty * 16, q.y + q.tx * 16)} L${P(q.x + q.ty * 16, q.y - q.tx * 16)}`);
    }
  }
  const leaves = (base: Pt, specs: readonly (readonly [number, number, number, string])[]): SVGGElement[] =>
    specs.map(([tx, ty, bend, fill]) => leaf(base, [tx, ty], 24, bend, fill, fill === COL.leaf ? COL.leafDark : '#1f6b2a'));
  return pic('bamboo',
    ...leaves(footL, [[24, 210, -8, COL.leafDark], [104, 262, -6, COL.leafDark], [46, 262, 6, COL.leaf]]),
    ...leaves(footR, [[278, 220, 8, COL.leafDark], [190, 264, 6, COL.leafDark], [250, 278, -6, COL.leaf]]),
    tubes(COL.bamboo, canes),
    // sunny highlight on the upper-left side of each cane
    s('g', { transform: 'translate(-4 -1)' },
      line(caneL, 4, '#b4e79a', { 'stroke-dasharray': '30 22', 'stroke-dashoffset': '-8' }),
      line(caneR, 4, '#b4e79a', { 'stroke-dasharray': '30 22', 'stroke-dashoffset': '-8' })),
    line(nodes.join(' '), 6, INK),
    leaf([151, 32], [170, 12], 12, 2, COL.leaf, COL.leafDark),
  );
}

// ───────────────────────────── 马 horse ─────────────────────────────
// Natural pose facing left with a flowing mane and four legs; the neck reaches forward and the face
// looks down a little, as in the glyph. rotate: 90 stands it up like the oracle glyph.

function horse(): SVGGElement {
  const body =
    'M 160 100 C 136 86 110 70 88 68 C 76 66 66 70 62 80 C 54 100 44 126 38 148 ' +
    'C 34 162 46 174 60 170 C 72 166 80 146 88 128 C 96 140 104 150 112 160 ' +
    'C 114 178 128 186 150 186 L 234 186 C 262 184 270 152 262 128 C 256 108 236 98 214 98 C 192 98 176 100 160 100 Z';
  const hoof = (x: number, y: number): SVGRectElement =>
    s('rect', { x: x - 13, y: y - 4, width: 26, height: 14, rx: 5, fill: INK, ...OUTLINE, 'stroke-width': 4 });
  return pic('horse',
    // far legs, tail and ear sit behind the body
    tubes(COL.horseDark, [['M 150 178 L 150 236', 18], ['M 212 178 L 208 236', 18]]),
    hoof(150, 238), hoof(208, 238),
    shape('M 256 118 C 276 112 284 136 278 162 C 274 180 280 196 268 210 C 262 194 256 180 254 162 C 252 148 252 136 248 130 Z', INK),
    line('M 266 128 C 274 144 272 170 268 192', 3.5, COL.hairShine),
    shape('M 74 72 C 68 58 70 44 76 34 C 86 42 92 56 90 70 Z', COL.horse),
    flat('M 78 64 C 76 56 77 48 79 42 C 84 48 86 56 86 64 Z', '#e9a3a0'),
    tubes(COL.horse, [['M 124 178 L 120 240', 20], ['M 238 172 L 242 240', 20]]),
    hoof(120, 242), hoof(242, 242),
    layered(body, COL.horse,
      flatOval(50, 156, 16, 14, COL.horseLight)),
    // mane + forelock
    shape('M 82 66 C 90 48 112 46 118 58 C 128 50 146 56 144 70 C 158 68 170 80 164 92 C 176 96 178 110 164 112 C 146 98 126 84 104 78 C 96 76 88 72 82 66 Z', INK),
    shape('M 80 66 C 70 70 62 80 62 94 C 70 88 78 82 88 78 Z', INK),
    line('M 104 60 C 116 64 126 70 136 78 M 134 72 C 144 80 152 88 158 96', 3.5, COL.hairShine),
    eye(70, 104, 8),
    dot(44, 158, 3.5, INK),
    line('M 48 170 q 6 1 10 -3', 3.5, INK),
    blush(66, 126, 7, 5),
  );
}

// ───────────────────────────── 夫 man ─────────────────────────────
// A grown-up standing like 大 with arms spread; his top-knot holds a vermilion hairpin (the extra line of 夫).

function man(): SVGGElement {
  return pic('man',
    // legs and shoes
    tubes(COL.clothesDark, [['M 136 220 L 120 266', 18], ['M 164 220 L 180 266', 18]]),
    oval(113, 272, 16, 9, INK), oval(187, 272, 16, 9, INK),
    // sleeves, then hands
    tubes(COL.clothes, [['M 134 152 L 80 202', 26], ['M 166 152 L 220 202', 26]]),
    circle(72, 209, 13, COL.skin),
    circle(228, 209, 13, COL.skin),
    // robe with a crossed collar and a sash
    layered('M 124 140 C 136 132 164 132 176 140 L 198 230 C 170 240 130 240 102 230 Z', COL.clothes,
      flat('M 110 184 L 190 184 L 193 198 L 107 198 Z', COL.sun),
      line('M 110 184 L 190 184 M 107 198 L 193 198', DW),
      flat('M 138 135 L 150 156 L 162 135 Z', COL.cream),
      line('M 138 135 L 156 166 M 162 135 L 150 156', DW)),
    // head
    circle(117, 104, 8, COL.skin), circle(183, 104, 8, COL.skin),
    circle(150, 100, 34, COL.skin),
    shape('M 117 98 C 114 76 128 64 150 64 C 172 64 186 76 183 98 C 174 86 164 81 150 81 C 136 81 126 86 117 98 Z', INK),
    // the hairpin goes through the top-knot: the extra horizontal stroke of 夫
    tubes(COL.red, [['M 100 50 L 200 50', 7]]),
    circle(97, 50, 7.5, COL.red, { 'stroke-width': 5 }),
    circle(203, 50, 7.5, COL.red, { 'stroke-width': 5 }),
    dot(95, 48, 2.2, COL.white), dot(201, 48, 2.2, COL.white),
    circle(150, 50, 19, INK),
    line('M 138 42 A 12 12 0 0 1 156 38', 3.5, COL.hairShine),
    // face
    line('M 132 94 q 6 -4 12 0 M 156 94 q 6 -4 12 0', 3.5),
    eye(138, 105, 5),
    eye(162, 105, 5),
    shape('M 150 115 C 145 112 139 113 137 117 C 142 116 146 117 150 117 C 154 117 158 116 163 117 C 161 113 155 112 150 115 Z', INK, { 'stroke-width': 2 }),
    line('M 143 122 Q 150 127 157 122', 4),
    blush(127, 115, 7, 5), blush(173, 115, 7, 5),
  );
}

// ───────────────────────────── Gugu the turtle (200×200) ─────────────────────────────

function hexD(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(P(cx + r * Math.cos(a), cy + r * 0.86 * Math.sin(a)));
  }
  return `M${pts.join(' L')}Z`;
}

export function buildMascot(): SVGGElement {
  const shell = 'M 18 138 C 18 74 54 28 100 28 C 146 28 182 74 182 138 C 182 154 156 162 100 162 C 44 162 18 154 18 138 Z';
  const plates: SVGElement[] = [
    shape(hexD(100, 62, 23), COL.plate, { 'stroke-width': DW }),
    shape(hexD(58, 90, 19), COL.plate, { 'stroke-width': DW }),
    shape(hexD(142, 90, 19), COL.plate, { 'stroke-width': DW }),
    shape(hexD(36, 124, 11), COL.plate, { 'stroke-width': DW }),
    shape(hexD(164, 124, 11), COL.plate, { 'stroke-width': DW }),
  ];
  const body = g('m-body',
    oval(64, 184, 18, 10, COL.turtle), oval(136, 184, 18, 10, COL.turtle),
    line('M 56 188 l 0 3 M 64 189 l 0 3 M 128 189 l 0 3 M 136 188 l 0 3', 3, INK),
    layered(shell, COL.shell,
      ...plates,
      line('M 22 136 C 44 150 72 154 100 154 C 128 154 156 150 178 136', DW),
      line('M 40 145 l -2 10 M 160 145 l 2 10', DW)),
  );
  // chubby arms: the left one resting, the right one up for a wave (pivot at its lower-left end)
  const armL = g('m-arm-l', shape('M 70 140 C 52 140 34 150 28 164 C 23 177 36 186 48 179 C 58 173 68 166 78 162 Z', COL.turtle));
  const armR = g('m-arm-r',
    shape('M 130 146 C 142 132 152 118 160 102 C 166 88 186 86 189 100 C 192 116 176 140 156 160 Z', COL.turtle),
    dot(171, 92, 2.6, INK), dot(180, 91, 2.6, INK), dot(187, 96, 2.6, INK));
  const head = g('m-head',
    circle(100, 122, 42, COL.turtle),
    dot(82, 96, 9, COL.turtleLight),
    dot(96, 90, 4, COL.turtleLight),
    g('m-eye', oval(84, 118, 13.5, 16, COL.white, { 'stroke-width': DW }), dot(86, 121, 8.5, INK), dot(82, 116, 3.4, COL.white), dot(89, 125, 1.6, COL.white)),
    g('m-eye', oval(116, 118, 13.5, 16, COL.white, { 'stroke-width': DW }), dot(114, 121, 8.5, INK), dot(110, 116, 3.4, COL.white), dot(117, 125, 1.6, COL.white)),
    blush(68, 140, 8.5, 5.5), blush(132, 140, 8.5, 5.5),
    shape('M 90 141 Q 100 152 110 141 Q 100 145 90 141 Z', '#c0504a', { 'stroke-width': DW }),
  );
  return g('mascot-gugu', body, armL, armR, head);
}

// ───────────────────────────── registry ─────────────────────────────

export const PICTURES: Record<string, PictureDef> = {
  日: { build: sun, rotate: 0, ambient: 'glow' },
  山: { build: mountain, rotate: 0 },
  水: { build: water, rotate: 0, ambient: 'flow' },
  林: { build: woods, rotate: 0, ambient: 'sway' },
  木: { build: tree, rotate: 0, ambient: 'sway' },
  鸟: { build: bird, rotate: 0, ambient: 'flap' },
  象: { build: elephant, rotate: 90, ambient: 'bob' },
  草: { build: grassPic, rotate: 0, ambient: 'sway' },
  田: { build: field, rotate: 0 },
  竹: { build: bamboo, rotate: 0, ambient: 'sway' },
  马: { build: horse, rotate: 90, ambient: 'bob' },
  夫: { build: man, rotate: 0, ambient: 'bob' },
};
