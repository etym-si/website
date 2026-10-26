#!/usr/bin/env node
// Counts for REPORT.md: signs by origin type, by number of ancient stages, journey kinds.
//   node stats.mjs            # reads content/systems/han/signs/*.yaml + glyph-coverage.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STAGING = path.resolve(HERE, '..');
const REPO = path.resolve(STAGING, '..', '..');
const SIGNS = path.join(REPO, 'content', 'systems', 'han', 'signs');
const coverage = JSON.parse(fs.readFileSync(path.join(STAGING, 'glyph-coverage.json'), 'utf8'));
const coll = YAML.parse(fs.readFileSync(path.join(REPO, 'content', 'collections', 'first-500', 'collection.yaml'), 'utf8'));

const count = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const byType = new Map();
const byStages = new Map();
const byJourney = new Map();
const withEarly = { early: 0, turn: 0 };
const composite = [];
const none = [];
let n = 0;
for (const f of fs.readdirSync(SIGNS).filter((x) => x.endsWith('.yaml')).sort()) {
  const y = YAML.parse(fs.readFileSync(path.join(SIGNS, f), 'utf8'));
  n++;
  count(byType, y.origin.type);
  const c = coverage[y.id];
  count(byStages, c.count);
  if (c.count === 0) none.push(y.id);
  count(byJourney, y.journey === 'default' ? 'default' : y.journey.length ? 'explicit' : '[]');
  if (y.story.early) withEarly.early++;
  if (y.story.turn) withEarly.turn++;
  if (y.id.includes('-')) composite.push(y.id);
}
const total = coll.units.reduce((a, u) => a + u.signs.length, 0);
const sort = (m) => Object.fromEntries([...m.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1)));
console.log(JSON.stringify({
  collection: { units: coll.units.length, signs: total, film: total - n }, new: n,
  byType: sort(byType), byStages: sort(byStages), byJourney: sort(byJourney), withEarly,
  composite, noAncientForms: none.join(' '),
}, null, 1));
