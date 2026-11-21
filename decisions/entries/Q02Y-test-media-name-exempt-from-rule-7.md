# Q02Y — Format 1.7.0: the `name` of a `test_media` item is exempt from privacy rule 7

**Status:** absorbed into [`report-format.md` 3.9](../../report-format.md#39-test_media),
[6](../../report-format.md#6-privacy-rules),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-21 (direct commit to `main`).
Accepted 2026-11-21 (owner).

## Decision

The format version is 1.7.0. The schema id is `skellycertify.report/1.7.0`.

The `name` of an item of `test_media` ([3.9](../../report-format.md#39-test_media)) is exempt from
rule 7 of [section 6](../../report-format.md#6-privacy-rules). It can end with the extension of a
video file, for example `sample.mp4`. Each other rule applies to `name`. Rule 7 applies to each
other string of the report, also to the other fields of a `test_media` item and to the Markdown
part.

The exemption is only for an item that is directly in the `test_media` list of a module report. A
`test_media` list in another place, for example in `details`, has no exemption.

The relay does the same in `relay/src/privacy.js`.

## Reason

- A test media file is a known file of a package, and its SHA-256 is in the same item. It is not a
  camera file of the person.
- Without the exemption, a package cannot list a sample recording such as `sample.mp4`.

## Consequences

- This is a minor step ([section 8](../../report-format.md#8-versioning-of-the-format)). The change
  is not a text fix: a `name` that ends with `.mp4` was invalid in 1.6.0. It adds an allowed
  value, and the owner decided in [ADR-9FHP](9FHP-format-1-6-0.md) that a new allowed value is a
  minor step. A reader of 1.6.0 refuses such a report, so the schema id must tell the two apart.
- No package wrote 1.6.0 yet, so no writer must change twice. The packages write 1.7.0.

## Alternatives rejected

- A change inside 1.6.0. Section 8 has no rule for it, and the schema id would not tell a reader
  of 1.6.0 that the rule changed.
- An exemption for the whole `test_media` item. Only `name` needs it.

## Open work

[open-work.md](../open-work.md)
