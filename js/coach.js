// ========== AI Fitness Coach ==========
// One decision surface that answers the questions a trainer actually answers:
// do I train today, what do I do, should volume go up, do I need a deload, and
// what should I fix in recovery.
//
// This app already computes eight separate advice signals (readiness from
// sleep+load, muscle balance, plateau detection, progression ladders, burn
// targets, nutrition recs). The coach does NOT add a ninth opinion — it reads
// those signals and commits to a call, which is the part that was missing.
//
// Deliberately rule-based rather than an LLM call: it runs offline, costs
// nothing, needs no API key, is identical every time, and every verdict can be
// traced to the numbers shown beside it. It "adapts over time" by recomputing
// from the full history on every render, so the advice moves as the log does.

const COACH_HARD_DAYS = 5;      // sessions in 7 days that counts as a heavy week
const COACH_STALE_DAYS = 4;     // days off after which getting back in matters more than freshness

// Everything the coach reasons about, gathered once.
function coachSnapshot() {
  const today = getTodayStr();
  const gym = state.gym || [];
  const cardio = state.cardio || [];

  // Only real sessions inform the coach. Counting two-set check-ins here made
  // it call a light week "5 sessions in 7 days" and prescribe a deload. A real
  // session is the same bar the Consistency card uses — 3+ distinct exercises
  // or any cardio (isConsistencyDay) — so the coach and the calendar never
  // disagree about whether a day counted.
  const allDates = new Set(
    gym.map(e => e && e.date).concat(cardio.map(c => c && c.date)).filter(Boolean)
  );
  const isSession = (typeof isConsistencyDay === 'function') ? isConsistencyDay
    : (typeof isFullSession === 'function') ? isFullSession : () => true;
  const sessionDates = new Set(Array.from(allDates).filter(isSession));
  // "Done for today" must mean a real session — not a push-ups-and-sit-ups
  // check-in, which the calendar shows faded. checkedInToday keeps the lighter
  // fact so the headline can nudge rather than either ignore it or over-credit it.
  const trainedToday = sessionDates.has(today);
  const checkedInToday = allDates.has(today) && !trainedToday;

  // Most recent training day, and how long ago that was.
  const sorted = Array.from(sessionDates).sort();
  const lastDate = sorted.length ? sorted[sorted.length - 1] : null;
  const daysSinceLast = lastDate
    ? Math.round((new Date(today + 'T00:00:00') - new Date(lastDate + 'T00:00:00')) / 86400000)
    : null;

  const inLastNDays = (n) => {
    const cutoff = offsetDateStr(today, -(n - 1));
    return sorted.filter(d => d >= cutoff).length;
  };
  const last7 = inLastNDays(7);
  const prev7 = sorted.filter(d => d >= offsetDateStr(today, -13) && d < offsetDateStr(today, -6)).length;

  const readiness = (typeof readinessBreakdown === 'function') ? readinessBreakdown() : null;
  const movements = (typeof strengthMovements === 'function') ? strengthMovements() : [];
  const stalled = movements.filter(m => m.stalled);
  const week = (typeof muscleWeeks === 'function') ? muscleWeeks(2)[0] : null;

  return { today, trainedToday, checkedInToday, lastDate, daysSinceLast, last7, prev7, readiness, movements, stalled, week };
}

// Which muscle group has been neglected this week, and a concrete movement for
// it — preferring something already in the log over a generic suggestion.
function coachWorkoutPick(s) {
  if (!s.week || typeof MUSCLE_ORDER === 'undefined') return null;
  const counts = MUSCLE_ORDER.map(g => ({ group: g, sets: s.week[g] || 0 }));
  counts.sort((a, b) => a.sets - b.sets);
  const target = counts[0];
  const label = MUSCLE_LABEL[target.group];

  // Their own movement for that group, most-trained first.
  let move = null;
  if (typeof muscleGroupFor === 'function') {
    const own = s.movements.filter(m => muscleGroupFor(m.name) === target.group);
    if (own.length) move = own[0];
  }
  const fallback = (typeof GROUP_SUGGESTIONS !== 'undefined' && GROUP_SUGGESTIONS[target.group]) || null;

  let detail;
  if (move) {
    // If it's plateaued, name the target that breaks the plateau.
    const bump = move.bodyweight ? move.typical + 2 : move.typical + 5;
    detail = move.stalled
      ? `${move.name} — go for ${bump}${move.bodyweight ? ' reps' : ' lbs'}, you've sat at ${move.typical} for a while`
      : `${move.name} — ${move.typical}${move.bodyweight ? ' reps' : ' lbs'} is your usual, beat it by a rep`;
  } else {
    detail = fallback ? `Try ${fallback}` : 'Pick anything for this group';
  }

  return { group: target.group, label, sets: target.sets, detail, untrained: target.sets === 0 };
}

// Should volume go up, hold, or come down.
function coachVolumeCall(s) {
  const heavyWeek = s.last7 >= COACH_HARD_DAYS;
  const lowReadiness = s.readiness && s.readiness.score < 55;
  const manyStalls = s.stalled.length >= 2;

  // Deload: hard week AND the body is signalling — not on volume alone.
  if (heavyWeek && (lowReadiness || (manyStalls && s.readiness && s.readiness.loadHigh))) {
    return {
      call: 'deload',
      tone: 'bad',
      text: `Take a lighter week — ${s.last7} sessions in 7 days${lowReadiness ? ' and readiness is down' : ' and two lifts have stalled'}. Halve the sets, keep the movements.`,
    };
  }
  if (manyStalls) {
    return {
      call: 'progress',
      tone: 'warn',
      text: `${s.stalled.length} movements have plateaued. Add reps before adding sessions — same workout, one rep more.`,
    };
  }
  if (s.last7 <= 1 && s.prev7 >= 2) {
    return { call: 'rebuild', tone: 'warn', text: 'Volume dropped off this week. Get one easy session in rather than chasing the old numbers.' };
  }
  if (s.readiness && s.readiness.score >= 75 && s.last7 >= 2) {
    return { call: 'increase', tone: 'good', text: 'Recovered and consistent — add a set to your main movement this week.' };
  }
  return { call: 'hold', tone: 'good', text: 'Hold the current volume and keep the sessions regular.' };
}

// The headline decision.
function coachDecision(s) {
  const r = s.readiness;
  const score = r ? r.score : null;

  if (s.trainedToday) {
    return {
      verdict: 'Done for today', tone: 'good', icon: '✓',
      line: 'Session already logged. Eat, sleep, repeat.',
    };
  }
  if (score !== null && score < 45) {
    return {
      verdict: 'Rest today', tone: 'bad', icon: '◍',
      line: `Readiness is ${score}. ${r.shortSleep ? 'Sleep is the limiter — a hard session now costs more than it gives.' : 'Recent load is high. Let it settle.'}`,
    };
  }
  // Logged something, but under the session bar — acknowledge it without calling
  // the day done, which is exactly the confusion a light check-in used to cause.
  if (s.checkedInToday) {
    return {
      verdict: 'One more to count', tone: 'warn', icon: '◐',
      line: 'Today is a check-in so far — a couple more exercises makes it a real session.',
    };
  }
  if (score !== null && score < 60) {
    return {
      verdict: 'Train light', tone: 'warn', icon: '◐',
      line: `Readiness is ${score}. Move, but keep it easy — technique work or a walk, not a PR attempt.`,
    };
  }
  if (s.daysSinceLast !== null && s.daysSinceLast >= COACH_STALE_DAYS) {
    return {
      verdict: 'Train today', tone: 'warn', icon: '▲',
      line: `${s.daysSinceLast} days since your last session. Getting back in matters more than what you do.`,
    };
  }
  return {
    verdict: 'Train today', tone: 'good', icon: '▲',
    line: score !== null ? `Readiness is ${score}. Good day to push a little.` : 'Nothing is holding you back today.',
  };
}

// Recovery: name the single biggest lever rather than listing everything.
function coachRecovery(s) {
  const r = s.readiness;
  if (r && typeof readinessAdvice === 'function') {
    const a = readinessAdvice(r);
    if (a) return a;
  }
  if (!r) return 'Log a few nights of sleep and this turns into a real recovery read.';
  return 'Recovery looks fine — keep sleep consistent.';
}

function renderCoach() {
  const host = document.getElementById('coachPanel');
  if (!host) return;
  if (!(state.gym || []).length) { host.innerHTML = ''; return; }

  const s = coachSnapshot();
  const d = coachDecision(s);
  const vol = coachVolumeCall(s);
  const pick = coachWorkoutPick(s);
  const rec = coachRecovery(s);

  // Evidence chips — every verdict shows the numbers behind it.
  const chips = [];
  if (s.readiness) chips.push(`Readiness ${s.readiness.score}`);
  if (s.daysSinceLast !== null) chips.push(s.daysSinceLast === 0 ? 'Trained today' : `${s.daysSinceLast}d since last`);
  chips.push(`${s.last7} sessions / 7d`);
  if (s.stalled.length) chips.push(`${s.stalled.length} stalled`);

  host.innerHTML = `
    <div class="card coach-panel coach-${d.tone}">
      <div class="coach-verdict">
        <span class="coach-icon">${d.icon}</span>
        <div class="coach-verdict-body">
          <div class="coach-verdict-title">${esc(d.verdict)}</div>
          <div class="coach-verdict-line">${esc(d.line)}</div>
        </div>
      </div>

      <div class="coach-chips">${chips.map(c => `<span class="coach-chip">${esc(c)}</span>`).join('')}</div>

      ${pick && !s.trainedToday ? `
        <div class="coach-row">
          <span class="coach-row-label">Do this</span>
          <div class="coach-row-body">
            <strong>${esc(pick.label)}</strong>${pick.untrained ? ' <em>— untouched this week</em>' : ` <em>— only ${pick.sets} sets this week</em>`}
            <div class="coach-row-detail">${esc(pick.detail)}</div>
          </div>
        </div>` : ''}

      <div class="coach-row">
        <span class="coach-row-label">Volume</span>
        <div class="coach-row-body coach-${vol.tone}-text">${esc(vol.text)}</div>
      </div>

      <div class="coach-row">
        <span class="coach-row-label">Recovery</span>
        <div class="coach-row-body">${esc(rec)}</div>
      </div>
    </div>`;
}
