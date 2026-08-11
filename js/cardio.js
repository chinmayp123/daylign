// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { render } from './app.js';
import { getGoals } from './diet-goals.js';
import { getExternalCycleDistance, getExternalRunDistance, getExternalSwimDistance, getExternalWorkouts } from './firebase-sync.js';
import { latestBodyWeightLbs, offsetDateStr } from './gym.js';
import { moduleEnabled, saveData, state } from './state.js';
import { emptyState, esc, formatDate, getTodayStr, showToast, toLocalDateStr } from './utils.js';

// ========== Cardio ==========
// Endurance training: running, cycling, swimming. Separate from Gym because
// the unit of work is a session (distance + duration), not sets and reps, and
// the interesting numbers are pace and weekly volume rather than tonnage.

export const CARDIO_TYPES = {
  run:  { label: 'Run',   icon: '🏃', unit: 'mi', unitLong: 'miles', paceLabel: 'min/mi' },
  ride: { label: 'Ride',  icon: '🚴', unit: 'mi', unitLong: 'miles', paceLabel: 'mph' },
  swim: { label: 'Swim',  icon: '🏊', unit: 'yd', unitLong: 'yards', paceLabel: 'min/100yd' },
};

// Races people actually train for, in miles. Half marathon is the default
// because that is what this view was built for.
export const RACE_DISTANCES = {
  '5k':      { label: '5K',            miles: 3.107 },
  '10k':     { label: '10K',           miles: 6.214 },
  'half':    { label: 'Half Marathon', miles: 13.109 },
  'full':    { label: 'Marathon',      miles: 26.219 },
};

export let cardioDate = getTodayStr();
export let cardioType = 'run';
// The type tab defaults to whatever you actually train, resolved once per
// session from your history. Hard-defaulting to 'run' meant a cyclist had to
// re-pick "Ride" every single time they opened the view.
export let cardioTypeResolved = false;
export let cardioRunType = 'easy'; // intensity for the run being logged

// Run intensity types (handoff §3), colour-coded. Only apply to runs — a ride
// or swim just has a distance and a duration.
export const RUN_TYPES = {
  easy:     { label: 'Easy',     color: 'var(--green)' },
  tempo:    { label: 'Tempo',    color: 'var(--yellow)' },
  interval: { label: 'Interval', color: 'var(--red)' },
  long:     { label: 'Long',     color: 'var(--accent)' },
  recovery: { label: 'Recovery', color: 'var(--blue)' },
};

// Heart-rate zones (Z1–Z5). Thresholds are % of an estimated max HR (220−age),
// falling back to age 30 when we don't know it. The zone bar highlights the
// zone a logged avg HR lands in — a rough but useful read of how hard it was.
export function runnerMaxHr() {
  const age = (state.goals && Number(state.goals.age)) || (typeof getGoals === 'function' && Number(getGoals().age)) || 30;
  return 220 - (age > 0 && age < 100 ? age : 30);
}
export function hrZone(avgHr) {
  if (!(avgHr > 0)) return 0;
  const pct = avgHr / runnerMaxHr();
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}
export const ZONE_COLORS = ['', 'var(--text-muted)', 'var(--blue)', 'var(--green)', 'var(--yellow)', 'var(--red)'];
export const ZONE_NAMES = ['', 'Recovery', 'Easy', 'Aerobic', 'Threshold', 'VO₂ max'];

export function cardioGoals() {
  const g = state.goals || {};
  return {
    raceKey: RACE_DISTANCES[g.raceKey] ? g.raceKey : 'half',
    raceDate: g.raceDate || '',
    weeklyMiles: Number(g.weeklyMiles) > 0 ? Number(g.weeklyMiles) : 15,
  };
}

export function cardioSessionsFor(dateStr) {
  return (state.cardio || []).filter(s => s.date === dateStr);
}

// ---------- Pace ----------
// Each discipline reports the number its athletes actually talk in: runners
// think in minutes per mile, cyclists in mph, swimmers in minutes per 100yd.
export function paceFor(session) {
  const dist = Number(session.distance) || 0;
  const mins = Number(session.duration) || 0;
  if (dist <= 0 || mins <= 0) return null;
  if (session.type === 'ride') return { value: dist / (mins / 60), label: 'mph', text: (dist / (mins / 60)).toFixed(1) + ' mph' };
  if (session.type === 'swim') {
    const per100 = mins / (dist / 100);
    return { value: per100, label: 'min/100yd', text: formatPaceMinutes(per100) + ' /100yd' };
  }
  const perMile = mins / dist;
  return { value: perMile, label: 'min/mi', text: formatPaceMinutes(perMile) + ' /mi' };
}

export function formatPaceMinutes(mins) {
  if (!isFinite(mins) || mins <= 0) return '—';
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  // 7:60 is not a pace — carry the rounding into the minutes.
  if (s === 60) return (m + 1) + ':00';
  return m + ':' + String(s).padStart(2, '0');
}

export function formatDuration(mins) {
  const total = Math.round(Number(mins) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------- Calorie burn ----------
// MET values scale with effort, so a 7:00/mi run does not score the same as a
// 12:00/mi shuffle. These linear fits track the Compendium of Physical
// Activities closely across the range people actually train in.
export function cardioMet(session) {
  const pace = paceFor(session);
  // No pace means no distance was logged (common for indoor bikes). The work
  // still happened, so fall back to a moderate MET for the discipline rather
  // than scoring the session as zero calories.
  if (!pace) {
    if (session.type === 'ride') return 7.0;  // stationary/moderate cycling
    if (session.type === 'swim') return 8.3;
    return session.type === 'run' ? 9.8 : 0;  // moderate running
  }
  if (session.type === 'ride') {
    // ~8.4 MET at 12 mph, ~12.3 at 20 mph
    return Math.max(4, Math.min(16, 0.49 * pace.value + 2.5));
  }
  if (session.type === 'swim') {
    return 8.3; // moderate freestyle laps
  }
  const mph = 60 / pace.value;
  // ~9.9 MET at 10:00/mi, ~12.4 at 8:00/mi
  return Math.max(6, Math.min(19, 1.65 * mph));
}

export function cardioBurnForDate(dateStr) {
  const kg = latestBodyWeightLbs() * 0.4536;
  return Math.round(cardioSessionsFor(dateStr).reduce((cal, s) => {
    return cal + cardioMet(s) * kg * ((Number(s.duration) || 0) / 60);
  }, 0));
}

// ---------- Weekly volume ----------
export function cardioWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay()); // weeks start Sunday, matching the calendar
  return toLocalDateStr(d);
}

export function cardioWeekStats(weekStartStr) {
  const start = new Date(weekStartStr + 'T12:00:00');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(toLocalDateStr(d));
  }
  const sessions = (state.cardio || []).filter(s => days.indexOf(s.date) !== -1);
  const stats = { sessions: sessions.length, days: new Set(sessions.map(s => s.date)).size, byType: {}, runMiles: 0, longestRun: 0, totalMinutes: 0 };
  Object.keys(CARDIO_TYPES).forEach(t => { stats.byType[t] = { distance: 0, minutes: 0, count: 0 }; });
  sessions.forEach(s => {
    const bucket = stats.byType[s.type];
    if (!bucket) return;
    bucket.distance += Number(s.distance) || 0;
    bucket.minutes += Number(s.duration) || 0;
    bucket.count += 1;
    stats.totalMinutes += Number(s.duration) || 0;
    if (s.type === 'run') {
      stats.runMiles += Number(s.distance) || 0;
      if ((Number(s.distance) || 0) > stats.longestRun) stats.longestRun = Number(s.distance) || 0;
    }
  });
  return stats;
}

// ---------- Race prediction ----------
// Riegel's formula: T2 = T1 * (D2/D1)^1.06. Well established for predicting
// across race distances, and honest about its limits — it assumes you have
// actually trained for the longer distance, which is exactly what the weekly
// mileage check below is for.
export function predictRaceTime(raceMiles) {
  const runs = (state.cardio || [])
    .filter(s => s.type === 'run' && Number(s.distance) >= 3 && Number(s.duration) > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);
  if (!runs.length) return null;
  // Best recent effort, not the average — prediction should reflect what the
  // legs can do on a good day, which is what race day is.
  let best = null;
  runs.forEach(s => {
    const t = (Number(s.duration) || 0) * Math.pow(raceMiles / Number(s.distance), 1.06);
    if (best === null || t < best.time) best = { time: t, from: s };
  });
  return best;
}

export function formatRaceTime(mins) {
  const total = Math.round(mins * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const race = new Date(dateStr + 'T12:00:00');
  const today = new Date(getTodayStr() + 'T12:00:00');
  return Math.round((race - today) / (1000 * 60 * 60 * 24));
}

// ---------- Coach ----------
// Deliberately few rules, each tied to a number on screen. Endurance advice is
// mostly "build gradually and run long once a week"; anything more prescriptive
// would be guessing at a plan we cannot see.
export function cardioCoach() {
  const g = cardioGoals();
  const race = RACE_DISTANCES[g.raceKey];
  const thisWeek = cardioWeekStats(cardioWeekStart(getTodayStr()));
  const prevWeekStart = (() => {
    const d = new Date(cardioWeekStart(getTodayStr()) + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    return toLocalDateStr(d);
  })();
  const lastWeek = cardioWeekStats(prevWeekStart);
  const recs = [];
  const days = daysUntil(g.raceDate);

  if (!state.cardio || !state.cardio.length) {
    recs.push({ type: 'info', text: 'Log your first run, ride or swim and this fills in with pace, weekly volume and a predicted finish time.' });
    return recs;
  }

  // 10% rule — the classic overuse guard.
  if (lastWeek.runMiles > 0 && thisWeek.runMiles > lastWeek.runMiles * 1.1) {
    recs.push({ type: 'warn', text: `Run volume is up ${Math.round((thisWeek.runMiles / lastWeek.runMiles - 1) * 100)}% on last week (${lastWeek.runMiles.toFixed(1)} → ${thisWeek.runMiles.toFixed(1)} mi). Jumps over ~10% a week are where injuries come from — hold here next week.` });
  }

  // Long run should be roughly a third of weekly volume, and needs to approach
  // race distance before race day.
  if (thisWeek.runMiles >= 5 && thisWeek.longestRun < thisWeek.runMiles * 0.25) {
    recs.push({ type: 'warn', text: `Your longest run this week is ${thisWeek.longestRun.toFixed(1)} mi out of ${thisWeek.runMiles.toFixed(1)} total. One genuinely long run is what builds endurance — aim for about a third of the week in a single effort.` });
  }

  if (days !== null && days > 0 && race) {
    if (days <= 14 && thisWeek.runMiles > g.weeklyMiles) {
      recs.push({ type: 'info', text: `${days} days out — this is taper time. Cut weekly volume by 30–40% and keep the intensity, not the mileage.` });
    } else if (days > 21 && thisWeek.longestRun < race.miles * 0.6) {
      recs.push({ type: 'info', text: `Longest run so far is ${thisWeek.longestRun.toFixed(1)} mi. Build toward ${(race.miles * 0.75).toFixed(1)}+ mi before ${race.label} day — you do not need the full distance in training, but you need close.` });
    }
  }

  if (thisWeek.days === 0) {
    recs.push({ type: 'warn', text: 'Nothing logged this week yet. Consistency beats any single session.' });
  } else if (thisWeek.days >= 4) {
    recs.push({ type: 'good', text: `${thisWeek.days} training days this week — that is the habit that gets you to the start line.` });
  }

  const swim = thisWeek.byType.swim;
  const ride = thisWeek.byType.ride;
  if (swim.count > 0 || ride.count > 0) {
    recs.push({ type: 'good', text: `Cross-training logged (${[swim.count ? swim.count + ' swim' : '', ride.count ? ride.count + ' ride' : ''].filter(Boolean).join(', ')}). Low-impact volume builds aerobic base without adding pounding.` });
  }

  return recs;
}

// ---------- Apple Watch workouts (imported from Apple Health) ----------
// Map Apple's workout activity name to one of our cardio types.
export function mapWatchWorkoutType(t) {
  const s = String(t || '').toLowerCase();
  if (s.indexOf('run') !== -1) return 'run';
  if (s.indexOf('cycl') !== -1 || s.indexOf('bike') !== -1 || s.indexOf('ride') !== -1) return 'ride';
  if (s.indexOf('swim') !== -1) return 'swim';
  if (s.indexOf('strength') !== -1 || s.indexOf('weight') !== -1 || s.indexOf('functional') !== -1 || s.indexOf('core') !== -1) return 'strength';
  return 'other';
}

// A watch workout counts as already in the log if a cardio session on that day
// matches its type and distance — stops a hand-logged run and its watch copy
// both landing in the log.
export function watchWorkoutImported(dateStr, w, ctype) {
  const dist = Number(w.distance) || 0;
  return cardioSessionsFor(dateStr).some(s =>
    s.type === ctype && Math.abs((Number(s.distance) || 0) - dist) < Math.max(0.15, dist * 0.05));
}

export function renderCardioWatchWorkouts() {
  const wrap = $('#cardioWatchWorkouts');
  if (!wrap) return;
  const workouts = (typeof getExternalWorkouts === 'function') ? getExternalWorkouts(cardioDate) : [];
  if (!workouts.length) { wrap.innerHTML = ''; wrap.hidden = true; return; }
  wrap.hidden = false;
  wrap.innerHTML = `<div class="card cardio-card">
    <h2>⌚ Apple Watch workouts</h2>
    <div class="ww-list">${workouts.map((w, i) => {
      const ctype = mapWatchWorkoutType(w.type);
      const cfg = CARDIO_TYPES[ctype] || { icon: '🏋️', unit: '' };
      const importable = ['run', 'ride', 'swim'].indexOf(ctype) !== -1;
      const dist = Number(w.distance) || 0;
      const meta = [
        dist ? `${Math.round(dist * 100) / 100} ${cfg.unit || ''}` : '',
        w.minutes ? formatDuration(w.minutes) : '',
        w.cal ? `${Math.round(w.cal)} cal` : '',
      ].filter(Boolean).join(' · ');
      const action = !importable
        ? `<span class="ww-note">strength</span>`
        : watchWorkoutImported(cardioDate, w, ctype)
          ? `<span class="ww-done">✓ in log</span>`
          : `<button type="button" class="btn-secondary ww-import" data-ww="${i}">Add to log</button>`;
      return `<div class="ww-row">
        <span class="ww-icon">${cfg.icon}</span>
        <div class="ww-main"><strong>${esc(w.type || ctype)}</strong><span class="ww-meta">${esc(meta)}</span></div>
        ${action}
      </div>`;
    }).join('')}</div>
  </div>`;
  wrap.querySelectorAll('[data-ww]').forEach(b =>
    b.addEventListener('click', () => importWatchWorkout(cardioDate, workouts[Number(b.dataset.ww)])));
}

export function importWatchWorkout(dateStr, w) {
  const ctype = mapWatchWorkoutType(w.type);
  if (['run', 'ride', 'swim'].indexOf(ctype) === -1) { showToast('Only run, ride and swim import to Cardio'); return; }
  state.cardio = state.cardio || [];
  state.cardio.push({
    id: 'c' + Date.now(),
    date: dateStr,
    type: ctype,
    distance: Number(w.distance) || 0,
    duration: Number(w.minutes) || 0,
    notes: 'Imported from Apple Watch',
    fromWatch: true,
  });
  saveData(state);
  showToast(`${CARDIO_TYPES[ctype].label} added to your log`);
  render();
}

// ---------- Render ----------
export function renderCardio() {
  const dateInput = $('#cardioDate');
  if (!dateInput) return;
  dateInput.value = cardioDate;
  const label = $('#cardioDateLabel');
  if (label) label.textContent = formatDate(cardioDate);

  // Default the logging type to your usual sport, once, before the tabs draw.
  // Only latch once there's actually history to learn from — the first render
  // runs before the cloud data lands, and latching then would keep the old
  // hard-coded 'run' default forever.
  if (!cardioTypeResolved) {
    const usual = cardioUsual();
    if (usual && CARDIO_TYPES[usual.type]) {
      cardioType = usual.type;
      cardioTypeResolved = true;
    }
  }
  // Race prediction and race targets are running features. Hide them entirely
  // until there's a logged run — for a rider they're pure noise.
  const hasRuns = (state.cardio || []).some(s => s && s.type === 'run');
  const raceCard = document.getElementById('cardioRace');
  const raceTarget = document.querySelector('[data-collapse-key="cardioracetarget"]');
  if (raceCard) raceCard.hidden = !hasRuns;
  if (raceTarget) raceTarget.hidden = !hasRuns;

  renderCardioQuick();
  renderCardioTypeTabs();
  renderCardioRunTypes();
  renderCardioZoneBar();
  updateCardioSaveLabel();
  renderCardioWatchChip();
  renderCardioWatchWorkouts();
  renderCardioDayList();
  renderCardioWeek();
  renderCardioRace();
  renderCardioCoach();
}

export function renderCardioTypeTabs() {
  const wrap = $('#cardioTypeTabs');
  if (!wrap) return;
  wrap.innerHTML = Object.keys(CARDIO_TYPES).map(t => {
    const cfg = CARDIO_TYPES[t];
    return `<button type="button" class="cardio-type-btn${t === cardioType ? ' active' : ''}" data-cardio-type="${t}">
      <span class="cardio-type-icon">${cfg.icon}</span>${cfg.label}
    </button>`;
  }).join('');

  const distLabel = $('#cardioDistanceLabel');
  if (distLabel) distLabel.textContent = `Distance (${CARDIO_TYPES[cardioType].unit})`;
  const distInput = $('#cardioDistance');
  if (distInput) distInput.placeholder = cardioType === 'swim' ? '1200' : '3.1';

  // Run-only detail (intensity chips + HR/elevation/RPE) hides for ride/swim.
  const isRun = cardioType === 'run';
  const runTypes = $('#cardioRunTypes');
  if (runTypes) runTypes.hidden = !isRun;
  const runDetail = $('#cardioRunDetail');
  if (runDetail) runDetail.hidden = !isRun;
}

// Intensity chips for the run being logged.
export function renderCardioRunTypes() {
  const wrap = $('#cardioRunTypes');
  if (!wrap) return;
  wrap.innerHTML = Object.keys(RUN_TYPES).map(k => {
    const cfg = RUN_TYPES[k];
    const on = k === cardioRunType;
    return `<button type="button" class="cardio-runtype${on ? ' active' : ''}" data-runtype="${k}"
      style="${on ? `border-color:${cfg.color};color:${cfg.color}` : ''}">${cfg.label}</button>`;
  }).join('');
}

// Live pace readout + "Save run · X.X mi" button echo, updated as you type.
export function updateCardioSaveLabel() {
  const dist = parseFloat(($('#cardioDistance') || {}).value) || 0;
  const dur = parseFloat(($('#cardioDuration') || {}).value) || 0;
  const paceEl = $('#cardioPace');
  if (paceEl) {
    const p = paceFor({ type: cardioType, distance: dist, duration: dur });
    paceEl.value = p ? p.text : '';
  }
  const btn = $('#cardioSaveBtn');
  if (btn) {
    const cfg = CARDIO_TYPES[cardioType];
    const verb = cardioType === 'run' ? 'Save run' : `Log ${cfg.label.toLowerCase()}`;
    btn.textContent = dist > 0 ? `${verb} · ${Math.round(dist * 100) / 100} ${cfg.unit}` : (cardioType === 'run' ? 'Save run' : 'Log session');
  }
}

// Z1–Z5 bar; highlights the zone the entered avg HR lands in.
export function renderCardioZoneBar() {
  const wrap = $('#cardioZoneBar');
  if (!wrap) return;
  const hr = parseFloat(($('#cardioHr') || {}).value) || 0;
  const active = hrZone(hr);
  // When a zone is active, name it (e.g. "Z3 · Aerobic") so the bar reads as
  // effort, not just a number — ref 4c.
  const nameChip = active > 0
    ? `<span class="cardio-zone-name" style="color:${ZONE_COLORS[active]}">Z${active} · ${ZONE_NAMES[active]}</span>`
    : '';
  wrap.innerHTML = `<span class="cardio-zone-label">HR zones</span>` +
    [1, 2, 3, 4, 5].map(z => `
      <span class="cardio-zone${z === active ? ' active' : ''}"
        style="${z === active ? `background:${ZONE_COLORS[z]};border-color:${ZONE_COLORS[z]}` : ''}">Z${z}</span>`).join('') +
    (hr > 0 ? `<span class="cardio-zone-hr">${Math.round(hr)} bpm</span>${nameChip}` : '');
}

// Cross-check against what the watch recorded, without ever creating a session
// from it — double counting a run is worse than not importing it.
export function renderCardioWatchChip() {
  const chip = $('#cardioWatchChip');
  if (!chip) return;
  const getters = {
    run: typeof getExternalRunDistance === 'function' ? getExternalRunDistance : null,
    ride: typeof getExternalCycleDistance === 'function' ? getExternalCycleDistance : null,
    swim: typeof getExternalSwimDistance === 'function' ? getExternalSwimDistance : null,
  };
  const fn = getters[cardioType];
  const watch = fn ? fn(cardioDate) : null;
  if (watch === null) { chip.hidden = true; return; }
  const logged = cardioSessionsFor(cardioDate)
    .filter(s => s.type === cardioType)
    .reduce((sum, s) => sum + (Number(s.distance) || 0), 0);
  const unit = CARDIO_TYPES[cardioType].unit;
  const rounded = cardioType === 'swim' ? Math.round(watch) : Math.round(watch * 100) / 100;
  chip.hidden = false;
  chip.innerHTML = `⌚ Watch recorded <strong>${rounded} ${unit}</strong> of ${CARDIO_TYPES[cardioType].label.toLowerCase()}ning this day` +
    (logged > 0 ? ` · you logged ${Math.round(logged * 100) / 100} ${unit}` : ` · <button type="button" class="cardio-watch-fill" data-fill="${rounded}">use this</button>`);
}

export function renderCardioDayList() {
  const list = $('#cardioDayList');
  if (!list) return;
  const sessions = cardioSessionsFor(cardioDate);
  if (!sessions.length) {
    list.innerHTML = emptyState({ icon: 'activity', title: 'Nothing logged', hint: 'Use the one-tap button above to log your usual session.' });
    return;
  }
  const burn = cardioBurnForDate(cardioDate);
  list.innerHTML = sessions.map((s) => {
    const cfg = CARDIO_TYPES[s.type] || CARDIO_TYPES.run;
    const pace = paceFor(s);
    const rt = s.runType && RUN_TYPES[s.runType];
    const detailBits = [
      rt ? `<span class="cardio-session-tag" style="color:${rt.color};border-color:${rt.color}">${rt.label}</span>` : '',
      s.avgHr ? `<span class="cardio-session-meta">♥ ${s.avgHr}</span>` : '',
      s.elevation ? `<span class="cardio-session-meta">↑ ${s.elevation} ft</span>` : '',
      s.rpe ? `<span class="cardio-session-meta">RPE ${s.rpe}</span>` : '',
    ].filter(Boolean).join('');
    return `
      <div class="cardio-session">
        <span class="cardio-session-icon">${cfg.icon}</span>
        <div class="cardio-session-main">
          <div class="cardio-session-top">
            <strong>${Math.round((Number(s.distance) || 0) * 100) / 100} ${cfg.unit}</strong>
            <span class="cardio-session-dur">${formatDuration(s.duration)}</span>
            ${pace ? `<span class="cardio-session-pace">${pace.text}</span>` : ''}
          </div>
          ${detailBits ? `<div class="cardio-session-detail">${detailBits}</div>` : ''}
          ${s.notes ? `<div class="cardio-session-notes">${esc(s.notes)}</div>` : ''}
        </div>
        <button class="cardio-session-del" data-del-cardio="${s.id}" title="Delete this session">&times;</button>
      </div>`;
  }).join('') + `<div class="cardio-day-burn">≈ ${burn} cal burned</div>`;
}

export function renderCardioWeek() {
  const wrap = $('#cardioWeekStats');
  if (!wrap) return;
  const g = cardioGoals();
  const stats = cardioWeekStats(cardioWeekStart(cardioDate));
  const pct = g.weeklyMiles > 0 ? Math.min(100, (stats.runMiles / g.weeklyMiles) * 100) : 0;
  const toGo = Math.max(0, g.weeklyMiles - stats.runMiles);
  const deg = Math.round((pct / 100) * 360);
  const tiles = [
    { label: 'Longest', value: stats.longestRun.toFixed(1), sub: 'mi single run' },
    { label: 'Ride', value: stats.byType.ride.distance.toFixed(1), sub: 'mi' },
    { label: 'Swim', value: Math.round(stats.byType.swim.distance), sub: 'yd' },
    { label: 'Time', value: formatDuration(stats.totalMinutes), sub: `${stats.days} day${stats.days === 1 ? '' : 's'}` },
  ];
  // Mileage ring leads (handoff 4b/11b), the other stats sit beside it.
  wrap.innerHTML = `
    <div class="cardio-week-ring-wrap">
      <div class="cardio-mileage-ring" style="--mile-deg:${deg}deg">
        <span class="cardio-mileage-val">${stats.runMiles.toFixed(1)}</span>
        <span class="cardio-mileage-goal">/ ${g.weeklyMiles} mi</span>
      </div>
      <div class="cardio-mileage-side">
        <span class="cardio-mileage-lead">${toGo > 0 ? `${toGo.toFixed(1)} mi to go` : 'Target hit 🎉'}</span>
        <div class="cardio-week-tiles">
          ${tiles.map(t => `
            <div class="cardio-week-tile">
              <span class="cardio-week-label">${t.label}</span>
              <span class="cardio-week-value">${t.value}</span>
              <span class="cardio-week-sub">${t.sub}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

export function renderCardioRace() {
  const wrap = $('#cardioRace');
  if (!wrap) return;
  const g = cardioGoals();
  const race = RACE_DISTANCES[g.raceKey];
  const days = daysUntil(g.raceDate);
  const pred = predictRaceTime(race.miles);

  const countdown = (days === null || !g.raceDate)
    ? '<span class="cardio-race-sub">Set a race date to start the countdown</span>'
    : days > 0
      ? `<span class="cardio-race-count">${days}</span><span class="cardio-race-sub">day${days === 1 ? '' : 's'} to go · ${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'}</span>`
      : days === 0
        ? '<span class="cardio-race-count">Today</span><span class="cardio-race-sub">Race day — good luck</span>'
        : `<span class="cardio-race-sub">Race was ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago</span>`;

  wrap.innerHTML = `
    <div class="cardio-race-head">
      <h2>${race.label}</h2>
      <span class="cardio-race-dist">${race.miles.toFixed(1)} mi</span>
    </div>
    <div class="cardio-race-count-wrap">${countdown}</div>
    <div class="cardio-race-pred">
      ${pred
        ? `<span class="cardio-race-time">${formatRaceTime(pred.time)}</span>
           <span class="cardio-race-sub">projected finish, from your ${Number(pred.from.distance).toFixed(1)} mi on ${formatDate(pred.from.date)}</span>`
        : '<span class="cardio-race-sub">Log a run of 3 mi or longer for a projected finish time</span>'}
    </div>`;
}

export function renderCardioCoach() {
  const wrap = $('#cardioCoach');
  if (!wrap) return;
  const recs = cardioCoach();
  wrap.innerHTML = recs.map(r => `
    <div class="cardio-rec cardio-rec-${r.type}">
      <span class="cardio-rec-dot"></span>
      <span>${r.text}</span>
    </div>`).join('');
}

// ---------- Actions ----------
export function addCardioSession() {
  const distEl = $('#cardioDistance');
  const durEl = $('#cardioDuration');
  const notesEl = $('#cardioNotes');
  const distance = parseFloat(distEl.value);
  const duration = parseFloat(durEl.value);

  // Duration is the only thing every session has. Distance is optional: an
  // indoor bike or treadmill-free session often has no distance readout, and
  // demanding one meant those workouts simply never got logged.
  if (!(duration > 0)) { showToast('Enter a duration in minutes'); durEl.focus(); return; }

  const session = {
    id: 'c' + Date.now(),
    date: cardioDate,
    type: cardioType,
    distance: distance > 0 ? distance : 0,
    duration: duration,
    notes: (notesEl.value || '').trim(),
  };
  // Run-only detail — stored only when present, so a ride/swim stays clean and
  // an existing session without these fields is unaffected.
  if (cardioType === 'run') {
    session.runType = cardioRunType;
    const hr = parseFloat(($('#cardioHr') || {}).value);
    const elev = parseFloat(($('#cardioElev') || {}).value);
    const rpe = parseInt(($('#cardioRpe') || {}).value);
    if (hr > 0) session.avgHr = Math.round(hr);
    if (elev > 0) session.elevation = Math.round(elev);
    if (rpe > 0) session.rpe = rpe;
  }

  state.cardio = state.cardio || [];
  state.cardio.push(session);
  saveData(state);

  distEl.value = '';
  durEl.value = '';
  notesEl.value = '';
  ['#cardioHr', '#cardioElev'].forEach(sel => { const el = $(sel); if (el) el.value = ''; });
  const rpe = $('#cardioRpe'); if (rpe) rpe.value = 5;
  const rpeVal = $('#cardioRpeVal'); if (rpeVal) rpeVal.textContent = '5';
  const cfg = CARDIO_TYPES[cardioType];
  showToast(`Logged ${distance} ${cfg.unit} ${cfg.label.toLowerCase()}`);
  render();
}

export function deleteCardioSession(id) {
  state.cardio = (state.cardio || []).filter(s => s.id !== id);
  saveData(state);
  render();
}

export function bindCardioEvents() {
  // Cardio's markup now lives in the Cardio pane of the merged Training view.
  const view = $('#trainingCardio');
  if (!view) return;

  const dateInput = $('#cardioDate');
  if (dateInput) dateInput.addEventListener('change', e => { cardioDate = e.target.value; renderCardio(); });
  const prev = $('#cardioPrevDay');
  if (prev) prev.addEventListener('click', () => { cardioDate = offsetDateStr(cardioDate, -1); renderCardio(); });
  const next = $('#cardioNextDay');
  if (next) next.addEventListener('click', () => { cardioDate = offsetDateStr(cardioDate, 1); renderCardio(); });
  const today = $('#cardioToday');
  if (today) today.addEventListener('click', () => { cardioDate = getTodayStr(); renderCardio(); });

  const tabs = $('#cardioTypeTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const btn = e.target.closest('[data-cardio-type]');
    if (!btn) return;
    cardioType = btn.dataset.cardioType;
    cardioTypeResolved = true; // an explicit pick beats the learned default
    renderCardio();
  });

  const save = $('#cardioSaveBtn');
  if (save) save.addEventListener('click', addCardioSession);

  // Run intensity chips (delegated on the persistent view).
  const runTypes = $('#cardioRunTypes');
  if (runTypes) runTypes.addEventListener('click', e => {
    const btn = e.target.closest('[data-runtype]');
    if (!btn) return;
    cardioRunType = btn.dataset.runtype;
    renderCardioRunTypes();
  });

  // Live pace + "Save run · X mi" echo as distance/duration change.
  const distEl = $('#cardioDistance');
  if (distEl) distEl.addEventListener('input', updateCardioSaveLabel);
  const durEl = $('#cardioDuration');
  if (durEl) durEl.addEventListener('input', updateCardioSaveLabel);
  // HR drives the live zone bar; RPE echoes its value.
  const hrEl = $('#cardioHr');
  if (hrEl) hrEl.addEventListener('input', renderCardioZoneBar);
  const rpeEl = $('#cardioRpe');
  if (rpeEl) rpeEl.addEventListener('input', () => {
    const v = $('#cardioRpeVal'); if (v) v.textContent = rpeEl.value;
  });

  const list = $('#cardioDayList');
  if (list) list.addEventListener('click', e => {
    const del = e.target.closest('[data-del-cardio]');
    if (del) deleteCardioSession(del.dataset.delCardio);
  });

  const chip = $('#cardioWatchChip');
  if (chip) chip.addEventListener('click', e => {
    const fill = e.target.closest('[data-fill]');
    if (!fill) return;
    const distEl = $('#cardioDistance');
    distEl.value = fill.dataset.fill;
    distEl.focus();
  });

  // Race settings
  const raceSel = $('#cardioRaceType');
  const raceDate = $('#cardioRaceDate');
  const weekly = $('#cardioWeeklyTarget');
  if (raceSel) {
    raceSel.innerHTML = Object.keys(RACE_DISTANCES)
      .map(k => `<option value="${k}">${RACE_DISTANCES[k].label}</option>`).join('');
  }
  function syncRaceInputs() {
    const g = cardioGoals();
    if (raceSel) raceSel.value = g.raceKey;
    if (raceDate) raceDate.value = g.raceDate;
    if (weekly) weekly.value = g.weeklyMiles;
  }
  syncRaceInputs();
  function saveRaceGoals() {
    state.goals = state.goals || {};
    if (raceSel) state.goals.raceKey = raceSel.value;
    if (raceDate) state.goals.raceDate = raceDate.value;
    if (weekly) state.goals.weeklyMiles = Number(weekly.value) || 15;
    saveData(state);
    renderCardio();
  }
  [raceSel, raceDate, weekly].forEach(el => { if (el) el.addEventListener('change', saveRaceGoals); });
}

// ========== Quick log ("same as usual") ==========
// Logging a daily ride used to mean: pick a type, type a distance, type a
// duration, then save — every single day, for a session that never changes.
// That friction is why the log stayed empty. This derives your usual session
// from history and logs it in one tap; the streak is the payoff for a habit
// that happens daily.

// The session you actually repeat: most-used type, then the most common
// duration/distance logged for it. Null until there's something to learn from.
export function cardioUsual() {
  const log = (state.cardio || []).filter(s => s && s.type && Number(s.duration) > 0);
  if (!log.length) return null;
  const recent = log.slice(-30);
  const byType = {};
  recent.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
  const type = Object.keys(byType).sort((a, b) => byType[b] - byType[a])[0];
  const ofType = recent.filter(s => s.type === type);
  const mode = (vals) => {
    const f = {};
    vals.forEach(v => { f[v] = (f[v] || 0) + 1; });
    return Number(Object.keys(f).sort((a, b) => f[b] - f[a] || Number(b) - Number(a))[0]) || 0;
  };
  return {
    type,
    duration: mode(ofType.map(s => Math.round(Number(s.duration) || 0))),
    distance: mode(ofType.map(s => Math.round((Number(s.distance) || 0) * 100) / 100)),
    count: ofType.length,
  };
}

// Consecutive days with a session. Today not being logged yet doesn't break
// the streak — it only breaks once a full day is missed.
export function cardioStreak() {
  const days = new Set((state.cardio || []).filter(s => s && s.date).map(s => s.date));
  if (!days.size) return 0;
  const today = getTodayStr();
  let cursor = days.has(today) ? today : offsetDateStr(today, -1);
  if (!days.has(cursor)) return 0;
  let n = 0;
  while (days.has(cursor)) { n++; cursor = offsetDateStr(cursor, -1); }
  return n;
}

export function logUsualCardio(dateStr) {
  const u = cardioUsual();
  if (!u) return;
  state.cardio = state.cardio || [];
  state.cardio.push({
    id: 'c' + Date.now(),
    // Today's dashboard button always logs today; the Cardio pane logs the day
    // you're viewing.
    date: dateStr || cardioDate,
    type: u.type,
    distance: u.distance || 0,
    duration: u.duration || 0,
    notes: '',
  });
  saveData(state);
  const cfg = CARDIO_TYPES[u.type] || { label: u.type };
  showToast(`✓ ${u.duration} min ${cfg.label.toLowerCase()} logged`);
  render();
}

export function renderCardioQuick() {
  const host = document.getElementById('cardioQuick');
  if (!host) return;
  const u = cardioUsual();
  if (!u || !u.duration) { host.innerHTML = ''; return; }

  const cfg = CARDIO_TYPES[u.type] || { label: u.type, icon: '🏃', unit: '' };
  const todays = (state.cardio || []).filter(s => s && s.date === cardioDate && s.type === u.type);
  const done = todays.length > 0;
  const streak = cardioStreak();
  const isToday = cardioDate === getTodayStr();
  const distTxt = u.distance ? ` · ${u.distance} ${cfg.unit}` : '';

  host.innerHTML = `
    <div class="card cq-card">
      <div class="cq-top">
        <div class="cq-label">${isToday ? 'Today' : formatDate(cardioDate)}</div>
        ${streak > 0 ? `<div class="cq-streak" title="consecutive days">🔥 ${streak} day${streak === 1 ? '' : 's'}</div>` : ''}
      </div>
      ${done ? `
        <div class="cq-done">
          <span class="cq-done-check">✓</span>
          <div class="cq-done-body">
            <div class="cq-done-title">${cfg.icon} ${todays.length > 1 ? `${todays.length} sessions` : `${Math.round(todays[0].duration)} min ${cfg.label.toLowerCase()}`} logged</div>
            <div class="cq-done-sub">Nice — that's the habit kept.</div>
          </div>
        </div>
        <button type="button" class="cq-again" id="cardioQuickBtn">+ Log another ${cfg.label.toLowerCase()}</button>
      ` : `
        <button type="button" class="cq-btn" id="cardioQuickBtn">
          <span class="cq-btn-icon">${cfg.icon}</span>
          <span class="cq-btn-text">
            <span class="cq-btn-main">Log ${u.duration} min ${cfg.label.toLowerCase()}</span>
            <span class="cq-btn-sub">your usual${distTxt}</span>
          </span>
          <span class="cq-btn-go">＋</span>
        </button>
      `}
    </div>`;

  const btn = document.getElementById('cardioQuickBtn');
  if (btn) btn.addEventListener('click', logUsualCardio);
}

// Compact one-tap version for the Today dashboard. A daily habit that lives
// behind a nav tab doesn't get logged — this puts it where you already look.
// Respects the Cardio module toggle, like every other cross-view surface.
export function renderTodayCardio() {
  const host = document.getElementById('todayCardio');
  if (!host) return;
  if (typeof moduleEnabled === 'function' && !moduleEnabled('cardio')) { host.innerHTML = ''; return; }

  const u = cardioUsual();
  if (!u || !u.duration) { host.innerHTML = ''; return; }

  const cfg = CARDIO_TYPES[u.type] || { label: u.type, icon: '🏃', unit: '' };
  const today = getTodayStr();
  const done = (state.cardio || []).some(s => s && s.date === today && s.type === u.type);
  const streak = cardioStreak();
  const streakChip = streak > 0 ? `<span class="tc-streak">🔥 ${streak}</span>` : '';

  host.innerHTML = done
    ? `<div class="today-cardio is-done">
         <span class="tc-icon tc-check">✓</span>
         <span class="tc-text"><b>${u.duration} min ${esc(cfg.label.toLowerCase())}</b> done today</span>
         ${streakChip}
       </div>`
    : `<button type="button" class="today-cardio" id="todayCardioBtn">
         <span class="tc-icon">${cfg.icon}</span>
         <span class="tc-text"><b>${u.duration} min ${esc(cfg.label.toLowerCase())}</b> — tap to log</span>
         ${streakChip}
         <span class="tc-go">＋</span>
       </button>`;

  const btn = document.getElementById('todayCardioBtn');
  if (btn) btn.addEventListener('click', () => logUsualCardio(getTodayStr()));
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { CARDIO_TYPES: CARDIO_TYPES, RACE_DISTANCES: RACE_DISTANCES, RUN_TYPES: RUN_TYPES, ZONE_COLORS: ZONE_COLORS, ZONE_NAMES: ZONE_NAMES, addCardioSession: addCardioSession, bindCardioEvents: bindCardioEvents, cardioBurnForDate: cardioBurnForDate, cardioCoach: cardioCoach, cardioGoals: cardioGoals, cardioMet: cardioMet, cardioSessionsFor: cardioSessionsFor, cardioStreak: cardioStreak, cardioUsual: cardioUsual, cardioWeekStart: cardioWeekStart, cardioWeekStats: cardioWeekStats, daysUntil: daysUntil, deleteCardioSession: deleteCardioSession, formatDuration: formatDuration, formatPaceMinutes: formatPaceMinutes, formatRaceTime: formatRaceTime, hrZone: hrZone, importWatchWorkout: importWatchWorkout, logUsualCardio: logUsualCardio, mapWatchWorkoutType: mapWatchWorkoutType, paceFor: paceFor, predictRaceTime: predictRaceTime, renderCardio: renderCardio, renderCardioCoach: renderCardioCoach, renderCardioDayList: renderCardioDayList, renderCardioQuick: renderCardioQuick, renderCardioRace: renderCardioRace, renderCardioRunTypes: renderCardioRunTypes, renderCardioTypeTabs: renderCardioTypeTabs, renderCardioWatchChip: renderCardioWatchChip, renderCardioWatchWorkouts: renderCardioWatchWorkouts, renderCardioWeek: renderCardioWeek, renderCardioZoneBar: renderCardioZoneBar, renderTodayCardio: renderTodayCardio, runnerMaxHr: runnerMaxHr, updateCardioSaveLabel: updateCardioSaveLabel, watchWorkoutImported: watchWorkoutImported });
