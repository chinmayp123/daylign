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
          <input type="number" class="dic-in dic-cal" placeholder="cal" min="0" inputmode="numeric">
          <input type="number" class="dic-in dic-p" placeholder="P" min="0" step="0.1" inputmode="decimal">
          <input type="number" class="dic-in dic-c" placeholder="C" min="0" step="0.1" inputmode="decimal">
          <input type="number" class="dic-in dic-f" placeholder="F" min="0" step="0.1" inputmode="decimal">
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
  if (typeof showToast === 'function') showToast(`✓ ${result.name} → ${meal}`);
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

function saveCombo(name, items) {
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
  const added = [];
  combo.items.forEach(it => {
    const entry = {
      date: dietViewDate, meal: meal, food: it.food, servings: it.servings,
      calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
    };
    state.diet.push(entry);
    added.push(entry);
  });
  saveData(state);
  if (typeof haptic === 'function') haptic('success');
  // Undo matters more here than for a single food: one tap just wrote five rows.
  lastComboAdd = { meal: meal, count: added.length, at: Date.now() };
  if (typeof showToast === 'function') {
    showToast(`✓ ${combo.name} — ${added.length} items → ${meal}. Tap to undo.`, undoLastCombo);
  }
  renderDiet();
}

let lastComboAdd = null;

function undoLastCombo() {
  if (!lastComboAdd || Date.now() - lastComboAdd.at > 60000) return;
  // Remove exactly the rows just appended — they are the last N of this meal.
  let toRemove = lastComboAdd.count;
  for (let i = state.diet.length - 1; i >= 0 && toRemove > 0; i--) {
    if (state.diet[i] && state.diet[i].meal === lastComboAdd.meal && state.diet[i].date === dietViewDate) {
      state.diet.splice(i, 1);
      toRemove--;
    }
  }
  lastComboAdd = null;
  saveData(state);
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
      showToast(`✓ Saved "${combo.name}" — ${combo.items.length} items`);
      renderDiet();
    }
  });
}
