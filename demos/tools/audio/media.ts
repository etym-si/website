// media/manifest.json lists every synthesized clip (plain git); the MP3 masters live in media/clips/ (Git LFS).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const FRAME_BYTES = 144; // MPEG-2 Layer III, 24 kHz, 48 kbps, mono
export const FRAME_MS = 24;

export interface ClipInfo { provider: string; voice: string; rate: string; text: string; bytes: number; ms: number }
export interface MediaManifest { v: 1; clips: Record<string, ClipInfo> }

export const clipPath = (mediaDir: string, key: string): string => path.join(mediaDir, 'clips', `${key}.mp3`);
export const clipMs = (bytes: number): number => (bytes / FRAME_BYTES) * FRAME_MS;
const manifestPath = (mediaDir: string) => path.join(mediaDir, 'manifest.json');

export function readMediaManifest(mediaDir: string): MediaManifest {
  const p = manifestPath(mediaDir);
  if (!existsSync(p)) return { v: 1, clips: {} };
  const m = JSON.parse(readFileSync(p, 'utf8')) as MediaManifest;
  if (m.v !== 1 || !m.clips || typeof m.clips !== 'object') throw new Error(`${p}: unsupported manifest format`);
  return m;
}

export function writeMediaManifest(mediaDir: string, m: MediaManifest): void {
  const clips = Object.fromEntries(Object.entries(m.clips).sort(([a], [b]) => (a < b ? -1 : 1)));
  mkdirSync(mediaDir, { recursive: true });
  writeFileSync(manifestPath(mediaDir), JSON.stringify({ v: 1, clips }, null, 1) + '\n');
}
