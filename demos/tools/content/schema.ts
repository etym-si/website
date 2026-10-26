// Strict Zod schemas for every content file (spec §9): unknown keys are errors, numbers are ranged,
// strings are capped, colors are #rrggbb. Locale keys come from config.yaml, hence makeSchemas(locales).
import { z } from 'zod';
import { LOCALE_ID, type L10n } from '../../shared/l10n.ts';
import { makeStepSchemas, SIGN_REF, STAGE_ID } from '../../shared/steps.ts';
import { PATH_D, TRANSFORM } from '../../shared/svg-tree.ts';

export const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const QUALIFIED_STAGE = /^[a-z][a-z0-9-]{0,31}\.[a-z][a-z0-9-]{0,31}$/;
export const QUALIFIED_SIGN = /^[a-z][a-z0-9-]{0,31}\/[^/\s]{1,32}$/;
export const TEXT_SCRIPT = /^[A-Z][a-z]{3}$/; // ISO 15924, e.g. Hans, Hant, Egyp
export const VAR_NAME = /^[a-z][A-Za-z0-9]{0,31}$/;
export const COMMONS_TITLE = /^File:[^\n|#<>[\]{}]{1,200}$/;
export const LICENSES = /^(Public domain|CC0|CC BY-SA [34]\.0|CC BY [34]\.0)$/;

const str = (max: number) => z.string().min(1).max(max);
const slug = z.string().regex(SLUG, 'ids are lowercase letters, digits and dashes');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colors are #rrggbb');
const stageId = z.string().regex(STAGE_ID, 'stage ids are lowercase letters, digits and dashes');
const textScript = z.string().regex(TEXT_SCRIPT, 'text scripts are ISO 15924 codes such as Hans');
const varName = z.string().regex(VAR_NAME);
const scheme = z.string().regex(/^[a-z][a-z0-9]{0,15}$/);
const signRef = z.string().regex(SIGN_REF, 'signs are <id> or <system>/<id>');
const unit = z.number().min(0).max(1);
const regexSource = z.string().min(1).max(300).refine((s) => {
  try { new RegExp(s, 'u'); return true; } catch { return false; }
}, 'not a valid regular expression');

export const ConfigSchema = z.strictObject({
  locales: z.array(z.strictObject({
    id: z.string().regex(LOCALE_ID), lang: z.string().regex(LOCALE_ID), section: z.string().regex(/^[a-z]{2,8}$/),
    fallback: z.string().regex(LOCALE_ID).optional(), audioFrom: z.string().regex(LOCALE_ID).optional(),
  })).min(1).max(20),
  narration: z.record(z.string().regex(/^[a-z]{2,8}$/), z.string().regex(SLUG)),
  voices: z.record(z.string().regex(SLUG), z.strictObject({
    provider: z.enum(['edge-tts', 'cloudflare']),
    voice: z.string().regex(/^([a-z]{2,3}-[A-Z]{2,8}(-[A-Za-z]+)?-[A-Za-z]+Neural|@cf\/[a-z0-9-]+\/[a-z0-9-]+(:[a-z0-9-]+)?)$/),
    rate: z.string().regex(/^[+-]\d{1,2}%$/),
    label: z.string().min(1).max(60).optional(),
    normalize: z.array(z.strictObject({ find: z.string().min(1).max(200), replace: z.string().max(200), literal: z.boolean().optional() })).max(50).optional(),
  })),
  alternateVoices: z.record(z.string().regex(/^[a-z]{2,8}$/), z.array(slug).max(16)).optional(),
  collections: z.array(slug).min(1).max(50),
  audio: z.strictObject({ gapMs: z.number().int().min(24).max(2400) }),
  budget: z.strictObject({ maxFiles: z.number().int().min(100).max(20000), maxFileMiB: z.number().min(1).max(25) }),
});

export function makeSchemas(locales: readonly string[]) {
  const [base, ...others] = locales;
  const L10n = (max = 600): z.ZodType<L10n> =>
    z.strictObject({ [base]: str(max), ...Object.fromEntries(others.map((l) => [l, str(max).optional()])) }) as unknown as z.ZodType<L10n>;
  const { StoryStep } = makeStepSchemas(L10n(600));
  const mark = z.strictObject({ box: z.tuple([unit, unit, unit, unit]), label: L10n(200).optional() })
    .refine((m) => m.box[2] > 0 && m.box[3] > 0 && m.box[0] + m.box[2] <= 1 && m.box[1] + m.box[3] <= 1, 'mark boxes must stay within 0–1 and have a size');
  const tpl = z.strictObject({ title: L10n(160), text: L10n(800) });

  const Ext = z.record(varName, z.union([str(120), z.number(), z.boolean()]));
  const Ui = z.strictObject({ strings: z.record(z.string().regex(/^[a-z][A-Za-z0-9]{0,39}$/), L10n(300)) });

  const StageExample = z.strictObject({
    when: z.strictObject({ variant: stageId.optional(), note: z.literal(true).optional() }).optional(),
    kind: z.enum(['book', 'example']).optional(),
    artifact: slug, title: L10n(160), text: L10n(800),
  });
  const Stage = z.strictObject({
    id: stageId, kind: z.enum(['picture', 'paths', 'strokes']), icon: str(8), color, name: L10n(60), era: L10n(160),
    commonsVariants: z.array(stageId).min(1).max(8).optional(),
    turn: z.boolean().optional(),      // the evolution story's "turn" beat may be told here
    quiz: z.boolean().optional(),      // false: leave out of the put-in-order quiz
    script: textScript.optional(),     // strokes stages: which text form's stroke data to draw
    derivedFrom: textScript.optional(),// shown only when text[script] differs from text[derivedFrom]
    intro: L10n(300).optional(),       // narration for a derived stage; {from} and {to} are filled in
    examples: z.array(StageExample).max(10).optional(),
  });
  const System = z.strictObject({
    id: slug, name: L10n(60), signNoun: L10n(30), signId: regexSource,
    textScripts: z.array(textScript).min(1).max(4),
    readings: z.record(scheme, z.strictObject({ primary: z.boolean().optional() })),
    pronounce: z.strictObject({ voice: slug, from: z.string().regex(/^text\.[A-Z][a-z]{3}$/) }).optional(),
    ingest: z.strictObject({ glyphs: z.enum(['commons-acc']).optional(), strokes: z.enum(['hanzi-writer-data']).optional() }),
    journeyForm: textScript.optional(),
    defaultJourney: z.array(stageId).min(1).max(12).optional(),
    variantNotes: z.record(stageId, L10n(60)).optional(),
    noteFragments: z.record(varName, z.strictObject({ match: regexSource, text: L10n(300) })).optional(),
    stages: z.array(Stage).min(1).max(16),
  });

  const glyphPath = z.strictObject({
    d: z.string().min(1).max(40000).regex(PATH_D, 'path data has unexpected characters'),
    t: z.string().max(400).regex(TRANSFORM, 'transform must be a list of SVG transform functions').optional(),
    mode: z.enum(['stroke', 'knockout']).optional(),
    w: z.number().min(0).max(100).optional(),
    rule: z.literal('evenodd').optional(),
  });
  const Form = z.strictObject({
    stage: stageId, form: str(8), variant: stageId,
    commons: z.string().regex(COMMONS_TITLE).optional(),
    provenance: z.strictObject({ period: z.string().max(20), code: z.string().max(12), note: z.string().max(120) }).optional(),
    box: z.tuple([z.number().min(-10000).max(10000), z.number().min(-10000).max(10000), z.number().gt(0).max(20000), z.number().gt(0).max(20000)]),
    paths: z.array(glyphPath).min(1).max(200),
  });
  const JourneyEntry = z.union([stageId, z.strictObject({ stage: stageId, form: str(8).optional(), variants: z.array(stageId).min(1).max(8).optional() })]);
  const Sign = z.strictObject({
    id: z.string().min(1).max(32).regex(/^[^/\s]+$/),
    status: z.enum(['draft', 'reviewed']).optional(),
    text: z.record(textScript, str(8)),
    readings: z.record(scheme, str(40)),
    meaning: L10n(80),
    fact: L10n(600),
    origin: z.strictObject({
      type: z.enum(['pictogram', 'ideogram', 'compound-ideogram', 'phono-semantic', 'loan', 'uncertain']),
      parts: z.array(z.strictObject({ char: str(8), role: z.enum(['meaning', 'sound', 'shape']), gloss: L10n(120).optional() })).max(8).optional(),
    }).optional(),
    sources: z.array(z.strictObject({ title: str(200), url: z.string().max(300).regex(/^https:\/\/[^\s<>"]+$/, 'source urls must be https') })).max(10).optional(),
    story: z.strictObject({ topic: L10n(120), hook: L10n(600), rotate: L10n(600).optional(), early: L10n(600).optional(), turn: L10n(600).optional(), closer: L10n(600) }).optional(),
    picture: z.strictObject({ rotate: z.number().int().min(-180).max(180), ambient: z.enum(['glow', 'flow', 'sway', 'flap', 'bob']).optional(), svg: z.string().min(20).max(200000) }).optional(),
    journey: z.union([z.literal('default'), z.array(JourneyEntry).max(12)]),
    cards: z.record(stageId, z.strictObject({ kind: z.enum(['exact', 'book', 'appears', 'example']), artifact: slug, artifact2: slug.optional(), marks: z.array(mark).max(10).optional(), title: L10n(160), text: L10n(800) })).optional(),
    forms: z.array(Form).max(24).optional(), // generated by ingest; do not edit by hand
  });

  const Occurrence = z.strictObject({
    sign: z.string().regex(QUALIFIED_SIGN, 'occurrences name signs as <system>/<id>'),
    phrase: L10n(300).optional(), text: L10n(800).optional(), marks: z.array(mark).max(10).optional(),
  });
  const Artifact = z.strictObject({
    id: slug,
    kind: z.enum(['bone', 'shell', 'vessel', 'rubbing', 'slips', 'manuscript', 'book', 'photo']).optional(),
    stage: z.string().regex(QUALIFIED_STAGE, 'stages are <system>.<stage>'),
    title: L10n(160),
    aliases: z.array(str(40)).max(10).optional(),
    image: z.strictObject({ file: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}\.(jpg|png)$/), commons: z.string().regex(COMMONS_TITLE) }),
    related: z.array(slug).max(4).optional(),
    occurrences: z.array(Occurrence).max(500).optional(),
    templates: z.strictObject({
      exact: z.strictObject({ title: L10n(160).optional(), text: L10n(800) }).optional(),
      appears: z.strictObject({ title: L10n(160).optional(), text: L10n(800).optional() }).optional(),
    }).optional(),
    credit: z.strictObject({ // generated by `npm run ingest:photos`
      author: str(160), license: z.string().regex(LICENSES), page: z.string().regex(/^https:\/\/commons\.wikimedia\.org\/wiki\/\S+$/),
      width: z.number().int().min(1).max(4000), height: z.number().int().min(1).max(4000),
    }).optional(),
  });

  const Source = z.strictObject({
    id: slug, stage: z.string().regex(QUALIFIED_STAGE), title: L10n(160),
    match: regexSource.optional(),
    entries: z.record(str(40), z.strictObject({ name: L10n(120), artifact: slug.optional(), vars: z.record(varName, L10n(200)).optional() })).optional(),
    fragments: z.record(varName, L10n(300)).optional(),
    lines: z.array(z.strictObject({ text: z.record(textScript, str(60)), gloss: L10n(300) })).max(2000).optional(),
    photo: slug,
    templates: z.strictObject({ book: tpl.optional(), example: tpl.optional(), quote: tpl.optional() }),
  });

  const Unit = z.strictObject({
    n: z.number().int().min(1).max(9999).optional(),
    title: L10n(120), color: color.optional(), playable: z.boolean().optional(),
    signs: z.array(signRef).min(1).max(60),
    story: slug.optional(),
    lessons: z.array(z.strictObject({ id: slug, kind: z.enum(['learn', 'review', 'story']), signs: z.array(signRef).min(1).max(12).optional() })).min(1).max(30).optional(),
  });
  const Collection = z.strictObject({
    id: slug, system: slug, title: L10n(120),
    featured: z.array(signRef).max(12).optional(),
    units: z.array(Unit).min(1).max(1000),
  });
  const Story = z.strictObject({ id: slug, title: L10n(120), topic: L10n(160), cast: z.array(signRef).min(1).max(60), script: z.array(StoryStep).min(1).max(600) });

  return { L10n, Ext, Ui, System, Sign, Artifact, Source, Collection, Story, Stage, StageExample, Form, JourneyEntry, Occurrence, Unit };
}

type S = ReturnType<typeof makeSchemas>;
export type Config = z.infer<typeof ConfigSchema>;
export type Ui = z.infer<S['Ui']>;
export type System = z.infer<S['System']>;
export type Stage = z.infer<S['Stage']>;
export type StageExample = z.infer<S['StageExample']>;
export type Sign = z.infer<S['Sign']>;
export type Form = z.infer<S['Form']>;
export type JourneyEntry = z.infer<S['JourneyEntry']>;
export type Artifact = z.infer<S['Artifact']>;
export type Occurrence = z.infer<S['Occurrence']>;
export type Source = z.infer<S['Source']>;
export type Collection = z.infer<S['Collection']>;
export type Unit = z.infer<S['Unit']>;
export type Story = z.infer<S['Story']>;
