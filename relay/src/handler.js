// The request handler: POST /reports, GET /health, CORS. No state of its own except the
// rate-limit counters in KV.

import { parseReport, Refused, SCHEMA_MAJOR } from './report.js';
import { privacyRule } from './privacy.js';
import { buildTitle, buildBody, marker } from './issue.js';
import { createGitHub, GitHubError, ConfigError } from './github.js';
import { checkLimits, recordReport, senderKey } from './ratelimit.js';

export const MAX_BYTES = 1_048_576; // 1 MiB
export const BRANCH = 'inbox';
const TYPES = ['text/markdown', 'text/plain'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'Retry-After',
  'Access-Control-Max-Age': '86400',
};

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS, ...extra },
  });
}

// Each error body: a fixed code, the retry flag and a fixed detail (text or a rule number).
function fail(status, error, detail, retryAfter = null) {
  const retry = status === 429 || status === 503;
  return json(status, { error, retry, detail }, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
}

// The only log line: time, outcome, status, size and the hash prefix. Never report content or the address.
function log(outcome, status, bytes = null, hash = null) {
  console.log(JSON.stringify({ t: new Date().toISOString(), outcome, status, bytes, hash: hash ? hash.slice(0, 12) : null }));
}

async function readCapped(request) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function typeOk(header) {
  const [type, ...params] = String(header || '').toLowerCase().split(';').map((s) => s.trim());
  if (!TYPES.includes(type)) return false;
  const charset = params.find((p) => p.startsWith('charset='));
  return !charset || charset.replace(/"/g, '') === 'charset=utf-8';
}

async function issueFromSidecar(gh, issuePath) {
  const text = await gh.readFile(issuePath, BRANCH);
  const number = Number.parseInt(text ?? '', 10);
  return Number.isSafeInteger(number) && number > 0 ? gh.getIssue(number) : null;
}

async function file(report, bytes, hash, env, deps) {
  const testMode = env.TEST_MODE === 'true';
  const gh = createGitHub(env, deps);
  const dir = testMode ? 'inbox/test' : `inbox/${report.data.modules[0].created_utc.slice(0, 4)}`;
  const filePath = `${dir}/${hash}.md`;
  const issuePath = `${dir}/${hash}.issue`;
  const short = hash.slice(0, 12);
  const linkIssue = (issue) => gh.createFile(issuePath, BRANCH, new TextEncoder().encode(`${issue.number}\n`),
    `Link certify report ${short} to issue #${issue.number}`).catch(() => null); // a retry finds the issue by its marker
  const answer = (issue, duplicate) => ({ issue_url: issue.html_url, issue_number: issue.number, file_path: filePath, duplicate });

  await gh.ensureBranch(BRANCH);

  // Duplicate: the sidecar file names the issue.
  const linked = await issueFromSidecar(gh, issuePath);
  if (linked) return answer(linked, true);

  let commit = null;
  let duplicate = await gh.exists(filePath, BRANCH);
  if (!duplicate) {
    commit = await gh.createFile(filePath, BRANCH, bytes, `Add certify report ${short}`);
    if (!commit) {
      // 422: another request committed the same file, or GitHub refused the write.
      if (!(await gh.exists(filePath, BRANCH))) throw new GitHubError('github-unavailable', 422);
      duplicate = true;
    }
  }
  if (duplicate) {
    // The file exists but no sidecar names an issue: the issue exists with no sidecar, or the
    // issue was never made (a half-done earlier request). Find it by the marker, else make it.
    const found = await gh.findIssue(marker(hash));
    if (found) {
      await linkIssue(found);
      return answer(found, true);
    }
    commit = await gh.lastCommit(filePath, BRANCH);
  }
  const fileUrl = `https://github.com/${gh.owner}/${gh.repo}/blob/${commit}/${filePath}`;
  const labels = testMode ? ['certify-report', 'relay-test'] : ['certify-report'];
  const issue = await gh.createIssue(buildTitle(report.data),
    buildBody({ data: report.data, hash, filePath, fileUrl, testMode }), labels);
  await linkIssue(issue);
  return answer(issue, duplicate);
}

async function postReport(request, env, deps) {
  if (env.RELAY_ENABLED !== 'true') return [fail(503, 'relay-off', 'the relay is switched off'), 'relay-off'];
  try {
    if (!env.RATE_KV || !env.RATE_SALT) throw new ConfigError('RATE_KV or RATE_SALT missing');
    createGitHub(env, deps); // checks GITHUB_REPO and the credential secrets
  } catch {
    return [fail(503, 'relay-misconfigured', 'the relay has no valid configuration'), 'relay-misconfigured'];
  }
  if (!typeOk(request.headers.get('content-type'))) {
    return [fail(415, 'wrong-type', 'send text/markdown or text/plain in UTF-8'), 'wrong-type'];
  }
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_BYTES) return [fail(413, 'too-large', `the limit is ${MAX_BYTES} bytes`), 'too-large'];

  const sender = await senderKey(request.headers.get('cf-connecting-ip') || 'unknown', env.RATE_SALT);
  const limited = await checkLimits(env.RATE_KV, sender, deps.now());
  if (limited) {
    const detail = limited.code === 'daily-cap' ? 'the relay daily limit is reached' : 'too many reports from this address';
    return [fail(limited.status, limited.code, detail, limited.retryAfter), limited.code];
  }

  const bytes = await readCapped(request);
  if (bytes === null) return [fail(413, 'too-large', `the limit is ${MAX_BYTES} bytes`), 'too-large'];
  if (bytes.length === 0) return [fail(400, 'empty-body', 'the body must be the report file'), 'empty-body'];
  const hash = hex(await crypto.subtle.digest('SHA-256', bytes));
  const meta = [bytes.length, hash];

  let report;
  try {
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Refused('not-utf8', 'the file must be UTF-8');
    }
    report = parseReport(text);
    const rule = privacyRule(report.markdown, report.data);
    if (rule) throw new Refused('privacy-rule', rule);
  } catch (e) {
    if (e instanceof Refused) return [fail(422, e.code, e.detail), e.code, ...meta];
    throw e;
  }

  try {
    const result = await file(report, bytes, hash, env, deps);
    if (!result.duplicate) await recordReport(env.RATE_KV, sender, deps.now());
    return [json(200, result), result.duplicate ? 'duplicate' : 'created', ...meta];
  } catch (e) {
    if (e instanceof GitHubError) {
      const detail = {
        'credential-rejected': 'GitHub refused the relay credential',
        'github-rate-limited': 'GitHub rate limit; try again later',
        'github-unavailable': 'GitHub is not available; try again later',
      }[e.code];
      return [fail(503, e.code, detail, e.retryAfter), e.code, ...meta];
    }
    if (e instanceof ConfigError) return [fail(503, 'relay-misconfigured', 'the relay has no valid configuration'), 'relay-misconfigured', ...meta];
    throw e;
  }
}

export async function handle(request, env, deps = {}) {
  deps = { fetch: deps.fetch ?? globalThis.fetch, now: deps.now ?? Date.now };
  const { pathname } = new URL(request.url);
  let response;
  let outcome;
  let bytes = null;
  let hash = null;
  try {
    if (request.method === 'OPTIONS') {
      [response, outcome] = [new Response(null, { status: 204, headers: CORS }), 'preflight'];
    } else if (request.method === 'GET' && pathname === '/health') {
      response = json(200, { enabled: env.RELAY_ENABLED === 'true', test_mode: env.TEST_MODE === 'true', schema_major: SCHEMA_MAJOR });
      outcome = 'health';
    } else if (request.method === 'POST' && pathname === '/reports') {
      [response, outcome, bytes, hash] = await postReport(request, env, deps);
    } else {
      [response, outcome] = [fail(404, 'not-found', 'use POST /reports or GET /health'), 'not-found'];
    }
  } catch {
    [response, outcome] = [fail(503, 'internal-error', 'the relay failed; try again later'), 'internal-error'];
  }
  log(outcome, response.status, bytes, hash);
  return response;
}
