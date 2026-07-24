// ========== Collapsible cards (mobile density) ==========
// The app grew out of a desktop dashboard: wide pages where everything fits at
// once. On a phone that same content stacks into one very tall scroll. This
// lets any card collapse to just its header, so secondary sections (weekly
// report, coach, history…) don't force a scroll marathon on mobile while
// staying fully visible on desktop.
//
// Usage: add class `collapsible` to a `.card`, and `data-collapse="mobile"` to
// have it start collapsed on phones. The card's FIRST child is treated as the
// header (a chevron is injected, it becomes the toggle); everything after hides
// when collapsed. An explicit toggle is remembered per card (data-collapse-key)
// and then wins over the responsive default.

function collapseKey(card) {
  return 'daylign_collapse_' + (card.dataset.collapseKey || card.id || 'c');
}

// Apply the right collapsed state to every collapsible card. Safe to call on
// every render — it re-reads the viewport so a card the user hasn't explicitly
// toggled collapses on phones and expands on desktop.
function applyCollapsibleState() {
  const isPhone = window.matchMedia('(max-width: 640px)').matches;
  document.querySelectorAll('.card.collapsible').forEach(card => {
    const saved = localStorage.getItem(collapseKey(card));
    let collapsed;
    if (saved !== null) collapsed = saved === '1';          // explicit choice wins
    else collapsed = isPhone && card.dataset.collapse === 'mobile'; // responsive default
    card.classList.toggle('is-collapsed', collapsed);
  });
}

// One-time wiring: mark the header, inject a chevron, attach the toggle.
function initCollapsibles() {
  document.querySelectorAll('.card.collapsible').forEach(card => {
    if (!card.dataset.collapseWired) {
      card.dataset.collapseWired = '1';
      const header = card.firstElementChild;
      if (!header) return;
      header.classList.add('collapsible-header');
      if (!header.querySelector('.collapsible-chevron')) {
        const chev = document.createElement('span');
        chev.className = 'collapsible-chevron';
        chev.textContent = '▾';
        header.appendChild(chev);
      }
      header.addEventListener('click', () => {
        const now = card.classList.toggle('is-collapsed');
        try { localStorage.setItem(collapseKey(card), now ? '1' : '0'); } catch (e) {}
      });
    }
  });
  applyCollapsibleState();

  // Re-evaluate responsive defaults when the viewport crosses the phone breakpoint.
  if (!window.__collapsibleResizeBound) {
    window.__collapsibleResizeBound = true;
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(applyCollapsibleState, 150); });
  }
}
