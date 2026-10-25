// Artifact cards (spec §1 "Normalization rules"). Facts live once — artifact aliases and occurrences, catalogue
// sources, quotable lines, stage examples — and card texts are templates filled at build time.
//
// Rule order for a form of sign S at stage T (provenance note N, Commons variant V):
//   0. override  — a literal card in S's `cards.<T>`
//   1. exact     — an artifact of stage T with an alias that names N (prefix of N not followed by a digit, or a whole token)
//   2. appears   — an artifact of stage T with an occurrence of S (literal occurrence text, or the appears template)
//   3. catalogue — the one source of stage T whose `match` regex (or entry-key prefix) hits N:
//                  `book` when the matched entry has its own artifact photo, `example` (source photo) otherwise
//   4. quote     — a source of stage T with a quotable line containing S (book)
//   5. example   — the first stage example whose `when` fits (variant V, a non-empty N)
// Formless stages (picture, regular, simplified) resolve once with N = '' and V = ''. Artifacts and sources are
// tried in id order. Template variables: {sign} (primary text), {note}, the system's noteFragments, the matched
// source's groups/entry fields/fragments, {phrase} (occurrence), {line.<script>} and {gloss} (quote).
import type { CardB, CardKind, L10n, MarkB, PhotoB } from '../../shared/bundle-types.ts';
import { complete } from '../content/l10n.ts';
import type { ArtifactDoc, ContentSet, SignDoc, SystemDoc } from '../content/load.ts';
import { primaryText } from '../content/lookup.ts';
import type { Form, Source } from '../content/schema.ts';
import { fill, type Vars } from './template.ts';

export type PhotoUrl = (artifactId: string) => string;
export interface CatalogueHit { source: Source; entryKey?: string; vars: Vars; artifact?: string }
interface Ctx { content: ContentSet; sys: SystemDoc; sign: SignDoc; stageId: string; qualified: string; form?: Form; index: number; url: PhotoUrl }
type Marked = { marks?: { box: [number, number, number, number]; label?: L10n }[] } | undefined;

const empty = (content: ContentSet): L10n => Object.fromEntries(content.locales.map((l) => [l, '']));
const byId = <T>(id: (x: T) => string) => (a: T, b: T) => (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0);

/** An alias names a note when the note starts with it (not followed by a digit) or contains it as a whole token. */
export function namesNote(alias: string, note: string): boolean {
  return (note.startsWith(alias) && !/\d/.test(note.charAt(alias.length))) || note.split(/\s+/).includes(alias);
}

export function photoOf(content: ContentSet, id: string, url: PhotoUrl): PhotoB {
  const a = content.artifacts.get(id);
  if (!a?.data.credit) throw new Error(`artifact ${id} has no credited photo`);
  const c = a.data.credit;
  return { file: url(id), w: c.width, h: c.height, title: a.data.image.commons.replace(/^File:/, ''), license: c.license, author: c.author, page: c.page };
}

function marksOf(content: ContentSet, o: Marked): MarkB[] | undefined {
  return o?.marks?.map((m) => ({ x: m.box[0], y: m.box[1], w: m.box[2], h: m.box[3], ...(m.label ? { label: complete(content, m.label) } : {}) }));
}

function artifactsOf(content: ContentSet, qualified: string): ArtifactDoc[] {
  return [...content.artifacts.values()].filter((a) => a.data.stage === qualified).sort(byId((a) => a.data.id));
}

function sourcesOf(content: ContentSet, qualified: string): Source[] {
  return [...content.sources.values()].map((s) => s.data).filter((s) => s.stage === qualified).sort(byId((s) => s.id));
}

export function matchCatalogue(content: ContentSet, qualified: string, note: string): CatalogueHit | null {
  if (!note) return null;
  const hits: CatalogueHit[] = [];
  for (const s of sourcesOf(content, qualified)) {
    let groups: Record<string, string> = {};
    let entryKey: string | undefined;
    if (s.match) {
      const m = new RegExp(s.match, 'u').exec(note);
      if (!m) continue;
      groups = { ...(m.groups ?? {}) };
      entryKey = groups.entry;
      delete groups.entry;
    } else if (s.entries) {
      entryKey = Object.keys(s.entries).find((k) => note.startsWith(k));
      if (entryKey === undefined) continue;
    } else continue;
    const entry = entryKey !== undefined ? s.entries?.[entryKey] : undefined;
    if (entryKey !== undefined && !entry) continue;
    const vars: Vars = { ...groups };
    if (entry && entryKey !== undefined) Object.assign(vars, { key: entryKey, name: entry.name }, entry.vars ?? {});
    hits.push({ source: s, entryKey, vars, artifact: entry?.artifact });
  }
  if (hits.length > 1) throw new Error(`provenance "${note}" matches more than one ${qualified} source: ${hits.map((h) => h.source.id).join(', ')}`);
  return hits[0] ?? null;
}

function fragmentVars(ctx: Ctx, note: string, base: Vars, hit: CatalogueHit | null): Vars {
  const { content, sys } = ctx;
  const out: Vars = {};
  for (const [name, f] of Object.entries(sys.data.noteFragments ?? {})) {
    const m = new RegExp(f.match, 'u').exec(note);
    out[name] = m ? fill(content, f.text, { ...base, ...(m.groups ?? {}) }, `${sys.data.id} noteFragments.${name}`) : empty(content);
  }
  for (const s of sourcesOf(content, ctx.qualified)) {
    for (const [name, tpl] of Object.entries(s.fragments ?? {})) {
      const mine = hit && hit.source.id === s.id && hit.entryKey !== undefined;
      out[name] = mine ? fill(content, tpl, { ...base, ...hit.vars }, `${s.id} fragments.${name}`) : empty(content);
    }
  }
  return out;
}

function resolveCard(ctx: Ctx): CardB | null {
  const { content, sys, sign, stageId, qualified, form, index, url } = ctx;
  const note = form?.provenance?.note ?? '';
  const variant = form?.variant ?? '';
  const base: Vars = { sign: primaryText(sys, sign), note };
  const hit = matchCatalogue(content, qualified, note);
  const vars: Vars = { ...base, ...fragmentVars(ctx, note, base, hit), ...(hit?.vars ?? {}) };
  const card = (kind: CardKind, photo: string, title: L10n, text: L10n, extra: { photo2?: string; marks?: MarkB[]; source?: string } = {}): CardB => ({
    kind,
    img: photoOf(content, photo, url),
    ...(extra.photo2 ? { img2: photoOf(content, extra.photo2, url) } : {}),
    ...(extra.marks ? { marks: extra.marks } : {}),
    ...(form ? { form: { stage: stageId, index } } : {}),
    title, text,
    ...(extra.source ? { source: extra.source } : {}),
  });

  const override = sign.data.cards?.[stageId];
  if (override) {
    const where = `${sign.key} cards.${stageId}`;
    return card(override.kind, override.artifact, fill(content, override.title, vars, where), fill(content, override.text, vars, where),
      { photo2: override.artifact2, marks: marksOf(content, override), source: note || undefined });
  }
  const arts = artifactsOf(content, qualified);
  if (note) {
    for (const a of arts) {
      if (!(a.data.aliases ?? []).some((al) => namesNote(al, note))) continue;
      const tpl = a.data.templates?.exact;
      if (!tpl) throw new Error(`artifact ${a.data.id}: provenance "${note}" names it, but it has no exact template`);
      const occ = a.data.occurrences?.find((o) => o.sign === sign.key);
      return card('exact', a.data.id, fill(content, tpl.title ?? a.data.title, vars, a.data.id), fill(content, tpl.text, vars, a.data.id),
        { photo2: a.data.related?.[0], marks: marksOf(content, occ), source: note });
    }
  }
  for (const a of arts) {
    const occ = a.data.occurrences?.find((o) => o.sign === sign.key);
    if (!occ) continue;
    const tpl = a.data.templates?.appears;
    const text = occ.text ?? tpl?.text;
    if (!text) throw new Error(`artifact ${a.data.id}: occurrence ${sign.key} needs a text, or the artifact needs an appears template`);
    const v: Vars = occ.phrase ? { ...vars, phrase: occ.phrase } : vars;
    return card('appears', a.data.id, fill(content, tpl?.title ?? a.data.title, v, a.data.id), fill(content, text, v, a.data.id),
      { photo2: a.data.related?.[0], marks: marksOf(content, occ), source: note || undefined });
  }
  if (hit) {
    const kind: CardKind = hit.artifact ? 'book' : 'example';
    const tpl = hit.source.templates[kind === 'book' ? 'book' : 'example'];
    if (!tpl) throw new Error(`source ${hit.source.id}: no ${kind} template`);
    return card(kind, hit.artifact ?? hit.source.photo, fill(content, tpl.title, vars, hit.source.id), fill(content, tpl.text, vars, hit.source.id), { source: note });
  }
  for (const s of sourcesOf(content, qualified)) {
    const quote = s.templates.quote;
    if (!s.lines?.length || !quote) continue;
    const line = s.lines.find((l) => Object.entries(sign.data.text).some(([script, t]) => (l.text[script] ?? '').includes(t)));
    if (!line) continue;
    const v: Vars = { ...vars, gloss: line.gloss, ...Object.fromEntries(Object.entries(line.text).map(([k, t]) => [`line.${k}`, t])) };
    return card('book', s.photo, fill(content, quote.title, v, s.id), fill(content, quote.text, v, s.id));
  }
  const stage = sys.data.stages.find((s) => s.id === stageId);
  for (const ex of stage?.examples ?? []) {
    if (ex.when?.variant && ex.when.variant !== variant) continue;
    if (ex.when?.note && !note) continue;
    const where = `${sys.data.id}.${stageId} examples`;
    return card(ex.kind ?? 'example', ex.artifact, fill(content, ex.title, vars, where), fill(content, ex.text, vars, where), { source: ex.when?.note ? note : undefined });
  }
  return null;
}

/** Cards for every stage on the timeline: one per form for paths stages, one for every other stage. */
export function resolveSignCards(content: ContentSet, sys: SystemDoc, sign: SignDoc, url: PhotoUrl, timeline: string[]): Record<string, (CardB | null)[]> {
  const out: Record<string, (CardB | null)[]> = {};
  const forms = sign.data.forms ?? [];
  for (const stageId of timeline) {
    const stage = sys.data.stages.find((s) => s.id === stageId);
    if (!stage) continue;
    const qualified = `${sys.data.id}.${stageId}`;
    const list = stage.kind === 'paths'
      ? forms.filter((f) => f.stage === stageId).map((form, index) => resolveCard({ content, sys, sign, stageId, qualified, form, index, url }))
      : [resolveCard({ content, sys, sign, stageId, qualified, index: 0, url })];
    if (list.some((c) => c)) out[stageId] = list;
  }
  return out;
}
