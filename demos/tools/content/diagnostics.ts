// Build diagnostics: `content/systems/han/signs/马.yaml:14:5 story.hook.zh-Hant: missing translation (falls back to zh-Hans)`.
import type { z } from 'zod';
import { locate, type YamlFile } from './yaml.ts';

export type Severity = 'error' | 'warning';
export type PathSeg = string | number;
export interface Diagnostic { severity: Severity; file: string; line: number; col: number; path: string; message: string }

export function formatPath(path: readonly PathSeg[]): string {
  return path.reduce<string>((s, seg) => (typeof seg === 'number' ? `${s}[${seg}]` : s ? `${s}.${seg}` : seg), '');
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.file}:${d.line}:${d.col} ${d.path ? `${d.path}: ` : ''}${d.message}`;
}

export class Diags {
  readonly list: Diagnostic[] = [];

  error(where: YamlFile | string, path: readonly PathSeg[], message: string): void { this.add('error', where, path, message); }
  warn(where: YamlFile | string, path: readonly PathSeg[], message: string): void { this.add('warning', where, path, message); }

  add(severity: Severity, where: YamlFile | string, path: readonly PathSeg[], message: string): void {
    const at = typeof where === 'string' ? { line: 1, col: 1 } : locate(where, path);
    this.list.push({ severity, file: typeof where === 'string' ? where : where.file, line: at.line, col: at.col, path: formatPath(path), message });
  }

  get errors(): Diagnostic[] { return this.list.filter((d) => d.severity === 'error'); }
  get warnings(): Diagnostic[] { return this.list.filter((d) => d.severity === 'warning'); }

  /** Errors first, then warnings, each formatted. */
  lines(): string[] { return [...this.errors, ...this.warnings].map(formatDiagnostic); }
}

type Issue = z.core.$ZodIssue;

/** Report every Zod issue at its YAML location. Unions report only the branch the author most likely meant. */
export function reportZod(diags: Diags, y: YamlFile, error: z.ZodError, prefix: readonly PathSeg[] = []): void {
  for (const issue of flatten(error.issues, [])) {
    const path = [...prefix, ...issue.path.filter((p): p is PathSeg => typeof p !== 'symbol')];
    if (issue.code === 'unrecognized_keys') for (const k of issue.keys) diags.error(y, [...path, k], `unknown key "${k}"`);
    else diags.error(y, path, issue.message);
  }
}

function flatten(issues: readonly Issue[], base: readonly PropertyKey[]): Issue[] {
  const out: Issue[] = [];
  for (const raw of issues) {
    const issue = { ...raw, path: [...base, ...raw.path] } as Issue;
    if (issue.code === 'invalid_union' && issue.errors.length) {
      const score = (branch: readonly Issue[]) =>
        branch.some((i) => (i.code === 'invalid_union' && i.errors.length === 0) || (i.code === 'unrecognized_keys' && i.path.length === 0)) ? 1 : 0;
      const depth = (branch: readonly Issue[]) => Math.max(0, ...branch.map((i) => i.path.length));
      const best = issue.errors.reduce((a, b) => (score(b) < score(a) || (score(b) === score(a) && depth(b) > depth(a)) ? b : a));
      out.push(...flatten(best, issue.path));
    } else out.push(issue);
  }
  return out;
}
