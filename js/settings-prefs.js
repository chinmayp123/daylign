// ========== Device preferences ==========
// Appearance accent, dashboard card visibility, workout defaults and
// accessibility options. Stored device-local in one localStorage blob, the
// same pattern the theme already uses (daylign_theme) — these describe how
// THIS device should look and behave, so syncing them across devices would be
// wrong, and it keeps them out of the 15-key cloud persistence path entirely.

const PREFS_KEY = 'daylign_prefs';

// One hue per accent, in a Day (light) and a Night (dark) shade. Text on the
// accent is --accent-ink: white on every Day shade, near-black on every Night
// shade, and each pair clears 4.5:1 against its ink. Hover and glow are derived
// in style.css, so an accent is just these two colours.
const ACCENTS = [
  { key: 'cobalt', label: 'Cobalt', day: '#2446f0', night: '#6c86ff' },
  { key: 'green',  label: 'Green',  day: '#15803d', night: '#3ddc7a' },
  { key: 'rose',   label: 'Rose',   day: '#be185d', night: '#ff6b9d' },
  { key: 'orange', label: 'Orange', day: '#c2410c', night: '#fb923c' },
  { key: 'teal',   label: 'Teal',   day: '#0f766e', night: '#2dd4bf' },
  { key: 'indigo', label: 'Indigo', day: '#4f46e5', night: '#8b8afc' },
];

// v2 accent keys that no longer exist. 'indigo' was the v2 default, so a
// device that never touched the picker has it stored — it becomes cobalt, the
// v3 default. The rest map to their nearest surviving hue.
const ACCENT_RENAMES = { indigo: 'cobalt', violet: 'indigo', blue: 'cobalt', amber: 'orange' };

// Dashboard cards the user can hide. Each maps to a real element, so a toggle
// can never point at something that no longer exists without showing up here.
// Sleep, readiness, weight trend and the weekly report left this list when they
// moved off Today — two of their selectors were #dashboardView-scoped and would
// have quietly stopped matching anything.
const DASH_WIDGETS = [
  { key: 'brief',     label: 'Daily brief',     sel: '#dailyBrief' },
  { key: 'plan',      label: 'Today plan',      sel: '#todayPlan' },
  { key: 'health',    label: 'Health strip',    sel: '#healthGrid' },
  { key: 'cardio',    label: 'Daily ride',      sel: '#todayCardio' },
  { key: 'reminders', label: 'Reminders',       sel: '#remindersBar' },
  { key: 'mytasks',   label: 'My tasks',        sel: '#dashboardView .my-tasks-board-card' },
  { key: 'deadlines', label: 'Deadlines',       sel: '#dashboardView .deadlines-card' },
  { key: 'schedule',  label: 'Schedule',        sel: '#scheduleCard' },
];

const PREF_DEFAULTS = {
  accent: 'cobalt',
  hidden: [],          // dashboard widget keys to hide
  restSeconds: 60,     // default rest timer
  defaultSets: 3,      // set rows the gym form opens with — most lifts are 3
  reduceMotion: false, // force-off animation regardless of OS setting
  largeText: false,
  alwaysShowActions: false, // reveal hover-only delete buttons permanently
  haptics: true,       // tactile feedback where the platform allows it
  accentV3: true,      // accent key is already a v3 key (see migrateAccentPref)
};

function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return Object.assign({}, PREF_DEFAULTS);
    return Object.assign({}, PREF_DEFAULTS, JSON.parse(raw) || {});
  } catch (e) {
    return Object.assign({}, PREF_DEFAULTS);
  }
}

// Runs once per device, at load, before the first applyPrefs(). Keyed on the
// STORED blob lacking accentV3, so a v3 'indigo' picked later is never
// mistaken for the v2 one; a device with no prefs yet already has v3 defaults.
function migrateAccentPref() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) || {};
    if (stored.accentV3) return;
    if (ACCENT_RENAMES[stored.accent]) stored.accent = ACCENT_RENAMES[stored.accent];
    stored.accentV3 = true;
    writePrefs(stored);
  } catch (e) { /* unreadable prefs: readPrefs() already falls back to defaults */ }
}

function writePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }
  catch (e) { if (typeof showToast === 'function') showToast('Could not save preferences on this device'); }
}

function setPref(key, value) {
  const p = readPrefs();
  p[key] = value;
  writePrefs(p);
  applyPrefs();
  renderSettingsPrefsPanel();
}

// Everything is applied by writing CSS variables / classes on the root, so a
// change takes effect without re-rendering any view.
function applyPrefs() {
  const p = readPrefs();
  const root = document.documentElement;

  const accent = ACCENTS.find(a => a.key === p.accent) || ACCENTS[0];
  // style.css picks the Day or Night shade for the current theme, so a theme
  // switch needs no call back into here.
  root.style.setProperty('--accent-day', accent.day);
  root.style.setProperty('--accent-night', accent.night);

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

// ---------- UI ----------
function renderSettingsPrefsPanel() {
  const p = readPrefs();

  const accentHost = document.getElementById('accentPicker');
  if (accentHost) {
    accentHost.innerHTML = ACCENTS.map(a =>
      '<button type="button" class="accent-dot' + (a.key === p.accent ? ' active' : '') + '"' +
      ' data-accent="' + a.key + '" title="' + a.label + '" aria-label="' + a.label + ' accent"' +
      ' style="--sw-day:' + a.day + ';--sw-night:' + a.night + '"></button>'
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

function bindSettingsPrefs() {
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
migrateAccentPref();
applyPrefs();
