// Locale fallback (config.yaml) and translation coverage. Compiled bundles always carry every locale.
import type { L10n } from '../../shared/l10n.ts';
import type { Diags, PathSeg } from './diagnostics.ts';
import type { ContentSet } from './load.ts';
import type { YamlFile } from './yaml.ts';

const chains = new WeakMap<ContentSet, Map<string, string[]>>();

export function fallbackChain(content: ContentSet, locale: string): string[] {
  let memo = chains.get(content);
  if (!memo) { memo = new Map(); chains.set(content, memo); }
  const hit = memo.get(locale);
  if (hit) return hit;
  const chain: string[] = [];
  let cur: string | undefined = locale;
  while (cur && !chain.includes(cur)) {
    chain.push(cur);
    cur = content.config.data.locales.find((l) => l.id === cur)?.fallback;
  }
  if (!chain.includes(content.locales[0])) chain.push(content.locales[0]);
  memo.set(locale, chain);
  return chain;
}

export function pick(content: ContentSet, text: L10n, locale: string): string {
  for (const l of fallbackChain(content, locale)) if (text[l] !== undefined) return text[l];
  throw new Error(`text has no ${content.locales[0]} value`);
}

export function complete(content: ContentSet, text: L10n): L10n {
  return Object.fromEntries(content.locales.map((l) => [l, pick(content, text, l)]));
}

export function isL10n(content: ContentSet, v: unknown): v is L10n {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.includes(content.locales[0]) && keys.every((k) => content.locales.includes(k) && typeof (v as Record<string, unknown>)[k] === 'string');
}

function walk(content: ContentSet, y: YamlFile, v: unknown, path: PathSeg[], diags: Diags, strict: boolean): void {
  if (isL10n(content, v)) {
    for (const l of content.locales) {
      if (v[l] !== undefined) continue;
      const next = fallbackChain(content, l).find((x) => x !== l && v[x] !== undefined);
      diags.add(strict ? 'error' : 'warning', y, [...path, l], `missing translation (falls back to ${next})`);
    }
    return;
  }
  if (Array.isArray(v)) v.forEach((x, i) => walk(content, y, x, [...path, i], diags, strict));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(content, y, x, [...path, k], diags, strict);
}

/** Every localized string in every file; missing locales are warnings (errors with --strict). */
export function checkCoverage(content: ContentSet, diags: Diags, strict: boolean): void {
  const docs = [
    content.ui,
    ...[...content.systems.values()].flatMap((s) => [s, ...s.signs.values()]),
    ...content.artifacts.values(), ...content.sources.values(),
    ...[...content.collections.values()].flatMap((c) => [c, ...c.stories.values()]),
  ];
  for (const d of docs) walk(content, d.y, d.data, [], diags, strict);
}
