// ========== Brief and actions (spec 4.5) ==========
// One sentence and up to three chips. It shares coachSnapshot/coachDecision
// with the Training coach on purpose — two engines would eventually contradict
// each other ("rest today" on one screen, "push hard" on another). This surface
// adds the domains the fitness coach doesn't cover: nutrition pacing and tasks.
//
// v3 folded three things into this one sentence: the brief's readiness badge and
// training row (now the bold first clause), the reminder CARDS (now the chips —
// same rules, a tenth of the height), and the tasks row (now "Due soon"). The
// this-week grid belongs to Insights' weekly report.
//
// Not built, deliberately: advice about data that does not exist.

function briefNutrition() {
  const goals = (typeof getGoals === 'function') ? getGoals() : {};
  const today = getTodayStr();
  const todays = (state.diet || []).filter(e => e && e.date === today);
  const totals = (typeof sumMacros === 'function')
    ? sumMacros(todays)
    : todays.reduce((a, e) => ({ calories: a.calories + (e.calories || 0), protein: a.protein + (e.protein || 0) }), { calories: 0, protein: 0 });

  // Recent protein habit, so the reminder reflects the pattern and not just today.
  const recent = [];
  for (let i = 1; i <= 7; i++) {
    const d = offsetDateStr(today, -i);
    const day = (state.diet || []).filter(e => e && e.date === d);
    if (day.length) recent.push(day.reduce((s, e) => s + (e.protein || 0), 0));
  }
  const avgProtein = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null;
  const proteinGoal = goals.protein || 150;
  const chronicLow = avgProtein !== null && avgProtein < proteinGoal * 0.75;

  const logged = todays.length > 0;
  const proteinLeft = Math.max(0, Math.round(proteinGoal - totals.protein));
  const hour = new Date().getHours();

  let text;
  if (!logged) {
    text = hour < 11
      ? 'Nothing logged yet — start the day with protein and the rest gets easier.'
      : 'Nothing logged today. ' + proteinGoal + 'g of protein is still the target.';
  } else if (proteinLeft <= 0) {
    text = 'Protein goal already cleared (' + Math.round(totals.protein) + 'g). Nicely done.';
  } else {
    text = Math.round(totals.protein) + 'g protein so far — ' + proteinLeft + 'g to go.';
    if (chronicLow) text += " You've averaged " + avgProtein + 'g this week, under your ' + proteinGoal + 'g target.';
  }
  return { text, chronicLow, proteinLeft, logged, avgProtein, proteinGoal, totals };
}

function briefTasks() {
  const today = getTodayStr();
  const tasks = state.tasks || [];
  const open = tasks.filter(t => t.status !== 'done');
  const overdue = open.filter(t => t.dueDate && t.dueDate < today);
  const dueToday = open.filter(t => t.dueDate === today);
  const noDate = open.filter(t => !t.dueDate);

  let text;
  if (overdue.length) {
    text = overdue.length + ' task' + (overdue.length === 1 ? ' is' : 's are') +
      ' overdue — clear ' + (overdue.length === 1 ? 'it' : 'the oldest one') + ' before adding anything new.';
  } else if (dueToday.length) {
    text = dueToday.length + ' due today. ' + esc(dueToday[0].name) + ' is first up.';
  } else if (open.length) {
    text = open.length + ' open, nothing due. ' + (noDate.length
      ? 'Pull one of the ' + noDate.length + ' undated tasks into today.'
      : 'Pick the one you keep avoiding.');
  } else {
    text = 'Nothing open. Enjoy it, or plan tomorrow.';
  }
  return { text, overdue: overdue.length, dueToday: dueToday.length, open: open.length };
}

// This week against last, so the brief shows movement rather than a snapshot.
function briefWeek() {
  const today = getTodayStr();
  const thisStart = offsetDateStr(today, -6);
  const lastStart = offsetDateStr(today, -13);
  const lastEnd = offsetDateStr(today, -7);

  const between = (from, to) => (d) => !!d && d >= from && d <= to;
  const inThis = between(thisStart, today);
  const inLast = between(lastStart, lastEnd);

  // One set of push-ups is a standing daily habit, not a training session, and
  // counting it here put "This week: 1 sessions" directly above the coach
  // saying "today is a check-in so far - a couple more exercises makes it a
  // real session". Both surfaces use isFullSession now (>= SESSION_MIN_SETS),
  // which is the line coach.js and the calendar were already drawing.
  //
  // Cardio counts on its own: a logged run has no sets to measure and is
  // never a check-in.
  const sessionDays = (pred) => {
    const fullDay = (typeof isFullSession === 'function') ? isFullSession : () => true;
    const gymDays = [...new Set((state.gym || []).filter(e => e && pred(e.date)).map(e => e.date))]
      .filter(fullDay);
    const cardioDays = (state.cardio || []).filter(c => c && pred(c.date)).map(c => c.date);
    return new Set(gymDays.concat(cardioDays)).size;
  };

  const proteinAvg = (pred) => {
    const byDay = {};
    (state.diet || []).forEach(e => {
      if (!e || !pred(e.date)) return;
      byDay[e.date] = (byDay[e.date] || 0) + (e.protein || 0);
    });
    const vals = Object.keys(byDay).map(k => byDay[k]);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const tasksDone = (pred) => (state.tasks || []).filter(t => t.completedAt && pred(t.completedAt)).length;

  return {
    sessions: sessionDays(inThis), sessionsPrev: sessionDays(inLast),
    protein: proteinAvg(inThis), proteinPrev: proteinAvg(inLast),
    tasks: tasksDone(inThis), tasksPrev: tasksDone(inLast),
  };
}


// ---------- the sentence ----------
// Bold first clause: what today IS, from the coach. Muted second clause: the one
// thing most worth knowing beyond it. Deliberately short of numbers the now
// block already shows two inches above — a sentence that repeats them is a
// sentence you learn to skip.
// Written the way the line writes it (24-hour), because the row this sentence
// points at is a few inches below: "at 6:30" over a node labelled 18:30 reads
// as two different sessions.
function briefWorkoutClock() {
  const mins = (typeof LINE_SLOT !== 'undefined' && LINE_SLOT.workout) || (18 * 60 + 30);
  if (typeof lineClock === 'function') return lineClock(mins);
  return Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0');
}

function briefSentence(s, nut, tasks) {
  const d = (typeof coachDecision === 'function') ? coachDecision(s) : { verdict: 'Today' };
  // "Push today" reads better as "Push day at 6:30" once there is a time to put
  // on it — and it is the same session the line is drawing at that time.
  let lead = d.verdict;
  if (!s.trainedToday && /today$/i.test(lead)) {
    lead = lead.replace(/\s*today$/i, ' day at ' + briefWorkoutClock());
  }

  let rest;
  if (tasks.overdue > 0) {
    rest = tasks.overdue + ' task' + (tasks.overdue === 1 ? ' is' : 's are') + ' past due — clear the oldest first.';
  } else if (!nut.logged) {
    rest = new Date().getHours() < 11
      ? 'Nothing logged yet; start the day with protein.'
      : 'Nothing logged today — the day is guesswork without it.';
  } else if (nut.chronicLow) {
    rest = 'Protein has been short all week; lead every meal with it.';
  } else if (nut.proteinLeft > 0) {
    rest = 'Food is on pace, ' + nut.proteinLeft + 'g of protein to go.';
  } else if (tasks.dueToday > 0) {
    rest = tasks.dueToday + ' due today.';
  } else {
    rest = 'Food is handled. Protect it with sleep.';
  }
  return { lead, rest };
}

// ---------- the action chips ----------
// The v2 reminder rules, unchanged in substance: workout, water, weigh-in,
// calories, protein, gym gap. They were six stacked cards with icons, titles,
// sub-lines and buttons — around 400px of Today. Same decisions, three chips.
// Ordered by what costs most if ignored; only the top three are drawn.
function briefActions(s, nut) {
  const today = getTodayStr();
  const hour = new Date().getHours();
  const g = (typeof getGoals === 'function') ? getGoals() : { calories: 2000, protein: 150, water: 66 };
  const out = [];

  // A rest verdict must not be followed by a chip telling you to train: the
  // reminder cards used to do exactly that, because they never asked the coach.
  const fullToday = (typeof isFullSession === 'function') ? isFullSession(today) : false;
  const verdict = (typeof coachDecision === 'function') ? coachDecision(s).verdict : '';
  const restDay = /^(rest|recovery|done)/i.test(verdict);
  if (!fullToday && !restDay) {
    out.push({ icon: 'fitness_center', label: 'Log workout', act: 'training' });
  }

  const weighDates = Object.keys(state.weight || {}).sort();
  const last = weighDates[weighDates.length - 1] || null;
  const sinceWeigh = last
    ? Math.round((new Date(today + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000)
    : null;
  if (hour >= 6 && (sinceWeigh === null || sinceWeigh >= 3)) {
    out.push({ icon: 'monitor_weight', label: 'Weigh in', act: 'weigh' });
  }

  const water = ((state.water || {})[today] || []).reduce((a, b) => a + b, 0);
  if (hour >= 10 && water < (g.water || 66) * 0.8) {
    out.push({ icon: 'water_drop', label: 'Water', act: 'diet' });
  }

  const cal = Math.round((nut.totals && nut.totals.calories) || 0);
  const protein = (nut.totals && nut.totals.protein) || 0;
  if (cal > (g.calories || 2000)) {
    out.push({ icon: 'restaurant', label: 'Over budget', act: 'diet' });
  } else if (!nut.logged || (hour >= 12 && cal < (g.calories || 2000) * 0.2)) {
    out.push({ icon: 'restaurant', label: 'Log food', act: 'diet' });
  } else if (hour >= 14 && protein < 50) {
    out.push({ icon: 'egg_alt', label: 'Protein', act: 'diet' });
  }

  return out.slice(0, 3);
}

function renderBrief() {
  const host = document.getElementById('todayBrief');
  if (!host) return;
  if (typeof coachSnapshot !== 'function') { host.innerHTML = ''; return; }

  const s = coachSnapshot();
  const nut = briefNutrition();
  const tasks = briefTasks();
  const sentence = briefSentence(s, nut, tasks);
  const acts = briefActions(s, nut);

  host.innerHTML =
    '<p class="brief-say"><b>' + esc(sentence.lead) + '.</b> <span>' + esc(sentence.rest) + '</span></p>' +
    (acts.length ? '<div class="brief-acts">' + acts.map((a, i) =>
      '<button type="button" class="brief-act' + (i === 0 ? ' primary' : '') + '" data-brief-act="' + a.act + '">' +
      '<span class="ms">' + a.icon + '</span>' + esc(a.label) + '</button>').join('') + '</div>' : '');

  bindBrief();
}

// #todayBrief survives every render — the chips inside it do not — so this is
// bound once on the host and delegates.
let briefBound = false;
function bindBrief() {
  const host = document.getElementById('todayBrief');
  if (!host || briefBound) return;
  briefBound = true;
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-brief-act]');
    if (!btn) return;
    const act = btn.dataset.briefAct;
    if (act === 'weigh') {
      if (typeof openWeightSheet === 'function') openWeightSheet();
      else if (typeof switchView === 'function') switchView('training');
      return;
    }
    if (typeof switchView === 'function') switchView(act);
  });
}
