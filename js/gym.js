// ========== Gym ==========
const BODYWEIGHT_EXERCISES = new Set([
  'Push Ups', 'Wide Push Ups', 'Diamond Push Ups', 'Decline Push Ups', 'Pike Push Ups',
  'Pull Up', 'Chin Up', 'Muscle Up', 'Dip', 'Ring Dip',
  'Sit Ups', 'Crunches', 'Leg Raises', 'Hanging Leg Raises', 'Bicycle Crunches',
  'Plank', 'Side Plank', 'Mountain Climbers', 'Burpees',
  'Pistol Squat', 'Bodyweight Squat', 'Jump Squat', 'Lunges', 'Bulgarian Split Squat',
  'Handstand Push Up', 'L-Sit', 'Dragon Flag', 'Back Lever', 'Front Lever',
  'Australian Rows', 'Inverted Rows', 'Jumping Jacks', 'Box Jumps',
  'Flutter Kicks', 'Russian Twists', 'Superman', 'Glute Bridge',
]);

const COMMON_EXERCISES = [
  ...BODYWEIGHT_EXERCISES,
  // Weights
  'Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row',
  'Lat Pulldown', 'Cable Row', 'Dumbbell Curl', 'Tricep Pushdown',
  'Leg Press', 'Calf Raise', 'Romanian Deadlift', 'Hip Thrust',
  'Lateral Raise', 'Face Pull',
];

let gymBodyweight = false; // current input mode
let gymEditingIdx = null; // index into day's exercises when editing

function isBodyweightExercise(name) {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  for (const bw of BODYWEIGHT_EXERCISES) {
    if (bw.toLowerCase() === lower) return true;
  }
  return false;
}

// 7-day rolling average of weigh-ins. Daily scale weight swings 1-3 lbs on
// water and food timing alone; on a 10 lb cut that noise buries the signal,
// so the trend value is the headline and the raw reading is secondary.
function weightTrendSeries() {
  const entries = Object.entries(state.weight || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const times = entries.map(([d]) => new Date(d + 'T00:00:00').getTime());
  return entries.map(([d], i) => {
    let sum = 0, n = 0;
    for (let j = i; j >= 0 && times[i] - times[j] < 7 * 86400000; j--) { sum += entries[j][1]; n++; }
    return [d, Math.round((sum / n) * 10) / 10];
  });
}

function renderWeight() {
  const currentEl = $('#weightCurrent');
  if (!currentEl) return;
  const WEIGHT_GOAL = (typeof getGoals === 'function' && getGoals().weight) || 150;
  const log = state.weight || {};
  const entries = Object.entries(log).sort((a, b) => a[0].localeCompare(b[0]));
  const input = $('#weightInput');
  const viewedVal = log[gymViewDate];
  input.placeholder = viewedVal ? `${viewedVal} lbs` : 'lbs';

  if (!entries.length) {
    currentEl.innerHTML = '<span class="weight-empty">Log your first weigh-in</span>';
    $('#weightSpark').innerHTML = '';
    $('#weightGoalChip').textContent = `Goal: ${WEIGHT_GOAL} lbs`;
    return;
  }

  const [latestDate, latestRaw] = entries[entries.length - 1];
  const trend = weightTrendSeries();
  const latest = trend[trend.length - 1][1];
  const prev = trend.length > 1 ? trend[trend.length - 2][1] : null;
  const delta = prev !== null ? Math.round((latest - prev) * 10) / 10 : null;
  // Direction-aware: moving toward the goal is good (green), away is red
  const losing = latest > WEIGHT_GOAL;
  const deltaGood = delta !== null && (losing ? delta <= 0 : delta >= 0);
  const toGo = Math.round(Math.abs(latest - WEIGHT_GOAL) * 10) / 10;

  currentEl.innerHTML = `
    <span class="weight-num">${latest}<small> lbs${trend.length > 1 ? ' trend' : ''}</small></span>
    ${delta !== null ? `<span class="weight-delta ${deltaGood ? 'good' : 'bad'}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} ${Math.abs(delta)}</span>` : ''}
    <span class="weight-date">${latestRaw !== latest ? `scale ${latestRaw} · ` : ''}${formatDate(latestDate)}</span>
  `;
  $('#weightGoalChip').textContent = toGo === 0
    ? `At goal: ${WEIGHT_GOAL} lbs`
    : `${toGo} lbs to ${losing ? 'lose' : 'gain'} → ${WEIGHT_GOAL}`;

  // Sparkline of the last 12 trend points (smoothed, not raw)
  const pts = trend.slice(-12).map(([, w]) => w);
  if (pts.length < 2) {
    $('#weightSpark').innerHTML = '';
    return;
  }
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const W = 140, H = 40, PAD = 4;
  const coords = pts.map((w, i) => {
    const x = PAD + (i / (pts.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((w - min) / range) * (H - PAD * 2);
    return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  });
  const last = coords[coords.length - 1].split(',');
  $('#weightSpark').innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline points="${coords.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" pathLength="100" class="weight-spark-line"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="var(--accent-hover)"/>
    </svg>`;
}

// ---- Targets & Coach ----
// Calorie burn is a MET estimate: cal = MET x bodyweight(kg) x hours.
// Each set is counted as ~2 min of session time (work + rest).
const SET_MINUTES = 2;
const MET_BODYWEIGHT = 5.0; // moderate-vigorous calisthenics
const MET_WEIGHTED = 6.0;   // vigorous weight training

// Keyword → muscle group, by the movement's prime mover:
//   push  chest, shoulders, triceps
//   pull  back, biceps, rear delts, traps
//   legs  quads, hamstrings, glutes, calves
//   core  abs and trunk
//
// The LONGEST matching keyword wins, regardless of which group it sits in.
// This used to take the first matching group in object order, which meant a
// short generic keyword in an earlier group beat a longer specific one later,
// and produced four wrong answers on real exercise names:
//
//   Leg Press       -> push   'press'    beat  'leg press'
//   Leg Curl        -> pull   'curl'     with no leg-curl keyword to lose to
//   Hamstring Curl  -> pull   same
//   Tricep Pulldown -> pull   'pulldown' beat  'tricep'
//
// Ordering by specificity fixes the whole class rather than the four names,
// and it makes bare keywords safe to add: 'fly' cannot swallow 'reverse fly',
// and 'raise' is still avoided only because 'calf raise', 'leg raise' and
// 'lateral raise' land in three different groups.
const MUSCLE_GROUPS = {
  push: ['push up', 'pushup', 'push-up', 'pushdown', 'dip', 'press', 'bench', 'handstand',
         'tricep', 'triceps', 'skull crusher', 'skullcrusher', 'jm press', 'tricep pulldown',
         'front raise', 'lateral raise', 'lat raise', 'shoulder', 'delt raise', 'arnold',
         'chest', 'pec deck', 'pec fly', 'fly', 'flye', 'overhead extension', 'crossover',
         'tricep extension', 'triceps extension', 'kickback'],
  pull: ['pull up', 'pullup', 'chin up', 'chinup', 'row', 'curl', 'pulldown', 'pullover',
         'muscle up', 'lever', 'face pull', 'bicep', 'biceps', 'reverse fly', 'reverse flye',
         'rear delt', 'reverse pec deck', 'shrug', 'lat prayer', 'straight arm'],
  legs: ['squat', 'lunge', 'deadlift', 'rdl', 'leg press', 'leg curl', 'leg extension',
         'hamstring', 'hamstring curl', 'quad', 'calf', 'glute', 'glute kickback', 'hip thrust',
         'box jump', 'step up', 'good morning', 'nordic', 'adductor', 'abductor',
         'adduction', 'abduction', 'sled'],
  core: ['sit up', 'situp', 'crunch', 'plank', 'leg raise', 'knee raise', 'twist', 'flutter',
         'l-sit', 'dragon flag', 'mountain climber', 'superman', 'ab wheel', 'ab roller',
         'hollow', 'dead bug', 'woodchop', 'pallof', 'oblique'],
};

// Flattened once at load: [keyword, group], longest keyword first.
const MUSCLE_KEYWORDS = Object.keys(MUSCLE_GROUPS)
  .reduce((out, g) => out.concat(MUSCLE_GROUPS[g].map(k => [k, g])), [])
  .sort((a, b) => b[0].length - a[0].length);

// Gym-first fallbacks — dumbbells, cables, machines and benches, not the old
// home-bodyweight defaults. Only used when you have no logged movement for a
// group yet; once you log your own, that ranks ahead of these.
const GROUP_SUGGESTIONS = {
  push: 'dumbbell bench press or cable fly',
  pull: 'lat pulldown or cable row',
  legs: 'leg press or Romanian deadlift',
  core: 'cable crunch or hanging leg raise',
};

function muscleGroupFor(exercise) {
  const name = (exercise || '').toLowerCase();
  if (!name) return null;
  // Most specific phrase wins — see the note on MUSCLE_GROUPS.
  for (let i = 0; i < MUSCLE_KEYWORDS.length; i++) {
    if (name.includes(MUSCLE_KEYWORDS[i][0])) return MUSCLE_KEYWORDS[i][1];
  }
  return null;
}

// MUSCLE_LABEL lives in strength.js; gym.js must not hard-depend on it loading.
function groupLabel(g) {
  if (typeof MUSCLE_LABEL !== 'undefined' && MUSCLE_LABEL[g]) return MUSCLE_LABEL[g];
  return g ? g.charAt(0).toUpperCase() + g.slice(1) : '';
}

// Names the day at a glance — "Push day" when one group carries most of the
// work, otherwise the groups that were actually hit. Weighted by sets rather
// than by exercise count, so four sets of squats outrank one set of crunches.
function sessionFocusRow(entries) {
  if (!entries || !entries.length) return '';
  const ORDER = (typeof MUSCLE_ORDER !== 'undefined') ? MUSCLE_ORDER : ['push', 'pull', 'legs', 'core'];
  const tally = { push: 0, pull: 0, legs: 0, core: 0 };
  let classified = 0, unknown = 0;
  entries.forEach(ex => {
    const g = muscleGroupFor(ex.exercise);
    const n = (ex.sets || []).length;
    if (g) { tally[g] += n; classified += n; } else { unknown += n; }
  });
  if (!classified) return '';

  const hit = ORDER.filter(g => tally[g] > 0).sort((a, b) => tally[b] - tally[a]);
  const top = hit[0];
  const label = tally[top] / classified >= 0.7 ? `${groupLabel(top)} day` : 'Mixed';

  return `
    <div class="gym-focus">
      <span class="gym-focus-lbl">${esc(label)}</span>
      <div class="gym-focus-chips">
        ${hit.map(g => `<span class="gym-focus-chip" data-group="${g}">${groupLabel(g)}<b>${tally[g]}</b></span>`).join('')}
        ${unknown ? `<span class="gym-focus-chip is-unknown" title="Not matched to a muscle group">Other<b>${unknown}</b></span>` : ''}
      </div>
    </div>`;
}

function latestBodyWeightLbs() {
  const entries = Object.entries(state.weight || {}).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.length ? entries[entries.length - 1][1] : 160;
}

function estimateBurnForDate(dateStr) {
  const kg = latestBodyWeightLbs() * 0.4536;
  const lifting = state.gym.filter(e => e.date === dateStr).reduce((cal, ex) => {
    const met = (ex.bodyweight || isBodyweightExercise(ex.exercise)) ? MET_BODYWEIGHT : MET_WEIGHTED;
    return cal + met * kg * (SET_MINUTES / 60) * ex.sets.length;
  }, 0);
  // Runs, rides and swims are real work — count them here so a training day
  // without lifting still shows a burn. Only reached when the watch has not
  // synced active energy, which would already include this.
  const cardio = (typeof cardioBurnForDate === 'function') ? cardioBurnForDate(dateStr) : 0;
  return Math.round(lifting + cardio);
}

// Prefer the Apple Watch's measured active calories when synced; fall back to
// the MET estimate from logged sets. The watch number is whole-day active
// energy (walking included), so callers must not add walk burn on top of it.
function burnForDate(dateStr) {
  const watch = (typeof getExternalActiveEnergy === 'function') ? getExternalActiveEnergy(dateStr) : null;
  if (watch !== null) return { cal: Math.round(watch), watch: true };
  return { cal: estimateBurnForDate(dateStr), watch: false };
}

// Pace over the trailing 3 weeks → lbs per week (negative = losing).
// Runs on the smoothed trend series so one salty dinner can't flip the verdict.
function weighInPace() {
  const entries = weightTrendSeries();
  if (entries.length < 2) return null;
  const [lastDate, lastW] = entries[entries.length - 1];
  const cutoff = new Date(lastDate + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - 21);
  const windowed = entries.filter(([d]) => new Date(d + 'T00:00:00') >= cutoff);
  if (windowed.length < 2) return null;
  const [firstDate, firstW] = windowed[0];
  const days = (new Date(lastDate + 'T00:00:00') - new Date(firstDate + 'T00:00:00')) / 86400000;
  if (days < 1) return null;
  return { perWeek: (lastW - firstW) / days * 7, lastDate, lastW };
}

function gymDatesBetween(startStr, endStr) {
  return state.gym.filter(e => e.date >= startStr && e.date <= endStr);
}

// ---- Progressive overload: last-time chip, PRs, progressions ----
// A set's score: reps for bodyweight work, reps x weight for loaded work.
function setScore(ex, s) {
  const bw = ex.bodyweight || isBodyweightExercise(ex.exercise);
  return bw ? Number(s.reps) || 0 : (Number(s.reps) || 0) * (Number(s.weight) || 0);
}

function bestSetScore(ex) {
  return ex.sets.reduce((m, s) => Math.max(m, setScore(ex, s)), 0);
}

// All sessions of an exercise strictly before a date, newest first
function exerciseHistory(name, beforeDate) {
  const lower = (name || '').toLowerCase().trim();
  if (!lower) return [];
  return state.gym
    .filter(e => (e.exercise || '').toLowerCase().trim() === lower && e.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Calisthenics progression chains, easiest → hardest. When the last two
// sessions of an exercise clear the rep threshold on every set, it has
// stopped being a growth stimulus — time to move up the chain.
// A day with one set of push ups and one set of sit ups is a check-in, not a
// session, and counting it as a full training day flatters the numbers. Four
// sets is the line: the real sessions in the log run 10-16 sets, the check-ins
// run 2, so anything at or above this is unambiguously a workout.
const SESSION_MIN_SETS = 4;

function setsOnDate(dateStr) {
  return (state.gym || []).reduce((n, e) => n + (e.date === dateStr ? (e.sets || []).length : 0), 0);
}

// Cardio counts as a full session on its own — a 30 minute ride is real work
// even though it logs no sets.
function isFullSession(dateStr) {
  if ((state.cardio || []).some(s => s.date === dateStr)) return true;
  return setsOnDate(dateStr) >= SESSION_MIN_SETS;
}

// Reps have not moved across the last few sessions of a staple movement. This
// is the failure mode the progression ladder below cannot see: the ladder waits
// for mastery (every set at the threshold) before suggesting the next
// variation, so an exercise parked at 10 reps forever never trips it.
const STALL_SESSIONS = 5;

function bodyweightStall() {
  const byName = {};
  (state.gym || []).forEach(e => {
    if (!e || !e.date || e.date > gymViewDate) return;
    if (!(e.bodyweight || isBodyweightExercise(e.exercise))) return;
    const key = (e.exercise || '').trim().toLowerCase();
    if (!key) return;
    (byName[key] = byName[key] || []).push(e);
  });

  let worst = null;
  Object.keys(byName).forEach(key => {
    const sessions = byName[key].sort((a, b) => a.date.localeCompare(b.date));
    if (sessions.length < STALL_SESSIONS) return;
    const bestOf = e => (e.sets || []).reduce((m, s) => Math.max(m, Number(s.reps) || 0), 0);
    const recent = sessions.slice(-STALL_SESSIONS);
    const peak = Math.max.apply(null, recent.map(bestOf));
    // Stalled if the best set in the whole span never beat the earliest one.
    if (peak > bestOf(recent[0])) return;
    if (!worst || sessions.length > worst.sessions) {
      worst = { name: sessions[0].exercise, sessions: sessions.length, reps: peak, since: sessions[0].date };
    }
  });
  return worst;
}

const PROGRESSION_CHAINS = [
  { chain: ['Wall Push Ups', 'Incline Push Ups', 'Knee Push Ups', 'Push Ups', 'Wide Push Ups', 'Decline Push Ups', 'Diamond Push Ups', 'Pike Push Ups', 'Handstand Push Up'], threshold: 20 },
  { chain: ['Crunches', 'Sit Ups', 'Bicycle Crunches', 'Leg Raises', 'Hanging Leg Raises', 'Dragon Flag'], threshold: 25 },
  { chain: ['Bodyweight Squat', 'Jump Squat', 'Lunges', 'Bulgarian Split Squat', 'Pistol Squat'], threshold: 20 },
  { chain: ['Australian Rows', 'Inverted Rows', 'Chin Up', 'Pull Up', 'Muscle Up'], threshold: 12 },
  { chain: ['Dip', 'Ring Dip'], threshold: 15 },
];

function progressionSuggestion() {
  for (const { chain, threshold } of PROGRESSION_CHAINS) {
    for (let i = chain.length - 2; i >= 0; i--) { // hardest mastered variation wins
      const name = chain[i].toLowerCase();
      const next = chain[i + 1];
      if (state.gym.some(e => (e.exercise || '').toLowerCase() === next.toLowerCase())) continue;
      const sessions = state.gym
        .filter(e => (e.exercise || '').toLowerCase() === name && e.date <= gymViewDate)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 2);
      if (sessions.length === 2 &&
          sessions.every(s => s.sets.length >= 3 && s.sets.every(set => Number(set.reps) >= threshold))) {
        return { from: chain[i], to: next, threshold };
      }
    }
  }
  return null;
}

// The "beat last time" chip under the exercise input — previous session,
// all-time PR, and a concrete target for today.
function renderLastTimeChip() {
  const el = $('#gymLastTime');
  if (!el) return;
  const name = $('#gymExerciseName').value.trim();
  if (!name) { el.innerHTML = ''; return; }
  const hist = exerciseHistory(name, gymViewDate);
  if (!hist.length) {
    el.innerHTML = `<div class="gym-lasttime">First time logging <strong>${esc(name)}</strong> — today sets the baseline.</div>`;
    return;
  }
  const last = hist[0];
  const bw = last.bodyweight || isBodyweightExercise(last.exercise);
  const setsStr = last.sets.map(s => bw ? s.reps : `${s.reps}&times;${s.weight}`).join(', ');
  const pr = hist.reduce((m, ex) => Math.max(m, bestSetScore(ex)), 0);
  const lastBestReps = last.sets.reduce((m, s) => Math.max(m, Number(s.reps) || 0), 0);
  const target = bw
    ? `get ${lastBestReps + 1} reps on your first set`
    : 'add a rep to each set, or +2.5 lbs';
  el.innerHTML = `<div class="gym-lasttime">
    <span class="gym-lasttime-label">Last time (${formatDate(last.date)}):</span>
    <span class="gym-lasttime-sets">${setsStr}</span>
    <span class="gym-lasttime-pr">PR: ${bw ? pr + ' reps' : pr.toLocaleString() + ' lbs&middot;set'}</span>
    <span class="gym-lasttime-target">Beat it &mdash; ${target}</span>
  </div>`;
}

// A day only "counts" for consistency — the streak, and a solid calendar cell —
// when it is a real session, not a token check-in. The bar the user asked for is
// about variety, not volume: two go-to moves (the classic push-ups + sit-ups) is
// a check-in; a third distinct exercise makes it a session. Any cardio session
// counts on its own, the same as isFullSession treats it.
const CONSISTENCY_MIN_EXERCISES = 3;

function distinctExercisesOn(dateStr) {
  const names = new Set();
  (state.gym || []).forEach(e => {
    if (e.date !== dateStr) return;
    const n = (e.exercise || '').trim().toLowerCase();
    if (n) names.add(n);
  });
  return names.size;
}

function isConsistencyDay(dateStr) {
  if ((state.cardio || []).some(s => s.date === dateStr)) return true;
  return distinctExercisesOn(dateStr) >= CONSISTENCY_MIN_EXERCISES;
}

// Dominant muscle group for a day, weighted by sets: 'push' | 'pull' | 'legs' |
// 'core' when one group carries 60%+ of the classified sets, otherwise 'mixed'.
// A day with no classifiable lifting but a cardio session reads as 'cardio';
// a day with nothing at all returns null.
function dayFocusGroup(dateStr) {
  const tally = { push: 0, pull: 0, legs: 0, core: 0 };
  let classified = 0;
  (state.gym || []).forEach(e => {
    if (e.date !== dateStr) return;
    const g = muscleGroupFor(e.exercise);
    const n = (e.sets || []).length;
    if (g) { tally[g] += n; classified += n; }
  });
  if (!classified) {
    return (state.cardio || []).some(s => s.date === dateStr) ? 'cardio' : null;
  }
  const order = ['push', 'pull', 'legs', 'core'];
  const hit = order.filter(g => tally[g] > 0).sort((a, b) => tally[b] - tally[a]);
  return tally[hit[0]] / classified >= 0.6 ? hit[0] : 'mixed';
}

// ---- Training split engine (Pull + Core → Push + Core → Legs + Core → Recovery)
// Nothing is scheduled by hand: the next day is inferred from what you actually
// logged. Missed days just resume at whatever is most due — there are no
// make-ups. Recovery is a real day in the cycle but adds ~no fatigue.
const SPLIT_ORDER = ['pull', 'push', 'legs']; // strength days; recovery interleaves
const SPLIT_LABEL = { pull: 'Pull + Core', push: 'Push + Core', legs: 'Legs + Core', recovery: 'Recovery' };
const SPLIT_FOCUS = {
  pull: ['Back', 'Biceps', 'Rear delts', 'Core'],
  push: ['Chest', 'Shoulders', 'Triceps', 'Core'],
  legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'],
  recovery: ['Easy cardio', 'Mobility', 'Optional light core'],
};

// What a logged day represents in the cycle, read from its dominant work:
// a strength day (pull/push/legs), a recovery day (cardio/mobility only),
// a core-only day, a mixed day, or nothing.
function trainingDayType(dateStr) {
  const g = dayFocusGroup(dateStr);
  if (!g) return null;
  if (g === 'cardio') return 'recovery';
  if (g === 'push' || g === 'pull' || g === 'legs') return g;
  return g; // 'core' or 'mixed'
}

const RECOVERY_AFTER_STREAK = 3; // strength days in a row before recovery is due

// The next day the app recommends, inferred from recent logs. Never asks you to
// pick — it reads the last few weeks and returns the most-rested strength day,
// or Recovery when you've strung together enough strength days or readiness is low.
function nextTrainingDay() {
  const today = getTodayStr();
  const last = { pull: null, push: null, legs: null };
  for (let i = 0; i <= 21; i++) {
    const ds = offsetDateStr(today, -i);
    const t = trainingDayType(ds);
    if ((t === 'pull' || t === 'push' || t === 'legs') && !last[t]) last[t] = ds;
  }
  const daysSince = g => last[g]
    ? Math.round((new Date(today + 'T00:00:00') - new Date(last[g] + 'T00:00:00')) / 86400000)
    : 999;

  // Consecutive strength days ending at the most recent training day — the
  // fatigue signal that makes Recovery the right call.
  let streak = 0;
  for (let i = 0; i <= 14; i++) {
    const t = trainingDayType(offsetDateStr(today, -i));
    if (i === 0 && !t) continue; // today may not be logged yet
    if (t === 'pull' || t === 'push' || t === 'legs') streak++;
    else break; // recovery, rest, or a gap ends the run
  }

  const readiness = (typeof readinessBreakdown === 'function') ? readinessBreakdown() : null;
  const lowReadiness = readiness && typeof readiness.score === 'number' && readiness.score < 45;
  if (streak >= RECOVERY_AFTER_STREAK || lowReadiness) {
    return {
      day: 'recovery', label: SPLIT_LABEL.recovery, focus: SPLIT_FOCUS.recovery,
      reason: lowReadiness
        ? `Readiness is ${readiness.score} — take it easy today.`
        : `${streak} strength days straight — recover before the next block.`,
      suggestion: 'Easy cardio + mobility, optional light core',
    };
  }

  // Most-rested strength day wins; ties fall back to the cycle order (Pull first).
  const day = SPLIT_ORDER.slice().sort((a, b) =>
    daysSince(b) - daysSince(a) || SPLIT_ORDER.indexOf(a) - SPLIT_ORDER.indexOf(b))[0];
  const ds = daysSince(day);
  const cap = day.charAt(0).toUpperCase() + day.slice(1);
  const reason = ds >= 999 ? 'Kicking off your cycle.' : `${cap} was ${ds === 0 ? 'today' : ds + 'd ago'} — it's the most rested.`;
  return { day, label: SPLIT_LABEL[day], focus: SPLIT_FOCUS[day], reason, suggestion: GROUP_SUGGESTIONS[day] };
}

// ---- Goal progress ----
// Connects the raw logging to WHY you train. Each goal reads from data you
// already enter — no new inputs. Golf is intentionally absent (a later phase).
// Waist/body-fat currently reads from the weight trend; a real waist measure
// arrives with the body-composition tracker.
function goalGroupDaysThisWeek(group) {
  const today = getTodayStr();
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const ds = offsetDateStr(today, -i);
    if ((state.gym || []).some(e => e.date === ds && muscleGroupFor(e.exercise) === group)) n++;
  }
  return n;
}

function goalProgress() {
  const today = getTodayStr();
  const goals = (typeof getGoals === 'function') ? getGoals() : { weight: 150 };
  const rows = [];

  // 1 — Fat loss (weight trend toward goal; waist comes with body-comp tracker)
  const pace = (typeof weighInPace === 'function') ? weighInPace() : null;
  const latestW = (typeof latestBodyWeightLbs === 'function') ? latestBodyWeightLbs() : null;
  if (pace && latestW != null && Number.isFinite(pace.perWeek)) {
    const cutting = latestW > goals.weight;
    const pw = Math.round(pace.perWeek * 10) / 10;
    const losing = pace.perWeek < -0.1;
    const atGoal = Math.abs(latestW - goals.weight) < 0.5;
    rows.push({
      label: 'Fat loss', icon: atGoal ? '🎯' : (cutting && losing ? '📉' : (cutting ? '⏸️' : '➖')),
      status: atGoal ? 'At goal' : (cutting && losing ? 'On track' : (cutting ? 'Stalled' : 'Maintaining')),
      detail: `${latestW} → ${goals.weight} lbs${pw ? ` · ${pw > 0 ? '+' : ''}${pw}/wk` : ''}`,
      tone: (atGoal || losing || !cutting) ? 'good' : 'warn',
    });
  } else {
    rows.push({ label: 'Fat loss', icon: '⚖️', status: 'Log weight', detail: 'weigh in twice a week to track', tone: 'muted' });
  }

  // 2 — Strength (average gain across your tracked movements)
  let strengthPct = null, improving = 0, stalledN = 0;
  if (typeof strengthMovements === 'function' && typeof movementTrend === 'function') {
    const trends = strengthMovements().map(movementTrend).filter(t => t.sessionCount >= 4);
    if (trends.length) {
      strengthPct = Math.round(trends.reduce((s, t) => s + t.gainPct, 0) / trends.length);
      improving = trends.filter(t => t.improving).length;
      stalledN = trends.filter(t => t.stalled).length;
    }
  }
  const gaining = strengthPct != null && strengthPct > 0;
  const strengthStatus = strengthPct == null ? 'Building'
    : gaining ? `+${strengthPct}%`
    : (stalledN > 0 && improving === 0) ? 'Stalled'
    : 'Holding';
  rows.push({
    label: 'Strength', icon: gaining ? '📈' : (strengthStatus === 'Stalled' ? '⏸️' : '💪'),
    status: strengthStatus,
    detail: strengthPct == null ? 'log a few weighted sessions' : `${improving} improving${stalledN ? ` · ${stalledN} stalled` : ''}`,
    tone: (gaining || improving > 0) ? 'good' : (stalledN > 0 ? 'warn' : 'good'),
  });

  // 3 — Core (days you hit core this week; target 3)
  const coreDays = goalGroupDaysThisWeek('core');
  rows.push({ label: 'Core', icon: coreDays >= 3 ? '🔥' : '🎯', status: `${coreDays}/wk`,
    detail: `${coreDays >= 3 ? 'on target' : 'aim for 3'} core days`, tone: coreDays >= 3 ? 'good' : 'warn' });

  // 4 — Cardio (sessions this week; target 2)
  const cardioDays = (state.cardio || []).filter(s => s && typeof s.date === 'string' && s.date >= offsetDateStr(today, -6) && s.date <= today).length;
  rows.push({ label: 'Cardio', icon: cardioDays >= 2 ? '🔥' : '🏃', status: `${cardioDays}/wk`,
    detail: `${cardioDays >= 2 ? 'on target' : 'aim for 2'} sessions`, tone: cardioDays >= 2 ? 'good' : 'warn' });

  // 5 — Consistency (real sessions this week vs 4)
  let real = 0;
  for (let i = 0; i < 7; i++) { if (isConsistencyDay(offsetDateStr(today, -i))) real++; }
  rows.push({ label: 'Consistency', icon: real >= 4 ? '🔥' : '📊', status: `${real}/4`,
    detail: 'real sessions this week', tone: real >= 4 ? 'good' : 'warn' });

  return rows;
}

function renderGoalProgress() {
  const host = document.getElementById('goalProgressBody');
  if (!host) return;
  const rows = goalProgress();
  host.innerHTML = rows.map(r => `
    <div class="goal-row">
      <span class="goal-row-icon">${r.icon}</span>
      <span class="goal-row-label">${esc(r.label)}</span>
      <span class="goal-row-detail">${esc(r.detail)}</span>
      <span class="goal-row-status goal-${r.tone}">${esc(r.status)}</span>
    </div>`).join('');
}

// ---- Consistency: streak stats + 16-week calendar ----
function renderStreak() {
  const heatEl = $('#streakHeatmap');
  if (!heatEl) return;
  const daySets = {};
  for (const e of state.gym) daySets[e.date] = (daySets[e.date] || 0) + e.sets.length;

  const today = getTodayStr();
  // Current streak: consecutive *real* sessions (3+ distinct exercises or cardio)
  // ending today — or yesterday, so a morning view before the workout doesn't
  // read as a broken streak. A push-ups + sit-ups check-in no longer holds it.
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  if (!isConsistencyDay(today)) d.setDate(d.getDate() - 1);
  while (isConsistencyDay(toLocalDateStr(d))) { streak++; d.setDate(d.getDate() - 1); }

  // Best streak, over the same real-session definition.
  const realDays = Object.keys(daySets)
    .concat((state.cardio || []).map(s => s.date))
    .filter((v, i, a) => a.indexOf(v) === i)
    .filter(isConsistencyDay)
    .sort();
  let best = 0, run = 0, prevT = null;
  for (const ds of realDays) {
    const t = new Date(ds + 'T00:00:00').getTime();
    run = (prevT !== null && t - prevT === 86400000) ? run + 1 : 1;
    if (run > best) best = run;
    prevT = t;
  }

  // Active days and real sessions are different things. A day of just push-ups
  // and sit-ups keeps the habit alive but is not a session, so it sits behind
  // the headline number as a check-in rather than counting toward it.
  let activeWeek = 0, realWeek = 0;
  for (let i = 0; i < 7; i++) {
    const dd = new Date(today + 'T00:00:00');
    dd.setDate(dd.getDate() - i);
    const ds = toLocalDateStr(dd);
    if (daySets[ds] || (state.cardio || []).some(s => s.date === ds)) activeWeek++;
    if (isConsistencyDay(ds)) realWeek++;
  }

  const checkIns = activeWeek - realWeek;
  $('#streakSummary').textContent = checkIns > 0
    ? `${realWeek} session${realWeek === 1 ? '' : 's'} · ${checkIns} check-in${checkIns === 1 ? '' : 's'} this week`
    : `${realWeek}/7 sessions this week`;
  $('#streakStats').innerHTML = `
    <div class="gym-stat"><span class="gym-stat-val">${streak}</span><span class="gym-stat-lbl">Day Streak</span></div>
    <div class="gym-stat"><span class="gym-stat-val">${realWeek}<small class="streak-stat-target"> / 4+</small></span><span class="gym-stat-lbl">Sessions This Week</span></div>
    <div class="gym-stat"><span class="gym-stat-val">${best}</span><span class="gym-stat-lbl">Best Streak</span></div>
  `;

  renderConsistencyCalendar(heatEl, daySets, today);
}

// Last-30-days calendar: columns = weeks, rows = Mon..Sun (so it reads down a
// week like a wall calendar), each day coloured by the muscle group it worked.
// A solid cell is a real session; a faded one is a check-in that fell under the
// 3-exercise bar. Weekday and month labels make the shape legible at a glance.
// The window is whole weeks so the weekday rows line up — enough columns to
// cover the last WINDOW_DAYS ending today, with no empty months of history.
const CAL_GROUP_LABEL = { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core', mixed: 'Mixed', cardio: 'Cardio' };
const CAL_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CAL_WINDOW_DAYS = 30;

function renderConsistencyCalendar(host, daySets, today, windowDays) {
  const win = windowDays || CAL_WINDOW_DAYS;
  const end = new Date(today + 'T00:00:00');
  const endDow = (end.getDay() + 6) % 7; // Mon = 0
  // Grid ends on the Sunday of the current week so the whole week shows.
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - endDow));
  // Window starts `win` days back from today, snapped back to that week's Monday.
  const start = new Date(end);
  start.setDate(start.getDate() - (win - 1));
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // that week's Monday
  const WEEKS = Math.round((gridEnd - start) / (7 * 86400000)) + 1;

  // Month labels: one slot per week column, named only where the month turns over.
  const months = [];
  let prevMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const col = new Date(start);
    col.setDate(start.getDate() + w * 7);
    const m = col.getMonth();
    months.push(m !== prevMonth ? `<span class="gym-cal-mon">${col.toLocaleDateString('en-US', { month: 'short' })}</span>` : '<span class="gym-cal-mon"></span>');
    prevMonth = m;
  }

  const cells = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    const ds = toLocalDateStr(dd);
    const label = dd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (ds > today) { cells.push(`<div class="gym-cal-cell is-future" title="${label}"></div>`); continue; }

    const group = dayFocusGroup(ds);
    if (!group) { cells.push(`<div class="gym-cal-cell is-empty" title="${label} · rest"></div>`); continue; }

    const real = isConsistencyDay(ds);
    const sets = daySets[ds] || 0;
    const distinct = distinctExercisesOn(ds);
    let tip;
    if (group === 'cardio') {
      tip = `${label} · Cardio`;
    } else {
      tip = `${label} · ${CAL_GROUP_LABEL[group]} · ${distinct} exercise${distinct === 1 ? '' : 's'}, ${sets} set${sets === 1 ? '' : 's'}${real ? '' : ' · check-in'}`;
    }
    cells.push(`<div class="gym-cal-cell g-${group} ${real ? 'is-real' : 'is-check'}" title="${tip}"></div>`);
  }

  const legendGroups = ['push', 'pull', 'legs', 'core', 'cardio'];
  const legend = legendGroups.map(g => `<span class="gym-cal-key"><i class="gym-cal-cell g-${g} is-real"></i>${CAL_GROUP_LABEL[g]}</span>`).join('')
    + '<span class="gym-cal-key gym-cal-key-note"><i class="gym-cal-cell g-mixed is-check"></i>Check-in</span>';

  host.innerHTML = `
    <div class="gym-cal-months">${months.join('')}</div>
    <div class="gym-cal-body">
      <div class="gym-cal-days">${CAL_DOW.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="gym-cal-grid">${cells.join('')}</div>
    </div>
    <div class="gym-cal-legend">${legend}</div>`;
}

// Exercise suggestions, ranked by what YOU actually do.
//
// The datalist under this input was alphabetical across 50+ catalogue entries,
// so "Push Ups" sat below "Pike Push Ups" and "Overhead Press" — and datalist
// on iOS Safari is a thin bar that is easy to miss anyway. Mid-workout, with
// one hand, typing the same lift for the twentieth time is the actual problem.
//
// Score is sessions logged, plus a recency bonus that decays over a month, so
// what you are training THIS block floats up without a single heavy week
// pinning something to the top forever. Unused catalogue entries come last,
// only when you are typing.
function rankedExerciseSuggestions(query) {
  const q = (query || '').trim().toLowerCase();
  const today = new Date(getTodayStr() + 'T00:00:00').getTime();
  const stats = {};
  (state.gym || []).forEach(e => {
    const name = (e && e.exercise || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!stats[key]) stats[key] = { name: name, count: 0, last: 0 };
    stats[key].count++;
    const t = new Date(e.date + 'T00:00:00').getTime();
    if (t > stats[key].last) stats[key].last = t;
  });

  const mine = Object.keys(stats).map(k => {
    const s = stats[k];
    const daysAgo = Math.max(0, Math.round((today - s.last) / 86400000));
    return { name: s.name, score: s.count + Math.max(0, 30 - daysAgo) / 3, used: true };
  });

  const seen = {};
  mine.forEach(m => { seen[m.name.toLowerCase()] = true; });
  const rest = (typeof COMMON_EXERCISES !== 'undefined' ? COMMON_EXERCISES : [])
    .filter(n => !seen[n.toLowerCase()])
    .map(n => ({ name: n, score: -1, used: false }));

  let all = mine.concat(rest);
  if (q) {
    // Prefix matches first — typing "pu" should reach Push Ups before Hip Thrust.
    all = all.filter(x => x.name.toLowerCase().includes(q));
    all.forEach(x => { if (x.name.toLowerCase().indexOf(q) === 0) x.score += 100; });
  } else {
    // Nothing typed: only offer things you have actually done, or the list is
    // just the catalogue in disguise.
    all = all.filter(x => x.used);
  }
  return all.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 12);
}

function renderExerciseSuggestions() {
  const host = document.getElementById('gymSuggest');
  if (!host) return;
  const input = document.getElementById('gymExerciseName');
  const q = input ? input.value : '';
  const list = rankedExerciseSuggestions(q);
  // An exact match means they already have what they need; the row would just
  // be covering the set inputs at that point.
  const exact = list.length === 1 && list[0].name.toLowerCase() === q.trim().toLowerCase();
  if (!list.length || exact) { host.innerHTML = ''; return; }
  host.innerHTML = list.map(x =>
    `<button type="button" class="gym-suggest-chip${x.used ? '' : ' is-new'}" data-ex="${esc(x.name)}">${esc(x.name)}</button>`
  ).join('');
}

// ---- Logging sheet (mobile) ----
// On a phone the gym page is now a view of the day's work, and logging happens
// in a sheet you open deliberately. Mid-set, one-handed, a full-screen form
// with big targets beats a form wedged above a list you keep scrolling past.
// Desktop ignores all of this and keeps the inline form.
function gymSheetIsMobile() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function openGymLogSheet(prefillName) {
  const sheet = document.getElementById('gymLogSheet');
  if (!sheet) return;
  if (gymEditingIdx === null) gymSets = (typeof defaultGymSets === 'function') ? defaultGymSets() : gymSets;
  const input = document.getElementById('gymExerciseName');
  if (input && typeof prefillName === 'string') input.value = prefillName;
  renderGym();
  sheet.classList.add('is-open');
  document.body.classList.add('gym-sheet-lock');
  if (typeof haptic === 'function') haptic('light');
  const title = document.getElementById('gymLogSheetTitle');
  if (title) title.textContent = gymEditingIdx === null ? 'Log exercise' : 'Edit exercise';
  // On mobile, do NOT autofocus: iOS throws the keyboard up over the suggestions,
  // which are the point of opening this. Desktop has no keyboard to fight, so a
  // popup that lands with the cursor already in the field feels right.
  if (!gymSheetIsMobile() && input) {
    input.focus();
    input.select();
  }
}

function closeGymLogSheet() {
  const sheet = document.getElementById('gymLogSheet');
  if (!sheet) return;
  sheet.classList.remove('is-open');
  document.body.classList.remove('gym-sheet-lock');
  const input = document.getElementById('gymExerciseName');
  if (input) input.blur();
}

function bindGymSuggestions() {
  const host = document.getElementById('gymSuggest');
  const input = document.getElementById('gymExerciseName');
  if (host) {
    host.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-ex]');
      if (!chip || !input) return;
      input.value = chip.dataset.ex;
      if (typeof haptic === 'function') haptic('light');
      // 'change' is what switches bodyweight mode and refreshes the beat-last-time
      // chip, so fire it rather than duplicating that logic here.
      input.dispatchEvent(new Event('change', { bubbles: true }));
      renderExerciseSuggestions();
      const firstReps = document.querySelector('#gymSetsList .gym-reps-input');
      if (firstReps) firstReps.focus();
    });
  }
  if (input) input.addEventListener('input', renderExerciseSuggestions);

  const close = document.getElementById('gymLogClose');
  if (close) close.addEventListener('click', closeGymLogSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGymLogSheet();
  });
  // Desktop popup: clicking the dimmed backdrop (the sheet element itself, never
  // the panel inside it) closes, matching how the New Task modal behaves.
  const sheet = document.getElementById('gymLogSheet');
  if (sheet) sheet.addEventListener('click', (e) => { if (e.target === sheet) closeGymLogSheet(); });
}

// ---- Rest timer ----
let restInterval = null;

function stopRestTimer() {
  if (restInterval) clearInterval(restInterval);
  restInterval = null;
  $$('.gym-rest-btn').forEach(b => {
    b.classList.remove('active');
    b.textContent = `Rest ${b.dataset.rest}s`;
  });
}

function startRestTimer(btn) {
  const wasActive = btn.classList.contains('active');
  stopRestTimer();
  if (wasActive) return; // tapping the running timer cancels it
  btn.classList.add('active');
  let left = Number(btn.dataset.rest);
  btn.textContent = `${left}s`;
  restInterval = setInterval(() => {
    left--;
    if (left <= 0) {
      stopRestTimer();
      // Fires from a timer, not a tap. The iOS switch fallback needs a user
      // gesture, so on iPhone this stays silent and the toast does the work —
      // there is no way to buzz a phone from a background timer on the web.
      if (typeof haptic === 'function') haptic('success');
      showToast('Rest over — next set!');
    } else {
      btn.textContent = `${left}s`;
    }
  }, 1000);
}

function offsetDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

function coachRecommendations(burn, burnGoal, pace) {
  const goals = getGoals();
  const recs = [];
  const isToday = gymViewDate === getTodayStr();

  const weekStart = offsetDateStr(gymViewDate, -6);
  const prevWeekStart = offsetDateStr(gymViewDate, -13);
  const prevWeekEnd = offsetDateStr(gymViewDate, -7);
  const week = gymDatesBetween(weekStart, gymViewDate);
  const prevWeek = gymDatesBetween(prevWeekStart, prevWeekEnd);

  const cutting = latestBodyWeightLbs() > goals.weight;

  // Pace safety first — losing too fast costs muscle
  if (pace && cutting && pace.perWeek < -2) {
    recs.push({ type: 'warn', text: `You're losing ${Math.abs(Math.round(pace.perWeek * 10) / 10)} lbs/week — faster than the ~1 lb/week sweet spot. Eat a little more and keep protein at ${goals.protein}g so the loss stays fat, not muscle.` });
  } else if (pace && cutting && pace.perWeek > -0.3) {
    recs.push({ type: 'warn', text: `Weight has barely moved over the last few weigh-ins (${pace.perWeek >= 0 ? '+' : ''}${Math.round(pace.perWeek * 10) / 10} lbs/week). Tighten calories toward ${goals.calories} or add a daily 30-min walk to restart the ~1 lb/week loss.` });
  }

  // Burn gap for today
  if (isToday && burn < burnGoal) {
    const kg = latestBodyWeightLbs() * 0.4536;
    const calPerSet = MET_BODYWEIGHT * kg * (SET_MINUTES / 60);
    const gap = burnGoal - burn;
    const sets = Math.ceil(gap / calPerSet);
    const walkMin = Math.max(10, Math.round(gap / (4.3 * kg / 60) / 5) * 5);
    recs.push({ type: 'info', text: `${gap} cal left on today's burn target — roughly ${sets} more sets or a ${walkMin}-min brisk walk.` });
  }

  // Training frequency over the trailing week
  const daysTrained = new Set(week.map(e => e.date)).size;
  if (daysTrained < 4) {
    recs.push({ type: 'warn', text: `You trained ${daysTrained} of the last 7 days. For calisthenics on a cut, 4-5 short sessions a week beats 1-2 long ones — it keeps the muscle-retention signal on.` });
  }

  // Muscle group balance
  const groupSets = { push: 0, pull: 0, legs: 0, core: 0 };
  for (const ex of week) {
    const g = muscleGroupFor(ex.exercise);
    if (g) groupSets[g] += ex.sets.length;
  }
  const missing = Object.keys(groupSets).filter(g => groupSets[g] === 0);
  if (week.length && missing.length && missing.length < 4) {
    recs.push({ type: 'warn', text: `No ${missing.join(' or ')} work in the last 7 days — add ${missing.map(g => GROUP_SUGGESTIONS[g]).join(', ')} to keep your physique balanced.` });
  }

  // Progression ladder: mastered a variation → point at the next one
  const prog = progressionSuggestion();
  if (prog) {
    recs.push({ type: 'good', text: `You've cleared ${prog.threshold}+ reps across your last two ${prog.from} sessions — that variation has stopped challenging you. Progress to ${prog.to}.` });
  }

  // Stalled staple: the ladder waits for mastery, so a movement parked well
  // below its threshold is invisible to it. That is the more common failure.
  const stall = bodyweightStall();
  if (!prog && stall) {
    recs.push({ type: 'warn', text: `${stall.name}: ${stall.sessions} sessions logged and your best set is still ${stall.reps} reps — it has not moved since ${formatDate(stall.since)}. A set that never gets harder stops producing anything. Take the first set to failure and log the real number.` });
  }

  // Check-in days: logged, but not a session
  const tokenDays = [...new Set(week.map(e => e.date))].filter(d => !isFullSession(d));
  if (tokenDays.length >= 2) {
    recs.push({ type: 'info', text: `${tokenDays.length} of your training days this week were under ${SESSION_MIN_SETS} sets. They keep the habit alive, but they are not doing training work — if a day is meant to count, give it 4+ hard sets.` });
  }

  // Progression: total reps this week vs last week
  const repCount = entries => entries.reduce((s, ex) => s + ex.sets.reduce((v, set) => v + Number(set.reps), 0), 0);
  const repsNow = repCount(week);
  const repsPrev = repCount(prevWeek);
  if (!prog && repsPrev > 0 && repsNow > 0 && repsNow <= repsPrev) {
    recs.push({ type: 'info', text: `Weekly volume is flat (${repsNow} reps vs ${repsPrev} last week). Add 1-2 reps per set or move to a harder variation (e.g. decline or diamond push ups) — progression is what changes your body.` });
  }

  // Protein yesterday (muscle retention on a cut)
  const yday = offsetDateStr(gymViewDate, -1);
  const ydayEntries = state.diet.filter(e => e.date === yday);
  if (ydayEntries.length) {
    const protein = Math.round(ydayEntries.reduce((s, e) => s + (e.protein || 0), 0));
    if (protein < goals.protein * 0.8) {
      recs.push({ type: 'warn', text: `Protein was ${protein}g yesterday vs your ${goals.protein}g target. On a cut, protein is what decides whether you lose fat or muscle — lead each meal with it.` });
    }
  }

  // Stale weigh-ins
  if (pace) {
    const daysSince = Math.round((new Date(getTodayStr() + 'T00:00:00') - new Date(pace.lastDate + 'T00:00:00')) / 86400000);
    if (daysSince >= 3) {
      recs.push({ type: 'info', text: `Last weigh-in was ${daysSince} days ago — step on the scale (same time of day) so your pace tracking stays honest.` });
    }
  }

  if (!recs.length) {
    recs.push({ type: 'good', text: 'Frequency, muscle balance, and pace all look on track this week — keep doing exactly this.' });
  }
  return recs.slice(0, 4);
}

function renderGymCoach() {
  const targetsEl = $('#coachTargets');
  if (!targetsEl) return;
  const goals = getGoals();
  const burnGoal = goals.burn || 300;
  const burnInfo = burnForDate(gymViewDate);
  const burn = burnInfo.cal;
  const pct = Math.min(100, Math.round((burn / burnGoal) * 100));
  const isToday = gymViewDate === getTodayStr();
  $('#burnGoalChip').textContent = `Burn goal: ${burnGoal} cal/day`;

  const pace = weighInPace();
  const cutting = latestBodyWeightLbs() > goals.weight;
  const targetPace = cutting ? -1 : 1;

  let paceVal = '—';
  let paceSub = `Log a couple of weigh-ins to see your pace (target ${targetPace} lb/week)`;
  let paceFlag = '';
  if (pace) {
    const pw = Math.round(pace.perWeek * 10) / 10;
    paceVal = `${pw > 0 ? '+' : ''}${pw}<small> lbs/wk</small>`;
    const onTrack = cutting ? pace.perWeek <= -0.5 : pace.perWeek >= 0.5;
    paceFlag = `<span class="coach-pace-flag ${onTrack ? 'good' : 'bad'}">${onTrack ? 'On track' : 'Off pace'}</span>`;
    const toGo = goals.weight - pace.lastW;
    const movingToward = toGo / pace.perWeek > 0;
    if (Math.abs(pace.lastW - goals.weight) < 0.5) {
      paceSub = `You're at your ${goals.weight} lbs goal — nice work.`;
    } else if (movingToward && Math.abs(pace.perWeek) >= 0.1) {
      const weeks = toGo / pace.perWeek;
      if (weeks <= 52) {
        const eta = new Date(pace.lastDate + 'T00:00:00');
        eta.setDate(eta.getDate() + Math.round(weeks * 7));
        paceSub = `Target ${targetPace} lb/week &middot; at this pace you hit ${goals.weight} lbs ~${eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else {
        paceSub = `Target ${targetPace} lb/week &middot; current pace puts the goal over a year out`;
      }
    } else {
      paceSub = `Target ${targetPace} lb/week &middot; you're currently moving away from ${goals.weight} lbs`;
    }
  }

  targetsEl.innerHTML = `
    <div class="coach-target">
      <span class="coach-target-lbl">${burnInfo.watch ? 'Active Burn' : 'Est. Burn'} &mdash; ${isToday ? 'Today' : formatDate(gymViewDate)}</span>
      <span class="coach-target-val">${burnInfo.watch ? '' : '~'}${burn}<small> / ${burnGoal} cal</small></span>
      <div class="coach-bar-track"><div class="coach-bar-fill ${burn >= burnGoal ? 'done' : ''}" style="width:${pct}%"></div></div>
      <span class="coach-target-sub">${burn >= burnGoal ? 'Burn target hit' : `${burnGoal - burn} cal to go`} &middot; ${burnInfo.watch ? 'measured by your Apple Watch' : 'estimated from your logged sets'}</span>
    </div>
    <div class="coach-target">
      <span class="coach-target-lbl">Weekly Pace &rarr; ${goals.weight} lbs ${paceFlag}</span>
      <span class="coach-target-val">${paceVal}</span>
      <span class="coach-target-sub">${paceSub}</span>
    </div>
  `;

  $('#coachRecs').innerHTML = coachRecommendations(burn, burnGoal, pace).map(r => `
    <div class="coach-rec ${r.type}"><span class="coach-rec-dot"></span><span>${r.text}</span></div>
  `).join('');
}

function renderGym() {
  const dateInput = $('#gymDate');
  if (!dateInput) return;
  dateInput.value = gymViewDate;

  renderWeight();
  renderGymCoach();
  renderGoalProgress();
  renderStreak();
  renderLastTimeChip();

  // Date label
  const todayStr = getTodayStr();
  const viewDate = new Date(gymViewDate + 'T00:00:00');
  const isToday = gymViewDate === todayStr;
  $('#gymDateLabel').textContent = isToday ? 'Today' :
    viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Populate exercise suggestions
  const allExercises = [...new Set([...COMMON_EXERCISES, ...state.gym.map(e => e.exercise)])].sort();
  $('#exerciseSuggestions').innerHTML = allExercises.map(e => `<option value="${e}">`).join('');
  renderExerciseSuggestions();

  // Detect bodyweight mode from exercise name
  const exerciseName = $('#gymExerciseName').value.trim();
  gymBodyweight = isBodyweightExercise(exerciseName);

  // Render set inputs
  $('#gymSetsList').innerHTML = gymSets.map((s, i) => `
    <div class="gym-set-chip" data-index="${i}">
      <span class="gym-set-chip-num">${i + 1}</span>
      <input type="number" class="gym-reps-input" value="${s.reps}" placeholder="reps" min="0" data-index="${i}">
      ${!gymBodyweight ? `
        <span class="gym-set-chip-x">&times;</span>
        <input type="number" class="gym-weight-input" value="${s.weight}" placeholder="lbs" min="0" step="2.5" data-index="${i}">
      ` : '<span class="gym-bw-label">BW</span>'}
      ${gymSets.length > 1 ? `<button type="button" class="gym-remove-set" data-index="${i}">&times;</button>` : ''}
    </div>
  `).join('');

  $$('.gym-reps-input').forEach(inp => {
    inp.addEventListener('input', () => { gymSets[inp.dataset.index].reps = inp.value; });
  });
  $$('.gym-weight-input').forEach(inp => {
    inp.addEventListener('input', () => { gymSets[inp.dataset.index].weight = inp.value; });
  });
  $$('.gym-remove-set').forEach(btn => {
    btn.addEventListener('click', () => { gymSets.splice(btn.dataset.index, 1); renderGym(); });
  });

  // Day exercises
  const dayExercises = state.gym.filter(e => e.date === gymViewDate);
  const totalSets = dayExercises.reduce((s, ex) => s + ex.sets.length, 0);
  const weightedExercises = dayExercises.filter(ex => !ex.bodyweight && !isBodyweightExercise(ex.exercise));
  const totalVolume = weightedExercises.reduce((s, ex) => s + ex.sets.reduce((v, set) => v + Number(set.reps) * Number(set.weight), 0), 0);
  const totalReps = dayExercises.reduce((s, ex) => s + ex.sets.reduce((v, set) => v + Number(set.reps), 0), 0);

  // Stats
  $('#gymStats').innerHTML = dayExercises.length ? `
    <div class="gym-stat"><span class="gym-stat-val">${dayExercises.length}</span><span class="gym-stat-lbl">Exercises</span></div>
    <div class="gym-stat"><span class="gym-stat-val">${totalSets}</span><span class="gym-stat-lbl">Sets</span></div>
    <div class="gym-stat"><span class="gym-stat-val">${totalReps.toLocaleString()}</span><span class="gym-stat-lbl">Reps</span></div>
    <div class="gym-stat"><span class="gym-stat-val">${totalVolume.toLocaleString()}</span><span class="gym-stat-lbl">Volume (lbs)</span></div>
  ` : '';

  // Exercise list
  if (!dayExercises.length) {
    $('#gymTodayList').innerHTML = '<div class="gym-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" opacity="0.4"><path d="M6.5 6.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3"/><path d="M17.5 6.5h3a1 1 0 011 1v9a1 1 0 01-1 1h-3"/><rect x="6.5" y="4" width="4" height="16" rx="1"/><rect x="13.5" y="4" width="4" height="16" rx="1"/><line x1="10.5" y1="12" x2="13.5" y2="12"/></svg><p>No exercises logged</p><p class="gym-empty-sub">Tap “+ Add Exercise” to start tracking</p></div>';
  } else {
    $('#gymTodayList').innerHTML = sessionFocusRow(dayExercises) + dayExercises.map((ex, idx) => {
      const isBW = ex.bodyweight || isBodyweightExercise(ex.exercise);
      const totalRepsEx = ex.sets.reduce((sum, s) => sum + Number(s.reps), 0);
      const vol = ex.sets.reduce((sum, s) => sum + (Number(s.reps) * Number(s.weight)), 0);
      // PR: best set today beats every earlier session of this exercise
      const hist = exerciseHistory(ex.exercise, ex.date);
      const isPR = hist.length > 0 && bestSetScore(ex) > hist.reduce((m, h) => Math.max(m, bestSetScore(h)), 0);
      const grp = muscleGroupFor(ex.exercise);
      return `
      <div class="gym-entry">
        <div class="gym-entry-head">
          <div class="gym-entry-left">
            <span class="gym-entry-num">${idx + 1}</span>
            <span class="gym-entry-name">${esc(ex.exercise)}</span>
            ${grp ? `<span class="gym-group-badge" data-group="${grp}">${groupLabel(grp)}</span>` : ''}
            ${isPR ? '<span class="gym-pr-badge">PR</span>' : ''}
            ${isBW ? '<span class="gym-bw-badge">Bodyweight</span>' : ''}
          </div>
          <div class="gym-entry-right">
            <span class="gym-entry-vol">${isBW ? totalRepsEx + ' reps' : vol.toLocaleString() + ' lbs'}</span>
            <button class="gym-entry-edit" data-gym-idx="${idx}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="gym-entry-del" data-gym-idx="${idx}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>
        <table class="gym-sets-table">
          <thead><tr><th>Set</th><th>Reps</th>${!isBW ? '<th>Weight</th>' : ''}</tr></thead>
          <tbody>
            ${ex.sets.map((s, si) => `<tr><td>${si + 1}</td><td>${s.reps}</td>${!isBW ? `<td>${s.weight} lbs</td>` : ''}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('');
  }

  // Bind edit
  $$('.gym-entry-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayEx = state.gym.filter(e => e.date === gymViewDate);
      const ex = dayEx[btn.dataset.gymIdx];
      if (!ex) return;
      gymEditingIdx = parseInt(btn.dataset.gymIdx);
      $('#gymExerciseName').value = ex.exercise;
      gymSets = ex.sets.map(s => ({ reps: String(s.reps), weight: String(s.weight) }));
      // Update button text
      $('#gymSaveExerciseBtn').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
        Update Exercise`;
      // Editing opens the same popup as logging — on both mobile and desktop now.
      // openGymLogSheet() calls renderGym() and handles focus per platform.
      if (typeof openGymLogSheet === 'function') openGymLogSheet(ex.exercise);
      else { renderGym(); $('#gymExerciseName').focus(); }
    });
  });

  // Bind delete
  $$('.gym-entry-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayEx = state.gym.filter(e => e.date === gymViewDate);
      const target = dayEx[btn.dataset.gymIdx];
      if (target) {
        state.gym = state.gym.filter(e => e !== target);
        saveData(state);
        renderGym();
      }
    });
  });

  // Logging a set or a weigh-in calls renderGym(), not the full render(), so
  // the Training shell above it (week line + weight readout) has to be brought
  // along or it shows stale numbers until the next navigation.
  if (typeof renderTrainingShell === 'function') renderTrainingShell();
  if (typeof renderWeightSheetBody === 'function') renderWeightSheetBody();
}

function bindGymEvents() {
  const burnChip = $('#burnGoalChip');
  if (burnChip && typeof openGoalsModal === 'function') burnChip.addEventListener('click', openGoalsModal);
  // Re-render set inputs when exercise name changes (bodyweight detection)
  $('#gymExerciseName').addEventListener('change', () => renderGym());
  // Live "beat last time" chip while typing (chip only — no full re-render mid-keystroke)
  $('#gymExerciseName').addEventListener('input', renderLastTimeChip);
  $$('.gym-rest-btn').forEach(btn => btn.addEventListener('click', () => startRestTimer(btn)));
  $('#gymDate').addEventListener('change', (e) => { gymViewDate = e.target.value; renderGym(); });
  $('#gymPrevDay').addEventListener('click', () => {
    const d = new Date(gymViewDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    gymViewDate = toLocalDateStr(d);
    renderGym();
  });
  $('#gymNextDay').addEventListener('click', () => {
    const d = new Date(gymViewDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    gymViewDate = toLocalDateStr(d);
    renderGym();
  });
  $('#gymToday').addEventListener('click', () => {
    gymViewDate = getTodayStr();
    renderGym();
  });
  $('#gymAddSetBtn').addEventListener('click', () => { gymSets.push({ reps: '', weight: '' }); renderGym(); });
  $('#weightLogBtn').addEventListener('click', () => {
    const v = Number($('#weightInput').value);
    if (!v || v < 50 || v > 500) { showToast('Enter your weight in lbs'); return; }
    state.weight = state.weight || {};
    state.weight[gymViewDate] = Math.round(v * 10) / 10;
    saveData(state);
    $('#weightInput').value = '';
    renderGym();
    showToast(`Weight logged: ${v} lbs`);
  });
  $('#weightInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#weightLogBtn').click();
  });
  bindGymSuggestions();
  $('#gymSaveExerciseBtn').addEventListener('click', () => {
    const name = $('#gymExerciseName').value.trim();
    if (!name) return;
    const bw = isBodyweightExercise(name);
    const validSets = gymSets
      .filter(s => s.reps && (bw || s.weight))
      .map(s => ({ reps: Number(s.reps), weight: bw ? 0 : Number(s.weight) }));
    if (!validSets.length) return;

    if (gymEditingIdx !== null) {
      // Update existing exercise
      const dayEx = state.gym.filter(e => e.date === gymViewDate);
      const target = dayEx[gymEditingIdx];
      if (target) {
        target.exercise = name;
        target.sets = validSets;
        target.bodyweight = bw;
      }
      gymEditingIdx = null;
      $('#gymSaveExerciseBtn').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Exercise`;
    } else {
      state.gym.push({ date: gymViewDate, exercise: name, sets: validSets, bodyweight: bw });
    }

    saveData(state);
    if (typeof haptic === 'function') haptic('success');
    $('#gymExerciseName').value = '';
    gymSets = (typeof defaultGymSets === 'function') ? defaultGymSets() : [{ reps: '', weight: '' }];
    gymBodyweight = false;
    renderGym();
    // Logging one exercise is the whole job of the sheet, so it closes and the
    // day's list is what you land back on.
    if (typeof closeGymLogSheet === 'function') closeGymLogSheet();
  });
}
