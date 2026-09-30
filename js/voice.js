// ========== Voice / Natural-Language Commands ==========
// Tap the mic (or type), speak naturally ("log 40 oz water", "add a task to
// pay rent tomorrow, high priority", "I weighed 163 this morning", "go to
// gym"). Speech is transcribed on-device via the Web Speech API, then Claude
// turns the text into structured commands the app runs. Reuses the same
// Anthropic key stored by the photo feature (localStorage only, never synced).
const VOICE_MODEL = 'claude-haiku-4-5'; // fast + cheap for simple command parsing

let voiceRecognition = null;
let voiceListening = false;

function voiceKey() {
  return (typeof getAnthropicKey === 'function') ? getAnthropicKey() : (localStorage.getItem('tf_anthropic_key') || '');
}

// 'gym' and 'cardio' stay listed as aliases — switchView maps them onto
// Training's two modes, so older phrasings keep working.
const VOICE_VIEWS = ['today', 'dashboard', 'tasks', 'board', 'calendar', 'training', 'gym', 'cardio', 'diet', 'settings'];

const VOICE_SCHEMA = {
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

function voiceContextPrompt() {
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

// ---- The voice sheet (spec 10.6) ----
// Opened from the + sheet, the mic in Diet's add bar, Today's "Say it" and the
// palette's "Run as a command". The floating mic that used to sit over every
// screen is gone: it covered content, and it was one more thing on the page.

// What the sheet says while the request is out: the shape of a result, not a
// spinner.
const VOICE_PENDING = '<div class="vc-res is-pending"><span class="dl-skel"></span></div><div class="vc-res is-pending"><span class="dl-skel" style="width:60%"></span></div>';
const VOICE_UNDO_MS = 6000;
let voiceUndoTimer = null;

function voiceStatus(html, opts) {
  const o = opts || {};
  $('#voiceResult').innerHTML = `<div class="vc-status${o.warn ? ' is-warn' : ''}">${html}</div>` +
    (o.settings ? '<button type="button" class="dl-btn" data-voice-settings><span class="ms" aria-hidden="true">key</span>Open Settings, AI</button>' : '');
}

async function runVoiceCommand(text) {
  const key = voiceKey();
  if (!key) {
    voiceStatus('No Anthropic key on this device, so voice is off. Add one in Settings, AI.', { warn: true, settings: true });
    return;
  }
  if (!text || !text.trim()) return;
  $('#voiceTranscript').textContent = '“' + text.trim() + '”';
  $('#voiceResult').innerHTML = VOICE_PENDING;

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
      if (res.status === 401) voiceStatus('The key was rejected. Replace it in Settings, AI.', { warn: true, settings: true });
      else voiceStatus(`Couldn't process that: ${esc(msg)}`, { warn: true });
      return;
    }
  } catch (e) {
    voiceStatus('Network error. Check your connection, or type it again later.', { warn: true });
    return;
  }

  // Record the call for the usage tracker (Settings, AI).
  if (typeof logAiCall === 'function' && data.usage) logAiCall('voice', VOICE_MODEL, data.usage);

  if (data.stop_reason === 'refusal') {
    voiceStatus('The model declined that request.', { warn: true });
    return;
  }

  let commands = [];
  try {
    const textBlock = (data.content || []).find(b => b.type === 'text');
    commands = JSON.parse(textBlock.text).commands || [];
  } catch (e) {
    voiceStatus('Could not understand that. Try saying it another way.', { warn: true });
    return;
  }

  executeVoiceCommands(commands);
}

// Run each command, collecting a line and an undo per one that changed
// something.
function executeVoiceCommands(commands) {
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
        icon: 'check_circle',
        label: `Task: <b>${esc(task.name)}</b>${task.dueDate ? `, ${esc(formatDate(task.dueDate))}` : ''}`,
        undo: () => { state.tasks = state.tasks.filter(t => t !== task); },
      });

    } else if (cmd.action === 'log_water') {
      const oz = Math.round(Number(cmd.oz) || 0);
      if (oz > 0) {
        state.water[today] = state.water[today] || [];
        state.water[today].push(oz);
        // The time goes with it, as it does from the Diet buttons, so the
        // line puts this drink where it was drunk.
        state.waterAt = state.waterAt || {};
        state.waterAt[today] = state.waterAt[today] || [];
        const at = state.water[today].length - 1;
        state.waterAt[today][at] = Date.now();
        done.push({
          icon: 'water_drop',
          label: `Water: <b>+${oz} oz</b>`,
          undo: () => {
            const a = state.water[today];
            if (!a) return;
            const i = a.lastIndexOf(oz);
            if (i < 0) return;
            a.splice(i, 1);
            if (state.waterAt && state.waterAt[today]) state.waterAt[today].splice(i, 1);
          },
        });
      }

    } else if (cmd.action === 'log_weight') {
      const lbs = Math.round((Number(cmd.lbs) || 0) * 10) / 10;
      if (lbs >= 50 && lbs <= 500) {
        state.weight = state.weight || {};
        const prev = state.weight[today];
        state.weight[today] = lbs;
        done.push({
          icon: 'monitor_weight',
          label: `Weight: <b>${lbs} lb</b>`,
          undo: () => { if (prev === undefined) delete state.weight[today]; else state.weight[today] = prev; },
        });
      }

    } else if (cmd.action === 'log_food') {
      const meal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(cmd.meal) ? cmd.meal
        : (typeof defaultMealForNow === 'function' ? defaultMealForNow() : 'snack');
      const added = [];
      for (const it of (cmd.items || [])) {
        const entry = {
          date: today, meal, food: String(it.food || 'Food').slice(0, 60), servings: 1, at: Date.now(),
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
          icon: 'restaurant',
          label: `${esc(meal.charAt(0).toUpperCase() + meal.slice(1))}: <b>${added.map(e => esc(e.food)).join(', ')}</b>, about ${cals} kcal`,
          undo: () => { state.diet = state.diet.filter(e => !added.includes(e)); },
        });
      }

    } else if (cmd.action === 'navigate') {
      if (VOICE_VIEWS.includes(cmd.view)) navTo = cmd.view;

    } else if (cmd.action === 'unrecognized') {
      done.push({ icon: 'help', miss: true, label: `Didn't catch “${esc(cmd.text || '')}”`, undo: null });
    }
  }

  const changed = done.some(d => d.undo);
  if (changed) { saveData(state); render(); }

  if (!done.length && !navTo) {
    voiceStatus('Nothing to do. Try “16 ounces of water” or “dentist tomorrow at 11”.');
    return;
  }

  resultEl.innerHTML = done.map((d, i) => `
      <div class="vc-res${d.miss ? ' is-miss' : ''}">
        <span class="ms${d.miss ? '' : ' fill'}" aria-hidden="true">${d.icon}</span>
        <span class="vc-res-t">${d.label}</span>
        ${d.undo ? `<button type="button" class="vc-undo" data-undo="${i}">Undo</button>` : ''}
      </div>`).join('') +
    (navTo ? `<div class="vc-res"><span class="ms" aria-hidden="true">arrow_forward</span><span class="vc-res-t">Opening <b>${esc(navTo)}</b></span></div>` : '');

  resultEl._undo = done;
  // Undo is offered for six seconds, like every other undo in the app. After
  // that the row stays as a record of what happened.
  clearTimeout(voiceUndoTimer);
  voiceUndoTimer = setTimeout(() => { resultEl.querySelectorAll('.vc-undo').forEach(b => b.remove()); }, VOICE_UNDO_MS);

  if (navTo) {
    // Navigate after a beat so the confirmation is readable, then close.
    setTimeout(() => { closeVoicePanel(); switchView(navTo); }, changed ? 900 : 250);
  }
}

// ---- Speech recognition ----
function voiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function setVoiceMic(on) {
  const mic = $('#voiceMicBtn');
  if (!mic) return;
  mic.classList.toggle('is-listening', on);
  mic.setAttribute('aria-pressed', on ? 'true' : 'false');
  mic.setAttribute('aria-label', on ? 'Stop listening' : 'Start listening');
}

function startVoiceListening() {
  if (!voiceSupported()) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  stopVoiceListening();
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  voiceRecognition = rec;

  setVoiceMic(true);
  $('#voiceHint').textContent = 'Listening…';

  rec.onresult = (e) => {
    let txt = '';
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    $('#voiceTranscript').textContent = '“' + txt + '”';
    $('#voiceInput').value = txt;
    const final = e.results[e.results.length - 1].isFinal;
    if (final) { stopVoiceListening(); $('#voiceHint').textContent = ''; runVoiceCommand(txt); }
  };
  rec.onerror = (e) => {
    stopVoiceListening();
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      $('#voiceHint').textContent = 'The microphone is blocked. Allow it, or type below.';
    } else if (e.error === 'no-speech') {
      $('#voiceHint').textContent = "Didn't hear anything. Tap the mic to try again, or type.";
    } else {
      $('#voiceHint').textContent = 'Voice is not available here. Type below.';
    }
  };
  rec.onend = () => { voiceListening = false; setVoiceMic(false); };

  try { rec.start(); voiceListening = true; }
  catch (e) { stopVoiceListening(); $('#voiceHint').textContent = 'Type below.'; }
}

function stopVoiceListening() {
  if (voiceRecognition) { try { voiceRecognition.stop(); } catch (e) {} voiceRecognition = null; }
  voiceListening = false;
  setVoiceMic(false);
}

// `text` runs straight away (the palette's "Run as a command"); with none the
// mic starts, in the same tap, which is what iOS needs to allow it.
function openVoicePanel(text) {
  const wrap = $('#voiceSheet');
  if (!wrap) return;
  clearTimeout(voiceUndoTimer);
  $('#voiceInput').value = '';
  $('#voiceResult').innerHTML = '';
  $('#voiceResult')._undo = null;
  $('#voiceTranscript').textContent = '';
  const mic = $('#voiceMicBtn');
  openDlSheet(wrap);
  if (typeof text === 'string' && text.trim()) {
    $('#voiceInput').value = text.trim();
    $('#voiceHint').textContent = '';
    runVoiceCommand(text);
    return;
  }
  if (!voiceKey()) {
    mic.hidden = !voiceSupported();
    $('#voiceHint').textContent = '';
    voiceStatus('No Anthropic key on this device, so voice is off. Add one in Settings, AI.', { warn: true, settings: true });
    return;
  }
  if (voiceSupported()) {
    mic.hidden = false;
    startVoiceListening();
  } else {
    mic.hidden = true;
    $('#voiceHint').textContent = 'Type a command and press Run.';
    setTimeout(() => $('#voiceInput').focus(), 60);
  }
}

function closeVoicePanel() {
  stopVoiceListening();
  const wrap = $('#voiceSheet');
  if (wrap && wrap.classList.contains('open')) closeDlSheet(wrap);
}

function bindVoiceEvents() {
  const wrap = $('#voiceSheet');
  if (!wrap) return;
  // Swiped away or Esc: stop listening too.
  wrap.addEventListener('dl-sheet-close', stopVoiceListening);
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('#voiceMicBtn')) {
      if (voiceListening) stopVoiceListening(); else startVoiceListening();
      return;
    }
    if (e.target.closest('#voiceRunBtn')) {
      stopVoiceListening();
      runVoiceCommand($('#voiceInput').value);
      return;
    }
    if (e.target.closest('[data-voice-settings]')) {
      closeVoicePanel();
      if (typeof openSettingsPage === 'function') openSettingsPage('ai');
      return;
    }
    const undo = e.target.closest('.vc-undo');
    if (undo) {
      const list = $('#voiceResult')._undo || [];
      const d = list[Number(undo.dataset.undo)];
      if (d && d.undo) {
        d.undo();
        d.undo = null;
        saveData(state);
        render();
        undo.closest('.vc-res').classList.add('is-undone');
        undo.remove();
      }
    }
  });
  $('#voiceInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); stopVoiceListening(); runVoiceCommand($('#voiceInput').value); }
  });
}
