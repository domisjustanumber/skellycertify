# VV80 — Format 1.5.0: the summary group `component`, the frame set of a benchmark, a four-part number in the Markdown

**Status:** absorbed into [`report-format.md` 3.4](../../report-format.md#34-check),
[3.6](../../report-format.md#36-example-skellytracker), [3.7](../../report-format.md#37-summary),
[4.2](../../report-format.md#42-layout), [6](../../report-format.md#6-privacy-rules),
[8](../../report-format.md#8-versioning-of-the-format),
[`relay/README.md` The issue](../../relay/README.md#the-issue), 2026-11-21 (direct commit to
`main`). Accepted 2026-11-21 (owner).

## Decision

The format version is 1.5.0. The schema id is `skellycertify.report/1.5.0`. It is one minor change:

1. The new summary group `component` gives the result of a check of a part of the software that is
   not an execution provider, a GPU JPEG decode, a camera or a benchmark. Examples: the check of the
   MediaPipe library in skellytracker (item `name` `MediaPipe`), and the checks of the own module
   of the freemocap app (build identity, child process, imports, data folder, install facts,
   Blender).
2. A `component` item has the fields of an `ep` item. Its `device` must be `null`. Its `result`,
   the `reason` of `skipped` and the optional `gate` obey the rules of each other item. There is no
   new result value.
3. The Markdown part shows the `component` items in the component table `| Module | Result |`,
   directly after the benchmark table. The table is absent when no module has a `component` item.
   The `Module` cell is the item `name`. The `Result` cell uses the display words of the GPU table.
   The later parts of the layout get the next numbers.
4. `ms_per_frame` of a `benchmark` item is the time to process one frame set: one frame of each
   camera of the stage. The name of a stage with more than one camera gives the count of cameras,
   for example `pipeline-3` is three cameras. `fps` is 1000 / `ms_per_frame`: the frame sets in one
   second. The table header `ms/frame` does not change.
5. A real value can hold a string that looks like an IPv4 address, for example an OS label, the
   name of a CPU, a GPU or a camera, a version or a check name. Privacy rule 20 refuses such a
   string in the Markdown part. So in the Markdown part only, each sender prints each match in a
   value with each dot replaced by a space, again until no match is left. The JSON block keeps the
   exact value. The relay prints the issue values in the same way, so the issue agrees with the
   file.

[`report-format.md`](../../report-format.md) states each rule in full.

## Reason

- The owner decided the three points. skellytracker has a check of the MediaPipe library, and the
  freemocap app has checks of its own module. No existing group fits them: an `ep` item names an
  execution provider, and the GPU table would show them as EPs.
- `device` is `null` because a component is software, not a device.
- The text of 3.7 said "the time for one frame". skellytracker measures one call with one frame of
  each camera (3.6). The two texts did not agree for a stage with more than one camera.
- Without a rule for the sender, a real value such as a camera name with a four-part number makes
  the relay refuse the whole report by rule 20.

## Consequences

- Section 8 names no step for a new value of `group`. The new group `benchmark` of 1.3.0 was a
  minor change, and an item of a new group does not change the meaning of an item of another
  group. So this is a minor change.
- The relay accepts `component` items and shows the component table. The live relay does not have
  this code yet. It must be deployed.
- skellytracker and freemocap must write `component` items. Each sender must print a four-part
  number in the Markdown part as point 5 says.

## Alternatives rejected

- A `component` item with a `device`. A component is software. A device would make a second GPU
  table.
- New result values for a component. The validation of summary items stays the same for each
  group.
- A new table header `ms/frame set`. The owner keeps `ms/frame`. The text defines the frame set.
- A relay that refuses fewer IPv4 strings in the Markdown part. Rule 20 stops an accident with a
  real address. A sender can print each value without a match.

## Open work

[open-work.md](../open-work.md)
