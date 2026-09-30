// ========== Weigh in (spec 10.4) ==========
// The only weigh-in UI. The now block's weight, the Training weight pill, the
// brief's "weigh in" chip, the + sheet and Coach all open this sheet. It
// replaced three: a quick modal on Today, a trend sheet in Training with its
// own inputs, and a weight form inside the Strength pane.
//
// Weight and waist are optional each; either one alone is a weigh-in.

let weighDate = null;   // the day being logged; today unless opened for another

function weighValue(v) {
  // A few old entries were stored as { lbs }. Everything else is a number.
  const n = (v && typeof v === 'object') ? Number(v.lbs) : Number(v);
  return n > 0 ? n : null;
}

// Least-squares slope in lb per day over [date, value] pairs.
function weighSlope(points) {
  if (points.length < 3) return null;
  const t0 = new Date(points[0][0] + 'T00:00:00').getTime();
  const xs = points.map(p => (new Date(p[0] + 'T00:00:00').getTime() - t0) / 86400000);
  if (xs[xs.length - 1] < 7) return null;   // under a week says nothing yet
  const ys = points.map(p => p[1]);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
  return den ? num / den : null;
}

// "early December", "mid March"
function weighWhen(ms) {
  const d = new Date(ms);
  const part = d.getDate() <= 10 ? 'early' : (d.getDate() <= 20 ? 'mid' : 'late');
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return part + ' ' + month + (sameYear ? '' : ' ' + d.getFullYear());
}

// The last 30 days, the change across them, and where the trend is heading.
function renderWeighTrend() {
  const host = document.getElementById('weighTrend');
  if (!host) return;
  const goal = Number((typeof getGoals === 'function' && getGoals().weight) || 0) || null;
  const today = getTodayStr();
  const start = offsetDateStr(today, -29);
  const log = state.weight || {};

  const series = [];
  for (let i = 29; i >= 0; i--) {
    const date = offsetDateStr(today, -i);
    series.push({ date: date, value: weighValue(log[date]) });
  }
  const pts = series.filter(p => p.value !== null);
  const trend = (typeof weightTrendSeries === 'function' ? weightTrendSeries() : [])
    .map(p => [p[0], weighValue(p[1])]).filter(p => p[1] !== null);
  const inWindow = trend.filter(p => p[0] >= start);

  let head = '';
  if (inWindow.length >= 2) {
    const d = Math.round((inWindow[inWindow.length - 1][1] - inWindow[0][1]) * 10) / 10;
    head = `<em>${d > 0 ? '+' : ''}${d} lb</em>`;
  }

  let note = '';
  const latest = trend.length ? trend[trend.length - 1][1] : null;
  if (latest !== null && goal) {
    const gap = Math.round((latest - goal) * 10) / 10;
    const slope = weighSlope(inWindow);
    if (Math.abs(gap) < 0.5) {
      note = 'At your goal.';
    } else {
      note = `${Math.abs(gap)} lb to your goal.`;
      if (slope !== null) {
        const toward = gap > 0 ? slope < -0.01 : slope > 0.01;
        if (toward) {
          const days = Math.abs(gap / slope);
          note += days > 730 ? ' Moving toward it, slowly.' : ` On pace for ${weighWhen(Date.now() + days * 86400000)}.`;
        } else if (Math.abs(slope) <= 0.01) {
          note += ' Holding steady.';
        } else {
          note += ' Moving away from it lately.';
        }
      }
    }
  } else if (latest === null) {
    note = 'Your 30-day line starts with the first weigh-in.';
  }

  // Insights' own line chart, so the weight line looks the same in both places.
  const chart = pts.length >= 3 && typeof insightLine === 'function'
    ? `<div class="wg-chart">${insightLine(series, { k: 'sleep', goal: goal, unit: ' lb', label: 'Body weight, last 30 days' })}</div>`
    : '';

  const waist = state.waist || {};
  const wDates = Object.keys(waist).filter(d => Number(waist[d]) > 0).sort();
  let waistLine = '';
  if (wDates.length) {
    const last = Number(waist[wDates[wDates.length - 1]]);
    const since = wDates.length > 1 ? Math.round((last - Number(waist[wDates[0]])) * 10) / 10 : null;
    waistLine = `<p class="set-sub">Waist ${last} in${since !== null ? `, ${since > 0 ? '+' : ''}${since} since ${esc(formatDate(wDates[0]))}` : ''}.</p>`;
  }

  host.innerHTML = `
    <div class="dl-card-h"><span>Last 30 days</span>${head}</div>
    ${chart || '<p class="wg-empty">Three weigh-ins this month and the line appears here.</p>'}
    ${note ? `<p class="set-sub">${esc(note)}</p>` : ''}
    ${waistLine}`;
}

// opts.date: log a day other than today (Training, when viewing a past day).
function openWeightSheet(opts) {
  const wrap = document.getElementById('weighSheet');
  if (!wrap) return;
  const o = opts || {};
  weighDate = (typeof o.date === 'string' && o.date) ? o.date : getTodayStr();
  const isToday = weighDate === getTodayStr();

  document.getElementById('weighTitle').textContent = 'Weigh in';
  const when = document.getElementById('weighWhen');
  if (when) when.textContent = isToday ? '' : (typeof lineDayLabel === 'function' ? lineDayLabel(weighDate) : formatDate(weighDate));

  // Opening a day that already has a weigh-in edits it rather than asking again.
  const w = weighValue((state.weight || {})[weighDate]);
  const waist = Number((state.waist || {})[weighDate]) || null;
  const lastDate = Object.keys(state.weight || {}).filter(d => weighValue(state.weight[d]) !== null).sort().pop();
  const wIn = document.getElementById('weighWeight');
  const waIn = document.getElementById('weighWaist');
  wIn.value = w !== null ? w : '';
  wIn.placeholder = lastDate ? String(weighValue(state.weight[lastDate])) : '160';
  waIn.value = waist || '';
  document.getElementById('weighErr').hidden = true;
  renderWeighTrend();
  openDlSheet(wrap);
  setTimeout(() => { wIn.focus({ preventScroll: true }); }, 80);
}

function closeWeightSheet() {
  closeDlSheet(document.getElementById('weighSheet'));
}

function saveWeighIn() {
  const wIn = document.getElementById('weighWeight');
  const waIn = document.getElementById('weighWaist');
  const err = document.getElementById('weighErr');
  const v = Number(wIn.value);
  const waist = Number(waIn.value);
  const hasW = wIn.value !== '' && v >= 50 && v <= 500;
  const hasWaist = waIn.value !== '' && waist >= 15 && waist <= 80;
  const badW = wIn.value !== '' && !hasW;
  const badWaist = waIn.value !== '' && !hasWaist;
  if (badW || badWaist || (!hasW && !hasWaist)) {
    err.textContent = badW ? 'Weight should be between 50 and 500 lb.'
      : badWaist ? 'Waist should be between 15 and 80 in.'
      : 'Enter your weight, your waist, or both.';
    err.hidden = false;
    (badWaist && !badW ? waIn : wIn).focus();
    return;
  }

  const date = weighDate || getTodayStr();
  state.weight = state.weight || {};
  state.waist = state.waist || {};
  const prevW = state.weight[date];
  const prevWaist = state.waist[date];
  if (hasW) state.weight[date] = Math.round(v * 10) / 10;
  if (hasWaist) state.waist[date] = Math.round(waist * 10) / 10;
  saveData(state);
  if (typeof haptic === 'function') haptic('success');
  closeWeightSheet();
  render();

  const parts = [hasW ? `${Math.round(v * 10) / 10} lb` : null, hasWaist ? `${Math.round(waist * 10) / 10} in waist` : null].filter(Boolean);
  showToast(`Weighed in: ${parts.join(' · ')} · Undo`, () => {
    if (hasW) { if (prevW === undefined) delete state.weight[date]; else state.weight[date] = prevW; }
    if (hasWaist) { if (prevWaist === undefined) delete state.waist[date]; else state.waist[date] = prevWaist; }
    saveData(state);
    render();
  });
}

function bindWeightSheet() {
  const wrap = document.getElementById('weighSheet');
  if (!wrap) return;
  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-weigh-cancel]')) closeWeightSheet();
    else if (e.target.closest('#weighSave')) saveWeighIn();
  });
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); saveWeighIn(); }
  });
  wrap.addEventListener('input', () => { document.getElementById('weighErr').hidden = true; });
}
