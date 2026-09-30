// ========== Board (v3, spec 5) ==========
// The Board face of Tasks. Three columns on desktop with drag between them; on
// a phone one column at a time, chosen with the switcher above, because three
// 110px columns side by side are unreadable.
//
// Cards carry a 3px bar in their category's colour (spec 2.3): the colour is
// the category, so a card does not need to spell it out in a footer as well.

const BOARD_STATUSES = ['todo', 'in-progress', 'done'];
const BOARD_COL_HOST = { todo: 'boardTodo', 'in-progress': 'boardProgress', done: 'boardDone' };
const BOARD_COL_COUNT = { todo: 'boardTodoCount', 'in-progress': 'boardProgressCount', done: 'boardDoneCount' };
const BOARD_BMS_COUNT = { todo: 'bmsTodo', 'in-progress': 'bmsProgress', done: 'bmsDone' };

function boardCardHtml(t, hideCategory) {
  const cat = (state.categories || []).find(c => c.id === t.category);
  const proj = t.project ? (state.projects || []).find(p => p.id === t.project) : null;
  const today = getTodayStr();
  const overdue = t.dueDate && t.dueDate < today && t.status !== 'done';
  const steps = (t.subtasks && t.subtasks.length)
    ? `<span class="bc-steps">${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>` : '';
  const clock = (typeof taskTimeOf === 'function') ? taskTimeOf(t) : (t.time || '');
  const due = t.dueDate
    ? `<span class="bc-due${overdue ? ' od' : ''}">${esc(formatDate(t.dueDate))}${clock ? ' ' + esc(clock) : ''}</span>` : '';
  const flag = ['high', 'medium', 'low'].indexOf(t.priority) !== -1
    ? `<span class="ms bc-flag p-${t.priority}" aria-hidden="true">flag</span>` : '';
  const catLine = (!hideCategory && cat)
    ? `<span class="dl-chip bc-cat" style="--c:${taxColor(cat)};--c-ink:var(--c-${cat.color || 'none'}-ink)">${esc(cat.name)}</span>` : '';
  const projLine = proj
    ? `<span class="dl-chip bc-cat" style="--c:${taxColor(proj)};--c-ink:var(--c-${proj.color || 'none'}-ink)">${esc(proj.name)}</span>` : '';
  const doneLine = t.status === 'done' && t.completedAt
    ? `<span class="bc-doneon">Done ${esc(formatDate(t.completedAt))}</span>` : '';

  return `
    <div class="board-card" data-id="${esc(t.id)}" style="--c:${taxColor(cat)}">
      <div class="bc-name">${esc(t.name)}</div>
      ${(catLine || projLine || due || steps || flag || doneLine)
        ? `<div class="bc-meta">${catLine}${projLine}${due}${steps}${flag}${doneLine}</div>` : ''}
    </div>`;
}

function renderBoard() {
  const cats = (state.categories || []).filter(c => (state.tasks || []).some(t => t.category === c.id));
  const filters = document.getElementById('boardFilters');
  if (filters) {
    filters.innerHTML = `
      <button type="button" class="dl-chip tk-chip${activeBoardFilter === null ? ' on' : ''}" data-cat="all">All</button>
      ${cats.map(c => `
        <button type="button" class="dl-chip tk-chip${activeBoardFilter === c.id ? ' on' : ''}" data-cat="${esc(c.id)}" style="--c:${taxColor(c)}">
          <span class="dl-dot" style="--c:${taxColor(c)}"></span>${esc(c.name)}
        </button>`).join('')}`;
    filters.querySelectorAll('[data-cat]').forEach(tab => tab.addEventListener('click', () => {
      activeBoardFilter = tab.dataset.cat === 'all' ? null : tab.dataset.cat;
      renderBoard();
    }));
  }

  BOARD_STATUSES.forEach(status => {
    const host = document.getElementById(BOARD_COL_HOST[status]);
    if (!host) return;
    // Hide auto-archived tasks (done 1+ week ago) so the Done column doesn't
    // pile up forever — same rule the list uses. They're not deleted; they
    // stay in Tasks → Archived.
    let tasks = (state.tasks || []).filter(t =>
      t.status === status && !(typeof isArchived === 'function' && isArchived(t)));
    if (activeBoardFilter) tasks = tasks.filter(t => t.category === activeBoardFilter);
    if (activeProject) tasks = tasks.filter(t => t.project === activeProject);

    const countEl = document.getElementById(BOARD_COL_COUNT[status]);
    if (countEl) countEl.textContent = tasks.length;
    const bms = document.getElementById(BOARD_BMS_COUNT[status]);
    if (bms) {
      bms.textContent = tasks.length;
      // Dims an empty column's badge — a zero is the one count that means
      // "nothing here", and it should not compete with the real numbers.
      bms.dataset.zero = tasks.length === 0 ? '1' : '0';
    }

    if (!tasks.length) {
      host.innerHTML = emptyState({ icon: 'tasks', title: 'Nothing here', compact: true });
      return;
    }

    // Group by project when a project is the lens, otherwise by category.
    const useProjectGrouping = activeBoardFilter === 'work' || !!activeProject;
    const grouped = {};
    tasks.forEach(t => {
      let key, data;
      if (useProjectGrouping) {
        const proj = (state.projects || []).find(p => p.id === t.project);
        key = proj ? proj.id : '_no-project';
        data = proj ? { name: proj.name, color: taxColor(proj) } : { name: 'No project', color: 'var(--text-muted)' };
      } else {
        const cat = (state.categories || []).find(c => c.id === t.category);
        key = cat ? cat.id : '_uncategorized';
        data = cat ? { name: cat.name, color: taxColor(cat) } : { name: 'Uncategorised', color: 'var(--text-muted)' };
      }
      if (!grouped[key]) grouped[key] = Object.assign({ tasks: [] }, data);
      grouped[key].tasks.push(t);
    });

    host.innerHTML = Object.keys(grouped).map(key => {
      const group = grouped[key];
      const fKey = status + '_' + key;
      const isOpen = !boardFoldersCollapsed[fKey];
      return `
        <div class="board-folder${isOpen ? ' open' : ''}" data-folder="${esc(fKey)}">
          <button type="button" class="board-folder-header" data-folder="${esc(fKey)}" aria-expanded="${isOpen}">
            <span class="ms board-folder-chev" aria-hidden="true">chevron_right</span>
            <span class="dl-dot" style="--c:${group.color}"></span>
            <span class="board-folder-name">${esc(group.name)}</span>
            <span class="board-folder-count">${group.tasks.length}</span>
          </button>
          <div class="board-folder-body">
            ${group.tasks.map(t => boardCardHtml(t, !useProjectGrouping)).join('')}
          </div>
        </div>`;
    }).join('');
  });

  // These nodes were just replaced, so re-binding them adds nothing that lasts.
  document.querySelectorAll('#tasksBoardPane .board-folder-header').forEach(header => {
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = header.dataset.folder;
      boardFoldersCollapsed[key] = !boardFoldersCollapsed[key];
      const open = !boardFoldersCollapsed[key];
      header.closest('.board-folder').classList.toggle('open', open);
      header.setAttribute('aria-expanded', String(open));
    });
  });

  document.querySelectorAll('#tasksBoardPane .board-card').forEach(card => {
    card.addEventListener('click', () => openTaskSheet(card.dataset.id));
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}

// The .column-tasks containers are static markup — renderBoard only rewrites
// their innerHTML, so binding drop targets inside the render added three
// listeners per column on EVERY render (9 per render, and render() fires on
// every save). Bound once instead; the cards inside are re-bound per render
// because they genuinely are replaced.
let boardDropBound = false;
function bindBoardDropTargets() {
  if (boardDropBound) return;
  boardDropBound = true;
  document.querySelectorAll('.column-tasks').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drop-over');
    });
    col.addEventListener('dragenter', (e) => { e.preventDefault(); col.classList.add('drop-over'); });
    col.addEventListener('dragleave', (e) => {
      // A dragleave fires for every child crossed, so only the one that leaves
      // the column itself should clear the highlight.
      if (col.contains(e.relatedTarget)) return;
      col.classList.remove('drop-over');
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drop-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.closest('.board-column').dataset.status;
      const task = (state.tasks || []).find(t => t.id === taskId);
      if (!task || task.status === newStatus) return;
      task.status = newStatus;
      task.completedAt = newStatus === 'done' ? getTodayStr() : null;
      saveData(state);
      render();
    });
  });
}
