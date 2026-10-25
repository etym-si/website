// Card-text templates: `{name}` placeholders filled per locale at build time. `{shown}` is left for the app, which
// fills in the sign in the reader's script (简/繁). Any other unknown placeholder fails the build.
import type { L10n } from '../../shared/l10n.ts';
import { pick } from '../content/l10n.ts';
import type { ContentSet } from '../content/load.ts';

export type Vars = Record<string, string | L10n>;
export const RUNTIME_TOKENS: ReadonlySet<string> = new Set(['shown']);
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9-]*)?)\}/g;

export class TemplateError extends Error {}

export function fill(content: ContentSet, tpl: L10n, vars: Vars, where: string): L10n {
  const out: L10n = {};
  for (const locale of content.locales) {
    out[locale] = pick(content, tpl, locale).replace(PLACEHOLDER, (m, name: string) => {
      if (RUNTIME_TOKENS.has(name)) return m;
      const v = vars[name];
      if (v === undefined) throw new TemplateError(`${where}: unknown placeholder ${m}`);
      return typeof v === 'string' ? v : pick(content, v, locale);
    });
  }
  return out;
}

/** Placeholders still present in a rendered text, runtime tokens excluded. */
export function leftovers(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[0]).filter((m) => !RUNTIME_TOKENS.has(m.slice(1, -1)));
}
