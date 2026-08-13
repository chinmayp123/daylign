// ========== Photo Food Logging (Claude vision) ==========
// Snap a plate photo → Claude identifies the food and estimates macros →
// user confirms/edits → items land in the diet log. The API key lives only
// in localStorage on this device — never in the repo or Firebase.
const FOOD_PHOTO_MODEL = 'claude-opus-4-8'; // cheaper: 'claude-sonnet-5' or 'claude-haiku-4-5'
const FOOD_PHOTO_KEY = 'tf_anthropic_key';

// Items awaiting confirmation. Mirrored to localStorage on every change,
// because this used to be the ONLY copy and it lived in a DOM node that any
// renderDiet() destroyed — including the one fired 50ms after every Firebase
// snapshot. Logging breakfast echoed back from the cloud and wiped a lunch
// photo that was still waiting to be confirmed. An analysis costs an API call
// and ten seconds of standing over your food; it must survive a re-render, a
// tab switch, and a reload.
const PHOTO_PENDING_KEY = 'tf_photo_pending';

let photoItems = null; // items awaiting confirmation

function savePendingPhoto() {
  try {
    if (photoItems && photoItems.length) {
      localStorage.setItem(PHOTO_PENDING_KEY, JSON.stringify({
        items: photoItems,
        meal: photoTargetMeal,
        sel: photoResultSel,
        thumb: lastPhotoDataUrl,
        date: (typeof dietViewDate !== 'undefined' && dietViewDate) || getTodayStr(),
        at: Date.now(),
      }));
    } else {
      localStorage.removeItem(PHOTO_PENDING_KEY);
    }
  } catch (e) { /* quota — the in-memory copy still works for this session */ }
}

function loadPendingPhoto() {
  try {
    const raw = localStorage.getItem(PHOTO_PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.items || !p.items.length) return null;
    // A confirmation left overnight is stale — the meal is long eaten and
    // silently logging it the next day would be worse than dropping it.
    if (Date.now() - (p.at || 0) > 12 * 3600 * 1000) { localStorage.removeItem(PHOTO_PENDING_KEY); return null; }
    return p;
  } catch (e) { return null; }
}

// Called from renderDiet AFTER it rebuilds the meal rows, so a pending
// confirmation is put back instead of disappearing.
function restorePendingPhoto() {
  const p = loadPendingPhoto();
  if (!p) return;
  const viewing = (typeof dietViewDate !== 'undefined' && dietViewDate) || getTodayStr();
  if (p.date && p.date !== viewing) return; // belongs to another day being viewed
  photoItems = p.items;
  photoTargetMeal = p.meal;
  photoResultSel = p.sel;
  if (p.thumb) lastPhotoDataUrl = p.thumb;
  if (photoResultBox()) renderPhotoConfirm();
}
let lastPhotoDataUrl = null; // thumbnail of the most recent analyzed photo
// When Snap is launched from a specific meal row, log to that meal and render
// the confirm UI inline there instead of the Log Food card's #photoResult.
let photoTargetMeal = null;
let photoResultSel = null;
function photoResultBox() {
  return (photoResultSel && document.querySelector(photoResultSel)) || $('#photoResult');
}

function getAnthropicKey() {
  return localStorage.getItem(FOOD_PHOTO_KEY) || '';
}

// Downscale to keep image tokens (and cost) low — 1024px is plenty for a plate
function resizePhotoToJpeg(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          food: { type: 'string' },
          portion: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['food', 'portion', 'calories', 'protein', 'carbs', 'fat', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

async function analyzeMealPhoto(file) {
  const key = getAnthropicKey();
  const resultEl = photoResultBox();
  resultEl.innerHTML = '<div class="photo-status"><span class="photo-spinner"></span>Analyzing your plate&hellip;</div>';

  let dataUrl;
  try {
    dataUrl = await resizePhotoToJpeg(file, 1024);
    lastPhotoDataUrl = dataUrl;
  } catch (e) {
    resultEl.innerHTML = '<div class="photo-status error">Could not read that image — try another photo.</div>';
    return;
  }

  const body = {
    model: FOOD_PHOTO_MODEL,
    max_tokens: 2048,
    output_config: { format: { type: 'json_schema', schema: PHOTO_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] } },
        { type: 'text', text:
          'Identify every distinct food and drink item in this photo and estimate the macros for the portion actually visible. ' +
          'The user frequently eats South Indian / Telugu food (idli, dosa, pappu charu, sambar, peanut chutney, soya chunk curry, vadiyala curry, rice dishes) — recognize these by name when present. ' +
          'For each item: a short name suitable for a food log, a portion description (e.g. "3 idli", "1 cup"), and realistic calories, protein, carbs, and fat in grams for that visible portion. ' +
          'Be honest about uncertainty by estimating middle-of-range values. Also rate your confidence in each item as "high", "medium", or "low" based on how clearly you can identify the food and judge its portion. If the photo has no recognizable food, return an empty items array.' },
      ],
    }],
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
      if (res.status === 401) {
        resultEl.innerHTML = '<div class="photo-status error">API key was rejected — tap the key icon and paste it again.</div>';
      } else {
        resultEl.innerHTML = `<div class="photo-status error">Analysis failed: ${esc(msg)}</div>`;
      }
      return;
    }
  } catch (e) {
    resultEl.innerHTML = '<div class="photo-status error">Network error — check your connection and try again.</div>';
    return;
  }

  // Record the call for the usage tracker (Settings → AI features).
  if (typeof logAiCall === 'function' && data.usage) logAiCall('photo', FOOD_PHOTO_MODEL, data.usage);

  if (data.stop_reason === 'refusal') {
    resultEl.innerHTML = '<div class="photo-status error">The model declined to analyze this photo — try a clearer shot of the plate.</div>';
    return;
  }

  let items = [];
  try {
    const textBlock = (data.content || []).find(b => b.type === 'text');
    items = JSON.parse(textBlock.text).items || [];
  } catch (e) {
    resultEl.innerHTML = '<div class="photo-status error">Could not parse the analysis — try again.</div>';
    return;
  }

  if (!items.length) {
    resultEl.innerHTML = '<div class="photo-status">No food detected in that photo — try a closer shot of the plate.</div>';
    return;
  }

  photoItems = items.map(it => ({
    food: String(it.food || 'Food').slice(0, 60),
    portion: String(it.portion || ''),
    calories: Math.max(0, Math.round(Number(it.calories) || 0)),
    protein: Math.max(0, Math.round((Number(it.protein) || 0) * 10) / 10),
    carbs: Math.max(0, Math.round((Number(it.carbs) || 0) * 10) / 10),
    fat: Math.max(0, Math.round((Number(it.fat) || 0) * 10) / 10),
    confidence: ['high', 'medium', 'low'].includes(it.confidence) ? it.confidence : 'medium',
  }));
  // Persist before painting. If anything re-renders in the next tick the
  // analysis is already safe on disk.
  savePendingPhoto();
  renderPhotoConfirm();
}

function defaultMealForNow() {
  const h = new Date().getHours();
  return mealForHour(h);
}

function renderPhotoConfirm() {
  const resultEl = photoResultBox();
  if (!photoItems || !photoItems.length) { resultEl.innerHTML = ''; return; }
  const totals = photoItems.reduce((a, it) => ({
    calories: a.calories + it.calories, protein: a.protein + it.protein,
    carbs: a.carbs + it.carbs, fat: a.fat + it.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const CONF_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence — double-check' };

  resultEl.innerHTML = `
    <div class="photo-confirm">
      <div class="photo-confirm-head">
        ${lastPhotoDataUrl ? `<img class="photo-confirm-thumb" src="${lastPhotoDataUrl}" alt="your meal">` : ''}
        <div class="photo-confirm-head-info">
          <strong>Found ${photoItems.length} item${photoItems.length === 1 ? '' : 's'}</strong>
          <span class="photo-confirm-totals">~${Math.round(totals.calories)} cal &middot; ${Math.round(totals.protein)}g P &middot; ${Math.round(totals.carbs)}g C &middot; ${Math.round(totals.fat)}g F</span>
        </div>
      </div>
      ${photoItems.map((it, i) => `
        <div class="photo-item" data-idx="${i}">
          <div class="photo-item-top">
            <span class="photo-conf photo-conf-${it.confidence}" title="${CONF_LABEL[it.confidence]}"></span>
            <input type="text" class="photo-item-name" value="${esc(it.food)}" data-idx="${i}">
            <span class="photo-item-portion">${esc(it.portion)}</span>
            <button type="button" class="photo-item-del" data-idx="${i}" title="Remove">&times;</button>
          </div>
          <div class="photo-item-macros">
            <label>cal <input type="number" min="0" value="${it.calories}" data-idx="${i}" data-macro="calories"></label>
            <label>P <input type="number" min="0" step="0.5" value="${it.protein}" data-idx="${i}" data-macro="protein"></label>
            <label>C <input type="number" min="0" step="0.5" value="${it.carbs}" data-idx="${i}" data-macro="carbs"></label>
            <label>F <input type="number" min="0" step="0.5" value="${it.fat}" data-idx="${i}" data-macro="fat"></label>
          </div>
        </div>`).join('')}
      <div class="photo-confirm-actions">
        ${photoTargetMeal
          ? `<span class="photo-confirm-meal">→ ${photoTargetMeal[0].toUpperCase() + photoTargetMeal.slice(1)}</span>`
          : `<select id="photoMeal">
          ${['breakfast', 'lunch', 'dinner', 'snack'].map(m =>
            `<option value="${m}" ${m === defaultMealForNow() ? 'selected' : ''}>${m[0].toUpperCase() + m.slice(1)}</option>`).join('')}
        </select>`}
        <button type="button" class="btn-primary" id="photoAddAllBtn">Add all to log</button>
        <button type="button" class="photo-discard-btn" id="photoDiscardBtn">Discard</button>
      </div>
      <p class="photo-confirm-note">Estimates from the photo — tweak anything that looks off before saving.</p>
    </div>`;

  resultEl.querySelectorAll('.photo-item-name').forEach(inp => {
    inp.addEventListener('input', () => { photoItems[inp.dataset.idx].food = inp.value; });
  });
  resultEl.querySelectorAll('.photo-item-macros input').forEach(inp => {
    inp.addEventListener('input', () => { photoItems[inp.dataset.idx][inp.dataset.macro] = Number(inp.value) || 0; });
  });
  resultEl.querySelectorAll('.photo-item-del').forEach(btn => {
    btn.addEventListener('click', () => { photoItems.splice(Number(btn.dataset.idx), 1); savePendingPhoto(); renderPhotoConfirm(); });
  });
  const addBtn = resultEl.querySelector('#photoAddAllBtn');
  if (addBtn) addBtn.addEventListener('click', savePhotoItems);
  const discardBtn = resultEl.querySelector('#photoDiscardBtn');
  if (discardBtn) discardBtn.addEventListener('click', () => { photoItems = null; savePendingPhoto(); photoResultBox().innerHTML = ''; photoTargetMeal = null; photoResultSel = null; });
}

function savePhotoItems() {
  if (!photoItems || !photoItems.length) return;
  const meal = photoTargetMeal || ($('#photoMeal') && $('#photoMeal').value) || defaultMealForNow();
  const date = (typeof dietViewDate !== 'undefined' && dietViewDate) || getTodayStr();
  for (const it of photoItems) {
    const food = it.food.trim();
    if (!food || (!it.calories && !it.protein && !it.carbs && !it.fat)) continue;
    state.diet.push({
      date, meal, food, servings: 1,
      calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
    });
    if (typeof rememberFood === 'function') {
      rememberFood(food, { calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat }, 1);
    }
  }
  const n = photoItems.length;
  photoItems = null;
  savePendingPhoto(); // items are in state.diet now — drop the pending copy
  photoResultBox().innerHTML = '';
  photoTargetMeal = null;
  photoResultSel = null;
  saveData(state);
  renderDiet();
  showToast(`✓ Logged ${n} item${n === 1 ? '' : 's'} from your photo`);
}

// Launch the photo flow from a specific meal row: log to that meal, render the
// confirm UI inline there. If no API key yet, show an inline paste field first.
function startMealPhoto(meal) {
  photoTargetMeal = meal;
  photoResultSel = `.diet-inline-photo[data-photo-meal="${meal}"]`;
  if (!getAnthropicKey()) { renderInlinePhotoKeyPrompt(); return; }
  const input = $('#photoFileInput');
  if (input) input.click();
}

function renderInlinePhotoKeyPrompt() {
  const box = photoResultBox();
  if (!box) { showToast('Add your Anthropic key in Settings → AI features to use Snap'); return; }
  box.innerHTML = `
    <div class="photo-inline-key">
      <input type="password" class="photo-inline-key-input" placeholder="Paste Anthropic key (sk-ant-…)" autocomplete="off">
      <button type="button" class="btn-primary photo-inline-key-save">Save &amp; snap</button>
      <p class="photo-key-note">Stored only on this device — never synced. Get one at console.anthropic.com.</p>
    </div>`;
  const inp = box.querySelector('.photo-inline-key-input');
  if (inp) inp.focus();
  const save = box.querySelector('.photo-inline-key-save');
  if (save) save.addEventListener('click', () => {
    const v = inp.value.trim();
    if (!v.startsWith('sk-ant-')) { showToast('That does not look like an Anthropic key (sk-ant-…)'); return; }
    localStorage.setItem(FOOD_PHOTO_KEY, v);
    box.innerHTML = '';
    showToast('✓ Key saved on this device');
    const input = $('#photoFileInput');
    if (input) input.click();
  });
}

function bindPhotoEvents() {
  const snapBtn = $('#snapMealBtn');
  if (!snapBtn) return;

  // First-time setup: if no key is saved yet, show the paste field up front
  // so it's obvious where the key goes. It collapses once a key is saved.
  if (!getAnthropicKey()) {
    const setup = $('#photoKeySetup');
    if (setup) setup.hidden = false;
  }

  snapBtn.addEventListener('click', () => {
    // Card's own Snap logs via the meal dropdown, confirm renders in #photoResult.
    photoTargetMeal = null;
    photoResultSel = null;
    if (!getAnthropicKey()) {
      $('#photoKeySetup').hidden = false;
      $('#photoKeyInput').focus();
      return;
    }
    $('#photoFileInput').click();
  });

  $('#photoFileInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same photo
    if (file) analyzeMealPhoto(file);
  });

  $('#photoKeyBtn').addEventListener('click', () => {
    const setup = $('#photoKeySetup');
    setup.hidden = !setup.hidden;
    if (!setup.hidden) $('#photoKeyInput').focus();
  });

  $('#photoKeySaveBtn').addEventListener('click', () => {
    const v = $('#photoKeyInput').value.trim();
    if (!v) {
      localStorage.removeItem(FOOD_PHOTO_KEY);
      showToast('API key removed from this device');
    } else if (!v.startsWith('sk-ant-')) {
      showToast('That does not look like an Anthropic key (sk-ant-…)');
      return;
    } else {
      localStorage.setItem(FOOD_PHOTO_KEY, v);
      showToast('✓ Key saved on this device — snap away');
    }
    $('#photoKeyInput').value = '';
    $('#photoKeySetup').hidden = true;
  });
}
