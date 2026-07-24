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

  // ---------- More sheet ----------
  function openMore() { const m = $('#moreSheet'); if (m) m.classList.add('open'); }
  function closeMore() { const m = $('#moreSheet'); if (m) m.classList.remove('open'); }

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
  function tileByLabel(label) {
    return $$('#healthGrid .health-tile').find(t => {
      const l = $('.health-tile-label', t);
      return l && l.textContent.trim() === label;
    });
  }
  function tileValue(label) {
    const t = tileByLabel(label); if (!t) return null;
    const v = $('.health-tile-value', t); if (!v) return null;
    const main = (v.childNodes[0] && v.childNodes[0].textContent || '').trim();
    const small = $('small', v);
    return { main, sub: small ? small.textContent.trim() : '' };
  }
  function tilePct(label) {
    const t = tileByLabel(label); if (!t) return 0;
    const f = $('.health-bar-fill', t);
    if (!f) return 0;
    const w = parseFloat(f.style.width) || 0;
    return Math.max(0, Math.min(100, w));
  }
  function buildTodayHero() {
    const host = $('#todayHero');
    if (!host) return;
    const net = tileValue('Net Cals') || tileValue('Calories');
    const cal = tileValue('Calories');
    const protein = tileValue('Protein');
    const water = tileValue('Water');
    const pct = tilePct('Calories');
    const focusEl = $('.weekly-focus strong');
    const focus = focusEl ? focusEl.textContent.trim() : '';

    const chips = [];
    if (protein) chips.push(`<span class="th-chip th-chip-green">${protein.main}${protein.sub ? ' <em>' + protein.sub + '</em>' : ''} protein</span>`);
    if (water) chips.push(`<span class="th-chip th-chip-blue">${water.main} water</span>`);
    if (cal) chips.push(`<span class="th-chip th-chip-accent">${cal.main}${cal.sub ? ' <em>' + cal.sub + '</em>' : ''} cal</span>`);

    const hour = new Date().getHours();
    const partOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const who = (typeof currentProfile === 'function' && currentProfile()) ? currentProfile().name : '';

    host.innerHTML = `
      <div class="th-greeting">${partOfDay}${who ? ', ' + who : ''} <span class="th-wave">👋</span></div>
      <div class="today-hero">
        <div class="th-ring" style="background:conic-gradient(var(--accent) 0 ${pct}%, var(--border) ${pct}% 100%)">
          <div class="th-ring-inner">
            <span class="th-ring-val">${net ? net.main : '—'}</span>
            <span class="th-ring-lbl">net kcal</span>
          </div>
        </div>
        <div class="th-body">
          <div class="th-label">${focus ? "This week's focus" : 'Today'}</div>
          <div class="th-text">${focus || 'Log your day and your focus for the week shows up here.'}</div>
          ${chips.length ? `<div class="th-chips">${chips.join('')}</div>` : ''}
        </div>
      </div>`;
  }

  // ---------- Mobile calendar agenda ----------
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const PRIO_COLOR = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--blue)' };
  function buildAgenda() {
    const host = $('#calAgenda');
    if (!host || typeof calendarDate === 'undefined' || typeof state === 'undefined') return;
    const year = calendarDate.getFullYear(), month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = (typeof getTodayStr === 'function') ? getTodayStr() : '';
    const holidays = (typeof getUSHolidays === 'function') ? getUSHolidays(year) : [];
    const esc2 = (typeof esc === 'function') ? esc : (x => x);

    const groups = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const tasks = (state.tasks || []).filter(t => t.dueDate === dateStr && t.status !== 'done');
      const events = (state.events || []).filter(e => e.date === dateStr);
      const holiday = holidays.find(h => h.date === dateStr);
      if (!tasks.length && !events.length && !holiday) continue;
      groups.push({ dateStr, d, tasks, events, holiday });
    }

    if (!groups.length) {
      host.innerHTML = `<div class="agenda-empty">Nothing scheduled in ${MONTHS[month]} — double-tap a day in month view to add an event.</div>`;
      return;
    }

    host.innerHTML = groups.map(g => {
      const dObj = new Date(g.dateStr + 'T00:00:00');
      const isToday = g.dateStr === today;
      const isPast = g.dateStr < today;
      const dow = isToday ? 'Today' : dObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dateLbl = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const evRows = g.events
        .slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''))
        .map(e => `<div class="agenda-row" data-event-id="${e.id}" style="border-left-color:${e.color || 'var(--accent)'}">
            <span class="agenda-row-name">${esc2(e.name)}</span>
            ${e.time ? `<span class="agenda-row-sub">${e.time}</span>` : ''}
          </div>`).join('');
      const taskRows = g.tasks.map(t => `<div class="agenda-row" data-id="${t.id}" style="border-left-color:${PRIO_COLOR[t.priority] || 'var(--accent)'}">
            <span class="agenda-row-name">${esc2(t.name)}</span>
            <span class="agenda-row-sub agenda-due">due</span>
          </div>`).join('');
      const holRow = g.holiday ? `<div class="agenda-row agenda-holiday" style="border-left-color:var(--purple)">
            <span class="agenda-row-name">${esc2(g.holiday.name)}</span></div>` : '';
      return `<div class="agenda-day${isToday ? ' today' : ''}${isPast ? ' past' : ''}">
          <div class="agenda-day-head"><span class="agenda-dow">${dow}</span><span class="agenda-date">${dateLbl}</span></div>
          <div class="agenda-rows">${holRow}${evRows}${taskRows}</div>
        </div>`;
    }).join('');

    $$('.agenda-row[data-id]', host).forEach(el => {
      el.addEventListener('click', () => { if (typeof openModal === 'function') openModal(el.dataset.id); });
    });
    $$('.agenda-row[data-event-id]', host).forEach(el => {
      el.addEventListener('click', () => {
        const ev = (state.events || []).find(e => e.id === el.dataset.eventId);
        if (ev && typeof openEventModal === 'function') openEventModal(ev.date, ev);
      });
    });
  }

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
  const VIEWS = [['dashboard','Today'],['tasks','All Tasks'],['board','Board'],['calendar','Calendar'],['training','Training'],['diet','Diet'],['settings','Settings']];
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
  function renderPaletteResults(q) {
    const query = (q || '').trim().toLowerCase();
    const rows = [];
    VIEWS.filter(v => !query || v[1].toLowerCase().includes(query))
      .forEach(v => rows.push({ group: 'Go to', label: v[1], run: () => { closePalette(); if (typeof switchView === 'function') switchView(v[0]); } }));
    if (query && typeof state !== 'undefined') {
      (state.tasks || []).filter(t => t.name && t.name.toLowerCase().includes(query)).slice(0, 6)
        .forEach(t => rows.push({ group: 'Tasks', label: t.name, sub: (t.status || '').replace('-', ' '), run: () => { closePalette(); if (typeof openModal === 'function') openModal(t.id); } }));
      Object.keys(state.customFoods || {}).filter(f => f.toLowerCase().includes(query)).slice(0, 5)
        .forEach(f => rows.push({ group: 'Foods', label: f, sub: 'log in Diet', run: () => { closePalette(); if (typeof switchView === 'function') switchView('diet'); const inp = $('#dietFoodName'); if (inp) { inp.value = f; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); } } }));
      [...new Set((state.gym || []).map(e => e.exercise))].filter(x => x && x.toLowerCase().includes(query)).slice(0, 5)
        .forEach(x => rows.push({ group: 'Exercises', label: x, sub: 'open Training', run: () => { closePalette(); if (typeof switchView === 'function') switchView('gym'); const inp = $('#gymExerciseName'); if (inp) { inp.value = x; inp.focus(); } } }));
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
          <span class="cmd-row-label">${r.label}</span>${r.sub ? `<span class="cmd-row-sub">${r.sub}</span>` : ''}</div>`;
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

    const moreBtn = $('#moreNavBtn'); if (moreBtn) moreBtn.addEventListener('click', openMore);
    const sheet = $('#moreSheet'); if (sheet) sheet.addEventListener('click', e => { if (e.target === sheet) closeMore(); });
    $$('.more-item[data-view]').forEach(b => b.addEventListener('click', () => {
      if (typeof switchView === 'function') switchView(b.dataset.view);
      closeMore();
    }));

    const themeBtn = $('#themeToggleBtn'); if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const moreTheme = $('#moreThemeToggle'); if (moreTheme) moreTheme.addEventListener('click', toggleTheme);

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
    wrap('renderDashboard', buildTodayHero);
    wrap('renderCalendar', buildAgenda);
    wrap('renderDiet', function () { setupServingStepper(); updateAddLabel(); });
    buildTodayHero();
    buildAgenda();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
