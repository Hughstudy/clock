# PRD v35 interaction increment

Date: 2026-11-02. The owner asked to complete the interaction-related work directly after the v35 gap review. Work remains on local `main`, followed by validation, commit, push and independent Pages verification. The supplied PRD is preserved in [the handoff snapshot](../handoff-20261102/番茄钟_产品PRD_v35.md).

## Scope

- Focus: timer controls form one group; note tools remain separate and stable; results offer explicit rest or preparation without starting; confirmation stays informative if expiry occurs; copy follows v35 B.6.
- Encouragement: one reader with current category, category replacement and Back/Escape semantics, matching original-quote favorite status, and quiet scene behavior.
- Thoughts: continued typing after submission remains attached to the same formal note; whitespace is retained; failed edits/deletions preserve durable originals; valid deletion undo remains reachable after subsequent operations.
- Records: four views, compact statistics, explicit 20-item pages, independent month/query/window conditions, full saved-note search, source-aware detail return, continued drafts, quote collection and welcome note.
- Feedback: saved-only totals, object-bound pending/error feedback, stable notice entry, single app announcement owner, and keyboard focus preserved during asynchronous timer commands.
- Settings and accessibility: separate sound audition, local application/data explanations, latest-state PWA reload guard, 44px native targets, functional contrast, small-screen and large-text layout.

## Retained boundaries

Keep the current blue character and rough.js drawing style. The existing eleven activities remain immediately available under their saved scene assignments. The Records scene view reads those actual assignments and original records; it does not infer outcomes from a session ID or invent past objects. It is a useful activity-history slice, not acceptance of the full v35 cottage interaction.

DAY05 and later authored chapters, story continuation, persistent room/object state, object dialogue and sources, day/night room rendering, and backup/replacement/clear are separate modules. They require their own complete implementation and evidence. No backend, accounts, cloud sync, new characters, commerce or completion-gated scenes are introduced.

## Data and interface changes

Snapshot v8 adds quote favorites with stable quote identity, captured text/content version, relation revisions and cancellation markers. Existing v7 data migrates without changing time records, drafts, preferences or scene assignments. Favorite commands use the same short lock and dataset-generation protections as existing mutations. Reading never creates a favorite or reward; welcome-note reading has no cancel-favorite action.

The 2026-11-07 iOS review extends this to snapshot v9 with `restSuggestionSessionId`. Only a settled deadline creates that identity; explicit preparation or starting a session clears it. v8 migration preserves all existing data and the current timer mode, without guessing whether idle rest was automatic or explicitly chosen. See [the iOS review](../verification/ios-design-review.md).

`QuoteFavoritesController` supplies confirmed selections and object-bound pending/error state. Timer command waiting is local: controls retain keyboard focus while repeated activation is refused. Main owns all facts and announcements. Animation remains a deterministic presentation consumer.

Records sums only confirmed ended focus records. It keeps a pending result readable but outside official totals. Durable note content survives a pending edit, state change or deletion. Full-list search excludes drafts and unconfirmed new text. Browsing state is temporary and does not become a stored user-behavior record.

## Acceptance

Run strict TypeScript, domain/storage/query regressions and the production build at `/clock/`. Browser verification covers timer and scene invariants, encouragement Back and focus, save-and-continue typing, expiry while confirming, failures/retry/concurrency, favorites, all-record pagination, 1,000/10,000-record search and source return. Inspect 320/375/430px, landscape, 200% text, reduced motion and meaningful keyboard interactions.

Record actual build and browser versions. Desktop emulation is not physical iPhone/Android, real soft-keyboard or screen-reader acceptance. Commit no generated screenshots or recordings; retain reproducible scripts and concise textual evidence. Publication and deployment are verified separately in [the verification report](../verification/interaction-v35.md).
