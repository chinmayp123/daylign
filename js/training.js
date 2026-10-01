// ========== Training (Strength · Cardio · Coach · Sleep) ==========
// One nav item, four sub-tabs (v3 BUILD_SPEC section 7). Before this there were
// TWO crossed controls — a Strength/Cardio mode toggle and a Log/Progress/Coach
// section row — which meant nine combinations for six real screens: Recovery
// and the coach verdict were reachable from either mode, the cardio coach only
// from one, and you could not tell from the chrome which of the nine you were
// in. Flattening it to four named destinations is the whole point.
//
// Still deliberately additive underneath: the gym and cardio markup lives in
// panes with every id intact, so gym.js, cardio.js, coach.js, strength.js and
// sleep.js render into exactly what they always did.

const TRAINING_MODE_KEY = 'daylign_training_mode';

// The Strength pane's own Today / Progress switch. Device-local, like every
// other "which tab was I on" memory in the app.
const STRENGTH_SUB_KEY = 'daylign_strength_sub';

function trainingMode() {
  return localStorage.getItem(TRAINING_MODE_KEY) === 'cardio' ? 'cardio' : 'strength';
}

// Kept for app.js (the header's primary action) and the legacy `cardio` view
// alias: which of the two LOGGING surfaces is in front. Coach and Sleep are not
// logging surfaces, so they answer with whatever was last logged into.
function effectiveTrainingMode() {
  const gymOn = typeof moduleEnabled !== 'function' || moduleEnabled('gym');
  const cardioOn = typeof moduleEnabled !== 'function' || moduleEnabled('cardio');
  const tab = trainingTab();
  let mode = tab === 'cardio' ? 'cardio' : tab === 'strength' ? 'strength' : trainingMode();
  if (mode === 'cardio' && !cardioOn) return 'strength';
  if (mode === 'strength' && !gymOn) return 'cardio';
  return mode;
}

// switchView() calls this to translate the legacy 'gym' / 'cardio' view keys.
// Deliberately not setTrainingTab(): that scrolls and re-labels the header
// button, neither of which makes sense mid-view-switch.
function setTrainingMode(mode) {
  localStorage.setItem(TRAINING_TAB_KEY, mode === 'cardio' ? 'cardio' : 'strength');
  applyTrainingTab();
}

function strengthSub() {
  return localStorage.getItem(STRENGTH_SUB_KEY) === 'progress' ? 'progress' : 'today';
}

function setStrengthSub(sub) {
  localStorage.setItem(STRENGTH_SUB_KEY, sub === 'progress' ? 'progress' : 'today');
  applyTrainingTab();
  if (typeof haptic === 'function') haptic('light');
}

// Compact body-weight readout in the shell: "163.2 lbs ↓0.6 · Log".
// Uses the same smoothed trend series as the full weight card so the two can
// never disagree.
function renderTrainingWeight() {
  const el = document.getElementById('trainingWeight');
  if (!el) return;
  const gymOn = typeof moduleEnabled !== 'function' || moduleEnabled('gym');
  el.hidden = !gymOn;
  if (!gymOn) return;

  const entries = Object.keys(state.weight || {});
  if (!entries.length || typeof weightTrendSeries !== 'function') {
    el.innerHTML = '<button type="button" class="training-weight-log" data-training-log-weight>Log weight</button>';
    return;
  }
  const trend = weightTrendSeries();
  if (!trend.length) {
    el.innerHTML = '<button type="button" class="training-weight-log" data-training-log-weight>Log weight</button>';
    return;
  }
  const latest = trend[trend.length - 1][1];
  const prev = trend.length > 1 ? trend[trend.length - 2][1] : null;
  const delta = prev !== null ? Math.round((latest - prev) * 10) / 10 : null;
  const goal = (typeof getGoals === 'function' && getGoals().weight) || 150;
  // Direction-aware, same rule as the weight card: toward the goal is good.
  const losing = latest > goal;
  const good = delta !== null && (losing ? delta <= 0 : delta >= 0);

  // One tinted pill in the sleep colour (spec section 7). It is a button, not a
  // readout with a button inside it: the whole thing opens the one weigh-in
  // sheet, so there is nothing to aim at.
  el.innerHTML = `
    <button type="button" class="dl-chip c-sleep training-weight-pill" data-training-log-weight>
      <span class="dl-dot" style="background:var(--c-sleep)"></span>
      <span class="dl-num training-weight-num">${latest}</span>
      <span class="training-weight-unit">lb</span>
      ${delta ? `<span class="training-weight-delta ${good ? 'good' : 'bad'}">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</span>` : ''}
    </button>
  `;
}

// The eyebrow above the title: "This week: 3 sessions".
//
// A SESSION, not "a day with something logged". Push Ups and Sit Ups are logged
// at one set each EVERY day as a standing habit, rest days included, so
// "anything logged" would report seven sessions a week forever. isFullSession
// (>= SESSION_MIN_SETS, or any cardio) is the line coach.js, brief.js and the
// calendar already draw, and this has to agree with them or the app contradicts
// itself on the same screen.
//
// "This week" is Monday to today, the same seven boxes the day chips draw right
// under it and the same week Today's "N sessions so far this week" counts. It
// was a rolling seven days, which read "6 sessions" above two filled chips.
function trainingSessionCount() {
  const today = (typeof getTodayStr === 'function') ? getTodayStr() : null;
  if (!today || typeof offsetDateStr !== 'function') return 0;
  const full = (typeof isFullSession === 'function') ? isFullSession : null;
  if (!full) return 0;
  const sinceMonday = (new Date(today + 'T00:00:00').getDay() + 6) % 7;
  let n = 0;
  for (let i = 0; i <= sinceMonday; i++) {
    if (full(offsetDateStr(today, -i))) n++;
  }
  return n;
}

function renderTrainingWeekLine() {
  const el = document.getElementById('trainingWeekLine');
  if (!el) return;
  const n = trainingSessionCount();
  el.innerHTML = `This week: <span class="dl-num">${n}</span> session${n === 1 ? '' : 's'}`;
}

// Seven chips, Monday to Sunday of the week you are viewing, filled in the
// `move` colour on a training day (mockup `Training / Strength`). Tapping one
// moves the log to that day, so the row is navigation as well as a readout.
//
// The fill is gated on isFullSession, never on "is there anything logged" — see
// trainingSessionCount above for why that distinction is load-bearing here.
function renderTrainingWeek() {
  const el = document.getElementById('trainingWeek');
  if (!el) return;
  const today = getTodayStr();
  const viewed = (typeof gymViewDate === 'string' && gymViewDate) ? gymViewDate : today;
  // Monday-first week containing the viewed day.
  const d = new Date(viewed + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  const monday = toLocalDateStr(d);
  const full = (typeof isFullSession === 'function') ? isFullSession : () => false;
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const chips = labels.map((lbl, i) => {
    const ds = offsetDateStr(monday, i);
    const on = ds <= today && full(ds);
    const cls = ['training-day-chip'];
    if (on) cls.push('is-session');
    if (ds === today) cls.push('is-today');
    if (ds === viewed) cls.push('is-viewed');
    if (ds > today) cls.push('is-future');
    return `<button type="button" class="${cls.join(' ')}" data-train-day="${ds}"
      aria-label="${formatDate(ds)}${on ? ', training day' : ''}" aria-pressed="${ds === viewed}">
      <span class="tdc-box"></span><span class="tdc-lbl">${lbl}</span></button>`;
  }).join('');

  el.innerHTML = chips;
}

// ---- Sub-tabs ----
// Four destinations, each one pane of markup. The panes are real containers now
// (#trainingStrength / #trainingCardio / #trainingCoach / #trainingSleep), so
// there is no per-card selector list to keep in sync any more — that list was
// the thing most likely to rot, because a card renamed in index.html vanished
// from every tab at once and nothing said so.
//
// What IS still checked at runtime is that all four panes exist
// (trainingTabAudit), because switching to a missing pane shows an empty screen.
const TRAINING_TABS = ['strength', 'cardio', 'coach', 'sleep'];
const TRAINING_TAB_KEY = 'daylign_training_tab';

// The panes, and which module has to be on for the tab to be reachable.
// Sleep follows the old rule from sleep.js: with both Gym and Cardio off there
// is no readiness to show, so the tab hides.
const TRAINING_PANES = [
  { tab: 'strength', sel: '#trainingStrength', needs: ['gym'] },
  { tab: 'cardio', sel: '#trainingCardio', needs: ['cardio'] },
  { tab: 'coach', sel: '#trainingCoach', needs: ['gym', 'cardio'] },
  { tab: 'sleep', sel: '#trainingSleep', needs: ['gym', 'cardio'] },
];

// A tab is offered when ANY module it needs is on.
function trainingTabAvailable(tab) {
  const pane = TRAINING_PANES.find(p => p.tab === tab);
  if (!pane) return false;
  if (typeof moduleEnabled !== 'function') return true;
  return pane.needs.some(m => moduleEnabled(m));
}

function trainingTab() {
  const saved = localStorage.getItem(TRAINING_TAB_KEY);
  // Old installs stored 'log' / 'progress'. Both were Strength-shaped, so map
  // them onto the Strength tab and let its own Today/Progress switch carry the
  // finer distinction.
  const mapped = saved === 'log' ? 'strength' : saved === 'progress' ? 'strength' : saved;
  const tab = TRAINING_TABS.indexOf(mapped) !== -1 ? mapped : 'strength';
  if (trainingTabAvailable(tab)) return tab;
  return TRAINING_TABS.find(trainingTabAvailable) || 'strength';
}

function setTrainingTab(tab) {
  if (TRAINING_TABS.indexOf(tab) === -1) tab = 'strength';
  localStorage.setItem(TRAINING_TAB_KEY, tab);
  // Label first, visibility second: updateHeaderActionBtn unconditionally shows
  // the header button, and applyTrainingTab is what decides Coach and Sleep
  // should not have one.
  if (typeof updateHeaderActionBtn === 'function' && typeof currentView !== 'undefined') {
    updateHeaderActionBtn(currentView);
  }
  applyTrainingTab();
  if (typeof haptic === 'function') haptic('light');
  // Landing mid-page after switching tabs feels broken; the new section should
  // start at its top.
  const shell = document.querySelector('.training-shell');
  if (shell) {
    const y = shell.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
}

function applyTrainingTab() {
  const active = trainingTab();
  TRAINING_PANES.forEach(p => {
    const el = document.querySelector(p.sel);
    if (el) el.hidden = p.tab !== active;
  });

  document.querySelectorAll('#trainingTabs [data-train-tab]').forEach(btn => {
    const tab = btn.dataset.trainTab;
    const on = tab === active;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.hidden = !trainingTabAvailable(tab);
  });

  // Strength's own Today / Progress switch.
  const sub = strengthSub();
  document.querySelectorAll('#trainingStrength [data-strength-pane]').forEach(el => {
    el.hidden = el.dataset.strengthPane !== sub;
  });
  document.querySelectorAll('#strengthSubSeg [data-strength-sub]').forEach(btn => {
    const on = btn.dataset.strengthSub === sub;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  // Watch sync is a logging question. On Coach and Sleep it is noise.
  const watch = document.getElementById('watchSync');
  if (watch) watch.hidden = !(active === 'cardio' || (active === 'strength' && sub === 'today'));
  // Same for the seven day chips: they navigate the log.
  const week = document.getElementById('trainingWeek');
  if (week) week.hidden = !(active === 'strength' || active === 'cardio');

  // Nothing is logged from Coach or Sleep, so the desktop header button
  // should not offer to log there - the header button opened
  // the exercise sheet from the Sleep screen otherwise.
  const logs = (active === 'strength' || active === 'cardio');
  if (typeof currentView !== 'undefined' && currentView === 'training') {
    const head = document.getElementById('addTaskBtn');
    if (head) head.style.display = logs ? '' : 'none';
  }
}

// Every pane must exist. Returns the ones that do not, so a test can assert on
// it rather than a tab quietly switching to an empty screen.
function trainingTabAudit() {
  return TRAINING_PANES
    .filter(p => !document.querySelector(p.sel))
    .map(p => p.tab + ' -> ' + p.sel);
}

function renderTrainingShell() {
  renderTrainingWeight();
  renderTrainingWeekLine();
  renderTrainingWeek();
  renderWatchSync();
  applyTrainingTab();
}

function renderTraining() {
  if (!document.getElementById('trainingView')) return;
  renderTrainingShell();
}

// Every listener here is on a PERSISTENT container - the shell and its rows
// survive render(), only their innerHTML is replaced - so each one is bound once
// and delegates. Binding them per render is how this app grew duplicate
// handlers before (see bindBoardDropTargets).
let trainingEventsBound = false;

function bindTrainingEvents() {
  if (trainingEventsBound) return;
  trainingEventsBound = true;

  const tabs = document.getElementById('trainingTabs');
  if (tabs) {
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-train-tab]');
      if (btn) setTrainingTab(btn.dataset.trainTab);
    });
  }

  const sub = document.getElementById('strengthSubSeg');
  if (sub) {
    sub.addEventListener('click', e => {
      const btn = e.target.closest('[data-strength-sub]');
      if (btn) setStrengthSub(btn.dataset.strengthSub);
    });
  }

  // A day chip moves the log to that day. The chips are rebuilt every render,
  // so this has to be delegated from the row.
  const week = document.getElementById('trainingWeek');
  if (week) {
    week.addEventListener('click', e => {
      const btn = e.target.closest('[data-train-day]');
      if (!btn) return;
      const ds = btn.dataset.trainDay;
      if (typeof gymViewDate !== 'undefined') gymViewDate = ds;
      if (typeof cardioDate !== 'undefined') cardioDate = ds;
      if (typeof renderGym === 'function') renderGym();
      if (typeof renderCardio === 'function') renderCardio();
      renderTrainingWeek();
    });
  }

  // The weight pill is the only weight control on this screen and it opens the
  // one weigh-in sheet (spec section 10.4).
  const weight = document.getElementById('trainingWeight');
  if (weight) {
    weight.addEventListener('click', () => {
      // The day being viewed, so a weigh-in for yesterday lands on yesterday.
      const day = (typeof gymViewDate !== 'undefined' && gymViewDate) || getTodayStr();
      if (typeof openWeightSheet === 'function') openWeightSheet({ date: day });
    });
  }

  // "Log exercise", spelled out in the pane rather than only living in the
  // header button and the thumb FAB.
  const logBtn = document.getElementById('gymLogOpenBtn');
  if (logBtn) {
    logBtn.addEventListener('click', () => {
      if (typeof openGymLogSheet === 'function') openGymLogSheet();
    });
  }
}

// ---- Apple Watch sync freshness ----
// "Did last night's shortcut actually run?" was previously only answerable by
// opening the Firebase URL in a browser. It is a daily question, so it belongs
// in the Log tab.
//
// The Shortcut records WHAT DATE each metric is for, never when it ran, so
// freshness is derived from the newest date any metric carries. If an explicit
// external/lastSync timestamp ever appears it is preferred — that only needs a
// single extra action in the Shortcut, and this will pick it up with no further
// change here.
const WATCH_METRICS = [
  { key: 'steps',           label: 'Steps' },
  { key: 'exerciseMinutes', label: 'Exercise' },
  { key: 'activeEnergy',    label: 'Active kcal' },
  { key: 'sleep',           label: 'Sleep' },
  { key: 'restingHR',       label: 'Resting HR' },
  { key: 'runDistance',     label: 'Distance' },
];

// Whatever the Shortcut managed to write, turned into a timestamp.
//
// iOS Shortcuts has no epoch format — Format Date cannot emit one without real
// contortions — but it writes an ISO string trivially. Insisting on a number
// would have pushed that awkwardness onto the phone for no reason, so this
// takes epoch milliseconds, epoch SECONDS (which is what most tools hand you,
// and is 1000x too small if taken at face value), or any parseable date string.
// Anything it cannot read comes back null and the card falls back to talking
// about the data instead of inventing a sync time.
function parseLastSync(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' || /^\d+$/.test(String(raw).trim())) {
    let n = Number(raw);
    if (!isFinite(n) || n <= 0) return null;
    if (n < 1e11) n *= 1000;          // seconds, not milliseconds
    return n;
  }
  // Shortcuts' DEFAULT date format is "August 13, 2026 at 9:14 PM", and that
  // " at " is the one thing Date.parse chokes on. Absorbing it here means the
  // stock format works and there is one less way to set this up wrong.
  const t = Date.parse(String(raw).trim().replace(/\s+at\s+/i, ' '));
  return isFinite(t) ? t : null;
}

function watchSyncStatus() {
  if (typeof externalData === 'undefined' || !externalData) return null;
  const today = getTodayStr();
  const perMetric = WATCH_METRICS.map(m => {
    const node = externalData[m.key];
    const dates = node && typeof node === 'object' ? Object.keys(node).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
    return { key: m.key, label: m.label, latest: dates.length ? dates[dates.length - 1] : null };
  });
  const withData = perMetric.filter(m => m.latest);
  if (!withData.length) return { none: true };

  const newest = withData.map(m => m.latest).sort().pop();
  const daysOld = Math.round((new Date(today + 'T00:00:00') - new Date(newest + 'T00:00:00')) / 86400000);
  // Only count a metric as current if it reaches the newest date any metric
  // reached — a partial run is the common failure and should be visible.
  const current = withData.filter(m => m.latest === newest).length;
  const explicit = parseLastSync(externalData.lastSync);
  return { newest, daysOld, current, total: WATCH_METRICS.length, perMetric, explicit };
}

function renderWatchSync() {
  const host = document.getElementById('watchSync');
  if (!host) return;
  const s = watchSyncStatus();
  if (!s) { host.innerHTML = ''; return; }
  if (s.none) {
    host.innerHTML = `<div class="watch-sync is-stale"><span class="watch-sync-dot"></span>
      <span class="watch-sync-text">No Apple Watch data yet. Set it up in Settings, Apple Watch</span></div>`;
    return;
  }

  const tone = s.daysOld <= 0 ? 'ok' : s.daysOld === 1 ? 'warn' : 'stale';
  const when = s.daysOld <= 0 ? 'today' : s.daysOld === 1 ? 'yesterday' : `${s.daysOld} days ago`;

  // Two different facts, previously said as one. "Synced yesterday" was really
  // "the newest data is dated yesterday" — which is exactly what a SUCCESSFUL
  // 9pm run produces, since it writes that day's totals. So without a real
  // timestamp the card talks about the DATA, and only claims a sync time when
  // the Shortcut has actually recorded one at external/lastSync.
  let headline;
  if (s.explicit) {
    const ran = new Date(s.explicit);
    const ranDay = toLocalDateStr(ran);
    const today = getTodayStr();
    const dayWord = ranDay === today ? 'today'
      : ranDay === offsetDateStr(today, -1) ? 'yesterday'
      : formatDate(ranDay);
    const time = ran.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    headline = `Watch synced <strong>${dayWord} at ${time}</strong>`;
  } else {
    headline = `Watch data through <strong>${formatDate(s.newest)}</strong> (${when})`;
  }
  // A partial run matters: sleep alone landing is not a successful sync.
  const partial = s.current < s.total;
  const missing = s.perMetric.filter(m => m.latest !== s.newest).map(m => m.label);

  host.innerHTML = `
    <details class="watch-sync is-${tone}">
      <summary>
        <span class="watch-sync-dot"></span>
        <span class="watch-sync-text">${headline}${partial ? ` &middot; ${s.current}/${s.total} metrics` : ''}</span>
        <span class="watch-sync-more">details</span>
      </summary>
      <div class="watch-sync-grid">
        ${s.perMetric.map(m => `
          <div class="watch-sync-row${m.latest === s.newest ? '' : ' is-behind'}">
            <span>${esc(m.label)}</span>
            <span>${m.latest ? formatDate(m.latest) : 'never'}</span>
          </div>`).join('')}
      </div>
      ${!s.explicit ? `<p class="watch-sync-note">That is the date the data covers, not when the Shortcut ran — it never records that. Add one last <em>Get Contents of URL</em> step at the END of the shortcut &mdash; PUT to <code>external/lastSync.json</code> with a Formatted Date as the body &mdash; and this shows the real time. Putting it last means the stamp only lands when the whole run finished.</p>` : ''}
      ${partial ? `<p class="watch-sync-note">${esc(missing.join(', '))} did not land in the last run. iOS skips the automation when the phone is locked — a charger-connect trigger fires more reliably than a fixed time.</p>` : ''}
    </details>`;
}
