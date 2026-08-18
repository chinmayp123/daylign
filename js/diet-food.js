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

function selectFoodFromDropdown(name, data) {
  $('#dietFoodName').value = name.charAt(0).toUpperCase() + name.slice(1);
  dietBaseMacros = { calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat };
  $('#dietServings').value = 1;
  updateMacrosByServings();
  $('#dietSearchDropdown').innerHTML = '';
  $('#dietSearchDropdown').classList.remove('visible');
  const info = [`Per serving: ${data.serving}`];
  if (data.fiber) info.push(`Fiber: ${data.fiber}g`);
  if (data.sugar) info.push(`Sugar: ${data.sugar}g`);
  $('#dietServingInfo').innerHTML = `<span class="diet-serving-tag">${info.join(' &middot; ')}</span>`;
  syncSaveCustomLabel();
  revealFoodEditor(name);
}

// The "Add a food to your bank" card is no longer a standing form — logging
// happens inline on each meal, by photo, or from the bank, so a blank macro
// form sitting at the top of the Food Library was the first thing you saw and
// the last thing you needed. It is still the ONLY editor those fields have,
// though: the pencil on a food and tapping any bank row both fill it in. So it
// stays in the DOM, hidden, and appears when you actually pick something to
// edit. Deleting the markup instead would throw on every food tap.
function revealFoodEditor(name) {
  const card = document.querySelector('.diet-bank-card');
  if (!card) return;
  card.classList.add('is-editing');
  const title = card.querySelector('h2');
  if (title && name) title.textContent = `Edit ${name}`;
}

function hideFoodEditor() {
  const card = document.querySelector('.diet-bank-card');
  if (!card) return;
  card.classList.remove('is-editing');
  const title = card.querySelector('h2');
  if (title) title.textContent = 'Add a food to your bank';
  ['#dietFoodName', '#dietCalories', '#dietProtein', '#dietCarbs', '#dietFat'].forEach(sel => {
    const el = $(sel); if (el) el.value = '';
  });
  const info = $('#dietServingInfo'); if (info) info.innerHTML = '';
  dietBaseMacros = null;
}

// "Save as My Food" flips to "Update My Food" when the typed name is already banked
function syncSaveCustomLabel() {
  const label = $('#dietSaveCustomLabel');
  if (!label) return;
  const name = ($('#dietFoodName').value || '').trim().toLowerCase();
  const exists = name && Object.keys(state.customFoods).some(k => k.toLowerCase() === name);
  label.textContent = exists ? 'Update My Food' : 'Save as My Food';
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

  // Fractional servings (0.5x chutney) must divide correctly — never round up to 1
  const n = Number(servings) > 0 ? Number(servings) : 1;
  // Prefer per-serving macros captured when picking from a dropdown; otherwise
  // derive them from the entered totals divided by servings.
  const per = dietBaseMacros ? dietBaseMacros : {
    calories: Math.round(totals.calories / n),
    protein: Math.round((totals.protein / n) * 10) / 10,
    carbs: Math.round((totals.carbs / n) * 10) / 10,
    fat: Math.round((totals.fat / n) * 10) / 10,
  };
  const serving = ($('#dietServingInfo').textContent || '')
    .replace(/^Per\s+(serving:\s*)?/i, '')
    .split('·')[0]
    .replace(/\(.*$/, '')
    .trim() || '1 serving';

  // Keyed by display name, so the name has to be a legal Firebase key.
  key = (typeof safeFoodName === 'function') ? safeFoodName(key) : key;
  if (!key) return false;
  state.customFoods[key] = {
    calories: per.calories,
    protein: per.protein,
    carbs: per.carbs,
    fat: per.fat,
    serving,
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

function updateMacrosByServings() {
  if (!dietBaseMacros) return;
  const servings = Number($('#dietServings').value) || 1;
  $('#dietCalories').value = Math.round(dietBaseMacros.calories * servings);
  $('#dietProtein').value = Math.round(dietBaseMacros.protein * servings * 10) / 10;
  $('#dietCarbs').value = Math.round(dietBaseMacros.carbs * servings * 10) / 10;
  $('#dietFat').value = Math.round(dietBaseMacros.fat * servings * 10) / 10;
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

async function lookupFoodAPI(query) {
  const dropdown = $('#dietSearchDropdown');
  // Don't replace dropdown if user is hovering over it
  const isHovered = dropdown.matches(':hover');
  if (isHovered) return;
  dropdown.innerHTML = '<div class="diet-search-loading">Searching food databases...</div>';
  dropdown.classList.add('visible');

  // Run both APIs in parallel with a 3s timeout each
  const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments,serving_size`;
  const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=6&dataType=Survey%20(FNDDS),Branded&api_key=DEMO_KEY`;

  const [offResult, usdaResult] = await Promise.allSettled([
    fetchWithTimeout(offUrl).then(r => r.ok ? r.json() : null).catch(() => null),
    fetchWithTimeout(usdaUrl).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  let results = [];

  // Parse Open Food Facts
  const offData = offResult.status === 'fulfilled' ? offResult.value : null;
  if (offData && offData.products) {
    results.push(...offData.products
      .filter(p => p.product_name && p.nutriments)
      .map(p => ({
        name: p.product_name,
        brand: p.brands || '',
        serving: p.serving_size || '100g',
        source: 'OFF',
        ...parseOFFNutrients(p),
      })));
  }

  // Parse USDA
  const usdaData = usdaResult.status === 'fulfilled' ? usdaResult.value : null;
  if (usdaData && usdaData.foods) {
    usdaData.foods.forEach(food => {
      const nutrients = {};
      (food.foodNutrients || []).forEach(n => {
        if (n.nutrientName === 'Energy') nutrients.calories = Math.round(n.value || 0);
        if (n.nutrientName === 'Protein') nutrients.protein = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Carbohydrate, by difference') nutrients.carbs = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Total lipid (fat)') nutrients.fat = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Fiber, total dietary') nutrients.fiber = Math.round((n.value || 0) * 10) / 10;
        if (n.nutrientName === 'Sugars, total including NLEA') nutrients.sugar = Math.round((n.value || 0) * 10) / 10;
      });
      results.push({
        name: food.description,
        brand: food.brandName || food.brandOwner || '',
        serving: food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : '100g',
        source: 'USDA',
        ...nutrients,
      });
    });
  }

  // Deduplicate by name
  const seen = new Set();
  results = results.filter(r => {
    const key = (r.name + r.brand).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return r.calories > 0;
  }).slice(0, 8);

  if (!results.length) {
    dropdown.innerHTML = '<div class="diet-search-empty">No results found. Try a different search or enter macros manually.</div>';
    return;
  }

  dropdown.innerHTML = results.map((r, i) => `
    <div class="diet-search-item diet-api-result" data-api-idx="${i}">
      <div class="diet-search-item-name">${esc(r.name)}${r.brand ? ` <span class="diet-search-brand">${esc(r.brand)}</span>` : ''}</div>
      <div class="diet-search-item-macros">
        <span>${r.calories} cal</span>
        <span>${r.protein}g P</span>
        <span>${r.carbs}g C</span>
        <span>${r.fat}g F</span>
        <span class="diet-search-per">per ${r.serving}</span>
      </div>
    </div>
  `).join('');

  $$('.diet-api-result').forEach((el, i) => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const r = results[i];
      const displayName = r.name.split(',')[0].split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      $('#dietFoodName').value = r.brand ? `${displayName} (${r.brand})` : displayName;
      dietBaseMacros = { calories: r.calories || 0, protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0 };
      $('#dietServings').value = 1;
      updateMacrosByServings();
      dropdown.innerHTML = '';
      dropdown.classList.remove('visible');
      const info = [`Per ${r.serving} (${r.source}${r.brand ? ' - ' + r.brand : ''})`];
      if (r.fiber) info.push(`Fiber: ${r.fiber}g`);
      if (r.sugar) info.push(`Sugar: ${r.sugar}g`);
      $('#dietServingInfo').innerHTML = `<span class="diet-serving-tag">${info.join(' &middot; ')}</span>`;
    });
  });
}

let dietSearchTimeout = null;

function bindDietEvents() {
  $('#dietDate').addEventListener('change', (e) => { dietViewDate = e.target.value; renderDiet(); });
  $('#dietPrevDay').addEventListener('click', () => {
    const d = new Date(dietViewDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    dietViewDate = toLocalDateStr(d);
    renderDiet();
  });
  $('#dietNextDay').addEventListener('click', () => {
    const d = new Date(dietViewDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    dietViewDate = toLocalDateStr(d);
    renderDiet();
  });
  $('#dietToday').addEventListener('click', () => {
    dietViewDate = getTodayStr();
    renderDiet();
  });

  // Servings → recalculate macros in real time
  $('#dietServings').addEventListener('input', updateMacrosByServings);

  // Water
  bindWaterEvents();

  const foodInput = $('#dietFoodName');
  const dropdown = $('#dietSearchDropdown');
  let localSearchTimeout = null;
  let dropdownHovered = false;

  // Track mouse over dropdown — never replace content while hovered
  dropdown.addEventListener('mouseenter', () => { dropdownHovered = true; });
  dropdown.addEventListener('mouseleave', () => { dropdownHovered = false; });

  function buildDropdown(query) {
    const localResults = searchFoodDatabase(query);

    if (localResults.length) {
      dropdown.innerHTML = localResults.map(r => `
        <div class="diet-search-item" data-food-key="${r.name}" data-food-custom="${r.custom ? '1' : ''}">
          <div class="diet-search-item-name">${esc(r.name.charAt(0).toUpperCase() + r.name.slice(1))}${r.custom ? ' <span class="diet-custom-badge">My Food</span>' : r.shared ? ' <span class="diet-custom-badge diet-shared-badge">Community</span>' : ''}</div>
          <div class="diet-search-item-macros">
            <span>${r.data.calories} cal</span>
            <span>${r.data.protein}g P</span>
            <span>${r.data.carbs}g C</span>
            <span>${r.data.fat}g F</span>
            <span class="diet-search-per">${r.data.serving}</span>
          </div>
        </div>
      `).join('') + `<div class="diet-search-item diet-search-api-btn" id="dietApiLookup">
        <div class="diet-search-item-name">Search online for "${esc(query)}"...</div>
      </div>`;
      dropdown.classList.add('visible');

      if (localResults.length <= 2) {
        dietSearchTimeout = setTimeout(() => {
          if (!dropdownHovered) lookupFoodAPI(query);
        }, 3000);
      }
    } else {
      dropdown.innerHTML = '<div class="diet-search-empty-hint">No local match. Searching online...</div>';
      dropdown.classList.add('visible');
      dietSearchTimeout = setTimeout(() => {
        if (!dropdownHovered) lookupFoodAPI(query);
      }, 1500);
    }

    bindDropdownClicks(query);
  }

  function bindDropdownClicks(query) {
    $$('.diet-search-item[data-food-key]').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const key = el.dataset.foodKey;
        const data = state.customFoods[key] || FOOD_DATABASE[key.toLowerCase()] || (typeof sharedFoods !== 'undefined' && sharedFoods[key.toLowerCase()]);
        if (data) selectFoodFromDropdown(key, data);
      });
    });
    const apiBtn = $('#dietApiLookup');
    if (apiBtn) {
      apiBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        lookupFoodAPI(query);
      });
    }
  }

  foodInput.addEventListener('input', () => {
    dietBaseMacros = null;
    clearTimeout(dietSearchTimeout);
    clearTimeout(localSearchTimeout);
    $('#dietServingInfo').innerHTML = '';
    syncSaveCustomLabel();

    const query = foodInput.value.trim();
    if (query.length < 2) {
      if (!dropdownHovered) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('visible');
      }
      return;
    }

    // Show local results immediately (no debounce) — only debounce API lookups
    if (!dropdownHovered) buildDropdown(query);
  });

  // Close dropdown on click outside
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.diet-search-wrapper')) {
      dropdown.innerHTML = '';
      dropdown.classList.remove('visible');
    }
  });

  // Re-open on focus only if dropdown is closed
  foodInput.addEventListener('focus', () => {
    const query = foodInput.value.trim();
    if (query.length >= 2 && !dropdown.classList.contains('visible')) {
      buildDropdown(query);
    }
  });

  // The Log Food card's "+ Add Food" is gone — logging happens on the meal
  // rows, which already know the meal and the date. Guarded, not deleted.
  const legacyAddBtn = $('#dietSaveBtn');
  if (legacyAddBtn) legacyAddBtn.addEventListener('click', () => {
    let food = $('#dietFoodName').value.trim();
    if (!food) return;
    const servings = Number($('#dietServings').value) || 1;
    const calories = Number($('#dietCalories').value) || 0;
    const protein = Number($('#dietProtein').value) || 0;
    const carbs = Number($('#dietCarbs').value) || 0;
    const fat = Number($('#dietFat').value) || 0;
    state.diet.push({
      date: dietViewDate,
      meal: $('#dietMeal').value,
      food,
      servings,
      // Macros already include servings multiplier from the input fields
      calories,
      protein,
      carbs,
      fat,
    });
    // Auto-remember any new food so it shows up in search next time
    if (rememberFood(food, { calories, protein, carbs, fat }, servings)) {
      showToast(`✓ ${food} saved to My Foods`);
    }
    saveData(state);
    clearDietForm();
    renderDiet();
  });

  // Save as custom food — also the override path for fixing a banked mistake
  $('#dietSaveCustomBtn').addEventListener('click', () => {
    const food = $('#dietFoodName').value.trim();
    const calories = Number($('#dietCalories').value);
    if (!food) { alert('Enter a food name first.'); return; }
    if (!calories) { alert('Fill in the macros before saving.'); return; }
    const lower = food.toLowerCase();
    // Explicit save overrides an earlier delete
    state.removedFoods = (state.removedFoods || []).filter(n => n !== lower);
    // Replace any case-variant instead of duplicating it
    const existed = Object.keys(state.customFoods).some(k => k.toLowerCase() === lower);
    for (const k of Object.keys(state.customFoods)) {
      if (k.toLowerCase() === lower) delete state.customFoods[k];
    }
    // The macro fields hold totals for the current servings count — bank per-serving
    const n = Number($('#dietServings').value) > 0 ? Number($('#dietServings').value) : 1;
    const serving = ($('#dietServingInfo').textContent || '').replace(/^Per serving:\s*/i, '').split('·')[0].trim() || '1 serving';
    food = (typeof safeFoodName === 'function') ? safeFoodName(food) : food;
    state.customFoods[food] = {
      calories: Math.round(calories / n),
      protein: Math.round(((Number($('#dietProtein').value) || 0) / n) * 10) / 10,
      carbs: Math.round(((Number($('#dietCarbs').value) || 0) / n) * 10) / 10,
      fat: Math.round(((Number($('#dietFat').value) || 0) / n) * 10) / 10,
      serving,
      fiber: 0,
      sugar: 0,
    };
    if (typeof publishFoodToBank === 'function') publishFoodToBank(food, state.customFoods[food]);
    saveData(state);
    renderDiet();
    showToast(existed ? `✓ ${food} updated in My Foods` : `✓ ${food} saved to My Foods`);
    $('#dietServingInfo').innerHTML = `<span class="diet-serving-tag">${existed ? 'Updated!' : 'Saved to My Foods!'}</span>`;
    syncSaveCustomLabel();
  });
}

