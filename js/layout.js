// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { DASH_WIDGETS, applyPrefs, readPrefs, renderSettingsPrefsPanel, setPref, writePrefs } from './settings-prefs.js';
import { esc, showToast } from './utils.js';

// ========== Dashboard layout editor ==========
// Drag to reorder, resize (desktop), hide, and save named layouts.
//
// Two constraints shaped this:
//   1. HTML5 drag-and-drop fires no events from touch on iOS — the Board and
//      Schedule already prove that. So dragging here is built on Pointer
//      Events, which behave identically for finger, pen and mouse.
//   2. Ordering is applied with CSS `order` rather than moving DOM nodes.
//      Every view re-renders by rewriting innerHTML, so moved nodes would be
//      undone constantly; `order` survives because it targets the containers.
//
// Reordering works within a container, so the eight stacked sections reorder
// among themselves and the seven grid cards among themselves. Resize only
// applies to the grid cards, and only above the mobile breakpoint — at 390px
// every card is already full width, so "wide" would be meaningless.

export let layoutEditing = false;

export function layoutOrder() {
  const p = readPrefs();
  const saved = p.order || [];
  // Anything not yet in the saved order keeps its natural position at the end,
  // so a newly added widget can never disappear.
  const known = DASH_WIDGETS.map(w => w.key);
  return saved.filter(k => known.indexOf(k) !== -1)
    .concat(known.filter(k => saved.indexOf(k) === -1));
}

export function applyLayout() {
  const p = readPrefs();
  const order = layoutOrder();
  const wide = p.wide || [];

  let tag = document.getElementById('layoutStyle');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'layoutStyle';
    document.head.appendChild(tag);
  }

  let css = '#dashboardView.active{display:flex;flex-direction:column;}';
  order.forEach((key, i) => {
    const w = DASH_WIDGETS.find(x => x.key === key);
    if (w) css += w.sel + '{order:' + (i + 1) + ';}';
  });

  // Direct children of #dashboardView that are NOT managed widgets — the
  // project filter, and the .dashboard-grid wrapper itself — have no `order`,
  // which in flexbox means order:0, i.e. BEFORE everything given order 1+.
  // Without this the entire grid (sleep, readiness, deadlines, weight...)
  // jumped above the whole stack the moment any custom order was saved.
  // The grid takes the position of the earliest widget it actually contains.
  const rootForOrder = document.getElementById('dashboardView');
  const gridForOrder = rootForOrder && rootForOrder.querySelector('.dashboard-grid');
  if (gridForOrder) {
    let gridPos = null;
    order.forEach((key, i) => {
      const el = layoutElFor(key);
      if (el && el.parentElement === gridForOrder && gridPos === null) gridPos = i + 1;
    });
    css += '#dashboardView .dashboard-grid{order:' + (gridPos === null ? order.length + 1 : gridPos) + ';}';
  }
  // The project filter belongs with the controls at the top.
  css += '#dashboardView .dashboard-project-filter{order:0;}';
  // Wide cards span both grid columns. Scoped above the mobile breakpoint
  // because the grid is single-column on a phone anyway.
  const wideSels = wide.map(k => (DASH_WIDGETS.find(x => x.key === k) || {}).sel).filter(Boolean);
  if (wideSels.length) {
    css += '@media (min-width: 901px){' + wideSels.join(',') + '{grid-column:1 / -1;}}';
  }
  tag.textContent = css;

  // Reconcile which CONTAINER each widget lives in. CSS `order` only sorts
  // siblings, so moving a card past the boundary between the stacked sections
  // and the two-column grid means physically relocating the node — and that
  // has to be re-applied on every load, because the HTML always starts out in
  // its original arrangement.
  const rootEl = document.getElementById('dashboardView');
  const gridEl = rootEl && rootEl.querySelector('.dashboard-grid');
  const cont = p.container || {};
  if (rootEl && gridEl) {
    order.forEach(key => {
      const want = cont[key];
      if (!want) return;
      const el = layoutElFor(key);
      if (!el) return;
      if (want === 'root' && el.parentElement !== rootEl) rootEl.insertBefore(el, gridEl);
      else if (want === 'grid' && el.parentElement !== gridEl) gridEl.appendChild(el);
    });
  }
}

export function layoutElFor(key) {
  const w = DASH_WIDGETS.find(x => x.key === key);
  return w ? document.querySelector(w.sel) : null;
}

// ---------- edit mode ----------
export function layoutWidgetEls() {
  return DASH_WIDGETS.map(w => {
    const el = document.querySelector(w.sel);
    return el ? { key: w.key, label: w.label, el } : null;
  }).filter(Boolean);
}

export function toggleLayoutEdit(on) {
  layoutEditing = (on === undefined) ? !layoutEditing : !!on;
  document.documentElement.classList.toggle('layout-editing', layoutEditing);

  layoutWidgetEls().forEach(w => {
    const existing = w.el.querySelector(':scope > .layout-handle');
    if (!layoutEditing) { if (existing) existing.remove(); w.el.classList.remove('layout-item'); return; }
    w.el.classList.add('layout-item');
    if (existing) return;
    const bar = document.createElement('div');
    bar.className = 'layout-handle';
    bar.innerHTML =
      '<span class="layout-grip" aria-hidden="true">⠿</span>' +
      '<span class="layout-name">' + esc(w.label) + '</span>' +
      '<button type="button" class="layout-btn" data-lay-up="' + w.key + '" aria-label="Move up">↑</button>' +
      '<button type="button" class="layout-btn" data-lay-down="' + w.key + '" aria-label="Move down">↓</button>' +
      '<button type="button" class="layout-btn" data-lay-hide="' + w.key + '" aria-label="Hide">✕</button>';
    w.el.insertBefore(bar, w.el.firstChild);
    attachLayoutDrag(bar, w.key);
  });

  const btn = document.getElementById('layoutEditBtn');
  if (btn) btn.textContent = layoutEditing ? 'Done' : 'Edit layout';
  renderHiddenTray();
}

export function moveWidget(key, dir) {
  const order = layoutOrder();
  const i = order.indexOf(key);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= order.length) return;

  const el = layoutElFor(key);
  const other = layoutElFor(order[j]);
  if (!el || !other) return;

  const before = captureRects();

  // Crossing between the stacked sections and the grid: move the node itself,
  // then remember the new home so a reload doesn't undo it.
  if (el.parentElement !== other.parentElement) {
    if (dir < 0) other.parentElement.insertBefore(el, other);
    else other.parentElement.insertBefore(el, other.nextSibling);
    const rootEl = document.getElementById('dashboardView');
    const p2 = readPrefs();
    p2.container = p2.container || {};
    p2.container[key] = (el.parentElement === rootEl) ? 'root' : 'grid';
    writePrefs(p2);
  }

  order.splice(i, 1);
  order.splice(j, 0, key);
  const p = readPrefs();
  p.order = order;
  writePrefs(p);
  applyLayout();
  flipFrom(before);
  renderHiddenTray();
}

// ---------- FLIP animation ----------
// Record where everything is, let the reorder happen, then animate each card
// from where it was to where it landed. Without this, `order` changes snap.
export function captureRects() {
  const map = {};
  layoutWidgetEls().forEach(w => { map[w.key] = w.el.getBoundingClientRect(); });
  return map;
}

export function flipFrom(before) {
  if (document.documentElement.classList.contains('pref-reduce-motion')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  layoutWidgetEls().forEach(w => {
    const b = before[w.key];
    if (!b) return;
    const a = w.el.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top;
    if (!dx && !dy) return;
    w.el.style.transition = 'none';
    w.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    requestAnimationFrame(() => {
      w.el.style.transition = 'transform .32s cubic-bezier(0.22, 1, 0.36, 1)';
      w.el.style.transform = '';
      setTimeout(() => { w.el.style.transition = ''; }, 340);
    });
  });
}

// ---------- pointer drag ----------
// Pointer Events rather than HTML5 DnD, so this works with a finger on iOS.
export function attachLayoutDrag(handle, key) {
  let startY = 0, dragging = false, el = null;

  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.layout-btn')) return; // let the buttons work
    el = handle.parentElement;
    startY = e.clientY;
    dragging = true;
    el.classList.add('is-dragging');
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging || !el) return;
    const dy = e.clientY - startY;
    el.style.transform = 'translateY(' + dy + 'px)';

    // Once dragged past half a neighbour, commit the swap and re-anchor.
    const rect = el.getBoundingClientRect();
    const siblings = layoutWidgetEls().filter(w => w.el !== el && w.el.parentElement === el.parentElement);
    for (const s of siblings) {
      const r = s.el.getBoundingClientRect();
      const overlapDown = dy > 0 && rect.bottom > r.top + r.height / 2 && r.top > rect.top;
      const overlapUp = dy < 0 && rect.top < r.bottom - r.height / 2 && r.bottom < rect.bottom;
      if (overlapDown || overlapUp) {
        el.style.transform = '';
        el.style.transition = 'none';
        moveWidget(key, overlapDown ? 1 : -1);
        startY = e.clientY;
        requestAnimationFrame(() => { el.style.transition = ''; });
        break;
      }
    }
  });

  const end = (e) => {
    if (!dragging || !el) return;
    dragging = false;
    el.classList.remove('is-dragging');
    el.style.transform = '';
    try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

// ---------- hidden widgets tray ----------
// Hiding a widget used to be a one-way door from the dashboard — the only way
// back was buried in Settings. In edit mode the hidden ones now sit at the
// bottom as ghosts you can restore in place.
export function renderHiddenTray() {
  const rootEl = document.getElementById('dashboardView');
  if (!rootEl) return;
  let tray = document.getElementById('layoutHiddenTray');

  if (!layoutEditing) { if (tray) tray.remove(); return; }

  if (!tray) {
    tray = document.createElement('div');
    tray.id = 'layoutHiddenTray';
    tray.className = 'layout-tray';
    rootEl.appendChild(tray);
  }
  tray.style.order = '9999';

  const hidden = readPrefs().hidden || [];
  if (!hidden.length) {
    tray.innerHTML = '<div class="layout-tray-title">Hidden widgets</div>' +
      '<p class="layout-tray-empty">Nothing hidden. Tap ✕ on any widget to tuck it away — it will show up here.</p>';
    return;
  }
  tray.innerHTML = '<div class="layout-tray-title">Hidden widgets <span>' + hidden.length + '</span></div>' +
    '<div class="layout-tray-items">' + hidden.map(k => {
      const w = DASH_WIDGETS.find(x => x.key === k);
      if (!w) return '';
      return '<button type="button" class="layout-restore" data-lay-show="' + k + '">' +
        '<span class="layout-restore-plus">+</span>' + esc(w.label) + '</button>';
    }).join('') + '</div>';
}

// ---------- named layouts ----------
export function savedLayouts() {
  const p = readPrefs();
  return p.layouts || {};
}

export function saveNamedLayout(name) {
  if (!name) return;
  const p = readPrefs();
  p.layouts = p.layouts || {};
  p.layouts[name] = { order: layoutOrder(), hidden: p.hidden || [], wide: p.wide || [] };
  writePrefs(p);
  renderLayoutManager();
  if (typeof showToast === 'function') showToast('Saved layout "' + name + '"');
}

export function applyNamedLayout(name) {
  const l = savedLayouts()[name];
  if (!l) return;
  const before = captureRects();
  const p = readPrefs();
  p.order = l.order || [];
  p.hidden = l.hidden || [];
  p.wide = l.wide || [];
  writePrefs(p);
  applyPrefs();
  applyLayout();
  flipFrom(before);
  renderLayoutManager();
  if (typeof renderSettingsPrefsPanel === 'function') renderSettingsPrefsPanel();
  if (typeof showToast === 'function') showToast('Switched to "' + name + '"');
}

export function deleteNamedLayout(name) {
  const p = readPrefs();
  if (!p.layouts || !p.layouts[name]) return;
  delete p.layouts[name];
  writePrefs(p);
  renderLayoutManager();
}

export function renderLayoutManager() {
  const host = document.getElementById('layoutManager');
  if (!host) return;
  const names = Object.keys(savedLayouts());
  host.innerHTML =
    (names.length
      ? '<div class="layout-chips">' + names.map(n =>
          '<span class="layout-chip"><button type="button" data-lay-apply="' + esc(n) + '">' + esc(n) + '</button>' +
          '<button type="button" class="layout-chip-x" data-lay-del="' + esc(n) + '" aria-label="Delete ' + esc(n) + '">×</button></span>'
        ).join('') + '</div>'
      : '<p class="settings-desc">No saved layouts yet.</p>') +
    '<div class="layout-save"><input type="text" id="layoutName" placeholder="Layout name" maxlength="24">' +
    '<button type="button" class="btn-secondary" id="layoutSaveBtn">Save current</button></div>';
}

export function bindLayoutEditor() {
  applyLayout();
  renderLayoutManager();

  const btn = document.getElementById('layoutEditBtn');
  if (btn) btn.addEventListener('click', () => toggleLayoutEdit());

  // Delegated so the controls survive every re-render.
  document.addEventListener('click', (e) => {
    const up = e.target.closest('[data-lay-up]');
    const down = e.target.closest('[data-lay-down]');
    const hide = e.target.closest('[data-lay-hide]');
    const apply = e.target.closest('[data-lay-apply]');
    const del = e.target.closest('[data-lay-del]');
    if (up) { moveWidget(up.dataset.layUp, -1); }
    if (down) { moveWidget(down.dataset.layDown, 1); }
    if (hide) {
      const p = readPrefs();
      const h = new Set(p.hidden || []);
      h.add(hide.dataset.layHide);
      setPref('hidden', Array.from(h));
      renderHiddenTray();
      if (typeof showToast === 'function') showToast('Hidden — restore it from the tray below');
    }
    const show = e.target.closest('[data-lay-show]');
    if (show) {
      const p = readPrefs();
      const h = new Set(p.hidden || []);
      h.delete(show.dataset.layShow);
      setPref('hidden', Array.from(h));
      // The widget is back in the DOM flow, so it needs its handle again.
      if (layoutEditing) { toggleLayoutEdit(false); toggleLayoutEdit(true); }
      renderHiddenTray();
      if (typeof showToast === 'function') showToast('Restored');
    }
    if (apply) applyNamedLayout(apply.dataset.layApply);
    if (del) deleteNamedLayout(del.dataset.layDel);
    if (e.target.id === 'layoutSaveBtn') {
      const inp = document.getElementById('layoutName');
      const name = (inp && inp.value || '').trim();
      if (!name) { if (typeof showToast === 'function') showToast('Give the layout a name first'); return; }
      saveNamedLayout(name);
      if (inp) inp.value = '';
    }
  });
}

// Order must be on the page before first paint, like the accent.
applyLayout();


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { applyLayout: applyLayout, applyNamedLayout: applyNamedLayout, attachLayoutDrag: attachLayoutDrag, bindLayoutEditor: bindLayoutEditor, captureRects: captureRects, deleteNamedLayout: deleteNamedLayout, flipFrom: flipFrom, layoutElFor: layoutElFor, layoutOrder: layoutOrder, layoutWidgetEls: layoutWidgetEls, moveWidget: moveWidget, renderHiddenTray: renderHiddenTray, renderLayoutManager: renderLayoutManager, saveNamedLayout: saveNamedLayout, savedLayouts: savedLayouts, toggleLayoutEdit: toggleLayoutEdit });
