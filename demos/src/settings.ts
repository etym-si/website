// User settings (UI language, character script, sound, and narrator voices). Persisted locally; validated on load.
export type Lang = 'en' | 'zh';
export type Script = 'simp' | 'trad';
export type TtsMode = 'pack' | 'live' | 'kokoro';
export interface Settings {
  lang: Lang;
  script: Script;
  sound: boolean;
  voiceEn: string;
  voiceZh: string;
  liveTts: boolean;
  ttsMode: TtsMode;
}

const KEY = 'etymsi.settings.v1';
const VALID_VOICE = /^[a-z][a-z0-9-]{1,31}$/;
const DEFAULTS: Settings = {
  lang: 'en',
  script: 'simp',
  sound: true,
  voiceEn: 'narr-en-ava',
  voiceZh: 'zh',
  liveTts: false,
  ttsMode: 'pack',
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return { ...DEFAULTS };
    const o = v as Record<string, unknown>;
    const ttsMode: TtsMode =
      o.ttsMode === 'kokoro' || o.ttsMode === 'live' || o.ttsMode === 'pack'
        ? o.ttsMode
        : o.liveTts === true
          ? 'live'
          : 'pack';
    return {
      lang: o.lang === 'zh' ? 'zh' : 'en',
      script: o.script === 'trad' ? 'trad' : 'simp',
      sound: typeof o.sound === 'boolean' ? o.sound : true,
      voiceEn: typeof o.voiceEn === 'string' && VALID_VOICE.test(o.voiceEn) ? o.voiceEn : DEFAULTS.voiceEn,
      voiceZh: typeof o.voiceZh === 'string' && VALID_VOICE.test(o.voiceZh) ? o.voiceZh : DEFAULTS.voiceZh,
      liveTts: ttsMode === 'live',
      ttsMode,
    };
  } catch {
    return { ...DEFAULTS }; // corrupted/blocked storage: fall back safely
  }
}

let current: Settings = load();
const listeners = new Set<(s: Settings) => void>();

export function settings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...current, ...patch };
  if (patch.ttsMode !== undefined) {
    next.liveTts = patch.ttsMode === 'live';
  } else if (patch.liveTts !== undefined) {
    next.ttsMode = patch.liveTts ? 'live' : 'pack';
  }
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable (private mode): keep in memory */
  }
  document.documentElement.lang = current.lang === 'en' ? 'en' : current.script === 'trad' ? 'zh-Hant' : 'zh-Hans';
  listeners.forEach((fn) => fn(current));
}

export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
