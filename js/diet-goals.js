// ========== Goal Tracker ==========
// Defaults: 25yo male, 5'10", ~160 lbs → 150 lbs cut (started Jul 2026)
// BMR ~1720, TDEE ~2500, -500 deficit = ~2000 cal/day (~1 lb/week)
// User-editable via the Goals modal; overrides live in state.goals (synced).
const DEFAULT_GOALS = {
  calories: 2000,
  protein: 150,  // keep high on a cut to hold onto muscle
  carbs: 215,
  fat: 60,
  water: 66,     // oz/day
  weight: 150,   // lbs target
  burn: 300,     // cal/day from exercise — pads the deficit so diet slip-ups still net out
};

function getGoals() {
  return { ...DEFAULT_GOALS, ...(state.goals || {}) };
}

// The summary (spec 8): the calorie ring, three macro bars, one caption.
//
// "Left" is goal minus eaten, the same figure the now block on Today shows, and
// the burn is stated beside it rather than added back. The mockup's example
// caption nets them ("Burned 420, so about 780 left"); that would put two
// different "left" numbers on two screens for the same day, so the burn is
// reported and the arithmetic is left to the reader.
function renderDietGoals(totals) {
  const host = $('#dietGoals');
  if (!host) return;
  const goals = getGoals();
  const cal = Math.round(totals.calories);
  const calPct = Math.min(100, Math.round((cal / goals.calories) * 100));
  const calLeft = goals.calories - cal;

  const burnInfo = (typeof burnForDate === 'function') ? burnForDate(dietViewDate)
    : (typeof estimateBurnForDate === 'function') ? { cal: estimateBurnForDate(dietViewDate), watch: false }
    : { cal: 0, watch: false };
  const burn = Number.isFinite(burnInfo.cal) ? Math.max(0, Math.round(burnInfo.cal)) : 0;

  const macros = [
    { label: 'Protein', current: Math.round(totals.protein), goal: goals.protein, k: 'food' },
    { label: 'Carbs', current: Math.round(totals.carbs), goal: goals.carbs, k: 'habit' },
    { label: 'Fat', current: Math.round(totals.fat), goal: goals.fat, k: 'meet' },
  ];
  const caption = (calLeft >= 0 ? `${calLeft.toLocaleString()} left.` : `${(-calLeft).toLocaleString()} over${-calLeft <= 250 ? ', which is fine.' : '.'}`) +
    (burn > 0 ? ` Burned ${burnInfo.watch ? '' : 'about '}${burn.toLocaleString()}${burnInfo.watch ? ', from your Watch' : ''}.` : '');

  host.innerHTML = `
    <span class="dl-ring-wrap dt-ring${calLeft < 0 ? ' is-over' : ''}">
      <svg class="dl-ring c-food" viewBox="0 0 64 64" role="img" aria-label="${cal.toLocaleString()} of ${goals.calories.toLocaleString()} kcal eaten">
        <circle class="dl-ring-track" cx="32" cy="32" r="28"/>
        <circle class="dl-ring-fill" cx="32" cy="32" r="28" pathLength="100" style="--pct:${calPct}"/>
      </svg>
      <span class="dl-ring-label"><b>${cal.toLocaleString()}</b><small>of ${goals.calories.toLocaleString()}</small></span>
    </span>
    <div class="dt-bars">
      ${macros.map(m => `
        <div class="dt-bar">
          <span class="dt-bar-t">${m.label} <b>${m.current}</b> / ${m.goal}g</span>
          <span class="dl-meter c-${m.k}"><i style="width:${Math.min(100, Math.round((m.current / m.goal) * 100))}%"></i></span>
        </div>`).join('')}
      <p class="dt-cap">${caption}</p>
    </div>`;
}

// ========== Food Recommendations ==========
// Cutting: high protein, high volume, calorie-conscious (South Indian friendly)
const CUT_RECOMMENDATIONS = [
  { meal: 'Breakfast', foods: [
    { name: 'Egg white omelette + 1 toast', cal: 250, p: 24, desc: '4 whites + 1 whole egg, veggies' },
    { name: '2 idli + sambar', cal: 200, p: 8, desc: 'Skip the coconut chutney' },
    { name: 'Greek yogurt + berries', cal: 180, p: 20, desc: '170g nonfat yogurt' },
    { name: 'Protein shake + banana', cal: 250, p: 27, desc: '1 scoop whey in water + banana' },
    { name: 'Moong dal chilla (2)', cal: 220, p: 14, desc: 'Minimal oil, with mint chutney' },
    { name: '3 boiled eggs', cal: 210, p: 18, desc: 'With black pepper' },
  ]},
  { meal: 'Lunch', foods: [
    { name: "Auntie's plate: rice + dal + curry + yogurt", cal: 520, p: 20, desc: '1 cup rice, load the dal & yogurt, go light on oily curry' },
    { name: 'Rice + 2 curries + extra dal + curd', cal: 500, p: 22, desc: 'Cap rice at 1 cup, double the dal for protein' },
    { name: 'Half rice + dal + curry + big curd', cal: 430, p: 21, desc: 'Swap ½ the rice for more veg curry & yogurt' },
    { name: 'Chicken breast + 1 cup rice + salad', cal: 450, p: 42, desc: '150g grilled chicken' },
    { name: 'Rice + pappu charu + veggies', cal: 400, p: 12, desc: '1 cup rice, light on oil' },
    { name: 'Dal + 2 phulka (no ghee)', cal: 350, p: 16, desc: 'With cucumber raita' },
    { name: 'Fish curry + 1 cup rice', cal: 420, p: 30, desc: 'South Indian style, measured rice' },
  ]},
  { meal: 'Dinner', foods: [
    { name: 'Grilled fish + sauteed veggies', cal: 350, p: 35, desc: '150g fish, minimal oil' },
    { name: 'Soya chunk curry + 1 cup rice', cal: 400, p: 28, desc: 'Your usual, measured rice' },
    { name: 'Chicken curry (lean) + 1 roti', cal: 400, p: 32, desc: 'Breast meat, light oil' },
    { name: 'Paneer bhurji + salad', cal: 350, p: 22, desc: 'Low-fat paneer, no butter' },
    { name: 'Egg curry (2 eggs) + veggies', cal: 320, p: 16, desc: 'Skip the rice tonight' },
  ]},
  { meal: 'Snacks', foods: [
    { name: 'Buttermilk (majjiga)', cal: 60, p: 3, desc: '1 glass, spiced' },
    { name: 'Greek yogurt cup', cal: 100, p: 17, desc: 'Plain nonfat' },
    { name: 'Roasted chana (1/4 cup)', cal: 120, p: 7, desc: 'Crunchy, filling' },
    { name: 'Protein shake in water', cal: 120, p: 24, desc: '1 scoop whey' },
    { name: 'Apple + 10 almonds', cal: 170, p: 3, desc: 'Fiber + crunch' },
    { name: 'Cucumber + hummus', cal: 150, p: 5, desc: '2 tbsp hummus' },
  ]},
];

function renderDietRecs(totals) {
  const el = $('#dietRecs');
  if (!el) return;
  const recGoals = getGoals();
  const remaining = {
    calories: Math.max(0, recGoals.calories - Math.round(totals.calories)),
    protein: Math.max(0, recGoals.protein - Math.round(totals.protein)),
  };
  const fold = (icon, text, body) => body
    ? `<summary><span class="ms" aria-hidden="true">${icon}</span><span class="dt-fold-t">${text}</span><span class="ms dt-fold-chev" aria-hidden="true">expand_more</span></summary><div class="dt-fold-b">${body}</div>`
    : `<summary class="is-plain"><span class="ms" aria-hidden="true">${icon}</span><span class="dt-fold-t">${text}</span></summary>`;

  // On a cut, hitting the budget means the kitchen is closed.
  if (remaining.calories <= 100) {
    el.hidden = false;
    el.innerHTML = fold('lightbulb', 'Calorie budget used up. Kitchen is closed for today.', '');
    el.open = false;
    return;
  }

  const dayEntries = state.diet.filter(e => e.date === dietViewDate);
  const loggedMeals = new Set(dayEntries.map(e => e.meal));
  const keyOf = name => name.toLowerCase() === 'snacks' ? 'snack' : name.toLowerCase();

  // Time-of-day awareness (only when viewing today — a past day has no "now")
  const isToday = dietViewDate === getTodayStr();
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const nowMeal = isToday ? mealForHour(new Date().getHours()) : null;

  // From the current time window, the first meal still worth eating.
  let featuredKey = null;
  if (nowMeal) {
    const start = MEAL_ORDER.indexOf(nowMeal);
    for (let i = 0; i < MEAL_ORDER.length; i++) {
      const k = MEAL_ORDER[(start + i) % MEAL_ORDER.length];
      if (k === 'snack' || !loggedMeals.has(k)) { featuredKey = k; break; }
    }
  }

  // Two ideas per unlogged meal. Chosen by the DATE, not at random: a random
  // pick reshuffled the list on every render, so the suggestion you were
  // reading changed under you each time anything saved.
  const dayNum = Math.floor(new Date(dietViewDate + 'T00:00:00').getTime() / 86400000);
  const pick = (foods) => [0, 1].map(i => foods[(dayNum + i) % foods.length]);
  let suggestions = [];
  for (const group of CUT_RECOMMENDATIONS) {
    const mealKey = keyOf(group.meal);
    if (!loggedMeals.has(mealKey) || mealKey === 'snack') suggestions.push({ meal: group.meal, foods: pick(group.foods) });
  }
  if (!suggestions.length) suggestions = [{ meal: 'Snacks', foods: pick(CUT_RECOMMENDATIONS[3].foods) }];
  if (featuredKey) {
    suggestions = [
      ...suggestions.filter(s => keyOf(s.meal) === featuredKey),
      ...suggestions.filter(s => keyOf(s.meal) !== featuredKey),
    ];
  }

  el.hidden = false;
  el.innerHTML = fold('lightbulb',
    `Ideas: ${remaining.calories.toLocaleString()} kcal and ${remaining.protein}g protein to go`,
    suggestions.map(s => `
      <div class="dt-idea-meal">${esc(s.meal)}${featuredKey && keyOf(s.meal) === featuredKey && featuredKey === nowMeal ? ' <em>now</em>' : ''}</div>
      ${s.foods.map(f => `
        <div class="dt-idea"><span class="dt-idea-n">${esc(f.name)}</span>
          <span class="dt-idea-m">${f.cal} · ${f.p}g P · ${esc(f.desc)}</span></div>`).join('')}`).join(''));
}

// ========== Yesterday's Skip-list ==========
// Forward-looking twin of the end-of-day review: analyze the most recent
// logged day and call out the specific foods to skip or shrink today.
// Shown only on the live day — browsing history shows the review instead.
function renderYesterdayAdvice() {
  const el = $('#dietYesterday');
  if (!el) return;
  const hide = () => { el.innerHTML = ''; el.hidden = true; };

  const todayStr = getTodayStr();
  if (dietViewDate !== todayStr) return hide();

  // Most recent day before today with food logged, no older than a week
  const prev = [...new Set(state.diet.map(e => e.date))]
    .filter(d => d && d < todayStr).sort().reverse()[0];
  if (!prev) return hide();
  const weekAgo = new Date(todayStr + 'T00:00:00');
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (new Date(prev + 'T00:00:00') < weekAgo) return hide();

  const y = new Date(todayStr + 'T00:00:00');
  y.setDate(y.getDate() - 1);
  const yesterdayStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  const dayName = prev === yesterdayStr ? 'yesterday' :
    new Date(prev + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

  // Aggregate repeat foods so two chapati entries read as one line
  const byFood = {};
  for (const e of state.diet.filter(en => en.date === prev)) {
    const name = (e.food || '').trim();
    if (!name) continue;
    const f = byFood[name.toLowerCase()] ||
      (byFood[name.toLowerCase()] = { food: name, meal: e.meal, calories: 0, protein: 0, carbs: 0, fat: 0 });
    f.calories += e.calories || 0;
    f.protein += e.protein || 0;
    f.carbs += e.carbs || 0;
    f.fat += e.fat || 0;
  }
  const foods = Object.values(byFood);
  if (!foods.length) return hide();

  const totals = foods.reduce((acc, f) => {
    acc.calories += f.calories; acc.carbs += f.carbs; acc.fat += f.fat;
    return acc;
  }, { calories: 0, carbs: 0, fat: 0 });

  const goals = getGoals();
  const overCal = Math.round(totals.calories - goals.calories);
  const overCarbs = Math.round(totals.carbs - goals.carbs);
  const overFat = Math.round(totals.fat - goals.fat);

  // Stayed on budget → one quiet line, no nagging
  if (overCal <= 0 && overCarbs <= 0 && overFat <= 0) {
    el.hidden = false;
    el.open = false;
    el.innerHTML = `<summary class="is-plain"><span class="ms" aria-hidden="true">check_circle</span><span class="dt-fold-t">You stayed on budget ${dayName === 'yesterday' ? 'yesterday' : 'on ' + esc(dayName)}. Same playbook today.</span></summary>`;
    return;
  }

  // Flag the foods that did the damage, worst first. Protein-dense foods get
  // "shrink" advice instead of "skip" — dropping them to fix a carb/fat overage
  // costs the one macro worth protecting on a cut.
  const flagged = [];
  for (const f of foods) {
    const cal = Math.round(f.calories);
    const protein = Math.round(f.protein);
    const proteinPer100 = f.calories > 0 ? (f.protein / f.calories) * 100 : 0;
    const proteinDense = protein >= 15 || proteinPer100 >= 8;
    let reason = '';
    if (overCal > 0 && f.calories >= overCal) {
      reason = proteinDense
        ? `${cal} cal covers the overage, but it carried ${protein}g protein — shrink the portion, don't skip it`
        : `${cal} cal — skipping this alone puts you back under budget`;
    } else if (overCal > 0 && f.calories >= overCal * 0.5) {
      reason = `${cal} cal — half of the ${overCal} cal overage by itself${proteinDense ? ` (but ${protein}g protein: shrink, don't skip)` : ''}`;
    } else if (overCarbs > 0 && f.carbs >= Math.max(30, overCarbs * 0.5)) {
      reason = `${Math.round(f.carbs)}g carbs on a day that ran ${overCarbs}g over${proteinDense ? ` — shrink it, it also brought ${protein}g protein` : ''}`;
    } else if (overFat > 0 && f.fat >= Math.max(10, overFat * 0.5)) {
      reason = proteinDense
        ? `${Math.round(f.fat)}g fat but also ${protein}g protein — go for a leaner version instead of skipping`
        : `${Math.round(f.fat)}g fat on a day that ran ${overFat}g over`;
    } else if (overCal > 0 && f.calories >= 200 && proteinPer100 < 4) {
      reason = `${cal} cal for only ${protein}g protein — weak trade on a cut`;
    }
    if (reason) flagged.push({ ...f, reason });
  }
  // Protein-light offenders first — they're the cheapest cuts
  flagged.sort((a, b) => (a.protein / Math.max(a.calories, 1)) - (b.protein / Math.max(b.calories, 1)) || b.calories - a.calories);
  const top = flagged.slice(0, 4);
  if (!top.length) return hide();

  const overBits = [];
  if (overCal > 0) overBits.push(`${overCal} cal`);
  if (overCarbs > 0) overBits.push(`${overCarbs}g carbs`);
  if (overFat > 0) overBits.push(`${overFat}g fat`);

  const Day = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  el.hidden = false;
  el.innerHTML = `
    <summary><span class="ms" aria-hidden="true">history</span><span class="dt-fold-t">${esc(Day)} ran over by ${overBits.join(', ')}: ${top.length} to skip or shrink</span><span class="ms dt-fold-chev" aria-hidden="true">expand_more</span></summary>
    <div class="dt-fold-b">
      ${top.map(f => `
        <div class="dt-idea"><span class="dt-idea-n">${esc(f.food)}${f.meal ? ` <em>${esc(f.meal)}</em>` : ''}</span>
          <span class="dt-idea-m">${esc(f.reason)}</span></div>`).join('')}
    </div>`;
}

// ========== End-of-day Review ==========
// Retrospective: for each macro that finished over goal, surface the foods
// that drove it so you can see exactly where to cut back next time.
// Protein is intentionally excluded — going over protein isn't a problem on a cut.
function renderDietReview(totals, dayEntries) {
  const el = $('#dietReview');
  if (!el) return;

  // Nothing logged yet → nothing to review
  if (!dayEntries.length) { el.innerHTML = ''; el.hidden = true; return; }

  // This is an after-the-fact summary, not a running scoreboard. Showing it at
  // 11am means being told you are "over" on a day you have barely started —
  // which reads as failure rather than information. It appears once the day is
  // actually done: dinner logged, late enough that it will be, or a past day
  // being reviewed.
  const isToday = dietViewDate === getTodayStr();
  const dinnerLogged = dayEntries.some(e => e.meal === 'dinner');
  const lateEnough = new Date().getHours() >= 20;
  if (isToday && !dinnerLogged && !lateEnough) {
    el.innerHTML = '';
    el.hidden = true;
    return;
  }

  const goals = getGoals();
  const LIMITING = [
    { key: 'calories', label: 'Calories', unit: '', k: 'food' },
    { key: 'carbs', label: 'Carbs', unit: 'g', k: 'habit' },
    { key: 'fat', label: 'Fat', unit: 'g', k: 'meet' },
  ];

  const over = LIMITING
    .map(m => {
      const current = Math.round(totals[m.key]);
      return { ...m, current, amount: current - goals[m.key] };
    })
    .filter(m => m.amount > 0);

  // Stayed within every limiting macro → a quick win, no culprit list needed
  const when = isToday ? 'today' : 'the day';
  if (!over.length) {
    el.hidden = false;
    el.open = false;
    el.innerHTML = `<summary class="is-plain"><span class="ms" aria-hidden="true">check_circle</span><span class="dt-fold-t">How ${when} landed: inside your calorie, carb and fat targets.</span></summary>`;
    return;
  }

  el.hidden = false;

  const sections = over.map(m => {
    const total = m.current;
    // Rank the day's foods by how much of THIS macro they contributed
    const culprits = dayEntries
      .map(e => ({ food: e.food, meal: e.meal, val: Math.round(e[m.key] || 0), protein: Math.round(e.protein || 0) }))
      .filter(c => c.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 3);

    // Advice must weigh the protein cost: on a cut, cutting a protein-dense food
    // to fix a small carb/fat overage is a net loss. Prefer the fix that
    // sacrifices the least protein, and downgrade "skip" to "shrink" when the
    // overage is small or every fix would cost real protein.
    const top = culprits[0];
    let tip = '';
    if (top) {
      const coverers = culprits.filter(c => c.val >= m.amount);
      const best = coverers.length
        ? coverers.reduce((a, b) => (a.protein <= b.protein ? a : b))
        : top;
      const smallOverage = m.key === 'calories' ? m.amount <= 120 : m.amount <= 8;

      if (smallOverage) {
        tip = `Only ${m.amount}${m.unit} over — a slightly smaller serving of <strong>${esc(best.food)}</strong> covers it. Nothing here is worth skipping${best.protein >= 10 ? ` (it carried ${best.protein}g protein)` : ''}.`;
      } else if (coverers.length && best.protein >= 12) {
        tip = `<strong>${esc(best.food)}</strong> covers the ${m.amount}${m.unit} overage, but it also brought ${best.protein}g protein — shrink the portion or swap for a leaner version rather than skipping it.`;
      } else if (coverers.length) {
        tip = `Skipping <strong>${esc(best.food)}</strong> alone would have kept you under your ${m.label.toLowerCase()} goal${best.protein > 0 ? ` at a cost of only ${best.protein}g protein` : ''}.`;
      } else {
        tip = `<strong>${esc(top.food)}</strong> was the biggest driver — trimming it claws back ${top.val}${m.unit} of the ${m.amount}${m.unit} overage.`;
      }
    }

    return `
      <div class="dt-idea-meal c-${m.k}"><span class="dl-dot"></span>${m.label} <em>+${m.amount}${m.unit}</em></div>
      ${culprits.map(c => {
        const pct = total > 0 ? Math.round((c.val / total) * 100) : 0;
        return `<div class="dt-idea"><span class="dt-idea-n">${esc(c.food)} <em>${esc(c.meal || '')}</em></span>
          <span class="dt-idea-m">${c.val}${m.unit} · ${pct}% of the day${c.protein >= 5 ? ` · ${c.protein}g protein` : ''}</span></div>`;
      }).join('')}
      ${tip ? `<p class="dt-tip">${tip}</p>` : ''}`;
  }).join('');

  el.innerHTML = `
    <summary><span class="ms" aria-hidden="true">insights</span><span class="dt-fold-t">How ${when} landed: ${over.map(m => m.label.toLowerCase() + ' +' + m.amount + m.unit).join(', ')}</span><span class="ms dt-fold-chev" aria-hidden="true">expand_more</span></summary>
    <div class="dt-fold-b">${sections}</div>`;
}

// ========== Water Tracker ==========
function renderWater() {
  const prog = $('#waterProgress');
  if (!prog) return;
  const waterGoal = getGoals().water;
  const entries = state.water[dietViewDate] || [];
  const total = entries.reduce((s, v) => s + v, 0);
  const pct = Math.min(100, Math.round((total / waterGoal) * 100));

  prog.textContent = `${total} / ${waterGoal} oz`;
  const fill = $('#waterBarFill');
  if (fill) fill.style.width = pct + '%';

  // Undo offered itself on a day with no water logged, which is a control that
  // cannot do anything. It appears once there is something to take back.
  const undo = $('#waterUndoBtn');
  if (undo) undo.hidden = !entries.length;
}

function addWater(oz) {
  if (!state.water[dietViewDate]) state.water[dietViewDate] = [];
  state.water[dietViewDate].push(oz);
  // v3: the line puts water at its last add, so each add records when. Kept in
  // a parallel list because state.water[date] is a plain array of ounces
  // everywhere else and changing that shape would touch every water reader.
  if (!state.waterAt) state.waterAt = {};
  if (!state.waterAt[dietViewDate]) state.waterAt[dietViewDate] = [];
  state.waterAt[dietViewDate].push(Date.now());
  saveData(state);
  renderWater();
}

function undoWater() {
  if (!state.water[dietViewDate] || !state.water[dietViewDate].length) return;
  state.water[dietViewDate].pop();
  if (state.waterAt && state.waterAt[dietViewDate]) state.waterAt[dietViewDate].pop();
  saveData(state);
  renderWater();
}

// ========== Goals Modal ==========
// The one place goals are written. The goals editor's Save and the setup
// wizard both come through here, so there is a single rule for what a valid
// goal is: a positive number, or whatever was there before. `extra` carries
// flags that ride along (_onboarded).
function saveGoalValues(values, extra) {
  const prev = getGoals();
  const pick = (k) => {
    const v = Number(values && values[k]);
    return v > 0 ? v : prev[k];
  };
  // Spread prev so cardio race targets (raceKey/raceDate/weeklyMiles) and the
  // _onboarded marker survive — rebuilding the object from scratch dropped them.
  state.goals = Object.assign({}, prev, {
    calories: pick('calories'), protein: pick('protein'), carbs: pick('carbs'), fat: pick('fat'),
    water: pick('water'), weight: pick('weight'), burn: pick('burn'),
  }, extra || {});
  saveData(state);
}

// The one goals editor (spec 10.5). Kept under its old name: Settings, Diet
// and the Training burn chip all call it.
function openGoalsModal() {
  const g = getGoals();
  $('#goalCalories').value = g.calories;
  $('#goalProtein').value = g.protein;
  $('#goalCarbs').value = g.carbs;
  $('#goalFat').value = g.fat;
  $('#goalWater').value = g.water;
  $('#goalWeight').value = g.weight;
  $('#goalBurn').value = g.burn;
  openDlSheet($('#goalsSheet'));
  setTimeout(() => $('#goalWeight').focus({ preventScroll: true }), 80);
}

function closeGoalsModal() {
  closeDlSheet($('#goalsSheet'));
}

function bindGoalsEvents() {
  $('#editGoalsBtn').addEventListener('click', openGoalsModal);
  $('#goalsCancelBtn').addEventListener('click', closeGoalsModal);
  $('#goalsSaveBtn').addEventListener('click', () => {
    saveGoalValues({
      calories: $('#goalCalories').value, protein: $('#goalProtein').value, carbs: $('#goalCarbs').value,
      fat: $('#goalFat').value, water: $('#goalWater').value, weight: $('#goalWeight').value, burn: $('#goalBurn').value,
    });
    closeGoalsModal();
    if (typeof render === 'function') render();
    showToast('Goals saved');
  });
  $('#goalsSheet').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); $('#goalsSaveBtn').click(); }
  });
}

function bindWaterEvents() {
  $$('.water-btn[data-oz]').forEach(btn => {
    btn.addEventListener('click', () => addWater(Number(btn.dataset.oz)));
  });
  // Other: a small inline field. It was a browser prompt().
  const other = $('#waterCustomBtn'), row = $('#waterOther'), input = $('#waterOtherInput'), add = $('#waterOtherAdd');
  const commit = () => {
    const oz = Math.round(Number(input.value));
    if (!(oz > 0) || oz > 200) { showToast('Enter the ounces, between 1 and 200'); input.focus(); return; }
    addWater(oz);
    input.value = '';
    row.hidden = true;
    other.setAttribute('aria-expanded', 'false');
  };
  if (other && row && input && add) {
    other.addEventListener('click', () => {
      row.hidden = !row.hidden;
      other.setAttribute('aria-expanded', String(!row.hidden));
      if (!row.hidden) input.focus();
    });
    add.addEventListener('click', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  }
  const undo = $('#waterUndoBtn');
  if (undo) undo.addEventListener('click', undoWater);
}

// ---- Week strip ----
// Seven days across the top of Diet, one ring each, so a week reads at a glance
// instead of needing a day-by-day walk through the date arrows.
//
// The check means ONE thing: the day landed under its calorie goal. It is
// deliberately not "hit every macro" — protein has been missed on every single
// logged day at the current 150g target, so a badge requiring it would show a
// cross forever and stop meaning anything. Protein gets its own small dot
// instead: visible, but not able to fail the day on its own.
//
// A barely-logged day is NOT a win. Coming in under target because you forgot
// to log dinner would otherwise earn the same tick as a day you actually
// controlled, which is the one way a streak display can quietly lie to you.
const WEEK_PARTIAL_FRACTION = 0.25;   // below this share of goal = incomplete log

function dietDayStatus(dateStr, totals, goals) {
  const today = getTodayStr();
  if (dateStr > today) return 'future';
  const cal = totals ? Math.round(totals.calories) : 0;
  if (!cal) return dateStr === today ? 'today' : 'none';
  if (dateStr === today) return 'today';
  if (cal < goals.calories * WEEK_PARTIAL_FRACTION) return 'partial';
  return cal <= goals.calories ? 'hit' : 'over';
}

// Sunday-first week containing the day being viewed, matching the weekday
// header order people expect from a calendar.
function dietWeekDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  const out = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    out.push(toLocalDateStr(x));
  }
  return out;
}

function renderDietWeek() {
  const host = document.getElementById('dietWeek');
  if (!host) return;
  const goals = getGoals();
  const byDate = (typeof dietTotalsByDate === 'function') ? dietTotalsByDate() : {};

  host.innerHTML = dietWeekDays(dietViewDate).map(ds => {
    const t = byDate[ds];
    const status = dietDayStatus(ds, t, goals);
    const cal = t ? Math.round(t.calories) : 0;
    const protein = t ? Math.round(t.protein) : 0;
    const proteinHit = protein >= goals.protein;
    const dow = new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
    const pct = Math.min(100, Math.round((cal / goals.calories) * 100));

    const tip = status === 'future' ? formatDate(ds)
      : status === 'none' ? `${formatDate(ds)}, nothing logged`
      : status === 'partial' ? `${formatDate(ds)}, ${cal} kcal, looks part-logged`
      : `${formatDate(ds)}, ${cal} of ${goals.calories} kcal, ${protein}g protein${status === 'over' ? ', over' : ''}`;

    return `
      <button type="button" class="dt-day is-${status}${ds === dietViewDate ? ' is-viewing' : ''}"
              data-diet-week-day="${ds}" ${status === 'future' ? 'disabled' : ''} aria-label="${esc(tip)}" title="${esc(tip)}"${ds === dietViewDate ? ' aria-current="date"' : ''}>
        <span class="dt-day-l">${dow}</span>
        <svg class="dl-ring dt-day-ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle class="dl-ring-track" cx="32" cy="32" r="26"/>
          <circle class="dl-ring-fill" cx="32" cy="32" r="26" pathLength="100" style="--pct:${pct}"/>
        </svg>
        ${proteinHit ? '<span class="dt-day-p" title="Protein goal met"></span>' : ''}
      </button>`;
  }).join('');

  host.querySelectorAll('[data-diet-week-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      dietViewDate = btn.dataset.dietWeekDay;
      if (typeof haptic === 'function') haptic('light');
      renderDiet();
    });
  });
}
