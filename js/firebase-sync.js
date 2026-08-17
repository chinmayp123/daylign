// ========== Firebase Sync ==========
const firebaseConfig = {
  apiKey: "AIzaSyBeoqmgxPOPxi--Jq5D4iQvHLhDZsUbKxQ",
  authDomain: "lifestack-d5300.firebaseapp.com",
  databaseURL: "https://lifestack-d5300-default-rtdb.firebaseio.com",
  projectId: "lifestack-d5300",
  storageBucket: "lifestack-d5300.firebasestorage.app",
  messagingSenderId: "126263493016",
  appId: "1:126263493016:web:e3afbc4136d45525d9abed"
};

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Whose data this session reads and writes. Assigned in initFirebaseSync once
// a profile has been chosen (see js/profile.js) — it is deliberately not set at
// load time, so there is no ref to write through before we know who is using
// the app. The original single-user node 'lifestack' is never written again;
// it stays frozen as a pre-profiles backup.
let DATA_REF = null;

// External data (written by iPhone Shortcuts / Apple Health exports) lives at
// a SEPARATE root node so the app's full-state writes can never clobber it.
// The app only ever reads it. See HEALTH-SYNC.md for the setup.
let externalData = null;

function getExternalMetric(node, dateStr) {
  const v = externalData && externalData[node] ? externalData[node][dateStr] : null;
  return v != null && Number(v) > 0 ? Number(v) : null;
}

function getExternalSteps(dateStr) { return getExternalMetric('steps', dateStr); }
// Apple Watch metrics (synced by the same Shortcut — see HEALTH-SYNC.md).
// activeEnergy is whole-day active calories, so it already includes walking.
function getExternalActiveEnergy(dateStr) { return getExternalMetric('activeEnergy', dateStr); }
function getExternalExerciseMinutes(dateStr) { return getExternalMetric('exerciseMinutes', dateStr); }
function getExternalRestingHR(dateStr) { return getExternalMetric('restingHR', dateStr); }
// Hours slept, keyed by the morning you woke up. Values over 24 are assumed
// to be minutes (Shortcut unit set to min instead of hr) and normalized.
// Daily distance totals from Apple Health, used only as a cross-check chip in
// the Cardio view — sessions are never created from these automatically, or a
// manually logged run and its watch recording would both count.
// Run/ride are miles; swim is yards.
function getExternalRunDistance(dateStr) { return getExternalMetric('runDistance', dateStr); }
function getExternalCycleDistance(dateStr) { return getExternalMetric('cycleDistance', dateStr); }
function getExternalSwimDistance(dateStr) { return getExternalMetric('swimDistance', dateStr); }

// Individual Apple Watch workout sessions for a day, posted by the shortcut as
// external/.../workouts/<date> = [{ type, minutes, distance, cal }, ...].
// Firebase may hand back an array or a numeric-keyed object; normalize to array.
function getExternalWorkouts(dateStr) {
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
function normalizeWorkout(w) {
  let minutes = Number(w.minutes || w.duration) || 0;
  if (minutes > 600) minutes = minutes / 60;
  return {
    type: w.type || 'Workout',
    minutes: Math.round(minutes),
    distance: Number(w.distance) || 0,
    cal: Number(w.cal || w.calories) || 0,
  };
}

// Calendar events for a day, posted by the iPhone Shortcut as
// external/.../calendar/<date> = [{ title, start, end, location }, ...].
// start/end are "HH:mm" — Shortcuts formats a date to that with one action,
// and it avoids every timezone question an ISO string would raise.
//
// Same three shapes as workouts, for the same reason: a real array, a
// numeric-keyed object (how Firebase hands arrays back), or a single bare
// object so a Shortcut with one event needs no Repeat loop.
function getExternalCalendar(dateStr) {
  const cal = externalData && externalData.calendar ? externalData.calendar : null;
  if (!cal) return [];

  // Two accepted layouts, because Shortcuts is the constrained end of this.
  //   calendar/<date>  = [ {...}, ... ]                  grouped per day
  //   calendar/all     = [ { date, ... }, ... ]          one flat week
  // The flat form exists because building nested per-date JSON on-device means
  // fighting Set Dictionary Value with a computed key; a flat list is one
  // Repeat and one PUT. Grouping is trivial here and miserable there.
  let source = cal[dateStr];
  if (!source && cal.all) {
    const flat = Array.isArray(cal.all) ? cal.all : Object.values(cal.all);
    source = flat.filter(e => e && String(e.date || '').trim() === dateStr);
  }
  if (!source) return [];

  let arr;
  if (Array.isArray(source)) arr = source;
  else if (source.title || source.start) arr = [source];
  else arr = Object.values(source);
  return arr
    .filter(e => e && typeof e === 'object' && e.title)
    .map(e => {
      const start = String(e.start || '').trim();
      const m = start.match(/(\d{1,2}):(\d{2})/);
      return {
        title: String(e.title).trim(),
        start: start,
        end: String(e.end || '').trim(),
        location: String(e.location || '').trim(),
        // -1 means all-day (or unparseable), which the schedule pins to its own
        // row rather than guessing an hour.
        hour: m ? Math.max(0, Math.min(23, parseInt(m[1], 10))) : -1,
      };
    })
    .sort((a, b) => a.hour - b.hour || a.start.localeCompare(b.start));
}

// Sleep arrives in whichever unit the Shortcut summed it in. Apple's sleep
// samples are categories ("Asleep"), not numbers, so the Shortcut has to sum
// their DURATIONS — and Shortcuts reports durations in seconds by default.
// Accept all three plausible units rather than making people do math on-device:
// seconds (27000), minutes (450) or hours (7.5). Nobody sleeps 1000+ hours, and
// nobody sleeps under 25 seconds, so the thresholds are unambiguous.
function getExternalSleep(dateStr) {
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
let sharedFoods = {}; // { lowercaseName: { name, calories, protein, carbs, fat, fiber } }

// Firebase keys can't contain . $ # [ ] / — slug around them, keep it short.
function foodBankKey(name) {
  return String(name).toLowerCase().trim()
    .replace(/[.$#\[\]\/]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function normalizeFoodValue(e) {
  return {
    name: String(e.name).trim(),
    calories: Number(e.calories) || 0,
    protein: Number(e.protein) || 0,
    carbs: Number(e.carbs) || 0,
    fat: Number(e.fat) || 0,
    fiber: Number(e.fiber) || 0,
  };
}

function loadSharedFoods() {
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
function publishFoodToBank(name, data) {
  if (!name || !data) return;
  const key = foodBankKey(name);
  if (!key) return;
  const value = normalizeFoodValue({ name: name, calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat, fiber: data.fiber });
  try {
    db.ref('foodBank/' + key).set(value).catch(() => {});
    sharedFoods[String(name).toLowerCase()] = value; // reflect locally at once
  } catch (e) { /* offline — it'll re-publish next time it's saved */ }
}

function loadExternalData() {
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
function refreshFromCloud() {
  const jobs = [];
  try { jobs.push(Promise.resolve(loadExternalData())); } catch (e) { /* offline */ }
  try { jobs.push(Promise.resolve(loadSharedFoods())); } catch (e) { /* offline */ }
  if (DATA_REF) {
    try {
      jobs.push(DATA_REF.once('value').then(snap => {
        const v = snap.val();
        // Same guard as the live listener. Pull-to-refresh must never be a way
        // to overwrite work that has not reached the cloud yet.
        if (v && shouldApplyCloudData(v) && typeof applyFirebaseData === 'function') {
          suppressFirebaseWrite = true;
          seedSyncBaseline(v);
          applyFirebaseData(v);
          suppressFirebaseWrite = false;
        }
      }).catch(() => {}));
    } catch (e) { /* offline */ }
  }
  return Promise.all(jobs);
}

// ---- Deciding whether cloud data may replace local state ----
// applyFirebaseData REPLACES all fifteen keys, so getting this wrong loses
// whatever you just typed. There were two paths into it and only one checked
// anything: the live listener compared timestamps, pull-to-refresh did not.
//
// That cost a real lunch. The entries were added locally, the write stalled on
// a weak connection, and pulling to refresh — the obvious thing to do when the
// indicator is stuck on "Saving…" — pulled down the pre-lunch copy and wiped
// them. They reappeared minutes later only because the stalled write carried
// its original payload and eventually landed.
//
// Both paths now go through shouldApplyCloudData, so they cannot drift again.
let pendingWrites = 0;      // writes started but not yet settled
let lastWriteStamp = 0;     // lastUpdated of the newest write we have sent

function shouldApplyCloudData(data) {
  if (!data || !data.lastUpdated) return false;
  // A write of ours is still in flight. Anything the cloud can return right now
  // was written before it, so applying it would undo changes already on screen.
  if (pendingWrites > 0 && data.lastUpdated <= lastWriteStamp) return false;
  const localTimestamp = parseInt(localStorage.getItem('tf_last_updated') || '0', 10) || 0;
  // The 1s margin absorbs clock skew between this device and the write it just
  // made; without it a device can keep re-applying its own echo.
  return data.lastUpdated > localTimestamp + 1000;
}

// Sync state
let firebaseReady = false;
let suppressFirebaseWrite = false; // prevent echo when receiving updates
// True once the initial cloud read has settled (success OR failure). Until then,
// saves must not advance the sync clock or push — otherwise automatic load-time
// saves (e.g. auto-banking foods) look "newer" than the cloud and trick the next
// load into overwriting good cloud data with stale local data.
let appReconciled = false;

// Update the visible sync indicator in the header.
// state: 'connecting' | 'saving' | 'synced' | 'error'
// The last failure reason, and whether we are currently in one. Kept in a
// variable rather than only on the element's title, because a title attribute
// is unreachable on a touch device — the phone showed "Not saving" in red with
// no way whatsoever to find out why or to do anything about it.
let lastSyncError = null;
let syncRetryTimer = null;

function setSyncStatus(state, message) {
  const el = document.getElementById('syncStatus');
  lastSyncError = state === 'error' ? (message || 'Cloud sync failed.') : null;
  if (state === 'error') scheduleSyncRetry(); else cancelSyncRetry();
  const detail = document.getElementById('syncDetail');
  if (detail && state !== 'error') detail.hidden = true;
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
// Keys written to the cloud, with the empty value each falls back to. One
// list so a new key cannot be added to the payload and forgotten by the
// change tracker.
const SYNC_KEYS = {
  tasks: [], categories: [], projects: [], gym: [], cardio: [], modules: {},
  diet: [], customFoods: {}, water: {}, events: [], removedFoods: {},
  weight: {}, goals: {}, sleep: {}, aiUsage: {}, combos: [],
};

// What we last successfully sent, serialized per key. Anything unchanged is
// left out of the next write.
let lastSentByKey = null;

// After a cloud load the remote copy IS what is up there, so seed the tracker
// rather than treating every key as dirty and re-uploading 68 KB for nothing.
function seedSyncBaseline(data) {
  lastSentByKey = {};
  Object.keys(SYNC_KEYS).forEach(k => {
    try { lastSentByKey[k] = JSON.stringify(data && data[k] !== undefined ? data[k] : SYNC_KEYS[k]); }
    catch (e) { lastSentByKey[k] = null; }
  });
}

function saveToFirebase(data) {
  if (suppressFirebaseWrite) return;
  if (!firebaseReady) return;
  if (!DATA_REF) return; // no profile chosen yet — nothing may reach the cloud

  // Every save used to PUT the whole document: 68 KB, of which 44 KB was 376
  // diet entries, just to add one food. On a weak connection that is ten-plus
  // seconds of "Saving…" for a single tap, and it grows with every day logged.
  // Send only the keys that actually changed.
  const payload = {};
  const changed = [];
  const serialized = {};
  Object.keys(SYNC_KEYS).forEach(k => {
    const v = data[k] !== undefined && data[k] !== null ? data[k] : SYNC_KEYS[k];
    let ser;
    try { ser = JSON.stringify(v); } catch (e) { ser = null; }
    serialized[k] = ser;
    if (!lastSentByKey || ser === null || lastSentByKey[k] !== ser) {
      payload[k] = v;
      changed.push(k);
    }
  });

  // Nothing but the clock moved — writing would only cost bandwidth and make
  // every other device re-render for no reason.
  if (!changed.length) { setSyncStatus('synced'); return; }

  // Stamp once and reuse: the payload's lastUpdated and the value we guard
  // incoming snapshots against must be the same number.
  const stamp = Date.now();
  payload.lastUpdated = stamp;
  pendingWrites++;
  if (stamp > lastWriteStamp) lastWriteStamp = stamp;

  // On a weak connection Firebase's promise can sit unresolved indefinitely, so
  // the indicator reads "Saving…" forever and looks like the app has hung. Say
  // plainly that it is stalled instead. The write is NOT cancelled — Firebase
  // keeps retrying and will flip this to Synced if it lands.
  const stallTimer = setTimeout(() => {
    setSyncStatus('error', 'Still trying to reach the cloud — your data is saved on this device and will sync when the connection recovers.');
  }, 12000);

  setSyncStatus('saving');
  // update() rather than set(): set() would delete any key left out of the
  // payload, which is now most of them.
  DATA_REF.update(payload)
    .then(() => {
      clearTimeout(stallTimer);
      pendingWrites--;
      // Only now is this what the cloud holds. Updating the baseline earlier
      // would mean a failed write silently never retried.
      if (!lastSentByKey) lastSentByKey = {};
      changed.forEach(k => { lastSentByKey[k] = serialized[k]; });
      setSyncStatus('synced');
    })
    .catch(err => {
      clearTimeout(stallTimer);
      pendingWrites--;
      console.warn('Firebase write failed:', err);
      setSyncStatus('error', 'Cloud sync failed: ' + (err && err.message ? err.message : 'unknown error') + '. Use Backup to save a copy.');
    });
}

// One-time move of the original single-user node into users/chinmay.
// Strictly additive: it writes only when users/chinmay does not exist yet, so
// running it again — on another device, or after a reload — can never overwrite
// newer data. 'lifestack' itself is left in place as a frozen backup of
// everything from before profiles existed.
function migrateOwnerData() {
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
function initFirebaseSync(onDataReceived) {
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

function startFirebaseSync(onDataReceived) {
  // First load
  DATA_REF.once('value')
    .then(snapshot => {
      firebaseReady = true;
      const data = snapshot.val();
      const localTimestamp = parseInt(localStorage.getItem('tf_last_updated') || '0');
      if (data && data.lastUpdated && data.lastUpdated > localTimestamp) {
        // Cloud is genuinely newer — adopt it (this is the path that pulls back
        // data another device saved while this one was closed).
        seedSyncBaseline(data);
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

    if (shouldApplyCloudData(data)) {
      suppressFirebaseWrite = true;
      seedSyncBaseline(data);
      onDataReceived(data);
      suppressFirebaseWrite = false;
      console.log('Received real-time update from Firebase');
    }
  });
}


// ---- Recovering from a failed save ----
// A rejected write used to sit there permanently: lastSentByKey is deliberately
// not advanced on failure, so the data WOULD go up on the next save — but only
// if you happened to edit something else. Log a meal on a dead connection and
// the app would show "Not saving" until you touched it again, which is exactly
// when you would put the phone down.
const SYNC_RETRY_MS = 30000;

function scheduleSyncRetry() {
  if (syncRetryTimer) return;
  syncRetryTimer = setInterval(() => {
    if (!lastSyncError) { cancelSyncRetry(); return; }
    if (!navigator.onLine) return;   // nothing to gain until the radio is back
    retrySync();
  }, SYNC_RETRY_MS);
}

function cancelSyncRetry() {
  if (!syncRetryTimer) return;
  clearInterval(syncRetryTimer);
  syncRetryTimer = null;
}

// Re-push. saveToFirebase diffs against lastSentByKey, which a failed write
// never updated, so the same keys are still marked dirty and go again.
function retrySync() {
  if (typeof saveToFirebase !== 'function' || typeof state === 'undefined') return;
  setSyncStatus('saving');
  try { saveToFirebase(state); }
  catch (e) { setSyncStatus('error', 'Retry failed: ' + (e && e.message ? e.message : 'unknown error')); }
}

function bindSyncStatusUI() {
  const btn = document.getElementById('syncStatus');
  const detail = document.getElementById('syncDetail');
  const msg = document.getElementById('syncDetailMsg');
  const retry = document.getElementById('syncRetryBtn');
  const close = document.getElementById('syncDetailClose');

  if (btn && detail && msg) {
    btn.addEventListener('click', () => {
      msg.textContent = lastSyncError
        ? lastSyncError
        : 'Everything on this device is saved to the cloud.';
      detail.hidden = !detail.hidden;
    });
  }
  if (close && detail) close.addEventListener('click', () => { detail.hidden = true; });
  if (retry) retry.addEventListener('click', () => {
    if (detail) detail.hidden = true;
    retrySync();
  });

  // Coming back online is the single best moment to try again.
  window.addEventListener('online', () => { if (lastSyncError) retrySync(); });
}