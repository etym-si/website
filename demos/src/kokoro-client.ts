// In-browser Offline Neural TTS powered by Kokoro-82M-v1.0-ONNX (@huggingface/transformers + WASM)
// Supports both English (via phonemizer eSpeak-NG WASM) and Chinese (via pinyin-pro -> Misaki ZHG2P IPA).
// Models and voice style vectors are cached in browser CacheStorage ('transformers-cache' & 'kokoro-voices-v1')
// so synthesis works 100% offline after initial load.
import { AutoTokenizer, StyleTextToSpeech2Model, Tensor, env as hfEnv } from '@huggingface/transformers';
import { phonemize } from 'phonemizer';
import { pinyin } from 'pinyin-pro';
import { normalizeSpokenText } from '../shared/edge-tts-live.ts';

const MODEL_ID = 'Kokoro-82M-v1.0-ONNX';
const IDB_NAME = 'etymsi-kokoro-cache-fp32-v1';
const IDB_STORE = 'responses';
const SAMPLE_RATE = 24000;

const IDB_CHUNK_BYTES = 16 * 1024 * 1024; // 16 MiB per IndexedDB entry (well below Chromium's 128 MiB IPC limit)

interface StoredEntry {
  body: ArrayBuffer;
  contentType: string;
}

interface StoredChunkMeta {
  chunked: true;
  chunkCount: number;
  totalByteLength: number;
  contentType: string;
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbReadRaw(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbWriteRaw(db: IDBDatabase, key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet(key: string): Promise<StoredEntry | null> {
  const db = await openIdb();
  if (!db) return null;
  const raw = await idbReadRaw(db, key);
  if (!raw || typeof raw !== 'object') return null;
  if ('chunked' in raw && (raw as StoredChunkMeta).chunked === true) {
    const meta = raw as StoredChunkMeta;
    const merged = new Uint8Array(meta.totalByteLength);
    let offset = 0;
    for (let i = 0; i < meta.chunkCount; i++) {
      const part = (await idbReadRaw(db, `${key}#part:${i}`)) as ArrayBuffer | Uint8Array | null;
      if (!part) return null;
      const view = part instanceof Uint8Array ? part : new Uint8Array(part);
      merged.set(view, offset);
      offset += view.byteLength;
    }
    return { body: merged.buffer, contentType: meta.contentType };
  }
  return raw as StoredEntry;
}

async function idbPut(key: string, entry: StoredEntry): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  const total = entry.body.byteLength;
  if (total <= IDB_CHUNK_BYTES) {
    await idbWriteRaw(db, key, entry);
    return;
  }
  const src = new Uint8Array(entry.body);
  const chunkCount = Math.ceil(total / IDB_CHUNK_BYTES);
  for (let i = 0; i < chunkCount; i++) {
    const start = i * IDB_CHUNK_BYTES;
    const end = Math.min(start + IDB_CHUNK_BYTES, total);
    const slice = src.slice(start, end).buffer;
    const ok = await idbWriteRaw(db, `${key}#part:${i}`, slice);
    if (!ok) return;
  }
  const meta: StoredChunkMeta = {
    chunked: true,
    chunkCount,
    totalByteLength: total,
    contentType: entry.contentType,
  };
  await idbWriteRaw(db, key, meta);
}

async function fetchAndCacheChunkedOnnx(key: string): Promise<StoredEntry | null> {
  try {
    const metaRes = await fetch(`${key}.meta.json`, { credentials: 'same-origin' });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as StoredChunkMeta;
    if (!meta?.chunked || !meta.chunkCount || !meta.totalByteLength) return null;
    const db = await openIdb();
    const merged = new Uint8Array(meta.totalByteLength);
    let offset = 0;
    const batchSize = 4;
    for (let base = 0; base < meta.chunkCount; base += batchSize) {
      const indices: number[] = [];
      for (let j = base; j < Math.min(base + batchSize, meta.chunkCount); j++) indices.push(j);
      const buffers = await Promise.all(
        indices.map(async (idx) => {
          const r = await fetch(`${key}.part${idx}`, { credentials: 'same-origin' });
          if (!r.ok) throw new Error(`Failed to fetch ${key}.part${idx}: ${r.status}`);
          return r.arrayBuffer();
        }),
      );
      for (let k = 0; k < indices.length; k++) {
        const idx = indices[k]!;
        const buf = buffers[k]!;
        const view = new Uint8Array(buf);
        merged.set(view, offset);
        offset += view.byteLength;
        if (db) await idbWriteRaw(db, `${key}#part:${idx}`, buf);
      }
    }
    if (db) await idbWriteRaw(db, key, meta);
    return { body: merged.buffer, contentType: meta.contentType || 'application/octet-stream' };
  } catch {
    return null;
  }
}

/** IndexedDB-backed CustomCache for @huggingface/transformers (works on HTTP LAN IPs and HTTPS, 100% offline). */
const idbCustomCache = {
  async match(request: Request | string): Promise<Response | undefined> {
    const key = typeof request === 'string' ? request : request.url;
    let hit = await idbGet(key);
    if (!hit && key.endsWith('.onnx')) {
      hit = await fetchAndCacheChunkedOnnx(key);
    }
    if (!hit) return undefined;
    return new Response(hit.body, {
      status: 200,
      headers: { 'Content-Type': hit.contentType, 'Content-Length': String(hit.body.byteLength) },
    });
  },
  async put(request: Request | string, response: Response): Promise<void> {
    const key = typeof request === 'string' ? request : request.url;
    const body = await response.clone().arrayBuffer();
    const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream';
    await idbPut(key, { body, contentType });
  },
};

/** Map UI voice selection IDs to Kokoro-82M voice style vectors (.bin). */
export const KOKORO_VOICE_MAP: Record<string, string> = {
  en: 'af_heart',
  'narr-en-ava': 'af_heart',
  'narr-en-aria': 'af_bella',
  'narr-en-emma': 'bf_emma',
  'narr-en-ana': 'af_nicole',
  zh: 'zf_xiaoxiao',
  'narr-zh-xiaoyi': 'zf_xiaoyi',
  'narr-zh-yunxia': 'zm_yunxia',
  'narr-zh-yunxi': 'zm_yunxi',
  'narr-zh-yunyang': 'zm_yunyang',
  'narr-zh-tw': 'zf_xiaobei',
};

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'r', 'z', 'c', 's', 'j', 'q', 'x'];
const INIT_IPA: Record<string, string> = {
  b: 'p', c: 'ʦʰ', ch: '\uAB67ʰ', d: 't', f: 'f', g: 'k', h: 'x', j: 'ʨ', k: 'kʰ',
  l: 'l', m: 'm', n: 'n', p: 'pʰ', q: 'ʨʰ', r: 'ɻ', s: 's', sh: 'ʂ', t: 'tʰ', x: 'ɕ', z: 'ʦ', zh: '\uAB67',
};
const FINAL_IPA: Record<string, string[]> = {
  a: ['a0'], ai: ['ai0'], an: ['a0', 'n'], ang: ['a0', 'ŋ'], ao: ['au0'],
  e: ['ɤ0'], ei: ['ei0'], en: ['ə0', 'n'], eng: ['ə0', 'ŋ'], er: ['ɚ0'],
  i: ['i0'], ia: ['j', 'a0'], ian: ['j', 'ɛ0', 'n'], iang: ['j', 'a0', 'ŋ'], iao: ['j', 'au0'],
  ie: ['j', 'e0'], in: ['i0', 'n'], iou: ['j', 'ou0'], iu: ['j', 'ou0'], ing: ['i0', 'ŋ'], iong: ['j', 'ʊ0', 'ŋ'],
  ong: ['ʊ0', 'ŋ'], ou: ['ou0'], u: ['u0'], uei: ['w', 'ei0'], ui: ['w', 'ei0'],
  ua: ['w', 'a0'], uai: ['w', 'ai0'], uan: ['w', 'a0', 'n'], uen: ['w', 'ə0', 'n'], un: ['w', 'ə0', 'n'],
  uang: ['w', 'a0', 'ŋ'], ueng: ['w', 'ə0', 'ŋ'], uo: ['w', 'o0'], o: ['w', 'o0'],
  v: ['y0'], ve: ['ɥ', 'e0'], ue: ['ɥ', 'e0'], van: ['ɥ', 'ɛ0', 'n'], vn: ['y0', 'n'],
};
const TONE_ARROW: Record<string, string> = { '1': '→', '2': '↗', '3': '↓', '4': '↘', '5': '', '0': '' };

function syllableToKokoroIpa(py: string): string {
  const m = /^([a-z]+)([0-5])$/.exec(py);
  if (!m) return py;
  const [, base, tone] = m;
  const arrow = TONE_ARROW[tone] ?? '';
  if (base === 'er') return `ɚ${arrow}`;
  if (base === 'n' || base === 'ng' || base === 'm') return `${base}${arrow}`;

  let init = '';
  let fin = base;
  if (base.startsWith('yu')) {
    fin = `v${base.slice(2)}`;
  } else if (base.startsWith('yi')) {
    fin = `i${base.slice(2)}`;
  } else if (base.startsWith('y')) {
    fin = `i${base.slice(1)}`;
    if (fin === 'iu') fin = 'iou';
  } else if (base.startsWith('wu')) {
    fin = 'u';
  } else if (base.startsWith('w')) {
    fin = `u${base.slice(1)}`;
  } else {
    for (const cand of INITIALS) {
      if (base.startsWith(cand)) {
        init = cand;
        fin = base.slice(cand.length);
        break;
      }
    }
  }
  if ((init === 'j' || init === 'q' || init === 'x') && fin.startsWith('u')) {
    fin = `v${fin.slice(1)}`;
  }
  const initStr = init ? INIT_IPA[init] : '';
  if (fin === 'i' && (init === 'zh' || init === 'ch' || init === 'sh' || init === 'r' || init === 'z' || init === 'c' || init === 's')) {
    return `${initStr}ɨ${arrow}`;
  }
  const parts = FINAL_IPA[fin];
  if (!parts) return `${initStr}${fin}${arrow}`;
  return initStr + parts.map((p) => p.replace('0', arrow)).join('');
}

/** Convert Chinese text to Kokoro v1.0 IPA phonemes with tone arrows (→ ↗ ↓ ↘). */
export function zhToKokoroIpa(raw: string): string {
  const cleaned = normalizeSpokenText('zh-CN-XiaoxiaoNeural', raw);
  const tokens = pinyin(cleaned, { toneType: 'num', type: 'array', v: true });
  return tokens
    .map((t) => (/^[a-z]+[0-5]$/.test(t) ? syllableToKokoroIpa(t) : t))
    .join(' ')
    .replace(/[，、]/g, ', ')
    .replace(/[。．]/g, '. ')
    .replace(/！/g, '! ')
    .replace(/？/g, '? ')
    .replace(/：/g, ': ')
    .replace(/；/g, '; ')
    .replace(/[“”「」『』]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convert English text to Kokoro IPA phonemes via eSpeak-NG WASM. */
export async function enToKokoroIpa(raw: string, isBritish = false): Promise<string> {
  const cleaned = normalizeSpokenText('en-US-AvaNeural', raw);
  const lang = isBritish ? 'en' : 'en-us';
  const punctRe = /(\s*[;:,.!?—…"()""]+\s*)+/g;
  const parts: { isPunct: boolean; text: string }[] = [];
  let prev = 0;
  for (const m of cleaned.matchAll(punctRe)) {
    const idx = m.index ?? 0;
    if (prev < idx) parts.push({ isPunct: false, text: cleaned.slice(prev, idx) });
    if (m[0].length > 0) parts.push({ isPunct: true, text: m[0] });
    prev = idx + m[0].length;
  }
  if (prev < cleaned.length) parts.push({ isPunct: false, text: cleaned.slice(prev) });

  const resolved = await Promise.all(
    parts.map(async (p) => (p.isPunct ? p.text : (await phonemize(p.text, lang)).join(' '))),
  );
  let ipa = resolved
    .join('')
    .replace(/ʲ/g, 'j')
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .trim();
  if (!isBritish) {
    ipa = ipa.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  }
  return ipa;
}

interface KokoroEngine {
  model: InstanceType<typeof StyleTextToSpeech2Model>;
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
}

let enginePromise: Promise<KokoroEngine> | null = null;
const voiceCache = new Map<string, Float32Array>();
let statusListeners = new Set<(status: string) => void>();
let currentStatus = 'idle';

export function kokoroStatus(): string {
  return currentStatus;
}

export function onKokoroStatus(fn: (status: string) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function setStatus(s: string): void {
  currentStatus = s;
  for (const fn of statusListeners) fn(s);
}

function appBaseUrl(): string {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  return new URL(base, location.href).href;
}

function configureHfEnv(): void {
  const base = appBaseUrl();
  hfEnv.allowLocalModels = true;
  hfEnv.allowRemoteModels = false;
  hfEnv.localModelPath = `${base}kokoro/models/`;
  hfEnv.useBrowserCache = false;
  hfEnv.useCustomCache = true;
  hfEnv.customCache = idbCustomCache as unknown as typeof hfEnv.customCache;
  if (hfEnv.backends?.onnx?.wasm) {
    hfEnv.backends.onnx.wasm.wasmPaths = `${base}kokoro/wasm/`;
    hfEnv.backends.onnx.wasm.numThreads = 1;
    hfEnv.backends.onnx.wasm.proxy = false;
  }
}

export function ensureKokoroEngine(): Promise<KokoroEngine> {
  if (enginePromise) return enginePromise;
  configureHfEnv();
  setStatus('loading-model');
  enginePromise = (async () => {
    try {
      const uniqueVoices = [...new Set(Object.values(KOKORO_VOICE_MAP))];
      const [model, tokenizer] = await Promise.all([
        StyleTextToSpeech2Model.from_pretrained(MODEL_ID, { dtype: 'fp32', device: 'wasm' }),
        AutoTokenizer.from_pretrained(MODEL_ID),
        ...uniqueVoices.map((v) => loadVoiceVector(v)),
      ]);
      setStatus('ready');
      return { model, tokenizer };
    } catch (e) {
      enginePromise = null;
      setStatus('error');
      throw e;
    }
  })();
  return enginePromise;
}

export async function loadVoiceVector(voiceId: string): Promise<Float32Array> {
  const mem = voiceCache.get(voiceId);
  if (mem) return mem;
  const url = `${appBaseUrl()}kokoro/voices/${voiceId}.bin`;
  const hit = await idbGet(url);
  if (hit) {
    const arr = new Float32Array(hit.body);
    voiceCache.set(voiceId, arr);
    return arr;
  }
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load Kokoro voice ${voiceId}`);
  const buf = await res.arrayBuffer();
  await idbPut(url, { body: buf.slice(0), contentType: 'application/octet-stream' });
  const vec = new Float32Array(buf);
  voiceCache.set(voiceId, vec);
  return vec;
}

/** Encode 24kHz mono Float32Array waveform into a standard 44-byte header 16-bit PCM WAV file. */
export function encodeWav24k(samples: Float32Array): Uint8Array {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buf);
}

/** Synthesize speech 100% in-browser (offline-capable) using Kokoro-82M-v1.0-ONNX. */
export async function synthesizeKokoroBrowser(opts: {
  text: string;
  lang: 'en' | 'zh';
  uiVoiceId: string;
  speed?: number;
}): Promise<{ wavBytes: Uint8Array; kokoroVoice: string; phonemes: string }> {
  const kokoroVoice = KOKORO_VOICE_MAP[opts.uiVoiceId] ?? (opts.lang === 'zh' ? 'zf_xiaoxiao' : 'af_heart');
  const [{ model, tokenizer }, voiceVec, phonemes] = await Promise.all([
    ensureKokoroEngine(),
    loadVoiceVector(kokoroVoice),
    opts.lang === 'zh' ? Promise.resolve(zhToKokoroIpa(opts.text)) : enToKokoroIpa(opts.text, kokoroVoice.startsWith('b')),
  ]);
  const { input_ids } = tokenizer(phonemes, { truncation: true });
  const seqLen = Number(input_ids.dims.at(-1) ?? 1);
  const styleOffset = 256 * Math.min(Math.max(seqLen - 2, 0), 509);
  const styleSlice = voiceVec.slice(styleOffset, styleOffset + 256);
  const inputs = {
    input_ids,
    style: new Tensor('float32', styleSlice, [1, 256]),
    speed: new Tensor('float32', [opts.speed ?? 1], [1]),
  };
  const { waveform } = await model(inputs);
  const wavBytes = encodeWav24k(waveform.data as Float32Array);
  return { wavBytes, kokoroVoice, phonemes };
}
