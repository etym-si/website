import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEMOS, TMP_DIR } from '../../tools/paths.ts';
import { clipKey } from '../../tools/audio/clip-key.ts';
import { clipPath, readMediaManifest } from '../../tools/audio/media.ts';
import { SILENT_FRAME } from '../../tools/audio/pack.ts';
import { Diags } from '../../tools/content/diagnostics.ts';
import { recordClips, ttsJobs } from '../../tools/tts.ts';
import { EGYPT_FIXTURE, loadFixture } from '../helpers/fixture.ts';

const scratchMedia = (): string => {
  mkdirSync(TMP_DIR, { recursive: true });
  const dir = mkdtempSync(path.join(TMP_DIR, 'media-'));
  mkdirSync(path.join(dir, 'clips'));
  return dir;
};

test('the job list holds exactly the clips media/ lacks, keyed by what is spoken', () => {
  const { content } = loadFixture(EGYPT_FIXTURE);
  const media = scratchMedia();
  const jobs = ttsJobs(content!, media, new Diags());
  assert.ok(jobs.length >= 2, `${jobs.length} jobs`);
  for (const j of jobs) assert.equal(j.key, clipKey(j.provider, j.voice, j.rate, j.text));
  assert.deepEqual(new Set(jobs.map((j) => j.voice)), new Set(['en-US-AvaMultilingualNeural', 'zh-CN-XiaoxiaoNeural']));
  const [first, ...rest] = jobs;
  writeFileSync(clipPath(media, first.key), Buffer.concat([SILENT_FRAME, SILENT_FRAME]));
  assert.deepEqual(recordClips(media, [first]), { added: [first.key], failed: [] });
  assert.deepEqual(readMediaManifest(media).clips[first.key], { provider: first.provider, voice: first.voice, rate: first.rate, text: first.text, bytes: 288, ms: 48 });
  assert.deepEqual(ttsJobs(content!, media, new Diags()).map((j) => j.key), rest.map((j) => j.key));
});

test('clips that are not edge-tts frames are rejected and deleted', () => {
  const media = scratchMedia();
  const job = { key: 'a'.repeat(64), provider: 'edge-tts', voice: 'zh-CN-XiaoxiaoNeural', rate: '-6%', text: '马' };
  writeFileSync(clipPath(media, job.key), 'ID3 is not a frame');
  assert.deepEqual(recordClips(media, [job, { ...job, key: 'b'.repeat(64) }]), { added: [], failed: [job.key, 'b'.repeat(64)] });
  assert.equal(existsSync(clipPath(media, job.key)), false);
  assert.deepEqual(readMediaManifest(media).clips, {});
});

test('Node and Python compute the same clip key', () => {
  const cases: [string, string, string, string][] = [
    ['edge-tts', 'zh-CN-XiaoxiaoNeural', '-15%', '马'],
    ['edge-tts', 'en-US-AvaMultilingualNeural', '-4%', '石 shows a rock () at the foot of a cliff ().'],
  ];
  for (const c of cases) {
    const py = execFileSync('python3', [path.join(DEMOS, 'scripts', 'tts.py'), '--key', ...c], { encoding: 'utf8' }).trim();
    assert.equal(py, clipKey(...c));
  }
  assert.equal(clipKey(...cases[0]), '9b9a9ac5ec51443b0b49b67b12fb3818d785fcdfcf61139c914a9232406f22ca');
});

test('tts.py refuses a job whose key does not match its text, before synthesizing anything', () => {
  const dir = scratchMedia();
  const jobs = path.join(dir, 'jobs.json');
  writeFileSync(jobs, JSON.stringify({ clipsDir: path.join(dir, 'clips'), jobs: [{ key: 'f'.repeat(64), provider: 'edge-tts', voice: 'zh-CN-XiaoxiaoNeural', rate: '-6%', text: '马' }] }));
  const r = spawnSync('python3', [path.join(DEMOS, 'scripts', 'tts.py'), jobs, path.join(dir, 'results.json')], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /job key does not match its text/);
});

test('the Commons adapters pass their offline self-tests', () => {
  for (const script of ['commons_glyphs.py', 'commons_photos.py']) {
    assert.match(execFileSync('python3', [path.join(DEMOS, 'scripts', script), '--selftest'], { encoding: 'utf8' }), /selftest: ok/);
  }
});
