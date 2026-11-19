# Open work

This file holds the open work of the [decision log](README.md). Read the items that apply to your
task. Delete an item when its work is done. The PR that closes an item records the result.

- **The first real certify report.** `reports/` holds no report yet. Run skellytracker's
  `tools/certify_platform.py` on a computer of the owner, send the file through the relay, and
  review it with [`review.md`](../review.md).
- **"The public repository of the package" has no definition.** Statement 8 of
  [Validity](../report-format.md#71-validity) in `report-format.md`, the reason code
  `commit-not-public` and [`review.md`](../review.md#4-check-validity) use the term. The
  [Terms](../report-format.md#1-terms) table does not define it, and
  [Packages](../report-format.md#9-packages) gives no repository address.
- **The GitHub App of the relay is not checked through the API.** Part 2 of
  [`relay/README.md`](../relay/README.md) gives the permissions (Contents and Issues read and write,
  Metadata read-only) and the installation on one repository only. No tracked file records a check
  of these settings through the GitHub API.
