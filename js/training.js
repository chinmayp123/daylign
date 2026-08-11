// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { updateHeaderActionBtn } from './app.js';
import { getGoals } from './diet-goals.js';
import { weightTrendSeries } from './gym.js';
import { readinessBreakdown, readinessVerdict } from './sleep.js';
import { currentView, moduleEnabled, state } from './state.js';
import { getTodayStr, toLocalDateStr } from './utils.js';
import { openWeightSheet } from './weight-sheet.js';

// ========== Training (Gym + Cardio behind one nav item) ==========
// Gym and Cardio used to be two nav items, which cost a slot the mobile bottom
// bar does not have. They are now two panes of one Training view: the shell
// (mode toggle, body-weight readout, combined-week line) is constant and only
// the pane below it swaps, so neither mode feels heavier than it did alone.
//
// Deliberately additive: the gym and cardio markup moved inside panes with
// every id intact, so gym.js and cardio.js still render into exactly what they
// always did and needed no changes.

export const TRAINING_MODE_KEY = 'daylign_training_mode';

export function trainingMode() {
  return localStorage.getItem(TRAINING_MODE_KEY) === 'cardio' ? 'cardio' : 'strength';
}

// A mode whose module is switched off in Settings is not selectable — fall back
// to whichever one is on instead of showing an empty pane.
export function effectiveTrainingMode() {
  const gymOn = typeof moduleEnabled !== 'function' || moduleEnabled('gym');
  const cardioOn = typeof moduleEnabled !== 'function' || moduleEnabled('cardio');
  const saved = trainingMode();
  if (saved === 'cardio' && !cardioOn) return 'strength';
  if (saved === 'strength' && !gymOn) return 'cardio';
  return saved;
}

export function setTrainingMode(mode) {
  localStorage.setItem(TRAINING_MODE_KEY, mode === 'cardio' ? 'cardio' : 'strength');
  applyTrainingMode();
  // The header's primary action follows the mode: Log Weight vs Log Session.
  if (typeof updateHeaderActionBtn === 'function' && typeof currentView !== 'undefined') {
    updateHeaderActionBtn(currentView);
  }
}

export function applyTrainingMode() {
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
export function renderTrainingWeight() {
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
export function trainingWeekSummary() {
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

export function renderTrainingWeek() {
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
export function renderTrainingShell() {
  renderTrainingWeight();
  renderTrainingWeek();
}

// Desktop right rail (ref 11c): the cross-mode cards that belong beside either
// logging pane — this week's training, readiness, and consistency. The rail is
// hidden on mobile (CSS), where these live in the shell/panes instead.
export function renderTrainingRail() {
  renderRailWeek();
  renderRailReadiness();
  renderRailConsistency();
}

export function renderRailWeek() {
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

export function renderRailReadiness() {
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

// Compact consistency heatmap for the rail — any lift or cardio day counts.
export function renderRailConsistency() {
  const host = document.getElementById('trainingRailConsistency');
  if (!host) return;
  // Shaded by size, not just presence — a two-set check-in and a sixteen-set
  // session used to render as the same solid square, which made a light month
  // look identical to a heavy one.
  const daySets = {};
  (state.gym || []).forEach(e => { daySets[e.date] = (daySets[e.date] || 0) + ((e.sets || []).length); });
  const cardioDays = new Set((state.cardio || []).map(s => s.date));
  const today = getTodayStr();
  const WEEKS = 12;
  const end = new Date(today + 'T00:00:00');
  const endDow = (end.getDay() + 6) % 7; // Mon = 0
  const start = new Date(end);
  start.setDate(start.getDate() - endDow - (WEEKS - 1) * 7);
  const cells = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(cur.getDate() + w * 7 + d);
      const ds = toLocalDateStr(cur);
      if (ds > today) { cells.push('<div class="streak-cell future"></div>'); continue; }
      const sets = daySets[ds] || 0;
      const lvl = cardioDays.has(ds) ? 3 : (sets === 0 ? 0 : sets < 4 ? 1 : sets < 12 ? 2 : 3);
      const note = sets ? ` · ${sets} set${sets === 1 ? '' : 's'}` : (cardioDays.has(ds) ? ' · cardio' : ' · rest');
      cells.push(`<div class="streak-cell lvl${lvl}" title="${formatDate(ds)}${note}"></div>`);
    }
  }
  host.innerHTML = `
    <div class="card training-rail-card">
      <div class="coach-head"><h2>Consistency</h2></div>
      <div class="streak-heatmap-wrap"><div class="streak-heatmap rail-heatmap">${cells.join('')}</div></div>
    </div>`;
}

export function renderTraining() {
  if (!document.getElementById('trainingView')) return;
  renderTrainingShell();
  renderTrainingRail();
  applyTrainingMode();
}

export function bindTrainingEvents() {
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


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { TRAINING_MODE_KEY: TRAINING_MODE_KEY, applyTrainingMode: applyTrainingMode, bindTrainingEvents: bindTrainingEvents, effectiveTrainingMode: effectiveTrainingMode, renderRailConsistency: renderRailConsistency, renderRailReadiness: renderRailReadiness, renderRailWeek: renderRailWeek, renderTraining: renderTraining, renderTrainingRail: renderTrainingRail, renderTrainingShell: renderTrainingShell, renderTrainingWeek: renderTrainingWeek, renderTrainingWeight: renderTrainingWeight, setTrainingMode: setTrainingMode, trainingMode: trainingMode, trainingWeekSummary: trainingWeekSummary });
