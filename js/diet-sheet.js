// ========== Log Food bottom sheet (mobile) ==========
// The most frequent action on the Diet tab — logging a food — used to sit at
// the very bottom of the page, under the calorie ring, the coaching, the water
// card and the whole day's meal log. You had to scroll past everything you only
// read to reach the one thing you came to do.
//
// On a phone, tapping "Log Food" now slides the Log Food card up in a sheet,
// right where you are. To keep every existing binding (search, serving stepper,
// add, Snap, voice) working untouched, we don't rebuild the form — we lift the
// real card node into the sheet and put it back on close.

let logFoodHomeParent = null;   // where the card lives in the page
let logFoodHomeAnchor = null;   // the sibling to re-insert before

// Sheet is a phone affordance; on wide screens the card sits in its own rail
// and is always visible, so there's nothing to lift.
function logFoodSheetApplies() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function openLogFoodSheet() {
  const card = document.querySelector('.diet-log-card');
  const sheet = document.getElementById('logFoodSheet');
  const body = document.getElementById('logFoodSheetBody');
  if (!card || !sheet || !body) return false;

  // Remember exactly where the card came from so it returns to the same spot.
  logFoodHomeParent = card.parentNode;
  logFoodHomeAnchor = card.nextSibling;

  body.appendChild(card);
  sheet.hidden = false;
  // next frame so the slide-up transition runs
  requestAnimationFrame(() => sheet.classList.add('open'));
  document.body.classList.add('logfood-sheet-lock');

  const search = document.getElementById('dietFoodName');
  if (search) setTimeout(() => search.focus(), 250);
  return true;
}

function closeLogFoodSheet() {
  const sheet = document.getElementById('logFoodSheet');
  const card = document.querySelector('.diet-log-card');
  if (!sheet) return;
  sheet.classList.remove('open');
  document.body.classList.remove('logfood-sheet-lock');

  // Put the card back where it was, once the slide-down finishes.
  const restore = () => {
    if (card && logFoodHomeParent) {
      if (logFoodHomeAnchor && logFoodHomeAnchor.parentNode === logFoodHomeParent) {
        logFoodHomeParent.insertBefore(card, logFoodHomeAnchor);
      } else {
        logFoodHomeParent.appendChild(card);
      }
    }
    sheet.hidden = true;
  };
  setTimeout(restore, 220);
}

function isLogFoodSheetOpen() {
  const sheet = document.getElementById('logFoodSheet');
  return sheet && sheet.classList.contains('open');
}

function bindLogFoodSheet() {
  const sheet = document.getElementById('logFoodSheet');
  if (!sheet) return;
  const close = document.getElementById('logFoodSheetClose');
  if (close) close.addEventListener('click', closeLogFoodSheet);
  // Tap the dimmed backdrop (but not the sheet itself) to dismiss.
  sheet.addEventListener('click', e => { if (e.target === sheet) closeLogFoodSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isLogFoodSheetOpen()) closeLogFoodSheet(); });
}
