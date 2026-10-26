// The stage: one SVG (1000×625 user units) with rice-paper background, watercolor filters and actors.
//
// Actor structure (CSS transforms are only ever animated on groups WITHOUT a transform attribute,
// because the SVG transform attribute and the CSS transform property are the same property):
//   root(attr translate x,y) > motion > ambient > gait > zoom > spin > { wash, pic > picSpin > picInner(attr), glyph }
import { s, nextId } from '../dom';
import type { GlyphInstance } from '../glyphs';
import type { PictureB } from '../../shared/bundle-types.ts';

export const W = 1000;
export const H = 625;

export interface Actor {
  id: string;
  root: SVGGElement;
  motion: SVGGElement;
  ambient: SVGGElement;
  gait: SVGGElement;
  zoom: SVGGElement;
  spin: SVGGElement;
  wash: SVGGElement;
  pic: SVGGElement;
  picSpin: SVGGElement;
  glyph: SVGGElement;
  x: number; // base position (root)
  y: number;
  ox: number; // current motion offset
  oy: number;
  size: number;
  rot: number;
  picRot: number;
  scale: number;
  partPoses: Map<string, string>;
  current?: GlyphInstance;
  picDef?: PictureB;
  ambientAnim?: Animation;
}

export interface StageOptions {
  viewBox?: [number, number, number, number];
  label?: string;
  className?: string;
}

export class Stage {
  readonly svg: SVGSVGElement;
  readonly defs: SVGDefsElement;
  readonly tint: SVGRectElement;
  readonly actorsLayer: SVGGElement;
  readonly front: SVGGElement;
  readonly washFilter: string;
  readonly actors = new Map<string, Actor>();

  constructor(host: HTMLElement, opts: StageOptions = {}) {
    const vb = opts.viewBox ?? [0, 0, W, H];
    this.washFilter = nextId('wc');
    const paperId = nextId('paper');
    this.defs = s('defs', {},
      // watercolor: displace a soft blob with fractal noise for ragged, bleeding edges
      s('filter', { id: this.washFilter, x: '-30%', y: '-30%', width: '160%', height: '160%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.025', numOctaves: '3', seed: '7', result: 'n' }),
        s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '38', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }),
        s('feGaussianBlur', { in: 'd', stdDeviation: '5' })),
      // rice paper grain
      s('filter', { id: paperId, x: '0', y: '0', width: '100%', height: '100%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', seed: '3', result: 't' }),
        s('feColorMatrix', { in: 't', type: 'matrix', values: '0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.25  0 0 0 0.09 0' })),
    );
    this.tint = s('rect', { x: vb[0], y: vb[1], width: vb[2], height: vb[3], fill: '#1d2a5a', class: 'stage-tint' });
    this.tint.style.opacity = '0';
    this.actorsLayer = s('g', { class: 'actors' });
    this.front = s('g', { class: 'front' });
    this.svg = s('svg', {
      viewBox: vb.join(' '), class: `stage-svg ${opts.className ?? ''}`, role: 'img', 'aria-label': opts.label ?? 'animation stage',
      preserveAspectRatio: 'xMidYMid meet',
    },
      this.defs,
      s('rect', { x: vb[0], y: vb[1], width: vb[2], height: vb[3], class: 'stage-paper' }),
      s('rect', { x: vb[0], y: vb[1], width: vb[2], height: vb[3], filter: `url(#${paperId})` }),
      this.actorsLayer,
      this.tint,
      this.front,
    );
    host.appendChild(this.svg);
  }

  actor(id: string): Actor {
    const a = this.actors.get(id);
    if (!a) throw new Error(`unknown actor "${id}" (place it first)`);
    return a;
  }

  place(id: string, x: number, y: number, size: number, back = false): Actor {
    this.remove(id);
    const g = (cls: string) => s('g', { class: cls });
    const a: Actor = {
      id, x, y, size, ox: 0, oy: 0, rot: 0, picRot: 0, scale: 1, partPoses: new Map(),
      root: s('g', { class: 'actor', transform: `translate(${x},${y})`, 'data-actor': id }),
      motion: g('a-motion'), ambient: g('a-ambient'), gait: g('a-gait'), zoom: g('a-zoom'), spin: g('a-spin'),
      wash: g('a-wash'), pic: g('a-pic'), picSpin: g('a-picspin'), glyph: g('a-glyph'),
    };
    a.pic.appendChild(a.picSpin);
    a.spin.append(a.wash, a.pic, a.glyph);
    a.zoom.appendChild(a.spin);
    a.gait.appendChild(a.zoom);
    a.ambient.appendChild(a.gait);
    a.motion.appendChild(a.ambient);
    a.root.appendChild(a.motion);
    if (back) this.actorsLayer.insertBefore(a.root, this.actorsLayer.firstChild);
    else this.actorsLayer.appendChild(a.root);
    this.actors.set(id, a);
    return a;
  }

  remove(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    a.ambientAnim?.cancel();
    a.root.remove();
    this.actors.delete(id);
  }

  /** Current on-stage center of an actor (base + motion offset). */
  where(a: Actor): [number, number] {
    return [a.x + a.ox, a.y + a.oy];
  }

  reset(): void {
    for (const id of [...this.actors.keys()]) this.remove(id);
    this.front.replaceChildren();
    this.tint.getAnimations().forEach((x) => x.cancel());
    this.tint.style.opacity = '0';
  }
}
