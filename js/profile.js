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

const PROFILE_KEY = 'daylign_profile';

// The original user. `legacy: true` means two things: their app data is
// migrated out of the old `lifestack` node, and their Apple Health metrics
// stay at the un-namespaced `external/*` paths their iPhone Shortcut already
// posts to. Everyone else is namespaced from the start.
const OWNER_PROFILE = { id: 'chinmay', name: 'Chinmay', legacy: true };

let activeProfile = null;

function loadProfile() {
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

function currentProfile() { return activeProfile; }

function profileDataPath() {
  return 'users/' + (activeProfile ? activeProfile.id : 'unknown');
}

// Chinmay's Shortcut has posted to external/steps/<date> since before profiles
// existed. Keep that path working rather than making him re-edit five Shortcut
// URLs; everyone else lives under external/u/<id>, where a profile id can
// never collide with a metric name.
function profileExternalPath() {
  if (activeProfile && activeProfile.legacy) return 'external';
  return 'external/u/' + (activeProfile ? activeProfile.id : 'unknown');
}

// Firebase keys cannot contain . $ # [ ] / — the slug avoids all of them.
function slugifyProfileName(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function saveProfile(profile) {
  activeProfile = profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  // Registry of who exists, so a future "compare our week" view can find both
  // of us. Never read for auth — it is a convenience list, nothing more.
  if (typeof cloudSignedOut !== 'undefined' && cloudSignedOut) return;
  try { db.ref('profiles/' + profile.id).set(profile.name).catch(() => {}); } catch (e) { /* offline is fine */ }
}

// Gate startup on a profile being chosen. Firebase sync is not started until
// this resolves, and saveToFirebase() is a no-op while firebaseReady is false,
// so nothing can reach the cloud before we know whose data it is.
function requireProfile(onReady) {
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

function showProfileGate(onReady) {
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
  if (!(typeof cloudSignedOut !== 'undefined' && cloudSignedOut)) try {
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
function updateProfileSettingsCard() {
  const name = activeProfile ? activeProfile.name : '—';
  const letter = (activeProfile && activeProfile.name ? activeProfile.name : '?').charAt(0).toUpperCase();
  const el = document.getElementById('profileCurrentName');
  if (el) el.textContent = name;
  const mark = document.getElementById('profileCurrentAvatar');
  if (mark) mark.textContent = letter;
  const sideName = document.getElementById('sidebarProfileName');
  if (sideName) sideName.textContent = name;
  const avatar = document.getElementById('sidebarProfileAvatar');
  if (avatar) avatar.textContent = letter;
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

function relativeTime(ms) {
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

function summarizeUsage(id, data) {
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

function loadUsageReport() {
  const out = document.getElementById('usageReport');
  if (!out) return;
  // No SDK this session (offline first load, blocked CDN): there is nothing
  // to read from, and db.ref would throw.
  if (!db) { out.innerHTML = '<p class="set-sub">Not connected to the cloud this session, so there is nothing to read.</p>'; return; }
  out.innerHTML = '<div class="dl-skel" style="height:96px"></div>';
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
      out.innerHTML = '<p class="set-sub">Could not load usage: ' + esc(err && err.message ? err.message : 'unknown error') + '</p>';
    });
}

function renderUsageReport(all, names, out) {
  const ids = Object.keys(all);
  if (!ids.length) { out.innerHTML = '<p class="set-sub">No profiles have synced yet.</p>'; return; }
  out.innerHTML = ids.map(id => {
    const u = summarizeUsage(id, all[id] || {});
    const name = names[id] || id;
    const isMe = activeProfile && activeProfile.id === id;
    return `
      <div class="dl-card">
        <div class="dl-card-h">
          <span>${esc(name)}${isMe ? ' <span class="dl-chip c-move">you</span>' : ''}</span>
          <em>synced ${esc(relativeTime(u.lastUpdated))}</em>
        </div>
        <p class="set-usage-active"><b>${u.activeDays}</b> of the last 14 days active</p>
        <div class="dl-tiles">
          ${u.features.map(f => `
            <div class="dl-tile${f.count === 0 ? ' is-zero' : ''}">
              <b>${f.count}</b>
              <span>${f.label}${f.detail ? ' · ' + esc(f.detail) : ''}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// Wipe the CURRENTLY ACTIVE profile back to a clean slate — local and cloud.
// For repairing a profile that got seeded with the demo tasks (created before
// the clean-start fix), or for anyone who just wants to start over. Only ever
// touches the active profile's own node, and only on a typed confirmation.
function resetCurrentProfileData() {
  const who = activeProfile ? activeProfile.name : 'this profile';
  askConfirm({
    title: 'Start fresh?',
    body: `<p>This erases <b>all of ${esc(who)}’s data</b>: tasks, workouts, cardio, meals, weigh-ins and sleep, on every device.</p>
      <p>Nobody else’s profile is touched. It cannot be undone, so download a backup first if you are unsure.</p>`,
    word: 'ERASE',
    confirmLabel: 'Erase everything',
    danger: true,
    onConfirm: () => {
      resetLocalStateToStarter();
      saveData(state); // pushes the clean slate to this profile's cloud node
      if (typeof render === 'function') render();
      showToast(`${who} reset to a clean slate`);
    },
  });
}

// Switching wipes this device's cached tf_* data first. Without that, the
// previous person's tasks and meals are still in localStorage when the next
// person's node loads, and the newer-timestamp reconciliation could push one
// person's data into the other's node.
function switchProfile() {
  const who = activeProfile ? activeProfile.name : 'this profile';
  // Anything not yet in the cloud is only in the local copy this is about to
  // clear, so say so rather than promise it is safe.
  const sync = (typeof syncStatusInfo === 'function') ? syncStatusInfo().state : 'synced';
  askConfirm({
    title: 'Switch profile?',
    body: `<p>This device’s copy of ${esc(who)}’s data is cleared, then reloaded from the cloud for whoever you pick next.</p>
      ${sync === 'synced'
        ? `<p>${esc(who)}’s data stays in the cloud.</p>`
        : '<p class="cf-warn">This device is not synced right now. Changes that have not reached the cloud will be lost, so download a backup first.</p>'}`,
    confirmLabel: 'Switch',
    onConfirm: () => {
      Object.keys(localStorage)
        // The Anthropic API key belongs to the device, not the person — each
        // device pays for its own photo/voice calls. Keep it so it does not have
        // to be pasted in again.
        .filter(k => k.indexOf('tf_') === 0 && k !== 'tf_anthropic_key')
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem(PROFILE_KEY);
      location.reload();
    },
  });
}
