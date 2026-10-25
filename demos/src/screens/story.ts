import { h } from '../dom';
import { t, tx } from '../i18n';
import { header, scriptViewer, button } from '../ui/common';
import { Stage } from '../engine/stage';
import { Player } from '../engine/player';
import { CHAPTERS, withoutNarration } from '../engine/scripts';
import type { Step } from '../engine/script';

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
  let currentScript: Step[] = [];
  const narrBtn = h('button', {
    type: 'button', class: `chip ${narration ? 'on' : ''}`, 'aria-pressed': String(narration),
    onclick: () => { narration = !narration; narrBtn.classList.toggle('on', narration); void run(currentScript); },
  }, `🗣️ ${t('narration')}`);
  const controls = h('div', { class: 'controls' },
    playBtn,
    button(`⟲ ${t('replay')}`, () => void run(currentScript), 'secondary'),
    h('div', { class: 'seg', role: 'group', 'aria-label': t('speed') }, ...speedBtns),
    narrBtn);
  host.append(stageBox, caption, controls);
  if (opts.withScript !== false) host.appendChild(viewer.el);

  async function run(script: Step[]) {
    currentScript = script;
    const steps = narration ? script : withoutNarration(script);
    viewer.load(steps);
    playBtn.textContent = `⏸ ${t('pause')}`;
    const finished = await player.play(steps);
    if (finished) opts.onDone?.();
  }
  return { run, stop: () => player.stop() };
}

export function renderStory(root: HTMLElement, param: string): () => void {
  const n = Math.min(Math.max(parseInt(param, 10) || 1, 1), CHAPTERS.length);
  const ch = CHAPTERS[n - 1];
  const tabs = h('div', { class: 'tabs', role: 'tablist' },
    ...CHAPTERS.map((c, i) => h('a', {
      href: `#/story/${i + 1}`, role: 'tab', class: `tab ${i + 1 === n ? 'on' : ''}`, 'aria-selected': String(i + 1 === n),
    }, `${t('chapter')} ${i + 1}${t('chapter') === '第' ? '章' : ''} · ${tx(c.title)}`)));
  const topicBar = h('div', { class: 'story-topic' }, `📖 ${tx(ch.title)} — ${tx(ch.topic)}`);
  const body = h('section', { class: 'story-main' }, topicBar);
  root.replaceChildren(
    header(),
    h('main', { class: 'story' }, h('h1', { class: 'page-title' }, `🎬 ${t('storyTitle')}`), tabs, body),
  );
  const sp = storyPlayer(body);
  const start = h('button', { type: 'button', class: 'start-overlay', 'aria-label': t('play') }, h('span', {}, '▶'));
  body.querySelector('.stage-box')?.appendChild(start);
  start.addEventListener('click', () => { start.remove(); void sp.run(ch.script); });
  return () => sp.stop();
}
