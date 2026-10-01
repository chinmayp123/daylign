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
// The import is a page in Settings (Data, Import a spreadsheet). It was a modal
// built on the fly; the fields are static markup now and keep what was pasted
// while you go and check something else.
let csvPreview = [];

function openCsvImport() {
  if (typeof openSettingsPage === 'function') openSettingsPage('import');
  const ta = document.getElementById('csvText');
  if (ta) setTimeout(() => ta.focus(), 80);
}

function bindCsvImport() {
  const ta = document.getElementById('csvText');
  if (!ta || ta._bound) return;
  ta._bound = true;
  ta.addEventListener('input', refreshCsvPreview);
  document.getElementById('csvProject').addEventListener('change', refreshCsvPreview);
  document.getElementById('csvGo').addEventListener('click', runCsvImport);
}

// Preview before writing anything. An import that silently creates 60 wrong
// tasks is far worse than one that refuses.
function refreshCsvPreview() {
  const box = document.getElementById('csvPreviewBox');
  const go = document.getElementById('csvGo');
  const text = document.getElementById('csvText').value;
  const projectId = document.getElementById('csvProject').value || null;
  const refuse = (html) => { box.hidden = false; box.innerHTML = html; go.disabled = true; go.textContent = 'Import'; csvPreview = []; };

  if (!text.trim()) { box.hidden = true; box.innerHTML = ''; go.disabled = true; go.textContent = 'Import'; csvPreview = []; return; }

  const rows = parseCsv(text);
  if (rows.length < 2) { refuse('<ul class="set-csv-warn"><li>Needs a header row and at least one row under it.</li></ul>'); return; }

  const map = guessColumns(rows[0]);

  // NOT `if (!map.name)`: a matched column is an INDEX, and the title is
  // almost always column A, so the successful case was index 0 and read as
  // falsy. Every well-formed sheet was rejected with "no column looks like a
  // title" until this used an explicit undefined check.
  if (map.name === undefined) {
    refuse(`<ul class="set-csv-warn"><li>No column looks like a title. Rename one to Title, Summary or Issue and paste again.</li></ul>
      <p class="set-csv-cols">Found: ${rows[0].map(h => esc(String(h).trim()) || '—').join(' · ')}</p>`);
    return;
  }

  csvPreview = csvRowsToTasks(rows, map, projectId);

  // What will not come across the way the sheet has it. Said before the
  // import, because afterwards it is sixty tasks to check by hand.
  const pick = (r, f) => (map[f] !== undefined ? String(r[map[f]] || '').trim() : '');
  const body = rows.slice(1);
  const named = body.filter(r => pick(r, 'name'));
  const untitled = body.length - named.length;
  const warns = [];
  if (map.dueDate === undefined) {
    warns.push('No due-date column found, so every task imports without a date.');
  } else {
    const noDate = named.filter(r => !pick(r, 'dueDate')).length;
    const badDate = named.filter(r => pick(r, 'dueDate') && !csvDate(pick(r, 'dueDate'))).length;
    if (noDate) warns.push(`${noDate} ${noDate === 1 ? 'has' : 'have'} no date.`);
    if (badDate) warns.push(`${badDate} ${badDate === 1 ? 'date' : 'dates'} could not be read, so ${badDate === 1 ? 'it imports' : 'they import'} without one.`);
  }
  if (untitled) warns.push(`${untitled} row${untitled === 1 ? ' has' : 's have'} no title and ${untitled === 1 ? 'is' : 'are'} skipped.`);

  const matched = Object.keys(map).map(f => `${f} &larr; ${esc(String(rows[0][map[f]]).trim())}`);
  const counts = csvPreview.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {});
  const n = csvPreview.length;
  const label = { todo: 'to do', 'in-progress': 'in progress', done: 'done' };

  box.hidden = false;
  box.innerHTML = `
    <p class="set-csv-ok"><b>${n}</b> row${n === 1 ? '' : 's'} ready${n ? ' · ' + Object.keys(counts).map(k => `${counts[k]} ${label[k] || k}`).join(', ') : ''}</p>
    ${warns.length ? `<ul class="set-csv-warn">${warns.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
    <p class="set-csv-cols">${matched.join(' · ')}</p>
    <div class="set-csv-rows">
      ${csvPreview.slice(0, 5).map(t => `
        <div class="set-csv-rowitem">
          <span>${esc(t.name)}</span>
          <span>${label[t.status] || t.status}${t.dueDate ? ' · due ' + esc(t.dueDate) : ''}</span>
        </div>`).join('')}
      ${n > 5 ? `<p class="set-csv-more">and ${n - 5} more</p>` : ''}
    </div>`;
  go.disabled = n === 0;
  go.textContent = n ? `Import ${n} task${n === 1 ? '' : 's'}` : 'Import';
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
  const ta = document.getElementById('csvText');
  if (ta) ta.value = '';
  refreshCsvPreview();
  render();
  if (typeof showToast === 'function') showToast(`Imported ${n} task${n === 1 ? '' : 's'} · View`, () => switchView('tasks'));
}
