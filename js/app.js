// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  // Offline support: network-first SW, so code is always fresh when online
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(setupUpdateWatch)
      .catch(() => {});
  }
  // state.js could not read the preference at parse time (settings-prefs.js
  // had not loaded), so honour it now that everything is present.
  if (typeof defaultGymSets === 'function') gymSets = defaultGymSets();
  setHeaderDate();
  bindHeaderCondense();
  bindPullToRefresh();
  bindSheetDrag();
  if (typeof bindSyncStatusUI === 'function') bindSyncStatusUI();
  if (typeof bindDiagnostics === 'function') bindDiagnostics();
  if (typeof startInboxWatch === 'function') startInboxWatch();
  if (typeof bindCsvImport === 'function') bindCsvImport();
  // The date format is breakpoint-dependent, so it has to be re-derived when
  // the viewport crosses 600px (rotation, or a resized desktop window).
  window.matchMedia('(max-width: 600px)').addEventListener('change', setHeaderDate);
  bindEvents();
  if (currentView !== 'today') {
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

// "Tuesday, August 11, 2026" is 24 characters competing with the title for a
// 390px row. The short form carries everything you actually need — the year is
// never in question, and the long weekday buys nothing.
function setHeaderDate() {
  // While you are browsing a past day on Diet, the header used to keep saying
  // TODAY - so "Tue, Sep 22" sat directly above a day label reading "Monday,
  // September 21". Two dates disagreeing on one screen. The header follows the
  // day being viewed, from the same dietViewDate the label below it uses.
  //
  // Guarded on the active view because render() runs every renderer on every
  // render: without this the Diet day would leak onto Today and Insights.
  const dietActive = (document.getElementById('dietView') || {}).classList
    && document.getElementById('dietView').classList.contains('active');
  // Same rule for the line on Today, which can step to another day (spec 4.1).
  const todayActive = (document.getElementById('dashboardView') || {}).classList
    && document.getElementById('dashboardView').classList.contains('active');
  const viewing = (dietActive && typeof dietViewDate === 'string' && dietViewDate)
    ? dietViewDate
    : (todayActive && typeof lineViewDate !== 'undefined' && lineViewDate) ? lineViewDate : null;
  const d = viewing ? new Date(viewing + 'T00:00:00') : new Date();
  const narrow = window.matchMedia('(max-width: 600px)').matches;
  $('#headerDate').textContent = d.toLocaleDateString('en-US', narrow
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Collapse the large title into a compact bar once you start reading. Standard
// iOS behaviour, and it pairs with the sticky header: generous at rest, thin
// while scrolling, without costing a permanent chunk of the screen.
function bindHeaderCondense() {
  const header = document.querySelector('.header');
  if (!header) return;
  const ON = 34, OFF = 12; // hysteresis, so it cannot flicker at the boundary
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (y > ON) header.classList.add('is-condensed');
    else if (y < OFF) header.classList.remove('is-condensed');
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
  // Today's now block sticks just under the header. On a phone the header
  // changes height as it condenses, so its live height is published for the
  // CSS; with a fixed offset the block slid underneath the header and hid.
  const publish = () => document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  if (typeof ResizeObserver === 'function') new ResizeObserver(publish).observe(header);
  publish();
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
  // The + sheet, the bottom bar's +, the install prompt (js/global.js).
  if (typeof bindGlobal === 'function') bindGlobal();
  // The two v3 sheets: the header x. Backdrop taps, Esc and a downward swipe
  // are handled once, for every .dl-sheet, by bindDlSheets() in js/utils.js.
  [['taskSheetClose', closeTaskSheet], ['eventSheetClose', closeEventSheet]].forEach(([id, fn]) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', fn);
  });

  // Tasks: List / Board, remembered per device. Bound here rather than in
  // js/enhancements.js, which used to route them through switchView('board').
  $$('[data-tasks-mode]').forEach(b => b.addEventListener('click', () => setTasksMode(b.dataset.tasksMode)));

  // Search — one box, filtering the task list (spec 5). The phone reaches it
  // through Ctrl K / the search icon.
  $('#searchInput').addEventListener('input', renderTasksView);

  // Calendar: a visible way to create an event. Defaults to the day you are
  // looking at (today when that month is on screen), so the date is usually
  // already right.
  [['calAddBtn'], ['calDayAdd']].forEach(([id]) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => openEventModal(calSelectedDate()));
  });

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
  $('#calMonthBtn').addEventListener('click', () => { calViewMode = 'month'; renderCalendar(); });
  $('#calWeekBtn').addEventListener('click', () => { calViewMode = 'week'; renderCalendar(); });

  // Today's right column (desktop): the two things the phone reaches from the
  // + in the bottom bar. New opens the task form; Say it opens voice.
  const todayNew = $('#todayNewBtn');
  if (todayNew) todayNew.addEventListener('click', () => openTaskSheet());
  const todaySay = $('#todaySayBtn');
  if (todaySay) todaySay.addEventListener('click', () => {
    if (typeof openVoicePanel === 'function') openVoicePanel();
  });

  // Gym & Diet
  bindGymEvents();
  if (typeof bindCardioEvents === 'function') bindCardioEvents();
  if (typeof bindTrainingEvents === 'function') bindTrainingEvents();
  if (typeof bindSleepEvents === 'function') bindSleepEvents();
  if (typeof bindPreferencesEvents === 'function') bindPreferencesEvents();
  if (typeof bindSettingsPrefs === 'function') bindSettingsPrefs();
  if (typeof bindLayoutEditor === 'function') bindLayoutEditor();
  // Search entry points for touch — the palette was Cmd/Ctrl-K only.
  ['openSearchBtn', 'avatarSearchBtn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => {
      const sheet = document.getElementById('avatarSheet');
      if (sheet && sheet.classList.contains('open')) closeDlSheet(sheet);
      if (typeof window.openPalette === 'function') window.openPalette();
    });
  });
  bindDietEvents();
  bindGoalsEvents();
  if (typeof bindBoardDropTargets === 'function') bindBoardDropTargets();
  if (typeof bindWeightSheet === 'function') bindWeightSheet();
  if (typeof bindPhotoEvents === 'function') bindPhotoEvents();
  if (typeof bindFoodLibrary === 'function') bindFoodLibrary();
  if (typeof bindVoiceEvents === 'function') bindVoiceEvents();

  // Tap a date label to open that view's native date picker — no hunting for a
  // tiny input. Pairs each label with its date input.
  [['#dietDateLabel', '#dietDate'], ['#gymDateLabel', '#gymDate'], ['#cardioDateLabel', '#cardioDate']]
    .forEach(([labelSel, inputSel]) => {
      const label = $(labelSel);
      const input = $(inputSel);
      if (label && input) label.addEventListener('click', () => {
        if (typeof input.showPicker === 'function') { try { input.showPicker(); return; } catch (e) {} }
        input.focus();
        input.click();
      });
    });

  // Profile
  const sidebarProfile = $('#sidebarProfile');
  if (sidebarProfile) sidebarProfile.addEventListener('click', () => switchView('settings'));
  // The sidebar's Manage links open the one categories manager, in Settings.
  // Everything inside Settings itself is bound in js/settings.js.
  $$('[data-manage-taxonomy]').forEach(btn => btn.addEventListener('click', () => openSettingsPage('cats')));

  // Keyboard. Every .dl-sheet closes on Escape by itself (js/utils.js); this
  // is for the mobile sidebar, which is not a sheet.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Mobile sidebar is an overlay too — Escape should back out of it.
    const sb = document.querySelector('.sidebar');
    if (sb && sb.classList.contains('open')) sb.classList.remove('open');
    const ov = document.querySelector('.sidebar-overlay');
    if (ov) ov.classList.remove('active');
  });
}

// ========== Views ==========
// The header's top-right button adapts to the current view: it logs weight in
// the Gym, logs food in Diet, and creates a task everywhere else.
const HEADER_ACTION_LABELS = { diet: 'Food library' };

function headerPrimaryAction() {
  if (currentView === 'training') {
    // Follows the active mode, so the button always means the thing on screen.
    const cardio = typeof effectiveTrainingMode === 'function' && effectiveTrainingMode() === 'cardio';
    // Strength: jump straight to logging an exercise. Weigh-ins happen maybe
    // twice a week, so handing the one prominent button to weight made the
    // daily action the harder one. Weight still has its own readout + Log
    // button in the Training shell, which is plenty for a twice-weekly task.
    // Strength logging now opens as a popup on both phone (full-screen sheet)
    // and desktop (centered modal, like New Task). Cardio still logs inline.
    if (!cardio && typeof openGymLogSheet === 'function') {
      openGymLogSheet();
      return;
    }
    const el = $('#cardioDistance');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
  } else if (currentView === 'diet') {
    // Logging now lives inline on each meal (usuals tiles, search, snap). The
    // header button opens the Food Library — recent foods, history, manual entry.
    if (typeof openFoodLibrary === 'function') openFoodLibrary();
  } else {
    openTaskSheet();
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

// One component, two hosts: the Apple Watch page in Settings and the Watch step
// of setup. Nothing in it has an id, so both can be on the page at once.
function renderWatchConnect(target) {
  const wrap = target || $('#watchConnect');
  if (!wrap) return;
  const dbUrl = (typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL) ? firebaseConfig.databaseURL.replace(/\/$/, '') : '';
  const path = (typeof profileExternalPath === 'function') ? profileExternalPath() : 'external';
  const base = dbUrl + '/' + path;
  const prof = (typeof currentProfile === 'function') ? currentProfile() : null;
  const id = prof ? prof.id : '';
  const last = lastExternalSyncDate();

  const html = `
    <p class="set-watch-status${last ? ' is-ok' : ''}"><span class="dl-dot" aria-hidden="true"></span>${last
      ? 'Connected. Last synced ' + esc(formatDate(last))
      : 'Not synced yet. Add the shortcut below.'}</p>
    ${(!prof || !prof.legacy) ? `
      <div class="dl-card tint c-food set-watch-warn">
        <div class="dl-card-h"><span>Point the shortcut at your own path first</span></div>
        <p class="set-sub">The shared shortcut posts to the account it was built for. Every
          <em>Get Contents of URL</em> step must use this instead, or your health data
          overwrites someone else's and never reaches your own.</p>
        <code>${esc(base)}/&lt;metric&gt;/&lt;date&gt;.json</code>
      </div>` : ''}
    <ol class="set-steps">
      <li>
        <b>Add the shortcut</b> to your iPhone (tap, then “Add Shortcut”).
        <div class="set-btnrow">
          ${HEALTH_SHORTCUTS.map(s => `<a class="dl-btn" href="${esc(s.url)}" target="_blank" rel="noopener"><span class="ms" aria-hidden="true">add</span>${esc(s.label)}</a>`).join('')}
        </div>
      </li>
      <li>
        <b>If it asks for your Daylign ID,</b> paste this.
        <div class="set-copy"><code>${esc(id || '—')}</code><button type="button" class="dl-btn" data-copy>Copy</button></div>
      </li>
      <li><b>Run it once</b> to grant Health access. Then add an Automation in the Shortcuts app (Time of Day, nightly) that runs it, so it syncs on its own.</li>
    </ol>
    <details class="set-adv">
      <summary>Advanced: your full sync URL</summary>
      <div class="set-copy"><code>${esc(base)}</code><button type="button" class="dl-btn" data-copy>Copy</button></div>
      <p class="set-sub">The shortcut posts each metric to <code>&lt;this&gt;/&lt;metric&gt;/&lt;date&gt;.json</code>. The full walkthrough is in <code>HEALTH-SYNC.md</code>.</p>
    </details>`;
  // Unchanged markup is left alone, so an opened "Advanced" stays open across
  // the re-render every save causes.
  if (wrap._html !== html) { wrap.innerHTML = html; wrap._html = html; }

  if (wrap._copyBound) return;
  wrap._copyBound = true;
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const code = btn.parentElement.querySelector('code');
    const txt = code ? code.textContent : '';
    if (!navigator.clipboard || !txt) { showToast('Could not copy. Select the text instead'); return; }
    navigator.clipboard.writeText(txt).then(() => showToast('Copied')).catch(() => showToast('Could not copy. Select the text instead'));
  });
}

function renderGoalsSummary() {
  const wrap = $('#goalsSummary');
  if (!wrap || typeof getGoals !== 'function') return;
  const g = getGoals();
  const n = (v) => Number(v).toLocaleString('en-US');
  const rows = [
    ['Goal weight', g.weight + ' lb'],
    ['Daily calories', n(g.calories) + ' kcal'],
    ['Protein', g.protein + ' g'],
    ['Carbs', g.carbs + ' g'],
    ['Fat', g.fat + ' g'],
    ['Water', g.water + ' oz'],
    ['Exercise burn', n(g.burn) + ' kcal a day'],
  ];
  const html = rows.map(r => `<div><span>${r[0]}</span><b>${esc(r[1])}</b></div>`).join('');
  if (wrap._html !== html) { wrap.innerHTML = html; wrap._html = html; }
}

function renderModuleToggles() {
  const wrap = $('#moduleToggles');
  if (!wrap || typeof TOGGLEABLE_MODULES === 'undefined') return;
  const html = TOGGLEABLE_MODULES.map(m => `
    <label class="set-togrow dl-toggle">
      <span class="set-togrow-t"><b>${m.label}</b><small>${m.desc}</small></span>
      <input type="checkbox" data-module="${m.key}" ${moduleEnabled(m.key) ? 'checked' : ''}>
      <span class="dl-toggle-track" aria-hidden="true"></span>
    </label>`).join('') + `
    <div class="set-togrow">
      <span class="set-togrow-t"><b>Tasks and Calendar</b><small>Always on</small></span>
      <span class="ms" aria-hidden="true">lock</span>
    </div>`;
  if (wrap._html !== html) { wrap.innerHTML = html; wrap._html = html; }

  // #moduleToggles outlives its rows, so this is bound once.
  if (wrap._bound) return;
  wrap._bound = true;
  wrap.addEventListener('change', e => {
    const input = e.target.closest('[data-module]');
    if (!input) return;
    const key = input.dataset.module;
    state.modules = state.modules || {};
    state.modules[key] = input.checked;
    saveData(state);
    render();
    // render() rewrote the rows; keep the keyboard where it was.
    const again = wrap.querySelector('[data-module="' + key + '"]');
    if (again) again.focus({ preventScroll: true });
  });
}

function updateHeaderActionBtn(view) {
  const btn = $('#addTaskBtn');
  if (!btn) return;
  // Settings has no primary action. On a phone this button is hidden anyway:
  // the + in the bottom bar is the phone's way to add.
  if (view === 'settings') { btn.style.display = 'none'; return; }
  btn.style.display = '';
  if (view === 'training') {
    const cardio = typeof effectiveTrainingMode === 'function' && effectiveTrainingMode() === 'cardio';
    btn.textContent = cardio ? 'Log session' : 'Log exercise';
    return;
  }
  btn.textContent = HEADER_ACTION_LABELS[view] || '+ New Task';
}

// Views that use the category/project sidebar sections. Everything else (the
// fitness modules, settings) hides them — they only clutter those screens.
const TASKMETA_VIEWS = ['today', 'tasks', 'calendar'];

function switchView(view) {
  // A running rest timer would otherwise keep ticking and fire its toast from
  // whatever view you navigated to.
  if (typeof stopRestTimer === 'function') stopRestTimer();

  // Always land on the main Diet day, never mid-Food-Library, when navigating.
  // Leaving Diet closes the Food library, so coming back lands on the day.
  if (typeof closeFoodLibrary === 'function') closeFoodLibrary(true);

  // Leaving Diet closes the inline food search too — coming back to an empty
  // search box you opened an hour ago reads as a half-finished log.
  if (view !== 'diet' && typeof closeDietInlineSearch === 'function') closeDietInlineSearch();

  // Guard against landing on a module the user has turned off (e.g. a saved
  // last-view, or a stale command-palette entry).
  // Gym and Cardio are now two modes of one Training view. Old saved views,
  // command-palette entries and voice commands still say 'gym'/'cardio', so
  // translate them into Training plus the matching mode.
  // The view key is 'today'; the ELEMENT is still #dashboardView. Renaming it
  // would mean rewriting the selector strings js/layout.js builds its custom
  // dashboard-order stylesheet from - real breakage risk for no gain.
  if (view === 'dashboard') view = 'today';
  // Board is a face of Tasks now (spec 5). Old saved views, the avatar sheet's
  // "Tester reports" item, palette entries and voice all still say 'board'.
  if (view === 'board') { if (typeof setTasksMode === 'function') setTasksMode('board', true); view = 'tasks'; }
  if (view === 'gym' || view === 'cardio') {
    if (typeof setTrainingMode === 'function') setTrainingMode(view === 'cardio' ? 'cardio' : 'strength');
    view = 'training';
  }
  if (typeof moduleEnabled === 'function') {
    // Training survives as long as either of its two modules is on.
    if (view === 'training' && !moduleEnabled('gym') && !moduleEnabled('cardio')) view = 'today';
    if (view === 'diet' && !moduleEnabled('diet')) view = 'today';
  }
  // Leaving Today puts the line back on today: this app stays open for days,
  // and coming back to find last Tuesday is a wrong-day bug waiting to happen.
  if (view !== 'today' && typeof lineResetDay === 'function') lineResetDay();
  // Same for Settings: coming back should open the list, not the page you
  // were on last week.
  if (view !== 'settings' && typeof settingsPage !== 'undefined') settingsPage = null;
  currentView = view;
  localStorage.setItem('tf_view', view);
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.remove('active'));

  const titles = { insights: 'Insights', today: 'Today', tasks: 'Tasks', calendar: 'Calendar', training: 'Training', diet: 'Diet', settings: 'Settings' };
  $('#viewTitle').textContent = titles[view];
  const VIEW_EL = { today: 'dashboardView' };
  const viewEl = document.getElementById(VIEW_EL[view] || (view + 'View'));
  if (viewEl) viewEl.classList.add('active');
  updateHeaderActionBtn(view);

  // Categories/Projects belong to task views only.
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('hide-taskmeta', TASKMETA_VIEWS.indexOf(view) === -1);

  // The header search only searches tasks — hide it where it does nothing.
  const searchBox = document.querySelector('.header .search-box');
  if (searchBox) searchBox.hidden = TASKMETA_VIEWS.indexOf(view) === -1;

  render();
  // After render, so leaving Diet on a past day puts today's date back.
  setHeaderDate();
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
  if (typeof renderSettings === 'function') renderSettings();
  renderSidebarCategories();
  renderSidebarProjects();
  renderDashboard();
  renderTasksView();
  renderBoard();
  renderCalendar();
  renderGym();
  if (typeof renderStrength === 'function') renderStrength();
  if (typeof renderCoach === 'function') renderCoach();
  if (typeof renderInsights === 'function') renderInsights();
  if (typeof renderCardio === 'function') renderCardio();
  if (typeof renderTraining === 'function') renderTraining();
  if (typeof renderSleep === 'function') renderSleep();
  renderDiet();
  populateCategoryDropdowns();
  if (typeof initCollapsibles === 'function') initCollapsibles();
  // Re-promote click-handled divs to keyboard-reachable controls — every
  // render replaces their markup, so this has to run after, not once.
  if (typeof enhanceKeyboardAccess === 'function') enhanceKeyboardAccess();
}

// The sidebar lists are for looking and filtering. Adding, renaming, recolouring
// and deleting live in Settings, Categories and projects (the Manage link).
function renderSidebarCategories() {
  const list = $('#categoryList');
  list.innerHTML = state.categories.map(cat => {
    const count = state.tasks.filter(t => t.category === cat.id).length;
    return `
      <div class="category-item" data-cat="${esc(cat.id)}">
        <span class="category-dot" style="background:${taxColor(cat)}"></span>
        ${esc(cat.name)}
        <span class="category-count">${count}</span>
      </div>`;
  }).join('');
}

function renderSidebarProjects() {
  const list = $('#projectList');
  list.innerHTML = state.projects.map(proj => {
    const count = state.tasks.filter(t => t.project === proj.id && t.status !== 'done').length;
    const active = activeProject === proj.id;
    return `
      <div class="project-item ${active ? 'active' : ''}" data-proj="${esc(proj.id)}">
        <span class="category-dot" style="background:${taxColor(proj)}"></span>
        ${esc(proj.name)}
        <span class="category-count">${count}</span>
      </div>`;
  }).join('');

  $$('.project-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.proj;
      activeProject = activeProject === id ? null : id;
      render();
    });
  });
}

// ---- Category/project mutations. Rename, recolour and delete are in
// js/settings.js, with the manager that calls them. ----
// The v2 auto palette, kept only so migrateTaxonomyColors() can map a stored
// hex to the v3 key in the same position (indigo→meet, green→move, red→food,
// yellow→habit, blue→water, violet→sleep, then round again).
const TAXONOMY_COLORS = ['#6366f1', '#22c55e', '#ef4444', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// One-time move of category / project colours from hex to a v3 key. Called
// from the sync layer once the first cloud read has settled (never from a
// renderer), so the save goes through the normal path and reaches the cloud
// instead of being overwritten by an older cloud copy. Idempotent: once every
// item holds a key it does nothing, so it is safe on every load.
function migrateTaxonomyColors() {
  let changed = false;
  ['categories', 'projects'].forEach(kind => {
    (state[kind] || []).forEach((item, i) => {
      if (!item || CATEGORY_COLOR_KEYS.indexOf(item.color) !== -1) return;
      const at = TAXONOMY_COLORS.indexOf(String(item.color || '').toLowerCase());
      item.color = CATEGORY_COLOR_KEYS[(at !== -1 ? at : i) % CATEGORY_COLOR_KEYS.length];
      changed = true;
    });
  });
  if (!changed) return false;
  saveData(state);
  render();
  return true;
}

function addCategoryNamed(name) {
  if (!name || !name.trim()) return false;
  const clean = name.trim();
  const id = clean.toLowerCase().replace(/\s+/g, '-');
  if (state.categories.some(c => c.id === id)) { showToast('A category with that name already exists'); return false; }
  state.categories.push({ id, name: clean, color: nextCategoryColor(state.categories) });
  saveData(state);
  render();
  return true;
}

function addProjectNamed(name) {
  if (!name || !name.trim()) return false;
  state.projects.push({ id: 'proj-' + Date.now(), name: name.trim(), color: nextCategoryColor(state.projects) });
  saveData(state);
  render();
  return true;
}

// ========== Backup / Restore ==========
// Optional `prefix` names the file (used for the automatic pre-restore safety copy).
function exportBackup(prefix) {
  const namePrefix = (typeof prefix === 'string' && prefix) ? prefix : 'daylign-backup';
  // Every key the cloud holds, taken from the one list that defines them. This
  // was a hand-written list, and it had drifted: saved meals and the times
  // water was logged were never exported, so restoring a backup lost them.
  const payload = {};
  Object.keys(CLOUD_KEYS).forEach(k => { payload[k] = state[k] !== undefined ? state[k] : CLOUD_KEYS[k]; });
  payload.exportedAt = new Date().toISOString();
  payload.version = 4;
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

// Replace everything with the contents of a backup. Reached only through the
// restore sheet in js/settings.js, after RESTORE has been typed.
function applyBackup(data) {
  // Always download what is here now first, so any restore can be undone.
  exportBackup('daylign-autosave-before-restore');

  // In every backup ever made, so a missing one means empty. The rest arrived
  // later: a backup from before they were exported must not wipe what is here.
  const CORE = ['tasks', 'categories', 'projects', 'gym', 'diet', 'customFoods', 'water', 'events'];
  Object.keys(CLOUD_KEYS).forEach(k => {
    const has = data[k] !== undefined && data[k] !== null && typeof data[k] === 'object';
    // Cardio, sleep, modules and AI usage were exported but never read back
    // here, so a restore kept today's copies of those beside yesterday's
    // everything else. Every key in the file is restored now.
    if (has) state[k] = data[k];
    else if (CORE.indexOf(k) !== -1) state[k] = JSON.parse(JSON.stringify(CLOUD_KEYS[k]));
  });
  // The times belong to the water entries they were logged with. A backup
  // with water but no times must not keep the times of the entries it replaced.
  if (data.waterAt === undefined || data.waterAt === null) state.waterAt = {};

  saveData(state);
  populateCategoryDropdowns();
  render();
  // An old backup can still hold v2 hex colours on its categories.
  if (typeof migrateTaxonomyColors === 'function') migrateTaxonomyColors();
  showToast('Backup restored');
}

// The task sheet builds its own category select on every open, and the Tasks
// list filters by chip now — there are no long-lived category dropdowns left to
// keep in sync. Kept as a no-op because the backup/restore path and the sync
// layer both call it.
function populateCategoryDropdowns() {}

// ========== Staying on the current version ==========
// Registering a service worker was the whole update story: no updatefound, no
// registration.update(), no reload. A new worker could install and activate
// while the PAGE carried on running the JavaScript it loaded at startup.
//
// On desktop that barely shows, because opening a tab is a fresh load. An
// installed iPhone PWA is RESUMED from the background for days without ever
// re-executing its scripts, so it can sit on week-old code — which is why
// every problem this week was "mostly the mobile version": the phone was
// running builds that had already been fixed.
//
// Two halves: actually go and CHECK for a new worker (browsers only do this on
// their own schedule, and an app that is never navigated may never trigger it),
// and then do something visible when one is ready.
let updateBannerShown = false;

function setupUpdateWatch(reg) {
  if (!reg) return;

  // Resuming the app is the moment a phone is most likely to be stale, and the
  // moment a reload costs least. Checking is cheap — unchanged files 304.
  const check = () => { try { reg.update(); } catch (e) {} };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('focus', check);
  setTimeout(check, 3000);

  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    if (!sw) return;
    sw.addEventListener('statechange', () => {
      // A worker reaching 'installed' when one already controls the page means
      // this is an UPDATE, not a first install.
      if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
    });
  });

  // sw.js calls skipWaiting(), so a new worker takes control on its own. The
  // page is still running the old code at that point, so say so.
  navigator.serviceWorker.addEventListener('controllerchange', showUpdateBanner);
}

// Deliberately NOT an automatic reload: a reload mid-set or mid-meal would
// throw away whatever is typed but unsaved. Offer it instead, and make it
// impossible to miss.
function showUpdateBanner() {
  if (updateBannerShown) return;
  updateBannerShown = true;
  // One banner at a time, and this one matters more.
  if (typeof hideInstallBanner === 'function') hideInstallBanner();
  const el = document.createElement('div');
  el.className = 'update-banner';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="ms" aria-hidden="true">system_update</span>
    <span class="update-banner-text">A new version is ready</span>
    <button type="button" class="dl-btn primary" id="updateReloadBtn">Reload</button>
    <button type="button" class="update-banner-x" id="updateDismissBtn" aria-label="Dismiss"><span class="ms" aria-hidden="true">close</span></button>`;
  document.body.appendChild(el);
  const go = document.getElementById('updateReloadBtn');
  if (go) go.addEventListener('click', () => location.reload());
  const x = document.getElementById('updateDismissBtn');
  if (x) x.addEventListener('click', () => el.remove());
}
