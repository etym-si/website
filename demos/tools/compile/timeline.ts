// The journey timeline of a sign (the ribbon in the theater and the order of its stage events).
import type { SignDoc, SystemDoc } from '../content/load.ts';

export function signTimeline(sys: SystemDoc, sign: SignDoc): string[] {
  const out: string[] = [];
  const picture = sys.data.stages.find((s) => s.kind === 'picture');
  if (picture && sign.data.picture) out.push(picture.id);
  for (const f of sign.data.forms ?? []) if (!out.includes(f.stage)) out.push(f.stage);
  for (const st of sys.data.stages.filter((s) => s.kind === 'strokes')) {
    if (st.derivedFrom && st.script && sign.data.text[st.script] === sign.data.text[st.derivedFrom]) continue;
    out.push(st.id);
  }
  return out;
}
