// ========== Photo Food Logging (Claude vision) ==========
// Snap a plate photo → Claude identifies the food and estimates macros →
// user confirms/edits → items land in the diet log. The API key lives only
// in localStorage on this device — never in the repo or Firebase.
const FOOD_PHOTO_MODEL = 'claude-opus-4-8'; // cheaper: 'claude-sonnet-5' or 'claude-haiku-4-5'
const FOOD_PHOTO_KEY = 'tf_anthropic_key';

let photoItems = null; // items awaiting confirmation
let lastPhotoDataUrl = null; // thumbnail of the most recent analyzed photo

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
  const resultEl = $('#photoResult');
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
  renderPhotoConfirm();
}

function defaultMealForNow() {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack';
}

function renderPhotoConfirm() {
  const resultEl = $('#photoResult');
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
        <select id="photoMeal">
          ${['breakfast', 'lunch', 'dinner', 'snack'].map(m =>
            `<option value="${m}" ${m === defaultMealForNow() ? 'selected' : ''}>${m[0].toUpperCase() + m.slice(1)}</option>`).join('')}
        </select>
        <button type="button" class="btn-primary" id="photoAddAllBtn">Add all to log</button>
        <button type="button" class="photo-discard-btn" id="photoDiscardBtn">Discard</button>
      </div>
      <p class="photo-confirm-note">Estimates from the photo — tweak anything that looks off before saving.</p>
    </div>`;

  $$('#photoResult .photo-item-name').forEach(inp => {
    inp.addEventListener('input', () => { photoItems[inp.dataset.idx].food = inp.value; });
  });
  $$('#photoResult .photo-item-macros input').forEach(inp => {
    inp.addEventListener('input', () => { photoItems[inp.dataset.idx][inp.dataset.macro] = Number(inp.value) || 0; });
  });
  $$('#photoResult .photo-item-del').forEach(btn => {
    btn.addEventListener('click', () => { photoItems.splice(Number(btn.dataset.idx), 1); renderPhotoConfirm(); });
  });
  const addBtn = $('#photoAddAllBtn');
  if (addBtn) addBtn.addEventListener('click', savePhotoItems);
  const discardBtn = $('#photoDiscardBtn');
  if (discardBtn) discardBtn.addEventListener('click', () => { photoItems = null; $('#photoResult').innerHTML = ''; });
}

function savePhotoItems() {
  if (!photoItems || !photoItems.length) return;
  const meal = ($('#photoMeal') && $('#photoMeal').value) || defaultMealForNow();
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
  $('#photoResult').innerHTML = '';
  saveData(state);
  renderDiet();
  showToast(`✓ Logged ${n} item${n === 1 ? '' : 's'} from your photo`);
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
