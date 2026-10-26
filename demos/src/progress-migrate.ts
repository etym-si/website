// Learner progress lives only in localStorage (no accounts, no personal data). Stored data is untrusted, so every
// field is validated. v1 (lesson ids like `u1-l1`, stickers as bare characters) is migrated to v2
// (`film-36/u1-l1`, `han/马`). No imports, so Node tests can load this file directly.
export interface ProgressV2 {
  v: 2;
  xp: number;
  streak: number;
  lastDay: string | null; // YYYY-MM-DD (local)
  done: Record<string, number>; // lesson id → best stars (1..3)
  stickers: string[]; // learned sign keys
}

export const freshProgress = (): ProgressV2 => ({ v: 2, xp: 0, streak: 0, lastDay: null, done: {}, stickers: [] });

const LESSON_ID = /^[a-z0-9][a-z0-9-]{0,63}\/u\d{1,4}-[a-z0-9-]{1,32}$/;
const LEGACY_LESSON_ID = /^u\d{1,4}-[a-z0-9-]{1,32}$/;
const SIGN_KEY = /^[a-z][a-z0-9-]{0,31}\/[^/\s]{1,32}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const count = (v: unknown, max: number): number => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, max) : 0);

export function parseProgress(rawV2: string | null, rawV1: string | null, defaults: { system: string; collection: string }): ProgressV2 {
  const v2 = parse(rawV2);
  const src = v2?.v === 2 ? v2 : parse(rawV1);
  if (!src || (src.v !== 1 && src.v !== 2)) return freshProgress();
  const legacy = src.v === 1;
  const p = freshProgress();
  p.xp = count(src.xp, 1e7);
  p.streak = count(src.streak, 1e5);
  p.lastDay = typeof src.lastDay === 'string' && DAY.test(src.lastDay) ? src.lastDay : null;
  if (src.done && typeof src.done === 'object') {
    for (const [k, v] of Object.entries(src.done as Record<string, unknown>)) {
      const id = legacy && LEGACY_LESSON_ID.test(k) ? `${defaults.collection}/${k}` : k;
      if (LESSON_ID.test(id) && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 3) p.done[id] = v as number;
    }
  }
  if (Array.isArray(src.stickers)) {
    const keys = src.stickers
      .filter((x): x is string => typeof x === 'string')
      .map((x) => (legacy && !x.includes('/') ? `${defaults.system}/${x}` : x))
      .filter((x) => SIGN_KEY.test(x));
    p.stickers = [...new Set(keys)].slice(0, 10000);
  }
  return p;
}
