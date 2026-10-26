import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CollectionBundle, SignBundle, SvgNode } from '../../shared/bundle-types.ts';
import { checkCollectionBundle, checkSignBundle, checkStoryBundle } from '../../shared/bundle-check.ts';
import { readCollectionSlice, readSignSlice, readStorySlice } from '../../tools/compile/pack-shards.ts';
import { compileSite } from '../../tools/compile/site.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { MEDIA_DIR } from '../../tools/paths.ts';
import { realContent } from '../helpers/content.ts';

const site = compileSite(realContent(), { mediaDir: MEDIA_DIR, strict: true }, new Diags());
const coll = checkCollectionBundle(readCollectionSlice(site.files, site.catalog.collections[0])) as CollectionBundle;

test('every compiled bundle passes the runtime re-check', () => {
  for (const s of Object.values(coll.signs)) checkSignBundle(readSignSlice(site.files, s));
  for (const s of coll.stories) checkStoryBundle(readStorySlice(site.files, s));
});

test('tampered bundles are rejected before they reach the DOM', () => {
  const original = readSignSlice(site.files, coll.signs['han/马']) as SignBundle;
  const tamper = (f: (b: SignBundle) => void) => { const b = structuredClone(original); f(b); return () => checkSignBundle(b); };
  assert.throws(tamper((b) => (b.picture!.tree[0][2] as SvgNode[]).push(['script', {}, []])), /element <script> is not allowed/);
  assert.throws(tamper((b) => { b.forms[0].paths[0].d = 'M0 0 url(javascript:alert(1))'; }), /path data/);
  assert.throws(tamper((b) => { b.cards.oracle[0]!.img.file = '../../etc/passwd'; }), /file path/);
  assert.throws(tamper((b) => { b.audio!.mp3 = 'https://evil.example/x.mp3'; }), /file path/);
  assert.throws(tamper((b) => { (b as { v: number }).v = 2; }), /version/);
});
