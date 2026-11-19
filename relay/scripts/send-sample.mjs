// Send one report file to a relay and print the answer.
// Usage: node scripts/send-sample.mjs <relay base URL> [file]   (default file: samples/valid.md)
// Example: node scripts/send-sample.mjs http://127.0.0.1:8787 samples/refused-privacy.md

import { readFileSync } from 'node:fs';

const [base, file = new URL('../samples/valid.md', import.meta.url)] = process.argv.slice(2);
if (!base) {
  console.error('Usage: node scripts/send-sample.mjs <relay base URL> [file]');
  process.exit(2);
}
const res = await fetch(new URL('/reports', base), {
  method: 'POST',
  headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  body: readFileSync(file),
});
const text = await res.text();
console.log(`HTTP ${res.status}${res.headers.get('retry-after') ? ` (Retry-After: ${res.headers.get('retry-after')} s)` : ''}`);
console.log(text);
try {
  const json = JSON.parse(text);
  if (json.issue_url) console.log(`Issue: ${json.issue_url}${json.duplicate ? ' (duplicate)' : ''}`);
} catch {
  // not JSON: printed above
}
// exitCode, not process.exit(): exit directly after fetch crashes Node on Windows (libuv assertion).
process.exitCode = res.ok ? 0 : 1;
