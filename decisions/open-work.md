# Open work

This file holds the open work of the [decision log](README.md). Read the items that apply to your
task. Delete an item when its work is done. The PR that closes an item records the result.

- **The first real certify report.** `reports/` holds no report yet. Run skellytracker's
  `tools/certify_platform.py` on a computer of the owner, send the file through the relay, and
  review it with [`review.md`](../review.md).
- **The relay: the summary of format 1.2.0
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md)).** The relay does not do this
  yet. Build the issue body from the JSON block, never from the Markdown. The body shows the same
  summary as [4.2](../report-format.md#42-layout), with the link to the report file. Build the
  issue title from the display names of 4.2. Use `FMC` for freemocap, `Win` for Windows and `Mac`
  for macOS. Other package names stay in full. Example:
  `[certify] skellytracker 2024.9.1019 · Win 11 26H2 · NVIDIA RTX 3070, Intel UHD 770`. Examine
  `relay/src/report.js`, `relay/src/privacy.js` and their tests for the new field `summary`. Update
  `relay/samples/valid.md` and `relay/samples/valid-quick.md` to the layout of 1.2.0. Update
  [`relay/README.md`](../relay/README.md). Then deploy the relay with the approval of the owner.
- **skellytracker: write format 1.2.0
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md)).** In the module report of
  `certify()`, fill `summary` with the `ep` and `gpu-jpeg` items of
  [3.6](../report-format.md#36-example-skellytracker). Write the schema id
  `skellycertify.report/1.2.0`. Write the Markdown layout (one system list and the GPU table) and the display names of
  [4.2](../report-format.md#42-layout) in `tools/certify_platform.py`.
- **skellycam: write the `camera` items
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md)).** When skellycam has checks of
  this format, fill `summary` with one `camera` item for each camera. Take the name from the model
  string of the device. Remove the name of a person (rule 16 of
  [section 6](../report-format.md#6-privacy-rules)).
- **freemocap: write format 1.2.0
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md)).** Write the report file of the
  app in the layout of [4.2](../report-format.md#42-layout) (one system list, the GPU table and one list line for each module) with
  the display names. Print the summary items of each module. Do not compute them.
