# V1TR — Format 1.4.0: one check for each test, quick checks only unknown things, the plan total and risks, notices

**Status:** absorbed into [`report-format.md` 2.6](../../report-format.md#26-the-plan-function),
[2.7](../../report-format.md#27-the-two-levels), [3.1](../../report-format.md#31-fields),
[3.4](../../report-format.md#34-check), [3.6](../../report-format.md#36-example-skellytracker),
[3.7](../../report-format.md#37-summary), [3.8](../../report-format.md#38-notices),
[4.2](../../report-format.md#42-layout), [5.3](../../report-format.md#53-common-reason-codes),
[5.4](../../report-format.md#54-codes-of-a-package),
[8](../../report-format.md#8-versioning-of-the-format),
[`relay/README.md` The issue](../../relay/README.md#the-issue), 2026-11-20 (direct commit to
`main`). Accepted 2026-11-20 (owner).

## Decision

The format version is 1.4.0. The schema id is `skellycertify.report/1.4.0`. It is one minor change:

1. Each test is its own check. A check has exactly one result. `partial` is only for a summary
   item. A package must not put two or more tests into one check.
2. A roll-up check runs no test of its own and gives the result of a group. It is `pass` only when
   each check that it requires is `pass`. The package names these checks in its documentation. The
   pair check `<label>` of skellytracker is a roll-up check.
3. The common reason code `over-budget`: the check did not run because the time limit of the level
   was used up.
4. The level `quick` checks only things that are not yet reviewed. It must not run a check of an
   item that already has a reviewed pass. That item is `skipped` with `reviewed`. A quick run that
   checks nothing is correct. The level `full` can check known-good things, to measure this system.
5. The plan has `total` (the count of checks of the run) and `risks` (one fixed sentence for each
   thing that the run can do to a device). The app shows the `risks` at the consent. The plan of a
   quick run has an empty `risks` list. The app does not ask the person to run a level when the
   `total` of each package is 0.
6. The table `Checks that did not pass:` with `| Package | Module | Test | Result | Reason |`
   replaces the table of the failed checks. It lists each `fail` check, and each `not-run` check
   under a `partial` or `fail` summary item with the same name. It names the check, not the section.
   A failed section with no check of its own gets one row.
7. A module report can have `notices`: at most 50 items, each a `code` and optional `values`. A
   notice tells the person what to do after a run. It holds no free text. The app turns the code
   into text.

[`report-format.md`](../../report-format.md) states each rule in full.

## Reason

- The owner: "each test must be it's own row, so it's clear exactly what failed" and "a test either
  passes or fails so it's clear what exactly failed".
- The owner: "Quick is to check unknown things are safe to use. Full is for benchmarking 1) unknown
  things and 2) this system in particular" and "quick should never check things that are
  known-good. Full can check known good things to verify performance on this specific system."
- The owner: when no package has a check to run, "don't even ask the user to run the check". The
  app needs `total` for this.
- A run can make a device stop until it is replugged. The person must know this before the consent,
  and must know what to do after the run.

## Consequences

- The relay accepts `notices` and shows the new table. The live relay does not have this code yet.
  It must be deployed.
- skellytracker, skellycam and freemocap must write the new rules and fields.

## Alternatives rejected

- `partial` as the result of a check. A test then hides what failed.
- A row for each `not-run` check. A real report has more than 100 checks that cannot run on the
  system.
- Free text in a notice. The privacy rules could not check it.

## Open work

[open-work.md](../open-work.md)
