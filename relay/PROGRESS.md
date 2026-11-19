# Relay setup progress

Last update: 2026-11-19. This file is a handover note for the relay set-up in [README.md](README.md). Part 1 and Part 2 are
done. Delete it when the open points are closed.

## State

- The relay is deployed and switched on, with test mode off:
  `https://skellycertify-relay.dom-dd0.workers.dev` (version `2e6e0b63-174a-4c79-b291-e49667ce0b65`,
  Wrangler 4.157.0). `/health`: `enabled` true, `test_mode` false.
- A valid report now files a real issue. Do not send `samples/valid.md` or `samples/valid-quick.md`.
  For a connection test, send `samples/refused-format.md` (422, nothing on GitHub).
- The relay files as the GitHub App `skellycertify-relay[bot]`. Cloudflare secrets set:
  `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` and `RATE_SALT`.
  The personal token is deleted.
- Wrangler login has only `account:read`, `user:read`, `workers_scripts:write` and
  `offline_access`. Deploy and `secret list` work with these scopes.

## README steps

| Step | State |
|---|---|
| 1 to 8 | Done. |
| 9. Unit tests | Done: 62 pass, 0 fail (run again at the end). |
| 10. Local run with the fake GitHub | Done: 200 created, 200 duplicate, 429 `rate-limited`, 413, 404, 422 `privacy-rule` (detail 1), 422 `wrong-schema`. |
| 11. Deploy | Done. |
| 12. Health | Done: `enabled` true, `test_mode` true, `schema_major` 1. |
| 13. Send the sample | Done: 200, `duplicate: false`, issue 1. |
| 14. Issue and branch | Done through the GitHub API: labels `certify-report` and `relay-test`, author `domisjustanumber`, the body agrees with `samples/valid.md`, `inbox/test/` holds the `.md` and the `.issue` file. Not looked at in the browser. |
| 15. Same file again | Done: 200, `duplicate: true`, issue 1. |
| 16. Refused samples | Done: 422 `privacy-rule` (detail 1), 422 `wrong-schema`. GitHub still had only issue 1 and the `inbox` head `c907c8aa`. |
| 17. Off switch | Done: 503 `relay-off` with `false`, then `/health` `enabled` true again. |
| 18. Logs | Done: `wrangler tail --format pretty` works with the reduced scopes. It shows the request line (method, URL, status) and the relay log line. No headers or report text seen. |
| 19. Token rotation | Not necessary now. |
| 20. Clean up | Done: issue 1 closed as not planned, `inbox/test/` deleted, `TEST_MODE` `"false"` deployed. |
| Part 2 (GitHub App) | Done 2026-11-19: in test mode, issue 2 and two commits came from `skellycertify-relay[bot]`. Issue 2 is closed and the test files are deleted. The permissions of the app and its one repository were not checked through the API. |

## Next

1. freemocap sends the first real report when its hand-in UI exists.

Live checks: 413 (262,145 bytes) and 404 (unknown route) work. The live 429 works, but late: of 12
POSTs of `samples/refused-format.md` in one second, the first 8 got 422 and the last 4 got 429
`rate-limited` with `Retry-After: 60`. Three POSTs in a row did not reach the limit. Cloudflare
counts with a delay. The daily cap of 200 is the hard limit.

## Things that exist now and need clean-up later

- Issues 1 and 2 in `domisjustanumber/skellycertify` are closed (not planned). They keep the label
  `relay-test`.
- The branch `inbox` exists and holds no files. Keep it or delete it. The relay makes it again.
- `relay/.dev.vars` with the fake local values. Git ignores it. The README says to delete it.

## Open points

- Format 1.1.0 (2026-11-19): a module report can have an `id` (a version 4 UUID), and a file can
  hold several module reports of one package. The relay checks the `id` and shows it in the issue.
  skellytracker must still write the `id`, use it as its report id, and add `pack_version` for each
  pair. The session `skellytracker-6c` has these decisions.
- The skellytracker level `full` is in the format (3.6), from skellytracker commit `03e5b3bb`.
  `review.md` section 4 step 3 now asks for a `pass` in the check `<label>` (probe and image) for an
  EP with the status `field-test`. Before, it asked for a pass in the old sections 3 and 4. The
  owner must confirm that this rule is as strict as the old one.
- The subdomain stays `dom-dd0` (decision of 2026-11-19). Step 4 of the README advises a neutral word that does not identify
  you. To change it, see the link in step 11. A change also changes the relay address.
- The deploy warns that Preview URLs are disabled. This is intended: `preview_urls` is `false`.
- The README steps for the dashboard (**Compute** > **Workers & Pages**) and for the reduced login
  scopes were rewritten in this session. The subdomain prompt of `wrangler deploy` did not appear,
  because the account already had a subdomain. That text comes from the Wrangler source only.

## Note for a Copilot session

The terminal tool starts in the repository root and drops `cd`. `npx wrangler` then offers to
download an unpinned Wrangler. Use the pinned one by its path:
`node relay\node_modules\wrangler\bin\wrangler.js <command> --cwd relay`.
