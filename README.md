# Daylign

*(formerly LifeStack)*

A personal life dashboard that aligns your day — tasks, workouts, nutrition, weigh-ins, and schedule in one place, with optional AI logging and Apple Watch sync. Built with **vanilla HTML, CSS, and JavaScript — no framework, no build step, no bundler.**

![License](https://img.shields.io/badge/license-MIT-blue)

Installable as a PWA, syncs across devices via Firebase, and works offline.

---

## For designers (start here for a design pass)

Everything visual lives in **one file: `style.css`** (~6,300 lines). There is no CSS framework, no Tailwind, no CSS-in-JS — just plain CSS with custom properties.

**The entire theme is driven by CSS variables** defined at `:root` in `style.css`. Change these and the whole app reskins:

| Token | Value | Role |
|---|---|---|
| `--bg-primary` / `--bg-secondary` | `#0b0b10` / `#0f0f16` | Page + panel backgrounds (dark) |
| `--bg-card` / `--bg-hover` | `#14141d` / `#1e1e2a` | Card surface / hover |
| `--border` | `#232330` | Hairline borders |
| `--text-primary` / `--secondary` / `--muted` | `#f2f2f7` / `#a5a5bd` / `#73738c` | Text hierarchy |
| `--accent` / `--accent-hover` / `--accent-glow` | `#6d6af8` (indigo) | Primary brand color, buttons, active states |
| `--green` / `--yellow` / `--red` / `--blue` / `--purple` | status colors | Progress dots, deltas, alerts |
| `--radius` / `--radius-sm` | `16px` / `10px` | Corner rounding |
| `--font-display` / `--font-body` | Space Grotesk / Inter | Headings vs body |
| `--shadow`, `--sidebar-width` | — | Elevation + layout |

**Structure:** `index.html` holds all markup. Each screen is a `<div class="view" id="...View">` (dashboard, tasks, board, calendar, gym, cardio, diet, settings) toggled by `switchView()` in `js/app.js`. Content is grouped into `.card` blocks. The layout is a fixed left `.sidebar` + main content on desktop, collapsing to a top bar + bottom `.bottom-nav` on mobile (`@media (max-width: 900px)`).

**It's fully responsive and theme-token-driven, so most redesigns are CSS-only** — recolor by editing the `:root` tokens, restyle components by editing their classes, no JS required. To preview changes, see *Running locally* below and open the app in a browser (or resize to phone width / use device-emulation).

**Current aesthetic:** dark, indigo-accented, rounded cards, Space Grotesk display type, generous spacing, subtle glows and micro-animations. A light theme also exists (`:root[data-theme="light"]`) — style both when touching colors.

### Redesigning the Gym, Cardio & Diet pages

These three are the fitness/nutrition modules and share conventions. Each renders from its own JS file into a `#...View` container; the markup for their input controls is static in `index.html`, and the list/summary areas are filled by `innerHTML` from JS. **Restyling is CSS-only** — the JS writes class names, not inline styles (except progress widths / conic-gradient rings). Every one leads with its primary logging control at the top so logging never needs a scroll.

| Page | View / file | Key sections (CSS class → what it is) | Notes for redesign |
|---|---|---|---|
| **Gym** | `#gymView` / `js/gym.js` | `.gym-date-bar` (day nav) · `.gym-add-bar` (add exercise + sets, top) · `.gym-stats` · `.gym-workout` (logged list) · `.weight-card` (body weight + spark) · `.coach-card` (targets + rule-based tips) · `.streak-card` (streak + 16-week heatmap) | Densest page. The heatmap and stat tiles are the visual anchors. |
| **Cardio** | `#cardioView` / `js/cardio.js` | `.cardio-add-card` (type tabs run/ride/swim + distance/duration, top) · `.cardio-watch-chip` (Apple Health cross-check) · `.cardio-day` (sessions) · `.cardio-week` (weekly volume tiles) · `.cardio-race` (countdown + projected finish) · `.cardio-coach` | Newest page, lightest styling — most room for a designer. Pace shows in each sport's own units. |
| **Diet** | `#dietView` / `js/diet.js` | `.diet-summary` (macro rings) · `.diet-log-card` (food search + add, incl. photo logging) · food list grouped by meal · `.diet-goals` · water tracker | Macro rings (`.diet-goals`) and the meal-grouped list are the centerpiece. |

Shared building blocks worth reusing rather than reinventing: `.card`, `.btn-primary` / `.btn-secondary`, the stat-tile pattern (label + big value + sub), progress bars/rings, and status dots (`--green` / `--yellow` / `--red`). The three modules can be turned on/off in Settings, so don't assume all three are always in the nav.

**Do not touch** the data flow: the render functions (`renderGym`, `renderCardio`, `renderDiet`) read from `state` and must not be made to write. Any save goes through `saveData(state)` on an explicit user action only — see the data-safety note in *Data & privacy*.

---

## Features

### Dashboard
- Task stats (total, in progress, completed, overdue) with project filtering
- **Health strip** — today's calories, net calories (food minus training + walking burn), protein, water, steps, exercise minutes, sleep, and weight, each vs. goal
- **Weekly Report** — trailing-7-day averages for calories, protein, carbs, fat, training, water, resting HR, and sleep, plus a single prioritized focus for the week
- Weight-trend chart (7-day smoothed) vs. goal line
- Smart reminders (gym gaps, water, calories, protein, weigh-ins, habits) and a drag-and-drop daily schedule

### Tasks
- **Board** (Kanban, drag-and-drop, category folders) and **List** views
- Subtask checklists, priorities, due dates, projects with custom colors
- Auto-archive of tasks completed 1+ week ago

### Calendar
- Month/week views with US holidays, custom color-coded events, and task dots on due dates

### Gym
- Log exercises with sets/reps/weight; automatic bodyweight-exercise detection
- **Trend body weight** (7-day rolling average) as the headline, with pace-to-goal tracking and ETA
- **Targets & Coach** — MET-based (or Apple-Watch-measured) calorie burn vs. goal, and rule-based training recommendations
- **Progressive overload** — beat-last-time chip, PR badges, and calisthenics progression ladders
- **Consistency** — day streak, weekly count, and a 16-week GitHub-style heatmap
- Built-in rest timer

### Cardio
- Log **runs, rides and swims** as sessions (distance + duration), with pace computed in each discipline's own units — min/mi, mph, min/100yd
- **Weekly volume** — run mileage vs target, longest single run, ride and swim totals, training days
- **Race countdown and projected finish** for 5K / 10K / half / marathon, using Riegel's formula against your best recent effort
- **Coach** — the 10%-a-week volume rule, long-run share of weekly mileage, and taper timing as the race approaches
- Session calories use pace-scaled MET values and feed the same Net Cals figure as lifting
- **Apple Watch workout import** — workouts synced from Apple Health show under "⌚ Apple Watch workouts" with one-tap import to the Cardio log (run/ride/swim); a type+distance match hides the button once imported so a hand-logged run and its watch copy don't double up

### Diet
- 200+ food database (incl. South Indian foods and fast-food chains) with live search (Open Food Facts + USDA fallback), custom foods, serving math, and meal grouping
- Macro goal tracker (calories, protein, carbs, fat) with net-calorie awareness and protein-aware overage advice
- Water tracker with quick-add buttons

### AI logging *(optional — needs your own Anthropic API key)*
- **Photo food logging** — snap a plate; Claude vision estimates each item's macros into an editable confirmation card
- **Voice / natural-language commands** — a floating mic (or typed input) lets you say things like *"log 40 oz water,"* *"add a task to pay rent tomorrow,"* *"I weighed 163,"* or *"three idli for breakfast"*; Claude parses it into actions, each with an Undo
- See `HEALTH-SYNC.md` and the *AI features* note below for setup

### Apple Health / Apple Watch
- An iPhone Shortcut writes steps, active energy, exercise minutes, resting HR, and sleep into a separate Firebase node the app reads; watch-measured active burn replaces the estimate everywhere. Full setup in **`HEALTH-SYNC.md`**.

---

## Tech stack

- **Vanilla JavaScript (ES6+)** — no framework, no build tooling
- **CSS custom properties** for theming (single `style.css`)
- **Firebase Realtime Database** for cross-device sync (`js/firebase-sync.js`)
- **PWA** — installable, `sw.js` service worker, offline-capable
- **Anthropic API** called directly from the browser for the AI features (photo + voice), using a device-local key
- Deployed on **GitHub Pages** (auto-deploys on push to `main`)

## Running locally

No install or build. Either open `index.html` directly, or serve it (recommended, so the service worker and relative paths behave):

```bash
npx http-server -p 8080 -c-1 .
# then open http://localhost:8080
```

To test on a phone, open `http://<your-computer-lan-ip>:8080` on the same Wi-Fi.

## Data & privacy

- App data (tasks, workouts, meals, weigh-ins, water, goals) syncs to **Firebase Realtime Database** and is cached in `localStorage` for offline use.
- **Profiles:** each person's data lives at `users/<profile-id>`, picked once per device on first launch and stored in `localStorage['daylign_profile']`. Nothing is read from or written to the cloud until a profile is chosen. This gives people **separation, not security** — the database has no auth rules, so it stops accidental clobbering between people who trust each other, and is not a permission system. Switch or reset from Settings → *Who's using this device*.
- The original pre-profiles node `lifestack` is **never written again** and is kept as a frozen backup.
- **Onboarding:** a newly created profile runs a short first-run flow (welcome → pick modules → set core goals) before landing on the dashboard. It's triggered by the sync layer once cloud state settles and gated on a synced `goals._onboarded` marker, so a returning person on a new device is never walked through it again. Skippable; everything it sets lives in Settings (`js/onboarding.js`).
- **Modules:** Gym, Cardio and Diet are optional and toggle on/off per-profile in Settings (`state.modules`, synced). Off hides them from every nav surface and drops their dashboard cards; the data is never deleted and returns when re-enabled. Tasks, Board, Calendar and Dashboard are core. The Categories/Projects sidebar sections only appear on those task-oriented views (`TASKMETA_VIEWS`).
- Settings → *How the app is being used* is a **read-only** engagement report (last sync, active days, what each person logs). It reads the `users` tree directly and never loads another profile into the running app — doing that would be a write hazard, since `renderDiet()` calls `saveData()` during an ordinary render.
- **Community food bank:** custom foods anyone saves publish to a shared `foodBank` root node (like `external`, a separate shared root), and every profile reads it — so one person's dishes become searchable for everyone, tagged "Community" in search. Publishing is additive; deleting a food from your own bank never removes it from the shared pool. `js/firebase-sync.js` (`loadSharedFoods` / `publishFoodToBank`).
- Apple Health/Watch data lives in a **separate `external` Firebase node** the app only reads — app writes can never overwrite it. Per person: `external/*` for the original profile, `external/u/<profile-id>/*` for everyone else.
- **AI features** send the photo or spoken text to the Anthropic API. The **API key is stored only in that browser's `localStorage`** (`tf_anthropic_key`) — never committed to the repo or synced to Firebase — so a public repo never exposes a billable key. AI features are entirely optional and dormant until a key is added.

## Project structure

```
index.html            — All markup (one .view per screen)
style.css             — All styles + :root design tokens
sw.js                 — Service worker (offline / PWA)
manifest.webmanifest  — PWA manifest
HEALTH-SYNC.md        — Apple Health / Watch shortcut setup
js/
  state.js            — Data model, localStorage persistence, defaults
  utils.js            — DOM helpers ($ / $$), dates, holidays, toasts
  app.js              — Entry point, navigation (switchView), event binding
  firebase-sync.js    — Firebase sync + external (Apple Health) reads
  profile.js          — Per-person profiles: first-launch gate, node paths, switching
  training.js         — Training shell: Strength/Cardio mode toggle, combined week line
  sleep.js            — Sleep logging + the Readiness score it feeds
  preferences.js      — Settings: appearance, sync status, Anthropic key row
  onboarding.js       — First-run flow for new profiles (modules + core goals)
  dashboard.js        — Health strip, Weekly Report, weight trend, reminders, schedule
  tasks.js            — List view
  board.js            — Kanban board
  calendar.js         — Month/week calendar + events
  modal.js            — Task create/edit modal
  gym.js              — Workout logging, trend weight, coach, streaks, PRs
  cardio.js           — Run/ride/swim sessions, pace, weekly volume, race prediction
  diet.js             — Food tracking, database, API lookups, goals, water
  food-photo.js       — Photo food logging (Claude vision)
  voice.js            — Voice / natural-language commands (Web Speech + Claude)
```

## License

MIT
