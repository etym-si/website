// Learner progress: stored only on this device (no accounts, no personal data — kid-privacy by design).
import type { LessonB } from '../shared/bundle-types.ts';
import { defaultCollectionId, defaultSystemId } from './content';
import { freshProgress, parseProgress, type ProgressV2 } from './progress-migrate';

export type Progress = ProgressV2;

const KEY = 'etymsi.progress.v2';
const LEGACY_KEY = 'etymsi.progress.v1'; // read once when v2 is absent

function load(): Progress {
  try {
    return parseProgress(localStorage.getItem(KEY), localStorage.getItem(LEGACY_KEY), { system: defaultSystemId(), collection: defaultCollectionId() });
  } catch {
    return freshProgress(); // storage blocked
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

export function completeLesson(lesson: LessonB, mistakes: number): Award {
  const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
  const xp = lesson.kind === 'story' ? 15 : 10 + (stars === 3 ? 5 : 0);
  const today = dayStr(new Date());
  const yesterday = dayStr(new Date(Date.now() - 86_400_000));
  if (state.lastDay !== today) state.streak = state.lastDay === yesterday ? state.streak + 1 : 1;
  state.lastDay = today;
  state.xp += xp;
  state.done[lesson.id] = Math.max(state.done[lesson.id] ?? 0, stars);
  const newStickers = lesson.kind === 'learn' ? lesson.signs.filter((k) => !state.stickers.includes(k)) : [];
  state.stickers.push(...newStickers);
  save();
  return { xp, stars, newStickers, streak: state.streak };
}

/** A lesson is open when it's the first of its collection or the previous lesson is done. */
export function isUnlocked(lesson: LessonB, lessons: LessonB[]): boolean {
  const i = lessons.findIndex((l) => l.id === lesson.id);
  if (i <= 0) return true;
  return !!state.done[lessons[i - 1].id];
}

export function resetProgress(): void {
  state = freshProgress();
  save();
}
