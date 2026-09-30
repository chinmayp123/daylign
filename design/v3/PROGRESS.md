# v3 build progress

Checkpoint written 2026-09-30, when work paused for the usage limit. Nothing is pushed.

1. **Done, verified, on `v3-day-line`:** phases 1 to 8 (Today, Tasks, Board, Calendar, Training's four tabs, Diet, Insights). 385 scripted checks pass at 1440 Night and 382 at 390 Day. `CACHE` is `daylign-v139`, one bump over what is pushed.
2. **Phase 9 (Settings, profiles, setup) is half done and NOT verified.** It is parked on branch `wip/v3-phase9-settings`. Do not merge it: the app does not run from that branch yet, because the JS expects markup that has not been written.
3. **Written on the WIP branch (JS only):** new `js/settings.js` (index, pages, categories manager with colour picker, confirm sheet, restore sheet); the sync conflict notice in `js/firebase-sync.js`; System / Light / Dark theme; workout time pref; AI usage page; inline spreadsheet import; setup wizard with Replay; backup now covers every synced key; `esc()` now escapes quotes.
4. **Next, in order:** `index.html` (the `#setWrap` Settings markup, `#confirmSheet`, profile gate, the early theme script in `<head>`, the `js/settings.js` script tag, remove `#taxonomyModal` and the sidebar add buttons); `sw.js` `ASSETS` entry; the phase 9 block in `style.css`; a `t-settings.js` suite; verify on the Firebase-stripped copy (`.claude/verify`), conflict logic with fabricated inputs only. Then phases 10, 11 and the section 13 coverage check.
5. **Waiting on the owner:** an unset theme now follows the device (was always dark); two "session" definitions still coexist (`isFullSession`, `isConsistencyDay`); Diet's caption does not net the burn; `CLAUDE.md` still describes the `renderDiet()` save hazard that phase 7 removed.
