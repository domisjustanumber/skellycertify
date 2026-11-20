// The request handler: POST /reports and GET /health. It stores nothing of its own.
// It sends no CORS header: a web page in a browser cannot send to the relay or read its answer.

import { parseReport, Refused, SCHEMA_MAJOR } from './report.js';
import { privacyRule } from './privacy.js';
import { buildTitle, buildBody, marker } from './issue.js';
import { createGitHub, GitHubError, ConfigError } from './github.js';
import { checkBurst, secondsToMidnight, senderKey, PER_DAY } from './ratelimit.js';

export const MAX_BYTES = 262_144; // 256 KiB
export const BRANCH = 'inbox';
const LABEL = 'certify-report';
// The start of the two fixed commit messages of the relay: the report commit and the link commit.
// Only the start is matched, so a line feed or a trailer at the end does not change the count.
const RELAY_COMMIT_RE = /^(?:Add|Link) certify report [0-9a-f]{12}\b/;
// The daily cap counts both kinds: a new report makes 2 commits, and the issue for a file of an
// earlier day makes 1 (its link commit). So the limit is 2 * PER_DAY commits.
const CAP_COMMITS = 2 * PER_DAY;
// Each commit of the relay matches, so CAP_COMMITS commits fill at most CAP_COMMITS / 100 pages:
// 400 / 100 = 4 pages. A page of other commits makes the count unknown, and the relay refuses.
const CAP_PAGES = Math.ceil(CAP_COMMITS / 100);

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
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
  if (type !== 'text/markdown') return false;
  const charset = params.find((p) => p.startsWith('charset='));
  return !charset || charset.replace(/"/g, '') === 'charset=utf-8';
}

class Limited extends Error {
  constructor(code, retryAfter) {
    super(code);
    this.code = code;
    this.retryAfter = retryAfter;
  }
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

  // Build the issue text before the first write, so that an error here leaves nothing on GitHub.
  // The commit is not known yet: the link holds a placeholder of the same length. Report strings
  // cannot hold "://" (neutral() breaks it), so the placeholder occurs only in the link.
  const draftUrl = `https://github.com/${gh.owner}/${gh.repo}/blob/${'0'.repeat(40)}/${filePath}`;
  const title = buildTitle(report.data);
  const body = buildBody({ data: report.data, hash, filePath, fileUrl: draftUrl, testMode });
  const labels = testMode ? [LABEL, 'relay-test'] : [LABEL];

  // Duplicate: the sidecar file names the issue. A read on a missing branch gives 404.
  const linked = await issueFromSidecar(gh, issuePath);
  if (linked) return answer(linked, true);

  // Each path below writes, so each one checks the daily cap first. It counts the commits of the
  // relay today (UTC): the commit is the first public write. Requests at the same moment can
  // pass the cap by the number of requests in flight.
  const today = Math.floor(deps.now() / 86_400_000) * 86_400_000;
  if ((await gh.countCommitsSince(BRANCH, today, RELAY_COMMIT_RE, CAP_COMMITS, CAP_PAGES)) >= CAP_COMMITS) {
    throw new Limited('daily-cap', secondsToMidnight(deps.now()));
  }

  let commit = null;
  let duplicate = await gh.exists(filePath, BRANCH);
  if (!duplicate) {
    await gh.ensureBranch(BRANCH);
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
    const found = await gh.findIssue(marker(hash), LABEL);
    if (found) {
      await linkIssue(found);
      return answer(found, true);
    }
    commit = await gh.lastCommit(filePath, BRANCH);
  }
  const fileUrl = `https://github.com/${gh.owner}/${gh.repo}/blob/${commit}/${filePath}`;
  const issue = await gh.createIssue(title, body.replace(draftUrl, () => fileUrl), labels);
  await linkIssue(issue);
  return answer(issue, duplicate);
}

async function postReport(request, env, deps) {
  if (env.RELAY_ENABLED !== 'true') return [fail(503, 'relay-off', 'the relay is switched off'), 'relay-off'];
  try {
    if (!env.SENDER_LIMIT || !env.BURST_LIMIT || !env.RATE_SALT) throw new ConfigError('a limiter binding or RATE_SALT is missing');
    createGitHub(env, deps); // checks GITHUB_REPO and the credential secrets
  } catch {
    return [fail(503, 'relay-misconfigured', 'the relay has no valid configuration'), 'relay-misconfigured'];
  }
  if (!typeOk(request.headers.get('content-type'))) {
    return [fail(415, 'wrong-type', 'send text/markdown in UTF-8'), 'wrong-type'];
  }
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_BYTES) return [fail(413, 'too-large', `the limit is ${MAX_BYTES} bytes`), 'too-large'];

  const sender = await senderKey(request.headers.get('cf-connecting-ip') || 'unknown', env.RATE_SALT);
  const limited = await checkBurst(env, sender);
  if (limited) {
    const detail = limited.code === 'busy' ? 'the relay is busy' : 'too many reports from this address';
    return [fail(limited.status, limited.code, detail, limited.retryAfter), limited.code];
  }

  const raw = await readCapped(request);
  if (raw === null) return [fail(413, 'too-large', `the limit is ${MAX_BYTES} bytes`), 'too-large'];
  if (raw.length === 0) return [fail(400, 'empty-body', 'the body must be the report file'), 'empty-body'];

  let report;
  let bytes;
  let hash;
  let meta = [raw.length, null];
  try {
    let text;
    try {
      // ignoreBOM keeps a BOM, so that only the line ends change.
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw);
    } catch {
      throw new Refused('not-utf8', 'the file must be UTF-8');
    }
    // Each CRLF becomes LF before each check, the hash and the commit (report-format.md 4.2).
    text = text.replace(/\r\n/g, '\n');
    bytes = new TextEncoder().encode(text);
    hash = hex(await crypto.subtle.digest('SHA-256', bytes));
    meta = [bytes.length, hash];
    report = parseReport(text, deps.now());
    const rule = privacyRule(report.markdown, report.data, report.json);
    if (rule) throw new Refused('privacy-rule', rule);
  } catch (e) {
    if (e instanceof Refused) return [fail(422, e.code, e.detail), e.code, ...meta];
    throw e;
  }

  try {
    const result = await file(report, bytes, hash, env, deps);
    return [json(200, result), result.duplicate ? 'duplicate' : 'created', ...meta];
  } catch (e) {
    if (e instanceof Limited) return [fail(503, e.code, 'the relay daily limit is reached', e.retryAfter), e.code, ...meta];
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
    if (request.method === 'GET' && pathname === '/health') {
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
