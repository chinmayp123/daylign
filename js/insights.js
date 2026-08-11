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
  const r = (v) => (o.decimals ? Math.round(v * 10) / 10 : Math.round(v));

  const cells = [
    ['Latest', r(last) + u],
    ['Avg', r(avg) + u],
    ['Range', r(min) + '–' + r(max) + u],
  ];
  if (o.showTotal) cells.push(['Total', r(sum) + u]);
  if (o.goal) {
    const hit = vals.filter(v => v >= o.goal).length;
    cells.push(['Hit goal', hit + '/' + vals.length + ' days']);
  }
  cells.push(['Logged', pts.length + ' of ' + series.length + ' days']);

  return '<div class="ins-stats">' + cells.map(c =>
    '<div class="ins-stat"><div class="ins-stat-v tnum">' + esc(String(c[1])) + '</div>' +
    '<div class="ins-stat-l">' + esc(c[0]) + '</div></div>').join('') + '</div>';
}

function insightLine(series, opts) {
  const o = opts || {};
  const pts = series.filter(p => p.value !== null);
  if (pts.length < MIN_CHART_POINTS) return insightGrowing(pts.length, o.unit);

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

  const coords = pts.map(p => `${Math.round(x(p.date) * 10) / 10},${Math.round(y(p.value) * 10) / 10}`);
  const area = `${coords.join(' ')} ${Math.round(x(pts[pts.length - 1].date))},${H - PY} ${Math.round(x(pts[0].date))},${H - PY}`;
  const color = o.color || 'var(--accent)';
  const gid = 'ig' + (o.id || Math.round(hi * 7 + pts.length));

  const goalLine = o.goal ? `
    <line x1="${PX}" y1="${y(o.goal)}" x2="${W - PX}" y2="${y(o.goal)}" stroke="var(--purple)"
      stroke-width="1.5" stroke-dasharray="5 5" opacity="0.6"/>
    <text x="${W - PX}" y="${y(o.goal) - 5}" text-anchor="end" font-size="10" fill="var(--purple)">goal ${Math.round(o.goal)}</text>` : '';

  return `
    <svg class="ins-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${o.fill || 'rgba(109,106,248,0.26)'}"/>
        <stop offset="1" stop-color="rgba(0,0,0,0)"/>
      </linearGradient></defs>
      ${goalLine}
      <polygon fill="url(#${gid})" points="${area}"/>
      <polyline class="ins-line" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"
        stroke-linejoin="round" pathLength="100" points="${coords.join(' ')}"/>
      <circle cx="${x(pts[pts.length - 1].date)}" cy="${y(pts[pts.length - 1].value)}" r="4.5"
        fill="${color}" stroke="var(--bg-card)" stroke-width="2"/>
    </svg>
    <div class="ins-axis">
      <span>${formatDate(pts[0].date)}</span>
      <span class="ins-axis-scale">${Math.round(lo)}–${Math.round(hi)}${o.unit || ''}</span>
      <span>${formatDate(pts[pts.length - 1].date)}</span>
    </div>`;
}

// Column chart with an optional goal line. Zero-value days stay as stubs so a
// gap in the habit is visible rather than invisible.
function insightBars(series, opts) {
  const o = opts || {};
  const withData = series.filter(p => p.value !== null && p.value > 0);
  if (withData.length < MIN_CHART_POINTS) return insightGrowing(withData.length, o.unit);

  const max = Math.max.apply(null, series.map(p => p.value || 0).concat([o.goal || 0, 1]));
  const goalPct = o.goal ? (1 - o.goal / max) * 100 : null;

  const cols = series.map(p => {
    const v = p.value || 0;
    const pct = max ? (v / max) * 100 : 0;
    const hit = o.goal && v >= o.goal;
    return `<div class="ins-col" title="${esc(formatDate(p.date))} · ${Math.round(v)}${esc(o.unit || '')}">
      <div class="ins-bar${v ? '' : ' is-empty'}" style="height:${v ? Math.max(3, pct) : 3}%;background:${v ? (hit ? 'var(--green)' : (o.color || 'var(--accent)')) : 'var(--bg-hover)'}"></div>
    </div>`;
  }).join('');

  return `
    <div class="ins-barwrap">
      ${goalPct !== null && goalPct >= 0 ? `<div class="ins-goal-line" style="top:${goalPct}%"><span>goal ${Math.round(o.goal)}</span></div>` : ''}
      <div class="ins-bars">${cols}</div>
    </div>
    <div class="ins-axis">
      <span>${formatDate(series[0].date)}</span>
      <span class="ins-axis-scale">peak ${Math.round(max)}${o.unit || ''}</span>
      <span>${formatDate(series[series.length - 1].date)}</span>
    </div>`;
}

function insightGrowing(have, unit) {
  const need = MIN_CHART_POINTS - have;
  return `
    <div class="ins-growing">
      <div class="ins-growing-bars">${[24, 46, 33, 62, 41].map(h => `<span style="height:${h}%"></span>`).join('')}</div>
      <p>${have === 0 ? 'Nothing logged in this range' : `Only ${have} day${have === 1 ? '' : 's'} logged`}${unit ? '' : ''}</p>
      <small>${need > 0 ? `${need} more day${need === 1 ? '' : 's'} and this becomes a chart` : 'Widen the range to see more'}</small>
    </div>`;
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
  const totalSets = days.reduce((s, d) => s + (sets[d] || 0), 0);
  const tasksDone = (state.tasks || []).filter(t => t.completedAt && inRange(t.completedAt)).length;

  return { days, avgCal, avgPro, trainDays, totalSets, tasksDone, loggedDays: loggedDiet.length, goals };
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

  const rangeChips = INSIGHT_RANGES.map(r =>
    `<button type="button" class="ins-range${r.key === insightsRange ? ' active' : ''}" data-ins-range="${r.key}">${r.label}</button>`
  ).join('');

  const tile = (v, l, sub) => `
    <div class="ins-tile">
      <div class="ins-tile-v tnum">${v === null || v === undefined ? '—' : v}</div>
      <div class="ins-tile-l">${esc(l)}</div>
      ${sub ? `<div class="ins-tile-s">${esc(sub)}</div>` : ''}
    </div>`;

  const card = (title, chip, body, note) => `
    <div class="card ins-card">
      <div class="coach-head">
        <h2>${esc(title)}</h2>
        ${chip ? `<span class="weight-goal-chip">${esc(chip)}</span>` : ''}
      </div>
      ${body}
      ${note ? `<div class="ins-note">${esc(note)}</div>` : ''}
    </div>`;

  // series
  const calSeries = bucketSeries(days, d => diet[d] ? Math.round(diet[d].calories) : null);
  const proSeries = bucketSeries(days, d => diet[d] ? Math.round(diet[d].protein) : null);
  const waterSeries = bucketSeries(days, d => waterOzFor(d));
  const setsSeries = bucketSeries(days, d => sets[d] || 0);
  const weightSeries = bucketSeries(days, d => (state.weight && state.weight[d]) ? state.weight[d] : null);
  const sleepSeries = bucketSeries(days, d => (typeof sleepHoursFor === 'function') ? sleepHoursFor(d) : null);

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
    const total = MUSCLE_ORDER.reduce((n, g) => n + tally[g], 0);
    muscleBody = total ? `
      <div class="ins-split">
        ${MUSCLE_ORDER.map(g => {
          const pct = Math.round((tally[g] / total) * 100);
          return `<div class="ins-split-row">
            <span class="ins-split-name">${MUSCLE_LABEL[g]}</span>
            <div class="ins-split-track"><div class="ins-split-fill" style="width:${pct}%;background:${MUSCLE_COLOR[g]}"></div></div>
            <span class="ins-split-val tnum">${tally[g]}</span>
          </div>`;
        }).join('')}
      </div>` : insightGrowing(0);
  }

  // task completion
  const doneInRange = (state.tasks || []).filter(t => t.completedAt && inRange(t.completedAt)).length;
  const createdInRange = (state.tasks || []).filter(t => t.created && inRange(t.created)).length;
  const openNow = (state.tasks || []).filter(t => t.status !== 'done').length;
  const rate = (doneInRange + openNow) ? Math.round((doneInRange / (doneInRange + openNow)) * 100) : 0;

  host.innerHTML = `
    <div class="ins-toolbar">
      <div class="ins-ranges">${rangeChips}</div>
      <button type="button" class="ins-export" id="insExport" title="Download this range as CSV">Export CSV</button>
    </div>

    <div class="ins-tiles">
      ${tile(s.avgCal, 'Avg calories', s.loggedDays ? `${s.loggedDays} days logged` : 'no food logged')}
      ${tile(s.avgPro !== null ? s.avgPro + 'g' : null, 'Avg protein', goals.protein ? `goal ${goals.protein}g` : '')}
      ${tile(s.trainDays, 'Training days', `${s.totalSets} sets`)}
      ${tile(s.tasksDone, 'Tasks done', rate ? `${rate}% completion` : '')}
    </div>

    ${card('Calories', goals.calories ? `goal ${goals.calories}` : '', insightLine(calSeries, { goal: goals.calories, id: 1, unit: '' }) + chartStats(calSeries, { goal: goals.calories }), 'Daily intake. Gaps are days with nothing logged, not zero-calorie days.')}
    ${card('Protein', goals.protein ? `goal ${goals.protein}g` : '', insightBars(proSeries, { goal: goals.protein, unit: 'g', color: 'var(--green)' }) + chartStats(proSeries, { goal: goals.protein, unit: 'g' }), 'Green columns cleared the goal.')}
    ${card('Training volume', `${s.totalSets} sets`, insightBars(setsSeries, { unit: ' sets', color: 'var(--accent)' }) + chartStats(setsSeries, { unit: ' sets', showTotal: true }), 'Sets logged per day.')}
    ${muscleBody ? card('Sets by muscle group', 'this range', muscleBody, 'Where the work actually went.') : ''}
    ${card('Water', goals.water ? `goal ${goals.water} oz` : '', insightBars(waterSeries, { goal: goals.water, unit: ' oz', color: 'var(--blue)' }) + chartStats(waterSeries, { goal: goals.water, unit: ' oz', showTotal: true }))}
    ${card('Body weight', goals.weight ? `goal ${goals.weight} lbs` : '', insightLine(weightSeries, { goal: goals.weight, color: 'var(--green)', fill: 'rgba(52,211,153,0.22)', id: 2, unit: '' }) + chartStats(weightSeries, { unit: ' lbs', decimals: true }))}
    ${card('Sleep', 'hours', insightBars(sleepSeries, { goal: goals.sleep || 8, unit: 'h', color: 'var(--purple)' }) + chartStats(sleepSeries, { goal: goals.sleep || 8, unit: 'h', decimals: true }))}
    ${card('Tasks', `${rate}% done`, `
      <div class="ins-tiles ins-tiles-sm">
        ${tile(doneInRange, 'Completed')}
        ${tile(createdInRange, 'Created')}
        ${tile(openNow, 'Still open')}
      </div>`)}
  `;

  host.querySelectorAll('[data-ins-range]').forEach(btn => {
    btn.addEventListener('click', () => { insightsRange = btn.dataset.insRange; renderInsights(); });
  });
  const exp = document.getElementById('insExport');
  if (exp) exp.addEventListener('click', exportInsightsCsv);
}

// One row per day in the active range, every metric side by side.
function exportInsightsCsv() {
  const days = insightsDays();
  const diet = dietTotalsByDate();
  const sets = gymSetsByDate();
  const rows = [['date', 'calories', 'protein', 'carbs', 'fat', 'sets', 'water_oz', 'weight_lbs', 'sleep_hours']];
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
