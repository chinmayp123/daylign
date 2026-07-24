// ========== Data Layer ==========
// New installs and new profiles start EMPTY — no demo tasks or projects. The
// app used to seed sample tasks so a first-ever run looked alive, but for real
// accounts that just means someone's brand-new profile opens full of tasks that
// were never theirs. Only the default categories remain, because creating a
// task needs at least one category to file under.
const DEFAULT_CATEGORIES = [
  { id: 'work', name: 'Work', color: '#6366f1' },
  { id: 'personal', name: 'Personal', color: '#22c55e' },
  { id: 'health', name: 'Health', color: '#ef4444' },
  { id: 'learning', name: 'Learning', color: '#eab308' },
];

// Parse one localStorage key defensively. A single corrupt/truncated value
// (partial write, quota failure, aborted sync) must never crash the whole app
// and make it look like all data is gone — fall back to the default instead.
function safeParse(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Corrupt localStorage key "${key}" — keeping a copy and using the default.`, e);
    // Preserve the bad blob so it can be recovered/inspected instead of being
    // silently overwritten by the next save.
    try { localStorage.setItem(key + '_corrupt_backup', raw); } catch (_) {}
    return fallback;
  }
}

function loadData() {
  return {
    tasks: safeParse('tf_tasks', []),
    categories: safeParse('tf_categories', [...DEFAULT_CATEGORIES]),
    projects: safeParse('tf_projects', []),
    gym: safeParse('tf_gym', []),
    cardio: safeParse('tf_cardio', []),
    // Which optional modules this profile shows. Missing key = on, so existing
    // profiles and fresh installs get everything until they turn something off.
    modules: safeParse('tf_modules', {}),
    diet: safeParse('tf_diet', []),
    customFoods: safeParse('tf_custom_foods', {}),
    water: safeParse('tf_water', {}),
    events: safeParse('tf_events', []),
    removedFoods: safeParse('tf_removed_foods', []),
    weight: safeParse('tf_weight', {}),
    goals: safeParse('tf_goals', {}),
  };
}

function saveData(data) {
  localStorage.setItem('tf_tasks', JSON.stringify(data.tasks));
  localStorage.setItem('tf_categories', JSON.stringify(data.categories));
  localStorage.setItem('tf_gym', JSON.stringify(data.gym));
  localStorage.setItem('tf_cardio', JSON.stringify(data.cardio || []));
  localStorage.setItem('tf_modules', JSON.stringify(data.modules || {}));
  localStorage.setItem('tf_diet', JSON.stringify(data.diet));
  localStorage.setItem('tf_custom_foods', JSON.stringify(data.customFoods));
  localStorage.setItem('tf_water', JSON.stringify(data.water));
  localStorage.setItem('tf_projects', JSON.stringify(data.projects));
  localStorage.setItem('tf_events', JSON.stringify(data.events));
  localStorage.setItem('tf_removed_foods', JSON.stringify(data.removedFoods || []));
  localStorage.setItem('tf_weight', JSON.stringify(data.weight || {}));
  localStorage.setItem('tf_goals', JSON.stringify(data.goals || {}));

  // Only advance the sync clock and push to the cloud once the initial cloud
  // reconciliation has settled. Saves that fire during initial load (e.g.
  // auto-banking foods in renderDiet) must NOT look newer than the cloud, or the
  // next load would overwrite good cloud data with stale local data. If the sync
  // layer failed to load at all, fall back to the previous behavior.
  const reconciled = (typeof appReconciled === 'undefined') ? true : appReconciled;
  if (!reconciled) return;
  localStorage.setItem('tf_last_updated', Date.now().toString());
  if (typeof saveToFirebase === 'function') saveToFirebase(data);
}

function applyFirebaseData(data) {
  state.tasks = data.tasks || [];
  state.categories = data.categories || [];
  state.projects = data.projects || [];
  state.gym = data.gym || [];
  state.cardio = data.cardio || [];
  state.modules = data.modules || {};
  state.diet = data.diet || [];
  state.customFoods = data.customFoods || {};
  state.water = data.water || {};
  state.events = data.events || [];
  state.removedFoods = data.removedFoods || [];
  state.weight = data.weight || {};
  state.goals = data.goals || {};
  // Cache locally
  localStorage.setItem('tf_tasks', JSON.stringify(state.tasks));
  localStorage.setItem('tf_categories', JSON.stringify(state.categories));
  localStorage.setItem('tf_gym', JSON.stringify(state.gym));
  localStorage.setItem('tf_cardio', JSON.stringify(state.cardio));
  localStorage.setItem('tf_modules', JSON.stringify(state.modules || {}));
  localStorage.setItem('tf_diet', JSON.stringify(state.diet));
  localStorage.setItem('tf_custom_foods', JSON.stringify(state.customFoods));
  localStorage.setItem('tf_water', JSON.stringify(state.water));
  localStorage.setItem('tf_projects', JSON.stringify(state.projects));
  localStorage.setItem('tf_events', JSON.stringify(state.events));
  localStorage.setItem('tf_removed_foods', JSON.stringify(state.removedFoods));
  localStorage.setItem('tf_weight', JSON.stringify(state.weight));
  localStorage.setItem('tf_goals', JSON.stringify(state.goals));
  localStorage.setItem('tf_last_updated', (data.lastUpdated || Date.now()).toString());
  // Re-render the app after a tick to let DOM settle
  if (typeof render === 'function') {
    setTimeout(() => {
      try { populateCategoryDropdowns(); } catch(e) {}
      render();
    }, 50);
  }
}

// Optional modules the user can turn on/off in Settings. Tasks, Board,
// Calendar and Dashboard are core and always present.
// The keys stay 'gym'/'cardio' — they name stored data, not the UI. The labels
// follow the merged Training tab, where these are its two modes.
const TOGGLEABLE_MODULES = [
  { key: 'gym',    label: 'Strength', desc: 'Lifting, body weight, PRs — the Strength side of Training' },
  { key: 'cardio', label: 'Cardio',   desc: 'Running, cycling, swimming, race training' },
  { key: 'diet',   label: 'Diet',     desc: 'Food logging, macros, water' },
];

// Missing/true = enabled. Only an explicit false hides a module.
function moduleEnabled(key) {
  return !state.modules || state.modules[key] !== false;
}

// A clean slate for a brand-new person. The sample tasks and demo projects in
// loadData() exist so a first-ever install looks alive — but a new PROFILE is
// not a new install, and seeding it means their first sync pushes demo junk
// into their cloud node. New profiles get this instead: no tasks, no demo
// projects, everything empty. The default categories stay because task
// creation needs at least one category to file under.
function starterState() {
  return {
    tasks: [],
    categories: [...DEFAULT_CATEGORIES],
    projects: [],
    gym: [],
    cardio: [],
    modules: {},
    diet: [],
    customFoods: {},
    water: {},
    events: [],
    removedFoods: [],
    weight: {},
    goals: {},
  };
}

// Reset THIS device's cached data and the in-memory state to a clean slate.
// Used when creating a fresh profile (so its first push is clean) and by the
// Settings "start fresh" repair. Keeps the device-local API key and view.
function resetLocalStateToStarter() {
  Object.keys(localStorage)
    .filter(k => k.indexOf('tf_') === 0 && k !== 'tf_anthropic_key' && k !== 'tf_view')
    .forEach(k => localStorage.removeItem(k));
  const fresh = starterState();
  Object.keys(fresh).forEach(k => { state[k] = fresh[k]; });
  if (typeof render === 'function') { try { render(); } catch (e) {} }
}

// ========== State ==========
let state = loadData();
let currentView = localStorage.getItem('tf_view') || 'dashboard';
let calendarDate = new Date();
let miniCalDate = new Date();
let editingSubtasks = [];
let activeTaskTab = null;
let activeBoardFilter = null;
let boardFoldersCollapsed = {};
let scheduleDate = new Date();
let calViewMode = 'month';
let gymSets = [{ reps: '', weight: '' }];
let gymViewDate = getTodayStr();
let dietViewDate = getTodayStr();
let dietBaseMacros = null; // {calories, protein, carbs, fat} per 1 serving
let activeProject = null; // null = all, or a project id
