// Strict parser for picture SVG blocks: elements and quoted attributes only. Comments, doctypes, processing
// instructions, CDATA, text content and non-XML entities are rejected outright; the allowlist does the rest.
import { checkSvgTree, type SvgNode } from '../../shared/svg-tree.ts';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const SVG_NS = 'http://www.w3.org/2000/svg';

export function parseSvg(text: string): SvgNode {
  let i = 0;
  const fail = (msg: string): never => { throw new Error(`${msg} (at offset ${i})`); };
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const name = (): string => {
    const m = /^[A-Za-z][A-Za-z0-9:-]*/.exec(text.slice(i, i + 64));
    if (!m) return fail('expected a name');
    i += m[0].length;
    return m[0];
  };
  const value = (): string => {
    const q = text[i];
    if (q !== '"' && q !== "'") return fail('expected a quoted attribute value');
    const end = text.indexOf(q, i + 1);
    if (end < 0) return fail('unterminated attribute value');
    const raw = text.slice(i + 1, end);
    i = end + 1;
    if (raw.includes('<')) return fail('"<" inside an attribute value');
    return raw.replace(/&([a-z]+);/g, (m, e: string) => ENTITIES[e] ?? fail(`entity ${m} is not allowed`));
  };
  const element = (): SvgNode => {
    if (text[i] !== '<') return fail('expected "<"');
    i++;
    if (text[i] === '!' || text[i] === '?') return fail('comments, doctypes and processing instructions are not allowed');
    const tag = name();
    const attrs: Record<string, string> = {};
    for (;;) {
      ws();
      if (text.startsWith('/>', i)) { i += 2; return [tag, attrs, []]; }
      if (text[i] === '>') { i++; break; }
      const k = name();
      ws();
      if (text[i] !== '=') return fail('expected "="');
      i++;
      ws();
      if (k in attrs) return fail(`duplicate attribute ${k}`);
      attrs[k] = value();
    }
    const kids: SvgNode[] = [];
    for (;;) {
      ws();
      if (i >= text.length) return fail(`<${tag}> is never closed`);
      if (text.startsWith('</', i)) {
        i += 2;
        const close = name();
        if (close !== tag) return fail(`</${close}> does not close <${tag}>`);
        ws();
        if (text[i] !== '>') return fail('expected ">"');
        i++;
        return [tag, attrs, kids];
      }
      if (text[i] !== '<') return fail('text content is not allowed');
      kids.push(element());
    }
  };
  ws();
  const root = element();
  ws();
  if (i !== text.length) fail('unexpected content after the root element');
  return root;
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Compact (indent < 0) or pretty markup. Attribute order is preserved. */
export function serializeSvg(node: SvgNode, indent = -1, depth = 0): string {
  const [tag, attrs, kids] = node;
  const pad = indent < 0 ? '' : ' '.repeat(indent * depth);
  const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  if (!kids.length) return `${pad}<${tag}${a}/>`;
  const nl = indent < 0 ? '' : '\n';
  return `${pad}<${tag}${a}>${nl}${kids.map((k) => serializeSvg(k, indent, depth + 1)).join(nl)}${nl}${pad}</${tag}>`;
}

/** The `picture.svg` block for a tree: a 300×300 root with two-space indentation. */
export function wrapPicture(tree: SvgNode[]): string {
  return serializeSvg(['svg', { xmlns: SVG_NS, viewBox: '0 0 300 300' }, tree], 2) + '\n';
}

export function sanitizePicture(svgText: string): { ok: true; tree: SvgNode[] } | { ok: false; error: string } {
  let root: SvgNode;
  try { root = parseSvg(svgText); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const [tag, attrs, kids] = root;
  if (tag !== 'svg' || attrs.xmlns !== SVG_NS || attrs.viewBox !== '0 0 300 300' || Object.keys(attrs).length !== 2) {
    return { ok: false, error: `the root must be exactly <svg xmlns="${SVG_NS}" viewBox="0 0 300 300">` };
  }
  if (!kids.length) return { ok: false, error: 'the picture is empty' };
  const err = checkSvgTree(kids);
  return err ? { ok: false, error: err } : { ok: true, tree: kids };
}
