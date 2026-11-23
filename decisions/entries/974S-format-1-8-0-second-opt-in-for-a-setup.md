# 974S — Format 1.8.0: the second opt-in of the person for a setup check, and a declined setup is not `partial-run`

**Status:** absorbed into [`report-format.md` 2.2](../../report-format.md#22-arguments),
[2.6](../../report-format.md#26-the-plan-function),
[5.3](../../report-format.md#53-common-reason-codes), [7.1](../../report-format.md#71-validity),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

The format version is 1.8.0. The schema id is `skellycertify.report/1.8.0`. It is one minor change.

A setup check needs a specific setup from the person, for example a certain light or a plug moved.
It runs only after a second opt-in of the person:

1. `certify_plan()` can return the optional list `setups`. No list or an empty list means no setup
   check. Each item has `id` and `text`. `id` is a fixed code of the package. It matches the
   pattern of a reason code ([5.2](../../report-format.md#52-reason-codes)), and it is unique in the
   plan. `text` is one fixed sentence that tells the person what to arrange. The example of 2.6
   has an empty list.
2. The plan of a quick run must have an empty `setups` list. A setup check runs only at the level
   `full`.
3. The package names in its documentation the setup that each setup check needs.
4. The app shows each setup as its own yes/no question, before the run, apart from the consent to
   the full run.
5. `certify()` and `certify_plan()` of each package must accept the keyword-only option
   `setups=None`, as `abandon` and `test_media_dir`: the `id` of each setup that the person
   accepted. `None` or an empty list means none. With the option, `total` and `seconds_estimate` of
   the plan count only the checks that will run. The `setups` list of the plan still holds each
   setup of the level.
6. A setup check whose setup is not in the list does not run. It is `not-run` with the existing
   common code `not-selected`. The format adds no reason code.
7. A declined setup does not make the run `partial-run`. The other checks still count as evidence.
8. A roll-up check that requires a setup check that did not run is not `pass`, by the existing rule
   of [3.4](../../report-format.md#34-check). A summary item whose `gate` is that roll-up check then
   gives no reviewed row, by the existing rule of
   [7.2](../../report-format.md#72-kinds-of-evidence). When the other checks of the item passed,
   the item is `partial` ([3.7](../../report-format.md#37-summary)).

[`report-format.md`](../../report-format.md) states each rule in full.

## Reason

- The owner decided each point. A setup check needs a thing that only the person can do. A yes to
  the full run does not tell that the person will do it.
- A declined setup is a choice of the person, not a gap in the run. The other checks still give
  evidence. Only the item that needs the setup check stays unsigned.
- The smallest form: one optional list in the plan and one option. The report gets no new field and
  no new code, because `not-run` with `not-selected` already tells that the person did not select
  the check.

## Consequences

- This is a minor step ([section 8](../../report-format.md#8-versioning-of-the-format)): it adds an
  optional field of the plan and an option, as `abandon` did in
  [ADR-9FHP](9FHP-format-1-6-0.md).
- The plan is not part of a report. The relay accepts each schema id of major version 1, so the
  relay does not change.
- Each package must accept `setups`, return `setups` in its plan and write the schema id 1.8.0. The
  app must ask the second question.

## Alternatives rejected

- A new reason code for a declined setup. `not-selected` already has that meaning.
- A new result of a summary item for a declined setup. `partial` and the rule of the `gate` already
  keep the item unsigned.
- The setups as items of `questions`. The app asks the questions after the run, and a setup must be
  accepted before the run.
- The pattern of a check name for `id`. A setup id is a fixed code, as a notice code is.

## Open work

[open-work.md](../open-work.md)
