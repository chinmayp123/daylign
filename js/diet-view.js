// ========== Diet: the day (v3, spec 8) ==========
// One screen, top to bottom: the day stepper and week strip, the calorie ring
// with its macro bars, ONE add bar, water, the four meals as a line, and three
// folded rows of advice. Tapping a meal opens the meal sheet, which is where
// its entries are changed. The Food library is its own full screen; its code
// is the second half of this file.
//
// renderDiet() reads state and writes nothing. The v2 version banked unknown
// foods and called saveData() from inside the render; that backfill now runs
// when the Food library is opened, which is a user action.

const DIET_MEALS = ['breakfast', 'lunch', 'snack', 'dinner'];   // in clock order
const DIET_MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const DIET_MEAL_ICON = { breakfast: 'breakfast_dining', lunch: 'lunch_dining', snack: 'cookie', dinner: 'dinner_dining' };
const DIET_MEAL_SLOT = { breakfast: 8 * 60, lunch: 12 * 60 + 30, snack: 16 * 60, dinner: 19 * 60 + 30 };

// The usual tiles currently on screen, so a delegated click can find the food.
let dietUsualsShown = [];
// Which meal the meal sheet is showing; null when it is closed.
let dietSheetMeal = null;
// True while the sheet's own "Add food" field is showing.
let dietSheetSearch = false;

function dietMealGroups() {
  const dayEntries = state.diet.filter(e => e.date === dietViewDate);
  return DIET_MEALS.map(meal => ({
    meal,
    label: DIET_MEAL_LABEL[meal],
    entries: dayEntries.filter(e => e.meal === meal),
  }));
}

// Minutes after midnight for a clock label like the line's.
function dietClock(min) {
  if (typeof lineClock === 'function') return lineClock(min);
  return Math.floor(min / 60) + ':' + String(Math.round(min % 60)).padStart(2, '0');
}

function renderDiet() {
  const dateInput = $('#dietDate');
  if (!dateInput) return;

  // The page header carries the day being viewed, not today (see setHeaderDate).
  // Here because every way the day changes - the arrows, the week strip, the
  // date picker, the Today button - ends in a renderDiet().
  if (typeof setHeaderDate === 'function') setHeaderDate();

  if (!dietViewDate) dietViewDate = getTodayStr();
  dateInput.value = dietViewDate;

  const todayStr = getTodayStr();
  const isToday = dietViewDate === todayStr;
  const viewDate = new Date(dietViewDate + 'T00:00:00');
  $('#dietDateLabel').textContent = isToday
    ? 'Today, ' + viewDate.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + viewDate.getDate()
    : viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const todayBtn = $('#dietToday');
  if (todayBtn) todayBtn.hidden = isToday;

  const mealGroups = dietMealGroups();
  const dayEntries = mealGroups.reduce((all, g) => all.concat(g.entries), []);
  const totals = sumMacros(dayEntries);

  renderDietGoals(totals);
  renderDietWeek();
  renderDietAdd(mealGroups);
  renderWater();
  renderDietLine(mealGroups, totals);
  renderDietRecs(totals);
  renderYesterdayAdvice();
  renderDietReview(totals, dayEntries);
  if (typeof renderPhotoPending === 'function') renderPhotoPending();

  if (dietSheetMeal) renderMealSheet();
  if (foodLibraryOpen()) renderFoodLibrary();

  // Put the cursor back in the field an add came from, once, on the day it was
  // asked for. You are usually logging the next thing.
  if (dietInlineOpenMeal && dietInlineOpenDate !== dietViewDate) closeDietInlineSearch();
  if (dietInlineOpenMeal) {
    const input = document.querySelector(dietSheetMeal ? '#mealSheetInput' : '#dietAddInput');
    if (input) input.focus();
    closeDietInlineSearch();
  }
}

// ---------- the add bar, and the tiles under it ----------
// The bar itself is static markup: rebuilding it on every render threw away
// whatever was being typed whenever a sync echoed back. Only its target meal,
// its labels and the tiles change here.
function renderDietAdd(mealGroups) {
  const wrap = document.getElementById('dietAddWrap');
  if (!wrap) return;
  const meal = activeDietMeal(mealGroups);
  const label = DIET_MEAL_LABEL[meal] || 'Meal';
  const changed = wrap.dataset.meal !== meal || wrap.dataset.date !== dietViewDate;
  wrap.dataset.meal = meal;
  wrap.dataset.date = dietViewDate;
  const input = document.getElementById('dietAddInput');
  if (input) {
    input.placeholder = `Add food to ${label.toLowerCase()}`;
    input.setAttribute('aria-label', `Add food to ${label}`);
    // A different meal or day: whatever was typed belonged to the other one.
    if (changed && input.value) { input.value = ''; const box = wrap.querySelector('.diet-inline-results'); if (box) box.innerHTML = ''; }
  }
  const cam = wrap.querySelector('[data-diet-photo]');
  if (cam) { cam.dataset.dietPhoto = meal; cam.setAttribute('aria-label', `Log ${label} from a photo`); }

  const tiles = document.getElementById('dietTiles');
  if (!tiles) return;
  dietUsualsShown = mealUsuals(meal, 4);
  const combos = (typeof comboList === 'function') ? comboList() : [];
  // A saved meal writes several rows, so its tile is drawn apart from a single
  // food's: outlined in the food colour.
  tiles.innerHTML =
    dietUsualsShown.map((u, i) => `<button type="button" class="dt-tile" data-usual-idx="${i}">${esc(u.name)}</button>`).join('') +
    combos.map(c => `<button type="button" class="dt-tile is-meal" data-combo-id="${esc(c.id)}" title="${esc(c.items.map(i => i.food).join(', '))}">${esc(c.name)}<em>${Math.round(comboTotals(c).calories)}</em></button>`).join('');
  tiles.hidden = !(dietUsualsShown.length || combos.length);
}

// ---------- the four meals as a line ----------
function renderDietLine(mealGroups, totals) {
  const host = document.getElementById('dietMealsList');
  if (!host) return;
  const today = getTodayStr();
  const isToday = dietViewDate === today;
  const goals = getGoals();
  const proteinLeft = Math.max(0, goals.protein - Math.round(totals.protein));
  const nextEmpty = isToday ? activeDietMeal(mealGroups) : null;

  const rows = mealGroups.map(g => {
    const kcal = Math.round(sumMacros(g.entries).calories);
    // When it was eaten: the earliest entry that carries a time, else the slot.
    const at = g.entries.reduce((a, e) => (e.at && (!a || e.at < a) ? e.at : a), null);
    const min = (typeof lineMinutesFrom === 'function') ? lineMinutesFrom(at, DIET_MEAL_SLOT[g.meal]) : DIET_MEAL_SLOT[g.meal];
    const names = groupMealEntries(g.entries)
      .map(b => b.type === 'group' ? b.name : ((b.entry && b.entry.food) || ''))
      .filter(Boolean);
    let sub;
    if (names.length) sub = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
    else if (g.meal === nextEmpty && proteinLeft > 0) sub = `${proteinLeft}g protein to go, tap to add`;
    else sub = 'tap to add';
    return { g, kcal, min, sub, has: g.entries.length > 0 };
  }).sort((a, b) => a.min - b.min);

  // Where the spine turns from the day's colours to plain ink.
  let cut = dietViewDate < today ? 100 : 0;
  if (isToday) {
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const first = rows[0].min, last = rows[rows.length - 1].min;
    cut = Math.max(0, Math.min(100, ((now - first) / Math.max(1, last - first)) * 100));
  }

  host.innerHTML = `<div class="dl-line dt-line" style="--cut:${Math.round(cut)}%">${rows.map(r => `
    <button type="button" class="dl-line-item c-food${r.has ? ' past' : ''}" data-open-meal="${r.g.meal}"
            aria-label="${r.g.label}: ${r.has ? r.kcal + ' kcal, ' + esc(r.sub) : 'nothing logged, tap to add'}">
      <span class="t">${dietClock(r.min)}</span><span class="n"></span>
      <span class="ico"><span class="ms" aria-hidden="true">${DIET_MEAL_ICON[r.g.meal]}</span></span>
      <span class="body">${r.g.label}<em>${esc(r.sub)}</em></span>
      <span class="val">${r.has ? r.kcal : ''}</span>
    </button>`).join('')}</div>`;
}

// ========== Meal sheet ==========
function openMealSheet(meal) {
  if (DIET_MEALS.indexOf(meal) === -1) return;
  dietSheetMeal = meal;
  dietSheetSearch = false;
  dietEditFormIdx = null;
  // Opening a meal does NOT retarget the add bar behind it. Looking at
  // breakfast at noon should not make the next thing you add a breakfast; the
  // sheet has its own Add food for that.
  renderMealSheet();
  openDlSheet(document.getElementById('mealSheet'));
}

function closeMealSheet() {
  closeDlSheet(document.getElementById('mealSheet'));
}

function mealSheetEntryRow(e, isIngredient) {
  const idx = state.diet.indexOf(e);
  const serv = Number(e.servings) > 0 ? Number(e.servings) : 1;
  const name = esc(e.food);
  const row = `
    <div class="ms-row${isIngredient ? ' is-ing' : ''}" data-entry-idx="${idx}">
      <span class="ms-name">${name}</span>
      <span class="ms-kcal">${Math.round(e.calories || 0)}</span>
      <button type="button" class="ss-act" data-ms-edit="${idx}" aria-label="Edit ${name}" aria-expanded="${dietEditFormIdx === idx}"><span class="ms" aria-hidden="true">edit</span></button>
      <button type="button" class="ss-act" data-ms-del="${idx}" aria-label="Delete ${name}"><span class="ms" aria-hidden="true">close</span></button>
      <span class="ms-sub">${Math.round(e.protein || 0)}g protein · ${Math.round(e.carbs || 0)}g carbs · ${Math.round(e.fat || 0)}g fat</span>
      <span class="ms-step">
        <button type="button" data-ms-step="-0.5" data-idx="${idx}" aria-label="Fewer servings of ${name}"><span class="ms" aria-hidden="true">remove</span></button>
        <b>${serv}x</b>
        <button type="button" data-ms-step="0.5" data-idx="${idx}" aria-label="More servings of ${name}"><span class="ms" aria-hidden="true">add</span></button>
      </span>
    </div>`;
  if (dietEditFormIdx !== idx) return row;
  // Name and macros AS LOGGED, for the servings shown.
  return row + `
    <form class="dl-card ms-edit" data-ms-form="${idx}">
      <h6 class="dl-card-h"><span>Edit ${name}</span><em>for ${serv}x</em></h6>
      <label class="dl-field"><span class="dl-field-label">Name</span>
        <input type="text" name="food" value="${name}" maxlength="80" autocomplete="off"></label>
      <div class="ms-macros">
        <label class="dl-field"><span class="dl-field-label">Kcal</span><input type="number" name="calories" inputmode="decimal" min="0" step="1" value="${Math.round(e.calories || 0)}"></label>
        <label class="dl-field"><span class="dl-field-label">P</span><input type="number" name="protein" inputmode="decimal" min="0" step="0.1" value="${Math.round((e.protein || 0) * 10) / 10}"></label>
        <label class="dl-field"><span class="dl-field-label">C</span><input type="number" name="carbs" inputmode="decimal" min="0" step="0.1" value="${Math.round((e.carbs || 0) * 10) / 10}"></label>
        <label class="dl-field"><span class="dl-field-label">F</span><input type="number" name="fat" inputmode="decimal" min="0" step="0.1" value="${Math.round((e.fat || 0) * 10) / 10}"></label>
      </div>
      <label class="ms-check"><input type="checkbox" name="fixBank" checked> Fix it everywhere: My foods and saved meals too</label>
      <div class="ts-actions"><span class="ts-spacer"></span>
        <button type="button" class="dl-btn" data-ms-cancel>Cancel</button>
        <button type="submit" class="dl-btn primary">Save</button></div>
    </form>`;
}

function renderMealSheet() {
  const body = document.getElementById('mealSheetBody');
  if (!body || !dietSheetMeal) return;
  const meal = dietSheetMeal;
  const label = DIET_MEAL_LABEL[meal];
  const entries = state.diet.filter(e => e.date === dietViewDate && e.meal === meal);
  const m = sumMacros(entries);

  const title = document.getElementById('mealSheetTitle');
  if (title) title.innerHTML = `${label} <span class="ms-total">${Math.round(m.calories)}</span>`;

  // Keep what is being typed in the sheet's search across a re-render.
  const prevInput = document.getElementById('mealSheetInput');
  const typed = prevInput ? prevInput.value : '';

  const blocks = groupMealEntries(entries).map(block => {
    if (block.type === 'single') return mealSheetEntryRow(block.entry, false);
    const open = !!dietGroupOpen[block.gid];
    const gname = esc(block.name);
    return `
      <div class="ms-group${open ? ' open' : ''}">
        <div class="ms-row ms-grouphead">
          <button type="button" class="ms-grouptoggle" data-toggle-group="${esc(block.gid)}" aria-expanded="${open}">
            <span class="ms" aria-hidden="true">chevron_right</span><span class="ms-name">${gname}</span>
          </button>
          <span class="ms-kcal">${Math.round(block.totals.calories)}</span>
          <button type="button" class="ss-act" data-del-group="${esc(block.gid)}" aria-label="Remove the whole ${gname}"><span class="ms" aria-hidden="true">close</span></button>
          <span class="ms-sub">saved meal · ${block.items.length} item${block.items.length === 1 ? '' : 's'} · ${Math.round(block.totals.protein)}g protein</span>
        </div>
        ${open ? `<div class="ms-groupbody">
          ${block.items.map(e => mealSheetEntryRow(e, true)).join('')}
          <div class="ms-ing">
            <input type="text" data-ing-input="${esc(block.gid)}" placeholder="Add an ingredient from your foods" autocomplete="off" aria-label="Ingredient to add to ${gname}">
            <button type="button" class="dl-btn" data-add-ing="${esc(block.gid)}">Add</button>
          </div>
        </div>` : ''}
      </div>`;
  }).join('');

  body.innerHTML = `
    ${entries.length
      ? `<p class="ms-macro">${Math.round(m.protein)}g protein · ${Math.round(m.carbs)}g carbs · ${Math.round(m.fat)}g fat</p><div class="ms-list">${blocks}</div>`
      : `<p class="ms-empty">Nothing in ${label.toLowerCase()} yet.</p>`}
    <div class="ms-actions">
      <button type="button" class="dl-btn" data-ms-add aria-expanded="${dietSheetSearch}"><span class="ms" aria-hidden="true">add</span>Add food</button>
      <button type="button" class="dl-btn" data-diet-photo="${meal}"><span class="ms" aria-hidden="true">photo_camera</span>Photo</button>
      ${entries.length >= 2 ? `<button type="button" class="dl-btn" data-ms-savecombo><span class="ms" aria-hidden="true">bookmark_add</span>Save these ${entries.length} as a meal</button>` : ''}
    </div>
    <div class="dt-addwrap diet-meal-addwrap" data-meal="${meal}"${dietSheetSearch ? '' : ' hidden'}>
      <div class="dt-search">
        <span class="ms" aria-hidden="true">search</span>
        <input type="text" id="mealSheetInput" class="dt-search-input" placeholder="Add food to ${label.toLowerCase()}" autocomplete="off" enterkeyhint="search" aria-label="Add food to ${label}">
      </div>
      <div class="diet-inline-results"></div>
    </div>
    <p class="ts-hint">A saved meal logs as one group. Open it to add an ingredient, or remove the whole group with its x.</p>`;

  if (typed) {
    const input = document.getElementById('mealSheetInput');
    if (input) { input.value = typed; renderInlineResults(input.closest('.diet-meal-addwrap'), typed); }
  }
}

// Servings +/- rescales that entry's macros in proportion.
function stepDietServings(idx, step) {
  const e = state.diet[idx];
  if (!e) return;
  const cur = Number(e.servings) > 0 ? Number(e.servings) : 1;
  let next = Math.round((cur + step) * 2) / 2;   // snap to the half, avoids float drift
  if (next < 0.5) next = 0.5;                     // half a serving is the floor
  if (next === cur) return;
  const ratio = next / cur;
  e.servings = next;
  e.calories = Math.round((e.calories || 0) * ratio);
  e.protein = Math.round(((e.protein || 0) * ratio) * 10) / 10;
  e.carbs = Math.round(((e.carbs || 0) * ratio) * 10) / 10;
  e.fat = Math.round(((e.fat || 0) * ratio) * 10) / 10;
  saveData(state);
  renderDiet();
}

// Delete with the way back on the toast, rather than a dialog in front of it.
function deleteDietEntry(idx) {
  const e = state.diet[idx];
  if (!e) return;
  state.diet.splice(idx, 1);
  dietEditFormIdx = null;   // indices shift after a splice: never reopen the wrong row
  closeDietInlineSearch();
  saveData(state);
  renderDiet();
  showToast(`Removed ${e.food}. Tap to undo`, () => {
    state.diet.splice(Math.min(idx, state.diet.length), 0, e);
    saveData(state);
    renderDiet();
  });
}

// Every control in the sheet, handled from the wrapper. The body is rewritten
// on every render; the wrapper is not.
let mealSheetBound = false;
function bindMealSheet() {
  const wrap = document.getElementById('mealSheet');
  if (!wrap || mealSheetBound) return;
  mealSheetBound = true;

  wrap.addEventListener('dl-sheet-close', () => { dietSheetMeal = null; dietSheetSearch = false; dietEditFormIdx = null; });
  const x = document.getElementById('mealSheetClose');
  if (x) x.addEventListener('click', closeMealSheet);

  wrap.addEventListener('click', (ev) => {
    const t = ev.target;
    const step = t.closest('[data-ms-step]');
    if (step) { stepDietServings(Number(step.dataset.idx), Number(step.dataset.msStep)); return; }
    const del = t.closest('[data-ms-del]');
    if (del) { deleteDietEntry(Number(del.dataset.msDel)); return; }
    const edit = t.closest('[data-ms-edit]');
    if (edit) {
      const idx = Number(edit.dataset.msEdit);
      dietEditFormIdx = dietEditFormIdx === idx ? null : idx;
      renderMealSheet();
      const f = wrap.querySelector(`[data-ms-form="${idx}"] input[name="calories"]`);
      if (f) { f.focus(); f.select(); }
      return;
    }
    if (t.closest('[data-ms-cancel]')) { dietEditFormIdx = null; renderMealSheet(); return; }
    const tog = t.closest('[data-toggle-group]');
    if (tog) { toggleDietGroup(tog.dataset.toggleGroup); return; }
    const delG = t.closest('[data-del-group]');
    if (delG) { deleteDietGroup(delG.dataset.delGroup); return; }
    const ing = t.closest('[data-add-ing]');
    if (ing) { addMealSheetIngredient(ing.dataset.addIng); return; }
    if (t.closest('[data-ms-add]')) {
      dietSheetSearch = !dietSheetSearch;
      renderMealSheet();
      if (dietSheetSearch) { const i = document.getElementById('mealSheetInput'); if (i) i.focus(); }
      return;
    }
    if (t.closest('[data-ms-savecombo]')) { if (typeof openComboSaver === 'function') openComboSaver(dietSheetMeal); return; }
    const cam = t.closest('[data-diet-photo]');
    if (cam && typeof startMealPhoto === 'function') { const meal = cam.dataset.dietPhoto; closeMealSheet(); startMealPhoto(meal); }
  });

  wrap.addEventListener('submit', (ev) => {
    const form = ev.target.closest('[data-ms-form]');
    if (!form) return;
    ev.preventDefault();
    const fd = new FormData(form);
    const fix = fd.get('fixBank') === 'on';
    const ok = updateDietEntry(Number(form.dataset.msForm), {
      food: fd.get('food'), calories: fd.get('calories'), protein: fd.get('protein'), carbs: fd.get('carbs'), fat: fd.get('fat'),
      fixBank: fix,
    });
    dietEditFormIdx = null;
    renderDiet();
    if (ok) showToast(fix ? 'Fixed here, in My foods and in your saved meals' : 'Fixed this entry');
  });

  wrap.addEventListener('input', (ev) => {
    const input = ev.target.closest('#mealSheetInput');
    if (input) renderInlineResults(input.closest('.diet-meal-addwrap'), input.value);
  });
  wrap.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const ing = ev.target.closest('[data-ing-input]');
    if (ing) { ev.preventDefault(); addMealSheetIngredient(ing.dataset.ingInput); }
  });
}

// An ingredient is added by name from foods you already have. It was a
// browser prompt(); it is a field in the group now.
function addMealSheetIngredient(gid) {
  const input = document.querySelector(`[data-ing-input="${gid}"]`);
  const name = input ? input.value.trim() : '';
  if (!name) { if (input) input.focus(); return; }
  const per = perServingMacros(name, null);
  if (!per) {
    showToast(`"${name}" is not in your foods yet. Add it with Add food first`);
    return;
  }
  addIngredientToGroup(gid, dietSheetMeal, name, per);
}

// ---------- page-level bindings (once) ----------
let dietDayBound = false;
function bindDietDay() {
  const view = document.getElementById('dietView');
  if (!view || dietDayBound) return;
  dietDayBound = true;

  view.addEventListener('click', (ev) => {
    const t = ev.target;
    const open = t.closest('[data-open-meal]');
    if (open) { openMealSheet(open.dataset.openMeal); return; }
    const usual = t.closest('[data-usual-idx]');
    if (usual) {
      const u = dietUsualsShown[Number(usual.dataset.usualIdx)];
      const wrap = document.getElementById('dietAddWrap');
      if (u && wrap) quickAddToMeal(wrap.dataset.meal, { name: u.name, data: u.per }, false);
      return;
    }
    const combo = t.closest('[data-combo-id]');
    if (combo) {
      const wrap = document.getElementById('dietAddWrap');
      if (wrap) addComboToMeal(combo.dataset.comboId, wrap.dataset.meal);
      return;
    }
    if (t.closest('[data-diet-voice]')) { if (typeof openVoicePanel === 'function') openVoicePanel(); return; }
    const cam = t.closest('#dietDay [data-diet-photo]');
    if (cam && typeof startMealPhoto === 'function') { startMealPhoto(cam.dataset.dietPhoto); return; }
    // Anywhere on the bar puts the cursor in it.
    const bar = t.closest('#dietAddWrap .dt-search');
    if (bar && !t.closest('button')) { const i = document.getElementById('dietAddInput'); if (i && document.activeElement !== i) i.focus(); }
  });

  const input = document.getElementById('dietAddInput');
  if (input) input.addEventListener('input', () => renderInlineResults(document.getElementById('dietAddWrap'), input.value));

  bindMealSheet();
  bindFoodLibraryUi();
}

// ========== Food library (full screen) ==========
// My foods / Meals / Recent / History, one search box, and the add-your-own
// form. It replaced a run of accordions with the editor hidden above them.
let libTab = 'foods';
let libQuery = '';
let libOnline = null;      // null | 'loading' | 'error' | [results]
let libEditing = null;     // name being edited in the form, or null for a new food
let libRecentShown = [];

function foodLibraryOpen() {
  const lib = document.getElementById('dietLibrary');
  return !!lib && !lib.hidden;
}

function libRow(name, sub, attrs, actions, chip) {
  return `
    <div class="lib-row" ${attrs || ''}>
      <span class="lib-sw"></span>
      <span class="lib-main"><span class="lib-name">${esc(name)}${chip || ''}</span><span class="lib-sub">${sub}</span></span>
      ${actions || ''}
    </div>`;
}

function libMacroSub(d) {
  return `${Math.round(d.calories || 0)} · ${Math.round((d.protein || 0) * 10) / 10}g P${d.serving ? ' · per ' + esc(d.serving) : ''}`;
}

function renderFoodLibrary() {
  const body = document.getElementById('libBody');
  if (!body) return;
  document.querySelectorAll('#libTabs [data-lib-tab]').forEach(b => {
    const on = b.dataset.libTab === libTab;
    if (on) b.setAttribute('aria-pressed', 'true'); else b.removeAttribute('aria-pressed');
  });
  const search = document.getElementById('libSearchWrap');
  if (search) search.hidden = libTab === 'history';
  const q = libQuery.trim().toLowerCase();
  const empty = (title, hint) => `<div class="lib-empty"><b>${title}</b>${hint}</div>`;
  const editBtn = (name) => `<button type="button" class="ss-act" data-lib-edit="${esc(name)}" aria-label="Edit ${esc(name)}"><span class="ms" aria-hidden="true">edit</span></button>`;

  if (libTab === 'foods') {
    const bank = Object.entries(state.customFoods).sort((a, b) => a[0].localeCompare(b[0]));
    let html;
    if (!q) {
      html = bank.length
        ? `<div class="dl-card lib-card">${bank.map(([name, d]) => libRow(name, libMacroSub(d), `data-lib-food="${esc(name)}"`,
            editBtn(name) + `<button type="button" class="ss-act" data-lib-del="${esc(name)}" aria-label="Remove ${esc(name)} from My foods"><span class="ms" aria-hidden="true">close</span></button>`)).join('')}</div>`
        : empty('No saved foods yet.', 'Anything you log is remembered here. You can also add one below.');
    } else {
      const found = searchFoodDatabase(q);
      html = found.length
        ? `<div class="dl-card lib-card">${found.map(r => libRow(r.name, libMacroSub(r.data), `data-lib-food="${esc(r.name)}"`,
            r.custom ? editBtn(r.name) : '',
            r.shared ? '<span class="dl-chip c-water">Community</span>' : (r.custom ? '' : '<span class="dl-chip">Built in</span>'))).join('')}</div>`
        : empty('No match in your foods.', 'Look it up online, or add it below.');
      html += `<button type="button" class="dl-btn full" id="libOnlineBtn"><span class="ms" aria-hidden="true">travel_explore</span>Look up "${esc(libQuery.trim())}" online</button>`;
      if (libOnline === 'loading') html += '<div class="lib-empty"><span class="dl-skel lib-skel"></span><span class="dl-skel lib-skel"></span>Searching Open Food Facts and USDA...</div>';
      else if (libOnline === 'error') html += empty('Could not reach the food databases.', 'Check your connection and try again, or add it below.');
      else if (Array.isArray(libOnline)) {
        html += libOnline.length
          ? `<div class="dl-card lib-card"><h6 class="dl-card-h"><span>Online</span><em>tap one to fill the form</em></h6>${libOnline.map((r, i) =>
              libRow(r.name + (r.brand ? ' (' + r.brand + ')' : ''), `${r.calories} · ${r.protein}g P · per ${esc(r.serving)}`, `data-lib-online="${i}"`, '',
                `<span class="dl-chip">${r.source === 'OFF' ? 'Open Food Facts' : 'USDA'}</span>`)).join('')}</div>`
          : empty('Nothing found online.', 'Try a shorter name, or add it below.');
      }
    }
    body.innerHTML = html;
  } else if (libTab === 'meals') {
    const combos = comboList().filter(c => !q || c.name.toLowerCase().includes(q));
    body.innerHTML = combos.length
      ? `<div class="dl-card lib-card">${combos.map(c => {
          const t = comboTotals(c);
          return libRow(c.name, `${Math.round(t.calories)} · ${Math.round(t.protein)}g P · ${c.items.length} item${c.items.length === 1 ? '' : 's'}: ${esc(c.items.map(i => i.food).join(', '))}`, '',
            `<button type="button" class="ss-act" data-lib-combo-edit="${esc(c.id)}" aria-label="Edit the saved meal ${esc(c.name)}"><span class="ms" aria-hidden="true">edit</span></button>
             <button type="button" class="ss-act" data-lib-combo-del="${esc(c.id)}" aria-label="Delete the saved meal ${esc(c.name)}"><span class="ms" aria-hidden="true">close</span></button>`);
        }).join('')}</div>`
      : empty(q ? 'No saved meal matches.' : 'No saved meals yet.', 'Open a meal with two or more foods and use Save these as a meal.');
  } else if (libTab === 'recent') {
    // Unique dishes, newest first.
    const seen = new Set();
    libRecentShown = [];
    for (let i = state.diet.length - 1; i >= 0 && libRecentShown.length < 30; i--) {
      const e = state.diet[i];
      const name = (e.food || '').trim();
      const lower = name.toLowerCase();
      if (!name || seen.has(lower) || isRemovedFood(lower)) continue;
      if (q && !lower.includes(q)) continue;
      seen.add(lower);
      libRecentShown.push({ name, meal: e.meal, date: e.date, per: perServingMacros(name, e) });
    }
    body.innerHTML = libRecentShown.length
      ? `<div class="dl-card lib-card">${libRecentShown.map((f, i) =>
          libRow(f.name, `${libMacroSub(f.per || {})} · ${esc(DIET_MEAL_LABEL[f.meal] || 'Snack').toLowerCase()}, ${esc(formatDate(f.date))}`, `data-lib-recent="${i}"`)).join('')}</div>`
      : empty(q ? 'Nothing recent matches.' : 'Nothing logged yet.', 'Foods appear here as you log them.');
  } else {
    const goals = getGoals();
    const days = [...new Set(state.diet.map(e => e.date))].sort().reverse().slice(0, 14);
    body.innerHTML = days.length
      ? `<div class="dl-card lib-card"><h6 class="dl-card-h"><span>Last ${days.length} logged day${days.length === 1 ? '' : 's'}</span><em>tap a day to open it</em></h6>${days.map(day => {
          const t = sumMacros(state.diet.filter(e => e.date === day));
          const over = t.calories > goals.calories;
          return `<button type="button" class="lib-row lib-day" data-lib-day="${day}">
            <span class="lib-main"><span class="lib-name">${esc(new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))}</span>
            <span class="lib-sub">${Math.round(t.protein)}g P · ${Math.round(t.carbs)}g C · ${Math.round(t.fat)}g F</span></span>
            <span class="lib-kcal${over ? ' is-over' : ''}">${Math.round(t.calories).toLocaleString()}${over ? ' over' : ''}</span>
          </button>`;
        }).join('')}</div>`
      : empty('No history yet.', 'Log a day of meals and it appears here.');
  }
  syncLibForm();
}

function syncLibForm() {
  const title = document.getElementById('libFormTitle');
  const save = document.getElementById('libSave');
  const cancel = document.getElementById('libCancel');
  if (title) title.textContent = libEditing ? `Edit ${libEditing}` : 'Not found? Add it';
  if (save) save.textContent = libEditing ? 'Update' : 'Add to my foods';
  if (cancel) cancel.hidden = !libEditing;
}

function fillLibForm(name, d, editing) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('libName', name);
  set('libKcal', d && d.calories != null ? Math.round(d.calories) : '');
  set('libP', d && d.protein != null ? d.protein : '');
  set('libC', d && d.carbs != null ? d.carbs : '');
  set('libF', d && d.fat != null ? d.fat : '');
  const form = document.getElementById('libForm');
  if (form) form.dataset.serving = (d && d.serving) || '';
  libEditing = editing ? name : null;
  syncLibForm();
  if (form) form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function clearLibForm() {
  ['libName', 'libKcal', 'libP', 'libC', 'libF'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const form = document.getElementById('libForm');
  if (form) form.dataset.serving = '';
  libEditing = null;
  syncLibForm();
}

function saveLibFood() {
  const val = (id) => (document.getElementById(id) || {}).value || '';
  const typed = val('libName').trim();
  const calories = Number(val('libKcal'));
  if (!typed) { showToast('Give the food a name first'); const n = document.getElementById('libName'); if (n) n.focus(); return; }
  if (!(calories > 0)) { showToast('Add its calories before saving'); const k = document.getElementById('libKcal'); if (k) k.focus(); return; }
  const food = (typeof safeFoodName === 'function') ? safeFoodName(typed) : typed;
  if (!food) { showToast('That name cannot be saved. Try plain letters and numbers'); return; }
  const lower = food.toLowerCase();
  const was = (libEditing || '').toLowerCase();
  // An explicit save overrides an earlier delete, and replaces any case variant
  // (or the old name, when this is a rename) instead of duplicating it.
  state.removedFoods = (state.removedFoods || []).filter(n => n !== lower);
  let existed = false;
  Object.keys(state.customFoods).forEach(k => {
    const kl = k.toLowerCase();
    if (kl === lower || (was && kl === was)) { existed = true; delete state.customFoods[k]; }
  });
  const form = document.getElementById('libForm');
  state.customFoods[food] = {
    calories: Math.round(calories),
    protein: Math.round((Number(val('libP')) || 0) * 10) / 10,
    carbs: Math.round((Number(val('libC')) || 0) * 10) / 10,
    fat: Math.round((Number(val('libF')) || 0) * 10) / 10,
    serving: (form && form.dataset.serving) || '1 serving',
    fiber: 0,
    sugar: 0,
  };
  if (typeof publishFoodToBank === 'function') publishFoodToBank(food, state.customFoods[food]);
  saveData(state);
  clearLibForm();
  libTab = 'foods';
  renderDiet();
  showToast(existed ? `${food} updated in My foods` : `${food} added to My foods`);
}

function removeLibFood(name) {
  const lower = name.toLowerCase();
  const removed = {};
  Object.keys(state.customFoods).forEach(k => { if (k.toLowerCase() === lower) { removed[k] = state.customFoods[k]; delete state.customFoods[k]; } });
  state.removedFoods = state.removedFoods || [];
  const wasRemoved = state.removedFoods.includes(lower);
  if (!wasRemoved) state.removedFoods.push(lower);
  saveData(state);
  renderDiet();
  showToast(`${name} removed. Tap to undo`, () => {
    Object.assign(state.customFoods, removed);
    if (!wasRemoved) state.removedFoods = state.removedFoods.filter(n => n !== lower);
    saveData(state);
    renderDiet();
  });
}

let libUiBound = false;
function bindFoodLibraryUi() {
  const lib = document.getElementById('dietLibrary');
  if (!lib || libUiBound) return;
  libUiBound = true;

  lib.addEventListener('click', (ev) => {
    const t = ev.target;
    const tab = t.closest('[data-lib-tab]');
    if (tab) { libTab = tab.dataset.libTab; renderFoodLibrary(); return; }
    const del = t.closest('[data-lib-del]');
    if (del) { removeLibFood(del.dataset.libDel); return; }
    const edit = t.closest('[data-lib-edit]');
    if (edit) { const n = edit.dataset.libEdit; fillLibForm(n, state.customFoods[n], true); return; }
    const cEdit = t.closest('[data-lib-combo-edit]');
    if (cEdit) { openComboEditor(cEdit.dataset.libComboEdit); return; }
    const cDel = t.closest('[data-lib-combo-del]');
    if (cDel) { removeSavedMeal(cDel.dataset.libComboDel); return; }
    const day = t.closest('[data-lib-day]');
    if (day) { dietViewDate = day.dataset.libDay; closeFoodLibrary(); return; }
    if (t.closest('#libOnlineBtn')) { lookupFoodOnline(libQuery); return; }
    const online = t.closest('[data-lib-online]');
    if (online && Array.isArray(libOnline)) {
      const r = libOnline[Number(online.dataset.libOnline)];
      if (r) {
        const clean = r.name.split(',')[0].split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        fillLibForm(r.brand ? `${clean} (${r.brand})` : clean, { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, serving: r.serving }, false);
      }
      return;
    }
    const recent = t.closest('[data-lib-recent]');
    if (recent) { const f = libRecentShown[Number(recent.dataset.libRecent)]; if (f) fillLibForm(f.name, f.per || {}, !!state.customFoods[f.name]); return; }
    const food = t.closest('[data-lib-food]');
    if (food) {
      const n = food.dataset.libFood;
      const own = state.customFoods[n];
      const d = own || FOOD_DATABASE[n.toLowerCase()] || (typeof sharedFoods !== 'undefined' && sharedFoods[n.toLowerCase()]);
      if (d) fillLibForm(n, d, !!own);
      return;
    }
    if (t.closest('#libSave')) { saveLibFood(); return; }
    if (t.closest('#libCancel')) { clearLibForm(); }
  });

  const search = document.getElementById('libSearch');
  if (search) search.addEventListener('input', () => { libQuery = search.value; libOnline = null; renderFoodLibrary(); });
}

// Saved meals are deleted with the way back on the toast, not a confirm().
function removeSavedMeal(id) {
  const list = comboList();
  const i = list.findIndex(c => c.id === id);
  if (i === -1) return;
  const gone = list.splice(i, 1)[0];
  saveData(state);
  renderDiet();
  showToast(`Deleted the saved meal "${gone.name}". Tap to undo`, () => {
    comboList().splice(Math.min(i, comboList().length), 0, gone);
    saveData(state);
    renderDiet();
  });
}
