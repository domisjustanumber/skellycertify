# skellycertify

This repository receives certification reports for the freemocap project.
A certification report tells the project what works on one computer: which GPU runs which
execution provider, which camera works, and what failed.
The project has only a few computers to test on. Your report helps the project support your
hardware.

This repository holds no test code.
The tests are in each freemocap package, for example skellytracker and skellycam.
The repository holds one small program: the relay in [relay/](relay/README.md). The relay files a
report that the app sends. It runs no test.

## Who sends what

- **You** run a certification in the freemocap app, or in the clone of one package.
  The run writes one report file. The run sends nothing. When the interface of the app and its
  backend are on different computers, the backend returns the file as it is.
- **You** send the report file to this repository in one of two ways:
  1. **The relay.** The app shows you the exact file. It sends the file to the relay only when you
     choose "send". A later retry sends the same file again, and nothing else. You need no
     GitHub account. The relay checks the file, commits it to the branch `inbox` and opens an
     issue. It stores nothing about you. See [relay/README.md](relay/README.md).
  2. **The issue form.** You attach the file to a GitHub issue
     ([Send a report in 3 steps](#send-a-report-in-3-steps)). The issue form is the permanent
     fallback, for example when the relay is off or refuses the file.
- **A reviewer** of the project reads the report and accepts it or keeps it as a record.

## Send a report in 3 steps

1. Open the report file. The app or the tool tells you where it is. The file name has the form
   `certify-report-<time>.md`.
2. Read the whole file. It must hold no personal data (see [Privacy](#privacy)). If you find
   personal data, remove it from the file.
3. Open a new issue in this repository with the form **Certify report**:
   `https://github.com/domisjustanumber/skellycertify/issues/new/choose`.
   Fill in the form and attach the report file.
   If GitHub does not accept the `.md` file, rename it to `.txt` and attach that file.

A `fail` result is useful to the project. Do not run the certification again to get a `pass`.
Send the report as it is.

## What happens to your report

1. A reviewer checks the report. The procedure is in [review.md](review.md).
2. If the report is valid, the reviewer commits the whole report to [reports/](reports/README.md).
3. The reviewer adds an evidence row to the package that owns the result. For example, an
   execution provider result goes to skellytracker. A `full` report can give a row. A `quick`
   report alone gives no row.
4. The next release of that package ships the row. The app then shows the item as "certified" on
   your hardware.

A report that is not valid as evidence stays in this repository as a record.
The reviewer tells you why on the issue.

## Privacy

A report holds hardware and software facts only: model names, PCI ids, versions and test results.
A report never holds:

- a host name, a user name or an absolute path;
- a serial number or a bus address;
- a camera frame or the file name of a recording;
- an error text or a traceback. A failure is a short fixed code, for example `timed-out`.

The report can hold one note from you. Do not write your name, your contact details or other
personal details in the note.
The software removes your user name and your host name from the report. It cannot find every
personal detail. You must read the report before you send it.

## Documents

- [report-format.md](report-format.md): the report format and the `certify()` contract that each
  package implements.
- [review.md](review.md): the procedure for a reviewer.
- [relay/README.md](relay/README.md): the relay, its answers and its setup.

## Licence

AGPL-3.0-or-later. See [LICENSE](LICENSE).
