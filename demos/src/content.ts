// The app's view of the static API: the catalog is inlined at build time; bundles are range-fetched from
// multi-member .pack.gz shards, gunzipped via DecompressionStream, decoded from Protobuf, re-checked, and cached.
import catalogJson from '@generated/catalog.json';
import type { Catalog, CollectionBundle, SignBundle, SignSummary, StageMetaB, StoryBundle, StoryRefB, SystemB } from '../shared/bundle-types.ts';
import { checkCollectionBundle, checkSignBundle, checkStoryBundle } from '../shared/bundle-check.ts';
import { decodeCollectionBundle, decodeSignBundle, decodeStoryBundle } from '../shared/bundle-proto.ts';
import { fetchPackRange } from './pack-loader';

export const CATALOG = catalogJson as unknown as Catalog;

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
  return cached(collections, id, async () => {
    const bytes = await fetchPackRange({ file: ref.file, range: ref.range, label: `collection:${id}`, kind: 'proto' });
    return checkCollectionBundle(decodeCollectionBundle(bytes));
  });
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
  return cached(signs, summary.key, async () => {
    const bytes = await fetchPackRange({ file: summary.file, range: summary.range, label: summary.key, kind: 'proto' });
    return checkSignBundle(decodeSignBundle(bytes));
  });
}

export function loadStory(ref: StoryRefB): Promise<StoryBundle> {
  const cacheKey = `${ref.file}#${ref.range ? `${ref.range[0]}-${ref.range[1]}` : ref.id}`;
  return cached(stories, cacheKey, async () => {
    const bytes = await fetchPackRange({ file: ref.file, range: ref.range, label: `story:${ref.id}`, kind: 'proto' });
    return checkStoryBundle(decodeStoryBundle(bytes));
  });
}
