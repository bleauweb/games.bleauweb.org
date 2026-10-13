import * as S from './ships.js';

const $ = (id) => document.getElementById(id);
const KEY = 'shipping-lanes.save.v1';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const secs = (ms) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.ceil(ms / 1000)}s`);

let state = loadGame();
let tab = 'map';

function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) {
        S.tick(s, Date.now());
        return s;
      }
    }
  } catch {
    // new game
  }
  return S.newGame(Date.now());
}
function saveGame() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
function toast(text, cls = '') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.textContent = text;
  $('toasts').append(t);
  setTimeout(() => t.remove(), 2700);
}
function after(fn) {
  fn();
  saveGame();
  render();
}

function renderTop() {
  $('t-coins').textContent = `${fmt(state.coins)} ducats`;
  $('t-cargo').textContent = `Cargo ${S.cargoCount(state)} / ${S.capacity(state)}`;
  $('t-day').textContent = `Day ${state.day}`;
}

// ---------- map ----------
function shipPos() {
  const v = state.voyage;
  if (!v) {
    const p = S.portById(state.port);
    return [p.x, p.y];
  }
  const a = S.portById(v.from);
  const b = S.portById(v.to);
  const k = Math.min(1, Math.max(0, (Date.now() - v.departAt) / (v.arriveAt - v.departAt)));
  return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k];
}
function renderMap() {
  const [sx, sy] = shipPos();
  const here = S.portById(state.port);
  let html = `<svg class="map" viewBox="0 0 100 86" id="map">
    <path class="land" d="M0 0 H34 C 30 10 24 16 22 22 C 20 28 26 30 28 36 C 20 38 8 34 0 40 Z"/>
    <path class="land" d="M38 0 H100 V34 C 90 30 84 36 78 44 C 70 46 66 36 60 38 C 52 40 50 48 44 50 C 40 44 44 36 40 30 C 36 22 42 10 38 0 Z"/>
    <path class="land" d="M30 48 C 40 52 44 60 42 70 C 40 78 48 84 56 86 H0 V46 C 10 44 20 46 30 48 Z"/>
    <path class="land" d="M62 60 C 68 58 72 62 70 68 C 68 72 62 70 60 66 Z"/>`;
  for (const p of S.PORTS) {
    if (p.id !== state.port && !state.voyage) html += `<line class="lane" x1="${here.x}" y1="${here.y}" x2="${p.x}" y2="${p.y}"/>`;
  }
  if (state.voyage) {
    const a = S.portById(state.voyage.from);
    const b = S.portById(state.voyage.to);
    html += `<line class="route" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  }
  for (const p of S.PORTS) {
    html += `<g class="port ${p.id === state.port && !state.voyage ? 'here' : ''}" data-port="${p.id}"><circle cx="${p.x}" cy="${p.y}" r="2.6"/><text x="${p.x}" y="${p.y + 6}">${p.name}</text></g>`;
  }
  html += `<path class="ship" transform="translate(${sx} ${sy - 3.5}) scale(0.5)" d="M-4 2 L4 2 L2 5 L-2 5 Z M0 2 V-5 M0 -5 L3 -1 L0 -1 Z"/></svg>`;
  if (state.voyage) {
    const v = state.voyage;
    const k = Math.min(1, (Date.now() - v.departAt) / (v.arriveAt - v.departAt));
    html += `<div class="card voyage"><b>Sailing to ${S.portById(v.to).name}</b> · ${secs(v.arriveAt - Date.now())} to go<div class="bar"><div style="width:${k * 100}%"></div></div></div>`;
  } else {
    html += `<div class="dest">`;
    for (const p of S.PORTS.filter((x) => x.id !== state.port).sort((a, b) => S.distance(state.port, a.id) - S.distance(state.port, b.id))) {
      const sells = Object.keys(p.sells).map((g) => S.GOODS[g].name).join(', ');
      const wants = Object.keys(p.wants).map((g) => S.GOODS[g].name).join(', ');
      html += `<div class="destrow"><div><div class="name">${p.name}</div><div class="meta">cheap: ${sells} · dear: ${wants}</div></div><div class="meta">${secs(S.voyageMs(state, state.port, p.id))}</div><button class="btn small" data-sail="${p.id}">Sail</button></div>`;
    }
    html += `</div>`;
  }
  const best = S.bestTrade(state);
  if (!state.voyage && best && best.margin > 0) html += `<div class="card small muted" style="margin-top:10px">Tip: ${S.GOODS[best.good].name} is ${best.here} here and about ${best.there} in ${S.portById(best.to).name}.</div>`;
  return html;
}

// ---------- port ----------
function renderPort() {
  if (state.voyage) return `<div class="card">At sea. Trading opens when you dock in ${S.portById(state.voyage.to).name}.</div>`;
  const p = S.portById(state.port);
  let html = `<h2>${p.name} <span class="sub">prices change daily</span></h2><div class="goods">`;
  for (const g of Object.keys(S.GOODS)) {
    const pr = S.price(state, p.id, g);
    const base = S.GOODS[g].price;
    const cls = pr <= base * 0.8 ? 'cheap' : pr >= base * 1.25 ? 'dear' : '';
    const have = state.cargo[g] || 0;
    const canAfford = Math.floor(state.coins / pr);
    const room = S.capacity(state) - S.cargoCount(state);
    html += `<div class="good"><div><div class="name">${S.GOODS[g].name} <span class="muted small">× ${have}</span></div><div class="meta">base ${base}${p.sells[g] ? ' · made here' : p.wants[g] ? ' · in demand here' : ''}</div></div><div class="price ${cls}">${pr}</div>
      <div class="acts">
        <button class="btn ghost small" data-buy="${g}" data-qty="1" ${canAfford < 1 || room < 1 ? 'disabled' : ''}>Buy 1</button>
        <button class="btn ghost small" data-buy="${g}" data-qty="10" ${canAfford < 1 || room < 1 ? 'disabled' : ''}>Buy 10</button>
        <button class="btn ghost small" data-buy="${g}" data-qty="max" ${canAfford < 1 || room < 1 ? 'disabled' : ''}>Fill</button>
        ${have ? `<button class="btn small" data-sell="${g}" data-qty="1">Sell 1</button><button class="btn small" data-sell="${g}" data-qty="all">Sell all (${fmt(have * pr)})</button>` : ''}
      </div></div>`;
  }
  html += `</div><h2>Elsewhere <span class="sub">${S.hasCharts(state) ? 'live from your charts' : 'what you remember'}</span></h2><div class="card known">`;
  for (const q of S.PORTS.filter((x) => x.id !== p.id)) {
    const parts = Object.keys(S.GOODS).map((g) => {
      const k = S.knownPrice(state, q.id, g);
      return k ? `${S.GOODS[g].name} ${k.price}${k.live ? '' : `<span class="stale"> (day ${k.day})</span>`}` : null;
    }).filter(Boolean);
    html += `<div class="k"><b>${q.name}</b><span style="text-align:right">${parts.length ? parts.join(' · ') : '<span class="stale">never visited</span>'}</span></div>`;
  }
  html += `</div>`;
  return html;
}

// ---------- yard ----------
function renderYard() {
  let html = state.voyage ? `<div class="card small muted">The shipyard is in port. Dock first.</div>` : '';
  for (const [id, u] of Object.entries(S.UPGRADES)) {
    const cur = S.upgradeInfo(state, id);
    const next = S.nextUpgrade(state, id);
    html += `<div class="upg ${id === 'flagship' ? 'golden' : ''}"><div class="name">${u.name}</div><div class="cur">${cur ? `${cur.name}: ${cur.desc}` : u.base}</div>
      ${next ? `<div class="next">Next: <b>${next.name}</b> · ${next.desc}</div>` : '<div class="next muted">Fully upgraded.</div>'}
      ${next ? `<button class="btn ${id === 'flagship' ? 'gold' : ''}" data-upg="${id}" ${S.canBuy(state, id) ? '' : 'disabled'}>${fmt(next.cost)}</button>` : '<span></span>'}</div>`;
  }
  html += `<h2>Log</h2><div class="card diary">${state.log.slice(0, 8).map((l) => `<div><b>Day ${l.day}</b>${l.text}</div>`).join('') || '<div class="muted">Calm seas so far.</div>'}</div>
    <div class="card small muted" style="margin-top:10px">${state.stats.voyages} voyages · ${fmt(state.stats.earned)} earned · ${state.stats.storms} storms.${state.won ? ` Flagship on day ${state.wonDay}.` : ''}</div>
    <button class="btn ghost wide small" data-act="reset">Start over</button>`;
  return html;
}

function render() {
  renderTop();
  const view = $('view');
  if (state.won && !state.acknowledged) {
    view.innerHTML = `<div class="card win"><h2 style="justify-content:center">Admiral!</h2><p>You bought the flagship on day ${state.wonDay} after ${state.stats.voyages} voyages and ${fmt(state.stats.earned)} ducats of trade.</p><button class="btn gold wide" data-act="ack">Keep sailing</button></div>`;
    return;
  }
  view.innerHTML = tab === 'map' ? renderMap() : tab === 'port' ? renderPort() : renderYard();
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
}

$('view').addEventListener('click', (e) => {
  const t = e.target.closest('[data-sail],[data-buy],[data-sell],[data-upg],[data-act],[data-port]');
  if (!t) return;
  const d = t.dataset;
  if (d.sail || (d.port && d.port !== state.port && !state.voyage)) {
    const to = d.sail || d.port;
    return after(() => { if (S.sail(state, to, Date.now())) toast(`Setting sail for ${S.portById(to).name}`); });
  }
  if (d.buy) return after(() => { const n = S.buy(state, d.buy, d.qty === 'max' ? 9999 : Number(d.qty)); if (!n) toast('No room or no coin'); });
  if (d.sell) return after(() => { const c = S.sell(state, d.sell, d.qty === 'all' ? 9999 : Number(d.qty)); toast(`Sold for ${fmt(c)}`, 'gold'); });
  if (d.upg) return after(() => { const n = S.nextUpgrade(state, d.upg); if (S.buyUpgrade(state, d.upg)) toast(n.win ? 'Admiral!' : `Bought ${n.name}`, 'gold'); });
  if (d.act === 'ack') return after(() => { state.acknowledged = true; });
  if (d.act === 'reset' && confirm('Start over with a sloop and 500 ducats?')) {
    state = S.newGame(Date.now());
    saveGame();
    tab = 'map';
    render();
  }
  return undefined;
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  render();
});

let wasAtSea = !!state.voyage;
let lastDay = state.day;
setInterval(() => {
  S.tick(state, Date.now());
  if (wasAtSea && !state.voyage) {
    toast(`Docked in ${S.portById(state.port).name}`);
    tab = 'port';
    saveGame();
    render();
  } else if (state.day !== lastDay) {
    toast(`Day ${state.day}: prices moved.`);
    saveGame();
    render();
  } else if (tab === 'map') render();
  else renderTop();
  wasAtSea = !!state.voyage;
  lastDay = state.day;
}, 1000);
setInterval(saveGame, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); else { S.tick(state, Date.now()); render(); } });
window.addEventListener('pagehide', saveGame);
render();
window.shippingLanes = { get state() { return state; }, S, render };
