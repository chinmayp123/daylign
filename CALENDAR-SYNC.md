# Calendar sync

Your meetings show up in **Today's Schedule**, in the right hour slot, next to
your tasks. All-day events get their own row above the grid. They are
read-only — they belong to Google, so nothing in Daylign can edit or delete one.

This runs in **GitHub Actions**, not on your phone.

That is the whole point. iOS skips time-of-day Shortcut automations when the
device is locked, which is why your health sync misses about one night in four.
A cron runner does not care whether your phone is locked, flat, or in another
country. It also means the sync runs **hourly**, so a meeting added at 10am
appears by 11 — rather than waiting for tomorrow.

---

## Setup — about five minutes, all in the browser

### 1. Get the secret address from Google Calendar

1. Google Calendar on desktop → **⚙ Settings**
2. Left sidebar → under *Settings for my calendars*, pick the calendar you want
3. Scroll to **Integrate calendar**
4. Copy **Secret address in iCal format** (the one ending `/basic.ics`)

Repeat for each calendar you want included.

> **Treat this like a password.** Anyone holding it can read that calendar,
> with no login. Do not paste it into chat, a commit, or an issue — it goes
> straight into GitHub Secrets below. If it ever leaks, the same page has a
> **Reset** button that invalidates the old one.

### 2. Put it in GitHub Secrets

1. Your repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `ICS_URLS`
4. Value: the URL. For several calendars, **one per line**.
5. **Add secret**

### 3. Set your timezone (skip if you're US Eastern)

Same page, **Variables** tab → **New repository variable**

- Name: `DAYLIGN_TZ`
- Value: your IANA zone — `America/New_York`, `America/Chicago`,
  `America/Los_Angeles`, `Europe/London`, `Asia/Kolkata`…

Defaults to `America/New_York`. Wrong zone means meetings land in the wrong
hour slot, so it is worth a moment.

### 4. Test it

Repo → **Actions** → **Calendar sync** → **Run workflow**. Tick
**dry run** the first time — it prints what it found and writes nothing.

The log should list your week. Then run it again with dry run **off**, open the
app, pull down to refresh, and today's meetings appear in the schedule. Use the
`<` `>` arrows on the Schedule card to page through the rest of the week.

After that it runs itself, hourly.

---

## What it handles

Tested against a feed containing all of these:

- **Recurring meetings** — `DAILY` / `WEEKLY` / `MONTHLY` / `YEARLY`, with
  `INTERVAL`, `COUNT`, `UNTIL` and `BYDAY`. A Mon–Fri standup correctly expands
  across weekdays and skips the weekend.
- **Cancelled occurrences** — `EXDATE` removes a single instance from a series,
  so a skipped 1:1 does not appear.
- **Cancelled events** — anything with `STATUS:CANCELLED` is dropped.
- **All-day events** — no clock time, pinned to their own row.
- **Timezones** — `TZID` and UTC (`Z`) both convert to your wall clock. A
  19:00 UTC meeting reads 15:00 in New York.
- **Folded lines** — long titles that the exporter split across two physical
  lines are rejoined.
- **Duplicates** — the same meeting on two calendars appears once.
- **Old events** — anything before today is ignored.

Each run **replaces** the whole list, so cancelled and past meetings drop off by
themselves.

### What it does not handle

- Exotic recurrence (`BYSETPOS`, `BYMONTHDAY` lists). These fall back to the
  single base occurrence — the rule under-reports rather than inventing
  meetings that do not exist.
- `RECURRENCE-ID` overrides, where one instance of a series was moved to a
  different time. It will show at the original time.

Neither is common in a personal calendar. Both are fixable if you hit one.

---

## Troubleshooting

**Workflow fails with "Feed responded 404"** — the secret address was reset or
mistyped. Copy it again from Google Calendar.

**Log shows 0 events** — the feed is reachable but empty in the next 7 days.
Check you copied the right calendar; the default "Holidays" calendar is a
common mix-up.

**Meetings appear in the wrong hour** — `DAYLIGN_TZ` is wrong or unset.

**Nothing in the app but the log looks right** — pull down to refresh. Failing
that, check the data directly:
`https://lifestack-d5300-default-rtdb.firebaseio.com/external/calendar/all.json`

---

## Running it by hand

```bash
ICS_URLS="https://calendar.google.com/calendar/ical/.../basic.ics" \
FIREBASE_URL="https://lifestack-d5300-default-rtdb.firebaseio.com" \
DAYLIGN_TZ="America/New_York" \
DRY_RUN=1 \
node tools/ics-to-daylign.mjs
```

`DRY_RUN=1` prints and writes nothing. Drop it to write for real.
