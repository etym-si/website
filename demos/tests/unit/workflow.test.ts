import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { REPO } from '../../tools/paths.ts';

interface Step { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; 'working-directory'?: string }
const text = readFileSync(path.join(REPO, '.github', 'workflows', 'deploy.yml'), 'utf8');
const wf = parse(text) as { on: Record<string, unknown>; permissions: unknown; jobs: { deploy: { steps: Step[] } } };

test('deploys on pushes to main and by hand, with read-only repository access', () => {
  assert.deepEqual(wf.on.push, { branches: ['main'] });
  assert.ok('workflow_dispatch' in wf.on);
  assert.deepEqual(wf.permissions, { contents: 'read' });
});

test('LFS objects come from the cache before git lfs pull; then test, build, e2e, deploy', () => {
  const steps = wf.jobs.deploy.steps;
  const at = (what: string, pred: (s: Step) => boolean): number => {
    const i = steps.findIndex(pred);
    assert.ok(i >= 0, `missing step: ${what}`);
    return i;
  };
  const checkout = at('checkout', (s) => !!s.uses?.startsWith('actions/checkout@'));
  assert.notEqual(steps[checkout].with?.lfs, true, 'checkout must not download LFS objects before the cache is restored');
  const order = [
    checkout,
    at('list LFS objects', (s) => !!s.run?.includes('git lfs ls-files --long')),
    at('LFS cache', (s) => !!s.uses?.startsWith('actions/cache@') && s.with?.path === '.git/lfs'),
    at('git lfs pull', (s) => s.run?.trim() === 'git lfs pull'),
    at('setup-node', (s) => !!s.uses?.startsWith('actions/setup-node@') && s.with?.['node-version-file'] === '.node-version'),
    at('npm ci', (s) => s.run === 'npm ci'),
    at('npm test', (s) => s.run === 'npm test'),
    at('npm run build', (s) => s.run === 'npm run build'),
    at('npm run test:e2e', (s) => s.run === 'npm run test:e2e'),
    at('wrangler', (s) => !!s.uses?.startsWith('cloudflare/wrangler-action@')),
  ];
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] < order[i], `step ${i} is out of order`);
  const deploy = steps[order[order.length - 1]].with!;
  assert.match(String(deploy.command), /^pages deploy dist --project-name=etym-si /);
  assert.equal(deploy.apiToken, '${{ secrets.CLOUDFLARE_API_TOKEN }}');
  assert.equal(deploy.accountId, '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
});

test('the two Cloudflare secrets are used only by the deploy step, and Node is pinned to 24', () => {
  assert.deepEqual(text.match(/secrets\.[A-Z_]+/g), ['secrets.CLOUDFLARE_API_TOKEN', 'secrets.CLOUDFLARE_ACCOUNT_ID']);
  assert.equal(readFileSync(path.join(REPO, '.node-version'), 'utf8'), '24\n');
});
