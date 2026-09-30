// ========== Shared modal behaviour + task mutations ==========
// The task modal itself is gone: spec 5 replaces it with the v3 task sheet in
// js/task-sheet.js, which is the single editor reached from a list row, a board
// card, a calendar dot, the line, Ctrl K and voice. What stays here is what was
// never really the modal's: toggling a task done, adding a category, and the
// drag-to-dismiss behaviour every remaining `.modal` sheet relies on.

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
  const color = nextCategoryColor(state.categories);
  state.categories.push({ id: name.trim().toLowerCase().replace(/\s+/g, '-'), name: name.trim(), color });
  saveData(state);
  render();
}

// ========== Sheet drag-to-dismiss (mobile) ==========
// Bottom sheets are only worth the change if they behave like sheets: a
// downward drag should close them without aiming at a small x. Bound once on
// the document and delegated, so every `.modal` sheet — voice, goals, taxonomy,
// the food library, the gym log — gets it without registering anything. The v3
// `.dl-sheet` family has its own equivalent in js/utils.js.
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

// ========== Capturing a pasted note ==========
// A task usually arrives as a blob of text from an email or a chat, and then
// you still have to invent a title. titleFromText builds one; the task sheet
// offers it rather than applying it silently, because a guessed title you did
// not notice is worse than none.

const TASK_TITLE_MAX = 70;

// Openers that say nothing about the task itself.
const TASK_SALUTATION = /^\s*(hi|hey|hello|dear|good (morning|afternoon|evening)|gentlemen|ladies|folks|team|all|everyone)\b[\s,:;.!-]*/i;

// A usable title out of a paragraph: drop the greeting, take the first
// sentence, and cut on a word boundary rather than mid-word.
function titleFromText(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  let prev;
  do { prev = t; t = t.replace(TASK_SALUTATION, ''); } while (t !== prev);
  // Ellipses are not sentence ends. "For BEADComply ... can you please" was
  // being cut at the "..." and yielding the title "For BEADComply".
  t = t.replace(/\.{2,}|…/g, ' ').replace(/\s+/g, ' ').trim();
  const stop = t.search(/[.?!](\s|$)/);
  if (stop > 12) t = t.slice(0, stop);
  t = t.replace(/[.?!,;:]+$/, '').trim();
  if (t.length <= TASK_TITLE_MAX) return t;
  const cut = t.lastIndexOf(' ', TASK_TITLE_MAX);
  let out = t.slice(0, cut > 20 ? cut : TASK_TITLE_MAX).trim();
  // A word-boundary cut can still land on a joining word, leaving
  // "...Apollo Contact Database and". Drop it.
  out = out.replace(/\s+(and|or|but|the|a|an|to|for|of|with|in|on|at|that|which|from|by)$/i, '');
  return out;
}
