// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  // Offline support: network-first SW, so code is always fresh when online
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  setHeaderDate();
  bindEvents();
  if (currentView !== 'dashboard') {
    switchView(currentView);
  } else {
    render();
  }

  // Scroll to top on load
  window.scrollTo(0, 0);

  // Ask who is using the app before touching the cloud. Until a profile is
  // picked there is no DATA_REF, so no one can read or overwrite anyone else's
  // node. Once picked, the initial reconciliation inside initFirebaseSync
  // decides whether to pull cloud data or push local up — we no longer blindly
  // push local state after a timeout, which could clobber newer cloud data
  // before it had a chance to load.
  updateProfileSettingsCard();
  requireProfile(() => initFirebaseSync(applyFirebaseData));
});

function setHeaderDate() {
  const d = new Date();
  $('#headerDate').textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ========== Events ==========
function bindEvents() {
  // Mobile sidebar toggle
  const sidebar = document.querySelector('.sidebar');
  const overlay = $('#sidebarOverlay');
  const menuBtn = $('#mobileMenuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Navigation
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      // Close mobile sidebar after navigation
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    });
  });

  // Header primary-action button — context-aware (see switchView for labels)
  $('#addTaskBtn').addEventListener('click', headerPrimaryAction);
  $('#modalClose').addEventListener('click', closeModal);
  $('#cancelBtn').addEventListener('click', closeModal);
  $('#taskModal').addEventListener('click', (e) => {
    if (e.target === $('#taskModal')) closeModal();
  });

  // Form
  $('#taskForm').addEventListener('submit', handleSaveTask);
  $('#deleteBtn').addEventListener('click', handleDeleteTask);

  // Category → show/hide project dropdown
  $('#taskCategory').addEventListener('change', toggleProjectRow);

  // Subtasks
  $('#addSubtaskBtn').addEventListener('click', addSubtask);
  $('#subtaskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
  });

  // Filters
  $('#filterStatus').addEventListener('change', renderTasksView);
  $('#filterCategory').addEventListener('change', renderTasksView);
  $('#sortBy').addEventListener('change', renderTasksView);

  // Search
  $('#searchInput').addEventListener('input', renderTasksView);

  // Calendar nav
  $('#calPrev').addEventListener('click', () => {
    if (calViewMode === 'month') {
      calendarDate.setMonth(calendarDate.getMonth() - 1);
    } else {
      calendarDate.setDate(calendarDate.getDate() - 7);
    }
    renderCalendar();
  });
  $('#calNext').addEventListener('click', () => {
    if (calViewMode === 'month') {
      calendarDate.setMonth(calendarDate.getMonth() + 1);
    } else {
      calendarDate.setDate(calendarDate.getDate() + 7);
    }
    renderCalendar();
  });

  // Calendar view toggle
  $('#calMonthBtn').addEventListener('click', () => {
    calViewMode = 'month';
    $('#calMonthBtn').classList.add('active');
    $('#calWeekBtn').classList.remove('active');
    renderCalendar();
  });
  $('#calWeekBtn').addEventListener('click', () => {
    calViewMode = 'week';
    $('#calWeekBtn').classList.add('active');
    $('#calMonthBtn').classList.remove('active');
    renderCalendar();
  });

  // Mini calendar nav (if present)
  if ($('#miniCalPrev')) {
    $('#miniCalPrev').addEventListener('click', () => { miniCalDate.setMonth(miniCalDate.getMonth() - 1); renderMiniCalendar(); });
    $('#miniCalNext').addEventListener('click', () => { miniCalDate.setMonth(miniCalDate.getMonth() + 1); renderMiniCalendar(); });
  }

  // Schedule day nav
  $('#schedulePrev').addEventListener('click', () => {
    scheduleDate.setDate(scheduleDate.getDate() - 1);
    renderSchedule();
  });
  $('#scheduleNext').addEventListener('click', () => {
    scheduleDate.setDate(scheduleDate.getDate() + 1);
    renderSchedule();
  });
  $('#scheduleToday').addEventListener('click', () => {
    scheduleDate = new Date();
    renderSchedule();
  });

  // Gym & Diet
  bindGymEvents();
  if (typeof bindCardioEvents === 'function') bindCardioEvents();
  if (typeof bindTrainingEvents === 'function') bindTrainingEvents();
  if (typeof bindSleepEvents === 'function') bindSleepEvents();
  if (typeof bindPreferencesEvents === 'function') bindPreferencesEvents();
  bindDietEvents();
  bindGoalsEvents();
  if (typeof bindLogFoodSheet === 'function') bindLogFoodSheet();
  if (typeof bindPhotoEvents === 'function') bindPhotoEvents();
  if (typeof bindVoiceEvents === 'function') bindVoiceEvents();

  // Add category / project
  $('#addCategoryBtn').addEventListener('click', handleAddCategory);
  $('#addProjectBtn').addEventListener('click', handleAddProject);

  // Profile
  const switchProfileBtn = $('#switchProfileBtn');
  if (switchProfileBtn) switchProfileBtn.addEventListener('click', switchProfile);
  const sidebarProfile = $('#sidebarProfile');
  if (sidebarProfile) sidebarProfile.addEventListener('click', () => switchView('settings'));
  // Quick access to the category/project manager from the sidebar (task views).
  $$('[data-manage-taxonomy]').forEach(btn => btn.addEventListener('click', openTaxonomyModal));
  const taxClose = $('#taxonomyModalClose');
  if (taxClose) taxClose.addEventListener('click', closeTaxonomyModal);
  const taxModal = $('#taxonomyModal');
  if (taxModal) taxModal.addEventListener('click', e => { if (e.target === taxModal) closeTaxonomyModal(); });
  const editGoalsSettingsBtn = $('#editGoalsSettingsBtn');
  if (editGoalsSettingsBtn && typeof openGoalsModal === 'function') editGoalsSettingsBtn.addEventListener('click', openGoalsModal);

  renderModuleToggles();
  const usageBtn = $('#usageLoadBtn');
  if (usageBtn) usageBtn.addEventListener('click', loadUsageReport);
  const resetProfileBtn = $('#resetProfileBtn');
  if (resetProfileBtn) resetProfileBtn.addEventListener('click', resetCurrentProfileData);

  // Backup / Restore
  $('#exportBtn').addEventListener('click', () => exportBackup());
  $('#importBtn').addEventListener('click', () => {
    // Deliberate first step so a stray tap can't even open the file picker.
    // Names the common mix-up: people mean "Backup" (download) and hit "Restore".
    if (!confirm('Restore from a backup file?\n\nThis is only for recovering lost data — it will REPLACE everything on this device and in the cloud.\n\nDid you mean "Backup" instead? Tap Cancel if so.')) return;
    $('#importFile').click();
  });
  $('#importFile').addEventListener('change', importBackup);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// ========== Views ==========
// The header's top-right button adapts to the current view: it logs weight in
// the Gym, logs food in Diet, and creates a task everywhere else.
const HEADER_ACTION_LABELS = { diet: 'Log Food' };

function headerPrimaryAction() {
  if (currentView === 'training') {
    // Follows the active mode, so the button always means the thing on screen.
    const cardio = typeof effectiveTrainingMode === 'function' && effectiveTrainingMode() === 'cardio';
    const el = $(cardio ? '#cardioDistance' : '#weightInput');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
  } else if (currentView === 'diet') {
    // On a phone, open the Log Food sheet so you never scroll to the bottom of
    // the day to add a food. On desktop the form is already in a visible rail —
    // just focus it.
    if (typeof logFoodSheetApplies === 'function' && logFoodSheetApplies()
        && typeof openLogFoodSheet === 'function' && openLogFoodSheet()) {
      return;
    }
    const el = $('#dietFoodName');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
  } else {
    openModal();
  }
}

// Pre-built iCloud shortcut(s). The combined "Sync Health to Daylign" pulls
// steps, active energy, exercise minutes, run distance and resting HR in one
// run. Add more entries here to render more "Add" buttons.
const HEALTH_SHORTCUTS = [
  { label: 'Sync Health to Daylign', url: 'https://www.icloud.com/shortcuts/35bece5937964531903187bb76279012' },
];

// Metric names the app understands, so the "last synced" scan ignores the
// nested u/<id> subtree under the legacy external node.
const KNOWN_EXTERNAL_METRICS = ['steps', 'activeEnergy', 'exerciseMinutes', 'restingHR', 'sleep', 'runDistance', 'cycleDistance', 'swimDistance'];

function lastExternalSyncDate() {
  if (typeof externalData === 'undefined' || !externalData) return null;
  let latest = null;
  KNOWN_EXTERNAL_METRICS.forEach(m => {
    const o = externalData[m];
    if (o && typeof o === 'object') Object.keys(o).forEach(d => { if (!latest || d > latest) latest = d; });
  });
  return latest;
}

function renderWatchConnect() {
  const wrap = $('#watchConnect');
  if (!wrap) return;
  const dbUrl = (typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL) ? firebaseConfig.databaseURL.replace(/\/$/, '') : '';
  const path = (typeof profileExternalPath === 'function') ? profileExternalPath() : 'external';
  const base = dbUrl + '/' + path;
  const id = (typeof currentProfile === 'function' && currentProfile()) ? currentProfile().id : '';
  const last = lastExternalSyncDate();
  const status = last
    ? `<div class="watch-status ok"><span class="watch-dot"></span>Connected — last synced ${esc(last)}</div>`
    : `<div class="watch-status"><span class="watch-dot"></span>Not synced yet — add a shortcut below</div>`;

  wrap.innerHTML = `
    ${status}
    <ol class="watch-steps">
      <li>
        <strong>Add the shortcuts</strong> to your iPhone (tap, then “Add Shortcut”):
        <div class="watch-shortcut-btns">
          ${HEALTH_SHORTCUTS.map(s => `<a class="btn-secondary watch-shortcut" href="${s.url}" target="_blank" rel="noopener">＋ ${esc(s.label)}</a>`).join('')}
        </div>
      </li>
      <li>
        <strong>If a shortcut asks for your Daylign ID,</strong> paste this:
        <div class="watch-copy"><code id="watchId">${esc(id || '—')}</code><button class="btn-secondary" data-copy="#watchId">Copy</button></div>
      </li>
      <li><strong>Run each one once</strong> to grant Health access. Then in the Shortcuts app add an <em>Automation → Time of Day → nightly</em> that runs them, so it syncs on its own.</li>
    </ol>
    <details class="watch-adv">
      <summary>Advanced: your full sync URL</summary>
      <div class="watch-copy"><code id="watchUrl">${esc(base)}</code><button class="btn-secondary" data-copy="#watchUrl">Copy</button></div>
      <p class="settings-desc">Shortcuts post each metric to <code>&lt;this&gt;/&lt;metric&gt;/&lt;date&gt;.json</code>. Full walkthrough in <code>HEALTH-SYNC.md</code>.</p>
    </details>`;

  wrap.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
    const el = wrap.querySelector(b.dataset.copy);
    const txt = el ? el.textContent : '';
    if (navigator.clipboard && txt) navigator.clipboard.writeText(txt).then(() => showToast('Copied')).catch(() => {});
  }));
}

function renderGoalsSummary() {
  const wrap = $('#goalsSummary');
  if (!wrap || typeof getGoals !== 'function') return;
  const g = getGoals();
  const rows = [
    { label: 'Goal weight', val: g.weight + ' lbs' },
    { label: 'Daily calories', val: g.calories + ' cal' },
    { label: 'Protein', val: g.protein + ' g' },
    { label: 'Carbs', val: g.carbs + ' g' },
    { label: 'Fat', val: g.fat + ' g' },
    { label: 'Water', val: g.water + ' oz' },
    { label: 'Exercise burn', val: g.burn + ' cal/day' },
  ];
  wrap.innerHTML = rows.map(r => `
    <div class="goals-summary-row">
      <span class="goals-summary-label">${r.label}</span>
      <span class="goals-summary-val">${r.val}</span>
    </div>`).join('');
}

function renderModuleToggles() {
  const wrap = $('#moduleToggles');
  if (!wrap || typeof TOGGLEABLE_MODULES === 'undefined') return;
  wrap.innerHTML = TOGGLEABLE_MODULES.map(m => `
    <label class="module-toggle">
      <span class="module-toggle-text">
        <span class="module-toggle-label">${m.label}</span>
        <span class="module-toggle-desc">${m.desc}</span>
      </span>
      <input type="checkbox" class="module-toggle-input" data-module="${m.key}" ${moduleEnabled(m.key) ? 'checked' : ''}>
      <span class="module-toggle-switch" aria-hidden="true"></span>
    </label>`).join('');

  wrap.querySelectorAll('.module-toggle-input').forEach(input => {
    input.addEventListener('change', () => {
      state.modules = state.modules || {};
      state.modules[input.dataset.module] = input.checked;
      saveData(state);
      applyModuleNav();
      // If we just turned off the module we're standing in, step back to Dashboard.
      if (!input.checked && currentView === input.dataset.module) switchView('dashboard');
    });
  });
}

function updateHeaderActionBtn(view) {
  const btn = $('#addTaskBtn');
  if (!btn) return;
  if (view === 'settings') { btn.style.display = 'none'; return; }
  btn.style.display = '';
  if (view === 'training') {
    const cardio = typeof effectiveTrainingMode === 'function' && effectiveTrainingMode() === 'cardio';
    btn.textContent = cardio ? 'Log Session' : 'Log Weight';
    return;
  }
  btn.textContent = HEADER_ACTION_LABELS[view] || '+ New Task';
}

// Views that use the category/project sidebar sections. Everything else (the
// fitness modules, settings) hides them — they only clutter those screens.
const TASKMETA_VIEWS = ['dashboard', 'tasks', 'board', 'calendar'];

function switchView(view) {
  // The Log Food sheet holds the real diet card node while open. Close it (which
  // returns the card home) before navigating, so it is never left in the sheet.
  if (typeof isLogFoodSheetOpen === 'function' && isLogFoodSheetOpen()) closeLogFoodSheet();

  // Guard against landing on a module the user has turned off (e.g. a saved
  // last-view, or a stale command-palette entry).
  // Gym and Cardio are now two modes of one Training view. Old saved views,
  // command-palette entries and voice commands still say 'gym'/'cardio', so
  // translate them into Training plus the matching mode.
  if (view === 'gym' || view === 'cardio') {
    if (typeof setTrainingMode === 'function') setTrainingMode(view === 'cardio' ? 'cardio' : 'strength');
    view = 'training';
  }
  if (typeof moduleEnabled === 'function') {
    // Training survives as long as either of its two modules is on.
    if (view === 'training' && !moduleEnabled('gym') && !moduleEnabled('cardio')) view = 'dashboard';
    if (view === 'diet' && !moduleEnabled('diet')) view = 'dashboard';
  }
  currentView = view;
  localStorage.setItem('tf_view', view);
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.remove('active'));

  const titles = { dashboard: 'Today', tasks: 'All Tasks', board: 'Board', calendar: 'Calendar', training: 'Training', diet: 'Diet', settings: 'Settings' };
  $('#viewTitle').textContent = titles[view];
  $(`#${view}View`).classList.add('active');
  updateHeaderActionBtn(view);

  // Categories/Projects belong to task views only.
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('hide-taskmeta', TASKMETA_VIEWS.indexOf(view) === -1);

  // The header search only searches tasks — hide it where it does nothing.
  const searchBox = document.querySelector('.header .search-box');
  if (searchBox) searchBox.hidden = TASKMETA_VIEWS.indexOf(view) === -1;

  render();
}

// Reflect the module on/off settings across every nav surface and the
// dashboard cards that belong to a module. Non-destructive: disabling only
// hides; the data stays in the cloud and returns when re-enabled.
function applyModuleNav() {
  if (typeof moduleEnabled !== 'function') return;
  ['diet'].forEach(key => {
    const on = moduleEnabled(key);
    document.querySelectorAll(`[data-view="${key}"]`).forEach(el => { el.hidden = !on; });
  });
  // Training's nav item stays as long as either module behind it is on.
  const trainingOn = moduleEnabled('gym') || moduleEnabled('cardio');
  document.querySelectorAll('[data-view="training"]').forEach(el => { el.hidden = !trainingOn; });
  // Weight trend lives in the Gym module — drop its dashboard card when Gym is off.
  const weightCard = document.querySelector('.weight-trend-card');
  if (weightCard) weightCard.hidden = !moduleEnabled('gym');
  // Hide the sidebar divider that fences off the fitness group when it is empty.
  const anyFitness = ['gym', 'cardio', 'diet'].some(moduleEnabled);
  const dividers = document.querySelectorAll('.sidebar .nav-divider');
  if (dividers[0]) dividers[0].hidden = !anyFitness;
}

// ========== Render ==========
function render() {
  applyModuleNav();
  if (typeof updateProfileSettingsCard === 'function') updateProfileSettingsCard();
  if (typeof renderGoalsSummary === 'function') renderGoalsSummary();
  if (typeof renderWatchConnect === 'function') renderWatchConnect();
  if (typeof renderTaxonomyManager === 'function') {
    renderTaxonomyManager();
    // Keep the popup in sync while it's open (add/delete/rename call render()).
    const modal = $('#taxonomyModal');
    if (modal && modal.classList.contains('active')) renderTaxonomyManager($('#taxonomyManagerModal'));
  }
  renderSidebarCategories();
  renderSidebarProjects();
  renderDashboard();
  renderMiniCalendar();
  renderSchedule();
  renderTasksView();
  renderBoard();
  renderCalendar();
  renderGym();
  if (typeof renderCardio === 'function') renderCardio();
  if (typeof renderTraining === 'function') renderTraining();
  if (typeof renderSleep === 'function') renderSleep();
  if (typeof renderTodayPlan === 'function') renderTodayPlan();
  if (typeof renderSettingsPrefs === 'function') renderSettingsPrefs();
  renderDiet();
  populateCategoryDropdowns();
}

function renderSidebarCategories() {
  const list = $('#categoryList');
  list.innerHTML = state.categories.map(cat => {
    const count = state.tasks.filter(t => t.category === cat.id).length;
    return `
      <div class="category-item" data-cat="${cat.id}">
        <span class="category-dot" style="background:${cat.color}"></span>
        ${cat.name}
        <span class="category-count">${count}</span>
        <button class="sidebar-del-btn" data-del-cat="${cat.id}">&times;</button>
      </div>`;
  }).join('');

  $$('.sidebar-del-btn[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategoryById(btn.dataset.delCat);
    });
  });
}

function renderSidebarProjects() {
  const list = $('#projectList');
  list.innerHTML = state.projects.map(proj => {
    const count = state.tasks.filter(t => t.project === proj.id && t.status !== 'done').length;
    const active = activeProject === proj.id;
    return `
      <div class="project-item ${active ? 'active' : ''}" data-proj="${proj.id}">
        <span class="category-dot" style="background:${proj.color}"></span>
        ${proj.name}
        <span class="category-count">${count}</span>
        <button class="sidebar-del-btn" data-del-proj="${proj.id}">&times;</button>
      </div>`;
  }).join('');

  $$('.project-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-del-btn')) return;
      const id = el.dataset.proj;
      activeProject = activeProject === id ? null : id;
      render();
    });
  });

  $$('.sidebar-del-btn[data-del-proj]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProjectById(btn.dataset.delProj);
    });
  });
}

function handleAddProject() {
  const name = prompt('Project name:');
  addProjectNamed(name);
}

// ---- Shared category/project mutations, used by both the sidebar and the
// Settings manager so add/rename/delete behave identically everywhere. ----
const TAXONOMY_COLORS = ['#6366f1', '#22c55e', '#ef4444', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function addCategoryNamed(name) {
  if (!name || !name.trim()) return false;
  const clean = name.trim();
  const id = clean.toLowerCase().replace(/\s+/g, '-');
  if (state.categories.some(c => c.id === id)) { showToast('A category with that name already exists'); return false; }
  state.categories.push({ id, name: clean, color: TAXONOMY_COLORS[state.categories.length % TAXONOMY_COLORS.length] });
  saveData(state);
  render();
  return true;
}

function addProjectNamed(name) {
  if (!name || !name.trim()) return false;
  state.projects.push({ id: 'proj-' + Date.now(), name: name.trim(), color: TAXONOMY_COLORS[state.projects.length % TAXONOMY_COLORS.length] });
  saveData(state);
  render();
  return true;
}

function deleteCategoryById(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  const count = state.tasks.filter(t => t.category === id).length;
  const msg = count ? `Delete "${cat.name}"? ${count} task(s) will become uncategorized.` : `Delete "${cat.name}"?`;
  if (!confirm(msg)) return;
  state.categories = state.categories.filter(c => c.id !== id);
  state.tasks.forEach(t => { if (t.category === id) t.category = ''; });
  saveData(state);
  render();
}

function deleteProjectById(id) {
  const proj = state.projects.find(p => p.id === id);
  if (!proj) return;
  const count = state.tasks.filter(t => t.project === id).length;
  const msg = count ? `Delete "${proj.name}"? ${count} task(s) will be unassigned.` : `Delete "${proj.name}"?`;
  if (!confirm(msg)) return;
  state.projects = state.projects.filter(p => p.id !== id);
  state.tasks.forEach(t => { if (t.project === id) t.project = null; });
  if (activeProject === id) activeProject = null;
  saveData(state);
  render();
}

function renameCategoryById(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  const name = prompt('Rename category:', cat.name);
  if (!name || !name.trim()) return;
  cat.name = name.trim(); // keep the id stable so existing tasks stay linked
  saveData(state);
  render();
}

function renameProjectById(id) {
  const proj = state.projects.find(p => p.id === id);
  if (!proj) return;
  const name = prompt('Rename project:', proj.name);
  if (!name || !name.trim()) return;
  proj.name = name.trim();
  saveData(state);
  render();
}

function openTaxonomyModal() {
  renderTaxonomyManager($('#taxonomyManagerModal'));
  const m = $('#taxonomyModal');
  if (m) m.classList.add('active');
}
function closeTaxonomyModal() {
  const m = $('#taxonomyModal');
  if (m) m.classList.remove('active');
}

// The always-available manager in Settings, so add/delete never depends on
// being on a task view or discovering a hover-only × in the sidebar.
function renderTaxonomyManager(target) {
  const wrap = target || $('#taxonomyManager');
  if (!wrap) return;
  const row = (item, kind, count) => `
    <div class="tax-row">
      <span class="tax-dot" style="background:${item.color}"></span>
      <span class="tax-name">${esc(item.name)}</span>
      <span class="tax-count">${count}</span>
      <button class="tax-btn" data-tax-edit="${kind}" data-id="${item.id}" title="Rename">✎</button>
      <button class="tax-btn tax-btn-del" data-tax-del="${kind}" data-id="${item.id}" title="Delete">&times;</button>
    </div>`;

  wrap.innerHTML = `
    <div class="tax-group">
      <h3>Categories</h3>
      <div class="tax-list">${state.categories.map(c => row(c, 'cat', state.tasks.filter(t => t.category === c.id).length)).join('') || '<p class="settings-desc">No categories yet.</p>'}</div>
      <div class="tax-add">
        <input type="text" class="tax-add-input" data-tax-add="cat" placeholder="New category name" maxlength="30">
        <button class="btn-secondary" data-tax-add-btn="cat">Add</button>
      </div>
    </div>
    <div class="tax-group">
      <h3>Projects</h3>
      <div class="tax-list">${state.projects.map(p => row(p, 'proj', state.tasks.filter(t => t.project === p.id && t.status !== 'done').length)).join('') || '<p class="settings-desc">No projects yet.</p>'}</div>
      <div class="tax-add">
        <input type="text" class="tax-add-input" data-tax-add="proj" placeholder="New project name" maxlength="30">
        <button class="btn-secondary" data-tax-add-btn="proj">Add</button>
      </div>
    </div>`;

  // Everything is scoped to `wrap` (not global $) so the same markup can render
  // in both the Settings card and the popup without id collisions.
  wrap.querySelectorAll('[data-tax-del]').forEach(b => b.addEventListener('click', () => {
    b.dataset.taxDel === 'cat' ? deleteCategoryById(b.dataset.id) : deleteProjectById(b.dataset.id);
  }));
  wrap.querySelectorAll('[data-tax-edit]').forEach(b => b.addEventListener('click', () => {
    b.dataset.taxEdit === 'cat' ? renameCategoryById(b.dataset.id) : renameProjectById(b.dataset.id);
  }));
  const addFrom = (kind) => {
    const el = wrap.querySelector(`[data-tax-add="${kind}"]`);
    if (!el) return;
    const ok = kind === 'cat' ? addCategoryNamed(el.value) : addProjectNamed(el.value);
    if (ok) el.value = '';
  };
  wrap.querySelectorAll('[data-tax-add-btn]').forEach(b => b.addEventListener('click', () => addFrom(b.dataset.taxAddBtn)));
  wrap.querySelectorAll('[data-tax-add]').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') addFrom(inp.dataset.taxAdd); }));
}

// ========== Backup / Restore ==========
// Optional `prefix` names the file (used for the automatic pre-restore safety copy).
function exportBackup(prefix) {
  const namePrefix = (typeof prefix === 'string' && prefix) ? prefix : 'daylign-backup';
  const payload = {
    tasks: state.tasks,
    categories: state.categories,
    projects: state.projects,
    gym: state.gym,
    diet: state.diet,
    customFoods: state.customFoods,
    water: state.water,
    events: state.events,
    removedFoods: state.removedFoods,
    weight: state.weight,
    goals: state.goals,
    exportedAt: new Date().toISOString(),
    version: 2,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `${namePrefix}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackup(e) {
  const input = e.target;
  const file = input.files && input.files[0];
  input.value = ''; // reset now so the same file can be re-selected later
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (err) {
      alert('Could not read that backup file: ' + err.message);
      return;
    }
    if (typeof data !== 'object' || data === null) {
      alert('That does not look like a valid backup file.');
      return;
    }

    // Summarize what this restore would replace, so it's an informed choice.
    const dietOf = arr => (Array.isArray(arr) ? arr : []);
    const curDiet = dietOf(state.diet).length;
    const newDiet = dietOf(data.diet).length;
    const curDays = new Set(dietOf(state.diet).map(x => x && x.date)).size;
    const newDays = new Set(dietOf(data.diet).map(x => x && x.date)).size;
    const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'an unknown date';

    // Always download the CURRENT data first, so any restore is undoable.
    exportBackup('daylign-autosave-before-restore');

    let msg =
      `Restore this backup?\n\n` +
      `• Backup created: ${when}\n` +
      `• Backup has ${newDiet} diet entries across ${newDays} day(s)\n` +
      `• You currently have ${curDiet} entries across ${curDays} day(s)\n\n` +
      `This REPLACES everything on this device AND in the cloud (all your devices).\n` +
      `A safety copy of your current data was just downloaded so you can undo this.`;

    if (newDiet < curDiet || newDays < curDays) {
      msg = `⚠️ This looks like an OLDER / smaller backup — you would LOSE ` +
        `${Math.max(0, curDiet - newDiet)} diet entries and ` +
        `${Math.max(0, curDays - newDays)} day(s) of history.\n\n` + msg;
    }

    // Require typing the word — a stray tap or reflexive "OK" can't get through.
    const answer = prompt(msg + `\n\nType RESTORE (all caps) to confirm:`);
    if (!answer || answer.trim().toUpperCase() !== 'RESTORE') {
      alert('Restore cancelled — your data is unchanged.');
      return;
    }

    state.tasks = data.tasks || [];
    state.categories = data.categories || [];
    state.projects = data.projects || [];
    state.gym = data.gym || [];
    state.diet = data.diet || [];
    state.customFoods = data.customFoods || {};
    state.water = data.water || {};
    state.events = data.events || [];
    // Only overwrite these when the backup actually contains them, so restoring
    // an older backup (made before these were exported) can't wipe them.
    if ('removedFoods' in data) state.removedFoods = data.removedFoods || [];
    if ('weight' in data) state.weight = data.weight || {};
    if ('goals' in data) state.goals = data.goals || {};
    saveData(state);
    populateCategoryDropdowns();
    render();
    alert('Backup restored successfully.');
  };
  reader.readAsText(file);
}

function populateCategoryDropdowns() {
  const opts = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  $('#taskCategory').innerHTML = opts;
  $('#filterCategory').innerHTML = '<option value="all">All Categories</option>' + opts;
}
