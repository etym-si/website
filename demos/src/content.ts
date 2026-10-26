// The app's view of the static API: the catalog is inlined at build time; bundles are fetched from our own
// origin, re-checked, and cached for the session.
import catalogJson from '@generated/catalog.json';
import type { Catalog, CollectionBundle, SignBundle, SignSummary, StageMetaB, StoryBundle, StoryRefB, SystemB } from '../shared/bundle-types.ts';
import { checkCollectionBundle, checkSignBundle, checkStoryBundle } from '../shared/bundle-check.ts';

export const CATALOG = catalogJson as unknown as Catalog;
const base = import.meta.env.BASE_URL;

async function getJson(file: string): Promise<unknown> {
  const res = await fetch(base + file, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);
  return res.json();
}

function cached<T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let p = map.get(key);
  if (!p) {
    p = load();
    p.catch(() => map.delete(key)); // retry later instead of caching a failure
    map.set(key, p);
  }
  return p;
}

const collections = new Map<string, Promise<CollectionBundle>>();
const signs = new Map<string, Promise<SignBundle>>();
const stories = new Map<string, Promise<StoryBundle>>();

export const defaultCollectionId = (): string => CATALOG.collections[0]?.id ?? '';
export const defaultSystemId = (): string => CATALOG.collections[0]?.system ?? CATALOG.systems[0]?.id ?? '';

export function system(id: string): SystemB {
  const s = CATALOG.systems.find((x) => x.id === id);
  if (!s) throw new Error(`unknown writing system ${id}`);
  return s;
}

export function stageMeta(systemId: string, stageId: string): StageMetaB | undefined {
  return CATALOG.systems.find((x) => x.id === systemId)?.stages.find((s) => s.id === stageId);
}

export function loadCollection(id: string): Promise<CollectionBundle> {
  const ref = CATALOG.collections.find((c) => c.id === id);
  if (!ref) return Promise.reject(new Error(`unknown collection ${id}`));
  return cached(collections, id, () => getJson(ref.file).then(checkCollectionBundle));
}

/** The first published collection (catalog order) that contains the sign. */
export async function findSign(key: string): Promise<{ collection: CollectionBundle; summary: SignSummary } | null> {
  for (const c of CATALOG.collections) {
    const collection = await loadCollection(c.id);
    const summary = collection.signs[key];
    if (summary) return { collection, summary };
  }
  return null;
}

export function loadSign(summary: SignSummary): Promise<SignBundle> {
  return cached(signs, summary.key, () => getJson(summary.file).then(checkSignBundle));
}

export function loadStory(ref: StoryRefB): Promise<StoryBundle> {
  return cached(stories, ref.file, () => getJson(ref.file).then(checkStoryBundle));
}
