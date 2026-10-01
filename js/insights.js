// ========== Insights ==========
// Cross-domain analytics over whatever history exists. Every chart is drawn as
// inline SVG or height-% bars to match the rest of the app (no chart library,
// no build step), and every one degrades honestly: a series with too few points
// renders a "keep logging" state instead of a misleading line.
//
// Ranges are Week / Month / Year / All. Year and All currently resolve to the
// same window because the log starts in April — the range chips say so rather
// than pretending otherwise.

let insightsRange = 'month'; // 'week' | 'month' | 'year' | 'all'

const INSIGHT_RANGES = [
  { key: 'week',  label: 'Week',  days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'year',  label: 'Year',  days: 365 },
  { key: 'all',   label: 'All',   days: null },
];

const MIN_CHART_POINTS = 3; // below this a chart is noise, so show a growing state

// ---------- range helpers ----------
function insightsStartDate() {
  const r = INSIGHT_RANGES.find(x => x.key === insightsRange) || INSIGHT_RANGES[1];
  if (!r.days) return '0000-01-01';
  return offsetDateStr(getTodayStr(), -(r.days - 1));
}

function inRange(dateStr) {
  return !!dateStr && dateStr >= insightsStartDate() && dateStr <= getTodayStr();
}

// Every date in the active window, oldest first (bounded so "all" on a long
// history doesn't try to plot thousands of columns).
function insightsDays(maxDays) {
  const start = insightsStartDate();
  const today = getTodayStr();
  const out = [];
  let cursor = today;
  const cap = maxDays || 400;
  while (cursor >= start && out.length < cap) {
    out.push(cursor);
    cursor = offsetDateStr(cursor, -1);
  }
  return out.reverse();
}

// Collapse a daily series into weekly buckets when the window is long, so a
// year of data doesn't render 365 unreadable columns.
function bucketSeries(days, valueFor) {
  const raw = days.map(d => ({ date: d, value: valueFor(d) }));
  if (raw.length <= 31) return raw;
  const size = Math.ceil(raw.length / 26);
  const out = [];
  for (let i = 0; i < raw.length; i += size) {
    const chunk = raw.slice(i, i + size);
    const withVal = chunk.filter(c => c.value !== null);
    out.push({
      date: chunk[0].date,
      value: withVal.length ? withVal.reduce((s, c) => s + c.value, 0) / withVal.length : null,
    });
  }
  return out;
}

// ---------- chart primitives ----------
// Area + line chart. Points with null values create gaps rather than dropping
// to zero, which would invent a bad day where there is simply no log.

// Every chart gets a readable numeric summary underneath it. Hover tooltips
// were the only way to see a value, and a phone has no hover — so the charts
// looked like data without ever showing any.
function chartStats(series, opts) {
  const o = opts || {};
  const pts = series.filter(p => p.value !== null && (o.includeZero || p.value > 0));
  if (!pts.length) return '';
  const vals = pts.map(p => p.value);
  const sum = vals.reduce((a, b) => a + b, 0);
  const avg = sum / vals.length;
  const max = Math.max.apply(null, vals);
  const min = Math.min.apply(null, vals);
  const last = vals[vals.length - 1];
  const u = o.unit || '';
  const r = (v) => (o.decimals ? Math.round(v * 10) / 10 : Math.round(v)).toLocaleString();

  const cells = [
    ['latest', r(last) + u],
    ['avg', r(avg) + u],
    ['range', r(min) + ' to ' + r(max) + u],
  ];
  if (o.showTotal) cells.push(['total', r(sum) + u]);
  if (o.goal) {
    const hit = vals.filter(v => v >= o.goal).length;
    cells.push(['at goal', hit + ' of ' + vals.length]);
  }
  cells.push(['logged', pts.length + ' of ' + series.length]);

  return '<div class="ins-stats">' + cells.map(c =>
    '<span><b>' + esc(String(c[1])) + '</b> ' + esc(c[0]) + '</span>').join('') + '</div>';
}

function tipVal(v, opts) {
  const o = opts || {};
  const n = o.decimals ? Math.round(v * 10) / 10 : Math.round(v);
  return n.toLocaleString() + (o.unit || '');
}

// One tooltip shared by every chart on the page, driven by pointer events so it
// works identically under a mouse and under a thumb. Native title= did neither
// well: a second of hover delay on desktop, and nothing at all on iOS.
function attachChartHovers(host) {
  if (!host) return;

  // renderInsights replaces host.innerHTML on every range change, which throws
  // the tooltip node away. Resolve it lazily so the handlers below never hold a
  // reference to a detached element.
  const getTip = () => {
    let t = host.querySelector(':scope > .ins-tip');
    if (!t) {
      t = document.createElement('div');
      t.className = 'ins-tip';
      t.setAttribute('role', 'status');
      host.appendChild(t);
    }
    return t;
  };
  getTip();

  if (host.dataset.hoversBound === '1') return; // delegated — bind listeners once
  host.dataset.hoversBound = '1';

  let activeDot = null;
  const hide = () => {
    getTip().classList.remove('show');
    if (activeDot) { activeDot.setAttribute('opacity', '0'); activeDot = null; }
  };

  const show = (el) => {
    const text = el.dataset.tip;
    if (!text) return hide();
    const tip = getTip();
    tip.textContent = text;
    tip.classList.add('show');

    // Park the hover dot on the data point itself, not the invisible hit slice.
    const svg = el.ownerSVGElement;
    const dot = svg && svg.querySelector('.ins-hover-dot');
    if (activeDot && activeDot !== dot) activeDot.setAttribute('opacity', '0');
    if (dot && el.dataset.cx) {
      dot.setAttribute('cx', el.dataset.cx);
      dot.setAttribute('cy', el.dataset.cy);
      dot.setAttribute('opacity', '1');
      activeDot = dot;
    }

    // Anchor above the bar or point, clamped inside the card so it never
    // hangs off the edge of a phone screen.
    const anchor = el.classList.contains('ins-col') ? (el.querySelector('.ins-bar') || el) : el;
    const hr = host.getBoundingClientRect();
    const r = anchor.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.max(6, Math.min(hr.width - w - 6, r.left - hr.left + r.width / 2 - w / 2));
    let top = r.top - hr.top - h - 8;
    if (top < 2) top = r.bottom - hr.top + 8; // flip below when there is no room
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };

  const onMove = e => {
    const el = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (el) show(el); else hide();
  };
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerdown', onMove);
  host.addEventListener('pointerleave', hide);
  // A tap elsewhere, a scroll, or a range change should all dismiss it.
  host.addEventListener('scroll', hide, true);
  window.addEventListener('scroll', hide, { passive: true });
}

// opts.k is the category colour key (food / water / move / sleep / meet); the
// chart takes its colour from the matching c- class, so nothing here names a hue.
function insightLine(series, opts) {
  const o = opts || {};
  const pts = series.filter(p => p.value !== null);
  if (pts.length < MIN_CHART_POINTS) return insightGrowing(pts.length);

  const W = 640, H = 150, PX = 8, PY = 18;
  const vals = pts.map(p => p.value);
  let hi = Math.max.apply(null, vals);
  let lo = Math.min.apply(null, vals);
  if (o.goal) { hi = Math.max(hi, o.goal); lo = Math.min(lo, o.goal); }
  const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.1);
  hi += pad; lo = o.zeroBased ? 0 : Math.max(0, lo - pad);
  const range = (hi - lo) || 1;

  const idxOf = {};
  series.forEach((p, i) => { idxOf[p.date] = i; });
  const n = Math.max(1, series.length - 1);
  const x = d => PX + (idxOf[d] / n) * (W - PX * 2);
  const y = v => PY + (1 - (v - lo) / range) * (H - PY * 2);
  const xy = p => `${Math.round(x(p.date) * 10) / 10},${Math.round(y(p.value) * 10) / 10}`;

  // A line chart is for measurements taken now and then (body weight), so the
  // line joins the points that exist and each one is marked. It never drops to
  // zero for a day without a reading.
  const lines = `<polyline class="ins-line" fill="none" points="${pts.map(xy).join(' ')}"/>` +
    (pts.length <= 24 ? pts.map(p => `<circle class="ins-pt" cx="${Math.round(x(p.date) * 10) / 10}" cy="${Math.round(y(p.value) * 10) / 10}" r="3"/>`).join('') : '');
  const areas = `<polygon class="ins-area" points="${pts.map(xy).join(' ')} ${Math.round(x(pts[pts.length - 1].date))},${H - PY} ${Math.round(x(pts[0].date))},${H - PY}"/>`;

  // A polyline has nothing to hover. An invisible slice over each point is what
  // gets hit-tested — slices only, so hovering a gap shows nothing.
  const half = (W - PX * 2) / n / 2;
  const hits = pts.map(p => {
    const cx = x(p.date), cy = y(p.value);
    return `<rect class="ins-hit" x="${Math.round((cx - half) * 10) / 10}" y="0" width="${Math.round(half * 20) / 10}" height="${H}"
      fill="transparent" data-tip="${esc(formatDate(p.date) + ' · ' + tipVal(p.value, o))}"
      data-cx="${Math.round(cx * 10) / 10}" data-cy="${Math.round(cy * 10) / 10}"/>`;
  }).join('');
  const lastP = pts[pts.length - 1];
  const label = `${o.label || 'Chart'}: ${pts.length} points from ${tipVal(pts[0].value, o)} to ${tipVal(lastP.value, o)}`;

  return `
    <svg class="ins-chart c-${o.k || 'move'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">
      ${o.goal ? `<line class="ins-goal-l" x1="${PX}" y1="${y(o.goal)}" x2="${W - PX}" y2="${y(o.goal)}"/>` : ''}
      ${areas}${lines}
      <circle class="ins-pt is-last" cx="${x(lastP.date)}" cy="${y(lastP.value)}" r="4.5"/>
      <circle class="ins-hover-dot ins-pt is-last" r="5.5" opacity="0"/>
      ${hits}
    </svg>
    <div class="ins-axis">
      <span>${formatDate(pts[0].date)}</span>
      <span>${o.goal ? 'goal ' + tipVal(o.goal, o) + ' (dashed)' : Math.round(lo) + ' to ' + Math.round(hi) + (o.unit || '')}</span>
      <span>${formatDate(lastP.date)}</span>
    </div>`;
}

// Column chart with an optional dashed goal line. A day with NOTHING logged is
// a gap; a day logged as zero is a stub. They are different facts.
function insightBars(series, opts) {
  const o = opts || {};
  const withData = series.filter(p => p.value !== null && p.value > 0);
  if (withData.length < MIN_CHART_POINTS) return insightGrowing(withData.length);

  const max = Math.max.apply(null, series.map(p => p.value || 0).concat([o.goal || 0, 1]));
  const goalPct = o.goal ? (1 - o.goal / max) * 100 : null;

  const cols = series.map(p => {
    const label = formatDate(p.date) + ' · ' + (p.value === null ? 'nothing logged' : tipVal(p.value, o));
    if (p.value === null) return `<div class="ins-col is-gap" data-tip="${esc(label)}"></div>`;
    const pct = max ? (p.value / max) * 100 : 0;
    return `<div class="ins-col" data-tip="${esc(label)}"><i class="ins-bar${p.value ? '' : ' is-zero'}" style="height:${p.value ? Math.max(3, pct) : 0}%"></i></div>`;
  }).join('');
  const label = `${o.label || 'Chart'}: ${withData.length} of ${series.length} logged, peak ${tipVal(max, o)}`;

  return `
    <div class="ins-barwrap c-${o.k || 'move'}" role="img" aria-label="${esc(label)}">
      ${goalPct !== null && goalPct >= 0 ? `<div class="ins-goal" style="top:${goalPct}%"></div>` : ''}
      <div class="ins-bars">${cols}</div>
    </div>
    <div class="ins-axis">
      <span>${formatDate(series[0].date)}</span>
      <span>${o.goal ? 'goal ' + tipVal(o.goal, o) + ' (dashed)' : 'peak ' + tipVal(max, o)}</span>
      <span>${formatDate(series[series.length - 1].date)}</span>
    </div>`;
}

// Under three points there is no chart to draw, and drawing one would be a
// line between two dots pretending to be a trend.
function insightGrowing(have) {
  const need = MIN_CHART_POINTS - have;
  return `<div class="ins-growing"><b>Still growing</b>${have === 0
    ? 'Nothing logged in this range yet.'
    : `${have} day${have === 1 ? '' : 's'} logged. ${need} more and this becomes a chart.`}</div>`;
}

// ---------- data series ----------
function dietTotalsByDate() {
  const map = {};
  (state.diet || []).forEach(e => {
    if (!e || !e.date) return;
    if (!map[e.date]) map[e.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    map[e.date].calories += e.calories || 0;
    map[e.date].protein += e.protein || 0;
    map[e.date].carbs += e.carbs || 0;
    map[e.date].fat += e.fat || 0;
  });
  return map;
}

// state.water[date] is an ARRAY of individual pours ([8, 12, 20]), not a total
// — Firebase may also hand it back as a numeric-keyed object.
function waterOzFor(dateStr) {
  const e = state.water && state.water[dateStr];
  if (!e) return 0;
  const arr = Array.isArray(e) ? e : (typeof e === 'object' ? Object.values(e) : [e]);
  return arr.reduce((s, v) => s + (Number(v) || 0), 0);
}

function gymSetsByDate() {
  const map = {};
  (state.gym || []).forEach(e => {
    if (!e || !e.date) return;
    const sets = (typeof setsOf === 'function') ? setsOf(e).length : ((e.sets || []).length);
    map[e.date] = (map[e.date] || 0) + sets;
  });
  return map;
}

// ---------- summary ----------
function insightsSummary() {
  const days = insightsDays();
  const diet = dietTotalsByDate();
  const sets = gymSetsByDate();
  const goals = (typeof getGoals === 'function') ? getGoals() : {};

  const loggedDiet = days.filter(d => diet[d]);
  const avgCal = loggedDiet.length ? Math.round(loggedDiet.reduce((s, d) => s + diet[d].calories, 0) / loggedDiet.length) : null;
  const avgPro = loggedDiet.length ? Math.round(loggedDiet.reduce((s, d) => s + diet[d].protein, 0) / loggedDiet.length) : null;
  const trainDays = days.filter(d => sets[d]).length;
  // A two-set check-in is not a training day. Reporting them together turned a
  // month with 11 real sessions into "20 training days".
  const full = (typeof isFullSession === 'function')
    ? days.filter(d => (sets[d] || 0) > 0 && isFullSession(d)).length
    : trainDays;
  const checkIns = trainDays - full;
  const totalSets = days.reduce((s, d) => s + (sets[d] || 0), 0);
  const tasksDone = (state.tasks || []).filter(t => t.completedAt && inRange(t.completedAt)).length;

  return { days, avgCal, avgPro, trainDays, fullSessions: full, checkIns, totalSets, tasksDone, loggedDays: loggedDiet.length, goals };
}

// ---------- the weekly report ----------
// One sentence and a stat line, for the last seven days whatever range the
// charts are on. This card was rendered on Today into a host that no longer
// existed; it lives here now (spec 9).
function insightsWeekReport() {
  const today = getTodayStr();
  const week = [];
  for (let i = 6; i >= 0; i--) week.push(offsetDateStr(today, -i));
  const diet = dietTotalsByDate();
  const goals = (typeof getGoals === 'function') ? getGoals() : {};
  const bw = (typeof briefWeek === 'function') ? briefWeek() : { sessions: 0, tasks: 0 };

  const logged = week.filter(d => diet[d]);
  const proteinDays = goals.protein ? logged.filter(d => diet[d].protein >= goals.protein).length : 0;

  let lead;
  if (!logged.length && !bw.sessions && !bw.tasks) lead = 'Nothing logged this week.';
  else if (bw.sessions >= 4 && proteinDays >= 4) lead = 'Strong week.';
  else if (bw.sessions >= 3 || proteinDays >= 4) lead = 'Solid week.';
  else if (bw.sessions >= 1 || logged.length >= 3) lead = 'A steady week.';
  else lead = 'A light week.';

  const bits = [];
  bits.push(`${bw.sessions} session${bw.sessions === 1 ? '' : 's'}`);
  if (logged.length && goals.protein) bits.push(`protein hit ${proteinDays} of ${logged.length} logged day${logged.length === 1 ? '' : 's'}`);
  const rest = (logged.length || bw.sessions) ? bits.join(', ') + '.' : 'Log a meal or a session and this fills in.';

  // The stat line: only the parts there is data for.
  const stats = [];
  const weights = week.filter(d => state.weight && state.weight[d]).map(d => Number(state.weight[d]));
  if (weights.length >= 2) {
    const delta = Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10;
    stats.push(`Weight ${delta > 0 ? '+' : ''}${delta} lb`);
  }
  stats.push(`${bw.tasks} task${bw.tasks === 1 ? '' : 's'} done`);
  if (typeof sleepHoursFor === 'function') {
    const nights = week.map(d => sleepHoursFor(d)).filter(h => typeof isPlausibleSleep === 'function' ? isPlausibleSleep(h) : h);
    if (nights.length) {
      const avg = nights.reduce((a, b) => a + b, 0) / nights.length;
      stats.push(`sleep avg ${typeof sleepHM === 'function' ? sleepHM(avg) : Math.round(avg * 10) / 10 + 'h'}`);
    }
  }
  if (bw.sessionsPrev != null && (bw.sessions || bw.sessionsPrev)) {
    const d = bw.sessions - bw.sessionsPrev;
    stats.push(d === 0 ? 'sessions level with last week' : `${Math.abs(d)} session${Math.abs(d) === 1 ? '' : 's'} ${d > 0 ? 'more' : 'fewer'} than last week`);
  }
  return { lead, rest, stats: stats.join(' · ') };
}

// Tasks completed per week across the range (per day on the Week range).
function insightsTaskSeries(days) {
  const done = {};
  (state.tasks || []).forEach(t => { if (t.completedAt) done[t.completedAt] = (done[t.completedAt] || 0) + 1; });
  if (days.length <= 7) return days.map(d => ({ date: d, value: done[d] || 0 }));
  const out = [];
  // Whole weeks ending today, oldest first, capped so a long range stays readable.
  for (let end = days.length - 1; end >= 0 && out.length < 26; end -= 7) {
    const chunk = days.slice(Math.max(0, end - 6), end + 1);
    out.unshift({ date: chunk[0], value: chunk.reduce((n, d) => n + (done[d] || 0), 0) });
  }
  return out;
}

// ---------- render ----------
function renderInsights() {
  const host = document.getElementById('insightsBody');
  if (!host) return;

  const s = insightsSummary();
  const days = s.days;
  const diet = dietTotalsByDate();
  const sets = gymSetsByDate();
  const goals = s.goals;

  const tile = (v, l, sub) => `
    <div class="dl-tile">
      <b>${v === null || v === undefined ? '—' : v}</b>
      <span>${esc(l)}${sub ? ` · ${esc(sub)}` : ''}</span>
    </div>`;

  const card = (title, chip, body, note) => `
    <div class="dl-card ins-card">
      <h6 class="dl-card-h"><span>${esc(title)}</span>${chip ? `<em>${esc(chip)}</em>` : ''}</h6>
      ${body}
      ${note ? `<p class="ins-note">${esc(note)}</p>` : ''}
    </div>`;

  // series
  const calSeries = bucketSeries(days, d => diet[d] ? Math.round(diet[d].calories) : null);
  const proSeries = bucketSeries(days, d => diet[d] ? Math.round(diet[d].protein) : null);
  // Water, sets and tasks are counts: a day with none is a real zero, not a gap.
  const waterSeries = bucketSeries(days, d => waterOzFor(d));
  const setsSeries = bucketSeries(days, d => sets[d] || 0);
  const weightSeries = bucketSeries(days, d => (state.weight && state.weight[d]) ? state.weight[d] : null);
  const sleepSeries = bucketSeries(days, d => (typeof sleepHoursFor === 'function') ? sleepHoursFor(d) : null);
  const stepSeries = bucketSeries(days, d => (typeof getExternalSteps === 'function') ? getExternalSteps(d) : null);
  const moveSeries = bucketSeries(days, d => (typeof getExternalExerciseMinutes === 'function') ? getExternalExerciseMinutes(d) : null);
  const taskSeries = insightsTaskSeries(days);
  // Most recent weigh-in of all time, not just this range — step burn scales
  // with bodyweight and a 7-day window often holds no weigh-in at all.
  const allWeighIns = Object.keys(state.weight || {}).sort();
  const latestWeight = allWeighIns.length ? Number(state.weight[allWeighIns[allWeighIns.length - 1]]) : null;

  // muscle split for the window
  let muscleBody = '';
  if (typeof muscleGroupFor === 'function' && typeof MUSCLE_ORDER !== 'undefined') {
    const tally = { push: 0, pull: 0, legs: 0, core: 0 };
    (state.gym || []).forEach(e => {
      if (!e || !inRange(e.date)) return;
      const g = muscleGroupFor(e.exercise);
      if (!g) return;
      tally[g] += (typeof setsOf === 'function') ? setsOf(e).length : 0;
    });
    const top = Math.max.apply(null, MUSCLE_ORDER.map(g => tally[g]).concat([1]));
    const total = MUSCLE_ORDER.reduce((n, g) => n + tally[g], 0);
    muscleBody = total
      ? MUSCLE_ORDER.map(g => `
          <div class="ins-split"><span>${MUSCLE_LABEL[g]}</span>
            <span class="dl-meter c-move"><i style="width:${Math.round((tally[g] / top) * 100)}%"></i></span>
            <b>${tally[g]}</b></div>`).join('')
      : insightGrowing(0);
  }

  // task completion
  const doneInRange = (state.tasks || []).filter(t => t.completedAt && inRange(t.completedAt)).length;
  const createdInRange = (state.tasks || []).filter(t => t.created && inRange(t.created)).length;
  const openNow = (state.tasks || []).filter(t => t.status !== 'done').length;

  const wk = insightsWeekReport();
  const rangeLabel = (INSIGHT_RANGES.find(r => r.key === insightsRange) || {}).label || '';
  const fmt = (n) => (n === null || n === undefined) ? null : Number(n).toLocaleString();

  host.innerHTML = `
    <div class="ins-toolbar">
      <div class="dl-seg" role="group" aria-label="Range">
        ${INSIGHT_RANGES.map(r => `<button type="button" data-ins-range="${r.key}"${r.key === insightsRange ? ' aria-pressed="true"' : ''}>${r.label}</button>`).join('')}
      </div>
      <button type="button" class="dl-btn" id="insExport"><span class="ms" aria-hidden="true">download</span>Export CSV</button>
    </div>

    <div class="dl-card tint c-move ins-week">
      <p class="ins-say"><b>${esc(wk.lead)}</b> <span>${esc(wk.rest)}</span></p>
      <p class="ins-week-stats">${esc(wk.stats)}</p>
    </div>

    <div class="dl-tiles ins-tiles">
      ${tile(fmt(s.avgCal), 'avg kcal', s.loggedDays ? `${s.loggedDays} days` : '')}
      ${tile(s.avgPro !== null ? s.avgPro + 'g' : null, 'avg protein', goals.protein ? `goal ${goals.protein}g` : '')}
      ${tile(s.fullSessions, 'full sessions', s.checkIns ? `${s.checkIns} check-in${s.checkIns === 1 ? '' : 's'}` : '')}
      ${tile(s.tasksDone, 'tasks done', '')}
    </div>

    <div class="ins-grid">
      ${card('Calories', goals.calories ? `goal ${Number(goals.calories).toLocaleString()}` : '', insightBars(calSeries, { goal: goals.calories, k: 'food', label: 'Calories' }) + chartStats(calSeries, { goal: goals.calories }), 'A gap is a day with nothing logged, not a zero.')}
      ${card('Protein', goals.protein ? `goal ${goals.protein}g` : '', insightBars(proSeries, { goal: goals.protein, unit: 'g', k: 'food', label: 'Protein' }) + chartStats(proSeries, { goal: goals.protein, unit: 'g' }))}
      ${card('Training volume', `${s.totalSets} sets`, insightBars(setsSeries, { unit: ' sets', k: 'move', label: 'Sets per day' }) + chartStats(setsSeries, { unit: ' sets', showTotal: true }))}
      ${card('Water', goals.water ? `goal ${goals.water} oz` : '', insightBars(waterSeries, { goal: goals.water, unit: ' oz', k: 'water', label: 'Water' }) + chartStats(waterSeries, { goal: goals.water, unit: ' oz' }))}
      ${card('Body weight', goals.weight ? `goal ${goals.weight} lb` : 'lb', insightLine(weightSeries, { goal: goals.weight, k: 'sleep', unit: ' lb', decimals: true, label: 'Body weight' }) + chartStats(weightSeries, { unit: ' lb', decimals: true }))}
      ${card('Sleep', 'hours', insightBars(sleepSeries, { goal: goals.sleep || 8, unit: 'h', k: 'sleep', decimals: true, label: 'Sleep' }) + chartStats(sleepSeries, { goal: goals.sleep || 8, unit: 'h', decimals: true }))}
      ${card('Steps', `goal ${(goals.steps || 8000).toLocaleString()}`, insightBars(stepSeries, { goal: goals.steps || 8000, k: 'move', label: 'Steps' }) + chartStats(stepSeries, { goal: goals.steps || 8000 }) + stepCoachNote(stepSeries, goals.steps || 8000, latestWeight), 'From your Watch.')}
      ${card('Movement', 'Watch minutes', insightBars(moveSeries, { unit: ' min', k: 'move', label: 'Exercise minutes' }) + chartStats(moveSeries, { unit: ' min', showTotal: true }))}
      ${muscleBody ? card('Sets by muscle', rangeLabel.toLowerCase(), muscleBody) : ''}
      ${card('Tasks', days.length <= 7 ? 'done per day' : 'done per week', insightBars(taskSeries, { k: 'meet', label: 'Tasks done' }) + `<div class="ins-stats"><span><b>${doneInRange}</b> completed</span><span><b>${createdInRange}</b> created</span><span><b>${openNow}</b> still open</span></div>`)}
    </div>
    <p class="ins-foot">Hover or tap any bar or point for its value. A gap means nothing was logged, not zero.</p>
  `;

  host.querySelectorAll('[data-ins-range]').forEach(btn => {
    btn.addEventListener('click', () => { insightsRange = btn.dataset.insRange; renderInsights(); });
  });
  const exp = document.getElementById('insExport');
  if (exp) exp.addEventListener('click', exportInsightsCsv);
  attachChartHovers(host);
}

// One row per day in the active range, every metric side by side.
// A goal you have never once reached stops being a target and becomes wallpaper
// — the ring sits at a quarter full forever and you learn to skip past it. When
// the gap is that wide, name the real baseline and propose a next step that is
// actually in reach, rather than silently rendering failure every day.
function stepCoachNote(series, goal, weightLbs) {
  const vals = series.filter(p => p.value !== null && p.value > 0).map(p => p.value);
  if (vals.length < 5) return '';
  const sorted = vals.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const hit = vals.filter(v => v >= goal).length;
  if (hit >= Math.ceil(vals.length * 0.2)) return ''; // goal is live — leave it alone
  const target = Math.max(3000, Math.round((median + 1500) / 500) * 500);
  if (target >= goal) return '';
  const kcal = Math.round((target - median) * (weightLbs || 160) * 0.00025);
  return `<p class="ins-note is-warn">
    Your usual day is <strong>${median.toLocaleString()}</strong> steps, and you have cleared
    ${goal.toLocaleString()} on <strong>${hit} of ${vals.length}</strong> days.
    A goal nothing ever reaches is just a red ring. Try <strong>${target.toLocaleString()}</strong> first
    — about ${kcal} kcal a day over your baseline, and reachable on a rest day.
  </p>`;
}

function exportInsightsCsv() {
  const days = insightsDays();
  const diet = dietTotalsByDate();
  const sets = gymSetsByDate();
  const rows = [['date', 'calories', 'protein', 'carbs', 'fat', 'sets', 'water_oz', 'weight_lbs', 'sleep_hours', 'steps', 'exercise_min', 'active_kcal']];
  const ext = (fn, d) => (typeof window[fn] === 'function' ? window[fn](d) : null);
  days.forEach(d => {
    const t = diet[d];
    rows.push([
      d,
      t ? Math.round(t.calories) : '',
      t ? Math.round(t.protein) : '',
      t ? Math.round(t.carbs) : '',
      t ? Math.round(t.fat) : '',
      sets[d] || '',
      waterOzFor(d) || '',
      (state.weight && state.weight[d]) || '',
      (typeof sleepHoursFor === 'function' && sleepHoursFor(d)) || '',
      ext('getExternalSteps', d) || '',
      ext('getExternalExerciseMinutes', d) || '',
      Math.round(ext('getExternalActiveEnergy', d) || 0) || '',
    ]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  try {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `daylign-insights-${insightsRange}-${getTodayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    if (typeof showToast === 'function') showToast(`Exported ${days.length} days`);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Could not export on this device');
  }
}
