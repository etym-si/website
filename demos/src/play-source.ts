// Where the Player gets glyph geometry, name-tag labels, pictures and audio: a sign bundle (theater, lessons,
// home teaser) or a story bundle (stories).
import type { AudioIndex, GlyphData, PictureB, SignBundle, SignLabel, StoryBundle, SystemB } from '../shared/bundle-types.ts';
import type { GlyphSel } from '../shared/steps.ts';
import { selKey } from '../shared/sel.ts';

export interface PlaySource {
  glyph(sel: GlyphSel): GlyphData | undefined;
  label(signKey: string): SignLabel | undefined;
  picture(signKey: string): PictureB | undefined;
  audio: AudioIndex | null;
}

/** A form of the sign (paths stages), or its stroke data for a strokes stage (via the stage's text script). */
export function signGlyph(b: SignBundle, sys: SystemB, sel: { stage: string; index?: number }): GlyphData | undefined {
  const meta = sys.stages.find((s) => s.id === sel.stage);
  if (meta?.kind === 'strokes') {
    const text = meta.script ? b.text[meta.script] : undefined;
    const strokes = text ? b.strokes[text] : undefined;
    return strokes ? { kind: 'strokes', strokes } : undefined;
  }
  const form = b.forms.filter((f) => f.stage === sel.stage)[sel.index ?? 0];
  return form ? { kind: 'paths', form } : undefined;
}

/** The oldest form we have, else the first strokes stage (quizzes, sticker stamps). */
export function firstGlyph(b: SignBundle, sys: SystemB): GlyphData | undefined {
  if (b.forms[0]) return { kind: 'paths', form: b.forms[0] };
  const strokes = sys.stages.find((s) => s.kind === 'strokes');
  return strokes ? signGlyph(b, sys, { stage: strokes.id }) : undefined;
}

export function signSource(b: SignBundle, sys: SystemB, opts: { audio?: boolean } = {}): PlaySource {
  return {
    glyph: (sel) => (sel.sign === b.key ? signGlyph(b, sys, sel) : undefined),
    label: (key) => (key === b.key ? { text: b.text, reading: b.reading } : undefined),
    picture: (key) => (key === b.key ? b.picture : undefined),
    audio: opts.audio === false ? null : b.audio,
  };
}

export function storySource(b: StoryBundle): PlaySource {
  return {
    glyph: (sel) => b.glyphs[selKey(sel)],
    label: (key) => b.labels[key],
    picture: () => undefined,
    audio: b.audio,
  };
}
