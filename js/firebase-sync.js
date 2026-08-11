// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { render } from './app.js';
import { maybeStartOnboarding } from './onboarding.js';
import { OWNER_PROFILE, currentProfile, profileDataPath, profileExternalPath } from './profile.js';
import { applyFirebaseData, state } from './state.js';

// ========== Firebase Sync ==========
export const firebaseConfig = {
  apiKey: "AIzaSyBeoqmgxPOPxi--Jq5D4iQvHLhDZsUbKxQ",
  authDomain: "lifestack-d5300.firebaseapp.com",
  databaseURL: "https://lifestack-d5300-default-rtdb.firebaseio.com",
  projectId: "lifestack-d5300",
  storageBucket: "lifestack-d5300.firebasestorage.app",
  messagingSenderId: "126263493016",
  appId: "1:126263493016:web:e3afbc4136d45525d9abed"
};

// Initialize Firebase
export const firebaseApp = firebase.initializeApp(firebaseConfig);
export const db = firebase.database();

// Whose data this session reads and writes. Assigned in initFirebaseSync once
// a profile has been chosen (see js/profile.js) — it is deliberately not set at
// load time, so there is no ref to write through before we know who is using
// the app. The original single-user node 'lifestack' is never written again;
// it stays frozen as a pre-profiles backup.
export let DATA_REF = null;

// External data (written by iPhone Shortcuts / Apple Health exports) lives at
// a SEPARATE root node so the app's full-state writes can never clobber it.
// The app only ever reads it. See HEALTH-SYNC.md for the setup.
export let externalData = null;

export function getExternalMetric(node, dateStr) {
  const v = externalData && externalData[node] ? externalData[node][dateStr] : null;
  return v != null && Number(v) > 0 ? Number(v) : null;
}

export function getExternalSteps(dateStr) { return getExternalMetric('steps', dateStr); }
// Apple Watch metrics (synced by the same Shortcut — see HEALTH-SYNC.md).
// activeEnergy is whole-day active calories, so it already includes walking.
export function getExternalActiveEnergy(dateStr) { return getExternalMetric('activeEnergy', dateStr); }
export function getExternalExerciseMinutes(dateStr) { return getExternalMetric('exerciseMinutes', dateStr); }
export function getExternalRestingHR(dateStr) { return getExternalMetric('restingHR', dateStr); }
// Hours slept, keyed by the morning you woke up. Values over 24 are assumed
// to be minutes (Shortcut unit set to min instead of hr) and normalized.
// Daily distance totals from Apple Health, used only as a cross-check chip in
// the Cardio view — sessions are never created from these automatically, or a
// manually logged run and its watch recording would both count.
// Run/ride are miles; swim is yards.
export function getExternalRunDistance(dateStr) { return getExternalMetric('runDistance', dateStr); }
export function getExternalCycleDistance(dateStr) { return getExternalMetric('cycleDistance', dateStr); }
export function getExternalSwimDistance(dateStr) { return getExternalMetric('swimDistance', dateStr); }

// Individual Apple Watch workout sessions for a day, posted by the shortcut as
// external/.../workouts/<date> = [{ type, minutes, distance, cal }, ...].
// Firebase may hand back an array or a numeric-keyed object; normalize to array.
export function getExternalWorkouts(dateStr) {
  const w = externalData && externalData.workouts ? externalData.workouts[dateStr] : null;
  if (!w) return [];
  // Accept three shapes so the Shortcut can stay simple: a real array, a
  // numeric-keyed object (how Firebase sometimes returns arrays), or a SINGLE
  // workout object — the last one lets a shortcut post one workout without
  // building a Repeat loop, which covers most days.
  let arr;
  if (Array.isArray(w)) arr = w;
  else if (w.type || w.minutes || w.duration) arr = [w];
  else arr = Object.values(w);
  return arr.filter(x => x && typeof x === 'object' && (x.type || x.minutes || x.duration)).map(normalizeWorkout);
}

// Shortcuts reports a workout's duration in seconds; the UI wants minutes.
// Anything over 600 is far too long to be minutes, so treat it as seconds.
export function normalizeWorkout(w) {
  let minutes = Number(w.minutes || w.duration) || 0;
  if (minutes > 600) minutes = minutes / 60;
  return {
    type: w.type || 'Workout',
    minutes: Math.round(minutes),
    distance: Number(w.distance) || 0,
    cal: Number(w.cal || w.calories) || 0,
  };
}

// Sleep arrives in whichever unit the Shortcut summed it in. Apple's sleep
// samples are categories ("Asleep"), not numbers, so the Shortcut has to sum
// their DURATIONS — and Shortcuts reports durations in seconds by default.
// Accept all three plausible units rather than making people do math on-device:
// seconds (27000), minutes (450) or hours (7.5). Nobody sleeps 1000+ hours, and
// nobody sleeps under 25 seconds, so the thresholds are unambiguous.
export function getExternalSleep(dateStr) {
  const v = getExternalMetric('sleep', dateStr);
  if (v === null) return null;
  let hours;
  if (v > 1000) hours = v / 3600;      // seconds
  else if (v > 24) hours = v / 60;     // minutes
  else hours = v;                      // already hours
  return Math.round(hours * 10) / 10;
}

// ---- Shared community food bank ----
// A SEPARATE root node, like `external`: every profile reads it and every
// profile's saved foods publish to it, so one person's custom dishes become
// searchable for everyone. Keyed by a sanitized food name; the display name and
// macros live in the value. Never written through saveToFirebase (that only
// touches the per-profile node) — publishing is a targeted, additive write.
export let sharedFoods = {}; // { lowercaseName: { name, calories, protein, carbs, fat, fiber } }

// Firebase keys can't contain . $ # [ ] / — slug around them, keep it short.
export function foodBankKey(name) {
  return String(name).toLowerCase().trim()
    .replace(/[.$#\[\]\/]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export function normalizeFoodValue(e) {
  return {
    name: String(e.name).trim(),
    calories: Number(e.calories) || 0,
    protein: Number(e.protein) || 0,
    carbs: Number(e.carbs) || 0,
    fat: Number(e.fat) || 0,
    fiber: Number(e.fiber) || 0,
  };
}

export function loadSharedFoods() {
  try {
    db.ref('foodBank').once('value')
      .then(snap => {
        const v = snap.val();
        if (!v) return;
        const map = {};
        Object.keys(v).forEach(k => {
          const e = v[k];
          if (e && e.name && Number(e.calories) >= 0) map[String(e.name).toLowerCase()] = normalizeFoodValue(e);
        });
        sharedFoods = map;
        if (typeof render === 'function') render();
      })
      .catch(() => {}); // community foods are a bonus — never break the app
  } catch (e) { /* firebase unavailable — fine */ }
}

// Add/refresh a food in the shared bank. Fire-and-forget and additive: it never
// removes anything, so one person deleting their copy leaves everyone else's.
export function publishFoodToBank(name, data) {
  if (!name || !data) return;
  const key = foodBankKey(name);
  if (!key) return;
  const value = normalizeFoodValue({ name: name, calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat, fiber: data.fiber });
  try {
    db.ref('foodBank/' + key).set(value).catch(() => {});
    sharedFoods[String(name).toLowerCase()] = value; // reflect locally at once
  } catch (e) { /* offline — it'll re-publish next time it's saved */ }
}

export function loadExternalData() {
  try {
    // Reads only this profile's subtree, so the shape handed to
    // getExternalMetric is identical no matter whose it is.
    return db.ref(profileExternalPath()).once('value')
      .then(snap => {
        const v = snap.val();
        if (!v) return;
        externalData = v;
        if (typeof render === 'function') render();
      })
      .catch(() => {}); // steps are a bonus — never let them break the app
  } catch (e) { /* firebase unavailable — fine */ }
  return Promise.resolve();
}

// Everything that is fetched once rather than subscribed to. The app's own
// data arrives through a live DATA_REF listener, but Apple Health and the
// shared food bank are one-shot reads at startup — so after the 9pm health
// shortcut runs, an app left open all day still shows yesterday. This is what
// pull-to-refresh calls, and until now the only way to get it was a restart.
export function refreshFromCloud() {
  const jobs = [];
  try { jobs.push(Promise.resolve(loadExternalData())); } catch (e) { /* offline */ }
  try { jobs.push(Promise.resolve(loadSharedFoods())); } catch (e) { /* offline */ }
  if (DATA_REF) {
    try {
      jobs.push(DATA_REF.once('value').then(snap => {
        const v = snap.val();
        if (v && typeof applyFirebaseData === 'function') applyFirebaseData(v);
      }).catch(() => {}));
    } catch (e) { /* offline */ }
  }
  return Promise.all(jobs);
}

// Sync state
export let firebaseReady = false;
export let suppressFirebaseWrite = false; // prevent echo when receiving updates
// True once the initial cloud read has settled (success OR failure). Until then,
// saves must not advance the sync clock or push — otherwise automatic load-time
// saves (e.g. auto-banking foods) look "newer" than the cloud and trick the next
// load into overwriting good cloud data with stale local data.
export let appReconciled = false;

// Update the visible sync indicator in the header.
// state: 'connecting' | 'saving' | 'synced' | 'error'
export function setSyncStatus(state, message) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.classList.remove('is-synced', 'is-saving', 'is-error');
  const txt = el.querySelector('.sync-text');
  switch (state) {
    case 'saving':
      el.classList.add('is-saving');
      if (txt) txt.textContent = 'Saving…';
      el.title = 'Saving to cloud…';
      break;
    case 'synced':
      el.classList.add('is-synced');
      if (txt) txt.textContent = 'Synced';
      el.title = 'All changes saved to the cloud';
      break;
    case 'error':
      el.classList.add('is-error');
      if (txt) txt.textContent = 'Not saving';
      el.title = message || 'Cloud sync failed — your changes are only on this device. Use Backup to be safe.';
      break;
    default:
      if (txt) txt.textContent = 'Connecting…';
      el.title = 'Connecting to cloud…';
  }
}

// Save all state to Firebase
export function saveToFirebase(data) {
  if (suppressFirebaseWrite) return;
  if (!firebaseReady) return;
  if (!DATA_REF) return; // no profile chosen yet — nothing may reach the cloud
  setSyncStatus('saving');
  DATA_REF.set({
    tasks: data.tasks || [],
    categories: data.categories || [],
    projects: data.projects || [],
    gym: data.gym || [],
    cardio: data.cardio || [],
    modules: data.modules || {},
    diet: data.diet || [],
    customFoods: data.customFoods || {},
    water: data.water || {},
    events: data.events || [],
    removedFoods: data.removedFoods || [],
    weight: data.weight || {},
    goals: data.goals || {},
    sleep: data.sleep || {},
    aiUsage: data.aiUsage || {},
    lastUpdated: Date.now(),
  })
    .then(() => setSyncStatus('synced'))
    .catch(err => {
      console.warn('Firebase write failed:', err);
      setSyncStatus('error', 'Cloud sync failed: ' + (err && err.message ? err.message : 'unknown error') + '. Use Backup to save a copy.');
    });
}

// One-time move of the original single-user node into users/chinmay.
// Strictly additive: it writes only when users/chinmay does not exist yet, so
// running it again — on another device, or after a reload — can never overwrite
// newer data. 'lifestack' itself is left in place as a frozen backup of
// everything from before profiles existed.
export function migrateOwnerData() {
  return db.ref('users/' + OWNER_PROFILE.id).once('value')
    .then(snap => {
      if (snap.exists()) return false;
      return db.ref('lifestack').once('value').then(legacySnap => {
        const legacy = legacySnap.val();
        if (!legacy) return false;
        return db.ref('users/' + OWNER_PROFILE.id).set(legacy).then(() => {
          console.log('Migrated pre-profiles data from lifestack to users/' + OWNER_PROFILE.id);
          return true;
        });
      });
    });
}

// Load from Firebase once on startup, then listen for changes.
// Must run only after a profile is chosen — see requireProfile in js/profile.js.
export function initFirebaseSync(onDataReceived) {
  setSyncStatus('connecting');
  // Drives the top progress bar + any skeletons until the first read settles.
  document.body.classList.add('app-loading');
  DATA_REF = db.ref(profileDataPath());
  loadExternalData();
  loadSharedFoods();

  // The owner's data has to be in place before the first read, or an empty
  // node would look like "no cloud data" and get overwritten by local state.
  const migrated = (currentProfile() && currentProfile().legacy)
    ? migrateOwnerData().catch(err => { console.warn('Migration check failed:', err); return false; })
    : Promise.resolve(false);

  migrated.then(() => startFirebaseSync(onDataReceived));
}

export function startFirebaseSync(onDataReceived) {
  // First load
  DATA_REF.once('value')
    .then(snapshot => {
      firebaseReady = true;
      const data = snapshot.val();
      const localTimestamp = parseInt(localStorage.getItem('tf_last_updated') || '0');
      if (data && data.lastUpdated && data.lastUpdated > localTimestamp) {
        // Cloud is genuinely newer — adopt it (this is the path that pulls back
        // data another device saved while this one was closed).
        onDataReceived(data);
        console.log('Loaded data from Firebase (newer than local)');
      } else {
        // Local is genuinely newer, or the cloud is empty — push local up once.
        // We only reach "local newer" here because load-time saves no longer
        // bump the clock, so this comparison is now trustworthy.
        console.log(data && data.lastUpdated ? 'Local data is newer, pushing to Firebase' : 'No Firebase data found, uploading local data');
        appReconciled = true; // allow the push below to advance the clock
        saveToFirebase(state);
      }
      appReconciled = true;
      document.body.classList.remove('app-loading');
      setSyncStatus('synced');
      // Now that cloud state (if any) has loaded, decide whether a freshly
      // created profile still needs onboarding. Runs after sync so a returning
      // person whose cloud data carries _onboarded is never re-onboarded.
      if (typeof maybeStartOnboarding === 'function') maybeStartOnboarding();
    })
    .catch(err => {
      console.warn('Firebase initial load failed, using localStorage:', err);
      // Could not reach the cloud. Stay LOCAL-ONLY this session rather than risk
      // pushing a stale blob over newer cloud data when connectivity returns.
      // appReconciled=true still lets real edits advance the local clock, so they
      // are recognized as newer and preserved on the next successful load.
      firebaseReady = false;
      appReconciled = true;
      // A stuck progress bar is worse than none — clear it on failure too.
      document.body.classList.remove('app-loading');
      setSyncStatus('error', 'Could not reach the cloud: ' + (err && err.message ? err.message : 'unknown error') + '. Changes save on this device only — reopen when online to sync.');
      // Offline first-run still deserves onboarding — it saves locally and
      // syncs when the connection returns.
      if (typeof maybeStartOnboarding === 'function') maybeStartOnboarding();
    });

  // Listen for real-time changes from other devices
  DATA_REF.on('value', snapshot => {
    if (!firebaseReady) return;
    const data = snapshot.val();
    if (!data || !data.lastUpdated) return;

    const localTimestamp = parseInt(localStorage.getItem('tf_last_updated') || '0');
    // Only apply if the remote change is newer than our last save
    if (data.lastUpdated > localTimestamp + 1000) {
      suppressFirebaseWrite = true;
      onDataReceived(data);
      suppressFirebaseWrite = false;
      console.log('Received real-time update from Firebase');
    }
  });
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { db: db, firebaseApp: firebaseApp, firebaseConfig: firebaseConfig, foodBankKey: foodBankKey, getExternalActiveEnergy: getExternalActiveEnergy, getExternalCycleDistance: getExternalCycleDistance, getExternalExerciseMinutes: getExternalExerciseMinutes, getExternalMetric: getExternalMetric, getExternalRestingHR: getExternalRestingHR, getExternalRunDistance: getExternalRunDistance, getExternalSleep: getExternalSleep, getExternalSteps: getExternalSteps, getExternalSwimDistance: getExternalSwimDistance, getExternalWorkouts: getExternalWorkouts, initFirebaseSync: initFirebaseSync, loadExternalData: loadExternalData, loadSharedFoods: loadSharedFoods, migrateOwnerData: migrateOwnerData, normalizeFoodValue: normalizeFoodValue, normalizeWorkout: normalizeWorkout, publishFoodToBank: publishFoodToBank, refreshFromCloud: refreshFromCloud, saveToFirebase: saveToFirebase, setSyncStatus: setSyncStatus, startFirebaseSync: startFirebaseSync });
