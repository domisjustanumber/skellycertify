# M8E0 — The passive record: design so far, with the questions that are open

**Status:** proposed, 2026-11-21 (owner, round 1 of the questions). Round 2 is not answered.

## Decision

Nothing of this is in `report-format.md` yet. [Section 7.3](../../report-format.md#73-the-passive-record-reserved) still says "reserved". A writer must not write `"kind": "passive"`.

Context: the skellytracker 2.0.0 pre-release needs the passive record. skellytracker builds nothing until the format defines it.

Settled by the owner (round 1):

1. The record stands in for as many results of a full run as normal use can give. It includes timings.
2. All three packages (skellytracker, skellycam, freemocap) write one.
3. Nothing leaves the system without "send". The opt-in covers only the gathering.
4. The opt-in is off by default. The app asks once. The person can turn it off, and this deletes what the packages gathered.
5. It is a module report with `"kind": "passive"`. Its checks are the counts.
6. One record covers one version set: pack, ONNX Runtime, GPU driver, models. When one changes, the counts start again.
7. The package gathers nothing for a pair before a quick pass on the same version set.
8. A row from a record is field evidence. It never replaces a `maintainer` row.
9. A reviewed row needs records from two systems with the same GPU model.
10. Disagreement with the reference is a histogram for each measure (box overlap, keypoint distance, score), not a count over one limit. Reason: DirectML gave 0.0155 on a healthy GPU against the limit 0.01.
11. Days are counted. The record holds the number of distinct days, the first day and the last day. It holds no time of day.
12. A separate function returns the record, for example `passive_report()`. It is not a level of `certify()`. The app puts it in the hand-in list.
13. Define the format now. The first real record can show a wrong field, and that needs a new format version.

## Open questions (NOT decided)

Each has the recommended answer of the assistant. The owner has not answered.

- **Q15.** Mirror the full run check for check. A check that normal use cannot cover is `not-run` with a new common code `not-passive`. Recommended: yes.
- **Q16.** Count timings, frame rates and dropped frames during real use. Run extra computation, such as the CPU beside the EP, only at idle after a recording. Recommended: yes.
- **Q17.** Add an optional field to a check for named histograms: bucket edges and one count for each bucket. Each package fixes its edges. No single measurement is stored. Recommended: yes.
- **Q18.** Each package sets its own minimum volume. The format demands that each package states it, and that a record below it is not evidence. The figures 200 compared frames, 5 recordings and 3 days become those of skellytracker. Recommended: yes.
- **Q19.** A record at its minimum gives the same evidence as a full run for the checks it covers, with Q8 and Q9. For skellycam, all gate checks must be covered and pass. Recommended: yes.
- **Q20.** One opt-in for all packages. The app says what is counted and that nothing is sent without "send". Turning it off stops all packages and deletes their data. Recommended: yes.
- **Q21.** When a record first reaches its minimum for a version set, the app offers it once, at an idle moment, in the hand-in list. It offers the same version set again only on request. Recommended: yes.
- **Q22.** The format defines the record for all three packages. For the 2.0.0 pre-release only skellytracker writes one. skellycam and freemocap follow when their full levels exist. Recommended: yes.
- **Q23.** The header of the summary says `passive record` and the volume, for example `passive record · 12 recordings over 9 days`. The tables are as for a full run. Recommended: yes.
- **Q24.** A hard failure (non-finite output, crash, hang, two unclean exits in a row) ends the record for that version set. The person can hand it in as a failure report. Counting stops. Recommended: yes.

## Reason

A full run is long. A person on a normal system can give evidence for an EP and GPU pair from real use, without a long test.

## Evidence

Facts of skellytracker (ADR-21BK items 3 to 5 of that repository), checked on 2026-11-20:

- Nothing of the record or of the shadow comparison is built. The comparison is planned: it runs at idle after a recording, on up to 30 sampled frames, and never during a recording.
- `compare_results()` exists. Unclean exits are counted today (`exits.py`). Compared frames, recordings and days are not.
- The driver version is in no key today. Its stored times are to the second, so they must not go into a record as they are.

## Open work

See [open-work.md](../open-work.md).
