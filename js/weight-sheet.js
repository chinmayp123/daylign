// ========== Weight-trend sheet (ref 5a/5b) ==========
// The full Body Weight card left the Training pane; the shell now shows a
// compact readout, and tapping it opens this sheet — a 30-day mini bar chart
// with the delta, goal, and an inline Log input (the same #weightInput /
// #weightLogBtn the gym module already wires, so logging is unchanged).

function renderWeightSheetBody() {
  const host = document.getElementById('weightSheetBody');
  if (!host) return;
  const goal = (typeof getGoals === 'function' && getGoals().weight) || 150;
  const log = state.weight || {};
  const dates = Object.keys(log).sort();

  if (!dates.length) {
    host.innerHTML = '<p class="weight-sheet-empty">No weigh-ins yet. Log your weight below and your 30-day trend appears here.</p>';
    return;
  }

  // Trend (smoothed) drives the headline number + delta; raw points draw bars.
  const trend = (typeof weightTrendSeries === 'function') ? weightTrendSeries() : dates.map(d => [d, log[d]]);
  const latest = trend[trend.length - 1][1];
  const prev = trend.length > 1 ? trend[trend.length - 2][1] : null;
  const delta = prev !== null ? Math.round((latest - prev) * 10) / 10 : null;
  const losing = latest > goal;
  const good = delta !== null && (losing ? delta <= 0 : delta >= 0);
  const toGo = Math.round(Math.abs(latest - goal) * 10) / 10;

  // 7-day average smooths daily water-weight noise — the number to actually
  // watch. Only shown once there's more than one weigh-in in the window.
  const weekAgo = (typeof offsetDateStr === 'function') ? offsetDateStr(getTodayStr(), -6) : null;
  const last7 = weekAgo ? dates.filter(d => d >= weekAgo) : [];
  const avg7 = last7.length >= 2 ? Math.round((last7.reduce((s, d) => s + log[d], 0) / last7.length) * 10) / 10 : null;

  // Waist — logged weekly, trend is what matters. Down is fat loss.
  const waistLog = state.waist || {};
  const waistDates = Object.keys(waistLog).sort();
  let waistBlock = '';
  if (waistDates.length) {
    const wLatest = waistLog[waistDates[waistDates.length - 1]];
    const wFirst = waistLog[waistDates[0]];
    const wPrev = waistDates.length > 1 ? waistLog[waistDates[waistDates.length - 2]] : null;
    const wDelta = wPrev !== null ? Math.round((wLatest - wPrev) * 10) / 10 : null;
    const wSince = Math.round((wLatest - wFirst) * 10) / 10;
    waistBlock = `
      <div class="weight-sheet-waist">
        <span class="wsw-label">Waist</span>
        <span class="wsw-num">${wLatest}<small>"</small></span>
        ${wDelta !== null ? `<span class="weight-sheet-delta ${wDelta <= 0 ? 'good' : 'bad'}">${wDelta > 0 ? '▲' : wDelta < 0 ? '▼' : '—'} ${Math.abs(wDelta)}"</span>` : ''}
        ${waistDates.length > 1 ? `<span class="weight-sheet-goal">${wSince > 0 ? '+' : ''}${wSince}" since ${formatDate(waistDates[0])}</span>` : ''}
      </div>`;
  }

  // Last 30 raw weigh-ins as bars.
  const recent = dates.slice(-30).map(d => ({ d, w: log[d] }));
  const ws = recent.map(r => r.w);
  const min = Math.min(...ws, goal), max = Math.max(...ws, goal);
  const range = max - min || 1;
  const goalY = 100 - ((goal - min) / range) * 100;

  const bars = recent.map(r => {
    const h = 12 + ((r.w - min) / range) * 88; // 12–100%
    const near = Math.abs(r.w - goal) <= 1;
    return `<div class="weight-bar-col" title="${r.w} lbs · ${formatDate(r.d)}">
      <div class="weight-bar" style="height:${h}%;background:${near ? 'var(--green)' : 'var(--accent)'}"></div>
    </div>`;
  }).join('');

  host.innerHTML = `
    <div class="weight-sheet-headline">
      <div class="weight-sheet-num">${latest}<small> lbs</small></div>
      ${delta !== null ? `<span class="weight-sheet-delta ${good ? 'good' : 'bad'}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} ${Math.abs(delta)}</span>` : ''}
      <span class="weight-sheet-goal">${toGo === 0 ? `at goal ${goal}` : `${toGo} to ${losing ? 'lose' : 'gain'} → ${goal}`}</span>
      ${avg7 !== null ? `<span class="weight-sheet-avg">7-day avg ${avg7}</span>` : ''}
    </div>
    <div class="weight-sheet-chart">
      <div class="weight-goal-line" style="top:${Math.max(0, Math.min(100, goalY))}%"><span>goal ${goal}</span></div>
      <div class="weight-bars">${bars}</div>
    </div>
    ${waistBlock}`;
}

function openWeightSheet() {
  const sheet = document.getElementById('weightSheet');
  if (!sheet) return;
  renderWeightSheetBody();
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  document.body.classList.add('logfood-sheet-lock');
  const input = document.getElementById('weightInput');
  if (input) setTimeout(() => input.focus(), 250);
}

function closeWeightSheet() {
  const sheet = document.getElementById('weightSheet');
  if (!sheet) return;
  sheet.classList.remove('open');
  document.body.classList.remove('logfood-sheet-lock');
  setTimeout(() => { sheet.hidden = true; }, 220);
}

function isWeightSheetOpen() {
  const sheet = document.getElementById('weightSheet');
  return sheet && sheet.classList.contains('open');
}

function bindWeightSheet() {
  const sheet = document.getElementById('weightSheet');
  if (!sheet) return;
  const close = document.getElementById('weightSheetClose');
  if (close) close.addEventListener('click', closeWeightSheet);
  sheet.addEventListener('click', e => { if (e.target === sheet) closeWeightSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isWeightSheetOpen()) closeWeightSheet(); });
}
