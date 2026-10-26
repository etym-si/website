// CREDITS.md, built from the forms actually shipped, the artifact photo credits and the datasets used.
import type { ContentSet, SignDoc } from '../content/load.ts';

/** Commons page path the way the retired Python tools quoted it (urllib.parse.quote, spaces as underscores). */
export function commonsPath(title: string): string {
  return encodeURIComponent(title.replaceAll(' ', '_')).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function creditsMarkdown(content: ContentSet, signs: SignDoc[], usesHanziWriter: boolean): string {
  const titles = [...new Set(signs.flatMap((s) => (s.data.forms ?? []).map((f) => f.commons).filter((t): t is string => !!t)))].sort();
  const photos = [...content.artifacts.values()].filter((a) => a.data.credit).sort((a, b) => (a.data.id < b.data.id ? -1 : 1));
  return [
    '# Credits', '',
    '## Historical glyphs', '',
    'From the Wikimedia Commons *Ancient Chinese characters project*, released into the **public domain** (sources: Sinica database, Chinese Etymology, et al.).', '',
    ...titles.map((t) => `- \`${t}\` — public domain — https://commons.wikimedia.org/wiki/${commonsPath(t)}`), '',
    ...(usesHanziWriter
      ? ['## Regular-script stroke data', '', '[hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) (derived from Make Me a Hanzi / Arphic fonts) — Arphic Public License, see `licenses/ARPHICPL.TXT`.', '']
      : []),
    '## Artifact photos', '',
    ...photos.map((a) => `- \`${a.data.image.commons.replace(/^File:/, '')}\` — ${a.data.credit!.author} — ${a.data.credit!.license} — ${a.data.credit!.page}`), '',
    '## Animation reference', '',
    'Techniques inspired by 《三十六个字》 (Shanghai Animation Film Studio, 1984, dir. A Da). No frames or drawings from the film are used.', '',
  ].join('\n');
}
