// Sound: synthesized UI chimes (Web Audio) and neural storytelling speech: compiled clips packed into one MP3
// per bundle (one byte section per voice, range-fetched into a Blob URL), with Web Speech API fallback.
import type { AudioIndex } from '../shared/bundle-types.ts';
import { CATALOG } from './content';
import { locale } from './i18n';
import { fetchPackRange } from './pack-loader';
import { settings } from './settings';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!settings().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'triangle', vol = 0.16): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export type Chime = 'correct' | 'wrong' | 'tap' | 'complete' | 'pop' | 'unlock';

export function chime(kind: Chime): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.01;
  switch (kind) {
    case 'correct':
      note(c, 659.25, t, 0.18);
      note(c, 987.77, t + 0.09, 0.32);
      break;
    case 'wrong':
      note(c, 293.66, t, 0.16, 'square', 0.06);
      note(c, 220, t + 0.12, 0.28, 'square', 0.06);
      break;
    case 'tap':
      note(c, 880, t, 0.07, 'sine', 0.08);
      break;
    case 'pop':
      note(c, 523.25, t, 0.08, 'sine', 0.1);
      note(c, 783.99, t + 0.05, 0.1, 'sine', 0.1);
      break;
    case 'unlock':
      [523.25, 659.25, 783.99].forEach((f, i) => note(c, f, t + i * 0.07, 0.2));
      break;
    case 'complete':
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => note(c, f, t + i * 0.1, i === 4 ? 0.6 : 0.22));
      break;
  }
}

// ---- speech (pre-generated neural MP3 + Web Speech fallback) -----------------

let voices: SpeechSynthesisVoice[] = [];
const synth: SpeechSynthesis | undefined = 'speechSynthesis' in window ? window.speechSynthesis : undefined;
if (synth) {
  voices = synth.getVoices();
  synth.addEventListener('voiceschanged', () => { voices = synth.getVoices(); });
}

let activeAudio: HTMLAudioElement | null = null;
let activeFinish: (() => void) | null = null;
let speechSpeed = 1;

// ---- compiled audio: one byte section per voice, range-fetched into a Blob URL --------------------------

/** One voice's section of a bundle MP3, decoded by one <audio> element; clips are [ms, dur] inside it. */
export interface Section {
  key: string;
  audio: HTMLAudioElement;
  url: string;
  clips: Record<string, [number, number]>;
}

const sections = new Map<string, Promise<Section | null>>();
const sectionPromises = new WeakMap<Section, Promise<Section | null>>();
const MAX_SECTIONS = 6;
let activeSection: Section | null = null;

function disposeSection(s: Section): void {
  URL.revokeObjectURL(s.url);
  s.audio.removeAttribute('src');
  s.audio.load();
}

/** The audio section that voices a UI locale (zh-Hans and zh-Hant share `zh`). */
export function sectionFor(localeId: string): string {
  return CATALOG.locales.find((l) => l.id === localeId)?.section ?? CATALOG.locales[0]?.section ?? 'en';
}

function sectionCacheKey(index: AudioIndex, id: string): string {
  const r = index.sections[id];
  return r ? `${index.mp3}#${id}:${r[0]}-${r[1]}` : `${index.mp3}#${id}`;
}

async function fetchSection(index: AudioIndex, id: string): Promise<Section | null> {
  const range = index.sections[id];
  if (!range) return null;
  const key = sectionCacheKey(index, id);
  const bytes = await fetchPackRange({ file: index.mp3, range, label: `audio:${id}@${range[0]}`, kind: 'audio' });
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type: 'audio/mpeg' }));
  const audio = new Audio(url);
  audio.preload = 'auto';
  const clips: Record<string, [number, number]> = {};
  for (const [clipKey, per] of Object.entries(index.clips)) if (per[id]) clips[clipKey] = per[id];
  return { key, audio, url, clips };
}

/** Fetch (once, LRU-cached) the section of a bundle's MP3 for the current locale. Null when there is no audio. */
export function prepareSection(index: AudioIndex | null, localeId: string = locale()): Promise<Section | null> {
  if (!index || !settings().sound) return Promise.resolve(null);
  const secId = sectionFor(localeId);
  const key = sectionCacheKey(index, secId);
  let p = sections.get(key);
  if (p) {
    sections.delete(key); // refresh its LRU position
  } else {
    p = fetchSection(index, secId).catch(() => null);
  }
  sections.set(key, p);
  void p.then((s) => { if (s) sectionPromises.set(s, p!); });
  while (sections.size > MAX_SECTIONS) {
    const [oldKey, old] = sections.entries().next().value!;
    sections.delete(oldKey);
    void old.then((s) => {
      if (!s || s === activeSection) return;
      disposeSection(s);
    });
  }
  return p;
}

/** How much longer than its length (in media time) a clip may take before we stop waiting for it. */
const CLIP_SLACK_MS = 1500;

/** Seek to a clip, play it, and stop at its end (inside the 240 ms silent gap that follows every clip).
 *  A stalled or crawling audio clock can't hold the caller up: playing time is capped at the clip's length plus slack. */
function playClip(section: Section, key: string): Promise<void> {
  const [ms, dur] = section.clips[key];
  cancelSpeech();
  return new Promise((resolve) => {
    const a = section.audio;
    const end = (ms + dur) / 1000;
    let done = false;
    let raf = 0;
    let lastTime = -1;
    let stuckSince = performance.now();
    let prev = stuckSince;
    let budget = dur + CLIP_SLACK_MS; // media ms left to wait for; spent at the playback rate while not paused
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      a.removeEventListener('ended', finish);
      a.removeEventListener('error', finish);
      if (!a.paused) a.pause();
      if (activeAudio === a) activeAudio = null;
      if (activeFinish === finish) activeFinish = null;
      if (activeSection === section) {
        activeSection = null;
        if (sections.get(section.key) !== sectionPromises.get(section)) {
          disposeSection(section);
        }
      }
      resolve();
    };
    const tick = () => {
      if (done) return;
      if (a.currentTime >= end) { finish(); return; }
      const now = performance.now();
      if (!a.paused) budget -= (now - prev) * a.playbackRate;
      prev = now;
      if (budget <= 0) { finish(); return; } // the audio clock crawls
      if (a.paused || a.currentTime !== lastTime) { lastTime = a.currentTime; stuckSince = now; }
      else if (now - stuckSince > 3000) { finish(); return; } // stalled while playing
      raf = requestAnimationFrame(tick);
    };
    activeAudio = a;
    activeFinish = finish;
    activeSection = section;
    a.playbackRate = speechSpeed;
    a.addEventListener('ended', finish, { once: true });
    a.addEventListener('error', finish, { once: true });
    a.currentTime = ms / 1000;
    void a.play().catch(finish);
    raf = requestAnimationFrame(tick); // watch from the start: a seek or play() that never settles is a stall too
  });
}

/** Speak a line: its compiled clip when the section has it, else device speech. */
export function speakLine(section: Section | null, key: string | undefined, text: string, lang: 'zh' | 'en'): Promise<void> {
  if (!settings().sound || !text) return Promise.resolve();
  if (section && key && section.clips[key]) return playClip(section, key);
  return speakDevice(text, lang);
}

function pickVoice(lang: 'zh' | 'en'): SpeechSynthesisVoice | undefined {
  const prefs = lang === 'zh'
    ? settings().script === 'trad' ? ['zh-TW', 'zh-HK', 'zh-CN', 'zh'] : ['zh-CN', 'cmn', 'zh-TW', 'zh']
    : ['en-US', 'en-GB', 'en'];
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-');
  for (const local of [true, false]) {
    for (const p of prefs) {
      const v = voices.find((x) => norm(x).startsWith(p) && x.localService === local);
      if (v) return v;
    }
  }
  return undefined;
}

/** Can we pronounce signs? Compiled pronunciation clips, or a Chinese device voice. */
export function hasPronunciations(index: AudioIndex | null): boolean {
  return !!index || (!!synth && !!pickVoice('zh'));
}

export function setSpeechSpeed(rate: number): void {
  speechSpeed = Math.min(1.6, Math.max(0.7, rate));
  if (activeAudio) activeAudio.playbackRate = speechSpeed;
}

export function pauseSpeech(): void {
  if (activeAudio && !activeAudio.paused) activeAudio.pause();
  synth?.pause();
}

export function resumeSpeech(): void {
  if (activeAudio && activeAudio.paused) void activeAudio.play().catch(() => activeFinish?.());
  synth?.resume();
}

export function cancelSpeech(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeFinish) {
    const fn = activeFinish;
    activeFinish = null;
    fn();
  }
  synth?.cancel();
}

/** Device speech (Web Speech API): the fallback when a line has no compiled clip. */
function speakDevice(text: string, lang: 'zh' | 'en'): Promise<void> {
  if (!settings().sound || !text || !synth) return Promise.resolve();
  cancelSpeech();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.lang = v?.lang ?? (lang === 'zh' ? 'zh-CN' : 'en-US');
    u.rate = (lang === 'zh' ? 0.72 : 0.95) * speechSpeed;
    u.pitch = 1.1;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    activeFinish = finish;
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, Math.max(3000, text.length * 250));
    synth.speak(u);
  });
}
