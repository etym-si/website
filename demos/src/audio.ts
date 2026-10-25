// Sound: synthesized UI chimes (Web Audio) and natural neural storytelling speech
// (pre-generated edge-tts MP3s in public/tts/, with Web Speech API fallback).
import { settings } from './settings';
import ttsManifest from './data/tts-manifest.json';

const base = import.meta.env.BASE_URL;
const MANIFEST = ttsManifest as Record<'en' | 'zh', Record<string, string>>;

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
const audioCache = new Map<string, HTMLAudioElement>();

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

export function hasVoice(lang: 'zh' | 'en'): boolean {
  if (Object.keys(MANIFEST[lang] ?? {}).length > 0) return true;
  return !!synth && !!pickVoice(lang);
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

/** Speak text using pre-generated neural storytelling audio (or Web Speech fallback). */
export function speak(text: string, lang: 'zh' | 'en'): Promise<void> {
  if (!settings().sound || !text) return Promise.resolve();
  cancelSpeech();

  const file = MANIFEST[lang]?.[text];
  if (file) {
    return new Promise((resolve) => {
      let audio = audioCache.get(file);
      if (!audio) {
        audio = new Audio(`${base}tts/${file}`);
        audio.preload = 'auto';
        audioCache.set(file, audio);
      } else {
        audio.currentTime = 0;
      }
      audio.playbackRate = speechSpeed;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        audio.removeEventListener('ended', finish);
        audio.removeEventListener('error', finish);
        clearTimeout(timer);
        if (activeAudio === audio) activeAudio = null;
        if (activeFinish === finish) activeFinish = null;
        resolve();
      };
      activeAudio = audio;
      activeFinish = finish;
      const timer = setTimeout(finish, Math.max(6000, text.length * 320));
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      void audio.play().catch(finish);
    });
  }

  if (!synth) return Promise.resolve();
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
