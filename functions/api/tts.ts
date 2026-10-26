// Cloudflare Pages Function: GET /api/tts?voice=en-US-AvaNeural&rate=-5%25&text=...
// Stateless dynamic Edge-TTS synthesizer with Cloudflare Edge Cache (caches.default) and strict input validation.
import { synthesizeEdgeTts, validateTtsParams } from '../../demos/shared/edge-tts-live.ts';

interface PagesContext {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
}

const RESPONSE_HEADERS: Record<string, string> = {
  'Content-Type': 'audio/mpeg',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};

export async function onRequest(ctx: PagesContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD', 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const url = new URL(request.url);
  const check = validateTtsParams(url.searchParams);
  if (!check.ok) {
    return new Response(JSON.stringify({ error: check.error }), {
      status: check.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const cacheStorage = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(
    `https://tts-cache.etym.si/v1?voice=${encodeURIComponent(check.voice)}&rate=${encodeURIComponent(check.rate)}&text=${encodeURIComponent(check.text)}`,
    { method: 'GET' },
  );

  if (cacheStorage) {
    const hit = await cacheStorage.match(cacheKey);
    if (hit) {
      const h = new Headers(hit.headers);
      h.set('X-TTS-Cache', 'HIT');
      return new Response(request.method === 'HEAD' ? null : hit.body, { status: 200, headers: h });
    }
  }

  try {
    const mp3 = await synthesizeEdgeTts({ voice: check.voice, rate: check.rate, text: check.text });
    const headers: Record<string, string> = {
      ...RESPONSE_HEADERS,
      'Content-Length': String(mp3.byteLength),
      'X-TTS-Cache': 'MISS',
    };
    const copy = new Uint8Array(mp3.byteLength);
    copy.set(mp3);
    const res = new Response(copy, { status: 200, headers });
    if (cacheStorage) {
      ctx.waitUntil(cacheStorage.put(cacheKey, res.clone()));
    }
    return request.method === 'HEAD' ? new Response(null, { status: 200, headers }) : res;
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream TTS synthesis failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    });
  }
}
