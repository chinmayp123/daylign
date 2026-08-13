function renderDiet() {
  const dateInput = $('#dietDate');
  if (!dateInput) return;

  // Bank any dishes from the log that aren't in the food bank yet
  // (history from before auto-remember, or entries synced from other devices)
  const backfilled = backfillRememberedFoods();
  if (backfilled > 0) {
    saveData(state);
    if (!dietBackfillNotified) {
      dietBackfillNotified = true;
      showToast(`Added ${backfilled} dish${backfilled === 1 ? '' : 'es'} from your log to My Foods`);
    }
  }
  // Ensure dietViewDate is set
  if (!dietViewDate) dietViewDate = getTodayStr();
  dateInput.value = dietViewDate;

  // Date navigation label
  const todayStr = getTodayStr();
  const isToday = dietViewDate === todayStr;
  const viewDate = new Date(dietViewDate + 'T00:00:00');
  $('#dietDateLabel').textContent = isToday ? 'Today' :
    viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const dayLabel = isToday ? "Today's Nutrition" :
    new Date(dietViewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  $('#dietSummaryTitle').textContent = dietViewDate === todayStr ? "Today's Nutrition" : dayLabel;

  const dayEntries = state.diet.filter(e => e.date === dietViewDate);

  // Totals
  const totals = sumMacros(dayEntries);

  // Goal tracker
  renderDietGoals(totals);

  // Food recommendations based on remaining macros
  renderDietRecs(totals);

  // Skip-list for today, learned from the last logged day
  renderYesterdayAdvice();

  // End-of-day review: what pushed you over each macro
  renderDietReview(totals, dayEntries);

  // Water tracker
  renderWater();

  // Meals grouped
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

  // Every meal is listed, even empty ones (design_handoff_daylign_v2 section 4:
  // "Empty meals still show (0 cal + add row)"). A day's plan reads as a whole
  // this way — an empty Dinner is information, and it gives you somewhere to
  // tap. Hiding it made the log look finished when it wasn't.
  const mealGroups = meals.map(meal => ({
    meal,
    label: mealLabels[meal],
    entries: dayEntries.filter(e => e.meal === meal),
  }));

  const usualsByMeal = {};
  {
    $('#dietMealsList').innerHTML = mealGroups.map(g => {
      const mealMacros = sumMacros(g.entries);
      const isEmpty = g.entries.length === 0;
      // Your Usuals: your most-logged foods for THIS meal — one tap to log.
      const usuals = mealUsuals(g.meal, 4);
      usualsByMeal[g.meal] = usuals;
      // Saved combos sit with the usuals — same gesture, one tap to log — but
      // styled apart, because a chip that writes five rows should not look
      // identical to one that writes a single food.
      const combos = (typeof comboList === 'function') ? comboList() : [];
      const comboChips = combos.map(c => {
        const t = comboTotals(c);
        return `<button type="button" class="diet-combo-tile" data-combo-id="${esc(c.id)}" data-combo-meal="${g.meal}" title="${esc(c.items.map(i => i.food).join(', '))}">
          <span class="diet-combo-name">${esc(c.name)}</span>
          <span class="diet-combo-meta">${c.items.length} items &middot; ${Math.round(t.calories)} cal</span>
        </button>`;
      }).join('');
      const usualsHtml = (usuals.length || comboChips) ? `
          <div class="diet-usuals">
            ${comboChips}
            ${usuals.map((u, i) => `<button type="button" class="diet-usual-tile" data-usual-meal="${g.meal}" data-usual-idx="${i}">${esc(u.name)}</button>`).join('')}
          </div>` : '';
      // With usuals present, search is the fallback ("Something else"), not the default.
      const addLabel = usuals.length ? '+ Something else' : `+ Add to ${g.label}`;
      return `
        <div class="diet-meal-group${isEmpty ? ' is-empty' : ''}">
          <div class="diet-meal-header">
            <span class="diet-meal-name">${g.label}</span>
            <span class="diet-meal-cal">
              <span class="diet-meal-cal-val">${Math.round(mealMacros.calories)} cal</span>
              ${isEmpty ? '' : `
              <span class="diet-meal-macro">${Math.round(mealMacros.protein)}g P</span>
              <span class="diet-meal-macro">${Math.round(mealMacros.carbs)}g C</span>
              <span class="diet-meal-macro">${Math.round(mealMacros.fat)}g F</span>`}
            </span>
          </div>
          ${g.entries.map(e => {
            const idx = state.diet.indexOf(e);
            const servVal = Number(e.servings) > 0 ? Number(e.servings) : 1;
            return `
              <div class="diet-food-entry" data-entry-idx="${idx}">
                <div class="diet-food-entry-main">
                  <span class="diet-food-name">${esc(e.food)}</span>
                  <button type="button" class="diet-serv-pill" data-idx="${idx}" title="Tap to change servings">${servVal}×</button>
                  <button class="diet-delete-food" data-diet-idx="${idx}">&times;</button>
                </div>
                <div class="diet-food-macros">
                  <span>${Math.round(e.calories || 0)} cal</span>
                  <span>${Math.round(e.protein || 0)}g P</span>
                  <span>${Math.round(e.carbs || 0)}g C</span>
                  <span>${Math.round(e.fat || 0)}g F</span>
                </div>
                <div class="diet-entry-edit"${dietEditOpenIdx === idx ? '' : ' hidden'}>
                  <button type="button" class="diet-serv-step" data-step="-0.5" data-idx="${idx}" aria-label="Fewer servings">−</button>
                  <span class="diet-serv-val">${servVal}</span>
                  <button type="button" class="diet-serv-step" data-step="0.5" data-idx="${idx}" aria-label="More servings">+</button>
                  <span class="diet-serv-caption">servings</span>
                </div>
              </div>`;
          }).join('')}
          ${usualsHtml}
          <div class="diet-meal-addwrap" data-meal="${g.meal}">
            <div class="diet-meal-addrow">
              <button type="button" class="diet-meal-add" data-add-meal="${g.meal}">${addLabel}</button>
              ${g.entries.length >= 2 ? `<button type="button" class="diet-meal-savecombo" data-savecombo-meal="${g.meal}" title="Save these items as a named combo">Save combo</button>` : ''}
              <button type="button" class="diet-meal-snap" data-snap-meal="${g.meal}" title="Snap a photo of this meal" aria-label="Snap a photo for ${g.label}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            </div>
            <div class="diet-inline-search" hidden>
              <input type="text" class="diet-inline-input" placeholder="Search food to add to ${g.label.toLowerCase()}…" autocomplete="off">
              <div class="diet-inline-results"></div>
            </div>
            <div class="diet-inline-photo" data-photo-meal="${g.meal}"></div>
          </div>
        </div>`;
    }).join('');
  }

  // Your Usuals: tap a tile to log that food to the meal at one serving — no
  // search, no form. keepSearchOpen=false so the search box stays closed.
  $$('.diet-usual-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const meal = btn.dataset.usualMeal;
      const u = (usualsByMeal[meal] || [])[Number(btn.dataset.usualIdx)];
      if (!u) return;
      quickAddToMeal(meal, { name: u.name, data: u.per }, false);
    });
  });

  // One tap logs the whole combo, with undo on the toast.
  $$('.diet-combo-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof addComboToMeal === 'function') addComboToMeal(btn.dataset.comboId, btn.dataset.comboMeal);
    });
  });

  // Save the items of this meal as a named combo. Everything is preselected,
  // but each row can be unticked — the protein shake was logged alongside two
  // eggs, and baking those into the shake would be wrong.
  $$('.diet-meal-savecombo').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof openComboSaver === 'function') openComboSaver(btn.dataset.savecomboMeal);
    });
  });

  // Snap a meal, per meal: photo → Claude → confirm inline → logs to this meal.
  $$('.diet-meal-snap').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof startMealPhoto === 'function') startMealPhoto(btn.dataset.snapMeal);
    });
  });

  // Tap a logged entry to reveal its servings stepper (log-first-fix-later).
  $$('#dietMealsList .diet-food-entry-main').forEach(main => {
    main.addEventListener('click', (ev) => {
      if (ev.target.closest('.diet-delete-food')) return;
      const row = main.closest('.diet-food-entry');
      const idx = Number(row.dataset.entryIdx);
      dietEditOpenIdx = (dietEditOpenIdx === idx) ? null : idx;
      const edit = row.querySelector('.diet-entry-edit');
      if (edit) edit.hidden = dietEditOpenIdx !== idx;
    });
  });

  // Servings +/- rescales that entry's macros in proportion and re-saves.
  $$('#dietMealsList .diet-serv-step').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const idx = Number(btn.dataset.idx);
      const e = state.diet[idx];
      if (!e) return;
      const cur = Number(e.servings) > 0 ? Number(e.servings) : 1;
      let next = cur + Number(btn.dataset.step);
      next = Math.round(next * 2) / 2; // snap to nearest 0.5, avoids float drift
      if (next < 0.5) next = 0.5;      // half serving is the floor
      if (next === cur) return;
      const ratio = next / cur;
      e.servings = next;
      e.calories = Math.round((e.calories || 0) * ratio);
      e.protein = Math.round(((e.protein || 0) * ratio) * 10) / 10;
      e.carbs = Math.round(((e.carbs || 0) * ratio) * 10) / 10;
      e.fat = Math.round(((e.fat || 0) * ratio) * 10) / 10;
      dietEditOpenIdx = idx; // keep the stepper open across the re-render
      saveData(state);
      renderDiet();
    });
  });

  // Inline quick-add: tapping "Add to <meal>" opens a small search right under
  // that meal — type, tap a result, it's added to THAT meal in place. No jump
  // to the form (design_handoff §5 / ref 3b one-tap add).
  $$('.diet-meal-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.diet-meal-addwrap');
      const search = wrap.querySelector('.diet-inline-search');
      const input = wrap.querySelector('.diet-inline-input');
      const open = !search.hidden;
      if (open) { search.hidden = true; dietInlineOpenMeal = null; return; }
      search.hidden = false;
      dietInlineOpenMeal = btn.dataset.addMeal;
      input.focus();
    });
  });

  // Re-open the inline search on whichever meal was active before a re-render
  // (so adding one food leaves the search ready for the next).
  if (dietInlineOpenMeal) {
    const wrap = document.querySelector(`.diet-meal-addwrap[data-meal="${dietInlineOpenMeal}"]`);
    if (wrap) { wrap.querySelector('.diet-inline-search').hidden = false; }
  }

  $$('.diet-inline-input').forEach(input => {
    input.addEventListener('input', () => {
      const wrap = input.closest('.diet-meal-addwrap');
      renderInlineResults(wrap, input.value);
    });
  });

  // Delete food
  $$('.diet-delete-food').forEach(btn => {
    btn.addEventListener('click', () => {
      state.diet.splice(Number(btn.dataset.dietIdx), 1);
      dietEditOpenIdx = null; // indices shift after a splice — don't reopen the wrong row
      saveData(state);
      renderDiet();
    });
  });

  // Recent Foods — unique dishes per meal, newest first, tap to re-log.
  // Grouped into collapsible time-of-day sections; the bank keeps powering search.
  const RECENT_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
  const RECENT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  const PER_MEAL_LIMIT = 6;
  const recentGroups = { breakfast: [], lunch: [], dinner: [], snack: [] };
  const recentSeen = { breakfast: new Set(), lunch: new Set(), dinner: new Set(), snack: new Set() };
  const recentFoods = []; // flat list so click/delete handlers can index into it

  for (let i = state.diet.length - 1; i >= 0; i--) {
    const e = state.diet[i];
    const name = (e.food || '').trim();
    if (!name) continue;
    const meal = RECENT_MEALS.includes(e.meal) ? e.meal : 'snack';
    if (recentGroups[meal].length >= PER_MEAL_LIMIT) continue;
    const lower = name.toLowerCase();
    if (recentSeen[meal].has(lower) || isRemovedFood(lower)) continue;
    recentSeen[meal].add(lower);
    // Per-serving macros from the bank when available, else derived from the entry
    const bankedEntry = Object.entries(state.customFoods).find(([k]) => k.toLowerCase() === lower);
    const banked = (bankedEntry && bankedEntry[1]) || FOOD_DATABASE[lower] || (typeof sharedFoods !== 'undefined' && sharedFoods[lower]);
    const n = Number(e.servings) > 0 ? Number(e.servings) : 1;
    const per = banked || {
      calories: Math.round((e.calories || 0) / n),
      protein: Math.round(((e.protein || 0) / n) * 10) / 10,
      carbs: Math.round(((e.carbs || 0) / n) * 10) / 10,
      fat: Math.round(((e.fat || 0) / n) * 10) / 10,
      serving: '1 serving',
    };
    const item = { name, meal, per, idx: recentFoods.length };
    recentFoods.push(item);
    recentGroups[meal].push(item);
  }

  // First render: open the meal that matches the time of day, collapse the rest
  if (!recentFoodsOpen) {
    const hour = new Date().getHours();
    const nowMeal = mealForHour(hour);
    recentFoodsOpen = { breakfast: false, lunch: false, dinner: false, snack: false, [nowMeal]: true };
  }

  // Full food bank — every banked dish (your South Indian pool + saved brands), A→Z
  const bankEntries = Object.entries(state.customFoods).sort((a, b) => a[0].localeCompare(b[0]));

  if (!recentFoods.length && !bankEntries.length) {
    $('#dietCustomList').innerHTML = emptyState({ icon: 'bookmark', title: 'No saved foods yet', hint: 'Anything you log is remembered here for one-tap re-adding.' });
  } else {
    const chevron = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg>';
    const foodItem = (name, per, attrs) => `
      <div class="diet-custom-item" ${attrs}>
        <div class="diet-custom-item-main">
          <span class="diet-custom-item-name">${esc(name)}</span>
          <button class="diet-custom-edit" data-edit-name="${esc(name)}" title="Fix this food's macros"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
          <button class="diet-custom-del" data-del-name="${esc(name)}" title="Remove from the food bank">&times;</button>
        </div>
        <div class="diet-custom-item-macros">
          <span>${Math.round(per.calories)} cal</span>
          <span>${per.protein}g P</span>
          <span>${per.carbs}g C</span>
          <span>${per.fat}g F</span>
        </div>
      </div>`;

    const groupsHtml = RECENT_MEALS.filter(m => recentGroups[m].length).map(meal => `
      <div class="recent-meal ${recentFoodsOpen[meal] ? 'open' : ''}" data-recent-meal="${meal}">
        <div class="recent-meal-header">
          <span class="recent-meal-chevron">${chevron}</span>
          <span class="recent-meal-label">${RECENT_LABELS[meal]}</span>
          <span class="recent-meal-count">${recentGroups[meal].length}</span>
        </div>
        <div class="recent-meal-body">
          ${recentGroups[meal].map(f => foodItem(f.name, f.per, `data-recent-idx="${f.idx}"`)).join('')}
        </div>
      </div>
    `).join('');

    const bankHtml = bankEntries.length ? `
      <div class="recent-meal recent-bank ${recentFoodsOpen.bank ? 'open' : ''}" data-recent-meal="bank">
        <div class="recent-meal-header">
          <span class="recent-meal-chevron">${chevron}</span>
          <span class="recent-meal-label">My Food Bank</span>
          <span class="recent-meal-count">${bankEntries.length}</span>
        </div>
        <div class="recent-meal-body">
          ${bankEntries.map(([name, data]) => foodItem(name, data, `data-bank-name="${esc(name)}"`)).join('')}
        </div>
      </div>` : '';

    $('#dietCustomList').innerHTML = groupsHtml + bankHtml;

    // Toggle sections without a full re-render (keeps it snappy)
    $$('.recent-meal-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.recent-meal');
        const meal = group.dataset.recentMeal;
        recentFoodsOpen[meal] = !recentFoodsOpen[meal];
        group.classList.toggle('open', recentFoodsOpen[meal]);
      });
    });

    $$('.diet-custom-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.delName;
        if (!name) return;
        const lower = name.toLowerCase();
        state.removedFoods = state.removedFoods || [];
        if (!state.removedFoods.includes(lower)) state.removedFoods.push(lower);
        // Drop any case-variant from the food bank
        for (const k of Object.keys(state.customFoods)) {
          if (k.toLowerCase() === lower) delete state.customFoods[k];
        }
        saveData(state);
        renderDiet();
        showToast(`${name} removed — it won't be auto-added again`);
      });
    });

    // Edit: load the food into the form so corrected macros can overwrite it
    $$('.diet-custom-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.editName;
        if (!name) return;
        const lower = name.toLowerCase();
        const entry = Object.entries(state.customFoods).find(([k]) => k.toLowerCase() === lower);
        const data = (entry && entry[1]) || FOOD_DATABASE[lower] || (typeof sharedFoods !== 'undefined' && sharedFoods[lower]);
        if (!data) return;
        selectFoodFromDropdown(entry ? entry[0] : name, data);
        $('#dietFoodName').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(`Editing ${name} — fix the macros, then press Update My Food`);
      });
    });

    $$('.diet-custom-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.diet-custom-del')) return;
        if (el.dataset.recentIdx !== undefined) {
          const f = recentFoods[Number(el.dataset.recentIdx)];
          if (!f) return;
          selectFoodFromDropdown(f.name, f.per);
          if (f.meal) $('#dietMeal').value = f.meal;
        } else if (el.dataset.bankName) {
          const data = state.customFoods[el.dataset.bankName];
          if (data) selectFoodFromDropdown(el.dataset.bankName, data);
        }
      });
    });
  }

  // History (last 14 unique days)
  const historyDays = [...new Set(state.diet.map(e => e.date))].sort().reverse().filter(d => d !== dietViewDate).slice(0, 14);
  if (!historyDays.length) {
    $('#dietHistoryList').innerHTML = emptyState({ icon: 'calendar', title: 'No history yet', hint: 'Log a day of meals and it will appear here.' });
  } else {
    $('#dietHistoryList').innerHTML = historyDays.map(day => {
      const entries = state.diet.filter(e => e.date === day);
      const dayTotals = sumMacros(entries);
      return `
        <div class="diet-history-day" data-diet-day="${day}">
          <div class="diet-history-day-header">
            <span class="diet-history-date">${new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span class="diet-history-cal ${dayTotals.calories > getGoals().calories ? 'over-budget' : 'under-budget'}"
              title="${dayTotals.calories > getGoals().calories ? 'Over' : 'Under'} the ${getGoals().calories} cal budget">${Math.round(dayTotals.calories)} cal</span>
          </div>
          <div class="diet-history-macros">
            <span>${Math.round(dayTotals.protein)}g P</span>
            <span>${Math.round(dayTotals.carbs)}g C</span>
            <span>${Math.round(dayTotals.fat)}g F</span>
          </div>
        </div>`;
    }).join('');

    $$('.diet-history-day').forEach(el => {
      el.addEventListener('click', () => {
        dietViewDate = el.dataset.dietDay;
        renderDiet();
      });
    });
  }

  // The meal rows were just rebuilt, which destroys the inline photo confirm
  // box. Put a pending analysis back rather than letting it vanish — this is
  // the render that used to eat an in-flight photo every time a Firebase
  // snapshot echoed a save back to us.
  if (typeof restorePendingPhoto === 'function') restorePendingPhoto();
}

