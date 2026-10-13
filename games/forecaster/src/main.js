import * as F from './forecast.js';

const $ = (id) => document.getElementById(id);
const KEY = 'forecaster.save.v1';
const GLYPH = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '🌨️' };
const WINDG = { calm: 'calm', breezy: 'breezy', windy: 'windy' };
const TOWN = 'Millbrook';

let state = loadGame();
let tab = 'desk';
let pred = { condition: null, temp: null, wind: null };
let lastResult = null;

function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) return s;
    }
  } catch {
    // new game
  }
  return F.newGame();
}
function saveGame() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
function toast(text, cls = '') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.textContent = text;
  $('toasts').append(t);
  setTimeout(() => t.remove(), 2700);
}

function renderTop() {
  $('t-points').textContent = `${state.points} pts`;
  $('t-streak').textContent = '☀'.repeat(state.streak) + '○'.repeat(Math.max(0, F.WIN_STREAK - state.streak));
  $('t-day').textContent = `Day ${state.day} · ${F.seasonName(state.dyn.day)}`;
}

function datum(k, v, extra = '') { return `<div class="datum ${extra}"><div class="k">${k}</div><div class="v">${v}</div></div>`; }
function locked(k, name) { return `<div class="datum locked"><div class="k">${k}</div><div class="v small">needs ${name}</div></div>`; }

function renderDesk() {
  const o = F.observations(state);
  if (pred.temp === null) pred.temp = o.temp;
  let html = `<div class="sky ${o.condition}"><div class="glyph">${GLYPH[o.condition]}</div><div><div class="big">${o.temp}°${o.tempCoarse ? ' <span class="meta">(about)</span>' : ''}</div><div class="meta">Today in ${TOWN}: ${o.condition}, wind from the ${o.windDir}${o.wind ? `, ${o.wind}` : ''}. ${o.season[0].toUpperCase()}${o.season.slice(1)}.</div></div></div>`;
  html += `<div class="data">`;
  html += o.normal !== undefined ? datum('Usual for the date', `${o.normal}°`) : locked('Usual for the date', 'the almanac');
  html += o.pressureTrend ? datum('Barometer', o.pressure !== undefined ? `${o.pressure} hPa, ${o.pressureChange > 0 ? '+' : ''}${o.pressureChange} in 24h` : o.pressureTrend) : locked('Barometer', 'a barometer');
  html += o.humidity !== undefined ? datum('Humidity', `${o.humidity}%`) : locked('Humidity', 'a hygrometer');
  html += o.wind ? datum('Wind', `${o.wind} from the ${o.windDir}`) : datum('Wind', `from the ${o.windDir}`, '');
  html += o.upwind1 ? datum('One day upwind', `${GLYPH[o.upwind1.condition]} ${o.upwind1.temp}°, ${o.upwind1.wind}`) : locked('One day upwind', 'neighbour reports');
  html += o.upwind2 ? datum('Two days upwind', `${GLYPH[o.upwind2.condition]} ${o.upwind2.temp}°, ${o.upwind2.wind}`) : locked('Two days upwind', 'neighbour reports II');
  html += o.front !== undefined ? datum('Next weather system', o.front) : locked('Next weather system', 'the satellite feed');
  html += o.radar !== undefined ? datum('Radar', o.radar) : locked('Radar', 'a radar');
  html += o.model ? datum('Computer model says', `${GLYPH[o.model.condition]} ${o.model.condition}, ${o.model.temp}°, ${o.model.wind} <span class="muted small">(${Math.round(o.model.skill * 100)}% skill)</span>`, 'wide2 model') : locked('Computer model', 'a computer model');
  html += `</div>`;

  html += `<div class="card form"><h2 style="margin-top:0">Tomorrow’s forecast <span class="sub">condition 50 · temp 30 · wind 20</span></h2>
    <div class="seg">${F.CONDITIONS.map((c) => `<button data-cond="${c}" class="${pred.condition === c ? 'on' : ''}">${GLYPH[c]}<br>${c}</button>`).join('')}</div>
    <div class="muted small" style="text-align:center">High temperature (within 1° for full marks)</div>
    <div class="stepper"><button data-temp="-1">−</button><div class="val">${pred.temp}°</div><button data-temp="1">+</button></div>
    <div class="seg three">${F.WINDS.map((w) => `<button data-wind="${w}" class="${pred.wind === w ? 'on' : ''}">${WINDG[w]}</button>`).join('')}</div>
    <button class="btn gold wide" data-act="submit" ${pred.condition && pred.wind ? '' : 'disabled'}>Submit forecast</button></div>`;

  if (lastResult) {
    const r = lastResult;
    html += `<div class="card result"><div class="total ${r.score.total === 100 ? 'ok' : ''}">${r.score.total === 100 ? '☀ Perfect day! ' : ''}${r.score.total} / 100</div>
      <div class="line ${r.score.cond ? 'ok' : 'bad'}"><span>Condition: ${GLYPH[r.actual.condition]} ${r.actual.condition}</span><span>${r.score.cond ? '+50' : `you said ${r.prediction.condition}`}</span></div>
      <div class="line ${r.score.temp === 30 ? 'ok' : r.score.temp ? 'part' : 'bad'}"><span>High: ${r.actual.temp}°</span><span>${r.score.temp ? `+${r.score.temp}` : ''} (you said ${r.prediction.temp}°, off by ${r.score.dt})</span></div>
      <div class="line ${r.score.wind ? 'ok' : 'bad'}"><span>Wind: ${r.actual.wind}</span><span>${r.score.wind ? '+20' : `you said ${r.prediction.wind}`}</span></div>
      <div class="suns">${Array.from({ length: F.WIN_STREAK }, (_, i) => `<span class="${i < state.streak ? 'on' : ''}">☀</span>`).join('')}</div>
      <div class="muted small" style="text-align:center">${state.streak ? `${state.streak} perfect in a row. ${F.WIN_STREAK - state.streak} to go.` : 'Five perfect days in a row wins. Best streak: ' + state.bestStreak + '.'}</div></div>`;
  } else {
    html += `<div class="card small muted" style="margin-top:10px">Read what you have, make your call, and learn from the record. Better instruments are in the shop; a perfect day scores 100 and five in a row makes you Forecaster of the Year.</div>`;
  }
  return html;
}

function renderGear() {
  let html = `<div class="card small muted">Points come from forecasts. Spend them on instruments and data that show more of what is really going on.</div>`;
  for (const [id, e] of Object.entries(F.EQUIPMENT)) {
    const lvl = F.gearLevel(state, id);
    const cur = lvl > 0 ? e.levels[lvl - 1] : null;
    const next = F.nextGear(state, id);
    html += `<div class="gear"><div class="name">${e.name}</div><div class="cur">${cur ? cur.desc : 'Not owned'}</div>
      ${next ? `<div class="next">Next: <b>${next.desc}</b></div>` : '<div class="next muted">Best available.</div>'}
      ${next ? `<button class="btn" data-buy="${id}" ${F.canBuyGear(state, id) ? '' : 'disabled'}>${next.cost} pts</button>` : '<span></span>'}</div>`;
  }
  html += `<button class="btn ghost wide small" data-act="reset">Start a new career</button>`;
  return html;
}

function renderLog() {
  if (!state.history.length) return `<div class="card small muted">No forecasts yet.</div>`;
  const perfect = state.history.filter((h) => h.score === 100).length;
  let html = `<div class="card small muted">${state.history.length} recent forecasts · ${perfect} perfect · average ${Math.round(state.history.reduce((a, h) => a + h.score, 0) / state.history.length)}.</div><div class="hist" style="margin-top:8px">`;
  for (const h of state.history) {
    html += `<div class="hrow"><span class="muted">Day ${h.day}</span><span>${GLYPH[h.actual.condition]} ${h.actual.temp}°, ${h.actual.wind} <span class="muted">· you: ${GLYPH[h.prediction.condition]} ${h.prediction.temp}°, ${h.prediction.wind}</span></span><span class="sc ${h.score === 100 ? 'p' : ''}">${h.score}</span></div>`;
  }
  return `${html}</div>`;
}

function render() {
  renderTop();
  const view = $('view');
  if (state.won && !state.acknowledged) {
    view.innerHTML = `<div class="card win"><div style="font-size:3rem">🏆</div><h2 style="justify-content:center">Forecaster of the Year!</h2><p>Five perfect days in a row, finished on day ${state.wonDay}. ${TOWN} trusts you now.</p><button class="btn gold wide" data-act="ack">Keep forecasting</button></div>`;
    return;
  }
  view.innerHTML = tab === 'desk' ? renderDesk() : tab === 'gear' ? renderGear() : renderLog();
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
}

$('view').addEventListener('click', (e) => {
  const t = e.target.closest('[data-cond],[data-temp],[data-wind],[data-act],[data-buy]');
  if (!t) return;
  const d = t.dataset;
  if (d.cond) { pred.condition = d.cond; return render(); }
  if (d.temp) { pred.temp += Number(d.temp); return render(); }
  if (d.wind) { pred.wind = d.wind; return render(); }
  if (d.act === 'submit') {
    if (!pred.condition || !pred.wind) return undefined;
    const r = F.submit(state, { ...pred });
    lastResult = { ...r, prediction: { ...pred } };
    pred = { condition: null, temp: null, wind: null };
    saveGame();
    toast(r.score.total === 100 ? 'Perfect day!' : `${r.score.total} points`, r.score.total === 100 ? 'gold' : '');
    return render();
  }
  if (d.buy) { if (F.buyGear(state, d.buy)) { saveGame(); toast(`Bought ${F.EQUIPMENT[d.buy].name}`, 'gold'); } return render(); }
  if (d.act === 'ack') { state.acknowledged = true; saveGame(); return render(); }
  if (d.act === 'reset' && confirm('Start a new career from scratch?')) { state = F.newGame(); lastResult = null; pred = { condition: null, temp: null, wind: null }; saveGame(); tab = 'desk'; return render(); }
  return undefined;
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  render();
});
render();
window.forecaster = { get state() { return state; }, F, render, submit: (p) => { const r = F.submit(state, p); lastResult = { ...r, prediction: p }; saveGame(); render(); return r; } };
