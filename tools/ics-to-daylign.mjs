// Fetch one or more secret iCal feeds, flatten the next N days of events, and
// PUT them to Firebase for Daylign to read.
//
// Runs in GitHub Actions, not on the phone. That is the whole point: iOS skips
// time-of-day automations when the device is locked, which was costing roughly
// one night in four on the health sync. A cron runner has no such problem.
//
// Zero dependencies — Node 20 has fetch, and an ICS parser good enough for real
// calendars is a few hundred lines. Pulling in a library would mean a
// package.json and a lockfile in a repo that deliberately has neither.
//
// Env:
//   ICS_URLS      newline- or comma-separated secret iCal URLs   (required)
//   FIREBASE_URL  database root, no trailing slash               (required)
//   DAYLIGN_TZ    IANA zone for wall-clock output                (default America/New_York)
//   DAYS_AHEAD    how far to look                                (default 7)
//   DRY_RUN       set to 1 to print instead of writing

const ICS_URLS = (process.env.ICS_URLS || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
const FIREBASE_URL = (process.env.FIREBASE_URL || '').replace(/\/$/, '');
const TZ = process.env.DAYLIGN_TZ || 'America/New_York';
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD || 7);
const DRY_RUN = process.env.DRY_RUN === '1';

// ---------- ICS lexing ----------

// RFC 5545 folds long lines with CRLF + a single space or tab. Unfold before
// anything else or a SUMMARY can be cut in half mid-word.
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function splitEvents(text) {
  const out = [];
  const re = /BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

// "DTSTART;TZID=America/New_York:20260811T090000" -> params + value
function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const name = parts[0].toUpperCase();
  const params = {};
  parts.slice(1).forEach(p => {
    const eq = p.indexOf('=');
    if (eq > -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  });
  return { name, params, value };
}

function fieldsOf(block) {
  const map = {};
  block.split('\n').forEach(line => {
    if (!line.trim()) return;
    const p = parseLine(line);
    if (!p) return;
    // EXDATE and RDATE legitimately repeat; everything else takes the first.
    if (p.name === 'EXDATE' || p.name === 'RDATE') (map[p.name] = map[p.name] || []).push(p);
    else if (!(p.name in map)) map[p.name] = p;
  });
  return map;
}

// ---------- time ----------

// An ICS timestamp is one of:
//   20260811          all-day (VALUE=DATE)
//   20260811T090000Z  UTC
//   20260811T090000   floating, or in the zone named by TZID
// Everything becomes a real instant plus an allDay flag; wall-clock formatting
// happens later, once, in the display zone.
function parseStamp(field) {
  if (!field) return null;
  const v = field.value.trim();
  const isDate = field.params.VALUE === 'DATE' || /^\d{8}$/.test(v);
  if (isDate) {
    const y = +v.slice(0, 4), mo = +v.slice(4, 6), d = +v.slice(6, 8);
    return { allDay: true, date: `${pad4(y)}-${pad(mo)}-${pad(d)}`, ms: Date.UTC(y, mo - 1, d) };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return { allDay: false, ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) };
  const zone = field.params.TZID || TZ;
  return { allDay: false, ms: wallTimeToUtc(+y, +mo, +d, +h, +mi, +s, zone) };
}

// Convert a wall-clock reading in `zone` to a UTC instant, without a tz library.
// Guess that the wall time is UTC, see how `zone` renders that instant, and
// correct by the difference. Two passes settle DST boundaries.
function wallTimeToUtc(y, mo, d, h, mi, s, zone) {
  let guess = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let i = 0; i < 2; i++) {
    const shown = zonedParts(guess, zone);
    const diff = Date.UTC(shown.y, shown.mo - 1, shown.d, shown.h, shown.mi, shown.s)
               - Date.UTC(y, mo - 1, d, h, mi, s);
    if (diff === 0) break;
    guess -= diff;
  }
  return guess;
}

function zonedParts(ms, zone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  fmt.formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  // Intl renders midnight as 24 in some engines.
  const hour = p.hour === '24' ? '00' : p.hour;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +hour, mi: +p.minute, s: +p.second };
}

const pad = n => String(n).padStart(2, '0');
const pad4 = n => String(n).padStart(4, '0');

function localDateStr(ms) {
  const p = zonedParts(ms, TZ);
  return `${pad4(p.y)}-${pad(p.mo)}-${pad(p.d)}`;
}
function localTimeStr(ms) {
  const p = zonedParts(ms, TZ);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

// ---------- recurrence ----------

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function parseRule(value) {
  const r = {};
  value.split(';').forEach(part => {
    const [k, v] = part.split('=');
    if (k) r[k.toUpperCase()] = v;
  });
  return r;
}

// Expand a recurring event across [windowStart, windowEnd].
// Covers DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, COUNT, UNTIL and
// BYDAY — which is what real calendars actually contain. Anything more exotic
// (BYSETPOS, BYMONTHDAY lists) falls back to the single base occurrence rather
// than guessing, so a weird rule under-reports instead of inventing meetings.
function expand(startMs, rule, windowStart, windowEnd, exdates) {
  if (!rule) return [startMs];
  const r = parseRule(rule);
  const freq = (r.FREQ || '').toUpperCase();
  const interval = Math.max(1, Number(r.INTERVAL || 1));
  const count = r.COUNT ? Number(r.COUNT) : null;
  const until = r.UNTIL ? (parseStamp({ value: r.UNTIL, params: {} }) || {}).ms : null;
  const byDay = r.BYDAY ? r.BYDAY.split(',').map(s => s.trim().slice(-2).toUpperCase()) : null;
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return [startMs];

  const out = [];
  const base = new Date(startMs);
  const hardStop = windowEnd + 86400000;
  let emitted = 0;

  // Step from the original start so INTERVAL stays aligned to the real series.
  for (let i = 0; i < 2000; i++) {
    let ms;
    if (freq === 'DAILY') ms = startMs + i * interval * 86400000;
    else if (freq === 'WEEKLY') ms = startMs + i * interval * 7 * 86400000;
    else {
      const d = new Date(startMs);
      if (freq === 'MONTHLY') d.setUTCMonth(d.getUTCMonth() + i * interval);
      else d.setUTCFullYear(d.getUTCFullYear() + i * interval);
      ms = d.getTime();
    }
    if (until && ms > until) break;
    if (ms > hardStop) break;

    if (freq === 'WEEKLY' && byDay) {
      // A weekly rule with BYDAY repeats within each week it touches.
      const weekStart = ms - ((new Date(ms).getUTCDay() - base.getUTCDay() + 7) % 7) * 86400000;
      byDay.forEach(code => {
        const target = DAY_CODES.indexOf(code);
        if (target < 0) return;
        const delta = (target - new Date(weekStart).getUTCDay() + 7) % 7;
        const occ = weekStart + delta * 86400000;
        if (occ < startMs) return;
        if (until && occ > until) return;
        if (occ >= windowStart && occ <= hardStop) out.push(occ);
      });
    } else if (ms >= windowStart) {
      out.push(ms);
    }
    emitted++;
    if (count && emitted >= count) break;
  }

  const skip = new Set(exdates);
  return [...new Set(out)].filter(ms => !skip.has(ms)).sort((a, b) => a - b);
}

// ---------- main ----------

function eventsFromIcs(text, windowStart, windowEnd, todayStr) {
  const events = [];
  for (const block of splitEvents(unfold(text))) {
    const f = fieldsOf(block);
    if (!f.DTSTART) continue;
    if (f.STATUS && f.STATUS.value.toUpperCase() === 'CANCELLED') continue;

    const start = parseStamp(f.DTSTART);
    if (!start) continue;
    const end = parseStamp(f.DTEND);
    const durationMs = end && !start.allDay ? end.ms - start.ms : 0;

    const exdates = (f.EXDATE || []).flatMap(p =>
      p.value.split(',').map(v => (parseStamp({ value: v.trim(), params: p.params }) || {}).ms)
    ).filter(Boolean);

    const occurrences = expand(start.ms, f.RRULE && f.RRULE.value, windowStart, windowEnd, exdates);
    for (const ms of occurrences) {
      if (ms > windowEnd + 86400000) continue;
      const date = start.allDay ? localDateStrUTC(ms) : localDateStr(ms);
      // Clamp against TODAY, not windowStart. windowStart is deliberately a day
      // early so an event sitting near a timezone edge still gets considered,
      // but that slack must not leak yesterday's meetings into the feed.
      if (date < todayStr || date > localDateStr(windowEnd)) continue;
      events.push({
        date,
        title: (f.SUMMARY ? f.SUMMARY.value : 'Untitled').replace(/\\,/g, ',').replace(/\\n/g, ' ').trim(),
        start: start.allDay ? '' : localTimeStr(ms),
        end: start.allDay || !durationMs ? '' : localTimeStr(ms + durationMs),
        location: (f.LOCATION ? f.LOCATION.value : '').replace(/\\,/g, ',').trim(),
      });
    }
  }
  return events;
}

// All-day values carry no zone; shifting them into TZ would drag them a day
// backwards for anyone west of UTC.
function localDateStrUTC(ms) {
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function main() {
  if (!ICS_URLS.length) throw new Error('ICS_URLS is empty — add the secret iCal address(es) to repo secrets.');
  if (!FIREBASE_URL) throw new Error('FIREBASE_URL is not set.');

  const now = Date.now();
  const todayStr = localDateStr(now);
  const windowStart = Date.parse(todayStr + 'T00:00:00Z') - 86400000; // a day of slack for zone edges
  const windowEnd = now + DAYS_AHEAD * 86400000;

  const all = [];
  for (const url of ICS_URLS) {
    const res = await fetch(url, { headers: { 'User-Agent': 'daylign-calendar-sync' } });
    if (!res.ok) throw new Error(`Feed responded ${res.status} ${res.statusText}`); // never half-write
    all.push(...eventsFromIcs(await res.text(), windowStart, windowEnd, todayStr));
  }

  // Stable order, and drop exact duplicates (the same meeting on two calendars).
  const seen = new Set();
  const events = all
    .filter(e => {
      const k = `${e.date}|${e.start}|${e.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  console.log(`${events.length} events across ${DAYS_AHEAD} days from ${ICS_URLS.length} feed(s), zone ${TZ}`);
  for (const e of events.slice(0, 12)) console.log(`  ${e.date} ${e.start || 'all-day'} ${e.title}`);
  if (events.length > 12) console.log(`  … and ${events.length - 12} more`);

  if (DRY_RUN) { console.log('DRY_RUN — nothing written'); return; }

  const target = `${FIREBASE_URL}/external/calendar/all.json`;
  const put = await fetch(target, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(events),
  });
  if (!put.ok) throw new Error(`Firebase PUT failed: ${put.status} ${await put.text()}`);
  console.log('written to external/calendar/all');
}

main().catch(err => { console.error(err.message); process.exit(1); });
