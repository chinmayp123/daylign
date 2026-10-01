// ========== Dashboard ==========
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
