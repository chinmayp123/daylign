// ========== Settings preferences ==========
// The theme switch and the Anthropic key, as they appear in Settings. The
// pages and the navigation between them are js/settings.js.

// ---------- Appearance ----------
// The theme itself lives in js/enhancements.js (it has to run before first
// paint). This only reflects the stored choice on the System / Light / Dark
// switch, which is the one theme control in the app.
function renderThemeSegmented() {
  const wrap = document.getElementById('themeSeg');
  if (!wrap) return;
  const pref = (typeof window.daylignThemePref === 'function') ? window.daylignThemePref() : 'system';
  wrap.querySelectorAll('[data-theme-pref]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.themePref === pref ? 'true' : 'false');
  });
}

// ---------- Anthropic API key ----------
// One localStorage slot, read by photo logging and by voice.
const AI_KEY_STORAGE = 'tf_anthropic_key';

function readAiKey() {
  try { return localStorage.getItem(AI_KEY_STORAGE) || ''; } catch (e) { return ''; }
}

// The key is never rendered, not even masked: once saved, the page only says
// that one exists. To change it, remove it and paste the new one.
function renderAiKeyStatus() {
  const status = document.getElementById('aiKeyStatus');
  if (!status) return;
  const has = !!readAiKey();
  status.textContent = has
    ? 'Key saved on this device'
    : 'No key on this device. Photo logging and voice are off.';
  const removeBtn = document.getElementById('aiKeyRemoveBtn');
  if (removeBtn) removeBtn.hidden = !has;
  const form = document.getElementById('aiKeyForm');
  if (form) form.hidden = has;
}

function saveAiKey() {
  const input = document.getElementById('aiKeyInput');
  if (!input) return;
  const key = input.value.trim();
  if (!key) { showToast('Paste your key first'); return; }
  // Cheap sanity check — catches pasting the wrong thing entirely.
  if (key.indexOf('sk-ant-') !== 0) { showToast('That does not look like an Anthropic key (starts with sk-ant-)'); return; }
  try { localStorage.setItem(AI_KEY_STORAGE, key); } catch (e) { showToast('Could not save on this device'); return; }
  input.value = '';
  renderAiKeyStatus();
  if (typeof renderSettingsIndex === 'function') renderSettingsIndex();
  showToast('Key saved on this device');
}

function removeAiKey() {
  try { localStorage.removeItem(AI_KEY_STORAGE); } catch (e) {}
  renderAiKeyStatus();
  if (typeof renderSettingsIndex === 'function') renderSettingsIndex();
  showToast('Key removed from this device');
}

function renderSettingsPrefs() {
  renderThemeSegmented();
  renderAiKeyStatus();
}

function bindPreferencesEvents() {
  const save = document.getElementById('aiKeySaveBtn');
  if (save) save.addEventListener('click', saveAiKey);
  const input = document.getElementById('aiKeyInput');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') saveAiKey(); });
  const remove = document.getElementById('aiKeyRemoveBtn');
  if (remove) remove.addEventListener('click', removeAiKey);
}
