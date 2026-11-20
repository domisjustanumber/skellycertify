# The relay

The relay is a small Cloudflare Worker. It files certify reports in the repository
`domisjustanumber/skellycertify`. The freemocap app sends the report file to the relay. The person
then needs no GitHub account. The issue form of the repository stays as the permanent fallback.

This guide is for the owner of the repository. Part 1 is the test with a personal token. Part 2 moves
the relay to a GitHub App. Do Part 2 before volunteers use the relay.

## What the relay does

The relay does one thing: `POST /reports` with the report file as the body.

1. It checks the limits, the size, the type, the format
   ([report-format.md](../report-format.md) sections 3, 4.1 and 4.2) and the privacy rules 1 to 11
   of section 6. If a check fails, it writes nothing. It replaces each CRLF with LF before the
   checks. The stored file and its SHA-256 are those of the LF bytes.
2. It commits the file to the branch `inbox` at `inbox/<yyyy>/<sha256>.md`. `<yyyy>` is the year
   of `created_utc` of the first module. `<sha256>` is the SHA-256 of the exact bytes. In test mode
   the path is `inbox/test/<sha256>.md`. The relay makes the branch from the default branch when the
   branch does not exist. Nobody merges the branch `inbox`.
3. It opens one issue with the label `certify-report`. The issue links the file at its commit.
4. It writes `inbox/.../<sha256>.issue` with the issue number. A second send of the same file finds
   the issue through this file and creates nothing.
5. It answers with JSON: `{"issue_url", "issue_number", "file_path", "duplicate"}`.

`GET /health` answers `{"enabled", "test_mode", "schema_major"}`. Each other route answers 404.

The relay keeps no copy of a report, no database and no Cloudflare storage. It does not store or show the address of the
sender. Its log line holds only the time, the outcome code, the status, the size and the first 12
characters of the hash.

### The issue

The relay builds the issue only from the JSON block. It never uses the Markdown part. The body
shows the summary of [report-format.md 4.2](../report-format.md#42-layout), with the display names
of 4.2.

- Title: `[certify] <app or package> <version> · <OS> · <GPUs>`. The relay writes `FMC` for
  `freemocap`, `Win` for `Windows` and `Mac` for `macOS`. Other names stay in full. `<GPUs>` are
  the GPU names without VRAM, each name one time. Example:
  `[certify] FMC 2.0.0 · Win 11 26H2 · NVIDIA RTX 3070, Intel UHD 770`. A report with no GPU has
  `no GPU`.
- In test mode, the first line is `**Test of the relay.** This issue is never evidence.`
- The header of 4.2. For one module with `"app": null`, it is one line. Else it is the app line and
  one list line for each module. Each module line shows the `id` of the module when it has one. It
  shows at most 10 reason codes, then `and <n> more`. The body shows at most 100 module lines.
- The system list: `- OS:`, `- CPU:` and `- RAM:`.
- The GPU table `| GPU | Module | Result |`, from the `summary` items and `host.gpus`. A module
  with no `summary` (format 1.1.0 or earlier) gives no item rows. Each GPU that no `ep` item names
  has the result `not checked`. When no module has `summary`, that result is
  `no summary in the report`, because the EPs of such a file can have run.
- The camera table, or the line `Cameras: not checked on this system.`
- Only when a section or a check failed: `Failed checks:` and the table
  `| Module | Check | Reason |`. It has one row for each section with the result `fail`, or for
  each check with the result `fail` when the module has no sections. The `Module` cell also shows
  the `id` of the module.
- The note as a quote, at most 2000 characters.
- The link to the file, the SHA-256 and a hidden marker `<!-- skellycertify-report sha256:<hash> -->`.

If the body is longer than 65,536 characters, the relay removes rows from the end of the tables
and says so. It removes the failed rows first, then the camera rows, the GPU rows and the module
lines. The report file holds all rows.

Each report string is untrusted. The relay removes each character that can start a mention, an
issue link, HTML or a Markdown link (`@`, `#`, `<`, `>`, `[`, `]`, `!`, `|`, `` ` ``, `*` and
control characters). It breaks `://` and `www.`. It puts report values in code spans.

## Answers for the app developers

Each error body is JSON: `{"error": <fixed code>, "retry": true|false, "detail": <fixed text or a rule number>}`.
The body never holds report content.

| Status | `error` | `retry` | Meaning | What the app does |
|---|---|---|---|---|
| 200 | none | none | Created, or `duplicate: true` | Show the issue link. Delete the saved copy. |
| 400 | `empty-body` | false | The body is empty. | Fix the app. |
| 404 | `not-found` | false | Wrong route or method. | Fix the app. |
| 413 | `too-large` | false | The body is larger than 262,144 bytes (256 KiB). | Offer the issue form at once. |
| 415 | `wrong-type` | false | Not `text/markdown` or `text/plain`, or a charset other than UTF-8. | Fix the app. |
| 422 | `not-utf8`, `lone-cr`, `no-json-block`, `bad-json`, `wrong-schema`, `missing-field`, `bad-value` | false | The file does not obey the format. `detail` is a fixed text or a field path such as `report.modules[0].kind`. CRLF line ends are accepted. A CR that is not part of CRLF gives `lone-cr`. | Never retry. Show the code. Offer the issue form at once. |
| 422 | `privacy-rule` | false | A privacy rule fails. `detail` is the rule number (1 to 11). | Never retry. Tell the person the rule. Offer the issue form at once. |
| 429 | `rate-limited` | true | More than 2 POSTs from this address in 60 seconds, in one Cloudflare location. `Retry-After` gives seconds. | Keep the file. Retry on a later app start. |
| 429 | `busy` | true | More than 10 POSTs from all senders in 60 seconds, in one Cloudflare location. `Retry-After` gives seconds. | Keep the file. Retry on a later app start. |
| 503 | `relay-off` | true | The owner switched the relay off. | Keep the file. Retry later. |
| 503 | `daily-cap` | true | 200 issues with the label `certify-report` were created today (UTC). `Retry-After` gives the seconds to 00:00 UTC. | Keep the file. Retry later. |
| 503 | `credential-rejected` | true | GitHub refused the credential of the relay, for example an expired token. | Keep the file. Retry later. |
| 503 | `github-rate-limited` | true | GitHub limits the relay. `Retry-After` gives seconds. | Keep the file. Retry later. |
| 503 | `github-unavailable` | true | GitHub did not answer or failed. | Keep the file. Retry later. |
| 503 | `relay-misconfigured` | true | A secret or a binding is missing. | Keep the file. Retry later. |
| 503 | `internal-error` | true | An unexpected failure in the relay. | Keep the file. Retry later. |

The app rule (decided 2026-11-19): save the file, then retry on the next app start. After 3 failed
retries, offer to open the issue form. A 413 or a 422 is permanent: do not retry it, and offer the
issue form at once.

Requirements for the app ([report-format.md](../report-format.md) section 4.1):

- The relay publishes a report before a person of the project reads it. Before the app sends a
  report to the relay, the app must show the person the exact file. The app must get a clear
  "send" from the person.
- An automatic retry must send only the file that the person accepted, byte for byte. It must
  never send data that the app added later.

A retry of the same file is safe. The relay finds the earlier issue, or makes the issue when an
earlier request committed the file but failed before the issue.

## Limits

The relay uses no Cloudflare storage product. It uses two Rate Limiting bindings and GitHub.

| Limit | Value | How |
|---|---|---|
| Size | 262,144 bytes (256 KiB) | `Content-Length` first, then again while the relay reads the body. |
| Per sender | 2 POSTs in 60 seconds | Binding `SENDER_LIMIT`. The key is a salted SHA-256 of the sender address (secret `RATE_SALT`), never the address. |
| Burst | 10 POSTs in 60 seconds | Binding `BURST_LIMIT` with the key `all`. |
| Daily cap | 200 new reports for each UTC day | GitHub is the counter. Before a new report, the relay counts the issues with the label `certify-report` that were created today. |

The relay checks in this order: the off switch, the size by `Content-Length`, the two bindings,
the body and the format, the duplicate lookup, the daily cap (only for a new report), then the
writes. So each POST counts against the two bindings, also a refused POST and a duplicate.

- The earlier figure of 5 reports per hour for each sender cannot be set: a binding period is 10
  or 60 seconds only.
- Each binding counts in each Cloudflare location separately, and its count is approximate. One
  sender usually reaches one location. The worst case for one sender in one location is 120 POSTs
  in one hour. The daily cap limits the new reports for all senders together to 200 in one day.
- Issues from the issue form also have the label `certify-report`. They count toward the daily
  cap.

## Files

| Path | Content |
|---|---|
| `src/index.js` | The Worker entry point. |
| `src/handler.js` | Routes, CORS, limits, status codes and the filing steps. |
| `src/report.js` | Parse the file and check the format. |
| `src/privacy.js` | Privacy rules 1 to 11. |
| `src/issue.js` | The issue title and body, and the neutralisation of report strings. |
| `src/github.js` | The GitHub client: the token or the GitHub App, the REST calls and the daily count. |
| `src/ratelimit.js` | The per-sender and burst limits (Rate Limiting bindings). |
| `test/` | Unit tests. They use a fake GitHub and need no network. |
| `samples/` | `valid.md`, `valid-quick.md` (two quick runs of one package), `refused-privacy.md` (rule 1) and `refused-format.md` (schema 2). |
| `scripts/send-sample.mjs` | Send a file to a relay and print the answer. |
| `scripts/fake-github.mjs` | A fake GitHub API for a local run. |
| `wrangler.jsonc` | The Worker configuration. It holds no secret and no account id. |

---

# Part 1: the test with a personal token

The commands are for PowerShell. Bash commands follow where they are different. Run each command in
the folder `relay/` of your clone, unless the step says otherwise.

## 1. Prerequisites

- Node.js 22 or later, with npm. Check with `node --version`.
- A clone of `domisjustanumber/skellycertify`.
- A GitHub account that owns the repository.
- An email address for a new Cloudflare account. No payment card is necessary for the free plan.

## 2. Create the labels

1. Open `https://github.com/domisjustanumber/skellycertify/labels`.
2. Make sure that the label `certify-report` exists. If it does not exist, click **New label**,
   type `certify-report` and click **Create label**.
3. Click **New label**. Type `relay-test`. Type the description `A test of the relay. Never evidence.`.
   Click **Create label**.

Success: the label list shows `certify-report` and `relay-test`.

## 3. Create the fine-grained token

1. On GitHub, open **Settings** > **Developer settings** > **Personal access tokens** >
   **Fine-grained tokens**.
2. Click **Generate new token**.
3. **Token name**: `skellycertify-relay-test`.
4. **Resource owner**: your account.
5. **Expiration**: 30 days.
6. **Repository access**: select **Only select repositories**. Select
   `domisjustanumber/skellycertify`. Select no other repository.
7. **Repository permissions**:
   - **Contents**: Read and write.
   - **Issues**: Read and write.
   - **Metadata**: Read-only. GitHub adds it. It is mandatory.
   - Set no other permission.
8. Click **Generate token**.
9. GitHub shows the token one time. Keep the page open. You paste the token in step 7. Do not
   save the token in a file, a note or a chat.

Success: the token list shows `skellycertify-relay-test` with an expiry date in 30 days.

## 4. Create the Cloudflare account and choose the subdomain

1. Create an account at `https://dash.cloudflare.com/sign-up`.
2. In the dashboard sidebar, open **Compute** > **Workers & Pages**.

The address of the relay is `https://skellycertify-relay.<subdomain>.workers.dev`.
The subdomain is public. Each Worker of the account shows it. Do not use your name, your user name
or a word that identifies you. Use a neutral word, for example `freemocap-relay` or a random word.

Choose the subdomain now. Use only lowercase letters, digits and hyphens. You do not create it in
the dashboard. Wrangler creates it at the first deploy, in
[step 11](#11-deploy).

Success: the **Workers & Pages** page opens and you have chosen a subdomain.

## 5. Install the tools

```powershell
cd relay
npm install
```

Success: npm prints `added ... packages`. The folder `node_modules/` exists. Git ignores it.

The relay has no runtime dependency. `wrangler` (the Cloudflare CLI) is the only development
dependency. Its version is pinned in `package.json`.

Run each `npx wrangler` command of this README from the folder `relay/`. From the repository root,
a bare `npx wrangler` offers to download another Wrangler version. From the root, use the pinned
one by its path: `node relay/node_modules/wrangler/bin/wrangler.js <command> --cwd relay`.

## 6. Log in to Cloudflare

A plain `npx wrangler login` asks for each permission that Wrangler knows (KV, D1, Pages, email,
AI and more). The relay needs three. Ask for these three only:

```powershell
npx wrangler login --scopes account:read user:read workers_scripts:write
```

| Scope | Why the relay needs it |
|---|---|
| `account:read` | Wrangler finds the account id. `wrangler.jsonc` holds no account id. |
| `user:read` | Wrangler reads your account memberships. `whoami` shows your email address. |
| `workers_scripts:write` | Deploy, secrets, the `workers.dev` subdomain, `wrangler tail` and `wrangler delete`. |

Wrangler adds `offline_access` itself. It lets Wrangler renew the login.

A browser window opens. Check the address of the page. It contains
`scope=account%3Aread%20user%3Aread%20workers_scripts%3Awrite%20offline_access`. Check that the
page lists only these permissions. Then click **Allow**.

If the page lists more permissions (for example D1, Pages or Email Routing), do not click
**Allow**. Close the page and stop the command with Ctrl+C. That login did not come from the
command above. Each other Wrangler command (`deploy`, `secret put`, `tail`) starts a login with
all permissions when you are not logged in. Always run the command above first.

If you already logged in with all permissions, run `npx wrangler logout` first. Then log in again
with the command above.

Success: Wrangler prints `Successfully logged in.` Check with `npx wrangler whoami`. It lists the
three scopes and `offline_access`. It also warns that Wrangler is missing some expected OAuth
scopes. This warning is correct. Ignore it.

If a later command fails with an authentication error (code 10000), a scope is missing. Run
`npx wrangler login --scopes-list` to see each scope. Add only the scope that the command needs.

## 7. Set the secrets

A secret goes only to Cloudflare. Never paste a secret into a file of this repository, into
`wrangler.jsonc` or into a command line.

1. Set the token. Wrangler asks for the value. Paste the token from step 3 and push Enter.

   ```powershell
   npx wrangler secret put GITHUB_TOKEN
   ```

2. Set the salt of the rate-limit keys. This command makes a random value and sends it directly.
   You never see the value. It works in PowerShell and in bash.

   ```powershell
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put RATE_SALT
   ```

3. Close the GitHub page with the token.

Notes:

- If the Worker does not exist yet, Wrangler asks to create it. Answer yes.
- `wrangler secret put` deploys a new version at once.
- In PowerShell, do not use `echo <token> | ...`. The token then goes into the command history.

Success: `npx wrangler secret list` shows `GITHUB_TOKEN` and `RATE_SALT`. It never shows a value.

The two Rate Limiting bindings are in `wrangler.jsonc`. They need no command. Their
`namespace_id` values (`71001` and `71002`) must be unique in your Cloudflare account. If you
already use these numbers for another Worker, change them in `wrangler.jsonc`.

## 8. Check the variables

The variables are in `wrangler.jsonc`, in `vars`. They are not secrets.

| Variable | Test value | Meaning |
|---|---|---|
| `RELAY_ENABLED` | `"true"` | `"false"` makes each POST answer 503 `relay-off` at once. |
| `TEST_MODE` | `"true"` | Adds the label `relay-test` and uses `inbox/test/`. |
| `GITHUB_REPO` | `"domisjustanumber/skellycertify"` | The target repository. |
| `GITHUB_API_URL` | `"https://api.github.com"` | The GitHub API. A local test sets a fake. |

Keep `TEST_MODE` `"true"` for the whole of Part 1.

The limit numbers are in `ratelimits` in `wrangler.jsonc` and in `src/ratelimit.js`. If you
change one, change the other. The period must be 10 or 60.

Wrangler deletes each variable that you set in the dashboard on the next deploy. Change the
variables only in `wrangler.jsonc`.

## 9. Run the unit tests

```powershell
npm test
```

Success: the summary shows `fail 0`. The tests need no network and no account.

## 10. Run the relay on your computer

`wrangler dev` runs the Worker on your computer. It does not need a login for a local run.
A fake GitHub stands in for GitHub. Nothing goes to GitHub.

1. Make the file `.dev.vars` in `relay/`. Git ignores it. Put these three lines in it. The values
   are fake.

   ```text
   GITHUB_API_URL=http://127.0.0.1:8790
   GITHUB_TOKEN=local-fake-token
   RATE_SALT=local-salt
   ```

2. Start the fake GitHub in a first terminal:

   ```powershell
   node scripts/fake-github.mjs 8790
   ```

3. Start the relay in a second terminal:

   ```powershell
   npx wrangler dev --port 8787
   ```

   Success: Wrangler prints `Ready on http://127.0.0.1:8787` (or `localhost:8787`).

4. Send the samples in a third terminal:

   ```powershell
   node scripts/send-sample.mjs http://127.0.0.1:8787
   node scripts/send-sample.mjs http://127.0.0.1:8787 samples/valid.md
   node scripts/send-sample.mjs http://127.0.0.1:8787 samples/refused-privacy.md
   node scripts/send-sample.mjs http://127.0.0.1:8787 samples/refused-format.md
   ```

   Success: `HTTP 200` with `"duplicate":false`, then `HTTP 200` with `"duplicate":true`.
   The per-sender limit allows 2 POSTs in 60 seconds. Wait 60 seconds. Then the third command
   gives `HTTP 422` with `privacy-rule` and detail `1`, and the fourth gives `HTTP 422` with
   `wrong-schema`.
   The fake prints each GitHub call. The issue links point to github.com, but the fake made them.
   They do not exist.

5. Stop the two servers with Ctrl+C. Delete `.dev.vars`.

A local run tests the code, the checks, the answers and the two Rate Limiting bindings (Wrangler
simulates them on your computer). It cannot test the real token, the real GitHub permissions, the
labels on GitHub, the count in each Cloudflare location or the Cloudflare logs.

If the third sample answers `HTTP 429` `rate-limited`, the per-sender limit works. Wait 60
seconds and send again.

If each POST answers 503 `internal-error`, another `wrangler dev` run can hold the local state
folder `.wrangler/`. Stop the other run, or start this run with `--persist-to` and a new folder.

## 11. Deploy

```powershell
npx wrangler deploy
```

On an account that has no `workers.dev` subdomain, Wrangler creates it:

1. Wrangler asks if you want to register a `workers.dev` subdomain now. Answer yes.
2. Wrangler asks for the subdomain. Type the subdomain that you chose in
   [step 4](#4-create-the-cloudflare-account-and-choose-the-subdomain).
3. Wrangler shows the address `https://<subdomain>.workers.dev` and asks to proceed. Answer yes.
   If another account uses the subdomain, Wrangler refuses it. Then type another one.

The new subdomain can take a few minutes to work. Until then, the address can answer with a DNS
error. Wait and try again.

To change the subdomain later, see
`https://developers.cloudflare.com/workers/configuration/routing/workers-dev/`. A change of the
subdomain changes the address of each Worker of the account.

Success: Wrangler prints the address `https://skellycertify-relay.<subdomain>.workers.dev`.

## 12. Check the health

```powershell
Invoke-RestMethod https://skellycertify-relay.<subdomain>.workers.dev/health
```

Bash: `curl -s https://skellycertify-relay.<subdomain>.workers.dev/health`

Success: `enabled` is `true`, `test_mode` is `true`, `schema_major` is `1`.

## 13. Send the sample

```powershell
node scripts/send-sample.mjs https://skellycertify-relay.<subdomain>.workers.dev
```

Success: `HTTP 200`, `"duplicate":false` and a line `Issue: https://github.com/domisjustanumber/skellycertify/issues/<n>`.

## 14. Look at the issue and the branch

1. Open the issue. Check that:
   - it has the labels `certify-report` and `relay-test`;
   - the first line says `Test of the relay`;
   - the title is `[certify] FMC 2.0.0 · Win 11 26H2 · NVIDIA RTX 3070, Intel UHD 770`;
   - the module line, the system list and the GPU table agree with the Markdown part of
     `samples/valid.md`. That sample has no `fail` row, so the body has no `Failed checks:` table;
   - the author is your account (Part 2 changes this to the app).
2. Click the link of the report file. GitHub shows `inbox/test/<sha256>.md` at one commit.
3. Open `https://github.com/domisjustanumber/skellycertify/tree/inbox/inbox/test`. It holds the
   `.md` file and the `.issue` file.

## 15. Send the same file again

```powershell
node scripts/send-sample.mjs https://skellycertify-relay.<subdomain>.workers.dev
```

Success: `HTTP 200`, `"duplicate":true` and the same issue number. GitHub shows no new issue and
no new commit.

The per-sender limit is 2 POSTs in 60 seconds. Wait 60 seconds before the next step. Cloudflare
counts with a delay, so the live relay lets more than 2 fast POSTs pass before it answers
`HTTP 429` `rate-limited`. In a test of 12 POSTs in one second, the first 8 passed. To see the
limit work, send `samples/refused-format.md` 12 times with no pause. A refused file makes nothing
on GitHub.

## 16. Send the refused samples

Send the two files with 60 seconds between them, or the second can get `HTTP 429`.

```powershell
node scripts/send-sample.mjs https://skellycertify-relay.<subdomain>.workers.dev samples/refused-privacy.md
node scripts/send-sample.mjs https://skellycertify-relay.<subdomain>.workers.dev samples/refused-format.md
```

Success: `HTTP 422` with `privacy-rule` (detail `1`), and `HTTP 422` with `wrong-schema`. GitHub
shows no new issue and no new commit.

## 17. Test the off switch

1. In `wrangler.jsonc`, set `"RELAY_ENABLED": "false"`.
2. Run `npx wrangler deploy`.
3. Send the sample again. Success: `HTTP 503` with `relay-off`.
4. Set `"RELAY_ENABLED": "true"` and run `npx wrangler deploy` again.

The fastest stop is in [Kill steps](#21-kill-steps).

## 18. Read the logs safely

The relay writes one log line for each request:
`{"t": ..., "outcome": ..., "status": ..., "bytes": ..., "hash": <12 characters>}`.

- Dashboard: **Compute** > **Workers & Pages** > `skellycertify-relay` > **Observability** (or **Logs**).
- Live: `npx wrangler tail --format pretty`.

Keep these settings:

- `observability.logs.invocation_logs` stays `false` in `wrangler.jsonc`. Invocation logs record
  request metadata. The relay does not need them.
- Do not turn on Logpush, traces or a log destination for this Worker.
- Do not add `console.log` of a report, of a header or of the request.
- `wrangler tail` can show request metadata. Do not save or share its output.

## 19. Rotate or revoke the token

To rotate:

1. Make a new token with step 3.
2. Run `npx wrangler secret put GITHUB_TOKEN` and paste the new token.
3. On GitHub, delete the old token.

To revoke: on GitHub, open **Fine-grained tokens**, select the token and click **Delete**. The relay
then answers 503 `credential-rejected`.

The token expires after 30 days. The relay then answers 503 `credential-rejected`. Do Part 2 before
that day, or rotate the token.

## 20. Clean up after the test

1. Close the test issues: open
   `https://github.com/domisjustanumber/skellycertify/issues?q=label%3Arelay-test`, select each
   issue and close it as **Not planned**. A `relay-test` issue is never evidence.
2. Delete the folder `inbox/test/` on the branch `inbox`. In a clone:

   ```powershell
   git fetch origin inbox
   git switch inbox
   git rm -r inbox/test
   git commit -m "Remove the relay test files"
   git push origin inbox
   git switch main
   ```

   Or delete the whole branch: `git push origin --delete inbox`. The relay makes it again when it
   needs it. Delete the branch only when it holds no real report.
3. Switch test mode off: set `"TEST_MODE": "false"` in `wrangler.jsonc` and run `npx wrangler deploy`.
   Success: `/health` shows `"test_mode": false`.

## 21. Kill steps

Do one or more of these steps, from fastest to strongest:

1. Stop the address: dashboard, **Compute** > **Workers & Pages** > `skellycertify-relay` > **Settings** >
   **Domains & Routes**, then disable `workers.dev`. Also set `"workers_dev": false` in
   `wrangler.jsonc`. Else the next deploy turns the address on again.
2. Switch the relay off with [step 17](#17-test-the-off-switch).
3. Delete the Worker: `npx wrangler delete`.
4. Revoke the token ([step 19](#19-rotate-or-revoke-the-token)), or uninstall the app (Part 2).

## 22. Costs and free-plan limits

The relay fits in the Workers free plan. These are the limits of the free plan (Cloudflare
documentation, read 2026-11-19):

| Limit | Free plan | The relay |
|---|---|---|
| Requests | 100,000 per day | One for each send. |
| CPU time | 10 ms per request | A normal report needs a few ms. The cap of 256 KiB keeps the parse short. |
| Request body | 100 MB | The relay refuses more than 262,144 bytes. |
| Subrequests | 50 per request | At most 16 GitHub calls. |
| Rate Limiting bindings | Not on the limits page | 2 calls for each POST. They are not storage. |

GitHub limits (GitHub documentation): 5,000 requests per hour for a token, and at most 80
content-generating requests per minute and 500 per hour. Each new report makes 3 contents (two
commits and one issue). The daily count costs 1 GitHub call, or 2 when 100 or more
`certify-report` issues were created today. A duplicate or a refused file needs no count. The
daily cap of 200 stays below these limits.

---

# Part 2: the GitHub App

With an app, the issues and the commits come from the app (`<app name>[bot]`), not from your
account. The app token lasts one hour and the relay makes a new one when it needs it. Do this part
before volunteers use the relay.

## 1. Create the app

1. On GitHub, open **Settings** > **Developer settings** > **GitHub Apps**.
2. Click **New GitHub App**.
3. **GitHub App name**: a unique name of at most 34 characters, for example
   `skellycertify-relay`.
4. **Homepage URL**: `https://github.com/domisjustanumber/skellycertify`.
5. **Webhook**: clear **Active**. The relay needs no webhook.
6. **Repository permissions**:
   - **Contents**: Read and write.
   - **Issues**: Read and write.
   - **Metadata**: Read-only (mandatory).
   - Set no other permission.
7. **Where can this GitHub App be installed?**: **Only on this account**.
8. Click **Create GitHub App**.

Success: the app page shows the **Client ID**. You need it in step 4.

## 2. Install the app on the one repository

1. On the app page, click **Install App**.
2. Click **Install** next to your account.
3. Select **Only select repositories**. Select `domisjustanumber/skellycertify`.
4. Click **Install**.
5. GitHub opens the installation page. Its address ends with `/installations/<number>`. That
   number is the installation ID.

## 3. Generate the private key

1. On the app page, find **Private keys**. Click **Generate a private key**.
2. The browser downloads a `.pem` file. GitHub keeps only the public part.

GitHub gives the key in the PKCS#1 format (`BEGIN RSA PRIVATE KEY`). WebCrypto in Workers imports
only PKCS#8. The relay converts a PKCS#1 key itself, so no conversion is necessary. A PKCS#8 key
(`BEGIN PRIVATE KEY`) also works. If you want to convert it yourself, OpenSSL (it comes with Git
for Windows) can do it:

```powershell
openssl pkcs8 -topk8 -nocrypt -in downloaded-key.pem -out key-pkcs8.pem
```

## 4. Set the three secrets

```powershell
npx wrangler secret put GITHUB_APP_CLIENT_ID
npx wrangler secret put GITHUB_APP_INSTALLATION_ID
Get-Content -Raw .\path\to\downloaded-key.pem | npx wrangler secret put GITHUB_APP_PRIVATE_KEY
```

Bash, last line: `npx wrangler secret put GITHUB_APP_PRIVATE_KEY < path/to/downloaded-key.pem`

- `GITHUB_APP_CLIENT_ID`: the Client ID of the app, from the app page. It is not the App ID.
- `GITHUB_APP_INSTALLATION_ID`: the number from step 2.
- Do not paste the key at the prompt. A prompt can cut a value with many lines. Use the pipe.

When the three app secrets are set, the relay uses the app and ignores `GITHUB_TOKEN`. When only
one or two are set, the relay answers 503 `relay-misconfigured`.

After the key is in Cloudflare, delete the `.pem` file from your computer. You can make a new key
on the app page at any time.

## 5. Check that the app files the issues

The relay answers a duplicate with the old issue. So send a new file:

1. Copy `samples/valid.md` to a file outside the repository.
2. In the copy, change `about five minutes` to `about six minutes`. The hash then changes.
3. Send the copy, with test mode on:

   ```powershell
   node scripts/send-sample.mjs https://skellycertify-relay.<subdomain>.workers.dev ..\..\copy-of-valid.md
   ```

4. Open the issue. Success: the author is `<app name>[bot]`. The commit on `inbox` also comes from
   the app.

## 6. Delete the personal token

1. Run `npx wrangler secret delete GITHUB_TOKEN`.
2. On GitHub, delete the token `skellycertify-relay-test`.
3. Send the copy again. Success: `HTTP 200` with `"duplicate":true`.
4. Clean up with [step 20](#20-clean-up-after-the-test) of Part 1. Switch test mode off there.

To stop the app later: on GitHub, open **Settings** > **Applications** > **Installed GitHub Apps**,
click **Configure** next to the app and click **Uninstall**. To change the key, generate a new key,
set it with step 4 and delete the old key on the app page.

---

# A custom domain later

The `workers.dev` address is enough. A custom domain needs a domain on your Cloudflare account.

1. Add the domain to Cloudflare.
2. In `wrangler.jsonc`, add:

   ```jsonc
   "routes": [{ "pattern": "relay.example.org", "custom_domain": true }],
   "workers_dev": false
   ```

3. Run `npx wrangler deploy`.
4. Give the new address to the app developers. Keep the old address until the app uses the new one.

---

# Troubleshooting

| Answer | Cause | Fix |
|---|---|---|
| 503 `relay-misconfigured` | A secret or a Rate Limiting binding is missing, or only some app secrets are set. | Run `npx wrangler secret list`. Check `ratelimits` in `wrangler.jsonc`. |
| 503 `credential-rejected` | GitHub refused the token or the app: expired, revoked, wrong repository or a missing permission. | Rotate the token (step 19), or check the app permissions and installation. |
| 503 `github-rate-limited` | GitHub limits the token or the app. | Wait for `Retry-After`. Check for a flood of sends. |
| 503 `github-unavailable` | GitHub failed, or two different reports wrote to `inbox` at the same time. | Retry later. Check `https://www.githubstatus.com`. |
| 503 `daily-cap` | 200 `certify-report` issues created today (UTC). | Wait until 00:00 UTC. Check the issues for a flood. |
| 503 `relay-off` | `RELAY_ENABLED` is not `"true"`. | Set it to `"true"` and deploy. |
| 429 `rate-limited` | More than 2 POSTs from one address in 60 seconds. | Wait for `Retry-After`. |
| 429 `busy` | More than 10 POSTs from all senders in 60 seconds. | Wait for `Retry-After`. Check for a flood. |
| 422 `privacy-rule` | A privacy rule fails. `detail` is the rule number. | The writer (the package or the app) must fix the file. |
| 422 other codes | The file does not obey the format. | The writer must fix the file. |
| 503 `internal-error` in `wrangler dev` | Another local run holds `.wrangler/`. | Stop the other run, or use `--persist-to`. |
| 415 `wrong-type` | The `Content-Type` is wrong. | Send `text/markdown; charset=utf-8`. |
| 413 `too-large` | The file is larger than 262,144 bytes. | Use the issue form. |
| The issue has no labels | The credential has no push access to the repository. | Check the Contents permission. |
| `wrangler dev` fails at start | The port is busy. | Use `--port` with a free port. |

## Limits of this design

- The two bindings count in each Cloudflare location separately, and their counts are approximate
  (Cloudflare documentation). A sender that reaches more than one location gets more POSTs. A
  burst can pass a few more POSTs than the limit before the counts agree.
- The worst case for one sender in one location is 2 POSTs in each 60 seconds: 120 in one hour.
  The daily cap limits all new reports together to 200 in one UTC day.
- The daily cap counts issues on GitHub. Two new reports at the same moment can both pass at 199.
  An issue from the issue form counts too. A `certify-report` issue that somebody deletes stops
  counting.
- Two identical sends at the same moment can make two issues. A retry after the first answer
  never does.
- The relay looks for a lost issue by its marker in the 100 newest issues. An issue older than that
  with no `.issue` file gets a second issue.
