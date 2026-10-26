// One MP3 per bundle (spec §5): each audio section (en, zh, …) is a run of whole edge-tts frames — itself a valid
// MP3 — with 240 ms of silent frames after every clip, so byte concatenation is exact and seeking has slack.
import { FRAME_BYTES, FRAME_MS } from './media.ts';

export const FRAME_HEADER: readonly number[] = [0xff, 0xf3, 0x64, 0xc4]; // MPEG-2 Layer III, 48 kbps, 24 kHz, mono
export const SILENT_FRAME: Uint8Array = (() => {
  const f = new Uint8Array(FRAME_BYTES);
  f.set(FRAME_HEADER);
  return f;
})();
export const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';

export function isLfsPointer(bytes: Uint8Array): boolean {
  return bytes.length < 1024 && new TextDecoder('latin1').decode(bytes.subarray(0, LFS_POINTER_PREFIX.length)) === LFS_POINTER_PREFIX;
}

export function checkFrames(bytes: Uint8Array, label: string): void {
  if (isLfsPointer(bytes)) throw new Error(`${label} is a Git LFS pointer, not audio (run git lfs pull)`);
  if (!bytes.length || bytes.length % FRAME_BYTES) throw new Error(`${label}: ${bytes.length} bytes is not a whole number of 144-byte frames`);
  for (let i = 0; i < bytes.length; i += FRAME_BYTES) {
    for (let k = 0; k < 4; k++) {
      if (bytes[i + k] !== FRAME_HEADER[k]) throw new Error(`${label}: frame ${i / FRAME_BYTES} is not MPEG-2 Layer III 24 kHz 48 kbps mono`);
    }
  }
}

export interface PackedAudio {
  bytes: Uint8Array;
  sections: Record<string, [start: number, length: number]>;
  clips: Record<string, Record<string, [ms: number, dur: number]>>;
}

export function packSections(sections: { id: string; keys: string[] }[], read: (key: string) => Uint8Array, gapFrames: number): PackedAudio {
  const gap = new Uint8Array(FRAME_BYTES * gapFrames);
  for (let g = 0; g < gapFrames; g++) gap.set(SILENT_FRAME, g * FRAME_BYTES);
  const parts: Uint8Array[] = [];
  const out: PackedAudio = { bytes: new Uint8Array(0), sections: {}, clips: {} };
  let offset = 0;
  for (const { id, keys } of sections) {
    if (!keys.length) continue;
    const start = offset;
    let frame = 0;
    for (const key of keys) {
      const clip = read(key);
      checkFrames(clip, `clip ${key}`);
      const n = clip.length / FRAME_BYTES;
      (out.clips[key] ??= {})[id] = [frame * FRAME_MS, n * FRAME_MS];
      parts.push(clip, gap);
      frame += n + gapFrames;
      offset += clip.length + gap.length;
    }
    out.sections[id] = [start, offset - start];
  }
  const bytes = new Uint8Array(offset);
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  out.bytes = bytes;
  return out;
}
