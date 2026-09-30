// ========== Setup (spec 10.2) ==========
// A short first-run flow for a newly created profile: Welcome, Modules, Goals,
// Apple Watch, Done. Every step can be skipped, and the whole thing can be run
// again from Settings (Replay setup), where it changes only what you change.
//
// Triggered by the sync layer via maybeStartOnboarding() once initial cloud
// state has settled, so a returning person (whose cloud data carries the
// _onboarded marker) is never walked through it again.

let obStep = 0;
let obDraft = null;
let obReplay = false;

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
  // so it drops out when both Strength and Diet are off.
  const wantsGoals = obDraft.modules.gym !== false || obDraft.modules.diet !== false;
  // Apple Watch sync only matters to the fitness modules.
  const wantsWatch = obDraft.modules.gym !== false || obDraft.modules.cardio !== false;
  return ['welcome', 'modules']
    .concat(wantsGoals ? ['goals'] : [])
    .concat(wantsWatch ? ['watch'] : [])
    .concat(['done']);
}

// opts.replay: opened from Settings on a profile that is already set up.
// Nothing is written until the last step, and closing early writes nothing.
function startOnboarding(opts) {
  const host = document.getElementById('onboard');
  if (!host) return;
  obStep = 0;
  obReplay = !!(opts && opts.replay);
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
    // The goals sheet's own save: one place decides what a valid goal is.
    saveGoalValues(obDraft.goals, { _onboarded: true });
  } else if (!obReplay) {
    // Skipping a first run still records completion (with whatever defaults
    // are in place) so we never nag on the next launch.
    saveGoalValues({}, { _onboarded: true });
  }
  if (host) { host.hidden = true; host.innerHTML = ''; }
  document.body.classList.remove('onboard-open');
  if (typeof applyModuleNav === 'function') applyModuleNav();
  // A replay started in Settings ends in Settings.
  if (!obReplay && typeof switchView === 'function') switchView('today');
  else if (typeof render === 'function') render();
  if (typeof showToast === 'function' && save) showToast(obReplay ? 'Setup saved' : 'You’re all set');
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

  let body = '';
  if (step === 'welcome') {
    body = `
      <h1 class="ob-title" id="obTitle" tabindex="-1">${obReplay ? 'Setup, again' : 'Welcome' + (who ? ', ' + esc(who) : '')}</h1>
      <p class="ob-lead">${obReplay
        ? 'The same few steps as the first time. Nothing you have logged is touched, and nothing changes until the last step.'
        : 'Tasks, training and food on one line through your day. Setting it up takes under a minute.'}</p>`;
  } else if (step === 'modules') {
    body = `
      <h1 class="ob-title" id="obTitle" tabindex="-1">Pick your modules</h1>
      <p class="ob-lead">Turn off what you don’t need and it leaves the menu. You can change this any time in Settings.</p>
      <div class="ob-modules">
        ${TOGGLEABLE_MODULES.map(m => {
          const on = obDraft.modules[m.key] !== false;
          return `<button type="button" class="ob-module" data-ob-module="${m.key}" aria-pressed="${on}">
            <span class="ms${on ? ' fill' : ''}" aria-hidden="true">${on ? 'check_circle' : 'radio_button_unchecked'}</span>
            <span class="ob-module-t"><b>${m.label}</b><small>${m.desc}</small></span>
          </button>`;
        }).join('')}
        <div class="ob-module is-static">
          <span class="ms fill" aria-hidden="true">lock</span>
          <span class="ob-module-t"><b>Tasks and Calendar</b><small>Always on</small></span>
        </div>
      </div>`;
  } else if (step === 'goals') {
    const g = obDraft.goals;
    const showDiet = obDraft.modules.diet !== false;
    body = `
      <h1 class="ob-title" id="obTitle" tabindex="-1">Set your goals</h1>
      <p class="ob-lead">Rough is fine. You can change these any time in Settings.</p>
      <div class="ob-goals">
        <div class="dl-field">
          <label for="obWeight">Goal weight, lb</label>
          <input type="number" id="obWeight" inputmode="decimal" min="50" max="500" step="1" value="${esc(g.weight)}">
        </div>
        ${showDiet ? `
        <div class="dl-field">
          <label for="obCalories">Daily calories</label>
          <input type="number" id="obCalories" inputmode="numeric" min="800" max="10000" step="50" value="${esc(g.calories)}">
        </div>
        <div class="dl-field">
          <label for="obProtein">Daily protein, g</label>
          <input type="number" id="obProtein" inputmode="numeric" min="20" max="400" step="5" value="${esc(g.protein)}">
        </div>` : ''}
      </div>`;
  } else if (step === 'watch') {
    // The Settings component itself, so the shortcut links, the ID to paste
    // and the warning about the shared shortcut's path are written once.
    body = `
      <h1 class="ob-title" id="obTitle" tabindex="-1">Apple Watch</h1>
      <p class="ob-lead">Optional. Steps, active energy, exercise minutes, resting heart rate and sleep from Apple Health, once a night. It is in Settings if you would rather do it later.</p>
      <div class="set-watch" id="obWatch"></div>`;
  } else if (step === 'done') {
    const on = TOGGLEABLE_MODULES.filter(m => obDraft.modules[m.key] !== false).map(m => m.label);
    body = `
      <h1 class="ob-title" id="obTitle" tabindex="-1">${obReplay ? 'Save these?' : 'You’re ready'}</h1>
      <p class="ob-lead">Tracking ${on.length ? esc(on.join(', ')) + ' and your tasks' : 'your tasks'}.${obReplay ? '' : ' Log your first entry and the day starts to fill in.'}</p>`;
  }

  const isFirst = obStep === 0;
  const isLast = step === 'done';
  host.innerHTML = `
    <div class="ob-card" role="dialog" aria-modal="true" aria-labelledby="obTitle">
      <p class="ob-count">STEP ${obStep + 1} OF ${steps.length}</p>
      <div class="ob-body">${body}</div>
      <div class="ob-dots" aria-hidden="true">${steps.map((s, i) => `<i class="${i === obStep ? 'on' : (i < obStep ? 'done' : '')}"></i>`).join('')}</div>
      <div class="ob-actions">
        ${isFirst ? '' : '<button type="button" class="dl-btn" id="obBack">Back</button>'}
        <span class="ob-gap"></span>
        ${isLast && !obReplay ? '' : `<button type="button" class="ob-skip" id="obSkip">${obReplay ? 'Close' : 'Skip setup'}</button>`}
        <button type="button" class="dl-btn primary" id="obNext">${isLast ? (obReplay ? 'Save' : 'Go to Today') : 'Continue'}</button>
      </div>
    </div>`;

  if (step === 'watch' && typeof renderWatchConnect === 'function') renderWatchConnect(document.getElementById('obWatch'));
  bindOnboardStep(step);
  // Each step replaces the whole card, so put focus on its heading: a keyboard
  // or screen reader would otherwise be left on a button that no longer exists.
  const title = document.getElementById('obTitle');
  if (title) title.focus({ preventScroll: true });
  host.scrollTop = 0;
}

function bindOnboardStep(step) {
  const host = document.getElementById('onboard');
  const next = document.getElementById('obNext');
  const back = document.getElementById('obBack');
  const skip = document.getElementById('obSkip');

  if (next) next.addEventListener('click', () => {
    if (step === 'goals') captureGoalsStep();
    if (step === 'done') finishOnboarding(true);
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
        const again = host.querySelector('[data-ob-module="' + key + '"]');
        if (again) again.focus({ preventScroll: true });
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
