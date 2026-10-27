// Player: executes animation scripts on a Stage using the Web Animations API.
// Every animation (including waits) is a WAAPI Animation, so pause / resume / speed / stop are uniform.
import type { GlyphSel, Step, StepOf } from '../../shared/steps.ts';
import { s, prefersReducedMotion } from '../dom';
import { glyphFromData, showInstant, INK, type GlyphInstance } from '../glyphs';
import { buildPicture } from '../picture';
import { locale, signText, tx } from '../i18n';
import { settings } from '../settings';
import { cancelSpeech, pauseSpeech, prepareSection, resumeSpeech, setSpeechSpeed, speakLine, type Section } from '../audio';
import type { PlaySource } from '../play-source';
import type { Actor, Stage } from './stage';

type Gait = NonNullable<StepOf<'move'>['gait']>;
type Ambient = StepOf<'ambient'>['motion'];
type Tone = StepOf<'bg'>['tone'];

export interface PlayerHooks {
  onStep?: (index: number) => void; // top-level step index; -1 when finished
  onCaption?: (text: string | null) => void;
  onStage?: (stage: string, variant?: string) => void;
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
  private pendingSpeech: Promise<void> | null = null;
  private source: PlaySource | null = null;
  private section: Section | null = null;
  private speakingNarration = false;
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
    setSpeechSpeed(x);
    for (const a of [...this.running, ...this.loops]) a.playbackRate = x;
  }

  pause(): void {
    if (this._paused) return;
    this._paused = true;
    for (const a of [...this.running, ...this.loops]) a.pause();
    pauseSpeech();
  }

  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    for (const a of [...this.running, ...this.loops]) a.play();
    resumeSpeech();
  }

  stop(): void {
    this.gen += 1;
    for (const a of [...this.running, ...this.loops]) a.cancel();
    this.running.clear();
    this.loops.clear();
    this.pendingSpeech = null;
    this.speakingNarration = false;
    this._paused = false;
    cancelSpeech();
  }

  private async finishSpeech(gen: number): Promise<void> {
    const p = this.pendingSpeech;
    if (!p) return;
    this.pendingSpeech = null;
    await p;
    this.check(gen);
  }

  /** Play a script from the start, taking glyphs, labels, pictures and audio from `source`.
   *  Resolves true when it ran to completion, false if stopped. */
  async play(script: Step[], source: PlaySource): Promise<boolean> {
    this.stop();
    const gen = this.gen;
    this.source = source;
    this.stage.reset();
    this.stage.front.appendChild(this.clock);
    this.hooks.onCaption?.(null);
    this.section = await prepareSection(source.audio);
    if (gen !== this.gen) return false;
    try {
      for (let i = 0; i < script.length; i++) {
        if (gen !== this.gen) return false;
        this.hooks.onStep?.(i);
        await this.exec(script[i], gen);
      }
      await this.finishSpeech(gen);
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
      case 'pose': {
        const a = S.actor(st.actor);
        if (!/^[a-z][a-z0-9-]{0,31}$/.test(st.part)) return;
        const el = a.pic.querySelector(`[data-part="${st.part}"]`) as SVGElement | null;
        if (!el) return;
        el.style.transformBox = 'fill-box';
        el.style.transformOrigin = st.origin ?? 'center';
        const from = a.partPoses.get(st.part) ?? 'translate(0px, 0px) scale(1, 1) rotate(0deg)';
        const to = `translate(${st.dx ?? 0}px, ${st.dy ?? 0}px) scale(${st.scaleX ?? 1}, ${st.scaleY ?? 1}) rotate(${st.deg ?? 0}deg)`;
        await this.anim(el, [{ transform: from }, { transform: to }], st.ms ?? 800, gen, { easing: 'cubic-bezier(.34,1.26,.64,1)' });
        a.partPoses.set(st.part, to);
        return;
      }
      case 'draw': {
        const a = S.actor(st.actor);
        const g = this.glyph(st.glyph, a.size, st.color ?? INK);
        a.current?.wrap.remove();
        return this.drawGlyph(a, g, st.ms ?? 1600, gen);
      }
      case 'show': {
        const a = S.actor(st.actor);
        const g = showInstant(this.glyph(st.glyph, a.size, st.color ?? INK));
        this.check(gen);
        a.current?.wrap.remove();
        a.glyph.appendChild(g.wrap);
        a.current = g;
        return this.anim(g.wrap, [{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1)' }], 260, gen, { easing: 'ease-out' });
      }
      case 'swap': {
        const a = S.actor(st.actor);
        const next = this.glyph(st.glyph, a.size, st.color ?? INK);
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
        await this.finishSpeech(gen);
        this.hooks.onStage?.(st.stage, st.variant);
        return;
      case 'caption':
        await this.finishSpeech(gen);
        this.hooks.onCaption?.(st.text ? tx(st.text) : null);
        return;
      case 'tag':
        return this.tag(S.actor(st.actor), st.sign, st.hold ?? 2600, st.dx ?? 0, st.dy ?? 0, gen);
      case 'say': {
        const text = typeof st.text === 'string' ? st.text : tx(st.text);
        const lang = st.lang === 'zh' ? 'zh' : settings().lang;
        const clip = st.clip?.[locale()];
        if (!st.wait) {
          // Character tag callout inside a story beat: speak when narration is off/silent
          if (!st.silent && !this.speakingNarration) {
            this.pendingSpeech = speakLine(this.section, clip, text, lang)
              .then(() => this.wait(180, gen))
              .catch(() => {});
          }
          return;
        }
        await this.finishSpeech(gen);
        this.speakingNarration = !st.silent && st.lang === 'ui';
        const p = st.silent ? Promise.resolve() : speakLine(this.section, clip, text, lang);
        const readMs = Math.max(1700, text.length * (lang === 'zh' ? 170 : 55));
        const task = Promise.all([p, this.wait(readMs, gen)])
          .then(() => {
            this.speakingNarration = false;
            return this.wait(220, gen);
          })
          .catch(() => {
            this.speakingNarration = false;
          });
        if (st.lang === 'zh') {
          await task;
          this.check(gen);
        } else {
          // Run narration concurrently with the visual steps that follow, awaiting before the next caption/stage/end
          this.pendingSpeech = task;
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

  private glyph(sel: GlyphSel, size: number, ink: string): GlyphInstance {
    const data = this.source?.glyph(sel);
    if (!data) throw new Error(`no glyph for ${sel.sign} ${sel.stage}#${sel.index ?? 0}`);
    return glyphFromData(data, size, ink);
  }

  private async picture(a: Actor, key: string, ms: number, gen: number): Promise<void> {
    const def = this.source?.picture(key);
    if (!def) return;
    a.picDef = def;
    a.partPoses.clear();
    a.picSpin.replaceChildren(s('g', { transform: `scale(${a.size / 300}) translate(-150,-150)` }, buildPicture(def.tree)));
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

  private async tag(a: Actor, key: string, hold: number, dx: number, dy: number, gen: number): Promise<void> {
    const info = this.source?.label(key);
    const [x, y] = this.stage.where(a);
    const label = info ? signText(info.text) : key.slice(key.indexOf('/') + 1);
    const g = s('g', { class: 'name-tag', transform: `translate(${x + dx},${y - a.size / 2 - 52 + dy})` });
    const inner = s('g', {},
      s('rect', { x: -40, y: -40, width: 80, height: 92, rx: 16, class: 'tag-box' }),
      s('text', { x: 0, y: 14, 'text-anchor': 'middle', class: 'tag-char' }, label),
      s('text', { x: 0, y: 42, 'text-anchor': 'middle', class: 'tag-pinyin' }, info?.reading ?? ''),
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
