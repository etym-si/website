// Small lookups shared by the validator and the compiler.
import type { ContentSet, SignDoc, SystemDoc } from './load.ts';
import type { Stage } from './schema.ts';

export function splitKey(key: string): [system: string, id: string] {
  const i = key.indexOf('/');
  return [key.slice(0, i), key.slice(i + 1)];
}

/** `马` in a han collection → `han/马`; already-qualified refs pass through. */
export function qualify(ref: string, system: string): string {
  return ref.includes('/') ? ref : `${system}/${ref}`;
}

export function signByKey(content: ContentSet, key: string): SignDoc | undefined {
  const [system, id] = splitKey(key);
  return content.systems.get(system)?.signs.get(id);
}

export function systemStage(sys: SystemDoc, id: string): Stage | undefined {
  return sys.data.stages.find((s) => s.id === id);
}

/** `han.bronze` → the han system and its bronze stage. */
export function stageOf(content: ContentSet, qualified: string): { system: SystemDoc; stage: Stage } | undefined {
  const [sysId, stageId] = qualified.split('.');
  const system = content.systems.get(sysId);
  const stage = system && systemStage(system, stageId);
  return system && stage ? { system, stage } : undefined;
}

/** The form used in card texts (`{sign}`): the first text script (han: Hans). */
export function primaryText(sys: SystemDoc, sign: SignDoc): string {
  return sign.data.text[sys.data.textScripts[0]] ?? Object.values(sign.data.text)[0];
}

export function primaryReading(sys: SystemDoc, sign: SignDoc): string {
  const schemes = Object.entries(sys.data.readings);
  const scheme = (schemes.find(([, r]) => r.primary) ?? schemes[0])?.[0];
  return scheme ? sign.data.readings[scheme] ?? '' : '';
}

/** Text spoken by the system's pronunciation voice, or undefined when the system has none. */
export function pronounceText(sys: SystemDoc, sign: SignDoc): string | undefined {
  const from = sys.data.pronounce?.from;
  return from ? sign.data.text[from.slice('text.'.length)] : undefined;
}

/** Resolved journey: what ingest looks for and what the validator expects in `forms:`. */
export function journeyEntries(sys: SystemDoc, sign: SignDoc): { stage: string; form: string; variants: string[] }[] {
  const defaultForm = sign.data.text[sys.data.journeyForm ?? sys.data.textScripts[0]] ?? sign.data.id;
  const raw = sign.data.journey === 'default' ? (sys.data.defaultJourney ?? []) : sign.data.journey;
  return raw.map((e) => {
    const entry = typeof e === 'string' ? { stage: e } : e;
    const variants = entry.variants ?? systemStage(sys, entry.stage)?.commonsVariants ?? [entry.stage];
    return { stage: entry.stage, form: entry.form ?? defaultForm, variants };
  });
}
