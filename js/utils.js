// ========== DOM Helpers ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========== Utility Functions ==========
function toLocalDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getTodayStr() {
  return toLocalDateStr(new Date());
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ========== Empty states ==========
// A blank panel that just says "No tasks" is a dead end. These give the same
// information with a glyph, a reason, and (where one exists) the action that
// fills the space — so an empty screen reads as "here's what to do next"
// rather than "something is missing".
const EMPTY_ICONS = {
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  food: '<path d="M3 2v7a3 3 0 003 3 3 3 0 003-3V2M6 2v6M18 2c-1.7 1.3-2.5 3.2-2.5 5.5 0 1.9.8 3.1 2.5 3.5v11"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  check: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>',
};

// opts: { icon, title, hint, actionLabel, action }
function emptyState(opts) {
  const o = opts || {};
  const glyph = EMPTY_ICONS[o.icon] || EMPTY_ICONS.tasks;
  return `
    <div class="empty-state${o.compact ? ' is-compact' : ''}">
      <svg class="empty-state-icon" width="26" height="26" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
      <p class="empty-state-title">${esc(o.title || '')}</p>
      ${o.hint ? `<p class="empty-state-hint">${esc(o.hint)}</p>` : ''}
      ${o.actionLabel && o.action ? `<button type="button" class="empty-state-action" data-empty-action="${esc(o.action)}">${esc(o.actionLabel)}</button>` : ''}
    </div>`;
}

// One delegated handler for every empty-state call to action.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-empty-action]');
  if (!btn) return;
  const action = btn.dataset.emptyAction;
  if (action === 'new-task' && typeof openModal === 'function') openModal();
  if (action === 'log-exercise') {
    const el = document.getElementById('gymExerciseName');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
  }
  if (action === 'log-food') {
    const el = document.querySelector('.diet-meal-add');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.click(); }
  }
});

// Sum calories/protein/carbs/fat across a list of food-log entries. Missing
// macros count as 0. Returns a fresh totals object. Used everywhere the diet
// view tallies a day, a meal, or a history row.
function sumMacros(entries) {
  return (entries || []).reduce((acc, e) => {
    acc.calories += (e.calories || 0);
    acc.protein += (e.protein || 0);
    acc.carbs += (e.carbs || 0);
    acc.fat += (e.fat || 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// Animate a numeric element from its current value to a target (count-up/down)
function animateNumber(el, target) {
  if (!el) return;
  target = Math.round(Number(target) || 0);
  const from = parseInt(el.textContent, 10) || 0;
  if (from === target) { el.textContent = target; return; }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target;
    return;
  }
  const duration = 500;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Lightweight toast notification (bottom-right, auto-dismisses)
function showToast(message) {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// ========== US Holidays ==========
function getUSHolidays(year) {
  const holidays = [];
  holidays.push({ date: `${year}-01-01`, name: "New Year's Day" });
  holidays.push({ date: `${year}-06-19`, name: 'Juneteenth' });
  holidays.push({ date: `${year}-07-04`, name: 'Independence Day' });
  holidays.push({ date: `${year}-11-11`, name: "Veterans Day" });
  holidays.push({ date: `${year}-12-25`, name: 'Christmas Day' });
  holidays.push({ date: getNthWeekday(year, 0, 1, 3), name: 'MLK Day' });
  holidays.push({ date: getNthWeekday(year, 1, 1, 3), name: "Presidents' Day" });
  holidays.push({ date: getLastWeekday(year, 4, 1), name: 'Memorial Day' });
  holidays.push({ date: getNthWeekday(year, 8, 1, 1), name: 'Labor Day' });
  holidays.push({ date: getNthWeekday(year, 9, 1, 2), name: 'Columbus Day' });
  holidays.push({ date: getNthWeekday(year, 10, 4, 4), name: 'Thanksgiving' });
  return holidays;
}

function getNthWeekday(year, month, weekday, n) {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month, d);
    if (date.getMonth() !== month) break;
    if (date.getDay() === weekday) {
      count++;
      if (count === n) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  return null;
}

function getLastWeekday(year, month, weekday) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = daysInMonth; d >= 1; d--) {
    const date = new Date(year, month, d);
    if (date.getDay() === weekday) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}
