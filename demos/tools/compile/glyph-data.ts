// Glyph geometry for bundles: Commons forms come from the sign's `forms:` section; regular-script strokes come
// from the pinned hanzi-writer-data package (spec: `ingest.strokes: hanzi-writer-data`), read at build time.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FormB, GlyphData, SignLabel, StrokesB } from '../../shared/bundle-types.ts';
import type { GlyphSel } from '../../shared/steps.ts';
import type { ContentSet, SystemDoc } from '../content/load.ts';
import { primaryReading, signByKey, systemStage } from '../content/lookup.ts';
import type { Form } from '../content/schema.ts';
import { DEMOS } from '../paths.ts';

export const HANZI_WRITER_DATA = path.join(DEMOS, 'node_modules', 'hanzi-writer-data');

export function formB(f: Form): FormB {
  return { stage: f.stage, form: f.form, variant: f.variant, box: f.box, paths: f.paths };
}

export function strokesFor(sys: SystemDoc, text: string): StrokesB | null {
  if (sys.data.ingest.strokes !== 'hanzi-writer-data') return null;
  if (!/^[^\\/.\s]{1,8}$/u.test(text)) return null; // ids/texts are pattern-checked before they become file names
  const file = path.join(HANZI_WRITER_DATA, `${text}.json`);
  if (!existsSync(file)) return null;
  const d = JSON.parse(readFileSync(file, 'utf8')) as StrokesB;
  return { strokes: d.strokes, medians: d.medians };
}

export function glyphFor(content: ContentSet, sel: GlyphSel): GlyphData | null {
  const sign = signByKey(content, sel.sign);
  const sys = sign && content.systems.get(sign.system);
  const stage = sys && systemStage(sys, sel.stage);
  if (!sign || !sys || !stage) return null;
  if (stage.kind === 'strokes') {
    const text = stage.script ? sign.data.text[stage.script] : undefined;
    const strokes = text ? strokesFor(sys, text) : null;
    return strokes ? { kind: 'strokes', strokes } : null;
  }
  if (stage.kind !== 'paths') return null;
  const form = (sign.data.forms ?? []).filter((f) => f.stage === sel.stage)[sel.index ?? 0];
  return form ? { kind: 'paths', form: formB(form) } : null;
}

export function signLabel(content: ContentSet, key: string): SignLabel | null {
  const sign = signByKey(content, key);
  const sys = sign && content.systems.get(sign.system);
  return sign && sys ? { text: sign.data.text, reading: primaryReading(sys, sign) } : null;
}
