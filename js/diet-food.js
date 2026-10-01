function searchFoodDatabase(query) {
  query = query.toLowerCase().trim();
  if (!query) return [];
  const results = [];

  // Search custom foods first (score -1 to prioritize)
  for (const [name, data] of Object.entries(state.customFoods)) {
    const lower = name.toLowerCase();
    if (lower.startsWith(query)) {
      results.push({ name, data, score: -1, custom: true });
    } else if (lower.includes(query)) {
      results.push({ name, data, score: 0, custom: true });
    } else {
      const words = query.split(/\s+/);
      if (words.every(w => lower.includes(w))) {
        results.push({ name, data, score: 1, custom: true });
      }
    }
  }

  // Shared community bank (foods other people saved), skipping anything already
  // in your own bank so it isn't listed twice.
  const own = new Set(Object.keys(state.customFoods).map(k => k.toLowerCase()));
  if (typeof sharedFoods !== 'undefined' && sharedFoods) {
    for (const [lower, data] of Object.entries(sharedFoods)) {
      if (own.has(lower)) continue;
      const name = data.name || lower;
      if (lower.startsWith(query)) results.push({ name, data, score: -0.5, shared: true });
      else if (lower.includes(query)) results.push({ name, data, score: 0.5, shared: true });
      else {
        const words = query.split(/\s+/);
        if (words.every(w => lower.includes(w))) results.push({ name, data, score: 1.5, shared: true });
      }
    }
  }

  // Then built-in database
  const already = new Set(results.map(r => r.name.toLowerCase()));
  for (const [name, data] of Object.entries(FOOD_DATABASE)) {
    if (already.has(name.toLowerCase())) continue;
    if (name.startsWith(query)) {
      results.push({ name, data, score: 0 });
    } else if (name.includes(query)) {
      results.push({ name, data, score: 1 });
    } else {
      const words = query.split(/\s+/);
      if (words.every(w => name.includes(w))) {
        results.push({ name, data, score: 2 });
      }
    }
  }
  return results.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, 8);
}

// Auto-add a logged food to the searchable food database (My Foods) if it's new.
// Stores PER-SERVING macros so quantities scale correctly next time.
// Foods the user explicitly deleted — never auto-add these again
function isRemovedFood(name) {
  return (state.removedFoods || []).includes((name || '').trim().toLowerCase());
}

function rememberFood(name, totals, servings) {
  let key = (name || '').trim();
  if (!key) return false;
  const lower = key.toLowerCase();
  // User deleted this food before — respect that.
  if (isRemovedFood(lower)) return false;
  // Already a built-in food? Nothing to remember.
  if (FOOD_DATABASE[lower]) return false;
  // Already saved (case-insensitive)? Don't duplicate or overwrite.
  if (Object.keys(state.customFoods).some(k => k.toLowerCase() === lower)) return false;
  // No macros worth saving.
  if (!totals.calories) return false;

  // Fractional servings (0.5x chutney) must divide correctly — never round up to 1.
  //
  // Derived from what was passed in and nothing else. This used to prefer a
  // global left over from the library's editor and read the serving text out of
  // a form field, so banking food A could pick up food B's macros if B had been
  // opened in the editor first.
  const n = Number(servings) > 0 ? Number(servings) : 1;
  const per = {
    calories: Math.round(totals.calories / n),
    protein: Math.round(((totals.protein || 0) / n) * 10) / 10,
    carbs: Math.round(((totals.carbs || 0) / n) * 10) / 10,
    fat: Math.round(((totals.fat || 0) / n) * 10) / 10,
  };

  // Keyed by display name, so the name has to be a legal Firebase key.
  key = (typeof safeFoodName === 'function') ? safeFoodName(key) : key;
  if (!key) return false;
  state.customFoods[key] = {
    calories: per.calories,
    protein: per.protein,
    carbs: per.carbs,
    fat: per.fat,
    serving: '1 serving',
    fiber: 0,
    sugar: 0,
  };
  if (typeof publishFoodToBank === 'function') publishFoodToBank(key, state.customFoods[key]);
  return true;
}

// Sweep the whole diet log and bank any dish that isn't searchable yet.
// Catches foods logged before auto-remember existed and entries synced in
// from other devices. Iterates newest-first so the latest macros win.
function backfillRememberedFoods() {
  let added = 0;
  const seen = new Set(Object.keys(state.customFoods).map(k => k.toLowerCase()));
  for (let i = state.diet.length - 1; i >= 0; i--) {
    const e = state.diet[i];
    const key = (e.food || '').trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (FOOD_DATABASE[lower] || seen.has(lower) || isRemovedFood(lower)) continue;
    if (!e.calories) continue;
    const n = Number(e.servings) > 0 ? Number(e.servings) : 1;
    // Same rule for auto-banking: the photo/voice analysis names foods freely,
    // and one slash in a name used to break every save from then on.
    const safeKey = (typeof safeFoodName === 'function') ? safeFoodName(key) : key;
    if (!safeKey) continue;
    state.customFoods[safeKey] = {
      calories: Math.round(e.calories / n),
      protein: Math.round(((e.protein || 0) / n) * 10) / 10,
      carbs: Math.round(((e.carbs || 0) / n) * 10) / 10,
      fat: Math.round(((e.fat || 0) / n) * 10) / 10,
      serving: '1 serving',
      fiber: 0,
      sugar: 0,
    };
    if (typeof publishFoodToBank === 'function') publishFoodToBank(safeKey, state.customFoods[safeKey]);
    seen.add(lower);
    added++;
  }
  return added;
}

function parseOFFNutrients(product) {
  const n = product.nutriments || {};
  // energy-kcal_100g is preferred; fallback to energy_100g (kJ) converted to kcal
  let cal = n['energy-kcal_100g'] || n['energy-kcal_serving'] || n['energy-kcal'] || 0;
  if (!cal && (n['energy_100g'] || n['energy'])) {
    cal = Math.round((n['energy_100g'] || n['energy']) / 4.184);
  }
  return {
    calories: Math.round(cal),
    protein: Math.round((n.proteins_100g || n.proteins_serving || n.proteins || 0) * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || n.carbohydrates_serving || n.carbohydrates || 0) * 10) / 10,
    fat: Math.round((n.fat_100g || n.fat_serving || n.fat || 0) * 10) / 10,
    fiber: Math.round((n.fiber_100g || n.fiber_serving || n.fiber || 0) * 10) / 10,
    sugar: Math.round((n.sugars_100g || n.sugars_serving || n.sugars || 0) * 10) / 10,
  };
}

function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Look a food up online for the Food library: Open Food Facts, then USDA, in
// parallel with a timeout each. Results land in libOnline and the library
// re-renders; tapping one fills the add-your-own form.
async function lookupFoodOnline(query) {
  const q = (query || '').trim();
  if (q.length < 2) return;
  libOnline = 'loading';
  renderFoodLibrary();

  const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments,serving_size`;
  const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=6&dataType=Survey%20(FNDDS),Branded&api_key=DEMO_KEY`;

  const [offResult, usdaResult] = await Promise.allSettled([
    fetchWithTimeout(offUrl).then(r => r.ok ? r.json() : null).catch(() => null),
    fetchWithTimeout(usdaUrl).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  // The query moved on while this was in flight: its answer is not wanted.
  if ((libQuery || '').trim() !== q) return;

  let results = [];
  const offData = offResult.status === 'fulfilled' ? offResult.value : null;
  if (offData && offData.products) {
    results.push(...offData.products
      .filter(p => p.product_name && p.nutriments)
      .map(p => ({ name: p.product_name, brand: p.brands || '', serving: p.serving_size || '100g', source: 'OFF', ...parseOFFNutrients(p) })));
  }
  const usdaData = usdaResult.status === 'fulfilled' ? usdaResult.value : null;
  if (usdaData && usdaData.foods) {
    usdaData.foods.forEach(food => {
      const n = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      (food.foodNutrients || []).forEach(x => {
        if (x.nutrientName === 'Energy') n.calories = Math.round(x.value || 0);
        if (x.nutrientName === 'Protein') n.protein = Math.round((x.value || 0) * 10) / 10;
        if (x.nutrientName === 'Carbohydrate, by difference') n.carbs = Math.round((x.value || 0) * 10) / 10;
        if (x.nutrientName === 'Total lipid (fat)') n.fat = Math.round((x.value || 0) * 10) / 10;
      });
      results.push({
        name: food.description, brand: food.brandName || food.brandOwner || '',
        serving: food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : '100g',
        source: 'USDA', ...n,
      });
    });
  }

  // Both lookups failing is a connection problem, not "no such food".
  if (!offData && !usdaData) { libOnline = 'error'; renderFoodLibrary(); return; }

  const seen = new Set();
  libOnline = results.filter(r => {
    const key = (r.name + r.brand).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return r.calories > 0;
  }).slice(0, 8);
  renderFoodLibrary();
}

function bindDietEvents() {
  const dateInput = $('#dietDate');
  if (dateInput) {
    dateInput.addEventListener('change', (e) => { if (e.target.value) { dietViewDate = e.target.value; renderDiet(); } });
    dateInput.addEventListener('click', (e) => { try { e.target.showPicker(); } catch (err) { /* not supported: the field still works */ } });
  }
  const shift = (n) => () => {
    const d = new Date(dietViewDate + 'T00:00:00');
    d.setDate(d.getDate() + n);
    dietViewDate = toLocalDateStr(d);
    renderDiet();
  };
  $('#dietPrevDay').addEventListener('click', shift(-1));
  $('#dietNextDay').addEventListener('click', shift(1));
  $('#dietToday').addEventListener('click', () => { dietViewDate = getTodayStr(); renderDiet(); });

  bindWaterEvents();
  if (typeof bindDietDay === 'function') bindDietDay();
  if (typeof bindComboSheet === 'function') bindComboSheet();
}
