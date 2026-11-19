import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, webcrypto } from 'node:crypto';
import { handle, MAX_BYTES } from '../src/handler.js';
import { createFakeGitHub } from '../scripts/fake-github.mjs';
import { BODY_LIMIT } from '../src/issue.js';
import { sample, validData, reportFile, makeEnv, post, fakeLimiter } from './helpers.js';

const VALID = sample('valid.md');
let logs;
const realLog = console.log;
beforeEach(() => { logs = []; console.log = (line) => logs.push(line); });
afterEach(() => { console.log = realLog; });

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function send(env, gh, request, now) {
  const res = await handle(request, env, { fetch: gh.fetch, now: now ?? Date.now });
  return { res, body: res.status === 204 ? null : await res.json() };
}

function assertError(r, status, error, retry) {
  assert.equal(r.res.status, status);
  assert.equal(r.body.error, error);
  assert.equal(r.body.retry, retry);
  assert.ok('detail' in r.body);
  assert.equal(r.res.headers.get('access-control-allow-origin'), '*');
}

test('a valid report: file on inbox, one issue, a sidecar, and the JSON answer', async () => {
  const env = makeEnv();
  const gh = createFakeGitHub({ token: 'test-token' });
  const hash = await sha256(VALID);
  const r = await send(env, gh, post(VALID));
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.body, {
    issue_url: 'https://github.com/domisjustanumber/skellycertify/issues/1', issue_number: 1,
    file_path: `inbox/2026/${hash}.md`, duplicate: false,
  });
  assert.ok(gh.state.refs.inbox, 'the inbox branch was made from the default branch');
  const stored = gh.state.files.get(`inbox:inbox/2026/${hash}.md`);
  assert.equal(Buffer.from(stored.content, 'base64').toString('utf8'), VALID, 'the exact bytes');
  assert.equal(Buffer.from(gh.state.files.get(`inbox:inbox/2026/${hash}.issue`).content, 'base64').toString(), '1\n');
  const issue = gh.state.issues[0];
  assert.deepEqual(issue.labels.map((l) => l.name), ['certify-report']);
  assert.ok(issue.body.includes(`/blob/${stored.commit}/inbox/2026/${hash}.md`), 'a permalink at the commit');
  assert.ok(issue.body.includes(`<!-- skellycertify-report sha256:${hash} -->`));
  assert.ok(!issue.body.includes('192.0.2.10'));
  for (const call of gh.state.calls) {
    assert.equal(call.headers['X-GitHub-Api-Version'], '2022-11-28');
    assert.equal(call.headers['User-Agent'], 'skellycertify-relay');
  }
});

test('the quick sample: two modules of one package with their ids make one issue', async () => {
  const gh = createFakeGitHub();
  const r = await send(makeEnv(), gh, post(sample('valid-quick.md')));
  assert.equal(r.res.status, 200);
  const { body } = gh.state.issues[0];
  assert.ok(body.length <= BODY_LIMIT);
  assert.match(body, /· id `3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90`: valid as evidence\./);
  assert.match(body, /· id `c1d2e3f4-5a6b-4c7d-8e9f-a0b1c2d3e4f5`: not valid as evidence: `check-failed`\./);
});

test('the log line holds only time, outcome, status, size and the hash prefix', async () => {
  const env = makeEnv();
  await send(env, createFakeGitHub(), post(VALID));
  assert.equal(logs.length, 1);
  const line = JSON.parse(logs[0]);
  assert.deepEqual(Object.keys(line).sort(), ['bytes', 'hash', 'outcome', 'status', 't']);
  assert.equal(line.outcome, 'created');
  assert.equal(line.hash.length, 12);
  assert.ok(!logs[0].includes('192.0.2.10') && !logs[0].includes('skellytracker'));
});

test('the same file again: duplicate, nothing new is made', async () => {
  const env = makeEnv();
  const gh = createFakeGitHub();
  await send(env, gh, post(VALID));
  const writes = gh.state.calls.filter((c) => c.method !== 'GET').length;
  const r = await send(env, gh, post(VALID));
  assert.equal(r.res.status, 200);
  assert.equal(r.body.duplicate, true);
  assert.equal(r.body.issue_number, 1);
  assert.equal(gh.state.issues.length, 1);
  assert.equal(gh.state.calls.filter((c) => c.method !== 'GET').length, writes, 'no write');
});

test('half-done: the file was committed but the issue failed; a retry makes the issue', async () => {
  const env = makeEnv();
  let failIssue = true;
  const gh = createFakeGitHub({ fault: (m, p) => (failIssue && m === 'POST' && p.endsWith('/issues') ? 502 : null) });
  const first = await send(env, gh, post(VALID));
  assertError(first, 503, 'github-unavailable', true);
  assert.equal(gh.state.issues.length, 0);
  failIssue = false;
  const r = await send(env, gh, post(VALID));
  assert.equal(r.res.status, 200);
  assert.equal(r.body.duplicate, true);
  assert.equal(gh.state.issues.length, 1);
  const hash = await sha256(VALID);
  assert.ok(gh.state.issues[0].body.includes(`/blob/${gh.state.files.get(`inbox:inbox/2026/${hash}.md`).commit}/`));
  assert.ok(gh.state.files.has(`inbox:inbox/2026/${hash}.issue`));
});

test('the issue exists but its sidecar write failed: a retry finds the issue by its marker', async () => {
  const env = makeEnv();
  let failSidecar = true;
  const gh = createFakeGitHub({ fault: (m, p) => (failSidecar && m === 'PUT' && p.endsWith('.issue') ? 500 : null) });
  const first = await send(env, gh, post(VALID));
  assert.equal(first.res.status, 200, 'the issue exists, so the answer is a success');
  failSidecar = false;
  const r = await send(env, gh, post(VALID));
  assert.equal(r.body.duplicate, true);
  assert.equal(r.body.issue_number, 1);
  assert.equal(gh.state.issues.length, 1);
  const hash = await sha256(VALID);
  assert.ok(gh.state.files.has(`inbox:inbox/2026/${hash}.issue`), 'the retry repairs the sidecar');
});

test('test mode: inbox/test/ and the relay-test label', async () => {
  const env = makeEnv({ TEST_MODE: 'true' });
  const gh = createFakeGitHub();
  const r = await send(env, gh, post(VALID));
  assert.match(r.body.file_path, /^inbox\/test\/[0-9a-f]{64}\.md$/);
  assert.deepEqual(gh.state.issues[0].labels.map((l) => l.name), ['certify-report', 'relay-test']);
  assert.match(gh.state.issues[0].body, /Test of the relay/);
});

test('refused reports: 422 with a fixed code, and nothing is written', async () => {
  const cases = [
    [sample('refused-privacy.md'), 'privacy-rule', 1],
    [sample('refused-format.md'), 'wrong-schema', 'report.schema'],
    ['# no data\n', 'no-json-block'],
    [VALID.replace('# Certify report', '# Certify\rreport'), 'lone-cr'],
  ];
  for (const [text, code, detail] of cases) {
    const env = makeEnv();
    const gh = createFakeGitHub();
    const r = await send(env, gh, post(text));
    assertError(r, 422, code, false);
    if (detail !== undefined) assert.equal(r.body.detail, detail);
    assert.equal(gh.state.calls.length, 0, `${code}: no GitHub call`);
    assert.ok(!JSON.stringify(r.body).includes('models'), 'no echo of report content');
  }
});

test('not UTF-8: 422 not-utf8', async () => {
  const bytes = new Uint8Array([...new TextEncoder().encode(VALID.slice(0, 20)), 0xff, 0xfe, ...new TextEncoder().encode(VALID.slice(20))]);
  assertError(await send(makeEnv(), createFakeGitHub(), post(bytes)), 422, 'not-utf8', false);
});

test('each privacy rule gives 422 with its number', async () => {
  const d = validData();
  d.modules[0].details.k = 'mail someone@example.org';
  const r = await send(makeEnv(), createFakeGitHub(), post(reportFile(d)));
  assertError(r, 422, 'privacy-rule', false);
  assert.equal(r.body.detail, 5);
});

test('413: too large by Content-Length, and while reading the body', async () => {
  const gh = createFakeGitHub();
  const big = 'x'.repeat(MAX_BYTES + 1);
  assertError(await send(makeEnv(), gh, post('small', { headers: { 'content-length': String(MAX_BYTES + 1) } })), 413, 'too-large', false);
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
  const req = new Request('https://relay.test/reports', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: stream, duplex: 'half' });
  assertError(await send(makeEnv(), gh, req), 413, 'too-large', false);
  assert.equal(gh.state.calls.length, 0);
});

test('415: wrong content type or charset; text/plain is accepted', async () => {
  const gh = createFakeGitHub();
  assertError(await send(makeEnv(), gh, post(VALID, { type: 'application/json' })), 415, 'wrong-type', false);
  assertError(await send(makeEnv(), gh, post(VALID, { type: 'text/plain; charset=latin1' })), 415, 'wrong-type', false);
  assert.equal((await send(makeEnv(), gh, post(VALID, { type: 'text/plain' }))).res.status, 200);
});

test('400: empty body', async () => {
  assertError(await send(makeEnv(), createFakeGitHub(), post('')), 400, 'empty-body', false);
});

test('429 rate-limited: 2 POSTs per sender per 60 s, with Retry-After; another sender is not blocked', async () => {
  const env = makeEnv({ SENDER_LIMIT: fakeLimiter(2) });
  const gh = createFakeGitHub();
  for (let i = 0; i < 2; i++) {
    const d = validData();
    d.note = `report ${i}`;
    assert.equal((await send(env, gh, post(reportFile(d)))).res.status, 200);
  }
  const r = await send(env, gh, post(VALID));
  assertError(r, 429, 'rate-limited', true);
  assert.equal(r.res.headers.get('retry-after'), '60');
  assert.equal((await send(env, gh, post(VALID, { ip: '198.51.100.7' }))).res.status, 200);
  for (const key of env.SENDER_LIMIT.counts.keys()) {
    assert.match(key, /^[0-9a-f]{32}$/, 'the key is a hash');
    assert.ok(!key.includes('192.0.2.10') && !key.includes('198.51.100.7'), 'the key holds no address');
  }
});

test('the limiter runs before the body is read: a refused or duplicate POST also counts', async () => {
  const env = makeEnv({ SENDER_LIMIT: fakeLimiter(1) });
  const gh = createFakeGitHub();
  assertError(await send(env, gh, post(sample('refused-format.md'))), 422, 'wrong-schema', false);
  assertError(await send(env, gh, post(VALID)), 429, 'rate-limited', true);
  assert.equal(gh.state.calls.length, 0);
});

test('429 busy: the burst limit with the key "all" covers all senders', async () => {
  const env = makeEnv({ BURST_LIMIT: fakeLimiter(1) });
  const gh = createFakeGitHub();
  assert.equal((await send(env, gh, post(VALID))).res.status, 200);
  const r = await send(env, gh, post(VALID, { ip: '198.51.100.7' }));
  assertError(r, 429, 'busy', true);
  assert.equal(r.res.headers.get('retry-after'), '60');
  assert.deepEqual([...env.BURST_LIMIT.counts.keys()], ['all']);
});

const today = (number, label = 'certify-report', created_at = '2026-11-19T01:00:00Z') =>
  ({ number, labels: [{ name: label }], created_at, body: '' });

test('503 daily-cap: 200 certify-report issues created today (UTC); GitHub is the counter', async () => {
  const now = () => Date.parse('2026-11-19T23:00:00Z');
  const gh = createFakeGitHub({ now });
  gh.state.issues.push(today(1, 'certify-report', '2026-11-18T12:00:00Z'));
  for (let i = 2; i <= 201; i++) gh.state.issues.push(today(i));
  const r = await send(makeEnv(), gh, post(VALID), now);
  assertError(r, 503, 'daily-cap', true);
  assert.equal(r.res.headers.get('retry-after'), '3600');
  assert.equal(gh.state.calls.filter((c) => c.path.endsWith('/issues') && c.method === 'GET').length, 2, 'two pages of 100');
  assert.equal(gh.state.calls.filter((c) => c.method !== 'GET').length, 0, 'nothing is written');
});

test('daily cap: 199 today passes; older issues and other labels do not count', async () => {
  const now = () => Date.parse('2026-11-19T10:00:00Z');
  const gh = createFakeGitHub({ now });
  for (let i = 1; i <= 50; i++) gh.state.issues.push(today(i, 'certify-report', '2026-11-18T10:00:00Z'));
  for (let i = 51; i <= 60; i++) gh.state.issues.push(today(i, 'question'));
  for (let i = 61; i <= 259; i++) gh.state.issues.push(today(i));
  assert.equal((await send(makeEnv(), gh, post(VALID), now)).res.status, 200);
});

test('a duplicate needs no daily-cap call, and is answered when the cap is reached', async () => {
  const env = makeEnv();
  const gh = createFakeGitHub();
  await send(env, gh, post(VALID));
  for (let i = 0; i < 200; i++) gh.state.issues.push(today(100 + i, 'certify-report', new Date().toISOString()));
  gh.state.calls.length = 0;
  const r = await send(env, gh, post(VALID));
  assert.equal(r.res.status, 200);
  assert.equal(r.body.duplicate, true);
  assert.ok(!gh.state.calls.some((c) => c.path.endsWith('/issues') && c.method === 'GET'), 'no count call');
});

test('CRLF is accepted: the relay stores LF bytes, and LF and CRLF copies have one hash', async () => {
  const env = makeEnv();
  const gh = createFakeGitHub();
  const crlf = await send(env, gh, post(VALID.replace(/\n/g, '\r\n')));
  assert.equal(crlf.res.status, 200);
  assert.equal(crlf.body.duplicate, false);
  const hash = await sha256(VALID);
  assert.equal(crlf.body.file_path, `inbox/2026/${hash}.md`, 'the hash of the LF bytes');
  assert.equal(Buffer.from(gh.state.files.get(`inbox:inbox/2026/${hash}.md`).content, 'base64').toString(), VALID);
  const lf = await send(env, gh, post(VALID));
  assert.equal(lf.body.duplicate, true);
  assert.equal(lf.body.issue_number, crlf.body.issue_number);
});

test('503 relay-off: the off switch answers at once', async () => {
  const gh = createFakeGitHub();
  assertError(await send(makeEnv({ RELAY_ENABLED: 'false' }), gh, post(VALID)), 503, 'relay-off', true);
  assertError(await send(makeEnv({ RELAY_ENABLED: undefined }), gh, post(VALID)), 503, 'relay-off', true);
  assert.equal(gh.state.calls.length, 0);
});

test('503 relay-misconfigured: no credential, a part of the App secrets, no salt, no limiter binding', async () => {
  for (const extra of [{ GITHUB_TOKEN: undefined }, { GITHUB_APP_ID: '1' }, { RATE_SALT: undefined }, { SENDER_LIMIT: undefined }, { BURST_LIMIT: undefined }, { GITHUB_REPO: 'x' }]) {
    assertError(await send(makeEnv(extra), createFakeGitHub(), post(VALID)), 503, 'relay-misconfigured', true);
  }
});

test('503 credential-rejected: GitHub refuses the token (for example an expired token)', async () => {
  const r = await send(makeEnv({ GITHUB_TOKEN: 'expired' }), createFakeGitHub({ token: 'test-token' }), post(VALID));
  assertError(r, 503, 'credential-rejected', true);
});

test('503 github-rate-limited with Retry-After, and github-unavailable on a network error', async () => {
  const limited = createFakeGitHub();
  const fetch = async (url, init) => (init.method === 'PUT'
    ? new Response('{}', { status: 403, headers: { 'retry-after': '120' } }) : limited.fetch(url, init));
  const r = await handle(post(VALID), makeEnv(), { fetch });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'github-rate-limited');
  assert.equal(r.headers.get('retry-after'), '120');
  const down = await handle(post(VALID), makeEnv(), { fetch: async () => { throw new TypeError('network'); } });
  assert.equal((await down.json()).error, 'github-unavailable');
});

test('GitHub App auth: the App secrets win over the token; PKCS#1 and PKCS#8 keys both work', async () => {
  for (const type of ['pkcs1', 'pkcs8']) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type, format: 'pem' });
    const appPublicKey = await webcrypto.subtle.importKey('spki', publicKey.export({ type: 'spki', format: 'der' }),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const gh = createFakeGitHub({ appPublicKey, token: 'never-used' });
    const env = makeEnv({ GITHUB_APP_ID: `12345${type}`, GITHUB_APP_INSTALLATION_ID: '678', GITHUB_APP_PRIVATE_KEY: pem, GITHUB_TOKEN: 'test-token' });
    const r = await send(env, gh, post(VALID));
    assert.equal(r.res.status, 200, type);
    assert.deepEqual(gh.state.jwtIssuers, [`12345${type}`], 'one JWT; the installation token is cached');
    assert.ok(gh.state.calls.filter((c) => c.path.startsWith('/repos/')).every((c) => c.auth.startsWith('Bearer ghs_fake')));
    assert.ok(gh.state.calls.every((c) => c.auth !== 'Bearer test-token'), 'the token is not used');
  }
});

test('GitHub App auth: a bad key is a configuration error', async () => {
  const env = makeEnv({ GITHUB_APP_ID: '9', GITHUB_APP_INSTALLATION_ID: '9', GITHUB_APP_PRIVATE_KEY: 'not a key' });
  assertError(await send(env, createFakeGitHub(), post(VALID)), 503, 'relay-misconfigured', true);
});

test('GET /health tells the state and no secret', async () => {
  const r = await send(makeEnv({ TEST_MODE: 'true' }), createFakeGitHub(), new Request('https://relay.test/health'));
  assert.equal(r.res.status, 200);
  assert.deepEqual(r.body, { enabled: true, test_mode: true, schema_major: 1 });
});

test('CORS: the preflight and the headers of each answer', async () => {
  const pre = await handle(new Request('https://relay.test/reports', { method: 'OPTIONS', headers: { origin: 'https://app.example', 'access-control-request-method': 'POST' } }), makeEnv());
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  assert.equal(pre.headers.get('access-control-allow-methods'), 'POST, GET, OPTIONS');
  assert.equal(pre.headers.get('access-control-allow-headers'), 'Content-Type');
  assert.equal(pre.headers.get('access-control-allow-credentials'), null);
});

test('404 for any other route or method', async () => {
  for (const req of [new Request('https://relay.test/'), new Request('https://relay.test/reports'), new Request('https://relay.test/health', { method: 'POST' })]) {
    assertError(await send(makeEnv(), createFakeGitHub(), req), 404, 'not-found', false);
  }
});
