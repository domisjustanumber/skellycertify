// Rate limits in Workers KV: 5 reports per sender per hour, 200 reports per day for all senders.
// The key holds a salted SHA-256 of the sender address, never the address.
// Fixed windows (the clock hour, the UTC day). KV is eventually consistent (up to 60 s or more
// between locations) and has no atomic increment, so a burst can pass a few more reports than
// the limit. That is acceptable for this relay.

export const PER_SENDER_PER_HOUR = 5;
export const PER_DAY = 200;

export async function senderKey(address, salt) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}\n${address}`));
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function windows(nowMs, sender) {
  const hour = Math.floor(nowMs / 3_600_000);
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return {
    hourKey: `h:${hour}:${sender}`,
    dayKey: `d:${day}`,
    hourLeft: Math.ceil(((hour + 1) * 3_600_000 - nowMs) / 1000),
    dayLeft: Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86_400_000 - nowMs) / 1000),
  };
}

const count = async (kv, key) => Number(await kv.get(key)) || 0;

// Return null when the request may go on, else { code, status, retryAfter }.
export async function checkLimits(kv, sender, nowMs) {
  const w = windows(nowMs, sender);
  const [mine, all] = await Promise.all([count(kv, w.hourKey), count(kv, w.dayKey)]);
  if (all >= PER_DAY) return { code: 'daily-cap', status: 503, retryAfter: w.dayLeft };
  if (mine >= PER_SENDER_PER_HOUR) return { code: 'rate-limited', status: 429, retryAfter: w.hourLeft };
  return null;
}

// Count one created report. A KV failure (for example its limit of one write per second to one
// key) loses one count. It does not fail the request: the report is already filed.
export async function recordReport(kv, sender, nowMs) {
  const w = windows(nowMs, sender);
  const put = async (key, ttl) => {
    try {
      await kv.put(key, String((await count(kv, key)) + 1), { expirationTtl: ttl });
    } catch {
      // shortcut: lost count on a KV write limit; use a Durable Object if exact counts matter.
    }
  };
  await Promise.all([put(w.hourKey, w.hourLeft + 60), put(w.dayKey, w.dayLeft + 3600)]);
}
