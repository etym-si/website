#!/usr/bin/env node
// Checker for the han-500 content: sign YAML files + the first-500 collection.
//
//   node check.mjs            # check content/systems/han/signs/*.yaml + collection
//   node check.mjs --drafts   # convert drafts in memory first (no files written), then check
//   node check.mjs --quiet    # errors only, no warnings
//
// Errors (exit 1) follow the brief's list; warnings flag style issues for human review.
// Message format: <file>:<line>:<col> <path>: <message>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML, { LineCounter } from 'yaml';
import { canonical, signYaml, collectionYaml, readSelection, ID_RE, LOCALES, TOP, STORY, STORY_REQUIRED, inside } from './to_yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STAGING = path.resolve(HERE, '..');
const REPO = path.resolve(STAGING, '..', '..');
const SIGNS = path.join(REPO, 'content', 'systems', 'han', 'signs');
const COLLECTION = path.join(REPO, 'content', 'collections', 'first-500', 'collection.yaml');
const DRAFTS = path.join(STAGING, 'drafts');
const COVERAGE = path.join(STAGING, 'glyph-coverage.json');
const RESEARCH = path.join(STAGING, 'research');
const FILM_STORIES = path.join(REPO, 'demos', 'src', 'data', 'char-stories.ts');
const FILM = [...'日山水林木鸟象草田竹马夫刀舟鱼网燕云雨伞石火龟鹿豕叟虎弓舍羊花门犬子女月'];
const ORIGIN_TYPES = ['pictogram', 'ideogram', 'compound-ideogram', 'phono-semantic', 'loan', 'uncertain'];
const STAGES = ['oracle', 'bronze', 'seal', 'clerical'];
const ROLES = ['meaning', 'sound'];
// Primary readings that are legitimately toneless (neutral tone).
const NEUTRAL = new Set(['的', '了', '么', '吗', '呢', '吧', '们', '啊']);
const TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ]/;
const PINYIN = /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ]+$/;

const argv = process.argv.slice(2);
const args = new Set(argv);
const quiet = args.has('--quiet');
// --slice N: only the ids of writer slice N (from .cache/packets/slice-N.ids); skips collection checks
const sliceArg = argv.find((a) => a.startsWith('--slice'));
const sliceN = sliceArg ? (sliceArg.split('=')[1] ?? argv[argv.indexOf(sliceArg) + 1]) : null;
const only = sliceN ? new Set(fs.readFileSync(path.join(STAGING, '.cache', 'packets', `slice-${Number(sliceN)}.ids`), 'utf8').split(/\s+/).filter(Boolean)) : null;
const COVERAGE_FILE = argv.includes('--provisional') ? path.join(STAGING, '.cache', 'provisional_coverage.json') : COVERAGE;
const errors = [];
const warnings = [];
const err = (loc, msg) => errors.push(`${loc} ${msg}`);
const warn = (loc, msg) => warnings.push(`${loc} ${msg}`);

function rel(p) {
  return path.relative(REPO, p);
}

/** file:line:col for a key path inside a parsed document. */
function locator(file, doc, lc) {
  return (keys) => {
    let node = doc.contents;
    let range = node?.range;
    for (const k of keys) {
      if (!node || typeof node.get !== 'function') break;
      const next = node.get(k, true);
      if (next === undefined) break;
      node = next;
      range = node?.range || range;
    }
    const pos = range ? lc.linePos(range[0]) : { line: 1, col: 1 };
    return `${rel(file)}:${pos.line}:${pos.col} ${keys.join('.') || '(root)'}:`;
  };
}

function isTri(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function exactKeys(obj, keys, at, keyPath, { optional = [] } = {}) {
  if (!isTri(obj)) {
    err(at(keyPath), 'expected a mapping');
    return false;
  }
  const have = Object.keys(obj);
  for (const k of keys) if (!have.includes(k) && !optional.includes(k)) err(at(keyPath), `missing field "${k}"`);
  for (const k of have) if (!keys.includes(k)) err(at([...keyPath, k]), `unexpected field "${k}"`);
  return true;
}

function checkTri(v, at, keyPath, film = false) {
  if (!exactKeys(v, LOCALES, at, keyPath)) return;
  for (const loc of LOCALES) {
    const s = v[loc];
    const p = [...keyPath, loc];
    if (typeof s !== 'string' || !s.trim()) {
      err(at(p), 'empty locale string');
      continue;
    }
    if (loc === 'zh-Hant' && /[“”]/.test(s)) err(at(p), 'zh-Hant must use 「」 quotes, not “”');
    if (loc === 'zh-Hans' && /[「」『』]/.test(s)) err(at(p), 'zh-Hans must use “” quotes, not 「」');
    if (loc === 'en' && /^\s*long,? long ago/i.test(s)) err(at(p), 'English must not start with "Long, long ago"');
    if (loc !== 'en' && /^\s*很久很久以前/.test(s)) err(at(p), 'must not start with 很久很久以前');
    if (loc === 'zh-Hant' && /"/.test(s)) warn(at(p), 'straight double quote in zh-Hant');
  }
}

// ── reference data ──────────────────────────────────────────────────────────
const coverage = fs.existsSync(COVERAGE_FILE) ? JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8')) : null;
if (!coverage) err(`${rel(COVERAGE_FILE)}:1:1`, 'glyph coverage file missing');
const research = (id) => {
  const p = path.join(RESEARCH, `${id}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};
const filmHooks = new Map();
if (fs.existsSync(FILM_STORIES)) {
  // hook: T('en', 'zh-Hans', 'zh-Hant') blocks of the 36 film characters
  const src = fs.readFileSync(FILM_STORIES, 'utf8');
  for (const m of src.matchAll(/^\s{2}(\S+): \{\s*\n[\s\S]*?hook: T\(\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'/gm)) {
    for (const s of [m[2], m[3], m[4]]) filmHooks.set(s.replace(/\\'/g, "'").trim(), `film ${m[1]}`);
  }
}
// simplified ↔ traditional pairs known from the research extracts (for script-mixing warnings)
const s2t = new Map();
if (fs.existsSync(RESEARCH)) {
  for (const f of fs.readdirSync(RESEARCH)) {
    const r = JSON.parse(fs.readFileSync(path.join(RESEARCH, f), 'utf8'));
    if (r.s && r.t && r.s !== r.t && r.s.length === 1 && r.t.length === 1) s2t.set(r.s, r.t);
  }
}
const tradSet = new Set(s2t.values());

// ── load signs ──────────────────────────────────────────────────────────────
const sources = []; // { file, text }
if (args.has('--drafts')) {
  for (const f of fs.readdirSync(DRAFTS).filter((x) => x.endsWith('.json')).sort()) {
    if (only && !only.has(f.slice(0, -5))) continue;
    const file = inside(DRAFTS, f);
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      sources.push({ file: path.join(SIGNS, f.replace(/\.json$/, '.yaml')), text: signYaml(canonical(d, f)), draft: file });
    } catch (e) {
      err(`${rel(file)}:1:1`, `cannot convert draft: ${e.message}`);
    }
  }
} else if (fs.existsSync(SIGNS)) {
  for (const f of fs.readdirSync(SIGNS).filter((x) => x.endsWith('.yaml')).sort()) {
    const file = inside(SIGNS, f);
    sources.push({ file, text: fs.readFileSync(file, 'utf8') });
  }
}

const ids = new Map();
const hooks = new Map();
const topics = new Map();
const signIds = new Set();

for (const { file, text } of sources) {
  const lc = new LineCounter();
  const doc = YAML.parseDocument(text, { lineCounter: lc, uniqueKeys: true, maxAliasCount: 0, prettyErrors: false });
  const at = locator(file, doc, lc);
  if (doc.errors.length) {
    for (const e of doc.errors) {
      const pos = e.linePos?.[0] || { line: 1, col: 1 };
      err(`${rel(file)}:${pos.line}:${pos.col}`, `YAML does not parse: ${e.message.split('\n')[0]}`);
    }
    continue;
  }
  const y = doc.toJS();
  const base = path.basename(file, '.yaml');
  if (!exactKeys(y, TOP, at, [])) continue;
  const order = Object.keys(y).join(',');
  if (order !== TOP.join(',')) warn(at([]), `field order differs from the brief: ${order}`);

  // id
  if (typeof y.id !== 'string' || !ID_RE.test(y.id)) err(at(['id']), `bad id ${JSON.stringify(y.id)}`);
  if (y.id !== base) err(at(['id']), `id "${y.id}" ≠ file name "${base}"`);
  if (ids.has(y.id)) err(at(['id']), `duplicate id (also in ${ids.get(y.id)})`);
  ids.set(y.id, rel(file));
  signIds.add(y.id);
  if (FILM.includes(y.id) || FILM.includes(String(y.id).split('-')[0])) err(at(['id']), 'film characters must not get new sign files');
  const [hans, hantFromId] = String(y.id).split('-');

  // text
  if (exactKeys(y.text, ['Hans', 'Hant'], at, ['text'])) {
    if (y.text.Hans !== hans) err(at(['text', 'Hans']), `Hans "${y.text.Hans}" ≠ id`);
    if (hantFromId && y.text.Hant !== hantFromId) err(at(['text', 'Hant']), `Hant "${y.text.Hant}" ≠ composite id`);
    for (const k of ['Hans', 'Hant']) if (typeof y.text[k] !== 'string' || [...y.text[k]].length !== 1) err(at(['text', k]), 'expected one character');
    const r = research(y.id);
    if (r && r.t && y.text.Hant !== r.t) warn(at(['text', 'Hant']), `Hant "${y.text.Hant}" ≠ research traditional form "${r.t}"`);
  }
  // readings
  if (exactKeys(y.readings, ['pinyin'], at, ['readings'])) {
    const p = String(y.readings.pinyin ?? '');
    if (!p) err(at(['readings', 'pinyin']), 'empty pinyin');
    else if (!PINYIN.test(p)) err(at(['readings', 'pinyin']), `pinyin "${p}" is not a single lower-case syllable`);
    else if (!TONE.test(p) && !NEUTRAL.has(y.id)) err(at(['readings', 'pinyin']), `pinyin "${p}" has no tone mark`);
    const r = research(y.id);
    if (r && r.pinyin?.length && !r.pinyin.includes(p) && TONE.test(p)) warn(at(['readings', 'pinyin']), `pinyin "${p}" not among Wiktionary readings ${r.pinyin.join('/')}`);
  }
  checkTri(y.meaning, at, ['meaning']);
  checkTri(y.fact, at, ['fact']);
  // story
  if (exactKeys(y.story, STORY, at, ['story'], { optional: ['early', 'turn'] })) {
    for (const k of Object.keys(y.story)) if (STORY.includes(k)) checkTri(y.story[k], at, ['story', k]);
    for (const k of STORY_REQUIRED) if (!y.story[k]) err(at(['story']), `missing story.${k}`);
    if (isTri(y.story.hook)) {
      for (const loc of LOCALES) {
        const h = String(y.story.hook[loc] ?? '').trim();
        if (!h) continue;
        if (hooks.has(h)) err(at(['story', 'hook', loc]), `duplicated hook (same as ${hooks.get(h)})`);
        else if (filmHooks.has(h)) err(at(['story', 'hook', loc]), `duplicated hook (same as ${filmHooks.get(h)})`);
        hooks.set(h, y.id);
      }
    }
    if (isTri(y.story.topic)) {
      const t = String(y.story.topic.en ?? '').trim().toLowerCase();
      if (t && topics.has(t)) warn(at(['story', 'topic', 'en']), `same topic as ${topics.get(t)}`);
      topics.set(t, y.id);
    }
  }
  // journey vs glyph coverage
  const cov = coverage?.[y.id];
  if (coverage && !cov) err(at(['journey']), 'sign missing from glyph-coverage.json');
  if (y.journey === 'default') {
    if (cov && (cov.plan !== 'default' || cov.count === 0)) err(at(['journey']), `journey "default" but coverage is ${cov.plan}/${cov.count} stages`);
  } else if (Array.isArray(y.journey)) {
    for (const [i, j] of y.journey.entries()) {
      if (!exactKeys(j, ['stage', 'form'], at, ['journey', i])) continue;
      if (!STAGES.includes(j.stage)) err(at(['journey', i, 'stage']), `unknown stage "${j.stage}"`);
      if (typeof j.form !== 'string' || [...j.form].length !== 1) err(at(['journey', i, 'form']), 'form must be one character');
    }
    if (cov) {
      const want = JSON.stringify(cov.journey);
      const have = JSON.stringify(y.journey.map((j) => ({ stage: j.stage, form: j.form })));
      if (y.journey.length === 0 && cov.count > 0) err(at(['journey']), `journey [] but Commons has ${cov.count} stage(s): use ${want}`);
      else if (y.journey.length > 0 && want !== have) err(at(['journey']), `journey ${have} ≠ coverage ${want}`);
    }
  } else err(at(['journey']), 'journey must be "default", [] or a list of { stage, form }');
  // origin
  if (exactKeys(y.origin, ['type', 'parts'], at, ['origin'], { optional: ['parts'] })) {
    if (!ORIGIN_TYPES.includes(y.origin.type)) err(at(['origin', 'type']), `unknown origin type "${y.origin.type}"`);
    if (y.origin.parts !== undefined) {
      if (!Array.isArray(y.origin.parts) || !y.origin.parts.length) err(at(['origin', 'parts']), 'parts must be a non-empty list');
      else for (const [i, p] of y.origin.parts.entries()) {
        if (!exactKeys(p, ['char', 'role', 'gloss'], at, ['origin', 'parts', i], { optional: ['gloss'] })) continue;
        if (typeof p.char !== 'string' || !p.char.trim()) err(at(['origin', 'parts', i, 'char']), 'empty part');
        if (!ROLES.includes(p.role)) err(at(['origin', 'parts', i, 'role']), `role must be ${ROLES.join(' | ')}`);
        if (p.gloss !== undefined) checkTri(p.gloss, at, ['origin', 'parts', i, 'gloss']);
      }
      if (y.origin.type === 'phono-semantic' && Array.isArray(y.origin.parts) && !y.origin.parts.some((p) => p.role === 'sound'))
        warn(at(['origin', 'parts']), 'phono-semantic without a sound part');
    } else if (['compound-ideogram', 'phono-semantic'].includes(y.origin.type)) warn(at(['origin']), `${y.origin.type} without parts`);
  }
  // status + sources
  if (y.status !== 'draft') err(at(['status']), 'new signs must be status: draft');
  if (!Array.isArray(y.sources) || !y.sources.length) err(at(['sources']), 'missing sources');
  else for (const [i, s] of y.sources.entries()) {
    if (!exactKeys(s, ['title', 'url'], at, ['sources', i])) continue;
    if (typeof s.title !== 'string' || !s.title.trim()) err(at(['sources', i, 'title']), 'empty source title');
    if (typeof s.url !== 'string' || !/^https:\/\/\S+$/.test(s.url)) err(at(['sources', i, 'url']), 'source url must be https');
  }

  // style warnings (human review)
  const sentences = (s) => (s.match(/[.!?。！？]+(?=\s|$|[”」’)])/g) || []).length;
  const lines = [['fact', y.fact], ...STORY.filter((k) => y.story?.[k]).map((k) => [`story.${k}`, y.story[k]])];
  for (const [k, v] of lines) {
    if (!isTri(v)) continue;
    if (sentences(v.en || '') > 2 && k !== 'story.topic') warn(at([...k.split('.'), 'en']), `more than 2 sentences`);
    if ((v.en || '').length > 260) warn(at([...k.split('.'), 'en']), `long line (${v.en.length} chars)`);
    const hant = v['zh-Hant'] || '';
    const hansText = v['zh-Hans'] || '';
    const bad = [...hant].filter((c) => s2t.has(c) && !tradSet.has(c));
    if (bad.length) warn(at([...k.split('.'), 'zh-Hant']), `simplified form(s) in zh-Hant: ${[...new Set(bad)].join('')}`);
    const badT = [...hansText].filter((c) => tradSet.has(c) && !s2t.has(c));
    if (badT.length) warn(at([...k.split('.'), 'zh-Hans']), `traditional form(s) in zh-Hans: ${[...new Set(badT)].join('')}`);
  }
  if (isTri(y.fact) && y.text?.Hant && !String(y.fact['zh-Hant']).includes(y.text.Hant) && !String(y.story?.closer?.['zh-Hant'] ?? '').includes(y.text.Hant))
    warn(at(['fact', 'zh-Hant']), `zh-Hant fact/closer never shows ${y.text.Hant}`);
}

// ── collection ──────────────────────────────────────────────────────────────
let collText = null;
if (only) {
  const missing = [...only].filter((id) => !ids.has(id));
  if (missing.length) warnings.push(`slice ${sliceN}: ${missing.length} draft(s) not written yet: ${missing.join(' ')}`);
} else if (args.has('--drafts')) {
  try { collText = collectionYaml(readSelection()); } catch (e) { err(`${rel(COLLECTION)}:1:1`, `cannot build collection: ${e.message}`); }
} else if (fs.existsSync(COLLECTION)) collText = fs.readFileSync(COLLECTION, 'utf8');
else err(`${rel(COLLECTION)}:1:1`, 'collection missing');
if (collText) {
  const lc = new LineCounter();
  const doc = YAML.parseDocument(collText, { lineCounter: lc, uniqueKeys: true, maxAliasCount: 0 });
  const at = locator(COLLECTION, doc, lc);
  if (doc.errors.length) err(at([]), `YAML does not parse: ${doc.errors[0].message.split('\n')[0]}`);
  else {
    const c = doc.toJS();
    exactKeys(c, ['id', 'title', 'system', 'units'], at, []);
    if (c.id !== 'first-500') err(at(['id']), 'id must be first-500');
    if (c.system !== 'han') err(at(['system']), 'system must be han');
    checkTri(c.title, at, ['title']);
    const seen = new Map();
    for (const [i, u] of (c.units || []).entries()) {
      exactKeys(u, ['n', 'title', 'color', 'signs'], at, ['units', i]);
      if (u.n !== i + 1) err(at(['units', i, 'n']), `unit number ${u.n} ≠ ${i + 1}`);
      checkTri(u.title, at, ['units', i, 'title']);
      if (!/^#[0-9a-f]{6}$/.test(u.color)) err(at(['units', i, 'color']), 'color must be #rrggbb');
      if (!Array.isArray(u.signs)) { err(at(['units', i, 'signs']), 'signs must be a list'); continue; }
      if (u.signs.length < 6 || u.signs.length > 10) warn(at(['units', i, 'signs']), `unit has ${u.signs.length} signs (brief: 6–10)`);
      for (const s of u.signs) {
        if (!signIds.has(s) && !FILM.includes(s)) err(at(['units', i, 'signs']), `sign "${s}" does not exist`);
        if (seen.has(s)) err(at(['units', i, 'signs']), `sign "${s}" appears twice (also unit ${seen.get(s)})`);
        seen.set(s, u.n);
      }
    }
    for (const id of signIds) if (!seen.has(id)) err(at(['units']), `sign "${id}" is not in the collection`);
    const filmIn = FILM.filter((f) => seen.has(f)).length;
    console.log(`collection: ${c.units?.length ?? 0} units, ${seen.size} signs (${filmIn} film)`);
  }
}

if (!quiet) for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(`checked ${sources.length} signs: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exitCode = errors.length ? 1 : 0;
