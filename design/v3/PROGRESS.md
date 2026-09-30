# v3 build progress

Updated 2026-09-30, after phase 10. Nothing is pushed.

1. **Done, verified, on `v3-day-line`:** phases 1 to 10 (Today, Tasks, Board, Calendar, Training's four tabs, Diet, Insights, Settings with profiles, setup and the sync conflict notice, then the global sheets and states). 569 scripted checks pass at 1440 Night and the same suites at 390 Day, with no contrast failures on any screen. `CACHE` is `daylign-v139`, one bump over what is pushed.
2. **Next: phase 11, cleanup (spec 11).** Dead renders and markup (`#todayCardio`/`renderTodayCardio`, the serving stepper in `enhancements.js`, `weightTrendNote/Class`, `renderWeight` in `gym.js`, `scheduleDate`, `editingSubtasks`), the last two `confirm()` calls (event and task delete), and v2 CSS for surfaces that no longer exist. Then grep every removed id.
3. **Then the section 13 coverage check** (`V3_COVERAGE_CHECK.md`, one line per row of `coverage.json`), a `CACHE` bump, and a README pass: it still describes the v2 file map and the `renderDiet()` save hazard.
4. **How it is verified:** a copy with the Firebase SDK stripped, demo data, scripted checks and a contrast audit, in `.claude/verify` (untracked). The sync conflict checks use fabricated snapshots only. Nothing has been run against the database.
5. **Waiting on the owner:** an unset theme now follows the device (was always dark); `esc()` now escapes quotes app-wide; two "session" definitions still coexist (`isFullSession`, `isConsistencyDay`); Diet's caption does not net the burn; `CLAUDE.md` still describes the `renderDiet()` save hazard that phase 7 removed.
