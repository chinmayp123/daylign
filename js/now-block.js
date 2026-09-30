// ========== The now block (v3, spec 4.2) ==========
// Replaces the health strip. Today's numbers on an ink panel, stuck under the
// header so they are on screen whatever you scroll to — the owner's rule is
// that the health numbers are always visible, so this cannot be hidden or
// reordered (Arrange Today shows it locked).
//
// Reads state only. Nothing here writes; the weigh-in tap opens the sheet,
// which does its own saving.

// Ten ticks rather than a continuous bar: at a glance you read "7 of 10", and
// a part-filled tick never reads as a rounding lie the way a bar edge does.
function nowTicks(pct) {
  const lit = Math.max(0, Math.min(10, Math.round((pct || 0) / 10)));
  let out = '';
  for (let i = 0; i < 10; i++) out += `<i class="nb-tick${i < lit ? ' on' : ''}"></i>`;
  return out;
}

function nowMetric(cls, label, value, pct, target) {
  return `
    <button type="button" class="nb-metric ${cls}" data-now-tap="${label.toLowerCase()}">
      <span class="nb-metric-top">
        <span class="nb-metric-val">${value}</span>
        <span class="nb-metric-label">${label}</span>
      </span>
      <span class="nb-ticks" role="img" aria-label="${Math.round(pct)}% of ${target}">${nowTicks(pct)}</span>
    </button>`;
}

function renderNowBlock() {
  const host = document.getElementById('nowBlock');
  if (!host) return;
  const today = getTodayStr();
  const g = (typeof getGoals === 'function') ? getGoals()
    : { calories: 2000, protein: 150, water: 66, weight: 150 };

  const dietToday = (state.diet || []).filter(e => e.date === today);
  const cal = Math.round(dietToday.reduce((s, e) => s + (e.calories || 0), 0));
  const protein = Math.round(dietToday.reduce((s, e) => s + (e.protein || 0), 0));
  const water = ((state.water || {})[today] || []).reduce((s, v) => s + v, 0);

  const weighIns = Object.entries(state.weight || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const latestW = weighIns.length ? weighIns[weighIns.length - 1][1] : null;

  // Same precedence the health strip used: a measured watch figure wins,
  // because it already counts both training and walking.
  const watchBurn = (typeof getExternalActiveEnergy === 'function') ? getExternalActiveEnergy(today) : null;
  const workoutBurn = (typeof estimateBurnForDate === 'function') ? estimateBurnForDate(today) : 0;
  const steps = (typeof getExternalSteps === 'function') ? getExternalSteps(today) : null;
  const walkBurn = steps ? Math.round(steps * (latestW || 160) * 0.00025) : 0;
  const burn = watchBurn !== null ? Math.round(watchBurn) : (workoutBurn + walkBurn);
  const exMin = (typeof getExternalExerciseMinutes === 'function') ? getExternalExerciseMinutes(today) : null;
  const sleepH = (typeof sleepHoursFor === 'function') ? sleepHoursFor(today)
    : ((typeof getExternalSleep === 'function') ? getExternalSleep(today) : null);

  const left = Math.max(0, g.calories - cal);
  const over = cal > g.calories;
  const pct = (n, d) => (d > 0 ? Math.min(100, (n / d) * 100) : 0);

  // Steps only exist with watch data; the row reflows around what is missing
  // rather than showing a zero that looks like a bad day.
  const row2 = [
    nowMetric('c-food', 'Protein', protein + 'g', pct(protein, g.protein), g.protein + 'g'),
    nowMetric('c-water', 'Water', water + ' oz', pct(water, g.water), g.water + ' oz'),
    steps !== null ? nowMetric('c-move', 'Steps', steps.toLocaleString(), pct(steps, g.steps || 8000), (g.steps || 8000).toLocaleString()) : '',
  ].filter(Boolean).join('');

  const small = [
    { cls: 'c-move', tap: 'burn', v: burn ? burn.toLocaleString() : '—', l: 'burned' },
    exMin !== null ? { cls: 'c-move', tap: 'exercise', v: exMin + 'm', l: 'exercise' } : null,
    sleepH !== null ? { cls: 'c-sleep', tap: 'sleep', v: sleepH + 'h', l: 'sleep' } : null,
    { cls: '', tap: 'weight', v: latestW !== null ? latestW : 'weigh in', l: latestW !== null ? 'lbs' : '' },
  ].filter(Boolean).map(s => `
    <button type="button" class="nb-small ${s.cls}" data-now-tap="${s.tap}">
      <span class="nb-small-val">${s.v}</span>${s.l ? `<span class="nb-small-label">${s.l}</span>` : ''}
    </button>`).join('');

  host.innerHTML = `
    <span class="nb-pin">PINNED</span>
    <button type="button" class="nb-cal" data-now-tap="calories">
      <span class="nb-cal-main">
        <span class="nb-cal-num">${cal.toLocaleString()}</span>
        <span class="nb-cal-of">/ ${g.calories.toLocaleString()} kcal eaten</span>
      </span>
      <span class="nb-cal-left${over ? ' is-over' : ''}">${over ? (cal - g.calories).toLocaleString() + ' over' : left.toLocaleString() + ' left'}</span>
    </button>
    <div class="nb-row2">${row2}</div>
    <div class="nb-row3">${small}</div>`;

  bindNowBlock();
}

// Bound once on the persistent host, not per render: this container survives
// every render() and per-render listeners would stack up on it.
let nowBlockBound = false;
function bindNowBlock() {
  const host = document.getElementById('nowBlock');
  if (!host || nowBlockBound) return;
  nowBlockBound = true;

  const GO = {
    calories: () => switchView('diet'),
    protein: () => switchView('diet'),
    water: () => switchView('diet'),
    steps: () => switchView('training'),
    burn: () => switchView('training'),
    exercise: () => switchView('training'),
    sleep: () => { switchView('training'); if (typeof setTrainingTab === 'function') setTrainingTab('coach'); },
    weight: () => { if (typeof openWeightSheet === 'function') openWeightSheet(); else switchView('training'); },
  };
  host.addEventListener('click', (e) => {
    // The collapsed bar is one tap target: tapping it expands rather than
    // navigating, so a scrolled-down glance never throws you into Diet.
    if (host.classList.contains('is-collapsed')) {
      host.classList.remove('is-collapsed');
      host.classList.add('is-user-open');
      return;
    }
    const btn = e.target.closest('[data-now-tap]');
    if (!btn) return;
    const go = GO[btn.dataset.nowTap];
    if (go) go();
  });
}

// Collapse to a single line once you scroll past it. An IntersectionObserver
// cannot do this (the block is sticky, so it never leaves the viewport), so it
// watches a zero-height sentinel sitting where the block starts.
function watchNowBlockScroll() {
  const host = document.getElementById('nowBlock');
  const sentinel = document.getElementById('nowBlockTop');
  if (!host || !sentinel || typeof IntersectionObserver !== 'function') return;
  if (host.__nbWatch) return;
  host.__nbWatch = true;
  new IntersectionObserver(([entry]) => {
    if (host.classList.contains('is-user-open')) return;
    host.classList.toggle('is-collapsed', !entry.isIntersecting);
  }, { threshold: 0 }).observe(sentinel);

  // Scrolling back to the top clears a manual expand, so the next scroll down
  // collapses again instead of staying stuck open.
  window.addEventListener('scroll', () => {
    if (window.scrollY < 8) host.classList.remove('is-user-open');
  }, { passive: true });
}
