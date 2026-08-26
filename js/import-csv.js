// ========== CSV import ==========
// The BTC UAT findings live in a spreadsheet, which means they are not moving
// through anything — nobody can see what is open versus fixed without opening
// the file. This brings a sheet in as tasks so the board becomes the record.
//
// Deliberately paste-first: exporting a sheet to CSV and copying it is faster
// than a file picker on a phone, and it works from Google Sheets, Excel and
// Numbers without caring which.

// A real parser, not a split(','). UAT sheets are full of commas inside
// quoted cells ("Login fails, then redirects") and newlines inside a
// description, and a naive split silently shreds both.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  row.push(field);
  rows.push(row);
  // Trailing newline leaves one empty row; a sheet often ends with several.
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

// Header names people actually use, in the order they should win. A UAT sheet
// might call the summary "Issue", "Defect", "Title" or "Summary" — guessing
// from a fixed list beats making someone map columns by hand.
const CSV_FIELD_HINTS = {
  name:        ['title', 'summary', 'issue', 'defect', 'bug', 'task', 'name', 'description of issue'],
  description: ['description', 'details', 'detail', 'notes', 'steps', 'comments', 'expected'],
  status:      ['status', 'state', 'progress'],
  dueDate:     ['due', 'due date', 'target', 'deadline', 'eta'],
  who:         ['reported by', 'reporter', 'raised by', 'owner', 'assignee', 'tester'],
};

function guessColumns(header) {
  const norm = header.map(h => String(h || '').trim().toLowerCase());
  const map = {};
  Object.keys(CSV_FIELD_HINTS).forEach(field => {
    for (const hint of CSV_FIELD_HINTS[field]) {
      const i = norm.indexOf(hint);
      if (i !== -1 && !Object.values(map).includes(i)) { map[field] = i; return; }
    }
    // Nothing exact — accept a header that merely contains the hint.
    for (const hint of CSV_FIELD_HINTS[field]) {
      const i = norm.findIndex(h => h.includes(hint));
      if (i !== -1 && !Object.values(map).includes(i)) { map[field] = i; return; }
    }
  });
  return map;
}

// Sheets say "Open", "In Progress", "Closed", "Fixed", "Pass"... map the common
// ones and default to todo, because importing something as already-done when it
// is not is the costlier mistake.
function csvStatus(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'todo';
  if (/(done|closed|fixed|resolved|complete|pass)/.test(v)) return 'done';
  if (/(progress|doing|active|wip|testing|review)/.test(v)) return 'in-progress';
  return 'todo';
}

// Spreadsheets hand back dates in whatever the author's locale used. Only
// accept what is unambiguous; anything else imports with no due date rather
// than a wrong one.
function csvDate(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    // Ambiguous between US and rest-of-world unless one part is > 12.
    let a = Number(m[1]), b = Number(m[2]);
    let month = a, day = b;
    if (a > 12 && b <= 12) { day = a; month = b; }
    if (month > 12) return '';
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const t = Date.parse(v);
  return isFinite(t) ? toLocalDateStr(new Date(t)) : '';
}

function csvRowsToTasks(rows, map, projectId) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {           // row 0 is the header
    const r = rows[i];
    const pick = f => (map[f] !== undefined ? String(r[map[f]] || '').trim() : '');
    const name = pick('name');
    if (!name) continue;                            // no summary, no task
    const bits = [];
    const desc = pick('description');
    if (desc) bits.push(desc);
    const who = pick('who');
    if (who) bits.push('Reported by ' + who);
    out.push({
      name: name.slice(0, 200),
      description: bits.join('\n\n'),
      status: csvStatus(pick('status')),
      dueDate: csvDate(pick('dueDate')),
      project: projectId || null,
      category: projectId ? 'work' : 'personal',
    });
  }
  return out;
}

// ---- UI ----
let csvPreview = [];

function openCsvImport() {
  const old = document.getElementById('csvImport');
  if (old) old.remove();

  const projects = state.projects || [];
  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay active';
  wrap.id = 'csvImport';
  wrap.innerHTML = `
    <div class="modal csv-modal">
      <div class="modal-header">
        <div class="modal-header-left">
          <div>
            <h2>Import from a spreadsheet</h2>
            <p class="modal-subtitle">Paste the sheet, including its header row</p>
          </div>
        </div>
        <button class="modal-close" id="csvClose" aria-label="Close">&times;</button>
      </div>
      <div class="csv-body">
        <textarea id="csvText" class="csv-text" placeholder="Title,Status,Due,Reported by
Login fails on Safari,Open,2026-09-01,Rishi
Sleep shows 15 hours,In Progress,,Ana"></textarea>
        <div class="csv-row">
          <label for="csvProject">Add to project</label>
          <select id="csvProject">
            <option value="">No project</option>
            ${projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="csv-preview" id="csvPreviewBox" hidden></div>
      </div>
      <div class="csv-actions">
        <button type="button" class="btn-secondary" id="csvCancel">Cancel</button>
        <button type="button" class="btn-primary" id="csvGo" disabled>Import</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  document.getElementById('csvClose').addEventListener('click', close);
  document.getElementById('csvCancel').addEventListener('click', close);
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });

  const ta = document.getElementById('csvText');
  ta.addEventListener('input', refreshCsvPreview);
  document.getElementById('csvProject').addEventListener('change', refreshCsvPreview);
  document.getElementById('csvGo').addEventListener('click', runCsvImport);
  setTimeout(() => ta.focus(), 80);
}

// Preview before writing anything. An import that silently creates 60 wrong
// tasks is far worse than one that refuses.
function refreshCsvPreview() {
  const box = document.getElementById('csvPreviewBox');
  const go = document.getElementById('csvGo');
  const text = document.getElementById('csvText').value;
  const projectId = document.getElementById('csvProject').value || null;

  if (!text.trim()) { box.hidden = true; go.disabled = true; csvPreview = []; return; }

  const rows = parseCsv(text);
  if (rows.length < 2) {
    box.hidden = false;
    box.innerHTML = '<p class="csv-warn">Needs a header row and at least one row under it.</p>';
    go.disabled = true;
    return;
  }

  const map = guessColumns(rows[0]);
  csvPreview = csvRowsToTasks(rows, map, projectId);

  // NOT `if (!map.name)`: a matched column is an INDEX, and the title is
  // almost always column A, so the successful case was index 0 and read as
  // falsy. Every well-formed sheet was rejected with "no column looks like a
  // title" until this used an explicit undefined check.
  if (map.name === undefined) {
    box.hidden = false;
    box.innerHTML = `<p class="csv-warn">No column looks like a title. Rename one to
      <strong>Title</strong>, <strong>Summary</strong> or <strong>Issue</strong> and paste again.</p>
      <p class="csv-cols">Found: ${rows[0].map(h => esc(String(h).trim()) || '—').join(' · ')}</p>`;
    go.disabled = true;
    return;
  }

  const matched = Object.keys(map).map(f => `${f} &larr; ${esc(String(rows[0][map[f]]).trim())}`);
  const counts = csvPreview.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {});

  box.hidden = false;
  box.innerHTML = `
    <p class="csv-ok"><strong>${csvPreview.length}</strong> task${csvPreview.length === 1 ? '' : 's'} ready
      &middot; ${Object.keys(counts).map(k => `${counts[k]} ${k}`).join(', ')}</p>
    <p class="csv-cols">${matched.join('<br>')}</p>
    <div class="csv-rows">
      ${csvPreview.slice(0, 5).map(t => `
        <div class="csv-rowitem">
          <span class="csv-rowname">${esc(t.name)}</span>
          <span class="csv-rowmeta">${t.status}${t.dueDate ? ' &middot; due ' + esc(t.dueDate) : ''}</span>
        </div>`).join('')}
      ${csvPreview.length > 5 ? `<p class="csv-more">and ${csvPreview.length - 5} more</p>` : ''}
    </div>`;
  go.disabled = csvPreview.length === 0;
}

function runCsvImport() {
  if (!csvPreview.length) return;
  const stamp = Date.now();
  csvPreview.forEach((t, i) => {
    state.tasks.push(Object.assign({}, t, {
      id: String(stamp + i),
      subtasks: [],
      created: getTodayStr(),
      completedAt: t.status === 'done' ? getTodayStr() : null,
      fromImport: true,
    }));
  });
  saveData(state);
  if (typeof haptic === 'function') haptic('success');
  const n = csvPreview.length;
  csvPreview = [];
  const el = document.getElementById('csvImport');
  if (el) el.remove();
  render();
  if (typeof showToast === 'function') showToast(`Imported ${n} task${n === 1 ? '' : 's'}`);
}
