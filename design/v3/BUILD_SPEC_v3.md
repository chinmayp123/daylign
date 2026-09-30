# Daylign v3 "Day Line": Build Spec

You are rebuilding the look and structure of the **existing Daylign app**
(`chinmayp123/daylign`, local clone `~/Personal-Projects/daylign`). It is a
vanilla JS PWA with **no build step**. Read the repo's `CLAUDE.md` and `README.md`
first; every rule in them still applies.

**Visual reference:** `design/v3/daylign-v3-mockups.html` (the same page as
https://claude.ai/artifact/73SCP2tko9eVXxQkn3tjBQ). Open it in a browser. It has
tabs (Today, Tasks, Calendar, Training, Diet, Insights, Settings, Global,
Coverage) and a Day / Night switch. This spec cites screens as
`Tab / caption`, for example `Training / Log exercise sheet`. The mockup is a
prototype: recreate its look and behaviour in the real app, do not copy its markup.

**Acceptance list:** `design/v3/coverage.json`. 338 rows, one per existing
capability, each with its new home and a status (`kept`, `merged`, `added`,
`removed`). The build is done when every `kept`, `merged` and `added` row works in
its new home and every `removed` row is gone. §13 says how to check.

> Implement every `[ ]` below. Earlier Daylign redesigns shipped only the easy
> half. Each checkbox is a separate, verifiable task. Do not stop early, and do not
> drop a feature because it is not drawn: if it is in `coverage.json`, it stays.

---

## 0. Ground rules (from the repo, restated because they bite)

- [ ] Work on a branch (`v3-day-line`), in PR-sized phases (§1). **Never push to
      `main`**; it auto-deploys to the live app. The co-builder reviews before merge.
- [ ] No framework, no bundler, no modules. A new JS file needs a `<script>` in
      `index.html`, an entry in `sw.js` `ASSETS`, and usually a call in `render()`
      in `js/app.js`.
- [ ] **Renderers never write.** No `saveData()` inside any `render*`. Save only on
      a user action. Bind listeners on persistent containers once (see
      `bindBoardDropTargets()`).
- [ ] All persistence goes through `writeStateToLocal()` / `saveData()`. Device
      prefs stay in `daylign_prefs` (not synced).
- [ ] Bump `CACHE` in `sw.js` on every PR (currently `daylign-v133`).
- [ ] Never commit or sync the Anthropic key. Demo data only in screenshots.
- [ ] Test at 390 px and 1440 px, in both Light and Dark, before each PR.

## 1. Phases (one PR each, in this order)

| # | Phase | Main files |
|---|---|---|
| 1 | Foundation: tokens, fonts, icons, category colours, base components | `style.css`, `index.html` head, `js/settings-prefs.js` |
| 2 | Navigation: sidebar, bottom bar with +, avatar sheet, Ctrl K | `index.html`, `js/app.js`, `js/enhancements.js` |
| 3 | Today: now block, brief, the line, tray, due soon, arrange | `js/today.js`, `js/dashboard.js`, `js/brief.js`, `js/layout.js`, `js/settings-prefs.js` |
| 4 | Tasks, Board, task sheet, priority | `js/tasks.js`, `js/board.js`, `js/modal.js`, `js/inbox.js` |
| 5 | Calendar | `js/calendar.js` |
| 6 | Training (Strength, Cardio, Coach, Sleep) | `js/training.js`, `gym.js`, `strength.js`, `cardio.js`, `coach.js`, `sleep.js`, `weight-sheet.js` |
| 7 | Diet | `js/diet-*.js`, `js/food-photo.js` |
| 8 | Insights | `js/insights.js` |
| 9 | Settings, profiles, setup, sync notice | `js/settings-prefs.js`, `profile.js`, `onboarding.js`, `firebase-sync.js`, `import-csv.js`, `ai-usage.js` |
| 10 | Global sheets and states | `js/voice.js`, `weight-sheet.js`, `diet-goals.js`, `utils.js`, `pull-refresh.js`, `app.js` |
| 11 | Cleanup and migration check | all of the above |

Phase 1 must land first. Phases 4 to 10 can go in any order after phase 3.

---

## 2. Design system (Phase 1)

### 2.1 Tokens

Keep the **existing variable names** so the other ~8.9k lines of CSS keep working;
change their values. Add the new ones. Light is the default look in the mockup
("Day"); Dark is "Night". Keep the existing System / Light / Dark theme mechanism
and put these values in its light and dark blocks.

| Variable | Light (Day) | Dark (Night) | Notes |
|---|---|---|---|
| `--bg-primary` | `#eceee9` | `#0e0f0e` | page |
| `--bg-card` | `#f7f8f5` | `#171917` | surfaces (mockup `--surf`) |
| `--bg-secondary`, `--bg-input` | `#f7f8f5` | `#171917` | |
| `--bg-hover` | `#e3e6e0` | `#1f221f` | |
| `--track`, `--border` | `#d5d8d1` | `#262925` | mockup `--line` |
| `--text-primary` | `#121412` | `#eeefeb` | mockup `--ink` |
| `--text-secondary` | `#4f544e` | `#aeb2ab` | `--sub` |
| `--text-muted` | `#686d66` | `#8a8f88` | darker than the mockup's `#8a8f88` in light, to pass 4.5:1. Was `#6f746d`, which measures 4.09:1 on `--bg-primary` and misses the bar it was written for; `#686d66` is 4.53:1. |
| `--accent` | `#2446f0` | `#6c86ff` | "now" and buttons only |
| `--accent-ink` (new) | `#ffffff` | `#0e0f0e` | text on accent |
| `--accent-glow` | `rgba(36,70,240,.09)` | `rgba(108,134,255,.13)` | mockup `--soft` |
| `--red` / warn | `#c2410c` | `#fb923c` | overdue, danger |
| `--c-sleep` (new) | `#5a5fd8` | `#8f93ff` | sleep, weight |
| `--c-food` (new) | `#e8730c` | `#ff9a3d` | food, calories, protein |
| `--c-water` (new) | `#0891b2` | `#35c6e6` | water |
| `--c-move` (new) | `#15a34a` | `#3ddc7a` | workouts, rides, steps, burn |
| `--c-meet` (new) | `#d9366e` | `#ff6b9d` | meetings, events, default work |
| `--c-habit` (new) | `#c48a00` | `#f2bd2c` | habits, home |

- [ ] Remove the purple/blue radial gradients on `body`; the page background is flat `--bg-primary`.
- [ ] Old `--green/--yellow/--blue/--purple` keep working: alias them to `--c-move`, `--c-habit`, `--c-water`, `--c-sleep`. Macro colours: protein `--c-food`, carbs `--c-habit`, fat `--c-meet`.
- [ ] Radii: sheets 24px top, cards 16px, rows and inputs 10 to 12px, chips 6px, the now block 18px, phone bottom bar 18px. `--radius: 16px`, `--radius-sm: 10px` stay.
- [ ] One accent. Nothing else uses `--accent` except the now line, the primary button, focus rings and selected states.

### 2.2 Type and icons

- [ ] Replace the Google Fonts link: **Bricolage Grotesque** (opsz 12..96, 400/600/800) for display, **Geist** (400/500/600) for UI, **JetBrains Mono** (400/500/700) for every number. Set `--font-display`, `--font-body`, and new `--font-mono`.
- [ ] All metrics, times, counts and dates-as-numbers use `--font-mono` (this replaces `tabular-nums` on Space Grotesk).
- [ ] Display type: the date number on Today (40px/800, tracking -0.045em), screen titles (30px/800), the brief sentence (19px/600, tracking -0.02em).
- [ ] Icons: **Material Symbols Rounded** via the same Google Fonts link (`opsz,wght,FILL@20..24,400,0..1`), filled for the selected nav item. Replace the 48 inline SVG icons in `index.html` as each screen is rebuilt. Add the font URL to the service worker's runtime cache the same way the current fonts are handled.
- [ ] No emoji in UI text (the v2 "👋" greeting goes).

### 2.3 Category colours (new, Phase 1 data change)

- [ ] Categories and projects get an optional `color` field holding one of the six keys `sleep|food|water|move|meet|habit`. Existing items get a colour assigned from the current auto palette order on first load (write it once, on a user action or on the migration save, never in a renderer).
- [ ] A chip, board card bar, calendar dot and line node for a task uses its category colour. No category means `--text-muted`.

### 2.4 Base components (build once in `style.css`, reuse everywhere)

- [ ] `.dl-chip` (tinted: `color: var(--c)`, background = `--c` at 14%).
- [ ] `.dl-seg` segmented control (selected = ink background, page-colour text), full-width variant.
- [ ] `.dl-sheet` bottom sheet: dimmed backdrop, 24px top radius, grab handle, closes on backdrop tap, Esc and swipe down. On desktop it becomes a centred panel max 520px wide.
- [ ] `.dl-card` and `.dl-card.tint` (surface mixed with `--c` at 9 to 10%, border at 40%).
- [ ] `.dl-line` the time line (spec in §4.3). Reused on Today, Calendar and Diet.
- [ ] Buttons: primary (accent), default (surface with border), danger text (warn, no border). `box-sizing: border-box`; full-width variant. Press state `scale(.98)`. Visible focus ring in `--accent`.
- [ ] Toggle switch, field (`label` in 9.5px mono caps + input box), tile (big mono number + small label), ring (SVG, 7px stroke, round cap), mini bar and line charts, skeleton loader.
- [ ] Respect `prefers-reduced-motion` and the app's own Reduce motion pref.

---

## 3. Navigation (Phase 2) — mockup: `Today / desktop`, `Global / Avatar sheet`

- [ ] **Phone bottom bar** floats (12px inset, 18px radius, surface + border): Today · Tasks · **+** (centre, accent square) · Training · Diet. Board is no longer a nav item; it is a view inside Tasks.
- [ ] **Avatar** (top right on every phone screen) opens the avatar sheet: profile name + sync pill, then Calendar, Insights, Search, Tester reports (with unread count), Settings. This replaces the More sheet (`#moreSheet`), which is deleted along with its theme toggle.
- [ ] Unread tester-report count shows as a dot on the avatar and on the Tasks nav item.
- [ ] **Desktop sidebar**: date block (small weekday/month, big day number), a search box showing `Ctrl K`, nav Today, Tasks, Calendar, Training, Diet, Insights, and Settings pinned at the bottom. Selected item = ink pill. On Tasks, Categories and Projects lists with colour squares and counts appear under the nav (mockup `Tasks / Desktop board`). The sidebar theme toggle is deleted.
- [ ] Rename the `dashboard` view key to `today` in `switchView`, nav buttons and persisted last-view; map a stored `dashboard` to `today` so old installs land correctly. Keep the `#dashboardView` id only if renaming it risks CSS breakage; say which in the PR.
- [ ] Header condense-on-scroll, update-available banner and top sync progress bar stay (restyled, §11).

## 4. Today (Phase 3) — mockup: `Today` tab

### 4.1 Header
- [ ] Small mono line `Tuesday, September` over the big day number. Right: search icon (opens Ctrl K palette) and avatar. On desktop the date lives in the sidebar.
- [ ] Previous / next day: swipe left/right on the line and `‹ ›` beside the date on desktop. Header follows the viewed day (existing behaviour); the now marker only shows on today.

### 4.2 The now block (replaces the health strip, `#healthGrid`)
- [ ] Ink background (`--text-primary`), page-colour text, 18px radius, a small `PINNED` flag in accent. **Sticky** under the header on scroll, phone and desktop. It cannot be hidden or moved (owner rule: health numbers are always visible).
- [ ] Row 1: calories eaten, large mono, coloured `--c-food`, `/ 2,000 kcal eaten`, and `N left` on the right.
- [ ] Row 2: protein, water, steps, each with a 10-tick bar in its colour (`food`, `water`, `move`).
- [ ] Row 3 (small): burned (`move`), exercise minutes (`move`), sleep (`sleep`), weight or `weigh in`.
- [ ] Steps, exercise and sleep keep today's conditional logic (hidden without Watch data); the row reflows.
- [ ] Taps: calories/protein/water → Diet; steps/burn/exercise → Training; sleep → Training / Sleep; weight → the weigh-in sheet (§10.4).
- [ ] Collapsed state when scrolled: a single row (calories, protein, water, steps). Tapping it expands.

### 4.3 The line (replaces Today plan's Scheduled lane, `#scheduleCard`, reminders and the daily-ride pill)
One vertical time spine. 64px left gutter: time label (mono 10px, right-aligned, ends 8px before the node) and a 12px node on a 2px spine.

- [ ] Spine colour: above "now" a gradient `--c-sleep → --c-habit → --c-food → --c-water`; below "now" `--text-primary`.
- [ ] Node: past = filled in the item's colour; future = hollow ring in its colour. Each row: 24px icon tile tinted with the item colour, title, grey sub-line, value on the right in the item colour.
- [ ] **Now marker**: a 2px accent line across the column with `now 3:40` in accent mono. Auto-scroll so it sits in the upper third on open.
- [ ] Item sources and their time:

| Item | Colour | Time | Value | Tap |
|---|---|---|---|---|
| Last night's sleep | sleep | first row, labelled with bedtime if known, else "last night" | hours | Training / Sleep |
| Habits: brush AM, morning routine, brush PM | habit | when done; if not done, its default time (7:00, 7:05, 21:30) as a future node with a Done button | `done` | Done marks it (morning routine still auto-logs 1 set each, as today) |
| Daily ride / usual cardio | move | when logged; else the usual time from the last 14 days (fallback 7:30) with a **Log it** one-tap | distance | one tap logs the usual (existing `#todayCardio` action) |
| Meals | food | entry time `at` if present, else the meal's slot time (breakfast 8:00, lunch 12:30, snack 16:00, dinner 19:30) | kcal | Diet, scrolled to that meal |
| Water | water | one aggregated row at the last add time | oz total | Diet water |
| Calendar events and Google meetings | event colour / meet | start time | duration | event sheet; Google rows read only |
| Tasks with a time | category colour | scheduled time | estimate | task sheet; check-off on the node |
| Workout (logged) | move | first set logged | duration or sets | Training / Strength |
| Workout (planned by the coach) | move | workout default time (Settings / Workouts, new field, default 18:30) | planned length | "Log workout" |

- [ ] The next future item that is a workout or high-priority task renders as a card (tinted, 14px radius, soft glow) instead of a plain row.
- [ ] **Data change:** new diet entries, water adds and habit completions store `at` (epoch ms). Old entries without `at` use the slot time. Habit keys stay in localStorage as today but store the timestamp instead of a flag (read both).

### 4.4 The tray at "now"
- [ ] Directly under the now marker: dashed-border box `No time needed · N left` listing today's undated-time tasks (the Anytime lane) with checkbox and estimate.
- [ ] Triage nudge inside it: `4 tasks have no date. Pull into today` → opens a small sheet listing undated tasks with `+ Today` on each and `See all` (goes to Tasks filtered to No date).
- [ ] Schedule a tray task: drag it onto the line (desktop) or its clock button (touch) → task sheet with the time field focused. Empty tray hides.

### 4.5 Brief and actions (replaces `#dailyBrief` and `#remindersBar`)
- [ ] One sentence in display type from the shared coach engine: bold first clause, muted second clause (e.g. "Push day at 6:30. Food is on pace, 38g of protein to go."). No restated numbers that are already in the now block.
- [ ] Up to 3 action chips under it, first one primary: from the reminder rules (log workout, water, weigh in, calories, protein, gym gap). Weigh in opens the weigh-in sheet.
- [ ] The brief's readiness badge and training row fold into the sentence; the tasks row becomes "Due soon"; the this-week grid moves to Insights' weekly report.

### 4.6 Due soon and desktop right column
- [ ] "Due soon" after the line: overdue and next 7 days, date in mono (overdue in warn), category chip. Replaces My Tasks and Deadlines cards.
- [ ] Desktop layout: sidebar 230px · centre (now block, brief, line) · right 240px (This week bars in `move`, Due soon, `New` and `Say it` buttons).

### 4.7 Arrange Today — mockup: `Today / Arrange Today`
- [ ] Sheet from an "Arrange" button at the end of Today: Now block and The line shown locked; Brief and actions, Due soon, This week (desktop) can be reordered and hidden. Saved layouts (save, apply, delete) are here, not in Settings.
- [ ] **Migration of `DASH_WIDGETS` and saved layouts** (in `settings-prefs.js` / `layout.js`): new keys `brief`, `due`, `week`. Map old → new: `plan`, `schedule`, `cardio`, `health` → dropped (fixed now); `reminders` → `brief`; `mytasks`, `deadlines` → `due` (hidden only if both were hidden). Apply to `order`, `hidden` and every named layout. Delete the `wide` field.

## 5. Tasks (Phase 4) — mockup: `Tasks` tab

- [ ] One view with a List / Board switch (remember the last choice per device). Board markup moves under Tasks; the Board nav item is gone.
- [ ] **List:** filter chips for status, category, sort; project chips with counts (this is where Today's project filter went); groups Overdue (warn), Today, This week, Later, No date (with the triage line), then an `Archived · N` row that expands (done 7+ days, same rule). Rows: checkbox, title, category chip, due in mono, steps `1/3`, estimate, priority flag.
- [ ] Search: desktop header search filters the list; phone uses Ctrl K / the search icon. One search box, not two.
- [ ] **Board:** tester reports card on top when any exist (Make it a task, Dismiss, Clear handled, tap the screenshot to enlarge); column switcher To do / Doing / Done with counts (phone); category tabs; collapsible category/project folders; cards with a 3px category-colour bar, due and steps. Desktop shows three columns with drag between them and a dashed accent drop zone. Done cards 7+ days old still auto-archive.
- [ ] **Task sheet** (replaces the task modal, `modal.js`): title, notes, category, project, due date, time on your day + length (this schedules it onto the line), **Priority None / Low / Medium / High (new; writes `task.priority`, which calendar dots and flags already read)**, status, steps with add/check, created stamp, Delete, Cancel, Save. Same sheet opens from every entry point (row, board card, calendar, line, Ctrl K, voice).
- [ ] Empty states: no matches (with New task), no archived.
- [ ] Categories and projects are managed only in Settings / Appearance; the sidebar "Manage" link opens that screen.

## 6. Calendar (Phase 5) — mockup: `Calendar` tab

- [ ] Phone month: header with Month / Week switch, `‹ September ›`, grid with today as an ink pill and the selected day ringed in accent; dots coloured by event colour or task priority; US holidays as a small label. Below the grid, the selected day as a `.dl-line` with `+ Event`.
- [ ] Phone week = agenda list by day (existing `#calAgenda` behaviour) with an empty-day card.
- [ ] Desktop week: 7 columns, hour grid, events as tinted blocks with a 3px left bar, a top "any time" strip of undated tasks per day; drag from the strip onto an hour to schedule; double-click a slot or day to add.
- [ ] Event sheet: name, date, time range, notes, colour (the six category colours), Delete, Save. Google Calendar events open read only.

## 7. Training (Phase 6) — mockup: `Training` tab

Header on every sub-tab: `This week: N sessions`, title, and a weight pill (sleep colour) that opens the weigh-in sheet. Sub-tabs **Strength · Cardio · Coach · Sleep**; remember the last one. The desktop rail duplicates (week tiles, readiness ring, heatmap) are deleted.

- [ ] **Strength:** Watch sync banner (tap for details); 7-day chips (filled `move` on training days); day navigation; tinted session card with focus line, stats (sets, volume, kcal) and logged rows (name, `3 x 8 · 155 lb`, PR chip, edit, delete); `Log exercise` full-width primary; consistency heatmap (16 weeks) with streak and next training day. A Today / Progress switch at the top of Strength.
- [ ] **Log exercise sheet:** name input with ranked suggestion chips, "Last time … Beat it" banner, set rows (reps × weight, remove), `+ Add set`, rest timer 60s / 90s (default from Settings / Workouts), Save. Bodyweight exercises detected automatically and skip weight.
- [ ] **Progress:** 30-day tiles, plateau card with its one-tap fix (prefills the log sheet), muscle balance bars, movement list with sparkline and improving / stalled chip (tap selects), curve with Est. 1RM / Top set switch, PR shelf. PR badges on logged rows stay.
- [ ] **Cardio:** "Your usual ride" card with streak and Log it (the same action as the ride on Today's line); day navigation; Run / Ride / Swim; distance, time and live pace in each sport's unit; run type chips; collapsible run detail (HR, elevation, RPE, zones); Watch cross-check banner with Use this; Watch imports list with Add to log (keep duplicate-hide); today's sessions with delete and burn total; weekly volume ring; race countdown with projected finish; race target settings (collapsed row).
- [ ] **Coach:** verdict sentence in display type, evidence chips, rows Do this (**new: Start it** opens the log sheet prefilled), Volume, Recovery, Cardio advice; burn vs target tile; weigh-in pace tile; calisthenics ladder as a list with done / current / next steps; goal progress bars; activity split line; bodyweight-stall advice. Empty until the first gym entry, as today.
- [ ] **Sleep:** readiness ring and verdict with advice text (the only readiness surface); last-night card with a ±15 min stepper, quality Poor / Okay / Good / Great, Save, freshness label; 7-night bars in `sleep` that keep but flag nights over 12h; the empty state before 6 sessions. If Gym and Cardio are both off, the Sleep tab hides (current behaviour).

## 8. Diet (Phase 7) — mockup: `Diet` tab

- [ ] Header with date navigation and a library button. Week strip of seven small rings. Big calorie ring with macro bars and the burn caption ("Burned 420, so about 780 left").
- [ ] Add bar: search with inline results and one-tap add, mic (voice panel), camera (photo flow). Usual tiles and saved-meal tiles (saved meals in `food` outline).
- [ ] Water card (tinted `water`): +8, +16, +24, Other (a small inline field, not `prompt()`), Undo, with total / goal.
- [ ] Meals as a `.dl-line` (Breakfast, Lunch, Snack, Dinner at their times with kcal). Tap a meal → **meal sheet**: entries with servings stepper, edit (name and macros, propagates to the bank as today), delete; Add food, Photo, Save these N as a meal; logged saved-meal groups expand, add ingredient (inline field, not `prompt()`), delete group.
- [ ] Folded rows that open: Ideas (recommendations), Yesterday's advice, End-of-day review (after dinner or 8pm).
- [ ] **Photo sheet:** photo, analysing skeleton, items with confidence dot (green sure, amber check), edit and remove per item, Add to (meal), Add all N, Discard; pending result kept 12h; inline no-key prompt; error states with a Retry button (new).
- [ ] **Food library** (full-screen from the header button): My foods / Meals / Recent / History tabs, search with online lookup (Open Food Facts then USDA), Community tag, add-your-own form, edit and remove. The 14-day history stays here; Insights has the weekly view.
- [ ] Empty states: no saved foods, no history, no match, budget used up.
- [ ] Goals are edited only in the goals sheet (§10.5); Diet's Edit goals opens it.

## 9. Insights (Phase 8) — mockup: `Insights` tab

- [ ] Range Week / Month / Year / All, Export CSV (selected range).
- [ ] Weekly report card first (moved here for real; it was a dead render on Today): one display sentence + a stat line.
- [ ] Summary tiles; charts Calories, Protein (goal dashed), Training volume, Water, Body weight (line), Sleep, Steps, Movement, Sets by muscle, Tasks. Each in its category colour. Desktop is a 3-column grid.
- [ ] Tap/hover tooltip; gaps drawn as gaps; "Still growing" state under 3 points.

## 10. Settings, profiles, setup and global sheets (Phases 9 and 10)

### 10.1 Settings — mockup: `Settings` tab
- [ ] Grouped list: You (Profile and goals, Apple Watch, Modules), Look (Appearance, Categories and projects, Today layout → opens Arrange Today), Workouts (defaults incl. the new workout time), AI (key, usage), Data (Sync, Backup and restore, Import a spreadsheet, Tester reports), Help (Replay setup, Recent errors, How the app is used), Profile (Switch profile, Start fresh with ERASE).
- [ ] **Appearance:** theme System / Light / Dark (**the only theme control**); accent swatches (six, first is the new cobalt default; change `ACCENTS` to cobalt `#2446f0`, green, rose, orange, teal, indigo and map a stored `indigo` to cobalt); larger text, reduce motion, always show delete, haptics.
- [ ] **Categories and projects:** list with colour square, count, colour button, delete; **colour picker (new)** with the six colours; add. The only manager (the sidebar copy is deleted).
- [ ] **Data and sync:** status card (last synced, retries every 30s, stalled-write message); **sync conflict notice (new):** when `shouldApplyCloudData()` skips incoming data because a local write is in flight, record `{key, local, remote, at}` and show "Your other device changed X while you typed" with Use theirs / Keep mine; backup download; restore with RESTORE and the safety copy; CSV import (paste, project, preview counts and warnings, Import N); recent errors with Copy and Clear; the read-only usage report.
- [ ] **AI:** key saved / remove (never shown), totals, by feature, by day (14), "estimate, not your bill".

### 10.2 First run
- [ ] Profile gate: "Who's using Daylign?", profile list, create (existing name signs in).
- [ ] Setup: Welcome, Modules, Goals, Apple Watch, Done; step dots, Back, Continue, Skip. **Replay setup** from Settings (new) runs it again without wiping data. The goals step writes through the goals sheet's save function; the Watch step reuses the Settings Watch component.

### 10.3 + sheet — mockup: `Global / + sheet`
- [ ] Task, Food, Water, Weigh in, Workout, Usual ride, Event, Say it, as tinted icon tiles. On Tasks the + opens a new task directly, on Diet the food search, on Training the log sheet (replaces the context-aware header button; the desktop header keeps a context-aware primary button).

### 10.4 Weigh-in sheet — the only weigh-in UI
- [ ] Big weight field, optional waist, 30-day line with delta, pace to goal, Save. Opened from the now block, the Training weight pill, the brief chip, Coach and voice. Delete the quick weigh-in modal (`#weighInSheet`) and fold the 30-day `weight-sheet.js` into this.

### 10.5 Goals sheet — the only goals editor
- [ ] Goal weight, calories, protein, water, burn, carbs / fat. Opened from Settings, Diet and setup.

### 10.6 Voice and Ctrl K
- [ ] Voice sheet from + or the mic in the add bar (the floating mic FAB is removed): mic button, live transcript, results with Undo (6s), "didn't catch" line, typed fallback, multi-command. Error copy points to **Settings, AI** (fix the stale "Diet tab" text).
- [ ] Ctrl K palette: groups Exercises, Tasks, Foods, Views, and "Run as a command". Opened by Ctrl/⌘K, the search icon and the sidebar search box.

### 10.7 States — mockup: `Global / Toasts, sync, banners, states`
- [ ] Toasts on ink: plain (2.6s), action/undo (6s), offline, error (warn). `aria-live=polite`.
- [ ] Sync pill: Connecting, Saving, Synced, Offline, Error with retry; tap for details.
- [ ] Banners: update ready (Reload), **install to home screen (new)** using `beforeinstallprompt`, dismissible and remembered.
- [ ] Pull to refresh with a ring indicator. Empty states as dashed cards with one action. Skeleton loaders, no spinners. Keep keyboard-access promotion and haptics.

## 11. Cleanup (Phase 11)
- [ ] Delete dead `renderWeightTrend()` / `renderWeeklyReport()` calls from Today.
- [ ] Delete `prefs.wide` and anything reading it.
- [ ] Remove the More sheet, sidebar and More theme toggles, the sidebar category manager copy, the quick weigh-in modal, the floating voice FAB, the desktop Training rail, Today's My Tasks / Deadlines / Schedule / Reminders / health strip markup.
- [ ] `grep` for every removed id in `js/` and `style.css`; no dangling selectors or listeners.
- [ ] Replace remaining `prompt()` uses in touched flows with inline fields.

## 12. Data changes summary
| Change | Where | Migration |
|---|---|---|
| `color` on categories and projects | taxonomy state | assign from palette order once |
| `task.priority` set from the UI | task sheet | none (field exists) |
| `at` timestamp on diet entries, water adds, habits | `diet-core.js`, water, habit keys | missing `at` = slot time |
| Workout default time | `daylign_prefs.workoutTime` | default 18:30 |
| `DASH_WIDGETS` keys and saved layouts | `settings-prefs.js`, `layout.js` | §4.7 mapping |
| Accent key `indigo` → `cobalt` | `daylign_prefs.accent` | map on load |
| View key `dashboard` → `today` | last-view pref | map on load |
| Sync conflict records | memory only, shown in Settings | none |

## 13. Definition of done
- [ ] Every row in `coverage.json` checked in the running app at its `home`, in Light and Dark, at 390 and 1440 px. Keep a checklist file `V3_COVERAGE_CHECK.md` in the PR listing each row as pass / fail with a one-line note.
- [ ] Every `merged` row: the old entry point is gone and the surviving one works from every place that used to reach it.
- [ ] Every `added` row: works (priority, category colours, install prompt, sync conflict notice, replay setup, stale copy fixed, dead renders gone, wide flag gone).
- [ ] No console errors on any view; offline reload works (service worker `ASSETS` complete, `CACHE` bumped).
- [ ] Screens match the mockup: fonts, one accent, category colours, the line on Today, Calendar and Diet, pinned now block.
- [ ] Nothing pushed to `main`. PRs opened per phase for the co-builder to review.
