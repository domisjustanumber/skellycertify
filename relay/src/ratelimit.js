// Limits with no Cloudflare storage product.
// 1. Per sender: the Rate Limiting binding SENDER_LIMIT, keyed by a salted SHA-256 of the sender
//    address (never the address). 2 POSTs per 60 s.
// 2. Burst: the binding BURST_LIMIT with the fixed key "all". 10 POSTs per 60 s.
//    Both bindings count per Cloudflare location and are approximate (Cloudflare documentation).
// 3. Daily cap: GitHub itself is the counter. Before a new report, the relay counts the issues with
//    the label certify-report that were created today (UTC). No counter is stored.

export const SENDER_LIMIT = { limit: 2, period: 60 }; // must equal wrangler.jsonc
export const BURST_LIMIT = { limit: 10, period: 60 }; // must equal wrangler.jsonc
export const PER_DAY = 200;

export async function senderKey(address, salt) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}\n${address}`));
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Return null when the request may go on, else { code, status, retryAfter }.
export async function checkBurst(env, sender) {
  const [mine, all] = await Promise.all([
    env.SENDER_LIMIT.limit({ key: sender }),
    env.BURST_LIMIT.limit({ key: 'all' }),
  ]);
  if (!mine.success) return { code: 'rate-limited', status: 429, retryAfter: SENDER_LIMIT.period };
  if (!all.success) return { code: 'busy', status: 429, retryAfter: BURST_LIMIT.period };
  return null;
}

// Seconds until 00:00 UTC of the next day.
export function secondsToMidnight(nowMs) {
  return Math.ceil((Math.floor(nowMs / 86_400_000) + 1) * 86_400_000 / 1000 - nowMs / 1000);
}
