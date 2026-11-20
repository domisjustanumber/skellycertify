# T191 — The gate of a summary item: a `partial` item can give a reviewed row

**Status:** absorbed into [`report-format.md` 3.7](../../report-format.md#37-summary),
[7.2](../../report-format.md#72-kinds-of-evidence),
[8](../../report-format.md#8-versioning-of-the-format),
[`review.md` 4](../../review.md#4-check-validity), 2026-11-20 (direct commit to `main`). Accepted
2026-11-20 (owner).

## Decision

1. A summary item of the groups `ep`, `gpu-jpeg` and `camera` can have the optional field `gate`.
   It is the `name` of one roll-up check ([3.4](../../report-format.md#34-check)) of the same
   module report. It matches the pattern of a check name. The package names it, for example
   `046d-085c:gate` for a camera. The relay refuses another form.
2. An item gives a reviewed evidence row when its `gate` check has the result `pass`, also when the
   result of the item is `partial`. The other rules of the `kind` stay
   ([7.2](../../report-format.md#72-kinds-of-evidence)).
3. A `partial` item with no `gate` gives no reviewed row, as before.
4. A `skipped` item never gives a reviewed row, with or without a `gate`.
5. The evidence row keeps each check of the item that did not pass. The package that owns the row
   defines the form of the row.
6. The `gate` does not change the displayed result. The summary still shows `partial`.

This entry changes rule 1 of [ADR-D1PW](D1PW-format-1-3-0.md) only for an item with a `gate`. The
other rules of ADR-D1PW do not change. The changed text in
[`report-format.md`](../../report-format.md) and [`review.md`](../../review.md) cites this entry
next to the changed rule, so this entry does not supersede ADR-D1PW
([Rules](../README.md#rules)). The schema id stays `skellycertify.report/1.4.0`, because no writer
shipped 1.4.0 yet.

## Reason

- The owner decided this on 2026-11-20, to fold it into format 1.4.0.
- For a camera model, native capture counts as verified when a named set of checks passes in a
  full run: the camera opens, the requested mode is granted, the frame rate is correct, the camera
  delivers native JPEG, the timestamps are correct, the frame sequence is correct, a short
  recording works, and no check hung or crashed.
- A failed control check (exposure, gain or focus) does not block it. The app then hides that
  control. Before this entry, such a failure made the item `partial`, and the model got no reviewed
  row.
- A roll-up check already gives the result of a named group of checks
  ([3.4](../../report-format.md#34-check)). The gate reuses it.

## Consequences

- skellycam must give each camera item a `gate` and name the checks that the gate check requires
  in its documentation.
- The reviewer reads the result of the `gate` check, not only the result of the item.

## Alternatives rejected

- Show `pass` for such an item. The person would not see that something did not work.

## Open work

[open-work.md](../open-work.md)
