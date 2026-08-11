// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { render } from './app.js';
import { db } from './firebase-sync.js';
import { resetLocalStateToStarter, saveData, state } from './state.js';
import { esc, showToast, toLocalDateStr } from './utils.js';

// ========== Profiles ==========
// Daylign began as a single-person app: everything lived at the `lifestack`
// node with no notion of who owned it, and every save was a full-blob
// DATA_REF.set(). The moment a second person opened the app they would adopt
// the first person's data and then overwrite it. Profiles fix that by giving
// each person their own node at `users/<id>`, chosen once per device.
//
// This is separation, not security. The database still has no auth rules, so
// anyone with the URL can reach any node. It stops accidental clobbering
// between people who trust each other; it is not a permission system.

export const PROFILE_KEY = 'daylign_profile';

// The original user. `legacy: true` means two things: their app data is
// migrated out of the old `lifestack` node, and their Apple Health metrics
// stay at the un-namespaced `external/*` paths their iPhone Shortcut already
// posts to. Everyone else is namespaced from the start.
export const OWNER_PROFILE = { id: 'chinmay', name: 'Chinmay', legacy: true };

export let activeProfile = null;

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && p.id) return p;
  } catch (e) {
    console.warn('Corrupt profile in localStorage — asking again.', e);
  }
  return null;
}

export function currentProfile() { return activeProfile; }

export function profileDataPath() {
  return 'users/' + (activeProfile ? activeProfile.id : 'unknown');
}

// Chinmay's Shortcut has posted to external/steps/<date> since before profiles
// existed. Keep that path working rather than making him re-edit five Shortcut
// URLs; everyone else lives under external/u/<id>, where a profile id can
// never collide with a metric name.
export function profileExternalPath() {
  if (activeProfile && activeProfile.legacy) return 'external';
  return 'external/u/' + (activeProfile ? activeProfile.id : 'unknown');
}

// Firebase keys cannot contain . $ # [ ] / — the slug avoids all of them.
export function slugifyProfileName(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

export function saveProfile(profile) {
  activeProfile = profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  // Registry of who exists, so a future "compare our week" view can find both
  // of us. Never read for auth — it is a convenience list, nothing more.
  try { db.ref('profiles/' + profile.id).set(profile.name); } catch (e) { /* offline is fine */ }
}

// Gate startup on a profile being chosen. Firebase sync is not started until
// this resolves, and saveToFirebase() is a no-op while firebaseReady is false,
// so nothing can reach the cloud before we know whose data it is.
export function requireProfile(onReady) {
  const saved = loadProfile();
  if (saved) {
    activeProfile = saved;
    // Returning session (we remembered this profile and skip the gate). The
    // gate's choose() would normally refresh these, but here we bypass it, so
    // update the sidebar indicator and re-render for the greeting — otherwise
    // the app opens showing the default "?" avatar with no name.
    updateProfileSettingsCard();
    if (typeof render === 'function') render();
    onReady(saved);
    return;
  }
  showProfileGate(onReady);
}

export function showProfileGate(onReady) {
  const gate = document.getElementById('profileGate');
  if (!gate) { // markup missing — fall back to the owner rather than stranding the app
    activeProfile = OWNER_PROFILE;
    onReady(OWNER_PROFILE);
    return;
  }
  gate.hidden = false;
  document.body.classList.add('profile-gated');

  const err = document.getElementById('profileGateError');
  const nameInput = document.getElementById('profileNewName');
  const list = document.getElementById('profileList');

  // Every pick wipes this device's local seed (loadData()'s demo tasks) to a
  // clean slate before sync starts. For a new profile that means the empty
  // cloud node gets a clean push, not sample junk; for an existing profile
  // (owner or a returning person) the reset is immediately overwritten when
  // their newer cloud data loads. onboard is set only for a genuinely new name.
  function choose(profile, onboard) {
    // Save first so activeProfile is set before any render — the greeting and
    // sidebar indicator both read currentProfile(), and resetLocalStateToStarter
    // triggers a render.
    saveProfile(profile);
    updateProfileSettingsCard();
    if (onboard) window.__pendingOnboarding = true;
    if (typeof resetLocalStateToStarter === 'function') resetLocalStateToStarter();
    gate.hidden = true;
    document.body.classList.remove('profile-gated');
    onReady(profile);
  }

  // Render one tappable profile button.
  function addProfileButton(profile) {
    if (!list) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile-pick';
    btn.innerHTML = `<span class="profile-pick-avatar">${esc((profile.name || '?').charAt(0).toUpperCase())}</span>` +
      `<span class="profile-pick-name">${esc(profile.name)}</span>`;
    btn.addEventListener('click', () => choose(profile, false));
    list.appendChild(btn);
  }

  // The owner is always available even if the registry can't be read (offline).
  if (list) list.innerHTML = '';
  addProfileButton(OWNER_PROFILE);

  // Pull every other known profile from the registry so people can sign back in
  // with a tap instead of retyping their name. Best-effort — offline just shows
  // the owner plus the create box.
  const seen = { [OWNER_PROFILE.id]: true };
  try {
    db.ref('profiles').once('value').then(snap => {
      const reg = snap.val() || {};
      Object.keys(reg).forEach(id => {
        if (seen[id]) return;
        seen[id] = true;
        addProfileButton({ id: id, name: reg[id], legacy: false });
      });
    }).catch(() => {});
  } catch (e) { /* firebase unavailable — owner + create still work */ }

  const createBtn = document.getElementById('profileCreateBtn');
  function createFromInput() {
    const name = nameInput ? nameInput.value.trim() : '';
    const id = slugifyProfileName(name);
    if (!name || !id) {
      if (err) { err.textContent = 'Enter a name with at least one letter or number.'; err.hidden = false; }
      return;
    }
    // Typing an existing name signs into that account rather than creating a
    // duplicate (and does not re-run onboarding).
    if (id === OWNER_PROFILE.id) { choose(OWNER_PROFILE, false); return; }
    if (seen[id]) { choose({ id: id, name: name, legacy: false }, false); return; }
    choose({ id: id, name: name, legacy: false }, true);
  }
  if (createBtn) createBtn.addEventListener('click', createFromInput);
  if (nameInput) {
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createFromInput(); });
  }
}

// Reflect the active profile in Settings and the sidebar indicator.
export function updateProfileSettingsCard() {
  const name = activeProfile ? activeProfile.name : '—';
  const el = document.getElementById('profileCurrentName');
  if (el) el.textContent = name;
  const sideName = document.getElementById('sidebarProfileName');
  if (sideName) sideName.textContent = name;
  const avatar = document.getElementById('sidebarProfileAvatar');
  if (avatar) avatar.textContent = (activeProfile && activeProfile.name ? activeProfile.name : '?').charAt(0).toUpperCase();
}

// ---------- Usage report ----------
// Read-only view of how each profile is actually using the app. Deliberately
// NOT a stats comparison — it answers "is he logging meals, is he opening it"
// so the app can be improved, not "who is fitter".
//
// Nothing here touches `state` or calls saveData/saveToFirebase. It reads the
// users tree once, on demand, and renders. Loading someone else's data into
// the live app instead would be a write hazard: renderDiet() alone calls
// saveData() during a normal render.

export function relativeTime(ms) {
  if (!ms) return 'never';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
  const days = Math.round(hrs / 24);
  if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  return Math.round(days / 30) + ' month(s) ago';
}

export function summarizeUsage(id, data) {
  const tasks = data.tasks || [];
  const gym = data.gym || [];
  const cardio = data.cardio || [];
  const diet = data.diet || [];
  const weight = data.weight || {};
  const water = data.water || {};

  // "Active" means they logged something that day, in any module.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 13);
  const cutoffStr = toLocalDateStr(cutoff);
  const activeDays = new Set();
  const collect = (dates) => dates.forEach(d => { if (d && d >= cutoffStr) activeDays.add(d); });
  collect(diet.map(e => e.date));
  collect(gym.map(e => e.date));
  collect(cardio.map(e => e.date));
  collect(Object.keys(weight));
  collect(Object.keys(water));

  return {
    id: id,
    lastUpdated: data.lastUpdated || 0,
    activeDays: activeDays.size,
    features: [
      { label: 'Tasks', count: tasks.length, detail: tasks.filter(t => t.status === 'done').length + ' done' },
      { label: 'Meals', count: diet.length, detail: new Set(diet.map(e => e.date)).size + ' days' },
      { label: 'Workouts', count: gym.length, detail: new Set(gym.map(e => e.date)).size + ' days' },
      { label: 'Cardio', count: cardio.length, detail: new Set(cardio.map(e => e.date)).size + ' days' },
      { label: 'Weigh-ins', count: Object.keys(weight).length, detail: '' },
      { label: 'Water', count: Object.keys(water).length, detail: 'days' },
    ],
  };
}

export function loadUsageReport() {
  const out = document.getElementById('usageReport');
  if (!out) return;
  out.innerHTML = '<p class="settings-desc">Loading…</p>';
  db.ref('users').once('value')
    .then(snap => {
      const all = snap.val() || {};
      const names = {};
      return db.ref('profiles').once('value')
        .then(p => { Object.assign(names, p.val() || {}); })
        .catch(() => {})
        .then(() => renderUsageReport(all, names, out));
    })
    .catch(err => {
      out.innerHTML = '<p class="settings-desc">Could not load usage: ' + esc(err && err.message ? err.message : 'unknown error') + '</p>';
    });
}

export function renderUsageReport(all, names, out) {
  const ids = Object.keys(all);
  if (!ids.length) { out.innerHTML = '<p class="settings-desc">No profiles have synced yet.</p>'; return; }
  out.innerHTML = ids.map(id => {
    const u = summarizeUsage(id, all[id] || {});
    const name = names[id] || id;
    const isMe = activeProfile && activeProfile.id === id;
    return `
      <div class="usage-card">
        <div class="usage-head">
          <strong>${esc(name)}${isMe ? ' <span class="usage-you">you</span>' : ''}</strong>
          <span class="usage-last">Last synced ${esc(relativeTime(u.lastUpdated))}</span>
        </div>
        <div class="usage-active">${u.activeDays}<span>/14 days active</span></div>
        <div class="usage-grid">
          ${u.features.map(f => `
            <div class="usage-stat${f.count === 0 ? ' usage-stat-zero' : ''}">
              <span class="usage-stat-num">${f.count}</span>
              <span class="usage-stat-label">${f.label}</span>
              ${f.detail ? `<span class="usage-stat-detail">${esc(f.detail)}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// Wipe the CURRENTLY ACTIVE profile back to a clean slate — local and cloud.
// For repairing a profile that got seeded with the demo tasks (created before
// the clean-start fix), or for anyone who just wants to start over. Only ever
// touches the active profile's own node, and only on a typed confirmation.
export function resetCurrentProfileData() {
  const who = activeProfile ? activeProfile.name : 'this profile';
  const typed = prompt(
    `Erase ALL of ${who}'s data — tasks, workouts, cardio, meals, weigh-ins — ` +
    `on every device, and start from an empty app?\n\n` +
    `This does not touch anyone else's profile. It cannot be undone.\n\n` +
    `Type ERASE to confirm.`
  );
  if (typed !== 'ERASE') { showToast('Cancelled — nothing was erased'); return; }
  resetLocalStateToStarter();
  saveData(state); // pushes the clean slate to this profile's cloud node
  showToast(`${who} reset to a clean slate`);
}

// Switching wipes this device's cached tf_* data first. Without that, the
// previous person's tasks and meals are still in localStorage when the next
// person's node loads, and the newer-timestamp reconciliation could push one
// person's data into the other's node.
export function switchProfile() {
  const who = activeProfile ? activeProfile.name : 'this profile';
  const ok = confirm(
    `Switch away from ${who}?\n\n` +
    `This device's local copy will be cleared and reloaded from the cloud for whoever you pick next. ` +
    `${who}'s data stays safe in the cloud.\n\n` +
    `Download a backup first if you are unsure.`
  );
  if (!ok) return;
  Object.keys(localStorage)
    // The Anthropic API key belongs to the device, not the person — each
    // device pays for its own photo/voice calls. Keep it so it does not have
    // to be pasted in again.
    .filter(k => k.indexOf('tf_') === 0 && k !== 'tf_anthropic_key')
    .forEach(k => localStorage.removeItem(k));
  localStorage.removeItem(PROFILE_KEY);
  location.reload();
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { OWNER_PROFILE: OWNER_PROFILE, PROFILE_KEY: PROFILE_KEY, currentProfile: currentProfile, loadProfile: loadProfile, loadUsageReport: loadUsageReport, profileDataPath: profileDataPath, profileExternalPath: profileExternalPath, relativeTime: relativeTime, renderUsageReport: renderUsageReport, requireProfile: requireProfile, resetCurrentProfileData: resetCurrentProfileData, saveProfile: saveProfile, showProfileGate: showProfileGate, slugifyProfileName: slugifyProfileName, summarizeUsage: summarizeUsage, switchProfile: switchProfile, updateProfileSettingsCard: updateProfileSettingsCard });
