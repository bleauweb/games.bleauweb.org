import * as W from './workshop.js';

const $ = (id) => document.getElementById(id);
const KEY = 'workshop.save.v1';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const secs = (ms) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.ceil(ms / 1000)}s`);
const nameOf = (id) => (W.MATERIALS[id] ? W.MATERIALS[id].name : W.RECIPES[id].name);

let state = loadGame();
let tab = 'craft';

function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) {
        W.tick(s, Date.now());
        return s;
      }
    }
  } catch {
    // new game
  }
  return W.newGame(Date.now());
}
function saveGame() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
function toast(text, cls = '') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.textContent = text;
  $('toasts').append(t);
  setTimeout(() => t.remove(), 2700);
}
function after(fn) { fn(); saveGame(); render(); }

function renderTop() {
  const lv = W.level(state);
  $('t-coins').textContent = `${fmt(state.coins)}¢`;
  $('t-level').textContent = `Lv ${lv}`;
  $('t-day').textContent = `Day ${state.day}`;
  const a = W.xpForLevel(lv);
  const b = W.xpForLevel(lv + 1);
  $('xpfill').style.width = `${Math.min(100, ((state.xp - a) / (b - a)) * 100)}%`;
}

function needsHtml(id) {
  return Object.entries(W.RECIPES[id].needs).map(([k, n]) => `<span class="${W.have(state, k) >= n ? '' : 'lack'}">${n} ${nameOf(k).toLowerCase()}</span>`).join(', ');
}

function renderCraft() {
  const now = Date.now();
  let html = '';
  const parts = Object.keys(state.inventory).filter((k) => state.inventory[k] > 0);
  html += `<div class="card"><b>Stock</b><div class="inv" style="margin-top:6px">${parts.length ? parts.map((k) => `<span class="chip">${nameOf(k)} × ${state.inventory[k]}</span>`).join('') : '<span class="muted small">Nothing yet. Buy materials in the Store.</span>'}</div></div>`;
  for (const [sid, st] of Object.entries(W.STATIONS)) {
    const open = W.stationOpen(state, sid);
    const jobs = state.stations[sid].jobs;
    html += `<div class="station"><div class="head"><span>${st.name}</span><span class="sub">${open ? `${jobs.filter((j) => j.startedAt !== null).length} / ${W.slots(state)} working` : 'locked: buy the table in Upgrades'}</span></div>`;
    if (open) {
      html += `<div class="jobs">${jobs.map((j) => {
        const started = j.startedAt !== null;
        const k = started ? Math.min(1, (now - j.startedAt) / j.ms) : 0;
        return `<div class="job ${started ? '' : 'waiting'}"><span>${W.RECIPES[j.recipe].name}</span><span class="muted small">${started ? secs(j.ms - (now - j.startedAt)) : 'waiting'}</span><div class="bar"><div style="width:${k * 100}%"></div></div></div>`;
      }).join('')}</div>`;
      const recipes = Object.keys(W.RECIPES).filter((id) => W.RECIPES[id].station === sid && W.RECIPES[id].level <= W.level(state));
      html += `<div class="recipes">${recipes.map((id) => `<button class="rec ${W.RECIPES[id].masterwork ? 'master' : ''}" data-queue="${id}" ${W.canCraft(state, id) ? '' : 'disabled'}><b>${W.RECIPES[id].name}</b><span class="needs">${needsHtml(id)}</span><span class="needs">${secs(W.jobMs(state, id))}${W.RECIPES[id].masterwork ? ' · wins the game' : ` · sells ${W.RECIPES[id].price}¢`}</span></button>`).join('')}</div>`;
      if (W.upgradeInfo(state, 'apprentice')) html += `<label class="toggle" style="margin-top:8px"><input type="checkbox" data-repeat="${sid}" ${state.stations[sid].repeat ? 'checked' : ''}/> Apprentice repeats the last job here while materials last</label>`;
    }
    html += `</div>`;
  }
  return html;
}

function renderStore() {
  let html = `<h2>Materials <span class="sub">prices drift daily${W.discount(state) < 1 ? ` · ${Math.round((1 - W.discount(state)) * 100)}% off` : ''}</span></h2><div class="goods">`;
  for (const [m, def] of Object.entries(W.MATERIALS)) {
    const locked = def.level && def.level > W.level(state);
    const p = W.materialPrice(state, m);
    html += `<div class="good"><div><div class="name">${def.name} <span class="muted small">× ${W.have(state, m)}</span></div><div class="meta">${locked ? `level ${def.level}` : `base ${def.price}¢`}</div></div><div class="price">${p}¢</div>
      <div class="acts">${locked ? '' : `<button class="btn ghost small" data-buy="${m}" data-qty="1" ${state.coins < p ? 'disabled' : ''}>Buy 1</button><button class="btn ghost small" data-buy="${m}" data-qty="5" ${state.coins < p ? 'disabled' : ''}>Buy 5</button><button class="btn ghost small" data-buy="${m}" data-qty="20" ${state.coins < p ? 'disabled' : ''}>Buy 20</button>`}</div></div>`;
  }
  html += `</div><h2>Sell goods <span class="sub">at the shop price</span></h2><div class="goods">`;
  const goods = Object.keys(W.RECIPES).filter((id) => !W.RECIPES[id].masterwork && W.have(state, id) > 0);
  if (!goods.length) html += `<div class="card small muted">Nothing finished yet.</div>`;
  for (const id of goods) {
    html += `<div class="good"><div><div class="name">${W.RECIPES[id].name} <span class="muted small">× ${W.have(state, id)}</span></div><div class="meta">orders may pay more</div></div><div class="price">${W.RECIPES[id].price}¢</div><div class="acts"><button class="btn small" data-sell="${id}" data-qty="1">Sell 1</button><button class="btn small" data-sell="${id}" data-qty="all">Sell all (${fmt(W.have(state, id) * W.RECIPES[id].price)}¢)</button></div></div>`;
  }
  return `${html}</div>`;
}

function renderOrders() {
  let html = `<div class="card small muted">Orders pay well above the shop price. Each lasts three days.</div>`;
  for (const o of state.orders) {
    const ok = W.canFulfil(state, o);
    html += `<div class="order"><div class="who">${o.who} wants ${o.qty} × ${W.RECIPES[o.recipe].name}</div><div class="what">pays ${fmt(o.pay)}¢ · ${o.expires - state.day} day${o.expires - state.day === 1 ? '' : 's'} left · you have ${W.have(state, o.recipe)}</div><button class="btn small ${ok ? 'gold' : 'ghost'}" data-fulfil="${o.id}" ${ok ? '' : 'disabled'}>Deliver</button></div>`;
  }
  html += `<h2>Log</h2><div class="card diary">${state.log.slice(0, 8).map((l) => `<div><b>Day ${l.day}</b>${l.text}</div>`).join('') || '<div class="muted">Quiet so far.</div>'}</div>`;
  return html;
}

function renderShop() {
  const lv = W.level(state);
  let html = '';
  for (const [id, u] of Object.entries(W.UPGRADES)) {
    const cur = W.upgradeInfo(state, id);
    const next = W.nextUpgrade(state, id);
    html += `<div class="upg"><div class="name">${u.name}</div><div class="cur">${cur ? `${cur.name}: ${cur.desc}` : u.base}</div>
      ${next ? `<div class="next">Next: <b>${next.name}</b> · ${next.desc}${next.level > lv ? ` <span class="req">· needs level ${next.level}</span>` : ''}</div>` : '<div class="next muted">Fully upgraded.</div>'}
      ${next ? `<button class="btn" data-upg="${id}" ${W.canBuy(state, id) ? '' : 'disabled'}>${fmt(next.cost)}¢</button>` : '<span></span>'}</div>`;
  }
  html += `<div class="card small muted">The Great Clock (level 5, at the jeweller’s table) wins the game.<br>${state.stats.crafted} crafted · ${state.stats.sold} sold · ${fmt(state.stats.earned)}¢ earned · ${state.stats.orders} orders.${state.won ? ` Finished on day ${state.wonDay}.` : ''}</div><button class="btn ghost wide small" data-act="reset">Start a new workshop</button>`;
  return html;
}

function render() {
  renderTop();
  const view = $('view');
  if (state.won && !state.acknowledged) {
    view.innerHTML = `<div class="card win"><h2 style="justify-content:center">Master Craftsman!</h2><p>The Great Clock was finished on day ${state.wonDay}. ${state.stats.crafted} things crafted, ${fmt(state.stats.earned)}¢ earned.</p><button class="btn gold wide" data-act="ack">Keep crafting</button></div>`;
    return;
  }
  view.innerHTML = tab === 'craft' ? renderCraft() : tab === 'store' ? renderStore() : tab === 'orders' ? renderOrders() : renderShop();
  const deliverable = state.orders.filter((o) => W.canFulfil(state, o)).length;
  for (const b of document.querySelectorAll('.tabs button')) {
    const t = b.dataset.tab;
    b.innerHTML = `${t[0].toUpperCase()}${t.slice(1)}${t === 'orders' && deliverable ? `<span class="badge">${deliverable}</span>` : ''}`;
    b.classList.toggle('on', t === tab);
  }
}

$('view').addEventListener('click', (e) => {
  const t = e.target.closest('[data-queue],[data-buy],[data-sell],[data-fulfil],[data-upg],[data-act]');
  if (!t) return;
  const d = t.dataset;
  if (d.queue) return after(() => { if (W.queue(state, d.queue)) toast(`${W.RECIPES[d.queue].name} queued`); });
  if (d.buy) return after(() => { const n = W.buyMaterial(state, d.buy, Number(d.qty)); if (!n) toast('Not enough coin'); });
  if (d.sell) return after(() => { const c = W.sellItem(state, d.sell, d.qty === 'all' ? 9999 : Number(d.qty)); toast(`Sold for ${fmt(c)}¢`, 'gold'); });
  if (d.fulfil) return after(() => { const o = state.orders.find((x) => x.id === d.fulfil); if (W.fulfil(state, d.fulfil)) toast(`Delivered! +${fmt(o.pay)}¢`, 'gold'); });
  if (d.upg) return after(() => { const n = W.nextUpgrade(state, d.upg); if (W.buyUpgrade(state, d.upg)) toast(`Bought ${n.name}`, 'gold'); });
  if (d.act === 'ack') return after(() => { state.acknowledged = true; });
  if (d.act === 'reset' && confirm('Start a new workshop?')) { state = W.newGame(Date.now()); saveGame(); tab = 'craft'; render(); }
  return undefined;
});
$('view').addEventListener('change', (e) => {
  const t = e.target.closest('[data-repeat]');
  if (t) after(() => W.setRepeat(state, t.dataset.repeat, t.checked));
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  render();
});
let lastDay = state.day;
let lastCrafted = state.stats.crafted;
setInterval(() => {
  W.tick(state, Date.now());
  if (state.stats.crafted !== lastCrafted) { lastCrafted = state.stats.crafted; saveGame(); render(); }
  else if (state.day !== lastDay) { lastDay = state.day; toast(`Day ${state.day}: material prices moved.`); saveGame(); render(); }
  else if (tab === 'craft') render();
  else renderTop();
}, 1000);
setInterval(saveGame, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); else { W.tick(state, Date.now()); render(); } });
window.addEventListener('pagehide', saveGame);
render();
window.workshop = { get state() { return state; }, W, render };
