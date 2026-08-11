// ========== Sleep + Readiness ==========
// design_handoff_daylign_v2 section 6, ref 9c. Sleep was the missing input: the
// app already read Apple Health sleep but nothing ever wrote it, and there was
// no way to log a night by hand. Readiness is the payoff — one number that
// blends how you slept with how hard you have been training, so "can I focus
// today?" and "should I run hard?" have a single answer.
//
// state.sleep = { '<date>': { hours, quality } } where date is the WAKE-UP
// morning, matching how getExternalSleep keys Apple Health data.

const SLEEP_QUALITIES = [
  { key: 'poor',  label: 'Poor',  icon: '😴' },
  { key: 'good',  label: 'Good',  icon: '🙂' },
  { key: 'great', label: 'Great', icon: '⚡' },
];

// Draft state for the stepper, so nothing is written until Save is pressed.
let sleepDraftHours = null;
// True once the user has actually adjusted the stepper or picked a quality —
// until then the card mirrors the watch/logged value instead of a stale draft.
let sleepDraftDirty = false;
let sleepDraftQuality = null;

function sleepLog() {
  if (!state.sleep || typeof state.sleep !== 'object') state.sleep = {};
  return state.sleep;
}

// Hours for a morning, preferring a hand-logged night over the watch: if
// someone bothered to correct it, that is the better number.
function sleepHoursFor(dateStr) {
  const entry = sleepLog()[dateStr];
  if (entry && Number(entry.hours) > 0) return Number(entry.hours);
  if (typeof getExternalSleep === 'function') {
    const watch = getExternalSleep(dateStr);
    if (watch !== null) return watch;
  }
  return null;
}

function sleepSourceFor(dateStr) {
  const entry = sleepLog()[dateStr];
  if (entry && Number(entry.hours) > 0) return 'logged';
  if (typeof getExternalSleep === 'function' && getExternalSleep(dateStr) !== null) return 'watch';
  return null;
}

function formatSleepHours(h) {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return `${whole}:${String(mins).padStart(2, '0')}`;
}

// The last 7 mornings ending today, oldest first.
function sleepRecentNights() {
  const out = [];
  const today = getTodayStr();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - i);
    const ds = toLocalDateStr(d);
    out.push({ date: ds, hours: sleepHoursFor(ds), entry: sleepLog()[ds] || null });
  }
  return out;
}

function sleepAverage(nights) {
  const withData = nights.filter(n => n.hours !== null);
  if (!withData.length) return null;
  return withData.reduce((n, x) => n + x.hours, 0) / withData.length;
}

// ---------- Readiness ----------
// 0-100, deliberately simple and explainable rather than clever:
//   sleep (0-100)  — last 3 nights against the sleep goal, on a steep curve
//   load  (0-100)  — how hard the last 3 days were vs the usual fortnight
// Blended 65/35 once there is enough history to know a usual load; until then
// readiness is the sleep read alone. A number nobody can explain is a number
// nobody trusts.

// Watch exercise minutes that count as a training day on their own. Set above
// the incidental-movement band — a brisk walk to the shop registers ten or so
// minutes and is not a session.
const WATCH_TRAINING_MINUTES = 20;

function readinessBreakdown() {
  const goalHours = (typeof getGoals === 'function' && getGoals().sleep) || 8;
  const nights = sleepRecentNights().slice(-3).filter(n => n.hours !== null);
  if (!nights.length) return null; // nothing to go on — say so rather than guess

  const avg = nights.reduce((n, x) => n + x.hours, 0) / nights.length;

  // Sleep debt is not linear — 65% of your goal does not leave you 65% ready.
  // Hitting the goal is 100; three hours under it is 0, with a steep slope in
  // between (for an 8h goal: 8h=100, 7h=67, 6.5h=50, 5h=0).
  const clamp01 = v => Math.max(0, Math.min(1, v));
  let sleepPart = clamp01((avg - (goalHours - 3)) / 3) * 100;

  // Quality nudges it either way when the person actually told us.
  nights.forEach(n => {
    if (!n.entry || !n.entry.quality) return;
    if (n.entry.quality === 'great') sleepPart += 2;
    else if (n.entry.quality === 'poor') sleepPart -= 4;
  });
  sleepPart = Math.max(0, Math.min(100, sleepPart));

  // Training load: sessions in the last 3 days vs the daily average over 14.
  const today = getTodayStr();
  const dayset = n => {
    const s = new Set();
    for (let i = 0; i < n; i++) {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      s.add(toLocalDateStr(d));
    }
    return s;
  };
  const last3 = dayset(3), last14 = dayset(14);
  // Count training DAYS, not logged rows. A six-exercise session is one hard
  // day, not six — counting rows made a normal leg day read as a week of work.
  // The watch is also a source here: a 40 minute ride is a training day whether
  // or not it ever got typed into the cardio card.
  const countIn = set => {
    const days = new Set();
    (state.gym || []).forEach(e => { if (e && set.has(e.date)) days.add(e.date); });
    (state.cardio || []).forEach(s => { if (s && set.has(s.date)) days.add(s.date); });
    if (typeof getExternalExerciseMinutes === 'function') {
      set.forEach(d => {
        const m = getExternalExerciseMinutes(d);
        if (m !== null && m >= WATCH_TRAINING_MINUTES) days.add(d);
      });
    }
    return days.size;
  };
  const baselineSessions = countIn(last14);
  const recent = countIn(last3) / 3;
  const baseline = baselineSessions / 14;
  // A fortnight with barely any history makes the ratio meaningless — three
  // normal sessions against a near-empty baseline reads as a huge spike and
  // would tell a brand-new user to rest. Only judge load once there is enough
  // history to have a usual load at all.
  const loadKnown = baselineSessions >= 6 && baseline > 0;
  let loadPart = 100;
  if (loadKnown) {
    const ratio = recent / baseline;
    // At or below the usual load = fresh; well above = accumulating fatigue.
    loadPart = ratio <= 1 ? 100 : Math.max(25, Math.round(100 - (ratio - 1) * 62));
  }

  // When load is unknowable, readiness IS the sleep read — rescaling beats
  // handing out a flat "neutral" chunk, which would floor a 5-hour night at a
  // respectable-looking score.
  const score = loadKnown
    ? Math.round(sleepPart * 0.65 + loadPart * 0.35)
    : Math.round(sleepPart);

  return {
    score: Math.max(0, Math.min(100, score)),
    avgHours: avg,
    goalHours: goalHours,
    shortSleep: avg < goalHours - 1,
    // Only true when we had enough history to actually judge load.
    loadHigh: loadKnown && loadPart < 70,
  };
}

function readinessScore() {
  const b = readinessBreakdown();
  return b ? b.score : null;
}

function readinessVerdict(score) {
  if (score >= 75) return { label: 'Good to go', tone: 'good' };
  if (score >= 55) return { label: 'Steady', tone: 'warn' };
  return { label: 'Ease off', tone: 'bad' };
}

// Names the actual driver rather than asserting one. Saying "you have been
// training heavy" when the real problem is sleep sends people to fix the wrong
// thing — and the load half is only meaningful once there is history for it.
function readinessAdvice(b) {
  if (!b) return '';
  const { score, avgHours, goalHours, shortSleep, loadHigh } = b;
  if (score >= 75) {
    if (loadHigh) return 'Sleeping well, though recent load is above your usual. Good to go — just do not stack another hard day on top.';
    return `Sleep is holding at ${formatSleepHours(avgHours)} and effort has been manageable. Good day for the hard session.`;
  }
  if (score >= 55) {
    if (shortSleep && loadHigh) return `${formatSleepHours(avgHours)} average against a ${goalHours}h goal, on top of a heavy stretch. Keep today moderate.`;
    if (shortSleep) return `Averaging ${formatSleepHours(avgHours)} against a ${goalHours}h goal — sleep is the limiter today, not your legs. Keep it moderate.`;
    if (loadHigh) return 'Sleep is fine; it is the training load that is elevated. Moderate effort today.';
    return 'Middle of the road. Nothing is flagging, so train by feel.';
  }
  if (shortSleep && loadHigh) return 'Short sleep and a heavy training stretch together. Take today easy, or rest outright.';
  if (shortSleep) return `Only ${formatSleepHours(avgHours)} a night against a ${goalHours}h goal. Sleep is the thing to fix before adding any more training.`;
  return 'Recent load is well above your usual. A rest day now beats a forced one later.';
}

// ---------- Rendering ----------
function renderSleepCard() {
  const host = document.getElementById('sleepCard');
  if (!host) return;
  if (typeof moduleEnabled === 'function' && !moduleEnabled('gym') && !moduleEnabled('cardio')) {
    host.hidden = true;
    return;
  }
  host.hidden = false;

  const today = getTodayStr();
  const existing = sleepLog()[today];
  const watch = (typeof getExternalSleep === 'function') ? getExternalSleep(today) : null;
  // Keep the stepper pinned to the real value until the user actually touches
  // it. The draft used to be set once, on first render — which happens BEFORE
  // the watch data has loaded from Firebase, so it fell through to the
  // hardcoded 7.5 and then refused to update when the real number arrived.
  // The card ended up showing "7:30 — from your watch" over a 5.0h night, and
  // pressing Save would have written that made-up 7.5 over the real reading.
  const sourceHours = (existing && Number(existing.hours)) || watch || null;
  if (!sleepDraftDirty) {
    sleepDraftHours = sourceHours !== null ? sourceHours : 7.5;
  } else if (sleepDraftHours === null) {
    sleepDraftHours = sourceHours !== null ? sourceHours : 7.5;
  }
  if (sleepDraftQuality === null && existing && existing.quality) sleepDraftQuality = existing.quality;

  const nights = sleepRecentNights();
  const avg = sleepAverage(nights);
  const max = Math.max(9, ...nights.map(n => n.hours || 0));
  const source = sleepSourceFor(today);

  const bars = nights.map(n => {
    const pct = n.hours ? Math.round((n.hours / max) * 100) : 0;
    const dow = new Date(n.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
    const q = n.entry && n.entry.quality ? n.entry.quality : '';
    const title = n.hours ? `${formatSleepHours(n.hours)} on ${formatDate(n.date)}` : `No sleep logged for ${formatDate(n.date)}`;
    return `<div class="sleep-bar-col" title="${title}">
      <div class="sleep-bar-track"><div class="sleep-bar-fill ${q}" style="height:${pct}%"></div></div>
      <span class="sleep-bar-day">${dow}</span>
    </div>`;
  }).join('');

  host.innerHTML = `
    <div class="card sleep-card">
      <div class="coach-head">
        <h2>Sleep</h2>
        <span class="weight-goal-chip">${avg !== null ? formatSleepHours(avg) + ' avg' : 'no nights yet'}</span>
      </div>

      <div class="sleep-log">
        <span class="sleep-log-label">Last night${source === 'watch' ? ' · ⌚ from your watch' : ''}</span>
        <div class="sleep-stepper">
          <button type="button" class="sleep-step-btn" data-sleep-step="-0.25" aria-label="Less sleep">−</button>
          <span class="sleep-hours" id="sleepHoursVal">${formatSleepHours(sleepDraftHours)}</span>
          <button type="button" class="sleep-step-btn" data-sleep-step="0.25" aria-label="More sleep">+</button>
        </div>
        <span class="sleep-hours-sub">hrs asleep</span>
        <div class="sleep-quality">
          ${SLEEP_QUALITIES.map(q => `
            <button type="button" class="sleep-q-btn${sleepDraftQuality === q.key ? ' active ' + q.key : ''}" data-sleep-quality="${q.key}">
              <span aria-hidden="true">${q.icon}</span> ${q.label}
            </button>`).join('')}
        </div>
        <button type="button" class="btn-primary sleep-save-btn" id="sleepSaveBtn">Save</button>
      </div>

      <div class="sleep-trend">
        <span class="sleep-trend-label">7-night trend</span>
        <div class="sleep-bars">${bars}</div>
      </div>
    </div>`;
}

function renderReadinessCard() {
  const host = document.getElementById('readinessCard');
  if (!host) return;
  if (typeof moduleEnabled === 'function' && !moduleEnabled('gym') && !moduleEnabled('cardio')) {
    host.hidden = true;
    return;
  }
  host.hidden = false;

  const breakdown = readinessBreakdown();
  const score = breakdown ? breakdown.score : null;
  if (score === null) {
    host.innerHTML = `
      <div class="card readiness-card">
        <div class="coach-head"><h2>Readiness</h2></div>
        <p class="readiness-empty">Log a night's sleep and this turns into a single read on whether to push today or back off.</p>
      </div>`;
    return;
  }
  const verdict = readinessVerdict(score);
  const deg = Math.round((score / 100) * 360);

  host.innerHTML = `
    <div class="card readiness-card">
      <div class="coach-head">
        <h2>Readiness</h2>
        <span class="readiness-chip ${verdict.tone}">${verdict.label}</span>
      </div>
      <div class="readiness-body">
        <div class="readiness-ring ${verdict.tone}" style="--ready-deg:${deg}deg">
          <span class="readiness-score">${score}</span>
          <span class="readiness-unit">ready</span>
        </div>
        <p class="readiness-advice">${readinessAdvice(breakdown)}</p>
      </div>
    </div>`;
}

function renderSleep() {
  renderSleepCard();
  renderReadinessCard();
}

// Delegated on document: both cards are re-rendered wholesale by render(), so
// listeners bound to their innards would not survive.
function bindSleepEvents() {
  document.addEventListener('click', e => {
    const step = e.target.closest('[data-sleep-step]');
    if (step) {
      const delta = Number(step.dataset.sleepStep) || 0;
      sleepDraftDirty = true;
      sleepDraftHours = Math.max(0, Math.min(14, Math.round((sleepDraftHours + delta) * 100) / 100));
      const val = document.getElementById('sleepHoursVal');
      if (val) val.textContent = formatSleepHours(sleepDraftHours);
      return;
    }
    const q = e.target.closest('[data-sleep-quality]');
    if (q) {
      sleepDraftDirty = true;
      sleepDraftQuality = q.dataset.sleepQuality;
      renderSleepCard();
      return;
    }
    if (e.target.closest('#sleepSaveBtn')) {
      const today = getTodayStr();
      sleepLog()[today] = {
        hours: Math.round(sleepDraftHours * 100) / 100,
        quality: sleepDraftQuality || 'good',
      };
      saveData(state);
      if (typeof showToast === 'function') showToast(`Sleep logged: ${formatSleepHours(sleepDraftHours)}`);
      renderSleep();
      // Sleep feeds the dashboard tile and the weekly report too.
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  });
}
