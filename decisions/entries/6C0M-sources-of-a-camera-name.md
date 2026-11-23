# 6C0M — The sources of a camera name, in order

**Status:** superseded by [PS04](PS04-personal-device-class-text-before-product-string.md),
2026-11-23 (direct commit to `main`). Absorbed into [`report-format.md` 3.7](../../report-format.md#37-summary),
[6](../../report-format.md#6-privacy-rules),
[8](../../report-format.md#8-versioning-of-the-format), 2026-11-23 (direct commit to `main`).
Accepted 2026-11-23 (owner).

## Decision

Rule 16 of [section 6](../../report-format.md#6-privacy-rules) gives the sources of a camera name.
The package uses the first source that applies:

1. The name in the list of known cameras of the package. The key of the list is the USB vendor id
   and the product id.
2. For a camera that is not in the list: the product text in the firmware of the camera (the USB
   product string). The package never uses a display name that the OS or a person can set. A
   filter applies: Unicode NFKC; only letters, marks and digits of each script, the space and the
   characters of rule 18; at most 60 characters.
3. For a personal device that a person uses as a camera: a fixed text for its class, for example
   `iPhone used as camera`, `iPad used as camera` or `Mac built-in camera`.
4. For a camera with no USB id: `Camera (no USB id)`.
5. When a privacy rule refuses the name of sources 1 to 4: `Camera vvvv:pppp`, with the USB vendor
   id and the product id in lower-case hex. A product text that holds the user name or the host name
   of the system is refused.

The `name` of a `camera` summary item is this camera name
([3.7](../../report-format.md#37-summary)). The rule that a camera name holds no name of a person
stays. The relay does not change: it cannot
find a first name, so the rule is a duty of the writer. The text of rule 16 states the full filter.

The schema id stays `skellycertify.report/1.7.0`. This is a patch change by
[section 8](../../report-format.md#8-versioning-of-the-format): it fixes the text of the document
and changes no field, no allowed value and no check of the relay. The owner decided it on
2026-11-23.

## Reason

- The old rule took the name from the model string of the device and removed the name of a person.
  A program cannot find each first name in a free text, for example in `<name>'s iPhone Camera`.
- A display name of the OS is a text that the person can set. The product text in the firmware is
  fixed by the maker of the camera.
- Each source gives a name with no person name. The last source always gives a name.

## Evidence

The example names pass the checks of the relay (code facts, read on 2026-11-23):

- `relay/src/report.js`, `checkModule()`: a summary `name` is a string of 1 to 80 characters.
- `relay/src/privacy.js`, `stringRule()` and `privacyRule()`: rules 1, 3, 4, 5, 7, 10, 17 and 20
  find no match in `Camera 046d:085c`, `Camera (no USB id)` or `iPhone used as camera`. The pattern
  of rule 3 needs a `.` after the second pair of hex digits.
- `relay/src/issue.js`, `KEPT`: the issue keeps `:`, `(` and `)`.

## Alternatives rejected

- Remove the name of a person from a display name. A program cannot find each first name.
- Always use `Camera vvvv:pppp`. A person cannot read it, and most cameras have a good product text.

## Open work

[open-work.md](../open-work.md)
