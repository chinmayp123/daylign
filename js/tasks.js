// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { openModal, toggleTaskDone } from './modal.js';
import { activeProject, state } from './state.js';
import { emptyState, formatDate, getTodayStr } from './utils.js';

// ========== Tasks List View ==========
export const ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // done tasks auto-archive after 1 week

export function isArchived(t) {
  if (t.status !== 'done' || !t.completedAt) return false;
  const completed = new Date(t.completedAt + 'T00:00:00');
  return (Date.now() - completed.getTime()) >= ARCHIVE_AFTER_MS;
}

export function renderTasksView() {
  const today = getTodayStr();
  const search = $('#searchInput').value.toLowerCase();
  const statusF = $('#filterStatus').value;
  const categoryF = $('#filterCategory').value;
  const sortBy = $('#sortBy').value;

  // Separate archived from active
  let activeTasks = [];
  let archivedTasks = [];
  state.tasks.forEach(t => {
    if (isArchived(t)) archivedTasks.push(t);
    else activeTasks.push(t);
  });

  // Choose which list based on filter
  let tasks = statusF === 'archived' ? [...archivedTasks] : [...activeTasks];

  if (search) tasks = tasks.filter(t => t.name.toLowerCase().includes(search) || (t.description && t.description.toLowerCase().includes(search)));
  if (statusF !== 'all' && statusF !== 'archived') tasks = tasks.filter(t => t.status === statusF);
  if (categoryF !== 'all') tasks = tasks.filter(t => t.category === categoryF);
  if (activeProject) tasks = tasks.filter(t => t.project === activeProject);

  // Sort: uncompleted first, recently completed on top of done, then by selected sort
  tasks.sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0;
    const bDone = b.status === 'done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    // Among done tasks, most recently completed first
    if (a.status === 'done' && b.status === 'done') {
      return (b.completedAt || '').localeCompare(a.completedAt || '');
    }

    switch (sortBy) {
      case 'created': return b.created.localeCompare(a.created);
      case 'dueDate': return (a.dueDate || 'z').localeCompare(b.dueDate || 'z');
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  $('#tasksList').innerHTML = tasks.length ? tasks.map(t => renderTaskRow(t, today)).join('')
    : (statusF === 'archived'
      ? emptyState({ icon: 'bookmark', title: 'No archived tasks', hint: 'Tasks auto-archive a week after you finish them.' })
      : emptyState({ icon: 'search', title: 'No matches', hint: 'No tasks match your current filters.', actionLabel: '+ New task', action: 'new-task' }));

  bindTaskRowEvents('#tasksList');

  // Archived section (only show when not filtering by archived)
  const archivedSection = $('#tasksArchivedSection');
  if (statusF === 'archived' || !archivedTasks.length) {
    archivedSection.innerHTML = '';
  } else {
    archivedSection.innerHTML = `
      <div class="archived-toggle" id="archivedToggle">
        <svg class="archived-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Archived</span>
        <span class="archived-count">${archivedTasks.length}</span>
      </div>
      <div class="archived-list" id="archivedList">
        ${archivedTasks.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).map(t => renderTaskRow(t, today)).join('')}
      </div>
    `;

    $('#archivedToggle').addEventListener('click', () => {
      archivedSection.classList.toggle('open');
    });

    bindTaskRowEvents('#archivedList');
  }
}

export function renderTaskRow(t, today) {
  const cat = state.categories.find(c => c.id === t.category);
  const proj = t.project ? state.projects.find(p => p.id === t.project) : null;
  const isOverdue = t.dueDate && t.dueDate < today && t.status !== 'done';
  const subtaskInfo = (t.subtasks && t.subtasks.length) ? `${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}` : '';
  const createdStr = t.created ? formatDate(t.created) : '';
  const completedStr = t.status === 'done' && t.completedAt ? formatDate(t.completedAt) : '';
  return `
    <div class="task-row ${t.status === 'done' ? 'task-row-done' : ''}" data-id="${t.id}">
      <div class="task-check ${t.status === 'done' ? 'checked' : ''}" data-id="${t.id}"></div>
      <div class="task-row-info">
        <div class="task-row-name ${t.status === 'done' ? 'completed' : ''}">${esc(t.name)}</div>
        <div class="task-row-meta">
          ${cat ? `<span class="task-row-category"><span class="category-dot" style="background:${cat.color}"></span>${cat.name}</span>` : ''}
          ${proj ? `<span class="task-row-project" style="color:${proj.color}">${proj.name}</span>` : ''}
          ${t.dueDate ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${isOverdue ? 'Overdue: ' : ''}${formatDate(t.dueDate)}</span>` : ''}
          ${subtaskInfo ? `<span>Subtasks: ${subtaskInfo}</span>` : ''}
          ${createdStr ? `<span class="task-created">Created ${createdStr}</span>` : ''}
          ${completedStr ? `<span class="task-completed-date">Done ${completedStr}</span>` : ''}
        </div>
      </div>
      <span class="status-badge ${t.status}">${t.status.replace('-', ' ')}</span>
    </div>`;
}

export function bindTaskRowEvents(containerSel) {
  $$(`${containerSel} .task-check`).forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); toggleTaskDone(el.dataset.id); });
  });
  $$(`${containerSel} .task-row`).forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { ARCHIVE_AFTER_MS: ARCHIVE_AFTER_MS, bindTaskRowEvents: bindTaskRowEvents, isArchived: isArchived, renderTaskRow: renderTaskRow, renderTasksView: renderTasksView });
