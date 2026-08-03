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

let layoutEditing = false;

function layoutOrder() {
  const p = readPrefs();
  const saved = p.order || [];
  // Anything not yet in the saved order keeps its natural position at the end,
  // so a newly added widget can never disappear.
  const known = DASH_WIDGETS.map(w => w.key);
  return saved.filter(k => known.indexOf(k) !== -1)
    .concat(known.filter(k => saved.indexOf(k) === -1));
}

function applyLayout() {
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
  // Wide cards span both grid columns. Scoped above the mobile breakpoint
  // because the grid is single-column on a phone anyway.
  const wideSels = wide.map(k => (DASH_WIDGETS.find(x => x.key === k) || {}).sel).filter(Boolean);
  if (wideSels.length) {
    css += '@media (min-width: 901px){' + wideSels.join(',') + '{grid-column:1 / -1;}}';
  }
  tag.textContent = css;
}

// ---------- edit mode ----------
function layoutWidgetEls() {
  return DASH_WIDGETS.map(w => {
    const el = document.querySelector(w.sel);
    return el ? { key: w.key, label: w.label, el } : null;
  }).filter(Boolean);
}

function toggleLayoutEdit(on) {
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
}

function moveWidget(key, dir) {
  const order = layoutOrder();
  const i = order.indexOf(key);
  if (i === -1) return;
  // Only swap with a neighbour that shares a container — ordering across
  // containers is not something CSS `order` can express.
  const el = document.querySelector((DASH_WIDGETS.find(w => w.key === key) || {}).sel);
  if (!el) return;
  const parent = el.parentElement;
  let j = i + dir;
  while (j >= 0 && j < order.length) {
    const other = document.querySelector((DASH_WIDGETS.find(w => w.key === order[j]) || {}).sel);
    if (other && other.parentElement === parent) break;
    j += dir;
  }
  if (j < 0 || j >= order.length) return;

  const before = captureRects();
  order.splice(i, 1);
  order.splice(j, 0, key);
  const p = readPrefs();
  p.order = order;
  writePrefs(p);
  applyLayout();
  flipFrom(before);
}

// ---------- FLIP animation ----------
// Record where everything is, let the reorder happen, then animate each card
// from where it was to where it landed. Without this, `order` changes snap.
function captureRects() {
  const map = {};
  layoutWidgetEls().forEach(w => { map[w.key] = w.el.getBoundingClientRect(); });
  return map;
}

function flipFrom(before) {
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
function attachLayoutDrag(handle, key) {
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

// ---------- named layouts ----------
function savedLayouts() {
  const p = readPrefs();
  return p.layouts || {};
}

function saveNamedLayout(name) {
  if (!name) return;
  const p = readPrefs();
  p.layouts = p.layouts || {};
  p.layouts[name] = { order: layoutOrder(), hidden: p.hidden || [], wide: p.wide || [] };
  writePrefs(p);
  renderLayoutManager();
  if (typeof showToast === 'function') showToast('Saved layout "' + name + '"');
}

function applyNamedLayout(name) {
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

function deleteNamedLayout(name) {
  const p = readPrefs();
  if (!p.layouts || !p.layouts[name]) return;
  delete p.layouts[name];
  writePrefs(p);
  renderLayoutManager();
}

function renderLayoutManager() {
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

function bindLayoutEditor() {
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
      if (typeof showToast === 'function') showToast('Hidden — re-enable in Settings');
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
