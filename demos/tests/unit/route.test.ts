import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../../src/route.ts';

const d = { system: 'han', collection: 'film-36' };

test('namespaced routes', () => {
  assert.deepEqual(parseRoute('#/theater/han/%E9%A9%AC', d), { name: 'theater', sign: 'han/马' });
  assert.deepEqual(parseRoute('#/theater/egyptian/G17', d), { name: 'theater', sign: 'egyptian/G17' });
  assert.deepEqual(parseRoute('#/story/film-36/casting-the-net', d), { name: 'story', collection: 'film-36', story: 'casting-the-net', index: 1 });
  assert.deepEqual(parseRoute('#/lesson/film-36/u1-l1', d), { name: 'lesson', collection: 'film-36', lesson: 'u1-l1' });
  assert.deepEqual(parseRoute('#/learn/first-500', d), { name: 'learn', collection: 'first-500' });
  assert.deepEqual(parseRoute('#/book', d), { name: 'book', collection: 'film-36' });
});

test('legacy links keep working', () => {
  assert.deepEqual(parseRoute('#/theater/%E9%A9%AC', d), { name: 'theater', sign: 'han/马' });
  assert.deepEqual(parseRoute('#/story/3', d), { name: 'story', collection: 'film-36', story: null, index: 3 });
  assert.deepEqual(parseRoute('#/lesson/u1-l1', d), { name: 'lesson', collection: 'film-36', lesson: 'u1-l1' });
  assert.deepEqual(parseRoute('#/theater', d), { name: 'theater', sign: null });
  assert.deepEqual(parseRoute('#/story', d), { name: 'story', collection: 'film-36', story: null, index: 1 });
});

test('junk is rejected', () => {
  assert.deepEqual(parseRoute('#/lesson/..%2F..%2Fx', d), { name: 'lesson', collection: 'film-36', lesson: '' });
  assert.deepEqual(parseRoute('#/theater/%E0%A4', d), { name: 'theater', sign: null });
  assert.deepEqual(parseRoute('#/nope', d), { name: 'home' });
});
