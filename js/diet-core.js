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

