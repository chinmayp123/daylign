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

// Redesigned per design_handoff_daylign_v2 §4: a big calorie ring plus three
// macro mini-rings that spell out eaten / goal in grams with a "left" chip —
// the explicit user correction was that a percent alone isn't enough.
// Daylign's burn-aware net line is preserved as a caption under the ring.
function renderDietGoals(totals) {
  const goals = getGoals();
  const cal = Math.round(totals.calories);
  const calPct = Math.min(100, Math.round((cal / goals.calories) * 100));
  const calLeft = goals.calories - cal;

  const burnInfo = (typeof burnForDate === 'function') ? burnForDate(dietViewDate)
    : (typeof estimateBurnForDate === 'function') ? { cal: estimateBurnForDate(dietViewDate), watch: false }
    : { cal: 0, watch: false };
  const burn = Number.isFinite(burnInfo.cal) ? Math.max(0, Math.round(burnInfo.cal)) : 0;
  // No "net calories" number. Exercise-burn estimates are noisy, and folding them
  // into one net figure reads like you ate less than you did — which nudges you
  // toward under-eating. Consumed-vs-target is the headline; activity is a
  // separate, clearly-estimated caption; the status line stays non-judgmental.
  const overBy = cal - goals.calories; // + = over target
  const statusLine = overBy > 0
    ? `${overBy} cal over your ${goals.calories} target${overBy <= 250 ? " — that's okay" : ''}`
    : overBy < 0
      ? `${-overBy} cal under your ${goals.calories} target`
      : `Right on your ${goals.calories} target`;
  const activityLine = burn > 0
    ? `${burn} cal ${burnInfo.watch ? 'burned (Apple Watch)' : 'estimated burned'}`
    : '';

  // README run/domain palette: protein green, carbs blue, fat amber.
  const macros = [
    { label: 'Protein', current: Math.round(totals.protein), goal: goals.protein, color: '#34d399' },
    { label: 'Carbs', current: Math.round(totals.carbs), goal: goals.carbs, color: '#5aa5f9' },
    { label: 'Fat', current: Math.round(totals.fat), goal: goals.fat, color: '#fbbf24' },
  ];

  const macroHTML = macros.map(m => {
    const pct = Math.min(100, Math.round((m.current / m.goal) * 100));
    const left = m.goal - m.current;
    const leftTxt = left >= 0 ? `${left}g left` : `${-left}g over`;
    return `
      <div class="dg-bar">
        <div class="dg-bar-head">
          <span class="dg-bar-label">${m.label}</span>
          <span class="dg-bar-nums"><b class="tnum">${m.current}</b><span class="dg-bar-goal"> / ${m.goal}g</span><span class="dg-bar-left tnum" style="color:${m.color}">${leftTxt}</span></span>
        </div>
        <div class="dg-bar-track"><div class="dg-bar-fill" style="width:${pct}%;background:${m.color}"></div></div>
      </div>`;
  }).join('');

  $('#dietGoals').innerHTML = `
    <div class="dg-cal-wrap">
      <div class="dg-cal-ring" style="background:conic-gradient(var(--accent) 0 ${calPct}%, var(--border) ${calPct}% 100%)">
        <div class="dg-cal-hole">
          <span class="dg-cal-num tnum">${cal}</span>
          <span class="dg-cal-of">of ${goals.calories} cal</span>
          <span class="dg-cal-left tnum ${calLeft < 0 ? 'over' : ''}">${calLeft >= 0 ? calLeft + ' left' : -calLeft + ' over'}</span>
        </div>
      </div>
    </div>
    ${activityLine ? `<div class="dg-activity"><span class="dg-activity-label">Activity</span>${activityLine}</div>` : ''}
    <div class="dg-status ${overBy > 0 ? 'over' : ''}">${statusLine}</div>
    <div class="dg-macros">${macroHTML}</div>`;
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
  const recGoals = getGoals();
  const remaining = {
    calories: Math.max(0, recGoals.calories - Math.round(totals.calories)),
    protein: Math.max(0, recGoals.protein - Math.round(totals.protein)),
  };

  // On a cut, hitting the budget means the kitchen is closed
  if (remaining.calories <= 100) {
    $('#dietRecs').innerHTML = '<div class="diet-recs-done">Calorie budget used up — kitchen\'s closed for today!</div>';
    return;
  }

  // Figure out which meals haven't been logged today
  const dayEntries = state.diet.filter(e => e.date === dietViewDate);
  const loggedMeals = new Set(dayEntries.map(e => e.meal));

  // Group meal name ("Snacks") -> entry meal key ("snack")
  const keyOf = name => name.toLowerCase() === 'snacks' ? 'snack' : name.toLowerCase();

  // Time-of-day awareness (only when viewing today — a past day has no "now")
  const isToday = dietViewDate === getTodayStr();
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealForHour = h => {
    if (h >= 4 && h < 11) return 'breakfast';
    if (h >= 11 && h < 16) return 'lunch';
    if (h >= 16 && h < 21) return 'dinner';
    return 'snack';
  };
  const nowMeal = isToday ? mealForHour(new Date().getHours()) : null;

  // Starting from the current time window, find the first meal still worth
  // eating (unlogged real meal, or a snack which is always fair game).
  let featuredKey = null;
  if (nowMeal) {
    const start = MEAL_ORDER.indexOf(nowMeal);
    for (let i = 0; i < MEAL_ORDER.length; i++) {
      const k = MEAL_ORDER[(start + i) % MEAL_ORDER.length];
      if (k === 'snack' || !loggedMeals.has(k)) { featuredKey = k; break; }
    }
  }

  // Pick recommendations for unlogged meals, or snacks if all meals logged
  let suggestions = [];
  for (const group of CUT_RECOMMENDATIONS) {
    const mealKey = keyOf(group.meal);
    if (!loggedMeals.has(mealKey) || mealKey === 'snack') {
      // Pick 1-2 random foods from this meal
      const shuffled = [...group.foods].sort(() => Math.random() - 0.5);
      suggestions.push({ meal: group.meal, foods: shuffled.slice(0, 2) });
    }
  }

  if (!suggestions.length) {
    suggestions = [{ meal: 'Snacks', foods: CUT_RECOMMENDATIONS[3].foods.slice(0, 2) }];
  }

  // Lead with the time-appropriate meal and flag it as "now"
  if (featuredKey) {
    suggestions = [
      ...suggestions.filter(s => keyOf(s.meal) === featuredKey),
      ...suggestions.filter(s => keyOf(s.meal) !== featuredKey),
    ];
    if (suggestions[0] && keyOf(suggestions[0].meal) === featuredKey) suggestions[0].now = true;
  }

  // Header context reflects the time of day
  const DISPLAY = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  const NOW_LABEL = { breakfast: 'Breakfast time', lunch: 'Lunchtime', dinner: 'Dinner time', snack: 'Snack time' };
  let contextLabel = 'Suggestions';
  if (featuredKey) {
    contextLabel = featuredKey === nowMeal ? NOW_LABEL[nowMeal] : `Up next: ${DISPLAY[featuredKey]}`;
  }

  const isOpen = $('#dietRecs').classList.contains('open');
  $('#dietRecs').innerHTML = `
    <div class="diet-recs-toggle" id="dietRecsToggle">
      <svg class="diet-recs-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="diet-recs-title">${contextLabel}</span>
      <span class="diet-recs-remaining">${remaining.calories} cal &middot; ${remaining.protein}g protein to go</span>
    </div>
    <div class="diet-recs-body">
      ${suggestions.map(s => `
        <div class="diet-recs-meal">
          <span class="diet-recs-meal-label">${s.meal}${s.now ? '<span class="diet-recs-now">now</span>' : ''}</span>
          ${s.foods.map(f => `
            <div class="diet-rec-item">
              <div class="diet-rec-name">${f.name}</div>
              <div class="diet-rec-meta">
                <span>${f.cal} cal</span>
                <span>${f.p}g protein</span>
                <span class="diet-rec-desc">${f.desc}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
  if (isOpen) $('#dietRecs').classList.add('open');

  $('#dietRecsToggle').addEventListener('click', () => {
    $('#dietRecs').classList.toggle('open');
  });
}

// ========== Yesterday's Skip-list ==========
// Forward-looking twin of the end-of-day review: analyze the most recent
// logged day and call out the specific foods to skip or shrink today.
// Shown only on the live day — browsing history shows the review instead.
function renderYesterdayAdvice() {
  const el = $('#dietYesterday');
  if (!el) return;
  const hide = () => { el.innerHTML = ''; el.classList.remove('has-content'); };

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

  // Stayed on budget → one quiet green line, no nagging
  if (overCal <= 0 && overCarbs <= 0 && overFat <= 0) {
    el.classList.add('has-content');
    el.innerHTML = `<div class="diet-yesterday-ok">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      You stayed on budget ${dayName === 'yesterday' ? 'yesterday' : 'on ' + dayName} &mdash; same playbook today.
    </div>`;
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

  el.classList.add('has-content');
  el.classList.toggle('open', dietAdviceOpen);
  el.innerHTML = `
    <button type="button" class="diet-advice-head" id="dietAdviceToggle">
      <svg class="diet-advice-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
      <span class="diet-advice-title">Skip or shrink today</span>
      <span class="diet-advice-count">${top.length}</span>
    </button>
    <div class="diet-advice-body">
      <div class="diet-advice-sub">${dayName} ran over by ${overBits.join(' · ')}</div>
      ${top.map(f => `
        <div class="diet-advice-item">
          <span class="diet-advice-name">${esc(f.food)}</span><span class="diet-advice-meal">${esc(f.meal || '')}</span>
          <div class="diet-advice-reason">${f.reason}</div>
        </div>`).join('')}
    </div>`;
  const adviceToggle = el.querySelector('#dietAdviceToggle');
  if (adviceToggle) adviceToggle.addEventListener('click', () => {
    dietAdviceOpen = !dietAdviceOpen;
    el.classList.toggle('open', dietAdviceOpen);
  });
}

// ========== End-of-day Review ==========
// Retrospective: for each macro that finished over goal, surface the foods
// that drove it so you can see exactly where to cut back next time.
// Protein is intentionally excluded — going over protein isn't a problem on a cut.
function renderDietReview(totals, dayEntries) {
  const el = $('#dietReview');
  if (!el) return;

  // Nothing logged yet → nothing to review
  if (!dayEntries.length) { el.innerHTML = ''; el.classList.remove('has-content'); return; }

  const goals = getGoals();
  const LIMITING = [
    { key: 'calories', label: 'Calories', unit: '', color: 'var(--accent)' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: '#eab308' },
    { key: 'fat', label: 'Fat', unit: 'g', color: '#ef4444' },
  ];

  const over = LIMITING
    .map(m => {
      const current = Math.round(totals[m.key]);
      return { ...m, current, amount: current - goals[m.key] };
    })
    .filter(m => m.amount > 0);

  // Stayed within every limiting macro → a quick win, no culprit list needed
  if (!over.length) {
    el.classList.add('has-content');
    el.innerHTML = `
      <div class="diet-review-header ok">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        <span class="diet-review-title">Day review</span>
      </div>
      <div class="diet-review-clean">Nice — you finished within your calorie, carb, and fat goals.</div>`;
    return;
  }

  el.classList.add('has-content');

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
      <div class="diet-review-macro">
        <div class="diet-review-macro-head">
          <span class="diet-review-dot" style="background:${m.color}"></span>
          <span class="diet-review-macro-label">${m.label}</span>
          <span class="diet-review-over">over by ${m.amount}${m.unit}</span>
        </div>
        <div class="diet-review-culprits">
          ${culprits.map(c => {
            const pct = total > 0 ? Math.round((c.val / total) * 100) : 0;
            return `
              <div class="diet-review-culprit">
                <span class="diet-review-culprit-name">${esc(c.food)}</span>
                <span class="diet-review-culprit-meal">${c.meal}</span>
                <span class="diet-review-culprit-val">${c.val}${m.unit} &middot; ${pct}%${c.protein >= 5 ? ` &middot; <span class="diet-review-culprit-protein">${c.protein}g P</span>` : ''}</span>
              </div>`;
          }).join('')}
        </div>
        ${tip ? `<div class="diet-review-tip">${tip}</div>` : ''}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="diet-review-header">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      <span class="diet-review-title">Where you went over</span>
      <span class="diet-review-sub">${over.length} macro${over.length === 1 ? '' : 's'} above goal</span>
    </div>
    ${sections}`;
}

// ========== Water Tracker ==========
function renderWater() {
  const waterGoal = getGoals().water;
  const entries = state.water[dietViewDate] || [];
  const total = entries.reduce((s, v) => s + v, 0);
  const pct = Math.min(100, Math.round((total / waterGoal) * 100));

  $('#waterProgress').textContent = `${total} / ${waterGoal} oz`;
  $('#waterBarFill').style.width = pct + '%';

  // Color the bar based on progress
  const fill = $('#waterBarFill');
  if (pct >= 100) fill.className = 'water-bar-fill water-complete';
  else if (pct >= 60) fill.className = 'water-bar-fill water-good';
  else fill.className = 'water-bar-fill';

  // Log entries
  if (!entries.length) {
    $('#waterLog').innerHTML = '';
  } else {
    $('#waterLog').innerHTML = entries.map((oz, i) => `<span class="water-log-chip">${oz} oz</span>`).join('');
  }
}

function addWater(oz) {
  if (!state.water[dietViewDate]) state.water[dietViewDate] = [];
  state.water[dietViewDate].push(oz);
  saveData(state);
  renderWater();
}

function undoWater() {
  if (!state.water[dietViewDate] || !state.water[dietViewDate].length) return;
  state.water[dietViewDate].pop();
  saveData(state);
  renderWater();
}

// ========== Goals Modal ==========
function openGoalsModal() {
  const g = getGoals();
  $('#goalCalories').value = g.calories;
  $('#goalProtein').value = g.protein;
  $('#goalCarbs').value = g.carbs;
  $('#goalFat').value = g.fat;
  $('#goalWater').value = g.water;
  $('#goalWeight').value = g.weight;
  $('#goalBurn').value = g.burn;
  $('#goalsModal').classList.add('active');
}

function closeGoalsModal() {
  $('#goalsModal').classList.remove('active');
}

function bindGoalsEvents() {
  $('#editGoalsBtn').addEventListener('click', openGoalsModal);
  const weightChip = $('#weightGoalChip');
  if (weightChip) weightChip.addEventListener('click', openGoalsModal);
  $('#goalsModalClose').addEventListener('click', closeGoalsModal);
  $('#goalsCancelBtn').addEventListener('click', closeGoalsModal);
  $('#goalsModal').addEventListener('click', (e) => {
    if (e.target === $('#goalsModal')) closeGoalsModal();
  });
  $('#goalsSaveBtn').addEventListener('click', () => {
    const read = (id, fallback) => {
      const v = Number($(id).value);
      return v > 0 ? v : fallback;
    };
    const prev = getGoals();
    // Spread prev so cardio race targets (raceKey/raceDate/weeklyMiles) and the
    // _onboarded marker survive — rebuilding the object from scratch dropped them.
    state.goals = {
      ...prev,
      calories: read('#goalCalories', prev.calories),
      protein: read('#goalProtein', prev.protein),
      carbs: read('#goalCarbs', prev.carbs),
      fat: read('#goalFat', prev.fat),
      water: read('#goalWater', prev.water),
      weight: read('#goalWeight', prev.weight),
      burn: read('#goalBurn', prev.burn),
    };
    saveData(state);
    closeGoalsModal();
    if (typeof render === 'function') render();
    showToast('Goals updated');
  });
}

function bindWaterEvents() {
  $$('.water-btn[data-oz]').forEach(btn => {
    btn.addEventListener('click', () => addWater(Number(btn.dataset.oz)));
  });
  $('#waterCustomBtn').addEventListener('click', () => {
    const val = prompt('Enter oz:');
    const oz = Number(val);
    if (oz > 0) addWater(oz);
  });
  $('#waterUndoBtn').addEventListener('click', undoWater);
}

function clearDietForm() {
  $('#dietFoodName').value = '';
  $('#dietServings').value = 1;
  $('#dietCalories').value = '';
  $('#dietProtein').value = '';
  $('#dietCarbs').value = '';
  $('#dietFat').value = '';
  $('#dietServingInfo').innerHTML = '';
  dietBaseMacros = null;
}

