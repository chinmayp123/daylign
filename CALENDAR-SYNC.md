# Calendar sync — iPhone Shortcut

Your meetings appear in **Today's Schedule**, in the right hour slot, alongside
your tasks. Read-only: they belong to Google/iOS, so nothing in Daylign can
edit or delete one.

This uses the same trick as the health sync — a Shortcut on your phone pushes to
Firebase, and the app reads it. No Google Cloud project, no OAuth, no sign-in.
And because it reads your iPhone's calendars, it picks up **every** calendar
synced there, Google included.

**Path:** `external/calendar/all`
**Full URL:** `https://lifestack-d5300-default-rtdb.firebaseio.com/external/calendar/all.json`

---

## The shape it sends

One flat list covering the whole week:

```json
[
  { "date": "2026-08-11", "title": "Standup", "start": "09:00", "end": "09:15", "location": "Zoom" },
  { "date": "2026-08-13", "title": "Board sync", "start": "15:00", "end": "16:00", "location": "Meet" }
]
```

- `date` — `yyyy-MM-dd`
- `start` / `end` — `HH:mm`, 24-hour. **Leave `start` empty for an all-day event**; it gets its own row above the hour grid.
- `location` — optional

A flat list rather than one node per day on purpose: nesting by date in
Shortcuts means fighting *Set Dictionary Value* with a computed key. One
Repeat and one PUT is much less to go wrong. Grouping happens in the app.

Each run **replaces** the whole list, so cancelled and past meetings drop off
by themselves.

---

## Building it

New Shortcut, name it **Sync Calendar To Daylign**. Add these in order.

**1. Find Calendar Events**
- Add *Find Calendar Events Where*
- Filter: **Start Date** — **is in the next** — **7** — **days**
- Tap *Sort by* → **Start Date**, Order **Oldest First**
- Leave the calendar filter off so it takes all of them

**2. Make a list to collect into**
- Add *Text*, leave it completely empty
- Add *Set Variable* → name it **Events**

**3. Loop the events**
- Add *Repeat with Each* (input: the events from step 1)

Inside the loop:

**3a.** *Format Date* → Date: **Repeat Item**, Format: **Custom**, string `yyyy-MM-dd`
  → *Set Variable* → **DayKey**

**3b.** *Format Date* → Date: **Repeat Item**, Format: **Custom**, string `HH:mm`
  → *Set Variable* → **StartTime`**

**3c.** *Get Details of Calendar Event* → **End Date** (from Repeat Item)
  → *Format Date* → Custom → `HH:mm` → *Set Variable* → **EndTime**

**3d.** *Get Details of Calendar Event* → **Is All Day** → *If* it is **true**
  → *Set Variable* **StartTime** to an empty *Text*
  (an all-day event has no meaningful clock time)

**3e.** *Dictionary* with five rows:

| Key | Value |
|---|---|
| `date` | DayKey |
| `title` | *Get Details of Calendar Event* → **Title** |
| `start` | StartTime |
| `end` | EndTime |
| `location` | *Get Details of Calendar Event* → **Location** |

**3f.** *Add to Variable* → **Events**

**4. Send it**
- After the loop: *Get Contents of URL*
- URL: `https://lifestack-d5300-default-rtdb.firebaseio.com/external/calendar/all.json`
- Method: **PUT**
- Request Body: **JSON**
- Body: the **Events** variable

**5. Automate it**
- Shortcuts → *Automation* → *Time of Day*
- **7:00 or 8:00am**, Daily, **Run Immediately**, Notify When Run **off**

Morning rather than 9pm: today's meetings should be there when you look at the
app over breakfast. Note your health automation misses roughly one night in
four because iOS skips these when the phone is locked — same caveat here, and
the same reason an earlier slot tends to fire more reliably.

---

## Checking it worked

Run it once by hand, then open this in any browser:

`https://lifestack-d5300-default-rtdb.firebaseio.com/external/calendar/all.json`

You should see your week. In the app, pull down to refresh, and today's
meetings appear in the schedule. Use the `<` `>` arrows on the Schedule card to
page through the rest of the week.

**If the schedule is empty but the URL shows data,** the likely cause is a date
format mismatch — `date` must be exactly `yyyy-MM-dd` and `start` exactly
`HH:mm`. Shortcuts defaults to a localised format, so both *Format Date* actions
must be set to **Custom**.
