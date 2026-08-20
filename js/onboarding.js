// ========== Onboarding ==========
// A short first-run flow for a newly created profile: welcome, pick the
// modules you want, set the handful of goals that drive the rings and coach.
// Deliberately skippable and short — the whole thing can be re-done later from
// Settings (modules + goals both live there).
//
// Triggered by the sync layer via maybeStartOnboarding() once initial cloud
// state has settled, so a returning person (whose cloud data carries the
// _onboarded marker) is never walked through it again.

let obStep = 0;
let obDraft = null;

// Only onboard a genuinely new profile that has not completed it. getGoals()
// carries _onboarded once finished/skipped, and it syncs, so every device and
// every future session sees it.
function maybeStartOnboarding() {
  if (!window.__pendingOnboarding) return;
  window.__pendingOnboarding = false;
  const goals = (typeof getGoals === 'function') ? getGoals() : {};
  if (goals._onboarded) return;           // already done on another device
  if (typeof startOnboarding === 'function') startOnboarding();
}

function onboardSteps() {
  // The goals step is pointless if the person tracks neither fitness nor food,
  // so it drops out when both Gym and Diet are off.
  const wantsGoals = obDraft.modules.gym !== false || obDraft.modules.diet !== false;
  // Apple Watch sync only matters to the fitness modules.
  const wantsWatch = obDraft.modules.gym !== false || obDraft.modules.cardio !== false;
  return ['welcome', 'modules']
    .concat(wantsGoals ? ['goals'] : [])
    .concat(wantsWatch ? ['watch'] : [])
    .concat(['done']);
}

function startOnboarding() {
  const host = document.getElementById('onboard');
  if (!host) return;
  obStep = 0;
  obDraft = {
    modules: Object.assign({}, state.modules || {}),
    goals: Object.assign({}, (typeof getGoals === 'function') ? getGoals() : {}),
  };
  host.hidden = false;
  document.body.classList.add('onboard-open');
  renderOnboardStep();
}

function finishOnboarding(save) {
  const host = document.getElementById('onboard');
  if (save) {
    state.modules = obDraft.modules;
    state.goals = Object.assign({}, obDraft.goals, { _onboarded: true });
  } else {
    // Skipping still records completion (with whatever defaults are in place)
    // so we never nag on the next launch.
    state.goals = Object.assign({}, (typeof getGoals === 'function') ? getGoals() : {}, { _onboarded: true });
  }
  if (typeof saveData === 'function') saveData(state);
  if (host) host.hidden = true;
  document.body.classList.remove('onboard-open');
  if (typeof applyModuleNav === 'function') applyModuleNav();
  if (typeof switchView === 'function') switchView('dashboard');
  else if (typeof render === 'function') render();
  if (typeof showToast === 'function' && save) showToast('You’re all set');
}

function obGo(delta) {
  const steps = onboardSteps();
  obStep = Math.max(0, Math.min(steps.length - 1, obStep + delta));
  renderOnboardStep();
}

function renderOnboardStep() {
  const host = document.getElementById('onboard');
  if (!host) return;
  const steps = onboardSteps();
  const step = steps[obStep];
  const who = (typeof currentProfile === 'function' && currentProfile()) ? currentProfile().name : '';
  const total = steps.length;

  let body = '';
  if (step === 'welcome') {
    body = `
      <div class="ob-mark">D</div>
      <h1>Welcome to Daylign${who ? ', ' + esc(who) : ''}</h1>
      <p class="ob-lead">One place for your tasks, workouts and food — with a coach that reads all of it together. Let’s set it up in under a minute.</p>`;
  } else if (step === 'modules') {
    body = `
      <h1>What do you want to track?</h1>
      <p class="ob-lead">Turn off anything you don’t need — it disappears from the menu. You can change this any time in Settings.</p>
      <div class="ob-modules">
        ${TOGGLEABLE_MODULES.map(m => {
          const on = obDraft.modules[m.key] !== false;
          return `<button type="button" class="ob-module${on ? ' on' : ''}" data-ob-module="${m.key}">
            <span class="ob-module-check">${on ? '✓' : ''}</span>
            <span class="ob-module-text"><span class="ob-module-label">${m.label}</span><span class="ob-module-desc">${m.desc}</span></span>
          </button>`;
        }).join('')}
        <div class="ob-module ob-module-static on">
          <span class="ob-module-check">✓</span>
          <span class="ob-module-text"><span class="ob-module-label">Tasks, Board &amp; Calendar</span><span class="ob-module-desc">Always on — the core planner</span></span>
        </div>
      </div>`;
  } else if (step === 'goals') {
    const g = obDraft.goals;
    const showDiet = obDraft.modules.diet !== false;
    body = `
      <h1>Set your targets</h1>
      <p class="ob-lead">Rough is fine — these drive the rings and the coach, and you can fine-tune everything later.</p>
      <div class="ob-goals">
        <label class="ob-field">
          <span>Goal weight (lbs)</span>
          <input type="number" id="obWeight" inputmode="numeric" min="50" max="500" step="1" value="${g.weight}">
        </label>
        ${showDiet ? `
        <label class="ob-field">
          <span>Daily calories</span>
          <input type="number" id="obCalories" inputmode="numeric" min="800" max="10000" step="50" value="${g.calories}">
        </label>
        <label class="ob-field">
          <span>Protein (g/day)</span>
          <input type="number" id="obProtein" inputmode="numeric" min="20" max="400" step="5" value="${g.protein}">
        </label>` : ''}
      </div>`;
  } else if (step === 'watch') {
    const shortcuts = (typeof HEALTH_SHORTCUTS !== 'undefined') ? HEALTH_SHORTCUTS : [];
    // The prebuilt shortcut posts to the ORIGINAL account's un-namespaced
    // external/<metric>/<date>. Handing it unchanged to a second person means
    // their steps and sleep overwrite the first person's health history, while
    // their own app — which reads external/u/<id> — stays empty. So a
    // non-legacy profile gets its own path and a warning, not a one-tap link.
    const prof = (typeof currentProfile === 'function') ? currentProfile() : null;
    const shared = !prof || !prof.legacy;
    const base = (typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL)
      ? firebaseConfig.databaseURL.replace(/\/$/, '') + '/' +
        ((typeof profileExternalPath === 'function') ? profileExternalPath() : 'external')
      : '';
    body = `
      <div class="ob-mark">⌚</div>
      <h1>Connect your Apple Watch</h1>
      <p class="ob-lead">Optional — auto-sync steps, active energy, exercise minutes, run distance and resting heart rate from Apple Health. iPhone + Apple Watch only.</p>
      <div class="ob-watch-btns">
        ${shortcuts.map(s => `<a class="btn-secondary ob-watch-add" href="${esc(s.url)}" target="_blank" rel="noopener">＋ Add “${esc(s.label)}”</a>`).join('')}
      </div>
      ${shared ? `
        <div class="ob-watch-warn">
          <strong>Change the URLs before you run it.</strong>
          The shared shortcut posts to the account it was built for. Each
          <em>Get Contents of URL</em> step must point at your own path instead:
          <code class="ob-watch-url">${esc(base)}/&lt;metric&gt;/&lt;date&gt;.json</code>
          Run it unchanged and your data lands on someone else's history and
          never reaches yours.
        </div>` : ''}
      <p class="ob-watch-note">Add it, run it once, and allow Health access. You can always set this up later — full steps live in <strong>Settings → Connect Apple Watch</strong>.</p>`;
  } else if (step === 'done') {
    const on = TOGGLEABLE_MODULES.filter(m => obDraft.modules[m.key] !== false).map(m => m.label);
    body = `
      <div class="ob-mark ob-mark-done">✓</div>
      <h1>You’re ready</h1>
      <p class="ob-lead">Tracking ${on.length ? esc(on.join(', ')) + ' and your tasks' : 'your tasks'}. Log your first entry and the dashboard fills in — streaks, trends and weekly coaching.</p>`;
  }

  const isFirst = obStep === 0;
  const isLast = step === 'done';
  host.innerHTML = `
    <div class="ob-card">
      <div class="ob-progress">${steps.map((s, i) => `<span class="ob-dot${i === obStep ? ' active' : ''}${i < obStep ? ' done' : ''}"></span>`).join('')}</div>
      <div class="ob-body">${body}</div>
      <div class="ob-actions">
        ${isFirst
          ? `<button type="button" class="ob-skip" id="obSkip">Skip setup</button>`
          : `<button type="button" class="btn-secondary" id="obBack">Back</button>`}
        <button type="button" class="btn-primary" id="obNext">${isLast ? 'Go to dashboard' : 'Continue'}</button>
      </div>
    </div>`;

  bindOnboardStep(step);
}

function bindOnboardStep(step) {
  const host = document.getElementById('onboard');
  const next = document.getElementById('obNext');
  const back = document.getElementById('obBack');
  const skip = document.getElementById('obSkip');
  const stepList = onboardSteps();

  if (next) next.addEventListener('click', () => {
    if (step === 'goals') captureGoalsStep();
    if (stepList[obStep] === 'done') finishOnboarding(true);
    else obGo(1);
  });
  if (back) back.addEventListener('click', () => {
    if (step === 'goals') captureGoalsStep();
    obGo(-1);
  });
  if (skip) skip.addEventListener('click', () => finishOnboarding(false));

  if (step === 'modules') {
    host.querySelectorAll('[data-ob-module]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.obModule;
        obDraft.modules[key] = obDraft.modules[key] === false ? true : false;
        renderOnboardStep(); // re-render so the goals step appears/disappears
      });
    });
  }
}

// Read the goals inputs into the draft, tolerating a missing diet step.
function captureGoalsStep() {
  const read = (id, prev) => {
    const el = document.getElementById(id);
    if (!el) return prev;
    const v = Number(el.value);
    return v > 0 ? v : prev;
  };
  obDraft.goals.weight = read('obWeight', obDraft.goals.weight);
  obDraft.goals.calories = read('obCalories', obDraft.goals.calories);
  obDraft.goals.protein = read('obProtein', obDraft.goals.protein);
}
