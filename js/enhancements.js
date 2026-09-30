// ========== Daylign UI enhancements (additive) ==========
// Self-contained layer added during the design pass. Everything here is
// additive — it wraps existing global render fns and reads already-rendered
// DOM rather than modifying js/ modules, so it merges with zero conflicts.
// Covers: mobile "More" sheet, board single-column switch, light/dark theme,
// dashboard "Today" hero, reminders focus rail, Cmd/Ctrl-K command palette,
// and a mobile calendar agenda.
(function () {
  'use strict';
  const THEME_KEY = 'daylign_theme';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ---------- Theme ----------
  function applyTheme(theme) {
    const light = theme === 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    $$('.theme-nav-label').forEach(el => { el.textContent = light ? 'Dark mode' : 'Light mode'; });
    const st = $('#moreThemeState'); if (st) st.textContent = light ? 'On' : 'Off';
    // Keep Settings' Appearance control honest when the sidebar toggle is used.
    if (typeof window.renderThemeSegmented === 'function') window.renderThemeSegmented();
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }
  function initTheme() {
    let saved = 'dark';
    try { saved = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
    applyTheme(saved);
  }
  // Settings' Appearance control needs to set an explicit theme rather than
  // flip the current one. Exported so there is still exactly one theme path.
  window.daylignSetTheme = function (theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
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

  // ---------- Serving stepper (Diet log) ----------
  function updateAddLabel() {
    const btn = $('#dietSaveBtn'); if (!btn) return;
    const cal = Number(($('#dietCalories') || {}).value) || 0;
    btn.textContent = cal > 0 ? `+ Add Food \u00b7 ${cal} cal` : '+ Add Food';
  }
  function setupServingStepper() {
    const inp = $('#dietServings');
    if (!inp || $('.serv-step')) return;
    const grp = inp.closest('.form-group'); if (grp) grp.classList.add('serv-stepper-group');
    const mk = (txt, delta) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'serv-step'; b.textContent = txt;
      b.addEventListener('click', () => {
        let v = Number(inp.value) || 1;
        v = Math.max(0.5, Math.round((v + delta) * 2) / 2);
        inp.value = v;
        inp.dispatchEvent(new Event('input', { bubbles: true })); // diet.js recalcs macros
        updateAddLabel();
      });
      return b;
    };
    inp.parentNode.insertBefore(mk('\u2212', -0.5), inp);
    inp.parentNode.insertBefore(mk('+', 0.5), inp.nextSibling);
    const cal = $('#dietCalories'); if (cal) cal.addEventListener('input', updateAddLabel);
    updateAddLabel();
  }

  // ---------- Command palette (\u2318K) ----------
  const VIEWS = [['today','Today'],['tasks','Tasks'],['board','Board'],['calendar','Calendar'],['training','Training'],['diet','Diet'],['settings','Settings']];
  let cmdRows = [], cmdSel = 0;
  function ensurePalette() {
    if ($('#cmdPalette')) return;
    const wrap = document.createElement('div');
    wrap.id = 'cmdPalette'; wrap.className = 'cmd-overlay';
    wrap.innerHTML = `<div class="cmd-box">
        <div class="cmd-input-row"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="cmdInput" type="text" placeholder="Search tasks, foods, exercises \u2014 or type a command\u2026" autocomplete="off">
          <kbd class="cmd-esc">esc</kbd></div>
        <div id="cmdResults" class="cmd-results"></div>
        <div class="cmd-foot"><span><b>\u2191\u2193</b> navigate</span><span><b>\u21b5</b> open</span><span><b>\u2318K</b> anytime</span></div>
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
  function renderPaletteResults(q) {
    const query = (q || '').trim().toLowerCase();
    const rows = [];
    VIEWS.filter(v => !query || v[1].toLowerCase().includes(query))
      .forEach(v => rows.push({ group: 'Go to', label: v[1], run: () => { closePalette(); if (typeof switchView === 'function') switchView(v[0]); } }));
    if (query && typeof state !== 'undefined') {
      (state.tasks || []).filter(t => t.name && t.name.toLowerCase().includes(query)).slice(0, 6)
        .forEach(t => rows.push({ group: 'Tasks', label: t.name, sub: (t.status || '').replace('-', ' '), run: () => { closePalette(); if (typeof openModal === 'function') openModal(t.id); } }));
      Object.keys(state.customFoods || {}).filter(f => f.toLowerCase().includes(query)).slice(0, 5)
        .forEach(f => rows.push({ group: 'Foods', label: f, sub: 'log in Diet', run: () => { closePalette(); if (typeof switchView === 'function') switchView('diet'); const inp = $('#dietAddInput'); if (inp) { inp.value = f; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); } } }));
      [...new Set((state.gym || []).map(e => e.exercise))].filter(x => x && x.toLowerCase().includes(query)).slice(0, 5)
        .forEach(x => rows.push({ group: 'Exercises', label: x, sub: 'open Training', run: () => { closePalette(); if (typeof switchView === 'function') switchView('gym'); const inp = $('#gymExerciseName'); if (inp) { inp.value = x; inp.focus(); } } }));
      // Cardio was searchable nowhere \u2014 "ride" or "run" now finds the log.
      [...new Set((state.cardio || []).map(c => c && c.type).filter(Boolean))]
        .filter(t => t.toLowerCase().includes(query)).slice(0, 3)
        .forEach(t => rows.push({
          group: 'Cardio', label: t.charAt(0).toUpperCase() + t.slice(1), sub: 'open Training',
          run: () => { closePalette(); if (typeof switchView === 'function') switchView('cardio'); },
        }));
      rows.push({ group: 'Command', label: `Run \u201c${q.trim()}\u201d as a command`, sub: 'e.g. log 40 oz water, add task pay rent tomorrow', cmd: true, run: () => { closePalette(); if (typeof runVoiceCommand === 'function') runVoiceCommand(q.trim()); } });
    }
    cmdRows = rows; cmdSel = 0;
    const host = $('#cmdResults');
    if (!rows.length) { host.innerHTML = '<div class="cmd-empty">No matches</div>'; return; }
    let lastGroup = '';
    host.innerHTML = rows.map((r, i) => {
      const head = r.group !== lastGroup ? `<div class="cmd-group">${r.group}</div>` : '';
      lastGroup = r.group;
      return head + `<div class="cmd-row${i === 0 ? ' sel' : ''}${r.cmd ? ' cmd-run' : ''}" data-idx="${i}">
          <span class="cmd-row-label">${escLabel(r.label)}</span>${r.sub ? `<span class="cmd-row-sub">${escLabel(r.sub)}</span>` : ''}</div>`;
    }).join('');
    $$('.cmd-row', host).forEach(el => {
      el.addEventListener('mouseenter', () => setPaletteSel(Number(el.dataset.idx)));
      el.addEventListener('click', () => { const r = cmdRows[Number(el.dataset.idx)]; if (r) r.run(); });
    });
  }
  function setPaletteSel(i) {
    cmdSel = Math.max(0, Math.min(cmdRows.length - 1, i));
    $$('.cmd-row').forEach(el => el.classList.toggle('sel', Number(el.dataset.idx) === cmdSel));
    const sel = $('.cmd-row.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function paletteKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteSel(cmdSel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteSel(cmdSel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = cmdRows[cmdSel]; if (r) r.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  }

  // ---------- Wrap globals so our extras rebuild on every render ----------
  function wrap(name, extra) {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__daylignWrapped) return;
    const wrapped = function () {
      const r = fn.apply(this, arguments);
      try { extra(); } catch (e) { /* never let an extra break the app */ }
      return r;
    };
    wrapped.__daylignWrapped = true;
    window[name] = wrapped;
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

    // The centre + is the same primary action as the FAB and the header button.
    const addBtn = $('#bottomNavAdd');
    if (addBtn) addBtn.addEventListener('click', () => {
      const primary = document.getElementById('primaryFab') || document.getElementById('addTaskBtn');
      if (primary) primary.click();
    });

    // Sidebar search and its Ctrl K hint both open the command palette.
    const sideSearch = $('#sidebarSearch');
    if (sideSearch) sideSearch.addEventListener('click', () => {
      if (typeof window.openPalette === 'function') window.openPalette();
      else { const i = document.getElementById('searchInput'); if (i) i.focus(); }
    });

    $$('.bms-btn').forEach(b => b.addEventListener('click', () => setBoardCol(b.dataset.col)));
    setBoardCol('todo');
    updateBoardCounts();
    $$('.nav-btn, .more-item, .bottom-nav-btn').forEach(b => b.addEventListener('click', () => setTimeout(updateBoardCounts, 80)));

    // Cmd/Ctrl-K → the command palette (fuzzy search across the app + run NL commands)
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openPalette();
      }
      if (e.key === 'Escape') closeMore();
    });

    setupServingStepper();

    // Hook renders and paint our extras once for the initial view.
    wrap('renderDiet', function () { setupServingStepper(); updateAddLabel(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
