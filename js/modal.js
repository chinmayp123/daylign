// ========== Modal ==========
function populateScheduleHourDropdown() {
  const sel = $('#taskScheduledHour');
  let html = '<option value="">Not scheduled</option>';
  for (let h = 6; h <= 21; h++) {
    const hour12 = h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    html += `<option value="${h}">${hour12}:00 ${ampm}</option>`;
  }
  sel.innerHTML = html;
}

function openModal(taskId = null, scheduledHour = null) {
  const modal = $('#taskModal');
  const form = $('#taskForm');
  form.reset();
  editingSubtasks = [];
  populateScheduleHourDropdown();
  populateProjectDropdown();

  if (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    $('#modalTitle').textContent = 'Edit Task';
    $('#modalSubtitle').textContent = 'Update the task details';
    $('#modalIcon').classList.add('editing');
    $('#modalIcon').innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    $('#taskId').value = task.id;
    $('#taskName').value = task.name;
    $('#taskDesc').value = task.description || '';
    $('#taskStatus').value = task.status;
    $('#taskCategory').value = task.category;
    $('#taskDueDate').value = task.dueDate || '';
    $('#taskProject').value = task.project || '';
    $('#taskScheduledHour').value = task.scheduledHour != null ? task.scheduledHour : '';
    $('#taskDuration').value = task.duration || '1';
    editingSubtasks = task.subtasks ? task.subtasks.map(s => ({ ...s })) : [];
    $('#deleteBtn').style.display = 'inline-flex';
  } else {
    $('#modalTitle').textContent = 'New Task';
    $('#modalSubtitle').textContent = 'Fill in the details below';
    $('#modalIcon').classList.remove('editing');
    $('#modalIcon').innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    $('#taskId').value = '';
    $('#taskProject').value = activeProject || '';
    $('#deleteBtn').style.display = 'none';
    if (scheduledHour != null) {
      $('#taskScheduledHour').value = scheduledHour;
      $('#taskDueDate').value = getTodayStr();
    }
  }

  toggleProjectRow();
  renderSubtasks();
  modal.classList.add('active');
  setTimeout(() => $('#taskName').focus(), 100);
}

function populateProjectDropdown() {
  const opts = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  $('#taskProject').innerHTML = '<option value="">No Project</option>' + opts;
}

function toggleProjectRow() {
  const cat = $('#taskCategory').value;
  $('#projectRow').style.display = cat === 'work' ? '' : 'none';
  if (cat !== 'work') $('#taskProject').value = '';
}

function closeModal() {
  $('#taskModal').classList.remove('active');
}

function renderSubtasks() {
  $('#subtasksList').innerHTML = editingSubtasks.map((s, i) => `
    <div class="subtask-item">
      <input type="checkbox" ${s.done ? 'checked' : ''} data-idx="${i}">
      <span class="${s.done ? 'done' : ''}">${esc(s.text)}</span>
      <button class="subtask-remove" data-idx="${i}" type="button">&times;</button>
    </div>
  `).join('');

  $$('#subtasksList input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      editingSubtasks[parseInt(cb.dataset.idx)].done = cb.checked;
      renderSubtasks();
    });
  });

  $$('#subtasksList .subtask-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      editingSubtasks.splice(parseInt(btn.dataset.idx), 1);
      renderSubtasks();
    });
  });
}

function addSubtask() {
  const input = $('#subtaskInput');
  const text = input.value.trim();
  if (!text) return;
  editingSubtasks.push({ text, done: false });
  input.value = '';
  renderSubtasks();
  input.focus();
}

// ========== CRUD ==========
function handleSaveTask(e) {
  e.preventDefault();
  const id = $('#taskId').value;
  const scheduledVal = $('#taskScheduledHour').value;
  const taskData = {
    name: $('#taskName').value.trim(),
    description: $('#taskDesc').value.trim(),
    status: $('#taskStatus').value,
    category: $('#taskCategory').value,
    project: $('#taskCategory').value === 'work' ? ($('#taskProject').value || null) : null,
    dueDate: $('#taskDueDate').value,
    scheduledHour: scheduledVal !== '' ? parseInt(scheduledVal) : null,
    duration: scheduledVal !== '' ? parseFloat($('#taskDuration').value) : null,
    subtasks: [...editingSubtasks],
  };

  if (!taskData.name) return;

  if (id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      if (taskData.status === 'done' && task.status !== 'done') taskData.completedAt = getTodayStr();
      else if (taskData.status !== 'done') taskData.completedAt = null;
      Object.assign(task, taskData);
    }
  } else {
    state.tasks.push({
      id: Date.now().toString(),
      ...taskData,
      created: getTodayStr(),
    });
  }

  saveData(state);
  closeModal();
  render();
}

function handleDeleteTask() {
  const id = $('#taskId').value;
  if (!id) return;
  if (!confirm('Delete this task?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveData(state);
  closeModal();
  render();
}

function toggleTaskDone(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.status = task.status === 'done' ? 'todo' : 'done';
  task.completedAt = task.status === 'done' ? getTodayStr() : null;
  // Completing something is the one action in this app that deserves to be
  // felt. Un-completing gets the lighter tick.
  if (typeof haptic === 'function') haptic(task.status === 'done' ? 'success' : 'light');
  saveData(state);
  render();
}

function handleAddCategory() {
  const name = prompt('Category name:');
  if (!name || !name.trim()) return;
  const colors = ['#6366f1', '#22c55e', '#ef4444', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const color = colors[state.categories.length % colors.length];
  state.categories.push({ id: name.trim().toLowerCase().replace(/\s+/g, '-'), name: name.trim(), color });
  saveData(state);
  render();
}

// ========== Sheet drag-to-dismiss (mobile) ==========
// Bottom sheets are only worth the change if they behave like sheets: a
// downward drag should close them without aiming at a small x. Bound once on
// the document and delegated, so every modal — present and future — gets it
// without registering anything.
const SHEET_DISMISS = 96;   // drag distance that commits to a close
const SHEET_SLOP = 8;

let sheetEl = null;
let sheetStartY = 0;
let sheetStartX = 0;
let sheetDragging = false;
let sheetDecided = false;

function sheetIsMobile() {
  return window.matchMedia('(max-width: 600px)').matches;
}

// Reuse each modal's own close button so its cleanup still runs — several of
// them reset form state on close, which a bare classList.remove would skip.
function dismissSheet(modal) {
  const overlay = modal.closest('.modal-overlay');
  if (!overlay) return;
  const closeBtn = overlay.querySelector('.modal-close');
  modal.style.removeProperty('--sheet-drag');
  modal.classList.remove('is-settling');
  if (closeBtn) closeBtn.click();
  else overlay.classList.remove('active');
}

function bindSheetDrag() {
  document.addEventListener('touchstart', (e) => {
    sheetEl = null;
    if (!sheetIsMobile() || e.touches.length !== 1) return;
    const modal = e.target.closest ? e.target.closest('.modal') : null;
    if (!modal) return;
    // Only start a drag from the top of the sheet's own scroll, otherwise a
    // downward swipe meant to scroll the content would close it instead.
    if (modal.scrollTop > 0) return;
    sheetEl = modal;
    sheetStartY = e.touches[0].clientY;
    sheetStartX = e.touches[0].clientX;
    sheetDragging = false;
    sheetDecided = false;
    modal.classList.remove('is-settling');
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!sheetEl || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - sheetStartY;
    const dx = e.touches[0].clientX - sheetStartX;

    if (!sheetDecided) {
      if (Math.abs(dy) < SHEET_SLOP && Math.abs(dx) < SHEET_SLOP) return;
      // Horizontal, or upward — not a dismissal. Hand the gesture back.
      if (Math.abs(dx) > Math.abs(dy) || dy < 0) { sheetEl = null; return; }
      sheetDecided = true;
      sheetDragging = true;
    }
    if (dy <= 0) { sheetEl.style.setProperty('--sheet-drag', '0px'); return; }
    if (e.cancelable) e.preventDefault();
    // Slight resistance past the commit point so it never feels weightless.
    const moved = dy > SHEET_DISMISS ? SHEET_DISMISS + Math.pow(dy - SHEET_DISMISS, 0.8) : dy;
    sheetEl.style.setProperty('--sheet-drag', moved + 'px');
  }, { passive: false });

  const release = () => {
    if (!sheetEl || !sheetDragging) { sheetEl = null; return; }
    const modal = sheetEl;
    sheetEl = null;
    sheetDragging = false;
    const moved = parseFloat(getComputedStyle(modal).getPropertyValue('--sheet-drag')) || 0;
    modal.classList.add('is-settling');
    if (moved >= SHEET_DISMISS) {
      if (typeof haptic === 'function') haptic('light');
      dismissSheet(modal);
    } else {
      modal.style.setProperty('--sheet-drag', '0px');
      setTimeout(() => modal.classList.remove('is-settling'), 280);
    }
  };
  document.addEventListener('touchend', release, { passive: true });
  document.addEventListener('touchcancel', release, { passive: true });
}
