// Sound: synthesized UI chimes (Web Audio, no audio files) and speech via the Web Speech API.
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

// ---- speech ------------------------------------------------------------------

let voices: SpeechSynthesisVoice[] = [];
const synth: SpeechSynthesis | undefined = 'speechSynthesis' in window ? window.speechSynthesis : undefined;
if (synth) {
  voices = synth.getVoices();
  synth.addEventListener('voiceschanged', () => { voices = synth.getVoices(); });
}

function pickVoice(lang: 'zh' | 'en'): SpeechSynthesisVoice | undefined {
  const prefs = lang === 'zh'
    ? settings().script === 'trad' ? ['zh-TW', 'zh-HK', 'zh-CN', 'zh'] : ['zh-CN', 'cmn', 'zh-TW', 'zh']
    : ['en-US', 'en-GB', 'en'];
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-');
  // Privacy: prefer on-device voices (localService) so text is not sent to a cloud speech service.
  // TODO(privacy): ship pre-recorded audio in the real app instead of relying on device voices.
  for (const local of [true, false]) {
    for (const p of prefs) {
      const v = voices.find((x) => norm(x).startsWith(p) && x.localService === local);
      if (v) return v;
    }
  }
  return undefined;
}

export function hasVoice(lang: 'zh' | 'en'): boolean {
  return !!synth && !!pickVoice(lang);
}

/** Speak text; resolves when finished (or immediately if sound is off / unsupported). */
export function speak(text: string, lang: 'zh' | 'en'): Promise<void> {
  if (!synth || !settings().sound || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.lang = v?.lang ?? (lang === 'zh' ? 'zh-CN' : 'en-US');
    u.rate = lang === 'zh' ? 0.72 : 0.95;
    u.pitch = 1.1;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, Math.max(3000, text.length * 250));
    synth.speak(u);
  });
}

export function cancelSpeech(): void {
  synth?.cancel();
}
