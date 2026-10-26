// Lesson runner: Duolingo-style sequence of bite-sized exercises with instant feedback,
// retry-at-the-end for missed items, and a rewards screen.
import HanziWriter from 'hanzi-writer';
import { h, s } from '../dom';
import { t, tx } from '../i18n';
import { settings } from '../settings';
import { button, confetti, mascot, speakerButton, timeline } from '../ui/common';
import { BY_CHAR, UNITS, LESSON_BY_ID, displayChar, type Lesson } from '../data/chars';
import { completeLesson, isUnlocked, progress, type Award } from '../progress';
import { loadGlyph, loadHanzi, staticGlyphSvg, type GlyphSel } from '../glyphs';
import { PICTURES } from '../pictures';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { chime, speak, hasVoice } from '../audio';
import { storyPlayer } from './story';
import { artifactCard, artifactList, cardItems } from '../ui/artifact';
import { defaultCollectionId, defaultSystemId, findSign, loadCollection, loadSign, loadStory, stageMeta, system } from '../content';
import { signSource } from '../play-source';
import type { SignBundle } from '../../shared/bundle-types.ts';

type ExKind = 'meet' | 'picture' | 'ancient' | 'listen' | 'order' | 'match' | 'trace';
interface Ex {
  kind: ExKind;
  chars: string[]; // chars[0] is the target; `match` uses all
}
interface ExApi {
  done: (correct: boolean, answer?: string) => void;
  miss: () => void;
  setFooter: (el: HTMLElement | null) => void;
}

const shuffle = <T>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const disp = (ch: string) => displayChar(BY_CHAR[ch], settings().script);

function buildQueue(lesson: Lesson): Ex[] {
  const listen: ExKind = settings().sound && hasVoice('zh') ? 'listen' : 'ancient';
  if (lesson.kind === 'learn') {
    const [a, b] = lesson.chars;
    const unit = UNITS[lesson.unit - 1].chars;
    const extra = shuffle(unit.filter((c) => c !== a && c !== b))[0];
    return [
      { kind: 'meet', chars: [a] },
      { kind: 'meet', chars: [b] },
      { kind: 'picture', chars: [a] },
      { kind: 'ancient', chars: [b] },
      { kind: listen, chars: [a] },
      { kind: 'order', chars: [b] },
      { kind: 'match', chars: shuffle([a, b, extra]) },
      { kind: 'trace', chars: [a] },
      { kind: 'picture', chars: [b] },
    ];
  }
  const cs = shuffle(lesson.chars);
  return [
    ...shuffle<Ex>([
      { kind: 'picture', chars: [cs[0]] }, { kind: 'ancient', chars: [cs[1]] }, { kind: listen, chars: [cs[2]] },
      { kind: 'order', chars: [cs[3]] }, { kind: 'ancient', chars: [cs[4]] }, { kind: 'picture', chars: [cs[5]] },
      { kind: 'match', chars: cs.slice(0, 3) },
    ]),
    { kind: 'match', chars: cs.slice(3, 6) },
    { kind: 'trace', chars: [cs[0]] },
  ];
}

function optionsFor(target: string, lesson: Lesson, n = 3): string[] {
  const pool = [...new Set([...lesson.chars, ...UNITS[lesson.unit - 1].chars, ...progress().stickers])].filter((c) => c !== target);
  return shuffle([target, ...shuffle(pool).slice(0, n - 1)]);
}

const prompt = (text: string) => h('h2', { class: 'prompt' }, text);

/** Multiple choice of modern characters. */
function choices(target: string, lesson: Lesson, api: ExApi): HTMLElement {
  const opts = optionsFor(target, lesson);
  const btns: HTMLButtonElement[] = [];
  const row = h('div', { class: 'choices', 'data-answer': disp(target) }); // data-answer: used by the e2e screenshot script
  for (const c of opts) {
    const b = h('button', {
      type: 'button', class: 'choice', lang: 'zh', 'aria-label': `${disp(c)} ${BY_CHAR[c].pinyin}`,
      onclick: () => {
        btns.forEach((x) => { x.disabled = true; });
        const ok = c === target;
        b.classList.add(ok ? 'right' : 'wrong');
        btns[opts.indexOf(target)].classList.add('right');
        void speak(disp(c), 'zh');
        api.done(ok, disp(target));
      },
    }, h('span', { class: 'choice-char' }, disp(c)));
    btns.push(b);
    row.appendChild(b);
  }
  return row;
}

function renderExercise(ex: Ex, host: HTMLElement, api: ExApi, lesson: Lesson): () => void {
  const ch = ex.chars[0];
  switch (ex.kind) {
    case 'meet': return meet(ch, host, api);
    case 'picture': {
      const pic = PICTURES[ch];
      if (!pic) return renderExercise({ ...ex, kind: 'ancient' }, host, api, lesson);
      const art = s('svg', { viewBox: '0 0 300 300', width: 210, height: 210, class: 'pic-svg ambient-on', role: 'img', 'aria-label': tx(BY_CHAR[ch].meaning) }, pic.build());
      host.append(prompt(t('qPicture')), h('div', { class: 'q-art' }, art), choices(ch, lesson, api));
      return () => {};
    }
    case 'ancient': {
      const art = h('div', { class: 'q-art ink-card' });
      host.append(prompt(t('qAncient')), art, choices(ch, lesson, api));
      loadGlyph(ch).then((doc) => staticGlyphSvg({ char: ch, stage: doc.stages[0]?.stage ?? 'regular' }, 190)).then((svg) => art.appendChild(svg)).catch(() => {});
      return () => {};
    }
    case 'listen': {
      const say = () => void speak(disp(ch), 'zh');
      host.append(prompt(t('qListen')), h('div', { class: 'q-art' }, speakerButton(say, true)), choices(ch, lesson, api));
      const timer = setTimeout(say, 350);
      return () => clearTimeout(timer);
    }
    case 'order': return order(ch, host, api, lesson);
    case 'match': return match(ex.chars, host, api);
    case 'trace': return trace(ch, host, api);
  }
}

function meet(ch: string, host: HTMLElement, api: ExApi): () => void {
  const info = BY_CHAR[ch];
  const stageBox = h('div', { class: 'stage-box meet' });
  const cap = h('div', { class: 'caption' });
  const tlHost = h('div', { class: 'tl-host' });
  const card = h('div', { class: 'meet-card' },
    h('div', { class: 'meet-char', lang: 'zh' }, disp(ch)),
    h('div', { class: 'meet-info' },
      h('div', { class: 'meet-head' },
        h('span', { class: 'meet-pinyin' }, info.pinyin),
        h('span', { class: 'meet-meaning' }, tx(info.meaning)),
        speakerButton(() => void speak(disp(ch), 'zh'))),
      h('p', { class: 'meet-fact' }, tx(info.fact))));
  host.append(prompt(`✨ ${t('newChar')}`), stageBox, cap, tlHost, card);
  const stage = new Stage(stageBox, { label: info.pinyin });
  let pausedByModal = false;
  let bundle: SignBundle | null = null;
  const seen: Record<string, number> = {};
  let tl = timeline([], system(defaultSystemId()));
  const onModal = (open: boolean) => {
    if (open && !player.paused) { player.pause(); pausedByModal = true; }
    else if (!open && pausedByModal) { pausedByModal = false; player.resume(); }
  };
  const artCard = artifactCard(onModal);
  stageBox.appendChild(artCard.el);
  const player = new Player(stage, {
    onCaption: (text) => { cap.textContent = text ?? ''; cap.classList.toggle('show', !!text); },
    onStage: (id, v) => {
      tl.set(id, v);
      cap.textContent = '';
      cap.classList.remove('show');
      const n = seen[id] ?? 0;
      seen[id] = n + 1;
      artCard.show(bundle?.cards[id]?.[n] ?? null, bundle);
    },
  });
  const cont = button(t('continue'), () => api.done(true));
  cont.disabled = true;
  api.setFooter(cont);
  const unlock = setTimeout(() => { cont.disabled = false; }, 4000); // let fast kids skip
  (async () => {
    const found = await findSign(`${defaultSystemId()}/${ch}`);
    if (!found) throw new Error(`unknown sign ${ch}`);
    const b = await loadSign(found.summary);
    bundle = b;
    const sys = system(b.system);
    const items = cardItems(b, (st) => stageMeta(b.system, st)?.icon ?? '');
    if (items.length) card.appendChild(artifactList(items, b, onModal));
    tl = timeline(b.stages, sys);
    tlHost.replaceChildren(tl.el);
    await player.play(b.scripts.compact, signSource(b, sys));
    card.classList.add('show');
    cont.disabled = false;
    cont.focus();
  })().catch(() => { cont.disabled = false; });
  return () => { clearTimeout(unlock); player.stop(); };
}

function order(ch: string, host: HTMLElement, api: ExApi, lesson: Lesson): () => void {
  const wrap = h('div', { class: 'order' });
  host.append(prompt(t('qOrder')), wrap);
  loadGlyph(ch).then(async (doc) => {
    const seen = new Set<string>();
    const hist = doc.stages.filter((x) => (seen.has(x.stage) ? false : (seen.add(x.stage), true)) && x.stage !== 'clerical').slice(0, 3);
    const forms: GlyphSel[] = [...hist.map((x) => ({ char: ch, stage: x.stage })), { char: ch, stage: 'regular' as const }];
    if (forms.length < 3) {
      wrap.remove();
      host.replaceChildren();
      renderExercise({ kind: 'ancient', chars: [ch] }, host, api, lesson);
      return;
    }
    const cards = await Promise.all(forms.map(async (f, i) => {
      const b = h('button', { type: 'button', class: 'order-card', 'data-i': String(i) }, await staticGlyphSvg(f, 84));
      return b;
    }));
    let pool = shuffle(cards.map((_, i) => i));
    if (pool.every((v, i) => v === i)) pool = [...pool.slice(1), pool[0]];
    const slots: (number | null)[] = forms.map(() => null);
    const slotRow = h('div', { class: 'order-slots' });
    const poolRow = h('div', { class: 'order-pool' });
    const labels = h('div', { class: 'order-labels' }, h('span', {}, `⬅ ${t('oldest')}`), h('span', {}, `${t('today')} ➡`));
    wrap.append(labels, slotRow, poolRow);
    let locked = false;
    const draw = () => {
      slotRow.replaceChildren(...slots.map((v, k) => {
        const slot = h('div', { class: 'order-slot' });
        if (v !== null) slot.appendChild(cards[v]);
        else slot.appendChild(h('span', { class: 'slot-n' }, String(k + 1)));
        return slot;
      }));
      poolRow.replaceChildren(...pool.map((v) => cards[v]));
    };
    cards.forEach((c, i) => c.addEventListener('click', () => {
      if (locked) return;
      chime('tap');
      const at = slots.indexOf(i);
      if (at >= 0) { slots[at] = null; pool.push(i); }
      else {
        const empty = slots.indexOf(null);
        if (empty < 0) return;
        slots[empty] = i;
        pool = pool.filter((x) => x !== i);
      }
      draw();
      if (slots.every((x) => x !== null)) {
        locked = true;
        const ok = slots.every((x, k) => x === k);
        [...slotRow.children].forEach((el, k) => el.classList.add(slots[k] === k ? 'right' : 'wrong'));
        if (!ok) {
          setTimeout(() => {
            slots.forEach((_, k) => { slots[k] = k; });
            draw();
            [...slotRow.children].forEach((el) => el.classList.add('right', 'fixed'));
          }, 900);
        }
        api.done(ok);
      }
    }));
    draw();
  }).catch(() => api.done(true));
  return () => {};
}

function match(chars: string[], host: HTMLElement, api: ExApi): () => void {
  const left = h('div', { class: 'match-col' });
  const right = h('div', { class: 'match-col' });
  host.append(prompt(t('qMatch')), h('div', { class: 'match' }, left, right));
  let selL: HTMLButtonElement | null = null;
  let selR: HTMLButtonElement | null = null;
  let matched = 0;
  const tryPair = () => {
    if (!selL || !selR) return;
    const a = selL;
    const b = selR;
    selL = selR = null;
    if (a.dataset.c === b.dataset.c) {
      [a, b].forEach((x) => { x.classList.remove('sel'); x.classList.add('right'); x.disabled = true; });
      chime('pop');
      void speak(disp(b.dataset.c ?? ''), 'zh');
      if (++matched === chars.length) setTimeout(() => api.done(true), 350);
    } else {
      [a, b].forEach((x) => { x.classList.remove('sel'); x.classList.add('shake'); setTimeout(() => x.classList.remove('shake'), 500); });
      api.miss();
    }
  };
  const pick = (b: HTMLButtonElement, side: 'L' | 'R') => {
    chime('tap');
    if (side === 'L') { selL?.classList.remove('sel'); selL = b; } else { selR?.classList.remove('sel'); selR = b; }
    b.classList.add('sel');
    tryPair();
  };
  for (const c of shuffle(chars)) {
    const b = h('button', { type: 'button', class: 'match-card ancient', 'data-c': c, 'aria-label': `ancient ${BY_CHAR[c].pinyin}` });
    b.addEventListener('click', () => pick(b, 'L'));
    left.appendChild(b);
    loadGlyph(c).then((doc) => staticGlyphSvg({ char: c, stage: doc.stages[0]?.stage ?? 'regular' }, 64)).then((svg) => b.appendChild(svg)).catch(() => {});
  }
  for (const c of shuffle(chars)) {
    const b = h('button', { type: 'button', class: 'match-card modern', 'data-c': c, lang: 'zh' }, disp(c));
    b.addEventListener('click', () => pick(b, 'R'));
    right.appendChild(b);
  }
  return () => {};
}

function trace(ch: string, host: HTMLElement, api: ExApi): () => void {
  const target = h('div', { class: 'trace-box' });
  const show = h('button', { type: 'button', class: 'btn btn-ghost small' }, t('showMe'));
  host.append(prompt(t('qTrace')), h('div', { class: 'q-art' }, target), h('div', { class: 'trace-tools' }, show));
  const writer = HanziWriter.create(target, disp(ch), {
    width: 260, height: 260, padding: 14, showOutline: true, showCharacter: false, renderer: 'svg',
    strokeColor: '#2b2522', outlineColor: '#e6dcc6', drawingColor: '#e8453c', highlightColor: '#4aa3df', drawingWidth: 24,
    showHintAfterMisses: 2, highlightOnComplete: true, strokeAnimationSpeed: 1.2, delayBetweenStrokes: 120,
    charDataLoader: (c: string, onLoad: (d: { strokes: string[]; medians: number[][][] }) => void, onError: (e?: unknown) => void) => {
      loadHanzi(c).then(onLoad).catch(onError);
    },
  });
  let finished = false;
  const startQuiz = () => writer.quiz({
    onCorrectStroke: () => chime('tap'),
    onComplete: () => {
      if (finished) return;
      finished = true;
      void speak(disp(ch), 'zh');
      setTimeout(() => api.done(true), 600);
    },
  });
  show.addEventListener('click', () => {
    writer.cancelQuiz();
    void writer.animateCharacter({ onComplete: () => { if (!finished) startQuiz(); } });
  });
  startQuiz();
  return () => { try { writer.cancelQuiz(); } catch { /* already gone */ } };
}

export function renderLesson(root: HTMLElement, id: string): () => void {
  const lesson = LESSON_BY_ID[id];
  if (!lesson || !UNITS[lesson.unit - 1]?.playable || !isUnlocked(lesson)) {
    location.hash = '#/learn';
    return () => {};
  }
  const color = UNITS[lesson.unit - 1].color;
  const fill = h('div', { class: 'fill' });
  const body = h('div', { class: 'lesson-body' });
  const footer = h('div', { class: 'lesson-footer' });
  root.replaceChildren(h('main', { class: 'lesson', style: { '--u': color } },
    h('div', { class: 'lesson-top' },
      h('a', { href: '#/learn', class: 'quit', 'aria-label': t('quit') }, '✕'),
      h('div', { class: 'lesson-progress' }, fill)),
    body, footer));

  let exCleanup: (() => void) | null = null;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') (footer.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.click();
  };
  window.addEventListener('keydown', onKey);
  const cleanupAll = () => { exCleanup?.(); window.removeEventListener('keydown', onKey); };

  function results(award: Award) {
    exCleanup?.();
    exCleanup = null;
    fill.style.width = '100%';
    chime('complete');
    body.replaceChildren(h('div', { class: 'results' },
      mascot(150, 'cheer'),
      h('h2', {}, lesson.kind === 'story' ? t('storyDone') : t('lessonDone')),
      h('div', { class: 'stars', 'aria-label': `${award.stars} / 3` },
        ...[1, 2, 3].map((i) => h('span', { class: `star ${i <= award.stars ? 'on' : ''}`, style: { '--i': String(i) } }, '★'))),
      h('div', { class: 'award-row' },
        h('div', { class: 'award xp' }, `+${award.xp} XP`),
        h('div', { class: 'award streak' }, `🔥 ${award.streak} ${t('streak')}`)),
      award.newStickers.length
        ? h('div', { class: 'new-stickers' }, h('div', { class: 'label' }, t('newStickers')),
          h('div', { class: 'sticker-row' }, ...award.newStickers.map((c) => h('span', { class: 'sticker got pop', lang: 'zh' }, disp(c)))))
        : null));
    footer.className = 'lesson-footer good';
    footer.replaceChildren(button(t('continue'), () => { location.hash = '#/learn'; }));
    confetti(root);
  }

  if (lesson.kind === 'story') {
    const sp = storyPlayer(body, {
      withScript: false,
      onDone: () => {
        fill.style.width = '100%';
        footer.replaceChildren(button(t('continue'), () => results(completeLesson(lesson, 0))));
      },
    });
    exCleanup = () => sp.stop();
    void loadCollection(defaultCollectionId()).then(async (coll) => {
      const ref = coll.stories.find((s) => s.unit === lesson.unit);
      if (!ref) { location.hash = '#/learn'; return; }
      await sp.run(await loadStory(ref));
    });
    return cleanupAll;
  }

  const queue = buildQueue(lesson);
  const total = queue.length;
  let correctCount = 0;
  let mistakes = 0;

  function next() {
    exCleanup?.();
    exCleanup = null;
    footer.className = 'lesson-footer';
    footer.replaceChildren();
    body.replaceChildren();
    const ex = queue.shift();
    if (!ex) { results(completeLesson(lesson, mistakes)); return; }
    let answered = false;
    const api: ExApi = {
      done(correct, answer) {
        if (answered) return;
        answered = true;
        if (ex.kind === 'meet') { correctCount++; fill.style.width = `${(correctCount / total) * 100}%`; next(); return; }
        if (correct) { correctCount++; chime('correct'); } else { mistakes++; chime('wrong'); queue.push(ex); }
        fill.style.width = `${(correctCount / total) * 100}%`;
        footer.className = `lesson-footer ${correct ? 'good' : 'bad'}`;
        footer.replaceChildren(
          h('div', { class: 'fb-text' },
            h('span', { class: 'fb-icon' }, correct ? '✔' : '✖'),
            h('strong', {}, correct ? t('correct') : t('wrong')),
            !correct && answer ? h('span', {}, ` ${t('answerIs')} `, h('b', { lang: 'zh' }, answer)) : null),
          button(t('continue'), next, correct ? 'primary' : 'danger'));
        (footer.querySelector('button') as HTMLButtonElement | null)?.focus();
      },
      miss() { mistakes++; chime('wrong'); },
      setFooter(el) { footer.replaceChildren(...(el ? [el] : [])); },
    };
    exCleanup = renderExercise(ex, body, api, lesson);
  }
  next();
  return cleanupAll;
}
