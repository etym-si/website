// Pictures arrive as sanitized JSON trees and are rebuilt with createElementNS — never parsed from markup.
import { SVG_NS } from './dom';
import { checkSvgTree, type SvgNode } from '../shared/svg-tree.ts';

export function buildPicture(tree: SvgNode[]): SVGGElement {
  const err = checkSvgTree(tree);
  if (err) throw new Error(`picture rejected: ${err}`);
  const make = ([tag, attrs, kids]: SvgNode): SVGElement => {
    const el = document.createElementNS(SVG_NS, tag) as SVGElement;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const kid of kids) el.appendChild(make(kid));
    return el;
  };
  if (tree.length === 1 && tree[0][0] === 'g') return make(tree[0]) as SVGGElement;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'pic');
  for (const n of tree) g.appendChild(make(n));
  return g;
}
