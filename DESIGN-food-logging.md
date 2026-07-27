# Design: Zero-Effort Food Logging ("Your Usuals")

Generated via office-hours, 2026-07-27
Branch: main
Repo: chinmayp123/todo-dashboard
Status: DRAFT
Mode: Builder

## Context

Daylign works, but it doesn't pull the user in. Opening it feels like a chore:
the Today page is cluttered, inputs are awkward, and logging demands too much.
The owner (building for himself + family) said it plainly: "it makes me do a lot
just to open this app" and "it needs to do something to gain my traction."

Asked what would make him *want* to open it, he picked **logging that's zero
effort** over a morning dashboard or a streak system. Then the key constraint:
"you can have the effort but it should look simple and not complicated." So the
intelligence lives under the hood; the surface stays calm and uncluttered.

The worst daily friction is **food** (3x+/day). He already likes the recent
food-logging visuals and the per-meal add flow, and wants the meal quick-add
made faster and more customizable.

## What makes this good

A normal day becomes ~5 taps, no typing, no forms in your face. You open Diet,
each meal already shows *your* usual foods as tiles, you tap what you ate, done.
Search stops being the default and becomes the fallback.

## Premises (agreed)

1. ~80% of what you eat is the same handful of foods, repeated. Fastest logging
   is not "search faster," it's "don't search at all" — surface your foods, tap.
2. Complexity (ranking, macros, defaults) lives in code, not on screen. You see
   a few tiles and a number.
3. Log first, fix later. Tapping never demands servings up front; adjust after.
   This also fixes a real gap: logged entries are currently delete-only.

## Recommended approach: "Your Usuals" tiles (inline, one-tap)

The pieces already exist. This is a re-rank + a re-placement, not new machinery.

**Reuse:**
- `quickAddToMeal(meal, result)` — `js/diet.js:510`. Already the true one-tap
  logger: takes `{name, data:{calories,protein,carbs,fat}}`, pushes the entry,
  saves, toasts, re-renders. Tiles call this directly.
- Recent Foods engine — `js/diet.js:686-718`. Already loops `state.diet`,
  groups unique dishes per meal, and resolves per-serving macros (`f.per`) from
  `state.customFoods` / `FOOD_DATABASE` / `sharedFoods`.
- Per-meal render block — `js/diet.js:597-644`, specifically the
  `.diet-meal-addwrap` (`:636`) where tiles get injected above the "+ Add" button.
- Time-of-day logic already present — `js/diet.js:722-724`.

**Build:**
1. **Rank "usuals" per meal.** New helper `mealUsuals(meal, limit)` in `diet.js`:
   count how often each food is logged for that meal across `state.diet`, weight
   by recency (recent logs count more) so it adapts. Return top `limit` (3-5)
   with resolved `per` macros (same resolution the recent loop already does at
   `:704-714`). Frequency, not just newest-first (that's the delta vs Recent).
2. **Render tiles inline.** In each meal group's `.diet-meal-addwrap` (`:636`),
   render a small row of chips above the "+ Add" button, e.g.
   `<button class="diet-usual-tile" data-meal="..." data-usual-idx="...">Oatmeal</button>`.
   Keep it visually quiet: chip = name only (macros optional/on long-press),
   meal header keeps its calorie total. This is the "simple surface."
3. **Tile tap = log, one tap.** Handler calls
   `quickAddToMeal(meal, {name: u.name, data: u.per})`. No form, no jump. The
   existing toast + re-render already give feedback.
4. **Fallback stays.** The existing inline search (`:638-641`, `renderInlineResults`
   `:485`) becomes the "+ something else" path for anything not in your usuals.
5. **Make logged entries editable (log-first-fix-later).** The `.diet-food-entry`
   (`:622`) currently has only a delete button (`:626`). Make the row tappable to
   reveal a tiny servings stepper (− / value / +) that rescales macros using the
   same math as `updateMacrosByServings()` (`:1031`-ish) and re-saves. Keep it
   hidden until tapped so the list stays clean.

**Customizable (his ask):** because ranking is frequency-based, the tiles ARE the
customization — they follow what you actually eat. Optional stretch: let a food be
pinned/hidden per meal (reuse the `state.removedFoods` pattern at `:786-800`).

## Approaches considered

- **A — Your Usuals tiles (CHOSEN).** Effort S/M. Reuses quickAddToMeal + recent
  engine. Smallest diff, ships the pull fastest, keeps surface simple.
- **B — One unified confirm sheet (MFP-style).** Effort M/L. More consistent, fixes
  divergent add paths, but it's still a form = more taps. Fold its editable-entry
  idea into A instead.
- **C — Repeat-a-day / templates.** Effort M. Great for routine days only. Good
  fast-follow after A lands.

## Success criteria

- Logging a typical breakfast/lunch/dinner is one tap each from the Diet view.
- No typing required on a normal day.
- The Diet screen doesn't look busier than today (tiles replace, not add to, the
  visual load; search is demoted to a fallback link).
- Logged foods can be edited (servings) without deleting and re-adding.

## Distribution

Existing pipeline: push to `main` → GitHub Pages auto-deploys. Bump the `sw.js`
CACHE version on ship so the PWA updates.

## Next steps (build order)

1. `mealUsuals(meal, limit)` helper + unit-sanity in headless browser with real
   `state.diet` (stub saves).
2. Render tiles inline in `.diet-meal-addwrap`; wire tap → `quickAddToMeal`.
3. Editable logged entries (servings stepper).
4. Simplify: demote inline search to "+ something else"; verify the screen reads
   calmer at 390px.
5. Optional: pin/hide a food per meal.

## The assignment (real-world)

For the next 2 days, log food the way you do now and note the single most annoying
moment each time (the tap/type/scroll that made you sigh). That list is the real
spec — build tiles to kill those exact moments first.
