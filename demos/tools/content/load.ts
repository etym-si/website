// Reads content/ into a ContentSet. Every file is parsed with the safe YAML reader and its strict schema;
// problems become diagnostics (file:line:col) instead of exceptions, so one bad file never hides the others.
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { rel } from '../paths.ts';
import { type Diags, reportZod } from './diagnostics.ts';
import { readYaml, type YamlFile } from './yaml.ts';
import { ConfigSchema, makeSchemas, type Artifact, type Collection, type Config, type Sign, type Source, type Story, type System, type Ui } from './schema.ts';

export interface Doc<T> { y: YamlFile; data: T }
export interface SignDoc extends Doc<Sign> { system: string; key: string; ext?: Record<string, string | number | boolean> }
export interface SystemDoc extends Doc<System> { signs: Map<string, SignDoc> }
export interface ArtifactDoc extends Doc<Artifact> { photoAbs: string }
export interface StoryDoc extends Doc<Story> { order: number }
export interface CollectionDoc extends Doc<Collection> { stories: Map<string, StoryDoc> }
export interface ContentSet {
  root: string;
  locales: string[];
  config: Doc<Config>;
  ui: Doc<Ui>;
  systems: Map<string, SystemDoc>;
  artifacts: Map<string, ArtifactDoc>;
  sources: Map<string, Doc<Source>>;
  collections: Map<string, CollectionDoc>;
}

const yamlFiles = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort() : []);
const subdirs = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.') && !f.startsWith('_') && statSync(path.join(dir, f)).isDirectory()).sort() : [];
const stem = (f: string) => f.replace(/\.yaml$/, '');

function parseDoc<T>(diags: Diags, abs: string, schema: z.ZodType<T>): Doc<T> | null {
  if (!existsSync(abs)) { diags.error(rel(abs), [], 'file is missing'); return null; }
  const y = readYaml(abs, diags);
  if (!y) return null;
  const r = schema.safeParse(y.data);
  if (!r.success) { reportZod(diags, y, r.error); return null; }
  return { y, data: r.data };
}

function idMatches(diags: Diags, y: YamlFile, id: string, expected: string, what: string): void {
  if (id !== expected) diags.error(y, ['id'], `id "${id}" must match the ${what} "${expected}"`);
}

export function loadContent(root: string, diags: Diags): ContentSet | null {
  const config = parseDoc(diags, path.join(root, 'config.yaml'), ConfigSchema);
  if (!config) return null;
  const locales = config.data.locales.map((l) => l.id);
  const S = makeSchemas(locales);
  const ui = parseDoc(diags, path.join(root, 'ui.yaml'), S.Ui);
  if (!ui) return null;
  const content: ContentSet = { root, locales, config, ui, systems: new Map(), artifacts: new Map(), sources: new Map(), collections: new Map() };

  for (const id of subdirs(path.join(root, 'systems'))) {
    const dir = path.join(root, 'systems', id);
    const sys = parseDoc(diags, path.join(dir, 'system.yaml'), S.System);
    if (!sys) continue;
    idMatches(diags, sys.y, sys.data.id, id, 'folder name');
    const doc: SystemDoc = { ...sys, signs: new Map() };
    content.systems.set(id, doc);
    for (const f of yamlFiles(path.join(dir, 'signs'))) {
      const y = readYaml(path.join(dir, 'signs', f), diags);
      if (!y) continue;
      const raw: Record<string, unknown> = y.data && typeof y.data === 'object' && !Array.isArray(y.data) ? { ...(y.data as Record<string, unknown>) } : {};
      let ext: SignDoc['ext'];
      if (id in raw) { // system-specific extension block, e.g. `egyptian: { kind: uniliteral, sound: m }`
        const e = S.Ext.safeParse(raw[id]);
        if (e.success) ext = e.data; else reportZod(diags, y, e.error, [id]);
        delete raw[id];
      }
      const r = S.Sign.safeParse(raw);
      if (!r.success) { reportZod(diags, y, r.error); continue; }
      idMatches(diags, y, r.data.id, stem(f), 'file name');
      doc.signs.set(r.data.id, { y, data: r.data, system: id, key: `${id}/${r.data.id}`, ext });
    }
  }
  for (const f of yamlFiles(path.join(root, 'artifacts'))) {
    const a = parseDoc(diags, path.join(root, 'artifacts', f), S.Artifact);
    if (!a) continue;
    idMatches(diags, a.y, a.data.id, stem(f), 'file name');
    content.artifacts.set(a.data.id, { ...a, photoAbs: path.join(root, 'artifacts', a.data.image.file) });
  }
  for (const f of yamlFiles(path.join(root, 'sources'))) {
    const s = parseDoc(diags, path.join(root, 'sources', f), S.Source);
    if (!s) continue;
    idMatches(diags, s.y, s.data.id, stem(f), 'file name');
    content.sources.set(s.data.id, s);
  }
  for (const id of subdirs(path.join(root, 'collections'))) {
    const dir = path.join(root, 'collections', id);
    const c = parseDoc(diags, path.join(dir, 'collection.yaml'), S.Collection);
    if (!c) continue;
    idMatches(diags, c.y, c.data.id, id, 'folder name');
    const doc: CollectionDoc = { ...c, stories: new Map() };
    content.collections.set(id, doc);
    for (const f of yamlFiles(path.join(dir, 'stories'))) {
      const s = parseDoc(diags, path.join(dir, 'stories', f), S.Story);
      if (!s) continue;
      const m = /^(\d{2})-(.+)\.yaml$/.exec(f);
      if (!m) { diags.error(s.y, [], 'story files are named NN-<id>.yaml'); continue; }
      idMatches(diags, s.y, s.data.id, m[2], 'file name');
      doc.stories.set(s.data.id, { ...s, order: Number(m[1]) });
    }
  }
  return content;
}
