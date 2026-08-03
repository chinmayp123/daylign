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
