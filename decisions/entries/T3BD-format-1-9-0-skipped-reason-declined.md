# T3BD — Format 1.9.0: the `skipped` reason `declined`

**Status:** absorbed into [`report-format.md` 2.6](../../report-format.md#26-the-plan-function),
[3.7](../../report-format.md#37-summary), [4.2](../../report-format.md#42-layout),
[7.2](../../report-format.md#72-kinds-of-evidence),
[8](../../report-format.md#8-versioning-of-the-format),
[`relay/README.md` The issue](../../relay/README.md#the-issue), 2026-11-23 (direct commit to
`main`). Accepted 2026-11-23 (owner).

## Decision

The format version is 1.9.0. The schema id is `skellycertify.report/1.9.0`. It is one minor change:

1. A summary item with the result `skipped` can have the new reason `declined`. It tells that the
   person declined each setup that the checks of the item need, so no check of the item ran
   ([2.6](../../report-format.md#26-the-plan-function), "Setups").
2. An item of the groups `ep`, `gpu-jpeg`, `camera` and `component` can have `declined`. A
   `benchmark` item has no `result` and no `reason`, so it cannot have it.
3. When a check of the item ran, the item does not have `declined`. When the other checks of the
   item passed, the item stays `partial`, as
   [ADR-974S](974S-format-1-8-0-second-opt-in-for-a-setup.md) says.
4. The display is `skipped (declined)`. `busy`, `reviewed` and `not-installed` do not change.
5. A `skipped` item never gives a reviewed row
   ([7.2](../../report-format.md#72-kinds-of-evidence)). Its `not-run` checks get no row in the
   table of the checks that did not pass ([4.2](../../report-format.md#42-layout) part 8). These
   rules do not change.

[`report-format.md`](../../report-format.md) states each rule in full.

## Reason

- The owner decided each point.
- [ADR-974S](974S-format-1-8-0-second-opt-in-for-a-setup.md) gives a declined setup check `not-run`
  with `not-selected`. It gives no result for an item whose only checks are declined setup checks.
  `partial` tells that some checks passed, and none ran. `busy`, `reviewed` and `not-installed` do
  not tell that the person declined.
- ADR-974S rejected a new result of a summary item. This entry adds a reason of the existing result
  `skipped`, not a new result. The other rules of ADR-974S stay.

## Consequences

- This is a minor step ([section 8](../../report-format.md#8-versioning-of-the-format)): it adds an
  allowed value, as `not-installed` did in [ADR-9FHP](9FHP-format-1-6-0.md).
- The relay accepts the reason `declined` for each group with a result, and shows
  `skipped (declined)`. The live relay does not have this code yet. It must be deployed.
- Each package must write `declined` for such an item and write the schema id 1.9.0. The app must
  print `skipped (declined)`.

## Alternatives rejected

- No summary item for an item whose only checks are declined setup checks. The item then goes out of
  the issue, and the person sees no word for it.

## Open work

[open-work.md](../open-work.md)
