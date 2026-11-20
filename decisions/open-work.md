# Open work

This file holds the open work of the [decision log](README.md). Read the items that apply to your
task. Delete an item when its work is done. The PR that closes an item records the result.

- **The first real certify report.** `reports/` holds no report yet. Run skellytracker's
  `tools/certify_platform.py` on a computer of the owner, send the file through the relay, and
  review it with [`review.md`](../review.md).
- **The relay: deploy the summary of format 1.2.0
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md)).** The code of the relay
  builds the issue title and body of [4.2](../report-format.md#42-layout) and checks the field
  `summary`. The live relay does not have this code yet. Deploy the relay with the approval of the
  owner ([`relay/README.md`](../relay/README.md)).
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
