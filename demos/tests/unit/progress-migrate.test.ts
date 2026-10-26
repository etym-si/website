import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshProgress, parseProgress } from '../../src/progress-migrate.ts';

const d = { system: 'han', collection: 'film-36' };

test('v1 progress is migrated: lesson ids gain the collection, stickers the system', () => {
  const v1 = JSON.stringify({ v: 1, xp: 45, streak: 2, lastDay: '2026-10-24', done: { 'u1-l1': 3, 'u1-l2': 2, bogus: 3, 'u1-l3': 9 }, stickers: ['日', '山', 7, 'x/y/z'] });
  assert.deepEqual(parseProgress(null, v1, d), {
    v: 2, xp: 45, streak: 2, lastDay: '2026-10-24',
    done: { 'film-36/u1-l1': 3, 'film-36/u1-l2': 2 },
    stickers: ['han/日', 'han/山'],
  });
});

test('v2 wins over v1 and passes through validated', () => {
  const v2 = JSON.stringify({ v: 2, xp: 10, streak: 1, lastDay: null, done: { 'film-36/u2-review': 1 }, stickers: ['han/后-後', 'egyptian/G17'] });
  assert.deepEqual(parseProgress(v2, JSON.stringify({ v: 1, xp: 99 }), d), { v: 2, xp: 10, streak: 1, lastDay: null, done: { 'film-36/u2-review': 1 }, stickers: ['han/后-後', 'egyptian/G17'] });
});

test('junk is ignored', () => {
  assert.deepEqual(parseProgress('{oops', 'null', d), freshProgress());
  assert.deepEqual(parseProgress(JSON.stringify({ v: 3 }), null, d), freshProgress());
  assert.equal(parseProgress(JSON.stringify({ v: 2, xp: -5, streak: 1.5 }), null, d).xp, 0);
});
