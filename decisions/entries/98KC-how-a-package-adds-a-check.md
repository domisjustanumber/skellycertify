# 98KC — How a package adds a check, and who approves a change of the format

**Status:** absorbed into [`report-format.md` 5.5](../../report-format.md#55-how-a-package-adds-a-check),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

[`report-format.md` 5.5](../../report-format.md#55-how-a-package-adds-a-check) tells a package how
to add a check. It collects the rules of [3.4](../../report-format.md#34-check),
[3.7](../../report-format.md#37-summary) and [5.4](../../report-format.md#54-codes-of-a-package) in
one place, with links. It adds these rules:

- The package owns each of its check names. This repository holds no list of check names. The
  package defines the name in its own specification or documentation, in the same commit that adds
  the check.
- A new check, a new reason code of the package and a new notice code of the package need no change
  of this repository.
- A package writes a fact that has no field in the format in `details` or in `numbers`. Each other
  new field and each new allowed value is a change of the format. A package must not write it
  before the format defines it. The rule that a reader ignores a field that it does not know is for
  a reader. It does not let a writer add a field.
- A change of the format follows [section 8](../../report-format.md#8-versioning-of-the-format). It
  has a decision entry in this repository. When the relay checks the field or the value, the same
  change updates the relay and its tests, and the relay is deployed.
- The package (its maintainer or its agent) asks the owner of this repository for a change of the
  format. The request gives the field or the value, its type, its place in the report and one
  example. The owner of this repository approves each change of the format.

The schema id stays `skellycertify.report/1.7.0`. This is a patch change by
[section 8](../../report-format.md#8-versioning-of-the-format): it fixes the text of the document
and changes no field, no allowed value and no check of the relay. The owner decided it on
2026-11-23.

## Reason

- The rules for a new check were in three sections. A package maintainer or an agent did not know
  that a new check needs no change of this repository.
- The relay refuses a value that it does not know. A package that writes a new value before the
  format and the relay have it makes reports that the relay refuses.
- The format is the contract between all packages. One person must approve each change of it.

## Alternatives rejected

- A list of the check names of all packages in this repository. Each new check would then need a
  change here, and the list would not agree with the packages.
