// ========== Global surfaces (spec 10.3, 10.7) ==========
// The + sheet, the install prompt and the offline notice: things that work
// from every screen. The weigh-in, goals and voice sheets live with the code
// that owns their data (weight-sheet.js, diet-goals.js, voice.js).

// ---------- + sheet ----------
// Each tile is one tap to the thing it names. Tiles for a module that is off
// are left out, and the usual cardio tile only appears once there is a usual.
function addSheetTiles() {
  const tiles = [
    { key: 'task', icon: 'check_circle', label: 'Task', c: 'meet' },
  ];
  if (moduleEnabled('diet')) {
    tiles.push({ key: 'food', icon: 'restaurant', label: 'Food', c: 'food' });
    tiles.push({ key: 'water', icon: 'water_drop', label: 'Water', c: 'water' });
  }
  tiles.push({ key: 'weigh', icon: 'monitor_weight', label: 'Weigh in', c: 'sleep' });
  if (moduleEnabled('gym')) tiles.push({ key: 'workout', icon: 'fitness_center', label: 'Workout', c: 'move' });
  const usual = (moduleEnabled('cardio') && typeof cardioUsual === 'function') ? cardioUsual() : null;
  if (usual && usual.duration) {
    const cfg = (typeof CARDIO_TYPES !== 'undefined' && CARDIO_TYPES[usual.type]) || { label: usual.type, ms: 'directions_run' };
    tiles.push({ key: 'usual', icon: cfg.ms || 'directions_run', label: 'Usual ' + String(cfg.label).toLowerCase(), c: 'move' });
  }
  tiles.push({ key: 'event', icon: 'event', label: 'Event', c: 'meet' });
  tiles.push({ key: 'say', icon: 'mic', label: 'Say it', c: 'habit' });
  return tiles;
}

const ADD_ACTIONS = {
  task: () => openTaskSheet(),
  food: () => {
    switchView('diet');
    if (typeof dietViewDate !== 'undefined' && dietViewDate !== getTodayStr()) { dietViewDate = getTodayStr(); render(); }
    const inp = document.getElementById('dietAddInput');
    if (inp) { inp.scrollIntoView({ block: 'center' }); inp.focus({ preventScroll: true }); }
  },
  water: () => {
    switchView('diet');
    if (typeof dietViewDate !== 'undefined' && dietViewDate !== getTodayStr()) { dietViewDate = getTodayStr(); render(); }
    const card = document.getElementById('waterTracker');
    if (card) {
      card.scrollIntoView({ block: 'center' });
      const b = card.querySelector('.water-btn');
      if (b) b.focus({ preventScroll: true });
    }
  },
  weigh: () => openWeightSheet(),
  workout: () => {
    switchView('training');
    if (typeof setTrainingTab === 'function') setTrainingTab('strength');
    if (typeof openGymLogSheet === 'function') openGymLogSheet();
  },
  usual: () => logUsualCardio(getTodayStr()),
  event: () => openEventModal(getTodayStr()),
  say: () => openVoicePanel(),
};

function openAddSheet() {
  const wrap = document.getElementById('addSheet');
  if (!wrap) return;
  document.getElementById('addGrid').innerHTML = addSheetTiles().map(t => `
    <button type="button" class="add-tile c-${t.c}" data-add="${t.key}">
      <span class="add-ic"><span class="ms" aria-hidden="true">${t.icon}</span></span>
      <span>${esc(t.label)}</span>
    </button>`).join('');
  openDlSheet(wrap);
  const first = wrap.querySelector('.add-tile');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
}

// The + in the bottom bar. On a screen with one obvious thing to add it does
// that straight away; everywhere else it offers the sheet.
function bottomAddAction() {
  if (typeof haptic === 'function') haptic('light');
  if (currentView === 'tasks') { openTaskSheet(); return; }
  if (currentView === 'diet') { ADD_ACTIONS.food(); return; }
  if (currentView === 'training') {
    const tab = (typeof trainingTab === 'function') ? trainingTab() : 'strength';
    if (tab === 'strength' && typeof openGymLogSheet === 'function') { openGymLogSheet(); return; }
    if (tab === 'cardio') { headerPrimaryAction(); return; }
  }
  openAddSheet();
}

// ---------- Install to home screen (new in v3) ----------
// Chrome and Edge offer an install prompt through beforeinstallprompt. Safari
// has no such event, so iPhones never see this; Share, Add to Home Screen is
// the only route there.
let installPromptEvent = null;

function installDismissed() {
  return typeof readPrefs === 'function' && !!readPrefs().installDismissed;
}

function rememberInstallDismissed() {
  if (typeof readPrefs !== 'function') return;
  const p = readPrefs();
  p.installDismissed = true;
  writePrefs(p);
}

function showInstallBanner() {
  if (!installPromptEvent || installDismissed() || document.getElementById('installBanner')) return;
  // The update banner matters more, and the two would stack in one corner.
  if (document.querySelector('.update-banner:not(#installBanner)')) return;
  const el = document.createElement('div');
  el.className = 'update-banner is-install';
  el.id = 'installBanner';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="ms" aria-hidden="true">install_mobile</span>
    <span class="update-banner-text">Add Daylign to your home screen</span>
    <button type="button" class="dl-btn primary" data-install-go>Add</button>
    <button type="button" class="update-banner-x" data-install-x aria-label="Not now"><span class="ms" aria-hidden="true">close</span></button>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target.closest('[data-install-x]')) { rememberInstallDismissed(); el.remove(); return; }
    if (!e.target.closest('[data-install-go]') || !installPromptEvent) return;
    const ev = installPromptEvent;
    installPromptEvent = null;
    el.remove();
    try {
      ev.prompt();
      // Declining the browser's own dialog is a clear enough "no".
      if (ev.userChoice) ev.userChoice.then(c => { if (c && c.outcome === 'dismissed') rememberInstallDismissed(); }).catch(() => {});
    } catch (err) { /* the prompt can only be used once; nothing to do */ }
  });
}

function hideInstallBanner() {
  const el = document.getElementById('installBanner');
  if (el) el.remove();
}

// ---------- Binding ----------
let globalBound = false;
function bindGlobal() {
  if (globalBound) return;
  globalBound = true;

  const add = document.getElementById('addSheet');
  if (add) add.addEventListener('click', e => {
    const tile = e.target.closest('[data-add]');
    if (!tile || !ADD_ACTIONS[tile.dataset.add]) return;
    closeDlSheet(add);
    ADD_ACTIONS[tile.dataset.add]();
  });
  const plus = document.getElementById('bottomNavAdd');
  if (plus) plus.addEventListener('click', bottomAddAction);

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();          // no mini-infobar; the banner asks instead
    installPromptEvent = e;
    showInstallBanner();
  });
  window.addEventListener('appinstalled', () => { rememberInstallDismissed(); hideInstallBanner(); });

  // Going offline is worth saying once, at the moment it happens: nothing is
  // lost, and the pill will say when it catches up.
  window.addEventListener('offline', () => {
    showToast('Offline. Saved on this device, it will sync later.', null, { kind: 'offline' });
  });
}
