// ========== Tester inbox ==========
// Reports filed through report.html land in /inbox — a node deliberately
// outside users/<id>, because the app subscribes to that one with .on() and a
// few base64 screenshots there would be re-downloaded on every sync.
//
// Nothing here writes into /inbox except a status flip, and the rules forbid
// even that from the public side: a filed report cannot be edited or deleted by
// whoever sent it. Accepting one COPIES it into tasks; the original is only
// marked handled, so there is always a record of what was actually reported
// versus what got written on the board.

let inboxReports = [];
let inboxBound = false;

function inboxRef() {
  if (typeof db === 'undefined' || !db || !db.ref) return null;
  try { return db.ref('inbox'); } catch (e) { return null; }
}

// Live, because the whole point is noticing a report without going to look.
function startInboxWatch() {
  const ref = inboxRef();
  if (!ref || inboxBound) return;
  inboxBound = true;
  ref.on('value', (snap) => {
    const val = snap.val() || {};
    inboxReports = Object.keys(val)
      .map(id => Object.assign({ id }, val[id]))
      .filter(r => r && r.title)
      .sort((a, b) => (b.at || 0) - (a.at || 0));
    renderInbox();
    renderInboxBadge();
  }, () => {
    // Rules not published yet, or offline. Not worth a toast — the panel just
    // stays hidden and the board is unaffected.
    inboxReports = [];
    renderInbox();
  });
}

function newInboxReports() {
  return inboxReports.filter(r => r.status !== 'accepted' && r.status !== 'dismissed');
}

// A count on the Board nav item, so a report is visible from anywhere.
function renderInboxBadge() {
  const n = newInboxReports().length;
  document.querySelectorAll('[data-view="board"]').forEach(el => {
    let dot = el.querySelector('.nav-inbox-badge');
    if (!n) { if (dot) dot.remove(); return; }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'nav-inbox-badge';
      el.appendChild(dot);
    }
    dot.textContent = n > 9 ? '9+' : String(n);
  });
}

function inboxWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago';
  return (typeof formatDate === 'function') ? formatDate(toLocalDateStr(d)) : d.toLocaleDateString();
}

function renderInbox() {
  const host = document.getElementById('inboxPanel');
  if (!host) return;
  const items = newInboxReports();
  if (!items.length) { host.hidden = true; host.innerHTML = ''; return; }
  host.hidden = false;

  host.innerHTML = `
    <div class="inbox-head">
      <span class="inbox-title">Reported by testers</span>
      <span class="inbox-count">${items.length}</span>
    </div>
    ${items.map(r => `
      <div class="inbox-card" data-report="${esc(r.id)}">
        <div class="inbox-card-top">
          <span class="inbox-card-title">${esc(r.title)}</span>
          ${r.project ? `<span class="inbox-chip">${esc(r.project)}</span>` : ''}
        </div>
        <div class="inbox-meta">${r.who ? esc(r.who) + ' · ' : ''}${esc(inboxWhen(r.at))}</div>
        ${r.detail ? `<div class="inbox-detail">${esc(r.detail)}</div>` : ''}
        ${Array.isArray(r.shots) && r.shots.length ? `
          <div class="inbox-shots">
            ${r.shots.map((s, i) => `<img class="inbox-shot" src="${esc(s)}" alt="screenshot ${i + 1}" data-shot="${esc(r.id)}:${i}">`).join('')}
          </div>` : ''}
        <div class="inbox-actions">
          <button type="button" class="btn-secondary inbox-dismiss" data-dismiss="${esc(r.id)}">Dismiss</button>
          <button type="button" class="btn-primary inbox-accept" data-accept="${esc(r.id)}">Add to board</button>
        </div>
      </div>`).join('')}`;

  host.querySelectorAll('[data-accept]').forEach(b =>
    b.addEventListener('click', () => acceptReport(b.dataset.accept)));
  host.querySelectorAll('[data-dismiss]').forEach(b =>
    b.addEventListener('click', () => setReportStatus(b.dataset.dismiss, 'dismissed')));
  // Tap a screenshot to see it full size — thumbnails are useless for a bug.
  host.querySelectorAll('[data-shot]').forEach(img =>
    img.addEventListener('click', () => openShot(img.src)));
}

function openShot(src) {
  const prev = document.getElementById('shotViewer');
  if (prev) prev.remove();
  const wrap = document.createElement('div');
  wrap.className = 'shot-viewer';
  wrap.id = 'shotViewer';
  wrap.innerHTML = `<img src="${esc(src)}" alt="screenshot"><button type="button" aria-label="Close">&times;</button>`;
  wrap.addEventListener('click', () => wrap.remove());
  document.body.appendChild(wrap);
}

// Marks the report handled. Never deletes: the original report is the record of
// what was actually said, which is worth keeping once it has been reworded into
// a task title.
function setReportStatus(id, status) {
  const ref = inboxRef();
  if (!ref) return;
  ref.child(id).child('status').set(status).catch(() => {
    if (typeof showToast === 'function') showToast('Could not update that report');
  });
}

// Copy into the board rather than move: tasks are the working surface, the
// report stays as filed.
function acceptReport(id) {
  const r = inboxReports.find(x => x.id === id);
  if (!r) return;

  const proj = (state.projects || []).find(p =>
    p && String(p.name).toLowerCase() === String(r.project || '').toLowerCase());

  const lines = [];
  if (r.detail) lines.push(r.detail);
  if (r.who) lines.push('Reported by ' + r.who);
  if (Array.isArray(r.shots) && r.shots.length) {
    lines.push(r.shots.length + ' screenshot' + (r.shots.length === 1 ? '' : 's') + ' in the tester inbox');
  }

  state.tasks.push({
    id: Date.now().toString(),
    name: r.title,
    description: lines.join('\n\n'),
    status: 'todo',
    category: proj ? 'work' : 'personal',
    project: proj ? proj.id : null,
    dueDate: '',
    subtasks: [],
    created: getTodayStr(),
    fromReport: r.id,
  });

  saveData(state);
  setReportStatus(id, 'accepted');
  if (typeof haptic === 'function') haptic('success');
  render();
}
