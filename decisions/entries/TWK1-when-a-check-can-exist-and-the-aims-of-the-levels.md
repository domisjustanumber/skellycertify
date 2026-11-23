# TWK1 — When a check can exist, the level of a check, the aims of the two levels and the one order rule

**Status:** absorbed into [`report-format.md` 2.7](../../report-format.md#27-the-two-levels),
[5.6](../../report-format.md#56-when-a-check-can-exist-and-its-level),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

**When a check can exist.** A package can create a check only when each of these statements is
true:

1. The answer can be different on a different system or hardware. Else the test is a normal test
   of the test suite of the package (CI), not a certify check.
2. The answer changes something: a verdict, a notice to the person, or what a developer fixes.
3. The check runs the code path of the product, not a second implementation.
4. The check can ask the person for a specific setup, but only after a second opt-in of the
   person ([ADR-974S](974S-format-1-8-0-second-opt-in-for-a-setup.md)). With no yes, the check does
   not run.
5. The check cannot spoil the run: it has a time limit, a failure gives a reason code and never a
   crash, and it puts back each thing that it changed.
6. Its result holds no private data and fits the format: fixed words, numbers and reason codes.
7. The check is in the specification of the package with its test before the code exists: the
   name, the pass rule or `record-only`, the numbers and the reason codes.
8. A `record-only` check names in the specification of the package the question that it will
   answer, and what turns it into a judged check or removes it.

**The level of a check.**

1. `quick` only when each of these is true: it answers "does this work at all"; it cannot block a
   device (it adds nothing to `risks`); it downloads nothing; it fits in the part of the 2 minutes
   that the package uses; it needs no setup from the person.
2. Else `full`.
3. A check that can block a device runs at the level `full`, after the safe checks.
4. A check with no pass rule is `record-only` at each level.
5. A check of an experimental method (its answer is not yet verified on that system) runs only at
   the level `full`, where its failure cannot spoil the rest of the run. It reports its own result.

**The aims of the levels.** `quick` is a smoke test: does it work at all. `full` shows how well
things perform, finds gaps in the logic and records the errors. Its result either signs off the use
of the path in production, or gives a developer the information to fix the issues in a later
release.

**The order.** The format has one order rule: a check that can block a device must run after the
safe checks. The rest of the order stays a recommendation. The level `full` keeps few fixed rules,
and the owner can still make them tighter.

The schema id is `skellycertify.report/1.8.0` ([ADR-974S](974S-format-1-8-0-second-opt-in-for-a-setup.md)).
These rules change no field, no allowed value and no check of the relay. They land in the same
step as 1.8.0, so section 8 lists them as changes of the text in 1.8.0.

## Reason

- The owner decided each point. The owner said that these rules must go into the specification of
  skellycertify.
- Each package adds its own checks ([5.5](../../report-format.md#55-how-a-package-adds-a-check)).
  With no common rule, a package can add a check that gives the same answer on each system, or a
  check that a person cannot use.
- A check that can block a device and that runs early can stop the safe checks of the run. The
  results of the safe checks are then lost.

## Alternatives rejected

- A list of allowed checks in this repository. [ADR-98KC](98KC-how-a-package-adds-a-check.md)
  rejected it: the package owns its check names.
- A fixed order for all checks. Only the order of a check that can block a device must be fixed.
  The packages know the value of their other checks best.

## Open work

[open-work.md](../open-work.md)
