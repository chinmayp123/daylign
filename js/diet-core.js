// ========== Which meal is it right now ==========
// There were three of these, and they disagreed:
//   diet-goals   lunch 11-16, dinner 16-21
//   diet-view    lunch <16,   dinner <22
//   food-photo   lunch <15,   dinner <20
// So the plan card could say "Up next: Dinner" at 4pm while the camera
// defaulted a photo to lunch. One rule now, used by all three.
//
// Dinner starts at 19:00 because that is when dinner actually happens here —
// the old windows called 4pm dinner, which made the next-meal suggestion
// nonsense for most of the afternoon. Late afternoon is a snack, which is what
// actually gets eaten then.
const MEAL_WINDOWS = [
  { meal: 'breakfast', from: 4,  to: 11 },
  { meal: 'lunch',     from: 11, to: 16 },
  { meal: 'dinner',    from: 19, to: 23 },
];

function mealForHour(h) {
  const hour = Number(h);
  for (let i = 0; i < MEAL_WINDOWS.length; i++) {
    const w = MEAL_WINDOWS[i];
    if (hour >= w.from && hour < w.to) return w.meal;
  }
  // 16:00-19:00 and 23:00-04:00 — genuinely snack territory.
  return 'snack';
}

function mealForNow() {
  return mealForHour(new Date().getHours());
}

let dietBackfillNotified = false;
let recentFoodsOpen = null; // per-meal open/collapsed state, survives re-renders
let dietInlineOpenMeal = null; // which meal's inline quick-add is open, survives re-renders

// Render inline search results under a meal's quick-add.
function renderInlineResults(wrap, query) {
  const box = wrap.querySelector('.diet-inline-results');
  if (!box) return;
  const q = (query || '').trim();
  if (!q) { box.innerHTML = ''; return; }
  const results = searchFoodDatabase(q);
  if (!results.length) {
    // No match in DB/bank/shared — let them add it as a brand-new food right
    // here: enter macros, it logs to this meal AND is remembered for next time.
    const meal = wrap.dataset.meal;
    const label = meal ? meal[0].toUpperCase() + meal.slice(1) : 'meal';
    box.innerHTML = `
      <div class="diet-inline-custom">
        <div class="diet-inline-custom-title">Add “${esc(q)}” as a new food</div>
        <div class="diet-inline-custom-macros">
          <label class="dic-field"><span>Calories</span>
            <input type="number" class="dic-in dic-cal" placeholder="0" min="0" inputmode="numeric" aria-label="Calories"></label>
          <label class="dic-field"><span>Protein <i>g</i></span>
            <input type="number" class="dic-in dic-p" placeholder="0" min="0" step="0.1" inputmode="decimal" aria-label="Protein in grams"></label>
          <label class="dic-field"><span>Carbs <i>g</i></span>
            <input type="number" class="dic-in dic-c" placeholder="0" min="0" step="0.1" inputmode="decimal" aria-label="Carbs in grams"></label>
          <label class="dic-field"><span>Fat <i>g</i></span>
            <input type="number" class="dic-in dic-f" placeholder="0" min="0" step="0.1" inputmode="decimal" aria-label="Fat in grams"></label>
        </div>
        <button type="button" class="btn-primary dic-add">Add to ${label}</button>
      </div>`;
    const addBtn = box.querySelector('.dic-add');
    if (addBtn) addBtn.addEventListener('click', () => {
      const macros = {
        calories: Number(box.querySelector('.dic-cal').value) || 0,
        protein: Number(box.querySelector('.dic-p').value) || 0,
        carbs: Number(box.querySelector('.dic-c').value) || 0,
        fat: Number(box.querySelector('.dic-f').value) || 0,
      };
      if (!macros.calories && !macros.protein && !macros.carbs && !macros.fat) {
        showToast('Add at least calories or a macro'); return;
      }
      if (typeof rememberFood === 'function') rememberFood(q, macros, 1);
      quickAddToMeal(meal, { name: q, data: macros }, false);
    });
    return;
  }
  box.innerHTML = results.map((r, i) => {
    const d = r.data || {};
    const badge = r.custom ? '<span class="diet-inline-badge">My Food</span>' : r.shared ? '<span class="diet-inline-badge shared">Shared</span>' : '';
    return `<button type="button" class="diet-inline-row" data-inline-idx="${i}">
      <span class="diet-inline-name">${esc(r.name)}${badge}</span>
      <span class="diet-inline-macros">${Math.round(d.calories || 0)} cal · ${Math.round(d.protein || 0)}P ${Math.round(d.carbs || 0)}C ${Math.round(d.fat || 0)}F</span>
      <span class="diet-inline-plus">+</span>
    </button>`;
  }).join('');
  box.querySelectorAll('.diet-inline-row').forEach((rowEl, i) => {
    rowEl.addEventListener('click', () => quickAddToMeal(wrap.dataset.meal, results[i]));
  });
}

// One-tap add a searched food to a specific meal, at one serving.
function quickAddToMeal(meal, result, keepSearchOpen) {
  const d = result.data || {};
  state.diet.push({
    date: dietViewDate,
    meal: meal,
    food: result.name,
    servings: 1,
    calories: Number(d.calories) || 0,
    protein: Number(d.protein) || 0,
    carbs: Number(d.carbs) || 0,
    fat: Number(d.fat) || 0,
  });
  saveData(state);
  // Tiles pass keepSearchOpen=false so a one-tap add doesn't pop the search box.
  if (keepSearchOpen !== false) dietInlineOpenMeal = meal;
  renderDiet();
}

// Per-serving macros for a food: prefer the food bank / built-in DB / shared
// bank; otherwise derive from a logged entry (its macros ÷ its servings).
function perServingMacros(name, entry) {
  const lower = (name || '').toLowerCase();
  const bankedEntry = Object.entries(state.customFoods).find(([k]) => k.toLowerCase() === lower);
  const banked = (bankedEntry && bankedEntry[1]) || FOOD_DATABASE[lower] || (typeof sharedFoods !== 'undefined' && sharedFoods[lower]);
  if (banked) return banked;
  if (!entry) return null;
  const n = Number(entry.servings) > 0 ? Number(entry.servings) : 1;
  return {
    calories: Math.round((entry.calories || 0) / n),
    protein: Math.round(((entry.protein || 0) / n) * 10) / 10,
    carbs: Math.round(((entry.carbs || 0) / n) * 10) / 10,
    fat: Math.round(((entry.fat || 0) / n) * 10) / 10,
    serving: '1 serving',
  };
}

// "Your Usuals" for a meal: the foods you log MOST for that meal, most-frequent
// first (newest entry breaks ties and supplies the macros). Powers the one-tap
// tiles so a routine day is logged without searching or typing.
function mealUsuals(meal, limit) {
  limit = limit || 4;
  const byFood = {};
  for (let i = 0; i < state.diet.length; i++) {
    const e = state.diet[i];
    if (e.meal !== meal) continue;
    const name = (e.food || '').trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (typeof isRemovedFood === 'function' && isRemovedFood(lower)) continue;
    let rec = byFood[lower];
    if (!rec) rec = byFood[lower] = { name, score: 0, lastIdx: -1 };
    rec.score += 1;
    rec.name = name;   // newest casing wins
    rec.lastIdx = i;   // newest entry: macros + tiebreak
  }
  return Object.keys(byFood)
    .map(k => byFood[k])
    .sort((a, b) => b.score - a.score || b.lastIdx - a.lastIdx)
    .slice(0, limit)
    .map(rec => ({ name: rec.name, per: perServingMacros(rec.name, state.diet[rec.lastIdx]) }))
    .filter(u => u.per);
}

// Which logged entry's servings stepper is expanded (survives re-render).
let dietEditOpenIdx = null;
// "Skip or shrink today" advice shows expanded by default so it's actually
// useful — just in a calm, light style rather than bold red cards. Still
// collapsible via the chevron; remembers its state per session.
let dietAdviceOpen = true;

// Food Library sub-page: Recent Foods, My Food Bank, Diet History and manual
// entry live here now, off the main Diet screen. Toggled by a class on #dietView.
function openFoodLibrary() {
  const v = document.getElementById('dietView');
  if (!v) return;
  v.classList.add('lib-open');
  window.scrollTo(0, 0);
}
function closeFoodLibrary() {
  const v = document.getElementById('dietView');
  if (!v) return;
  v.classList.remove('lib-open');
  window.scrollTo(0, 0);
}
function bindFoodLibrary() {
  const open = document.getElementById('openFoodLibraryBtn');
  const close = document.getElementById('closeFoodLibraryBtn');
  if (open) open.addEventListener('click', openFoodLibrary);
  if (close) close.addEventListener('click', closeFoodLibrary);
}


// ========== Meal combos ==========
// A named set of foods you eat together, each remembering its own servings.
//
// Grounded in the log rather than guessed at. Two things it found that changed
// the design:
//   - A combo is a SUBSET of a meal, not the meal. The protein shake was logged
//     under breakfast alongside 2 eggs; saving "the meal" would have baked the
//     eggs into the shake. Hence per-item selection when saving.
//   - Servings must be stored per item. Peanut butter is 0.5x every time it has
//     ever been logged; without that the shake comes back with double the
//     peanut butter.
//
// Adding is immediate rather than previewed: 80% of meals here are 2+ items and
// almost every repeat differs slightly (the banana got dropped on the shake's
// second outing), so the fix-afterwards path is the common one and it already
// exists — every added row has its own x and servings stepper.
function comboList() {
  if (!Array.isArray(state.combos)) state.combos = [];
  return state.combos;
}

function saveCombo(name, items, id) {
  const clean = (items || [])
    .filter(it => it && it.food)
    .map(it => ({
      food: String(it.food).trim().slice(0, 80),
      servings: Number(it.servings) > 0 ? Number(it.servings) : 1,
      calories: Math.max(0, Number(it.calories) || 0),
      protein: Math.max(0, Number(it.protein) || 0),
      carbs: Math.max(0, Number(it.carbs) || 0),
      fat: Math.max(0, Number(it.fat) || 0),
    }));
  if (!clean.length) return null;
  const label = String(name || '').trim().slice(0, 60) || clean[0].food;
  const list = comboList();
  // Editing an existing combo updates it in place — renaming must not orphan
  // the old one or leave two chips behind.
  if (id) {
    const at = list.findIndex(c => c.id === id);
    if (at !== -1) {
      list[at] = { id: id, name: label, items: clean };
      saveData(state);
      return list[at];
    }
  }
  // Re-saving under an existing name replaces it, so correcting a combo does
  // not leave two chips with the same label.
  const existing = list.findIndex(c => (c.name || '').toLowerCase() === label.toLowerCase());
  const combo = { id: 'c' + Date.now(), name: label, items: clean };
  if (existing !== -1) list[existing] = combo; else list.push(combo);
  saveData(state);
  return combo;
}

function deleteCombo(id) {
  const list = comboList();
  const i = list.findIndex(c => c.id === id);
  if (i === -1) return;
  list.splice(i, 1);
  saveData(state);
  renderDiet();
}

function comboTotals(combo) {
  return (combo.items || []).reduce((a, it) => ({
    calories: a.calories + (it.calories || 0),
    protein: a.protein + (it.protein || 0),
    carbs: a.carbs + (it.carbs || 0),
    fat: a.fat + (it.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// One tap logs every item. The macros stored on each item are already for its
// servings, so they are copied straight across rather than re-multiplied.
function addComboToMeal(comboId, meal) {
  const combo = comboList().find(c => c.id === comboId);
  if (!combo) return;
  const gid = 'g' + Date.now() + Math.random().toString(36).slice(2, 6);
  const added = [];
  combo.items.forEach(it => {
    const entry = {
      date: dietViewDate, meal: meal, food: it.food, servings: it.servings,
      calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
      // Ingredients stay separate entries so every total, chart and analytic
      // keeps working untouched — the grouping is purely how the log DRAWS
      // them. One row that expands, rather than five loose ones.
      group: gid, groupName: combo.name,
    };
    state.diet.push(entry);
    added.push(entry);
  });
  saveData(state);
  if (typeof haptic === 'function') haptic('success');
  // Undo matters more here than for a single food: one tap just wrote five rows.
  renderDiet();
}



// The save picker. Deliberately a sheet rather than a prompt(): the whole point
// is choosing WHICH items belong to the combo, and prompt() cannot show a list.
function openComboSaver(meal) {
  const entries = state.diet
    .map((e, i) => ({ e: e, i: i }))
    .filter(x => x.e && x.e.date === dietViewDate && x.e.meal === meal);
  if (entries.length < 2) return;

  const existing = document.getElementById('comboSaver');
  if (existing) existing.remove();

  const suggested = entries.length
    ? entries[0].e.food + (entries.length > 1 ? ' + ' + (entries.length - 1) + ' more' : '')
    : meal;

  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay active';
  wrap.id = 'comboSaver';
  wrap.innerHTML = `
    <div class="modal combo-saver">
      <div class="modal-header">
        <div class="modal-header-left">
          <h2>Save combo</h2>
          <p class="modal-subtitle">Tick what belongs together. Servings are remembered.</p>
        </div>
        <button type="button" class="modal-close" id="comboCancel" aria-label="Cancel">&times;</button>
      </div>
      <div class="combo-saver-body">
        <label class="form-group">
          <span class="form-label">Name</span>
          <input type="text" id="comboName" class="combo-name-input" value="${esc(suggested)}" maxlength="60" autocomplete="off">
        </label>
        <div class="combo-pick-list">
          ${entries.map(x => `
            <label class="combo-pick">
              <input type="checkbox" checked data-idx="${x.i}">
              <span class="combo-pick-name">${esc(x.e.food)}</span>
              <span class="combo-pick-serv">${(Number(x.e.servings) || 1)}&times;</span>
              <span class="combo-pick-cal">${Math.round(x.e.calories || 0)} cal</span>
            </label>`).join('')}
        </div>
        <div class="combo-saver-actions">
          <button type="button" class="btn-secondary" id="comboCancel2">Cancel</button>
          <button type="button" class="btn-primary" id="comboSave">Save combo</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#comboCancel').addEventListener('click', close);
  wrap.querySelector('#comboCancel2').addEventListener('click', close);
  wrap.querySelector('#comboSave').addEventListener('click', () => {
    const picked = [...wrap.querySelectorAll('.combo-pick input:checked')]
      .map(cb => state.diet[Number(cb.dataset.idx)])
      .filter(Boolean);
    if (!picked.length) { showToast('Pick at least one item'); return; }
    const name = wrap.querySelector('#comboName').value;
    const combo = saveCombo(name, picked);
    close();
    if (combo) {
      if (typeof haptic === 'function') haptic('success');
      renderDiet();
    }
  });
}

// Edit a saved meal: rename it, drop items, or change how much of each.
// Reuses the same picker as saving, sourced from the combo instead of a logged
// meal — without this a mis-saved combo was permanent, since deleteCombo
// existed but was wired to nothing.
function openComboEditor(id) {
  const combo = comboList().find(c => c.id === id);
  if (!combo) return;

  const existing = document.getElementById('comboSaver');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay active';
  wrap.id = 'comboSaver';
  wrap.innerHTML = `
    <div class="modal combo-saver">
      <div class="modal-header">
        <div class="modal-header-left">
          <h2>Edit saved meal</h2>
          <p class="modal-subtitle">Untick to remove. Servings are what gets logged.</p>
        </div>
        <button type="button" class="modal-close" id="comboCancel" aria-label="Cancel">&times;</button>
      </div>
      <div class="combo-saver-body">
        <label class="form-group">
          <span class="form-label">Name</span>
          <input type="text" id="comboName" class="combo-name-input" value="${esc(combo.name)}" maxlength="60" autocomplete="off">
        </label>
        <div class="combo-pick-list">
          ${combo.items.map((it, i) => `
            <label class="combo-pick">
              <input type="checkbox" checked data-i="${i}">
              <span class="combo-pick-name">${esc(it.food)}</span>
              <span class="combo-serv-edit">
                <button type="button" class="combo-serv-step" data-i="${i}" data-step="-0.5" aria-label="Fewer">&minus;</button>
                <span class="combo-serv-val" data-i="${i}">${it.servings}</span>
                <button type="button" class="combo-serv-step" data-i="${i}" data-step="0.5" aria-label="More">+</button>
              </span>
              <span class="combo-pick-cal" data-cal="${i}">${Math.round(it.calories)} cal</span>
            </label>`).join('')}
        </div>
        <div class="combo-saver-actions">
          <button type="button" class="btn-secondary" id="comboCancel2">Cancel</button>
          <button type="button" class="btn-primary" id="comboSave">Save changes</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  // Work on a copy so Cancel really cancels.
  const draft = combo.items.map(it => Object.assign({}, it));

  wrap.querySelectorAll('.combo-serv-step').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const i = Number(btn.dataset.i);
      const it = draft[i];
      const was = it.servings || 1;
      const next = Math.max(0.5, Math.round((was + Number(btn.dataset.step)) * 2) / 2);
      // Macros are stored for the servings, so rescale them by the same ratio
      // rather than leaving 3 scoops carrying 1 scoop's protein.
      const k = next / was;
      ['calories', 'protein', 'carbs', 'fat'].forEach(m => { it[m] = Math.round((it[m] || 0) * k * 10) / 10; });
      it.servings = next;
      wrap.querySelector(`.combo-serv-val[data-i="${i}"]`).textContent = next;
      wrap.querySelector(`[data-cal="${i}"]`).textContent = Math.round(it.calories) + ' cal';
    });
  });

  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#comboCancel').addEventListener('click', close);
  wrap.querySelector('#comboCancel2').addEventListener('click', close);
  wrap.querySelector('#comboSave').addEventListener('click', () => {
    const picked = [...wrap.querySelectorAll('.combo-pick input:checked')].map(cb => draft[Number(cb.dataset.i)]).filter(Boolean);
    if (!picked.length) { showToast('A saved meal needs at least one item'); return; }
    const saved = saveCombo(wrap.querySelector('#comboName').value, picked, combo.id);
    close();
    if (saved) {
      if (typeof haptic === 'function') haptic('success');
      renderDiet();
    }
  });
}

// Which combo groups are expanded in the log. Collapsed by default — the point
// of grouping is that breakfast reads as "Bread omelette", not five lines.
let dietGroupOpen = {};

function toggleDietGroup(gid) {
  dietGroupOpen[gid] = !dietGroupOpen[gid];
  renderDiet();
}

// Split a meal's entries into ordered blocks: either a single loose food, or a
// combo group with its ingredients. Order follows first appearance, so adding
// a combo does not reshuffle what is already logged.
function groupMealEntries(entries) {
  const blocks = [];
  const byGid = {};
  entries.forEach(e => {
    const gid = e && e.group;
    if (!gid) { blocks.push({ type: 'single', entry: e }); return; }
    if (!byGid[gid]) {
      byGid[gid] = { type: 'group', gid: gid, name: e.groupName || 'Meal', items: [] };
      blocks.push(byGid[gid]);
    }
    byGid[gid].items.push(e);
  });
  blocks.forEach(b => {
    if (b.type !== 'group') return;
    b.totals = b.items.reduce((a, e) => ({
      calories: a.calories + (e.calories || 0), protein: a.protein + (e.protein || 0),
      carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
  return blocks;
}

// Add an ingredient to an already-logged combo — recipes change with whatever
// is in the fridge, so a logged group must not be frozen.
function addIngredientToGroup(gid, meal, name, per) {
  state.diet.push({
    date: dietViewDate, meal: meal, food: name, servings: 1,
    calories: Number(per.calories) || 0, protein: Number(per.protein) || 0,
    carbs: Number(per.carbs) || 0, fat: Number(per.fat) || 0,
    group: gid, groupName: (state.diet.find(e => e.group === gid) || {}).groupName || 'Meal',
  });
  saveData(state);
  dietGroupOpen[gid] = true;
  if (typeof rememberFood === 'function') rememberFood(name, per, 1);
  renderDiet();
}

// Remove an entire logged meal group. Undoable rather than confirm-gated: a
// confirm dialog on every removal is friction on the common case, and undo
// covers the mistake better than a modal you learn to dismiss.

// No undo toast: both directions are already one tap. A wrongly added meal
// has an x on its header, a wrongly removed one is one tap on its chip. A
// toast confirming what you just watched happen is noise.
function deleteDietGroup(gid) {
  const removed = state.diet.filter(e => e && e.group === gid);
  if (!removed.length) return;
  const name = removed[0].groupName || 'Meal';
  state.diet = state.diet.filter(e => !(e && e.group === gid));
  delete dietGroupOpen[gid];
  saveData(state);
  if (typeof haptic === 'function') haptic('light');
  renderDiet();
}

