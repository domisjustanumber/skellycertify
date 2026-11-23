# 2EXP — Format 1.10.0: the field `seconds`, the benchmark header, memory in whole MiB and one check on each line

**Status:** absorbed into [`report-format.md` 3.1](../../report-format.md#31-fields),
[3.3](../../report-format.md#33-host), [4.2](../../report-format.md#42-layout),
[6](../../report-format.md#6-privacy-rules),
[8](../../report-format.md#8-versioning-of-the-format),
[`relay/README.md` The issue](../../relay/README.md#the-issue), 2026-11-23 (direct commit to
`main`). Accepted 2026-11-23 (owner).

## Decision

The format version is 1.10.0. The schema id is `skellycertify.report/1.10.0`. It is one minor
change:

1. A module report can have the optional field `seconds` at the top level: the length of the whole
   run of the package in seconds, a number of 0 or more. The relay refuses another form, also
   `null`. The issue does not show it.
2. The Markdown header of the benchmark table is
   `| GPU | Module | Stage | ms/frame set | Frame sets/s |`. The names of the fields
   `ms_per_frame` and `fps` do not change. The issue of the relay shows the new header.
3. A writer writes `memory_bytes`, `vram_bytes` and `shared_memory_bytes` in bytes, rounded down to
   a whole MiB (a multiple of 1,048,576). The relay does not refuse an exact value.
4. The writer of a report file prints each item of `checks` on one line of the data block. The
   writer chooses the layout of the rest of the block. A reader accepts each layout of valid JSON.

[`report-format.md`](../../report-format.md) states each rule in full.

## Reason

- The owner decided each point.
- No field of a module report gave the length of the whole run. `seconds` of a section
  ([3.5](../../report-format.md#35-section)) and `numbers.seconds` of a check give the time of one
  part only. `seconds_estimate` of the plan is an estimate.
- A benchmark item is for one frame set ([3.7](../../report-format.md#37-summary)). `ms/frame` and
  `FPS` read as the time of one frame of one camera.
- The exact count of bytes of the memory identifies one configuration more than a model. A whole
  MiB keeps the size and drops that detail.
- With one field on each line, a report of 368 checks is very long, and a reader cannot see one
  check at a time. One check on each line keeps the block short, and a diff shows each changed
  check.

## Consequences

- This is a minor step ([section 8](../../report-format.md#8-versioning-of-the-format)): it adds
  one optional field. The other changes are rules for a writer and a header of the layout.
- The relay checks `seconds` and shows the new header. The live relay does not have this code yet.
  It must be deployed.
- The samples of the relay are files of format 1.4.0. They keep the old header and their layout.
- Each package and the app must write these rules and the schema id 1.10.0.

## Alternatives rejected

- New field names for `ms_per_frame` and `fps`. That is a major change. The header alone gives the
  meaning to a person.
- A refusal of a memory value that is not a whole MiB. Older reports have exact values, and the
  person cannot fix a sent file.
- `null` for `seconds`. The other optional fields of a module report have no `null`. A writer that
  does not know the length writes no field.

## Open work

[open-work.md](../open-work.md)
