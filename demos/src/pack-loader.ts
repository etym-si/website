// Range-loader + native DecompressionStream('gzip') for multi-member .pack.gz shards, with live telemetry
// for the Pack & Lazy-Load Inspector UI.
import type { PackMetaB } from '../shared/bundle-types.ts';

const base = import.meta.env.BASE_URL;

export interface PackSliceEntry {
  id: number;
  label: string;
  kind: 'proto' | 'audio';
  file: string;
  range: [number, number];
  gzBytes: number;
  rawBytes: number;
  status: number;
  ms: number;
}

class PackTelemetry {
  readonly entries: PackSliceEntry[] = [];
  totalSlices = 0;
  totalGzBytes = 0;
  totalRawBytes = 0;
  private nextId = 1;
  private readonly listeners = new Set<() => void>();

  record(entry: Omit<PackSliceEntry, 'id'>): void {
    const full: PackSliceEntry = { id: this.nextId++, ...entry };
    this.entries.unshift(full);
    if (this.entries.length > 250) this.entries.pop();
    this.totalSlices += 1;
    this.totalGzBytes += entry.gzBytes;
    this.totalRawBytes += entry.rawBytes;
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  summary(packs: readonly PackMetaB[]): {
    slices: number;
    fetchedGzBytes: number;
    fetchedRawBytes: number;
    totalPackGzBytes: number;
    totalPackRawBytes: number;
    shardCount: number;
  } {
    let totalPackGzBytes = 0;
    let totalPackRawBytes = 0;
    for (const p of packs) {
      totalPackGzBytes += p.bytes;
      totalPackRawBytes += p.rawBytes;
    }
    return {
      slices: this.totalSlices,
      fetchedGzBytes: this.totalGzBytes,
      fetchedRawBytes: this.totalRawBytes,
      totalPackGzBytes,
      totalPackRawBytes,
      shardCount: packs.length,
    };
  }
}

export const packTelemetry = new PackTelemetry();

/** Decompress a gzip member (`1f 8b ...`) using the browser/runtime DecompressionStream('gzip'). */
export async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lazy-fetch a single gzip member [start, length] from a .pack.gz shard and gunzip it in memory. */
export async function fetchPackRange(opts: {
  file: string;
  range?: [number, number];
  label: string;
  kind: 'proto' | 'audio';
}): Promise<Uint8Array> {
  const t0 = performance.now();
  const headers: Record<string, string> = {};
  if (opts.range) {
    const [start, length] = opts.range;
    headers.Range = `bytes=${start}-${start + length - 1}`;
  }
  const res = await fetch(base + opts.file, { headers, credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${opts.file}`);
  let gz = new Uint8Array(await res.arrayBuffer());
  if (opts.range) {
    const [start, length] = opts.range;
    if (res.status !== 206) gz = gz.slice(start, start + length); // fallback when server ignores Range
    if (gz.length !== length) throw new Error(`truncated pack slice in ${opts.file}`);
  }
  const raw = await gunzipBytes(gz);
  const ms = Math.max(1, Math.round(performance.now() - t0));
  packTelemetry.record({
    label: opts.label,
    kind: opts.kind,
    file: opts.file,
    range: opts.range ?? [0, gz.length],
    gzBytes: gz.length,
    rawBytes: raw.length,
    status: res.status,
    ms,
  });
  return raw;
}
