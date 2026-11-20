# MC7T — Format 1.2.0: the `summary` field and a short summary for a person

**Status:** absorbed into [`report-format.md` 1](../../report-format.md#1-terms),
[3.1](../../report-format.md#31-fields), [3.6](../../report-format.md#36-example-skellytracker),
[3.7](../../report-format.md#37-summary), [4.2](../../report-format.md#42-layout),
[6](../../report-format.md#6-privacy-rules), [8](../../report-format.md#8-versioning-of-the-format),
2026-11-20 (direct commit to `main`). Accepted 2026-11-20 (user).

## Decision

1. This change is format version 1.2.0. It adds an optional field, so it is a minor change. A
   reader of major version 1 still accepts a file of 1.1.0 or 1.0.0, and a file in the earlier
   Markdown layout.
2. The Markdown part of a report file holds only a short summary for a person: the header, the
   system, the EP table, the cameras, the failed checks, the note, then `## Data` and the JSON block.
   [4.2](../../report-format.md#42-layout) gives the layout. The rules for a reader do not change.
3. A module report has the optional field `summary`, a list of items with `group`, `name`, `device`
   and `result` ([3.7](../../report-format.md#37-summary)). The package that ran the checks fills
   it. A writer and the relay print the items. They do not compute them from `checks`.
4. The result of an `ep` item is the result of the row of the pair
   ([3.6](../../report-format.md#36-example-skellytracker)). The package decides the result of a
   `gpu-jpeg` item.
5. The JSON keeps each name as the OS or the driver gives it. A writer shortens a name only for
   display ([4.2](../../report-format.md#42-layout)).
6. A camera name holds no name of a person. The writer removes it before the report exists (rule 16
   of [section 6](../../report-format.md#6-privacy-rules)).
7. The text of a report and of `report-format.md` uses "system", not "machine", for the computer of
   the run ([section 1](../../report-format.md#1-terms)).
8. The issue of the relay will show the same summary, built from the JSON block and never from the
   Markdown. The issue title will use the short names, `FMC` for freemocap, `Win` for Windows and
   `Mac` for macOS. Other package names stay in full. Example:
   `[certify] skellytracker 2024.9.1019 · Win 11 26H2 · NVIDIA RTX 3070, Intel UHD 770`.
   [open-work.md](../open-work.md) gives this work.

## Reason

- A person reads the file before "send" ([4.1](../../report-format.md#41-content)). A short summary
  tells at a glance which EP works on which GPU and which camera works. The JSON block stays the
  data.
- The package that ran the checks knows which check gives the result of an EP. So the package
  writes the result in `summary`, and the relay only prints it.
- The names from the driver are long. Short names fit in a table and in an issue title. The JSON
  keeps the full names for the reviewer and for tools.
- A device name such as `<name>'s iPhone Camera` holds a first name. The relay cannot find a first
  name in free text. Only the writer can take the model string of the device.

## Consequences

- The writers in skellytracker, skellycam and freemocap must write `summary` and the new layout.
- The relay must build the issue body and the title from the JSON block. Until then, the issue
  shows the earlier body and title.
- Each writer implements the display names in its own code. There is no shared code package.

## Alternatives rejected

- Teach the relay the check names of each package. A rename of a check in a package breaks the
  relay.
- Split the JSON into a second file. Two files can arrive that do not belong together. One file has
  one hash, and it is one thing for the person to read before "send".
- Put the JSON in a collapsed HTML `details` block. A report then holds HTML, and the privacy rules
  check each line of the Markdown.

## Open work

[open-work.md](../open-work.md)
