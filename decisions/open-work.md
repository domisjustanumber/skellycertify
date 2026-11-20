# Open work

This file holds the open work of the [decision log](README.md). Read the items that apply to your
task. Delete an item when its work is done. The PR that closes an item records the result.

- **The first real certify report.** `reports/` holds no report yet. Run skellytracker's
  `tools/certify_platform.py` on a computer of the owner, send the file through the relay, and
  review it with [`review.md`](../review.md).
- **The relay: turn off the test mode.** The live relay runs in test mode since 2026-11-20 for the
  first hand-ins from freemocap. No report counts as evidence while it is on. Set `TEST_MODE` to
  `"false"` in `relay/wrangler.jsonc` and deploy, with the approval of the owner.
- **skellytracker: write format 1.3.0
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md),
  [ADR-D1PW](entries/D1PW-format-1-3-0.md)).** In the module report of `certify()`, fill `summary`
  with the `ep` and `gpu-jpeg` items of [3.6](../report-format.md#36-example-skellytracker). Give a
  pair that `quick` skips because of a reviewed row an `ep` item `skipped` with `reviewed`. Write
  `module` on the checks ([3.4](../report-format.md#34-check)). Write the schema id
  `skellycertify.report/1.3.0`. Give `source` and `sha256` for each item of `downloads` in
  `certify_plan()`, and check the hash after each download
  ([2.6](../report-format.md#26-the-plan-function)). Accept `test_media_dir`
  ([2.8](../report-format.md#28-the-test-media-folder)). Write the Markdown layout and the display
  names of [4.2](../report-format.md#42-layout) in `tools/certify_platform.py`.
- **skellycam: write the `camera` items
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md),
  [ADR-D1PW](entries/D1PW-format-1-3-0.md)).** When skellycam has checks of this format, fill
  `summary` with one `camera` item for each camera model, not for each unit
  ([3.7](../report-format.md#37-summary)). Take the name from the model string of the device.
  Remove the name of a person (rule 16 of [section 6](../report-format.md#6-privacy-rules)). Use
  `partial` and `skipped` with `busy` for a camera. Refuse the run with `cameras-busy` when skellycam
  cannot get the cameras ([2.5](../report-format.md#25-runtime-rules)).
- **Each package: check the quick run against the three rules
  ([ADR-M8J1](entries/M8J1-quick-and-full-levels-defined.md)).** skellytracker, freemocap and
  skellycam must check that their quick run takes no more than 2 minutes (in an app run, together
  with the other packages), downloads nothing (`certify_plan("quick")` returns an empty `downloads`
  list) and shows that each recording, realtime and post-hoc session of the package can start and
  run ([2.7](../report-format.md#27-the-two-levels)). skellytracker must check first that its plugin
  packs of the quick pairs are in the installed package ([3.6](../report-format.md#36-example-skellytracker)).
- **freemocap: write format 1.3.0
  ([ADR-F1KN](entries/F1KN-format-1-2-0-markdown-layout-revised.md),
  [ADR-D1PW](entries/D1PW-format-1-3-0.md)).** Write the report file of the app in the layout of
  [4.2](../report-format.md#42-layout): one system list, the GPU table, the benchmark table, the
  table of the failed checks with `Package`, `Module`, `Test` and `Reason`, one list line for each
  module with `incomplete` where it applies, and the display names. Print the summary items of each
  module. Do not compute them. Give each package the `test_media_dir` of the user, and remove the
  files of a successful full run by default ([2.8](../report-format.md#28-the-test-media-folder)).
  After the app or a package process ends early, write the report from the stages that finished,
  with `interrupted` ([2.5](../report-format.md#25-runtime-rules)).
