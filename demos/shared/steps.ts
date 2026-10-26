// The animation step vocabulary. THIS is the one place to add a step type: add a member to LEAF below.
// Tools validate story YAML with these schemas at runtime; the app imports only the inferred types
// (`import type`), so zod never reaches the browser bundle.
import { z } from 'zod';
import type { L10n } from './l10n.ts';

export const ACTOR = /^[a-z][a-z0-9]{0,23}$/;
export const SIGN_REF = /^([a-z][a-z0-9-]{0,31}\/)?[^/\s]{1,32}$/;
export const STAGE_ID = /^[a-z][a-z0-9-]{0,31}$/;
const EASE = /^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\))$/;
const anyL10n: z.ZodType<L10n> = z.record(z.string(), z.string());

function leafSchemas(L10n: z.ZodType<L10n>) {
  const Actor = z.string().regex(ACTOR, 'actor ids are lowercase letters and digits');
  const Coord = z.number().min(-2000).max(3000);
  const XY = z.tuple([Coord, Coord]);
  const Ms = z.number().min(0).max(600000);
  const Offset = z.number().min(-2000).max(2000);
  const Size = z.number().min(1).max(3000);
  const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colors are #rrggbb');
  const SignRef = z.string().regex(SIGN_REF, 'signs are <id> or <system>/<id>');
  const StageRef = z.string().regex(STAGE_ID);
  const GlyphSel = z.strictObject({ sign: SignRef, stage: StageRef, index: z.number().int().min(0).max(23).optional() });
  const Clip = z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/));
  const LEAF = [
    z.strictObject({ do: z.literal('place'), actor: Actor, at: XY, size: Size, back: z.boolean().optional() }),
    z.strictObject({ do: z.literal('picture'), actor: Actor, pic: SignRef, ms: Ms.optional() }),
    z.strictObject({ do: z.literal('rotate'), actor: Actor, deg: z.number().min(-720).max(720), target: z.enum(['picture', 'all']).optional(), ms: Ms.optional() }),
    z.strictObject({
      do: z.literal('pose'),
      actor: Actor,
      part: StageRef,
      dx: Offset.optional(),
      dy: Offset.optional(),
      scaleX: z.number().min(0.05).max(5).optional(),
      scaleY: z.number().min(0.05).max(5).optional(),
      deg: z.number().min(-360).max(360).optional(),
      origin: z.enum(['left', 'right', 'center', 'top', 'bottom']).optional(),
      ms: Ms.optional(),
    }),
    z.strictObject({ do: z.literal('draw'), actor: Actor, glyph: GlyphSel, ms: Ms.optional(), color: Color.optional() }),
    z.strictObject({ do: z.literal('show'), actor: Actor, glyph: GlyphSel, color: Color.optional() }),
    z.strictObject({ do: z.literal('swap'), actor: Actor, glyph: GlyphSel, ms: Ms.optional(), color: Color.optional() }),
    z.strictObject({ do: z.literal('clearPicture'), actor: Actor, ms: Ms.optional() }),
    z.strictObject({ do: z.literal('wash'), actor: Actor, color: Color, size: Size.optional(), w: Size.optional(), h: Size.optional(), opacity: z.number().min(0).max(1).optional(), ms: Ms.optional(), dx: Offset.optional(), dy: Offset.optional() }),
    z.strictObject({ do: z.literal('move'), actor: Actor, to: XY, ms: Ms, gait: z.enum(['walk', 'hop', 'fly', 'swim', 'gallop']).optional(), ease: z.string().regex(EASE).optional() }),
    z.strictObject({ do: z.literal('ambient'), actor: Actor, motion: z.enum(['bob', 'sway', 'pulse', 'flicker', 'flow', 'float', 'none']) }),
    z.strictObject({ do: z.literal('fade'), actor: Actor, to: z.number().min(0).max(1), ms: Ms.optional() }),
    z.strictObject({ do: z.literal('scale'), actor: Actor, to: z.number().min(0.01).max(20), ms: Ms.optional() }),
    z.strictObject({ do: z.literal('remove'), actor: Actor, ms: Ms.optional() }),
    z.strictObject({ do: z.literal('bg'), tone: z.enum(['paper', 'dawn', 'dusk', 'night']), ms: Ms.optional() }),
    z.strictObject({ do: z.literal('stage'), stage: StageRef, variant: StageRef.optional() }),
    z.strictObject({ do: z.literal('caption'), text: L10n.nullable() }),
    z.strictObject({ do: z.literal('tag'), actor: Actor, sign: SignRef, hold: Ms.optional(), dx: Offset.optional(), dy: Offset.optional() }),
    // lang 'zh' = the sign's pronunciation voice (legacy name kept for golden parity); 'ui' = narration in the UI language.
    z.strictObject({ do: z.literal('say'), text: z.union([L10n, z.string().min(1).max(600)]), lang: z.enum(['zh', 'ui']), wait: z.boolean().optional(), silent: z.boolean().optional(), clip: Clip.optional() }),
    z.strictObject({ do: z.literal('wait'), ms: Ms }),
  ] as const;
  return { LEAF, LeafStep: z.discriminatedUnion('do', [...LEAF]), GlyphSel, Actor, SignRef, Offset };
}

const plain = leafSchemas(anyL10n);
export type LeafStep = z.infer<typeof plain.LeafStep>;
export type GlyphSel = z.infer<typeof plain.GlyphSel>;
export type Step = LeafStep | { do: 'together'; steps: Step[] };
export type StoryStep =
  | LeafStep
  | { do: 'together'; steps: StoryStep[] }
  | { narrate: L10n }
  | { tagSay: { actor: string; sign: string; dx?: number; dy?: number } };
export type StepOf<K extends Step['do']> = Extract<Step, { do: K }>;

export interface StepSchemas {
  Step: z.ZodType<Step>;
  StoryStep: z.ZodType<StoryStep>;
}

/** Build the step schemas with a locale-aware L10n schema (content) or a loose one (default). */
export function makeStepSchemas(L10n: z.ZodType<L10n> = anyL10n): StepSchemas {
  const { LEAF, Actor, SignRef, Offset } = leafSchemas(L10n);
  const Step: z.ZodType<Step> = z.lazy(() =>
    z.discriminatedUnion('do', [...LEAF, z.strictObject({ do: z.literal('together'), steps: z.array(Step).min(1).max(40) })]));
  const Narrate = z.strictObject({ narrate: L10n });
  const TagSay = z.strictObject({ tagSay: z.strictObject({ actor: Actor, sign: SignRef, dx: Offset.optional(), dy: Offset.optional() }) });
  const StoryStep: z.ZodType<StoryStep> = z.lazy(() =>
    z.union([z.discriminatedUnion('do', [...LEAF, z.strictObject({ do: z.literal('together'), steps: z.array(StoryStep).min(1).max(40) })]), Narrate, TagSay]));
  return { Step, StoryStep };
}
