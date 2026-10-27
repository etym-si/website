import { h } from '../dom';
import { signText, t, tx } from '../i18n';
import { header, scriptViewer, timeline, button, speakerButton } from '../ui/common';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { withoutNarration } from '../engine/narration';
import { CATALOG, defaultCollectionId, findSign, loadCollection, loadSign, stageMeta, system } from '../content';
import { prepareSection, speakLine } from '../audio';
import { artifactCard, artifactList, cardItems } from '../ui/artifact';
import { signSource } from '../play-source';
import type { CollectionBundle, SignBundle } from '../../shared/bundle-types.ts';

let narration = true;
let speed = 1;

/** The Evolution Theater for one sign key (`han/马`); null shows the first sign of the default collection. */
export function renderTheater(root: HTMLElement, param: string | null): () => void {
  let alive = true;
  let current = '';

  // --- layout -------------------------------------------------------------
  const picker = h('aside', { class: 'picker', 'aria-label': t('pickChar') }, h('h2', {}, t('pickChar')));
  const pickBtns = new Map<string, HTMLButtonElement>();
  const stageBox = h('div', { class: 'stage-box' });
  const caption = h('div', { class: 'caption', 'aria-live': 'polite' });
  const startOverlay = h('button', { type: 'button', class: 'start-overlay', 'aria-label': t('play') }, h('span', {}, '▶'));
  stageBox.append(startOverlay);
  const tlHost = h('div', { class: 'tl-host' });
  const viewer = scriptViewer(true);
  const playBtn = button(`⏸ ${t('pause')}`, () => togglePause(), 'secondary');
  const speedBtns = [0.5, 1, 2].map((x) => h('button', { type: 'button', class: `chip ${x === speed ? 'on' : ''}`, onclick: () => setSpeed(x) }, `${x}×`));
  const narrBtn = h('button', { type: 'button', class: `chip ${narration ? 'on' : ''}`, 'aria-pressed': String(narration), onclick: () => { narration = !narration; void load(current); } }, `🗣️ ${t('narration')}`);
  const controls = h('div', { class: 'controls' },
    playBtn,
    button(`⟲ ${t('replay')}`, () => void load(current), 'secondary'),
    h('div', { class: 'seg', role: 'group', 'aria-label': t('speed') }, ...speedBtns),
    narrBtn);
  const infoCard = h('div', { class: 'info-card' });
  const topicBar = h('div', { class: 'story-topic' });
  const collTabs = h('div', { class: 'tabs', role: 'tablist' });
  root.replaceChildren(
    header(),
    h('main', { class: 'theater' },
      h('h1', { class: 'page-title' }, `🎭 ${t('theaterTitle')}`),
      collTabs,
      h('div', { class: 'theater-grid' },
        picker,
        h('section', { class: 'theater-main' }, topicBar, stageBox, caption, tlHost, controls, infoCard))),
  );

  // --- engine -------------------------------------------------------------
  const stage = new Stage(stageBox, { label: t('theaterTitle') });
  stageBox.insertBefore(stage.svg, startOverlay);
  let pausedByModal = false;
  let bundle: SignBundle | null = null;
  let seen: Record<string, number> = {};
  let tl: ReturnType<typeof timeline> | null = null;
  const onModal = (open: boolean) => {
    if (open && !player.paused) { player.pause(); pausedByModal = true; }
    else if (!open && pausedByModal) { pausedByModal = false; player.resume(); }
  };
  const card = artifactCard(onModal);
  stageBox.insertBefore(card.el, startOverlay);
  const player = new Player(stage, {
    onStep: (i) => viewer.highlight(i),
    onCaption: (text) => {
      caption.textContent = text ?? '';
      caption.classList.toggle('show', !!text);
    },
    onStage: (id, variant) => {
      tl?.set(id, variant);
      caption.textContent = '';
      caption.classList.remove('show');
      // show the real artifact behind this stage of the journey
      const n = seen[id] ?? 0;
      seen[id] = n + 1;
      card.show(bundle?.cards[id]?.[n] ?? null, bundle);
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

  function renderCollTabs(activeId: string) {
    if (CATALOG.collections.length < 2) return;
    collTabs.replaceChildren(
      ...CATALOG.collections.map((c) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: `tab ${c.id === activeId ? 'on' : ''}`,
            'aria-selected': String(c.id === activeId),
            onclick: () => {
              void loadCollection(c.id).then((coll) => {
                if (!alive) return;
                renderCollTabs(coll.id);
                renderPicker(coll);
                const firstKey = coll.signs[current] ? current : (coll.units[0]?.signs[0] ?? '');
                if (firstKey) select(firstKey);
              });
            },
          },
          tx(c.title),
        ),
      ),
    );
  }

  function renderPicker(coll: CollectionBundle) {
    pickBtns.clear();
    picker.replaceChildren(h('h2', {}, `${t('pickChar')} · ${tx(coll.title)}`));
    for (const u of coll.units) {
      const row = h('div', { class: 'pick-row' });
      for (const key of u.signs) {
        const sum = coll.signs[key];
        if (!sum) continue;
        const b = h('button', { type: 'button', class: 'pick', style: { '--u': u.color }, 'aria-label': `${signText(sum.text)} ${sum.reading}`, onclick: () => select(key) },
          signText(sum.text));
        pickBtns.set(key, b);
        row.appendChild(b);
      }
      picker.append(h('div', { class: 'pick-unit', title: tx(u.title) }, h('span', { class: 'pick-unit-n', style: { background: u.color } }, String(u.n)), row));
    }
  }

  function renderInfo(b: SignBundle) {
    const disp = signText(b.text);
    topicBar.textContent = b.topic ? `📖 ${disp} · ${tx(b.topic)}` : '';
    infoCard.replaceChildren(
      h('div', { class: 'info-char', lang: 'zh' }, disp),
      h('div', { class: 'info-body' },
        h('div', { class: 'info-head' },
          h('span', { class: 'info-pinyin' }, b.reading),
          h('span', { class: 'info-meaning' }, tx(b.meaning)),
          speakerButton(() => void prepareSection(b.audio).then((sec) => speakLine(sec, b.clip, disp, 'zh')))),
        h('p', { class: 'info-fact' }, tx(b.fact))),
    );
  }

  async function load(key: string) {
    current = key;
    pickBtns.forEach((b, k) => b.classList.toggle('on', k === key));
    const slash = key.indexOf('/');
    history.replaceState(null, '', `#/theater/${key.slice(0, slash)}/${encodeURIComponent(key.slice(slash + 1))}`);
    player.stop();
    card.show(null, null);
    const found = await findSign(key);
    if (!found) return;
    const b = await loadSign(found.summary);
    if (!alive || current !== key) return;
    bundle = b;
    seen = {};
    const sys = system(b.system);
    renderInfo(b);
    // every real artifact on this sign's journey, listed under the info card
    const items = cardItems(b, (st) => stageMeta(b.system, st)?.icon ?? '');
    if (items.length) infoCard.appendChild(artifactList(items, b, onModal));
    tl = timeline(b.stages, sys);
    tlHost.replaceChildren(tl.el);
    let steps = b.scripts.full;
    if (!narration) steps = withoutNarration(steps);
    viewer.load(steps);
    playBtn.textContent = `⏸ ${t('pause')}`;
    await player.play(steps, signSource(b, sys));
  }

  function select(key: string) {
    startOverlay.remove();
    void load(key);
  }

  // The picker shows the collection that contains the requested sign (else the default collection).
  // Resolves to the sign to start with ('' when there is none or the screen is gone).
  const ready = (async () => {
    const found = param ? await findSign(param) : null;
    const coll = found?.collection ?? (await loadCollection(defaultCollectionId()));
    if (!alive) return '';
    renderCollTabs(coll.id);
    renderPicker(coll);
    current = found ? found.summary.key : coll.units[0]?.signs[0] ?? '';
    return current;
  })();

  // Browsers only allow speech after a user gesture: ask for one tap if needed. The overlay takes taps from
  // the moment it is shown, so a tap while the collection is still loading starts the theater once it is ready.
  startOverlay.addEventListener('click', () => {
    startOverlay.remove();
    void ready.then((key) => { if (alive && key) select(key); });
  });
  void ready.then((key) => {
    if (!key || !startOverlay.isConnected) return; // nothing to play, or a tap is already starting it
    const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
    if (activated) select(key);
    else pickBtns.forEach((b, k) => b.classList.toggle('on', k === key));
  });

  return () => {
    alive = false;
    player.stop();
  };
}
