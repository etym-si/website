// Player: executes animation scripts on a Stage using the Web Animations API.
// Every animation (including waits) is a WAAPI Animation, so pause / resume / speed / stop are uniform.
import { s, prefersReducedMotion } from '../dom';
import { buildSel, showInstant, INK, type GlyphInstance } from '../glyphs';
import { PICTURES } from '../pictures';
import { tx } from '../i18n';
import { BY_CHAR, displayChar } from '../data/chars';
import { settings } from '../settings';
import { speak, cancelSpeech } from '../audio';
import type { StageId } from '../data/stages';
import type { Ambient, Gait, Step, Tone } from './script';
import type { Actor, Stage } from './stage';

export interface PlayerHooks {
  onStep?: (index: number) => void; // top-level step index; -1 when finished
  onCaption?: (text: string | null) => void;
  onStage?: (stage: StageId, variant?: string) => void;
}

class Stopped extends Error {}

const GAITS: Record<Gait, { frames: Keyframe[]; ms: number }> = {
  walk: { ms: 900, frames: [
    { transform: 'translateY(0px) rotate(-3deg)' }, { transform: 'translateY(-7px) rotate(0deg)' },
    { transform: 'translateY(0px) rotate(3deg)' }, { transform: 'translateY(-7px) rotate(0deg)' }, { transform: 'translateY(0px) rotate(-3deg)' }] },
  hop: { ms: 520, frames: [{ transform: 'translateY(0px)', easing: 'ease-out' }, { transform: 'translateY(-28px)', easing: 'ease-in' }, { transform: 'translateY(0px)' }] },
  fly: { ms: 340, frames: [{ transform: 'translateY(0px) scaleY(1)' }, { transform: 'translateY(-10px) scaleY(0.72)' }, { transform: 'translateY(0px) scaleY(1)' }] },
  swim: { ms: 800, frames: [{ transform: 'rotate(-7deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(-7deg)' }] },
  gallop: { ms: 420, frames: [{ transform: 'translateY(0px) rotate(-4deg)' }, { transform: 'translateY(-15px) rotate(3deg)' }, { transform: 'translateY(0px) rotate(-4deg)' }] },
};

const AMBIENTS: Record<Exclude<Ambient, 'none'>, { frames: Keyframe[]; ms: number; origin?: 'base' }> = {
  bob: { ms: 2400, frames: [{ transform: 'translateY(0px)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0px)' }] },
  sway: { ms: 3200, origin: 'base', frames: [{ transform: 'rotate(-2.5deg)' }, { transform: 'rotate(2.5deg)' }, { transform: 'rotate(-2.5deg)' }] },
  pulse: { ms: 1600, frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }] },
  flicker: { ms: 460, origin: 'base', frames: [
    { transform: 'scale(1, 1)', opacity: 1 }, { transform: 'scale(1.05, 0.93)', opacity: 0.85 }, { transform: 'scale(0.97, 1.07)', opacity: 1 }, { transform: 'scale(1, 1)', opacity: 1 }] },
  flow: { ms: 2600, frames: [{ transform: 'translateX(-12px)' }, { transform: 'translateX(12px)' }, { transform: 'translateX(-12px)' }] },
  float: { ms: 3600, frames: [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(6px, -8px)' }, { transform: 'translate(0px, 0px)' }] },
};

const TONES: Record<Tone, { fill: string; opacity: number }> = {
  paper: { fill: '#ffb36b', opacity: 0 },
  dawn: { fill: '#ffb36b', opacity: 0.22 },
  dusk: { fill: '#ff7a59', opacity: 0.3 },
  night: { fill: '#17224d', opacity: 0.55 },
};

export class Player {
  private running = new Set<Animation>();
  private loops = new Set<Animation>();
  private gen = 0;
  private _speed = 1;
  private _paused = false;
  private readonly clock: SVGGElement;
  readonly reduced = prefersReducedMotion();

  constructor(readonly stage: Stage, private hooks: PlayerHooks = {}) {
    this.clock = s('g', { class: 'clock' });
    stage.front.appendChild(this.clock);
  }

  get paused(): boolean { return this._paused; }
  get speed(): number { return this._speed; }

  setSpeed(x: number): void {
    this._speed = x;
    for (const a of [...this.running, ...this.loops]) a.playbackRate = x;
  }

  pause(): void {
    if (this._paused) return;
    this._paused = true;
    for (const a of [...this.running, ...this.loops]) a.pause();
    cancelSpeech();
  }

  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    for (const a of [...this.running, ...this.loops]) a.play();
  }

  stop(): void {
    this.gen += 1;
    for (const a of [...this.running, ...this.loops]) a.cancel();
    this.running.clear();
    this.loops.clear();
    this._paused = false;
    cancelSpeech();
  }

  /** Play a script from the start. Resolves true when it ran to completion, false if stopped. */
  async play(script: Step[]): Promise<boolean> {
    this.stop();
    const gen = this.gen;
    this.stage.reset();
    this.stage.front.appendChild(this.clock);
    this.hooks.onCaption?.(null);
    try {
      for (let i = 0; i < script.length; i++) {
        if (gen !== this.gen) return false;
        this.hooks.onStep?.(i);
        await this.exec(script[i], gen);
      }
      this.hooks.onStep?.(-1);
      return gen === this.gen;
    } catch (e) {
      if (e instanceof Stopped || gen !== this.gen) return false;
      throw e;
    }
  }

  // ---- primitives ----------------------------------------------------------

  private check(gen: number): void {
    if (gen !== this.gen) throw new Stopped();
  }

  private anim(el: Element, frames: Keyframe[], ms: number, gen: number, opts: KeyframeAnimationOptions = {}): Promise<void> {
    this.check(gen);
    const duration = Math.max(1, this.reduced ? Math.min(ms, 150) : ms);
    const a = el.animate(frames, { duration, fill: 'forwards', easing: 'ease-in-out', ...opts });
    a.playbackRate = this._speed;
    if (this._paused) a.pause();
    this.running.add(a);
    return a.finished.then(
      () => {
        this.running.delete(a);
        try { a.commitStyles(); } catch { /* element no longer rendered */ }
        a.cancel();
        this.check(gen);
      },
      () => {
        this.running.delete(a);
        throw new Stopped();
      },
    );
  }

  /** A pausable, speed-aware wait (it's an animation on an invisible element). Not shortened by reduced motion. */
  private wait(ms: number, gen: number): Promise<void> {
    this.check(gen);
    const a = this.clock.animate([{ opacity: 1 }, { opacity: 1 }], { duration: Math.max(1, ms) });
    a.playbackRate = this._speed;
    if (this._paused) a.pause();
    this.running.add(a);
    return a.finished.then(() => { this.running.delete(a); this.check(gen); }, () => { this.running.delete(a); throw new Stopped(); });
  }

  private loop(el: Element, frames: Keyframe[], ms: number): Animation | undefined {
    if (this.reduced) return undefined;
    const a = el.animate(frames, { duration: ms, iterations: Infinity, easing: 'ease-in-out' });
    a.playbackRate = this._speed;
    if (this._paused) a.pause();
    this.loops.add(a);
    return a;
  }

  private endLoop(a?: Animation): void {
    if (!a) return;
    a.cancel();
    this.loops.delete(a);
  }

  // ---- steps ---------------------------------------------------------------

  private async exec(st: Step, gen: number): Promise<void> {
    this.check(gen);
    const S = this.stage;
    switch (st.do) {
      case 'place':
        S.place(st.actor, st.at[0], st.at[1], st.size, st.back);
        return;
      case 'picture':
        return this.picture(S.actor(st.actor), st.pic, st.ms ?? 700, gen);
      case 'rotate': {
        const a = S.actor(st.actor);
        const pic = (st.target ?? 'picture') === 'picture';
        const from = pic ? a.picRot : a.rot;
        await this.anim(pic ? a.picSpin : a.spin, [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${st.deg}deg)` }], st.ms ?? 900, gen,
          { easing: 'cubic-bezier(.5,-0.3,.4,1.3)' });
        if (pic) a.picRot = st.deg; else a.rot = st.deg;
        return;
      }
      case 'draw': {
        const a = S.actor(st.actor);
        const g = await buildSel(st.glyph, a.size, st.color ?? INK);
        a.current?.wrap.remove();
        return this.drawGlyph(a, g, st.ms ?? 1600, gen);
      }
      case 'show': {
        const a = S.actor(st.actor);
        const g = showInstant(await buildSel(st.glyph, a.size, st.color ?? INK));
        this.check(gen);
        a.current?.wrap.remove();
        a.glyph.appendChild(g.wrap);
        a.current = g;
        return this.anim(g.wrap, [{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1)' }], 260, gen, { easing: 'ease-out' });
      }
      case 'swap': {
        const a = S.actor(st.actor);
        const next = await buildSel(st.glyph, a.size, st.color ?? INK);
        return this.swap(a, next, st.ms ?? 1500, gen);
      }
      case 'clearPicture': {
        const a = S.actor(st.actor);
        await this.anim(a.pic, [{ opacity: 1 }, { opacity: 0 }], st.ms ?? 600, gen);
        a.picSpin.replaceChildren();
        return;
      }
      case 'wash': {
        const a = S.actor(st.actor);
        const rx = (st.w ?? st.size ?? a.size) * 0.5;
        const ry = (st.h ?? st.size ?? a.size) * 0.5;
        const blob = s('ellipse', { cx: st.dx ?? 0, cy: st.dy ?? 0, rx, ry, fill: st.color, filter: `url(#${S.washFilter})` });
        const w = s('g', { class: 'wash' }, blob);
        a.wash.appendChild(w);
        return this.anim(w, [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: st.opacity ?? 0.5, transform: 'scale(1)' }], st.ms ?? 900, gen,
          { easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      case 'move': {
        const a = S.actor(st.actor);
        const nx = st.to[0] - a.x;
        const ny = st.to[1] - a.y;
        const gait = st.gait ? this.loop(a.gait, GAITS[st.gait].frames, GAITS[st.gait].ms) : undefined;
        try {
          await this.anim(a.motion, [{ transform: `translate(${a.ox}px, ${a.oy}px)` }, { transform: `translate(${nx}px, ${ny}px)` }], st.ms, gen,
            { easing: st.ease ?? 'ease-in-out' });
        } finally {
          this.endLoop(gait);
        }
        a.ox = nx;
        a.oy = ny;
        return;
      }
      case 'ambient': {
        const a = S.actor(st.actor);
        this.endLoop(a.ambientAnim);
        a.ambientAnim = undefined;
        if (st.motion === 'none') return;
        const spec = AMBIENTS[st.motion];
        a.ambient.style.transformOrigin = spec.origin === 'base' ? `0px ${a.size * 0.45}px` : '0px 0px';
        a.ambientAnim = this.loop(a.ambient, spec.frames, spec.ms);
        return;
      }
      case 'fade': {
        const a = S.actor(st.actor);
        return this.anim(a.root, [{ opacity: getComputedStyle(a.root).opacity }, { opacity: st.to }], st.ms ?? 600, gen);
      }
      case 'scale': {
        const a = S.actor(st.actor);
        await this.anim(a.zoom, [{ transform: `scale(${a.scale})` }, { transform: `scale(${st.to})` }], st.ms ?? 600, gen, { easing: 'cubic-bezier(.34,1.56,.64,1)' });
        a.scale = st.to;
        return;
      }
      case 'remove': {
        const a = S.actor(st.actor);
        await this.anim(a.root, [{ opacity: 1 }, { opacity: 0 }], st.ms ?? 500, gen);
        S.remove(st.actor);
        return;
      }
      case 'bg': {
        const tone = TONES[st.tone];
        return this.anim(S.tint, [{ opacity: tone.opacity, fill: tone.fill }], st.ms ?? 1500, gen);
      }
      case 'stage':
        this.hooks.onStage?.(st.stage, st.variant);
        return;
      case 'caption':
        this.hooks.onCaption?.(st.text ? tx(st.text) : null);
        return;
      case 'tag':
        return this.tag(S.actor(st.actor), st.char, st.hold ?? 2600, st.dx ?? 0, st.dy ?? 0, gen);
      case 'say': {
        const text = typeof st.text === 'string' ? st.text : tx(st.text);
        const lang = st.lang === 'zh' ? 'zh' : settings().lang;
        const p = st.silent ? Promise.resolve() : speak(text, lang);
        if (st.wait) {
          // pace by the narrator, but always leave enough time to read the caption (sound may be off)
          const readMs = Math.max(1700, text.length * (lang === 'zh' ? 170 : 55));
          await Promise.all([p, this.wait(readMs, gen)]);
        }
        return;
      }
      case 'wait':
        return this.wait(st.ms, gen);
      case 'together':
        await Promise.all(st.steps.map((x) => this.exec(x, gen)));
        return;
    }
  }

  private async picture(a: Actor, id: string, ms: number, gen: number): Promise<void> {
    const def = PICTURES[id];
    if (!def) return;
    a.picDef = def;
    a.picSpin.replaceChildren(s('g', { transform: `scale(${a.size / 300}) translate(-150,-150)` }, def.build()));
    a.pic.classList.add('ambient-on');
    await this.anim(a.pic, [
      { opacity: 0, transform: 'scale(0.4)' },
      { opacity: 1, transform: 'scale(1.08)', offset: 0.7 },
      { opacity: 1, transform: 'scale(1)' }], ms, gen, { easing: 'ease-out' });
  }

  private async drawGlyph(a: Actor, g: GlyphInstance, ms: number, gen: number): Promise<void> {
    this.check(gen);
    a.glyph.appendChild(g.wrap);
    a.current = g;
    if (g.kind === 'hist') {
      // 1) sketch the outline with a fine brush, 2) let the ink flood in
      await Promise.all(g.outlines.map((o) => this.anim(o, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }], ms * 0.62, gen)));
      const fills = g.fills.filter((f) => !f.classList.contains('g-stroke'));
      const outs = g.outlines.filter((o) => !o.classList.contains('g-stroke'));
      await Promise.all([
        ...fills.map((f) => this.anim(f, [{ opacity: 0 }, { opacity: 1 }], ms * 0.38, gen, { easing: 'ease-out' })),
        ...outs.map((o) => this.anim(o, [{ opacity: 1 }, { opacity: 0 }], ms * 0.38, gen)),
      ]);
      return;
    }
    // regular script: real stroke order; time per stroke proportional to its length
    const gap = 60;
    const total = g.strokes.reduce((t, x) => t + x.len, 0) || 1;
    const avail = Math.max(ms - gap * g.strokes.length, 300);
    for (const x of g.strokes) {
      x.median.style.opacity = '1';
      await this.anim(x.median, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }], Math.max(150, (x.len / total) * avail), gen);
      x.fill.style.opacity = '1';
      x.median.style.opacity = '0';
      await this.wait(gap, gen);
    }
  }

  private async swap(a: Actor, next: GlyphInstance, ms: number, gen: number): Promise<void> {
    const old = a.current;
    const out = old
      ? this.anim(old.wrap, [
          { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
          { opacity: 0, transform: 'scale(1.12)', filter: 'blur(6px)' }], 560, gen, { easing: 'ease-in' }).then(() => old.wrap.remove())
      : Promise.resolve();
    await this.wait(180, gen);
    await Promise.all([out, this.drawGlyph(a, next, ms, gen)]);
  }

  private async tag(a: Actor, ch: string, hold: number, dx: number, dy: number, gen: number): Promise<void> {
    const info = BY_CHAR[ch];
    const [x, y] = this.stage.where(a);
    const label = info ? displayChar(info, settings().script) : ch;
    const g = s('g', { class: 'name-tag', transform: `translate(${x + dx},${y - a.size / 2 - 52 + dy})` });
    const inner = s('g', {},
      s('rect', { x: -40, y: -40, width: 80, height: 92, rx: 16, class: 'tag-box' }),
      s('text', { x: 0, y: 14, 'text-anchor': 'middle', class: 'tag-char' }, label),
      s('text', { x: 0, y: 42, 'text-anchor': 'middle', class: 'tag-pinyin' }, info?.pinyin ?? ''),
    );
    g.appendChild(inner);
    this.stage.front.appendChild(g);
    await this.anim(inner, [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1.1)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], 380, gen,
      { easing: 'ease-out' });
    // fade out later without blocking the script
    this.wait(hold, gen)
      .then(() => this.anim(inner, [{ opacity: 1 }, { opacity: 0 }], 400, gen))
      .then(() => g.remove())
      .catch(() => g.remove());
  }
}
