# M8J1 — The two levels `quick` and `full` are defined

**Status:** absorbed into [`report-format.md` 2.7](../../report-format.md#27-the-two-levels),
2026-11-20 (direct commit to `main`). Accepted 2026-11-20 (owner).

## Decision

The level `quick` of each package must obey three rules:

1. The whole quick run takes no more than 2 minutes. The limit is for all packages together when an
   app runs each package in one run. A package that runs alone has the same limit.
2. The quick run downloads nothing. Each file that it needs is in the package at install time.
   `certify_plan("quick")` returns an empty `downloads` list.
3. The quick run shows that a recording, a realtime pipeline session and a post-hoc session can at
   least start and run, for each of these that the package has.

The level `full` is open. It can download the files that its plan names, with the consent of the
user. It can take longer and run full benchmarks. The format sets no limit for `full`.

The version stays 1.2.0. No field changes. The format adds no time budget and no reason code. A
check that runs too long already gets `timed-out`
([2.5](../../report-format.md#25-runtime-rules)).

## Reason

- A user must be able to run `quick` at any time, with no wait and no download.
- A test can check rule 2: the plan has no `downloads`.
- The old text said "takes seconds" and "takes minutes". It gave no limit that a package can test.

## Consequences

- Each package must check its quick run against the three rules. [open-work.md](../open-work.md)
  gives this work.

## Alternatives rejected

- A limit of 2 minutes for each package. An app with three packages would then take 6 minutes.

## Open work

[open-work.md](../open-work.md)
