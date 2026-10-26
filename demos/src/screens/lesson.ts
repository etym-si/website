// Lesson runner: Duolingo-style sequence of bite-sized exercises with instant feedback,
// retry-at-the-end for missed items, and a rewards screen. Data: one collection bundle + the unit's sign bundles.
import HanziWriter from 'hanzi-writer';
import { h, s } from '../dom';
import { signText, t, tx } from '../i18n';
import { settings } from '../settings';
import { button, confetti, mascot, speakerButton, timeline } from '../ui/common';
import { completeLesson, isUnlocked, progress, type Award } from '../progress';
import { staticGlyph } from '../glyphs';
import { buildPicture } from '../picture';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { chime, hasPronunciations, prepareSection, speakLine, type Section } from '../audio';
import { storyPlayer } from './story';
import { artifactCard, artifactList, cardItems } from '../ui/artifact';
import { loadCollection, loadSign, loadStory, stageMeta, system } from '../content';
import { firstGlyph, signGlyph, signSource } from '../play-source';
import type { CollectionBundle, GlyphData, LessonB, SignBundle, SystemB, UnitB } from '../../shared/bundle-types.ts';

type ExKind = 'meet' | 'picture' | 'ancient' | 'listen' | 'order' | 'match' | 'trace';
interface Ex {
  kind: ExKind;
  chars: string[]; // sign keys; chars[0] is the target; `match` uses all
}
interface ExApi {
  done: (correct: boolean, answer?: string) => void;
  miss: () => void;
  setFooter: (el: HTMLElement | null) => void;
}
/** Everything a lesson needs, loaded once before the first exercise. */
interface Ctx { coll: CollectionBundle; sys: SystemB; unit: UnitB; lesson: LessonB; bundles: Map<string, SignBundle>; section: Section | null }

const shuffle = <T>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const disp = (ctx: Ctx, key: string) => signText(ctx.coll.signs[key]?.text ?? {});
const reading = (ctx: Ctx, key: string) => ctx.coll.signs[key]?.reading ?? '';
const say = (ctx: Ctx, key: string) => void speakLine(ctx.section, ctx.coll.signs[key]?.clip, disp(ctx, key), 'zh');
const glyphOf = (ctx: Ctx, key: string): GlyphData | undefined => { const b = ctx.bundles.get(key); return b && firstGlyph(b, ctx.sys); };

function buildQueue(ctx: Ctx): Ex[] {
  const listen: ExKind = settings().sound && hasPronunciations(ctx.coll.audio) ? 'listen' : 'ancient';
  const { lesson, unit } = ctx;
  if (lesson.kind === 'learn') {
    const [a, b] = lesson.signs;
    const extra = shuffle(unit.signs.filter((c) => c !== a && c !== b))[0];
    if (!b) { // a one-sign chunk (units with an odd number of signs)
      return [
        { kind: 'meet', chars: [a] }, { kind: 'picture', chars: [a] }, { kind: listen, chars: [a] }, { kind: 'order', chars: [a] },
        ...(extra ? [{ kind: 'match' as const, chars: shuffle([a, extra]) }] : []), { kind: 'trace', chars: [a] },
      ];
    }
    return [
      { kind: 'meet', chars: [a] },
      { kind: 'meet', chars: [b] },
      { kind: 'picture', chars: [a] },
      { kind: 'ancient', chars: [b] },
      { kind: listen, chars: [a] },
      { kind: 'order', chars: [b] },
      { kind: 'match', chars: shuffle(extra ? [a, b, extra] : [a, b]) },
      { kind: 'trace', chars: [a] },
      { kind: 'picture', chars: [b] },
    ];
  }
  const cs = shuffle(lesson.signs);
  const kinds: ExKind[] = ['picture', 'ancient', listen, 'order', 'ancient', 'picture'];
  const singles: Ex[] = cs.map((c, i) => ({ kind: kinds[i % kinds.length], chars: [c] }));
  const matches: Ex[] = [];
  for (let i = 0; i + 1 < cs.length; i += 3) matches.push({ kind: 'match', chars: cs.slice(i, i + 3) });
  return [...shuffle<Ex>([...singles, ...matches.slice(0, 1)]), ...matches.slice(1), { kind: 'trace', chars: [cs[0]] }];
}

function optionsFor(ctx: Ctx, target: string, n = 3): string[] {
  const pool = [...new Set([...ctx.lesson.signs, ...ctx.unit.signs, ...progress().stickers])].filter((c) => c !== target && ctx.coll.signs[c]);
  return shuffle([target, ...shuffle(pool).slice(0, n - 1)]);
}

const prompt = (text: string) => h('h2', { class: 'prompt' }, text);

/** Multiple choice of modern characters. */
function choices(ctx: Ctx, target: string, api: ExApi): HTMLElement {
  const opts = optionsFor(ctx, target);
  const btns: HTMLButtonElement[] = [];
  const row = h('div', { class: 'choices', 'data-answer': disp(ctx, target) }); // data-answer: used by the e2e smoke test
  for (const c of opts) {
    const b = h('button', {
      type: 'button', class: 'choice', lang: 'zh', 'aria-label': `${disp(ctx, c)} ${reading(ctx, c)}`,
      onclick: () => {
        btns.forEach((x) => { x.disabled = true; });
        const ok = c === target;
        b.classList.add(ok ? 'right' : 'wrong');
        btns[opts.indexOf(target)].classList.add('right');
        say(ctx, c);
        api.done(ok, disp(ctx, target));
      },
    }, h('span', { class: 'choice-char' }, disp(ctx, c)));
    btns.push(b);
    row.appendChild(b);
  }
  return row;
}

function renderExercise(ex: Ex, host: HTMLElement, api: ExApi, ctx: Ctx): () => void {
  const key = ex.chars[0];
  switch (ex.kind) {
    case 'meet': return meet(ctx, key, host, api);
    case 'picture': {
      const pic = ctx.bundles.get(key)?.picture;
      if (!pic) return renderExercise({ ...ex, kind: 'ancient' }, host, api, ctx);
      const art = s('svg', { viewBox: '0 0 300 300', width: 210, height: 210, class: 'pic-svg ambient-on', role: 'img', 'aria-label': tx(ctx.coll.signs[key].meaning) }, buildPicture(pic.tree));
      host.append(prompt(t('qPicture')), h('div', { class: 'q-art' }, art), choices(ctx, key, api));
      return () => {};
    }
    case 'ancient': {
      const art = h('div', { class: 'q-art ink-card' });
      host.append(prompt(t('qAncient')), art, choices(ctx, key, api));
      const g = glyphOf(ctx, key);
      if (g) art.appendChild(staticGlyph(g, 190));
      return () => {};
    }
    case 'listen': {
      const play = () => say(ctx, key);
      host.append(prompt(t('qListen')), h('div', { class: 'q-art' }, speakerButton(play, true)), choices(ctx, key, api));
      const timer = setTimeout(play, 350);
      return () => clearTimeout(timer);
    }
    case 'order': return order(ctx, key, host, api);
    case 'match': return match(ctx, ex.chars, host, api);
    case 'trace': return trace(ctx, key, host, api);
  }
}

function meet(ctx: Ctx, key: string, host: HTMLElement, api: ExApi): () => void {
  const b = ctx.bundles.get(key)!;
  const stageBox = h('div', { class: 'stage-box meet' });
  const cap = h('div', { class: 'caption' });
  const tlHost = h('div', { class: 'tl-host' });
  const card = h('div', { class: 'meet-card' },
    h('div', { class: 'meet-char', lang: 'zh' }, disp(ctx, key)),
    h('div', { class: 'meet-info' },
      h('div', { class: 'meet-head' },
        h('span', { class: 'meet-pinyin' }, b.reading),
        h('span', { class: 'meet-meaning' }, tx(b.meaning)),
        speakerButton(() => say(ctx, key))),
      h('p', { class: 'meet-fact' }, tx(b.fact))));
  host.append(prompt(`✨ ${t('newChar')}`), stageBox, cap, tlHost, card);
  const stage = new Stage(stageBox, { label: b.reading });
  let pausedByModal = false;
  const seen: Record<string, number> = {};
  const tl = timeline(b.stages, ctx.sys);
  tlHost.replaceChildren(tl.el);
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
      artCard.show(b.cards[id]?.[n] ?? null, b);
    },
  });
  const items = cardItems(b, (st) => stageMeta(b.system, st)?.icon ?? '');
  if (items.length) card.appendChild(artifactList(items, b, onModal));
  const cont = button(t('continue'), () => api.done(true));
  cont.disabled = true;
  api.setFooter(cont);
  const unlock = setTimeout(() => { cont.disabled = false; }, 4000); // let fast kids skip
  void player.play(b.scripts.compact, signSource(b, ctx.sys)).then(() => {
    card.classList.add('show');
    cont.disabled = false;
    cont.focus();
  }, () => { cont.disabled = false; });
  return () => { clearTimeout(unlock); player.stop(); };
}

function order(ctx: Ctx, key: string, host: HTMLElement, api: ExApi): () => void {
  const b = ctx.bundles.get(key)!;
  const wrap = h('div', { class: 'order' });
  host.append(prompt(t('qOrder')), wrap);
  const stages = [...new Set(b.forms.map((f) => f.stage))].filter((st) => stageMeta(b.system, st)?.quiz !== false).slice(0, 3);
  const modern = ctx.sys.stages.find((st) => st.kind === 'strokes');
  const forms = [...stages.map((st) => signGlyph(b, ctx.sys, { stage: st })), modern ? signGlyph(b, ctx.sys, { stage: modern.id }) : undefined]
    .filter((g): g is GlyphData => !!g);
  if (forms.length < 3) {
    host.replaceChildren();
    return renderExercise({ kind: 'ancient', chars: [key] }, host, api, ctx);
  }
  const cards = forms.map((g, i) => h('button', { type: 'button', class: 'order-card', 'data-i': String(i) }, staticGlyph(g, 84)));
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
  return () => {};
}

function match(ctx: Ctx, keys: string[], host: HTMLElement, api: ExApi): () => void {
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
      say(ctx, b.dataset.c ?? '');
      if (++matched === keys.length) setTimeout(() => api.done(true), 350);
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
  for (const c of shuffle(keys)) {
    const b = h('button', { type: 'button', class: 'match-card ancient', 'data-c': c, 'aria-label': `ancient ${reading(ctx, c)}` });
    b.addEventListener('click', () => pick(b, 'L'));
    left.appendChild(b);
    const g = glyphOf(ctx, c);
    if (g) b.appendChild(staticGlyph(g, 64));
  }
  for (const c of shuffle(keys)) {
    const b = h('button', { type: 'button', class: 'match-card modern', 'data-c': c, lang: 'zh' }, disp(ctx, c));
    b.addEventListener('click', () => pick(b, 'R'));
    right.appendChild(b);
  }
  return () => {};
}

function trace(ctx: Ctx, key: string, host: HTMLElement, api: ExApi): () => void {
  const shown = disp(ctx, key);
  const strokes = ctx.bundles.get(key)?.strokes[shown];
  if (!strokes) return renderExercise({ kind: 'ancient', chars: [key] }, host, api, ctx); // no stroke data (e.g. not a han sign)
  const target = h('div', { class: 'trace-box' });
  const show = h('button', { type: 'button', class: 'btn btn-ghost small' }, t('showMe'));
  host.append(prompt(t('qTrace')), h('div', { class: 'q-art' }, target), h('div', { class: 'trace-tools' }, show));
  const writer = HanziWriter.create(target, shown, {
    width: 260, height: 260, padding: 14, showOutline: true, showCharacter: false, renderer: 'svg',
    strokeColor: '#2b2522', outlineColor: '#e6dcc6', drawingColor: '#e8453c', highlightColor: '#4aa3df', drawingWidth: 24,
    showHintAfterMisses: 2, highlightOnComplete: true, strokeAnimationSpeed: 1.2, delayBetweenStrokes: 120,
    charDataLoader: (_c: string, onLoad: (d: { strokes: string[]; medians: number[][][] }) => void) => onLoad(strokes),
  });
  let finished = false;
  const startQuiz = () => writer.quiz({
    onCorrectStroke: () => chime('tap'),
    onComplete: () => {
      if (finished) return;
      finished = true;
      say(ctx, key);
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

/** `#/lesson/<collection>/<lesson>` — loads the collection, the unit's sign bundles and the pronunciations first. */
export function renderLesson(root: HTMLElement, collectionId: string, lessonId: string): () => void {
  let alive = true;
  let inner: (() => void) | null = null;
  root.replaceChildren(h('main', { class: 'lesson' }, h('div', { class: 'lesson-body' })));
  void (async () => {
    const coll = await loadCollection(collectionId).catch(() => null);
    const lesson = coll?.lessons.find((l) => l.id === `${collectionId}/${lessonId}`);
    const unit = lesson && coll?.units.find((u) => u.n === lesson.unit);
    if (!alive) return;
    if (!coll || !lesson || !unit || !unit.playable || !isUnlocked(lesson, coll.lessons)) {
      location.hash = `#/learn/${collectionId}`;
      return;
    }
    const entries = await Promise.all(unit.signs.map(async (k) => [k, await loadSign(coll.signs[k])] as const));
    const section = await prepareSection(coll.audio);
    if (!alive) return;
    inner = runLesson(root, { coll, sys: system(coll.system), unit, lesson, bundles: new Map(entries), section });
  })();
  return () => {
    alive = false;
    inner?.();
  };
}

function runLesson(root: HTMLElement, ctx: Ctx): () => void {
  const { lesson, unit, coll } = ctx;
  const fill = h('div', { class: 'fill' });
  const body = h('div', { class: 'lesson-body' });
  const footer = h('div', { class: 'lesson-footer' });
  root.replaceChildren(h('main', { class: 'lesson', style: { '--u': unit.color } },
    h('div', { class: 'lesson-top' },
      h('a', { href: `#/learn/${coll.id}`, class: 'quit', 'aria-label': t('quit') }, '✕'),
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
          h('div', { class: 'sticker-row' }, ...award.newStickers.map((c) => h('span', { class: 'sticker got pop', lang: 'zh' }, disp(ctx, c)))))
        : null));
    footer.className = 'lesson-footer good';
    footer.replaceChildren(button(t('continue'), () => { location.hash = `#/learn/${coll.id}`; }));
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
    const ref = coll.stories.find((st) => st.unit === lesson.unit);
    if (!ref) { location.hash = `#/learn/${coll.id}`; return cleanupAll; }
    void loadStory(ref).then((b) => sp.run(b));
    return cleanupAll;
  }

  const queue = buildQueue(ctx);
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
    exCleanup = renderExercise(ex, body, api, ctx);
  }
  next();
  return cleanupAll;
}
