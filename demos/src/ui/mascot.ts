// Gugu the turtle, the mascot (200×200), drawn with the same tiny drawing kit the original picture
// illustrations used. The illustrations themselves now live in content/ (picture.svg blocks in sign files).
//
// Animation hooks (see pictures.css): .m-eye, .m-arm-r. Those groups never carry a transform attribute,
// so CSS transforms can animate them safely. Nothing is parsed from markup.

import { s } from '../dom';

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

const ROUND: Attr = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const OUTLINE: Attr = { stroke: INK, 'stroke-width': SW, ...ROUND };

/** Round to 0.1 so generated path data stays short. */
const rd = (v: number): number => Math.round(v * 10) / 10;
/** "x y" pair for path data. */
const P = (x: number, y: number): string => `${rd(x)} ${rd(y)}`;

function g(cls: string | null, ...kids: Kid[]): SVGGElement {
  return s('g', cls ? { class: cls } : undefined, ...kids);
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
function blush(cx: number, cy: number, rx = 9, ry = 6): SVGEllipseElement {
  return flatOval(cx, cy, rx, ry, COL.blush, { opacity: 0.6 });
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
