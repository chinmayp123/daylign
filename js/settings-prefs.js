// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { esc, showToast } from './utils.js';

// ========== Device preferences ==========
// Appearance accent, dashboard card visibility, workout defaults and
// accessibility options. Stored device-local in one localStorage blob, the
// same pattern the theme already uses (daylign_theme) — these describe how
// THIS device should look and behave, so syncing them across devices would be
// wrong, and it keeps them out of the 15-key cloud persistence path entirely.

export const PREFS_KEY = 'daylign_prefs';

export const ACCENTS = [
  { key: 'indigo', label: 'Indigo', hex: '#6d6af8', hover: '#8b8afc' },
  { key: 'violet', label: 'Violet', hex: '#a78bfa', hover: '#c4b5fd' },
  { key: 'blue',   label: 'Blue',   hex: '#5aa5f9', hover: '#84c0fb' },
  { key: 'green',  label: 'Green',  hex: '#34d399', hover: '#6ee7b7' },
  { key: 'amber',  label: 'Amber',  hex: '#fbbf24', hover: '#fcd34d' },
  { key: 'rose',   label: 'Rose',   hex: '#f26d6d', hover: '#f79b9b' },
];

// Dashboard cards the user can hide. Each maps to a real element, so a toggle
// can never point at something that no longer exists without showing up here.
export const DASH_WIDGETS = [
  { key: 'brief',     label: 'Daily brief',     sel: '#dailyBrief' },
  { key: 'hero',      label: 'Today hero',      sel: '#todayHero' },
  { key: 'plan',      label: 'Today plan',      sel: '#todayPlan' },
  { key: 'stats',     label: 'Task stats',      sel: '#dashboardView .stats-grid' },
  { key: 'health',    label: 'Health strip',    sel: '#healthGrid' },
  { key: 'cardio',    label: 'Daily ride',      sel: '#todayCardio' },
  { key: 'reminders', label: 'Reminders',       sel: '#remindersBar' },
  { key: 'mytasks',   label: 'My tasks',        sel: '#dashboardView .my-tasks-board-card' },
  { key: 'deadlines', label: 'Deadlines',       sel: '#dashboardView .deadlines-card' },
  { key: 'sleep',     label: 'Sleep',           sel: '#sleepCard' },
  { key: 'readiness', label: 'Readiness',       sel: '#readinessCard' },
  { key: 'weight',    label: 'Weight trend',    sel: '#dashboardView .weight-trend-card' },
  { key: 'weekly',    label: 'Weekly report',   sel: '#dashboardView .weekly-report-card' },
  { key: 'schedule',  label: 'Schedule',        sel: '#scheduleCard' },
];

export const PREF_DEFAULTS = {
  accent: 'indigo',
  hidden: [],          // dashboard widget keys to hide
  restSeconds: 60,     // default rest timer
  defaultSets: 1,      // set rows the gym form opens with
  reduceMotion: false, // force-off animation regardless of OS setting
  largeText: false,
  alwaysShowActions: false, // reveal hover-only delete buttons permanently
  haptics: true,       // tactile feedback where the platform allows it
};

export function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return Object.assign({}, PREF_DEFAULTS);
    return Object.assign({}, PREF_DEFAULTS, JSON.parse(raw) || {});
  } catch (e) {
    return Object.assign({}, PREF_DEFAULTS);
  }
}

export function writePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }
  catch (e) { if (typeof showToast === 'function') showToast('Could not save preferences on this device'); }
}

export function setPref(key, value) {
  const p = readPrefs();
  p[key] = value;
  writePrefs(p);
  applyPrefs();
  renderSettingsPrefsPanel();
}

// Everything is applied by writing CSS variables / classes on the root, so a
// change takes effect without re-rendering any view.
export function applyPrefs() {
  const p = readPrefs();
  const root = document.documentElement;

  const accent = ACCENTS.find(a => a.key === p.accent) || ACCENTS[0];
  root.style.setProperty('--accent', accent.hex);
  root.style.setProperty('--accent-hover', accent.hover);
  root.style.setProperty('--accent-glow', hexToGlow(accent.hex));

  root.classList.toggle('pref-reduce-motion', !!p.reduceMotion);
  root.classList.toggle('pref-large-text', !!p.largeText);
  root.classList.toggle('pref-show-actions', !!p.alwaysShowActions);

  // Hidden dashboard widgets, driven by one style tag rather than inline
  // styles so re-renders can't wipe it.
  let tag = document.getElementById('prefHiddenStyle');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'prefHiddenStyle';
    document.head.appendChild(tag);
  }
  const sels = (p.hidden || [])
    .map(k => (DASH_WIDGETS.find(w => w.key === k) || {}).sel)
    .filter(Boolean);
  tag.textContent = sels.length ? sels.join(', ') + ' { display: none !important; }' : '';

  // The first rest button becomes the preferred duration, so the setting is
  // actually reachable from the place you use it rather than being inert.
  const restBtn = document.querySelector('.gym-rest-btn');
  if (restBtn) {
    restBtn.dataset.rest = String(p.restSeconds);
    restBtn.textContent = 'Rest ' + p.restSeconds + 's';
  }
}

export function hexToGlow(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', 0.16)';
}

// ---------- UI ----------
export function renderSettingsPrefsPanel() {
  const p = readPrefs();

  const accentHost = document.getElementById('accentPicker');
  if (accentHost) {
    accentHost.innerHTML = ACCENTS.map(a =>
      '<button type="button" class="accent-dot' + (a.key === p.accent ? ' active' : '') + '"' +
      ' data-accent="' + a.key + '" title="' + a.label + '" aria-label="' + a.label + ' accent"' +
      ' style="background:' + a.hex + '"></button>'
    ).join('');
  }

  const widgetHost = document.getElementById('widgetToggles');
  if (widgetHost) {
    widgetHost.innerHTML = DASH_WIDGETS.map(w => {
      const on = (p.hidden || []).indexOf(w.key) === -1;
      return '<label class="pref-toggle"><input type="checkbox" data-widget="' + w.key + '"' +
        (on ? ' checked' : '') + '><span>' + esc(w.label) + '</span></label>';
    }).join('');
  }

  const rest = document.getElementById('prefRestSeconds');
  if (rest) rest.value = p.restSeconds;
  const sets = document.getElementById('prefDefaultSets');
  if (sets) sets.value = p.defaultSets;

  [['prefReduceMotion', 'reduceMotion'], ['prefLargeText', 'largeText'], ['prefShowActions', 'alwaysShowActions'], ['prefHaptics', 'haptics']]
    .forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (el) el.checked = !!p[pair[1]];
    });
}

export function bindSettingsPrefs() {
  const accentHost = document.getElementById('accentPicker');
  if (accentHost) accentHost.addEventListener('click', (e) => {
    const b = e.target.closest('[data-accent]');
    if (b) setPref('accent', b.dataset.accent);
  });

  const widgetHost = document.getElementById('widgetToggles');
  if (widgetHost) widgetHost.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-widget]');
    if (!cb) return;
    const p = readPrefs();
    const hidden = new Set(p.hidden || []);
    if (cb.checked) hidden.delete(cb.dataset.widget); else hidden.add(cb.dataset.widget);
    setPref('hidden', Array.from(hidden));
  });

  const rest = document.getElementById('prefRestSeconds');
  if (rest) rest.addEventListener('change', () => {
    const v = Math.max(10, Math.min(600, Number(rest.value) || 60));
    setPref('restSeconds', v);
  });
  const sets = document.getElementById('prefDefaultSets');
  if (sets) sets.addEventListener('change', () => {
    const v = Math.max(1, Math.min(10, Number(sets.value) || 1));
    setPref('defaultSets', v);
  });

  [['prefReduceMotion', 'reduceMotion'], ['prefLargeText', 'largeText'], ['prefShowActions', 'alwaysShowActions'], ['prefHaptics', 'haptics']]
    .forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (el) el.addEventListener('change', () => setPref(pair[1], el.checked));
    });

  renderSettingsPrefsPanel();
}

// Applied as early as possible so the accent doesn't flash on load.
applyPrefs();


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { ACCENTS: ACCENTS, DASH_WIDGETS: DASH_WIDGETS, PREFS_KEY: PREFS_KEY, PREF_DEFAULTS: PREF_DEFAULTS, applyPrefs: applyPrefs, bindSettingsPrefs: bindSettingsPrefs, hexToGlow: hexToGlow, readPrefs: readPrefs, renderSettingsPrefsPanel: renderSettingsPrefsPanel, setPref: setPref, writePrefs: writePrefs });
