// The Diet tab's logging, redrawn in Daylign's own tokens (style.css :root — Space Grotesk / Inter,
// #0b0b10 / #14141d / #232330, accent #6d6af8, radius 16 / 10). Main = the leading direction at full
// fidelity; Board / Compose / Ledger = three other ways the same logging could work, drawn lighter.
// Run: node design/diet/gen.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));

const T = { bg: "#0b0b10", bg2: "#0f0f16", card: "#14141d", hover: "#1e1e2a", input: "#0b0b10", border: "#232330", text: "#f2f2f7", sec: "#a5a5bd", muted: "#8a8aa3", accent: "#6d6af8", accentH: "#8b8afc", glow: "rgba(109, 106, 248, 0.16)", green: "#34d399", greenBg: "rgba(52, 211, 153, 0.12)", yellow: "#fbbf24", red: "#f26d6d", blue: "#5aa5f9", P: "#6366f1", C: "#eab308", F: "#ef4444" };

const STYLE = `
    body { margin: 0; background: ${T.bg}; color: ${T.text}; font-family: "Inter", "Segoe UI", -apple-system, sans-serif; font-size: 14px; -webkit-font-smoothing: antialiased; }
    a { color: ${T.accentH}; } a:hover { color: ${T.text}; }
    .disp { font-family: "Space Grotesk", "Inter", "Segoe UI", sans-serif; }
    .tnum { font-variant-numeric: tabular-nums; }
    .card { background: ${T.card}; border: 1px solid ${T.border}; border-radius: 16px; }
    .nav { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: ${T.sec}; font-size: 14px; font-weight: 500; }
    .nav.on { background: ${T.glow}; color: ${T.accentH}; }
    .nav svg { width: 20px; height: 20px; }
    .label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: ${T.muted}; }
    .pill { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 5px 12px; border-radius: 999px; border: 1px solid ${T.accent}; background: rgba(109, 106, 248, .16); color: ${T.text}; font-size: 12.5px; font-weight: 650; white-space: nowrap; }
    .pill .n { padding: 1px 7px; border-radius: 999px; background: rgba(109, 106, 248, .22); color: ${T.sec}; font-size: 10.5px; font-weight: 700; }
    .pill.usual { min-height: 34px; padding: 7px 12px; background: ${T.glow}; color: ${T.accentH}; font-size: 12px; font-weight: 600; }
    .pill.ghost { background: transparent; border: 1px dashed ${T.border}; color: ${T.muted}; font-weight: 600; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) 56px 64px 52px 52px 52px 28px; align-items: center; gap: 8px; min-height: 42px; padding: 0 10px; border-radius: 10px; background: ${T.bg2}; }
    .row .nm { font-size: 13px; font-weight: 500; color: ${T.text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row .m { font-size: 12px; color: ${T.muted}; text-align: right; font-variant-numeric: tabular-nums; }
    .row .m.cal { color: ${T.sec}; font-weight: 600; }
    .row .sv { justify-self: end; font-size: 11px; font-weight: 700; color: ${T.accentH}; background: ${T.glow}; border: 1px solid ${T.accent}; border-radius: 999px; padding: 2px 9px; }
    .row .x { text-align: right; color: ${T.muted}; font-size: 14px; }
    .row.hd { background: transparent; min-height: 22px; }
    .row.hd .m, .row.hd .nm { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: ${T.muted}; }
    .row.ing { background: ${T.card}; margin-left: 12px; }
    .group { border: 1px solid ${T.border}; border-left: 3px solid ${T.accent}; border-radius: 10px; background: ${T.bg2}; overflow: hidden; }
    .ghead { display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 8px 12px; }
    .ghead .cnt { font-size: 10.5px; font-weight: 700; color: ${T.accent}; background: rgba(109, 106, 248, .16); padding: 2px 7px; border-radius: 999px; }
    .bar { height: 7px; border-radius: 4px; background: ${T.bg}; overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 4px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid ${T.border}; background: transparent; color: ${T.sec}; font-size: 12px; font-weight: 600; }
    .btn.primary { border-color: ${T.accentH}; background: linear-gradient(180deg, ${T.accentH}, ${T.accent}); color: #fff; }
    .ico { width: 16px; height: 16px; }
    .mealline { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; }
    .chev { width: 16px; height: 16px; flex: none; color: ${T.muted}; }
    .sketch { font-family: "Space Grotesk", sans-serif; }
    .wire { border: 1px dashed ${T.border}; border-radius: 10px; color: ${T.muted}; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .note { position: absolute; left: 28px; bottom: 22px; right: 28px; padding: 12px 14px; border-radius: 10px; background: ${T.bg2}; border: 1px solid ${T.border}; color: ${T.sec}; font-size: 12.5px; line-height: 1.5; }
    .note b { color: ${T.text}; }`;

const svg = (d, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  today: `<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>`,
  tasks: `<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>`,
  board: `<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18M15 3v18"></path>`,
  cal: `<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>`,
  train: `<path d="M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12"></path>`,
  diet: `<path d="M18 8h1a4 4 0 010 8h-1"></path><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"></path><path d="M6 1v3M10 1v3M14 1v3"></path>`,
  insights: `<path d="M3 3v18h18"></path><path d="M7 14l4-4 4 4 5-6"></path>`,
  settings: `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"></path>`,
  moon: `<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"></path>`,
  search: `<circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path>`,
  mic: `<rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0014 0M12 17v4M8 21h8"></path>`,
  cam: `<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"></path><circle cx="12" cy="13" r="4"></circle>`,
  chevD: `<polyline points="6,9 12,15 18,9"></polyline>`,
  chevR: `<polyline points="9,6 15,12 9,18"></polyline>`,
  plus: `<path d="M12 5v14M5 12h14"></path>`,
  edit: `<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path>`,
  drop: `<path d="M12 2.7l5.7 5.7a8 8 0 11-11.3 0z"></path>`,
  book: `<path d="M4 19.5A2.5 2.5 0 016.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"></path>`,
  spark: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path>`,
  check: `<polyline points="20,6 9,17 4,12"></polyline>`,
};

const sidebar = `
  <aside style="width: 260px; flex: none; background: ${T.bg2}; border-right: 1px solid ${T.border}; display: flex; flex-direction: column; padding: 18px 16px; gap: 6px;">
    <div class="disp" style="display: flex; align-items: center; gap: 12px; padding: 4px 10px 18px; font-size: 20px; font-weight: 700;"><span style="width: 32px; height: 32px; border-radius: 10px; background: ${T.accent}; display: inline-flex; align-items: center; justify-content: center;">${svg(`<path d="M6 8h12M6 12h12M6 16h8"></path>`)}</span>Daylign</div>
    <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 10px; border: 1px solid ${T.border}; border-radius: 12px; background: ${T.card};"><span style="width: 28px; height: 28px; border-radius: 50%; background: ${T.accent}; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">C</span><div><div style="font-size: 13px; font-weight: 600;">Chinmay</div><div style="font-size: 11px; color: ${T.muted};">Signed in</div></div></div>
    <div class="nav">${svg(I.today)}Today</div><div class="nav">${svg(I.tasks)}All Tasks</div><div class="nav">${svg(I.board)}Board</div><div class="nav">${svg(I.cal)}Calendar</div>
    <div style="height: 1px; background: ${T.border}; margin: 8px 6px;"></div>
    <div class="nav">${svg(I.train)}Training</div><div class="nav on">${svg(I.diet)}Diet</div>
    <div style="height: 1px; background: ${T.border}; margin: 8px 6px;"></div>
    <div class="nav">${svg(I.insights)}Insights</div><div class="nav">${svg(I.settings)}Settings</div><div class="nav">${svg(I.moon)}Light mode</div>
  </aside>`;
const header = (sub = "Thursday, September 10, 2026") => `
  <div style="display: flex; align-items: center; gap: 16px; padding: 22px 32px 14px;">
    <div><div class="disp" style="font-size: 28px; font-weight: 700; letter-spacing: -.01em; line-height: 1.1;">Diet</div><div style="margin-top: 4px; font-size: 13px; color: ${T.sec};">${sub}</div></div>
    <div style="margin-left: auto; display: flex; align-items: center; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 10px; width: 260px; height: 40px; padding: 0 14px; border-radius: 999px; background: ${T.card}; border: 1px solid ${T.border}; color: ${T.muted}; font-size: 13px;">${svg(I.search)}Search tasks…</div>
      <span style="display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: ${T.sec};"><i style="width: 8px; height: 8px; border-radius: 50%; background: ${T.green};"></i>Synced</span>
      <span class="btn primary" style="min-height: 40px; padding: 0 18px; font-size: 13px;">${svg(I.book)}Food Library</span>
    </div>
  </div>`;

const shell = (title, body, h = 900) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Space+Grotesk:wght@500;600;700&amp;display=swap">
  <style>${STYLE}
  </style>
</helmet>
<div style="width: 1440px; height: ${h}px; background: ${T.bg}; display: flex; overflow: hidden; position: relative;">${sidebar}
  <main style="flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;">${header()}${body}</main>
</div>
</x-dc>
</body>
</html>
`;

// ---- pieces ----
const ring = (pct, size, num, sub, left) => `<div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: conic-gradient(${T.accent} 0 ${pct}%, ${T.border} ${pct}% 100%); display: flex; align-items: center; justify-content: center; flex: none;"><div style="width: ${size - 18}px; height: ${size - 18}px; border-radius: 50%; background: ${T.card}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;"><span class="disp tnum" style="font-size: ${Math.round(size / 5.2)}px; font-weight: 700; line-height: 1;">${num}</span><span style="font-size: 11px; color: ${T.muted};">${sub}</span><span class="tnum" style="font-size: 11.5px; font-weight: 600; color: ${T.green};">${left}</span></div></div>`;
const macro = (label, cur, goal, color) => { const pct = Math.min(100, Math.round((cur / goal) * 100)); return `<div style="display: flex; flex-direction: column; gap: 7px;"><div style="display: flex; align-items: baseline; justify-content: space-between;"><span class="label">${label}</span><span class="tnum" style="font-size: 12.5px; color: ${T.sec};"><b style="color: ${T.text}; font-size: 15px;">${cur}</b> / ${goal}g <span style="color: ${color}; font-weight: 600; margin-left: 6px;">${Math.max(0, goal - cur)} left</span></span></div><div class="bar"><i style="width: ${pct}%; background: ${color};"></i></div></div>`; };
const dayStrip = (compact = false) => `
  <div class="card" style="padding: ${compact ? "10px 14px" : "12px 14px 10px"}; display: flex; align-items: center; gap: 14px;">
    <span class="btn" style="width: 36px; padding: 0;">${svg(I.chevR, "ico").replace("<svg", "<svg style=\"transform: rotate(180deg)\"")}</span>
    <span class="disp" style="font-size: 16px; font-weight: 700;">Today</span>
    <span class="btn" style="width: 36px; padding: 0;">${svg(I.chevR)}</span>
    <div style="margin-left: auto; display: grid; grid-template-columns: repeat(7, 44px); gap: 4px;">
      ${["M", "T", "W", "T", "F", "S", "S"].map((d, i) => { const st = i < 3 ? "hit" : i === 3 ? "now" : "future"; const ringBg = st === "hit" ? `conic-gradient(${T.green} 0 100%, ${T.green} 100%)` : st === "now" ? `conic-gradient(${T.accent} 0 70%, ${T.border} 70% 100%)` : "none"; return `<div style="display: flex; flex-direction: column; align-items: center; gap: 7px; min-height: 44px; padding: 6px 2px; border-radius: 10px; ${st === "now" ? `background: ${T.hover};` : ""}"><span style="font-size: 11px; font-weight: 700; color: ${T.muted};">${d}</span><span style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid ${st === "future" ? T.border : "transparent"}; background: ${ringBg}; opacity: ${st === "future" ? .5 : 1}; display: inline-flex; align-items: center; justify-content: center; color: #0b0b10;">${st === "hit" ? svg(I.check, "ico").replace("class=\"ico\"", "style=\"width: 12px; height: 12px; stroke-width: 3\"") : ""}</span></div>`; }).join("")}
    </div>
    <span class="btn" style="margin-left: 6px;">Today</span>
  </div>`;

const entry = (nm, sv, cal, p, c, f, cls = "") => `<div class="row ${cls}"><span class="nm">${nm}</span><span class="sv">${sv}×</span><span class="m cal">${cal}</span><span class="m">${p}</span><span class="m">${c}</span><span class="m">${f}</span><span class="x">×</span></div>`;
const cols = `<div class="row hd"><span class="nm">food</span><span></span><span class="m">cal</span><span class="m">P</span><span class="m">C</span><span class="m">F</span><span></span></div>`;

// ---- Main: log first — the meal you are in is open at the top, one bar logs by typing, voice or photo; the numbers live in a rail ----
const mainBody = `
  <div style="flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; padding: 6px 32px 28px; overflow: hidden;">
    <div style="display: flex; flex-direction: column; gap: 14px; min-width: 0;">
      ${dayStrip()}
      <div class="card" style="padding: 18px 20px 16px; display: flex; flex-direction: column; gap: 12px; border-color: rgba(109, 106, 248, .45);">
        <div style="display: flex; align-items: baseline; gap: 12px;">
          <span class="disp" style="font-size: 20px; font-weight: 700;">Dinner</span>
          <span style="font-size: 12px; font-weight: 600; color: ${T.accentH}; background: ${T.glow}; border-radius: 999px; padding: 3px 9px;">now</span>
          <span class="tnum" style="margin-left: auto; font-size: 13px; color: ${T.sec};"><b style="color: ${T.text}; font-size: 15px;">542</b> cal &nbsp;·&nbsp; 16g P &nbsp; 44g C &nbsp; 42g F</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 8px 0 16px; border-radius: 12px; background: ${T.input}; border: 1px solid ${T.accent}; box-shadow: 0 0 0 3px ${T.glow};">
          ${svg(I.search)}<span style="flex: 1; font-size: 14px; color: ${T.muted};">Log to dinner — type it, say it, or snap it</span>
          <span class="btn" style="width: 36px; min-height: 34px; padding: 0; border-color: transparent;">${svg(I.mic)}</span><span class="btn" style="width: 36px; min-height: 34px; padding: 0; border-color: transparent;">${svg(I.cam)}</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          <span class="pill">Ground Chicken Smash Burger <span class="n">418</span></span><span class="pill">Spicy Thousand Island <span class="n">124</span></span>
          <span class="pill usual">chicken 65</span><span class="pill usual">onion</span><span class="pill usual">Sourdough Bread</span><span class="pill usual">Original Taste (Coca Cola, Coke)</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
          ${cols}
          <div class="group">
            <div class="ghead">${svg(I.chevD)}<span style="flex: 1; font-size: 14px; font-weight: 650;">Ground Chicken Smash Burger</span><span class="cnt">7</span><span class="tnum" style="font-size: 13px; font-weight: 650;">418 cal</span><span style="color: ${T.muted}; margin-left: 6px;">×</span></div>
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 0 8px 8px;">
              ${entry("lettuce", 1, 5, 1, 1, 0, "ing")}${entry("tomato", 1, 22, 1, 5, 0, "ing")}${entry("onion", 1, 44, 1, 10, 0, "ing")}${entry("jalapeno", 1, 4, 0, 1, 0, "ing")}${entry("cheese", 1, 113, 7, 0, 9, "ing")}
              <div class="row ing" style="outline: 1px solid ${T.accent}; background: ${T.hover};"><span class="nm">ground chicken patty</span><span class="sv">1×</span><span class="m cal" style="color: ${T.accentH};">190</span><span class="m" style="color: ${T.accentH};">22</span><span class="m">0</span><span class="m" style="color: ${T.accentH};">11</span><span class="x" style="color: ${T.accentH};">${svg(I.edit)}</span></div>
              ${entry("Burger Buns", 1, 120, 4, 22, 2, "ing")}
              <span class="pill ghost" style="align-self: flex-start; margin: 4px 0 0 12px;">${svg(I.plus)}Add ingredient</span>
            </div>
          </div>
          ${entry("Spicy Thousand Island", 1, 124, 0, 5, 11)}
        </div>
      </div>
      <div class="card" style="display: flex; flex-direction: column;">
        <div class="mealline" style="border-bottom: 1px solid ${T.border};">${svg(I.chevR, "chev")}<span class="disp" style="font-size: 15px; font-weight: 700; width: 92px;">Breakfast</span><span style="flex: 1; font-size: 13px; color: ${T.sec}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Bread Omlete · Original Taste (Coca Cola, Coke)</span><span class="tnum" style="font-size: 13px; font-weight: 600;">435 <span style="color: ${T.muted}; font-weight: 500;">cal</span></span></div>
        <div class="mealline" style="border-bottom: 1px solid ${T.border};">${svg(I.chevR, "chev")}<span class="disp" style="font-size: 15px; font-weight: 700; width: 92px;">Lunch</span><span style="flex: 1; font-size: 13px; color: ${T.sec}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">PB + banana protein shake. · chicken 65 · Sourdough Bread</span><span class="tnum" style="font-size: 13px; font-weight: 600;">486 <span style="color: ${T.muted}; font-weight: 500;">cal</span></span></div>
        <div class="mealline">${svg(I.chevR, "chev")}<span class="disp" style="font-size: 15px; font-weight: 700; width: 92px; color: ${T.muted};">Snack</span><span style="flex: 1; font-size: 13px; color: ${T.muted};">nothing yet</span><span class="btn" style="min-height: 32px; padding: 0 12px;">${svg(I.plus)}Add</span></div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 14px; min-width: 0;">
      <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between;"><span class="disp" style="font-size: 17px; font-weight: 700;">Today</span><span class="btn" style="min-height: 30px; padding: 0 12px;">${svg(I.settings)}Goals</span></div>
        <div style="display: flex; justify-content: center;">${ring(70, 150, "1,463", "of 2,100 cal", "637 left")}</div>
        ${macro("Protein", 96, 160, T.P)}${macro("Carbs", 118, 210, T.C)}${macro("Fat", 62, 70, T.F)}
        <div style="font-size: 12.5px; color: ${T.sec}; background: ${T.bg2}; border: 1px solid ${T.border}; border-radius: 10px; padding: 10px 12px; line-height: 1.5;">64g protein to go — dinner did most of the fat already, so a lean protein and not much else.</div>
      </div>
      <div class="card" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between;"><span style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;">${svg(I.drop)}Water</span><span class="tnum" style="font-size: 12.5px; color: ${T.sec};">32 / 66 oz</span></div>
        <div class="bar"><i style="width: 48%; background: ${T.blue};"></i></div>
        <div style="display: flex; gap: 6px;"><span class="btn" style="flex: 1;">+8</span><span class="btn" style="flex: 1;">+12</span><span class="btn" style="flex: 1;">+16</span><span class="btn" style="flex: 1;">+20</span></div>
      </div>
      <div class="card" style="padding: 14px 20px; display: flex; align-items: center; gap: 10px; color: ${T.sec}; font-size: 12.5px;">${svg(I.chevR, "chev")}Yesterday: skip the soda, shrink the rice</div>
    </div>
  </div>`;

// ---- Board: four meals side by side, each with its own chips and its own numbers ----
const col = (name, cal, chips, items, now) => `
  <div class="card" style="display: flex; flex-direction: column; gap: 10px; padding: 14px; ${now ? `border-color: rgba(109, 106, 248, .45);` : ""}">
    <div style="display: flex; align-items: baseline; gap: 8px;"><span class="disp" style="font-size: 16px; font-weight: 700;">${name}</span>${now ? `<span style="font-size: 11px; font-weight: 600; color: ${T.accentH}; background: ${T.glow}; border-radius: 999px; padding: 2px 8px;">now</span>` : ""}<span class="tnum" style="margin-left: auto; font-size: 13px; font-weight: 600; color: ${T.sec};">${cal}</span></div>
    <div style="display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 10px; background: ${T.input}; border: 1px solid ${T.border}; color: ${T.muted}; font-size: 12.5px;">${svg(I.plus)}Add…</div>
    <div style="display: flex; flex-wrap: wrap; gap: 5px;">${chips.map((c) => `<span class="pill usual" style="min-height: 30px; padding: 5px 10px; font-size: 11.5px;">${c}</span>`).join("")}</div>
    <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 6px;">${items.map(([n, k]) => `<div style="display: flex; justify-content: space-between; gap: 8px; min-height: 38px; align-items: center; padding: 0 10px; border-radius: 10px; background: ${T.bg2}; font-size: 12.5px;"><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${n}</span><span class="tnum" style="color: ${T.muted}; flex: none;">${k}</span></div>`).join("")}</div>
  </div>`;
const boardBody = `
  <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; padding: 6px 32px 28px;">
    <div class="card" style="display: flex; align-items: center; gap: 28px; padding: 12px 20px;">
      <span class="disp" style="font-size: 16px; font-weight: 700;">Today</span>
      <span class="tnum" style="font-size: 13px; color: ${T.sec};"><b style="color: ${T.text}; font-size: 18px;">1,463</b> / 2,100 cal · <span style="color: ${T.green}; font-weight: 600;">637 left</span></span>
      <div style="flex: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">${[["P", 96, 160, T.P], ["C", 118, 210, T.C], ["F", 62, 70, T.F]].map(([l, a, b, c]) => `<div style="display: flex; align-items: center; gap: 8px;"><span class="label" style="width: 14px;">${l}</span><div class="bar" style="flex: 1;"><i style="width: ${Math.round((a / b) * 100)}%; background: ${c};"></i></div><span class="tnum" style="font-size: 12px; color: ${T.sec}; width: 64px; text-align: right;">${a} / ${b}</span></div>`).join("")}</div>
      <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: ${T.sec};">${svg(I.drop)}32 / 66 oz</span>
    </div>
    <div style="flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px;">
      ${col("Breakfast", "435 cal", ["Bread Omlete", "3 boiled eggs", "PB + banana shake"], [["Bread Omlete", "435"]], false)}
      ${col("Lunch", "486 cal", ["chicken 65", "Sourdough Bread", "PB + banana shake"], [["PB + banana protein shake.", "354"], ["chicken 65", "132"]], false)}
      ${col("Dinner", "542 cal", ["Smash Burger · 418", "Thousand Island · 124", "Soya chunk curry"], [["Ground Chicken Smash Burger · 7", "418"], ["Spicy Thousand Island", "124"]], true)}
      ${col("Snack", "0 cal", ["Greek yogurt", "Coke Zero", "banana"], [], false)}
    </div>
    <div class="note"><b>Board.</b> All four meals at once, each column its own little logger, so a whole day is planned or logged in one screen. Tradeoff: needs the width — it only works on the desktop, the phone gets one column at a time.</div>
  </div>`;

// ---- Compose: the log is a timeline; one line at the bottom logs anything — typed, spoken or photographed — with a confirm card ----
const composeBody = `
  <div style="flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; padding: 6px 32px 28px;">
    <div style="display: flex; flex-direction: column; min-width: 0;">
      <div class="card" style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 8px 20px 0; overflow: hidden;">
        ${[["8:10", "Breakfast", ["Bread Omlete · 435"]], ["12:40", "Lunch", ["PB + banana protein shake. · 354", "chicken 65 · 132"]], ["19:05", "Dinner", ["Ground Chicken Smash Burger · 418", "Spicy Thousand Island · 124"]]].map(([t, m, xs]) => `
        <div style="display: grid; grid-template-columns: 64px 24px minmax(0, 1fr); gap: 0 12px; padding: 14px 0;">
          <span class="tnum" style="font-size: 12.5px; color: ${T.muted}; padding-top: 4px;">${t}</span>
          <span style="display: flex; flex-direction: column; align-items: center;"><i style="width: 10px; height: 10px; border-radius: 50%; background: ${T.accent}; margin-top: 6px;"></i><i style="flex: 1; width: 2px; background: ${T.border}; margin-top: 6px;"></i></span>
          <div><div class="disp" style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">${m}</div><div style="display: flex; flex-direction: column; gap: 5px;">${xs.map((x) => `<div style="display: flex; justify-content: space-between; min-height: 38px; align-items: center; padding: 0 12px; border-radius: 10px; background: ${T.bg2}; font-size: 13px;"><span>${x.split(" · ")[0]}</span><span class="tnum" style="color: ${T.muted};">${x.split(" · ")[1]} cal</span></div>`).join("")}</div></div>
        </div>`).join("")}
        <div style="margin-top: auto; padding: 12px 0 16px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 12px; background: ${T.bg2}; border: 1px solid ${T.accent};">
            ${svg(I.spark)}
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 13px; font-weight: 600;">2 eggs, 1 toast with butter — for dinner?</span><span class="tnum" style="font-size: 12px; color: ${T.muted};">≈ 300 cal · 16g P · 16g C · 19g F &nbsp;·&nbsp; 3 items, tap any to fix</span></div>
            <span class="btn">Edit</span><span class="btn primary">Log it</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 8px 0 18px; border-radius: 999px; background: ${T.input}; border: 1px solid ${T.border};">
            <span style="flex: 1; font-size: 14px; color: ${T.muted};">What did you eat?</span>
            <span class="btn" style="width: 40px; min-height: 38px; padding: 0; border-color: transparent;">${svg(I.mic)}</span><span class="btn" style="width: 40px; min-height: 38px; padding: 0; border-color: transparent;">${svg(I.cam)}</span>
          </div>
        </div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 18px; align-items: stretch;"><div style="display: flex; justify-content: center;">${ring(70, 140, "1,463", "of 2,100 cal", "637 left")}</div>${macro("Protein", 96, 160, T.P)}${macro("Carbs", 118, 210, T.C)}${macro("Fat", 62, 70, T.F)}</div>
      <div class="note" style="position: static;"><b>Compose.</b> One line at the bottom, like a message: type "2 eggs and toast", say it, or snap it — the app reads it into a card you confirm. The log reads as the day's timeline. Tradeoff: two steps for anything the app has to interpret, and it leans on the AI key.</div>
    </div>
  </div>`;

// ---- Ledger: the day as one dense table, every number a click away from being fixed ----
const lrow = (nm, sv, cal, p, c, f, opts = {}) => `<div style="display: grid; grid-template-columns: minmax(0, 1fr) 60px 70px 60px 60px 60px 60px; align-items: center; min-height: 34px; padding: 0 12px; border-bottom: 1px solid ${T.border}; font-size: 13px; ${opts.sub ? `background: ${T.bg2}; font-weight: 600;` : ""}"><span style="${opts.sub ? "" : "padding-left: 14px;"} overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nm}</span><span class="tnum" style="text-align: right; color: ${T.muted};">${sv}</span>${[cal, p, c, f].map((v, i) => opts.editing && i === 1 ? `<span style="display: flex; justify-content: flex-end;"><span style="width: 52px; height: 26px; border-radius: 6px; border: 1px solid ${T.accent}; box-shadow: 0 0 0 3px ${T.glow}; background: ${T.input}; display: inline-flex; align-items: center; justify-content: flex-end; padding: 0 6px; color: ${T.text}; font-weight: 600;">${v}</span></span>` : `<span class="tnum" style="text-align: right; color: ${opts.sub ? T.text : T.sec};">${v}</span>`).join("")}<span style="text-align: right; color: ${T.muted};">${opts.sub ? "" : "×"}</span></div>`;
const ledgerBody = `
  <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; padding: 6px 32px 28px;">
    <div class="card" style="display: flex; align-items: center; gap: 28px; padding: 12px 20px;">
      <span class="disp" style="font-size: 16px; font-weight: 700;">Today</span>
      <span class="tnum" style="font-size: 13px; color: ${T.sec};"><b style="color: ${T.text}; font-size: 18px;">1,463</b> / 2,100 cal · <span style="color: ${T.green}; font-weight: 600;">637 left</span></span>
      <div style="flex: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">${[["P", 96, 160, T.P], ["C", 118, 210, T.C], ["F", 62, 70, T.F]].map(([l, a, b, c]) => `<div style="display: flex; align-items: center; gap: 8px;"><span class="label" style="width: 14px;">${l}</span><div class="bar" style="flex: 1;"><i style="width: ${Math.round((a / b) * 100)}%; background: ${c};"></i></div><span class="tnum" style="font-size: 12px; color: ${T.sec}; width: 64px; text-align: right;">${a} / ${b}</span></div>`).join("")}</div>
      <div style="display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 999px; background: ${T.input}; border: 1px solid ${T.border}; color: ${T.muted}; font-size: 12.5px; width: 220px;">${svg(I.plus)}Add to dinner…</div>
    </div>
    <div class="card" style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: grid; grid-template-columns: minmax(0, 1fr) 60px 70px 60px 60px 60px 60px; padding: 10px 12px; border-bottom: 1px solid ${T.border};" class="label"><span>food</span><span style="text-align: right;">serv</span><span style="text-align: right;">cal</span><span style="text-align: right;">P</span><span style="text-align: right;">C</span><span style="text-align: right;">F</span><span></span></div>
      ${lrow("Breakfast", "", 435, 22, 38, 20, { sub: true })}${lrow("Bread Omlete", "1×", 435, 22, 38, 20)}
      ${lrow("Lunch", "", 486, 41, 44, 14, { sub: true })}${lrow("PB + banana protein shake.", "1×", 354, 32, 36, 9)}${lrow("chicken 65", "1×", 132, 9, 8, 5)}
      ${lrow("Dinner", "", 542, 33, 44, 42, { sub: true })}${lrow("Ground Chicken Smash Burger", "7 items", 418, 33, 39, 31)}${lrow("· ground chicken patty", "1×", 190, 22, 0, 11, { editing: true })}${lrow("· cheese", "1×", 113, 7, 0, 9)}${lrow("· Burger Buns", "1×", 120, 4, 22, 2)}${lrow("Spicy Thousand Island", "1×", 124, 0, 5, 11)}
      ${lrow("Snack", "", 0, 0, 0, 0, { sub: true })}
      <div style="margin-top: auto; display: grid; grid-template-columns: minmax(0, 1fr) 60px 70px 60px 60px 60px 60px; align-items: center; min-height: 40px; padding: 0 12px; border-top: 1px solid ${T.border}; font-size: 13px; font-weight: 700;"><span>Day</span><span></span><span class="tnum" style="text-align: right;">1,463</span><span class="tnum" style="text-align: right;">96</span><span class="tnum" style="text-align: right;">126</span><span class="tnum" style="text-align: right;">76</span><span></span></div>
    </div>
    <div class="note" style="position: static;"><b>Ledger.</b> The day as one table: every number is a click from being fixed (the patty's protein is being typed here), Tab moves along the row, the meal subtotals and the day total sit in the same columns. Tradeoff: it is a spreadsheet — fast for someone who checks numbers, cold for someone who just wants to tap what they ate.</div>
  </div>`;

writeFileSync(join(HERE, "Main.dc.html"), shell("Main", mainBody, 1180));
writeFileSync(join(HERE, "Board.dc.html"), shell("Board", boardBody));
writeFileSync(join(HERE, "Compose.dc.html"), shell("Compose", composeBody));
writeFileSync(join(HERE, "Ledger.dc.html"), shell("Ledger", ledgerBody));
writeFileSync(join(HERE, "canvas.json"), JSON.stringify({
  artboards: [
    { file: "Main.dc.html", title: "Log first · the meal you are in, open at the top", x: 0, y: 0, w: 1440, h: 1180 },
    { file: "Board.dc.html", title: "Direction · Board", x: 1540, y: 0, w: 1440, h: 900 },
    { file: "Compose.dc.html", title: "Direction · Compose", x: 0, y: 1320, w: 1440, h: 900 },
    { file: "Ledger.dc.html", title: "Direction · Ledger", x: 1540, y: 1320, w: 1440, h: 900 },
  ],
  annotations: [
    { id: "brief", x: 0, y: -190, w: 900, text: "What is wrong today: the log is at the bottom of one tall card, under the ring, the bars, the advice and the water — logging is the reason you open the tab and it is the last thing on it. Rows say \"5 cal 1g P 1g C 0g F\" in a run of text you cannot scan, and fixing a wrong number took a detour until last night.\n\nLog first (top left): the meal you are in right now is open at the top with ONE bar that logs by typing, voice or photo, its usuals and saved meals under the bar, and the rows in columns you can scan. The other meals fold to one line each. The day's numbers move to a rail on the right so they never push the log down.\n\nThree other ways beside it: Board (all four meals at once), Compose (a message line + confirm card, the log as a timeline), Ledger (a spreadsheet). Pick one, or mix." },
  ],
  launch: { view: "canvas" },
}, null, 2));
console.log("wrote Main, Board, Compose, Ledger, canvas.json");
