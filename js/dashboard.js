// ========== Dashboard ==========
// How the weigh-ins are actually going. Reads from the FIRST entry rather than
// the previous one: day-to-day weight is mostly water and says nothing, while
// "down 2.5 lbs since Jul 14" is the fact that keeps someone logging.
function weightTrendNote(weighIns, goalW) {
  if (!weighIns.length) return 'Tap to log your first';
  const val = e => (e && typeof e[1] === 'object') ? Number(e[1].lbs) : Number(e[1]);
  const latest = val(weighIns[weighIns.length - 1]);
  if (weighIns.length < 2) return `${Math.round(Math.abs(latest - goalW) * 10) / 10} lbs to go`;
  const first = val(weighIns[0]);
  const delta = Math.round((latest - first) * 10) / 10;
  const since = formatDate(weighIns[0][0]);
  const togo = Math.round(Math.abs(latest - goalW) * 10) / 10;
  if (delta === 0) return `Level since ${since} · ${togo} to go`;
  const dir = delta < 0 ? 'Down' : 'Up';
  return `${dir} ${Math.abs(delta)} lbs since ${since} · ${togo} to go`;
}

// Losing weight is the goal, so DOWN is the good direction here — the opposite
// of every other tile.
function weightTrendClass(weighIns) {
  if (weighIns.length < 2) return '';
  const val = e => (e && typeof e[1] === 'object') ? Number(e[1].lbs) : Number(e[1]);
  const delta = val(weighIns[weighIns.length - 1]) - val(weighIns[0]);
  if (Math.abs(delta) < 0.05) return '';
  return delta < 0 ? 'is-good' : 'is-bad';
}

// The morning routine auto-logs one set each of push ups and sit ups. Pulled
// out of the reminder button so the line's Done button runs the SAME code -
// two copies would have drifted, and this one writes to state.gym.
function logMorningRoutine(dateStr) {
  const day = dateStr || getTodayStr();
  const already = state.gym.some(e => e.date === day && e.exercise === 'Push Ups' && e._fromReminder);
  if (already) return;
  state.gym.push({ date: day, exercise: 'Push Ups', sets: [{ reps: 10, weight: 0 }], bodyweight: true, _fromReminder: true, at: Date.now() });
  state.gym.push({ date: day, exercise: 'Sit Ups',  sets: [{ reps: 10, weight: 0 }], bodyweight: true, _fromReminder: true, at: Date.now() });
  saveData(state);
}

// Today's health at a glance — the numbers that matter on a cut
function renderWeightTrend() {
  const host = $('#weightTrendChart');
  if (!host) return;
  const goalW = (typeof getGoals === 'function' && getGoals().weight) || 150;
  const entries = Object.entries(state.weight || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-60); // last 60 weigh-ins is plenty for a trend

  if (entries.length < 2) {
    $('#weightTrendMeta').textContent = `Goal: ${goalW} lbs`;
    host.innerHTML = `<div class="empty-state"><p>${entries.length === 1
      ? `First weigh-in logged (${entries[0][1]} lbs) — one more and the trend line appears`
      : 'Log weigh-ins in the Gym tab and your trend appears here'}</p></div>`;
    return;
  }

  const first = entries[0][1];
  const latest = entries[entries.length - 1][1];
  const change = Math.round((latest - first) * 10) / 10;
  const losing = latest > goalW;
  const changeGood = losing ? change <= 0 : change >= 0;
  $('#weightTrendMeta').innerHTML =
    `<span class="weight-delta ${changeGood ? 'good' : 'bad'}">${change > 0 ? '▲' : change < 0 ? '▼' : '—'} ${Math.abs(change)} lbs</span>
     <span class="weight-trend-goal">goal ${goalW} lbs</span>`;

  const W = 640, H = 170, PX = 34, PY = 16;
  const times = entries.map(([d]) => new Date(d + 'T00:00:00').getTime());
  const weights = entries.map(([, w]) => w);
  const tMin = times[0], tMax = times[times.length - 1];
  const yMin = Math.min(...weights, goalW) - 2;
  const yMax = Math.max(...weights, goalW) + 2;
  const x = (t) => PX + ((t - tMin) / (tMax - tMin || 1)) * (W - PX * 2);
  const y = (w) => H - PY - ((w - yMin) / (yMax - yMin || 1)) * (H - PY * 2);

  const pts = entries.map(([d, w], i) => `${Math.round(x(times[i]) * 10) / 10},${Math.round(y(w) * 10) / 10}`);
  const areaPts = `${PX},${H - PY} ${pts.join(' ')} ${Math.round(x(tMax))},${H - PY}`;
  const goalY = Math.round(y(goalW) * 10) / 10;
  const fmtD = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="weight-trend-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(109,106,248,0.25)"/>
          <stop offset="1" stop-color="rgba(109,106,248,0)"/>
        </linearGradient>
      </defs>
      <line x1="${PX}" y1="${goalY}" x2="${W - PX}" y2="${goalY}" stroke="var(--purple)" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.7"/>
      <text x="${W - PX + 4}" y="${goalY + 3.5}" fill="var(--purple)" font-size="10">${goalW}</text>
      <polygon points="${areaPts}" fill="url(#wtFill)"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="100" class="weight-spark-line"/>
      ${entries.map(([, w], i) => `<circle cx="${Math.round(x(times[i]) * 10) / 10}" cy="${Math.round(y(w) * 10) / 10}" r="3" fill="var(--accent-hover)"><title>${w} lbs</title></circle>`).join('')}
    </svg>
    <div class="weight-trend-axis">
      <span>${fmtD(tMin)} · ${first} lbs</span>
      <span>${fmtD(tMax)} · ${latest} lbs</span>
    </div>`;
}

// Weekly Report — trailing 7-day averages vs goals, plus one focus for the week
function renderWeeklyReport() {
  const host = $('#weeklyReport');
  if (!host) return;
  const g = (typeof getGoals === 'function') ? getGoals() : { calories: 2000, protein: 150, water: 66, weight: 155 };
  const meta = $('#weeklyReportMeta');
  // "last 7 days" read as "including today", which is what the Month card
  // below actually does - so with two logged days the two cards sat on screen
  // saying 105 avg and 1338 avg about what looked like the same week. The diet
  // rows run to YESTERDAY (see the window below); say so.
  if (meta) meta.textContent = '7 days to yesterday';

  // Trailing 7 days: today back through 6 days ago
  const days = [];
  const todayDate = new Date(getTodayStr() + 'T00:00:00');
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    days.push(toLocalDateStr(d));
  }

  // Diet: averages over the last 7 COMPLETED days — today excluded.
  //
  // Today is a partial day. Averaging 22g-of-a-planned-150g into a DAILY
  // average drags it down purely because it is 11am, and the number then
  // disagrees with the daily brief, which excludes today for this reason.
  // Both surfaces were on screen at once saying 73g and 85g about the same
  // week — the sort of contradiction that makes people stop trusting all of it.
  //
  // Deliberately its own window rather than `days` minus today: that would
  // leave six days against the brief's seven, which was still a mismatch
  // (81g vs 85g) — closer, and therefore harder to spot. Counts of sessions
  // and tasks keep using `days`, which does include today, because a workout
  // you finished this morning should show up in this week's tally.
  const dietWindow = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    dietWindow.push(toLocalDateStr(d));
  }
  const diet = state.diet || [];
  let dietDays = 0, calSum = 0, proteinSum = 0, carbSum = 0, fatSum = 0;
  dietWindow.forEach(day => {
    const entries = diet.filter(e => e.date === day);
    if (!entries.length) return;
    dietDays++;
    calSum += entries.reduce((s, e) => s + (e.calories || 0), 0);
    proteinSum += entries.reduce((s, e) => s + (e.protein || 0), 0);
    carbSum += entries.reduce((s, e) => s + (e.carbs || 0), 0);
    fatSum += entries.reduce((s, e) => s + (e.fat || 0), 0);
  });
  const avgCal = dietDays ? Math.round(calSum / dietDays) : 0;
  const avgProtein = dietDays ? Math.round(proteinSum / dietDays) : 0;
  const avgCarbs = dietDays ? Math.round(carbSum / dietDays) : 0;
  const avgFat = dietDays ? Math.round(fatSum / dietDays) : 0;

  // Training: days with any gym entry, plus total sets
  const gym = state.gym || [];
  let daysTrained = 0, totalSets = 0;
  days.forEach(day => {
    const entries = gym.filter(e => e.date === day);
    if (entries.length) daysTrained++;
    totalSets += entries.reduce((s, e) => s + ((e.sets && e.sets.length) || 0), 0);
  });

  // Water: average of daily totals over days with entries
  const waterLog = state.water || {};
  let waterDays = 0, waterSum = 0;
  days.forEach(day => {
    const entries = waterLog[day];
    if (!entries || !entries.length) return;
    waterDays++;
    waterSum += entries.reduce((s, v) => s + v, 0);
  });
  const avgWater = waterDays ? Math.round(waterSum / waterDays) : 0;

  // Resting heart rate: Apple Watch metric, averaged over days with data.
  // A falling resting HR is one of the cleanest signs conditioning is improving.
  let hrDays = 0, hrSum = 0;
  if (typeof getExternalRestingHR === 'function') {
    days.forEach(day => {
      const hr = getExternalRestingHR(day);
      if (hr !== null) { hrDays++; hrSum += hr; }
    });
  }
  const avgHR = hrDays ? Math.round(hrSum / hrDays) : null;

  // Sleep: watch-synced, averaged over nights with data
  let sleepDays = 0, sleepSum = 0;
  if (typeof sleepHoursFor === 'function' || typeof getExternalSleep === 'function') {
    days.forEach(day => {
      const h = (typeof sleepHoursFor === 'function') ? sleepHoursFor(day) : getExternalSleep(day);
      if (h !== null) { sleepDays++; sleepSum += h; }
    });
  }
  const avgSleep = sleepDays ? Math.round((sleepSum / sleepDays) * 10) / 10 : null;

  // Weight: smoothed trend change over roughly the last week
  let weightChange = null;
  if (typeof weightTrendSeries === 'function') {
    const series = weightTrendSeries() || [];
    if (series.length >= 2) {
      const last = series[series.length - 1];
      const lastTime = new Date(last[0] + 'T00:00:00').getTime();
      let ref = series[0];
      for (let i = series.length - 2; i >= 0; i--) {
        const t = new Date(series[i][0] + 'T00:00:00').getTime();
        if (lastTime - t >= 7 * 86400000) { ref = series[i]; break; }
      }
      weightChange = Math.round((last[1] - ref[1]) * 10) / 10;
    }
  }

  const rows = [];

  // Calories (cutting: under budget is good)
  // An average is only as good as the number of days under it. One logged day
  // in the window produced "1g avg" next to a Month card reading 38g, with no
  // way to see that one was a single sparse day - so the count rides along.
  const over = dietDays === 1 ? ' · 1 logged day' : ` · ${dietDays} logged days`;

  if (dietDays) {
    const calDot = avgCal <= g.calories ? 'good' : avgCal <= g.calories * 1.1 ? 'warn' : 'bad';
    rows.push({ label: 'Calories', val: `${avgCal} avg / ${g.calories}${over}`, dot: calDot });
  } else {
    rows.push({ label: 'Calories', val: 'no days logged', dot: 'warn' });
  }

  // Protein (cutting: hitting the target protects muscle, so more is good)
  if (dietDays) {
    const proteinDot = avgProtein >= g.protein * 0.9 ? 'good' : avgProtein >= g.protein * 0.7 ? 'warn' : 'bad';
    rows.push({ label: 'Protein', val: `${avgProtein}g avg / ${g.protein}g${over}`, dot: proteinDot });
  } else {
    // It used to render "0g avg / 150g" in red for someone who had simply not
    // logged anything yet - a failing grade for a week they never ate in.
    rows.push({ label: 'Protein', val: 'no days logged', dot: 'warn' });
  }

  // Carbs & Fat (cutting: at or under budget is good, like calories)
  if (dietDays) {
    const carbDot = avgCarbs <= g.carbs ? 'good' : avgCarbs <= g.carbs * 1.15 ? 'warn' : 'bad';
    rows.push({ label: 'Carbs', val: `${avgCarbs}g avg / ${g.carbs}g`, dot: carbDot });
    const fatDot = avgFat <= g.fat ? 'good' : avgFat <= g.fat * 1.15 ? 'warn' : 'bad';
    rows.push({ label: 'Fat', val: `${avgFat}g avg / ${g.fat}g`, dot: fatDot });
  }

  // Training
  const trainDot = daysTrained >= 4 ? 'good' : daysTrained >= 2 ? 'warn' : 'bad';
  rows.push({ label: 'Training', val: `${daysTrained}/7 days · ${totalSets} sets`, dot: trainDot });

  // Water
  const waterDot = avgWater >= g.water * 0.9 ? 'good' : avgWater >= g.water * 0.6 ? 'warn' : 'bad';
  rows.push({ label: 'Water', val: `${avgWater} oz avg / ${g.water} oz`, dot: waterDot });

  // Resting HR (only when the watch has synced data)
  if (avgHR !== null) {
    const hrDot = avgHR <= 65 ? 'good' : avgHR <= 75 ? 'warn' : 'bad';
    rows.push({ label: 'Resting HR', val: `${avgHR} bpm avg`, dot: hrDot });
  }

  // Sleep (only when the watch has synced data) — poor sleep sabotages a cut:
  // it drives hunger up and training quality down
  if (avgSleep !== null) {
    const sleepDot = avgSleep >= 7 ? 'good' : avgSleep >= 6 ? 'warn' : 'bad';
    rows.push({ label: 'Sleep', val: `${avgSleep}h avg / ${g.sleep || 8}h`, dot: sleepDot });
  }

  // Weight trend (cutting: falling is good)
  if (weightChange !== null) {
    const weightDot = weightChange <= -0.5 ? 'good' : weightChange <= 0.2 ? 'warn' : 'bad';
    rows.push({ label: 'Weight trend', val: `${weightChange > 0 ? '+' : ''}${weightChange} lbs this week`, dot: weightDot });
  } else {
    rows.push({ label: 'Weight trend', val: '— log weigh-ins', dot: 'warn' });
  }

  // One focus for the week, highest-impact issue first
  // Three days is the floor for calling something an average. Below that the
  // advice was quoting a single day as the week's protein habit.
  const ENOUGH_DAYS = 3;
  let focus;
  if (dietDays && dietDays < ENOUGH_DAYS) {
    focus = `keep logging — ${dietDays} day${dietDays === 1 ? '' : 's'} is not a week yet`;
  } else if (dietDays >= ENOUGH_DAYS && avgProtein < g.protein * 0.8) {
    focus = `lead every meal with protein — you averaged ${avgProtein}g vs the ${g.protein}g target`;
  } else if (daysTrained < 4) {
    focus = 'train at least 4 days — short sessions count';
  } else if (dietDays >= ENOUGH_DAYS && avgCal > g.calories) {
    focus = `tighten calories back to the ~${g.calories} budget`;
  } else if (weightChange === null || weightChange > -0.3) {
    focus = 'hold the deficit steady and weigh in daily so the trend is trustworthy';
  } else {
    focus = "everything's on track — repeat last week";
  }

  host.innerHTML = `
    ${rows.map(r => `
      <div class="weekly-row">
        <span class="weekly-dot ${r.dot}"></span>
        <span class="weekly-row-label">${r.label}</span>
        <span class="weekly-row-val">${r.val}</span>
      </div>`).join('')}
    <div class="weekly-focus">Focus this week: <strong>${focus}</strong></div>`;
}

// Today, in render order down the page. Everything this function used to draw
// itself — the health strip, the reminder cards, the My Tasks board, the
// deadlines list, the schedule card and the project filter — became one of the
// five v3 surfaces below, so this is now just the call list for them.
//
// The weight trend and the weekly report are NOT Today surfaces any more; they
// are called from here because their hosts live in Training and Insights and
// this is still the one function render() reaches Today through.
function renderDashboard() {
  const today = getTodayStr();

  if (typeof renderNowBlock === 'function') renderNowBlock();                 // 4.2
  if (typeof watchNowBlockScroll === 'function') watchNowBlockScroll();
  if (typeof renderBrief === 'function') renderBrief();                       // 4.5
  const viewed = (typeof lineViewDate !== 'undefined' && lineViewDate) || today;
  if (typeof renderLine === 'function') renderLine(viewed);                   // 4.3
  if (typeof renderTray === 'function') renderTray();                         // 4.4 — after the line: it renders into it
  if (typeof renderDueSoon === 'function') renderDueSoon();                   // 4.6
  if (typeof renderWeekBars === 'function') renderWeekBars();                 // 4.6
  if (typeof bindTodaySurfaces === 'function') bindTodaySurfaces();

  // This PWA stays open for days, so the sidebar's day number goes stale
  // across midnight unless it is re-derived on render like everything else.
  if (typeof fillSidebarDate === 'function') fillSidebarDate();
  renderWeightTrend();
  renderWeeklyReport();
}

// ========== Mini Calendar (Dashboard) ==========
function renderMiniCalendar() {
  if (!$('#miniCalDays')) return;
  const year = miniCalDate.getFullYear();
  const month = miniCalDate.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  $('#miniCalMonth').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = getTodayStr();

  const miniHolidays = getUSHolidays(year);
  let html = '';

  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<span class="mini-cal-cell other-month">${daysInPrev - i}</span>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const hasTasks = state.tasks.some(t => t.dueDate === dateStr);
    const isHoliday = miniHolidays.some(h => h.date === dateStr);
    const classes = ['mini-cal-cell'];
    if (isToday) classes.push('today');
    if (hasTasks) classes.push('has-tasks');
    if (isHoliday) classes.push('holiday');
    html += `<span class="${classes.join(' ')}" ${isHoliday ? `title="${miniHolidays.find(h => h.date === dateStr).name}"` : ''}>${d}</span>`;
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<span class="mini-cal-cell other-month">${i}</span>`;
  }

  $('#miniCalDays').innerHTML = html;
}

// ---- Quick weigh-in ----
// The gaps between Chinmay's weigh-ins were widening — 7, 5, 3, 5, 8, 9 days —
// on the single number his whole goal is defined by, while he logged every meal
// without missing a day for six weeks. The difference was friction: food logs
// from the screen he already has open, weight needed a trip to Training.
//
// Reuses state.weight and saveData directly rather than driving the hidden
// Training inputs, so it cannot break if that form moves again.
function openWeighIn() {
  const existing = document.getElementById('weighInSheet');
  if (existing) existing.remove();

  const today = getTodayStr();
  const g = (typeof getGoals === 'function') ? getGoals() : {};
  const entries = Object.entries(state.weight || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const val = e => (e && typeof e[1] === 'object') ? Number(e[1].lbs) : Number(e[1]);
  const last = entries.length ? val(entries[entries.length - 1]) : null;

  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay active';
  wrap.id = 'weighInSheet';
  wrap.innerHTML = `
    <div class="modal weighin-modal">
      <div class="modal-header">
        <div class="modal-header-left">
          <div>
            <h2>Weigh in</h2>
            <p class="modal-subtitle">${last !== null ? `Last: ${last} lbs` : 'First weigh-in'}${g.weight ? ` · goal ${g.weight}` : ''}</p>
          </div>
        </div>
        <button class="modal-close" id="weighInClose" aria-label="Close">&times;</button>
      </div>
      <div class="weighin-body">
        <input type="number" id="weighInValue" class="weighin-input" inputmode="decimal"
               step="0.1" min="50" max="500" placeholder="${last !== null ? last : '160'}"
               autocomplete="off">
        <span class="weighin-unit">lbs</span>
      </div>
      <div class="weighin-actions">
        <button type="button" class="btn-secondary" id="weighInCancel">Cancel</button>
        <button type="button" class="btn-primary" id="weighInSave">Save</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  document.getElementById('weighInClose').addEventListener('click', close);
  document.getElementById('weighInCancel').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

  const input = document.getElementById('weighInValue');
  setTimeout(() => input.focus(), 80);

  const save = () => {
    const v = Number(input.value);
    if (!v || v < 50 || v > 500) { input.classList.add('is-missing'); input.focus(); return; }
    state.weight = state.weight || {};
    state.weight[today] = Math.round(v * 10) / 10;
    saveData(state);
    if (typeof haptic === 'function') haptic('success');
    close();
    render();
  };
  document.getElementById('weighInSave').addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}
