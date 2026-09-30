# v3 build progress

Updated 2026-09-30, after phase 9. Nothing is pushed.

1. **Done, verified, on `v3-day-line`:** phases 1 to 9 (Today, Tasks, Board, Calendar, Training's four tabs, Diet, Insights, Settings with profiles, setup and the sync conflict notice). 508 scripted checks pass at 390 Day and at 1440 Night, with no contrast failures on any screen. `CACHE` is `daylign-v139`, one bump over what is pushed.
2. **Next: phase 10, global sheets and states (spec 10.3 to 10.7).** The + sheet, the one weigh-in sheet, the goals sheet, the voice sheet (replacing the floating mic), Ctrl K groups, toasts, sync pill states, update and install banners, pull to refresh, empty states. Also the phone header, which truncates long titles ("Setti...") when the sync pill is wide.
3. **Then phase 11 (cleanup)** and the section 13 coverage check (`V3_COVERAGE_CHECK.md`), plus a README pass: it still describes the v2 file map and the `renderDiet()` save hazard.
4. **How it is verified:** a copy with the Firebase SDK stripped, demo data, scripted checks and a contrast audit, in `.claude/verify` (untracked). The sync conflict checks use fabricated snapshots only. Nothing has been run against the database.
5. **Waiting on the owner:** an unset theme now follows the device (was always dark); `esc()` now escapes quotes app-wide; two "session" definitions still coexist (`isFullSession`, `isConsistencyDay`); Diet's caption does not net the burn; `CLAUDE.md` still describes the `renderDiet()` save hazard that phase 7 removed.
