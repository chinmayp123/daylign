# v3 build progress

Updated 2026-09-30, after phase 11. Nothing is pushed.

1. **Done, verified, on `v3-day-line`:** phases 1 to 11 (every screen rebuilt, the global sheets and states, then cleanup: dead renders gone, no browser dialogs left, `style.css` from 13,916 to 6,504 lines). 573 scripted checks pass at 1440 Night and the same suites at 390 Day, with no contrast failures on any screen. `CACHE` is `daylign-v139`, one bump over what is pushed.
2. **Next: the section 13 coverage check**, `V3_COVERAGE_CHECK.md` with one line per row of `coverage.json`.
3. **Then a README pass** (it still describes the v2 file map and the `renderDiet()` save hazard), and the owner's review of the branch before any push.
4. **How it is verified:** a copy with the Firebase SDK stripped, demo data, scripted checks and a contrast audit, in `.claude/verify` (untracked). The sync conflict checks use fabricated snapshots only. Nothing has been run against the database.
5. **Waiting on the owner:** an unset theme now follows the device (was always dark); `esc()` now escapes quotes app-wide; two "session" definitions still coexist (`isFullSession`, `isConsistencyDay`); Diet's caption does not net the burn; `CLAUDE.md` still describes the `renderDiet()` save hazard that phase 7 removed.
