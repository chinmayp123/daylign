// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { openModal } from './modal.js';
import { calViewMode, calendarDate, saveData, state } from './state.js';
import { esc, getTodayStr, getUSHolidays, toLocalDateStr } from './utils.js';

// ========== Calendar View ==========
export function renderCalendar() {
  if (calViewMode === 'month') {
    $('#calMonthView').style.display = '';
    $('#calWeekView').style.display = 'none';
    renderCalendarMonth();
  } else {
    $('#calMonthView').style.display = 'none';
    $('#calWeekView').style.display = '';
    renderCalendarWeek();
  }
}

export function renderCalendarMonth() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  $('#calMonth').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = getTodayStr();

  let html = '';

  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month"><span class="cal-day-number">${daysInPrev - i}</span></div>`;
  }

  const holidays = getUSHolidays(year);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const holiday = holidays.find(h => h.date === dateStr);
    const dayTasks = state.tasks.filter(t => t.dueDate === dateStr);
    const dayEvents = (state.events || []).filter(e => e.date === dateStr);
    const holidayHtml = holiday ? `<div class="cal-holiday">${esc(holiday.name)}</div>` : '';
    const eventDots = dayEvents.map(e =>
      `<div class="cal-event-dot" style="border-left-color:${e.color || 'var(--accent)'}" data-event-id="${e.id}" title="${esc(e.name)}">${esc(e.name)}</div>`
    ).join('');
    const taskDots = dayTasks.slice(0, 3).map(t =>
      `<div class="cal-task-dot ${t.priority}" data-id="${t.id}" title="${esc(t.name)}">${esc(t.name)}</div>`
    ).join('');
    html += `<div class="cal-day${isToday ? ' today' : ''}${holiday ? ' holiday' : ''}" data-date="${dateStr}"><span class="cal-day-number">${d}</span>${holidayHtml}${eventDots}${taskDots}</div>`;
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><span class="cal-day-number">${i}</span></div>`;
  }

  // Remove old day cells but keep day-name headers
  const grid = $('#calMonthView');
  const oldCells = grid.querySelectorAll('.cal-day');
  oldCells.forEach(c => c.remove());
  grid.insertAdjacentHTML('beforeend', html);

  $$('.cal-task-dot').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openModal(el.dataset.id); });
  });

  // Click day to add custom event
  $$('.cal-day:not(.other-month)').forEach(cell => {
    cell.addEventListener('dblclick', () => {
      const date = cell.dataset.date;
      if (!date) return;
      openEventModal(date);
    });
  });

  // Click event to edit/delete
  $$('.cal-event-dot').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const ev = (state.events || []).find(ev => ev.id === el.dataset.eventId);
      if (ev) openEventModal(ev.date, ev);
    });
  });
}

export function renderCalendarWeek() {
  const d = new Date(calendarDate);
  const dayOfWeek = d.getDay();
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - dayOfWeek);

  const today = getTodayStr();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const startMonth = monthNames[weekStart.getMonth()];
  const endMonth = monthNames[weekEnd.getMonth()];
  if (startMonth === endMonth) {
    $('#calMonth').textContent = `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  } else {
    $('#calMonth').textContent = `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  }

  const holidays = [
    ...getUSHolidays(weekStart.getFullYear()),
    ...(weekStart.getFullYear() !== weekEnd.getFullYear() ? getUSHolidays(weekEnd.getFullYear()) : [])
  ];

  let html = '';
  for (let i = 0; i < 7; i++) {
    const colDate = new Date(weekStart);
    colDate.setDate(weekStart.getDate() + i);
    const dateStr = toLocalDateStr(colDate);
    const isToday = dateStr === today;
    const holiday = holidays.find(h => h.date === dateStr);
    const dayTasks = state.tasks.filter(t => t.dueDate === dateStr);
    const dayEvents = (state.events || []).filter(e => e.date === dateStr);

    const scheduled = dayTasks.filter(t => t.scheduledHour != null).sort((a, b) => a.scheduledHour - b.scheduledHour);
    const unscheduled = dayTasks.filter(t => t.scheduledHour == null);

    html += `
      <div class="week-col${isToday ? ' today' : ''}" data-date="${dateStr}">
        <div class="week-col-header">
          <span class="week-col-day">${dayNames[i]}</span>
          <span class="week-col-num${isToday ? ' today' : ''}">${colDate.getDate()}</span>
        </div>
        ${holiday ? `<div class="cal-holiday">${esc(holiday.name)}</div>` : ''}
        ${dayEvents.map(e => `<div class="cal-event-dot week-event" style="border-left-color:${e.color || 'var(--accent)'}" data-event-id="${e.id}">${esc(e.name)}${e.time ? ` <span class="week-event-time">${e.time}</span>` : ''}</div>`).join('')}
        <div class="week-col-tasks">
          ${scheduled.map(t => {
            const cat = state.categories.find(c => c.id === t.category);
            const hour12 = t.scheduledHour > 12 ? t.scheduledHour - 12 : t.scheduledHour;
            const ampm = t.scheduledHour >= 12 ? 'PM' : 'AM';
            return `
              <div class="week-task" data-id="${t.id}">
                <span class="week-task-time">${hour12}${ampm}</span>
                <div class="week-task-info">
                  <div class="week-task-name priority-border-${t.priority}">${esc(t.name)}</div>
                  ${cat ? `<span class="week-task-cat" style="color:${cat.color}"><span class="category-dot" style="background:${cat.color}"></span>${cat.name}</span>` : ''}
                </div>
              </div>`;
          }).join('')}
          ${unscheduled.map(t => {
            const cat = state.categories.find(c => c.id === t.category);
            return `
              <div class="week-task" data-id="${t.id}">
                <div class="week-task-info">
                  <div class="week-task-name priority-border-${t.priority}">${esc(t.name)}</div>
                  ${cat ? `<span class="week-task-cat" style="color:${cat.color}"><span class="category-dot" style="background:${cat.color}"></span>${cat.name}</span>` : ''}
                </div>
              </div>`;
          }).join('')}
          ${!dayTasks.length ? '<div class="week-empty">No tasks</div>' : ''}
        </div>
      </div>`;
  }

  $('#weekGrid').innerHTML = html;

  $$('.week-task').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });

  // Week view: double-click column to add event
  $$('.week-col').forEach(col => {
    col.addEventListener('dblclick', (e) => {
      if (e.target.closest('.week-task') || e.target.closest('.cal-event-dot')) return;
      const date = col.dataset.date;
      if (date) openEventModal(date);
    });
  });

  // Week view: click event to edit
  $$('.week-event').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const ev = (state.events || []).find(ev => ev.id === el.dataset.eventId);
      if (ev) openEventModal(ev.date, ev);
    });
  });
}

// ========== Event Modal ==========
export const EVENT_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4'];

export function openEventModal(date, existingEvent) {
  // Remove any existing event modal
  const old = $('#eventModal');
  if (old) old.remove();

  const ev = existingEvent || {};
  const isEdit = !!existingEvent;

  const modal = document.createElement('div');
  modal.id = 'eventModal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal event-modal">
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Event' : 'New Event'}</h2>
        <button class="modal-close" id="eventModalClose">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Event Name</label>
          <input type="text" id="eventName" class="form-input" value="${esc(ev.name || '')}" placeholder="e.g. Doctor's appointment">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="eventDate" class="form-input" value="${ev.date || date}">
          </div>
          <div class="form-group">
            <label>Time (optional)</label>
            <input type="time" id="eventTime" class="form-input" value="${ev.time || ''}">
          </div>
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <textarea id="eventDesc" class="form-input" rows="2" placeholder="Notes...">${esc(ev.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Color</label>
          <div class="event-color-picker" id="eventColorPicker">
            ${EVENT_COLORS.map(c => `<button type="button" class="event-color-swatch ${(ev.color || '#3b82f6') === c ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit ? '<button class="btn btn-danger" id="eventDeleteBtn">Delete</button>' : ''}
        <button class="btn btn-primary" id="eventSaveBtn">${isEdit ? 'Update' : 'Add Event'}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  let selectedColor = ev.color || '#3b82f6';

  $$('#eventColorPicker .event-color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      $$('#eventColorPicker .event-color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      selectedColor = sw.dataset.color;
    });
  });

  $('#eventModalClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  $('#eventSaveBtn').addEventListener('click', () => {
    const name = $('#eventName').value.trim();
    if (!name) return;
    if (!state.events) state.events = [];

    const eventData = {
      id: isEdit ? ev.id : 'evt-' + Date.now(),
      name,
      date: $('#eventDate').value,
      time: $('#eventTime').value || '',
      description: $('#eventDesc').value.trim(),
      color: selectedColor,
    };

    if (isEdit) {
      const idx = state.events.findIndex(e => e.id === ev.id);
      if (idx >= 0) state.events[idx] = eventData;
    } else {
      state.events.push(eventData);
    }

    saveData(state);
    modal.remove();
    renderCalendar();
  });

  if (isEdit && $('#eventDeleteBtn')) {
    $('#eventDeleteBtn').addEventListener('click', () => {
      state.events = state.events.filter(e => e.id !== ev.id);
      saveData(state);
      modal.remove();
      renderCalendar();
    });
  }

  $('#eventName').focus();
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { EVENT_COLORS: EVENT_COLORS, openEventModal: openEventModal, renderCalendar: renderCalendar, renderCalendarMonth: renderCalendarMonth, renderCalendarWeek: renderCalendarWeek });
