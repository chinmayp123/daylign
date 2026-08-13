// ========== Training (Gym + Cardio behind one nav item) ==========
// Gym and Cardio used to be two nav items, which cost a slot the mobile bottom
// bar does not have. They are now two panes of one Training view: the shell
// (mode toggle, body-weight readout, combined-week line) is constant and only
// the pane below it swaps, so neither mode feels heavier than it did alone.
//
// Deliberately additive: the gym and cardio markup moved inside panes with
// every id intact, so gym.js and cardio.js still render into exactly what they
// always did and needed no changes.

const TRAINING_MODE_KEY = 'daylign_training_mode';

function trainingMode() {
  return localStorage.getItem(TRAINING_MODE_KEY) === 'cardio' ? 'cardio' : 'strength';
}

// A mode whose module is switched off in Settings is not selectable — fall back
// to whichever one is on instead of showing an empty pane.
function effectiveTrainingMode() {
  const gymOn = typeof moduleEnabled !== 'function' || moduleEnabled('gym');
  const cardioOn = typeof moduleEnabled !== 'function' || moduleEnabled('cardio');
  const saved = trainingMode();
  if (saved === 'cardio' && !cardioOn) return 'strength';
  if (saved === 'strength' && !gymOn) return 'cardio';
  return saved;
}

function setTrainingMode(mode) {
  localStorage.setItem(TRAINING_MODE_KEY, mode === 'cardio' ? 'cardio' : 'strength');
  applyTrainingMode();
  // The header's primary action follows the mode: Log Weight vs Log Session.
  if (typeof updateHeaderActionBtn === 'function' && typeof currentView !== 'undefined') {
    updateHeaderActionBtn(currentView);
  }
}

function applyTrainingMode() {
  const mode = effectiveTrainingMode();
  const strength = document.getElementById('trainingStrength');
  const cardio = document.getElementById('trainingCardio');
  if (strength) strength.hidden = mode !== 'strength';
  if (cardio) cardio.hidden = mode !== 'cardio';

  const gymOn = typeof moduleEnabled !== 'function' || moduleEnabled('gym');
  const cardioOn = typeof moduleEnabled !== 'function' || moduleEnabled('cardio');
  document.querySelectorAll('#trainingToggle .training-mode-btn').forEach(btn => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    // With only one module on there is nothing to toggle between — hide the pair.
    btn.hidden = btn.dataset.mode === 'cardio' ? !cardioOn : !gymOn;
  });
  const toggle = document.getElementById('trainingToggle');
  if (toggle) toggle.hidden = !(gymOn && cardioOn);
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

  el.innerHTML = `
    <span class="training-weight-num">${latest}</span>
    <span class="training-weight-unit">lbs</span>
    ${delta ? `<span class="training-weight-delta ${good ? 'good' : 'bad'}">${delta > 0 ? '↑' : '↓'}${Math.abs(delta)}</span>` : ''}
    <button type="button" class="training-weight-log" data-training-log-weight>Log</button>
  `;
}

// "3 lifts · 4 runs · 🔥12" — the point of the merge is that the week reads as
// one story instead of two separate tabs.
function trainingWeekSummary() {
  const today = getTodayStr();
  const window7 = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - i);
    window7.add(toLocalDateStr(d));
  }
  const liftDays = new Set((state.gym || []).filter(e => window7.has(e.date)).map(e => e.date));
  const sessions = (state.cardio || []).filter(s => window7.has(s.date));
  // "Runs" means runs — a ride or a swim counted here would contradict the
  // mileage next to it, which only sums running. Other types still feed the
  // streak below, since they are training either way.
  const runs = sessions.filter(s => s.type === 'run');
  const runMiles = runs.reduce((n, s) => n + (Number(s.distance) || 0), 0);
  const crossTrain = sessions.length - runs.length;

  // Current training streak, counting any logged lift or cardio session.
  // Yesterday still counts so a morning view doesn't read as a broken streak.
  const active = new Set([...(state.gym || []).map(e => e.date), ...(state.cardio || []).map(s => s.date)]);
  let streak = 0;
  const cursor = new Date(today + 'T00:00:00');
  if (!active.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (active.has(toLocalDateStr(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  return { lifts: liftDays.size, runs: runs.length, runMiles, crossTrain, streak };
}

function renderTrainingWeek() {
  const el = document.getElementById('trainingWeek');
  if (!el) return;
  const s = trainingWeekSummary();
  const gymOn = typeof moduleEnabled !== 'function' || moduleEnabled('gym');
  const cardioOn = typeof moduleEnabled !== 'function' || moduleEnabled('cardio');

  const chips = [];
  if (gymOn) chips.push(`<span class="training-week-chip">${s.lifts} lift${s.lifts === 1 ? '' : 's'}</span>`);
  if (cardioOn) {
    const miles = s.runMiles > 0 ? ` · ${s.runMiles.toFixed(1)} mi` : '';
    chips.push(`<span class="training-week-chip alt">${s.runs} run${s.runs === 1 ? '' : 's'}${miles}</span>`);
    if (s.crossTrain > 0) {
      chips.push(`<span class="training-week-chip alt">${s.crossTrain} cross</span>`);
    }
  }
  if (s.streak > 0) chips.push(`<span class="training-week-streak">🔥 ${s.streak}</span>`);

  el.innerHTML = `<span class="training-week-label">This week</span><span class="training-week-chips">${chips.join('')}</span>`;
}

// Just the numbers in the shell. Split out so gym.js/cardio.js can refresh it
// after a save without re-running the mode/visibility logic.
// ---- Section tabs ----
// The Strength pane stacked eight top-level cards in a single scroll: log,
// activity, coach, goals, analytics, consistency, recovery, weight. Everything
// past the log needed a long thumb journey to reach, and the page read as
// endless — you never felt like you had arrived anywhere.
//
// Same cards, three destinations. Nothing was deleted or rewritten; each card
// is simply assigned to a tab and hidden when another is showing.
//
// Declarative on purpose, and every selector is checked at runtime by
// trainingTabAudit() — a tab silently pointing at an element that no longer
// exists is exactly the bug that bit the dashboard widget toggles.
const TRAINING_TABS = ['log', 'progress', 'coach'];
const TRAINING_TAB_KEY = 'daylign_training_tab';

const TRAINING_SECTIONS = [
  // --- Log: the daily job ---
  { tab: 'log', sel: '#watchSync' },
  { tab: 'log', sel: '#trainingStrength .gym-date-bar' },
  { tab: 'log', sel: '.gym-log-card' },
  { tab: 'log', sel: '#activityBreakdown' },
  { tab: 'log', sel: '#trainingCardio .gym-date-bar' },
  { tab: 'log', sel: '#cardioQuick' },
  { tab: 'log', sel: '.cardio-add-card' },
  { tab: 'log', sel: '#cardioWatchWorkouts' },
  { tab: 'log', sel: '#cardioDayList' },

  // --- Progress: am I actually getting better ---
  { tab: 'progress', sel: '#strengthAnalytics' },
  { tab: 'progress', sel: '.goal-progress-card' },
  { tab: 'progress', sel: '.streak-card' },
  { tab: 'progress', sel: '.weight-trend-card' },
  { tab: 'progress', sel: '#trainingCardio .cardio-card:not(.cardio-race):not([data-collapse-key="cardiocoach"]):not([data-collapse-key="cardioracetarget"])' },
  { tab: 'progress', sel: '#cardioRace' },
  { tab: 'progress', sel: '[data-collapse-key="cardioracetarget"]' },

  // --- Coach: what should I do about it ---
  { tab: 'coach', sel: '.coach-merged' },
  { tab: 'coach', sel: '.recovery-card' },
  { tab: 'coach', sel: '[data-collapse-key="cardiocoach"]' },
];

function trainingTab() {
  const saved = localStorage.getItem(TRAINING_TAB_KEY);
  return TRAINING_TABS.indexOf(saved) !== -1 ? saved : 'log';
}

function setTrainingTab(tab) {
  if (TRAINING_TABS.indexOf(tab) === -1) tab = 'log';
  localStorage.setItem(TRAINING_TAB_KEY, tab);
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
  TRAINING_SECTIONS.forEach(sec => {
    document.querySelectorAll(sec.sel).forEach(el => {
      // dataset rather than [hidden] so the panes' own show/hide for
      // Strength vs Cardio keeps working independently of this.
      el.classList.toggle('train-tab-off', sec.tab !== active);
    });
  });
  document.querySelectorAll('#trainingTabs .training-tab').forEach(btn => {
    const on = btn.dataset.trainTab === active;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  // The logging sheet is only reachable from the Log tab, so the primary
  // action should not offer it from Progress or Coach.
  const fabLabel = document.getElementById('primaryFabLabel');
  if (fabLabel && typeof currentView !== 'undefined' && currentView === 'training') {
    const fab = document.getElementById('primaryFab');
    if (fab) fab.hidden = active !== 'log';
  }
}

function bindTrainingTabs() {
  const host = document.getElementById('trainingTabs');
  if (!host) return;
  host.addEventListener('click', e => {
    const btn = e.target.closest('[data-train-tab]');
    if (btn) setTrainingTab(btn.dataset.trainTab);
  });
}

// Every selector must resolve to something. Returns the ones that do not, so a
// test can assert on it rather than a card quietly vanishing from all three tabs.
function trainingTabAudit() {
  return TRAINING_SECTIONS
    .filter(sec => !document.querySelector(sec.sel))
    .map(sec => sec.tab + ' -> ' + sec.sel);
}

function renderTrainingShell() {
  renderTrainingWeight();
  renderTrainingWeek();
  renderWatchSync();
  applyTrainingTab();
}

// Desktop right rail (ref 11c): the cross-mode cards that belong beside either
// logging pane — this week's training, readiness, and consistency. The rail is
// hidden on mobile (CSS), where these live in the shell/panes instead.
function renderTrainingRail() {
  renderRailWeek();
  renderRailReadiness();
  renderRailConsistency();
}

function renderRailWeek() {
  const host = document.getElementById('trainingRailWeek');
  if (!host) return;
  const s = trainingWeekSummary();
  const gymOn = typeof moduleEnabled !== 'function' || moduleEnabled('gym');
  const cardioOn = typeof moduleEnabled !== 'function' || moduleEnabled('cardio');
  const tiles = [];
  if (gymOn) tiles.push({ v: s.lifts, l: 'lifts' });
  if (cardioOn) tiles.push({ v: s.runs, l: 'runs', sub: s.runMiles > 0 ? `${s.runMiles.toFixed(1)} mi` : '' });
  if (s.crossTrain > 0) tiles.push({ v: s.crossTrain, l: 'cross' });
  host.innerHTML = `
    <div class="card training-rail-card">
      <div class="coach-head">
        <h2>This week's training</h2>
        ${s.streak > 0 ? `<span class="training-week-streak">🔥 ${s.streak}</span>` : ''}
      </div>
      <div class="rail-week-tiles">
        ${tiles.map(t => `
          <div class="rail-week-tile">
            <span class="rail-week-val">${t.v}</span>
            <span class="rail-week-lbl">${t.l}${t.sub ? ` · ${t.sub}` : ''}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderRailReadiness() {
  const host = document.getElementById('trainingRailReadiness');
  if (!host) return;
  if (typeof readinessBreakdown !== 'function') { host.innerHTML = ''; return; }
  const b = readinessBreakdown();
  if (!b) {
    host.innerHTML = `
      <div class="card training-rail-card">
        <div class="coach-head"><h2>Readiness</h2></div>
        <p class="readiness-empty">Log a night's sleep and this turns into a single read on whether to push today.</p>
      </div>`;
    return;
  }
  const v = readinessVerdict(b.score);
  const deg = Math.round((b.score / 100) * 360);
  host.innerHTML = `
    <div class="card training-rail-card">
      <div class="coach-head">
        <h2>Readiness</h2>
        <span class="readiness-chip ${v.tone}">${v.label}</span>
      </div>
      <div class="readiness-body">
        <div class="readiness-ring ${v.tone}" style="--ready-deg:${deg}deg">
          <span class="readiness-score">${b.score}</span>
          <span class="readiness-unit">ready</span>
        </div>
        <p class="readiness-advice">${readinessAdvice(b)}</p>
      </div>
    </div>`;
}

// Consistency calendar for the desktop rail. It shares the exact renderer the
// in-pane card uses (renderConsistencyCalendar in gym.js), so the muscle-group
// colours, weekday/month labels and the 3-exercise "real session" bar are the
// same wherever it shows. The in-pane copy is hidden at this width, so there is
// no duplication.
function renderRailConsistency() {
  const host = document.getElementById('trainingRailConsistency');
  if (!host) return;
  host.innerHTML = `
    <div class="card training-rail-card">
      <div class="coach-head"><h2>Consistency</h2></div>
      <div class="gym-cal-wrap"><div class="gym-cal" id="railStreakHeatmap"></div></div>
    </div>`;
  const grid = document.getElementById('railStreakHeatmap');
  if (grid && typeof renderConsistencyCalendar === 'function') {
    const daySets = {};
    (state.gym || []).forEach(e => { daySets[e.date] = (daySets[e.date] || 0) + ((e.sets || []).length); });
    renderConsistencyCalendar(grid, daySets, getTodayStr());
  }
}

function renderTraining() {
  if (!document.getElementById('trainingView')) return;
  renderTrainingShell();
  renderTrainingRail();
  applyTrainingMode();
}

function bindTrainingEvents() {
  bindTrainingTabs();
  const toggle = document.getElementById('trainingToggle');
  if (toggle) {
    toggle.addEventListener('click', e => {
      const btn = e.target.closest('.training-mode-btn');
      if (btn) setTrainingMode(btn.dataset.mode);
    });
  }
  // Delegated: the readout is re-rendered on every render(), so a direct
  // listener would be lost each time. Tapping the readout opens the
  // weight-trend sheet (ref 5b) where the trend + log input live.
  const weight = document.getElementById('trainingWeight');
  if (weight) {
    weight.addEventListener('click', () => {
      if (typeof openWeightSheet === 'function') openWeightSheet();
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
  const explicit = externalData.lastSync ? Number(externalData.lastSync) : null;
  return { newest, daysOld, current, total: WATCH_METRICS.length, perMetric, explicit };
}

function renderWatchSync() {
  const host = document.getElementById('watchSync');
  if (!host) return;
  const s = watchSyncStatus();
  if (!s) { host.innerHTML = ''; return; }
  if (s.none) {
    host.innerHTML = `<div class="watch-sync is-stale"><span class="watch-sync-dot"></span>
      <span class="watch-sync-text">No Apple Watch data yet — see Settings &rsaquo; Connect Apple Watch</span></div>`;
    return;
  }

  const tone = s.daysOld <= 0 ? 'ok' : s.daysOld === 1 ? 'warn' : 'stale';
  const when = s.daysOld <= 0 ? 'today' : s.daysOld === 1 ? 'yesterday' : `${s.daysOld} days ago`;
  // A partial run matters: sleep alone landing is not a successful sync.
  const partial = s.current < s.total;
  const missing = s.perMetric.filter(m => m.latest !== s.newest).map(m => m.label);

  host.innerHTML = `
    <details class="watch-sync is-${tone}">
      <summary>
        <span class="watch-sync-dot"></span>
        <span class="watch-sync-text">Watch synced <strong>${when}</strong>${partial ? ` &middot; ${s.current}/${s.total} metrics` : ''}</span>
        <span class="watch-sync-more">details</span>
      </summary>
      <div class="watch-sync-grid">
        ${s.perMetric.map(m => `
          <div class="watch-sync-row${m.latest === s.newest ? '' : ' is-behind'}">
            <span>${esc(m.label)}</span>
            <span>${m.latest ? formatDate(m.latest) : 'never'}</span>
          </div>`).join('')}
      </div>
      ${partial ? `<p class="watch-sync-note">${esc(missing.join(', '))} did not land in the last run. iOS skips the automation when the phone is locked — a charger-connect trigger fires more reliably than a fixed time.</p>` : ''}
    </details>`;
}
