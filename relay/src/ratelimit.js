// Limits with no Cloudflare storage product.
// 1. Per sender: the Rate Limiting binding SENDER_LIMIT, keyed by a salted SHA-256 of the sender
//    network (never the address): the full IPv4 address, or the /64 network of an IPv6 address.
//    2 POSTs per 60 s.
// 2. Burst: the binding BURST_LIMIT with the fixed key "all". 10 POSTs per 60 s. Only a POST that
//    passed the per-sender limit counts here, so one sender cannot use up the limit of all.
//    Both bindings count per Cloudflare location and are approximate (Cloudflare documentation).
// 3. Daily cap: GitHub itself is the counter. Before each write, the relay counts its commits on
//    the branch inbox today (UTC): 2 * PER_DAY commits, 2 for each report. No counter is stored. See handler.js.

export const SENDER_LIMIT = { limit: 2, period: 60 }; // must equal wrangler.jsonc
export const BURST_LIMIT = { limit: 10, period: 60 }; // must equal wrangler.jsonc
export const PER_DAY = 200;

// The network of a sender: an IPv4 address as it is, or the first 4 groups of an IPv6 address
// after full expansion. An IPv4-mapped IPv6 address gives its IPv4 address.
export function senderNetwork(address) {
  let a = String(address).toLowerCase();
  if (!a.includes(':')) return a;
  // A dotted IPv4 tail becomes two groups.
  a = a.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, p, q, r, s) => `${((p << 8) | q).toString(16)}:${((r << 8) | s).toString(16)}`);
  const [head, tail] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  const g = groups.map((x) => (Number.parseInt(x, 16) || 0).toString(16));
  if (g.length === 8 && g.slice(0, 5).every((x) => x === '0') && g[5] === 'ffff') {
    const n = [g[6], g[7]].map((x) => Number.parseInt(x, 16));
    return [n[0] >> 8, n[0] & 255, n[1] >> 8, n[1] & 255].join('.');
  }
  return `${g.slice(0, 4).join(':')}::/64`;
}

export async function senderKey(address, salt) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}\n${senderNetwork(address)}`));
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Return null when the request may go on, else { code, status, retryAfter }.
export async function checkBurst(env, sender) {
  if (!(await env.SENDER_LIMIT.limit({ key: sender })).success) {
    return { code: 'rate-limited', status: 429, retryAfter: SENDER_LIMIT.period };
  }
  if (!(await env.BURST_LIMIT.limit({ key: 'all' })).success) {
    return { code: 'busy', status: 429, retryAfter: BURST_LIMIT.period };
  }
  return null;
}

// Seconds until 00:00 UTC of the next day.
export function secondsToMidnight(nowMs) {
  return Math.ceil((Math.floor(nowMs / 86_400_000) + 1) * 86_400_000 / 1000 - nowMs / 1000);
}
