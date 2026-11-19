# Report format

**Status:** draft. Format version 1.1.0.

This document is the contract between the freemocap packages, the freemocap app and this
repository. Each package implements it in its own code. There is no shared code package.

## 1. Terms

| Term | Meaning |
|---|---|
| package | One freemocap package that has checks, for example `skellytracker` or `skellycam`. |
| app | A program that ships packages and calls `certify()` of each one, for example the freemocap app. |
| module report | The object that `certify()` of one package returns ([section 3](#3-the-module-report)). |
| report file | One Markdown file that holds one or more module reports ([section 4](#4-the-report-file)). |
| check | One test or one recorded fact, with one result. |
| section | An optional group of checks in a module report. |
| reason code | A short fixed code that tells why a check has its result, for example `timed-out`. |
| evidence row | A reviewed row in the package that owns the result. The app reads it to show "certified". |
| kind | The kind of a module report: `quick`, `full` or `passive`. |

## 2. The function

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
| `level` | `"quick"` or `"full"` | `quick` is the default level. It takes seconds. `full` is opt-in. It takes minutes. |
| `progress` | callable or `None` | The function calls it with one progress message (a `dict`). See [2.3](#23-progress-messages). |
| `cancel` | object or `None` | An object with a method `is_set() -> bool`, for example `threading.Event` or `multiprocessing.Event`. See [2.4](#24-cancel). |

- The function must raise `ValueError` for a `level` that is not `quick` or `full`.
- The function must not raise because of a check. A check that fails, crashes or runs too long is a
  result in the report.
- The `kind` of the returned report is equal to `level`.

**Package options.** A package can add its own options after these three arguments. Each option
must be keyword-only and must have a default. The call `certify(level)` must always work.
`certify_plan` takes the same options. The package gives its options in its own documentation.
For example, skellytracker takes the execution providers to check and the pipeline of the user:

```python
certify("quick", progress, cancel, execution_providers=["cuda"], pipeline=config)
```

An option changes which checks run. It does not change the format of the report. When an option
selects only a part of the checks of a level, the report is not valid as evidence (`partial-run`),
unless the rules of the package say that the selected part is complete for one item.

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

**Cleanup.**

- The package must delete each file that it downloads and each package that it installs. This
  rule also applies after a cancel, a crash or a time-out.
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
 "downloads": [
  {"name": "onnxruntime_ep_cuda13-0.2.0-py3-none-win_amd64.whl", "bytes": 1009000000}
 ],
 "system_changes": [],
 "questions": []
}
```

`system_changes` holds one fixed sentence for each change outside the work folder, for example the
install of a Windows ML package. `questions` holds the yes/no questions of the package, each with
`section`, `id` and `text`. `seconds_estimate` is the time estimate of the run in whole seconds.
Each item of `downloads` gives the file name and its size in bytes.

The app must show the plan of each package to the user. The app must get the consent of the user
before it calls `certify()`. The app asks one time for all packages. After the run, the app asks
the questions and puts the answers in `answers`.

## 3. The module report

### 3.1 Fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schema` | string | yes | `skellycertify.report/1.1.0` ([section 8](#8-versioning-of-the-format)). |
| `id` | string | no | A version 4 UUID in the lower-case form with hyphens (36 characters), for example `3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90`. The package gives it when it saves the report. It is unique in a report file. It holds no time and no machine data. A version 1 UUID is forbidden, because it holds the MAC address. A report that was not saved can have no `id`. |
| `package` | object | yes | See [3.2](#32-package). |
| `kind` | string | yes | `quick`, `full` or `passive` ([7.2](#72-kinds-of-evidence)). `passive` is reserved for a record that the package gathers from normal use ([7.3](#73-the-passive-record-reserved)). Its fields are not yet defined. A writer must not write `passive` in this version. |
| `created_utc` | string | yes | The start of the run, `YYYY-MM-DDTHH:MM:SSZ`. |
| `host` | object | yes | Hardware and software facts. See [3.3](#33-host). |
| `checks` | list | yes | Each check of the run. See [3.4](#34-check). |
| `sections` | list | no | The sections of the run. See [3.5](#35-section). |
| `cleanup` | list | no | One check object for each cleanup step that failed. An empty list or no field means that each step passed. |
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
under `details`.

| Field | Meaning |
|---|---|
| `os.name` | `Windows`, `Linux` or `macOS`. |
| `os.release`, `os.version`, `os.build` | The release, the version and the build number of the OS. |
| `os.label` | The OS as a person reads it, for example `Windows 11 Home 26H2`. |
| `os.arch` | The CPU architecture, for example `x86_64` or `arm64`. |
| `cpu.name` | The model name of the CPU. |
| `memory_bytes` | The total memory in bytes. |
| `gpus` | A list. Each item has `vendor`, `name`, `id` (the PCI vendor id and device id in lower-case hex, for example `10de:2484`), `driver_version` and `vram_bytes`. |

### 3.4 Check

| Field | Required | Meaning |
|---|---|---|
| `section` | when `sections` exists | The `id` of the section of the check. |
| `name` | yes | The check name. It matches `^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$`. The pair (`section`, `name`) is unique. |
| `result` | yes | `pass`, `fail`, `not-run` or `record-only` ([section 5](#5-results-and-reason-codes)). |
| `reason` | yes | A reason code, or `null`. It must not be `null` for `fail` and `not-run`. |
| `numbers` | no | A flat object of facts. Each value is a number, a boolean, `null`, a reason code, a list of reason codes, or a string from a fixed vocabulary of the package. It holds no free text. |

### 3.5 Section

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | A short id, for example `"3"`. |
| `name` | yes | The fixed name of the section. |
| `result`, `reason` | yes | The section result. Any `fail` check makes `fail`. Else any `pass` check makes `pass`. Else any `record-only` check makes `record-only`. Else `not-run`. A section with no check, for example a section that crashed, has its own result and reason. |
| `summary` | no | One line for a person. The package makes it from fixed words and from the facts of the report only. |
| `seconds`, `exit_code` | no | The time and the exit code of the child process of the section. |
| `details` | no | Facts of the section. They obey [section 6](#6-privacy-rules). |

### 3.6 Example: skellytracker

This is the layout of skellytracker for the level `quick`. The level `full` has the same layout
and more checks (see "Level `full`" below). The layout of `details` is the layout of the package.
The CPU name, the commit and the id are example values.

One report is one `certify()` call. It covers each selected pair of an execution provider (EP) and
a GPU. An EP that was not selected is not in the report. A selected pair that cannot run has the
result `not-run`, with a reason such as `ep-not-installed`, `gpu-not-usable` or `not-gpu-ep`.

- The label of a pair is `<ep>@<device>`, for example `cuda@10de-2484-0`. It is the plain `<ep>`
  for an EP with no GPU and for `coreml`.
- A check name with no `:` is the row of the pair. It passes only when its `probe` and `image`
  checks pass.
- The other checks of a pair are `<label>:probe` and `<label>:image`. For `cuda` and `trt-rtx` on a
  GPU there are also `<label>:jpeg-decode` and `<label>:jpeg-preprocess` (level `quick`).
- `details.eps.<label>` holds `gpu` (the GPU id, for example `10de:2484`, `chip:<slug>` for
  `coreml`, or `null`), `device` (the device key or `null`; the full form, for example
  `gpu:10de:2484:0`, not the short form of the label), `models`, `warnings` and `pack_version`.
  `models` and `warnings` are there only when the image run gave them. A pair that is `not-run`, or
  whose probe failed, has neither. Each item of `models` is an object with `key`, `version`, `size`,
  `precision`, `execution_provider` and `device`. `warnings` is a sorted list of warning codes.
  `pack_version` is `builtin` for a built-in EP (`directml`, `coreml`, `cpu`). For an EP of the
  Windows ML catalog it is the package version of the Windows ML record (or `windows-ml`). For a
  plugin pack it is the pack version, for example `0.2.0`. `pack_version` is optional. Older
  reports of level `quick` do not have it.
- The quick check compares a GPU EP with the CPU EP. `cpu` is not in the default selection. When a
  caller names it, its checks `cpu:probe`, `cpu:image` and `cpu` are all `not-run` with the reason
  `not-gpu-ep`. Its `details.eps.cpu` is `{"gpu": null, "device": null, "pack_version": "builtin"}`,
  with no `models` and no `warnings`.
- A check can also have `numbers`, for example `seconds`, `max_abs_diff`, `ep_ms`, `cpu_ms`,
  `speed_against_cpu` and `exit_code`.
- A child process that gave its result and did not exit cleanly adds a row `<name>:exit` with the
  result `record-only` and the reason `hung-at-exit` or `crashed`.
- `cuda@...` uses a plugin pack (`0.2.0`). `cuda` and `trt-rtx` pairs keep the two jpeg rows.
  `directml` has no jpeg rows.
- `details.versions` gives the versions one time for the report, not for each EP.
- The name and the driver version of a GPU are only in `host.gpus`. Join `host.gpus[].id` with
  `details.eps.<label>.gpu`. Two GPUs of one model have the same id.

```json
{
 "schema": "skellycertify.report/1.1.0",
 "id": "3f2b8c1e-9a4d-4e7b-b6a1-0c5d2e8f7a90",
 "package": {"name": "skellytracker", "version": "2.0.0", "commit": "0123456789abcdef0123456789abcdef01234567",
             "tree_modified": false},
 "kind": "quick",
 "created_utc": "2026-11-19T10:00:00Z",
 "host": {
  "os": {"name": "Windows", "release": "11", "version": "10.0.26300", "build": 26300,
         "label": "Windows 11 Home 26H2", "arch": "x86_64"},
  "cpu": {"name": "Example 8-Core Processor"},
  "memory_bytes": 34359738368,
  "gpus": [
   {"vendor": "nvidia", "name": "NVIDIA GeForce RTX 3070", "id": "10de:2484", "driver_version": "610.88",
    "vram_bytes": 8589934592}
  ]
 },
 "checks": [
  {"name": "cuda@10de-2484-0:probe", "result": "pass", "reason": null},
  {"name": "cuda@10de-2484-0:image", "result": "pass", "reason": null},
  {"name": "cuda@10de-2484-0:jpeg-decode", "result": "pass", "reason": null},
  {"name": "cuda@10de-2484-0:jpeg-preprocess", "result": "pass", "reason": null},
  {"name": "cuda@10de-2484-0", "result": "pass", "reason": null},
  {"name": "directml@10de-2484-0:probe", "result": "pass", "reason": null},
  {"name": "directml@10de-2484-0:image", "result": "pass", "reason": null},
  {"name": "directml@10de-2484-0", "result": "pass", "reason": null}
 ],
 "cleanup": [],
 "details": {
  "pipeline": "yolox-rtmw-wholebody@skellytracker",
  "eps": {
   "cuda@10de-2484-0": {"gpu": "10de:2484", "device": "gpu:10de:2484:0",
                        "models": [{"key": "yolox-m", "version": "1.0.0", "size": "m", "precision": "fp16",
                                    "execution_provider": "cuda", "device": "gpu:10de:2484:0"}],
                        "warnings": [], "pack_version": "0.2.0"},
   "directml@10de-2484-0": {"gpu": "10de:2484", "device": "gpu:10de:2484:0",
                            "models": [{"key": "yolox-m", "version": "1.0.0", "size": "m", "precision": "fp16",
                                        "execution_provider": "directml", "device": "gpu:10de:2484:0"}],
                            "warnings": [], "pack_version": "builtin"}
  },
  "versions": {"ort_distribution": "onnxruntime-windowsml", "ort_version": "1.30.0", "windowsml": "2.6.74rc0",
               "catalog_revision": "<64 hex digits>",
               "set_hash": "4abfaa7678817ed4a8ccb5f3e355ba28672589e8a3468bb6805e491dfe03a302"},
  "scrub": {"exempted_terms": 0}
 },
 "evidence": {"valid": true, "reasons": []}
}
```

**Level `full`.** The layout is the same as for `quick`: flat `checks`, no sections, the same
`details.eps` and `details.versions`. A full report adds
`details.full`: `{"camera_counts": [1, 3, 6], "warmup_calls": 10, "timed_calls": 100, "running_mode": "video"}`.
A full run writes a report file. skellytracker uses the `id` also as the file name and as the
hand-in id. Older files of schema 1.0.0 stay readable and have no `id`.

The order of the checks of a full report:

1. The CPU EP first, with no row of its own: `cpu:pipeline-1`, `cpu:pipeline-3`, `cpu:pipeline-6`,
   `cpu:jpeg`, then `cpu:jpeg:<name>` for each check of the JPEG certification.
2. Then each pair, with the same labels as `quick`: `<label>:probe`, `<label>:image`,
   `<label>:pipeline-1`, `<label>:pipeline-3`, `<label>:pipeline-6`, `<label>:jpeg`, each
   `<label>:jpeg:<name>`, then `<label>`. A full report has no `<label>:jpeg-decode` and no
   `<label>:jpeg-preprocess`.

- `<x>:pipeline-<n>` is the timing of the pipeline at `<n>` cameras. Its result is `record-only`.
  Its `numbers` are `cameras`, `start_seconds`, `first_call_ms`, `calls`, `median_ms`, `p95_ms`,
  `vram_before_mib` and `peak_vram_mib` (`null` when there is no VRAM reader). A pair on a GPU also
  has `against_cpu` and `speed_against_cpu`.
- A timing is `not-run` with the class name of an exception as the reason when the run raised, for
  example when there is no VRAM at 6 cameras. It is `not-run` with `image-not-passed` when the image
  check did not pass, and with `models-missing` on the CPU EP when a model file is absent. It is
  `fail` with `crashed` or `timed-out` when the child process died.
- `<x>:jpeg` is the outcome of the JPEG checks. It is `fail`, with the reason of the first failed
  check, when a check failed. Else it is `pass` when a check passed. Else it is `not-run` with
  `no-check`. It is `not-run` with `probe-not-passed` when the probe did not pass. It exists only for
  `cuda`, `trt-rtx`, `directml`, `amdgpu` and `migraphx` on a GPU.
- `<x>:jpeg:<name>` is one check of the JPEG certification, for example `cpu_decode.baseline_420` or
  `gpu_decode.baseline_422`. There are about 70 names for each target today. The result is `pass`,
  `fail`, `not-run` or `record-only`. The reason keeps the code of the JPEG module, with
  underscores, for example `ep_not_present`, `no_gpu_decode_on_ep` or `over_limit`.
- `<name>:exit` rows are as in `quick`.
- `<label>` passes when its `probe` and `image` pass. A timing or a JPEG check never changes it.
- A named `cpu` pair is still the three rows `cpu:probe`, `cpu:image` and `cpu`, all `not-run` with
  `not-gpu-ep`.
- With no EP named, `full` also takes a pair that has a reviewed row. `quick` skips such a pair.
  With no EP at all, `full` still runs the CPU checks. It installs nothing. It downloads only the
  test image.

## 4. The report file

### 4.1 Content

One report file holds one JSON object:

| Field | Meaning |
|---|---|
| `schema` | `skellycertify.report/1.1.0`. |
| `app` | `name`, `version` (SemVer) and `commit` of the app, or `null` for a report of one package that ran alone. |
| `modules` | A list of module reports. The list holds at least one module report. A package can give more than one module report, for example one for each run. Each module report is independent ([7.1](#71-validity)). |
| `note` | The one free-text note of the person, or `null`. At most 2000 characters. |

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

### 4.2 Layout

The file is Markdown, in UTF-8, with `\n` line ends. Its name is
`certify-report-<yyyymmddThhmmssZ>.md`, with the UTC start time of the run.

1. A title line: `# Certify report`.
2. One line with the schema, the app and its version (if any), and the UTC time.
3. One line for each module: `**<name> <version>:** valid as evidence.`, or
   `**<name> <version>:** not valid as evidence: <reasons>.`
4. A summary table with one row for each section, or for each check when a module has no
   sections: `| Module | Section | Result | Reason |`.
5. Optional: the details for a person, for example a table of checks for each section and the
   note.
6. Last: the heading `## Data` and one fenced code block with the info string `json`. It holds
   the object of [4.1](#41-content). The fence has at least 3 backticks. It is longer than each
   run of backticks in the JSON.

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

Schema `skellycertify.report/1.1.0`, app freemocap 2.0.0, created 2026-11-19T10:00:00Z (UTC).

**skellytracker 2.0.0:** valid as evidence.
**skellycam 1.0.0:** not valid as evidence: modified-tree.

| Module | Section | Result | Reason |
|---|---|---|---|
| skellytracker | 1. Checkout and versions | pass | |
| skellytracker | 3. EPs: install, verify and certify | pass | |
| skellycam | open-camera | fail | timed-out |

## Data

```json
{
 "schema": "skellycertify.report/1.1.0",
 "app": {"name": "freemocap", "version": "2.0.0", "commit": "89abcdef0123456789abcdef0123456789abcdef"},
 "modules": [
  {"schema": "skellycertify.report/1.1.0", "package": {"name": "skellytracker", "...": "..."}},
  {"schema": "skellycertify.report/1.1.0", "package": {"name": "skellycam", "...": "..."}}
 ],
 "note": null
}
```
````

The `"...": "..."` items only make the example short. A real file holds each required field.
The skellycam values are examples. skellycam has no checks of this format yet.

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
| `not-selected` | check, section | The person or the caller did not select the check. |
| `not-built` | check, section | The check does not exist in this version of the package yet. |
| `no-version` | `evidence.reasons` | `package.version` is not a SemVer version. |
| `no-commit` | `evidence.reasons` | `package.commit` is `null` or not 40 hex digits. |
| `modified-tree` | `evidence.reasons` | `package.tree_modified` is not `false`. |
| `partial-run` | `evidence.reasons` | Not all checks of the level were selected. |
| `kind-not-evidence` | `evidence.reasons` | The `kind` is `passive`. This version does not define the fields of a `passive` record. |
| `commit-not-public` | the answer of the reviewer | `package.commit` is not in the public repository of the package. The reviewer gives this code on the issue. It is not in the report file. |

### 5.4 Codes of a package

Each package owns its other reason codes. This repository does not own them.

- Each package must keep the list of its reason codes in its own repository. The list gives each
  code, or each form of code (for example `install-<code>`), with one sentence of meaning.
- The package must add a code to the list in the same commit that adds the code to its checks.
- [Section 9](#9-packages) gives the place of the list of each package.

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
   `.flac`. The file names of recordings are not in a report.
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

Allowed facts: model names of a CPU, a GPU or a camera, PCI vendor and device ids, USB vendor and
product ids, driver and package versions, the OS label, and test results. These facts identify a
model, not one unit.

## 7. Evidence validity

### 7.1 Validity

A module report is valid as evidence only when each of these statements is true:

1. `package.version` is a SemVer version. Else the reason is `no-version`.
2. `package.commit` is 40 lower-case hex digits. Else the reason is `no-commit`.
3. `package.tree_modified` is `false`. Else the reason is `modified-tree`. A module with
   `tree_modified: true` is a record only, because no commit identifies its source.
4. The run selected each check of its level. Else the reason is `partial-run`.
5. The run went to its end: the caller did not cancel it, and the package did not refuse it.
   Else the reason is `cancelled` or `gpu-busy`. A cancelled run is not evidence.
6. `kind` is `quick` or `full`. Else the reason is `kind-not-evidence`.
7. Each rule of the package for its own evidence is true. The package adds its own codes to
   `evidence.reasons`, for example `packages-differ`.

The writer cannot check statement 8. The reviewer checks it:

8. `package.commit` is a commit in the public repository of the package. Else the module is a
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

- 1.1.0: A module report can have the optional field `id` ([3.1](#31-fields)). A report file can
  hold more than one module report of one package ([4.1](#41-content)).
- 1.0.0: The first version.

## 9. Packages

These are the only packages of this format.

| Package | Evidence for | `certify()` | Reason codes | Evidence rows |
|---|---|---|---|---|
| skellytracker | execution providers (EPs) | `skellytracker.certify` and `skellytracker.certify_plan`, levels `quick` and `full`. Package options: `execution_providers`, `pipeline`. The tool `tools/certify_platform.py` still writes the old format ([section 10](#10-differences-from-skellytrackercertify-suite1)). | `skellytracker/REASON_CODES.md` | `skellytracker/core/eps/ep_evidence.yaml` (EPs); this repository for the other sections |
| skellycam | cameras ([7.4](#74-camera-evidence)) | not yet implemented | not yet implemented | not yet implemented |

## 10. Differences from skellytracker.certify-suite/1

The report of `tools/certify_platform.py` of skellytracker uses the schema
`skellytracker.certify-suite/1`. These changes make it a module report of this format. The function `certify("full")` of skellytracker
is built ([3.6](#36-example-skellytracker)). Its result has flat checks and no sections. Making the
tool call it is planned, not built. The steps below stay valid for what the tool still has to change.

1. **Schema id.** Write `skellycertify.report/1.1.0` in place of `skellytracker.certify-suite/1`.
   Move `suite_version` to `details.suite_version`.
2. **Package block.** Add `package` with `name`, `version`, `commit` and `tree_modified`. Today the
   commit and the clean state are in `details.checkout` of section 1, and the report records no
   package version. `tree_modified` is `not checkout.clean`.
3. **SemVer version.** `skellytracker.__version__` is `v2024.09.1019` today. That is not SemVer. The
   package must give a SemVer version with no `v` prefix.
4. **Commit with no git.** Today section 1 runs `git`. A frozen app has no git. The package must
   also get its commit from metadata that the build writes.
5. **Kind.** Add `kind`. The suite of today is the level `full`. Both levels are
   `skellytracker.certify` ([3.6](#36-example-skellytracker)).
6. **Host block.** Add `host` at the top level, from `probe_host()`: `os_name`, `os_release`,
   `os_version`, `os_build`, `os_label` and `arch` go to `host.os.name`, `release`, `version`,
   `build`, `label` and `arch`. The GPUs go to `host.gpus`, with `id` from `evidence.gpu_id()`.
   Section 2 keeps its details.
7. **Flat checks.** Move each check out of `sections[].checks` to the top-level `checks`, with
   `section` set to the section number as a string. The sections keep `result`, `reason`,
   `summary`, `seconds`, `exit_code` and `details`. `questions` of a section moves to the plan
   ([2.6](#26-the-plan-function)). The answers stay in `answers`.
8. **Section ids.** `number` (an integer) becomes `id` (a string), for example `"3"`.
9. **Reason field.** Rename `reason_code` to `reason` in each check, each section and each cleanup
   row. The `reason_code` keys inside `details` can stay.
10. **Numbers.** Move each extra key of a check (for example `changed_files`, `differ`, `pinned`,
    `exit_code`, `grace_seconds`, `reasons` and the agreement fields of section 4) into `numbers`.
11. **Cancel code.** The reason `interrupted` becomes `cancelled`, in the checks and in
    `evidence.reasons`.
12. **Evidence block.** `evidence` keeps `valid` and `reasons`. Remove `tag` and `commit` from it:
    the commit is in `package`. Remove the reason `no-tag`: any build can give evidence. The tag
    stays a fact in `details.checkout`. Add `no-version` and `no-commit`. Keep
    `section-1-not-run`, `python-differs` and `packages-differ` as codes of the package.
    `modified-tree` and `partial-run` keep their meaning.
13. **Note.** `notes` becomes `note` and moves out of the module report to the report file
    object. The limit of 2000 characters stays.
14. **Package facts.** Move `selected`, `telemetry_database` and `scrub` into `details`.
15. **Report file.** Wrap the module report in the object of [4.1](#41-content):
    `{"schema", "app": null, "modules": [<module report>], "note"}`. Add the module line and the
    `Module` column to the summary table. The title becomes `# Certify report`. The rest of the
    Markdown layout stays.
16. **Reason code list.** Write the list of the reason codes of skellytracker, with the forms
    `install-<code>`, `catalog-<ExceptionClass>`, `image-<code>`, `cleanup-<ExceptionClass>`,
    `probe-<level>-failed` and the bare exception class name.
17. **Function.** Add a public `certify(level, progress=None, cancel=None)` for the whole package.
    skellytracker has it for the levels `quick` and `full`. Today the suite is a tool script with consent at a terminal. It starts `sys.executable` with
    the script path for each section. `skellytracker.core.eps.certify(key)` tests one EP and gives
    only a step name to `progress`. The new function must not ask questions, must send complete
    progress messages, must obey `cancel`, and must not start `sys.executable` with a script path.
