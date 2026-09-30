// ========== The line (v3, spec 4.3) ==========
// One vertical time spine for the day: sleep, habits, meals, water, cardio,
// events, workouts and timed tasks, in clock order, with a "now" marker.
// Replaces Today's Scheduled lane, the schedule card, the reminders list and
// the daily-ride pill.
//
// Reads state and writes nothing. The Done / Log it buttons call the same
// handlers the old surfaces used, so logging still happens on a real click.
// Reused later by Calendar and Diet, so it takes a date and returns markup.

// Default clock positions for things that have no timestamp of their own.
const LINE_SLOT = {
  breakfast: 8 * 60, lunch: 12 * 60 + 30, snack: 16 * 60, dinner: 19 * 60 + 30,
  brush_am: 7 * 60, morning: 7 * 60 + 5, brush_pm: 21 * 60 + 30,
  cardio: 7 * 60 + 30, workout: 18 * 60 + 30,
};

function lineMinutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function lineClock(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h + ':' + String(m).padStart(2, '0');
}

// Entries gained an `at` (epoch ms) in v3; everything logged before that has
// only a date. Falling back to the slot time keeps old days readable instead
// of stacking them all at midnight.
function lineMinutesFrom(at, fallbackMin) {
  if (at) {
    const d = new Date(Number(at));
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  return fallbackMin;
}

// Habit keys used to hold '1'. They hold a timestamp now, and both are read:
// a '1' means done but at an unknown time, so it takes its default slot.
function habitState(key, dateStr) {
  let raw = null;
  try { raw = localStorage.getItem('tf_' + key + '_' + dateStr); } catch (e) { raw = null; }
  if (!raw) return { done: false, min: LINE_SLOT[key] };
  const n = Number(raw);
  if (raw === '1' || !isFinite(n) || n <= 1) return { done: true, min: LINE_SLOT[key] };
  return { done: true, min: lineMinutesFrom(n, LINE_SLOT[key]) };
}

// ---------- which day the line is showing (spec 4.1) ----------
// null means today, so an app left open across midnight rolls over on its own.
// Session-only on purpose: it is where you are looking, not a setting. This is
// what the v2 schedule card's < Today > buttons became.
let lineViewDate = null;

function lineShiftDay(n) {
  const today = getTodayStr();
  const next = n === 0 ? today : offsetDateStr(lineViewDate || today, n);
  lineViewDate = next === today ? null : next;
  if (typeof render === 'function') render();
  if (typeof setHeaderDate === 'function') setHeaderDate();
}

function lineResetDay() { lineViewDate = null; }

function lineDayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function lineItemsFor(dateStr) {
  const items = [];
  const isToday = dateStr === getTodayStr();
  const push = (o) => { if (o) items.push(o); };

  // ---- last night's sleep: always first, before any clock time ----
  const sleepH = (typeof sleepHoursFor === 'function') ? sleepHoursFor(dateStr) : null;
  if (sleepH !== null && sleepH !== undefined) {
    const bed = (typeof sleepBedtimeFor === 'function') ? sleepBedtimeFor(dateStr) : null;
    push({ sort: -1, time: bed || 'last night', c: 'sleep', icon: 'bedtime',
           title: 'Sleep', sub: bed ? 'from ' + bed : 'last night',
           val: sleepH + 'h', past: true, tap: 'sleep' });
  }

  // ---- habits ----
  [['brush_am', 'Brush AM', 'dentistry'], ['morning', 'Morning routine', 'wb_sunny'],
   ['brush_pm', 'Brush PM', 'dentistry']].forEach(([key, label, icon]) => {
    const h = habitState(key, dateStr);
    push({ sort: h.min, time: lineClock(h.min), c: 'habit', icon,
           title: label, sub: key === 'morning' ? 'push ups, sit ups' : '',
           val: h.done ? 'done' : '', past: h.done,
           action: (!h.done && isToday) ? `<button type="button" class="dl-line-btn" data-line-habit="${key}">Done</button>` : '' });
  });

  // ---- meals ----
  const meals = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  Object.keys(meals).forEach(meal => {
    const entries = (state.diet || []).filter(e => e.date === dateStr && e.meal === meal);
    const kcal = Math.round(entries.reduce((s, e) => s + (e.calories || 0), 0));
    const at = entries.reduce((a, e) => (e.at && (!a || e.at < a) ? e.at : a), null);
    const min = lineMinutesFrom(at, LINE_SLOT[meal]);
    push({ sort: min, time: lineClock(min), c: 'food', icon: 'restaurant',
           title: meals[meal],
           sub: entries.length ? entries.map(e => e.food).filter(Boolean).slice(0, 3).join(', ') : 'nothing logged yet',
           val: entries.length ? String(kcal) : '', past: entries.length > 0,
           tap: 'meal:' + meal });
  });

  // ---- water: one aggregated row at the last add ----
  const w = (state.water || {})[dateStr] || [];
  if (w.length) {
    const atList = ((state.waterAt || {})[dateStr]) || [];
    const lastAt = atList.length ? atList[atList.length - 1] : null;
    const min = lineMinutesFrom(lastAt, 14 * 60);
    const total = w.reduce((s, v) => s + v, 0);
    push({ sort: min, time: lineClock(min), c: 'water', icon: 'water_drop',
           title: 'Water', sub: w.length + (w.length === 1 ? ' add' : ' adds'),
           val: total + ' oz', past: true, tap: 'water' });
  }

  // ---- cardio ----
  const rides = (state.cardio || []).filter(e => e.date === dateStr);
  if (rides.length) {
    rides.forEach(rd => {
      const min = lineMinutesFrom(rd.at, LINE_SLOT.cardio);
      push({ sort: min, time: lineClock(min), c: 'move', icon: 'directions_run',
             title: rd.type ? rd.type[0].toUpperCase() + rd.type.slice(1) : 'Cardio',
             sub: rd.minutes ? rd.minutes + ' min' : '',
             val: rd.distance ? rd.distance + ' mi' : '', past: true, tap: 'training' });
    });
  } else if (isToday) {
    push({ sort: LINE_SLOT.cardio, time: lineClock(LINE_SLOT.cardio), c: 'move',
           icon: 'directions_run', title: 'Usual ride', sub: 'not logged yet', val: '',
           action: '<button type="button" class="dl-line-btn" data-line-cardio>Log it</button>' });
  }

  // ---- logged workout ----
  const gym = (state.gym || []).filter(e => e.date === dateStr);
  if (gym.length) {
    const sets = gym.reduce((s, e) => s + ((e.sets && e.sets.length) || 0), 0);
    const full = (typeof isFullSession === 'function') ? isFullSession(dateStr) : sets >= 4;
    const at = gym.reduce((a, e) => (e.at && (!a || e.at < a) ? e.at : a), null);
    const min = lineMinutesFrom(at, LINE_SLOT.workout);
    push({ sort: min, time: lineClock(min), c: 'move', icon: 'fitness_center',
           title: full ? 'Workout' : 'Check-in',
           sub: gym.map(e => e.exercise).filter(Boolean).slice(0, 3).join(', '),
           val: sets + (sets === 1 ? ' set' : ' sets'), past: true, tap: 'training' });
  } else if (isToday) {
    push({ sort: LINE_SLOT.workout, time: lineClock(LINE_SLOT.workout), c: 'move',
           icon: 'fitness_center', title: 'Workout', sub: 'planned by the coach', val: '',
           card: true, tap: 'training' });
  }

  // ---- calendar events, own and mirrored ----
  (state.events || []).filter(e => e.date === dateStr).forEach(ev => {
    const m = String(ev.time || '').match(/(\d{1,2}):(\d{2})/);
    const min = m ? Number(m[1]) * 60 + Number(m[2]) : 9 * 60;
    push({ sort: min, time: lineClock(min), c: 'meet', icon: 'event',
           title: ev.name || 'Event', sub: ev.location || '', val: '',
           past: isToday && min <= lineMinutesNow(), tap: 'calendar' });
  });
  if (typeof getExternalCalendar === 'function') {
    getExternalCalendar(dateStr).forEach(ev => {
      const m = String(ev.start || '').match(/(\d{1,2}):(\d{2})/);
      const min = m ? Number(m[1]) * 60 + Number(m[2]) : 9 * 60;
      push({ sort: min, time: lineClock(min), c: 'meet', icon: 'groups',
             title: ev.title, sub: ev.location || 'from your calendar', val: '',
             past: isToday && min <= lineMinutesNow(), tap: 'calendar' });
    });
  }

  // ---- tasks that carry a time ----
  // taskClockTime() (js/today.js) also reads the existing `scheduledHour`, which
  // is what the task form actually writes. Without it every task the v2 Schedule
  // lane held would have vanished from the app: not in the tray (it has a time)
  // and not on the line (it has no `time`).
  const clockOf = (t) => (typeof taskClockTime === 'function' ? taskClockTime(t) : t.time);
  (state.tasks || []).filter(t => t && t.dueDate === dateStr && clockOf(t)).forEach(t => {
    const m = String(clockOf(t)).match(/(\d{1,2}):(\d{2})/);
    if (!m) return;
    const min = Number(m[1]) * 60 + Number(m[2]);
    const cat = (state.categories || []).find(c => c.id === t.category);
    push({ sort: min, time: lineClock(min), c: (cat && cat.color) || '', icon: 'check_circle',
           title: t.name, sub: '', val: (typeof taskEstimateText === 'function' ? taskEstimateText(t) : ''),
           past: t.status === 'done', card: t.priority === 'high', tap: 'task:' + t.id });
  });

  return items.sort((a, b) => a.sort - b.sort);
}

function renderLine(dateStr) {
  const host = document.getElementById('dayLine');
  if (!host) return;
  const date = dateStr || (typeof dietViewDate !== 'undefined' && dietViewDate) || getTodayStr();
  const isToday = date === getTodayStr();
  const items = lineItemsFor(date);

  if (!items.length) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;

  const now = lineMinutesNow();
  // Where the spine changes from the day's colours to plain ink. Off the end
  // on a past day so the whole spine reads as done.
  let cut = date > getTodayStr() ? 0 : 100;   // a day that has not happened is all ink
  if (isToday) {
    const first = items[0].sort < 0 ? 0 : items[0].sort;
    const last = items[items.length - 1].sort;
    const span = Math.max(1, last - first);
    cut = Math.max(0, Math.min(100, ((now - first) / span) * 100));
  }

  let html = '';
  let markerPlaced = !isToday;
  items.forEach(it => {
    if (!markerPlaced && it.sort > now) {
      html += `<div class="dl-now" id="dlNowMarker"><span>now ${lineClock(now)}</span></div>`;
      markerPlaced = true;
    }
    const past = it.past || (isToday && it.sort <= now && it.val);
    const cls = ['dl-line-item', past ? 'past' : '', it.card ? 'card' : '', it.c ? 'c-' + it.c : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}"${it.tap ? ` data-line-tap="${esc(it.tap)}"` : ''}>
      <span class="t">${esc(it.time)}</span><span class="n"></span>
      <span class="ico"><span class="ms">${it.icon}</span></span>
      <span class="body">${esc(it.title)}${it.sub ? `<em>${esc(it.sub)}</em>` : ''}</span>
      <span class="val">${it.action || esc(it.val || '')}</span>
    </div>`;
  });
  if (!markerPlaced) html += `<div class="dl-now" id="dlNowMarker"><span>now ${lineClock(now)}</span></div>`;

  // Day stepper. Always there on desktop; on a phone you swipe the line, so it
  // only appears once you are off today - as the label for which day this is
  // and the way back.
  const dayNav = `<div class="dl-line-day${isToday ? '' : ' is-away'}">
    <button type="button" class="dl-line-day-btn" data-line-day="-1" aria-label="Previous day"><span class="ms">chevron_left</span></button>
    <b>${isToday ? 'Today' : esc(lineDayLabel(date))}</b>
    <button type="button" class="dl-line-day-btn" data-line-day="1" aria-label="Next day"><span class="ms">chevron_right</span></button>
    ${isToday ? '' : '<button type="button" class="dl-line-btn" data-line-day="0">Back to today</button>'}
  </div>`;

  host.innerHTML = dayNav + `<div class="dl-line" style="--cut:${Math.round(cut)}%">${html}</div>`;
  bindLine();
}

let lineBound = false;
function bindLine() {
  const host = document.getElementById('dayLine');
  if (!host || lineBound) return;   // persistent container: bind once
  lineBound = true;

  // Swipe the line sideways to change day. Horizontal has to clearly win over
  // vertical, or every slightly diagonal scroll would turn the page.
  let sx = 0, sy = 0, st = 0;
  host.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { st = 0; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  host.addEventListener('touchend', (e) => {
    if (!st) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const quick = Date.now() - st < 600;
    st = 0;
    if (!quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    lineShiftDay(dx < 0 ? 1 : -1);
  }, { passive: true });

  host.addEventListener('click', (e) => {
    const day = e.target.closest('[data-line-day]');
    if (day) { lineShiftDay(Number(day.dataset.lineDay)); return; }
    const habit = e.target.closest('[data-line-habit]');
    if (habit) {
      const key = habit.dataset.lineHabit;
      // Store the timestamp, not a flag, so the row lands at the real time.
      try { localStorage.setItem('tf_' + key + '_' + getTodayStr(), String(Date.now())); } catch (err) {}
      if (key === 'morning' && typeof logMorningRoutine === 'function') logMorningRoutine();
      if (typeof render === 'function') render();
      return;
    }
    if (e.target.closest('[data-line-cardio]')) {
      const btn = document.querySelector('#todayCardio button, [data-log-usual-cardio]');
      if (btn) btn.click();
      return;
    }
    const row = e.target.closest('[data-line-tap]');
    if (!row) return;
    const tap = row.dataset.lineTap;
    if (tap === 'sleep') { switchView('training'); if (typeof setTrainingTab === 'function') setTrainingTab('coach'); }
    else if (tap === 'water' || tap.startsWith('meal:')) switchView('diet');
    else if (tap === 'training') switchView('training');
    else if (tap === 'calendar') switchView('calendar');
    else if (tap.startsWith('task:')) {
      // openTaskView arrives with the task sheet (phase 4); until then the
      // task form is the only thing that can open a task, and a row that does
      // nothing when tapped is worse than the old form.
      if (typeof openTaskView === 'function') openTaskView(tap.slice(5));
      else if (typeof openModal === 'function') openModal(tap.slice(5));
    }
  });
}

// Put "now" in the upper third rather than at the very top: the next thing you
// are going to do matters more than what you already did.
function scrollLineToNow() {
  const marker = document.getElementById('dlNowMarker');
  if (!marker) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = window.scrollY + marker.getBoundingClientRect().top - (window.innerHeight / 3);
  window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
}
