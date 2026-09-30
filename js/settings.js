// ========== Settings (spec 10.1) ==========
// One grouped index with a page behind each row. On a phone a row drills in
// and the arrow comes back; on a wide screen the index stays on the left and
// the page sits beside it.
//
// The pages themselves are static markup in index.html, and each piece is
// still filled by the module that owns it (goals by app.js, the key by
// preferences.js, usage by ai-usage.js...). This file owns the index, the
// navigation between pages, the categories manager, the sync and backup cards,
// and the one confirm sheet that replaced confirm() and prompt().
//
// Everything rendered here only READS state. Saving happens in the click and
// change handlers at the bottom.

let settingsPage = null;     // null = the index; otherwise a page key
let taxColorOpen = null;     // 'cat:<id>' / 'proj:<id>' whose colour row is open
let confirmAction = null;    // what the confirm sheet's button will run
let settingsBound = false;

function settingsWide() {
  return !!(window.matchMedia && window.matchMedia('(min-width: 1024px)').matches);
}

// A wide screen always has a page beside the index; a phone shows the index
// until a row is tapped.
function settingsShownPage() {
  return settingsPage || (settingsWide() ? 'profile' : null);
}

// innerHTML only when the markup actually changed. render() runs on every
// save and every sync echo, and rewriting an unchanged list would drop focus
// from whatever row or field the keyboard was on.
function setHtml(host, html) {
  if (!host || host._html === html) return false;
  host.innerHTML = html;
  host._html = html;
  return true;
}

function settingsIndexGroups() {
  const g = (typeof getGoals === 'function') ? getGoals() : {};
  const prefs = readPrefs();
  const mods = TOGGLEABLE_MODULES.filter(m => moduleEnabled(m.key)).map(m => m.label);
  const watch = (typeof lastExternalSyncDate === 'function') ? lastExternalSyncDate() : null;
  const theme = (typeof window.daylignThemePref === 'function') ? window.daylignThemePref() : 'system';

  let layout = (typeof activeLayoutName === 'function') ? activeLayoutName() : null;
  if (!layout) {
    const natural = DASH_WIDGETS.map(w => w.key).join();
    const isDefault = !(prefs.hidden || []).length && (typeof layoutOrder !== 'function' || layoutOrder().join() === natural);
    layout = isDefault ? 'Default' : 'Custom';
  }

  const ai = (typeof aiUsageSummary === 'function') ? aiUsageSummary(30) : { totals: { calls: 0, cost: 0 } };
  const sync = (typeof syncStatusInfo === 'function') ? syncStatusInfo() : { state: 'offline', label: 'On this device' };
  const conflicts = (typeof syncConflicts !== 'undefined') ? syncConflicts.length : 0;
  const reports = (typeof newInboxReports === 'function') ? newInboxReports().length : 0;
  const errors = (typeof recentErrors !== 'undefined') ? recentErrors.length : 0;

  return [
    { h: 'You', rows: [
      { go: 'profile', icon: 'person', t: 'Profile and goals',
        v: (g.weight ? g.weight + ' lb' : '') + (g.weight && g.calories ? ' · ' : '') + (g.calories ? Number(g.calories).toLocaleString('en-US') + ' kcal' : '') },
      { go: 'watch', icon: 'watch', t: 'Apple Watch', v: watch ? 'Connected' : 'Not set up' },
      { go: 'modules', icon: 'view_module', t: 'Modules', v: mods.length ? mods.join(', ') : 'All off' },
    ] },
    { h: 'Look', rows: [
      { go: 'look', icon: 'palette', t: 'Appearance', v: theme.charAt(0).toUpperCase() + theme.slice(1) },
      { go: 'cats', icon: 'sell', t: 'Categories and projects', v: state.categories.length + ' · ' + state.projects.length },
      { act: 'arrange', icon: 'dashboard_customize', t: 'Today layout', v: layout },
    ] },
    { h: 'Workouts', rows: [
      { go: 'workouts', icon: 'timer', t: 'Defaults', v: prefs.restSeconds + 's rest · ' + prefs.defaultSets + ' sets' },
    ] },
    { h: 'AI', rows: [
      { go: 'ai', icon: 'key', t: 'Anthropic key', v: (typeof readAiKey === 'function' && readAiKey()) ? 'Saved' : 'Not set' },
      { go: 'ai', anchor: 'aiUsageReport', icon: 'monitoring', t: 'AI usage',
        v: ai.totals.calls ? fmtUsd(ai.totals.cost) + ' last 30 days' : 'No calls yet' },
    ] },
    { h: 'Data', rows: [
      { go: 'data', icon: sync.state === 'error' || sync.state === 'offline' ? 'cloud_off' : 'cloud_done', t: 'Sync',
        v: conflicts ? conflicts + ' to review' : sync.label, warn: conflicts > 0 || sync.state === 'error' },
      { go: 'data', anchor: 'setBackup', icon: 'backup', t: 'Backup and restore', v: '' },
      { go: 'import', icon: 'upload_file', t: 'Import a spreadsheet', v: '' },
      { act: 'reports', icon: 'bug_report', t: 'Tester reports', v: reports ? String(reports) : '' },
    ] },
    { h: 'Help', rows: [
      { act: 'replay', icon: 'replay', t: 'Replay setup', v: '' },
      { go: 'errors', icon: 'error', t: 'Recent errors', v: String(errors) },
      { go: 'usage', icon: 'query_stats', t: 'How the app is used', v: '' },
    ] },
    { h: 'Profile', rows: [
      { act: 'switch', icon: 'swap_horiz', t: 'Switch profile', v: '', plain: true },
      { act: 'erase', icon: 'delete_forever', t: 'Start fresh', v: 'type ERASE', plain: true, danger: true },
    ] },
  ];
}

function renderSettingsIndex() {
  const host = document.getElementById('setIndex');
  if (!host) return;
  const shown = settingsShownPage();
  // Two rows can lead to one page (the key and its usage). Only the first is
  // marked current, so the highlight is one row, not a block.
  let marked = false;
  const html = settingsIndexGroups().map(grp => `
    <div class="set-group">
      <h3 class="set-group-h">${grp.h}</h3>
      <div class="set-list">
        ${grp.rows.map(r => {
          const current = settingsWide() && r.go && r.go === shown && !marked;
          if (current) marked = true;
          return `<button type="button" class="set-row${r.danger ? ' is-danger' : ''}"
            ${r.go ? `data-set-go="${r.go}"` : `data-set-act="${r.act}"`}${r.anchor ? ` data-set-anchor="${r.anchor}"` : ''}${current ? ' aria-current="page"' : ''}>
            <span class="ms" aria-hidden="true">${r.icon}</span>
            <span class="set-row-t">${r.t}</span>
            ${r.v ? `<span class="set-row-v${r.warn ? ' is-warn' : ''}">${esc(r.v)}</span>` : ''}
            ${r.plain ? '' : '<span class="ms set-row-chev" aria-hidden="true">chevron_right</span>'}
          </button>`;
        }).join('')}
      </div>
    </div>`).join('');
  setHtml(host, html);
}

function renderSettings() {
  const wrap = document.getElementById('setWrap');
  if (!wrap) return;
  bindSettings();
  renderSettingsIndex();
  const shown = settingsShownPage();
  wrap.classList.toggle('has-page', !!settingsPage);
  wrap.querySelectorAll('.set-page').forEach(p => { p.hidden = p.dataset.setPage !== shown; });

  if (typeof updateProfileSettingsCard === 'function') updateProfileSettingsCard();
  if (typeof renderGoalsSummary === 'function') renderGoalsSummary();
  if (typeof renderWatchConnect === 'function') renderWatchConnect();
  if (typeof renderModuleToggles === 'function') renderModuleToggles();
  renderTaxonomyManager();
  if (typeof renderSettingsPrefs === 'function') renderSettingsPrefs();
  if (typeof renderSettingsPrefsPanel === 'function') renderSettingsPrefsPanel();
  if (typeof renderAiUsageReport === 'function') renderAiUsageReport();
  renderSettingsSync();
  renderSyncConflicts();
  fillCsvProjects();
  if (typeof renderDiagnostics === 'function') renderDiagnostics();
}

// The way in from anywhere else: the sidebar's Manage link, a conflict toast,
// the spreadsheet import. `anchor` is an element id on the page to scroll to.
function openSettingsPage(page, anchor) {
  if (typeof currentView !== 'undefined' && currentView !== 'settings' && typeof switchView === 'function') switchView('settings');
  settingsPage = page || null;
  renderSettings();
  const pageEl = settingsPage ? document.querySelector('.set-page[data-set-page="' + settingsPage + '"]') : null;
  const target = (anchor && document.getElementById(anchor)) || pageEl;
  if (target && anchor) target.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
  // Move focus with the view, or a keyboard is left on a row that has just
  // scrolled away (phone) or on nothing at all.
  const head = pageEl && pageEl.querySelector('.set-head h2');
  if (head && !settingsWide()) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
}

function closeSettingsPage() {
  const was = settingsPage;
  settingsPage = null;
  renderSettings();
  window.scrollTo(0, 0);
  const row = was && document.querySelector('#setIndex [data-set-go="' + was + '"]');
  if (row) row.focus({ preventScroll: true });
}

// ---------- Sync status card ----------
function renderSettingsSync() {
  const el = document.getElementById('settingsSync');
  if (!el) return;
  const s = (typeof syncStatusInfo === 'function') ? syncStatusInfo() : { state: 'offline', label: 'On this device' };
  const who = (typeof currentProfile === 'function' && currentProfile()) ? currentProfile().name : '';
  let title = s.label, icon = 'cloud_done', tint = '', note = 'Saves on this device first, then to the cloud.', side = who, retry = false;
  if (s.state === 'synced') {
    title = 'Synced' + (s.at ? ' ' + relativeTime(s.at) : '');
    tint = ' tint c-move';
  } else if (s.state === 'saving') {
    icon = 'cloud_upload';
  } else if (s.state === 'connecting') {
    icon = 'cloud_sync';
  } else if (s.state === 'error') {
    title = 'Not saving to the cloud'; icon = 'cloud_off'; tint = ' tint c-food';
    note = s.message || 'Cloud sync failed. Your changes are saved on this device.';
    side = 'retries every 30s'; retry = true;
  } else {
    title = 'On this device only'; icon = 'cloud_off';
    note = 'Cloud sync is unavailable this session. Changes are saved on this device.';
  }
  el.className = 'dl-card set-sync' + tint;
  setHtml(el, `
    <div class="dl-card-h"><span class="set-sync-t"><span class="ms" aria-hidden="true">${icon}</span>${esc(title)}</span>${side ? `<em>${esc(side)}</em>` : ''}</div>
    <p class="set-sub">${esc(note)}</p>
    ${retry ? '<div class="set-btnrow"><button type="button" class="dl-btn" data-sync-retry>Retry now</button></div>' : ''}`);
}

// Called by the sync layer whenever the header pill changes.
function onSyncStatusChanged() {
  renderSettingsSync();
  renderSettingsIndex();
}

// ---------- Sync conflict notice (new in v3) ----------
const SYNC_KEY_LABELS = {
  tasks: 'Tasks', categories: 'Categories', projects: 'Projects', gym: 'Strength', cardio: 'Cardio',
  modules: 'Modules', diet: 'Food', customFoods: 'My foods', water: 'Water', events: 'Events',
  weight: 'Weigh-ins', goals: 'Goals', sleep: 'Sleep', aiUsage: 'AI usage', combos: 'Saved meals',
};
const SYNC_KEY_NOUNS = {
  tasks: ['task', 'tasks'], diet: ['food entry', 'food entries'], gym: ['exercise', 'exercises'],
  cardio: ['session', 'sessions'], events: ['event', 'events'], categories: ['category', 'categories'],
  projects: ['project', 'projects'], combos: ['saved meal', 'saved meals'], customFoods: ['food', 'foods'],
  sleep: ['night', 'nights'], weight: ['weigh-in', 'weigh-ins'],
};

// What a value amounts to, in words short enough for a button. null when a
// count would say nothing (goals, module switches).
function syncValueSummary(key, v) {
  if (key === 'water') {
    const day = (v && v[getTodayStr()]) || [];
    const list = Array.isArray(day) ? day : Object.values(day);
    return list.reduce((a, b) => a + (Number(b) || 0), 0) + ' oz';
  }
  const noun = SYNC_KEY_NOUNS[key];
  if (!noun) return null;
  const n = Array.isArray(v) ? v.length : Object.keys(v || {}).length;
  return n + ' ' + noun[n === 1 ? 0 : 1];
}

function renderSyncConflicts() {
  const host = document.getElementById('syncConflicts');
  if (!host) return;
  const list = (typeof syncConflicts !== 'undefined') ? syncConflicts : [];
  setHtml(host, list.map(c => {
    const label = SYNC_KEY_LABELS[c.key] || c.key;
    const mine = syncValueSummary(c.key, c.local), theirs = syncValueSummary(c.key, c.remote);
    const today = c.key === 'water' ? ' today' : '';
    let sub;
    if (mine && theirs && mine !== theirs) {
      sub = c.untouched
        ? `This device still has ${mine}${today}. The other device has ${theirs}.`
        : `We kept this device's value (${mine}${today}). The other device had ${theirs}.`;
    } else {
      sub = c.untouched
        ? 'This device still shows the older copy. The other device has a newer one.'
        : "We kept this device's copy. The other device's is different.";
    }
    const short = c.key === 'water' && mine !== theirs;
    return `
      <div class="dl-card tint c-food set-conflict">
        <div class="dl-card-h"><span>Another device changed ${esc(label)} while you typed</span></div>
        <p class="set-sub">${esc(sub)}</p>
        <div class="set-btnrow">
          <button type="button" class="dl-btn" data-conflict-use="${esc(c.key)}">${short ? 'Use ' + esc(theirs) : 'Use theirs'}</button>
          <button type="button" class="dl-btn" data-conflict-keep="${esc(c.key)}">${short ? 'Keep ' + esc(mine) : 'Keep mine'}</button>
        </div>
      </div>`;
  }).join(''));
}

// Called by the sync layer when the list changes. `fresh` names the keys that
// were not already waiting, so the same conflict never toasts twice.
function onSyncConflictsChanged(fresh) {
  renderSyncConflicts();
  renderSettingsIndex();
  if (fresh && fresh.length && typeof showToast === 'function') {
    const label = SYNC_KEY_LABELS[fresh[0]] || fresh[0];
    showToast('Another device changed ' + label + '. Tap to review', () => openSettingsPage('data'));
  }
}

// ---------- Categories and projects ----------
// The only manager. The sidebar used to have a second copy, with its own add
// buttons and a popup.
function renderTaxonomyManager() {
  const wrap = document.getElementById('taxonomyManager');
  if (!wrap) return;
  const row = (item, kind, count, noun) => {
    const open = taxColorOpen === kind + ':' + item.id;
    const key = CATEGORY_COLOR_KEYS.indexOf(item.color) !== -1 ? item.color : '';
    return `
    <div class="set-tax${key ? ' c-' + key : ''}" data-tax="${kind}" data-id="${esc(item.id)}">
      <div class="set-tax-row">
        <span class="set-tax-sw" aria-hidden="true"></span>
        <input type="text" class="set-tax-name" value="${esc(item.name)}" maxlength="30" aria-label="Name of ${esc(item.name)}" data-tax-name>
        <span class="set-tax-count">${count} ${noun}</span>
        <button type="button" class="set-tax-btn" data-tax-color aria-expanded="${open}" aria-label="Colour for ${esc(item.name)}"><span class="ms" aria-hidden="true">palette</span></button>
        <button type="button" class="set-tax-btn" data-tax-del aria-label="Delete ${esc(item.name)}"><span class="ms" aria-hidden="true">close</span></button>
      </div>
      ${open ? `<div class="set-tax-colors" role="group" aria-label="Colour for ${esc(item.name)}">
        ${CATEGORY_COLOR_KEYS.map(k => `<button type="button" class="set-swatch c-${k}" data-tax-swatch="${k}" aria-pressed="${k === key}" aria-label="${TAX_COLOR_NAMES[k] || k}"></button>`).join('')}
      </div>` : ''}
    </div>`;
  };
  const group = (kind, title, items, count, noun, placeholder) => `
    <div class="set-group">
      <h3 class="set-group-h">${title}</h3>
      <div class="set-list set-tax-list">
        ${items.map(i => row(i, kind, count(i), noun)).join('') || `<p class="set-empty">No ${title.toLowerCase()} yet.</p>`}
      </div>
      <div class="set-tax-add">
        <input type="text" data-tax-add="${kind}" placeholder="${placeholder}" maxlength="30" aria-label="${placeholder}">
        <button type="button" class="dl-btn" data-tax-add-btn="${kind}"><span class="ms" aria-hidden="true">add</span>Add</button>
      </div>
    </div>`;

  // Whatever is half-typed in an add field survives the rewrite.
  const typed = {};
  wrap.querySelectorAll('[data-tax-add]').forEach(i => { typed[i.dataset.taxAdd] = i.value; });
  const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.taxAdd : null;

  const changed = setHtml(wrap,
    group('cat', 'Categories', state.categories, c => state.tasks.filter(t => t.category === c.id).length, 'tasks', 'New category') +
    group('proj', 'Projects', state.projects, p => state.tasks.filter(t => t.project === p.id && t.status !== 'done').length, 'open', 'New project'));
  if (!changed) return;
  wrap.querySelectorAll('[data-tax-add]').forEach(i => {
    if (typed[i.dataset.taxAdd]) i.value = typed[i.dataset.taxAdd];
    if (focused === i.dataset.taxAdd) i.focus();
  });
}

const TAX_COLOR_NAMES = { meet: 'Rose', move: 'Green', food: 'Orange', habit: 'Amber', water: 'Teal', sleep: 'Indigo' };

function taxItem(kind, id) {
  return (kind === 'cat' ? state.categories : state.projects).find(x => x.id === id);
}

function renameTaxItem(kind, id, name) {
  const item = taxItem(kind, id);
  const clean = String(name || '').trim();
  if (!item || !clean || clean === item.name) { renderTaxonomyManagerFresh(); return; }
  item.name = clean;   // the id stays, so tasks filed under it stay filed
  saveData(state);
  render();
}

// A rename that was abandoned (emptied, or unchanged) has to put the stored
// name back in the field, and the memo in setHtml would otherwise skip it.
function renderTaxonomyManagerFresh() {
  const wrap = document.getElementById('taxonomyManager');
  if (wrap) wrap._html = null;
  renderTaxonomyManager();
}

function setTaxColor(kind, id, color) {
  const item = taxItem(kind, id);
  if (!item || CATEGORY_COLOR_KEYS.indexOf(color) === -1) return;
  item.color = color;
  taxColorOpen = null;
  saveData(state);
  render();
}

// Delete, with the way back in the toast. It used to be a confirm() dialog,
// which protects against a stray tap but offers nothing a second later.
function deleteTaxItem(kind, id) {
  const item = taxItem(kind, id);
  if (!item) return;
  const listKey = kind === 'cat' ? 'categories' : 'projects';
  const field = kind === 'cat' ? 'category' : 'project';
  const at = state[listKey].indexOf(item);
  const taskIds = state.tasks.filter(t => t[field] === id).map(t => t.id);
  const empty = kind === 'cat' ? '' : null;

  state[listKey] = state[listKey].filter(x => x.id !== id);
  state.tasks.forEach(t => { if (t[field] === id) t[field] = empty; });
  if (kind === 'proj' && typeof activeProject !== 'undefined' && activeProject === id) activeProject = null;
  saveData(state);
  render();

  const n = taskIds.length;
  const what = kind === 'cat' ? 'uncategorised' : 'moved out';
  showToast(`Deleted ${item.name}${n ? ` · ${n} task${n === 1 ? '' : 's'} ${what}` : ''} · Undo`, () => {
    if (state[listKey].some(x => x.id === id)) return;
    state[listKey].splice(Math.min(at, state[listKey].length), 0, item);
    state.tasks.forEach(t => { if (taskIds.indexOf(t.id) !== -1 && (t[field] === empty || t[field] == null)) t[field] = id; });
    saveData(state);
    render();
  });
}

function addTaxFromInput(kind) {
  const el = document.querySelector('#taxonomyManager [data-tax-add="' + kind + '"]');
  if (!el) return;
  const ok = kind === 'cat' ? addCategoryNamed(el.value) : addProjectNamed(el.value);
  if (!ok) return;
  el.value = '';
  // render() has rewritten the list; the field is a new node.
  const again = document.querySelector('#taxonomyManager [data-tax-add="' + kind + '"]');
  if (again) { again.value = ''; again.focus(); }
}

// ---------- Confirm sheet ----------
// One sheet for every "are you sure", with an optional word to type. Replaces
// confirm() and prompt(), which cannot be styled, cannot be tested, and on an
// installed PWA show the site's URL as their title.
//   askConfirm({ title, body (html), word, confirmLabel, danger, onConfirm })
function askConfirm(opts) {
  const wrap = document.getElementById('confirmSheet');
  if (!wrap) return;
  confirmAction = opts.onConfirm || null;
  document.getElementById('confirmTitle').textContent = opts.title || 'Are you sure?';
  document.getElementById('confirmBody').innerHTML = `
    <div class="cf-text">${opts.body || ''}</div>
    ${opts.word ? `
      <div class="dl-field">
        <label for="confirmWord">Type ${esc(opts.word)} to confirm</label>
        <input type="text" id="confirmWord" data-word="${esc(opts.word)}" autocomplete="off" autocapitalize="characters" spellcheck="false">
      </div>` : ''}
    <div class="cf-actions">
      <button type="button" class="dl-btn" data-cf-cancel>Cancel</button>
      <button type="button" class="dl-btn ${opts.danger ? 'cf-danger' : 'primary'}" data-cf-ok${opts.word ? ' disabled' : ''}>${esc(opts.confirmLabel || 'Confirm')}</button>
    </div>`;
  openDlSheet(wrap);
  const input = document.getElementById('confirmWord');
  if (input) setTimeout(() => input.focus({ preventScroll: true }), 60);
}

function closeConfirm() {
  confirmAction = null;
  closeDlSheet(document.getElementById('confirmSheet'));
}

function bindConfirmSheet() {
  const wrap = document.getElementById('confirmSheet');
  if (!wrap) return;
  const ready = () => {
    const input = document.getElementById('confirmWord');
    return !input || input.value.trim().toUpperCase() === input.dataset.word;
  };
  const run = () => {
    if (!ready()) return;
    const fn = confirmAction;
    closeConfirm();
    if (typeof fn === 'function') fn();
  };
  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-cf-cancel]')) { closeConfirm(); return; }
    if (e.target.closest('[data-cf-ok]')) run();
  });
  wrap.addEventListener('input', e => {
    if (e.target.id !== 'confirmWord') return;
    const ok = wrap.querySelector('[data-cf-ok]');
    if (ok) ok.disabled = !ready();
  });
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'confirmWord') { e.preventDefault(); run(); }
  });
  // Dismissed by the backdrop, Esc or a swipe: forget what it was about to do.
  wrap.addEventListener('dl-sheet-close', () => { confirmAction = null; });
}

// ---------- Backup and restore ----------
function backupShape(data) {
  return !!data && typeof data === 'object' && !Array.isArray(data) &&
    Object.keys(CLOUD_KEYS).some(k => data[k] !== undefined);
}

function readBackupFile(e) {
  const input = e.target;
  const file = input.files && input.files[0];
  input.value = '';   // so the same file can be chosen again
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data = null;
    try { data = JSON.parse(reader.result); } catch (err) { data = null; }
    if (!backupShape(data)) { showToast('That file is not a Daylign backup'); return; }
    openRestoreSheet(data);
  };
  reader.onerror = () => showToast('Could not read that file');
  reader.readAsText(file);
}

// Says what the backup holds next to what is here now, so restoring an old
// file over a newer app is a decision and not an accident.
function openRestoreSheet(data) {
  const list = (v) => (Array.isArray(v) ? v : []);
  const days = (v) => new Set(list(v).map(x => x && x.date)).size;
  const when = data.exportedAt && !isNaN(new Date(data.exportedAt))
    ? new Date(data.exportedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'an unknown date';
  const newDiet = list(data.diet).length, curDiet = list(state.diet).length;
  const newDays = days(data.diet), curDays = days(state.diet);
  const smaller = newDiet < curDiet || newDays < curDays || list(data.tasks).length < list(state.tasks).length;
  askConfirm({
    title: 'Restore this backup?',
    body: `
      <p>Made ${esc(when)}. It holds <b>${list(data.tasks).length}</b> tasks and <b>${newDiet}</b> food entries across <b>${newDays}</b> day${newDays === 1 ? '' : 's'}.</p>
      <p>Right now you have <b>${list(state.tasks).length}</b> tasks and <b>${curDiet}</b> food entries across <b>${curDays}</b> day${curDays === 1 ? '' : 's'}.</p>
      ${smaller ? '<p class="cf-warn">This backup holds less than what you have now. Anything newer than it will be gone.</p>' : ''}
      <p>Restoring replaces everything on this device and in the cloud, on all your devices. A safety copy of what you have now downloads first.</p>`,
    word: 'RESTORE',
    confirmLabel: 'Restore',
    danger: true,
    onConfirm: () => applyBackup(data),
  });
}

// ---------- Spreadsheet import ----------
function fillCsvProjects() {
  const sel = document.getElementById('csvProject');
  if (!sel) return;
  const keep = sel.value;
  const changed = setHtml(sel, '<option value="">No project</option>' +
    (state.projects || []).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(''));
  if (changed) sel.value = (state.projects || []).some(p => p.id === keep) ? keep : '';
}

// ---------- Events ----------
// #settingsView is never rebuilt, so everything is delegated from it once.
function bindSettings() {
  if (settingsBound) return;
  const view = document.getElementById('settingsView');
  if (!view) return;
  settingsBound = true;
  bindConfirmSheet();

  const ACTIONS = {
    arrange: () => { switchView('today'); if (typeof openArrangeSheet === 'function') openArrangeSheet(); },
    reports: () => switchView('board'),
    replay: () => { if (typeof startOnboarding === 'function') startOnboarding({ replay: true }); },
    switch: () => { if (typeof switchProfile === 'function') switchProfile(); },
    erase: () => { if (typeof resetCurrentProfileData === 'function') resetCurrentProfileData(); },
  };

  view.addEventListener('click', e => {
    const go = e.target.closest('[data-set-go]');
    if (go) { openSettingsPage(go.dataset.setGo, go.dataset.setAnchor); return; }
    if (e.target.closest('[data-set-back]')) { closeSettingsPage(); return; }
    const act = e.target.closest('[data-set-act]');
    if (act && ACTIONS[act.dataset.setAct]) { ACTIONS[act.dataset.setAct](); return; }

    const themeBtn = e.target.closest('[data-theme-pref]');
    if (themeBtn) {
      if (typeof window.daylignSetTheme === 'function') window.daylignSetTheme(themeBtn.dataset.themePref);
      renderSettings();
      return;
    }

    if (e.target.closest('[data-sync-retry]')) { if (typeof retrySync === 'function') retrySync(); return; }
    const use = e.target.closest('[data-conflict-use]');
    if (use) { if (resolveSyncConflict(use.dataset.conflictUse, true)) showToast('Using the other device’s copy'); return; }
    const keep = e.target.closest('[data-conflict-keep]');
    if (keep) { if (resolveSyncConflict(keep.dataset.conflictKeep, false)) showToast('Kept this device’s copy'); return; }

    if (e.target.closest('#exportBtn')) { exportBackup(); showToast('Backup downloaded'); return; }
    if (e.target.closest('#importBtn')) { document.getElementById('importFile').click(); return; }
    if (e.target.closest('#editGoalsSettingsBtn')) { if (typeof openGoalsModal === 'function') openGoalsModal(); return; }
    if (e.target.closest('#usageLoadBtn')) { if (typeof loadUsageReport === 'function') loadUsageReport(); return; }

    const tax = e.target.closest('.set-tax');
    if (tax) {
      const kind = tax.dataset.tax, id = tax.dataset.id;
      if (e.target.closest('[data-tax-color]')) {
        taxColorOpen = taxColorOpen === kind + ':' + id ? null : kind + ':' + id;
        renderTaxonomyManager();
        const btn = document.querySelector(`.set-tax[data-tax="${kind}"][data-id="${CSS.escape(id)}"] [data-tax-color]`);
        if (btn) btn.focus();
        return;
      }
      const sw = e.target.closest('[data-tax-swatch]');
      if (sw) { setTaxColor(kind, id, sw.dataset.taxSwatch); return; }
      if (e.target.closest('[data-tax-del]')) { deleteTaxItem(kind, id); return; }
    }
    const add = e.target.closest('[data-tax-add-btn]');
    if (add) addTaxFromInput(add.dataset.taxAddBtn);
  });

  // A rename commits when the field loses focus or Enter is pressed.
  view.addEventListener('change', e => {
    const name = e.target.closest('[data-tax-name]');
    if (!name) return;
    const tax = name.closest('.set-tax');
    renameTaxItem(tax.dataset.tax, tax.dataset.id, name.value);
  });
  view.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.matches('[data-tax-name]')) { e.target.blur(); return; }
    if (e.target.matches('[data-tax-add]')) addTaxFromInput(e.target.dataset.taxAdd);
  });

  const file = document.getElementById('importFile');
  if (file) file.addEventListener('change', readBackupFile);

  // The index is beside the page on a wide screen and replaces it on a phone,
  // so crossing the breakpoint changes what should be showing.
  if (window.matchMedia) window.matchMedia('(min-width: 1024px)').addEventListener('change', renderSettings);
}
