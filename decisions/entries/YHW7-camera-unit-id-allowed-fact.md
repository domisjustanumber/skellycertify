# YHW7 — The local unit id of a camera is an allowed fact

**Status:** absorbed into [`report-format.md` 6](../../report-format.md#6-privacy-rules),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

The local unit id of a camera is an allowed fact
([section 6](../../report-format.md#6-privacy-rules)). It is the one exception to "a model, not one
unit". It has at most 8 lower-case hex digits, from a keyed hash of a value that identifies the unit
on that system. The key is random, stays in a local file and is never in a report. The id is `null`
when the package cannot use the key. It is only in `details` of a module report of a package that
checks cameras, for example `details.cameras[].unit_id` of skellycam. It is not in `summary`, not in
a check name and not in the Markdown part.

The serial number, the device path and the camera id of the OS stay forbidden. Rules 1 to 20 do not
change. The relay does not change: it cannot check where the id comes from, so this is a duty of the
writer. The reviewer checks the form and the place of the id.

The schema id stays `skellycertify.report/1.7.0`. This is a patch change by
[section 8](../../report-format.md#8-versioning-of-the-format): it fixes the text of the document
and adds no field and no allowed value. `details` is free-form already, and a reader of 1.7.0 and a
relay of 1.7.0 accept a report with the id.

## Reason

- A developer must compare two runs of one camera unit on one system, for example to find a unit
  that fails more than its model.
- The privacy cost is low:
  - The key never leaves the system, so the id links no report of one system to a report of another
    system.
  - The person can delete the key file, and the next run gives new ids.
  - The reports of one system are already linkable by their hardware list.

## Alternatives rejected

- A serial number. It identifies a unit everywhere, and rule 2 forbids it.
- An unsalted hash of the serial number. Anyone can compute it from the serial number, so it
  identifies the unit on each system.

## Open work

[open-work.md](../open-work.md)
