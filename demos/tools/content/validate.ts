// Cross-reference checks (spec §9). Schema problems were reported by the loader; this file checks that
// everything referenced exists and that tool-maintained sections agree with what authors declared.
import { existsSync } from 'node:fs';
import type { Diags } from './diagnostics.ts';
import { checkCoverage } from './l10n.ts';
import type { ArtifactDoc, CollectionDoc, ContentSet, Doc, SignDoc, SystemDoc } from './load.ts';
import { journeyEntries, qualify, signByKey, stageOf, systemStage } from './lookup.ts';
import type { Source } from './schema.ts';
import { sanitizePicture } from './svg.ts';

export function validateContent(content: ContentSet, diags: Diags, opts: { strict: boolean }): void {
  validateConfig(content, diags);
  for (const sys of content.systems.values()) validateSystem(content, sys, diags);
  for (const a of content.artifacts.values()) validateArtifact(content, a, diags);
  for (const s of content.sources.values()) validateSource(content, s, diags);
  for (const c of content.collections.values()) validateCollection(content, c, diags);
  checkCoverage(content, diags, opts.strict);
}

function validateConfig(content: ContentSet, diags: Diags): void {
  const { y, data } = content.config;
  const ids = new Set(content.locales);
  data.locales.forEach((l, i) => {
    if (i === 0 && l.fallback) diags.error(y, ['locales', i, 'fallback'], 'the first (base) locale cannot have a fallback');
    if (l.fallback && !ids.has(l.fallback)) diags.error(y, ['locales', i, 'fallback'], `unknown locale ${l.fallback}`);
    if (l.audioFrom && !ids.has(l.audioFrom)) diags.error(y, ['locales', i, 'audioFrom'], `unknown locale ${l.audioFrom}`);
    if (!data.narration[l.section]) diags.error(y, ['locales', i, 'section'], `no narration voice for section ${l.section}`);
  });
  for (const [section, voice] of Object.entries(data.narration)) {
    if (!data.voices[voice]) diags.error(y, ['narration', section], `unknown voice ${voice}`);
  }
  for (const [id, v] of Object.entries(data.voices)) {
    (v.normalize ?? []).forEach((r, i) => {
      if (r.literal) return;
      try { new RegExp(r.find, 'gu'); } catch { diags.error(y, ['voices', id, 'normalize', i, 'find'], 'not a valid regular expression'); }
    });
  }
  data.collections.forEach((c, i) => { if (!content.collections.has(c)) diags.error(y, ['collections', i], `unknown collection ${c}`); });
  for (const c of content.collections.values()) {
    if (!data.collections.includes(c.data.id)) diags.warn(c.y, ['id'], `collection ${c.data.id} is not published (add it to config.yaml collections)`);
  }
}

function validateSystem(content: ContentSet, sys: SystemDoc, diags: Diags): void {
  const { y, data } = sys;
  const scripts = new Set(data.textScripts);
  const seen = new Set<string>();
  data.stages.forEach((st, i) => {
    if (seen.has(st.id)) diags.error(y, ['stages', i, 'id'], `duplicate stage ${st.id}`);
    seen.add(st.id);
    if (st.kind === 'strokes' && (!st.script || !scripts.has(st.script))) diags.error(y, ['stages', i, 'script'], 'strokes stages need a script from textScripts');
    if (st.derivedFrom && !scripts.has(st.derivedFrom)) diags.error(y, ['stages', i, 'derivedFrom'], `unknown text script ${st.derivedFrom}`);
    (st.examples ?? []).forEach((ex, j) => {
      if (!content.artifacts.has(ex.artifact)) diags.error(y, ['stages', i, 'examples', j, 'artifact'], `unknown artifact ${ex.artifact}`);
    });
  });
  if (data.journeyForm && !scripts.has(data.journeyForm)) diags.error(y, ['journeyForm'], `unknown text script ${data.journeyForm}`);
  (data.defaultJourney ?? []).forEach((s, i) => {
    if (systemStage(sys, s)?.kind !== 'paths') diags.error(y, ['defaultJourney', i], `${s} is not a paths stage`);
  });
  if (data.pronounce) {
    if (!content.config.data.voices[data.pronounce.voice]) diags.error(y, ['pronounce', 'voice'], `unknown voice ${data.pronounce.voice}`);
    if (!scripts.has(data.pronounce.from.slice('text.'.length))) diags.error(y, ['pronounce', 'from'], `unknown text script in ${data.pronounce.from}`);
  }
  for (const sign of sys.signs.values()) validateSign(content, sys, sign, diags);
}

function validateSign(content: ContentSet, sys: SystemDoc, sign: SignDoc, diags: Diags): void {
  const { y, data } = sign;
  if (!new RegExp(sys.data.signId, 'u').test(data.id)) diags.error(y, ['id'], `"${data.id}" does not match the ${sys.data.id} sign id rule ${sys.data.signId}`);
  for (const s of sys.data.textScripts) if (!data.text[s]) diags.error(y, ['text', s], 'missing');
  for (const s of Object.keys(data.text)) if (!sys.data.textScripts.includes(s)) diags.error(y, ['text', s], `not a text script of ${sys.data.id}`);
  for (const r of Object.keys(data.readings)) if (!sys.data.readings[r]) diags.error(y, ['readings', r], `${sys.data.id} has no reading scheme ${r}`);
  if (data.journey === 'default' && !sys.data.defaultJourney) diags.error(y, ['journey'], `${sys.data.id} has no defaultJourney`);
  if (Array.isArray(data.journey)) data.journey.forEach((e, i) => {
    const stage = typeof e === 'string' ? e : e.stage;
    if (systemStage(sys, stage)?.kind !== 'paths') diags.error(y, ['journey', i], `${stage} is not a paths stage of ${sys.data.id}`);
  });
  const forms = data.forms ?? [];
  forms.forEach((f, i) => {
    if (systemStage(sys, f.stage)?.kind !== 'paths') diags.error(y, ['forms', i, 'stage'], `${f.stage} is not a paths stage of ${sys.data.id}`);
  });
  const fix = `run npm run ingest:glyphs -- ${sign.key}`;
  const journey = journeyEntries(sys, sign);
  if (Array.isArray(data.journey)) {
    journey.forEach((e, i) => {
      const f = forms[i];
      if (!f || f.stage !== e.stage) diags.error(y, ['journey', i], `journey stage ${e.stage} has no form (${fix})`);
      else if (f.form !== e.form) diags.error(y, ['forms', i, 'form'], `form ${f.form} does not match the journey's ${e.form} (${fix})`);
    });
    if (forms.length > journey.length) diags.error(y, ['forms', journey.length], `form without a journey entry (${fix})`);
  } else {
    const order = journey.map((e) => e.stage);
    let last = -1;
    forms.forEach((f, i) => {
      const at = order.indexOf(f.stage);
      if (at < last) diags.error(y, ['forms', i, 'stage'], `${f.stage} is out of journey order (${fix})`);
      last = Math.max(last, at);
    });
  }
  if (data.picture) {
    const r = sanitizePicture(data.picture.svg);
    if (!r.ok) diags.error(y, ['picture', 'svg'], r.error);
  }
  for (const [stage, card] of Object.entries(data.cards ?? {})) {
    if (!systemStage(sys, stage)) diags.error(y, ['cards', stage], `unknown stage ${stage}`);
    for (const k of ['artifact', 'artifact2'] as const) {
      const id = card[k];
      if (id && !content.artifacts.has(id)) diags.error(y, ['cards', stage, k], `unknown artifact ${id}`);
    }
  }
}

function validateArtifact(content: ContentSet, a: ArtifactDoc, diags: Diags): void {
  const { y, data } = a;
  if (!stageOf(content, data.stage)) diags.error(y, ['stage'], `unknown stage ${data.stage}`);
  if (!existsSync(a.photoAbs)) diags.error(y, ['image', 'file'], `photo file ${data.image.file} is missing next to the YAML`);
  if (!data.credit) diags.error(y, ['image'], `credit section missing (run npm run ingest:photos -- ${data.id})`);
  (data.related ?? []).forEach((r, i) => { if (!content.artifacts.has(r)) diags.error(y, ['related', i], `unknown artifact ${r}`); });
  const seen = new Set<string>();
  (data.occurrences ?? []).forEach((o, i) => {
    if (!signByKey(content, o.sign)) diags.error(y, ['occurrences', i, 'sign'], `unknown sign ${o.sign}`);
    if (seen.has(o.sign)) diags.error(y, ['occurrences', i, 'sign'], `${o.sign} is listed twice`);
    seen.add(o.sign);
  });
}

function validateSource(content: ContentSet, s: Doc<Source>, diags: Diags): void {
  const { y, data } = s;
  const where = stageOf(content, data.stage);
  if (!where) diags.error(y, ['stage'], `unknown stage ${data.stage}`);
  if (!content.artifacts.has(data.photo)) diags.error(y, ['photo'], `unknown artifact ${data.photo}`);
  const entries = Object.entries(data.entries ?? {});
  for (const [k, e] of entries) if (e.artifact && !content.artifacts.has(e.artifact)) diags.error(y, ['entries', k, 'artifact'], `unknown artifact ${e.artifact}`);
  const needsBook = entries.some(([, e]) => e.artifact);
  const needsExample = (!!data.match && !entries.length) || entries.some(([, e]) => !e.artifact);
  if (needsBook && !data.templates.book) diags.error(y, ['templates'], 'entries with their own artifact need a book template');
  if (needsExample && !data.templates.example) diags.error(y, ['templates'], 'this source needs an example template');
  if (data.lines?.length && !data.templates.quote) diags.error(y, ['templates'], 'quotable lines need a quote template');
  if (where) (data.lines ?? []).forEach((l, i) => {
    for (const k of Object.keys(l.text)) if (!where.system.data.textScripts.includes(k)) diags.error(y, ['lines', i, 'text', k], `not a text script of ${where.system.data.id}`);
  });
}

function validateCollection(content: ContentSet, c: CollectionDoc, diags: Diags): void {
  const { y, data } = c;
  if (!content.systems.has(data.system)) { diags.error(y, ['system'], `unknown system ${data.system}`); return; }
  const where = new Map<string, number>();
  const numbers = new Set<number>();
  data.units.forEach((u, ui) => {
    const n = u.n ?? ui + 1;
    if (numbers.has(n)) diags.error(y, ['units', ui, 'n'], `duplicate unit number ${n}`);
    numbers.add(n);
    const unitSigns = new Set<string>();
    u.signs.forEach((ref, si) => {
      const key = qualify(ref, data.system);
      if (!signByKey(content, key)) diags.error(y, ['units', ui, 'signs', si], `unknown sign ${key}`);
      const prev = where.get(key);
      if (prev !== undefined) diags.error(y, ['units', ui, 'signs', si], `${key} already appears in unit ${prev} of this collection`);
      else where.set(key, n);
      unitSigns.add(key);
    });
    if (u.story && !c.stories.has(u.story)) diags.error(y, ['units', ui, 'story'], `unknown story ${u.story}`);
    const lessonIds = new Set<string>();
    (u.lessons ?? []).forEach((l, li) => {
      if (lessonIds.has(l.id)) diags.error(y, ['units', ui, 'lessons', li, 'id'], `duplicate lesson ${l.id}`);
      lessonIds.add(l.id);
      if (l.kind === 'story' && !u.story) diags.error(y, ['units', ui, 'lessons', li, 'kind'], 'a story lesson needs a unit story');
      (l.signs ?? []).forEach((ref, si) => {
        if (!unitSigns.has(qualify(ref, data.system))) diags.error(y, ['units', ui, 'lessons', li, 'signs', si], `${ref} is not in this unit`);
      });
    });
  });
  (data.featured ?? []).forEach((ref, i) => { if (!signByKey(content, qualify(ref, data.system))) diags.error(y, ['featured', i], `unknown sign ${ref}`); });
  const used = new Set(data.units.map((u) => u.story).filter(Boolean));
  for (const st of c.stories.values()) {
    if (!used.has(st.data.id)) diags.warn(st.y, ['id'], `story ${st.data.id} is not linked from any unit`);
    st.data.cast.forEach((ref, i) => { if (!signByKey(content, qualify(ref, data.system))) diags.error(st.y, ['cast', i], `unknown sign ${qualify(ref, data.system)}`); });
  }
}
