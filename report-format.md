# Report format

**Status:** draft. Format version 1.10.0.

This document is the contract between the freemocap packages, the freemocap app and this
repository. Each package implements it in its own code. There is no shared code package.

## 1. Terms

| Term | Meaning |
|---|---|
| package | One freemocap package that has checks, for example `skellytracker` or `skellycam`. |
| app | A program that ships packages and calls `certify()` of each one, for example the freemocap app. |
| module report | The object that `certify()` of one package returns ([section 3](#3-the-module-report)). |
| report file | One Markdown file that holds one or more module reports ([section 4](#4-the-report-file)). |
| check | One test, one recorded fact or one roll-up of a group ([3.4](#34-check)), with one result. |
| section | An optional group of checks in a module report. |
| reason code | A short fixed code that tells why a check has its result, for example `timed-out`. |
| evidence row | A reviewed row in the package that owns the result. The app reads it to show "certified". |
| kind | The kind of a module report: `quick`, `full` or `passive`. |
| public repository | The repository of a package where a commit counts as public ([section 9](#9-packages)). |
| system | The computer of a run. The text of a report and of this document uses "system" for it, not "machine". |
| summary item | One line of the summary for a person in a module report ([3.7](#37-summary)). |

## 2. The function

This section is the contract between an app and a package. A stand-alone tool of a package, for
example `tools/certify_platform.py` of skellytracker, is not bound by it. The tool can show its own
plan and ask its own questions. Its report file must still obey [section 3](#3-the-module-report)
and [section 4](#4-the-report-file).

### 2.1 Signature

Each package must give two functions in its public API: `certify_plan()`
([2.6](#26-the-plan-function)) and this function:

```python
def certify(level: str, progress=None, cancel=None) -> dict: ...
```

The package names the module path of the two functions in its own documentation.
The function returns one module report ([section 3](#3-the-module-report)).

### 2.2 Arguments

| Argument | Type | Meaning |
|---|---|---|
| `level` | `"quick"` or `"full"` | `quick` is the default level. `full` is opt-in. [2.7](#27-the-two-levels) gives the rules of the two levels. |
| `progress` | callable or `None` | The function calls it with one progress message (a `dict`). See [2.3](#23-progress-messages). |
| `cancel` | object or `None` | An object with a method `is_set() -> bool`, for example `threading.Event` or `multiprocessing.Event`. See [2.4](#24-cancel). |

- The function must raise `ValueError` for a `level` that is not `quick` or `full`.
- The function must not raise because of a check. A check that fails, crashes or runs too long is a
  result in the report.
- The `kind` of the returned report is equal to `level`.

**Package options.** A package can add its own options after these three arguments. Each option
must be keyword-only and must have a default. The call `certify(level)` must always work.
`certify_plan` takes the same options. The package gives its options in its own documentation.
The format also has three keyword-only options that each package must accept: `abandon`
([2.4](#24-cancel)), `test_media_dir` ([2.8](#28-the-test-media-folder)) and `setups`
([2.6](#26-the-plan-function), "Setups").
For example, skellytracker takes the execution providers to check and the pipeline of the user:

```python
certify("quick", progress, cancel, execution_providers=["cuda"], pipeline=config)
```

An option changes which checks run. It does not change the format of the report. When an option
selects only a part of the checks of a level, the report is not valid as evidence (`partial-run`),
unless the rules of the package say that the selected part is complete for one item. The option
`setups` is an exception: a setup that the person declined does not make the run `partial-run`
([2.6](#26-the-plan-function), "Setups";
[ADR-974S](decisions/entries/974S-format-1-8-0-second-opt-in-for-a-setup.md)).

### 2.3 Progress messages

Each progress message holds the complete current state of the run. It is never a delta.
The app shows only the latest message. It can drop or skip a message with no loss.

```json
{
 "package": "skellytracker",
 "kind": "full",
 "state": "running",
 "step": {"section": "3", "name": "cuda"},
 "checks": [
  {"section": "1", "name": "checkout", "result": "pass"},
  {"section": "1", "name": "python", "result": "pass"},
  {"section": "3", "name": "cuda", "result": null}
 ],
 "done": 2,
 "total": 9,
 "seconds_left": 140
}
```

| Field | Meaning |
|---|---|
| `package` | The package name. |
| `kind` | Equal to `level`. |
| `state` | `starting`, `running`, `cleaning-up` or `done`. |
| `step` | The check that runs now, as `section` and `name`, or `null`. |
| `checks` | Each check known so far. `result` is `null` until the check ends. The list can grow during the run. A check never leaves the list. |
| `done`, `total` | The count of ended checks and the count of planned checks. `total` is `null` when the package does not know it. |
| `seconds_left` | An estimate in whole seconds, or `null`. |

- The package must call `progress` with `state: "starting"` first and `state: "done"` last.
- The package must call `progress` at most 10 times a second.
- A progress message must be JSON-serialisable. It must obey the privacy rules of
  [section 6](#6-privacy-rules).
- The app can run `certify()` in a child process and send each message through a queue.
- If `progress` raises, the package must stop calling it and must continue the run.

### 2.4 Cancel

- The package must read `cancel.is_set()` at least one time each second while a check runs.
- When `cancel.is_set()` is true, the package must stop the running check. It must kill the child
  process of that check with its process tree.
- The package must not start a new check after a cancel.
- The running check and each check that did not start get the result `not-run` with the reason
  `cancelled`.
- The package must then do its cleanup ([2.5](#25-runtime-rules)) and return the report.
  The report is not valid as evidence (reason `cancelled`).

**Abandon.** `certify()` of each package must accept the keyword-only option `abandon=None`.
`certify_plan()` does not take it. `abandon` is an object with a method `is_set() -> bool`, as
`cancel` is.

- The app sets `abandon` when its backend ended early and the app already recorded the run as
  `interrupted` ([2.5](#25-runtime-rules), "Interrupted run"). The process of the package can then
  still run with no caller. It must not write a second report of the same run with `cancelled`.
- The package must read `abandon.is_set()` as it reads `cancel.is_set()`.
- When `abandon.is_set()` is true, the package must stop the run as for a cancel and do its cleanup
  ([2.5](#25-runtime-rules)).
- After an abandon, the package must store no result in its own store and must write no report
  file.
- The function still returns a module report, as after a cancel.
- When `cancel` and `abandon` are both set, the rules of `abandon` apply
  ([ADR-9FHP](decisions/entries/9FHP-format-1-6-0.md)).

### 2.5 Runtime rules

**Frozen app.** The app can call `certify()` in a child process of a frozen application, for example
a PyInstaller build.

- The function must work when `sys.frozen` is true.
- The function must not start `sys.executable` with a script path. In a frozen app,
  `sys.executable` is the app. Use `multiprocessing` with the `spawn` start method.
- The app must call `multiprocessing.freeze_support()` at its entry point.
- The function must not need git at run time. The package gets its commit from metadata that the
  build writes.

**No console.**

- The function must not read stdin. It must not call `input()`.
- The function must work when `sys.stdout` and `sys.stderr` are `None`.
- The function must not ask the user a question. The caller gets the consent of the user before
  the call ([2.6](#26-the-plan-function)).

**GPU in use.**

- The app must not start a certify run while a pipeline holds the GPU: a live pipeline, a
  recording or a post-hoc run. The app refuses the run and offers to stop the pipeline first.
- A package may refuse the run when it can tell that the GPU is in use. It then returns the report
  with each check `not-run` and the reason `gpu-busy`. Its `evidence.reasons` holds `gpu-busy`.

**Cameras in use.**

- A package may refuse the run when it cannot get the cameras. It then returns the report with each
  camera check `not-run` and the reason `cameras-busy`. Its `evidence.reasons` holds
  `cameras-busy`.
- One camera that another program holds, while the other cameras work, is not a refused run. The
  checks of that camera are `not-run` with a reason code of the package. Its summary item is
  `skipped` with the reason `busy` ([3.7](#37-summary)).

**Time limits.**

- Each check, or each child process that runs a group of checks, must have a time limit.
- A check over its time limit gets `fail` with the reason `timed-out`. The package must kill the
  child process with its process tree.
- A check records its time in `numbers.seconds` when the package measures it.

**Crashes.**

- The package must run each risky check in a child process. A risky check loads a GPU library,
  a camera driver or other native code that can end the process.
- A child process that ends with no result gets `fail` with the reason `crashed` and its exit code
  in `numbers.exit_code`.
- A child process that ends with output that is not a result gets `fail` with the reason
  `bad-output`.
- A child process that gave its complete result and then crashed, ran too long or did not exit
  keeps its result. It gets one more check `exit` with the result `record-only` and the reason
  `crashed`, `timed-out` or `hung-at-exit`.

**Interrupted run.** The app or the process of the package can end before the run ends. The report
is then written later from the stages that finished.

- The check that ran when the process ended is `fail` with the reason `crashed`.
- Each other check that did not end is `not-run` with the reason `interrupted`.
- `evidence.reasons` holds `interrupted`.

**Cleanup.**

- The package must delete each file that it downloads and each package that it installs. This
  rule also applies after a cancel, a crash or a time-out. A file in the test media folder follows
  the rules of [2.8](#28-the-test-media-folder).
- The package must not remove a thing that was on the computer before the run.
- The package may record its own results in its own store: its reports, its probe results, the
  answers of the person and a local pass. A local pass makes an item usable on that computer
  ([7.2](#72-kinds-of-evidence)).
- The package must not change any other store, cache or setting of the user. It keeps its other
  files in its own work folder.
- A cleanup step that fails gets a `fail` row in `cleanup` ([section 3](#3-the-module-report)).
  The package must still return the report.

**Network.**

- The package must download only the files that its plan names.
- The function must send nothing. The report goes to this repository only when the person sends
  it.

### 2.6 The plan function

The user must accept each download before it starts. So the caller needs the plan before the call.
Each package must give this second function. It is part of the contract:

```python
def certify_plan(level: str) -> dict: ...
```

It loads no GPU library and downloads nothing. It returns:

```json
{
 "package": "skellytracker",
 "kind": "full",
 "seconds_estimate": 270,
 "total": 9,
 "risks": [],
 "downloads": [
  {"name": "onnxruntime_ep_cuda13-0.2.0-py3-none-win_amd64.whl", "bytes": 1009000000,
   "source": "https://example.org/packs/onnxruntime_ep_cuda13-0.2.0-py3-none-win_amd64.whl",
   "sha256": "4abfaa7678817ed4a8ccb5f3e355ba28672589e8a3468bb6805e491dfe03a302"}
 ],
 "system_changes": [],
 "questions": [],
 "setups": []
}
```

`system_changes` holds one fixed sentence for each change outside the work folder, for example the
install of a Windows ML package. `questions` holds the yes/no questions of the package, each with
`section`, `id` and `text`. `seconds_estimate` is the time estimate of the run in whole seconds.
`total` is the count of checks that the run will do, a whole number, 0 or more. It is the count of
the rows that the run plans to write in `checks` ([3.1](#31-fields)). A roll-up check
([3.4](#34-check)) is a row, so it counts. `total` does not count a row that the run writes only
after an event, for example an `exit` row ([2.5](#25-runtime-rules), "Crashes"), or a setup check
that the person did not accept ("Setups" below)
([ADR-ZW66](decisions/entries/ZW66-what-a-check-writes-and-the-aims-of-both-levels.md)). `risks` holds one
fixed sentence for each thing that the run can do to a device, for example "The last part of the
full run sends direct USB requests and can make a camera stop until it is replugged." The plan of a
quick run must have an empty `risks` list. Each item of `downloads` has `name` (the file name), `bytes` (the size in bytes), `source` (the
https address that the file comes from) and `sha256` (64 lower-case hex digits). The address and
the hash in the example are example values.

- The package must check the SHA-256 of a file after the download.
- The package must not use a file whose hash is wrong. The check that needs the file is then `fail`
  with a reason code of the package.

The app must show the plan of each package to the user. The app must get the consent of the user
before it calls `certify()`. The app asks one time for all packages. When it asks for the consent,
the app shows the `risks` of each package. The app must not ask the person to run a level when the
`total` of each package is 0. After the run, the app asks the questions and puts the answers in
`answers`.

**Setups.** A setup check needs a specific setup from the person, for example a certain light or a
plug moved to another port ([5.6](#56-when-a-check-can-exist-and-its-level)). It runs only after a
second opt-in of the person
([ADR-974S](decisions/entries/974S-format-1-8-0-second-opt-in-for-a-setup.md)).

- The plan can have the optional list `setups`. No list or an empty list means that the run has no
  setup check. Each item has `id` and `text`.
- `id` is a fixed code of the package. It matches the pattern of a reason code
  ([5.2](#52-reason-codes)). It is unique in the plan.
- `text` is one fixed sentence that tells the person what to arrange, for example "Turn on a lamp
  in front of the cameras."
- The plan of a quick run must have an empty `setups` list. A setup check runs only at the level
  `full`.
- The package must name in its documentation the setup that each setup check needs.
- The app must show each setup as its own yes/no question, before the run. This question is not part
  of the consent to the full run. A yes to the full run is not a yes to a setup.
- `certify()` and `certify_plan()` of each package must accept the keyword-only option
  `setups=None`: a list of the `id` of each setup that the person accepted. `None` or an empty
  list means that the person accepted no setup. With this option, `total` and `seconds_estimate`
  of the plan count only the checks that will run. The `setups` list of the plan still holds each
  setup of the level.
- A setup check whose setup is not in the list does not run. It gets the result `not-run` with the
  reason `not-selected` ([5.3](#53-common-reason-codes)).
- A declined setup does not make the run `partial-run` ([7.1](#71-validity)). The other checks of
  the run still count as evidence.
- A roll-up check that requires a setup check that did not run is not `pass` ([3.4](#34-check)). So
  a summary item whose `gate` is that roll-up check gives no reviewed row
  ([7.2](#72-kinds-of-evidence)). When the other checks of the item passed, the item is `partial`
  ([3.7](#37-summary)).
- When no check of an item ran because the person declined each setup that the checks of the item
  need, the item is `skipped` with the reason `declined` ([3.7](#37-summary)). It gives no reviewed
  row ([7.2](#72-kinds-of-evidence))
  ([ADR-T3BD](decisions/entries/T3BD-format-1-9-0-skipped-reason-declined.md)).

### 2.7 The two levels

**Aims.** The two levels have different aims
([ADR-TWK1](decisions/entries/TWK1-when-a-check-can-exist-and-the-aims-of-the-levels.md)):

- The level `quick` is a smoke test. It shows whether things work at all.
- The level `full` shows how well things perform. It finds gaps in the logic and records the
  errors. Its result either signs off the use of this path in production, or it gives a developer
  the information to fix the issues in a later release.

Both levels also have these two aims
([ADR-ZW66](decisions/entries/ZW66-what-a-check-writes-and-the-aims-of-both-levels.md)):

- The report leaks no data of the user ([section 6](#6-privacy-rules)).
- The report is short. It has no row that carries no information
  ([5.8](#58-what-a-check-writes)).

[5.6](#56-when-a-check-can-exist-and-its-level) tells which checks can exist and the level of each
check. [5.8](#58-what-a-check-writes) tells what a check writes.

**Level `quick`.** A package must obey these three rules:

1. The whole quick run must take no more than 2 minutes. The limit is for the whole run. When an
   app runs each package in one run, the limit is 2 minutes for all packages together, not for each
   package. A package that runs alone has the same limit.
2. The quick run must download nothing. Each file that it needs must be in the package at install
   time: in the installer of the app or in the installed package. So `certify_plan("quick")` must
   return an empty `downloads` list.
3. The quick run must be enough to show that a recording, a realtime pipeline session and a
   post-hoc session can at least start and run. This applies to each of these that the package has
   and that is not yet reviewed.

A check that runs too long is a result in the report ([2.5](#25-runtime-rules), "Time limits").

The level `quick` checks that unknown things are safe to use. It checks only things that are not yet
reviewed. The level `quick` must not run a check of an item that already has a reviewed pass. That
item gets a summary item `skipped` with the reason `reviewed` ([3.7](#37-summary)). When each thing
that a package would check is already reviewed, its quick run checks nothing. That is a correct
quick run. The app must not ask the person to run the quick check when no package has a check to
run, that is when the `total` of each plan is 0 ([2.6](#26-the-plan-function)).

**Level `full`.** The level `full` has few fixed rules: the rules of
[5.6](#56-when-a-check-can-exist-and-its-level) and the order rule below. It is for benchmarks of
unknown things and of this system. It can also check a known-good item, to measure the performance
of this system. It can download test files. It can download only the files that its plan names,
with the consent of the user ([2.6](#26-the-plan-function)). It can take longer on the system. It
can run full benchmarks. The owner can make these rules tighter later.

**Order of the checks.** The format has one rule for the order. A check that can block a device
must run after the safe checks. A check can block a device when the plan names that risk in `risks`
([2.6](#26-the-plan-function)). A safe check cannot block a device. The rest of the order is a
recommendation: first the tests of most value and the tests of new things, then the tests of less
value. A run that stops early then still gives the important results
([ADR-TWK1](decisions/entries/TWK1-when-a-check-can-exist-and-the-aims-of-the-levels.md)).

### 2.8 The test media folder

`certify()` and `certify_plan()` of each package must accept the keyword-only option
`test_media_dir=None`. The app gives the location of one folder for each user. This folder is
outside the data of each package.

- A package keeps its test images and its benchmark recordings in this folder.
- The name of each file is its SHA-256 in lower-case hex, followed by its extension. Two packages
  that need the same file then share one copy.
- A package must check the hash of a file before it uses the file.
- A package must delete only a file that this run downloaded.
- After a successful full run, the app removes by default each file that the run downloaded and
  each file that the run wrote. The app never removes a file that was in the folder before the run.
  The app never removes the report.
- A package that gets no `test_media_dir` uses its own work folder, as before.
- When the folder does not hold a file that a check needs, the package uses its bundled copy of
  that file, if it has one: the copy that is in the installed package.
- A package must never use a file whose SHA-256 is wrong, a bundled copy or a file in the folder.
  The check that needs the file then gets a reason code of the package, for example
  `test-media-missing` of skellytracker.
- The package lists each test media file that the checks of the run used in `test_media`, with
  `source` `bundled` or `shared` ([3.9](#39-test_media),
  [ADR-9FHP](decisions/entries/9FHP-format-1-6-0.md)).
- The path of the folder is never in a report (privacy rule 1 of [section 6](#6-privacy-rules)).
- The folder is never in a repository.

## 3. The module report

### 3.1 Fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schema` | string | yes | `skellycertify.report/1.10.0` ([section 8](#8-versioning-of-the-format)). |
| `id` | string | no | A version 4 UUID in the lower-case form with hyphens (36 characters), for example `3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90`. The package gives it when it saves the report. It is unique in a report file. It holds no time and no data of the system. A version 1 UUID is forbidden, because it holds the MAC address. A report that was not saved can have no `id`. |
| `package` | object | yes | See [3.2](#32-package). |
| `kind` | string | yes | `quick`, `full` or `passive` ([7.2](#72-kinds-of-evidence)). `passive` is reserved for a record that the package gathers from normal use ([7.3](#73-the-passive-record-reserved)). Its fields are not yet defined. A writer must not write `passive` in this version. |
| `created_utc` | string | yes | The start of the run, `YYYY-MM-DDTHH:MM:SSZ`. The relay accepts only the current UTC year, the year before and the year after. |
| `seconds` | number | no | The length of the whole run of the package in seconds, a number of 0 or more, for example `271.4`. A writer that does not know the length writes no `seconds`. The relay refuses another form, also `null` ([ADR-2EXP](decisions/entries/2EXP-format-1-10-0.md)). |
| `host` | object | yes | Hardware and software facts. See [3.3](#33-host). |
| `checks` | list | yes | Each check of the run. See [3.4](#34-check). |
| `sections` | list | no | The sections of the run. See [3.5](#35-section). |
| `summary` | list | no | The summary items of the run for a person. See [3.7](#37-summary). |
| `cleanup` | list | no | One check object for each cleanup step that failed. An empty list or no field means that each step passed. |
| `notices` | list | no | What the person must do after the run. See [3.8](#38-notices). |
| `test_media` | list | no | The test media files that the checks of the run used. See [3.9](#39-test_media). |
| `answers` | list | no | The answers to the yes/no questions of the package: `section`, `id`, `text`, `answer` (`yes`, `no` or `null`). `text` is the fixed text of the question. |
| `details` | object | no | Facts of the package that have no field here. They obey [section 6](#6-privacy-rules). |
| `evidence` | object | yes | `valid` (boolean) and `reasons` (list of reason codes). See [section 7](#7-evidence-validity). |

A reader must ignore a field that it does not know.

### 3.2 `package`

| Field | Meaning |
|---|---|
| `name` | The distribution name in lower case, for example `skellytracker`. |
| `version` | The SemVer version of the package, with no `v` prefix, for example `2.0.0` or `2.0.0-rc.1`. |
| `commit` | The full git commit of the source, 40 lower-case hex digits, or `null` when the package does not know it. |
| `tree_modified` | `true` when the source tree had a change that the commit does not hold, `false` when it had none, `null` when the package does not know. |

### 3.3 `host`

These keys have a fixed meaning. A package writes the keys that it can find. It can add more keys
under `details`. When a writer does not know the value of a field, it leaves the field out or
writes `null`. This does not apply to `name` and `id` of a GPU.

| Field | Meaning |
|---|---|
| `os.name` | `Windows`, `Linux` or `macOS`. |
| `os.release`, `os.version`, `os.build` | The release, the version and the build number of the OS. |
| `os.label` | The OS as a person reads it, for example `Windows 11 Home 26H2`. |
| `os.arch` | The CPU architecture, for example `x86_64` or `arm64`. |
| `cpu.name` | The model name of the CPU. |
| `memory_bytes` | The total memory in bytes. |
| `gpus` | A list. Each item has `vendor`, `name`, `id` (the PCI vendor id and device id in lower-case hex, for example `10de:2484`), `driver_version`, `vram_bytes` (the dedicated memory of the GPU in bytes) and `shared_memory_bytes` (the shared system memory that the GPU can use, in bytes, for example `SharedSystemMemory` of DXGI on Windows; `null` when the OS gives no value). |

**Memory in whole MiB.** A writer writes `memory_bytes`, `vram_bytes` and `shared_memory_bytes` in
bytes, rounded down to a whole MiB: a multiple of 1,048,576. For example, 68388003840 bytes
become 68387078144 bytes (65219 MiB). The exact count of bytes identifies one configuration more than a model. A
reader accepts a value that is not a multiple of 1,048,576, for example in an older report. The
relay does not refuse it ([ADR-2EXP](decisions/entries/2EXP-format-1-10-0.md)).

The fields have these forms. The relay refuses another form.

- `os` and `cpu` are objects or `null`. Each field of the table above in them is a string, a
  number or `null`.
- `memory_bytes` and `vram_bytes` are numbers of 0 or more, or `null`.
- `shared_memory_bytes` is an integer of 0 or more, or `null`
  ([ADR-9FHP](decisions/entries/9FHP-format-1-6-0.md)).
- `gpus` is a list or `null`. It has at most 16 items. Each item is an object. `name` (at most 200
  characters) and `id` (at most 40 characters) are strings, and each item must have them. `vendor`
  and `driver_version` are strings or `null`.
- A reader shows nothing for a `null` value.

### 3.4 Check

| Field | Required | Meaning |
|---|---|---|
| `section` | when `sections` exists | The `id` of the section of the check. |
| `name` | yes | The check name. It matches `^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$`. The pair (`section`, `name`) is unique. |
| `result` | yes | `pass`, `fail`, `not-run` or `record-only` ([section 5](#5-results-and-reason-codes)). |
| `reason` | yes | A reason code, or `null`. It must not be `null` for `fail` and `not-run`. |
| `module` | no | The tested part, as a short label from the vocabulary of the package, for example `CUDA`. It is equal to the `name` of the summary item of the tested part ([3.7](#37-summary)): for a camera, the camera model name; for an EP, the EP name; for a component, the name of the component. At most 80 characters. |
| `numbers` | no | A flat object of facts. Each value is a number, a boolean, `null`, a reason code, a list of reason codes, or a string from a fixed vocabulary of the package. It holds no free text. |

**One test, one check.** A package gives one check for each test that it runs. A check has exactly
one result of [5.1](#51-results). `partial` is never the result of a check. It exists only for a
summary item ([3.7](#37-summary)). A package must not put two or more tests into one check. No
check hides the result of another test. A reader can tell from the checks alone which test failed.

**Roll-up check.** A roll-up check runs no test of its own. It gives the result of a group, for
example the check of an EP and GPU pair in skellytracker ([3.6](#36-example-skellytracker)). It is
`pass` only when each check that it requires is `pass`. The package names in its documentation the
checks that each roll-up check requires. Each test of the group keeps its own check.

### 3.5 Section

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | A short id, for example `"3"`. |
| `name` | yes | The fixed name of the section. |
| `result`, `reason` | yes | The section result. Any `fail` check makes `fail`. Else any `pass` check makes `pass`. Else any `record-only` check makes `record-only`. Else `not-run`. A section with no check, for example a section that crashed, has its own result and reason. |
| `module` | no | The tested part, as for a check ([3.4](#34-check)). |
| `summary` | no | One line for a person. The package makes it from fixed words and from the facts of the report only. |
| `seconds`, `exit_code` | no | The time and the exit code of the child process of the section. |
| `details` | no | Facts of the section. They obey [section 6](#6-privacy-rules). |

### 3.6 Example: skellytracker

This is the layout of skellytracker for the levels `quick` and `full`. The layout of `details` is
the layout of the package. The CPU name, the commit and the id are example values.

One report is one `certify()` call. It covers each selected pair of an execution provider (EP) and
a GPU. An EP that was not selected is not in the report. A selected pair that cannot run has the
result `not-run`, with a reason such as `ep-not-installed` or `gpu-not-usable`. A check that the
pair can never have is not in the report, for example a probe against the CPU for the CPU EP
([5.8](#58-what-a-check-writes) rule 1).

**Names.**

- The label of a pair is `<ep>@<device>`, for example `cuda@10de-2484-0`. It is the plain `<ep>`
  for an EP with no GPU and for `coreml`.
- The checks of a pair are `<label>:probe`, `<label>:video` and `<label>:live`. `video` and `live`
  are sessions of the running modes video and live.
- The pair check `<label>` has no `:` in its name. It is a roll-up check ([3.4](#34-check)). It is
  `pass` only when `<label>:probe`, `<label>:video` and `<label>:live` are `pass`. A timing or a
  JPEG check never changes it.
- For `cuda` and `trt-rtx` on a GPU, level `quick` also has `<label>:jpeg-decode` and
  `<label>:jpeg-preprocess`.
- The CPU EP has no pair row. Its checks are `cpu:video` and `cpu:live`, with `module` `CPU`.
- A child process that gave its result and did not exit cleanly adds a row `<name>:exit` with the
  result `record-only` and the reason `hung-at-exit` or `crashed`.
- `module` of each check of a pair, of its JPEG rows and of its `<name>:exit` row is the EP name,
  for example `TensorRT RTX`. A `suite:*` check has no `module`.
- A check can have `numbers`, for example `seconds`, `ep_ms`, `cpu_ms`, `max_abs_diff` and
  `exit_code`. A value that is the same in each row of the run, for example the count of test
  frames or of timed calls, is in `details` one time, not in `numbers`. A value that a reader can
  compute from the other numbers of the row is not in `numbers`
  ([5.8](#58-what-a-check-writes) rule 6).

**Level `quick`.** The quick run has a limit of 65 seconds. A check that does not fit in it is
`not-run` with `over-budget`. The CPU EP runs only as the reference for a pair that is not
reviewed. A pair that has a reviewed pass does not run. It gets an `ep` item `skipped` with
`reviewed`. A quick run in which each pair is reviewed runs no check. Its evidence reason is
`no-check`.

**Level `full`.** The layout is the same: flat `checks`, no sections, the same `details.eps` and
`details.versions`. The order of the checks:

1. The CPU reference: `cpu:video` and `cpu:live`.
2. Each pair with no reviewed pass, on the GPU that the package recommends: `<label>:probe`,
   `<label>:video`, `<label>:live`, `<label>:pipeline-1`, `<label>:pipeline-3`,
   `<label>:pipeline-6`, `<label>:jpeg`, each `<label>:jpeg:<name>`, then `<label>`.
3. The CPU timings: `cpu:pipeline-1`, `cpu:pipeline-3`, `cpu:pipeline-6`, `cpu:jpeg` and each
   `cpu:jpeg:<name>`.
4. The other pairs.

- `<x>:pipeline-<n>` is the timing of the pipeline at `<n>` cameras. Its result is `record-only`.
  Its `numbers` are `cameras`, `start_seconds`, `first_call_ms`, `median_ms`, `p95_ms`,
  `vram_before_mib` and `peak_vram_mib` (`null` when there is no VRAM reader). A pair on a GPU also
  has `against_cpu`. The count of timed calls is `details.full.timed_calls`.
- A timing is `not-run` with the class name of an exception as the reason when the run raised, for
  example when there is no VRAM at 6 cameras. It is `not-run` with `video-not-passed` when the
  check `<label>:video` did not pass, and with `models-missing` on the CPU EP when a model file is absent. It is
  `fail` with `crashed` or `timed-out` when the child process died.
- `<x>:jpeg` is the outcome of the JPEG checks. It is `fail`, with the reason of the first failed
  check, when a check failed. Else it is `pass` when a check passed. Else it is `not-run` with
  `no-check`. It exists for `cpu` and for `cuda`, `trt-rtx`, `directml`, `amdgpu` and `migraphx`
  on a GPU.
- `<x>:jpeg:<name>` is one check of the JPEG certification, for example `cpu_decode.baseline_420`,
  `gpu_decode.baseline_422` or `preprocess_graph.yolox_person`. The JPEG certification has 66 names
  today. A target has only the names that it can have. A name whose result cannot differ between
  two targets of one run is in the report one time ([5.8](#58-what-a-check-writes) rules 1 and 2).
  The result is `pass`, `fail`, `not-run` or `record-only`. The reason keeps the code of the JPEG
  module, with underscores, for example `ep_not_present` or `over_limit`. A report of `directml`
  has no `gpu_decode` name, because DirectML has no GPU JPEG decode.
- A full report has no `<label>:jpeg-decode` and no `<label>:jpeg-preprocess`.
- With no EP at all, `full` still runs the CPU checks. For `certify("full")`, it installs nothing
  and it downloads only the test image. It reads `<sha256>.zip` in `test_media_dir`
  ([2.8](#28-the-test-media-folder)).
- `test_media` lists the test frames file of the package, `quick_frames.zip`, when a check used it
  ([3.9](#39-test_media)).

**`details`.**

- `details.eps.<label>` holds `gpu` (the GPU id, for example `10de:2484`, `chip:<slug>` for
  `coreml`, or `null`), `device` (the device key or `null`; the full form, for example
  `gpu:10de:2484:0`, not the short form of the label), `models`, `warnings` and `pack_version`.
  `models` and `warnings` are there only when the session run gave them. A pair that is `not-run`,
  or whose probe failed, has neither. Each item of `models` is an object with `key`, `version`,
  `size`, `precision`, `execution_provider` and `device`. `warnings` is a sorted list of warning
  codes. `pack_version` is `builtin` for a built-in EP (`directml`, `coreml`, `cpu`). For an EP of
  the Windows ML catalog it is the package version of the Windows ML record (or `windows-ml`). For
  a plugin pack it is the pack version, for example `0.2.0`. The CPU EP has no entry in
  `details.eps` in a full report.
- A pair whose EP has a plugin pack also has two facts of the installed pack in
  `details.eps.<label>`: `installed_pack_version` (the `version` of the manifest `pack.json` of the
  installed pack in the EP store) and `wheels_match_lock` (a boolean: `true` when the sha256 values
  of the wheels that the install recorded in `pack.json` are exactly the sha256 values of the lock
  of the catalog for that pack). Both are absent for a built-in EP, for an EP of the Windows ML
  catalog, and when the pack has no manifest. The match compares the hashes that were recorded at
  install time. It does not read a wheel again and does not hash the unpacked files. The store
  checks each unpacked file by presence and size: a pack with a missing file or a file of another
  size is not usable, and its pair is `not-run` with `ep-files`. A file that was changed with the
  same size is not found.
- `details.versions` gives the versions one time for the report, not for each EP.
- `details.full` is `{"camera_counts": [1, 3, 6], "warmup_calls": 10, "timed_calls": 100,
  "running_mode": "video"}` in a full report.
- `details.skipped` is an object. It is empty when no pair was skipped.
- The name and the driver version of a GPU are only in `host.gpus`. Join `host.gpus[].id` with
  `details.eps.<label>.gpu`. Two GPUs of one model have the same id.

**`summary`** ([3.7](#37-summary)):

- One `ep` item for each pair that ran. A pair that is `not-run` has no item. The result of an
  `ep` item is the result of the row of the pair (`<label>`). skellytracker decides the result of
  its item. The CPU EP has the item `CPU` with `device` `null` and the result `record-only`. A pair
  that `quick` skips because it has a reviewed row has an `ep` item with the result `skipped` and
  the reason `reviewed`.
- A `gpu-jpeg` item only when a GPU JPEG decode test ran for that pair. A report of `directml`
  has none. skellytracker decides the result of that item.
- A `component` item `MediaPipe` with `device` `null` for the check `mediapipe:smoke` of the
  MediaPipe library. That check has `module` `MediaPipe`. When `quick` skips the check because it
  has a reviewed pass, the item has the result `skipped` and the reason `reviewed`
  ([ADR-VV80](decisions/entries/VV80-format-1-5-0.md)).
- `benchmark` items of a full report. They come after the `ep` item of the CPU. Each has `stage`
  `pipeline-<n>` for `n` cameras (1, 3 and 6), for the pair and for the CPU.
  skellytracker writes `ms_per_frame` as the median time of one call that holds one frame of each
  of the `n` cameras (`median_ms` of the `pipeline-<n>` check), and `fps` as 1000 divided by
  `ms_per_frame`.

```json
{
 "schema": "skellycertify.report/1.10.0",
 "id": "3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90",
 "package": {"name": "skellytracker", "version": "2024.9.1019",
             "commit": "0123456789abcdef0123456789abcdef01234567", "tree_modified": false},
 "kind": "full",
 "created_utc": "2026-11-21T00:21:01Z",
 "host": {
  "os": {"name": "Windows", "release": "11", "version": "10.0.26300", "build": 26300,
         "label": "Windows 11 Home 26H2", "arch": "x86_64"},
  "cpu": {"name": "Intel(R) Core(TM) i7-14700K"},
  "memory_bytes": 68387078144,
  "gpus": [
   {"vendor": "nvidia", "name": "NVIDIA GeForce RTX 3070", "id": "10de:2484", "driver_version": "610.88",
    "vram_bytes": 8589934592, "shared_memory_bytes": 34193014784}
  ]
 },
 "summary": [
  {"group": "ep", "name": "DirectML", "device": "10de:2484", "result": "pass"},
  {"group": "ep", "name": "CPU", "device": null, "result": "record-only"},
  {"group": "benchmark", "name": "DirectML", "device": "10de:2484", "stage": "pipeline-1",
   "ms_per_frame": 3.44, "fps": 290.7},
  {"group": "benchmark", "name": "CPU", "device": null, "stage": "pipeline-1",
   "ms_per_frame": 16.08, "fps": 62.2}
 ],
 "checks": [
  {"name": "cpu:video", "result": "pass", "reason": null, "module": "CPU",
   "numbers": {"cpu_ms": 16.1, "seconds": 5.0}},
  {"name": "directml@10de-2484-0:probe", "result": "pass", "reason": null, "module": "DirectML",
   "numbers": {"seconds": 1.2, "max_abs_diff": 9.537e-07}},
  {"name": "directml@10de-2484-0:live", "result": "pass", "reason": null, "module": "DirectML",
   "numbers": {"ep_ms": 3.3}},
  {"name": "directml@10de-2484-0:pipeline-1", "result": "record-only", "reason": null, "module": "DirectML",
   "numbers": {"cameras": 1, "start_seconds": 1.44, "first_call_ms": 24.8, "median_ms": 3.44,
               "p95_ms": 3.65, "vram_before_mib": 0, "peak_vram_mib": 279, "against_cpu": 0.21}},
  {"name": "directml@10de-2484-0", "result": "pass", "reason": null, "module": "DirectML"},
  {"name": "cpu:pipeline-1", "result": "record-only", "reason": null, "module": "CPU",
   "numbers": {"cameras": 1, "start_seconds": 1.25, "first_call_ms": 122.0, "median_ms": 16.08,
               "p95_ms": 17.85, "vram_before_mib": 0, "peak_vram_mib": 0}}
 ],
 "cleanup": [],
 "test_media": [
  {"name": "quick_frames.zip", "sha256": "a973456f417eab8e24ea8aa3f118a48142aa55143af69c73ee6799cb4f94c1f4",
   "bytes": 6215661, "source": "bundled"}
 ],
 "details": {
  "pipeline": "yolox-rtmw-wholebody@skellytracker",
  "eps": {
   "directml@10de-2484-0": {"gpu": "10de:2484", "device": "gpu:10de:2484:0", "pack_version": "builtin",
                            "models": [{"key": "yolox-person@openmmlab-exporter", "version": "0.1.0",
                                        "size": "m", "precision": "fp16", "execution_provider": "directml",
                                        "device": "gpu:10de:2484:0"}],
                            "warnings": ["batch_limited_by_state"]}
  },
  "full": {"camera_counts": [1, 3, 6], "warmup_calls": 10, "timed_calls": 100, "running_mode": "video"},
  "versions": {"python": "3.12.10", "ort_distribution": "onnxruntime-windowsml", "ort_version": "1.30.0.202609102321",
               "windowsml": "2.6.74rc0", "catalog_revision": "<64 hex digits>",
               "set_hash": "4abfaa7678817ed4a8ccb5f3e355ba28672589e8a3468bb6805e491dfe03a302"},
  "skipped": {},
  "scrub": {"exempted_terms": 0}
 },
 "evidence": {"valid": true, "reasons": []}
}
```

The example shows 6 of the many checks of a real full report. It shows one of two `models` items.
It puts a long check on two or three lines, so that a person can read it. A report file has each
check on one line ([4.2](#42-layout), "The lines of the data block").
A full run writes a report file. skellytracker uses the `id` also as the file name and as the
hand-in id. Older files of schema 1.0.0 stay readable and have no `id`.

**The tool `tools/certify_platform.py`.**

- It writes one report file of [section 4](#4-the-report-file) with `"app": null` and one module of
  kind `full`, named `certify-report-<yyyymmddThhmmssZ>.md`.
- The module is the report of `certify("full")`, with the rows of the suite first. The suite has
  four sections: `checkout`, `hardware`, `packs` and `full`. Each section gives a row `suite:<slug>`
  and each of its checks a row `suite:<slug>:<name>`. For `full`, the row `suite:full` exists only
  when `certify("full")` gave no report. A child process that did not exit cleanly adds
  `suite:<slug>:exit` (`record-only`).
- `suite:packs` installs each pack from the lock of the catalog into a new, empty EP store of the
  run, with the sha256 check, and runs the probe on it. It has one row `suite:packs:<EP key>`, or
  `suite:packs:<EP key>@<device>` for an EP with no pack that runs on each GPU. This row
  uses the label of the pair, for example `suite:packs:directml@10de-2484-0`. `suite:packs` does not
  touch the
  EP store of the person. The checks of `certify("full")` in a tool report run on that new store, so
  the pair checks say that a new install from the catalog works.
- `details.suite` holds `version`, `selected`, `sections.<slug>` (`summary`, `seconds`, `details`),
  `telemetry_database` (`before`, `after`) and `answers`.
- The evidence reasons of the suite are added to those of the package: `section-1-not-run`,
  `no-commit`, `modified-tree`, `python-differs`, `packages-differ`, `partial-run` (a section was
  not selected, did not run or gave no result) and `cancelled`. A failed `suite:hardware` or
  `suite:packs` row adds no reason: a failed check is a result that the reviewer reads.

### 3.7 `summary`

`summary` is optional. It is a list of summary items. They give the facts of the summary for a
person ([4.2](#42-layout)). It is not the `summary` of a section ([3.5](#35-section)).

| Field | Meaning |
|---|---|
| `group` | `ep`, `gpu-jpeg`, `camera`, `benchmark` or `component`. |
| `name` | A short fixed name from the vocabulary of the package, for example `TensorRT RTX`, `CUDA`, `DirectML` or `CPU`. For a camera, the camera name of rule 16 of [section 6](#6-privacy-rules), for example `Logitech C922` ([ADR-6C0M](decisions/entries/6C0M-sources-of-a-camera-name.md)). For `benchmark`, the tested part, as for `ep`. For `component`, the name of the component, for example `MediaPipe`. |
| `device` | For `ep`, `gpu-jpeg` and `benchmark`: the `id` of the GPU in `host.gpus`. For a PCI device this is `vvvv:dddd`. For `camera`: the USB id `vvvv:pppp`, or `null` for a camera with no USB id (its name is `Camera (no USB id)`). For `component`: always `null`. Else `null`. |
| `result` | Not for `benchmark`. `pass`, `fail`, `record-only`, `partial` or `skipped`. |
| `reason` | Not for `benchmark`. For `skipped`: `busy`, `reviewed` or `declined`, and for a `component` item also `not-installed`. For each other result: absent or `null`. |
| `gate` | Optional. Only for `ep`, `gpu-jpeg`, `camera` and `component`. The `name` of one roll-up check ([3.4](#34-check)) of the same module report, for example `046d-085c:gate` for a camera. It matches the pattern of a check name. The relay refuses another form. The package names it. [7.2](#72-kinds-of-evidence) tells what it gives ([ADR-T191](decisions/entries/T191-gate-of-a-summary-item.md)). |
| `stage` | Only for `benchmark`. A short fixed name of the package for the measured stage. At most 80 characters. |
| `ms_per_frame`, `fps` | Only for `benchmark`. Two numbers, each 0 or more: the time in milliseconds to process one frame set, and the frame sets for each second. `fps` is 1000 / `ms_per_frame`. |

**Frame set.** A frame set is one frame of each camera of the stage. The name of a stage with more
than one camera gives the count of cameras, for example `pipeline-3` is three cameras. So
`ms_per_frame` of `pipeline-3` is the time for three frames, one from each camera
([ADR-VV80](decisions/entries/VV80-format-1-5-0.md)).

**Component.** A `component` item gives the result of a check of a part of the software that is
not an EP, a GPU JPEG decode, a camera or a benchmark, for example a library or a part of the app.
It has the fields of an `ep` item, and its `device` is `null`. Its `result` and the `reason` of
`skipped` obey the rules of each other item ([ADR-VV80](decisions/entries/VV80-format-1-5-0.md)).
Only a `component` item can also have `skipped` with the reason `not-installed`
([ADR-9FHP](decisions/entries/9FHP-format-1-6-0.md)).

The results of an item:

- `partial`: some checks of the item passed. Other checks could not run, or failed in a way that
  is not fatal. Each group can use it.
- `skipped`: the package did not test the item. The reason `busy` tells that another program holds
  the camera or the GPU. The reason `reviewed` tells that the package skipped the item at the level
  `quick` because the item already has a reviewed pass. The reason `not-installed` tells that the
  component is not installed on the system, for example Blender. Only a `component` item can have
  `not-installed`. The reason `declined` tells that the person declined each setup that the checks
  of the item need, so no check of the item ran ([2.6](#26-the-plan-function), "Setups"). An `ep`,
  `gpu-jpeg`, `camera` or `component` item can have `declined`. When a check of the item ran, the
  item does not have `declined`
  ([ADR-T3BD](decisions/entries/T3BD-format-1-9-0-skipped-reason-declined.md)).

A `benchmark` item has no `result` and no `reason`. The details of the measurement stay in
`checks`.

A `gate` does not change the result of its item. An item with the result `partial` stays
`partial` in the summary, also when its `gate` check is `pass`.

- The package that ran the checks fills `summary`. skellytracker gives the `ep` and `gpu-jpeg`
  items ([3.6](#36-example-skellytracker)). skellycam gives the `camera` items. Each package that
  measures a benchmark gives its `benchmark` items. Each package that checks a component gives its
  `component` items, for example skellytracker for the MediaPipe library and freemocap for the
  checks of its own module.
- A `gpu-jpeg` item has the same `name` and `device` as its `ep` item.
- The `name` of an item is equal to the `module` of each check of the tested part
  ([3.4](#34-check)).
- There is one `camera` item for each camera model on the system (USB vendor id and product id),
  not for each unit. Two units of one model give one item. The count of units can be in `checks`. A
  system with no camera has no `camera` item.
- A writer of the report file prints the items. It does not compute them from `checks`.
- A reader must accept a module with no `summary`. That module then gives no row to the GPU table,
  the benchmark table, the component table or the camera table ([4.2](#42-layout)).
- Each item obeys the privacy rules of [section 6](#6-privacy-rules). A camera name holds no name of
  a person (rule 16).

### 3.8 `notices`

`notices` is optional. A notice tells the person what to do after a run. A cleanup check
(`cleanup`, [3.1](#31-fields)) records a fact. A notice tells the person what to do.

| Field | Required | Meaning |
|---|---|---|
| `code` | yes | A fixed code of the package. It matches the pattern of a reason code ([5.2](#52-reason-codes)). |
| `values` | no | A flat object of at most 8 keys. Each value is a number or a string of at most 80 characters, for example the cleaned name of a camera. |

- `notices` is a list of at most 50 items. Each item is an object.
- A notice holds no free text. The app turns the code into the text for the person. The format
  fixes only the shape.
- The package keeps its notice codes in the list of its reason codes ([5.4](#54-codes-of-a-package)).
- Each item obeys the privacy rules of [section 6](#6-privacy-rules). A camera name holds no name of
  a person (rule 16).

Example: `{"code": "camera-wedged", "values": {"camera": "Logitech C922"}}`. The app shows it as
"Camera Logitech C922: wedged, please replug".

### 3.9 `test_media`

`test_media` is optional. It is a list of the test media files that the checks of this run used
([2.8](#28-the-test-media-folder)). Each item is an object with these fields:

| Field | Meaning |
|---|---|
| `name` | The name that the package gives the file, never a path. A string of at most 120 characters, for example `quick_frames.zip`. Use this name also for a `shared` file, not its name in the folder. |
| `sha256` | The SHA-256 of the file: 64 lower-case hex digits. |
| `bytes` | The size of the file in bytes: an integer, 0 or more. |
| `source` | `bundled`: the copy that is in the installed package. `shared`: the file in the test media folder ([2.8](#28-the-test-media-folder)). |

- A module report that used no test media file gives an empty list or has no `test_media` field.
- The list has at most 50 items.
- Each item obeys the privacy rules of [section 6](#6-privacy-rules). The `name` of an item is
  exempt from rule 7: it can end with the extension of a video file, for example `sample.mp4`. The
  file is a known file of a package, and its SHA-256 is in the same item. Each other rule applies
  to `name`. Rule 7 applies to each other field of the item.
- The relay checks the form of `test_media`. The issue does not show it
  ([ADR-9FHP](decisions/entries/9FHP-format-1-6-0.md)).

## 4. The report file

### 4.1 Content

One report file holds one JSON object:

| Field | Meaning |
|---|---|
| `schema` | `skellycertify.report/1.10.0`. |
| `app` | `name`, `version` (SemVer) and `commit` of the app, or `null` for a report of one package that ran alone. |
| `modules` | A list of module reports. The list holds at least one module report. A package can give more than one module report, for example one for each run. Each module report is independent ([7.1](#71-validity)). |
| `note` | The one free-text note of the person, or `null`. At most 2000 characters. It must be a clean note (rule 18 of [section 6](#6-privacy-rules)). |

The app calls `certify()` of each package and puts each result in `modules`.
An app can put more than one report of one package in one file, for example each report not yet
handed in.
A package that runs alone, from its own clone, writes the same file with one module and
`"app": null`.

The report is one file. When the interface of the app and its backend are on different
computers, the backend returns the file as it is. The interface saves the file.

There are two ways to hand in the file:

1. **The relay** ([relay/README.md](relay/README.md)). The app sends the file to the relay after
   the "send" of the person. The relay files the file in this repository and returns the address of
   the issue.
2. **The issue form.** The person attaches the file to a new issue. This is the permanent
   fallback. The app offers it after 3 failed retries, and at once when the relay answers 413 or
   422.

Nothing is sent automatically. This means: a run sends nothing, and the app sends a file only after
the person read that file and chose "send". A later automatic retry sends the same file again.

**Send rules for the app.** The relay publishes a report before a person of the project reads it.
So:

- Before the app sends a report to the relay, the app must show the person the exact file. The
  app must get a clear "send" from the person.
- The app must keep the file that the person accepted. An automatic retry must send only that
  file, byte for byte. It must never send data that the app added later.
- Before the app shows the file to the person, the app must make the note clean (rule 18 of
  [section 6](#6-privacy-rules)). The person then sees the exact note that the app sends.
- The app must send the file with the content type `text/markdown`, with no `charset` parameter or
  with `charset=utf-8`. The relay refuses each other type, also `text/plain`.

### 4.2 Layout

The file is Markdown, in UTF-8, with `\n` line ends. Its name is
`certify-report-<yyyymmddThhmmssZ>.md`, with the UTC start time of the run.

**The time of a file with more than one report of one package.** An app can put more than one
report of one package in one file ([4.1](#41-content)). The file name and the time in the header
line of such a file are the oldest `created_utc` of the module reports in the file. The bytes of the
file must not change between the view of the person and the send ([4.1](#41-content), "Send rules
for the app") ([ADR-9FHP](decisions/entries/9FHP-format-1-6-0.md)).

The Markdown part is a short summary for a person. It has these parts, in this order, with a blank
line between two parts:

1. A title line: `# Certify report`.
2. The header.
   - One module with `"app": null`: one line
     `<package> <version> · <kind> run · <YYYY-MM-DD HH:MM> UTC · valid as evidence`. The time is
     `created_utc` of the module. A module that is not valid ends the line with
     `not valid as evidence: <reasons>`.
   - Two or more modules, or an app: one line `<app> <version> · <YYYY-MM-DD HH:MM> UTC`, with the
     UTC start time of the run. With `"app": null`, the line has only the time. Then one list line
     for each module: `- <package> <version> · <kind> run · valid as evidence`, or
     `not valid as evidence: <reasons>` at the end.
   - `<reasons>` is the list of `evidence.reasons`, separated by `, `.
   - When `evidence.reasons` of a module holds `cancelled` or `interrupted`, the line of that module
     has the word `incomplete` directly before the validity text, for example
     `… · full run · incomplete · not valid as evidence: interrupted`.
3. The system, as a list. The writer prints it one time for the whole file: `- OS: …`, `- CPU: …`,
   `- RAM: …`. It has no `- GPU:` line. It is never one list for each module. Each value comes from
   the first module in `modules` whose `host` has that key. The values are display names (see
   below). A line is absent when no module has its key.
4. The GPU table: `| GPU | Module | Result |`. In this table, `Module` means the tested part (an EP or
   a GPU decode), not a module report. The benchmark table (part 5), the component table (part 6)
   and the table of the checks that did not pass (part 8) use `Module` with the same meaning.
   - It has one row for each `ep` item ([3.7](#37-summary)). `GPU` is the display name of the GPU in
     `host.gpus` (of the same module report) whose `id` is equal to `device`, followed by the VRAM
     in whole GB when it is 1 GB or more, for example `NVIDIA RTX 3070 8 GB` or `Intel UHD 770`.
     `GPU` is `-` when `device` is `null`, for example for the CPU EP. `Module` is the `name` of the
     item, for example `CUDA`. An EP that did not run has no item, so it has no row.
   - A `gpu-jpeg` item has its own row. The row is directly under the row of the `ep` item of the
     same module report with the same `name` and `device`. Its `Module` cell is
     `<name> GPU decode`, for example `CUDA GPU decode`. Its `GPU` cell is the same as the `GPU`
     cell of that `ep` row.
   - A GPU in `host.gpus` (of any module report) that no `ep` item names gets one row after the item
     rows. Its `GPU` cell is as above, its `Module` cell is empty and its `Result` cell is
     `not checked`. Each such GPU id has one row for the whole file.
   - The order is the order of `modules`, then of `summary`.
   - A file with no `ep` item and no GPU in any `host.gpus` has no GPU table.
5. Only when a module has a `benchmark` item: the benchmark table
   `| GPU | Module | Stage | ms/frame set | Frame sets/s |`. It has one row for each `benchmark`
   item, in the order of `modules`, then of `summary`. `GPU` is as in the GPU table, and `-` when
   `device` is `null`. `Module` is the `name` of the item. `Stage` is `stage`. `ms/frame set` and
   `Frame sets/s` are `ms_per_frame` and `fps` with one decimal place, for example `12.4`.
   `ms/frame set` is the time to process one frame set (one frame of each camera of the stage), and
   `Frame sets/s` is the frame sets for each second ([3.7](#37-summary)). The names of the fields
   `ms_per_frame` and `fps` do not change. A writer of 1.9.0 or earlier prints the header
   `| GPU | Module | Stage | ms/frame | FPS |` with the same meaning
   ([ADR-2EXP](decisions/entries/2EXP-format-1-10-0.md)).
6. Only when a module has a `component` item: the component table `| Module | Result |`. It has one
   row for each `component` item, in the order of `modules`, then of `summary`. `Module` is the
   `name` of the item. `Result` uses the display words of the GPU table
   ([ADR-VV80](decisions/entries/VV80-format-1-5-0.md)).
7. The cameras: a table `| Camera | Result |` with one row for each `camera` item. When no module
   has a `camera` item, this part is the line `Cameras: not checked on this system.`
8. The checks that did not pass: the line `Checks that did not pass:` and a table
   `| Package | Module | Test | Result | Reason |`. The part is absent when it has no row.
   - It has one row for each check with the result `fail`.
   - It has one row for each check with the result `not-run` when its module report has a summary
     item with the `result` `partial` or `fail` and a `name` equal to the `module` of the check
     ([3.4](#34-check)). A `not-run` check with no such item has no row. A check that the system
     can never have is not in the report ([5.8](#58-what-a-check-writes) rule 1).
   - The table always names the check, never only its section. The exception is a section with the
     result `fail` and no check of its own, for example a section that crashed
     ([3.5](#35-section)). It gets one row with the name of the section in `Test`.
   - `Package` is the package name. `Module` is the `module` of the check or of the section, or an
     empty cell when it has none. `Test` is the `name` of the check or of the section. `Result` is
     `fail` or `not run`. `Reason` is the reason code.
   - Two summary items can have one `name`, for example one EP on two GPUs. The check name in `Test`
     then tells them apart.
9. Only when `note` is not `null`: the line `Note of the person:` and the note as a quote. Each line
   of the note starts with `> `.
10. Last: the heading `## Data` and one fenced code block with the info string `json`. It holds
    the object of [4.1](#41-content). The fence has at least 3 backticks. It is longer than each
    run of backticks in the JSON.

**The lines of the data block.** The writer of a report file prints each item of the `checks` list
of each module report on one line. That line holds the whole item and nothing else, other than the
indent before the item and the `,` after it. The writer does not put a line break inside the item.
The rest of the block is valid JSON in a layout that the writer chooses. For example, each other
object can have one field on each line, with an indent of one space for each level. A reader, also
the relay, accepts each layout of valid JSON
([ADR-2EXP](decisions/entries/2EXP-format-1-10-0.md)).

The Markdown shows a result as `pass`, `fail`, `record`, `partial`, `skipped (busy)`,
`skipped (already reviewed)`, `skipped (not installed)` or `skipped (declined)`. Part 8 also shows
`not run`, the display of `not-run`. `record` is the display of `record-only`. `skipped (busy)` is
the display of `skipped` with the reason `busy`. `skipped (already reviewed)` is the display of
`skipped` with the reason `reviewed`. `skipped (not installed)` is the display of `skipped` with
the reason `not-installed`. `skipped (declined)` is the display of `skipped` with the reason
`declined`. A writer prints the summary items. It does not compute them.
The relay shows the same summary in the issue. It builds it from the JSON block and not from the
Markdown.

**Display names.** The JSON keeps each name as the OS or the driver gives it. `host` does not
change. A writer shortens a name only for the Markdown:

- GPU: remove `(R)`, `(TM)`, `GeForce`, `Radeon`, `Arc`, `Graphics`, `GPU` and `Series`. The vendor
  stays first. Keep `RTX`, `GTX`, `Quadro`, `TITAN`, `Laptop`, `Ti`, `SUPER`, `RX`, `Pro`, `Vega`,
  `FirePro`, `XT`, `UHD`, `HD`, `Iris`, `Xe`, `MAX` and `Adreno`. Examples:
  `NVIDIA GeForce RTX 3070` → `NVIDIA RTX 3070`; `AMD Radeon RX 7800 XT` → `AMD RX 7800 XT`;
  `Intel(R) UHD Graphics 770` → `Intel UHD 770`; `Intel(R) Arc(TM) A770 Graphics` → `Intel A770`.
- CPU: remove `(R)`, `(TM)`, a generation prefix (for example `13th Gen`), a clock speed (for
  example `CPU @ 3.60GHz`) and a core-count suffix (for example `8-Core Processor`). Example:
  `AMD Ryzen 7 7700X 8-Core Processor` → `AMD Ryzen 7 7700X`.
- RAM and VRAM: whole GB, from the bytes divided by 2^30 and rounded. Example: 68387078144 bytes →
  `64 GB`. A VRAM of less than 1 GB is not shown in the `GPU` cell.
- OS: `os.label` without the edition words `Home` and `Pro`. Example: `Windows 11 Home 26H2` →
  `Windows 11 26H2`.
- A four-part number in a value, for example `2.1.0.5`: each dot becomes a space, so
  `2 1 0 5`. Rule 20 of [section 6](#6-privacy-rules) gives the rule.

Rules for a reader:

- The JSON block is the data. The Markdown before it is for a person.
- If the Markdown and the JSON block do not agree, the JSON block is correct.
- A reader takes the last fenced `json` block. The file must end with that block and one `\n`.
- A writer writes `\n` line ends. A reader (the relay, a tool of the reviewer) accepts `\r\n`. It
  replaces each `\r\n` with `\n` before each check and before it computes a hash. The relay commits
  the file with `\n` line ends. A `\r` that is not part of `\r\n` makes the file not valid.
- If a module report has `id`, it must be a version 4 UUID in the lower-case form with hyphens. The
  relay shows the `id` in the issue. The relay refuses a report whose `id` has another form.

### 4.3 Example

````markdown
# Certify report

freemocap 2.0.0 · 2026-11-19 10:00 UTC

- skellytracker 2.0.0 · quick run · valid as evidence
- skellycam 1.0.0 · quick run · not valid as evidence: modified-tree

- OS: Windows 11 26H2
- CPU: AMD Ryzen 7 7700X
- RAM: 32 GB

| GPU | Module | Result |
|---|---|---|
| NVIDIA RTX 3070 8 GB | CUDA | skipped (already reviewed) |
| NVIDIA RTX 3070 8 GB | DirectML | pass |
| - | CPU | record |
| Intel UHD 770 | | not checked |

| Module | Result |
|---|---|
| MediaPipe | skipped (already reviewed) |

| Camera | Result |
|---|---|
| Logitech C922 | partial |
| Razer Kiyo Pro | skipped (busy) |

Checks that did not pass:

| Package | Module | Test | Result | Reason |
|---|---|---|---|---|
| skellycam | Logitech C922 | set-fps | fail | timed-out |
| skellycam | Logitech C922 | record-30s | not run | over-budget |

Note of the person:

> The Razer camera was open in another app.

## Data

```json
{
 "schema": "skellycertify.report/1.10.0",
 "app": {"name": "freemocap", "version": "2.0.0", "commit": "89abcdef0123456789abcdef0123456789abcdef"},
 "modules": [
  {"schema": "skellycertify.report/1.10.0", "package": {"name": "skellytracker", "...": "..."},
   "summary": [
    {"group": "ep", "name": "CUDA", "device": "10de:2484", "result": "skipped", "reason": "reviewed"},
    {"group": "ep", "name": "DirectML", "device": "10de:2484", "result": "pass"},
    {"group": "ep", "name": "CPU", "device": null, "result": "record-only"},
    {"group": "component", "name": "MediaPipe", "device": null, "result": "skipped", "reason": "reviewed"}
   ]},
  {"schema": "skellycertify.report/1.10.0", "package": {"name": "skellycam", "...": "..."},
   "summary": [
    {"group": "camera", "name": "Logitech C922", "device": "046d:085c", "result": "partial"},
    {"group": "camera", "name": "Razer Kiyo Pro", "device": "1532:0e05", "result": "skipped", "reason": "busy"}
   ],
   "checks": [
    {"name": "set-fps", "module": "Logitech C922", "result": "fail", "reason": "timed-out"},
    {"name": "record-30s", "module": "Logitech C922", "result": "not-run", "reason": "over-budget"}
   ]}
 ],
 "note": "The Razer camera was open in another app."
}
```
````

The `"...": "..."` items only make the example short. A real file holds each required field.
The names, the ids and the results are examples. The system list shows one time for the whole file.
The `host.gpus` of the modules (not shown) hold the RTX 3070 (`10de:2484`) and the Intel UHD 770
(`8086:4688`). No `ep` item names the Intel UHD 770, so it has the row `not checked`. The CUDA pair
already has a reviewed pass, so the quick run skipped it. The same applies to the MediaPipe
component, so the component table shows it as `skipped (already reviewed)`. The time limit of the quick run was used
up before `record-30s`. That check has a row because the item of its camera is `partial`. The
skellycam values are examples.
skellycam has no checks of this format yet.

## 5. Results and reason codes

### 5.1 Results

| Result | Meaning |
|---|---|
| `pass` | The test passed. |
| `fail` | The test failed, crashed or ran too long. |
| `not-run` | The test did not run. The reason tells why. |
| `record-only` | The check only recorded facts, or its result does not count on this hardware. |

### 5.2 Reason codes

- A reason code is a fixed code. It is never an error text, an exception message or a traceback.
- A reason code matches `^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$`.
- A reason code can be the class name of an exception, for example `TimeoutError`, when the
  package registers that form. It must never hold the message of the exception.

### 5.3 Common reason codes

This format owns these codes. Each package must use them with this meaning.

| Code | Where | Meaning |
|---|---|---|
| `timed-out` | check, section | The check ran longer than its time limit. |
| `crashed` | check, section | The child process ended with no result, or ended with an error after its result. |
| `bad-output` | check, section | The child process gave output that is not a result. |
| `hung-at-exit` | check `exit` | The child process did not end after its result. The package stopped it. |
| `cancelled` | check, `evidence.reasons` | The caller set `cancel`. |
| `gpu-busy` | check, `evidence.reasons` | The package refused the run because a pipeline holds the GPU. |
| `cameras-busy` | check, `evidence.reasons` | The package refused the run because it cannot get the cameras. |
| `interrupted` | check, `evidence.reasons` | The app or the process of the package ended before the run ended. The report was written later from the stages that finished. |
| `not-selected` | check, section | The person or the caller did not select the check. |
| `not-built` | check, section | The check does not exist in this version of the package yet. |
| `over-budget` | check | The check did not run because the time limit of the level was used up. Its result is `not-run`. |
| `no-version` | `evidence.reasons` | `package.version` is not a SemVer version. |
| `no-commit` | `evidence.reasons` | `package.commit` is `null` or not 40 hex digits. |
| `modified-tree` | `evidence.reasons` | `package.tree_modified` is not `false`. |
| `partial-run` | `evidence.reasons` | Not all checks of the level were selected. A setup that the person declined does not count ([2.6](#26-the-plan-function), "Setups"). |
| `kind-not-evidence` | `evidence.reasons` | The `kind` is `passive`. This version does not define the fields of a `passive` record. |
| `commit-not-public` | the answer of the reviewer | `package.commit` is not in the public repository of the package. The reviewer gives this code on the issue. It is not in the report file. |

### 5.4 Codes of a package

Each package owns its other reason codes. This repository does not own them.

- Each package must keep the list of its reason codes in its own repository. The list gives each
  code, or each form of code (for example `install-<code>`), with one sentence of meaning.
- The same list gives each notice code of the package ([3.8](#38-notices)) with one sentence of
  meaning and its text for the person.
- The package must add a code to the list in the same commit that adds the code to its checks.
- [Section 9](#9-packages) gives the place of the list of each package.

### 5.5 How a package adds a check

A package can add a check with no change of this repository. A change of the format needs the
approval of the owner of this repository
([ADR-98KC](decisions/entries/98KC-how-a-package-adds-a-check.md)).

**A new check.** The package owns the name of each of its checks. This repository holds no list of
check names.

- The check obeys [5.6](#56-when-a-check-can-exist-and-its-level): when a check can exist, and its
  level.
- The package defines the name of the check in its own specification or documentation. It does
  this in the same commit that adds the check.
- The package adds the name to its list of check names ([5.7](#57-the-list-of-check-names-of-a-package)).
- The name matches the pattern of a check name ([3.4](#34-check)). The pair (`section`, `name`) is
  unique in the module report.
- The check is one test ([3.4](#34-check), "One test, one check").
- The package names in its documentation the checks that each roll-up check requires
  ([3.4](#34-check), "Roll-up check").
- A `gate` of a summary item names a roll-up check ([3.7](#37-summary)).
- The relay checks only the form of a check name.

**A new code of the package.** A new reason code or notice code of the package follows
[5.4](#54-codes-of-a-package). The package adds it to the list in its own repository, in the same
commit. This repository does not change.

**A new fact of the package.** A package writes a fact that has no field in this format in
`details` ([3.1](#31-fields), [3.5](#35-section)) or in `numbers` of a check ([3.4](#34-check)). The
fact obeys the privacy rules of [section 6](#6-privacy-rules). Each other new field and each new
allowed value of a field is a change of the format. A package must not write it before this format
defines it. A reader ignores a field that it does not know ([3.1](#31-fields)). That rule is for a
reader. It does not let a writer add a field.

**A change of this repository.** These changes need a change of this document:

- a new common reason code ([5.3](#53-common-reason-codes));
- a new field;
- a new allowed value of a field;
- a new summary group ([3.7](#37-summary));
- a new reason of a `skipped` summary item ([3.7](#37-summary));
- a change of a privacy rule or of the allowed facts ([section 6](#6-privacy-rules)).

[Section 8](#8-versioning-of-the-format) gives the step of the version. A change that adds an
optional field, a common reason code or an allowed value is a minor change. A change that removes
or renames a field, changes the meaning of a field, or makes an optional field required is a major
change. Each change of the format has a decision entry in this
repository ([decisions/README.md](decisions/README.md)). When the relay checks the field or the
value, the same change updates the relay and its tests (`relay/src/report.js`,
`relay/src/privacy.js`), and the relay is deployed.

**How to ask.** The package (its maintainer or its agent) asks the owner of this repository for the
change. The request gives the field or the value, its type, its place in the report and one
example. The owner of this repository approves each change of the format.

### 5.6 When a check can exist, and its level

This section adds to [5.5](#55-how-a-package-adds-a-check). It tells when a package can create a
check, and at which level the check runs
([ADR-TWK1](decisions/entries/TWK1-when-a-check-can-exist-and-the-aims-of-the-levels.md)).

**When a check can exist.** A package can create a check only when each of these statements is
true:

1. The answer can be different on a different system or hardware. When the answer is the same on
   each system, the test is a normal test of the test suite of the package (CI). It is not a
   certify check.
2. The answer changes something: a verdict, a notice to the person
   ([3.8](#38-notices)), or what a developer fixes.
3. The check runs the code path of the product. It does not run a second implementation.
4. The check can ask the person for a specific setup, for example a certain light or a plug moved.
   It can ask only after a second opt-in of the person ([2.6](#26-the-plan-function), "Setups").
   When the person does not say yes, the check does not run.
5. The check cannot spoil the run. It has a time limit ([2.5](#25-runtime-rules), "Time limits"). A
   failure gives a reason code, never a crash of the run. The check puts back each thing that it
   changed.
6. Its result holds no private data, and it fits the format: fixed words, numbers and reason codes
   ([section 6](#6-privacy-rules)).
7. The check is in the specification of the package, with its test, before the code of the check
   exists. The specification gives the name, the pass rule or `record-only`, the numbers and the
   reason codes.
8. A `record-only` check names in the specification of the package the question that it will
   answer. The specification also names what turns it into a judged check, or what removes it.

**The level of a check.**

1. A check is at the level `quick` only when each of these statements is true:
   - It answers "does this work at all" ([2.7](#27-the-two-levels), "Aims").
   - It cannot block a device: it adds nothing to `risks` ([2.6](#26-the-plan-function)).
   - It downloads nothing.
   - It fits in the part of the 2 minutes of [2.7](#27-the-two-levels) that the package uses.
   - It needs no setup from the person.
2. Each other check is at the level `full`.
3. A check that can block a device runs at the level `full`, after the safe checks
   ([2.7](#27-the-two-levels), "Order of the checks").
4. A check with no pass rule is `record-only` at each level.
5. An experimental method is a method whose answer is not yet verified on that system. Its check
   runs only at the level `full`. The package puts it where its failure cannot spoil the rest of
   the run. The check reports its own result.

### 5.7 The list of check names of a package

Each package keeps one list of all its check names
([ADR-9K1Q](decisions/entries/9K1Q-one-list-of-check-names-for-each-package.md)).

- The list is in the own repository of the package. The package owns the names. This repository
  holds no list.
- A name with a variable part is in the list in its template form, for example
  `<label>:usb3-trial`.
- Each entry gives the name and the level: `quick`, `full` or both. An entry of an experimental
  check also gives the device classes that the check runs on ([5.8](#58-what-a-check-writes) rule
  8). Only these are required. A package can add more to an entry.
- The list is machine-readable: a tool can read each entry exactly. The list is in one place. The
  format sets no form for the list. [Section 9](#9-packages) names the place of the list of each
  package.
- A new check goes into the list before its code, or in the same commit.
- The package must have two tests. First, each check name that a run writes matches an entry of the
  list. Second, each entry is known to the code of the package, or the list marks it as not built.

### 5.8 What a check writes

Each package must obey these rules. They keep the report short, with no row that carries no
information ([2.7](#27-the-two-levels), "Aims";
[ADR-ZW66](decisions/entries/ZW66-what-a-check-writes-and-the-aims-of-both-levels.md)).

1. **No row for a check that cannot exist.** A report has no row for a check that the device, the
   EP or the component of that row can never have. For example, the report has no check of a GPU
   JPEG decode for an EP that has no GPU JPEG decode. `not-run` is only for a check that the item
   can have at the level of the run and that did not run. Its reason tells why, for example
   `over-budget`, `not-selected`, `not-built` or `cancelled` ([5.3](#53-common-reason-codes)).
2. **One row for a test with one result.** A test whose result cannot differ between two labels of
   one run (for example two pairs of an EP and a GPU, [3.6](#36-example-skellytracker)) runs one
   time. It is in the report one time, not one time for each label.
3. **An error.** A check that catches an error writes these two facts:
   - The class name of the exception, with no module path. It is the reason code, or a value in
     `numbers` or in `details`. It has the form of a reason code ([5.2](#52-reason-codes)).
   - The error number of the OS or of the library, as a number in `numbers` or in `details`: for
     example an HRESULT on Windows, `errno` on Linux and macOS, or the return code of the library.
     An HRESULT is the unsigned 32-bit value, for example `2289696773` for `0x887A0005`.

   When the error has no number, the check writes only the class name. The check never writes the
   message text of the error ([5.2](#52-reason-codes), rule 10 of [section 6](#6-privacy-rules)).
4. **A failure in a series.** A check that fails on one item of a series, for example a frame, a
   repeat or a camera, writes the index of that item and the numbers of that item. It does not
   write the numbers of the first item of the series. The index starts at 0. When more than one item
   fails, the check writes the first item that failed. For a camera, the index is the position of
   the camera among the cameras of the check, in the order of the run. It is not a camera id of the
   OS ([section 6](#6-privacy-rules), allowed facts).
5. **Runtime versions.** A report records the version of each runtime that a check result depends
   on, for example Python and the library that the check ran. `package.version`
   ([3.2](#32-package)) and `host.os` ([3.3](#33-host)) give the package and the OS. The format has
   no field for the other versions. The package writes them in `details`, one time for the run, for
   example `details.versions` of skellytracker ([3.6](#36-example-skellytracker)).
6. **A value one time.**
   - A value of `numbers` that is the same in each row of a run, for example a limit, a constant or
     a count of repeats, is in `details` one time for the run. It is not in each row.
   - A derived value is not in `numbers` or in `details` beside its inputs. A field that this format
     defines is not a derived value of this rule, for example `fps` of a `benchmark` item
     ([3.7](#37-summary)).
   - A number has no more digits than its meaning needs. For a timing, 4 significant digits are
     enough, for example `16.08` and not `16.0812345`.
7. **The pass limit.** The pass limit of a judged number is in the report one time. A reader can
   then see how far the value is from its limit. A limit that is the same for each check of the run
   is in `details` (rule 6). A limit of one check only is in `numbers` of that check.
8. **An experimental check.** A check of an experimental method
   ([5.6](#56-when-a-check-can-exist-and-its-level), "The level of a check", item 5) runs only on
   the device classes that the package names for it, for example only on a dedicated GPU. A device
   class is a kind of device that the package names, for example a dedicated GPU, an integrated GPU
   or a USB camera. The entry of the check in the list of check names
   ([5.7](#57-the-list-of-check-names-of-a-package)) gives its device classes. The check does not
   run on a device of another class, and the report has no row of it for that device (rule 1).

## 6. Privacy rules

Each rule is a statement that a test can check. "String" means each key and each value of the
JSON object, and each line of the Markdown.

The writer (the package or the app) must make these statements true. The reviewer checks them
again ([review.md](review.md)).

1. No string matches the path pattern
   `(?:\b[A-Za-z]:[\\/]|\\\\[^\\\s]|/(?:home|Users|root)/|~[\\/])`.
2. No object key is one of these names, in upper case, lower case or a mix (for example
   `Hostname`): `hostname`, `host_name`, `node`, `user`, `username`, `user_name`,
   `email`, `serial`, `serial_number`, `uuid`, `mac`, `mac_address`, `bus_id`, `pci_bus_id`, `luid`,
   `ip`, `ip_address`.
3. No string matches a PCI bus address, `\b(?:[0-9a-fA-F]{4}:)?[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-7]\b`.
4. No string matches a MAC address, `\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b`.
5. No string holds an email address.
6. No string is longer than 2000 characters. A camera frame cannot fit in such a string.
7. No string ends with the extension of an image, video or audio file, in upper case, lower case
   or a mix (for example `.JPG`): `.jpg`, `.jpeg`, `.png`,
   `.bmp`, `.tif`, `.tiff`, `.webp`, `.mp4`, `.avi`, `.mkv`, `.mov`, `.webm`, `.wav`, `.mp3`,
   `.flac`. The file names of recordings are not in a report. One exception: the `name` of an
   item of `test_media` ([3.9](#39-test_media)) is exempt from this rule. The item must be directly
   in the `test_media` list of a module report. A `test_media` list in another place, for example in
   `details`, has no exemption.
8. The Markdown holds no image link (`![`). The report file has no other attached file.
9. Each `reason` and each item of `evidence.reasons` matches the pattern of
   [5.2](#52-reason-codes).
10. No string holds `Traceback (most recent call last)`.
11. `note` is `null` or a string of at most 2000 characters.

These rules apply to the writer. A test of the writer can check them. A reviewer cannot:

12. The writer removes the user name, the home folder and the host name of the run host from each
    string. It writes `<private>` for a name and `<path>` for a path.
13. A user name or a host name that is also a word of a public fact (for example `ubuntu` in
    `Ubuntu 24.04 LTS`) stays in the fields of the module report. The writer then records only the
    count of such names. The writer always removes these names from `note`.
14. The writer takes the facts of an OS tool through an allow-list of fields. It never keeps the raw
    output of an OS tool.
15. Before the person writes the note, the writer tells the person not to write a name, contact
    details or other personal details.
16. A camera name holds no name of a person. The package that writes the name sets it before the
    report exists. It uses the first of these sources that applies
    ([ADR-PS04](decisions/entries/PS04-personal-device-class-text-before-product-string.md)):
    1. The name in the list of known cameras of the package. The key of the list is the USB vendor
       id and the product id of the camera.
    2. For a personal device that a person uses as a camera: a fixed text for the class of the
       device: `iPhone used as camera`, `iPad used as camera` or `Mac built-in camera`. A camera
       is also a personal device when its product text (source 3) holds a personal-device word,
       for example `iPhone`, `iPad`, `Mac` or `MacBook`. Compare the words without case. Such a
       product text is often `<person>'s iPhone`, and a package cannot know each name. So the
       class text applies before the product text. The package keeps the list of personal-device
       words and their class texts in its own documentation.
    3. For a camera that is not in the list and is not a personal device: the product text in the
       firmware of the camera (the USB product string). The package never uses a display name that
       the OS or a person can set. The package changes the product text with this filter:
       - It applies the Unicode normalization NFKC.
       - It keeps only letters, marks and digits of each script (the Unicode categories L, M and
         N), the space (U+0020) and the characters of rule 18. It replaces each other character
         with a space. So no control character of the text direction stays.
       - It replaces each run of spaces with one space, and it removes the spaces at the start and
         at the end.
       - It keeps at most 60 characters.
    4. For a camera with no USB id: `Camera (no USB id)`.
    5. When a rule of this section refuses the name of sources 1 to 4: `Camera vvvv:pppp`, with the
       USB vendor id and the product id in lower-case hex, for example `Camera 046d:085c`. A product
       text that holds the user name or the host name of the system is refused (rule 12).

    The relay cannot find a first name, so this rule is a duty of the writer.

The writer must also make these statements true. The relay checks them, and the reviewer checks
them again:

17. No line of the Markdown part (each line before the heading `## Data`) holds `<`, `](`, `]:`,
    `://` or `www.` (`www.` in upper case, lower case or a mix). The layout of [4.2](#42-layout) needs
    none of them. The Markdown part shows a value that holds `<private>` or `<path>` (rule 12)
    without `<` and `>`, for example `private`.
18. `note` is `null` or a clean note. A clean note obeys each of these statements:
    - It has at most 2000 characters.
    - It holds only letters, marks and digits (the Unicode categories L, M and N), the space
      (U+0020), the line feed and these characters: `.` `,` `:` `;` `_` `+` `=` `(` `)` `'` `%` `/`
      `?` `·` `-`. This is the set of characters that the relay keeps in the issue. So the note
      holds no control character other than the line feed.
    - It holds no `://` and no `www.` (`www.` in upper case, lower case or a mix).

    Before the app shows the file to the person, the app makes the note clean. It replaces each
    character that the list above does not allow with a space. Then it removes each `://` and each
    `www.`, again until none is left. The relay does not change a note. It refuses a report whose
    note is not clean.
19. No object of the JSON object has the same key two times. A JSON parser keeps only one of the
    two values, so the other rules cannot check the other value.
20. No line of the Markdown part and no line of `note` holds an IPv4 address,
    `\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b`. This rule
    does not apply to the other values of the JSON object, because a driver or package version can
    have four numeric parts, for example `32.0.101.6881`.

    A real value can hold a part that matches this pattern, for example an OS label, the name of a
    CPU, a GPU or a camera, a version or a check name. In the Markdown part only, the writer prints
    each match in a value with each dot replaced by a space, for example `2.1.0.5` becomes
    `2 1 0 5`. It does this again until no match is left. The JSON block keeps the exact value.
    The relay prints each value in the issue in the same way
    ([ADR-VV80](decisions/entries/VV80-format-1-5-0.md)).

**Limit of these rules.** The rules stop accidents. They cannot stop a sender who wants to publish
personal data of a person: a name, a phone number or a street address passes the rules. The
reviewer and a fast removal of the file are the defence ([review.md](review.md) section 3).

Allowed facts: model names of a CPU, a GPU or a camera, PCI vendor and device ids, USB vendor and
product ids, driver and package versions, the OS label, and test results. These facts identify a
model, not one unit. There is no exception. A report holds no fact that identifies one camera
unit: no unit id, no serial number, no device path and no camera id of the OS
([ADR-6GAN](decisions/entries/6GAN-no-unit-id-of-a-camera.md)). A memory size is in whole MiB
([3.3](#33-host), "Memory in whole MiB").

## 7. Evidence validity

### 7.1 Validity

A module report is valid as evidence only when each of these statements is true:

1. `package.version` is a SemVer version. Else the reason is `no-version`.
2. `package.commit` is 40 lower-case hex digits. Else the reason is `no-commit`.
3. `package.tree_modified` is `false`. Else the reason is `modified-tree`. A module with
   `tree_modified: true` is a record only, because no commit identifies its source.
4. The run selected each check of its level. Else the reason is `partial-run`. A setup check that
   did not run because the person declined its setup does not make the run `partial-run`
   ([2.6](#26-the-plan-function), "Setups").
5. The run went to its end: the caller did not cancel it, the package did not refuse it, and the
   process did not end early. Else the reason is `cancelled`, `gpu-busy`, `cameras-busy` or
   `interrupted`. A cancelled run is not evidence.
6. `kind` is `quick` or `full`. Else the reason is `kind-not-evidence`.
7. Each rule of the package for its own evidence is true. The package adds its own codes to
   `evidence.reasons`, for example `packages-differ`.

The writer cannot check statement 8. The reviewer checks it:

8. `package.commit` is a commit in the [public repository of the package](#9-packages). Else the module is a
   record only. The reviewer gives the reason `commit-not-public` on the issue.

Any build can give evidence when each module records its version and its commit: a release, a
pre-release or a build of a commit on a branch. A release is not necessary.
`evidence.valid` is `true` only when `evidence.reasons` is empty.
The `evidence` object of each module report is independent. In one report file, one module can
be valid and another module not valid.

### 7.2 Kinds of evidence

A valid module report gives evidence by its `kind`:

| Kind | What it gives |
|---|---|
| `quick` | It makes the item usable on that computer, with the status "passed on this computer, not yet reviewed". Alone, it never gives a reviewed row. |
| `full` | It can give a reviewed row. |
| `passive` | Together with a `quick` pass on the same version set, it can give a reviewed row marked as field evidence. The `passive` record must reach the minimum volume of [7.3](#73-the-passive-record-reserved). |

- A row from a `passive` record never replaces a row that a package requires from a maintainer.
  For example, skellytracker requires maintainer rows for an NVIDIA version bump.
- A freemocap module of kind `full` is a record only until the level `full` of freemocap is built.
- A summary item with the result `skipped` never gives a reviewed row, with or without a `gate`.
  A summary item with the result `partial` gives a reviewed row only when it has a `gate`
  ([3.7](#37-summary)) and its `gate` check has the result `pass`. A `partial` item with no `gate`
  gives no reviewed row. The reviewer treats an item that gives no row as a record. The evidence
  row of a `partial` item keeps each check of the item that did not pass. The package that owns
  the row defines the form of the row ([ADR-T191](decisions/entries/T191-gate-of-a-summary-item.md)).
- The package that owns an evidence row gives its other rules for each kind. The reviewer reads
  those rules in the package.

### 7.3 The `passive` record (reserved)

The field list of a `passive` record is not yet defined in this version. A writer must not write
`"kind": "passive"`. A reader gives the reason `kind-not-evidence` to a `passive` module report.
The definition must obey these constraints:

- The package gathers the record from normal use.
- The person opts in one time.
- The record holds counts and histograms only. It never holds a camera frame, a path, a recording
  name, a frame number or a time finer than one day.
- The minimum volume is 200 compared frames, 5 recordings and 3 days, with no hard failure. These
  values are a starting point. They are not yet calibrated.
- A hard failure is a non-finite output, a crash, a hang, or two unclean exits in a row.
- A disagreement with the reference on real footage is a rate, not a single failure.

### 7.4 Camera evidence

Camera evidence comes later, as its own record type. Its key is the camera model (USB VID:PID),
the capture backend and the OS. Camera evidence is not part of an EP row.

## 8. Versioning of the format

- The schema id has the form `skellycertify.report/<major>.<minor>.<patch>`, with a SemVer version.
- A change that adds an optional field or a common reason code is a minor change.
- A fix of the text of this document with no change of the format is a patch change.
- A change that removes or renames a field, changes the meaning of a field, or makes an optional
  field required is a major change.
- A reader of major version N reads each report of major version N. It ignores each field that it
  does not know.
- A reader refuses a report of another major version.
- The module reports and the report file of one run use the same schema id.

Changes of the format:

- 1.10.0: A module report can have the optional field `seconds`: the length of the whole run of
  the package in seconds ([3.1](#31-fields)). The benchmark table has the header
  `| GPU | Module | Stage | ms/frame set | Frame sets/s |` ([4.2](#42-layout) part 5). The names of
  the fields `ms_per_frame` and `fps` do not change. A writer rounds `memory_bytes`, `vram_bytes`
  and `shared_memory_bytes` down to a whole MiB ([3.3](#33-host)). The writer of a report file
  prints each item of `checks` on one line of the data block ([4.2](#42-layout), "The lines of the
  data block"). This is a minor change: it adds one optional field. The other changes are rules for
  a writer and a header of the layout. They add no allowed value and change the meaning of no
  field. The relay accepts a memory value that is not a whole MiB and each layout of the data
  block. A reader of major version 1 still accepts a file of 1.9.0 or earlier
  ([ADR-2EXP](decisions/entries/2EXP-format-1-10-0.md)).
  These changes of the text are also in 1.10.0. They change no field, no allowed value and no check
  of the relay: the two aims of both levels ([2.7](#27-the-two-levels)), the exact count of `total`
  ([2.6](#26-the-plan-function)) and the new [5.8](#58-what-a-check-writes), which tells what a
  check writes
  ([ADR-ZW66](decisions/entries/ZW66-what-a-check-writes-and-the-aims-of-both-levels.md)). A `camera`
  item of a camera with no USB id has `device` `null` ([3.7](#37-summary))
  ([ADR-D249](decisions/entries/D249-device-null-for-a-camera-with-no-usb-id.md)).
- 1.9.0: An `ep`, `gpu-jpeg`, `camera` or `component` summary item can have `skipped` with the new
  reason `declined`, shown as `skipped (declined)`. It tells that the person declined each setup
  that the checks of the item need, so no check of the item ran ([2.6](#26-the-plan-function),
  "Setups", [3.7](#37-summary), [4.2](#42-layout)). When a check of the item ran, the item does not
  have `declined`. This is a minor change: it adds an allowed value, as
  `not-installed` did in 1.6.0. `declined` does not change the meaning of `busy`, `reviewed` or
  `not-installed`. A reader of 1.8.0 refuses such a report, so the schema id must tell the two
  apart. A reader of major version 1 still accepts a file of 1.8.0 or earlier
  ([ADR-T3BD](decisions/entries/T3BD-format-1-9-0-skipped-reason-declined.md)).
  This change of the text is also in 1.9.0. It changes no field, no allowed value and no check of
  the relay: the new [5.7](#57-the-list-of-check-names-of-a-package) tells each package to keep one
  list of its check names, and to test it
  ([ADR-9K1Q](decisions/entries/9K1Q-one-list-of-check-names-for-each-package.md)).
- 1.8.0: The plan can have the optional list `setups`. Each item has `id` and `text`. The plan of a
  quick run has an empty list. `certify()` and `certify_plan()` of each package accept the
  keyword-only option `setups`: the `id` of each setup that the person accepted. The app asks one
  yes/no question for each setup, apart from the consent to the full run. A setup check whose setup
  is not in the list is `not-run` with `not-selected`. A declined setup does not make the run
  `partial-run`. A roll-up check that requires a setup check that did not run is not `pass`, so its
  summary item gives no reviewed row ([2.2](#22-arguments), [2.6](#26-the-plan-function),
  [5.3](#53-common-reason-codes), [7.1](#71-validity)). This is a minor change: it adds an optional
  field of the plan and an option, as `abandon` did in 1.6.0. It adds no field of the report and no
  reason code. A reader of major version 1 still accepts a file of 1.7.0 or earlier
  ([ADR-974S](decisions/entries/974S-format-1-8-0-second-opt-in-for-a-setup.md)).
  These changes of the text are also in 1.8.0. They change no field, no allowed value and no check
  of the relay: the aims of the two levels and the one rule for the order of the checks
  ([2.7](#27-the-two-levels)), and the new [5.6](#56-when-a-check-can-exist-and-its-level), which
  tells when a package can create a check and at which level it runs
  ([ADR-TWK1](decisions/entries/TWK1-when-a-check-can-exist-and-the-aims-of-the-levels.md)).
- 1.7.0: The `name` of an item of `test_media` is exempt from rule 7 of
  [section 6](#6-privacy-rules) ([3.9](#39-test_media)). Each other rule still applies to it. This
  is a minor change. The change does not fix text: a `name` that ends with `.mp4` was invalid
  in 1.6.0 and is valid now. It adds no field and no code, but it adds an allowed value, and the
  owner decided that a new allowed value is a minor step. A reader of 1.6.0 refuses such a
  report, so the schema id must tell the two apart. A reader of major version 1 still accepts a
  file of 1.6.0 or earlier ([ADR-Q02Y](decisions/entries/Q02Y-test-media-name-exempt-from-rule-7.md)).
  These are patch changes inside 1.7.0. Each fixes the text of this document and changes no field,
  no allowed value and no check of the relay. The schema id stays 1.7.0:
  - The list of allowed facts in [section 6](#6-privacy-rules) named the local unit id of a camera
    (`details.cameras[].unit_id`) as an exception
    ([ADR-YHW7](decisions/entries/YHW7-camera-unit-id-allowed-fact.md)). The owner removed the
    exception on the same day, before a package wrote the id. The allowed facts identify a model,
    not one unit, with no exception
    ([ADR-6GAN](decisions/entries/6GAN-no-unit-id-of-a-camera.md)).
  - Rule 16 of [section 6](#6-privacy-rules) gives the sources of a camera name, in order: the list
    of known cameras of the package, a fixed class text for a personal device (also a camera whose
    product text holds a personal-device word), the USB product string through a filter,
    `Camera (no USB id)` and `Camera vvvv:pppp`. The name never comes from a display name that the
    OS or a person can set
    ([ADR-PS04](decisions/entries/PS04-personal-device-class-text-before-product-string.md)).
  - The new [5.5](#55-how-a-package-adds-a-check) tells how a package adds a check, and which
    changes need a change of this document. The owner of this repository approves each change of
    the format ([ADR-98KC](decisions/entries/98KC-how-a-package-adds-a-check.md)).
- 1.6.0: `certify()` accepts the keyword-only option `abandon`. When it is set, the run stops as
  for a cancel, and the package stores no result and writes no report file. `abandon` applies when
  `cancel` is also set ([2.4](#24-cancel)). A `component` summary item can have `skipped` with the
  new reason `not-installed`, shown as `skipped (not installed)` ([3.7](#37-summary),
  [4.2](#42-layout)). A module report can have the optional field `test_media`
  ([3.9](#39-test_media)), and a package uses its bundled copy of a test media file when the test
  media folder does not hold it ([2.8](#28-the-test-media-folder)). An item of `host.gpus` can have
  the optional field `shared_memory_bytes` ([3.3](#33-host)). A file with more than one report of
  one package carries the oldest `created_utc` in its name and its header line ([4.2](#42-layout)).
  This is a minor change. The owner decided that a new allowed value of this kind is a minor step:
  `not-installed` does not change the meaning of `busy` or `reviewed`, and only a `component` item
  can have it. The limit of the quick run of skellytracker in [3.6](#36-example-skellytracker) is
  65 seconds, not 75 seconds. That is a fix of the text. A reader of major version 1 still accepts
  a file of 1.5.0 or earlier ([ADR-9FHP](decisions/entries/9FHP-format-1-6-0.md)).
- 1.5.0: The new summary group `component` gives the result of a check of a part of the software
  that is not an EP, a GPU JPEG decode, a camera or a benchmark. Its `device` is `null`. The
  Markdown shows its items in the component table `| Module | Result |`, directly after the
  benchmark table ([3.7](#37-summary), [4.2](#42-layout)). `ms_per_frame` and `fps` of a
  `benchmark` item are for one frame set: one frame of each camera of the stage ([3.7](#37-summary)).
  In the Markdown part, a writer prints a four-part number in a value with each dot replaced by a
  space (rule 20 of [section 6](#6-privacy-rules)). This is a minor change. The rules above name
  no step for a new value of `group`. The new group `benchmark` of 1.3.0 was a minor change,
  and an item of the new group does not change the meaning of an item of another group. A reader
  of major version 1 still accepts a file of 1.4.0 or earlier
  ([ADR-VV80](decisions/entries/VV80-format-1-5-0.md)).
- 1.4.0: A package gives one check for each test, and a roll-up check gives the result of a group
  ([3.4](#34-check)). A module report can have the optional field `notices` ([3.8](#38-notices)).
  The plan has the fields `total` and `risks` ([2.6](#26-the-plan-function)). The level `quick`
  checks only things that are not yet reviewed, and the level `full` can check known-good things
  ([2.7](#27-the-two-levels)). The common reason code `over-budget` is new
  ([5.3](#53-common-reason-codes)). The table `Checks that did not pass:` with the column `Result`
  replaces the table of the failed checks ([4.2](#42-layout)). A reader of major version 1 still
  accepts a file of 1.3.0 or earlier
  ([ADR-V1TR](decisions/entries/V1TR-format-1-4-0.md)). The privacy rules 17 to 20 are new: no
  `<`, `](`, `]:`, `://` or `www.` in the Markdown part, a clean note, no key two times in one object,
  and no IPv4 address in the Markdown part or the note ([section 6](#6-privacy-rules)). The relay
  also checks the forms of `host` ([3.3](#33-host)), and it applies these checks to a file of each
  version. The schema id stays 1.4.0, because no writer shipped 1.4.0 yet
  ([ADR-MM1F](decisions/entries/MM1F-relay-hardened-after-security-review.md)). A summary item of
  the groups `ep`, `gpu-jpeg` and `camera` can have the optional field `gate`, and a `partial` item
  whose `gate` check is `pass` can give a reviewed row ([3.7](#37-summary),
  [7.2](#72-kinds-of-evidence), [ADR-T191](decisions/entries/T191-gate-of-a-summary-item.md)).
- 1.3.0: A summary item can have the results `partial` and `skipped`, and a `skipped` item has the
  field `reason` (`busy` or `reviewed`). The new group `benchmark` gives the benchmark table. A
  check and a section can have the optional field `module`, and the table of the failed checks has
  the columns `Package`, `Module`, `Test` and `Reason` ([3.7](#37-summary), [4.2](#42-layout)).
  The common reason codes `cameras-busy` and `interrupted` are new, and the header shows
  `incomplete` ([2.5](#25-runtime-rules), [5.3](#53-common-reason-codes)). The plan gives `source` and `sha256` for each
  download, and the option `test_media_dir` gives the shared test media folder
  ([2.6](#26-the-plan-function), [2.8](#28-the-test-media-folder)). There is one `camera` item for
  each camera model ([3.7](#37-summary)). By the rules above, a new value of `result` changes the
  meaning of a field, so it is a major change. The owner made it a minor change: the relay is the
  only reader that checks the values, and it changed in the same step. Also, no report with
  `summary` was accepted as evidence before this version. A reader of major version 1 still accepts
  a file of 1.2.0, 1.1.0 or 1.0.0 ([ADR-D1PW](decisions/entries/D1PW-format-1-3-0.md)).
- 1.2.0: A module report can have the optional field `summary` ([3.7](#37-summary)). The Markdown
  part has a new layout: a short summary for a person ([4.2](#42-layout)). A reader of major
  version 1 still accepts a file of 1.1.0 or 1.0.0, and a file in the earlier Markdown layout. The
  JSON block is the data in each layout. The owner revised this layout on the same day, before a
  writer shipped it: one system list for the whole file and the GPU table
  ([ADR-F1KN](decisions/entries/F1KN-format-1-2-0-markdown-layout-revised.md), which supersedes
  ADR-MC7T).
- 1.1.0: A module report can have the optional field `id` ([3.1](#31-fields)). A report file can
  hold more than one module report of one package ([4.1](#41-content)).
- 1.0.0: The first version.

## 9. Packages

These are the only packages of this format.

| Package | Evidence for | `certify()` | Reason codes | Evidence rows |
|---|---|---|---|---|
| skellytracker | execution providers (EPs) | `skellytracker.certify` and `skellytracker.certify_plan`, levels `quick` and `full`. Package options: `execution_providers`, `pipeline`. The tool `tools/certify_platform.py` writes a report file of this format (schema 1.10.0; see [3.6](#36-example-skellytracker)). | `skellytracker/REASON_CODES.md` | `skellytracker/core/eps/ep_evidence.yaml` (EPs); this repository for the other sections |
| freemocap | the app on an OS: it starts a child process, loads its bundled modules and can write its data folder | `freemocap.certify` and `freemocap.certify_plan`, level `quick`. The level `full` is not built. Package options: `ui_remote`, `blender_exe_path`. | the docstring of `freemocap/certification.py` | none yet |
| skellycam | cameras ([7.4](#74-camera-evidence)) | not yet implemented | not yet implemented | not yet implemented |

The place of the list of check names of each package ([5.7](#57-the-list-of-check-names-of-a-package)):
skellycam has it in `specs/certify.md` (the list is being built there). The place for skellytracker
and for freemocap is not yet defined.

The public repository of skellytracker is `https://github.com/domisjustanumber/skellytracker` for
now. The public repository of freemocap is `https://github.com/domisjustanumber/freemocap` for
now. A commit on each pushed branch of each of them counts. The public repository of skellycam is
not set yet.
