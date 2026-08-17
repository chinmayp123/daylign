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

// ========== Global error surfacing ==========
// On an installed iPhone PWA there is no console to open, so an uncaught throw
// in any of the app's ~230 listeners was completely invisible — the UI would
// just stop responding with no explanation. Surface it instead, and keep the
// last few for Settings diagnostics.
const recentErrors = [];
function recordError(kind, detail) {
  const entry = { kind, detail: String(detail || '').slice(0, 300), at: new Date().toISOString() };
  recentErrors.push(entry);
  if (recentErrors.length > 10) recentErrors.shift();
  console.warn('[daylign]', kind, detail);
  if (typeof showToast === 'function') showToast('Something went wrong — that action may not have saved');
  // Keep the panel live if it happens to be open, so an error that fires while
  // you are looking at Settings appears without a reload.
  if (typeof renderDiagnostics === 'function') { try { renderDiagnostics(); } catch (e) {} }
}
window.addEventListener('error', (e) => recordError('error', (e && e.message) || 'unknown'));
window.addEventListener('unhandledrejection', (e) => {
  const r = e && e.reason;
  recordError('promise', (r && (r.message || r)) || 'unknown');
});

// ========== Keyboard access for click-handled elements ==========
// Much of the UI is rendered as <div>s carrying click handlers (task rows,
// board cards, health tiles, meal entries...), which makes those actions
// mouse/touch-only. Rewriting ~25 render sites into <button>s would mean
// re-doing their CSS and risking layout regressions across every view, so
// instead this promotes them centrally after each render: they become
// focusable, announce as buttons, and respond to Enter/Space.
const KEYBOARD_CLICKABLE = [
  '.task-row', '.task-check', '.board-card', '.board-folder-header',
  '.archived-toggle', '.health-tile', '.my-task-card', '.my-task-check',
  '.schedule-event', '.diet-food-entry-main', '.recent-meal-header',
  '.diet-custom-item', '.diet-history-day', '.str-mv', '.today-sched-row',
  '.today-sched-check', '.project-item', '.category-item', '.cal-day',
].join(', ');

function enhanceKeyboardAccess() {
  document.querySelectorAll(KEYBOARD_CLICKABLE).forEach(el => {
    const tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  });
}

// Enter/Space activate them, matching native button behaviour.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const t = e.target;
  if (!t || !t.closest) return;
  const tag = t.tagName;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const el = t.closest(KEYBOARD_CLICKABLE);
  if (!el) return;
  e.preventDefault();
  el.click();
});

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
// onTap makes the toast the undo affordance. Added for combos, where one tap
// writes five rows and "that wasn't what I meant" needs to be cheap — but any
// caller can use it. Without a handler the toast behaves exactly as before.
function showToast(message, onTap) {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    // Confirmations are the app's main feedback channel — announce them.
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'toast' + (typeof onTap === 'function' ? ' toast-action' : '');
  toast.textContent = message;
  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  };
  if (typeof onTap === 'function') {
    toast.setAttribute('role', 'button');
    toast.tabIndex = 0;
    const fire = (e) => { e.preventDefault(); dismiss(); try { onTap(); } catch (err) { console.warn(err); } };
    toast.addEventListener('click', fire);
    toast.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  }
  host.appendChild(toast);
  // An undoable toast lingers: 2.6s is not long enough to notice five new rows,
  // realise they are wrong, and reach the toast.
  setTimeout(dismiss, typeof onTap === 'function' ? 6000 : 2600);
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

// ========== Haptics ==========
// navigator.vibrate is unsupported in every browser on iOS — Apple requires
// WebKit, so Chrome and Firefox there fail identically. That kills the obvious
// implementation on the one platform this app actually runs on.
//
// The fallback exploits the fact that Apple's own switch control (iOS 17.4+,
// <input type="checkbox" switch>) produces haptic feedback natively. Clicking
// a hidden one borrows that. It is undocumented and depends on behaviour Apple
// never promised, so it is written to fail silently and nothing is built on
// the assumption that it works — if it does nothing, the app is merely as
// quiet as it was before.
let hapticSwitch = null;
let hapticsProbed = false;

function hapticsEnabled() {
  try { return typeof readPrefs !== 'function' || readPrefs().haptics !== false; }
  catch (e) { return true; }
}

function ensureHapticSwitch() {
  if (hapticsProbed) return hapticSwitch;
  hapticsProbed = true;
  try {
    // Only worth building on WebKit/iOS, where vibrate() is missing.
    if (typeof navigator.vibrate === 'function') return null;
    const input = document.createElement('input');
    input.type = 'checkbox';
    // Unknown attributes are ignored elsewhere, so this is inert off-iOS.
    input.setAttribute('switch', '');
    input.id = 'hapticProxy';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    // Off-screen rather than display:none — a hidden control cannot be
    // clicked, and clicking is the whole mechanism.
    input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    const label = document.createElement('label');
    label.setAttribute('for', 'hapticProxy');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = input.style.cssText;
    document.body.appendChild(input);
    document.body.appendChild(label);
    hapticSwitch = label;
  } catch (e) {
    hapticSwitch = null;
  }
  return hapticSwitch;
}

// Call from inside a user gesture. Patterns follow the usual convention:
// 'light' for a confirmation, 'success' for something completed, 'warn' for a
// rejected action.
const HAPTIC_PATTERNS = { light: 10, success: [12, 40, 18], warn: [26, 60, 26] };

function haptic(kind) {
  if (!hapticsEnabled()) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(HAPTIC_PATTERNS[kind] || HAPTIC_PATTERNS.light);
      return;
    }
    const proxy = ensureHapticSwitch();
    if (proxy) proxy.click(); // iOS only ever gives one flavour of tick
  } catch (e) { /* haptics are a nicety — never let them surface */ }
}

// ---- Recent errors panel (Settings > Your data) ----
// recordError has been filling recentErrors since it was written, for a panel
// that was never built. So the app would tell you "Something went wrong — that
// action may not have saved" and then discard the single fact that explained
// it. On an installed PWA there is no console to open, which made an
// intermittent failure genuinely undiagnosable.
function renderDiagnostics() {
  const host = document.getElementById('diagList');
  if (!host) return;
  if (!recentErrors.length) {
    host.innerHTML = '<p class="diag-empty">No errors recorded this session.</p>';
    return;
  }
  // Newest first — the one you just hit is the one you came here to read.
  host.innerHTML = recentErrors.slice().reverse().map(e => {
    const t = new Date(e.at);
    const when = isNaN(t) ? e.at : t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return `<div class="diag-row">
      <div class="diag-row-head"><span class="diag-kind">${esc(e.kind)}</span><span class="diag-when">${esc(when)}</span></div>
      <div class="diag-detail">${esc(e.detail)}</div>
    </div>`;
  }).join('');
}

function diagnosticsText() {
  if (!recentErrors.length) return 'No errors recorded.';
  return recentErrors.map(e => `[${e.at}] ${e.kind}: ${e.detail}`).join('\n');
}

function bindDiagnostics() {
  const copy = document.getElementById('diagCopyBtn');
  const clear = document.getElementById('diagClearBtn');
  if (copy) copy.addEventListener('click', () => {
    const txt = diagnosticsText();
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
  });
  if (clear) clear.addEventListener('click', () => {
    recentErrors.length = 0;
    renderDiagnostics();
  });
}
