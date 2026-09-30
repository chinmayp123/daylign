// ========== Daylign UI enhancements (additive) ==========
// Covers: the theme (System / Light / Dark), the avatar sheet, the board's
// single-column switch on a phone, and the Ctrl K palette.
(function () {
  'use strict';
  const THEME_KEY = 'daylign_theme';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ---------- Theme ----------
  // daylign_theme holds 'light' or 'dark'; anything else (including nothing)
  // means System, which follows the device and keeps following it. The one
  // control is Settings, Appearance. The same three lines run inline in
  // index.html's head so the first paint is already the right theme.
  const sysDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function themePref() {
    let v = null;
    try { v = localStorage.getItem(THEME_KEY); } catch (e) {}
    return v === 'light' || v === 'dark' ? v : 'system';
  }
  function applyTheme() {
    const pref = themePref();
    const light = pref === 'light' || (pref === 'system' && !(sysDark && sysDark.matches));
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    // The browser chrome (status bar, task switcher) takes the page colour.
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
    if (meta && bg) meta.setAttribute('content', bg);
    if (typeof window.renderThemeSegmented === 'function') window.renderThemeSegmented();
  }
  function initTheme() {
    applyTheme();
    if (!sysDark) return;
    const follow = () => { if (themePref() === 'system') applyTheme(); };
    if (sysDark.addEventListener) sysDark.addEventListener('change', follow);
    else if (sysDark.addListener) sysDark.addListener(follow);
  }
  window.daylignThemePref = themePref;
  window.daylignSetTheme = function (pref) {
    try {
      if (pref === 'light' || pref === 'dark') localStorage.setItem(THEME_KEY, pref);
      else localStorage.setItem(THEME_KEY, 'system');
    } catch (e) {}
    applyTheme();
  };

  // ---------- Avatar sheet (was the More sheet) ----------
  function openMore() { const m = $('#avatarSheet'); if (m) { fillAvatarSheet(); m.classList.add('open'); } }
  function closeMore() { const m = $('#avatarSheet'); if (m) m.classList.remove('open'); }

  // Name, initial and sync state are read straight off the surfaces that
  // already own them, so this sheet never becomes a second source of truth.
  function fillAvatarSheet() {
    const raw = ((document.getElementById('sidebarProfileName') || {}).textContent || '').trim();
    // Before a profile is chosen the source reads an em-dash placeholder, and
    // taking [0] of that put a dash in the avatar circle.
    const name = /^[A-Za-z0-9]/.test(raw) ? raw : '';
    const letter = (name[0] || 'D').toUpperCase();
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.textContent = v; };
    set('avatarSheetName', name || 'Daylign');
    set('avatarSheetAvatar', letter);
    set('headerAvatarLetter', letter);
    const sync = document.querySelector('#syncStatus .sync-text');
    set('avatarSheetSync', sync ? sync.textContent.trim() : 'Signed in');
  }

  // One unread count, shown in three places: the avatar, the Tasks nav item
  // and the sheet row itself.
  function refreshReportBadges() {
    const n = (typeof newInboxReports === 'function') ? newInboxReports().length : 0;
    const dot = document.getElementById('headerAvatarDot');
    if (dot) dot.hidden = !n;
    const count = document.getElementById('avatarReportCount');
    if (count) { count.hidden = !n; count.textContent = n > 9 ? '9+' : String(n); }
    document.querySelectorAll('.bottom-nav-btn[data-view="tasks"]').forEach(el => {
      let d = el.querySelector('.nav-report-dot');
      if (!n) { if (d) d.remove(); return; }
      if (!d) { d = document.createElement('span'); d.className = 'nav-report-dot'; el.appendChild(d); }
    });
  }
  window.refreshReportBadges = refreshReportBadges;
  window.fillSidebarDate = function () { fillSidebarDate(); };

  // The sidebar's own date block: small weekday and month, big day number.
  function fillSidebarDate() {
    const d = new Date();
    const sub = document.getElementById('sidebarDateSub');
    const day = document.getElementById('sidebarDateDay');
    // Built from two parts rather than one toLocaleDateString: asking for
    // weekday+month together returns them month-first ("Sep Tue").
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    const mo = d.toLocaleDateString('en-US', { month: 'short' });
    if (sub) sub.textContent = wd + ' · ' + mo;
    if (day) day.textContent = String(d.getDate());
  }

  // ---------- Board mobile column switch ----------
  const COUNT_SRC = { todo: 'boardTodoCount', 'in-progress': 'boardProgressCount', done: 'boardDoneCount' };
  const COUNT_DST = { todo: 'bmsTodo', 'in-progress': 'bmsProgress', done: 'bmsDone' };
  function updateBoardCounts() {
    Object.keys(COUNT_SRC).forEach(k => {
      const src = document.getElementById(COUNT_SRC[k]), dst = document.getElementById(COUNT_DST[k]);
      if (src && dst) dst.textContent = src.textContent;
    });
  }
  function setBoardCol(col) {
    const board = $('.board');
    if (board) board.setAttribute('data-mobile-col', col);
    $$('.bms-btn').forEach(b => b.classList.toggle('active', b.dataset.col === col));
  }

  // ---------- Dashboard "Today" hero ----------
  // Reads the numbers the app already rendered into the health strip + weekly
  // report, so it never recomputes state and can't drift from the source.
  // The Today hero used to live here. It restated the daily brief's own
  // sentence from a different window (7 days including today vs excluding
  // it), so the two sat on screen contradicting each other - 73g against
  // 85g for the same week - and its chips repeated the health strip.

  // The phone calendar agenda moved to js/calendar.js (renderCalAgenda): it
  // belongs to the week view now, not the whole month, and it is the calendar's
  // own renderer rather than something bolted onto renderCalendar from here.

  // ---------- Command palette (\u2318K), spec 10.6 ----------
  // Groups: Exercises, Tasks, Foods, Cardio, Views, then "Run as a command",
  // which hands the text to the voice sheet so its results and undo show.
  const VIEWS = [['today','Today','today'],['tasks','Tasks','check_circle'],['board','Board','view_kanban'],['calendar','Calendar','calendar_month'],['training','Training','fitness_center'],['diet','Diet','restaurant'],['insights','Insights','insights'],['settings','Settings','settings']];
  let cmdRows = [], cmdSel = 0;
  function ensurePalette() {
    if ($('#cmdPalette')) return;
    const wrap = document.createElement('div');
    wrap.id = 'cmdPalette'; wrap.className = 'cmd-overlay';
    wrap.innerHTML = `<div class="cmd-box" role="dialog" aria-modal="true" aria-label="Search and commands">
        <div class="cmd-input-row"><span class="ms" aria-hidden="true">search</span>
          <input id="cmdInput" type="text" placeholder="Search, or type a command" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="cmdResults" aria-autocomplete="list">
          <kbd class="cmd-esc">Esc</kbd></div>
        <div id="cmdResults" class="cmd-results" role="listbox"></div>
        <div class="cmd-foot"><span><b>\u2191\u2193</b> move</span><span><b>\u21b5</b> open</span><span><b>Ctrl K</b> anytime</span></div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => { if (e.target === wrap) closePalette(); });
    const input = $('#cmdInput');
    input.addEventListener('input', () => renderPaletteResults(input.value));
    input.addEventListener('keydown', paletteKeydown);
  }
  function openPalette() {
    ensurePalette();
    const p = $('#cmdPalette'); p.classList.add('open');
    const input = $('#cmdInput'); input.value = ''; renderPaletteResults('');
    setTimeout(() => input.focus(), 30);
  }
  function closePalette() { const p = $('#cmdPalette'); if (p) p.classList.remove('open'); }
  // Row labels are user data (task and food names), so they must be escaped.
  function escLabel(v) { return (typeof esc === 'function') ? esc(String(v)) : String(v); }
  // Exposed because the palette used to be reachable ONLY via Cmd/Ctrl-K —
  // a key that does not exist on a phone, which made the entire search feature
  // invisible on the device this app is mainly used on.
  window.openPalette = openPalette;
  window.closePalette = closePalette;
  const go = (view) => { if (typeof switchView === 'function') switchView(view); };
  function logFood(name) {
    const meal = (typeof defaultMealForNow === 'function') ? defaultMealForNow() : 'snack';
    go('diet');
    if (typeof dietViewDate !== 'undefined') dietViewDate = getTodayStr();
    const before = state.diet.length;
    quickAddToMeal(meal, { name: name, data: state.customFoods[name] }, false);
    const entry = state.diet.length > before ? state.diet[state.diet.length - 1] : null;
    if (!entry) return;
    showToast(`${name} added to ${meal} \u00b7 Undo`, () => {
      state.diet = state.diet.filter(e => e !== entry);
      saveData(state); render();
    });
  }
  function renderPaletteResults(q) {
    const query = (q || '').trim().toLowerCase();
    const rows = [];
    if (query && typeof state !== 'undefined') {
      [...new Set((state.gym || []).map(e => e.exercise))].filter(x => x && x.toLowerCase().includes(query)).slice(0, 5)
        .forEach(x => rows.push({ group: 'Exercises', icon: 'fitness_center', label: x, sub: 'log a set', run: () => {
          closePalette(); go('training');
          if (typeof setTrainingTab === 'function') setTrainingTab('strength');
          if (typeof openGymLogSheet === 'function') openGymLogSheet(x);
        } }));
      (state.tasks || []).filter(t => t.name && t.name.toLowerCase().includes(query)).slice(0, 6)
        .forEach(t => {
          const cat = (state.categories || []).find(c => c.id === t.category);
          rows.push({ group: 'Tasks', icon: t.status === 'done' ? 'task_alt' : 'check_circle', label: t.name, sub: cat ? cat.name : (t.status || '').replace('-', ' '), run: () => { closePalette(); if (typeof openTaskSheet === 'function') openTaskSheet(t.id); } });
        });
      const meal = (typeof defaultMealForNow === 'function') ? defaultMealForNow() : 'snack';
      Object.keys(state.customFoods || {}).filter(f => f.toLowerCase().includes(query)).slice(0, 5)
        .forEach(f => rows.push({ group: 'Foods', icon: 'restaurant', label: f, sub: 'add to ' + meal, run: () => { closePalette(); logFood(f); } }));
      // Cardio was searchable nowhere — "ride" or "run" now finds the log.
      [...new Set((state.cardio || []).map(c => c && c.type).filter(Boolean))]
        .filter(t => t.toLowerCase().includes(query)).slice(0, 3)
        .forEach(t => rows.push({
          group: 'Cardio', icon: 'directions_run', label: t.charAt(0).toUpperCase() + t.slice(1), sub: 'open Cardio',
          run: () => { closePalette(); go('cardio'); },
        }));
    }
    VIEWS.filter(v => !query || v[1].toLowerCase().includes(query))
      .forEach(v => rows.push({ group: 'Views', icon: v[2], label: v[1], run: () => { closePalette(); go(v[0]); } }));
    if (query) {
      rows.push({ group: 'Run as a command', icon: 'mic', label: `\u201c${q.trim()}\u201d`, sub: 'Enter', cmd: true, run: () => { closePalette(); if (typeof openVoicePanel === 'function') openVoicePanel(q.trim()); } });
    }
    cmdRows = rows; cmdSel = 0;
    const host = $('#cmdResults');
    if (!rows.length) { host.innerHTML = '<div class="cmd-empty">No matches</div>'; return; }
    let lastGroup = '';
    host.innerHTML = rows.map((r, i) => {
      const head = r.group !== lastGroup ? `<div class="cmd-group" role="presentation">${r.group}</div>` : '';
      lastGroup = r.group;
      return head + `<div class="cmd-row${i === 0 ? ' sel' : ''}${r.cmd ? ' cmd-run' : ''}" data-idx="${i}" role="option" aria-selected="${i === 0}">
          <span class="ms" aria-hidden="true">${r.icon}</span><span class="cmd-row-label">${escLabel(r.label)}</span>${r.sub ? `<span class="cmd-row-sub">${escLabel(r.sub)}</span>` : ''}</div>`;
    }).join('');
    $$('.cmd-row', host).forEach(el => {
      el.addEventListener('mouseenter', () => setPaletteSel(Number(el.dataset.idx)));
      el.addEventListener('click', () => { const r = cmdRows[Number(el.dataset.idx)]; if (r) r.run(); });
    });
  }
  function setPaletteSel(i) {
    cmdSel = Math.max(0, Math.min(cmdRows.length - 1, i));
    $$('.cmd-row').forEach(el => {
      const on = Number(el.dataset.idx) === cmdSel;
      el.classList.toggle('sel', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const sel = $('.cmd-row.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function paletteKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteSel(cmdSel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteSel(cmdSel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = cmdRows[cmdSel]; if (r) r.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  }

  function bind() {
    initTheme();

    const avatarBtn = $('#headerAvatar'); if (avatarBtn) avatarBtn.addEventListener('click', openMore);
    const sheet = $('#avatarSheet'); if (sheet) sheet.addEventListener('click', e => { if (e.target === sheet) closeMore(); });
    $$('.avatar-item[data-view]').forEach(b => b.addEventListener('click', () => {
      if (typeof switchView === 'function') switchView(b.dataset.view);
      closeMore();
    }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMore(); });

    fillSidebarDate();
    fillAvatarSheet();
    refreshReportBadges();


    // Sidebar search and its Ctrl K hint both open the command palette.
    const sideSearch = $('#sidebarSearch');
    if (sideSearch) sideSearch.addEventListener('click', () => {
      if (typeof window.openPalette === 'function') window.openPalette();
      else { const i = document.getElementById('searchInput'); if (i) i.focus(); }
    });

    $$('.bms-btn').forEach(b => b.addEventListener('click', () => setBoardCol(b.dataset.col)));
    setBoardCol('todo');
    updateBoardCounts();
    $$('.nav-btn, .bottom-nav-btn').forEach(b => b.addEventListener('click', () => setTimeout(updateBoardCounts, 80)));

    // Cmd/Ctrl-K → the command palette (fuzzy search across the app + run NL commands)
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openPalette();
      }
      if (e.key === 'Escape') closeMore();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
