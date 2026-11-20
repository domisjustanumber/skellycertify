# F1KN — Format 1.2.0: the Markdown layout is revised

**Status:** absorbed into [`report-format.md` 4.2](../../report-format.md#42-layout),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-20 (direct commit to `main`).
Accepted 2026-11-20 (user).

## Decision

This entry supersedes [ADR-MC7T](MC7T-format-1-2-0-summary-for-a-person.md) in full. The version
stays 1.2.0. The JSON and the field `summary` do not change.

1. The Markdown part has one system list for the whole file: `- OS: …`, `- CPU: …`, `- RAM: …`. It
   has no `- GPU:` line, no list for each module and no `<package> <version>:` line. Each value comes
   from the first module in `modules` whose `host` has that key.
2. The table `| EP | GPU | Result | GPU JPEG |` is replaced by the table
   `| GPU | Module | Result |`. Here `Module` means the tested part (an EP or a GPU decode), not a
   module report. A `gpu-jpeg` item is its own row, `<name> GPU decode`, under its `ep` row. A GPU
   that no `ep` item names has one row with `not checked`. The CPU EP has `-` in the GPU cell. The
   VRAM is in the GPU cell. [4.2](../../report-format.md#42-layout) gives the full rules.
3. These rules of [ADR-MC7T](MC7T-format-1-2-0-summary-for-a-person.md) stay. A link states each of
   them:
   - The version is 1.2.0, and a reader of major version 1 accepts 1.1.0, 1.0.0 and the earlier
     Markdown layout ([8](../../report-format.md#8-versioning-of-the-format)).
   - A module report has the optional field `summary`. The package fills it. A writer prints the
     items and does not compute them ([3.7](../../report-format.md#37-summary)).
   - The result of an `ep` item is the result of the row of the pair, and the package decides the
     result of a `gpu-jpeg` item ([3.6](../../report-format.md#36-example-skellytracker)).
   - The JSON keeps each name as the OS or the driver gives it. A writer shortens a name only for
     display ([4.2](../../report-format.md#42-layout)).
   - A camera name holds no name of a person
     ([6](../../report-format.md#6-privacy-rules)).
   - The text uses "system", not "machine" ([1](../../report-format.md#1-terms)).
   - The issue of the relay shows the same summary, built from the JSON block. Its title uses the
     short names. [open-work.md](../open-work.md) gives this work.

## Reason

- One system block is shorter. The system is the same for each module in a normal file, and the
  GPU names are in the table.
- The GPU table shows each GPU with its tests in one place, also a GPU that no test used.
- The owner revised the layout the same day as [ADR-MC7T](MC7T-format-1-2-0-summary-for-a-person.md).
  No writer had shipped the first layout. So the version stays 1.2.0.

## Consequences

- A writer in skellytracker, skellycam and freemocap must write this layout, not the first one.
- The relay must build the issue from the JSON block with the same rows.

## Alternatives rejected

- Edit the body of [ADR-MC7T](MC7T-format-1-2-0-summary-for-a-person.md). That entry is on `main`,
  and the [Rules](../README.md#rules) allow only four edits of it.
- Raise the version to 1.3.0. No writer shipped 1.2.0, so no file in the first layout exists.

## Open work

[open-work.md](../open-work.md)
