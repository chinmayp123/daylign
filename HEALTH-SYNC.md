# Syncing Apple Health (Steps + Apple Watch) into Daylign

## Fastest setup: add the pre-built shortcuts

In the app, go to **Settings → Connect Apple Watch**. Tap each shortcut to add it to your iPhone, run it once to grant Health access, then set up a nightly Automation to run them. That's the whole thing — the manual build below is only if you want to understand or customize it.

Pre-built shortcuts:
- **Steps** — https://www.icloud.com/shortcuts/b4c12d9d299a4a849b2d10e978cfa8e1
- **Sleep** — https://www.icloud.com/shortcuts/896af7c980d44e24b0188225a98c7ab0

---

## Building the shortcut (the pattern that actually works)

> This section was rewritten after building it for real on an iPhone. An earlier
> version described a single Dictionary + multi-path `PATCH`; that is *not* what
> was built or verified. What follows is the proven pattern.

Each metric is an independent **3-action block**. Repeat the block per metric.

**Once, at the top of the shortcut:**

**Format Date** → Date = *Current Date*, Date Format = **Custom** → `yyyy-MM-dd`.
This produces the `Formatted Date` variable every block reuses.

**Then, per metric:**

1. **Find Health Samples** — set *Type*, and a date filter (**Start Date is today**, or **is in the last 1 day** for sleep).
2. **Calculate Statistics** — **Sum** for most, **Average** for Resting Heart Rate.
3. **Get Contents of URL**
   - URL: `https://lifestack-d5300-default-rtdb.firebaseio.com/external/<metric>/` + **Formatted Date** + `.json`
   - Method: **PUT**
   - Request Body: **File**  ← *not* JSON; the body is a single bare number
   - File: the **Sum** (or **Average**) from step 2

| Metric | Health sample type | Stat | URL word |
|---|---|---|---|
| Steps | Steps | Sum | `steps` |
| Active energy | Active Energy | Sum | `activeEnergy` |
| Exercise | Apple Exercise Time | Sum | `exerciseMinutes` |
| Resting HR | Resting Heart Rate | **Average** | `restingHR` |
| Sleep | Sleep — *see below* | Sum | `sleep` |
| Run distance | Walking + Running Distance | Sum | `runDistance` |
| Cycle distance | Cycling Distance | Sum | `cycleDistance` |
| Swim distance | Swimming Distance | Sum | `swimDistance` |

URL words are **case-sensitive** — `restingHr` will not be read; it must be `restingHR`.

### Recording *when* the sync ran (optional, one action)

Nothing in the blocks above records the time the shortcut ran — only the date
each reading belongs to. Those are different facts, and the app refuses to
claim one from the other: without this step the card reads *"Watch data through
Aug 13"*, not *"synced at 9:14 PM"*. A successful 9 PM run produces data dated
that same day, so "the newest data is from yesterday" would look identical
whether the shortcut ran perfectly or has not run since.

Add **one** action as the very **last** step of the shortcut:

**Get Contents of URL**
- URL: `https://lifestack-d5300-default-rtdb.firebaseio.com/external/lastSync.json`
- Method: **PUT**
- Request Body: **File**  ← a bare value, same as the metric blocks
- File: **Current Date**

**Put it last, not first.** A metric that finds no samples errors and skips
every action below it (see the warning below), so a stamp at the END only lands
when the whole run actually finished. A stamp at the top would say "synced"
about runs that fell over immediately.

**Any date format works.** The app accepts Shortcuts' default
(`August 13, 2026 at 9:14 PM`), an ISO string, epoch milliseconds, or epoch
seconds. You do not need a Format Date action — pass *Current Date* straight in.
Anything unparseable is ignored and the card quietly falls back to describing
the data instead of inventing a time.

### Sleep needs one extra action

Apple's sleep samples are **categories** ("Asleep", "InBed", "Core", "Deep", "REM"), not numbers. Summing them fails with *"Calculate Statistics failed because Shortcuts couldn't convert from Text to Number."* You must sum their **durations** instead:

**Find Health Samples** (Sleep, *Start Date is in the last 1 day*, *Value is Asleep*) → **Get Details of Health Sample → Duration** → **Calculate Statistics → Sum of `Duration`** → upload.

Two gotchas: point the Sum at the **Duration** output (not "Health Samples"), and use *in the last 1 day* — last night's sleep **starts yesterday evening**, so "is today" finds nothing. The app accepts the total in seconds, minutes or hours.

### A metric with no data stops the whole shortcut

If a Find returns nothing (0 exercise minutes, no resting-HR sample yet), its upload sends an empty body, errors, and **every action below it is skipped**. Symptoms: the first metrics sync fine and the rest silently never appear.

Practical ways to live with it:
- Put the always-present metrics (**steps**, **active energy**) **first**.
- Put flaky ones (exercise, resting HR) **last**, or keep them in a **separate shortcut**.
- To find the culprit, run it and scroll from the top — the **first red error** is what halted the run.

**Automate it:** Shortcuts app → Automation → *Time of Day* → nightly (e.g. 11:55 PM) → run this shortcut → turn off "Ask Before Running".

---

## Syncing individual workouts (Apple Watch → Cardio)

Beyond the daily totals above, you can push each **workout session** so they appear in the Cardio tab under "⌚ Apple Watch workouts", each with a one-tap **Add to log** (import) that creates a Cardio session. Runs, rides and swims are importable; strength workouts show as read-only.

Post them to `workouts/<date>` as a list of `{ type, minutes, distance, cal }`:
- `type` — the Apple workout name (e.g. "Outdoor Run", "Pool Swimming"). The app maps run/cycle/swim automatically.
- `minutes` — duration
- `distance` — miles for run/ride, yards for swim (0 for strength)
- `cal` — active calories

**Keep this as its own shortcut** ("Sync Workouts to Daylign") rather than adding it to the metrics one — then an empty metric can't stop it (see the warning above).

**Simple version — one workout, 3 actions.** The app accepts a single workout object, so no Repeat loop is needed and this covers most days:

1. **Format Date** → Current Date → Custom → `yyyy-MM-dd`
2. **Find Workouts** — filter *Start Date is in the last 1 day*, **Limit = 1**, Sort by Start Date (Latest First)
3. **Get Contents of URL**
   - URL: `https://lifestack-d5300-default-rtdb.firebaseio.com/external/workouts/` + **Formatted Date** + `.json`
   - Method: **PUT** (replaces that day's entry, so re-runs never duplicate)
   - Request Body: **JSON** — here it *is* JSON, because we're sending an object rather than one number. Add four fields:

   | Field | Type | Value |
   |---|---|---|
   | `type` | Text | Workout → *Type* |
   | `minutes` | Number | Workout → *Duration* |
   | `distance` | Number | Workout → *Distance* |
   | `cal` | Number | Workout → *Active Energy* |

Duration may come through in seconds; the app converts anything over 600 to minutes.

**Multiple workouts a day:** drop the Limit, wrap steps in **Repeat with Each** building a **Dictionary** per workout into an **Add to Variable** `WorkoutList`, then PUT `WorkoutList` as the JSON body. The app reads arrays and single objects alike.

---

## What this does

An iPhone Shortcut reads today's health data from Apple Health and writes it directly to the Daylign Firebase Realtime Database under the `external` node (e.g. `external/steps/2026-07-16 = 8421`). The dashboard reads this node read-only. The app's own writes go to the `lifestack` node, so nothing under `external` is ever overwritten by the app.

Supported metrics and where they show up:

| Firebase path | Health sample | Used for |
|---|---|---|
| `external/steps/<date>` | Steps (Sum) | Steps tile; walking burn in Net Cals |
| `external/activeEnergy/<date>` | Active Energy (Sum) | Replaces the MET burn estimate everywhere — Net Cals tile, Gym "Active Burn" target, Diet net line |
| `external/exerciseMinutes/<date>` | Apple Exercise Time (Sum) | Exercise tile on the dashboard (default goal 30 min) |
| `external/restingHR/<date>` | Resting Heart Rate (Average) | Resting HR row in the Weekly Report |
| `external/sleep/<date>` | Sleep, Value is Asleep (Sum, in hr) | Sleep tile on the dashboard (goal 8h) + Weekly Report row. Keyed by wake-up date; values >24 are treated as minutes and normalized |
| `external/runDistance/<date>` | Walking + Running Distance (Sum, in mi) | Cross-check chip in the Cardio view |
| `external/cycleDistance/<date>` | Cycling Distance (Sum, in mi) | Cross-check chip in the Cardio view |
| `external/swimDistance/<date>` | Swimming Distance (Sum, in yd) | Cross-check chip in the Cardio view |

**The three distance metrics never create sessions by themselves.** They show up as a "⌚ Watch recorded 5.2 mi" chip with a *use this* button that pre-fills the distance box. That is deliberate: if the app auto-imported them, a run you logged by hand and the same run recorded by the watch would both count toward your weekly mileage. Note that Apple's `Walking + Running Distance` includes ordinary walking, so it will usually read higher than your actual run.

Steps work from the iPhone alone. The other three need an Apple Watch (that's what measures active energy, exercise minutes, and resting HR). When `activeEnergy` exists for a date, the app trusts it outright and stops adding its own workout estimate + walking burn — the watch number already includes both.

## If you are not Chinmay: use your own paths

Daylign now has one profile per person (see "Who's using this device" in Settings). The paths in the table above belong to the original profile, which was set up before profiles existed. **Everyone else adds `u/<your-profile-id>` after `external`:**

| Your profile | Path to use |
|---|---|
| Chinmay | `external/steps/<date>` |
| Anyone else, e.g. profile id `arjun` | `external/u/arjun/steps/<date>` |

Your profile id is your first name, lowercased, with spaces and punctuation turned into hyphens — "Arjun K" becomes `arjun-k`. Settings shows the name you picked.

So wherever this guide says:

`https://lifestack-d5300-default-rtdb.firebaseio.com/external/steps/[Current Date].json`

you would use:

`https://lifestack-d5300-default-rtdb.firebaseio.com/external/u/arjun/steps/[Current Date].json`

Everything else — the Health sample types, the date format, the Automation — is identical. The app reads only your own subtree, so your metrics never mix with anyone else's.

## Shortcut setup

Open the **Shortcuts** app on your iPhone and create a new shortcut named **Sync Steps to Daylign**, with these three actions in order:

1. **Find Health Samples**
   - Type: **Steps**
   - Add filter: **Start Date** is **Today at 00:00**
   - Group By: **Day**
   - Calculate: **Sum**
   - Output: today's total step count.

2. **Format Date**
   - Date: **Current Date**
   - Format: **Custom**
   - Custom format string: `yyyy-MM-dd`

3. **Get Contents of URL**
   - URL:
     `https://lifestack-d5300-default-rtdb.firebaseio.com/external/steps/[Formatted Date].json`
     (insert the **Formatted Date** variable from step 2 where shown)
   - Tap **Show More**:
     - Method: **PUT**
     - Request Body: **File** (or Text) = the **Health Samples** result from step 1 — the raw number, no quotes. Firebase stores it as a JSON number.

## Adding Apple Watch metrics (same shortcut)

Append these actions to the same shortcut, after the three above. Each pair follows the exact same pattern as steps — a **Find Health Samples** action, then a **Get Contents of URL** PUT. Reuse the **Formatted Date** variable from step 2 in every URL.

4. **Find Health Samples** — Type: **Active Energy**, filter Start Date is **Today at 00:00**, Group By **Day**, Calculate **Sum**.
5. **Get Contents of URL** — URL:
   `https://lifestack-d5300-default-rtdb.firebaseio.com/external/activeEnergy/[Formatted Date].json`
   Method **PUT**, Request Body = the **Health Samples** result from action 4.

6. **Find Health Samples** — Type: **Apple Exercise Time**, filter Start Date is **Today at 00:00**, Group By **Day**, Calculate **Sum**.
7. **Get Contents of URL** — URL:
   `.../external/exerciseMinutes/[Formatted Date].json`
   Method **PUT**, Request Body = the result from action 6.

8. **Find Health Samples** — Type: **Resting Heart Rate**, filter Start Date is **Today at 00:00**, Calculate **Average**.
9. **Get Contents of URL** — URL:
   `.../external/restingHR/[Formatted Date].json`
   Method **PUT**, Request Body = the result from action 8.

10. **Find Health Samples** — Type: **Sleep** · **Add Filter: Value is Asleep** (excludes In Bed time) · Start Date **is in the last 1 day** (NOT "is today" — last night's sleep started yesterday evening) · Unit **hr** · Group By **None**.
11. **Calculate Statistics** — Operation: **Sum**, input: the Sleep samples from action 10 (needed because sleep can't Group By cleanly across midnight).
12. **Get Contents of URL** — URL:
    `.../external/sleep/[Formatted Date].json`
    Method **PUT**, Request Body = the **Calculated Statistics** result from action 11.

Careful when inserting each Request Body: Shortcuts offers every prior action's output — pick the **matching** Find Health Samples result (tap the variable, check its source action), not the first one. If two variables look identical, insert one, tap it → **Reveal Action** — it highlights the card it comes from.

Run it once manually. iOS will prompt for Health access on first run — tap **Allow** for all requested categories.

## Automation (runs nightly)

1. Shortcuts app → **Automation** tab → **+**
2. Choose **Time of Day** → **9:00 PM**, repeat **Daily**
3. Select **Run Immediately** (run without asking)
4. Pick **Sync Steps to Daylign**

You can also run the shortcut manually anytime. Re-runs are safe: PUT overwrites the same date key with the latest count.

## Verify it worked

1. Open this in any browser:
   `https://lifestack-d5300-default-rtdb.firebaseio.com/external.json`
2. Check that each metric has today's date key with a bare number, e.g. `{"steps": {"2026-07-16": 8421}, "activeEnergy": {"2026-07-16": 512}, ...}`.
3. Refresh the Daylign dashboard — the Steps and Exercise tiles should populate, Net Cals shows the ⌚ marker, and the Gym card's burn target switches from "Est. Burn" to "Active Burn / measured by your Apple Watch".

## Troubleshooting

- **Number shows up quoted** (`"8421"` instead of `8421`): the request body must be the step count *variable*, not typed text or a quoted string. If the Steps tile shows nothing, open the `.json` URL above and confirm the value is a bare number.
- **Wrong or missing date key**: the custom date format must be exactly `yyyy-MM-dd` (lowercase `yyyy` and `dd`, uppercase `MM`).
- **Shortcut returns no steps**: on first run, iOS asks for Health permission — it must be allowed. Check Settings → Privacy & Security → Health → Shortcuts if you missed the prompt.
