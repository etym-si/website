// Shared UI building blocks.
import { h, s } from '../dom';
import { t, tx } from '../i18n';
import { settings, updateSettings } from '../settings';
import { chime } from '../audio';
import { progress } from '../progress';
import type { Step, SystemB } from '../../shared/bundle-types.ts';
import { buildMascot } from '../pictures';

export function button(label: string, onClick: () => void, variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary', extra: Record<string, string> = {}): HTMLButtonElement {
  return h('button', {
    type: 'button', class: `btn btn-${variant}`, ...extra,
    onclick: () => { chime('tap'); onClick(); },
  }, label);
}

export function header(opts: { showStats?: boolean } = {}): HTMLElement {
  const st = settings();
  const p = progress();
  const toggle = (label: string, aria: string, active: boolean, on: () => void) =>
    h('button', { type: 'button', class: `chip ${active ? 'on' : ''}`, 'aria-label': aria, 'aria-pressed': String(active), onclick: on }, label);
  return h('header', { class: 'topbar' },
    h('a', { href: '#/', class: 'brand', 'aria-label': t('home') },
      h('span', { class: 'brand-mark' }, '字'),
      h('span', { class: 'brand-name' }, 'etym.si'),
      h('span', { class: 'badge' }, t('prototype'))),
    h('div', { class: 'topbar-right' },
      opts.showStats ? h('span', { class: 'stat streak', title: t('streak') }, `🔥 ${p.streak}`) : null,
      opts.showStats ? h('span', { class: 'stat xp' }, `⭐ ${p.xp} XP`) : null,
      h('div', { class: 'seg', role: 'group', 'aria-label': t('langToggle') },
        toggle('EN', 'English', st.lang === 'en', () => updateSettings({ lang: 'en' })),
        toggle('中文', '中文', st.lang === 'zh', () => updateSettings({ lang: 'zh' }))),
      h('div', { class: 'seg', role: 'group', 'aria-label': t('scriptToggle') },
        toggle('简', '简体', st.script === 'simp', () => updateSettings({ script: 'simp' })),
        toggle('繁', '繁體', st.script === 'trad', () => updateSettings({ script: 'trad' }))),
      toggle(st.sound ? '🔊' : '🔇', st.sound ? t('soundOn') : t('soundOff'), st.sound, () => updateSettings({ sound: !st.sound })),
    ),
  );
}

/** Collapsible panel that shows the animation script and highlights the step that is playing. */
export function scriptViewer(open = false): { el: HTMLElement; load: (steps: Step[]) => void; highlight: (i: number) => void } {
  const list = h('ol', { class: 'script-list', start: '0' });
  const details = h('details', { class: 'script-panel' },
    h('summary', {}, `🧾 ${t('script')}`),
    h('p', { class: 'script-note' }, t('scriptNote')),
    list);
  details.open = open;
  let items: HTMLElement[] = [];
  return {
    el: details,
    load(steps) {
      items = steps.map((st) => h('li', {}, h('code', {}, compact(st))));
      list.replaceChildren(...items);
    },
    highlight(i) {
      items.forEach((li, k) => li.classList.toggle('current', k === i));
      if (i >= 0 && details.open) items[i]?.scrollIntoView({ block: 'nearest' });
    },
  };
}

function compact(st: Step): string {
  // one readable line per step; keep only the English text and drop clip keys to keep it short
  return JSON.stringify(st, (k, v) => (k === 'zh-Hans' || k === 'zh-Hant' || k === 'clip' ? undefined : v));
}

/** The journey ribbon: one station per stage this character actually has. */
export function timeline(stages: string[], sys: SystemB): { el: HTMLElement; set: (id: string, variant?: string) => void } {
  const label = h('div', { class: 'tl-label' });
  const metaOf = (id: string) => sys.stages.find((s) => s.id === id) ?? { id, icon: '•', color: '#888888', name: { en: id }, era: { en: '' } };
  const stations = stages.map((id) => {
    const meta = metaOf(id);
    return h('li', { class: 'tl-station', 'data-stage': id, style: { '--c': meta.color } as Partial<CSSStyleDeclaration> },
      h('span', { class: 'tl-dot' }, meta.icon),
      h('span', { class: 'tl-name' }, tx(meta.name)));
  });
  const el = h('div', { class: 'timeline' }, h('ol', { class: 'tl-track' }, ...stations), label);
  return {
    el,
    set(id, variant) {
      let reached = true;
      for (const li of stations) {
        const isCur = li.dataset.stage === id;
        li.classList.toggle('current', isCur);
        li.classList.toggle('past', reached && !isCur);
        if (isCur) reached = false;
      }
      const meta = metaOf(id);
      const note = variant && sys.variantNotes[variant] ? ` · ${tx(sys.variantNotes[variant])}` : '';
      label.replaceChildren(h('strong', {}, `${meta.icon} ${tx(meta.name)}`), h('span', {}, ` ${tx(meta.era)}${note}`));
    },
  };
}

export function mascot(size = 120, mood: 'idle' | 'cheer' = 'idle'): SVGSVGElement {
  return s('svg', { viewBox: '0 0 200 200', width: size, height: size, class: `mascot mascot-${mood} ambient-on`, role: 'img', 'aria-label': 'Gugu the turtle' }, buildMascot());
}

export function confetti(host: HTMLElement, n = 60): void {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#e8453c', '#f5b82e', '#2fb67c', '#4aa3df', '#8b5cf6', '#ff7aa8'];
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  host.appendChild(layer);
  const anims: Promise<unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const piece = h('i', { style: { background: colors[i % colors.length], left: `${50 + (Math.random() - 0.5) * 20}%` } });
    layer.appendChild(piece);
    const dx = (Math.random() - 0.5) * 900;
    const dy = 300 + Math.random() * 500;
    const rot = (Math.random() - 0.5) * 1440;
    anims.push(piece.animate([
      { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${-dy * 0.5}px) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 1600 + Math.random() * 900, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }).finished);
  }
  Promise.allSettled(anims).then(() => layer.remove());
}

export function speakerButton(onClick: () => void, big = false): HTMLButtonElement {
  return h('button', { type: 'button', class: `speaker ${big ? 'big' : ''}`, 'aria-label': t('tapToHear'), onclick: onClick }, '🔊');
}
