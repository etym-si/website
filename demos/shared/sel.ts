/** Key of a glyph selector in a glyph table (story bundles). Kept free of zod so the app can import it. */
export function selKey(sel: { sign: string; stage: string; index?: number }): string {
  return `${sel.sign}|${sel.stage}|${sel.index ?? 0}`;
}
