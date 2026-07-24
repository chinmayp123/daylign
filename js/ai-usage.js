// ========== AI usage tracking ==========
// Daylign calls Anthropic directly from the browser for photo food logging and
// voice commands. Anthropic does not return your account's billed spend in the
// API response, so this can't show real dollars — but every response DOES carry
// usage.input_tokens / output_tokens, so we can count calls, sum tokens, and
// estimate cost from the model's public rate. For the authoritative billed
// total, console.anthropic.com → Usage is always the source of truth.
//
// Stored aggregated by day + feature so it stays compact and syncs with the
// rest of the profile:
//   state.aiUsage = { '<date>': { photo: {calls,inTok,outTok}, voice: {...} } }

// Public per-1M-token rates (USD). Keep in sync with the models the two
// features use (see FOOD_PHOTO_MODEL / VOICE_MODEL).
const AI_MODEL_RATES = {
  'claude-opus-4-8':  { in: 5.00, out: 25.00 },
  'claude-sonnet-5':  { in: 3.00, out: 15.00 },
  'claude-haiku-4-5': { in: 1.00, out: 5.00 },
};

function aiRateFor(model) {
  return AI_MODEL_RATES[model] || AI_MODEL_RATES['claude-opus-4-8'];
}

function estimateAiCost(inTok, outTok, model) {
  const r = aiRateFor(model);
  return (inTok / 1e6) * r.in + (outTok / 1e6) * r.out;
}

// Record one call. `usage` is the Anthropic response's usage object.
function logAiCall(feature, model, usage) {
  if (!usage) return;
  const inTok = Number(usage.input_tokens) || 0;
  const outTok = Number(usage.output_tokens) || 0;
  const cacheRead = Number(usage.cache_read_input_tokens) || 0;
  const cacheWrite = Number(usage.cache_creation_input_tokens) || 0;
  const today = getTodayStr();
  if (!state.aiUsage || typeof state.aiUsage !== 'object') state.aiUsage = {};
  if (!state.aiUsage[today]) state.aiUsage[today] = {};
  const slot = state.aiUsage[today][feature] || { calls: 0, inTok: 0, outTok: 0, model: model };
  slot.calls += 1;
  // Cache reads/writes are billed differently, but for a personal estimate
  // folding them into input tokens is close enough and keeps the model simple.
  slot.inTok += inTok + cacheRead + cacheWrite;
  slot.outTok += outTok;
  slot.model = model;
  state.aiUsage[today][feature] = slot;
  if (typeof saveData === 'function') saveData(state);
  if (typeof renderAiUsageReport === 'function') renderAiUsageReport();
}

// Roll the whole log into totals + per-feature + per-day views.
function aiUsageSummary() {
  const log = state.aiUsage || {};
  const totals = { calls: 0, inTok: 0, outTok: 0, cost: 0 };
  const byFeature = {};
  const byDay = [];
  Object.keys(log).sort().reverse().forEach(date => {
    const day = log[date];
    let dayCost = 0, dayCalls = 0;
    Object.keys(day).forEach(feature => {
      const s = day[feature];
      const cost = estimateAiCost(s.inTok, s.outTok, s.model);
      totals.calls += s.calls; totals.inTok += s.inTok; totals.outTok += s.outTok; totals.cost += cost;
      dayCost += cost; dayCalls += s.calls;
      if (!byFeature[feature]) byFeature[feature] = { calls: 0, inTok: 0, outTok: 0, cost: 0, model: s.model };
      byFeature[feature].calls += s.calls;
      byFeature[feature].inTok += s.inTok;
      byFeature[feature].outTok += s.outTok;
      byFeature[feature].cost += cost;
    });
    byDay.push({ date, calls: dayCalls, cost: dayCost });
  });
  return { totals, byFeature, byDay };
}

function fmtUsd(n) {
  if (n < 0.01 && n > 0) return '<$0.01';
  return '$' + n.toFixed(2);
}
function fmtTok(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

const AI_FEATURE_LABELS = { photo: '📷 Photo logging', voice: '🎙️ Voice commands' };

function renderAiUsageReport() {
  const host = document.getElementById('aiUsageReport');
  if (!host) return;
  const { totals, byFeature, byDay } = aiUsageSummary();

  if (!totals.calls) {
    host.innerHTML = '<p class="ai-usage-empty">No AI calls yet. Photo logging and voice commands will show up here once you use them.</p>';
    return;
  }

  const featureRows = Object.keys(byFeature).map(f => {
    const s = byFeature[f];
    return `<div class="ai-usage-frow">
      <span class="ai-usage-fname">${AI_FEATURE_LABELS[f] || f}</span>
      <span class="ai-usage-fcalls">${s.calls} call${s.calls === 1 ? '' : 's'}</span>
      <span class="ai-usage-ftok">${fmtTok(s.inTok)} in · ${fmtTok(s.outTok)} out</span>
      <span class="ai-usage-fcost">${fmtUsd(s.cost)}</span>
    </div>`;
  }).join('');

  const dayRows = byDay.slice(0, 14).map(d => `
    <div class="ai-usage-drow">
      <span>${formatDate(d.date)}</span>
      <span>${d.calls} call${d.calls === 1 ? '' : 's'}</span>
      <span>${fmtUsd(d.cost)}</span>
    </div>`).join('');

  host.innerHTML = `
    <div class="ai-usage-totals">
      <div class="ai-usage-total">
        <span class="ai-usage-total-val">${totals.calls}</span>
        <span class="ai-usage-total-lbl">calls</span>
      </div>
      <div class="ai-usage-total">
        <span class="ai-usage-total-val">${fmtTok(totals.inTok + totals.outTok)}</span>
        <span class="ai-usage-total-lbl">tokens</span>
      </div>
      <div class="ai-usage-total">
        <span class="ai-usage-total-val">${fmtUsd(totals.cost)}</span>
        <span class="ai-usage-total-lbl">est. cost</span>
      </div>
    </div>
    <div class="ai-usage-section-label">By feature</div>
    <div class="ai-usage-features">${featureRows}</div>
    <div class="ai-usage-section-label">By day</div>
    <div class="ai-usage-days">${dayRows}</div>
    <p class="ai-usage-note">Estimated from token usage × each model's public rate. For your actual billed total, see console.anthropic.com → Usage.</p>`;
}
