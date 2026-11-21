# Interaction bug review — 2026-11-21

## Scope and baseline

Baseline: `6835f5b54433967aee8ff671184acb8ce8bf5672`. The owner requested several bug-review passes and then explicitly prioritized interaction quality. The review follows concrete user journeys: changing time, writing and switching drafts, returning to a source note, using an IME, and finding controls with a keyboard or enlarged text.

The three passes were: trace state/transaction boundaries and reproduce suspect behavior; walk the writing/settings/return journeys in the production app; inspect short-screen and 200% text results and strengthen assertions where a technically focused control was still clipped. Existing timer controls, source identities, copy, artwork and snapshot v10 are retained.

## Confirmed findings and fixes

| Priority | User-visible trigger and failure | Correction and regression evidence |
| --- | --- | --- |
| P2 | Settings saves are delayed. Starting at 25, three `+` taps show 28; the first acknowledgement resets the display to 26. Another tap eventually saves 27 instead of 29 | Each settings/reset command returns its existing queue receipt. The form removes only that request's optimistic patch. The browser test holds writes, releases one, clicks again, and verifies 29. Reset followed by edits to two duration fields also retains submission order |
| P2 | The draft-switch confirmation uses the old `.focus-task__body` class after its stylesheet was retired. Choices become adjoining inline buttons with no gap | Use a shared `.thought-switch` style with separate rows, an 8px gap, wrapping text and minimum 44px targets. This layout regression was introduced by the previous cleanup |
| P2 | Choose “continue current draft” or switch between the draft and a saved note. The clicked confirmation button disappears and focus falls to the document body, so typing no longer reaches the editor | On entering the prompt, focus the first available choice; on leaving it, focus the textarea. Both Focus and Records use a shared initial-focus marker, including cases where a draft prompt replaces the textarea |
| P2 | At narrow widths and 200% text, Records resets the editor's scroll position after focusing a choice, leaving the focused button below the reading area's bottom edge | Reveal explicit entry focus inside the book scroller. Keep the existing separate branch for source-anchored returns, including peer insertions. Assertions check actual visible bounds and keyboard access to the last choice, not just DOM presence |
| P2 | Escape during Chinese IME composition closes the Focus editor instead of leaving the input session open. Legacy composition key events could also trigger Records Back/search or Settings dismissal | Respect composing events and key code 229 before handling Escape/Enter. Ordinary Escape, Enter search and contextual Back still work. Automated checks use synthetic composition/key-code events; real device IME behavior remains a separate check |
| P1 | One tab pauses/resumes Focus while another cannot read storage. The latter uses its old deadline or elapsed time to create an unconfirmed end, then persists it on retry, prematurely ending the paused session and overstating time/counts | Apply the existing rest-ending timeline check to focus endings too. Reject only the conflicting unconfirmed ending, preserve the durable timer, and remove its provisional completed-count contribution. Four storage cases cover pause, resumed deadline and agreeing/disagreeing manual elapsed time; three failed before the fix |

The data-consistency defect was reproduced before the owner narrowed the priority and is included with its focused fix. There is no new schema or timer-accounting formula. This review does not implement unfinished story, cottage or backup/restore features.

## Validation

Environment: Node `24.22.3`, Linux Chromium `153.0.8010.0`, repository-locked dependencies. Browser executable is external to application dependencies.

- Strict TypeScript and 495 unit tests across 41 files pass, including all 66 storage tests. Four new tests exercise the confirmed multi-tab focus defect.
- `BASE_PATH=/clock/ npm run build` passes.
- All 111 checks in the new `verify-interaction-regressions.mjs` pass. The script is part of `npm run test:e2e`. It checks delayed settings acknowledgements, reset/edit ordering, all three draft choices in both hosts, focus visibility, original-note identity, IME Escape/Enter and ordinary search/Back. Layouts are 320×568, 375×812 and 430×932, each at 100%/200% text.
- The complete production suite covers existing timing, pause/resume/end, saving errors, deletion/undo, source returns, large collections, service-worker updates, panels and the Focus card's step-aside behavior. Final results are recorded in [the machine-readable review](interaction-bug-review/checks.json).
- The actual v5-client compatibility audit and product-document/whitespace checks pass.

The explicit book-focus reveal was added during the final large-text inspection. The affected Records and new interaction suites ran against that version, and final type/unit/build checks were repeated. Screenshots are sampled visual evidence, not exhaustive visual acceptance. These runs are desktop Chromium emulation, not physical Safari/iPhone/iPad, VoiceOver or hardware IME acceptance.

## Delivery

This report records the verified code and local checks. The containing commit is the handoff. GitHub Actions separately validates that commit and publishes Pages. Its deployment status must be checked independently of a successful commit.
