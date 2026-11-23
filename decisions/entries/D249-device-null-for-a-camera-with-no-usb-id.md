# D249 — `device` is `null` for a camera with no USB id

**Status:** absorbed into [`report-format.md` 3.7](../../report-format.md#37-summary),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

A `camera` summary item of a camera with no USB id has `device` `null`. Its name is
`Camera (no USB id)` (rule 16 of [section 6](../../report-format.md#6-privacy-rules)). The `device`
row of the table in [3.7](../../report-format.md#37-summary) states the rule. The relay already
accepts `null`.

The schema id stays `skellycertify.report/1.10.0`. The change fixes text of the document. It changes
no field, no allowed value and no check of the relay. The owner decided it on 2026-11-23.
[Section 8](../../report-format.md#8-versioning-of-the-format) lists it in the 1.10.0 item.

## Reason

A camera with no USB id has no `vvvv:pppp` to write. The format did not say what `device` holds in
this case. The camera table of [4.2](../../report-format.md#42-layout) prints `name` and `result`
only, so it does not change.

## Alternatives rejected

- A fixed text such as `none` in `device`. A reader would have to know one more word.

## Open work

See [open-work.md](../open-work.md).
