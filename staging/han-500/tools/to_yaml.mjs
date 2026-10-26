#!/usr/bin/env node
// Convert writer drafts (staging/han-500/drafts/<id>.json) into canonical sign YAML
// (content/systems/han/signs/<id>.yaml), and selection.yaml's units into
// content/collections/first-500/collection.yaml.
//
//   node to_yaml.mjs                 # every draft + the collection
//   node to_yaml.mjs 目 后-後         # only these drafts (+ the collection)
//   node to_yaml.mjs --no-collection
//
// Field order and flow/block styles follow the brief exactly; lineWidth: 0 (no folding).
// The converter refuses drafts with missing/extra keys; check.mjs does the full validation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STAGING = path.resolve(HERE, '..');
const REPO = path.resolve(STAGING, '..', '..');
const DRAFTS = path.join(STAGING, 'drafts');
const SIGNS = path.join(REPO, 'content', 'systems', 'han', 'signs');
const COLLECTION = path.join(REPO, 'content', 'collections', 'first-500', 'collection.yaml');
const SELECTION = path.join(STAGING, 'selection.yaml');

export const ID_RE = /^\p{Script=Han}(-\p{Script=Han})?$/u;
export const LOCALES = ['en', 'zh-Hans', 'zh-Hant'];
export const TOP = ['id', 'text', 'readings', 'meaning', 'fact', 'story', 'journey', 'origin', 'status', 'sources'];
export const STORY = ['topic', 'hook', 'early', 'turn', 'closer'];
export const STORY_REQUIRED = ['topic', 'hook', 'closer'];
const DUMP = { lineWidth: 0, singleQuote: true, flowCollectionPadding: true, indent: 2 };

/** Resolve a file inside a directory, refusing anything that escapes it. */
export function inside(dir, name) {
  const p = path.resolve(dir, name);
  if (!p.startsWith(path.resolve(dir) + path.sep)) throw new Error(`unsafe path: ${name}`);
  return p;
}

function tri(v, where) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where}: expected {en, zh-Hans, zh-Hant}`);
  const extra = Object.keys(v).filter((k) => !LOCALES.includes(k));
  if (extra.length) throw new Error(`${where}: unexpected keys ${extra.join(', ')}`);
  const o = {};
  for (const k of LOCALES) {
    if (typeof v[k] !== 'string') throw new Error(`${where}.${k}: missing`);
    o[k] = v[k].trim();
  }
  return o;
}

/** Normalize one draft object into the canonical key order (throws on missing/extra keys). */
export function canonical(d, file = 'draft') {
  const extra = Object.keys(d).filter((k) => !TOP.includes(k));
  if (extra.length) throw new Error(`${file}: unexpected keys ${extra.join(', ')}`);
  for (const k of TOP) if (!(k in d)) throw new Error(`${file}: missing ${k}`);
  const story = {};
  for (const k of STORY) if (d.story[k] !== undefined) story[k] = tri(d.story[k], `${file} story.${k}`);
  const sx = Object.keys(d.story).filter((k) => !STORY.includes(k));
  if (sx.length) throw new Error(`${file}: unexpected story keys ${sx.join(', ')}`);
  const origin = { type: d.origin.type };
  if (d.origin.parts !== undefined) {
    origin.parts = d.origin.parts.map((p, i) => {
      const o = { char: p.char, role: p.role };
      if (p.gloss !== undefined) o.gloss = tri(p.gloss, `${file} origin.parts[${i}].gloss`);
      const px = Object.keys(p).filter((k) => !['char', 'role', 'gloss'].includes(k));
      if (px.length) throw new Error(`${file}: unexpected origin.parts[${i}] keys ${px.join(', ')}`);
      return o;
    });
  }
  const ox = Object.keys(d.origin).filter((k) => !['type', 'parts'].includes(k));
  if (ox.length) throw new Error(`${file}: unexpected origin keys ${ox.join(', ')}`);
  return {
    id: d.id,
    text: { Hans: d.text.Hans, Hant: d.text.Hant },
    readings: { pinyin: d.readings.pinyin },
    meaning: tri(d.meaning, `${file} meaning`),
    fact: tri(d.fact, `${file} fact`),
    story,
    journey: d.journey === 'default' ? 'default' : (d.journey || []).map((j) => ({ stage: j.stage, form: j.form })),
    origin,
    status: d.status,
    sources: d.sources.map((s) => ({ title: s.title, url: s.url })),
  };
}

function flow(node) {
  node.flow = true;
  return node;
}

/** `key: [ a, b ]` → `key: [a, b]` (flow maps keep their `{ … }` padding, as in the brief). */
function unpadSeq(text, key) {
  const re = new RegExp(`^(\\s*${key}: )\\[ (.*) \\]$`, 'gm');
  return text.replace(re, '$1[$2]');
}

/** Canonical YAML text for one sign. */
export function signYaml(sign) {
  const doc = new YAML.Document(sign);
  const m = doc.contents;
  for (const k of ['text', 'readings', 'meaning']) flow(m.get(k, true));
  const story = m.get('story', true);
  for (const pair of story.items) flow(pair.value);
  const journey = m.get('journey', true);
  if (YAML.isSeq(journey)) {
    flow(journey);
    for (const it of journey.items) flow(it);
  }
  const parts = m.get('origin', true).get('parts', true);
  if (parts) for (const it of parts.items) {
    flow(it);
    const g = it.get('gloss', true);
    if (g) flow(g);
  }
  for (const it of m.get('sources', true).items) {
    flow(it);
    for (const k of ['title', 'url']) it.get(k, true).type = YAML.Scalar.QUOTE_SINGLE;
  }
  return unpadSeq(doc.toString(DUMP), 'journey');
}

export function collectionYaml(sel) {
  const coll = {
    id: 'first-500',
    title: { en: 'My First 500 Characters', 'zh-Hans': '我的前500个字', 'zh-Hant': '我的前500個字' },
    system: 'han',
    units: sel.units.map((u) => ({ n: u.n, title: tri(u.title, `unit ${u.n} title`), color: u.color, signs: u.signs })),
  };
  const doc = new YAML.Document(coll);
  flow(doc.contents.get('title', true));
  for (const u of doc.contents.get('units', true).items) {
    flow(u.get('title', true));
    flow(u.get('signs', true));
    u.get('color', true).type = YAML.Scalar.QUOTE_SINGLE;
  }
  return unpadSeq(doc.toString(DUMP), 'signs');
}

export function readSelection() {
  return YAML.parse(fs.readFileSync(SELECTION, 'utf8'), { uniqueKeys: true, maxAliasCount: 0 });
}

function main() {
  const args = process.argv.slice(2);
  const noColl = args.includes('--no-collection');
  const only = args.filter((a) => !a.startsWith('--'));
  for (const id of only) if (!ID_RE.test(id)) throw new Error(`bad id ${id}`);
  const files = only.length ? only.map((id) => `${id}.json`) : fs.readdirSync(DRAFTS).filter((f) => f.endsWith('.json')).sort();
  fs.mkdirSync(SIGNS, { recursive: true });
  let n = 0;
  const failures = [];
  for (const f of files) {
    const id = f.slice(0, -5);
    try {
      if (!ID_RE.test(id)) throw new Error('file name is not a sign id');
      const d = JSON.parse(fs.readFileSync(inside(DRAFTS, f), 'utf8'));
      if (d.id !== id) throw new Error(`id ${d.id} ≠ file name`);
      fs.writeFileSync(inside(SIGNS, `${id}.yaml`), signYaml(canonical(d, f)));
      n++;
    } catch (e) {
      failures.push(`${path.join('staging/han-500/drafts', f)}: ${e.message}`);
    }
  }
  if (!noColl) {
    fs.mkdirSync(path.dirname(COLLECTION), { recursive: true });
    fs.writeFileSync(COLLECTION, collectionYaml(readSelection()));
  }
  console.log(`converted ${n}/${files.length} drafts${noColl ? '' : ' + collection'}`);
  for (const x of failures) console.error(x);
  process.exitCode = failures.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
