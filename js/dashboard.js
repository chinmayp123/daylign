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

// Today, in render order down the page. Everything this function used to draw
// itself — the health strip, the reminder cards, the My Tasks board, the
// deadlines list, the schedule card and the project filter — became one of the
// five v3 surfaces below, so this is now just the call list for them.
//
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
