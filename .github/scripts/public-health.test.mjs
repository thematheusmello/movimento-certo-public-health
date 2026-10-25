import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkPublicSite, homeProblem, statsProblem, RELEASE_ASSETS } from './public-health.mjs';

const now = Date.parse('2026-10-23T20:00:00Z');
const stats = { ok: true, founders: 0, waitlist: 0, updated_at: new Date(now).toISOString() };
const home = readFileSync(new URL('../../waitlist-site/index.html', import.meta.url), 'utf8');
const assets = new Map(RELEASE_ASSETS.map(([name, url, hash]) => {
  const path = name === 'home' ? 'index.html' : new URL(url).pathname.slice(1);
  const body = readFileSync(new URL(`../../waitlist-site/${path}`, import.meta.url), 'utf8');
  assert.equal(createHash('sha256').update(body).digest('hex'), hash, `reviewed ${name} artifact`);
  return [url, body];
}));
const healthyResponse = url => url.endsWith('/api/stats')
  ? Response.json({ ...stats, updated_at: new Date().toISOString() }) : new Response(assets.get(url));

test('zero counts are healthy but HTTP-200 provider failures are not', () => {
  assert.equal(statsProblem(stats, now), null);
  for (const flag of ['founders_error', 'waitlist_error']) {
    assert.equal(statsProblem({ ...stats, [flag]: true }, now), 'stats_provider');
    assert.equal(statsProblem({ ...stats, [flag]: 'false' }, now), 'stats_provider');
    assert.equal(statsProblem({ ...stats, [flag]: false }, now), null);
  }
});

test('invalid counts, missing evidence and stale/future responses fail closed', () => {
  for (const data of [null, [], { ...stats, ok: false }, { ...stats, founders: -1 }, { ...stats, waitlist: 0.5 }]) {
    assert.equal(statsProblem(data, now), 'stats_shape');
  }
  for (const updated_at of [undefined, 'invalid', new Date(now - 600_001).toISOString(), new Date(now + 120_001).toISOString()]) {
    assert.equal(statsProblem({ ...stats, updated_at }, now), 'stats_stale');
  }
  assert.equal(statsProblem({ ...stats, updated_at: new Date(now - 600_000).toISOString() }, now), null);
});

test('the current presale copy is checked instead of any HTTP-200 page', () => {
  assert.equal(homeProblem(home), null);
  for (const value of ['', '<html>Sign in</html>', home.replace('29 de novembro', '8 de novembro'), home + ' elabora a sequência']) {
    assert.equal(homeProblem(value), 'home_copy');
  }
});

test('only the fixed public release assets and aggregate endpoint are requested', async () => {
  const requests = [];
  const checks = await checkPublicSite(async (url, options) => {
    requests.push({ url, options });
    return healthyResponse(url);
  });
  assert.deepEqual(checks, [...RELEASE_ASSETS.map(([check]) => ({ check, ok: true })), { check: 'stats', ok: true }]);
  assert.deepEqual(requests.map(r => r.url), [...assets.keys(), 'https://movimentocerto.app/api/stats']);
  assert.ok(requests.every(r => r.options.redirect === 'error' && !r.options.method && r.options.signal));
});

test('configured deadline regression is caught even while all HTML fallbacks stay correct', async () => {
  assert.ok(home.includes('data-cfg="founderDeadline"'));
  const configUrl = RELEASE_ASSETS.find(([name]) => name === 'config')[1];
  const wrong = assets.get(configUrl).replace("founderDeadline: '29 de novembro'", "founderDeadline: '8 de novembro'");
  assert.notEqual(wrong, assets.get(configUrl));
  const checks = await checkPublicSite(async url => url === configUrl ? new Response(wrong) : healthyResponse(url));
  assert.deepEqual(checks.find(r => r.check === 'config'), { check: 'config', ok: false, reason: 'config_source' });
  assert.ok(checks.filter(r => r.check !== 'config').every(r => r.ok));
});

test('one wrong HTML fallback, changed runtime or CSS cannot hide behind other correct strings', async () => {
  for (const [name, url] of RELEASE_ASSETS.filter(([name]) => name !== 'config')) {
    const changed = name === 'home' ? assets.get(url).replace('29 de novembro', '8 de novembro') : assets.get(url) + '\n/* unreviewed */';
    const checks = await checkPublicSite(async candidate => candidate === url ? new Response(changed) : healthyResponse(candidate));
    assert.equal(checks.find(r => r.check === name).reason, `${name}_source`);
  }
});

test('HTTP errors, invalid JSON and request failures expose only static reasons', async () => {
  const denied = await checkPublicSite(async () => new Response('private_fixture', { status: 503 }));
  assert.ok(denied.every(r => !r.ok && r.reason === 'http_status'));
  const invalid = await checkPublicSite(async url => url.endsWith('/api/stats') ? new Response('private_fixture') : healthyResponse(url));
  assert.equal(invalid.find(r => r.check === 'stats').reason, 'stats_json');
  const failed = await checkPublicSite(async () => { throw new Error('private_fixture'); });
  assert.ok(failed.every(r => !r.ok && r.reason === 'request_failed'));
  assert.equal(JSON.stringify([denied, invalid, failed]).includes('private_fixture'), false);
});
