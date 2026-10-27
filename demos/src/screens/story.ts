import { h } from '../dom';
import { t, tx } from '../i18n';
import { header, scriptViewer, button } from '../ui/common';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { withoutNarration } from '../engine/narration';
import { loadCollection, loadStory } from '../content';
import { storySource } from '../play-source';
import type { StoryBundle } from '../../shared/bundle-types.ts';

let narration = true;
let speed = 1;

/** Story player, used both standalone (#/story) and as a lesson node. */
export function storyPlayer(host: HTMLElement, opts: { onDone?: () => void; withScript?: boolean } = {}) {
  const stageBox = h('div', { class: 'stage-box wide' });
  const caption = h('div', { class: 'caption', 'aria-live': 'polite' });
  const viewer = scriptViewer(false);
  const stage = new Stage(stageBox, { label: t('storyTitle') });
  const player = new Player(stage, {
    onStep: (i) => viewer.highlight(i),
    onCaption: (text) => {
      caption.textContent = text ?? '';
      caption.classList.toggle('show', !!text);
    },
  });
  player.setSpeed(speed);
  const playBtn = button(`⏸ ${t('pause')}`, () => {
    if (player.paused) player.resume();
    else player.pause();
    playBtn.textContent = player.paused ? `▶ ${t('play')}` : `⏸ ${t('pause')}`;
  }, 'secondary');
  const speedBtns = [0.5, 1, 2].map((x) => h('button', {
    type: 'button', class: `chip ${x === speed ? 'on' : ''}`,
    onclick: () => { speed = x; player.setSpeed(x); speedBtns.forEach((b, i) => b.classList.toggle('on', [0.5, 1, 2][i] === x)); },
  }, `${x}×`));
  let current: StoryBundle | null = null;
  const narrBtn = h('button', {
    type: 'button', class: `chip ${narration ? 'on' : ''}`, 'aria-pressed': String(narration),
    onclick: () => { narration = !narration; narrBtn.classList.toggle('on', narration); if (current) void run(current); },
  }, `🗣️ ${t('narration')}`);
  const controls = h('div', { class: 'controls' },
    playBtn,
    button(`⟲ ${t('replay')}`, () => { if (current) void run(current); }, 'secondary'),
    h('div', { class: 'seg', role: 'group', 'aria-label': t('speed') }, ...speedBtns),
    narrBtn);
  host.append(stageBox, caption, controls);
  if (opts.withScript === true) host.appendChild(viewer.el);

  async function run(bundle: StoryBundle) {
    current = bundle;
    const steps = narration ? bundle.script : withoutNarration(bundle.script);
    viewer.load(steps);
    playBtn.textContent = `⏸ ${t('pause')}`;
    const finished = await player.play(steps, storySource(bundle));
    if (finished) opts.onDone?.();
  }
  return { run, stop: () => player.stop() };
}

export function renderStory(root: HTMLElement, r: { collection: string; story: string | null; index: number }): () => void {
  let alive = true;
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const topicBar = h('div', { class: 'story-topic' });
  const body = h('section', { class: 'story-main' }, topicBar);
  root.replaceChildren(
    header(),
    h('main', { class: 'story' }, h('h1', { class: 'page-title' }, `🎬 ${t('storyTitle')}`), tabs, body),
  );
  const sp = storyPlayer(body);
  void loadCollection(r.collection).then((coll) => {
    if (!alive || !coll.stories.length) return;
    const byId = r.story ? coll.stories.findIndex((s) => s.id === r.story) : -1;
    const at = byId >= 0 ? byId : Math.min(Math.max(r.index, 1), coll.stories.length) - 1;
    const ref = coll.stories[at];
    tabs.replaceChildren(...coll.stories.map((s, i) => h('a', {
      href: `#/story/${coll.id}/${s.id}`, role: 'tab', class: `tab ${i === at ? 'on' : ''}`, 'aria-selected': String(i === at),
    }, `${t('chapter')} ${i + 1}${t('chapter') === '第' ? '章' : ''} · ${tx(s.title)}`)));
    topicBar.textContent = `📖 ${tx(ref.title)} — ${tx(ref.topic)}`;
    const start = h('button', { type: 'button', class: 'start-overlay', 'aria-label': t('play') }, h('span', {}, '▶'));
    body.querySelector('.stage-box')?.appendChild(start);
    start.addEventListener('click', () => {
      start.remove();
      void loadStory(ref).then((bundle) => (alive ? sp.run(bundle) : undefined));
    });
  });
  return () => {
    alive = false;
    sp.stop();
  };
}
