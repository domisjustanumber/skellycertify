# 9FHP — Format 1.6.0: `abandon`, `skipped` with `not-installed`, `test_media`, `shared_memory_bytes`, the time of a file with more than one report

**Status:** absorbed into [`report-format.md` 2.2](../../report-format.md#22-arguments),
[2.4](../../report-format.md#24-cancel), [2.8](../../report-format.md#28-the-test-media-folder),
[3.1](../../report-format.md#31-fields), [3.3](../../report-format.md#33-host),
[3.6](../../report-format.md#36-example-skellytracker), [3.7](../../report-format.md#37-summary),
[3.9](../../report-format.md#39-test_media), [4.2](../../report-format.md#42-layout),
[8](../../report-format.md#8-versioning-of-the-format),
[`relay/README.md` The issue](../../relay/README.md#the-issue), 2026-11-21 (direct commit to
`main`). Accepted 2026-11-21 (owner).

## Decision

The format version is 1.6.0. The schema id is `skellycertify.report/1.6.0`. It is one minor change:

1. `certify()` of each package must accept the keyword-only option `abandon=None`. `certify_plan()`
   does not take it. `abandon` is an object with `is_set() -> bool`, as `cancel` is. When it is
   set, the run stops as for a cancel and does its cleanup. The package stores no result and writes
   no report file. The function still returns a module report. When `cancel` and `abandon` are both
   set, the rules of `abandon` apply.
2. A summary item with the result `skipped` can have the new reason `not-installed`. Only an item of
   the group `component` can have it, for example Blender when it is not installed. The display is
   `skipped (not installed)`. `busy` and `reviewed` do not change.
3. A module report can have the optional top-level field `test_media`: a list of at most 50 test
   media files that the checks of the run used. Each item has `name` (the file name only, never a
   path, at most 120 characters), `sha256` (64 lower-case hex digits), `bytes` (an integer, 0 or
   more) and `source` (`bundled` or `shared`). A module report that used no test media file gives
   an empty list or has no field. The issue does not show it.
4. When the test media folder does not hold a file, the package uses its bundled copy if it has
   one, and writes `bundled`. A package never uses a file whose SHA-256 is wrong. The reason code of
   the package applies, for example `test-media-missing` of skellytracker. The format adds no
   common code.
5. An item of `host.gpus` can have the optional field `shared_memory_bytes`: the shared system
   memory that the GPU can use, in bytes, or `null` when the OS gives no value (on Windows,
   `SharedSystemMemory` of DXGI). `vram_bytes` keeps its meaning: the dedicated memory. The
   Markdown and the issue do not show it.
6. The file name and the time in the header line of a file with more than one report of one
   package are the oldest `created_utc` of the module reports in the file.
7. Text fix: the quick run of skellytracker in 3.6 has a limit of 65 seconds, not 75 seconds. The
   format does not split the time between the packages. The 2 minutes of 2.7 stay the only time of
   the contract.

The name and the place of the test media folder stay out of the format.
[`report-format.md`](../../report-format.md) states each rule in full.

## Reason

- The owner decided each point.
- `abandon`: when the backend of the app ends early, the app already records the run as
  `interrupted`. The package process can still run with no caller. A cancel would make it write a
  second report of the same run, with `cancelled`.
- `not-installed`: a component such as Blender can be absent from the system. That is not a
  `fail`, and `busy` and `reviewed` do not tell that fact.
- `test_media`: the reviewer can see which test file and which copy the checks used.
- `shared_memory_bytes`: an integrated GPU has little or no dedicated memory. `vram_bytes` alone
  does not tell the memory that it can use.
- The time of the oldest report: the app makes the file one time. The bytes of the file must not
  change between the view of the person and the send ([4.1](../../report-format.md#41-content)).
  The relay already builds the issue header from the oldest `created_utc`.

## Consequences

- The owner decided that a new allowed value of this kind is a minor step. `not-installed` does not
  change the meaning of `busy` or `reviewed`, and only a `component` item can have it.
- The relay checks the reason `not-installed`, the form of `test_media` and the form of
  `shared_memory_bytes`, and shows `skipped (not installed)`. The live relay does not have this
  code yet. It must be deployed.
- Each package must accept `abandon`, write `test_media` and write the schema id 1.6.0.

## Alternatives rejected

- A common reason code for a test media file with a wrong hash. Each package already has its own
  code, and 5.3 has no code that fits.
- The time limit of each package in the format. The 2 minutes of 2.7 for the whole run stay the
  only time of the contract.
- The name or the place of the test media folder in the format. The app chooses it.

## Open work

[open-work.md](../open-work.md)
