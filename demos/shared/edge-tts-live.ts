// Pure TypeScript Edge-TTS client (Cloudflare Workers + Node.js 24 compatible, zero external npm packages).
// Implements the v2 Sec-MS-GEC DRM token and the Read-Aloud WebSocket SSML -> MP3 streaming protocol.

export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export const CHROMIUM_FULL_VERSION = '143.0.3650.75';
export const CHROMIUM_MAJOR_VERSION = '143';
export const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
export const EDGE_TTS_HOST = 'speech.platform.bing.com';
export const EDGE_TTS_PATH = `/consumer/speech/synthesize/readaloud/edge/v1`;

/** Strict allow-list of permitted neural voice names to prevent SSML injection or abuse. */
export const ALLOWED_EDGE_VOICES: ReadonlySet<string> = new Set([
  'en-US-AvaMultilingualNeural',
  'en-US-AvaNeural',
  'en-US-AriaNeural',
  'en-US-EmmaNeural',
  'en-US-AnaNeural',
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaoyiNeural',
  'zh-CN-YunxiaNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-YunyangNeural',
  'zh-TW-HsiaoChenNeural',
]);

export const RATE_PATTERN = /^[+-]\d{1,2}%$/;
export const MAX_TEXT_CHARS = 400;

const WIN_EPOCH = 11644473600;

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
];
const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
];
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const SHA256_ADJUSTMENT = 0xc9dc06a7;
const SHA256_BLOCK_CONSTANTS = [
  ...SHA256_ROUND_CONSTANTS.slice(0, 14),
  SHA256_ADJUSTMENT,
  ...SHA256_ROUND_CONSTANTS.slice(15),
];
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;

const CS64_COEFFICIENTS: readonly [number, number][] = [
  [0xe82e91b1, 0xb32700d0],
  [0x44de24c6, 0x88dff51d],
  [0x3beb65bc, 0x29514038],
  [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5],
  [0x314ef5d5, 0x26e55f3c],
  [0xe92491b1, 0x607801c6],
  [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da],
  [0xda79fa60, 0x207cc464],
  [0xbed20560, 0x3c3c74f3],
  [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1],
  [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
const CS64_ADJUSTMENT1 = 0x0b1a0000;

function u32(x: number): number {
  return x >>> 0;
}

function mul32(a: number, b: number): number {
  return Math.imul(a, b) >>> 0;
}

function rol16(v: number): number {
  const x = v >>> 0;
  return ((x << 16) | (x >>> 16)) >>> 0;
}

function rotr(x: number, n: number): number {
  const v = x >>> 0;
  return ((v >>> n) | (v << (32 - n))) >>> 0;
}

function sigma0(v: number): number {
  const x = v >>> 0;
  return (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
}

function sigma1(v: number): number {
  const x = v >>> 0;
  return (rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)) >>> 0;
}

function sha256Rounds(state: number[], words: number[], firstRound = 0): number[] {
  let [a, b, c, d, e, f, g, h] = state.map(u32);
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  for (let i = firstRound; i < 64; i++) {
    const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch = g ^ (e & (f ^ g));
    const t1 = u32(h + s1 + ch + constants[i] + words[i]);
    const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj = (a & b) | (c & (a | b));
    const t2 = u32(s0 + maj);
    h = g;
    g = f;
    f = e;
    e = u32(d + t1);
    d = c;
    c = b;
    b = a;
    a = u32(t1 + t2);
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSchedule(words: number[], firstWord = 16): void {
  for (let i = firstWord; i < 64; i++) {
    const s1 = sigma1(words[i - 2]);
    const s0 = sigma0(words[i - 15]);
    words.push(u32(s1 + words[i - 7] + s0 + words[i - 16]));
  }
}

function sha256Init(data7: Uint8Array): number[] {
  const w14 = ((data7[0] << 16) | (data7[1] << 8) | data7[2]) >>> 0;
  const w15 = ((data7[3] << 24) | (data7[4] << 16) | (data7[5] << 8) | data7[6]) >>> 0;
  const words: number[] = [...new Array<number>(14).fill(0), w14, w15];
  for (let i = 16; i < 30; i++) {
    let val = SHA256_SCHEDULE[i - 16];
    if (i - 2 >= 14) {
      val = u32(val + (i === 16 ? (sigma1(words[i - 2]) ^ SHA256_SIGMA1_ADJUSTMENT) >>> 0 : sigma1(words[i - 2])));
    }
    if (i - 7 >= 14) {
      val = u32(val + words[i - 7]);
    }
    if (i - 15 >= 14) {
      val = u32(val + (i === 29 ? (sigma0(words[i - 15]) ^ SHA256_SIGMA0_ADJUSTMENT) >>> 0 : sigma0(words[i - 15])));
    }
    words.push(val);
  }
  words.push(
    u32(
      sigma1(words[28]) +
        words[23] +
        sigma0(words[15]) +
        words[14] +
        SHA256_ADJUSTMENT -
        SHA256_ROUND_CONSTANTS[14],
    ),
  );
  expandSchedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  return SHA256_INITIAL.map((x, idx) => u32(x + working[idx]));
}

function sha256Digest(data: Uint8Array): Uint8Array {
  const length = 57 + data.length;
  const tail = data.subarray(7);
  const padZeroes = (((55 - length) % 64) + 64) % 64;
  const padded = new Uint8Array(tail.length + 1 + padZeroes + 8);
  padded.set(tail, 0);
  padded[tail.length] = 0x80;
  const bitLen = BigInt(length) * 8n;
  const dv = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  dv.setBigUint64(padded.length - 8, bitLen, false);

  let state = sha256Init(data.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = [];
    for (let k = 0; k < 16; k++) {
      words.push(dv.getUint32(offset + k * 4, false));
    }
    expandSchedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    state = state.map((x, idx) => u32(x + working[idx]));
  }
  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outDv.setUint32(i * 4, state[i], false);
  return out;
}

function wordsLe4Even(data: Uint8Array): number[] {
  const rem = (4 - (data.length % 4)) % 4;
  const padded = new Uint8Array(data.length + rem);
  padded.set(data, 0);
  if (!padded.length) return [];
  const dv = new DataView(padded.buffer);
  const words: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(dv.getUint32(i, true));
  }
  if (words.length % 2 === 1) words.push(0);
  return words;
}

function cs64Digest(data: Uint8Array, digest: Uint8Array): [number, number] {
  const dDv = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const keyA = (dDv.getUint32(0, true) | 1) >>> 0;
  const keyB = (dDv.getUint32(4, true) | 1) >>> 0;
  const factors: [number, number] = [mul32(keyA, CS64_FACTOR), mul32(keyB, CS64_FACTOR)];
  const terms: number[] = CS64_COEFFICIENTS.map(([coeff], idx) => mul32(coeff, factors[idx % 2]));
  const offsets: number[] = CS64_COEFFICIENTS.map(([, off]) => off >>> 0);

  const prefixed = new Uint8Array(1 + data.length);
  prefixed.set(data, 1);
  const words = wordsLe4Even(prefixed);
  for (let idx = 0; idx < words.length; idx++) {
    const word = words[idx];
    let term = mul32(word, idx % 2 === 0 ? keyA : keyB);
    let offset = mul32(rol16(word), idx % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (idx === 0) {
      term = u32(term + mul32(CS64_ADJUSTMENT0, factors[0]));
      offset = u32(offset + CS64_ADJUSTMENT1);
    }
    terms.push(term);
    offsets.push(offset);
  }

  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let idx = 0; idx < terms.length; idx += 2) {
    const x = terms[idx];
    const y = terms[idx + 1];
    let t = rol16(u32(offsets[idx] + x));
    let q = mul32(t, 0x76f50f34);
    swapAcc = u32(swapAcc + u32(mul32(rol16(q), 0xc3efea97) + q));

    t = rol16(u32(offsets[idx + 1] + y));
    q = mul32(t, 0x1881ce3c);
    swapLast = u32(mul32(rol16(q), 0x35bd1ec9) + q);
    swapAcc = u32(swapAcc + swapLast);

    state = u32(mul32(state, keyA) + x);
    state = mul32(rol16(state), 0xcf98b111);
    state = mul32(rol16(state), 0x87085b9f);
    state = mul32(rol16(state), 0x12ceb96d);
    state = mul32(rol16(state), 0x257e1d83);
    acc = u32(acc + state);

    t = u32(mul32(state, keyB) + y);
    t = mul32(rol16(t), 0xa27416f5);
    t = mul32(rol16(t), 0xd38396ff);
    state = mul32(rol16(mul32(rol16(t), 0x7c932b89)), 0xbfa49f69);
    acc = u32(acc + state);
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}

function toHexUpper(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out.toUpperCase();
}

/** Generate the v2 Sec-MS-GEC DRM token ("<16 hex>-<64 hex>"). */
export function generateSecMsGecV2(unixSeconds = Date.now() / 1000): string {
  let ticks = Math.floor(unixSeconds) + WIN_EPOCH;
  ticks -= ticks % 300;
  const ticks100ns = BigInt(ticks) * 10_000_000n;
  const strToHash = `${ticks100ns.toString()}${TRUSTED_CLIENT_TOKEN}`;
  const data = new TextEncoder().encode(strToHash);
  const digest = sha256Digest(data);
  const [cs0, cs1] = cs64Digest(data, digest);
  const csBytes = new Uint8Array(8);
  const csDv = new DataView(csBytes.buffer);
  csDv.setUint32(0, cs0, true);
  csDv.setUint32(4, cs1, true);
  return `${toHexUpper(csBytes)}-${toHexUpper(digest)}`;
}

export function randomHex(byteCount = 16): string {
  const buf = new Uint8Array(byteCount);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0');
  return out;
}

export function escapeXml(raw: string): string {
  let clean = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
      clean += ' ';
    } else {
      clean += raw[i];
    }
  }
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSpeechConfigFrame(timestamp = new Date().toUTCString()): string {
  return (
    `X-Timestamp:${timestamp}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`
  );
}

export function buildSsmlFrame(
  reqId: string,
  voice: string,
  rate: string,
  text: string,
  timestamp = new Date().toUTCString(),
): string {
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='+0Hz' rate='${rate}' volume='+0%'>` +
    `${escapeXml(text)}` +
    `</prosody></voice></speak>`;
  return (
    `X-RequestId:${reqId}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${timestamp}Z\r\n` +
    `Path:ssml\r\n\r\n` +
    ssml
  );
}

export function extractAudioFromBinaryFrame(frame: Uint8Array): Uint8Array | null {
  if (frame.length < 2) return null;
  const headerLen = (frame[0] << 8) | frame[1];
  if (headerLen + 2 > frame.length) return null;
  const headerStr = new TextDecoder().decode(frame.subarray(2, 2 + headerLen));
  if (!headerStr.includes('Path:audio')) return null;
  const audio = frame.subarray(2 + headerLen);
  return audio.length > 0 ? audio : null;
}

export function buildEdgeTtsQuery(connId = randomHex(16), unixSeconds?: number): string {
  const gec = generateSecMsGecV2(unixSeconds);
  return `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connId}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
}

export function edgeTtsRequestHeaders(muid = randomHex(16).toUpperCase()): Record<string, string> {
  return {
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    Cookie: `muid=${muid};`,
  };
}

/** Voice-aware text normalization matching content/config.yaml so raw UI strings speak naturally. */
export function normalizeSpokenText(voice: string, raw: string): string {
  let s = raw.trim();
  if (voice.startsWith('en-')) {
    if (!voice.includes('Multilingual')) {
      s = s.replace(/\s*:\s*[\u4e00-\u9fff]+([.!?])/g, '$1');
      s = s.replace(/\s*—\s*[\u4e00-\u9fff]+\s*—\s*/g, ' ');
    }
    s = s
      .replace(/\s*[艹氵虍宀犭厂口](?![\p{L}\p{N}_])/gu, '')
      .replace(/—/g, ', ')
      .replace(/…/g, '...')
      .replace(/\s+/g, ' ')
      .trim();
  } else if (voice.startsWith('zh-')) {
    s = s
      .replaceAll('草字头“艹”', '草字头')
      .replaceAll('“艹”', '草字头')
      .replaceAll('”虍', '”')
      .replaceAll('屋顶“宀”', '宝盖头')
      .replaceAll('反犬旁“犭”', '反犬旁')
      .replaceAll('山崖“厂”', '山崖厂字头')
      .replaceAll('“厂”', '厂字头')
      .trim();
  }
  return s || raw.trim();
}

export interface EdgeTtsOptions {
  voice: string;
  rate?: string;
  text: string;
}

/** Validate and sanitize untrusted query parameters before synthesis. */
export function validateTtsParams(params: URLSearchParams): { ok: true; voice: string; rate: string; text: string } | { ok: false; status: number; error: string } {
  const voice = (params.get('voice') ?? 'en-US-AvaNeural').trim();
  if (!ALLOWED_EDGE_VOICES.has(voice)) {
    return { ok: false, status: 400, error: 'Unsupported voice parameter' };
  }
  const rate = (params.get('rate') ?? '+0%').trim();
  if (!RATE_PATTERN.test(rate)) {
    return { ok: false, status: 400, error: 'Invalid rate format' };
  }
  const rawText = (params.get('text') ?? '').trim();
  if (!rawText || rawText.length > MAX_TEXT_CHARS) {
    return { ok: false, status: 400, error: `Text must be 1..${MAX_TEXT_CHARS} characters` };
  }
  const text = normalizeSpokenText(voice, rawText);
  return { ok: true, voice, rate, text };
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  // Append 4 silent 144-byte CBR frames (~96ms) so browser <audio> elements never clip the final phoneme
  const padFrames = 4;
  const out = new Uint8Array(total + padFrames * 144);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  for (let i = 0; i < padFrames; i++) {
    const base = offset + i * 144;
    out[base] = 0xff;
    out[base + 1] = 0xf3;
    out[base + 2] = 0x64;
    out[base + 3] = 0xc4;
  }
  return out;
}

/**
 * Connect to Microsoft Edge Read-Aloud WebSocket and stream back the synthesized MP3 bytes.
 * Supports both Cloudflare Workers (`fetch` with `Upgrade: websocket` -> `res.webSocket`)
 * and Node.js 24 (`new WebSocket(url, { headers })`).
 */
export async function synthesizeEdgeTts(opts: EdgeTtsOptions): Promise<Uint8Array> {
  const rate = opts.rate ?? '+0%';
  const query = buildEdgeTtsQuery();
  const headers = edgeTtsRequestHeaders();
  const configFrame = buildSpeechConfigFrame();
  const ssmlFrame = buildSsmlFrame(randomHex(16), opts.voice, rate, opts.text);

  // Check if running in Cloudflare Workers runtime where fetch Upgrade: websocket returns res.webSocket
  const isCfWorkers = typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers');
  if (isCfWorkers) {
    const httpsUrl = `https://${EDGE_TTS_HOST}${EDGE_TTS_PATH}${query}`;
    const res = await fetch(httpsUrl, {
      headers: { ...headers, Upgrade: 'websocket' },
    }) as Response & { webSocket?: WebSocket };
    const ws = res.webSocket;
    if (!ws) throw new Error(`Edge-TTS WebSocket upgrade failed (${res.status})`);
    (ws as unknown as { accept(): void }).accept();
    return await collectFromWebSocket(ws, configFrame, ssmlFrame, true);
  }

  const wssUrl = `wss://${EDGE_TTS_HOST}${EDGE_TTS_PATH}${query}`;
  const WsCtor = WebSocket as unknown as new (url: string, opts?: { headers?: Record<string, string> }) => WebSocket;
  const ws = new WsCtor(wssUrl, { headers });
  ws.binaryType = 'arraybuffer';
  return await collectFromWebSocket(ws, configFrame, ssmlFrame, false);
}

function collectFromWebSocket(
  ws: WebSocket,
  configFrame: string,
  ssmlFrame: string,
  alreadyOpen: boolean,
): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error('Edge-TTS synthesis timed out'));
      }
    }, 15_000);

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      if (err) reject(err);
      else if (chunks.length === 0) reject(new Error('No audio received from Edge-TTS'));
      else resolve(concatChunks(chunks));
    };

    const sendInit = () => {
      try {
        ws.send(configFrame);
        ws.send(ssmlFrame);
      } catch (e) {
        finish(e as Error);
      }
    };

    if (alreadyOpen) {
      sendInit();
    } else {
      ws.addEventListener('open', sendInit);
    }

    ws.addEventListener('message', (ev: MessageEvent) => {
      if (typeof ev.data === 'string') {
        if (ev.data.includes('Path:turn.end')) {
          finish();
        }
      } else if (ev.data instanceof ArrayBuffer) {
        const audio = extractAudioFromBinaryFrame(new Uint8Array(ev.data));
        if (audio) chunks.push(audio);
      } else if (ArrayBuffer.isView(ev.data)) {
        const view = ev.data as ArrayBufferView;
        const audio = extractAudioFromBinaryFrame(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
        if (audio) chunks.push(audio);
      }
    });

    ws.addEventListener('error', () => {
      finish(new Error('Edge-TTS WebSocket error'));
    });

    ws.addEventListener('close', () => {
      if (!settled) {
        if (chunks.length > 0) finish();
        else finish(new Error('Edge-TTS WebSocket closed before turn.end'));
      }
    });
  });
}

