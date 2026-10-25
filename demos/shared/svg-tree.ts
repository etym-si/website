// Picture SVGs are stored as a JSON tree and rebuilt with createElementNS (never parsed from markup in the app).
// This allowlist runs at build time (sanitizer) and again in the browser before touching the DOM.
export type SvgNode = [tag: string, attrs: Record<string, string>, children: SvgNode[]];

const NUM = /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
export const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE\s,.+-]*$/;
export const TRANSFORM = /^\s*((matrix|translate|scale|rotate|skewX|skewY)\(\s*[-+0-9.eE\s,]*\)\s*)+$/;
const POINTS = /^[-+0-9.eE\s,]*$/;
const PAINT = /^(none|currentColor|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/;
const DASH = /^(none|[0-9.]+([\s,]+[0-9.]+)*)$/;
const CLASS = /^pic(-[a-z0-9]+)*( pic(-[a-z0-9]+)*)*$/; // animation hooks only (see pictures.css)
const PART = /^[a-z][a-z0-9-]{0,31}$/; // reserved for rigged parts (future `pose` step)

const PRESENTATION: Record<string, RegExp> = {
  fill: PAINT, stroke: PAINT, 'stroke-width': NUM, 'stroke-linecap': /^(butt|round|square)$/, 'stroke-linejoin': /^(miter|round|bevel)$/,
  'stroke-dasharray': DASH, 'stroke-dashoffset': NUM, 'stroke-opacity': NUM, 'fill-opacity': NUM, opacity: NUM,
  'fill-rule': /^(nonzero|evenodd)$/, transform: TRANSFORM, class: CLASS,
};
const OWN: Record<string, Record<string, RegExp>> = {
  g: { 'data-part': PART },
  path: { d: PATH_D },
  circle: { cx: NUM, cy: NUM, r: NUM },
  ellipse: { cx: NUM, cy: NUM, rx: NUM, ry: NUM },
  rect: { x: NUM, y: NUM, width: NUM, height: NUM, rx: NUM, ry: NUM },
  line: { x1: NUM, y1: NUM, x2: NUM, y2: NUM },
  polyline: { points: POINTS },
  polygon: { points: POINTS },
};

/** null when every node passes the allowlist, otherwise a human-readable reason. */
export function checkSvgTree(nodes: SvgNode[], depth = 0): string | null {
  if (depth > 24) return 'picture is nested too deeply';
  if (!Array.isArray(nodes)) return 'malformed picture tree';
  for (const n of nodes) {
    if (!Array.isArray(n) || n.length !== 3 || typeof n[0] !== 'string' || typeof n[1] !== 'object' || !Array.isArray(n[2])) return 'malformed picture node';
    const [tag, attrs, kids] = n;
    const own = OWN[tag];
    if (!own) return `element <${tag}> is not allowed`;
    for (const [k, v] of Object.entries(attrs)) {
      if (typeof v !== 'string' || v.length > 40000) return `bad value for ${k}`;
      const re = PRESENTATION[k] ?? own[k];
      if (!re) return `attribute ${k} is not allowed on <${tag}>`;
      if (!re.test(v)) return `attribute ${k}="${v.slice(0, 40)}" is not allowed`;
    }
    if (tag !== 'g' && kids.length) return `<${tag}> cannot have children`;
    const err = checkSvgTree(kids, depth + 1);
    if (err) return err;
  }
  return null;
}
