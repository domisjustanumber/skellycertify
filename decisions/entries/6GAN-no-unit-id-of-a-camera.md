# 6GAN — No unit id of a camera in a report

**Status:** absorbed into [`report-format.md` 6](../../report-format.md#6-privacy-rules),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

This entry supersedes [ADR-YHW7](YHW7-camera-unit-id-allowed-fact.md) in full.

The local unit id of a camera is not an allowed fact. The exception of
[ADR-YHW7](YHW7-camera-unit-id-allowed-fact.md) is removed. The
allowed facts of [section 6](../../report-format.md#6-privacy-rules) identify a model, not one unit,
with no exception. skellycam writes no unit id, also not `details.cameras[].unit_id`.

These rules of [ADR-YHW7](YHW7-camera-unit-id-allowed-fact.md) stay. [Section 6](../../report-format.md#6-privacy-rules) states them:

- The serial number, the device path and the camera id of the OS of a camera are not in a report.
- Rules 1 to 20 do not change.

The relay does not change. It never checked the unit id.

The schema id stays `skellycertify.report/1.7.0`. This is a patch change by
[section 8](../../report-format.md#8-versioning-of-the-format): it fixes the text of the document
and changes no field, no allowed value and no check of the relay. No package wrote the unit id. The
owner decided it on 2026-11-23.

## Reason

- skellycam now writes no unit id. So no package uses the exception.
- With no exception, the reviewer does not check the form and the place of a unit id.
