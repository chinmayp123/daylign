# Daylign

A personal life dashboard — tasks, workouts, nutrition, weigh-ins, sleep and
schedule in one place, with optional AI logging and Apple Watch sync. One owner
builds it; this is the brief every Claude Code session here works from.

**Read `README.md` first — it is the source of truth** for features, the data
model, the full file map and the design tokens. This file is the layer on top:
the rules that keep the live app from breaking. The v3 "Day Line" redesign is
specced in `design/v3/BUILD_SPEC_v3.md`; where it stands is in
`design/v3/PROGRESS.md`, and `design/v3/V3_COVERAGE_CHECK.md` maps every v2
feature to its v3 home.

## The one thing to understand: there is no build step

Every file is a plain `<script>` in `index.html` sharing **one global scope** —
no framework, no bundler, no ES modules, no imports. This is deliberate. It
changes how you edit:

- **Load order is significant.** `state.js` and `utils.js` load before anything
  that uses `state`, `$`, `$$` or `esc`. The five `diet-*.js` files must stay in
  their listed order — they were sliced from one file at function boundaries.
- **A new file must be registered in THREE places**, or it silently breaks:
  1. a `<script>` tag in `index.html`
  2. an entry in `sw.js` `ASSETS` (miss this and it breaks *offline*, not on your machine — easy to not notice)
  3. usually a call inside `render()` in `js/app.js`
- Adding a library? Prefer not to. If you must, it's a `<script>` tag and an
  `ASSETS` entry like everything else — keep the no-build discipline.

## The rule that will bite you: renderers must never write

`render()` in `app.js` calls every view's renderer on every render; views are
shown/hidden with CSS, never unmounted. Renderers rebuild their section with
`innerHTML` and re-attach listeners. So:

- **A render function reads `state`. It must not call `saveData()`.** Saving
  happens only on an explicit user action. No renderer saves today (v3 removed
  the old `renderDiet()` save-on-render, which now runs when the Food library is
  opened); keep it that way. The read-only engagement report still never loads
  another profile into the running app.
- Listeners on elements *inside* a rewritten section die with the old nodes
  (fine). Listeners on *persistent* containers **accumulate** — bind those once,
  guarded. `bindBoardDropTargets()` exists because that bug shipped once.
- `writeStateToLocal()` in `state.js` is the single writer for all 18 synced
  keys. Route persistence through it; don't write localStorage keys directly.
- **Sheets:** every bottom sheet is a `.dl-sheet-wrap` opened and closed with
  `openDlSheet()` / `closeDlSheet()` (js/utils.js). Those handle Esc, backdrop
  tap, swipe, an inert background, the Tab trap and returning focus. A sheet's
  own action bar that should stick to the bottom gets `.sheet-foot`; plain
  `.ts-actions` is just a row. No `confirm()` / `prompt()` / `alert()`: deletes
  undo from the toast, and "are you sure" uses `askConfirm()` (js/settings.js).

## Data, and why it's shared but not secured

- Firebase Realtime Database syncs the 18-key state object; `localStorage`
  caches it offline. Device prefs (`daylign_prefs` — accent, layouts, workout
  time; the theme is `daylign_theme`) are **not** synced; they describe one
  device.
- **A new synced key must be added in FOUR places**, or it is silently lost on
  reload or never reaches the cloud: `loadData()`, `writeStateToLocal()` and
  `CLOUD_KEYS` in `state.js`, and `SYNC_KEYS` in `firebase-sync.js`. Backup,
  restore and Start fresh read `CLOUD_KEYS`, so they follow automatically.
- **Never write `undefined` into state.** Firebase rejects a write with
  `undefined` anywhere in it, and the key stays dirty, so every later save fails
  too. Leave a key out instead (`saveToFirebase` also strips them, as a
  backstop).
- Each person is a profile at `users/<profile-id>`. This is **separation, not
  security** — the database has *no auth rules*, it's world-readable and
  world-writable. That's the single most important open item (see Known gaps in
  README). **Do not "add Firebase security rules" casually** — the real rules
  need Firebase Auth added first, and applying them naively locks the live app
  out. Ask the owner before touching this.
- **Never test against the live database.** Verify on a local copy with the
  Firebase SDK stripped or disconnected; the database is shared and has no auth.
  Take a read-only backup (GET `users/<id>`, `profiles`, `external`) before
  any push that changes how data is loaded or saved.
- The Anthropic API key for AI features is stored only in the browser's
  `localStorage` (`tf_anthropic_key`) — **never commit a key, never sync one to
  Firebase.** The repo is public.

## Shipping

- **`main` auto-deploys to GitHub Pages on every push.** A broken `main` is a
  broken *live* app. So: **work on a branch, and push or open a PR only with
  the owner's OK. Never push straight to `main`.**
- **Bump `CACHE` in `sw.js` on every ship**, or returning users get a stale app
  masked by the service worker.
- Keep changes CSS-only where you can — the whole app is theme-token-driven from
  `:root` in `style.css`. Recoloring and restyling rarely needs JS.
- No automated tests are committed. Verify by running it (below) on a copy
  with the Firebase SDK stripped, and exercise the flow you changed at phone
  (390 px) and desktop (1440 px) widths, in Day and Night. The owner tests on an
  iPhone, so check Safari too: WebKit as an iPhone 15 via Playwright is the
  standard pass. A local, untracked harness that does all of this (seeded demo
  data, scripted checks, a contrast scan, the WebKit runner) lives in
  `.claude/verify/` when present.
- Safari specifics already handled, keep them: form controls inherit the font
  family (Safari otherwise draws them in Times), fields are at least 16px on a
  phone (smaller ones make iOS zoom the page), sheets size with `dvh` with a
  `vh` fallback, and the bottom nav pads for `env(safe-area-inset-bottom)`.

## Running locally

No install, no build:

```bash
npx http-server -p 8080 -c-1 .
# open http://localhost:8080
```

Serve it rather than opening `index.html` directly, so the service worker and
relative paths behave. To test on a phone, open `http://<your-lan-ip>:8080` on
the same Wi-Fi.

## Cardio and the coach

`js/cardio.js` already does run/ride/swim with pace in each sport's own units,
weekly volume vs target, race countdown and projected finish (Riegel), and
Apple Watch imports. The coach (`coach.js` / `brief.js`, one shared engine) is
rule-based on purpose: it runs offline, costs nothing, and every verdict shows
its numbers. Extend these rather than rebuilding them, and keep the coach
rule-based unless the owner decides otherwise.

## Where things live (quick map — full version in README)

- `index.html` — all markup, one `.view` per screen
- `style.css` — all styles + `:root` design tokens (~6.4k lines)
- `sw.js` — service worker; bump `CACHE` on ship
- `js/state.js` — data model, the 18 synced keys, the single localStorage writer
- `js/app.js` — entry, `switchView`, `render()`, event binding
- `js/firebase-sync.js` — cloud sync, the sync pill and conflict notice, Apple Health reads
- `js/cardio.js` · `coach.js` · `brief.js` · `training.js` · `strength.js` — the
  training surfaces
- `js/gym.js` · `sleep.js` · `diet-*.js` — the other health modules
- `js/tasks.js` · `board.js` · `task-sheet.js` · `calendar.js` — tasks and
  calendar; `line.js` (the day line) · `now-block.js` · `today.js` ·
  `dashboard.js` — Today
- `js/settings.js` · `settings-prefs.js` · `preferences.js` — Settings;
  `global.js` (the + sheet, install banner) · `weight-sheet.js` (the one
  weigh-in) · `voice.js` — global sheets
