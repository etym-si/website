// The animation "script" vocabulary. Scripts are plain JSON-serializable data:
// authored by hand (stories) or generated from glyph data (evolution), then played by Player.
import type { Tri } from '../i18n';
import type { GlyphSel } from '../glyphs';
import type { StageId } from '../data/stages';

export type XY = [number, number];
export type Gait = 'walk' | 'hop' | 'fly' | 'swim' | 'gallop';
export type Ambient = 'bob' | 'sway' | 'pulse' | 'flicker' | 'flow' | 'float' | 'none';
export type Tone = 'paper' | 'dawn' | 'dusk' | 'night';

export type Step =
  /** Create (or reset) an actor slot at a position. `back` puts it behind existing actors. */
  | { do: 'place'; actor: string; at: XY; size: number; back?: boolean }
  /** Pop in an original illustration (the "picture" stage). */
  | { do: 'picture'; actor: string; pic: string; ms?: number }
  /** Rotate the picture (default) or the whole actor, in degrees. */
  | { do: 'rotate'; actor: string; deg: number; target?: 'picture' | 'all'; ms?: number }
  /** Brush-draw a glyph: outline sketch then ink (historical), or real stroke order (regular script). */
  | { do: 'draw'; actor: string; glyph: GlyphSel; ms?: number; color?: string }
  /** Show a glyph instantly (no drawing). */
  | { do: 'show'; actor: string; glyph: GlyphSel; color?: string }
  /** Ink-dissolve the current glyph and draw the next form in its place. */
  | { do: 'swap'; actor: string; glyph: GlyphSel; ms?: number; color?: string }
  | { do: 'clearPicture'; actor: string; ms?: number }
  /** A watercolor bloom behind the actor (the film's color washes). */
  | { do: 'wash'; actor: string; color: string; size?: number; w?: number; h?: number; opacity?: number; ms?: number; dx?: number; dy?: number }
  | { do: 'move'; actor: string; to: XY; ms: number; gait?: Gait; ease?: string }
  | { do: 'ambient'; actor: string; motion: Ambient }
  | { do: 'fade'; actor: string; to: number; ms?: number }
  | { do: 'scale'; actor: string; to: number; ms?: number }
  | { do: 'remove'; actor: string; ms?: number }
  /** Background mood (tint over the rice paper). */
  | { do: 'bg'; tone: Tone; ms?: number }
  /** UI: highlight a stop on the journey timeline. */
  | { do: 'stage'; stage: StageId; variant?: string }
  /** UI: subtitle line (null clears). */
  | { do: 'caption'; text: Tri | null }
  /** Name tag next to an actor, like the modern-character labels in the film's margins. */
  | { do: 'tag'; actor: string; char: string; hold?: number; dx?: number; dy?: number }
  /** Speech: Chinese pronunciation (`zh`) or the caption in the current UI language (`ui`).
   *  `wait` paces the script by the narrator (or reading time); `silent` keeps the pacing without speaking. */
  | { do: 'say'; text: Tri | string; lang: 'zh' | 'ui'; wait?: boolean; silent?: boolean }
  | { do: 'wait'; ms: number }
  /** Run steps in parallel. */
  | { do: 'together'; steps: Step[] };
