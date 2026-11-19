// A small GitHub REST client: the token or GitHub App auth, and the calls of the relay.

export class GitHubError extends Error {
  // code: a fixed error code of the relay. retryAfter: seconds, or null.
  constructor(code, status, retryAfter = null) {
    super(`${code} (GitHub ${status})`);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export class ConfigError extends Error {}

const API_VERSION = '2022-11-28';
const USER_AGENT = 'skellycertify-relay';

// ---- base64 and PEM (no Buffer in Workers without nodejs_compat) ----

export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const base64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const base64url = (bytes) => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const utf8 = (s) => new TextEncoder().encode(s);

function derLength(n) {
  if (n < 0x80) return [n];
  const out = [];
  for (; n > 0; n >>= 8) out.unshift(n & 0xff);
  return [0x80 | out.length, ...out];
}

// GitHub gives the App key as PKCS#1 ("BEGIN RSA PRIVATE KEY"). WebCrypto imports only PKCS#8.
// Wrap a PKCS#1 key in the PKCS#8 structure, so the owner can paste the key as GitHub gives it.
export function pemToPkcs8(pem) {
  const text = String(pem).replace(/\\n/g, '\n');
  const pkcs1 = text.includes('BEGIN RSA PRIVATE KEY');
  const body = text.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  const der = base64ToBytes(body);
  if (!pkcs1) return der;
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]; // rsaEncryption, NULL
  const octet = [0x04, ...derLength(der.length)];
  const inner = [0x02, 0x01, 0x00, ...algo, ...octet];
  const seq = [0x30, ...derLength(inner.length + der.length)];
  const out = new Uint8Array(seq.length + inner.length + der.length);
  out.set(seq, 0);
  out.set(inner, seq.length);
  out.set(der, seq.length + inner.length);
  return out;
}

export async function makeAppJwt(appId, privateKeyPem, nowSeconds) {
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const header = base64url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  // iat 60 s in the past for clock drift; exp at most 10 minutes ahead (GitHub docs).
  const claims = base64url(utf8(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: String(appId) })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(`${header}.${claims}`));
  return `${header}.${claims}.${base64url(new Uint8Array(sig))}`;
}

// ---- the client ----

let cachedInstallation = null; // { key, token, expiresAt } for one Worker isolate

export function authMode(env) {
  const app = [env.GITHUB_APP_ID, env.GITHUB_APP_INSTALLATION_ID, env.GITHUB_APP_PRIVATE_KEY];
  if (app.every(Boolean)) return 'app';
  if (app.some(Boolean)) throw new ConfigError('set all three GITHUB_APP_* secrets or none');
  if (env.GITHUB_TOKEN) return 'token';
  throw new ConfigError('no GitHub credential');
}

function failureCode(res) {
  const retryAfter = Number(res.headers.get('retry-after')) || null;
  if (res.status === 401) return new GitHubError('credential-rejected', 401);
  if ((res.status === 403 || res.status === 429) &&
      (retryAfter || res.headers.get('x-ratelimit-remaining') === '0')) {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    const wait = retryAfter ?? (reset ? Math.max(60, reset - Math.floor(Date.now() / 1000)) : 60);
    return new GitHubError('github-rate-limited', res.status, wait);
  }
  if (res.status === 403 || res.status === 404) return new GitHubError('credential-rejected', res.status);
  return new GitHubError('github-unavailable', res.status);
}

export function createGitHub(env, { fetch = globalThis.fetch, now = Date.now } = {}) {
  const api = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
  const [owner, repo] = String(env.GITHUB_REPO || '').split('/');
  if (!owner || !repo) throw new ConfigError('GITHUB_REPO must be owner/name');
  const mode = authMode(env);

  async function raw(method, path, body, token) {
    let res;
    try {
      res = await fetch(`${api}${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': USER_AGENT,
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GitHubError('github-unavailable', 0);
    }
    return res;
  }

  async function token() {
    if (mode === 'token') return env.GITHUB_TOKEN;
    const key = `${env.GITHUB_APP_ID}/${env.GITHUB_APP_INSTALLATION_ID}`;
    if (cachedInstallation?.key === key && cachedInstallation.expiresAt - now() > 5 * 60_000) return cachedInstallation.token;
    let jwt;
    try {
      jwt = await makeAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY, Math.floor(now() / 1000));
    } catch {
      throw new ConfigError('GITHUB_APP_PRIVATE_KEY is not a usable RSA key');
    }
    const res = await raw('POST', `/app/installations/${encodeURIComponent(env.GITHUB_APP_INSTALLATION_ID)}/access_tokens`, null, jwt);
    if (res.status !== 201) throw failureCode(res);
    const json = await res.json();
    cachedInstallation = { key, token: json.token, expiresAt: Date.parse(json.expires_at) || now() + 3_000_000 };
    return json.token;
  }

  // Return { status, json }. Throw a GitHubError for a status that is not in `ok`.
  async function call(method, path, body, ok = [200, 201]) {
    const res = await raw(method, path, body, await token());
    if (!ok.includes(res.status)) throw failureCode(res);
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }

  const r = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

  return {
    mode,
    owner,
    repo,
    // Create the branch from the default branch when it does not exist.
    async ensureBranch(branch) {
      const got = await call('GET', `${r}/git/ref/heads/${enc(branch)}`, null, [200, 404]);
      if (got.status === 200) return;
      const repoInfo = await call('GET', r);
      const base = await call('GET', `${r}/git/ref/heads/${enc(repoInfo.json.default_branch)}`);
      // 422: another request made the branch first.
      await call('POST', `${r}/git/refs`, { ref: `refs/heads/${branch}`, sha: base.json.object.sha }, [201, 422]);
    },
    async exists(path, branch) {
      return (await call('GET', `${r}/contents/${enc(path)}?ref=${encodeURIComponent(branch)}`, null, [200, 404])).status === 200;
    },
    // Return the file text, or null when the file does not exist on the branch.
    async readFile(path, branch) {
      const got = await call('GET', `${r}/contents/${enc(path)}?ref=${encodeURIComponent(branch)}`, null, [200, 404]);
      if (got.status === 404) return null;
      return new TextDecoder().decode(base64ToBytes(got.json.content.replace(/\s/g, '')));
    },
    // Create a new file. Return the commit SHA, or null on 422 (the file can exist already: the
    // caller reads it again). A 409 (the branch moved) is a temporary failure.
    async createFile(path, branch, bytes, message) {
      const got = await call('PUT', `${r}/contents/${enc(path)}`,
        { message, branch, content: bytesToBase64(bytes) }, [201, 422]);
      return got.status === 201 ? got.json.commit.sha : null;
    },
    // The SHA of the last commit on the branch that changed the path.
    async lastCommit(path, branch) {
      const got = await call('GET', `${r}/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=1`);
      return got.json[0]?.sha ?? branch;
    },
    async getIssue(number) {
      const got = await call('GET', `${r}/issues/${number}`, null, [200, 404, 410]);
      return got.status === 200 ? got.json : null;
    },
    // Find an issue whose body holds the marker, in the 100 newest issues. No search index is used,
    // so an issue made seconds ago is found.
    async findIssue(markerText) {
      const got = await call('GET', `${r}/issues?state=all&sort=created&direction=desc&per_page=100`);
      return got.json.find((i) => !i.pull_request && typeof i.body === 'string' && i.body.includes(markerText)) ?? null;
    },
    // Count the issues with the label that were created since `sinceMs`, up to `max`.
    // Newest first, 100 for each page: at most ceil(max / 100) calls. Pull requests do not count.
    async countIssuesSince(label, sinceMs, max) {
      let n = 0;
      for (let page = 1; n < max && page <= Math.ceil(max / 100); page++) {
        const got = await call('GET', `${r}/issues?labels=${encodeURIComponent(label)}&state=all&sort=created&direction=desc&per_page=100&page=${page}`);
        for (const i of got.json) {
          if (Date.parse(i.created_at) < sinceMs) return n;
          if (!i.pull_request) n++;
        }
        if (got.json.length < 100) break;
      }
      return n;
    },
    async createIssue(title, body, labels) {
      return (await call('POST', `${r}/issues`, { title, body, labels }, [201])).json;
    },
  };
}
