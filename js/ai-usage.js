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

// Roll the log into totals + per-feature + per-day views. `days` limits it to
// the last N days (today included); leave it out for everything.
function aiUsageSummary(days) {
  const log = state.aiUsage || {};
  const since = days ? offsetDateStr(getTodayStr(), -(days - 1)) : '';
  const totals = { calls: 0, inTok: 0, outTok: 0, cost: 0 };
  const byFeature = {};
  const byDay = [];
  Object.keys(log).filter(d => d >= since).sort().reverse().forEach(date => {
    const day = log[date] || {};
    let dayCost = 0, dayCalls = 0;
    Object.keys(day).forEach(feature => {
      const s = day[feature];
      if (!s) return;
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

const AI_FEATURE_LABELS = { photo: 'Photo food logging', voice: 'Voice commands' };
// The colour each feature is drawn in: photos log food, voice is the other one.
const AI_FEATURE_COLOR = { photo: 'food', voice: 'water' };

// Settings, AI (spec 10.1): totals, by feature, by day. Reads only.
function renderAiUsageReport() {
  const host = document.getElementById('aiUsageReport');
  if (!host) return;
  const month = aiUsageSummary(30);
  let html;

  if (!aiUsageSummary().totals.calls) {
    html = '<div class="dl-card"><div class="dl-card-h"><span>Usage</span></div>' +
      '<p class="set-sub">No AI calls yet. Photo logging and voice show up here once you use them.</p></div>';
  } else {
    const top = Math.max.apply(null, Object.keys(month.byFeature).map(f => month.byFeature[f].cost).concat([0]));
    const features = Object.keys(month.byFeature).sort((a, b) => month.byFeature[b].cost - month.byFeature[a].cost).map(f => {
      const s = month.byFeature[f];
      return `<div class="set-ai-feat">
        <div><span>${esc(AI_FEATURE_LABELS[f] || f)}</span><b>${fmtUsd(s.cost)} · ${s.calls} call${s.calls === 1 ? '' : 's'}</b></div>
        <span class="dl-meter c-${AI_FEATURE_COLOR[f] || 'water'}"><i style="width:${top ? Math.round((s.cost / top) * 100) : 0}%"></i></span>
      </div>`;
    }).join('');

    // Fourteen calendar days, oldest first, so a quiet day is a visible stub
    // and not a missing column.
    const today = getTodayStr();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const date = offsetDateStr(today, -i);
      const hit = month.byDay.find(d => d.date === date);
      days.push({ date: date, cost: hit ? hit.cost : 0, calls: hit ? hit.calls : 0 });
    }
    const max = Math.max.apply(null, days.map(d => d.cost));
    const spent = days.reduce((a, d) => a + d.cost, 0);
    const best = days.reduce((a, d) => (d.cost > a.cost ? d : a), days[0]);
    const cols = days.map(d => `<div class="ins-col" title="${esc(formatDate(d.date))}: ${fmtUsd(d.cost)}, ${d.calls} call${d.calls === 1 ? '' : 's'}">` +
      `<span class="ins-bar${d.cost > 0 ? '' : ' is-zero'}" style="height:${max ? Math.max(4, Math.round((d.cost / max) * 100)) : 0}%"></span></div>`).join('');

    html = `
      <div class="dl-tiles set-ai-tiles">
        <div class="dl-tile"><b>${fmtUsd(month.totals.cost)}</b><span>last 30 days</span></div>
        <div class="dl-tile"><b>${month.totals.calls}</b><span>requests</span></div>
      </div>
      <div class="dl-card">
        <div class="dl-card-h"><span>By feature</span><em>30 days</em></div>
        ${features || '<p class="set-sub">Nothing in the last 30 days.</p>'}
      </div>
      <div class="dl-card">
        <div class="dl-card-h"><span>By day</span><em>14 days</em></div>
        <div class="ins-barwrap c-water" role="img" aria-label="Estimated cost per day, last 14 days: ${fmtUsd(spent)} in total${max ? ', most on ' + esc(formatDate(best.date)) + ' at ' + fmtUsd(best.cost) : ''}"><div class="ins-bars">${cols}</div></div>
        <div class="ins-axis"><span>${esc(formatDate(days[0].date))}</span><span>today</span></div>
        <div class="ins-stats"><span>total <b>${fmtUsd(spent)}</b></span>${max ? `<span>most <b>${fmtUsd(best.cost)}</b> on ${esc(formatDate(best.date))}</span>` : ''}</div>
      </div>
      <p class="set-note">An estimate from token counts, not your bill. The billed total is at console.anthropic.com, under Usage.</p>`;
  }
  if (host._html !== html) { host.innerHTML = html; host._html = html; }
}
