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

const MUSCLE_GROUPS = {
  push: ['push up', 'pushup', 'push-up', 'dip', 'press', 'bench', 'handstand', 'tricep'],
  pull: ['pull up', 'pullup', 'chin up', 'row', 'curl', 'pulldown', 'muscle up', 'lever', 'face pull'],
  legs: ['squat', 'lunge', 'deadlift', 'leg press', 'calf', 'glute', 'hip thrust', 'box jump'],
  core: ['sit up', 'situp', 'crunch', 'plank', 'leg raise', 'twist', 'flutter', 'l-sit', 'dragon flag', 'mountain climber', 'superman'],
};

const GROUP_SUGGESTIONS = {
  push: 'push ups or dips',
  pull: 'pull ups or Australian rows',
  legs: 'bodyweight squats and lunges',
  core: 'planks and leg raises',
};

function muscleGroupFor(exercise) {
  const name = (exercise || '').toLowerCase();
  for (const [group, keywords] of Object.entries(MUSCLE_GROUPS)) {
    if (keywords.some(k => name.includes(k))) return group;
  }
  return null;
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

// ---- Consistency: streak stats + 16-week heatmap ----
function renderStreak() {
  const heatEl = $('#streakHeatmap');
  if (!heatEl) return;
  const daySets = {};
  for (const e of state.gym) daySets[e.date] = (daySets[e.date] || 0) + e.sets.length;

  const today = getTodayStr();
  // Current streak: consecutive training days ending today (or yesterday, so
  // a morning view before the workout doesn't read as a broken streak)
  let streak = 0;
  const d = new Date(today + 'T00:00:00');
  if (!daySets[today]) d.setDate(d.getDate() - 1);
  while (daySets[toLocalDateStr(d)]) { streak++; d.setDate(d.getDate() - 1); }

  let best = 0, run = 0, prevT = null;
  for (const ds of Object.keys(daySets).sort()) {
    const t = new Date(ds + 'T00:00:00').getTime();
    run = (prevT !== null && t - prevT === 86400000) ? run + 1 : 1;
    if (run > best) best = run;
    prevT = t;
  }

  let week = 0;
  for (let i = 0; i < 7; i++) {
    const dd = new Date(today + 'T00:00:00');
    dd.setDate(dd.getDate() - i);
    if (daySets[toLocalDateStr(dd)]) week++;
  }

  $('#streakSummary').textContent = `${week}/7 days this week`;
  $('#streakStats').innerHTML = `
    <div class="gym-stat"><span class="gym-stat-val">${streak}</span><span class="gym-stat-lbl">Day Streak</span></div>
    <div class="gym-stat"><span class="gym-stat-val">${week}<small class="streak-stat-target"> / 4+</small></span><span class="gym-stat-lbl">This Week</span></div>
    <div class="gym-stat"><span class="gym-stat-val">${best}</span><span class="gym-stat-lbl">Best Streak</span></div>
  `;

  // 16 weeks, columns = weeks, rows = Mon..Sun, GitHub-style
  const WEEKS = 16;
  const end = new Date(today + 'T00:00:00');
  const endDow = (end.getDay() + 6) % 7; // Mon = 0
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS * 7 - 1) + (6 - endDow));
  const cells = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    const ds = toLocalDateStr(dd);
    if (ds > today) { cells.push('<div class="streak-cell future"></div>'); continue; }
    const sets = daySets[ds] || 0;
    const lvl = sets === 0 ? 0 : sets < 6 ? 1 : sets < 12 ? 2 : 3;
    const label = new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    cells.push(`<div class="streak-cell lvl${lvl}" title="${label}${sets ? ` · ${sets} sets` : ' · rest'}"></div>`);
  }
  heatEl.innerHTML = cells.join('');
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
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
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
    $('#gymTodayList').innerHTML = '<div class="gym-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" opacity="0.4"><path d="M6.5 6.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3"/><path d="M17.5 6.5h3a1 1 0 011 1v9a1 1 0 01-1 1h-3"/><rect x="6.5" y="4" width="4" height="16" rx="1"/><rect x="13.5" y="4" width="4" height="16" rx="1"/><line x1="10.5" y1="12" x2="13.5" y2="12"/></svg><p>No exercises logged</p><p class="gym-empty-sub">Add an exercise below to start tracking</p></div>';
  } else {
    $('#gymTodayList').innerHTML = dayExercises.map((ex, idx) => {
      const isBW = ex.bodyweight || isBodyweightExercise(ex.exercise);
      const totalRepsEx = ex.sets.reduce((sum, s) => sum + Number(s.reps), 0);
      const vol = ex.sets.reduce((sum, s) => sum + (Number(s.reps) * Number(s.weight)), 0);
      // PR: best set today beats every earlier session of this exercise
      const hist = exerciseHistory(ex.exercise, ex.date);
      const isPR = hist.length > 0 && bestSetScore(ex) > hist.reduce((m, h) => Math.max(m, bestSetScore(h)), 0);
      return `
      <div class="gym-entry">
        <div class="gym-entry-head">
          <div class="gym-entry-left">
            <span class="gym-entry-num">${idx + 1}</span>
            <span class="gym-entry-name">${esc(ex.exercise)}</span>
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
      renderGym();
      $('#gymExerciseName').focus();
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
    $('#gymExerciseName').value = '';
    gymSets = [{ reps: '', weight: '' }];
    gymBodyweight = false;
    renderGym();
  });
}
