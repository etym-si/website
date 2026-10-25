// Compiled formats: what the build writes under public/data (and inlines as the catalog) and what the app reads.
// Plain JSON data only. Every L10n here is complete (all locales filled by the build's fallback chain).
import type { L10n } from './l10n.ts';
import type { Step } from './steps.ts';
import type { SvgNode } from './svg-tree.ts';

export type { L10n, Step, SvgNode };
export type Box = [number, number, number, number];
export interface GlyphPath { d: string; t?: string; mode?: 'stroke' | 'knockout'; w?: number; rule?: 'evenodd' }
export interface FormB { stage: string; form: string; variant: string; box: Box; paths: GlyphPath[] }
export interface StrokesB { strokes: string[]; medians: [number, number][][] }
export type GlyphData = { kind: 'paths'; form: FormB } | { kind: 'strokes'; strokes: StrokesB };
export interface PictureB { rotate: number; ambient?: string; tree: SvgNode[] }
export interface PhotoB { file: string; w: number; h: number; title: string; license: string; author: string; page: string }
export interface MarkB { x: number; y: number; w: number; h: number; label?: L10n }
export type CardKind = 'exact' | 'book' | 'appears' | 'example';
/** An artifact card. Texts may contain the runtime token {shown} (the sign in the reader's script). */
export interface CardB {
  kind: CardKind; img: PhotoB; img2?: PhotoB; marks?: MarkB[];
  form?: { stage: string; index: number }; // the form the card is about (zoomed comparison glyph)
  title: L10n; text: L10n; source?: string;
}
/** One MP3 per bundle: a byte section per audio section (en, zh, …) and clip positions inside each section. */
export interface AudioIndex {
  mp3: string;
  sections: Record<string, [start: number, length: number]>;
  clips: Record<string, Record<string, [ms: number, dur: number]>>; // clip key → section → position
}
export interface SignLabel { text: Record<string, string>; reading: string }
export interface OriginB { type: string; parts?: { char: string; role: string; gloss?: L10n }[] }
export interface SignBundle {
  v: 1; key: string; system: string; id: string; status: 'draft' | 'reviewed';
  text: Record<string, string>; readings: Record<string, string>; reading: string;
  meaning: L10n; fact: L10n; topic?: L10n;
  origin?: OriginB; sources?: { title: string; url: string }[]; ext?: Record<string, string | number | boolean>;
  picture?: PictureB;
  forms: FormB[];
  strokes: Record<string, StrokesB>; // keyed by the character itself (e.g. 馬, 马)
  stages: string[]; // the journey timeline, in order
  cards: Record<string, (CardB | null)[]>; // stage → card per form index (formless stages use index 0)
  scripts: { full: Step[]; compact: Step[] };
  clip?: string; // pronunciation clip key (present in every audio section)
  audio: AudioIndex | null;
}
export interface StoryBundle {
  v: 1; collection: string; id: string; unit: number; title: L10n; topic: L10n;
  script: Step[];
  glyphs: Record<string, GlyphData>; // selKey(glyph selector) → data, for every selector in the script
  labels: Record<string, SignLabel>; // sign key → name-tag label
  audio: AudioIndex | null;
}
export interface SignSummary { key: string; id: string; text: Record<string, string>; reading: string; meaning: L10n; file: string; clip?: string }
export interface UnitB { n: number; title: L10n; color: string; playable: boolean; signs: string[]; story?: string }
export interface LessonB { id: string; unit: number; kind: 'learn' | 'review' | 'story'; signs: string[] }
export interface StoryRefB { id: string; unit: number; title: L10n; topic: L10n; file: string }
export interface CollectionBundle {
  v: 1; id: string; system: string; title: L10n; featured: string[];
  units: UnitB[]; lessons: LessonB[];
  signs: Record<string, SignSummary>; // every sign in the collection, by key
  stories: StoryRefB[];
  audio: AudioIndex | null; // every pronunciation, in every section
}
export interface StageMetaB { id: string; kind: 'picture' | 'paths' | 'strokes'; icon: string; color: string; name: L10n; era: L10n; script?: string; quiz?: boolean }
export interface SystemB { id: string; name: L10n; signNoun: L10n; textScripts: string[]; stages: StageMetaB[]; variantNotes: Record<string, L10n> }
export interface LocaleB { id: string; lang: string; section: string }
export interface Catalog {
  v: 1;
  locales: LocaleB[];
  ui: Record<string, L10n>;
  systems: SystemB[];
  collections: { id: string; system: string; title: L10n; file: string }[]; // config.yaml order; the first is the default
}
