// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { COACH_STALE_DAYS, coachDecision, coachSnapshot } from './coach.js';
import { getGoals } from './diet-goals.js';
import { offsetDateStr } from './gym.js';
import { state } from './state.js';
import { esc, getTodayStr, sumMacros } from './utils.js';

// ========== Daily brief ==========
// The morning read on the whole day, not just training. It shares
// coachSnapshot/coachDecision with the Training coach on purpose — two engines
// would eventually contradict each other ("rest today" on one screen, "push
// hard" on another). This surface adds the domains the fitness coach doesn't
// cover: nutrition pacing, tasks, and week-over-week movement.
//
// Not built, deliberately: habit reminders (the app has no habits feature) and
// calendar analysis (the calendar has zero events). Inventing either would mean
// showing advice about data that does not exist.

export function briefNutrition() {
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

export function briefTasks() {
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
export function briefWeek() {
  const today = getTodayStr();
  const thisStart = offsetDateStr(today, -6);
  const lastStart = offsetDateStr(today, -13);
  const lastEnd = offsetDateStr(today, -7);

  const between = (from, to) => (d) => !!d && d >= from && d <= to;
  const inThis = between(thisStart, today);
  const inLast = between(lastStart, lastEnd);

  const sessionDays = (pred) => new Set(
    (state.gym || []).filter(e => e && pred(e.date)).map(e => e.date)
      .concat((state.cardio || []).filter(c => c && pred(c.date)).map(c => c.date))
  ).size;

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

// The single most important thing today, ordered by what costs the most if
// ignored: recovery, then commitments already made, then consistency.
export function briefFocus(s, nut, tasks) {
  const r = s.readiness;
  const staleDays = (typeof COACH_STALE_DAYS !== 'undefined') ? COACH_STALE_DAYS : 4;

  if (r && r.score < 45) {
    return { text: "Recovery is today's job. Sleep is the lever — everything else can wait a day.", tone: 'bad' };
  }
  if (tasks.overdue > 0) {
    return { text: "Clear what's overdue. " + tasks.overdue + ' task' + (tasks.overdue === 1 ? '' : 's') +
      ' past due outranks starting anything new.', tone: 'warn' };
  }
  if (!s.trainedToday && s.daysSinceLast !== null && s.daysSinceLast >= staleDays) {
    return { text: 'Get a session in. ' + s.daysSinceLast +
      " days off — the workout doesn't have to be good, it has to happen.", tone: 'warn' };
  }
  if (nut.chronicLow) {
    return { text: "Lead every meal with protein. You're averaging " + nut.avgProtein +
      'g against a ' + nut.proteinGoal + 'g target.', tone: 'warn' };
  }
  if (!s.trainedToday && s.stalled.length && r && r.score >= 60) {
    const m = s.stalled[0];
    const bump = m.bodyweight ? m.typical + 2 : m.typical + 5;
    return { text: 'Break the plateau. ' + m.name + ' has sat at ' + m.typical +
      ' for weeks — go for ' + bump + ' today.', tone: 'good' };
  }
  if (s.trainedToday) {
    return { text: "Training's done. Protect it with food and sleep — that's where the adaptation happens.", tone: 'good' };
  }
  return { text: 'Keep the streak honest. One session, one good meal, one task closed.', tone: 'good' };
}

export function renderDailyBrief() {
  const host = document.getElementById('dailyBrief');
  if (!host) return;
  if (typeof coachSnapshot !== 'function') { host.innerHTML = ''; return; }

  const s = coachSnapshot();
  const nut = briefNutrition();
  const tasks = briefTasks();
  const week = briefWeek();
  const focus = briefFocus(s, nut, tasks);
  const decision = coachDecision(s);
  const r = s.readiness;

  const hour = new Date().getHours();
  const part = hour < 12 ? 'This morning' : hour < 18 ? 'This afternoon' : 'Tonight';

  const delta = (now, prev, unit) => {
    if (now === null || prev === null || prev === undefined) return '';
    const d = now - prev;
    if (!d) return '<span class="brief-flat">same as last week</span>';
    const up = d > 0;
    return '<span class="brief-delta ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' +
      Math.abs(Math.round(d)) + (unit || '') + ' vs last week</span>';
  };

  host.innerHTML =
    '<div class="card brief-card brief-' + focus.tone + '">' +
      '<div class="brief-head">' +
        '<span class="brief-eyebrow">' + part + ' · your brief</span>' +
        (r ? '<span class="brief-ready" title="Recovery score">' + r.score + '<small> ready</small></span>' : '') +
      '</div>' +
      '<div class="brief-focus">' + esc(focus.text) + '</div>' +
      '<div class="brief-rows">' +
        '<div class="brief-row"><span class="brief-label">Training</span>' +
          '<span class="brief-value"><strong>' + esc(decision.verdict) + '</strong> — ' + esc(decision.line) + '</span></div>' +
        '<div class="brief-row"><span class="brief-label">Nutrition</span>' +
          '<span class="brief-value">' + esc(nut.text) + '</span></div>' +
        '<div class="brief-row"><span class="brief-label">Tasks</span>' +
          '<span class="brief-value">' + tasks.text + '</span></div>' +
      '</div>' +
      '<div class="brief-week">' +
        '<div class="brief-week-title">This week</div>' +
        '<div class="brief-week-grid">' +
          '<div class="brief-stat"><div class="brief-stat-v tnum">' + week.sessions + '</div>' +
            '<div class="brief-stat-l">sessions</div>' + delta(week.sessions, week.sessionsPrev) + '</div>' +
          '<div class="brief-stat"><div class="brief-stat-v tnum">' + (week.protein === null ? '—' : week.protein + 'g') + '</div>' +
            '<div class="brief-stat-l">avg protein</div>' + delta(week.protein, week.proteinPrev, 'g') + '</div>' +
          '<div class="brief-stat"><div class="brief-stat-v tnum">' + week.tasks + '</div>' +
            '<div class="brief-stat-l">tasks done</div>' + delta(week.tasks, week.tasksPrev) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { briefFocus: briefFocus, briefNutrition: briefNutrition, briefTasks: briefTasks, briefWeek: briefWeek, renderDailyBrief: renderDailyBrief });
