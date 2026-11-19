// A fake GitHub REST API in memory, for the unit tests and for a local run with `wrangler dev`.
// It knows only the calls of the relay. It is not GitHub: it checks little and stores nothing.
//
// Local run:  node scripts/fake-github.mjs [port]     (default port 8790)
// Then set GITHUB_API_URL=http://127.0.0.1:8790 in .dev.vars.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const sha = () => [...crypto.getRandomValues(new Uint8Array(20))].map((b) => b.toString(16).padStart(2, '0')).join('');

// options.token: the bearer token that the repository calls must carry (null: any token).
// options.appPublicKey: a CryptoKey; when set, the fake checks the App JWT and gives tokens.
// options.fault(method, path): return an HTTP status to fail that call, or nothing.
export function createFakeGitHub({ owner = 'domisjustanumber', repo = 'skellycertify', token = null, appPublicKey = null, fault = () => null } = {}) {
  const state = {
    refs: { main: sha() },
    files: new Map(), // "branch:path" -> { content (base64), commit }
    issues: [],
    calls: [],
    installationTokens: new Set(),
    jwtIssuers: [],
  };
  const base = `/repos/${owner}/${repo}`;
  const reply = (status, body = null, headers = {}) =>
    new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

  async function checkJwt(auth) {
    const [h, c, s] = auth.replace(/^Bearer /, '').split('.');
    const b64 = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (x) => x.charCodeAt(0));
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', appPublicKey, b64(s), new TextEncoder().encode(`${h}.${c}`));
    const header = JSON.parse(new TextDecoder().decode(b64(h)));
    const claims = JSON.parse(new TextDecoder().decode(b64(c)));
    const now = Math.floor(Date.now() / 1000);
    if (!ok || header.alg !== 'RS256' || claims.exp - claims.iat > 600 || claims.exp < now) return null;
    return claims.iss;
  }

  async function fetch(url, init = {}) {
    const u = new URL(url);
    const method = init.method || 'GET';
    const path = decodeURIComponent(u.pathname);
    const auth = init.headers?.Authorization || '';
    state.calls.push({ method, path, auth, headers: init.headers });
    const injected = fault(method, path);
    if (injected) return reply(injected, { message: 'injected fault' });
    if (!init.headers?.['User-Agent'] || !init.headers?.['X-GitHub-Api-Version']) return reply(400, { message: 'headers missing' });

    const m = /^\/app\/installations\/([^/]+)\/access_tokens$/.exec(path);
    if (m && method === 'POST') {
      if (!appPublicKey) return reply(404, { message: 'Not Found' });
      const iss = await checkJwt(auth).catch(() => null);
      if (!iss) return reply(401, { message: 'A JSON web token could not be decoded' });
      state.jwtIssuers.push(iss);
      const t = `ghs_fake${sha()}`;
      state.installationTokens.add(t);
      return reply(201, { token: t, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    }
    const bearer = auth.replace(/^Bearer /, '');
    const authorised = state.installationTokens.has(bearer) || (token === null ? !appPublicKey : bearer === token);
    if (!authorised) return reply(401, { message: 'Bad credentials' });
    if (!path.startsWith(base)) return reply(404, { message: 'Not Found' });
    const rest = path.slice(base.length);
    const body = init.body ? JSON.parse(init.body) : null;

    if (rest === '' && method === 'GET') return reply(200, { default_branch: 'main' });
    let r;
    if ((r = /^\/git\/ref\/heads\/(.+)$/.exec(rest)) && method === 'GET') {
      return state.refs[r[1]] ? reply(200, { object: { sha: state.refs[r[1]] } }) : reply(404, { message: 'Not Found' });
    }
    if (rest === '/git/refs' && method === 'POST') {
      const name = body.ref.replace(/^refs\/heads\//, '');
      if (state.refs[name]) return reply(422, { message: 'Reference already exists' });
      state.refs[name] = body.sha;
      return reply(201, { ref: body.ref, object: { sha: body.sha } });
    }
    if ((r = /^\/contents\/(.+)$/.exec(rest))) {
      const filePath = r[1];
      if (method === 'GET') {
        const f = state.files.get(`${u.searchParams.get('ref')}:${filePath}`);
        return f ? reply(200, { path: filePath, content: f.content, encoding: 'base64' }) : reply(404, { message: 'Not Found' });
      }
      if (method === 'PUT') {
        if (!state.refs[body.branch]) return reply(404, { message: 'Branch not found' });
        const key = `${body.branch}:${filePath}`;
        if (state.files.has(key) && !body.sha) return reply(422, { message: '"sha" wasn\'t supplied.' });
        const commit = sha();
        state.refs[body.branch] = commit;
        state.files.set(key, { content: body.content, commit });
        return reply(201, { content: { path: filePath, sha: sha() }, commit: { sha: commit } });
      }
    }
    if (rest === '/commits' && method === 'GET') {
      const f = state.files.get(`${u.searchParams.get('sha')}:${u.searchParams.get('path')}`);
      return reply(200, f ? [{ sha: f.commit }] : []);
    }
    if ((r = /^\/issues\/(\d+)$/.exec(rest)) && method === 'GET') {
      const issue = state.issues.find((i) => i.number === Number(r[1]));
      return issue ? reply(200, issue) : reply(404, { message: 'Not Found' });
    }
    if (rest === '/issues' && method === 'GET') return reply(200, [...state.issues].reverse().slice(0, 100));
    if (rest === '/issues' && method === 'POST') {
      if (typeof body.body === 'string' && body.body.length > 65536) return reply(422, { message: 'body is too long' });
      const number = state.issues.length + 1;
      const issue = { number, title: body.title, body: body.body, labels: body.labels.map((name) => ({ name })),
        html_url: `https://github.com/${owner}/${repo}/issues/${number}` };
      state.issues.push(issue);
      return reply(201, issue);
    }
    return reply(404, { message: 'Not Found' });
  }

  return { fetch, state };
}

// Run as a local HTTP server.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.argv[2]) || 8790;
  const fake = createFakeGitHub();
  createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [
      { 'user-agent': 'User-Agent', 'x-github-api-version': 'X-GitHub-Api-Version', authorization: 'Authorization' }[k] ?? k, v]));
    const r = await fake.fetch(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks).toString() : undefined });
    console.log(`${req.method} ${req.url} -> ${r.status}`);
    res.writeHead(r.status, { 'content-type': 'application/json' });
    res.end(await r.text());
  }).listen(port, '127.0.0.1', () => console.log(`fake GitHub on http://127.0.0.1:${port}`));
}
