// Content-addressed narration clips (spec §5): key = sha256(provider|voice|rate|spokenText).
// A line is synthesized once ever; changing voice, rate or provider changes the key and re-records it once.
import { createHash } from 'node:crypto';
import type { Config } from '../content/schema.ts';

export type Voice = Config['voices'][string];

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export function clipKey(provider: string, voice: string, rate: string, spoken: string): string {
  return sha256(`${provider}|${voice}|${rate}|${spoken}`);
}

/** Apply the voice's normalization rules from config.yaml in order, then trim. */
export function spokenText(voice: Voice, text: string): string {
  let s = text;
  for (const r of voice.normalize ?? []) {
    s = r.literal ? s.split(r.find).join(r.replace) : s.replace(new RegExp(r.find, 'gu'), r.replace);
  }
  return s.trim();
}

export function voiceClip(voice: Voice, text: string): { key: string; spoken: string } {
  const spoken = spokenText(voice, text);
  return { key: clipKey(voice.provider, voice.voice, voice.rate, spoken), spoken };
}

/** The name the retired scripts/fetch-tts.py gave a clip. Only used to prove the migration. */
export function legacyClipName(lang: 'en' | 'zh', spoken: string): string {
  return `${lang}-${sha256(`${lang}:${spoken}`).slice(0, 12)}.mp3`;
}
