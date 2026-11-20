# D1PW — Format 1.3.0: new results, benchmarks, module labels, incomplete runs and test media

**Status:** absorbed into [`report-format.md` 2.5](../../report-format.md#25-runtime-rules),
[2.6](../../report-format.md#26-the-plan-function), [2.7](../../report-format.md#27-the-two-levels),
[2.8](../../report-format.md#28-the-test-media-folder), [3.4](../../report-format.md#34-check),
[3.5](../../report-format.md#35-section), [3.6](../../report-format.md#36-example-skellytracker),
[3.7](../../report-format.md#37-summary), [4.2](../../report-format.md#42-layout),
[5.3](../../report-format.md#53-common-reason-codes), [7.1](../../report-format.md#71-validity),
[7.2](../../report-format.md#72-kinds-of-evidence),
[8](../../report-format.md#8-versioning-of-the-format),
[`review.md` 4](../../review.md#4-check-validity), 2026-11-20 (direct commit to `main`).
Accepted 2026-11-20 (owner).

## Decision

The format version is 1.3.0. The schema id is `skellycertify.report/1.3.0`. It is one minor change:

1. A summary item has the results `pass`, `fail`, `record-only`, `partial` and `skipped`. A
   `skipped` item has `reason`: `busy` or `reviewed`. Each other result has no `reason`, or `null`.
   The display is `partial`, `skipped (busy)` and `skipped (already reviewed)`. A `partial` or
   `skipped` item never gives a reviewed row.
2. The common reason code `cameras-busy`: the package refused the run because it cannot get the
   cameras. One camera that another program holds is not a refused run. Its item is `skipped` with
   `busy`.
3. A check and a section have the optional field `module`. The table of the failed checks is
   `| Package | Module | Test | Reason |`.
4. The summary group `benchmark` has `name`, `device`, `stage`, `ms_per_frame` and `fps`, with no
   `result`. The Markdown shows the table `| GPU | Module | Stage | ms/frame | FPS |` after the GPU
   table.
5. The common reason code `interrupted`: the process ended early, and the report was written later.
   The header shows `incomplete` for `cancelled` and `interrupted`.
6. `certify()` and `certify_plan()` accept `test_media_dir=None`. The test media folder holds the
   files by their SHA-256. The app cleans it after a successful full run.
7. Each plan download has `source` and `sha256`. The package checks the hash.
8. There is one `camera` item for each camera model, not for each unit.
9. The format recommends an order for a full run: the tests of most value first. It is not a rule.

[`report-format.md`](../../report-format.md) states each rule in full.

## Reason

- A run on a real system can skip an item or test it only in part. The results `pass`, `fail` and
  `record-only` could not show this.
- The failed checks table must show the tested part, not only the check name.
- The benchmark figures are the main result of a full run for a person.
- An app can end during a run. The person must see that the report is incomplete.
- Two packages can need the same test file. One shared folder keeps one copy.

## Consequences

- By the rules of [8](../../report-format.md#8-versioning-of-the-format), a new value of `result`
  changes the meaning of a field. The owner made it a minor change, because the relay is the only
  reader that checks the values and it changed in the same step. No report with `summary` was
  accepted as evidence before.
- skellytracker, skellycam and freemocap must write the new fields. The relay must be deployed.

## Alternatives rejected

- A result `in-use` only for cameras. The owner refused it. `skipped` with `busy` serves cameras and
  GPUs.
- A major version 2.0.0. Each existing reader would refuse the new files for no gain.
- A rule for the order of a full run. The format has no opinion. It only recommends value first.

## Open work

[open-work.md](../open-work.md)
