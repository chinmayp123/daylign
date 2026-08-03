// ========== Strength Analytics ==========
// Progression tracking for the Strength pane: movement history, plateau
// detection, personal records, and a per-movement progression curve.
//
// Design note: this app's real training log is calisthenics-heavy, so a
// barbell-only "estimated 1RM" view would be empty most of the time. Every
// metric here therefore has two modes, chosen off the entry's `bodyweight`
// flag: bodyweight movements are measured in REPS, loaded movements in
// estimated 1RM. Nothing is shown that the data can't support — a movement
// with fewer than MIN_CURVE_SESSIONS sessions renders a "keep logging" state
// instead of a misleading chart.

const MIN_CURVE_SESSIONS = 3;   // sessions needed before a curve is drawn
const STALL_MIN_SESSIONS = 5;   // below this we don't claim a plateau
const STALL_MIN_DAYS = 21;      // ...nor over a span shorter than this
const PR_FRESH_DAYS = 14;       // a PR this recent gets the "new" treatment

// Which movement the curve card is showing, and in which mode.
let strengthCurveKey = null;
let strengthCurveMode = 'best'; // 'best' | 'total'

// Epley — the standard estimate. Lets 5x135 and 3x155 sit on one line.
function estOneRM(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return Math.round(w * (1 + r / 30));
}

// Grouping key for an exercise name. Case and stray whitespace only — enough
// to merge "squat"/"Squat"/"Squat " without risking a merge of two genuinely
// different lifts. Typos ("Shoullder press") stay separate on purpose.
function exKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Firebase hands arrays back as objects when they have gaps — normalize.
function setsOf(entry) {
  const s = entry && entry.sets;
  if (!s) return [];
  const arr = Array.isArray(s) ? s : Object.values(s);
  return arr.filter(x => x && (x.reps || x.weight));
}

// One logged entry reduced to the numbers the analytics care about.
function sessionStats(entry) {
  const sets = setsOf(entry);
  const bw = !!entry.bodyweight;
  let bestReps = 0, best1RM = 0, totalReps = 0, volume = 0, topWeight = 0;
  sets.forEach(s => {
    const reps = Number(s.reps) || 0;
    const wt = Number(s.weight) || 0;
    totalReps += reps;
    volume += reps * wt;
    if (reps > bestReps) bestReps = reps;
    if (wt > topWeight) topWeight = wt;
    const orm = estOneRM(wt, reps);
    if (orm > best1RM) best1RM = orm;
  });
  return {
    date: entry.date,
    bodyweight: bw,
    sets: sets.length,
    bestReps, best1RM, totalReps, volume, topWeight,
    // The single number this movement is judged by.
    best: bw ? bestReps : best1RM,
  };
}

// All movements in the log, grouped and sorted by how much they're trained.
function strengthMovements() {
  const groups = {};
  (state.gym || []).forEach(e => {
    if (!e || !e.exercise || !e.date) return;
    const k = exKey(e.exercise);
    if (!k) return;
    if (!groups[k]) groups[k] = { key: k, names: {}, sessions: [], bodyweight: !!e.bodyweight };
    const g = groups[k];
    g.names[e.exercise] = (g.names[e.exercise] || 0) + 1;
    if (e.bodyweight) g.bodyweight = true;
    g.sessions.push(sessionStats(e));
  });
  return Object.values(groups).map(g => {
    g.sessions.sort((a, b) => a.date.localeCompare(b.date));
    // Display name = the spelling used most often.
    g.name = Object.keys(g.names).sort((a, b) => g.names[b] - g.names[a])[0];
    g.unit = g.bodyweight ? 'reps' : 'est. 1RM';
    return Object.assign(g, movementTrend(g));
  }).sort((a, b) => b.sessions.length - a.sessions.length);
}

// Progression verdict for one movement: PR, typical working set, and whether
// it has plateaued. "Stalled" is only claimed with enough sessions over a long
// enough span — a quiet week shouldn't read as a plateau.
function movementTrend(g) {
  const ss = g.sessions;
  const bests = ss.map(s => s.best);
  const prVal = Math.max.apply(null, bests.concat([0]));
  const prIdx = bests.lastIndexOf(prVal);
  const prDate = prIdx >= 0 ? ss[prIdx].date : null;

  // Typical = most common best-set value (what you actually do most days).
  const freq = {};
  bests.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  const typical = Number(Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0]) || 0;

  const spanDays = ss.length > 1
    ? Math.round((new Date(ss[ss.length - 1].date) - new Date(ss[0].date)) / 86400000)
    : 0;

  // Have the last few sessions beaten anything that came before?
  const tail = bests.slice(-3);
  const head = bests.slice(0, -3);
  const recentBest = tail.length ? Math.max.apply(null, tail) : 0;
  const priorBest = head.length ? Math.max.apply(null, head) : 0;
  const stalled = ss.length >= STALL_MIN_SESSIONS && spanDays >= STALL_MIN_DAYS && recentBest <= priorBest;
  const improving = priorBest > 0 && recentBest > priorBest;

  const first = bests[0] || 0;
  const last = bests[bests.length - 1] || 0;
  const gainPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  // How often the typical set shows up — the "you've done X in N of M" line.
  const typicalCount = freq[typical] || 0;

  return { prVal, prDate, typical, typicalCount, spanDays, stalled, improving, gainPct,
           sessionCount: ss.length, canCurve: ss.length >= MIN_CURVE_SESSIONS };
}

// Rolling 30-day headline: how much work actually happened.
function strengthLast30() {
  const cutoff = offsetDateStr(getTodayStr(), -30);
  const recent = (state.gym || []).filter(e => e && e.date && e.date >= cutoff);
  const days = new Set(recent.map(e => e.date));
  let reps = 0;
  const moves = new Set();
  recent.forEach(e => {
    moves.add(exKey(e.exercise));
    setsOf(e).forEach(s => { reps += Number(s.reps) || 0; });
  });
  return { sessions: days.size, reps, movements: moves.size };
}

// The one thing worth saying today. Prefers the most-trained plateaued
// movement, because that's where an extra rep is cheapest.
function strengthInsight(movements) {
  const stalled = movements.filter(m => m.stalled);
  if (!stalled.length) return null;
  const m = stalled[0];
  const target = m.bodyweight ? m.typical + 2 : m.typical + 5;
  const unit = m.bodyweight ? 'reps' : 'lbs';
  return {
    movement: m,
    title: `Your ${m.name.toLowerCase()} ${m.bodyweight ? 'have' : 'has'} been ${m.typical} ${unit} for ${Math.max(1, Math.round(m.spanDays / 30))} months`,
    body: `${m.typical} ${unit} in ${m.typicalCount} of ${m.sessionCount} sessions. Your body adapted a long time ago — the fastest win here is adding ${m.bodyweight ? 'reps' : 'weight'}, not more sessions.`,
    ctaLabel: `Try 3 × ${target} today`,
    targetReps: m.bodyweight ? target : m.typical,
    targetWeight: m.bodyweight ? 0 : (m.sessions[m.sessions.length - 1].topWeight + 5),
    name: m.name,
  };
}

// ---------- Muscle balance ----------
// Sets per muscle group per week. Volume alone flatters whatever you already
// do most, so this card is about BALANCE: which groups are carrying the week
// and which are being skipped.
const MUSCLE_ORDER = ['push', 'pull', 'legs', 'core'];
const MUSCLE_LABEL = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core' };
const MUSCLE_COLOR = { push: 'var(--accent)', pull: 'var(--blue)', legs: 'var(--green)', core: 'var(--yellow)' };
const BALANCE_WEEKS = 4; // only 3 of the last 8 weeks have data — don't draw empty columns

// Sets per group for each of the last N weeks. Index 0 = this week.
function muscleWeeks(weeks) {
  const today = getTodayStr();
  const out = [];
  for (let i = 0; i < weeks; i++) out.push({ push: 0, pull: 0, legs: 0, core: 0, total: 0 });
  (state.gym || []).forEach(e => {
    if (!e || !e.date || !e.exercise) return;
    const g = (typeof muscleGroupFor === 'function') ? muscleGroupFor(e.exercise) : null;
    if (!g) return;
    const days = Math.round((new Date(today + 'T00:00:00') - new Date(e.date + 'T00:00:00')) / 86400000);
    if (days < 0) return;
    const w = Math.floor(days / 7);
    if (w >= weeks) return;
    const n = setsOf(e).length;
    out[w][g] += n;
    out[w].total += n;
  });
  return out;
}

// The honest read on this week's split.
function balanceVerdict(week) {
  const trained = MUSCLE_ORDER.filter(g => week[g] > 0);
  const skipped = MUSCLE_ORDER.filter(g => week[g] === 0);
  if (!week.total) return { tone: 'muted', text: 'No sets logged yet this week.' };
  if (skipped.length) {
    const names = skipped.map(g => MUSCLE_LABEL[g].toLowerCase());
    const list = names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    return { tone: 'warn', text: `No ${list} work this week — ${trained.map(g => MUSCLE_LABEL[g].toLowerCase()).join(' and ')} carried it.` };
  }
  const vals = MUSCLE_ORDER.map(g => week[g]);
  const hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
  const ratio = lo > 0 ? hi / lo : 0;
  if (ratio >= 2.5) {
    const hiG = MUSCLE_ORDER[vals.indexOf(hi)], loG = MUSCLE_ORDER[vals.indexOf(lo)];
    return { tone: 'warn', text: `${MUSCLE_LABEL[hiG]} is ${Math.round(ratio * 10) / 10}× your ${MUSCLE_LABEL[loG].toLowerCase()} volume this week.` };
  }
  return { tone: 'good', text: 'All four groups trained this week — nicely balanced.' };
}

function renderMuscleBalance() {
  if (typeof muscleGroupFor !== 'function') return '';
  const weeks = muscleWeeks(BALANCE_WEEKS);
  const wk = weeks[0];
  const anyData = weeks.some(w => w.total > 0);
  if (!anyData) return '';

  const scale = Math.max.apply(null, MUSCLE_ORDER.map(g => wk[g]).concat([1]));
  const rows = MUSCLE_ORDER.map(g => {
    const sets = wk[g];
    const pct = Math.round((sets / scale) * 100);
    // 4-week trend for this group, so a zero week reads in context.
    const hist = weeks.map(w => w[g]).reverse();
    const hmax = Math.max.apply(null, hist.concat([1]));
    const spark = hist.map(v => `<span class="mb-tick" style="height:${Math.max(8, Math.round((v / hmax) * 100))}%;background:${v ? MUSCLE_COLOR[g] : 'var(--bg-hover)'}"></span>`).join('');
    return `
      <div class="mb-row">
        <div class="mb-head">
          <span class="mb-name">${MUSCLE_LABEL[g]}</span>
          <span class="mb-sets tnum">${sets === 0 ? '<span class="mb-zero">none</span>' : `<b>${sets}</b> set${sets === 1 ? '' : 's'}`}</span>
        </div>
        <div class="mb-barwrap">
          <div class="mb-track"><div class="mb-fill" style="width:${pct}%;background:${MUSCLE_COLOR[g]}"></div></div>
          <div class="mb-spark" title="last ${BALANCE_WEEKS} weeks">${spark}</div>
        </div>
      </div>`;
  }).join('');

  const v = balanceVerdict(wk);
  return `
    <div class="card str-card">
      <div class="coach-head">
        <h2>Muscle balance</h2>
        <span class="weight-goal-chip${v.tone === 'warn' ? ' str-chip-warn' : ''}">${wk.total} set${wk.total === 1 ? '' : 's'} this week</span>
      </div>
      ${rows}
      <div class="mb-verdict ${v.tone}">${esc(v.text)}</div>
    </div>`;
}

// ---------- Rendering ----------

function renderStrength() {
  const host = document.getElementById('strengthAnalytics');
  if (!host) return;
  const movements = strengthMovements();
  if (!movements.length) { host.innerHTML = ''; return; }

  // Default the curve to the most-trained movement that has enough history.
  if (!strengthCurveKey || !movements.some(m => m.key === strengthCurveKey && m.canCurve)) {
    const first = movements.find(m => m.canCurve);
    strengthCurveKey = first ? first.key : null;
  }

  host.innerHTML =
    renderStrengthSummary(movements) +
    renderMuscleBalance() +
    renderMovementList(movements) +
    renderStrengthCurve(movements) +
    renderStrengthPRs(movements);

  bindStrengthEvents(movements);
}

function renderStrengthSummary(movements) {
  const s = strengthLast30();
  const insight = strengthInsight(movements);
  return `
    <div class="card str-card">
      <div class="coach-head">
        <h2>Last 30 days</h2>
        <span class="weight-goal-chip">${s.sessions} session${s.sessions === 1 ? '' : 's'}</span>
      </div>
      <div class="str-tiles">
        <div class="str-tile"><div class="str-tile-v tnum">${s.sessions}</div><div class="str-tile-l">Sessions</div></div>
        <div class="str-tile"><div class="str-tile-v tnum">${s.reps}</div><div class="str-tile-l">Total reps</div></div>
        <div class="str-tile"><div class="str-tile-v tnum">${s.movements}</div><div class="str-tile-l">Movements</div></div>
      </div>
      ${insight ? `
        <div class="str-insight">
          <span class="str-insight-icon">⚡</span>
          <div class="str-insight-body">
            <div class="str-insight-title">${esc(insight.title)}</div>
            <div class="str-insight-text">${esc(insight.body)}</div>
            <button type="button" class="str-insight-cta" id="strInsightCta">${esc(insight.ctaLabel)}</button>
          </div>
        </div>` : ''}
    </div>`;
}

function renderMovementList(movements) {
  const stalledCount = movements.filter(m => m.stalled).length;
  // Tracked movements lead. Movements still gathering history are capped at a
  // couple of rows and then summarised — eight identical "needs more sessions"
  // rows is noise, not information.
  const tracked = movements.filter(m => m.canCurve);
  const growing = movements.filter(m => !m.canCurve);
  const shown = tracked.concat(growing.slice(0, 2));
  const hiddenCount = growing.length - Math.min(growing.length, 2);
  const rows = shown.map(m => {
    const unit = m.bodyweight ? 'reps' : 'lbs';
    const headline = m.bodyweight
      ? `${m.typical}<small> reps</small>`
      : `${m.sessions[m.sessions.length - 1].topWeight}<small> lbs × ${m.sessions[m.sessions.length - 1].bestReps}</small>`;
    if (!m.canCurve) {
      const pct = Math.round((m.sessionCount / MIN_CURVE_SESSIONS) * 100);
      return `
        <div class="str-mv is-locked" data-mv="${esc(m.key)}">
          <div class="str-mv-top"><span class="str-mv-name">${esc(m.name)}</span><span class="str-mv-best tnum">${headline}</span></div>
          <div class="str-mv-lock"><div class="str-mv-lockfill" style="width:${pct}%"></div></div>
          <div class="str-mv-foot">
            <span class="str-tag lock">${m.sessionCount} / ${MIN_CURVE_SESSIONS}</span>
            <span class="str-mv-sub">${MIN_CURVE_SESSIONS - m.sessionCount} more session${MIN_CURVE_SESSIONS - m.sessionCount === 1 ? '' : 's'} unlocks your curve</span>
          </div>
        </div>`;
    }
    const tag = m.stalled ? '<span class="str-tag flat">STALLED</span>'
      : m.improving ? '<span class="str-tag up">IMPROVING</span>' : '';
    return `
      <div class="str-mv" data-mv="${esc(m.key)}">
        <div class="str-mv-top"><span class="str-mv-name">${esc(m.name)}</span><span class="str-mv-best tnum">${headline}</span></div>
        ${sparklineSvg(m)}
        <div class="str-mv-foot">
          ${tag}
          <span class="str-mv-sub">${m.sessionCount} sessions · best ${m.prVal}${m.bodyweight ? '' : ' lb'} on ${formatDate(m.prDate)}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card str-card">
      <div class="coach-head">
        <h2>Your movements</h2>
        ${stalledCount ? `<span class="weight-goal-chip str-chip-warn">${stalledCount} stalled</span>` : ''}
      </div>
      ${rows}
      ${hiddenCount > 0 ? `<div class="str-mv-more">+${hiddenCount} more movement${hiddenCount === 1 ? '' : 's'} building history</div>` : ''}
    </div>`;
}

// Small inline sparkline of the last 14 sessions' best set.
function sparklineSvg(m) {
  const ss = m.sessions.slice(-14);
  const vals = ss.map(s => s.best);
  const max = Math.max.apply(null, vals);
  const min = Math.min.apply(null, vals);
  const W = 300, H = 30, P = 5;
  // Pad the scale so a FLAT series (a plateau — very common here) sits in the
  // middle of the band instead of collapsing onto the bottom edge, where it
  // reads as a clipped/broken chart rather than "steady".
  const spread = max - min;
  const lo = spread ? min - spread * 0.6 : min - 1;
  const hi = spread ? max + spread * 0.2 : min + 1;
  const range = (hi - lo) || 1;
  const step = vals.length > 1 ? (W - P * 2) / (vals.length - 1) : 0;
  const yOf = v => H - P - ((v - lo) / range) * (H - P * 2);
  const pts = vals.map((v, i) => `${Math.round((P + i * step) * 10) / 10},${Math.round(yOf(v) * 10) / 10}`).join(' ');
  const color = m.stalled ? 'var(--yellow)' : 'var(--accent)';
  const prI = vals.lastIndexOf(max);
  const prX = P + prI * step, prY = yOf(max);
  return `
    <svg class="str-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polyline class="str-spark-line" fill="none" stroke="${color}" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round" pathLength="100" points="${pts}"/>
      ${spread > 0 ? `<circle cx="${Math.round(prX)}" cy="${Math.round(prY)}" r="3" fill="var(--accent-hover)"/>` : ''}
    </svg>`;
}

function renderStrengthCurve(movements) {
  const m = movements.find(x => x.key === strengthCurveKey);
  if (!m) return '';
  const ss = m.sessions.slice(-16);
  const useTotal = strengthCurveMode === 'total';
  const vals = ss.map(s => useTotal ? s.totalReps : s.best);
  const unitLabel = m.bodyweight ? 'reps' : (useTotal ? 'reps' : 'est. 1RM');

  const W = 640, H = 150, PX = 34, PY = 22;
  const maxV = Math.max.apply(null, vals);
  const minV = Math.min.apply(null, vals);
  // Next target sits just above what you already do — the line to chase.
  const target = useTotal ? 0 : (m.bodyweight ? m.typical + 2 : m.typical + 5);
  const hi = Math.max(maxV, target) * 1.08;
  const lo = Math.max(0, minV - (hi - minV) * 0.25);
  const range = (hi - lo) || 1;
  const x = i => PX + (vals.length > 1 ? (i / (vals.length - 1)) * (W - PX * 2) : (W - PX * 2) / 2);
  const y = v => PY + (1 - (v - lo) / range) * (H - PY * 2);

  const pts = vals.map((v, i) => `${Math.round(x(i) * 10) / 10},${Math.round(y(v) * 10) / 10}`).join(' ');
  const area = `${pts} ${Math.round(x(vals.length - 1))},${H - PY} ${PX},${H - PY}`;
  const prI = vals.lastIndexOf(maxV);
  const targetY = target ? y(target) : 0;

  const chips = m.bodyweight || true ? `
    <div class="str-curve-chips">
      <button type="button" class="str-curve-chip ${useTotal ? '' : 'active'}" data-mode="best">Best set</button>
      <button type="button" class="str-curve-chip ${useTotal ? 'active' : ''}" data-mode="total">Total reps</button>
    </div>` : '';

  const statusChip = m.stalled
    ? `<span class="weight-goal-chip str-chip-warn">no gain · ${Math.max(1, Math.round(m.spanDays / 30))} mo</span>`
    : `<span class="weight-goal-chip">${m.gainPct >= 0 ? '+' : ''}${m.gainPct}% all-time</span>`;

  return `
    <div class="card str-card">
      <div class="coach-head"><h2>${esc(m.name)}</h2>${statusChip}</div>
      ${chips}
      <svg class="str-curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs><linearGradient id="strFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(109,106,248,0.26)"/><stop offset="1" stop-color="rgba(109,106,248,0)"/>
        </linearGradient></defs>
        ${target ? `<line x1="${PX}" y1="${targetY}" x2="${W - PX}" y2="${targetY}" stroke="var(--purple)"
          stroke-width="1.5" stroke-dasharray="5 5" opacity="0.65"/>
          <text x="${W - PX}" y="${targetY - 6}" text-anchor="end" font-size="10" fill="var(--purple)">next target ${target}</text>` : ''}
        <polygon fill="url(#strFill)" points="${area}"/>
        <polyline class="str-spark-line" fill="none" stroke="var(--accent)" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" pathLength="100" points="${pts}"/>
        <circle cx="${Math.round(x(prI))}" cy="${Math.round(y(maxV))}" r="5" fill="var(--green)" stroke="var(--bg-card)" stroke-width="2"/>
      </svg>
      <div class="str-curve-axis">
        <span>${formatDate(ss[0].date)}</span>
        <span>${formatDate(ss[ss.length - 1].date)}</span>
      </div>
      <div class="str-curve-foot">
        <div><div class="str-cs-v tnum">${m.typical}</div><div class="str-cs-l">typical</div></div>
        <div><div class="str-cs-v tnum" style="color:var(--green)">${m.prVal}</div><div class="str-cs-l">your PR</div></div>
        <div><div class="str-cs-v tnum" style="color:${m.stalled ? 'var(--yellow)' : 'var(--green)'}">${m.gainPct >= 0 ? '+' : ''}${m.gainPct}%</div><div class="str-cs-l">all-time</div></div>
        <div><div class="str-cs-v tnum">${m.sessionCount}</div><div class="str-cs-l">sessions</div></div>
      </div>
      <div class="str-curve-note">${esc(unitLabel)} per session${m.bodyweight ? '' : ' · Epley estimate'}</div>
    </div>`;
}

function renderStrengthPRs(movements) {
  const today = getTodayStr();
  // A record needs something to be a record AGAINST — a movement logged once
  // has no PR, just an entry. Two sessions minimum keeps this shelf meaningful.
  const prs = movements.filter(m => m.prVal > 0 && m.prDate && m.sessionCount >= 2)
    .sort((a, b) => b.prDate.localeCompare(a.prDate))
    .slice(0, 8);
  if (!prs.length) return '';
  const cards = prs.map(m => {
    const ageDays = Math.round((new Date(today) - new Date(m.prDate)) / 86400000);
    const fresh = ageDays <= PR_FRESH_DAYS;
    const sess = m.sessions[m.sessions.map(s => s.best).lastIndexOf(m.prVal)] || m.sessions[m.sessions.length - 1];
    const val = m.bodyweight
      ? `${m.prVal}<small> reps</small>`
      : `${sess.topWeight}<small> × ${sess.bestReps}</small>`;
    return `
      <div class="str-pr ${fresh ? 'is-new' : ''}">
        ${fresh ? '<span class="str-pr-badge">PR</span>' : ''}
        <div class="str-pr-ex">${esc(m.name)}</div>
        <div class="str-pr-val tnum">${val}</div>
        <div class="str-pr-meta">${formatDate(m.prDate)}${m.bodyweight ? '' : ` · 1RM ${m.prVal}`}</div>
      </div>`;
  }).join('');
  return `
    <div class="card str-card">
      <div class="coach-head"><h2>Personal records</h2><span class="weight-goal-chip">${prs.length}</span></div>
      <div class="str-pr-shelf">${cards}</div>
    </div>`;
}

function bindStrengthEvents(movements) {
  // Tap a movement row to point the curve at it.
  document.querySelectorAll('#strengthAnalytics .str-mv:not(.is-locked)').forEach(el => {
    el.addEventListener('click', () => {
      strengthCurveKey = el.dataset.mv;
      renderStrength();
      const curve = document.querySelector('#strengthAnalytics .str-curve');
      if (curve) curve.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.querySelectorAll('#strengthAnalytics .str-curve-chip').forEach(btn => {
    btn.addEventListener('click', () => { strengthCurveMode = btn.dataset.mode; renderStrength(); });
  });

  // "Try 3 × N today" — prefills the add-exercise form so the nudge is one tap
  // from being logged, instead of just being advice.
  const cta = document.getElementById('strInsightCta');
  if (cta) cta.addEventListener('click', () => {
    const insight = strengthInsight(movements);
    if (!insight) return;
    const nameInput = document.getElementById('gymExerciseName');
    if (nameInput) nameInput.value = insight.name;
    if (typeof gymSets !== 'undefined') {
      gymSets = [0, 1, 2].map(() => ({
        reps: String(insight.targetReps),
        weight: insight.targetWeight ? String(insight.targetWeight) : '',
      }));
    }
    if (typeof renderGym === 'function') renderGym();
    if (nameInput) nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof showToast === 'function') showToast(`Loaded 3 × ${insight.targetReps} ${insight.name} — hit Add Exercise`);
  });
}
