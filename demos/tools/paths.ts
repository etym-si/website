// Absolute paths used by every tool and test. Content and media live at the repo root, next to demos/.
import path from 'node:path';

export const DEMOS = path.resolve(import.meta.dirname, '..');
export const REPO = path.resolve(DEMOS, '..');
export const CONTENT_DIR = path.join(REPO, 'content');
export const MEDIA_DIR = path.join(REPO, 'media');
export const PUBLIC_DIR = path.join(DEMOS, 'public');
export const GENERATED_DIR = path.join(DEMOS, 'src', 'generated');
export const GOLDEN_DIR = path.join(DEMOS, 'tests', 'golden');
export const TMP_DIR = path.join(DEMOS, 'tests', '.tmp');

/** Repo-relative path with forward slashes (used in diagnostics). */
export function rel(abs: string): string {
  return path.relative(REPO, abs).split(path.sep).join('/');
}
