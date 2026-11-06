# PRD v37 migration and dialogue expansion

Date: 2026-11-06 (America/Los_Angeles). The owner asked for more companion text and authorized splitting the PRD into a dedicated GitHub folder with a README map. This is a documentation and content-candidate change; no application implementation is included.

## Sources and destination

| Input | Exact source | Use |
| --- | --- | --- |
| PRD v36 | Library `libfile_bcdaeef130d08191a600d27ba5123a82`, version25; 450234 UTF-8 bytes; SHA-256 `46ac835668051cfb391a8b701908892466ecdde13b79e9e5d2f767704d8224f2` | All 3481 source lines partitioned into 13 topic modules; original A–F/RULE/ACT/T identities retained |
| Code bridge | Library `libfile_2a84400c0f348191b60a0ceea5ebcda1`, version2; internal revisionv3; SHA-256 `7caf8471efa88cd8aac11ab9a25606c72f6a3adcaf91df772708722752abd81e` | Migrated as module14, with publication/source status and later repository reports clearly separated |
| Repository | `4a94d440ef2e1683764645535d384dd96ba977ba` | Latest main at task start, including the three design-pass batches; preserved without application edits |
| Destination | [docs/prd/README.md](../prd/README.md) | Maintained product entry point, labeled v37; engineering plans remain English, product/copy documents remain Chinese |

The pre-split Library files and repository handoffs remain historical sources. This migration does not delete them or create a second live task register. New product changes belong in `docs/prd/`; source snapshots are not bidirectionally maintained copies.

## What changed

- Thirteen product modules separate the overview, features, UI, three data scopes, acceptance, voice policy, encouragement text, character profile, everyday dialogue, story production and action index. The code bridge is the fourteenth module; README maps every module and offers task-based reading paths.
- All original explicit anchors move with their sections. Internal fragment links now point to the appropriate file. E.1–E.2 and E.5–E.9 share the voice-policy module; E.3–E.4 remain a separate unchanged encouragement asset.
- The overview's title and source-status wording identify the current split edition. Original detailed rules, field tables, acceptance cases, chapter examples and existing encouragement wording are preserved.
- Forty-eight `DLG-*` candidates cover windows, books, a ticket bookmark, cups, a succulent, a desk, small ideas and rest. They have context conditions, create no new triggers, and do not require additional objects or animation. They are not approved runtime copy merely because they are in the repository.
- README, AGENTS, PLAN and the two active workstream plans point to the new source. Current planning no longer treats ended-session continuation as unfinished required work. Historical reports and handoff snapshots are not rewritten.
- The bridge retains its original `973c5c3` audit links. Later design reports are summarized as existing reports, not as tests rerun during this migration.

## Verification

- A source-range partition accounts for every original line. Reversing the new cross-file links reproduces each migrated source segment byte-for-byte before the explicitly listed overview edits, added candidates and normalization of the final file newline.
- All 565 original explicit anchors are present once across the split modules. The candidate section adds one new anchor; original RULE/ACT/T identifiers remain unchanged.
- E.3–E.4 encouragement source text and all data/acceptance source segments pass the same lossless check. Original section numbers remain searchable.
- `python3 scripts/check-prd-docs.py` checks the map, local file/fragment links, reference-style links, duplicate anchors, fenced blocks and unique dialogue IDs. This check is reusable and requires no extra dependencies.
- `git diff --check` checks patch whitespace. The changeset is limited to product documents, document entry points, this report and the documentation checker.

Application tests, builds, browser behavior and physical-device checks were not rerun: application files are unchanged. Existing verification counts belong to their original reports. GitHub commit publication is checked separately from the main-triggered Pages workflow; that workflow does not constitute acceptance of unimplemented v37 features.
