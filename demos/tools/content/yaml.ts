// Safe YAML: 1.2 core schema, no tags, unique keys, no merge keys, aliases capped. Warnings are errors.
import { readFileSync } from 'node:fs';
import { LineCounter, parseDocument, visit, type Document } from 'yaml';
import { rel } from '../paths.ts';
import type { Diags, PathSeg } from './diagnostics.ts';

export const MAX_ALIASES = 50;

export interface YamlFile {
  abs: string;
  file: string; // repo-relative, for messages
  text: string;
  doc: Document;
  lines: LineCounter;
  data: unknown;
}

export function parseYamlText(abs: string, text: string, diags: Diags): YamlFile | null {
  const file = rel(abs);
  const lines = new LineCounter();
  const doc = parseDocument(text, {
    lineCounter: lines, schema: 'core', customTags: [], uniqueKeys: true, merge: false, strict: true, version: '1.2', prettyErrors: false,
  });
  let ok = true;
  const fail = (message: string, offset: number) => {
    ok = false;
    const p = lines.linePos(offset);
    diags.list.push({ severity: 'error', file, line: p.line, col: p.col, path: '', message });
  };
  for (const e of [...doc.errors, ...doc.warnings]) fail(e.message.split('\n')[0], e.pos[0]);
  visit(doc, {
    Node(_key, node) {
      const tag = (node as { tag?: string }).tag;
      if (tag) fail(`explicit YAML tags are not allowed (${tag})`, node.range?.[0] ?? 0);
    },
  });
  if (!ok) return null;
  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: MAX_ALIASES });
  } catch (e) {
    fail(`${(e as Error).message} (alias limit ${MAX_ALIASES})`, 0);
    return null;
  }
  return { abs, file, text, doc, lines, data };
}

export function readYaml(abs: string, diags: Diags): YamlFile | null {
  return parseYamlText(abs, readFileSync(abs, 'utf8'), diags);
}

/** Line/column of the deepest existing node on `path` (missing keys point at their parent). */
export function locate(y: YamlFile, path: readonly PathSeg[]): { line: number; col: number } {
  for (let n = path.length; n >= 0; n--) {
    const node = n === 0 ? y.doc.contents : y.doc.getIn(path.slice(0, n), true);
    const range = (node as { range?: [number, number, number] } | null | undefined)?.range;
    if (range) {
      const p = y.lines.linePos(range[0]);
      return { line: p.line, col: p.col };
    }
  }
  return { line: 1, col: 1 };
}
