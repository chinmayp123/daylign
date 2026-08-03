// ========== Board View ==========
function renderBoard() {
  const cats = state.categories.filter(c =>
    state.tasks.some(t => t.category === c.id)
  );
  const filtersHtml = `
    <button class="my-tasks-tab ${activeBoardFilter === null ? 'active' : ''}" data-cat="all">All</button>
    ${cats.map(c => `
      <button class="my-tasks-tab ${activeBoardFilter === c.id ? 'active' : ''}" data-cat="${c.id}">
        <span class="category-dot" style="background:${c.color}"></span>${c.name}
      </button>
    `).join('')}`;
  $('#boardFilters').innerHTML = filtersHtml;

  $$('#boardFilters .my-tasks-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeBoardFilter = tab.dataset.cat === 'all' ? null : tab.dataset.cat;
      renderBoard();
    });
  });

  const statuses = ['todo', 'in-progress', 'done'];
  const containers = { todo: $('#boardTodo'), 'in-progress': $('#boardProgress'), done: $('#boardDone') };
  const counts = { todo: $('#boardTodoCount'), 'in-progress': $('#boardProgressCount'), done: $('#boardDoneCount') };

  // hideCategory: when cards are grouped by category the folder header already
  // names it, so repeating it in each card footer is just noise — drop it.
  const renderCard = (t, hideCategory) => {
    const cat = state.categories.find(c => c.id === t.category);
    const proj = t.project ? state.projects.find(p => p.id === t.project) : null;
    const completedLine = t.status === 'done' && t.completedAt
      ? `<div class="board-card-completed">Completed ${new Date(t.completedAt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>`
      : '';
    const footer = (!hideCategory && cat)
      ? `<div class="board-card-footer"><span class="board-card-category"><span class="category-dot" style="background:${cat.color}"></span>${cat.name}</span></div>`
      : '';
    return `
      <div class="board-card" data-id="${t.id}">
        <div class="board-card-name">${esc(t.name)}</div>
        ${proj ? `<span class="board-card-project" style="color:${proj.color};background:${proj.color}15"><span class="category-dot" style="background:${proj.color}"></span>${proj.name}</span>` : ''}
        ${completedLine}
        ${footer}
      </div>`;
  };

  statuses.forEach(status => {
    // Hide auto-archived tasks (done 1+ week ago) so the Done column doesn't
    // pile up forever — same rule the Tasks view uses. They're not deleted;
    // they stay in Tasks → Archived.
    let tasks = state.tasks.filter(t => t.status === status && !(typeof isArchived === 'function' && isArchived(t)));
    if (activeBoardFilter) {
      tasks = tasks.filter(t => t.category === activeBoardFilter);
    }
    if (activeProject) {
      tasks = tasks.filter(t => t.project === activeProject);
    }
    counts[status].textContent = tasks.length;

    if (!tasks.length) {
      containers[status].innerHTML = emptyState({ icon: 'tasks', title: 'Nothing here', compact: true });
      return;
    }

    // Group by project if filtering Work, otherwise by category
    const useProjectGrouping = activeBoardFilter === 'work' || activeProject;
    const grouped = {};
    tasks.forEach(t => {
      let key, groupData;
      if (useProjectGrouping) {
        const proj = state.projects.find(p => p.id === t.project);
        key = proj ? proj.id : '_no-project';
        groupData = proj ? { name: proj.name, color: proj.color } : { name: 'No Project', color: 'var(--text-muted)' };
      } else {
        const cat = state.categories.find(c => c.id === t.category);
        key = cat ? cat.id : '_uncategorized';
        groupData = cat ? { name: cat.name, color: cat.color } : { name: 'Uncategorized', color: 'var(--text-muted)' };
      }
      if (!grouped[key]) grouped[key] = { ...groupData, tasks: [] };
      grouped[key].tasks.push(t);
    });

    const folderKey = (status, catKey) => `${status}_${catKey}`;

    containers[status].innerHTML = Object.entries(grouped).map(([key, group]) => {
      const fKey = folderKey(status, key);
      const isOpen = !boardFoldersCollapsed[fKey];
      return `
        <div class="board-folder ${isOpen ? 'open' : ''}" data-folder="${fKey}">
          <div class="board-folder-header" data-folder="${fKey}">
            <svg class="board-folder-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="category-dot" style="background:${group.color}"></span>
            <span class="board-folder-name">${group.name}</span>
            <span class="board-folder-count">${group.tasks.length}</span>
          </div>
          <div class="board-folder-body">
            ${group.tasks.map(t => renderCard(t, !useProjectGrouping)).join('')}
          </div>
        </div>`;
    }).join('');
  });

  // Keep the mobile column-switch counts in sync on every render — not just on
  // nav-button clicks — so completing, adding, or dragging a task updates the
  // To Do / Doing / Done tallies immediately.
  const bmsCounts = { todo: $('#bmsTodo'), 'in-progress': $('#bmsProgress'), done: $('#bmsDone') };
  statuses.forEach(s => { if (bmsCounts[s] && counts[s]) bmsCounts[s].textContent = counts[s].textContent; });

  $$('.board-folder-header').forEach(header => {
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = header.dataset.folder;
      boardFoldersCollapsed[key] = !boardFoldersCollapsed[key];
      header.closest('.board-folder').classList.toggle('open');
    });
  });

  $$('.board-card').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });

  // Drag and drop
  $$('.board-card').forEach(card => {
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });
  });

  $$('.column-tasks').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.style.background = 'var(--accent-glow)'; });
    col.addEventListener('dragleave', () => { col.style.background = ''; });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.style.background = '';
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.closest('.board-column').dataset.status;
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = newStatus;
        if (newStatus === 'done') task.completedAt = getTodayStr();
        else task.completedAt = null;
        saveData(state);
        render();
      }
    });
  });
}
