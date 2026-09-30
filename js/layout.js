// ========== Arrange Today (spec 4.7) ==========
// The Today screen is a fixed skeleton with three movable sections in it.
//
// Locked, by the owner's rule: the now block (health numbers are always on
// screen) and the line (it IS the screen). Movable: Brief and actions, Due
// soon, This week. Saved layouts live here too — they used to be in Settings,
// two screens away from the thing they rearrange.
//
// Two constraints from v2 still shape this:
//   1. Ordering is applied with CSS `order`, never by moving DOM nodes. Every
//      view re-renders by rewriting innerHTML, so moved nodes would be undone
//      constantly; `order` targets the containers, which survive.
//   2. The old edit mode dropped a drag handle INTO each card on the Today
//      screen and dragged with Pointer Events. That is gone: a sheet with
//      up/down buttons works with a finger, a mouse and a keyboard, and it
//      doesn't rearrange the page you are trying to read while you use it.

// Where the fixed parts sit. The movable sections take the gaps: the FIRST one
// goes above the line, the rest below it — so "move Due soon to the top" means
// "put it above the line", which is what the sheet's arrows appear to promise.
const LAYOUT_FIXED_ORDER = {
  '#nowBlockTop': 1,
  '#nowBlock': 2,
  '#dayLine': 15,
  '#dashboardView .today-arrange': 90,
  '#dashboardView .today-actions': 91,
};

function layoutOrder() {
  const p = readPrefs();
  const saved = p.order || [];
  // Anything not yet in the saved order keeps its natural position at the end,
  // so a newly added section can never disappear.
  const known = DASH_WIDGETS.map(w => w.key);
  return saved.filter(k => known.indexOf(k) !== -1)
    .concat(known.filter(k => saved.indexOf(k) === -1));
}

function applyLayout() {
  const order = layoutOrder();

  let tag = document.getElementById('layoutStyle');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'layoutStyle';
    document.head.appendChild(tag);
  }

  // Only `order` is written here. The display mode of #dashboardView (column
  // stack on a phone, two columns on desktop) lives in style.css: this tag is
  // appended to <head> last, so anything it declares beats the stylesheet, and
  // a `display` here would silently kill the desktop layout.
  let css = '';
  Object.keys(LAYOUT_FIXED_ORDER).forEach(sel => {
    css += sel + '{order:' + LAYOUT_FIXED_ORDER[sel] + ';}';
  });
  order.forEach((key, i) => {
    const w = DASH_WIDGETS.find(x => x.key === key);
    if (!w) return;
    css += w.sel + '{order:' + (i === 0 ? 10 : 19 + i) + ';}';
  });
  tag.textContent = css;
}

function layoutElFor(key) {
  const w = DASH_WIDGETS.find(x => x.key === key);
  return w ? document.querySelector(w.sel) : null;
}

// ---------- FLIP animation ----------
// Record where everything is, let the reorder happen, then animate each card
// from where it was to where it landed. Without this, `order` changes snap.
function captureRects() {
  const map = {};
  DASH_WIDGETS.forEach(w => {
    const el = document.querySelector(w.sel);
    if (el) map[w.key] = el.getBoundingClientRect();
  });
  return map;
}

function flipFrom(before) {
  if (document.documentElement.classList.contains('pref-reduce-motion')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  DASH_WIDGETS.forEach(w => {
    const el = document.querySelector(w.sel);
    const b = before[w.key];
    if (!el || !b) return;
    const a = el.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top;
    if (!dx && !dy) return;
    el.style.transition = 'none';
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    requestAnimationFrame(() => {
      el.style.transition = 'transform .32s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 340);
    });
  });
}

function moveWidget(key, dir) {
  const order = layoutOrder();
  const i = order.indexOf(key);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= order.length) return;

  const before = captureRects();
  order.splice(i, 1);
  order.splice(j, 0, key);
  const p = readPrefs();
  p.order = order;
  writePrefs(p);
  applyLayout();
  flipFrom(before);
  renderArrangeSheet();
}

function setWidgetHidden(key, hide) {
  const p = readPrefs();
  const h = new Set(p.hidden || []);
  if (hide) h.add(key); else h.delete(key);
  setPref('hidden', Array.from(h));   // setPref applies the prefs and re-renders Settings
  renderArrangeSheet();
}

// ---------- named layouts ----------
function savedLayouts() {
  return readPrefs().layouts || {};
}

function saveNamedLayout(name) {
  if (!name) return;
  const p = readPrefs();
  p.layouts = p.layouts || {};
  p.layouts[name] = { order: layoutOrder(), hidden: p.hidden || [] };
  writePrefs(p);
  renderArrangeSheet();
  if (typeof showToast === 'function') showToast('Saved layout "' + name + '"');
}

function applyNamedLayout(name) {
  const l = savedLayouts()[name];
  if (!l) return;
  const before = captureRects();
  const p = readPrefs();
  p.order = l.order || [];
  p.hidden = l.hidden || [];
  writePrefs(p);
  applyPrefs();
  applyLayout();
  flipFrom(before);
  renderArrangeSheet();
  if (typeof renderSettingsPrefsPanel === 'function') renderSettingsPrefsPanel();
  if (typeof showToast === 'function') showToast('Switched to "' + name + '"');
}

function deleteNamedLayout(name) {
  const p = readPrefs();
  if (!p.layouts || !p.layouts[name]) return;
  delete p.layouts[name];
  writePrefs(p);
  renderArrangeSheet();
}

// Which saved layout the screen currently matches, so the chips can show one as
// active instead of making you remember what you last applied.
function activeLayoutName() {
  const order = layoutOrder().join(',');
  const hidden = (readPrefs().hidden || []).slice().sort().join(',');
  const names = Object.keys(savedLayouts());
  for (const n of names) {
    const l = savedLayouts()[n];
    const lo = (l.order || []).filter(k => DASH_WIDGETS.some(w => w.key === k)).join(',');
    const lh = (l.hidden || []).slice().sort().join(',');
    if (lo === order && lh === hidden) return n;
  }
  return null;
}

// ---------- the sheet ----------
function renderArrangeSheet() {
  const host = document.getElementById('arrangeBody');
  if (!host) return;
  const p = readPrefs();
  const hidden = p.hidden || [];
  const order = layoutOrder();
  const names = Object.keys(savedLayouts());
  const active = activeLayoutName();

  const locked = DASH_LOCKED.map(r => `
    <div class="arr-row is-locked">
      <span class="ms">lock</span>
      <span class="arr-name">${esc(r.label)}</span>
      <span class="arr-note">${esc(r.note)}</span>
    </div>`).join('');

  const rows = order.map((key, i) => {
    const w = DASH_WIDGETS.find(x => x.key === key);
    if (!w) return '';
    const on = hidden.indexOf(key) === -1;
    return `
    <div class="arr-row">
      <span class="ms">drag_indicator</span>
      <span class="arr-name">${esc(w.label)}${w.desktop ? '<em>desktop</em>' : ''}</span>
      <span class="arr-moves">
        <button type="button" class="arr-move" data-lay-up="${key}" aria-label="Move ${esc(w.label)} up"${i === 0 ? ' disabled' : ''}><span class="ms">keyboard_arrow_up</span></button>
        <button type="button" class="arr-move" data-lay-down="${key}" aria-label="Move ${esc(w.label)} down"${i === order.length - 1 ? ' disabled' : ''}><span class="ms">keyboard_arrow_down</span></button>
      </span>
      <label class="dl-toggle">
        <input type="checkbox" data-lay-show-toggle="${key}" aria-label="Show ${esc(w.label)}"${on ? ' checked' : ''}>
        <span class="dl-toggle-track"></span>
      </label>
    </div>`;
  }).join('');

  host.innerHTML = `
    ${locked}
    ${rows}
    <div class="dl-field arr-layouts">
      <span class="dl-field-label">Saved layouts</span>
      <div class="arr-chips">
        ${names.map(n => `
          <span class="arr-chip${n === active ? ' on' : ''}">
            <button type="button" data-lay-apply="${esc(n)}">${esc(n)}</button>
            <button type="button" class="arr-chip-x" data-lay-del="${esc(n)}" aria-label="Delete layout ${esc(n)}">&times;</button>
          </span>`).join('')}
        <button type="button" class="arr-chip arr-chip-add" id="layoutSaveBtn"><span class="ms">add</span>Save current</button>
      </div>
      <input type="text" id="layoutName" class="arr-name-input" placeholder="Name this layout" maxlength="24" hidden>
    </div>
    <p class="arr-foot">Habits like the daily ride live on the line — turn one off in its own settings, not here.</p>`;
}

function openArrangeSheet() {
  renderArrangeSheet();
  if (typeof openDlSheet === 'function') openDlSheet(document.getElementById('arrangeSheet'));
}

// Bound once, on the document, because the sheet's contents are rewritten on
// every change — per-render listeners on a persistent container stack up.
let arrangeBound = false;
function bindLayoutEditor() {
  applyLayout();
  if (arrangeBound) return;
  arrangeBound = true;

  const openBtn = document.getElementById('arrangeBtn');
  if (openBtn) openBtn.addEventListener('click', openArrangeSheet);

  document.addEventListener('click', (e) => {
    const up = e.target.closest('[data-lay-up]');
    const down = e.target.closest('[data-lay-down]');
    const apply = e.target.closest('[data-lay-apply]');
    const del = e.target.closest('[data-lay-del]');
    if (up) moveWidget(up.dataset.layUp, -1);
    if (down) moveWidget(down.dataset.layDown, 1);
    if (apply) applyNamedLayout(apply.dataset.layApply);
    if (del) deleteNamedLayout(del.dataset.layDel);

    // Save current: first click reveals the name box, second saves it. One
    // field that is only there when it is needed, rather than an empty input
    // sitting in the sheet forever.
    if (e.target.closest('#layoutSaveBtn')) {
      const inp = document.getElementById('layoutName');
      if (!inp) return;
      if (inp.hidden) { inp.hidden = false; inp.focus(); return; }
      const name = (inp.value || '').trim();
      if (!name) { if (typeof showToast === 'function') showToast('Give the layout a name first'); inp.focus(); return; }
      saveNamedLayout(name);
    }
  });

  document.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-lay-show-toggle]');
    if (cb) setWidgetHidden(cb.dataset.layShowToggle, !cb.checked);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('#layoutName');
    if (!inp) return;
    e.preventDefault();
    const name = (inp.value || '').trim();
    if (name) saveNamedLayout(name);
  });
}

// Order must be on the page before first paint, like the accent.
applyLayout();
