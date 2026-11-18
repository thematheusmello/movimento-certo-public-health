import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Reviewed thirty-day campaign calendar with previous-buyer guarantee preserved.
// Change fingerprints only with a reviewed release.
export const RELEASE_ASSETS = [
  ['home', 'https://movimentocerto.app/', 'a0c9458019d4f222dc775a91cfde14917dbf4a3ff28df44a048c38acc21632b9'],
  ['thanks', 'https://movimentocerto.app/obrigado', '82c895c30ac30a3b4c62a7358e75dc8b1f5d34f657c1bef69ad264ede0fcc23d'],
  ['config', 'https://movimentocerto.app/assets/config.js?v=15', '10cbd36d1cdd59a0497c3f936b590e1a2c9c2301626b65bbd7a74483f69fee23'],
  ['script', 'https://movimentocerto.app/assets/site.js?v=16', '2aff46a71c56837b0f7c24e387ddacd1389328aa3a7e964e270d66def61a72eb'],
  ['styles', 'https://movimentocerto.app/assets/site.css?v=12', '8adca47bf76c585e1eec56fb87a1073aba93193e2bb8e7eb58319265c455dd12'],
  ['analytics', 'https://movimentocerto.app/assets/analytics.js?v=2', '1bc528012e54a620a96010deac2d7aa6bad751d68620713e4781d5589f1f7c65'],
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
  return typeof html === 'string' && html.includes('Movimento Certo') && html.includes('12 de dezembro')
    && html.split('elabora a sequência').length === 2
    && createHash('sha256').update(html).digest('hex') === RELEASE_ASSETS[0][2] ? null : 'home_copy';
}

export async function checkPublicSite(fetcher = fetch, releaseAssets = RELEASE_ASSETS) {
  return Promise.all([
    ...releaseAssets,
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

export async function runPublicSiteCheck() {
  const checks = await checkPublicSite();
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checks }));
  if (checks.some(check => !check.ok)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runPublicSiteCheck();
