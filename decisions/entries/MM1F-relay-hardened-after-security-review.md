# MM1F — The relay is hardened after a security review

**Status:** absorbed into [`report-format.md` 3.1](../../report-format.md#31-fields),
[3.3](../../report-format.md#33-host), [4.1](../../report-format.md#41-content),
[6](../../report-format.md#6-privacy-rules), [8](../../report-format.md#8-versioning-of-the-format),
[`relay/README.md` What the relay does](../../relay/README.md#what-the-relay-does),
[The issue](../../relay/README.md#the-issue),
[Answers for the app developers](../../relay/README.md#answers-for-the-app-developers),
[Limits](../../relay/README.md#limits),
[22. Costs and free-plan limits](../../relay/README.md#22-costs-and-free-plan-limits),
[Part 2: the GitHub App](../../relay/README.md#part-2-the-github-app),
[7. Protect the branch main](../../relay/README.md#7-protect-the-branch-main),
[Limits of this design](../../relay/README.md#limits-of-this-design),
[`review.md` 3](../../review.md#3-check-privacy), 2026-11-20 (direct commit to `main`). Accepted
2026-11-20 (owner).

## Decision

A security review of the relay found weak points. The owner agreed to each change below. The
relay is switched off until the change is live.

1. The relay builds the issue title and body before its first write to GitHub. An error in that
   step leaves nothing on GitHub. The printing helpers take only a string or a finite number. Each
   other JSON value prints as empty text. The relay checks the forms of `host` (3.3). Each optional
   field of `host` can be `null` when the writer does not know the value. `name` and `id` of a GPU
   stay required strings. A `null` prints as empty text.
2. The daily cap counts the commits of the relay on `inbox` today (UTC), not the issues: the
   report commits and the link commits. The relay finds them by the start of the fixed message,
   so the end of a message does not change the count. The limit is 400 commits, 2 for each of 200
   reports. So the issue for a file of an earlier day also counts. The commit is the first public
   write. Each path that writes checks the cap. The count fails closed.
3. A line of the Markdown part holds no `<`, `](`, `]:`, `://` or `www.` (privacy rule 17).
4. The note is a clean note (rule 18). The app makes the note clean before it shows the file to the
   person. The relay refuses a note that is not clean. It does not change the file. The issue
   breaks `www.` and `GH-<digits>` in each place, and it shows each note line in a code span.
5. The relay tests the length rule before the patterns. Each pattern costs linear time.
6. The per-sender limit runs first. Only a POST that passed it counts against the shared limit. The
   per-sender key is the /64 network of an IPv6 address and the full IPv4 address.
7. The relay sends no CORS header and answers `OPTIONS` with 404. It accepts only `text/markdown`.
8. No object of the JSON block has the same key two times (rule 19). The relay uses a small scanner
   over the JSON text. A check of each raw JSON line with the string rules is not correct: a
   writer can put the JSON on one long line, and a JSON escape can hide a character.
9. The lookup of a lost issue takes only an issue with the label `certify-report` that the app of
   the relay wrote (`performed_via_github_app.client_id`). With the token of Part 1, it takes none.
10. The relay accepts `created_utc` only in the current UTC year, the year before or the year after.
11. When GitHub answers 401 to the cached installation token, the relay drops the token.
12. No line of the Markdown part and no line of the note holds an IPv4 address (rule 20). The rule
    does not apply to other JSON values, because a version can have four numeric parts.
13. The documents state the known limits: the privacy rules stop accidents, not a sender who wants
    to publish personal data; an open relay can be flooded up to the daily cap; the app token can
    write to each branch, so `main` needs a branch rule that the app cannot bypass.

The schema id stays `skellycertify.report/1.4.0`, because no writer shipped 1.4.0 yet. The
documents in the status line state each rule in full.

## Reason

- The owner: "sanitize the user's notes to make sure there's nothing malicious. This must be done
  on the sender side and again in the relay."
- The relay commits the file byte for byte, and the hash of the file is its identity. So the relay
  cannot change a note. It can only refuse it. The app must clean the note, so that the person sees
  the exact text that is published.
- The commit is public before a person of the project reads the file. A failure after the commit
  left a public file with no issue. A cap that counted issues did not count such a file. A cap that
  counted only the report commits did not count a new issue for a file of an earlier day.
- A system tool can fail to give a value of `host`. The writer must then be able to send the report
  with `null` for that value.
- A report string reaches GitHub, which renders Markdown and makes links and references. The relay
  must keep each report string as plain text.

## Consequences

- freemocap must make the note clean before it shows the file, and must send `text/markdown`.
- A writer that prints `<private>` or `<path>` in the Markdown part gets a refusal. It must print
  the value without `<` and `>`.
- The relay must be deployed and switched on, with the approval of the owner.

## Alternatives rejected

- Store the file under a name that GitHub does not render. It changes the file name of the format,
  the review and the reports folder.
- A secret in the app. A public app cannot keep one.
- Check the Markdown part line by line against the layout. It is much more code for the same gain.

## Open work

[open-work.md](../open-work.md)
