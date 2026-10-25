import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Reviewed production release G4vqwPXF; update fingerprints only with a reviewed release.
export const RELEASE_ASSETS = [
  ['home', 'https://movimentocerto.app/', 'c08cff7963a4e370dc68e99e556cd8597bf421a407b99a8c7ae288c01988abfd'],
  ['config', 'https://movimentocerto.app/assets/config.js?v=12', 'c179fda924a58206f15c4096e9e01e90b603f720aed1d85fc4aeb4ef29e1e19d'],
  ['script', 'https://movimentocerto.app/assets/site.js?v=12', 'dfb4f7b4bf607c172ea5b39bfd4078aa39e6b22abe5ad5879306d8cc0d13eb0b'],
  ['styles', 'https://movimentocerto.app/assets/site.css?v=11', '31a2d4947a7de68ead285da81726ed9d90cb953421f955be405bfce0d72f9636'],
];

export function statsProblem(data, now = Date.now()) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.ok !== true
    || !['founders', 'waitlist'].every(key => Number.isSafeInteger(data[key]) && data[key] >= 0)) return 'stats_shape';
  if (data.founders_error !== undefined && data.founders_error !== false
    || data.waitlist_error !== undefined && data.waitlist_error !== false) return 'stats_provider';
  const updated = typeof data.updated_at === 'string' ? Date.parse(data.updated_at) : NaN;
  if (!Number.isFinite(updated) || now - updated > 10 * 60_000 || updated - now > 2 * 60_000) return 'stats_stale';
  return null;
}

export function homeProblem(html) {
  return typeof html === 'string' && html.includes('Movimento Certo') && html.includes('29 de novembro')
    && html.split('elabora a sequência').length === 2
    && createHash('sha256').update(html).digest('hex') === RELEASE_ASSETS[0][2] ? null : 'home_copy';
}

export async function checkPublicSite(fetcher = fetch) {
  return Promise.all([
    ...RELEASE_ASSETS,
    ['stats', 'https://movimentocerto.app/api/stats'],
  ].map(async ([check, url, expectedHash]) => {
    try {
      const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'Cache-Control': 'no-cache' } });
      if (response.status !== 200) return { check, ok: false, reason: 'http_status' };
      let reason;
      if (expectedHash) {
        const text = await response.text();
        reason = createHash('sha256').update(text).digest('hex') === expectedHash
          ? check === 'home' ? homeProblem(text) : null : `${check}_source`;
      }
      else {
        let data;
        try { data = await response.json(); } catch { return { check, ok: false, reason: 'stats_json' }; }
        reason = statsProblem(data);
      }
      return reason ? { check, ok: false, reason } : { check, ok: true };
    } catch {
      // Provider exceptions and response bodies can echo private diagnostic data.
      return { check, ok: false, reason: 'request_failed' };
    }
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checks = await checkPublicSite();
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checks }));
  if (checks.some(check => !check.ok)) process.exitCode = 1;
}
