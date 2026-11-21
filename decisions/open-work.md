# Open work

This file holds the open work of the [decision log](README.md). Read the items that apply to your
task. Delete an item when its work is done. The PR that closes an item records the result.

- **The first real certify report.** `reports/` holds no report yet. Run skellytracker's
  `tools/certify_platform.py` on a computer of the owner, send the file through the relay, and
  review it with [`review.md`](../review.md).
- **The relay: turn off the test mode.** The live relay runs in test mode since 2026-11-20 for the
  first hand-ins from freemocap. No report counts as evidence while it is on. Set `TEST_MODE` to
  `"false"` in `relay/wrangler.jsonc` and deploy, with the approval of the owner.
- **The relay: deploy and switch on ([ADR-V1TR](entries/V1TR-format-1-4-0.md),
  [ADR-MM1F](entries/MM1F-relay-hardened-after-security-review.md)).** The live relay is switched
  off since 2026-11-20. It does not have the code of format 1.4.0 and of the hardening yet. Deploy
  the relay and switch it on, with the approval of the owner. Before volunteers use it, add the
  branch rule on `main` of `relay/README.md` Part 2 step 7.
- **freemocap: the clean note and the content type
  ([ADR-MM1F](entries/MM1F-relay-hardened-after-security-review.md)).** Before the app shows the
  file to the person, the app must make the note clean (rule 18 of
  [section 6](../report-format.md#6-privacy-rules)). The app must send the file with the content
  type `text/markdown` ([4.1](../report-format.md#41-content)). The Markdown writer must print no
  `<`, `](`, `]:`, `://`, `www.` and no IPv4 address (rules 17 and 20).
- **Each package: write format 1.4.0 ([ADR-V1TR](entries/V1TR-format-1-4-0.md)).** skellytracker,
  skellycam and freemocap must give one check for each test and write `module` on each check
  ([3.4](../report-format.md#34-check)). They must name the checks that each roll-up check requires
  in their documentation. Their `certify_plan()` must give `total` and `risks`
  ([2.6](../report-format.md#26-the-plan-function)). Their level `quick` must not run a check of an
  item that already has a reviewed pass ([2.7](../report-format.md#27-the-two-levels)). They must
  write the schema id `skellycertify.report/1.4.0`.
- **skellycam: write `notices` ([ADR-V1TR](entries/V1TR-format-1-4-0.md)).** Give a notice when the
  person must do something after the run, for example replug a camera
  ([3.8](../report-format.md#38-notices)). Keep each notice code with its meaning and its text for
  the person in the list of the reason codes ([5.4](../report-format.md#54-codes-of-a-package)).
- **freemocap: the app side of format 1.4.0 ([ADR-V1TR](entries/V1TR-format-1-4-0.md)).** Write the
  table `Checks that did not pass:` of [4.2](../report-format.md#42-layout) part 7 in the Markdown
  writer. Turn each notice code of each package into its text for the person
  ([3.8](../report-format.md#38-notices)). Show the `risks` of each plan at the consent. Do not
  offer a run of a level when the `total` of each plan is 0
  ([2.6](../report-format.md#26-the-plan-function)).
- **skellytracker: `over-budget` ([ADR-V1TR](entries/V1TR-format-1-4-0.md)).** Give a check that
  did not run because the time limit of the level was used up the result `not-run` with
  `over-budget` ([5.3](../report-format.md#53-common-reason-codes)).
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
  cannot get the cameras ([2.5](../report-format.md#25-runtime-rules)). Give each camera item a
  `gate`: the name of the roll-up check of the native capture of that model, for example
  `046d-085c:gate`. Name the checks that it requires in the documentation of skellycam
  ([ADR-T191](entries/T191-gate-of-a-summary-item.md)).
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
- **The passive record: wait for the owner (ADR-M8E0).** The design waits for the answers of the owner to round 2 (Q15 to Q24). Nothing of it is in [`report-format.md`](../report-format.md) yet. Read [ADR-M8E0](entries/M8E0-passive-record-design.md).
