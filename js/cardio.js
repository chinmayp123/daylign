// ========== Cardio ==========
// Endurance training: running, cycling, swimming. Separate from Gym because
// the unit of work is a session (distance + duration), not sets and reps, and
// the interesting numbers are pace and weekly volume rather than tonnage.

// `ms` is the Material Symbols name the v3 surfaces draw; `icon` is the emoji
// the v2 Today pill still uses. `doing` is for sentences: "3.1 mi of running"
// (it used to be label + "ning", which made "ridening" and "swimning").
const CARDIO_TYPES = {
  run:  { label: 'Run',   icon: '🏃', ms: 'directions_run',  doing: 'running',  unit: 'mi', unitLong: 'miles', paceLabel: 'min/mi' },
  ride: { label: 'Ride',  icon: '🚴', ms: 'directions_bike', doing: 'riding',   unit: 'mi', unitLong: 'miles', paceLabel: 'mph' },
  swim: { label: 'Swim',  icon: '🏊', ms: 'pool',            doing: 'swimming', unit: 'yd', unitLong: 'yards', paceLabel: 'min/100yd' },
};

// Races people actually train for, in miles. Half marathon is the default
// because that is what this view was built for.
const RACE_DISTANCES = {
  '5k':      { label: '5K',            miles: 3.107 },
  '10k':     { label: '10K',           miles: 6.214 },
  'half':    { label: 'Half Marathon', miles: 13.109 },
  'full':    { label: 'Marathon',      miles: 26.219 },
};

let cardioDate = getTodayStr();
let cardioType = 'run';
// The type tab defaults to whatever you actually train, resolved once per
// session from your history. Hard-defaulting to 'run' meant a cyclist had to
// re-pick "Ride" every single time they opened the view.
let cardioTypeResolved = false;
let cardioRunType = 'easy'; // intensity for the run being logged

// Run intensity types (handoff §3), colour-coded. Only apply to runs — a ride
// or swim just has a distance and a duration.
const RUN_TYPES = {
  easy:     { label: 'Easy',     color: 'var(--green)' },
  tempo:    { label: 'Tempo',    color: 'var(--yellow)' },
  interval: { label: 'Interval', color: 'var(--red)' },
  long:     { label: 'Long',     color: 'var(--accent)' },
  recovery: { label: 'Recovery', color: 'var(--blue)' },
};

// Heart-rate zones (Z1–Z5). Thresholds are % of an estimated max HR (220−age),
// falling back to age 30 when we don't know it. The zone bar highlights the
// zone a logged avg HR lands in — a rough but useful read of how hard it was.
function runnerMaxHr() {
  const age = (state.goals && Number(state.goals.age)) || (typeof getGoals === 'function' && Number(getGoals().age)) || 30;
  return 220 - (age > 0 && age < 100 ? age : 30);
}
function hrZone(avgHr) {
  if (!(avgHr > 0)) return 0;
  const pct = avgHr / runnerMaxHr();
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}
const ZONE_COLORS = ['', 'var(--text-muted)', 'var(--blue)', 'var(--green)', 'var(--yellow)', 'var(--red)'];
const ZONE_NAMES = ['', 'Recovery', 'Easy', 'Aerobic', 'Threshold', 'VO₂ max'];

function cardioGoals() {
  const g = state.goals || {};
  return {
    raceKey: RACE_DISTANCES[g.raceKey] ? g.raceKey : 'half',
    raceDate: g.raceDate || '',
    weeklyMiles: Number(g.weeklyMiles) > 0 ? Number(g.weeklyMiles) : 15,
  };
}

function cardioSessionsFor(dateStr) {
  return (state.cardio || []).filter(s => s.date === dateStr);
}

// ---------- Pace ----------
// Each discipline reports the number its athletes actually talk in: runners
// think in minutes per mile, cyclists in mph, swimmers in minutes per 100yd.
function paceFor(session) {
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

function formatPaceMinutes(mins) {
  if (!isFinite(mins) || mins <= 0) return '—';
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  // 7:60 is not a pace — carry the rounding into the minutes.
  if (s === 60) return (m + 1) + ':00';
  return m + ':' + String(s).padStart(2, '0');
}

function formatDuration(mins) {
  const total = Math.round(Number(mins) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------- Calorie burn ----------
// MET values scale with effort, so a 7:00/mi run does not score the same as a
// 12:00/mi shuffle. These linear fits track the Compendium of Physical
// Activities closely across the range people actually train in.
function cardioMet(session) {
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

function cardioBurnForDate(dateStr) {
  const kg = latestBodyWeightLbs() * 0.4536;
  return Math.round(cardioSessionsFor(dateStr).reduce((cal, s) => {
    return cal + cardioMet(s) * kg * ((Number(s.duration) || 0) / 60);
  }, 0));
}

// ---------- Weekly volume ----------
function cardioWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay()); // weeks start Sunday, matching the calendar
  return toLocalDateStr(d);
}

function cardioWeekStats(weekStartStr) {
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
function predictRaceTime(raceMiles) {
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

function formatRaceTime(mins) {
  const total = Math.round(mins * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const race = new Date(dateStr + 'T12:00:00');
  const today = new Date(getTodayStr() + 'T12:00:00');
  return Math.round((race - today) / (1000 * 60 * 60 * 24));
}

// ---------- Coach ----------
// Deliberately few rules, each tied to a number on screen. Endurance advice is
// mostly "build gradually and run long once a week"; anything more prescriptive
// would be guessing at a plan we cannot see.
function cardioCoach() {
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
function mapWatchWorkoutType(t) {
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
function watchWorkoutImported(dateStr, w, ctype) {
  const dist = Number(w.distance) || 0;
  return cardioSessionsFor(dateStr).some(s =>
    s.type === ctype && Math.abs((Number(s.distance) || 0) - dist) < Math.max(0.15, dist * 0.05));
}

function renderCardioWatchWorkouts() {
  const wrap = $('#cardioWatchWorkouts');
  if (!wrap) return;
  const workouts = (typeof getExternalWorkouts === 'function') ? getExternalWorkouts(cardioDate) : [];
  if (!workouts.length) { wrap.innerHTML = ''; wrap.hidden = true; return; }
  wrap.hidden = false;
  wrap.innerHTML = `<div class="dl-card cd-card">
    <h6 class="dl-card-h"><span>From your Watch</span></h6>
    ${workouts.map((w, i) => {
      const ctype = mapWatchWorkoutType(w.type);
      const cfg = CARDIO_TYPES[ctype] || { ms: 'fitness_center', unit: '' };
      const importable = ['run', 'ride', 'swim'].indexOf(ctype) !== -1;
      const dist = Number(w.distance) || 0;
      const meta = [
        dist ? `${Math.round(dist * 100) / 100} ${cfg.unit || ''}` : '',
        w.minutes ? formatDuration(w.minutes) : '',
        w.cal ? `${Math.round(w.cal)} kcal` : '',
      ].filter(Boolean).join(' · ');
      // Already-imported workouts keep their row but lose the button, so the
      // same run cannot be added twice.
      const action = !importable
        ? '<span class="cd-row-note">strength</span>'
        : watchWorkoutImported(cardioDate, w, ctype)
          ? '<span class="cd-row-note">in your log</span>'
          : `<button type="button" class="cd-link" data-ww="${i}">Add to log</button>`;
      return `<div class="cd-row">
        <span class="ms cd-row-ico" aria-hidden="true">${cfg.ms}</span>
        <span class="cd-row-main"><span class="cd-row-name">${esc(w.type || ctype)}</span><span class="cd-row-sub">${esc(meta)}</span></span>
        ${action}
      </div>`;
    }).join('')}
  </div>`;
  wrap.querySelectorAll('[data-ww]').forEach(b =>
    b.addEventListener('click', () => importWatchWorkout(cardioDate, workouts[Number(b.dataset.ww)])));
}

function importWatchWorkout(dateStr, w) {
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
function renderCardio() {
  const dateInput = $('#cardioDate');
  if (!dateInput) return;
  dateInput.value = cardioDate;
  const label = $('#cardioDateLabel');
  const isToday = cardioDate === getTodayStr();
  const viewDate = new Date(cardioDate + 'T00:00:00');
  if (label) label.textContent = isToday
    ? 'Today, ' + viewDate.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + viewDate.getDate()
    : viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const todayBtn = $('#cardioToday');
  if (todayBtn) todayBtn.hidden = isToday;

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
  const raceTarget = document.querySelector('[data-cardio-racetarget]');
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
}

function renderCardioTypeTabs() {
  const wrap = $('#cardioTypeTabs');
  if (!wrap) return;
  wrap.innerHTML = Object.keys(CARDIO_TYPES).map(t =>
    `<button type="button" data-cardio-type="${t}"${t === cardioType ? ' aria-pressed="true"' : ''}>${CARDIO_TYPES[t].label}</button>`).join('');

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
function renderCardioRunTypes() {
  const wrap = $('#cardioRunTypes');
  if (!wrap) return;
  wrap.innerHTML = Object.keys(RUN_TYPES).map(k => {
    const on = k === cardioRunType;
    return `<button type="button" class="cd-chip${on ? ' on' : ''}" data-runtype="${k}" aria-pressed="${on}">${RUN_TYPES[k].label}</button>`;
  }).join('');
}

// Live pace readout + "Save run · X.X mi" button echo, updated as you type.
function updateCardioSaveLabel() {
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

// Z1–Z5 bar; highlights the zone the entered avg HR lands in, and names it, so
// the bar reads as effort rather than a number.
function renderCardioZoneBar() {
  const wrap = $('#cardioZoneBar');
  if (!wrap) return;
  const hr = parseFloat(($('#cardioHr') || {}).value) || 0;
  const active = hrZone(hr);
  wrap.innerHTML = `<span class="cd-zone-set">` +
    [1, 2, 3, 4, 5].map(z => `<span class="cd-zone${z === active ? ' on' : ''}">Z${z}</span>`).join('') + `</span>` +
    `<span class="cd-zone-read">${hr > 0
      ? `${Math.round(hr)} bpm${active ? ` · Z${active} ${ZONE_NAMES[active]}` : ''}`
      : 'Enter an average heart rate to see its zone'}</span>`;
}

// Cross-check against what the watch recorded, without ever creating a session
// from it — double counting a run is worse than not importing it.
function renderCardioWatchChip() {
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
  const cfg = CARDIO_TYPES[cardioType];
  const logged = cardioSessionsFor(cardioDate)
    .filter(s => s.type === cardioType)
    .reduce((sum, s) => sum + (Number(s.distance) || 0), 0);
  const rounded = cardioType === 'swim' ? Math.round(watch) : Math.round(watch * 100) / 100;
  chip.hidden = false;
  chip.innerHTML = `<span class="ms" aria-hidden="true">watch</span>
    <span>Watch saw <b>${rounded} ${cfg.unit}</b> of ${cfg.doing} this day${logged > 0 ? `; you logged ${Math.round(logged * 100) / 100} ${cfg.unit}.` : '.'}</span>
    ${logged > 0 ? '' : `<button type="button" class="cd-link cardio-watch-fill" data-fill="${rounded}">Use this</button>`}`;
}

function renderCardioDayList() {
  const list = $('#cardioDayList');
  if (!list) return;
  const sessions = cardioSessionsFor(cardioDate);
  const isToday = cardioDate === getTodayStr();
  const title = isToday ? 'Today' : formatDate(cardioDate);
  if (!sessions.length) {
    list.innerHTML = `<div class="dl-card cd-card"><h6 class="dl-card-h"><span>${esc(title)}</span></h6>
      <p class="cd-note">Nothing logged ${isToday ? 'yet today' : 'on this day'}.</p></div>`;
    return;
  }
  const burn = cardioBurnForDate(cardioDate);
  list.innerHTML = `<div class="dl-card cd-card"><h6 class="dl-card-h"><span>${esc(title)}</span><em>${burn} kcal</em></h6>
    ${sessions.map(s => {
      const cfg = CARDIO_TYPES[s.type] || CARDIO_TYPES.run;
      const pace = paceFor(s);
      const rt = s.runType && RUN_TYPES[s.runType];
      const dist = Math.round((Number(s.distance) || 0) * 100) / 100;
      const bits = [
        formatDuration(s.duration),
        pace ? pace.text : '',
        rt ? rt.label : '',
        s.avgHr ? `${s.avgHr} bpm` : '',
        s.elevation ? `${s.elevation} ft up` : '',
        s.rpe ? `RPE ${s.rpe}` : '',
      ].filter(Boolean).join(' · ');
      return `
      <div class="cd-row">
        <span class="ms cd-row-ico" aria-hidden="true">${cfg.ms}</span>
        <span class="cd-row-main">
          <span class="cd-row-name">${cfg.label}${dist ? `, ${dist} ${cfg.unit}` : ''}</span>
          <span class="cd-row-sub">${esc(bits)}</span>
          ${s.notes ? `<span class="cd-row-sub">${esc(s.notes)}</span>` : ''}
        </span>
        <button type="button" class="ss-act cd-del" data-del-cardio="${esc(s.id)}" aria-label="Delete this ${cfg.label.toLowerCase()}"><span class="ms" aria-hidden="true">close</span></button>
      </div>`;
    }).join('')}
  </div>`;
}

function renderCardioWeek() {
  const wrap = $('#cardioWeekStats');
  if (!wrap) return;
  const g = cardioGoals();
  const stats = cardioWeekStats(cardioWeekStart(cardioDate));
  const hasRuns = (state.cardio || []).some(s => s && s.type === 'run');
  const time = formatDuration(stats.totalMinutes);
  const days = `${stats.days} day${stats.days === 1 ? '' : 's'}`;

  // The ring is RUN miles against the weekly run target. Someone who only
  // rides has no such target, and a ring stuck at "0 of 15 mi" every week is a
  // standing failure they never signed up for - they get plain tiles instead.
  if (!hasRuns) {
    wrap.innerHTML = `
      <div class="dl-card cd-card">
        <h6 class="dl-card-h"><span>This week</span><em>${days}</em></h6>
        <div class="dl-tiles cd-tiles">
          <div class="dl-tile"><b>${stats.byType.ride.distance.toFixed(1)}<small>mi</small></b><span>ride</span></div>
          ${stats.byType.swim.distance ? `<div class="dl-tile"><b>${Math.round(stats.byType.swim.distance)}<small>yd</small></b><span>swim</span></div>` : ''}
          <div class="dl-tile"><b>${time}</b><span>moving</span></div>
        </div>
      </div>`;
    return;
  }

  const pct = g.weeklyMiles > 0 ? Math.min(100, (stats.runMiles / g.weeklyMiles) * 100) : 0;
  const toGo = Math.max(0, g.weeklyMiles - stats.runMiles);
  const extra = [
    stats.longestRun ? `longest ${stats.longestRun.toFixed(1)} mi` : '',
    stats.byType.ride.distance ? `ride ${stats.byType.ride.distance.toFixed(1)} mi` : '',
    stats.byType.swim.distance ? `swim ${Math.round(stats.byType.swim.distance)} yd` : '',
    `${time} over ${days}`,
  ].filter(Boolean).join(' · ');
  const shown = stats.runMiles >= 10 ? Math.round(stats.runMiles) : stats.runMiles.toFixed(1);
  wrap.innerHTML = `
    <div class="cd-ringrow">
      <span class="dl-ring-wrap cd-ring">
        <svg class="dl-ring c-move" viewBox="0 0 64 64" role="img" aria-label="${stats.runMiles.toFixed(1)} of ${g.weeklyMiles} miles run this week">
          <circle class="dl-ring-track" cx="32" cy="32" r="28"/>
          <circle class="dl-ring-fill" cx="32" cy="32" r="28" pathLength="100" style="--pct:${Math.round(pct)}"/>
        </svg>
        <span class="dl-ring-label">${shown}</span>
      </span>
      <div class="cd-week-side">
        <b>${toGo > 0 ? `${toGo.toFixed(1)} mi to go` : 'Weekly target hit'}</b>
        <span>of ${g.weeklyMiles} mi running this week</span>
        <span class="cd-week-line">${extra}</span>
      </div>
    </div>`;
}

function renderCardioRace() {
  const wrap = $('#cardioRace');
  if (!wrap) return;
  const g = cardioGoals();
  const race = RACE_DISTANCES[g.raceKey];
  const days = daysUntil(g.raceDate);
  const pred = predictRaceTime(race.miles);

  let count = '', sub;
  if (days === null || !g.raceDate) sub = 'Set a race date below to start the countdown.';
  else if (days > 0) { count = `${days} day${days === 1 ? '' : 's'}`; const w = Math.floor(days / 7); sub = `${w} week${w === 1 ? '' : 's'} to go.`; }
  else if (days === 0) { count = 'Today'; sub = 'Race day. Good luck.'; }
  else sub = `The race was ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`;

  const proj = pred
    ? `Projected finish ${formatRaceTime(pred.time)}, from your ${Number(pred.from.distance).toFixed(1)} mi on ${formatDate(pred.from.date)}.`
    : 'Log a run of 3 mi or longer for a projected finish.';

  wrap.innerHTML = `
    <h6 class="dl-card-h"><span>${race.label}</span><em>${race.miles.toFixed(1)} mi</em></h6>
    ${count ? `<div class="cd-race-count">${count}</div>` : ''}
    <p class="cd-note">${sub} ${proj}</p>`;
}

// ---------- Actions ----------
function addCardioSession() {
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
  // Logged for today means it happened about now, which is what puts it at the
  // right point on Today's line. A back-dated session has no honest clock time.
  if (cardioDate === getTodayStr()) session.at = Date.now();
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
  // Distance is optional, and an empty one used to toast "Logged NaN mi ride".
  showToast(distance > 0
    ? `Logged ${distance} ${cfg.unit} ${cfg.label.toLowerCase()}`
    : `Logged ${formatDuration(duration)} ${cfg.label.toLowerCase()}`);
  render();
}

function deleteCardioSession(id) {
  state.cardio = (state.cardio || []).filter(s => s.id !== id);
  saveData(state);
  render();
}

function bindCardioEvents() {
  // Cardio's markup now lives in the Cardio pane of the merged Training view.
  const view = $('#trainingCardio');
  if (!view) return;

  const dateInput = $('#cardioDate');
  if (dateInput) {
    dateInput.addEventListener('change', e => { if (e.target.value) { cardioDate = e.target.value; renderCardio(); } });
    dateInput.addEventListener('click', e => { try { e.target.showPicker(); } catch (err) { /* not supported: the field still works */ } });
  }
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
function cardioUsual() {
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
function cardioStreak() {
  const days = new Set((state.cardio || []).filter(s => s && s.date).map(s => s.date));
  if (!days.size) return 0;
  const today = getTodayStr();
  let cursor = days.has(today) ? today : offsetDateStr(today, -1);
  if (!days.has(cursor)) return 0;
  let n = 0;
  while (days.has(cursor)) { n++; cursor = offsetDateStr(cursor, -1); }
  return n;
}

function logUsualCardio(dateStr) {
  const u = cardioUsual();
  if (!u) return;
  state.cardio = state.cardio || [];
  state.cardio.push({
    id: 'c' + Date.now(),
    // Today's dashboard button always logs today; the Cardio pane logs the day
    // you're viewing. Guard the type so a stray Event argument can never be
    // stored as the date again.
    date: (typeof dateStr === 'string' && dateStr) ? dateStr : cardioDate,
    type: u.type,
    distance: u.distance || 0,
    duration: u.duration || 0,
    notes: '',
  });
  const added = state.cardio[state.cardio.length - 1];
  if (added.date === getTodayStr()) added.at = Date.now();
  saveData(state);
  const cfg = CARDIO_TYPES[u.type] || { label: u.type };
  showToast(`${u.duration} min ${cfg.label.toLowerCase()} logged`);
  render();
}

function renderCardioQuick() {
  const host = document.getElementById('cardioQuick');
  if (!host) return;
  const u = cardioUsual();
  if (!u || !u.duration) { host.innerHTML = ''; return; }

  const cfg = CARDIO_TYPES[u.type] || { label: u.type, ms: 'directions_run', unit: '' };
  const done = (state.cardio || []).some(s => s && s.date === cardioDate && s.type === u.type);
  const streak = cardioStreak();
  const isToday = cardioDate === getTodayStr();

  host.innerHTML = `
    <div class="dl-card tint c-move cd-usual">
      <h6 class="dl-card-h"><span>Your usual ${esc(cfg.label.toLowerCase())}</span>${streak > 0 ? `<em>${streak}-day streak</em>` : ''}</h6>
      <div class="cd-usual-row">
        <span class="cd-usual-val">${u.distance ? `${u.distance} ${cfg.unit} · ` : ''}${u.duration} min</span>
        ${done ? `<span class="cd-usual-done"><span class="ms" aria-hidden="true">check</span>Logged ${isToday ? 'today' : 'this day'}</span>` : ''}
        <button type="button" class="dl-btn${done ? '' : ' primary'}" id="cardioQuickBtn">${done ? 'Log another' : 'Log it'}</button>
      </div>
    </div>`;

  const btn = document.getElementById('cardioQuickBtn');
  // Wrap it — passing the listener directly hands logUsualCardio the click
  // Event as its dateStr, which then got stored as the session's date.
  if (btn) btn.addEventListener('click', () => logUsualCardio(cardioDate));
}
