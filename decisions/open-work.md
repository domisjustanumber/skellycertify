# Open work

This file holds the open work of the [decision log](README.md). Read the items that apply to your
task. Delete an item when its work is done. The PR that closes an item records the result.

- **The first real certify report.** `reports/` holds no report yet. Run skellytracker's
  `tools/certify_platform.py` on a computer of the owner, send the file through the relay, and
  review it with [`review.md`](../review.md).
- **The relay: turn off the test mode.** The live relay runs in test mode since 2026-11-20 for the
  first hand-ins from freemocap. No report counts as evidence while it is on. Set `TEST_MODE` to
  `"false"` in `relay/wrangler.jsonc` and deploy, with the approval of the owner.
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
  table `Checks that did not pass:` of [4.2](../report-format.md#42-layout) part 8 in the Markdown
  writer. Turn each notice code of each package into its text for the person
  ([3.8](../report-format.md#38-notices)). Show the `risks` of each plan at the consent. Do not
  offer a run of a level when the `total` of each plan is 0
  ([2.6](../report-format.md#26-the-plan-function)).
- **freemocap: the app side of format 1.5.0 ([ADR-VV80](entries/VV80-format-1-5-0.md)).** Write a
  `component` item with `device` `null` for each check of the own module of the app: build identity,
  child process, imports, data folder, install facts and Blender
  ([3.7](../report-format.md#37-summary)). Print the component table of
  [4.2](../report-format.md#42-layout) part 6 in the Markdown writer. In the Markdown part, print
  each four-part number in a value with each dot replaced by a space (rule 20 of
  [section 6](../report-format.md#6-privacy-rules)).
- **Each package: the schema id of format 1.5.0 ([ADR-VV80](entries/VV80-format-1-5-0.md)).**
  skellytracker, skellycam and freemocap must write the schema id `skellycertify.report/1.5.0`, not
  `skellycertify.report/1.4.0`, when they write the rules of format 1.5.0.
- **Each package: write format 1.6.0 ([ADR-9FHP](entries/9FHP-format-1-6-0.md)).** skellytracker,
  skellycam and freemocap must accept the keyword-only option `abandon` of `certify()`
  ([2.4](../report-format.md#24-cancel)). They must write `test_media` for each test media file
  that the checks used ([3.9](../report-format.md#39-test_media)). They must write the schema id
  `skellycertify.report/1.10.0`, not `skellycertify.report/1.5.0`, when they write the rules of
  format 1.6.0 to 1.10.0 ([ADR-Q02Y](entries/Q02Y-test-media-name-exempt-from-rule-7.md),
  [ADR-974S](entries/974S-format-1-8-0-second-opt-in-for-a-setup.md),
  [ADR-T3BD](entries/T3BD-format-1-9-0-skipped-reason-declined.md), [ADR-2EXP](entries/2EXP-format-1-10-0.md)).
- **Each package: write format 1.8.0 ([ADR-974S](entries/974S-format-1-8-0-second-opt-in-for-a-setup.md)).**
  skellytracker, skellycam and freemocap must accept the keyword-only option `setups` of
  `certify()` and `certify_plan()`. Their `certify_plan()` must return the list `setups`, with an
  empty list at the level `quick` ([2.6](../report-format.md#26-the-plan-function), "Setups"). A
  setup check whose setup is not in `setups` must be `not-run` with `not-selected`. A declined setup
  must not add `partial-run` ([7.1](../report-format.md#71-validity)). They must name in their
  documentation the setup that each setup check needs. They must write the schema id
  `skellycertify.report/1.10.0` ([ADR-T3BD](entries/T3BD-format-1-9-0-skipped-reason-declined.md), [ADR-2EXP](entries/2EXP-format-1-10-0.md)).
- **Each package: write format 1.9.0 ([ADR-T3BD](entries/T3BD-format-1-9-0-skipped-reason-declined.md)).**
  skellytracker, skellycam and freemocap must give an `ep`, `gpu-jpeg`, `camera` or `component`
  item the result `skipped` with the reason `declined` when no check of the item ran because the
  person declined each setup that its checks need ([3.7](../report-format.md#37-summary),
  [2.6](../report-format.md#26-the-plan-function), "Setups"). They must write the schema id
  `skellycertify.report/1.10.0` ([ADR-2EXP](entries/2EXP-format-1-10-0.md)).
- **Each package: write format 1.10.0 ([ADR-2EXP](entries/2EXP-format-1-10-0.md)).** skellytracker, skellycam and
  freemocap must write `seconds` in each module report ([3.1](../report-format.md#31-fields)). They
  must round `memory_bytes`, `vram_bytes` and `shared_memory_bytes` down to a whole MiB
  ([3.3](../report-format.md#33-host)). Each writer of a report file of a package, for example
  `tools/certify_platform.py` of skellytracker, must print the benchmark header
  `| GPU | Module | Stage | ms/frame set | Frame sets/s |` and each item of `checks` on one line of
  the data block ([4.2](../report-format.md#42-layout)). They must write the schema id
  `skellycertify.report/1.10.0`.
- **freemocap: the app side of format 1.10.0 ([ADR-2EXP](entries/2EXP-format-1-10-0.md)).** The Markdown writer of the
  app must print the benchmark header `| GPU | Module | Stage | ms/frame set | Frame sets/s |`
  and each item of `checks` of each module report on one line of the data block
  ([4.2](../report-format.md#42-layout)).
- **Each package: apply 5.8 to its checks ([ADR-ZW66](entries/ZW66-what-a-check-writes-and-the-aims-of-both-levels.md)).** skellytracker, skellycam and
  freemocap must check each check against [5.8](../report-format.md#58-what-a-check-writes). Remove
  each row of a check that its item can never have. Write a test with one result for the run one
  time. Write the class name and the error number of each caught error. Write the index and the
  numbers of the failed item of a series. Write the runtime versions and each constant one time, in
  `details`. Write each pass limit one time. Give the device classes of each experimental check in the list of
  check names. Count `total` of the plan as [2.6](../report-format.md#26-the-plan-function) says.
  For skellytracker, this includes the rows with `not-gpu-ep` and `no_gpu_decode_on_ep` (rule 1),
  the numbers of frame 0 in `<label>:video` (rule 4), and `frames`, `calls`, `speed_against_cpu`
  and the `cpu_ms` of the CPU reference in each `<label>:video` in `numbers` (rule 6).
- **freemocap: the second question for a setup
  ([ADR-974S](entries/974S-format-1-8-0-second-opt-in-for-a-setup.md)).** Show each item of
  `setups` of each plan as its own yes/no question before the run, apart from the consent to the
  full run ([2.6](../report-format.md#26-the-plan-function), "Setups"). Give the `id` of each
  accepted setup to `certify()` of that package in the option `setups`.
- **freemocap: print `skipped (declined)`
  ([ADR-T3BD](entries/T3BD-format-1-9-0-skipped-reason-declined.md)).** In the Markdown writer,
  print a summary item with the result `skipped` and the reason `declined` as `skipped (declined)`
  ([4.2](../report-format.md#42-layout)).
- **Each package: check the existing checks against 5.6
  ([ADR-TWK1](entries/TWK1-when-a-check-can-exist-and-the-aims-of-the-levels.md)).**
  skellytracker, skellycam and freemocap must check each existing check against
  [5.6](../report-format.md#56-when-a-check-can-exist-and-its-level): when it can exist and its
  level. Move a check that gives the same answer on each system to the test suite of the package
  (CI). Run each check that can block a device after the safe checks
  ([2.7](../report-format.md#27-the-two-levels), "Order of the checks"). Name in the specification
  of the package the question of each `record-only` check, and what turns it into a judged check or
  removes it.
- **Each package: make the one list of check names
  ([ADR-9K1Q](entries/9K1Q-one-list-of-check-names-for-each-package.md)).** skellytracker,
  skellycam and freemocap must make their one list of check names and the two tests of
  [5.7](../report-format.md#57-the-list-of-check-names-of-a-package). Then this repository must name
  the place of the list of skellytracker and of freemocap in
  [section 9](../report-format.md#9-packages).
- **freemocap: the app side of format 1.6.0 ([ADR-9FHP](entries/9FHP-format-1-6-0.md)).** Set
  `abandon` for a package process that has no caller after the backend ended early
  ([2.4](../report-format.md#24-cancel)). Give the `component` item of Blender the result `skipped`
  with `not-installed` when Blender is not installed ([3.7](../report-format.md#37-summary)). Give
  a file with more than one report of one package the oldest `created_utc` in its name and its
  header line ([4.2](../report-format.md#42-layout)).
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
  [ADR-D1PW](entries/D1PW-format-1-3-0.md),
  [ADR-PS04](entries/PS04-personal-device-class-text-before-product-string.md)).** When skellycam has checks of this
  format, fill `summary` with one `camera` item for each camera model, not for each unit
  ([3.7](../report-format.md#37-summary)). Take the name from the first source of rule 16 of
  [section 6](../report-format.md#6-privacy-rules) that applies: the list of known cameras of
  skellycam (keyed by USB vendor id and product id), a fixed class text for a personal device (also
  a camera whose product text holds a personal-device word), the USB product string through the
  filter of the rule, `Camera (no USB id)`, or `Camera vvvv:pppp`. Keep the list of
  personal-device words and their class texts in the documentation of skellycam.
  Never use a display name that the OS or a person can set. Use
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
- **The relay: measure the size limit against a real report.** The relay refuses a file larger than
  262,144 bytes (`MAX_BYTES` in `relay/src/handler.js`). A full report of skellytracker has about
  87,000 bytes. The specification of skellycam gives a limit of 128 KiB for a full report with four
  cameras. This limit is an estimate, not a measurement. An app report with six cameras can then be
  larger than the limit of the relay. The owner decided on 2026-11-23 to keep the limit until a real
  report is measured. When the first full report of skellycam exists, put it and a full report of
  skellytracker in one file. Measure the size of the file and the time of the checks of the relay.
  The CPU limit of the relay is 10 ms for each request ([`relay/README.md`](../relay/README.md)).
  Increase `MAX_BYTES` only if the measurement shows that it is necessary.
