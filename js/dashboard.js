// ========== Dashboard ==========
let dashboardProjectFilter = null; // null = all projects

function renderDashboardProjectFilter() {
  const projects = state.projects || [];
  if (!projects.length) {
    $('#dashboardProjectFilter').innerHTML = '';
    return;
  }
  $('#dashboardProjectFilter').innerHTML = `
    <div class="dash-project-tabs">
      <button class="dash-project-tab ${dashboardProjectFilter === null ? 'active' : ''}" data-proj="all">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
        All Projects
      </button>
      ${projects.map(p => `
        <button class="dash-project-tab ${dashboardProjectFilter === p.id ? 'active' : ''}" data-proj="${p.id}">
          <span class="category-dot" style="background:${p.color}"></span>${esc(p.name)}
        </button>
      `).join('')}
    </div>`;

  $$('.dash-project-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      dashboardProjectFilter = tab.dataset.proj === 'all' ? null : tab.dataset.proj;
      renderDashboard();
    });
  });
}

// Today's health at a glance — the numbers that matter on a cut
function renderHealthStrip(today) {
  const el = $('#healthGrid');
  if (!el) return;
  const g = (typeof getGoals === 'function') ? getGoals() : { calories: 2000, protein: 150, water: 66, weight: 150 };
  const dietToday = state.diet.filter(e => e.date === today);
  const cal = Math.round(dietToday.reduce((s, e) => s + (e.calories || 0), 0));
  const protein = Math.round(dietToday.reduce((s, e) => s + (e.protein || 0), 0));
  const water = (state.water[today] || []).reduce((s, v) => s + v, 0);
  const weighIns = Object.entries(state.weight || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const latestW = weighIns.length ? weighIns[weighIns.length - 1][1] : null;
  const calOver = cal > g.calories;

  // Net calories: eaten minus what training and walking burned. This is the
  // number that decides whether today was actually a deficit day. When the
  // Apple Watch has synced active energy, that measured number wins outright —
  // it already includes both workouts and walking.
  const watchBurn = (typeof getExternalActiveEnergy === 'function') ? getExternalActiveEnergy(today) : null;
  const workoutBurn = (typeof estimateBurnForDate === 'function') ? estimateBurnForDate(today) : 0;
  const steps = (typeof getExternalSteps === 'function') ? getExternalSteps(today) : null;
  const walkBurn = steps ? Math.round(steps * (latestW || 160) * 0.00025) : 0;
  const totalBurn = watchBurn !== null ? Math.round(watchBurn) : workoutBurn + walkBurn;
  const exMin = (typeof getExternalExerciseMinutes === 'function') ? getExternalExerciseMinutes(today) : null;
  // sleepHoursFor prefers a hand-logged night, falling back to the watch.
  const sleepH = (typeof sleepHoursFor === 'function')
    ? sleepHoursFor(today)
    : ((typeof getExternalSleep === 'function') ? getExternalSleep(today) : null);

  const tiles = [
    { view: 'diet', label: 'Calories', value: cal, sub: `/ ${g.calories}`, pct: Math.min(100, (cal / g.calories) * 100), color: calOver ? 'var(--yellow)' : 'var(--accent)' },
    // Activity, not "net calories": exercise-burn estimates are noisy, and a net
    // number reads like you ate less than you did. Shown as its own estimate.
    { view: 'gym', label: 'Activity', value: totalBurn, sub: 'cal', pct: null,
      note: watchBurn !== null ? '⌚ measured active energy' : 'estimated from workouts & steps', color: 'var(--green)' },
    { view: 'diet', label: 'Protein', value: `${protein}g`, sub: `/ ${g.protein}g`, pct: Math.min(100, (protein / g.protein) * 100), color: '#6366f1' },
    { view: 'diet', label: 'Water', value: `${water} oz`, sub: `/ ${g.water} oz`, pct: Math.min(100, (water / g.water) * 100), color: '#38bdf8' },
    ...(steps !== null ? [{ view: 'gym', label: 'Steps', value: steps.toLocaleString(), sub: `/ ${(g.steps || 8000).toLocaleString()}`, pct: Math.min(100, (steps / (g.steps || 8000)) * 100), color: '#22c55e' }] : []),
    ...(exMin !== null ? [{ view: 'gym', label: 'Exercise', value: `${exMin} min`, sub: `/ ${g.exerciseMin || 30} min`, pct: Math.min(100, (exMin / (g.exerciseMin || 30)) * 100), color: '#f59e0b' }] : []),
    ...(sleepH !== null ? [{ view: 'training', label: 'Sleep', value: `${sleepH}h`, sub: `/ ${g.sleep || 8}h`, pct: Math.min(100, (sleepH / (g.sleep || 8)) * 100), color: '#a78bfa' }] : []),
    { view: 'gym', label: 'Weight', value: latestW !== null ? `${latestW} lbs` : '—', sub: latestW !== null ? `→ ${g.weight} lbs` : 'log a weigh-in',
      pct: null, note: latestW !== null ? `${Math.round(Math.abs(latestW - g.weight) * 10) / 10} lbs to go` : 'Tap to log your first', color: 'var(--purple)' },
  ];

  el.innerHTML = tiles.map(t => `
    <div class="health-tile" data-view="${t.view}" title="Open ${t.view}">
      <div class="health-tile-top">
        <span class="health-tile-label">${t.label}</span>
        <span class="health-tile-value">${t.value} <small>${t.sub}</small></span>
      </div>
      ${t.pct !== null
        ? `<div class="health-bar-track"><div class="health-bar-fill" style="width:${t.pct}%;background:${t.color}"></div></div>`
        : `<div class="health-tile-note">${t.note}</div>`}
    </div>`).join('');

  $$('.health-tile').forEach(tile => {
    tile.addEventListener('click', () => switchView(tile.dataset.view));
  });
}

// Weight trend chart — SVG line of weigh-ins vs the goal line
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
  if (meta) meta.textContent = 'last 7 days';

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
  if (dietDays) {
    const calDot = avgCal <= g.calories ? 'good' : avgCal <= g.calories * 1.1 ? 'warn' : 'bad';
    rows.push({ label: 'Calories', val: `${avgCal} avg / ${g.calories}`, dot: calDot });
  } else {
    rows.push({ label: 'Calories', val: 'no days logged', dot: 'warn' });
  }

  // Protein (cutting: hitting the target protects muscle, so more is good)
  const proteinDot = avgProtein >= g.protein * 0.9 ? 'good' : avgProtein >= g.protein * 0.7 ? 'warn' : 'bad';
  rows.push({ label: 'Protein', val: `${avgProtein}g avg / ${g.protein}g`, dot: proteinDot });

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
  let focus;
  if (dietDays && avgProtein < g.protein * 0.8) {
    focus = `lead every meal with protein — you averaged ${avgProtein}g vs the ${g.protein}g target`;
  } else if (daysTrained < 4) {
    focus = 'train at least 4 days — short sessions count';
  } else if (dietDays && avgCal > g.calories) {
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

function renderDashboard() {
  renderDashboardProjectFilter();

  let tasks = state.tasks;
  if (dashboardProjectFilter) {
    tasks = tasks.filter(t => t.project === dashboardProjectFilter);
  }
  const today = getTodayStr();

  const total = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const completed = tasks.filter(t => t.status === 'done').length;
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;

  animateNumber($('#totalTasks'), total);
  animateNumber($('#inProgressTasks'), inProgress);
  animateNumber($('#completedTasks'), completed);
  animateNumber($('#overdueTasks'), overdue);

  renderHealthStrip(today);
  renderWeightTrend();
  renderWeeklyReport();
  renderReminders(today);
  renderMyTasksBoard(tasks);

  // Deadlines
  const upcoming = tasks
    .filter(t => t.dueDate && t.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  $('#deadlinesList').innerHTML = upcoming.length ? upcoming.map(t => {
    const isOverdue = t.dueDate < today;
    const dateStr = formatDate(t.dueDate);
    const proj = t.project ? state.projects.find(p => p.id === t.project) : null;
    const cat = state.categories.find(c => c.id === t.category);
    const itemColor = proj ? proj.color : (cat ? cat.color : null);
    return `
      <div class="deadline-item">
        <span class="deadline-date ${isOverdue ? 'overdue' : ''}" ${!isOverdue && itemColor ? `style="color:${itemColor}"` : ''}>${dateStr}</span>
        <span class="deadline-name">${esc(t.name)}</span>
      </div>`;
  }).join('') : emptyState({ icon: 'calendar', title: 'Nothing due', hint: 'Tasks with a due date show up here as the day approaches.' });
}

// ========== My Tasks Board (Dashboard) ==========
function renderMyTasksBoard(taskPool) {
  const allTasks = taskPool || state.tasks;
  const today = getTodayStr();

  const cats = state.categories.filter(c =>
    allTasks.some(t => t.category === c.id)
  );
  const tabsHtml = `
    <button class="my-tasks-tab ${activeTaskTab === null ? 'active' : ''}" data-cat="all">All</button>
    ${cats.map(c => `
      <button class="my-tasks-tab ${activeTaskTab === c.id ? 'active' : ''}" data-cat="${c.id}">
        <span class="category-dot" style="background:${c.color}"></span>${c.name}
      </button>
    `).join('')}`;
  $('#myTasksTabs').innerHTML = tabsHtml;

  // Scoped to this card: the Board emits the same .my-tasks-tab class into
  // #boardFilters, so a document-wide query also bound the Board's category
  // filters — clicking one there mutated the dashboard's tab state.
  $$('#myTasksTabs .my-tasks-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTaskTab = tab.dataset.cat === 'all' ? null : tab.dataset.cat;
      renderMyTasksBoard(allTasks);
    });
  });

  let filtered = allTasks.filter(t => t.status !== 'done');
  if (activeTaskTab) {
    filtered = filtered.filter(t => t.category === activeTaskTab);
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    const aOverdue = a.dueDate && a.dueDate < today ? 0 : 1;
    const bOverdue = b.dueDate && b.dueDate < today ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  if (!filtered.length) {
    $('#myTasksBoard').innerHTML = emptyState({ icon: 'check', title: 'All clear', hint: 'No active tasks right now.', actionLabel: '+ New task', action: 'new-task' });
    return;
  }

  $('#myTasksBoard').innerHTML = filtered.slice(0, 8).map(t => {
    const cat = state.categories.find(c => c.id === t.category);
    const isOverdue = t.dueDate && t.dueDate < today;
    return `
      <div class="my-task-card" data-id="${t.id}">
        <div class="my-task-card-top">
          <div class="task-check ${t.status === 'done' ? 'checked' : ''}" data-id="${t.id}"></div>
          <span class="my-task-card-name">${esc(t.name)}</span>
        </div>
        <div class="my-task-card-bottom">
          ${cat ? `<span class="my-task-card-cat" style="color:${cat.color}"><span class="category-dot" style="background:${cat.color}"></span>${cat.name}</span>` : '<span></span>'}
          <div class="my-task-card-tags">
            ${isOverdue ? '<span class="my-task-tag overdue">Overdue</span>' : t.dueDate ? `<span class="my-task-tag">${formatDate(t.dueDate)}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  $$('#myTasksBoard .task-check').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskDone(el.dataset.id);
    });
  });

  $$('#myTasksBoard .my-task-card').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });
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

// ========== Daily Schedule ==========
function renderSchedule() {
  const now = new Date();
  const nowStr = toLocalDateStr(now);
  const viewDate = new Date(scheduleDate);
  const viewStr = toLocalDateStr(viewDate);
  const isToday = viewStr === nowStr;
  const currentHour = isToday ? now.getHours() : -1;

  if (isToday) {
    $('#scheduleTitle').textContent = "Today's Schedule";
  } else {
    $('#scheduleTitle').textContent = 'Schedule';
  }
  $('#scheduleDate').textContent = viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  $('#scheduleToday').style.display = isToday ? 'none' : '';

  // Meetings for the day being viewed, synced from the phone's calendars.
  // Read-only: they belong to Google/iOS, so nothing here can edit or delete
  // one — they are context for planning around, not tasks to tick off.
  const meetings = (typeof getExternalCalendar === 'function') ? getExternalCalendar(viewStr) : [];
  const allDayMeetings = meetings.filter(m => m.hour < 0);

  const todayTasks = state.tasks.filter(t => t.dueDate === viewStr && t.status !== 'done');
  const scheduled = todayTasks.filter(t => t.scheduledHour != null);
  const unscheduled = todayTasks.filter(t => t.scheduledHour == null);

  if (unscheduled.length) {
    $('#scheduleUnscheduled').innerHTML = `
      <div class="unscheduled-label">Unscheduled tasks — drag to a time slot</div>
      <div class="unscheduled-tasks">
        ${unscheduled.map(t => {
          const cat = state.categories.find(c => c.id === t.category);
          return `
          <div class="schedule-event priority-${t.priority} draggable-event" draggable="true" data-id="${t.id}">
            <div class="schedule-event-header">
              <div class="schedule-event-name">${esc(t.name)}</div>
            </div>
            <div class="schedule-event-meta">
              <span class="schedule-event-priority ${t.priority}">${t.priority}</span>
              ${cat ? `<span class="schedule-event-category"><span class="category-dot" style="background:${cat.color}"></span>${cat.name}</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  } else {
    $('#scheduleUnscheduled').innerHTML = '';
  }

  let html = '';
  if (allDayMeetings.length) {
    html += `
      <div class="schedule-allday">
        <div class="schedule-hour-label">All day</div>
        <div class="schedule-allday-items">
          ${allDayMeetings.map(m => `<div class="schedule-meeting is-allday">
            <span class="schedule-meeting-name">${esc(m.title)}</span>
            ${m.location ? `<span class="schedule-meeting-loc">${esc(m.location)}</span>` : ''}
          </div>`).join('')}
        </div>
      </div>`;
  }
  for (let h = 6; h <= 21; h++) {
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const isCurrent = h === currentHour;
    const slotTasks = scheduled.filter(t => t.scheduledHour === h);

    html += `
      <div class="schedule-hour${isCurrent ? ' current' : ''}" data-hour="${h}">
        <div class="schedule-hour-label">${hour12} ${ampm}</div>
        <div class="schedule-hour-slot" data-hour="${h}">
          ${meetings.filter(m => m.hour === h).map(m => `
            <div class="schedule-meeting" title="${esc(m.title)}">
              <span class="schedule-meeting-time">${esc(m.start)}${m.end ? '&ndash;' + esc(m.end) : ''}</span>
              <span class="schedule-meeting-name">${esc(m.title)}</span>
              ${m.location ? `<span class="schedule-meeting-loc">${esc(m.location)}</span>` : ''}
            </div>`).join('')}
          ${slotTasks.map(t => {
            const cat = state.categories.find(c => c.id === t.category);
            return `
            <div class="schedule-event priority-${t.priority} draggable-event" draggable="true" data-id="${t.id}">
              <div class="schedule-event-header">
                <div class="schedule-event-name">${esc(t.name)}</div>
                ${cat ? `<span class="schedule-event-category"><span class="category-dot" style="background:${cat.color}"></span>${cat.name}</span>` : ''}
              </div>
              <div class="schedule-event-meta">
                <span class="schedule-event-priority ${t.priority}">${t.priority}</span>
                ${t.duration && t.duration !== 1 ? `<span>${t.duration}h</span>` : ''}
                ${(t.subtasks && t.subtasks.length) ? `<span>${t.subtasks.filter(s => s.done).length}/${t.subtasks.length} subtasks</span>` : ''}
              </div>
              <button class="schedule-event-remove" data-id="${t.id}" title="Unschedule">&times;</button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  $('#scheduleTimeline').innerHTML = html;

  $$('.schedule-event').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('schedule-event-remove')) return;
      openModal(el.dataset.id);
    });
  });

  $$('.schedule-event-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id === btn.dataset.id);
      if (task) {
        delete task.scheduledHour;
        delete task.duration;
        saveData(state);
        render();
      }
    });
  });

  $$('.schedule-hour-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
      if (e.target !== slot) return;
      const hour = parseInt(slot.dataset.hour);
      openModal(null, hour);
    });
  });

  $$('.draggable-event').forEach(ev => {
    ev.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', ev.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      ev.style.opacity = '0.4';
    });
    ev.addEventListener('dragend', () => { ev.style.opacity = '1'; });
  });

  $$('.schedule-hour-slot').forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const hour = parseInt(slot.dataset.hour);
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.scheduledHour = hour;
        if (!task.duration) task.duration = 1;
        if (!task.dueDate) task.dueDate = viewStr;
        saveData(state);
        render();
      }
    });
  });

  const currentSlot = $('.schedule-hour.current');
  if (currentSlot) {
    const container = currentSlot.closest('.schedule-timeline');
    if (container) {
      container.scrollTop = currentSlot.offsetTop - container.offsetTop - container.clientHeight / 2;
    }
  }
}

// ========== Reminders ==========
function renderReminders(today) {
  const reminders = [];
  const hour = new Date().getHours();

  // --- Brush teeth (morning) ---
  const brushAM = localStorage.getItem('tf_brush_am_' + today);
  if (!brushAM && hour < 12) {
    reminders.push({
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 21h10"/><rect x="10" y="2" width="4" height="12" rx="2"/><path d="M12 14v7"/></svg>',
      color: '#22d3ee',
      bg: 'rgba(34, 211, 238, 0.1)',
      text: 'Brush your teeth (morning)',
      sub: '',
      action: `<button class="reminder-done-btn" data-habit="brush_am">Done</button>`,
    });
  }

  // --- Morning routine: pushups & situps ---
  const morningDone = localStorage.getItem('tf_morning_' + today);
  if (!morningDone && hour < 14) {
    reminders.push({
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
      color: 'var(--purple)',
      bg: 'rgba(139, 92, 246, 0.1)',
      text: 'Morning routine: Pushups & Situps',
      sub: 'Start your day strong!',
      action: `<button class="reminder-done-btn" data-habit="morning">Done</button>`,
    });
  }

  // --- Gym reminder ---
  const gymToday = state.gym.filter(e => e.date === today);
  const daysSinceGym = (() => {
    const gymDates = [...new Set(state.gym.map(e => e.date))].sort().reverse();
    if (!gymDates.length) return 99;
    const last = new Date(gymDates[0] + 'T00:00:00');
    const now = new Date(today + 'T00:00:00');
    return Math.round((now - last) / (1000 * 60 * 60 * 24));
  })();

  if (!gymToday.length) {
    if (daysSinceGym >= 2) {
      reminders.push({
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3"/><path d="M17.5 6.5h3a1 1 0 011 1v9a1 1 0 01-1 1h-3"/><rect x="6.5" y="4" width="4" height="16" rx="1"/><rect x="13.5" y="4" width="4" height="16" rx="1"/><line x1="10.5" y1="12" x2="13.5" y2="12"/></svg>',
        color: 'var(--red)',
        bg: 'var(--red-bg)',
        text: `No workout in ${daysSinceGym} days`,
        sub: 'Time to hit the gym! Consistency is what drops the weight.',
        action: `<button class="reminder-nav-btn" data-view="gym">Log Workout</button>`,
      });
    } else if (hour >= 8) {
      reminders.push({
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3"/><path d="M17.5 6.5h3a1 1 0 011 1v9a1 1 0 01-1 1h-3"/><rect x="6.5" y="4" width="4" height="16" rx="1"/><rect x="13.5" y="4" width="4" height="16" rx="1"/><line x1="10.5" y1="12" x2="13.5" y2="12"/></svg>',
        color: 'var(--yellow)',
        bg: 'var(--yellow-bg)',
        text: "Haven't logged a workout today",
        sub: 'Keep your streak going!',
        action: `<button class="reminder-nav-btn" data-view="gym">Log Workout</button>`,
      });
    }
  }

  // --- Water reminder ---
  const waterEntries = state.water[today] || [];
  const waterTotal = waterEntries.reduce((s, v) => s + v, 0);
  const waterGoal = (typeof getGoals === 'function' && getGoals().water) || 66;
  if (waterTotal < waterGoal && hour >= 10) {
    const waterPct = Math.round((waterTotal / waterGoal) * 100);
    if (waterPct < 50 && hour >= 14) {
      reminders.push({
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.1)',
        text: `Only ${waterTotal} oz water today (${waterPct}%)`,
        sub: `Drink up! ${waterGoal - waterTotal} oz to go.`,
        action: `<button class="reminder-nav-btn" data-view="diet">Log Water</button>`,
      });
    } else if (waterPct < 80) {
      reminders.push({
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.1)',
        text: `Water: ${waterTotal} / ${waterGoal} oz`,
        sub: `${waterGoal - waterTotal} oz remaining today`,
        action: `<button class="reminder-nav-btn" data-view="diet">Log Water</button>`,
      });
    }
  }

  // --- Calorie reminder (cutting: over budget is the danger) ---
  const dietToday = state.diet.filter(e => e.date === today);
  const calToday = dietToday.reduce((s, e) => s + (e.calories || 0), 0);
  const calGoal = (typeof getGoals === 'function' && getGoals().calories) || 2000;
  const foodIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>';
  if (calToday > calGoal) {
    reminders.push({
      icon: foodIcon,
      color: 'var(--red)',
      bg: 'var(--red-bg)',
      text: `Over budget: ${Math.round(calToday)} / ${calGoal} cal`,
      sub: `${Math.round(calToday - calGoal)} cal over — keep the rest of the day light, maybe a walk.`,
      action: `<button class="reminder-nav-btn" data-view="diet">View Diet</button>`,
    });
  } else if (calToday > calGoal * 0.85 && hour < 18) {
    reminders.push({
      icon: foodIcon,
      color: 'var(--yellow)',
      bg: 'var(--yellow-bg)',
      text: `${Math.round(calGoal - calToday)} cal left for the day`,
      sub: `Budget is nearly used — plan a light dinner (soup, salad, grilled protein).`,
      action: `<button class="reminder-nav-btn" data-view="diet">Log Food</button>`,
    });
  } else if (hour >= 12 && calToday < calGoal * 0.2) {
    reminders.push({
      icon: foodIcon,
      color: 'var(--yellow)',
      bg: 'var(--yellow-bg)',
      text: `Only ${Math.round(calToday)} / ${calGoal} cal logged`,
      sub: `Don't forget to log your meals — skipping logs hides overeating.`,
      action: `<button class="reminder-nav-btn" data-view="diet">Log Food</button>`,
    });
  }

  // --- Weigh-in reminder (the scale is the scoreboard on a cut) ---
  const weighDates = Object.keys(state.weight || {}).sort();
  const lastWeighIn = weighDates[weighDates.length - 1] || null;
  const daysSinceWeighIn = lastWeighIn
    ? Math.round((new Date(today + 'T00:00:00') - new Date(lastWeighIn + 'T00:00:00')) / 86400000)
    : null;
  if (hour >= 6 && (daysSinceWeighIn === null || daysSinceWeighIn >= 3)) {
    reminders.push({
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/></svg>',
      color: 'var(--purple)',
      bg: 'rgba(167, 139, 250, 0.1)',
      text: daysSinceWeighIn === null ? 'No weigh-ins logged yet' : `No weigh-in in ${daysSinceWeighIn} days`,
      sub: 'Hop on the scale — tracking weight is how the cut stays honest.',
      action: `<button class="reminder-nav-btn" data-view="gym">Log Weight</button>`,
    });
  }

  // --- Protein reminder (extra important on a cut — protects muscle) ---
  const proteinToday = dietToday.reduce((s, e) => s + (e.protein || 0), 0);
  const proteinGoal = (typeof getGoals === 'function' && getGoals().protein) || 150;
  if (hour >= 14 && proteinToday < 50) {
    reminders.push({
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.1)',
      text: `Low protein: ${Math.round(proteinToday)}g / ${proteinGoal}g`,
      sub: 'Protein keeps muscle while you cut — chicken, eggs, or a shake.',
      action: `<button class="reminder-nav-btn" data-view="diet">Log Food</button>`,
    });
  }

  // --- Brush teeth (evening) ---
  const brushPM = localStorage.getItem('tf_brush_pm_' + today);
  if (!brushPM && hour >= 18) {
    reminders.push({
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 21h10"/><rect x="10" y="2" width="4" height="12" rx="2"/><path d="M12 14v7"/></svg>',
      color: '#22d3ee',
      bg: 'rgba(34, 211, 238, 0.1)',
      text: 'Brush your teeth (evening)',
      sub: '',
      action: `<button class="reminder-done-btn" data-habit="brush_pm">Done</button>`,
    });
  }

  // Render
  const bar = $('#remindersBar');
  if (!reminders.length) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = reminders.map(r => `
    <div class="reminder-card" style="border-left-color:${r.color}">
      <div class="reminder-icon" style="color:${r.color};background:${r.bg}">${r.icon}</div>
      <div class="reminder-body">
        <div class="reminder-text">${r.text}</div>
        ${r.sub ? `<div class="reminder-sub">${r.sub}</div>` : ''}
      </div>
      ${r.action}
    </div>
  `).join('');

  // Bind nav buttons
  $$('.reminder-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Bind all habit done buttons
  $$('.reminder-done-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const habit = btn.dataset.habit;
      localStorage.setItem(`tf_${habit}_` + today, '1');

      // Auto-log pushups & situps to gym when morning routine is completed
      if (habit === 'morning') {
        const alreadyPushups = state.gym.some(e => e.date === today && e.exercise === 'Push Ups' && e._fromReminder);
        if (!alreadyPushups) {
          state.gym.push({ date: today, exercise: 'Push Ups', sets: [{ reps: 10, weight: 0 }], bodyweight: true, _fromReminder: true });
          state.gym.push({ date: today, exercise: 'Sit Ups', sets: [{ reps: 10, weight: 0 }], bodyweight: true, _fromReminder: true });
          saveData(state);
        }
      }

      renderReminders(today);
    });
  });
}
