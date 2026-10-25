import { h } from '../dom';
import { t, tx } from '../i18n';
import { settings } from '../settings';
import { header, scriptViewer, timeline, button, speakerButton } from '../ui/common';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { evolutionScript, withoutNarration } from '../engine/scripts';
import { loadGlyph } from '../glyphs';
import { PICTURES } from '../pictures';
import { BY_CHAR, UNITS, displayChar } from '../data/chars';
import { STAGE_BY_ID, type StageId } from '../data/stages';
import { speak } from '../audio';
import { artifactFor } from '../data/artifacts';
import { artifactCard, artifactList } from '../ui/artifact';
import type { GlyphDoc } from '../glyphs';

let narration = true;
let speed = 1;

export function renderTheater(root: HTMLElement, param: string): () => void {
  let current = BY_CHAR[param] ? param : '日';
  const script = settings().script;

  // --- layout -------------------------------------------------------------
  const picker = h('aside', { class: 'picker', 'aria-label': t('pickChar') }, h('h2', {}, t('pickChar')));
  const pickBtns = new Map<string, HTMLButtonElement>();
  for (const u of UNITS) {
    const row = h('div', { class: 'pick-row' });
    for (const ch of u.chars) {
      const b = h('button', { type: 'button', class: 'pick', style: { '--u': u.color }, 'aria-label': `${ch} ${BY_CHAR[ch].pinyin}`, onclick: () => select(ch) },
        displayChar(BY_CHAR[ch], script));
      pickBtns.set(ch, b);
      row.appendChild(b);
    }
    picker.append(h('div', { class: 'pick-unit' }, h('span', { class: 'pick-unit-n', style: { background: u.color } }, String(u.n)), row));
  }

  const stageBox = h('div', { class: 'stage-box' });
  const caption = h('div', { class: 'caption', 'aria-live': 'polite' });
  const startOverlay = h('button', { type: 'button', class: 'start-overlay', 'aria-label': t('play') }, h('span', {}, '▶'));
  stageBox.append(startOverlay);
  const tlHost = h('div', { class: 'tl-host' });
  const viewer = scriptViewer(true);

  const playBtn = button(`⏸ ${t('pause')}`, () => togglePause(), 'secondary');
  const speedBtns = [0.5, 1, 2].map((x) => h('button', { type: 'button', class: `chip ${x === speed ? 'on' : ''}`, onclick: () => setSpeed(x) }, `${x}×`));
  const narrBtn = h('button', { type: 'button', class: `chip ${narration ? 'on' : ''}`, 'aria-pressed': String(narration), onclick: () => { narration = !narration; load(current); } }, `🗣️ ${t('narration')}`);
  const controls = h('div', { class: 'controls' },
    playBtn,
    button(`⟲ ${t('replay')}`, () => load(current), 'secondary'),
    h('div', { class: 'seg', role: 'group', 'aria-label': t('speed') }, ...speedBtns),
    narrBtn);

  const infoCard = h('div', { class: 'info-card' });

  root.replaceChildren(
    header(),
    h('main', { class: 'theater' },
      h('h1', { class: 'page-title' }, `🎭 ${t('theaterTitle')}`),
      h('div', { class: 'theater-grid' },
        picker,
        h('section', { class: 'theater-main' }, stageBox, caption, tlHost, controls, infoCard),
        h('section', { class: 'theater-side' }, viewer.el))),
  );

  // --- engine -------------------------------------------------------------
  const stage = new Stage(stageBox, { label: t('theaterTitle') });
  stageBox.insertBefore(stage.svg, startOverlay);
  const card = artifactCard();
  stageBox.insertBefore(card.el, startOverlay);
  let doc: GlyphDoc | null = null;
  let seen: Record<string, number> = {};
  let tl = timeline([]);
  const player = new Player(stage, {
    onStep: (i) => viewer.highlight(i),
    onCaption: (text) => {
      caption.textContent = text ?? '';
      caption.classList.toggle('show', !!text);
    },
    onStage: (id, variant) => {
      tl.set(id, variant);
      caption.textContent = '';
      caption.classList.remove('show');
      // show the real artifact behind this stage of the journey
      const n = seen[id] ?? 0;
      seen[id] = n + 1;
      const hist = doc?.stages.filter((s) => s.stage === id)[n];
      card.show(doc ? artifactFor(doc.char, id, hist, displayChar(BY_CHAR[doc.char], settings().script)) : null);
    },
  });
  player.setSpeed(speed);

  function setSpeed(x: number) {
    speed = x;
    player.setSpeed(x);
    speedBtns.forEach((b, i) => b.classList.toggle('on', [0.5, 1, 2][i] === x));
  }

  function togglePause() {
    if (player.paused) player.resume();
    else player.pause();
    playBtn.textContent = player.paused ? `▶ ${t('play')}` : `⏸ ${t('pause')}`;
  }

  function renderInfo(ch: string) {
    const info = BY_CHAR[ch];
    const disp = displayChar(info, settings().script);
    infoCard.replaceChildren(
      h('div', { class: 'info-char', lang: 'zh' }, disp),
      h('div', { class: 'info-body' },
        h('div', { class: 'info-head' },
          h('span', { class: 'info-pinyin' }, info.pinyin),
          h('span', { class: 'info-meaning' }, tx(info.meaning)),
          speakerButton(() => void speak(disp, 'zh'))),
        h('p', { class: 'info-fact' }, tx(info.fact))),
    );
  }

  async function load(ch: string) {
    current = ch;
    pickBtns.forEach((b, k) => b.classList.toggle('on', k === ch));
    history.replaceState(null, '', `#/theater/${encodeURIComponent(ch)}`);
    renderInfo(ch);
    player.stop();
    card.show(null);
    const loaded = await loadGlyph(ch);
    if (current !== ch) return;
    doc = loaded;
    seen = {};
    const stages: StageId[] = [];
    if (PICTURES[ch]) stages.push('picture');
    for (const st of loaded.stages) if (!stages.includes(st.stage)) stages.push(st.stage);
    stages.push('regular');
    if (loaded.trad !== loaded.char) stages.push('simplified');
    // every real artifact on this character's journey, listed under the info card
    const disp = displayChar(BY_CHAR[ch], settings().script);
    const items = [...loaded.stages.map((st) => ({ id: st.stage as StageId, a: artifactFor(ch, st.stage, st, disp) })),
      { id: 'regular' as StageId, a: artifactFor(ch, 'regular', undefined, disp) }]
      .filter((x): x is { id: StageId; a: NonNullable<typeof x.a> } => !!x.a)
      .map((x) => ({ icon: STAGE_BY_ID[x.id].icon, a: x.a }));
    if (items.length) infoCard.appendChild(artifactList(items));
    const fresh = timeline(stages);
    tl.el.replaceWith(fresh.el);
    tl = fresh;
    if (!tlHost.contains(tl.el)) tlHost.replaceChildren(tl.el);
    let steps = evolutionScript(loaded);
    if (!narration) steps = withoutNarration(steps);
    viewer.load(steps);
    playBtn.textContent = `⏸ ${t('pause')}`;
    await player.play(steps);
  }

  function select(ch: string) {
    startOverlay.remove();
    void load(ch);
  }

  // Browsers only allow speech after a user gesture: ask for one tap if needed.
  const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
  startOverlay.addEventListener('click', () => select(current));
  if (activated) select(current);
  else pickBtns.forEach((b, k) => b.classList.toggle('on', k === current));

  return () => player.stop();
}
