import { readFileSync } from 'node:fs';

export const sample = (name) => readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf8');

// The parsed JSON of the valid sample, as a fresh object each call.
export function validData() {
  const text = sample('valid.md');
  return JSON.parse(text.slice(text.lastIndexOf('```json\n') + 8, text.lastIndexOf('```')));
}

// A report file with the given Markdown part and data, in the layout of section 4.2.
export function reportFile(data, markdown = '# Certify report\n\nA test file.\n') {
  return `${markdown}\n## Data\n\n\`\`\`json\n${JSON.stringify(data, null, 1)}\n\`\`\`\n`;
}

export function fakeKV() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value, opts) {
      if (!opts || opts.expirationTtl < 60) throw new Error('expirationTtl must be at least 60');
      map.set(key, value);
    },
  };
}

export function makeEnv(extra = {}) {
  return {
    RELAY_ENABLED: 'true',
    TEST_MODE: 'false',
    GITHUB_REPO: 'domisjustanumber/skellycertify',
    GITHUB_API_URL: 'https://fake.github.test',
    GITHUB_TOKEN: 'test-token',
    RATE_SALT: 'test-salt',
    RATE_KV: fakeKV(),
    ...extra,
  };
}

export function post(body, { type = 'text/markdown; charset=utf-8', ip = '192.0.2.10', headers = {} } = {}) {
  return new Request('https://relay.test/reports', {
    method: 'POST',
    headers: { 'content-type': type, 'cf-connecting-ip': ip, ...headers },
    body,
  });
}
