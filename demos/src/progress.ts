// Learner progress: stored only on this device (no accounts, no personal data — kid-privacy by design).
import { LESSONS, LESSON_BY_ID, type Lesson } from './data/chars';

export interface Progress {
  v: 1;
  xp: number;
  streak: number;
  lastDay: string | null; // YYYY-MM-DD (local)
  done: Record<string, number>; // lessonId -> best stars (1..3)
  stickers: string[]; // learned characters (simplified)
}

const KEY = 'etymsi.progress.v1';
const fresh = (): Progress => ({ v: 1, xp: 0, streak: 0, lastDay: null, done: {}, stickers: [] });

/** Treat stored data as untrusted: validate every field, drop anything unexpected. */
function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || o.v !== 1) return fresh();
    const p = fresh();
    p.xp = Number.isInteger(o.xp) && (o.xp as number) >= 0 ? Math.min(o.xp as number, 1e7) : 0;
    p.streak = Number.isInteger(o.streak) && (o.streak as number) >= 0 ? Math.min(o.streak as number, 1e5) : 0;
    p.lastDay = typeof o.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.lastDay) ? o.lastDay : null;
    if (o.done && typeof o.done === 'object') {
      for (const [k, v] of Object.entries(o.done as Record<string, unknown>)) {
        if (LESSON_BY_ID[k] && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 3) p.done[k] = v as number;
      }
    }
    if (Array.isArray(o.stickers)) p.stickers = o.stickers.filter((x): x is string => typeof x === 'string' && x.length === 1).slice(0, 64);
    return p;
  } catch {
    return fresh();
  }
}

let state = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}

const dayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function progress(): Readonly<Progress> {
  return state;
}

export interface Award {
  xp: number;
  stars: number;
  newStickers: string[];
  streak: number;
}

export function completeLesson(lesson: Lesson, mistakes: number): Award {
  const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  const xp = lesson.kind === 'story' ? 15 : 10 + (stars === 3 ? 5 : 0);
  const today = dayStr(new Date());
  const yesterday = dayStr(new Date(Date.now() - 86_400_000));
  if (state.lastDay !== today) state.streak = state.lastDay === yesterday ? state.streak + 1 : 1;
  state.lastDay = today;
  state.xp += xp;
  state.done[lesson.id] = Math.max(state.done[lesson.id] ?? 0, stars);
  const newStickers = lesson.kind === 'learn' ? lesson.chars.filter((c) => !state.stickers.includes(c)) : [];
  state.stickers.push(...newStickers);
  save();
  return { xp, stars, newStickers, streak: state.streak };
}

/** A lesson is open when it's the very first one or the previous lesson in its unit is done. */
export function isUnlocked(lesson: Lesson): boolean {
  const i = LESSONS.indexOf(lesson);
  if (i <= 0) return true;
  const prev = LESSONS[i - 1];
  return !!state.done[prev.id];
}

export function resetProgress(): void {
  state = fresh();
  save();
}
