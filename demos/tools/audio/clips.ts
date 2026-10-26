// Which clip each `say` step plays, per locale, and which clips go into which audio section of a bundle.
// Narration: locale → text (zh-Hant speaks its audioFrom, zh-Hans) → the section's narration voice → key.
// Pronunciations (`lang: 'zh'`): the system's pronunciation voice; the same key is copied into every section.
import { readFileSync } from 'node:fs';
import type { L10n } from '../../shared/l10n.ts';
import type { Step } from '../../shared/steps.ts';
import { pick } from '../content/l10n.ts';
import type { ContentSet } from '../content/load.ts';
import { voiceClip, type Voice } from './clip-key.ts';
import { clipPath, FRAME_MS, type MediaManifest } from './media.ts';
import { packSections, type PackedAudio } from './pack.ts';

/** A line that has no master clip yet: exactly what `npm run tts` must synthesize. */
export interface MissingClip { text: string; spoken: string; provider: string; voice: string; rate: string }

export class ClipResolver {
  readonly missing = new Map<string, MissingClip>(); // clip key → what to synthesize
  readonly gapFrames: number;
  private readonly content: ContentSet;
  private readonly media: MediaManifest;
  private readonly mediaDir: string;
  private readonly sections: string[];

  constructor(content: ContentSet, media: MediaManifest, mediaDir: string) {
    this.content = content;
    this.media = media;
    this.mediaDir = mediaDir;
    this.gapFrames = Math.round(content.config.data.audio.gapMs / FRAME_MS);
    this.sections = [...new Set(content.config.data.locales.map((l) => l.section))];
  }

  private known(voice: Voice, raw: string): string | undefined {
    const { key, spoken } = voiceClip(voice, raw);
    if (this.media.clips[key]) return key;
    this.missing.set(key, { text: raw, spoken, provider: voice.provider, voice: voice.voice, rate: voice.rate });
    return undefined;
  }

  /** The pronunciation clip of a text (han: the simplified form), or undefined when no master exists. */
  pronunciation(text: string, voiceId = this.pronunciationVoice()): string | undefined {
    const voice = voiceId ? this.content.config.data.voices[voiceId] : undefined;
    return voice ? this.known(voice, text) : undefined;
  }

  private pronunciationVoice(): string | undefined {
    return [...this.content.systems.values()].map((s) => s.data.pronounce?.voice).find(Boolean);
  }

  lineClips(text: L10n | string, lang: 'ui' | 'zh'): Record<string, string> {
    const out: Record<string, string> = {};
    if (lang === 'zh') {
      const key = this.pronunciation(typeof text === 'string' ? text : pick(this.content, text, this.content.locales[0]));
      if (key) for (const l of this.content.locales) out[l] = key;
      return out;
    }
    for (const l of this.content.config.data.locales) {
      const spokenLocale = l.audioFrom ?? l.id;
      const raw = typeof text === 'string' ? text : pick(this.content, text, spokenLocale);
      const voice = this.content.config.data.voices[this.content.config.data.narration[l.section]];
      const key = voice && this.known(voice, raw);
      if (key) out[l.id] = key;
    }
    return out;
  }

  /** Copy of the steps with `clip` on every say step that has at least one master. */
  attach(steps: Step[]): Step[] {
    return steps.map((s): Step => {
      if (s.do === 'together') return { ...s, steps: this.attach(s.steps) };
      if (s.do !== 'say') return s;
      const clip = this.lineClips(s.text, s.lang);
      return Object.keys(clip).length ? { ...s, clip } : s;
    });
  }

  /** Clip keys per audio section, in first-use order; `extra` (e.g. the pronunciation) goes first in every section. */
  sectionKeys(steps: Step[], extra: string[] = []): { id: string; keys: string[]; aliases?: [string, string][] }[] {
    const per = new Map<string, Set<string>>(this.sections.map((id) => [id, new Set(extra)]));
    const sectionOf = new Map(this.content.config.data.locales.map((l) => [l.id, l.section]));
    const visit = (list: Step[]) => {
      for (const s of list) {
        if (s.do === 'together') visit(s.steps);
        if (s.do !== 'say' || !s.clip) continue;
        for (const [locale, key] of Object.entries(s.clip)) {
          if (s.lang === 'zh') for (const set of per.values()) set.add(key);
          else per.get(sectionOf.get(locale) ?? '')?.add(key);
        }
      }
    };
    visit(steps);
    const out: { id: string; keys: string[]; aliases?: [string, string][] }[] = [...per].map(([id, keys]) => ({ id, keys: [...keys] }));

    const altMap = this.content.config.data.alternateVoices ?? {};
    for (const [baseSec, altVoiceIds] of Object.entries(altMap)) {
      const loc = this.content.config.data.locales.find((l) => l.section === baseSec);
      if (!loc) continue;
      const spokenLocale = loc.audioFrom ?? loc.id;
      for (const altVoiceId of altVoiceIds) {
        const altVoice = this.content.config.data.voices[altVoiceId];
        if (!altVoice) continue;
        const altSet = new Set<string>(extra);
        const aliases: [string, string][] = [];
        let complete = true;
        let hasNarration = false;
        const visitAlt = (list: Step[]) => {
          for (const s of list) {
            if (!complete) return;
            if (s.do === 'together') { visitAlt(s.steps); continue; }
            if (s.do !== 'say' || !s.clip) continue;
            if (s.lang === 'zh') {
              const pKey = s.clip[loc.id];
              if (pKey) altSet.add(pKey);
              continue;
            }
            const primaryKey = s.clip[loc.id];
            if (!primaryKey) continue;
            hasNarration = true;
            const raw = typeof s.text === 'string' ? s.text : pick(this.content, s.text, spokenLocale);
            const { key: altKey } = voiceClip(altVoice, raw);
            if (!this.media.clips[altKey]) { complete = false; return; }
            altSet.add(altKey);
            aliases.push([primaryKey, altKey]);
          }
        };
        visitAlt(steps);
        if (complete && hasNarration) out.push({ id: altVoiceId, keys: [...altSet], aliases });
      }
    }
    return out;
  }

  pack(sections: { id: string; keys: string[]; aliases?: [string, string][] }[]): PackedAudio | null {
    if (!sections.some((s) => s.keys.length)) return null;
    const packed = packSections(sections, (key) => readFileSync(clipPath(this.mediaDir, key)), this.gapFrames);
    const primaryKeys = new Set<string>();
    for (const s of sections) {
      if (!s.aliases) for (const k of s.keys) primaryKeys.add(k);
    }
    for (const s of sections) {
      for (const [primaryKey, altKey] of s.aliases ?? []) {
        const pos = packed.clips[altKey]?.[s.id];
        if (pos) (packed.clips[primaryKey] ??= {})[s.id] = pos;
        if (altKey !== primaryKey && !primaryKeys.has(altKey)) delete packed.clips[altKey];
      }
    }
    return packed;
  }
}
