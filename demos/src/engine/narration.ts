import type { Step } from '../../shared/steps.ts';

/** Narration off: keep the caption pacing (reading time) but don't speak; character pronunciations stay. */
export function withoutNarration(script: Step[]): Step[] {
  return script.map((st): Step => {
    if (st.do === 'say' && st.lang === 'ui') return { ...st, silent: true };
    if (st.do === 'together') return { ...st, steps: withoutNarration(st.steps) };
    return st;
  });
}
