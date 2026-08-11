// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { logAiCall } from './ai-usage.js';
import { render, switchView } from './app.js';
import { rememberFood } from './diet-food.js';
import { defaultMealForNow, getAnthropicKey } from './food-photo.js';
import { saveData, state } from './state.js';
import { formatDate, getTodayStr } from './utils.js';

// ========== Voice / Natural-Language Commands ==========
// Tap the mic (or type), speak naturally ("log 40 oz water", "add a task to
// pay rent tomorrow, high priority", "I weighed 163 this morning", "go to
// gym"). Speech is transcribed on-device via the Web Speech API, then Claude
// turns the text into structured commands the app runs. Reuses the same
// Anthropic key stored by the photo feature (localStorage only, never synced).
export const VOICE_MODEL = 'claude-haiku-4-5'; // fast + cheap for simple command parsing

export let voiceRecognition = null;
export let voiceListening = false;

export function voiceKey() {
  return (typeof getAnthropicKey === 'function') ? getAnthropicKey() : (localStorage.getItem('tf_anthropic_key') || '');
}

// 'gym' and 'cardio' stay listed as aliases — switchView maps them onto
// Training's two modes, so older phrasings keep working.
export const VOICE_VIEWS = ['dashboard', 'tasks', 'board', 'calendar', 'training', 'gym', 'cardio', 'diet', 'settings'];

export const VOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['commands'],
  properties: {
    commands: {
      type: 'array',
      items: {
        anyOf: [
          { type: 'object', additionalProperties: false, required: ['action', 'name'],
            properties: {
              action: { const: 'add_task' },
              name: { type: 'string' },
              dueDate: { type: ['string', 'null'] },
              priority: { enum: ['high', 'medium', 'low'] },
              category: { type: 'string' },
            } },
          { type: 'object', additionalProperties: false, required: ['action', 'oz'],
            properties: { action: { const: 'log_water' }, oz: { type: 'number' } } },
          { type: 'object', additionalProperties: false, required: ['action', 'lbs'],
            properties: { action: { const: 'log_weight' }, lbs: { type: 'number' } } },
          { type: 'object', additionalProperties: false, required: ['action', 'items'],
            properties: {
              action: { const: 'log_food' },
              meal: { enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
              items: {
                type: 'array',
                items: {
                  type: 'object', additionalProperties: false,
                  required: ['food', 'calories', 'protein', 'carbs', 'fat'],
                  properties: {
                    food: { type: 'string' }, portion: { type: 'string' },
                    calories: { type: 'number' }, protein: { type: 'number' },
                    carbs: { type: 'number' }, fat: { type: 'number' },
                  },
                },
              },
            } },
          { type: 'object', additionalProperties: false, required: ['action', 'view'],
            properties: { action: { const: 'navigate' }, view: { enum: VOICE_VIEWS } } },
          { type: 'object', additionalProperties: false, required: ['action', 'text'],
            properties: { action: { const: 'unrecognized' }, text: { type: 'string' } } },
        ],
      },
    },
  },
};

export function voiceContextPrompt() {
  const today = getTodayStr();
  const weekday = new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const cats = (state.categories || []).map(c => `${c.id} (${c.name})`).join(', ');
  return `You convert a person's spoken request into structured app commands for their personal dashboard.

Today is ${weekday}, ${today}. Interpret all relative dates ("today", "tomorrow", "next friday", "in 3 days") as calendar dates in YYYY-MM-DD form relative to today.

Available task categories (use the id): ${cats || 'personal'}. If no category is clear, use "personal".
Navigable pages: ${VOICE_VIEWS.join(', ')} (home/main = dashboard, workout/exercise/weight = gym, food/meals/eating = diet).

Rules:
- One utterance may contain several commands — return all of them.
- add_task: extract a concise task name; set dueDate only if a time was mentioned (else null); set priority only if implied ("urgent"/"important" = high).
- log_water: convert to fluid ounces (1 cup = 8 oz, 1 bottle assume 16 oz unless stated, 1 liter = 34 oz).
- log_weight: body weight in pounds (convert kg if stated, 1 kg = 2.205 lb).
- log_food: estimate macros for the portion described. The user often eats South Indian / Telugu food (idli ~40 cal each, dosa, sambar, pappu charu, peanut chutney, soya chunk curry) — recognize these. Set meal from context or time of day.
- navigate: only when the user clearly wants to open a page.
- If a part of the request can't be mapped to any action, emit an unrecognized command with the leftover text.`;
}

export async function runVoiceCommand(text) {
  const resultEl = $('#voiceResult');
  const key = voiceKey();
  if (!key) {
    resultEl.innerHTML = '<div class="voice-status error">No API key set. Open the Diet tab and tap the key icon next to "Snap a meal" to add your Anthropic key — voice uses the same key.</div>';
    return;
  }
  if (!text || !text.trim()) return;
  resultEl.innerHTML = '<div class="voice-status"><span class="photo-spinner"></span>Understanding&hellip;</div>';

  const body = {
    model: VOICE_MODEL,
    max_tokens: 1024,
    system: voiceContextPrompt(),
    output_config: { format: { type: 'json_schema', schema: VOICE_SCHEMA } },
    messages: [{ role: 'user', content: text.trim() }],
  };

  let data;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    data = await res.json();
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
      resultEl.innerHTML = res.status === 401
        ? '<div class="voice-status error">API key was rejected — re-add it from the Diet tab.</div>'
        : `<div class="voice-status error">Couldn't process that: ${esc(msg)}</div>`;
      return;
    }
  } catch (e) {
    resultEl.innerHTML = '<div class="voice-status error">Network error — check your connection.</div>';
    return;
  }

  // Record the call for the usage tracker (Settings → AI features).
  if (typeof logAiCall === 'function' && data.usage) logAiCall('voice', VOICE_MODEL, data.usage);

  if (data.stop_reason === 'refusal') {
    resultEl.innerHTML = '<div class="voice-status error">The model declined that request.</div>';
    return;
  }

  let commands = [];
  try {
    const textBlock = (data.content || []).find(b => b.type === 'text');
    commands = JSON.parse(textBlock.text).commands || [];
  } catch (e) {
    resultEl.innerHTML = '<div class="voice-status error">Could not understand that — try rephrasing.</div>';
    return;
  }

  executeVoiceCommands(commands);
}

// Run each command, collecting a human summary + an undo fn per successful one.
export function executeVoiceCommands(commands) {
  const resultEl = $('#voiceResult');
  const today = getTodayStr();
  const done = [];
  let navTo = null;

  for (const cmd of commands) {
    if (cmd.action === 'add_task') {
      const catIds = (state.categories || []).map(c => c.id);
      const category = catIds.includes(cmd.category) ? cmd.category : (catIds.includes('personal') ? 'personal' : (catIds[0] || 'personal'));
      const task = {
        id: Date.now().toString() + Math.floor(Math.random() * 1000),
        name: String(cmd.name).slice(0, 200),
        description: '',
        priority: ['high', 'medium', 'low'].includes(cmd.priority) ? cmd.priority : 'medium',
        status: 'todo',
        category,
        project: null,
        dueDate: cmd.dueDate || '',
        scheduledHour: null,
        duration: null,
        subtasks: [],
        created: today,
      };
      state.tasks.push(task);
      done.push({
        label: `Task: <strong>${esc(task.name)}</strong>${task.dueDate ? ` &middot; ${formatDate(task.dueDate)}` : ''} &middot; ${task.priority}`,
        undo: () => { state.tasks = state.tasks.filter(t => t !== task); },
      });

    } else if (cmd.action === 'log_water') {
      const oz = Math.round(Number(cmd.oz) || 0);
      if (oz > 0) {
        state.water[today] = state.water[today] || [];
        state.water[today].push(oz);
        done.push({
          label: `Water: <strong>${oz} oz</strong>`,
          undo: () => { const a = state.water[today]; if (a) { const i = a.lastIndexOf(oz); if (i >= 0) a.splice(i, 1); } },
        });
      }

    } else if (cmd.action === 'log_weight') {
      const lbs = Math.round((Number(cmd.lbs) || 0) * 10) / 10;
      if (lbs >= 50 && lbs <= 500) {
        state.weight = state.weight || {};
        const prev = state.weight[today];
        state.weight[today] = lbs;
        done.push({
          label: `Weight: <strong>${lbs} lbs</strong>`,
          undo: () => { if (prev === undefined) delete state.weight[today]; else state.weight[today] = prev; },
        });
      }

    } else if (cmd.action === 'log_food') {
      const meal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(cmd.meal) ? cmd.meal
        : (typeof defaultMealForNow === 'function' ? defaultMealForNow() : 'snack');
      const added = [];
      for (const it of (cmd.items || [])) {
        const entry = {
          date: today, meal, food: String(it.food || 'Food').slice(0, 60), servings: 1,
          calories: Math.max(0, Math.round(Number(it.calories) || 0)),
          protein: Math.max(0, Math.round((Number(it.protein) || 0) * 10) / 10),
          carbs: Math.max(0, Math.round((Number(it.carbs) || 0) * 10) / 10),
          fat: Math.max(0, Math.round((Number(it.fat) || 0) * 10) / 10),
        };
        if (!entry.calories && !entry.protein && !entry.carbs && !entry.fat) continue;
        state.diet.push(entry);
        added.push(entry);
        if (typeof rememberFood === 'function') {
          rememberFood(entry.food, { calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat }, 1);
        }
      }
      if (added.length) {
        const cals = added.reduce((s, e) => s + e.calories, 0);
        done.push({
          label: `Food (${meal}): <strong>${added.map(e => esc(e.food)).join(', ')}</strong> &middot; ~${cals} cal`,
          undo: () => { state.diet = state.diet.filter(e => !added.includes(e)); },
        });
      }

    } else if (cmd.action === 'navigate') {
      if (VOICE_VIEWS.includes(cmd.view)) navTo = cmd.view;

    } else if (cmd.action === 'unrecognized') {
      done.push({ label: `<span class="voice-unknown">Didn't catch: "${esc(cmd.text || '')}"</span>`, undo: null });
    }
  }

  const changed = done.some(d => d.undo);
  if (changed) { saveData(state); render(); }

  if (!done.length && !navTo) {
    resultEl.innerHTML = '<div class="voice-status">Nothing to do — try "log 40 oz of water" or "add a task to call mom tomorrow".</div>';
    return;
  }

  resultEl.innerHTML = `
    <div class="voice-done">
      ${done.map((d, i) => `
        <div class="voice-done-row">
          <span class="voice-done-check">${d.undo ? '✓' : '—'}</span>
          <span class="voice-done-label">${d.label}</span>
          ${d.undo ? `<button type="button" class="voice-undo-btn" data-undo="${i}">Undo</button>` : ''}
        </div>`).join('')}
      ${navTo ? `<div class="voice-done-row"><span class="voice-done-check">→</span><span class="voice-done-label">Opened <strong>${navTo}</strong></span></div>` : ''}
    </div>`;

  $$('#voiceResult .voice-undo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = done[Number(btn.dataset.undo)];
      if (d && d.undo) {
        d.undo();
        saveData(state);
        render();
        btn.closest('.voice-done-row').classList.add('voice-undone');
        btn.remove();
      }
    });
  });

  if (navTo) {
    // Navigate after a beat so the confirmation is visible, then close the panel
    setTimeout(() => { switchView(navTo); closeVoicePanel(); }, changed ? 900 : 250);
  }
}

// ---- Speech recognition ----
export function voiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startVoiceListening() {
  if (!voiceSupported()) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  stopVoiceListening();
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  voiceRecognition = rec;

  const input = $('#voiceInput');
  const micBtn = $('#voiceMicBtn');
  micBtn.classList.add('listening');
  $('#voiceHint').textContent = 'Listening… speak now';

  rec.onresult = (e) => {
    let txt = '';
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    input.value = txt;
    const final = e.results[e.results.length - 1].isFinal;
    if (final) { stopVoiceListening(); runVoiceCommand(txt); }
  };
  rec.onerror = (e) => {
    stopVoiceListening();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      $('#voiceHint').textContent = 'Mic blocked — allow microphone access, or just type below.';
    } else if (e.error === 'no-speech') {
      $('#voiceHint').textContent = "Didn't hear anything — tap the mic to retry, or type.";
    } else {
      $('#voiceHint').textContent = 'Voice unavailable here — type your command below.';
    }
  };
  rec.onend = () => { voiceListening = false; if (micBtn) micBtn.classList.remove('listening'); };

  try { rec.start(); voiceListening = true; }
  catch (e) { stopVoiceListening(); $('#voiceHint').textContent = 'Type your command below.'; }
}

export function stopVoiceListening() {
  if (voiceRecognition) { try { voiceRecognition.stop(); } catch (e) {} voiceRecognition = null; }
  voiceListening = false;
  const micBtn = $('#voiceMicBtn');
  if (micBtn) micBtn.classList.remove('listening');
}

export function openVoicePanel() {
  const panel = $('#voicePanel');
  if (!panel) return;
  panel.classList.add('active');
  $('#voiceInput').value = '';
  $('#voiceResult').innerHTML = '';
  const micBtn = $('#voiceMicBtn');
  if (voiceSupported()) {
    micBtn.style.display = '';
    $('#voiceHint').textContent = 'Listening… speak now';
    startVoiceListening(); // same user-gesture as the FAB tap → iOS-friendly
  } else {
    micBtn.style.display = 'none';
    $('#voiceHint').textContent = 'Type a command and press Run.';
    $('#voiceInput').focus();
  }
}

export function closeVoicePanel() {
  stopVoiceListening();
  const panel = $('#voicePanel');
  if (panel) panel.classList.remove('active');
}

// The FAB is fixed above the bottom nav and sits on top of whatever content
// happens to be under it — on a phone it was covering a dashboard stat and the
// gym date nav. Hide it while scrolling down and bring it back on scroll up,
// which is the standard behaviour and keeps it out of the way exactly when the
// user is reading rather than acting.
export function bindFabAutoHide(fab) {
  let lastY = window.scrollY;
  let ticking = false;
  const THRESHOLD = 8; // ignore sub-pixel jitter and rubber-banding
  // Both floating controls move together — tucking one and leaving the other
  // would just look broken.
  const targets = () => [fab, document.getElementById('primaryFab')].filter(Boolean);
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) < THRESHOLD) return;
    // Never hide at the very top, where there is nothing to scroll past.
    const tuck = dy > 0 && y > 120;
    targets().forEach(el => el.classList.toggle('fab-tucked', tuck));
    lastY = y;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
}

export function bindVoiceEvents() {
  const fab = $('#voiceFab');
  if (!fab) return;
  fab.addEventListener('click', openVoicePanel);
  bindFabAutoHide(fab);
  $('#voicePanelClose').addEventListener('click', closeVoicePanel);
  $('#voicePanel').addEventListener('click', (e) => { if (e.target === $('#voicePanel')) closeVoicePanel(); });

  $('#voiceMicBtn').addEventListener('click', () => {
    if (voiceListening) stopVoiceListening();
    else startVoiceListening();
  });

  $('#voiceRunBtn').addEventListener('click', () => {
    stopVoiceListening();
    runVoiceCommand($('#voiceInput').value);
  });
  $('#voiceInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); stopVoiceListening(); runVoiceCommand($('#voiceInput').value); }
  });
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { VOICE_MODEL: VOICE_MODEL, VOICE_SCHEMA: VOICE_SCHEMA, VOICE_VIEWS: VOICE_VIEWS, bindFabAutoHide: bindFabAutoHide, bindVoiceEvents: bindVoiceEvents, closeVoicePanel: closeVoicePanel, executeVoiceCommands: executeVoiceCommands, openVoicePanel: openVoicePanel, runVoiceCommand: runVoiceCommand, startVoiceListening: startVoiceListening, stopVoiceListening: stopVoiceListening, voiceContextPrompt: voiceContextPrompt, voiceKey: voiceKey, voiceSupported: voiceSupported });
