// Tiny DOM helpers. Security: never uses innerHTML/insertAdjacentHTML.
// Text is always inserted as text nodes; styles go through CSSOM (CSP-safe).

export const SVG_NS = 'http://www.w3.org/2000/svg';

type Primitive = string | number | boolean | null | undefined;
export type Attrs = {
  [key: string]: Primitive | Partial<CSSStyleDeclaration> | EventListener | Record<string, string>;
};
export type Child = Node | string | number | null | undefined | false;

function apply(el: Element, attrs: Attrs | undefined): void {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'style' && typeof v === 'object') {
      const style = (el as HTMLElement | SVGElement).style;
      for (const [prop, val] of Object.entries(v as Record<string, string>)) {
        if (prop.startsWith('--')) style.setProperty(prop, String(val)); // CSS custom properties
        else (style as unknown as Record<string, string>)[prop] = String(val);
      }
    } else if (k === 'dataset' && typeof v === 'object') {
      Object.assign((el as HTMLElement).dataset, v);
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      el.setAttribute('class', String(v));
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
}

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

/** Create an HTML element. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs);
  append(el, children);
  return el;
}

/** Create an SVG element. */
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  apply(el, attrs);
  append(el, children);
  return el;
}

export function clear(el: Element): void {
  el.replaceChildren();
}

let uid = 0;
/** Unique id for SVG defs (clipPaths, filters, gradients). */
export function nextId(prefix = 'e'): string {
  uid += 1;
  return `${prefix}${uid}`;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
