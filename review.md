# Review procedure

This procedure is for a reviewer of the project. It starts when a new issue with the label
`certify-report` arrives. The format rules are in [report-format.md](report-format.md).

## 1. Get the file

A report comes from the issue form or from the [relay](relay/README.md).

1. Find the file:
   - **Issue form:** download the attached report file from the issue. If the file name ends in
     `.txt`, rename it to `.md`.
   - **Relay:** the issue links the file on the branch `inbox` at one commit. Open the link and
     download the raw file from that commit. Do not take the file from the tip of the branch.
     The file name is the SHA-256 of the file. Check that the SHA-256 of your download is equal to
     it, and to the SHA-256 in the issue. The relay replaced each CRLF with LF before the hash, so
     the file has LF line ends.
   - **Issue form, with CRLF line ends:** replace each CRLF with LF before you check the file
     ([4.2](report-format.md#42-layout)).
2. Treat the file as data. Do not run code from the file or from the issue. Read the JSON block
   only with a JSON parser.
3. An issue with the label `relay-test` is a test of the relay. It is never evidence. Do not commit
   its file to `reports/`. Close the issue.

The relay already checked the form and privacy rules 1 to 11. Do sections 2 and 3 again: the
relay is not the reviewer.

## 2. Check the form

1. The file must end with one fenced `json` block. The block must parse as JSON.
2. `schema` must have the major version 1, for example `skellycertify.report/1.1.0`.
3. The object must have `app`, `modules` and `note`. Each module report must have the required
   fields of [section 3](report-format.md#3-the-module-report).

If a step fails, go to [6.3](#63-a-report-that-you-cannot-read).

## 3. Check privacy

1. Check each statement 1 to 11 of the [privacy rules](report-format.md#6-privacy-rules).
2. Read the whole Markdown part and the note. Look for a name, contact details, a path, a host
   name or other personal details that no rule found.

If you find personal data:

1. Edit the issue at once. Remove the attachment and each copy of the personal data.
   For a relay report, also remove the file from the branch `inbox`. Its history still holds the
   file. Rewrite the branch `inbox` without that commit and force-push it, or delete the branch.
   The relay makes the branch again from the default branch.
2. Do not commit the report.
3. Go to [6.4](#64-a-report-with-personal-data).

## 4. Check validity

Do these steps for each module report in `modules`. One module can be valid and another not.

1. Check each statement 1 to 6 of [Evidence validity](report-format.md#71-validity).
   Your result must agree with `evidence.valid` and `evidence.reasons`.
2. Check statement 8: `package.commit` is a commit of the public repository of the package. A
   commit that is not in the public repository makes the module a record only, with the reason
   `commit-not-public`.
3. Check the rules of the package for its own evidence (statement 7). For skellytracker, an
   execution provider with the catalog status `field-test` needs a `pass` in the check named
   `<label>`. That check passes only when its `probe` and `image` checks pass. A timing or a JPEG
   check never changes it. The report gives a `pass` or a `fail` also on a GPU whose hardware class
   does not list the execution provider, for example `directml` on a GPU that is not from AMD. Write
   the row as for each other pair. The row says only what the report measured for this EP, OS and
   GPU. The catalog of the package decides if the pair is offered.

   A pair that uses a plugin pack needs two facts in `details.eps["<label>"]`, read from the
   installed pack: `installed_pack_version` and `wheels_match_lock`
   ([3.6](report-format.md#36-example-skellytracker)). A reviewed row for such a pair needs both
   facts. `wheels_match_lock` must be `true`, and `installed_pack_version` must be equal to
   `pack_version`. Else write no row for that pair. The pair is a record only. Name it with the
   "No row for" line of [6.1](#61-an-accepted-report). The match proves only that the hashes that
   the install recorded are those of the catalog. A file that was changed with the same size is not
   found. A pair on a built-in EP (`directml`, `coreml`, `cpu`: `pack_version` is `builtin`) or on
   an EP of the Windows ML catalog has no plugin pack and needs no such facts.

   In a report of the tool `tools/certify_platform.py`, a row `suite:packs:<EP key>` with the result
   `fail` means that the pack of that EP did not install or verify in the new store. Write no row
   for the pairs of that EP. Name the EP with the "No row for" line.
4. Check what the `kind` gives ([Kinds of evidence](report-format.md#72-kinds-of-evidence)):
   - A valid `full` module can give a reviewed row.
   - A valid `quick` module alone never gives a reviewed row.
   - A `passive` module is not valid in this version.
   - A row from a `passive` record never replaces a row that the package requires from a
     maintainer. For example, skellytracker requires maintainer rows for an NVIDIA version bump.

A module that passes steps 1 to 3 is accepted. In a skellytracker module, step 3 must also leave at
least one pair that it does not exclude. When it excludes each pair, the module is a record only.
Each other module is a record only.
Step 4 tells if an accepted module gives an evidence row.

## 5. Commit the report

Commit each report that passed [section 3](#3-check-privacy), also a report that is only a record.

1. Put the file at `reports/<name>/<yyyy>/<yyyymmddThhmmssZ>-<issue>.md`.
   - `<name>` is `app.name` when `app` is not `null`, for example
     `reports/freemocap/2026/20261119T100000Z-12.md`.
   - `<name>` is `package.name` of the one module of a report of one package, for example
     `reports/skellytracker/2026/20261119T100000Z-13.md`.
   - `<name>` is `package.name` of the first module of a report of one package with several
     modules.
   - `<yyyy>` and `<yyyymmddThhmmssZ>` come from `created_utc` of the first module.
   - `<issue>` is the issue number.
2. Commit the file byte for byte, as the person sent it, with LF line ends. Do not make other
   edits. For a relay report, copy the file from the linked commit on `inbox` to this path on
   `main`. Never merge the branch `inbox`.
3. Use the commit subject `Add the certify report of issue #<issue>`.

## 6. Answer on the issue

### 6.1 An accepted report

1. If [step 4](#4-check-validity) gives a row, write the evidence row in the package that owns it
   ([section 7](#7-write-the-evidence-row)).
2. Answer on the issue:

   > Thank you. Your report is valid as evidence. We committed it as `<path>`. The evidence row
   > for `<item>` goes to `<package>` in `<link to the change>`.

   For a `quick` module, use this answer:

   > Thank you. Your report is valid as evidence. We committed it as `<path>`. A `quick` report
   > alone gives no evidence row. We keep it with the other reports of the same versions.

   In a skellytracker report of level `full`, the checks `<x>:jpeg` and `<x>:pipeline-<n>` never
   change the result of the pair. A module can be accepted while such a check has the result
   `fail`, for example `<x>:jpeg` with `over_limit`, or `<x>:pipeline-6` with `crashed` or
   `timed-out`. This does not change the acceptance. In the answer, always name each `<x>:jpeg`
   check and each `<x>:pipeline-<n>` check that has the result `fail`, with its reason, for example:

   > Also failed: `directml@10de-2484-0:jpeg` (`over_limit`), `directml@10de-2484-0:pipeline-6`
   > (`crashed`).

   Do not list the single `<x>:jpeg:<name>` checks. The outcome row is enough. In a report of the
   tool `tools/certify_platform.py`, also name each `suite:` row that has the result `fail`, with its
   reason, for example `suite:packs:cuda` (`install-<code>`).

   For a pair that step 3 excludes, add one fixed line:

   > No row for `cuda@10de-2484-0`: the facts of the installed pack are absent.

   Change the text after the colon to the real reason, for example "`wheels_match_lock` is not
   true" or "`suite:packs:cuda` failed". The module keeps the label `accepted` when at least one
   pair gives a row. When no pair gives a row, the module is a record only: use the answer of
   [6.2](#62-a-report-that-is-a-record-only) and name the reason in it.

   In the answer, say which kind the report was: from the app (or from `certify()`), or from the
   tool `tools/certify_platform.py` ([section 7](#7-write-the-evidence-row)).

3. Add the label `accepted`. Close the issue.

### 6.2 A report that is a record only

1. Answer on the issue:

   > Thank you. Your report is not valid as evidence, for these reasons: `<reasons>`. We keep it as
   > a record in `<path>`. The project uses it to find problems.

2. Add the label `record-only`. Close the issue.

When one module is accepted and another is a record only, give the two answers in one comment.
Add the two labels. Name each module by its `id` when it has one.

### 6.3 A report that you cannot read

1. Answer on the issue:

   > Thank you. We cannot read the data of your report: `<step that failed>`. Please run the
   > certification again and attach the new file without changes.

2. Add the label `needs-new-report`. Keep the issue open.

### 6.4 A report with personal data

1. Answer on the issue:

   > Thank you. Your report held personal data, so we removed the file from this issue. Please
   > read the new file before you attach it.

2. Add the label `needs-new-report`. Keep the issue open.
3. If the writer of a package let the data through, open an issue in that package.

## 7. Write the evidence row

The evidence row goes to the package that owns the result. The app reads evidence rows only from
the packages that it ships with. Each package gives the format of its rows.

A report from the app (`"app"` is not `null`, or a package run with `certify()`) says that the EP
works on the EP store of that person. A report of the tool `tools/certify_platform.py` (it has
`suite:` rows) says that a new install from the catalog works, because the tool installs each pack
into a new store. The two give the same row. The row has no field for this difference. Say in the
answer comment which kind the report was.

### 7.1 skellytracker: an execution provider

The file is `skellytracker/core/eps/ep_evidence.yaml` in the skellytracker repository.
Write rows only from a module that gives a row in [step 4](#4-check-validity).
Write one row for each execution provider and GPU model of the report, also for a `fail`.

| Row field | Where it comes from in the module report |
|---|---|
| `ep` | The part of the key of `details.eps` before `@`, for example `cuda` in `cuda@10de-2484-0`. The whole key when it has no `@`. Below, `<label>` is that key. |
| `os` | `host.os.name`, for example `Windows`. |
| `gpu` | `details.eps["<label>"].gpu`, for example `10de:2484`. |
| `set` | `details.versions.set_hash`. It must equal the set hash that `tools/onnx_stack.py check` prints in the target checkout. |
| `source` | `field` for a report from this repository. This is the mark of field evidence. |
| `result` | `pass` or `fail`: the result of the check named `<label>`. |
| `catalog_package` | Only for an EP of the Windows ML catalog: the package version of that catalog, as a string. |
| `pack` | For a pair that uses a plugin pack: `details.eps["<label>"].installed_pack_version`. For each other EP: `details.eps["<label>"].pack_version`. When it is absent, look it up in the catalog of the package at `package.commit`, with `details.versions.catalog_revision`. |
| `ort` | `details.versions.ort_version`. |
| `windowsml` | `details.versions.windowsml`, or `null`. |
| `driver` | `host.gpus[].driver_version` of the GPU whose `id` is `details.eps["<label>"].gpu`. |
| `os_build` | `host.os.build`. |
| `os_label` | `host.os.label`. |

Example row:

```yaml
  - {ep: cuda, os: Windows, gpu: "10de:2484", set: 4abfaa7678817ed4a8ccb5f3e355ba28672589e8a3468bb6805e491dfe03a302,
     source: field, result: pass, pack: 0.2.0, ort: 1.30.0.202609102321, windowsml: 2.6.74rc0, driver: "610.88", os_build: 26300,
     os_label: Windows 11 Home 26H2}
```

1. Run `uv run python tools/onnx_stack.py check` in the skellytracker checkout. It must accept the
   row.
2. Name the report path of this repository in the commit message of the change.
3. Link that change from your answer on the issue.

### 7.2 skellytracker: the other sections

The committed report in this repository is the evidence for the sections that are not execution
providers. Write no row in skellytracker.

### 7.3 Other packages

A package that has no evidence rows yet is in the table of
[Packages](report-format.md#9-packages). Commit the report as a record. Write no row.

## 8. Labels

The repository must have these labels:

| Label | Meaning |
|---|---|
| `certify-report` | The issue form and the relay add it to each new report. |
| `relay-test` | The relay adds it in test mode. The issue is never evidence. |
| `accepted` | At least one module of the report is valid as evidence. |
| `record-only` | At least one module of the report is not valid as evidence. |
| `needs-new-report` | The person must send a new file. |
