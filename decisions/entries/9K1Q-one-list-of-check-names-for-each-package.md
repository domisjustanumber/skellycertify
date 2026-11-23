# 9K1Q — One list of check names for each package

**Status:** absorbed into [`report-format.md` 5.7](../../report-format.md#57-the-list-of-check-names-of-a-package),
[5.5](../../report-format.md#55-how-a-package-adds-a-check),
[8](../../report-format.md#8-versioning-of-the-format),
[9](../../report-format.md#9-packages), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

[`report-format.md` 5.7](../../report-format.md#57-the-list-of-check-names-of-a-package) tells each
package to keep one list of all its check names. It adds these rules:

- Each package keeps the list in its own repository. The package owns the names. This repository
  holds no list.
- A name with a variable part is in the list in its template form, for example
  `<label>:usb3-trial`.
- Each entry gives the name and the level: `quick`, `full` or both. Only these two are required. A
  package can add more to an entry.
- A tool can read each entry of the list exactly. The list is in one place. The format sets no form
  for the list. [Section 9](../../report-format.md#9-packages) names the place of the list of each
  package.
- A new check goes into the list before its code, or in the same commit.
- The package must have two tests. First, each check name that a run writes matches an entry of the
  list. Second, each entry is known to the code of the package, or the list marks it as not built.

[5.5](../../report-format.md#55-how-a-package-adds-a-check) points to the new section for a new
check.

The schema id stays `skellycertify.report/1.9.0`. The change fixes and adds text of the document. It
changes no field, no allowed value and no check of the relay. The owner decided it on 2026-11-23.

## Reason

In one package the check names were in three places: the text of its specification, a catalogue in
its code and the rows that a run writes. Nothing held them together. A tool could not look a name up
exactly. A rename in the code would not be noticed.

## Alternatives rejected

- A list of the check names in this repository. The names belong to the package. Each new check
  would need a change here, as [ADR-98KC](98KC-how-a-package-adds-a-check.md) already decided.
- A fixed form for the list. The packages keep the list in different kinds of file.

## Open work

See [open-work.md](../open-work.md).
