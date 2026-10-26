import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFrames, FRAME_HEADER, isLfsPointer, packSections, SILENT_FRAME } from '../../tools/audio/pack.ts';

const frames = (n: number, fill: number) => {
  const b = new Uint8Array(144 * n).fill(fill);
  for (let i = 0; i < n; i++) b.set(FRAME_HEADER, i * 144);
  return b;
};

test('the silent frame is the edge-tts header followed by zeros', () => {
  assert.equal(SILENT_FRAME.length, 144);
  assert.deepEqual([...SILENT_FRAME.subarray(0, 4)], [0xff, 0xf3, 0x64, 0xc4]);
  assert.ok(SILENT_FRAME.subarray(4).every((x) => x === 0));
});

test('sections hold their clips back to back with 240 ms of silence after each', () => {
  const clips: Record<string, Uint8Array> = { a: frames(2, 1), b: frames(3, 2), p: frames(1, 3) };
  const packed = packSections([{ id: 'en', keys: ['p', 'a'] }, { id: 'zh', keys: ['p', 'b'] }, { id: 'xx', keys: [] }], (k) => clips[k], 10);
  assert.deepEqual(packed.sections, { en: [0, (1 + 10 + 2 + 10) * 144], zh: [23 * 144, (1 + 10 + 3 + 10) * 144] });
  assert.deepEqual(packed.clips, { p: { en: [0, 24], zh: [0, 24] }, a: { en: [264, 48] }, b: { zh: [264, 72] } });
  assert.equal(packed.bytes.length, (23 + 24) * 144);
  for (let i = 0; i < packed.bytes.length; i += 144) assert.deepEqual([...packed.bytes.subarray(i, i + 4)], [...FRAME_HEADER], `frame at ${i}`);
  assert.deepEqual(packed.bytes.subarray(144, 288), SILENT_FRAME);
  assert.equal(packed.bytes[23 * 144 + 4], 3); // zh section starts with the pronunciation clip
});

test('non-edge-tts audio and Git LFS pointers are rejected', () => {
  assert.throws(() => checkFrames(new Uint8Array(100), 'x'), /not a whole number of 144-byte frames/);
  assert.throws(() => checkFrames(new Uint8Array(144), 'x'), /frame 0 is not MPEG-2 Layer III/);
  const pointer = new TextEncoder().encode('version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 12\n');
  assert.ok(isLfsPointer(pointer));
  assert.throws(() => checkFrames(pointer, 'media/clips/k.mp3'), /media\/clips\/k\.mp3 is a Git LFS pointer, not audio \(run git lfs pull\)/);
});
