# ZW66 — What a check writes, the two aims of both levels and the exact count of `total`

**Status:** absorbed into [`report-format.md` 2.6](../../report-format.md#26-the-plan-function),
[2.7](../../report-format.md#27-the-two-levels),
[3.6](../../report-format.md#36-example-skellytracker),
[4.2](../../report-format.md#42-layout),
[5.7](../../report-format.md#57-the-list-of-check-names-of-a-package),
[5.8](../../report-format.md#58-what-a-check-writes),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

**The aims of both levels.** The levels `quick` and `full` both have two more aims. The report leaks
no data of the user. The report is short, with no row that carries no information.

**What a check writes.** The new section 5.8 gives eight rules for each package:

1. A report has no row for a check that the device, the EP or the component of that row can never
   have. `not-run` is only for a check that the item can have at the level of the run and that did
   not run.
2. A test whose result cannot differ between two labels of one run runs one time. It is in the
   report one time.
3. A check that catches an error writes the class name of the exception and the error number of
   the OS or of the library as a number. It never writes the message text.
4. A check that fails on one item of a series writes the index of that item and the numbers of
   that item, not of the first item.
5. A report records the version of each runtime that a check result depends on, in `details`.
6. A value that is the same in each row of a run is in `details` one time. A derived value is not
   beside its inputs. A number has no more digits than its meaning needs.
7. The pass limit of a judged number is in the report one time.
8. An experimental check runs only on the device classes that the package names for it. Its entry
   in the list of check names (5.7) gives these classes.

**`total`.** `total` of the plan keeps its meaning. It is the count of the rows that the run plans to
write in `checks`. A roll-up check is a row.

[`report-format.md`](../../report-format.md) states each rule in full. These rules change no field,
no allowed value and no check of the relay. They land in the same step as format 1.10.0
([ADR-2EXP](2EXP-format-1-10-0.md)), so section 8 lists them as changes of the text in 1.10.0.

## Reason

- The owner decided each point.
- A full report of one package on one system had 368 checks. 214 of them carried no information.
  The real findings were hidden in the record rows.
- The text of a report must not leak data of the user. A class name and an error number give a
  developer the error with no message text.
- A failure on frame 7 with the numbers of frame 0 tells the reader nothing about the failure.

## Consequences

- Some text of 3.6 and of 4.2 part 8 broke the new rules. It now agrees with 5.8:
  - 3.6 has no `not-gpu-ep` pair and no `gpu_decode` row of `no_gpu_decode_on_ep` for DirectML
    (rule 1).
  - A JPEG name with one result for each target is in the report one time (rule 2).
  - `frames`, `calls` and `speed_against_cpu` are not in `numbers` (rule 6).
  - The example has `max_abs_diff` `9.537e-07` (rule 6) and `details.versions.python` (rule 5).
- 4.2 part 8 no longer says that a system has many checks that cannot run on it.
- 2.6 tells what `total` does not count: a row that the run writes only after an event, and a
  setup check that the person did not accept. This keeps the rule of "Setups" that `total` counts
  only the checks that will run.
- Each package must apply 5.8 to its existing checks.

## Alternatives rejected

- `not-run` only for a check that must run. A check that the person did not select (`not-selected`)
  or that is not built (`not-built`) need not run, and it is still `not-run`. So rule 1 says "can
  have".
- A new field for the runtime versions. `details` already holds the facts of a package, and
  skellytracker already writes `details.versions`.

## Open work

[open-work.md](../open-work.md)
