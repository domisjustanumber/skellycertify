# PS04 — The class text of a personal device applies before the USB product string

**Status:** absorbed into [`report-format.md` 6](../../report-format.md#6-privacy-rules),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

This entry supersedes [ADR-6C0M](6C0M-sources-of-a-camera-name.md) in full.

Rule 16 of [section 6](../../report-format.md#6-privacy-rules) gives the sources of a camera name.
The package uses the first source that applies. The order is now:

1. The name in the list of known cameras of the package.
2. For a personal device that a person uses as a camera: the fixed class text
   `iPhone used as camera`, `iPad used as camera` or `Mac built-in camera`. A camera is a personal
   device also when its product text holds a personal-device word, for example `iPhone`, `iPad`,
   `Mac` or `MacBook` (compared without case).
3. For another camera: the USB product string through the filter of rule 16. The filter does not
   change.
4. For a camera with no USB id: `Camera (no USB id)`.
5. When a privacy rule refuses the name: `Camera vvvv:pppp`.

The package keeps the list of personal-device words and their class texts in its own documentation.

These rules of [ADR-6C0M](6C0M-sources-of-a-camera-name.md) stay. [Section 6](../../report-format.md#6-privacy-rules)
states them: the key of the list, the filter, the ban on a display name that the OS or a person can
set, the sources 4 and 5, and the duty of the writer. The relay does not change.

The schema id stays `skellycertify.report/1.7.0`. This is a patch change by
[section 8](../../report-format.md#8-versioning-of-the-format): it fixes the text of the document
and changes no field, no allowed value and no check of the relay. The owner decided it on
2026-11-23.

## Reason

- A product text of a personal device is often `<person>'s iPhone`. A package cannot know each
  name, so the filter alone can let a name through.
- When the text says `iPhone` or `MacBook`, the class of the device is all that the report needs.

## Alternatives rejected

- Keep the filter before the class text. A name of a person can pass the filter.

## Open work

[open-work.md](../open-work.md)
