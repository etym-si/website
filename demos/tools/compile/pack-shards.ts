// Multi-member RFC 1952 .pack.gz shard packer (spec §3).
// Every Protobuf bundle and every voice MP3 section is compressed as an independent gzip member (1f 8b 08 ...)
// with mtime=0 and concatenated into data/packs/pack-XX.<hash>.pack.gz shards capped at MAX_PACK_BYTES (20 MiB).
// Each whole .pack.gz file is a valid .gz archive, AND each [start, length] slice is a standalone .gz stream
// that the browser lazy-loads via HTTP Range and decompresses with DecompressionStream('gzip').
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import type {
  AudioIndex,
  ByteRange,
  CollectionBundle,
  PackMetaB,
  SignBundle,
  StoryBundle,
} from '../../shared/bundle-types.ts';
import {
  decodeCollectionBundle,
  decodeSignBundle,
  decodeStoryBundle,
  encodeCollectionBundle,
  encodeSignBundle,
  encodeStoryBundle,
} from '../../shared/bundle-proto.ts';
import type { PackedAudio } from '../audio/pack.ts';

export const MAX_PACK_BYTES = 20 * 1024 * 1024; // 20 MiB per .pack.gz shard
const SHARD_HEADROOM = 64 * 1024; // 64 KiB safety margin when grouping items into a shard

export interface SliceLoc {
  file: string;
  range: ByteRange;
}

const gzCache = new Map<string, Uint8Array>();

/** Compress `raw` into a deterministic RFC 1952 gzip member (mtime = 0, OS = 3 Unix). */
export function gzipMember(raw: Uint8Array, level = 6): Uint8Array {
  const key = `${level}:${raw.length}:${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
  const cached = gzCache.get(key);
  if (cached) return cached;
  const gz = new Uint8Array(zlib.gzipSync(raw, { level }));
  // Zero mtime (bytes 4..7) and set OS = 3 (Unix, byte 9) for reproducible builds
  gz[4] = 0;
  gz[5] = 0;
  gz[6] = 0;
  gz[7] = 0;
  gz[9] = 3;
  gzCache.set(key, gz);
  return gz;
}

/** Decompress a single [start, length] gzip member slice from a .pack.gz buffer. */
export function gunzipSlice(packBytes: Uint8Array, [start, length]: ByteRange): Uint8Array {
  return new Uint8Array(zlib.gunzipSync(packBytes.subarray(start, start + length)));
}

export function readSignSlice(files: Map<string, Uint8Array>, ref: { file: string; range?: ByteRange }): SignBundle {
  const pack = files.get(ref.file);
  if (!pack || !ref.range) throw new Error(`missing sign slice ${ref.file}`);
  return decodeSignBundle(gunzipSlice(pack, ref.range));
}

export function readStorySlice(files: Map<string, Uint8Array>, ref: { file: string; range?: ByteRange }): StoryBundle {
  const pack = files.get(ref.file);
  if (!pack || !ref.range) throw new Error(`missing story slice ${ref.file}`);
  return decodeStoryBundle(gunzipSlice(pack, ref.range));
}

export function readCollectionSlice(files: Map<string, Uint8Array>, ref: { file: string; range?: ByteRange }): CollectionBundle {
  const pack = files.get(ref.file);
  if (!pack || !ref.range) throw new Error(`missing collection slice ${ref.file}`);
  return decodeCollectionBundle(gunzipSlice(pack, ref.range));
}

interface PreparedAudioSec {
  id: string;
  gz: Uint8Array;
  rawLen: number;
}

interface PreparedItem<T> {
  key: string;
  bundle: Omit<T, 'audio'>;
  encode: (full: T) => Uint8Array;
  audioClips: Record<string, Record<string, [number, number]>> | null;
  secs: PreparedAudioSec[];
  estBytes: number;
  rawAudioBytes: number;
  digest: string;
}

function prepareAudio(packed: PackedAudio | null): {
  clips: Record<string, Record<string, [number, number]>> | null;
  secs: PreparedAudioSec[];
  gzBytes: number;
  rawBytes: number;
} {
  if (!packed) return { clips: null, secs: [], gzBytes: 0, rawBytes: 0 };
  const secs: PreparedAudioSec[] = [];
  let gzBytes = 0;
  let rawBytes = 0;
  for (const [id, [start, length]] of Object.entries(packed.sections)) {
    const raw = packed.bytes.subarray(start, start + length);
    const gz = gzipMember(raw, 1);
    secs.push({ id, gz, rawLen: length });
    gzBytes += gz.length;
    rawBytes += length;
  }
  return { clips: packed.clips, secs, gzBytes, rawBytes };
}

function prepareItem<T extends { audio: AudioIndex | null }>(
  key: string,
  bundle: Omit<T, 'audio'>,
  packed: PackedAudio | null,
  encode: (full: T) => Uint8Array,
): PreparedItem<T> {
  const { clips, secs, gzBytes, rawBytes } = prepareAudio(packed);
  const previewPb = encode({ ...(bundle as object), audio: null } as T);
  const digest = createHash('sha256')
    .update(previewPb)
    .update(packed ? packed.bytes : new Uint8Array(0))
    .digest('hex')
    .slice(0, 16);
  return {
    key,
    bundle,
    encode,
    audioClips: clips,
    secs,
    estBytes: gzBytes + previewPb.length + 128,
    rawAudioBytes: rawBytes,
    digest,
  };
}

function finalizeBatch<T extends { audio: AudioIndex | null }>(
  shardIndex: number,
  kind: 'signs' | 'collections',
  batch: PreparedItem<T>[],
  files: Map<string, Uint8Array>,
  packs: PackMetaB[],
  locations: Map<string, SliceLoc>,
): void {
  if (!batch.length) return;
  const h = createHash('sha256');
  for (const item of batch) h.update(item.key).update(item.digest);
  const hash = h.digest('hex').slice(0, 10);
  const packFile = `data/packs/pack-${String(shardIndex).padStart(2, '0')}.${hash}.pack.gz`;

  const members: Uint8Array[] = [];
  let offset = 0;
  let rawBytes = 0;

  for (const item of batch) {
    let audio: AudioIndex | null = null;
    if (item.audioClips && item.secs.length) {
      const sections: Record<string, [number, number]> = {};
      for (const sec of item.secs) {
        sections[sec.id] = [offset, sec.gz.length];
        members.push(sec.gz);
        offset += sec.gz.length;
        rawBytes += sec.rawLen;
      }
      audio = { mp3: packFile, sections, clips: item.audioClips };
    }
    const full = { ...(item.bundle as object), audio } as T;
    const pbRaw = item.encode(full);
    const pbGz = gzipMember(pbRaw, 6);
    const range: ByteRange = [offset, pbGz.length];
    members.push(pbGz);
    offset += pbGz.length;
    rawBytes += pbRaw.length;
    locations.set(item.key, { file: packFile, range });
  }

  const out = new Uint8Array(offset);
  let at = 0;
  for (const m of members) {
    out.set(m, at);
    at += m.length;
  }
  files.set(packFile, out);
  packs.push({ file: packFile, bytes: out.length, rawBytes, items: batch.length, kind });
}

export function packSignShards(
  signs: { key: string; bundle: Omit<SignBundle, 'audio'>; packed: PackedAudio | null }[],
  files: Map<string, Uint8Array>,
  packs: PackMetaB[],
): Map<string, SliceLoc> {
  const locations = new Map<string, SliceLoc>();
  const limit = MAX_PACK_BYTES - SHARD_HEADROOM;
  let batch: PreparedItem<SignBundle>[] = [];
  let batchEst = 0;

  for (const s of signs) {
    const item = prepareItem<SignBundle>(s.key, s.bundle, s.packed, encodeSignBundle);
    if (batch.length > 0 && batchEst + item.estBytes > limit) {
      finalizeBatch(packs.length, 'signs', batch, files, packs, locations);
      batch = [];
      batchEst = 0;
    }
    batch.push(item);
    batchEst += item.estBytes;
  }
  if (batch.length > 0) {
    finalizeBatch(packs.length, 'signs', batch, files, packs, locations);
  }
  return locations;
}

export function packStoriesAndCollections(
  stories: { key: string; bundle: Omit<StoryBundle, 'audio'>; packed: PackedAudio | null }[],
  buildCollections: (storyLocs: Map<string, SliceLoc>) => { key: string; bundle: Omit<CollectionBundle, 'audio'>; packed: PackedAudio | null }[],
  files: Map<string, Uint8Array>,
  packs: PackMetaB[],
): { storyLocs: Map<string, SliceLoc>; collectionLocs: Map<string, SliceLoc> } {
  const storyLocs = new Map<string, SliceLoc>();
  const collectionLocs = new Map<string, SliceLoc>();

  const preparedStories = stories.map((st) => prepareItem<StoryBundle>(st.key, st.bundle, st.packed, encodeStoryBundle));
  // Compute a deterministic shard hash over the stories and collection ids
  const shardIdx = packs.length;
  const h = createHash('sha256');
  for (const st of preparedStories) h.update(st.key).update(st.digest);

  // First pass: assign story offsets starting at 0 using a placeholder pack filename to build collections
  const placeholderPack = `data/packs/pack-${String(shardIdx).padStart(2, '0')}.0000000000.pack.gz`;
  const tempStoryLocs = new Map<string, SliceLoc>();
  let tempOffset = 0;
  for (const item of preparedStories) {
    for (const sec of item.secs) tempOffset += sec.gz.length;
    const tempAudio: AudioIndex | null =
      item.audioClips && item.secs.length
        ? { mp3: placeholderPack, sections: Object.fromEntries(item.secs.map((s) => [s.id, [0, s.gz.length]])), clips: item.audioClips }
        : null;
    const pbGz = gzipMember(item.encode({ ...(item.bundle as object), audio: tempAudio } as StoryBundle), 6);
    tempStoryLocs.set(item.key, { file: placeholderPack, range: [tempOffset, pbGz.length] });
    tempOffset += pbGz.length;
  }

  const rawColls = buildCollections(tempStoryLocs);
  const preparedColls = rawColls.map((c) => prepareItem<CollectionBundle>(c.key, c.bundle, c.packed, encodeCollectionBundle));
  for (const c of preparedColls) h.update(c.key).update(c.digest);
  const hash = h.digest('hex').slice(0, 10);
  const packFile = `data/packs/pack-${String(shardIdx).padStart(2, '0')}.${hash}.pack.gz`;

  const members: Uint8Array[] = [];
  let offset = 0;
  let rawBytes = 0;

  for (const item of preparedStories) {
    let audio: AudioIndex | null = null;
    if (item.audioClips && item.secs.length) {
      const sections: Record<string, [number, number]> = {};
      for (const sec of item.secs) {
        sections[sec.id] = [offset, sec.gz.length];
        members.push(sec.gz);
        offset += sec.gz.length;
        rawBytes += sec.rawLen;
      }
      audio = { mp3: packFile, sections, clips: item.audioClips };
    }
    const pbRaw = item.encode({ ...(item.bundle as object), audio } as StoryBundle);
    const pbGz = gzipMember(pbRaw, 6);
    storyLocs.set(item.key, { file: packFile, range: [offset, pbGz.length] });
    members.push(pbGz);
    offset += pbGz.length;
    rawBytes += pbRaw.length;
  }

  const finalColls = buildCollections(storyLocs).map((c) => prepareItem<CollectionBundle>(c.key, c.bundle, c.packed, encodeCollectionBundle));
  for (const item of finalColls) {
    let audio: AudioIndex | null = null;
    if (item.audioClips && item.secs.length) {
      const sections: Record<string, [number, number]> = {};
      for (const sec of item.secs) {
        sections[sec.id] = [offset, sec.gz.length];
        members.push(sec.gz);
        offset += sec.gz.length;
        rawBytes += sec.rawLen;
      }
      audio = { mp3: packFile, sections, clips: item.audioClips };
    }
    const pbRaw = item.encode({ ...(item.bundle as object), audio } as CollectionBundle);
    const pbGz = gzipMember(pbRaw, 6);
    collectionLocs.set(item.key, { file: packFile, range: [offset, pbGz.length] });
    members.push(pbGz);
    offset += pbGz.length;
    rawBytes += pbRaw.length;
  }

  if (members.length > 0) {
    const out = new Uint8Array(offset);
    let at = 0;
    for (const m of members) {
      out.set(m, at);
      at += m.length;
    }
    files.set(packFile, out);
    packs.push({
      file: packFile,
      bytes: out.length,
      rawBytes,
      items: preparedStories.length + finalColls.length,
      kind: 'collections',
    });
  }
  return { storyLocs, collectionLocs };
}
