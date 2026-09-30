// ========== Photo Food Logging (Claude vision) ==========
// Snap a plate photo → Claude identifies the food and estimates macros →
// user confirms/edits → items land in the diet log. The API key lives only
// in localStorage on this device — never in the repo or Firebase.
//
// v3 (spec 8): the whole flow is one sheet, #photoSheet, with four stages:
// the no-key prompt, the analysing skeleton, an error with Retry, and the
// confirmation list. It used to be an inline box inside whichever meal was
// open, which every renderDiet() destroyed and had to put back.
const FOOD_PHOTO_MODEL = 'claude-opus-4-8'; // cheaper: 'claude-sonnet-5' or 'claude-haiku-4-5'
const FOOD_PHOTO_KEY = 'tf_anthropic_key';

// Items awaiting confirmation. Mirrored to localStorage on every change: an
// analysis costs an API call and ten seconds of standing over your food, so it
// must survive a re-render, a tab switch, a closed sheet and a reload.
const PHOTO_PENDING_KEY = 'tf_photo_pending';

let photoItems = null;        // items awaiting confirmation
let lastPhotoDataUrl = null;  // thumbnail of the most recent analysed photo
let photoTargetMeal = null;   // the meal the camera was opened from
let photoStage = null;        // 'key' | 'busy' | 'error' | 'confirm'
let photoError = '';          // what went wrong, in words
let photoLastFile = null;     // kept so Retry can send the same photo again
let photoEditIdx = null;      // which item's fields are open

function savePendingPhoto() {
  try {
    if (photoItems && photoItems.length) {
      localStorage.setItem(PHOTO_PENDING_KEY, JSON.stringify({
        items: photoItems,
        meal: photoTargetMeal,
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

// Called from renderDiet(). A waiting analysis shows as one row on the day it
// belongs to; tapping it reopens the sheet. Reads only.
function renderPhotoPending() {
  const host = document.getElementById('dietPhotoPending');
  if (!host) return;
  const p = loadPendingPhoto();
  const viewing = (typeof dietViewDate !== 'undefined' && dietViewDate) || getTodayStr();
  if (!p || (p.date && p.date !== viewing)) { host.hidden = true; host.innerHTML = ''; return; }
  const meal = p.meal || defaultMealForNow();
  host.hidden = false;
  host.innerHTML = `<button type="button" class="dt-pending" data-photo-resume>
    <span class="ms" aria-hidden="true">photo_camera</span>
    <span>A photo is waiting: ${p.items.length} item${p.items.length === 1 ? '' : 's'} for ${esc(meal)}.</span>
    <b>Review</b></button>`;
}

function resumePendingPhoto() {
  const p = loadPendingPhoto();
  if (!p) return;
  photoItems = p.items;
  photoTargetMeal = p.meal || null;
  if (p.thumb) lastPhotoDataUrl = p.thumb;
  photoEditIdx = null;
  openPhotoSheet('confirm');
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

// Every failure lands in the sheet as words plus a Retry (spec 8, new). `retry`
// false means sending the same photo again cannot help.
function photoFail(message, retry) {
  photoError = message;
  photoStage = 'error';
  if (retry === false) photoLastFile = null;
  renderPhotoSheet();
}

async function analyzeMealPhoto(file) {
  const key = getAnthropicKey();
  photoLastFile = file;
  photoItems = null;
  photoEditIdx = null;
  openPhotoSheet('busy');

  let dataUrl;
  try {
    dataUrl = await resizePhotoToJpeg(file, 1024);
    lastPhotoDataUrl = dataUrl;
    renderPhotoSheet();   // the skeleton now has the photo above it
  } catch (e) {
    photoFail('Could not read that image. Try another photo.', false);
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
      if (res.status === 401) photoFail('The API key was rejected. Paste it again in Settings, under AI features, then retry.');
      else photoFail(`The analysis failed: ${msg}`);
      return;
    }
  } catch (e) {
    photoFail('Network error. Check your connection and try again.');
    return;
  }

  // Record the call for the usage tracker (Settings → AI features).
  if (typeof logAiCall === 'function' && data.usage) logAiCall('photo', FOOD_PHOTO_MODEL, data.usage);

  if (data.stop_reason === 'refusal') {
    photoFail('The model declined to analyse this photo. Try a clearer shot of the plate.', false);
    return;
  }

  let items = [];
  try {
    const textBlock = (data.content || []).find(b => b.type === 'text');
    items = JSON.parse(textBlock.text).items || [];
  } catch (e) {
    photoFail('Could not read the analysis that came back. Try again.');
    return;
  }

  if (!items.length) {
    photoFail('No food found in that photo. Try a closer shot of the plate.', false);
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
  photoLastFile = null;
  photoStage = 'confirm';
  renderPhotoSheet();
  if (typeof renderPhotoPending === 'function') renderPhotoPending();
}

function defaultMealForNow() {
  const h = new Date().getHours();
  return mealForHour(h);
}

// ---------- the sheet ----------
function openPhotoSheet(stage) {
  photoStage = stage;
  renderPhotoSheet();
  const wrap = document.getElementById('photoSheet');
  if (wrap && !wrap.classList.contains('open')) openDlSheet(wrap);
}

function closePhotoSheet() {
  closeDlSheet(document.getElementById('photoSheet'));
}

function renderPhotoSheet() {
  const wrap = document.getElementById('photoSheet');
  if (!wrap) return;
  const body = wrap.querySelector('.ts-body');
  const title = document.getElementById('photoSheetTitle');
  const meal = photoTargetMeal || defaultMealForNow();
  const Meal = meal[0].toUpperCase() + meal.slice(1);
  if (title) title.textContent = `${Meal} from a photo`;
  const thumb = lastPhotoDataUrl && photoStage !== 'key'
    ? `<img class="ph-thumb" src="${lastPhotoDataUrl}" alt="The photo you took">` : '';

  if (photoStage === 'key') {
    body.innerHTML = `
      <p class="ts-hint">Photo logging uses your own Anthropic key. It is stored on this device only and is never synced.</p>
      <label class="dl-field"><span class="dl-field-label">Anthropic key</span>
        <input type="password" id="photoKeyInline" placeholder="sk-ant-..." autocomplete="off"></label>
      <div class="ts-actions"><span class="ts-spacer"></span>
        <button type="button" class="dl-btn" data-photo-close>Not now</button>
        <button type="button" class="dl-btn primary" data-photo-savekey>Save and take the photo</button></div>
      <p class="ts-hint">You can get one at console.anthropic.com, and change or remove it in Settings, under AI features.</p>`;
    return;
  }

  if (photoStage === 'busy') {
    body.innerHTML = `
      ${thumb || '<div class="dl-skel ph-thumb"></div>'}
      <p class="ph-status" role="status">Looking at your plate...</p>
      <div class="dl-skel ph-skel"></div><div class="dl-skel ph-skel"></div><div class="dl-skel ph-skel"></div>`;
    return;
  }

  if (photoStage === 'error') {
    body.innerHTML = `
      ${thumb}
      <div class="ph-error" role="alert"><span class="ms" aria-hidden="true">error</span><span>${esc(photoError)}</span></div>
      <div class="ts-actions"><span class="ts-spacer"></span>
        <button type="button" class="dl-btn" data-photo-close>Close</button>
        ${photoLastFile ? '<button type="button" class="dl-btn primary" data-photo-retry>Retry</button>'
          : '<button type="button" class="dl-btn primary" data-photo-again>Take another photo</button>'}</div>`;
    return;
  }

  // confirm
  if (!photoItems || !photoItems.length) { body.innerHTML = '<p class="ms-empty">Nothing to add.</p>'; return; }
  const totals = photoItems.reduce((a, it) => ({ calories: a.calories + it.calories, protein: a.protein + it.protein }), { calories: 0, protein: 0 });
  body.innerHTML = `
    ${thumb}
    <p class="ms-macro">About ${Math.round(totals.calories)} kcal · ${Math.round(totals.protein)}g protein</p>
    <div class="ms-list">
      ${photoItems.map((it, i) => `
        <div class="ph-row">
          <span class="ph-dot ${it.confidence === 'high' ? 'is-sure' : 'is-check'}" role="img" aria-label="${it.confidence === 'high' ? 'Sure about this one' : 'Check this one'}"></span>
          <span class="lib-main"><span class="lib-name">${esc(it.food)}</span>
            <span class="lib-sub">${it.portion ? esc(it.portion) + ' · ' : ''}${it.calories} kcal · ${it.protein}g P</span></span>
          <button type="button" class="ss-act" data-photo-edit="${i}" aria-label="Edit ${esc(it.food)}" aria-expanded="${photoEditIdx === i}"><span class="ms" aria-hidden="true">edit</span></button>
          <button type="button" class="ss-act" data-photo-del="${i}" aria-label="Remove ${esc(it.food)}"><span class="ms" aria-hidden="true">close</span></button>
        </div>
        ${photoEditIdx === i ? `
          <div class="dl-card ms-edit">
            <label class="dl-field"><span class="dl-field-label">Name</span><input type="text" data-photo-field="food" data-idx="${i}" value="${esc(it.food)}" maxlength="60"></label>
            <div class="ms-macros">
              <label class="dl-field"><span class="dl-field-label">Kcal</span><input type="number" min="0" data-photo-field="calories" data-idx="${i}" value="${it.calories}"></label>
              <label class="dl-field"><span class="dl-field-label">P</span><input type="number" min="0" step="0.5" data-photo-field="protein" data-idx="${i}" value="${it.protein}"></label>
              <label class="dl-field"><span class="dl-field-label">C</span><input type="number" min="0" step="0.5" data-photo-field="carbs" data-idx="${i}" value="${it.carbs}"></label>
              <label class="dl-field"><span class="dl-field-label">F</span><input type="number" min="0" step="0.5" data-photo-field="fat" data-idx="${i}" value="${it.fat}"></label>
            </div>
          </div>` : ''}`).join('')}
    </div>
    <p class="ts-hint">The dot shows how sure it is: green sure, amber check it.</p>
    <label class="dl-field"><span class="dl-field-label">Add to</span>
      <select id="photoMeal">${['breakfast', 'lunch', 'snack', 'dinner'].map(m =>
        `<option value="${m}"${m === meal ? ' selected' : ''}>${m[0].toUpperCase() + m.slice(1)}</option>`).join('')}</select></label>
    <div class="ts-actions">
      <button type="button" class="dl-btn danger" data-photo-discard>Discard</button>
      <span class="ts-spacer"></span>
      <button type="button" class="dl-btn primary" data-photo-addall>Add ${photoItems.length === 1 ? 'it' : 'all ' + photoItems.length}</button>
    </div>
    <p class="ts-hint">If you leave, this waits for you for 12 hours.</p>`;
}

function savePhotoItems() {
  if (!photoItems || !photoItems.length) return;
  const sel = document.getElementById('photoMeal');
  const meal = (sel && sel.value) || photoTargetMeal || defaultMealForNow();
  const date = (typeof dietViewDate !== 'undefined' && dietViewDate) || getTodayStr();
  let added = 0;
  for (const it of photoItems) {
    const food = it.food.trim();
    if (!food || (!it.calories && !it.protein && !it.carbs && !it.fat)) continue;
    const entry = {
      date, meal, food, servings: 1,
      calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
    };
    // When it was eaten, so the line can place it (spec 4.3). Only a meal
    // logged for today has an honest clock time.
    if (date === getTodayStr()) entry.at = Date.now();
    state.diet.push(entry);
    added++;
    if (typeof rememberFood === 'function') {
      rememberFood(food, { calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat }, 1);
    }
  }
  photoItems = null;
  photoTargetMeal = null;
  lastPhotoDataUrl = null;
  savePendingPhoto(); // items are in state.diet now — drop the pending copy
  saveData(state);
  closePhotoSheet();
  renderDiet();
  if (added) showToast(`Added ${added} item${added === 1 ? '' : 's'} to ${meal}`);
}

// Launch the photo flow for a meal. Without a key the sheet opens on the key
// prompt first.
function startMealPhoto(meal) {
  photoTargetMeal = meal || defaultMealForNow();
  if (!getAnthropicKey()) { openPhotoSheet('key'); const i = document.getElementById('photoKeyInline'); if (i) i.focus(); return; }
  const input = $('#photoFileInput');
  if (input) input.click();
}

let photoBound = false;
function bindPhotoEvents() {
  // The file input is the one piece every camera button needs.
  const fileInput = $('#photoFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // allow re-selecting the same photo
      if (file) analyzeMealPhoto(file);
    });
  }

  const wrap = document.getElementById('photoSheet');
  if (!wrap || photoBound) return;
  photoBound = true;
  const x = document.getElementById('photoSheetClose');
  if (x) x.addEventListener('click', closePhotoSheet);

  wrap.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('[data-photo-close]')) { closePhotoSheet(); return; }
    if (t.closest('[data-photo-savekey]')) {
      const inp = document.getElementById('photoKeyInline');
      const v = (inp ? inp.value : '').trim();
      if (!v.startsWith('sk-ant-')) { showToast('That does not look like an Anthropic key (sk-ant-...)'); if (inp) inp.focus(); return; }
      localStorage.setItem(FOOD_PHOTO_KEY, v);
      showToast('Key saved on this device');
      closePhotoSheet();
      if (fileInput) fileInput.click();
      return;
    }
    if (t.closest('[data-photo-retry]')) { if (photoLastFile) analyzeMealPhoto(photoLastFile); return; }
    if (t.closest('[data-photo-again]')) { closePhotoSheet(); if (fileInput) fileInput.click(); return; }
    const edit = t.closest('[data-photo-edit]');
    if (edit) { const i = Number(edit.dataset.photoEdit); photoEditIdx = photoEditIdx === i ? null : i; renderPhotoSheet(); return; }
    const del = t.closest('[data-photo-del]');
    if (del) {
      photoItems.splice(Number(del.dataset.photoDel), 1);
      photoEditIdx = null;
      savePendingPhoto();
      if (!photoItems.length) { photoItems = null; closePhotoSheet(); }
      else renderPhotoSheet();
      if (typeof renderPhotoPending === 'function') renderPhotoPending();
      return;
    }
    if (t.closest('[data-photo-discard]')) {
      photoItems = null; photoTargetMeal = null; lastPhotoDataUrl = null;
      savePendingPhoto();
      closePhotoSheet();
      if (typeof renderPhotoPending === 'function') renderPhotoPending();
      return;
    }
    if (t.closest('[data-photo-addall]')) savePhotoItems();
  });

  // Edits are kept as they are typed, and mirrored to the pending copy.
  wrap.addEventListener('input', (ev) => {
    const f = ev.target.closest('[data-photo-field]');
    if (!f || !photoItems) return;
    const it = photoItems[Number(f.dataset.idx)];
    if (!it) return;
    if (f.dataset.photoField === 'food') it.food = f.value;
    else it[f.dataset.photoField] = Math.max(0, Number(f.value) || 0);
    savePendingPhoto();
  });
  wrap.addEventListener('change', (ev) => {
    const sel = ev.target.closest('#photoMeal');
    if (sel) { photoTargetMeal = sel.value; savePendingPhoto(); const tt = document.getElementById('photoSheetTitle'); if (tt) tt.textContent = `${sel.value[0].toUpperCase() + sel.value.slice(1)} from a photo`; }
  });

  // The "A photo is waiting" row on the Diet day.
  document.addEventListener('click', (ev) => { if (ev.target.closest('[data-photo-resume]')) resumePendingPhoto(); });
}
