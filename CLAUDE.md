# Daylign

A personal life dashboard — tasks, workouts, nutrition, weigh-ins, sleep and
schedule in one place, with optional AI logging and Apple Watch sync. Built by
two people: this is the shared brief so anyone's Claude Code works the same way.

**Read `README.md` first — it is the source of truth** for features, the data
model, the full file map and the design tokens. This file is the layer on top:
the rules that keep two people from breaking each other's work, and the shared
direction we're building toward.

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
  happens only on an explicit user action. `renderDiet()` currently calls
  `saveData()` during an ordinary render — that is a known hazard, and it is why
  the read-only engagement report never loads another profile into the running
  app. Don't add more of this.
- Listeners on elements *inside* a rewritten section die with the old nodes
  (fine). Listeners on *persistent* containers **accumulate** — bind those once,
  guarded. `bindBoardDropTargets()` exists because that bug shipped once.
- `writeStateToLocal()` in `state.js` is the single writer for all 15 synced
  keys. Route persistence through it; don't write localStorage keys directly.

## Data, and why it's shared but not secured

- Firebase Realtime Database syncs the 15-key state object; `localStorage`
  caches it offline. Device prefs (`daylign_prefs` — theme, accent, layouts) are
  **not** synced; they describe one device.
- Each person is a profile at `users/<profile-id>`. This is **separation, not
  security** — the database has *no auth rules*, it's world-readable and
  world-writable. That's the single most important open item (see Known gaps in
  README). **Do not "add Firebase security rules" casually** — the real rules
  need Firebase Auth added first, and applying them naively locks the live app
  out. Coordinate before touching this.
- **When we're both testing, use separate profiles** (Settings → *Who's using
  this device*) so we don't clobber each other's data.
- The Anthropic API key for AI features is stored only in the browser's
  `localStorage` (`tf_anthropic_key`) — **never commit a key, never sync one to
  Firebase.** The repo is public.

## How we work together

- **`main` auto-deploys to GitHub Pages on every push.** A broken `main` is a
  broken *live* app. So: **branch per feature, open a PR, don't push straight to
  `main`.**
- **Bump `CACHE` in `sw.js` on every ship**, or returning users get a stale app
  masked by the service worker.
- Keep changes CSS-only where you can — the whole app is theme-token-driven from
  `:root` in `style.css`. Recoloring and restyling rarely needs JS.
- No automated tests exist yet. Verify by running it (below) and clicking the
  actual flow you changed, on both desktop and phone widths.

## Running locally

No install, no build:

```bash
npx http-server -p 8080 -c-1 .
# open http://localhost:8080
```

Serve it rather than opening `index.html` directly, so the service worker and
relative paths behave. To test on a phone, open `http://<your-lan-ip>:8080` on
the same Wi-Fi.

## What we're building toward: marathon training

Vaibhav is training for a marathon, and daylign already has real bones for this
in `js/cardio.js` — don't rebuild what's there, extend it:

- Run/ride/swim sessions with pace in each sport's own units (min/mi, mph,
  min/100yd)
- **Weekly volume** vs target, longest run, training days
- **Race countdown and projected finish** for 5K/10K/half/**marathon**, using
  Riegel's formula against your best recent effort
- A rule-based **coach** (`coach.js` / `brief.js`, one shared engine): the
  10%-a-week volume rule, long-run share of weekly mileage, and taper timing as
  the race nears
- Apple Watch run import via the Apple Health node

The likely shape of the work — **to agree on together, not yet specced**:
bringing a structured training *plan* into the app (weeks, target paces, long-run
progression), measuring actual sessions against it, and sharpening the race
prediction and taper guidance around a real goal race. Treat cardio.js, coach.js
and brief.js as the surfaces this touches, and keep the coach rule-based (it runs
offline, costs nothing, and every verdict shows its numbers) unless we decide
otherwise together.

## Where things live (quick map — full version in README)

- `index.html` — all markup, one `.view` per screen
- `style.css` — all styles + `:root` design tokens (~8.9k lines)
- `sw.js` — service worker; bump `CACHE` on ship
- `js/state.js` — data model, the 15 synced keys, the single localStorage writer
- `js/app.js` — entry, `switchView`, `render()`, event binding
- `js/firebase-sync.js` — cloud sync + Apple Health reads
- `js/cardio.js` · `coach.js` · `brief.js` · `training.js` · `strength.js` — the
  training surfaces (marathon work lands here)
- `js/gym.js` · `sleep.js` · `diet-*.js` — the other health modules
- `js/tasks.js` · `board.js` · `calendar.js` · `today.js` · `dashboard.js` — the
  planning core
