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
function strengthLast30(movements) {
  const cutoff = offsetDateStr(getTodayStr(), -30);
  const recent = (state.gym || []).filter(e => e && e.date && e.date >= cutoff);
  // A session is a full session, not a day with the two habit sets on it.
  const days = Array.from(new Set(recent.map(e => e.date)));
  const sessions = days.filter(d => (typeof isFullSession === 'function') ? isFullSession(d) : true).length;
  let sets = 0, volume = 0;
  recent.forEach(e => {
    const bw = e.bodyweight || (typeof isBodyweightExercise === 'function' && isBodyweightExercise(e.exercise));
    setsOf(e).forEach(st => {
      sets++;
      if (!bw) volume += (Number(st.reps) || 0) * (Number(st.weight) || 0);
    });
  });
  const prs = (movements || []).filter(m => m.sessionCount >= 2 && m.prDate && m.prDate >= cutoff).length;
  return { sessions, sets, volume, prs };
}

// 48,120 -> "48k". Under ten thousand the exact figure still fits the tile.
function compactNumber(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  return Math.round(n).toLocaleString();
}

// "3 weeks" under two months, "4 months" after: "1 months" was the old output.
function stallSpan(days) {
  if (days < 60) { const w = Math.max(1, Math.round(days / 7)); return w + (w === 1 ? ' week' : ' weeks'); }
  const mo = Math.round(days / 30); return mo + ' months';
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
    title: `Your ${m.name.toLowerCase()} ${m.bodyweight ? 'have' : 'has'} been ${m.typical} ${unit} for ${stallSpan(m.spanDays)}`,
    body: `${m.typical} ${unit} in ${m.typicalCount} of ${m.sessionCount} sessions. Your body adapted a long time ago — the fastest win here is adding ${m.bodyweight ? 'reps' : 'weight'}, not more sessions.`,
    ctaLabel: m.bodyweight ? `Try 3 x ${target} today` : `Try 3 x ${m.typical} at ${m.sessions[m.sessions.length - 1].topWeight + 5}`,
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
  if (!weeks.some(w => w.total > 0)) return '';

  const scale = Math.max.apply(null, MUSCLE_ORDER.map(g => wk[g]).concat([1]));
  const rows = MUSCLE_ORDER.map(g => {
    const sets = wk[g];
    const pct = Math.round((sets / scale) * 100);
    // Four weeks of this group beside the bar, so a zero week reads in context.
    const hist = weeks.map(w => w[g]).reverse();
    const hmax = Math.max.apply(null, hist.concat([1]));
    const ticks = hist.map(v => `<i class="${v ? '' : 'empty'}" style="--h:${Math.max(12, Math.round((v / hmax) * 100))}%"></i>`).join('');
    return `
      <div class="sp-bal">
        <span class="sp-bal-name">${MUSCLE_LABEL[g]}</span>
        <span class="dl-meter c-move"><i style="width:${pct}%"></i></span>
        <span class="dl-bars c-move sp-bal-ticks" title="last ${BALANCE_WEEKS} weeks">${ticks}</span>
        <span class="sp-bal-n">${sets || 'none'}</span>
      </div>`;
  }).join('');

  const v = balanceVerdict(wk);
  return `
    <div class="dl-card sp-card">
      <h6 class="dl-card-h"><span>Muscle balance</span><em>${wk.total} set${wk.total === 1 ? '' : 's'} this week</em></h6>
      ${rows}
      <p class="sp-note${v.tone === 'warn' ? ' is-warn' : ''}">${esc(v.text)}</p>
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
  const s = strengthLast30(movements);
  const insight = strengthInsight(movements);
  const tiles = [[s.sessions, 'sessions'], [s.sets, 'sets'], [compactNumber(s.volume), 'lb moved'], [s.prs, s.prs === 1 ? 'PR' : 'PRs']];
  return `
    <div class="dl-tiles sp-tiles">
      ${tiles.map(t => `<div class="dl-tile"><b>${t[0]}</b><span>${t[1]}</span></div>`).join('')}
    </div>
    <p class="sp-window">Last 30 days</p>
    ${insight ? `
      <div class="dl-card tint c-food sp-card">
        <h6 class="dl-card-h"><span>${esc(insight.title)}</span></h6>
        <p class="sp-note">${esc(insight.body)}</p>
        <button type="button" class="dl-btn primary" id="strInsightCta">${esc(insight.ctaLabel)}</button>
      </div>` : ''}`;
}

function renderMovementList(movements) {
  // Tracked movements lead. Movements still gathering history are capped at a
  // couple of rows and then summarised — eight identical "needs more sessions"
  // rows is noise, not information.
  const tracked = movements.filter(m => m.canCurve);
  const growing = movements.filter(m => !m.canCurve);
  const shown = tracked.concat(growing.slice(0, 2));
  const hiddenCount = growing.length - Math.min(growing.length, 2);
  const rows = shown.map(m => {
    const last = m.sessions[m.sessions.length - 1];
    const now = m.bodyweight ? `${m.typical} reps` : `${last.topWeight} lb x ${last.bestReps}`;
    if (!m.canCurve) {
      const left = MIN_CURVE_SESSIONS - m.sessionCount;
      return `
        <div class="sp-mv is-locked">
          <span class="sp-mv-main"><span class="sp-mv-name">${esc(m.name)}</span>
            <span class="sp-mv-sub">${now} · ${left} more session${left === 1 ? '' : 's'} for a curve</span></span>
          <span class="dl-chip">${m.sessionCount} / ${MIN_CURVE_SESSIONS}</span>
        </div>`;
    }
    const chip = m.stalled ? '<span class="dl-chip c-food">stalled</span>'
      : m.improving ? '<span class="dl-chip c-move">improving</span>' : '<span class="dl-chip">steady</span>';
    return `
      <button type="button" class="sp-mv${m.key === strengthCurveKey ? ' on' : ''}" data-mv="${esc(m.key)}" aria-pressed="${m.key === strengthCurveKey}">
        <span class="sp-mv-main"><span class="sp-mv-name">${esc(m.name)}</span>
          <span class="sp-mv-sub">${now} · ${m.sessionCount} sessions</span></span>
        ${sparklineSvg(m)}
        ${chip}
      </button>`;
  }).join('');

  return `
    <div class="dl-card sp-card">
      <h6 class="dl-card-h"><span>Movements</span><em>tap one to chart it</em></h6>
      ${rows}
      ${hiddenCount > 0 ? `<p class="sp-note">+${hiddenCount} more movement${hiddenCount === 1 ? '' : 's'} building history.</p>` : ''}
    </div>`;
}

// Small inline sparkline of the last 14 sessions' best set.
function sparklineSvg(m) {
  const ss = m.sessions.slice(-14);
  const vals = ss.map(x => x.best);
  const max = Math.max.apply(null, vals);
  const min = Math.min.apply(null, vals);
  const W = 120, H = 26, P = 3;
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
  const color = m.stalled ? 'var(--c-food)' : m.improving ? 'var(--c-move)' : 'var(--text-muted)';
  return `
    <svg class="sp-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>
    </svg>`;
}

// The curve has two readings. For a weighted lift: estimated 1RM, or the top
// set's weight (spec 7). For a bodyweight move neither exists, so it is best
// set against total reps. Stored as 'best' or anything else.
function renderStrengthCurve(movements) {
  const m = movements.find(x => x.key === strengthCurveKey);
  if (!m) return '';
  const ss = m.sessions.slice(-16);
  const alt = strengthCurveMode !== 'best';
  const vals = ss.map(x => !alt ? x.best : (m.bodyweight ? x.totalReps : x.topWeight));
  const labels = m.bodyweight ? ['Best set', 'Total reps'] : ['Est. 1RM', 'Top set'];
  const unit = m.bodyweight ? 'reps' : 'lb';

  const W = 640, H = 150, PX = 8, PY = 20;
  const maxV = Math.max.apply(null, vals);
  const minV = Math.min.apply(null, vals);
  // Next target sits just above what you already do — the line to chase.
  const target = alt ? 0 : (m.bodyweight ? m.typical + 2 : m.typical + 5);
  const hi = Math.max(maxV, target) * 1.08;
  const lo = Math.max(0, minV - (hi - minV) * 0.25);
  const range = (hi - lo) || 1;
  const x = i => PX + (vals.length > 1 ? (i / (vals.length - 1)) * (W - PX * 2) : (W - PX * 2) / 2);
  const y = v => PY + (1 - (v - lo) / range) * (H - PY * 2);

  const pts = vals.map((v, i) => `${Math.round(x(i) * 10) / 10},${Math.round(y(v) * 10) / 10}`).join(' ');
  const area = `${pts} ${Math.round(x(vals.length - 1))},${H - PY} ${PX},${H - PY}`;
  const prI = vals.lastIndexOf(maxV);
  const targetY = target ? y(target) : 0;
  const gain = `${m.gainPct >= 0 ? '+' : ''}${m.gainPct}%`;

  return `
    <div class="dl-card sp-card" id="strCurveCard">
      <h6 class="dl-card-h"><span>${esc(m.name)}</span>
        <span class="dl-seg sp-seg" role="group" aria-label="Chart reading">
          <button type="button" data-mode="best"${alt ? '' : ' aria-pressed="true"'}>${labels[0]}</button>
          <button type="button" data-mode="alt"${alt ? ' aria-pressed="true"' : ''}>${labels[1]}</button>
        </span></h6>
      <svg class="sp-curve c-move" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
           aria-label="${esc(m.name)}: ${esc(labels[alt ? 1 : 0])} over ${ss.length} sessions, from ${vals[0]} to ${vals[vals.length - 1]} ${unit}">
        ${target ? `<line x1="${PX}" y1="${targetY}" x2="${W - PX}" y2="${targetY}" class="sp-curve-target"/>` : ''}
        <polygon class="sp-curve-area" points="${area}"/>
        <polyline class="sp-curve-line" fill="none" points="${pts}"/>
        <circle cx="${Math.round(x(prI))}" cy="${Math.round(y(maxV))}" r="5" class="sp-curve-pr"/>
      </svg>
      <div class="sp-curve-axis"><span>${formatDate(ss[0].date)}</span>${target ? `<span>next target ${target} ${unit}</span>` : ''}<span>${formatDate(ss[ss.length - 1].date)}</span></div>
      <div class="dl-tiles sp-curve-tiles">
        <div class="dl-tile"><b>${m.typical}</b><span>typical</span></div>
        <div class="dl-tile"><b>${m.prVal}</b><span>best, ${formatDate(m.prDate)}</span></div>
        <div class="dl-tile"><b>${gain}</b><span>${m.stalled ? `flat for ${stallSpan(m.spanDays)}` : 'all-time'}</span></div>
        <div class="dl-tile"><b>${m.sessionCount}</b><span>sessions</span></div>
      </div>
      <p class="sp-note">${labels[alt ? 1 : 0]} per session${m.bodyweight || alt ? '' : ', Epley estimate'}.</p>
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
  const chips = prs.map(m => {
    const ageDays = Math.round((new Date(today) - new Date(m.prDate)) / 86400000);
    const fresh = ageDays <= PR_FRESH_DAYS;
    const sess = m.sessions[m.sessions.map(x => x.best).lastIndexOf(m.prVal)] || m.sessions[m.sessions.length - 1];
    const val = m.bodyweight ? `${m.prVal}` : `${sess.topWeight} x ${sess.bestReps}`;
    return `<span class="dl-chip c-food sp-pr${fresh ? ' is-new' : ''}" title="${esc(formatDate(m.prDate))}${m.bodyweight ? '' : ` · est. 1RM ${m.prVal}`}">
      <span class="ms" aria-hidden="true">trophy</span>${esc(m.name)} ${val}${fresh ? '<b>new</b>' : ''}</span>`;
  }).join('');
  return `
    <div class="dl-card sp-card">
      <h6 class="dl-card-h"><span>Personal records</span><em>${prs.length}</em></h6>
      <div class="sp-prs">${chips}</div>
    </div>`;
}

function bindStrengthEvents(movements) {
  // Tap a movement row to point the curve at it.
  document.querySelectorAll('#strengthAnalytics .sp-mv[data-mv]').forEach(el => {
    el.addEventListener('click', () => {
      strengthCurveKey = el.dataset.mv;
      renderStrength();
      const curve = document.getElementById('strCurveCard');
      if (curve) curve.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.querySelectorAll('#strengthAnalytics .sp-seg [data-mode]').forEach(btn => {
    btn.addEventListener('click', () => { strengthCurveMode = btn.dataset.mode; renderStrength(); });
  });

  // "Try 3 x N today" opens the log sheet already filled in, so the nudge is
  // one tap from being logged instead of being advice.
  const cta = document.getElementById('strInsightCta');
  if (cta) cta.addEventListener('click', () => {
    const insight = strengthInsight(movements);
    if (!insight || typeof openGymLogSheet !== 'function') return;
    openGymLogSheet(insight.name, [0, 1, 2].map(() => ({
      reps: String(insight.targetReps),
      weight: insight.targetWeight ? String(insight.targetWeight) : '',
    })));
  });
}
