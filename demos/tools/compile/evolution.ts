// The evolution script of a sign, generated once at build time (port of the legacy evolutionScript()):
// picture → (rotate upright) → each historical form drawn/swapped → the first strokes stage → derived strokes
// stages (e.g. simplified) → name tag + pronunciation → closing line. Stage behaviour comes from system.yaml:
// `turn` marks where the story's turn beat may be told; `derivedFrom`/`intro` drive the simplified step.
import type { L10n } from '../../shared/l10n.ts';
import type { Step } from '../../shared/steps.ts';
import { complete } from '../content/l10n.ts';
import type { ContentSet, SignDoc, SystemDoc } from '../content/load.ts';
import { pronounceText } from '../content/lookup.ts';
import { fill } from './template.ts';

export function evolutionScript(content: ContentSet, sys: SystemDoc, sign: SignDoc, opts: { compact?: boolean } = {}): Step[] {
  const key = sign.key;
  const L = (t: L10n) => complete(content, t);
  const story = sign.data.story;
  const pic = sign.data.picture;
  const k = opts.compact ? 0.7 : 1;
  const A = 'hero';
  const narr = (t: L10n): Step[] => [{ do: 'caption', text: L(t) }, { do: 'say', text: L(t), lang: 'ui', wait: true }];
  const steps: Step[] = [{ do: 'place', actor: A, at: [500, 320], size: 340 }];
  const pictureStage = sys.data.stages.find((s) => s.kind === 'picture');
  let hasGlyph = false;

  if (pic && pictureStage) {
    steps.push({ do: 'stage', stage: pictureStage.id }, ...(opts.compact || !story ? [] : narr(story.hook)), { do: 'picture', actor: A, pic: key }, { do: 'wait', ms: 1000 * k });
    if (pic.svg.includes('data-part="leaf-l"') && pic.svg.includes('data-part="leaf-r"')) {
      steps.push(
        {
          do: 'together',
          steps: [
            { do: 'pose', actor: A, part: 'leaf-l', origin: 'left', scaleX: 0.32, dy: -6, ms: Math.round(900 * k) },
            { do: 'pose', actor: A, part: 'leaf-r', origin: 'right', scaleX: 0.32, dy: -6, ms: Math.round(900 * k) },
          ],
        },
        { do: 'wait', ms: 500 * k },
      );
    }
    if (pic.rotate) steps.push(...(story?.rotate ? narr(story.rotate) : []), { do: 'rotate', actor: A, deg: pic.rotate, ms: 1100 }, { do: 'wait', ms: 600 * k });
  }

  const forms = sign.data.forms ?? [];
  const turnStages = new Set(sys.data.stages.filter((s) => s.turn).map((s) => s.id));
  const turnIdx = forms.findIndex((f, i) => i > 0 && (turnStages.has(f.stage) || i === forms.length - 1));
  forms.forEach((f, i) => {
    const index = forms.slice(0, i).filter((x) => x.stage === f.stage).length;
    steps.push({ do: 'stage', stage: f.stage, variant: f.variant });
    if (i === 0 && !opts.compact && story) {
      const first = pic ? story.early : story.hook;
      if (first) steps.push(...narr(first));
    } else if (i === turnIdx && !opts.compact && story?.turn) {
      steps.push(...narr(story.turn));
    }
    if (!hasGlyph) {
      steps.push({ do: 'draw', actor: A, glyph: { sign: key, stage: f.stage, index }, ms: 2100 * k });
      if (pic) steps.push({ do: 'clearPicture', actor: A, ms: 700 });
      hasGlyph = true;
    } else {
      steps.push({ do: 'swap', actor: A, glyph: { sign: key, stage: f.stage, index }, ms: 1500 * k });
    }
    steps.push({ do: 'wait', ms: 1000 * k });
  });

  sys.data.stages.filter((s) => s.kind === 'strokes').forEach((st, si) => {
    if (si === 0) {
      steps.push({ do: 'stage', stage: st.id });
      if (forms.length === 0 && !pic && !opts.compact && story) steps.push(...narr(story.hook));
      if (hasGlyph) steps.push({ do: 'swap', actor: A, glyph: { sign: key, stage: st.id }, ms: 2600 * k });
      else {
        if (pic) steps.push({ do: 'clearPicture', actor: A, ms: 600 });
        steps.push({ do: 'draw', actor: A, glyph: { sign: key, stage: st.id }, ms: 2600 * k });
        hasGlyph = true;
      }
      steps.push({ do: 'wait', ms: 900 * k });
      return;
    }
    if (!st.derivedFrom || !st.script || sign.data.text[st.script] === sign.data.text[st.derivedFrom]) return;
    const line = st.intro && fill(content, st.intro, { from: sign.data.text[st.derivedFrom], to: sign.data.text[st.script] }, `${sys.data.id}.${st.id} intro`);
    steps.push(
      { do: 'stage', stage: st.id },
      ...(line ? (opts.compact ? [{ do: 'caption', text: line } as Step] : narr(line)) : []),
      { do: 'swap', actor: A, glyph: { sign: key, stage: st.id }, ms: 1900 * k },
      { do: 'wait', ms: 900 * k },
    );
  });

  steps.push({ do: 'tag', actor: A, sign: key, hold: 600000, dx: 270, dy: 170 });
  const spoken = pronounceText(sys, sign);
  if (spoken) steps.push({ do: 'say', text: spoken, lang: 'zh', wait: true });
  if (!opts.compact) steps.push(...narr(story?.closer ?? sign.data.fact));
  return steps;
}
