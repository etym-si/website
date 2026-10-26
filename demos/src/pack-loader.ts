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

const SLICE_DB = 'etymsi-pack-slices-v1';
const SLICE_STORE = 'slices';

function openSliceDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(SLICE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SLICE_STORE)) db.createObjectStore(SLICE_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getSliceCache(key: string): Promise<Uint8Array | null> {
  const db = await openSliceDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(SLICE_STORE, 'readonly').objectStore(SLICE_STORE).get(key);
      req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function putSliceCache(key: string, gz: Uint8Array): Promise<void> {
  const db = await openSliceDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SLICE_STORE, 'readwrite');
      tx.objectStore(SLICE_STORE).put(gz, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Lazy-fetch a single gzip member [start, length] from a .pack.gz shard and gunzip it in memory (with IndexedDB offline fallback). */
export async function fetchPackRange(opts: {
  file: string;
  range?: [number, number];
  label: string;
  kind: 'proto' | 'audio';
}): Promise<Uint8Array> {
  const t0 = performance.now();
  const cacheKey = opts.range ? `${opts.file}@${opts.range[0]}+${opts.range[1]}` : opts.file;
  const headers: Record<string, string> = {};
  if (opts.range) {
    const [start, length] = opts.range;
    headers.Range = `bytes=${start}-${start + length - 1}`;
  }
  let gz: Uint8Array;
  let status = 206;
  try {
    const res = await fetch(base + opts.file, { headers, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${opts.file}`);
    status = res.status;
    gz = new Uint8Array(await res.arrayBuffer());
    if (opts.range) {
      const [start, length] = opts.range;
      if (res.status !== 206) gz = gz.slice(start, start + length); // fallback when server ignores Range
      if (gz.length !== length) throw new Error(`truncated pack slice in ${opts.file}`);
    }
    void putSliceCache(cacheKey, gz);
  } catch (err) {
    const cached = await getSliceCache(cacheKey);
    if (!cached) throw err;
    gz = cached;
    status = 200;
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
    status,
    ms,
  });
  return raw;
}
