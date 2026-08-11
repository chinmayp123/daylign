// ========== Pull to refresh ==========
// The app's own data arrives on a live Firebase listener, but Apple Health and
// the shared food bank are read once at startup. So an installed PWA left open
// all day still showed yesterday's watch data after the 9pm shortcut ran, and
// the only cure was force-quitting the app. This is the gesture everyone
// already knows for exactly that problem.
//
// Deliberately conservative about when it engages, because the scroll on this
// app has been fiddly before: it arms only on a real touch that starts with the
// page already at the very top, and disarms the moment the gesture looks more
// horizontal than vertical. Anything else is left alone as a normal scroll.

const PTR_TRIGGER = 72;   // pull distance that commits to a refresh
const PTR_MAX = 110;      // furthest the indicator will travel
const PTR_SLOP = 10;      // ignore the first few px so taps never arm it

let ptrStartY = 0;
let ptrStartX = 0;
let ptrArmed = false;     // touch began at scrollY 0
let ptrPulling = false;   // committed to a vertical pull, we own the gesture
let ptrRefreshing = false;
let ptrEl = null;

function ptrIndicator() {
  if (ptrEl) return ptrEl;
  ptrEl = document.createElement('div');
  ptrEl.className = 'ptr';
  ptrEl.setAttribute('aria-hidden', 'true');
  ptrEl.innerHTML = '<div class="ptr-spinner"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3.6-7.2"/><polyline points="21 3 21 9 15 9"/></svg></div>';
  document.body.appendChild(ptrEl);
  return ptrEl;
}

function ptrSet(dist, committed) {
  const el = ptrIndicator();
  const d = Math.min(dist, PTR_MAX);
  el.style.transform = 'translate(-50%, ' + d + 'px)';
  el.style.opacity = String(Math.min(1, d / (PTR_TRIGGER * 0.65)));
  el.classList.toggle('is-ready', !!committed);
  // Rotate with the pull so it reads as direct manipulation rather than a
  // progress bar that happens to be near your thumb.
  const spin = el.querySelector('.ptr-spinner');
  if (spin) spin.style.transform = 'rotate(' + Math.round(d * 2.6) + 'deg)';
}

function ptrReset() {
  const el = ptrIndicator();
  el.classList.add('is-settling');
  el.style.transform = 'translate(-50%, 0px)';
  el.style.opacity = '0';
  el.classList.remove('is-ready', 'is-spinning');
  setTimeout(() => el.classList.remove('is-settling'), 240);
}

function ptrRun() {
  if (ptrRefreshing) return;
  ptrRefreshing = true;
  // Still inside the touch gesture here, which is what the iOS fallback needs.
  if (typeof haptic === 'function') haptic('light');
  const el = ptrIndicator();
  el.classList.add('is-spinning');
  el.classList.add('is-settling');
  el.style.transform = 'translate(-50%, ' + PTR_TRIGGER + 'px)';
  el.style.opacity = '1';

  const done = () => {
    ptrRefreshing = false;
    ptrReset();
  };
  // Always show the spinner briefly. A refresh that resolves in 80ms reads as
  // "nothing happened" and people pull again.
  const minVisible = new Promise(r => setTimeout(r, 550));
  const work = (typeof refreshFromCloud === 'function')
    ? refreshFromCloud().catch(() => {})
    : Promise.resolve();

  Promise.all([work, minVisible]).then(() => {
    if (typeof render === 'function') { try { render(); } catch (e) { /* keep the gesture honest */ } }
    if (typeof showToast === 'function') showToast('Up to date');
    done();
  }).catch(done);
}

function bindPullToRefresh() {
  if (!('ontouchstart' in window)) return; // pointerless devices have F5

  document.addEventListener('touchstart', e => {
    if (ptrRefreshing || e.touches.length !== 1) { ptrArmed = false; return; }
    // Only arm at the very top. Anything else is a scroll, not a pull.
    ptrArmed = window.scrollY <= 0;
    ptrPulling = false;
    ptrStartY = e.touches[0].clientY;
    ptrStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!ptrArmed || ptrRefreshing || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - ptrStartY;
    const dx = e.touches[0].clientX - ptrStartX;

    if (!ptrPulling) {
      if (dy < PTR_SLOP) return;                 // not downward yet
      if (Math.abs(dx) > Math.abs(dy)) {         // horizontal — a card swipe
        ptrArmed = false;
        return;
      }
      // The page may have scrolled between touchstart and now.
      if (window.scrollY > 0) { ptrArmed = false; return; }
      ptrPulling = true;
    }

    if (dy <= 0) { ptrSet(0, false); return; }
    // Suppress the native rubber band only once we have committed, so normal
    // overscroll elsewhere in the app is untouched.
    if (e.cancelable) e.preventDefault();
    const eased = Math.pow(dy, 0.82); // resistance, so it never feels loose
    ptrSet(eased, eased >= PTR_TRIGGER);
  }, { passive: false });

  const end = () => {
    if (!ptrPulling || ptrRefreshing) { ptrArmed = false; ptrPulling = false; return; }
    const el = ptrIndicator();
    const committed = el.classList.contains('is-ready');
    ptrArmed = false;
    ptrPulling = false;
    if (committed) ptrRun();
    else ptrReset();
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
