// Imports generated from the identifier graph during the module
// migration. See the window shim at the foot of this file.
import { bindPhotoEvents } from './food-photo.js';
import { currentProfile } from './profile.js';
import { state } from './state.js';
import { showToast } from './utils.js';

// ========== Settings preferences ==========
// The controls that used to be scattered — the theme toggle in the sidebar, the
// Anthropic key behind a tiny icon in Diet — now also have a real home in
// Settings (design_handoff_daylign_v2 section 5, refs 8a/8b).

// ---------- Appearance ----------
// The theme itself lives in js/enhancements.js (it has to run before first
// paint). This only drives the segmented control and keeps it in sync with the
// sidebar toggle, which still works.
export function currentThemeName() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function renderThemeSegmented() {
  const wrap = document.getElementById('themeSegmented');
  if (!wrap) return;
  const theme = currentThemeName();
  wrap.querySelectorAll('.segmented-btn').forEach(btn => {
    const on = btn.dataset.theme === theme;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// ---------- Account / sync ----------
export function renderSettingsSync() {
  const el = document.getElementById('settingsSync');
  if (!el) return;
  // Mirrors the header indicator rather than inventing a second source of truth.
  const header = document.getElementById('syncStatus');
  let state = 'connecting', label = 'Connecting…';
  if (header) {
    if (header.classList.contains('is-synced')) { state = 'synced'; label = 'Synced to cloud'; }
    else if (header.classList.contains('is-saving')) { state = 'saving'; label = 'Saving…'; }
    else if (header.classList.contains('is-error')) { state = 'error'; label = 'Not syncing — this device only'; }
  }
  const who = (typeof currentProfile === 'function' && currentProfile()) ? currentProfile().name : '—';
  el.className = 'settings-sync is-' + state;
  el.innerHTML = `<span class="settings-sync-dot"></span><span class="settings-sync-text">${label}</span><span class="settings-sync-sub">${who}</span>`;
}

// ---------- Anthropic API key ----------
// Same localStorage slot the Diet photo button uses, so setting it in either
// place lights up both photo logging and voice.
export const AI_KEY_STORAGE = 'tf_anthropic_key';

export function readAiKey() {
  try { return localStorage.getItem(AI_KEY_STORAGE) || ''; } catch (e) { return ''; }
}

// Never render the key itself — only enough to recognise it.
export function maskAiKey(key) {
  if (key.length <= 10) return '••••';
  return key.slice(0, 7) + '…' + key.slice(-4);
}

export function renderAiKeyStatus() {
  const status = document.getElementById('aiKeyStatus');
  if (!status) return;
  const key = readAiKey();
  const removeBtn = document.getElementById('aiKeyRemoveBtn');
  const input = document.getElementById('aiKeyInput');
  if (key) {
    status.className = 'ai-key-status is-set';
    status.textContent = `Key set on this device — ${maskAiKey(key)}`;
    if (removeBtn) removeBtn.hidden = false;
    if (input) input.placeholder = 'Paste a new key to replace it';
  } else {
    status.className = 'ai-key-status';
    status.textContent = 'No key on this device — photo logging and voice are off.';
    if (removeBtn) removeBtn.hidden = true;
    if (input) input.placeholder = 'sk-ant-...';
  }
}

export function saveAiKey() {
  const input = document.getElementById('aiKeyInput');
  if (!input) return;
  const key = input.value.trim();
  if (!key) { showToast('Paste your key first'); return; }
  // Cheap sanity check — catches pasting the wrong thing entirely.
  if (key.indexOf('sk-ant-') !== 0) { showToast('That does not look like an Anthropic key (starts with sk-ant-)'); return; }
  try { localStorage.setItem(AI_KEY_STORAGE, key); } catch (e) { showToast('Could not save on this device'); return; }
  input.value = '';
  renderAiKeyStatus();
  if (typeof bindPhotoEvents === 'function') {
    // Hide the inline "add a key" prompt in Diet now that one exists.
    const setup = document.getElementById('photoKeySetup');
    if (setup) setup.hidden = true;
  }
  showToast('Key saved on this device');
}

export function removeAiKey() {
  try { localStorage.removeItem(AI_KEY_STORAGE); } catch (e) {}
  renderAiKeyStatus();
  showToast('Key removed from this device');
}

export function renderSettingsPrefs() {
  renderThemeSegmented();
  renderSettingsSync();
  renderAiKeyStatus();
}

export function bindPreferencesEvents() {
  const seg = document.getElementById('themeSegmented');
  if (seg) {
    seg.addEventListener('click', e => {
      const btn = e.target.closest('.segmented-btn');
      if (!btn) return;
      // Delegates to the sidebar toggle's own logic so there is one theme path.
      if (typeof window.daylignSetTheme === 'function') window.daylignSetTheme(btn.dataset.theme);
      renderThemeSegmented();
    });
  }

  const save = document.getElementById('aiKeySaveBtn');
  if (save) save.addEventListener('click', saveAiKey);
  const input = document.getElementById('aiKeyInput');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') saveAiKey(); });
  const remove = document.getElementById('aiKeyRemoveBtn');
  if (remove) remove.addEventListener('click', removeAiKey);
}


// --- transitional global shim ---
// Functions and constants only. Mutable bindings are deliberately NOT
// republished: window would hold a frozen copy from module-eval time, so a
// missed reference would read stale data instead of failing loudly.
Object.assign(window, { AI_KEY_STORAGE: AI_KEY_STORAGE, bindPreferencesEvents: bindPreferencesEvents, currentThemeName: currentThemeName, maskAiKey: maskAiKey, readAiKey: readAiKey, removeAiKey: removeAiKey, renderAiKeyStatus: renderAiKeyStatus, renderSettingsPrefs: renderSettingsPrefs, renderSettingsSync: renderSettingsSync, renderThemeSegmented: renderThemeSegmented, saveAiKey: saveAiKey });
