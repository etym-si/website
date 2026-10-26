import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CollectionBundle, SignBundle, StoryBundle } from '../../shared/bundle-types.ts';
import { checkCollectionBundle, checkSignBundle, checkStoryBundle } from '../../shared/bundle-check.ts';
import {
  decodeCollectionBundle,
  decodeSignBundle,
  decodeStoryBundle,
  encodeCollectionBundle,
  encodeSignBundle,
  encodeStoryBundle,
} from '../../shared/bundle-proto.ts';
import { ProtoReader, ProtoWriter, WIRE_LEN, WIRE_VARINT } from '../../shared/proto-wire.ts';
import { CONTENT_DIR } from '../../tools/paths.ts';

test('content/_schema/bundle.proto defines the proto3 schema for SignBundle, StoryBundle and CollectionBundle', () => {
  const protoFile = path.join(CONTENT_DIR, '_schema', 'bundle.proto');
  assert.ok(existsSync(protoFile), 'content/_schema/bundle.proto exists');
  const src = readFileSync(protoFile, 'utf8');
  assert.match(src, /syntax\s*=\s*"proto3";/);
  for (const msg of ['message SignBundle', 'message StoryBundle', 'message CollectionBundle', 'message StepProto']) {
    assert.ok(src.includes(msg), `bundle.proto includes ${msg}`);
  }
});

test('proto-wire encodes and decodes varints, sint32, float64, strings, bytes and skips unknown fields', () => {
  const w = new ProtoWriter();
  w.uint32(1, 300);
  w.sint32(2, -150);
  w.double(3, 0.32);
  w.string(4, '门 — gate');
  w.bytes(5, new Uint8Array([1, 2, 3, 255]));
  // field 99 (unknown to consumer) should be skipped cleanly
  w.string(99, 'skip-me');
  w.bool(6, true);

  const bytes = w.finish();
  const r = new ProtoReader(bytes);
  let f1 = 0;
  let f2 = 0;
  let f3 = 0;
  let f4 = '';
  let f5 = new Uint8Array(0);
  let f6 = false;
  while (r.next()) {
    switch (r.field) {
      case 1:
        assert.equal(r.wire, WIRE_VARINT);
        f1 = r.uint32();
        break;
      case 2:
        f2 = r.sint32();
        break;
      case 3:
        f3 = r.double();
        break;
      case 4:
        assert.equal(r.wire, WIRE_LEN);
        f4 = r.string();
        break;
      case 5:
        f5 = r.bytes();
        break;
      case 6:
        f6 = r.bool();
        break;
      default:
        r.skip();
    }
  }
  assert.equal(f1, 300);
  assert.equal(f2, -150);
  assert.equal(f3, 0.32);
  assert.equal(f4, '门 — gate');
  assert.deepEqual([...f5], [1, 2, 3, 255]);
  assert.equal(f6, true);
});

test('SignBundle, StoryBundle and CollectionBundle round-trip losslessly through Protobuf and pass bundle-check', () => {
  const sign: SignBundle = {
    v: 1,
    key: 'han/门',
    system: 'han',
    id: '门',
    status: 'reviewed',
    text: { Hans: '门', Hant: '門' },
    readings: { pinyin: 'mén' },
    reading: 'mén',
    meaning: { en: 'gate', 'zh-Hans': '大门', 'zh-Hant': '大門' },
    fact: { en: 'Gate with two doors.', 'zh-Hans': '两扇门。', 'zh-Hant': '兩扇門。' },
    topic: { en: 'Double Gate', 'zh-Hans': '木大门', 'zh-Hant': '木大門' },
    origin: {
      type: 'pictograph',
      parts: [{ char: '門', role: 'pictograph', gloss: { en: 'two leaves', 'zh-Hans': '两扇', 'zh-Hant': '兩扇' } }],
    },
    sources: [{ title: 'Shuowen', url: 'https://commons.wikimedia.org/wiki/File:Test.svg' }],
    ext: { hsk: 1, joyo: true, tag: 'core' },
    picture: {
      rotate: 0,
      ambient: 'sway',
      tree: [
        [
          'g',
          { class: 'pic' },
          [
            ['g', { 'data-part': 'leaf-l' }, [['rect', { x: '58', y: '58', width: '90', height: '192' }, []]]],
            ['g', { 'data-part': 'leaf-r' }, [['rect', { x: '152', y: '58', width: '90', height: '192' }, []]]],
          ],
        ],
      ],
    },
    forms: [
      {
        stage: 'bronze',
        form: '門',
        variant: 'bronze',
        box: [0, 0, 300, 300],
        paths: [{ d: 'M 10,10 L 90,90 Z', t: 'translate(1,2)', mode: 'stroke', w: 4.5, rule: 'evenodd' }],
      },
    ],
    strokes: {
      門: { strokes: ['M 0 0 L 10 10 Z'], medians: [[[0, 0], [10, 10]]] },
    },
    stages: ['picture', 'bronze', 'regular'],
    cards: {
      bronze: [
        {
          kind: 'exact',
          img: {
            file: 'data/photos/hu-ding-rubbing.1234567890.jpg',
            w: 800,
            h: 600,
            title: 'Hu ding',
            license: 'CC0',
            author: 'Museum',
            page: 'https://commons.wikimedia.org/wiki/File:Hu.jpg',
          },
          img2: {
            file: 'data/photos/dayu-ding.1234567890.jpg',
            w: 400,
            h: 300,
            title: 'Vessel',
            license: 'CC-BY',
            author: 'Photo',
            page: 'https://commons.wikimedia.org/wiki/File:Vessel.jpg',
          },
          marks: [{ x: 10, y: 20, w: 30, h: 40, label: { en: 'gate', 'zh-Hans': '门', 'zh-Hant': '門' } }],
          form: { stage: 'bronze', index: 0 },
          title: { en: 'Rubbing', 'zh-Hans': '拓片', 'zh-Hant': '拓片' },
          text: { en: 'See {shown}', 'zh-Hans': '看{shown}', 'zh-Hant': '看{shown}' },
          source: '曶鼎',
        },
        null,
      ],
    },
    scripts: {
      full: [
        { do: 'place', actor: 'hero', at: [500, 320], size: 340, back: true },
        { do: 'stage', stage: 'picture', variant: 'bronze' },
        { do: 'caption', text: { en: 'Hello', 'zh-Hans': '你好', 'zh-Hant': '你好' } },
        { do: 'caption', text: null },
        { do: 'picture', actor: 'hero', pic: 'han/门', ms: 700 },
        {
          do: 'together',
          steps: [
            { do: 'pose', actor: 'hero', part: 'leaf-l', origin: 'left', scaleX: 0.32, dy: -6, ms: 900 },
            { do: 'pose', actor: 'hero', part: 'leaf-r', origin: 'right', scaleX: 0.32, dy: -6, ms: 900 },
          ],
        },
        { do: 'rotate', actor: 'hero', deg: -90, target: 'picture', ms: 800 },
        { do: 'draw', actor: 'hero', glyph: { sign: 'han/门', stage: 'bronze', index: 0 }, ms: 1600, color: '#6b4a1e' },
        { do: 'show', actor: 'hero', glyph: { sign: 'han/门', stage: 'bronze' }, color: '#112233' },
        { do: 'swap', actor: 'hero', glyph: { sign: 'han/门', stage: 'regular' }, ms: 1500, color: '#223344' },
        { do: 'clearPicture', actor: 'hero', ms: 600 },
        { do: 'wash', actor: 'hero', color: '#ffd966', size: 200, w: 180, h: 160, opacity: 0.55, ms: 900, dx: -10, dy: 15 },
        { do: 'move', actor: 'hero', to: [600, 400], ms: 1200, gait: 'hop', ease: 'ease-in-out' },
        { do: 'ambient', actor: 'hero', motion: 'sway' },
        { do: 'fade', actor: 'hero', to: 0.5, ms: 400 },
        { do: 'scale', actor: 'hero', to: 1.2, ms: 500 },
        { do: 'remove', actor: 'hero', ms: 300 },
        { do: 'bg', tone: 'night', ms: 1200 },
        { do: 'tag', actor: 'hero', sign: 'han/门', hold: 2600, dx: 100, dy: -50 },
        {
          do: 'say',
          text: { en: 'Gate', 'zh-Hans': '门', 'zh-Hant': '門' },
          lang: 'ui',
          wait: true,
          silent: false,
          clip: { en: 'a'.repeat(64), 'zh-Hans': 'b'.repeat(64) },
        },
        { do: 'say', text: '门', lang: 'zh', wait: false, clip: { 'zh-Hans': 'c'.repeat(64) } },
        { do: 'wait', ms: 1000 },
      ],
      compact: [{ do: 'place', actor: 'hero', at: [500, 320], size: 340 }],
    },
    clip: 'c'.repeat(64),
    audio: {
      mp3: 'data/packs/pack-00.1234567890.pack.gz',
      sections: { en: [0, 1440], zh: [1440, 2880] },
      clips: { ['a'.repeat(64)]: { en: [0, 720], zh: [240, 960] } },
    },
  };

  const signBytes1 = encodeSignBundle(sign);
  const signBytes2 = encodeSignBundle(sign);
  assert.deepEqual(signBytes1, signBytes2, 'deterministic Protobuf encoding');
  assert.ok(signBytes1.length < JSON.stringify(sign).length, 'Protobuf wire bytes are smaller than JSON');
  const decodedSign = checkSignBundle(decodeSignBundle(signBytes1));
  assert.deepEqual(decodedSign, sign);

  const story: StoryBundle = {
    v: 1,
    collection: 'film-36',
    id: 'home-under-the-crescent-moon',
    unit: 6,
    title: { en: 'Home', 'zh-Hans': '回家', 'zh-Hant': '回家' },
    topic: { en: 'Evening', 'zh-Hans': '夜晚', 'zh-Hant': '夜晚' },
    script: sign.scripts.full,
    glyphs: {
      'han/门:bronze#0': { kind: 'paths', form: sign.forms[0] },
      'han/门:regular#0': { kind: 'strokes', strokes: sign.strokes['門'] },
    },
    labels: { 'han/门': { text: { Hans: '门', Hant: '門' }, reading: 'mén' } },
    pictures: { 'han/门': sign.picture! },
    audio: sign.audio,
  };

  const storyBytes = encodeStoryBundle(story);
  const decodedStory = checkStoryBundle(decodeStoryBundle(storyBytes));
  assert.deepEqual(decodedStory, story);

  const collection: CollectionBundle = {
    v: 1,
    id: 'film-36',
    system: 'han',
    title: { en: '36 Characters', 'zh-Hans': '36字', 'zh-Hant': '36字' },
    featured: ['han/门'],
    units: [{ n: 1, title: { en: 'Unit 1', 'zh-Hans': '第一单元', 'zh-Hant': '第一單元' }, color: '#2fb67c', playable: true, signs: ['han/门'], story: 'home-under-the-crescent-moon' }],
    lessons: [{ id: 'film-36/u1-l1', unit: 1, kind: 'learn', signs: ['han/门'] }],
    signs: {
      'han/门': {
        key: 'han/门',
        id: '门',
        text: { Hans: '门', Hant: '門' },
        reading: 'mén',
        meaning: sign.meaning,
        file: 'data/packs/pack-00.1234567890.pack.gz',
        range: [1440, 3200],
        clip: 'c'.repeat(64),
      },
    },
    stories: [
      {
        id: 'home-under-the-crescent-moon',
        unit: 6,
        title: story.title,
        topic: story.topic,
        file: 'data/packs/pack-05.abcdef0123.pack.gz',
        range: [0, 4100],
      },
    ],
    audio: sign.audio,
  };

  const collBytes = encodeCollectionBundle(collection);
  const decodedColl = checkCollectionBundle(decodeCollectionBundle(collBytes));
  assert.deepEqual(decodedColl, collection);
});
