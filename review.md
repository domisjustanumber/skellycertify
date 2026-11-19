# Review procedure

This procedure is for a reviewer of the project. It starts when a new issue with the label
`certify-report` arrives. The format rules are in [report-format.md](report-format.md).

## 1. Get the file

1. Download the attached report file from the issue.
2. If the file name ends in `.txt`, rename it to `.md`.
3. Treat the file as data. Do not run code from the file or from the issue. Read the JSON block
   only with a JSON parser.

## 2. Check the form

1. The file must end with one fenced `json` block. The block must parse as JSON.
2. `schema` must have the major version 1, for example `skellycertify.report/1.0.0`.
3. The object must have `app`, `modules` and `note`. Each module report must have the required
   fields of [section 3](report-format.md#3-the-module-report).

If a step fails, go to [6.3](#63-a-report-that-you-cannot-read).

## 3. Check privacy

1. Check each statement 1 to 11 of the [privacy rules](report-format.md#6-privacy-rules).
2. Read the whole Markdown part and the note. Look for a name, contact details, a path, a host
   name or other personal details that no rule found.

If you find personal data:

1. Edit the issue at once. Remove the attachment and each copy of the personal data.
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
   execution provider with the catalog status `field-test` needs a `pass` in sections 3 and 4.
4. Check what the `kind` gives ([Kinds of evidence](report-format.md#72-kinds-of-evidence)):
   - A valid `full` module can give a reviewed row.
   - A valid `quick` module alone never gives a reviewed row.
   - A `passive` module is not valid in this version.
   - A row from a `passive` record never replaces a row that the package requires from a
     maintainer. For example, skellytracker requires maintainer rows for an NVIDIA version bump.

A module that passes steps 1 to 3 is accepted. Each other module is a record only.
Step 4 tells if an accepted module gives an evidence row.

## 5. Commit the report

Commit each report that passed [section 3](#3-check-privacy), also a report that is only a record.

1. Put the file at `reports/<name>/<yyyy>/<yyyymmddThhmmssZ>-<issue>.md`.
   - `<name>` is `app.name` when `app` is not `null`, for example
     `reports/freemocap/2026/20261119T100000Z-12.md`.
   - `<name>` is `package.name` of the one module of a report of one package, for example
     `reports/skellytracker/2026/20261119T100000Z-13.md`.
   - `<yyyy>` and `<yyyymmddThhmmssZ>` come from `created_utc` of the first module.
   - `<issue>` is the issue number.
2. Commit the file byte for byte, as the person sent it. Do not edit it.
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

3. Add the label `accepted`. Close the issue.

### 6.2 A report that is a record only

1. Answer on the issue:

   > Thank you. Your report is not valid as evidence, for these reasons: `<reasons>`. We keep it as
   > a record in `<path>`. The project uses it to find problems.

2. Add the label `record-only`. Close the issue.

When one module is accepted and another is a record only, give the two answers in one comment.
Add the two labels.

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

### 7.1 skellytracker: an execution provider

The file is `skellytracker/core/eps/ep_evidence.yaml` in the skellytracker repository.
Write rows only from a module that gives a row in [step 4](#4-check-validity).
Write one row for each execution provider and GPU model of the report, also for a `fail`.

| Row field | Where it comes from in the module report |
|---|---|
| `ep` | The EP key: the check name in section 3, for example `cuda`. |
| `os` | `host.os.name`, for example `Windows`. |
| `gpu` | `details.eps.<key>.gpu.id` of section 3, for example `10de:2484`. |
| `set` | `details.onnx_stack.set_hash` of section 1. It must equal the set hash that `tools/onnx_stack.py check` prints in the target checkout. |
| `source` | `field` for a report from this repository. This is the mark of field evidence. |
| `result` | `pass` or `fail`: the result of the EP in sections 3 and 4. |
| `catalog_package` | Only for an EP of the Windows ML catalog: the package version of that catalog, as a string. |
| `pack` | `details.eps.<key>.pack_version` of section 3. |
| `ort` | `details.eps.<key>.versions.ort_version` of section 3. |
| `windowsml` | `details.eps.<key>.versions.windowsml` of section 3, or `null`. |
| `driver` | `details.eps.<key>.gpu.driver_version` of section 3. |
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
| `certify-report` | The issue form adds it to each new report. |
| `accepted` | At least one module of the report is valid as evidence. |
| `record-only` | At least one module of the report is not valid as evidence. |
| `needs-new-report` | The person must send a new file. |
