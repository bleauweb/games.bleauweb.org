import * as B from './bakery.js';

const $ = (id) => document.getElementById(id);
const KEY = 'bakery-rush.save.v1';
const FARM_KEY = 'market-day.save.v1';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const secs = (ms) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.ceil(ms / 1000)}s`);

let state = loadGame();
let tab = 'bake';

function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) {
        const before = s.stats.customers;
        B.tick(s, Date.now());
        if (s.stats.customers - before > 3) setTimeout(() => toast(`While you were out: ${s.stats.customers - before} customers came by.`), 300);
        return s;
      }
    }
  } catch {
    // new game
  }
  return B.newGame(Date.now());
}
function saveGame() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
function farm() {
  try {
    const raw = localStorage.getItem(FARM_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && s.inventory ? s : null;
  } catch {
    return null;
  }
}
function saveFarm(s) { try { localStorage.setItem(FARM_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
function toast(text, cls = '') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.textContent = text;
  $('toasts').append(t);
  setTimeout(() => t.remove(), 2700);
}
function after(fn) { fn(); saveGame(); render(); }

function renderTop() {
  const lv = B.level(state);
  $('t-coins').textContent = `${fmt(state.coins)}¢`;
  $('t-level').textContent = `Lv ${lv}`;
  $('t-rep').textContent = `${'★'.repeat(Math.floor(B.repStars(state)))}${B.repStars(state) % 1 ? '½' : ''}`.padEnd(1, '☆') || '☆';
  $('t-day').textContent = `Day ${state.day}${B.isRush(state, Date.now()) ? ' · RUSH' : ''}`;
  const a = B.xpForLevel(lv);
  const b = B.xpForLevel(lv + 1);
  $('xpfill').style.width = `${Math.min(100, ((state.xp - a) / (b - a)) * 100)}%`;
}

function needsHtml(id) {
  return Object.entries(B.RECIPES[id].needs).map(([k, n]) => `<span class="${(state.pantry[k] || 0) >= n ? '' : 'lack'}">${n} ${B.INGREDIENTS[k].name.toLowerCase()}</span>`).join(', ');
}

function renderBake() {
  const now = Date.now();
  const rush = B.isRush(state, now);
  let html = `<div class="card ${rush ? 'rush' : ''}">${rush ? `<b>Lunchtime rush!</b> ${secs(B.RUSH_MS - (now - state.dayStart))} left · customers every second or two.` : `Quiet hours. Next rush in ${secs(B.DAY_MS - (now - state.dayStart))}.`}<div class="muted small">Today’s special: ${B.RECIPES[state.special].name} (+30%). Served ${state.served}, turned away ${state.lost} today.</div></div>`;
  html += `<h2>Ovens <span class="sub">${state.ovens.length} / ${B.ovenCount(state)} busy</span></h2><div class="ovens">`;
  for (const o of state.ovens) {
    const k = Math.min(1, (now - o.startedAt) / o.ms);
    html += `<div class="oven"><b>${B.RECIPES[o.recipe].name} × ${o.qty}</b><span class="muted small">${secs(o.ms - (now - o.startedAt))}</span><div class="bar"><div style="width:${k * 100}%"></div></div></div>`;
  }
  for (let i = state.ovens.length; i < B.ovenCount(state); i++) html += `<div class="oven empty">Oven free</div>`;
  html += `</div><h2>Recipes <span class="sub">batch size ×${B.yieldMult(state)}</span></h2><div class="recipes">`;
  for (const [id, r] of Object.entries(B.RECIPES)) {
    const locked = !B.recipeUnlocked(state, id);
    html += `<div class="rec ${id === state.special ? 'special' : ''} ${locked ? 'locked' : ''}"><div class="name">${r.name}</div><div class="needs">${locked ? `level ${r.level}` : `${needsHtml(id)} · ${secs(B.bakeMs(state, id))} · ${Math.round(r.yield * B.yieldMult(state))} at ${B.sellPrice(state, id)}¢`}</div><button class="btn small" data-bake="${id}" ${B.canBake(state, id) ? '' : 'disabled'}>Bake</button></div>`;
  }
  return `${html}</div>`;
}

function renderShelf() {
  let html = `<div class="card small muted">Customers buy from the shelf on their own. Day-old goods sell at 60%; two days old gets thrown out.</div><h2>On the shelf <span class="sub">${B.shelfCount(state)} items</span></h2><div class="shelf">`;
  const sorted = [...state.shelf].sort((a, b) => a.day - b.day);
  if (!sorted.length) html += `<div class="card small muted">Empty. Bake something before the rush.</div>`;
  for (const s of sorted) html += `<div class="item"><div><div class="name">${B.RECIPES[s.recipe].name} × ${s.qty}</div><div class="meta">${state.day - s.day > 0 ? 'day-old' : 'fresh'}${state.special === s.recipe ? ' · special' : ''}</div></div><div class="price">${B.sellPrice(state, s.recipe, s.day)}¢</div></div>`;
  html += `</div><h2>Diary</h2><div class="card diary">${state.log.slice(0, 8).map((l) => `<div><b>Day ${l.day}</b>${l.text}</div>`).join('') || '<div class="muted">Nothing yet.</div>'}</div>`;
  return html;
}

function renderPantry() {
  let html = `<h2>Supplier <span class="sub">prices drift daily</span></h2><div class="goods">`;
  for (const [i, def] of Object.entries(B.INGREDIENTS)) {
    const p = B.ingredientPrice(state, i);
    html += `<div class="good"><div><div class="name">${def.name} <span class="muted small">× ${state.pantry[i] || 0}</span></div><div class="meta">base ${def.price}¢</div></div><div class="price">${p}¢</div>
      <div class="acts"><button class="btn ghost small" data-buy="${i}" data-qty="1" ${state.coins < p ? 'disabled' : ''}>Buy 1</button><button class="btn ghost small" data-buy="${i}" data-qty="5" ${state.coins < p ? 'disabled' : ''}>Buy 5</button><button class="btn ghost small" data-buy="${i}" data-qty="20" ${state.coins < p ? 'disabled' : ''}>Buy 20</button></div></div>`;
  }
  html += `</div>`;
  const f = farm();
  const stock = f ? Object.entries(B.FARM_GOODS).map(([g, d]) => ({ g, d, have: f.inventory[g] || 0 })).filter((x) => x.have > 0) : [];
  html += `<h2>Farm delivery <span class="sub">from your Market Day farm</span></h2>`;
  if (!f) html += `<div class="card farm small muted">Play <a href="/games/market-day/" style="color:#9fc4ff">Market Day</a> and your wheat, eggs and milk can be delivered here for 1¢ each.</div>`;
  else if (!stock.length) html += `<div class="card farm small muted">The farm has no wheat, eggs or milk in stock right now.</div>`;
  else {
    html += `<div class="goods">`;
    for (const x of stock) html += `<div class="good farm"><div><div class="name">${x.g[0].toUpperCase()}${x.g.slice(1)} <span class="muted small">× ${x.have} at the farm</span></div><div class="meta">1 ${x.g} → ${x.d.per} ${B.INGREDIENTS[x.d.gives].name.toLowerCase()}</div></div><div class="price">1¢</div><div class="acts"><button class="btn small" data-farm="${x.g}" data-qty="5">Take 5</button><button class="btn small" data-farm="${x.g}" data-qty="all">Take all</button></div></div>`;
    html += `</div>`;
  }
  return html;
}

function renderShop() {
  const lv = B.level(state);
  let html = '';
  for (const [id, u] of Object.entries(B.UPGRADES)) {
    const cur = B.upgradeInfo(state, id);
    const next = B.nextUpgrade(state, id);
    html += `<div class="upg ${id === 'whisk' ? 'golden' : ''}"><div class="name">${u.name}</div><div class="cur">${cur ? `${cur.name}: ${cur.desc}` : u.base}</div>
      ${next ? `<div class="next">Next: <b>${next.name}</b> · ${next.desc}${next.level > lv ? ` <span class="req">· needs level ${next.level}</span>` : ''}</div>` : '<div class="next muted">Fully upgraded.</div>'}
      ${next ? `<button class="btn ${id === 'whisk' ? 'gold' : ''}" data-upg="${id}" ${B.canBuy(state, id) ? '' : 'disabled'}>${fmt(next.cost)}¢</button>` : '<span></span>'}</div>`;
  }
  html += `<div class="card small muted">${state.stats.baked} baked · ${state.stats.sold} sold · ${fmt(state.stats.earned)}¢ earned · ${state.stats.customers} customers, ${state.stats.lostCustomers} turned away.${state.won ? ` Golden Whisk on day ${state.wonDay}.` : ''}</div><button class="btn ghost wide small" data-act="reset">Open a new bakery</button>`;
  return html;
}

function render() {
  renderTop();
  const view = $('view');
  if (state.won && !state.acknowledged) {
    view.innerHTML = `<div class="card win"><h2 style="justify-content:center">Golden Whisk!</h2><p>Won on day ${state.wonDay}: ${state.stats.sold} things sold to ${state.stats.customers} customers, ${fmt(state.stats.earned)}¢ earned.</p><button class="btn gold wide" data-act="ack">Keep baking</button></div>`;
    return;
  }
  view.innerHTML = tab === 'bake' ? renderBake() : tab === 'shelf' ? renderShelf() : tab === 'pantry' ? renderPantry() : renderShop();
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
}

$('view').addEventListener('click', (e) => {
  const t = e.target.closest('[data-bake],[data-buy],[data-farm],[data-upg],[data-act]');
  if (!t) return;
  const d = t.dataset;
  if (d.bake) return after(() => { if (B.bake(state, d.bake, Date.now())) toast(`${B.RECIPES[d.bake].name} in the oven`); });
  if (d.buy) return after(() => { if (!B.buy(state, d.buy, Number(d.qty))) toast('Not enough coin'); });
  if (d.farm) return after(() => {
    const f = farm();
    if (!f) return;
    const n = B.buyFromFarm(state, f.inventory, d.farm, d.qty === 'all' ? 9999 : Number(d.qty));
    if (n) { saveFarm(f); toast(`${n} ${d.farm} delivered from the farm`); }
  });
  if (d.upg) return after(() => { const n = B.nextUpgrade(state, d.upg); if (B.buyUpgrade(state, d.upg)) toast(n.win ? 'The Golden Whisk is yours!' : `Bought ${n.name}`, 'gold'); });
  if (d.act === 'ack') return after(() => { state.acknowledged = true; });
  if (d.act === 'reset' && confirm('Open a new bakery? This one closes for good.')) { state = B.newGame(Date.now()); saveGame(); tab = 'bake'; render(); }
  return undefined;
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  render();
});
let lastDay = state.day;
setInterval(() => {
  B.tick(state, Date.now());
  if (state.day !== lastDay) { lastDay = state.day; toast(`Day ${state.day}: special is ${B.RECIPES[state.special].name.toLowerCase()}.`); saveGame(); }
  if (tab === 'bake' || tab === 'shelf') render();
  else renderTop();
}, 1000);
setInterval(saveGame, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); else { B.tick(state, Date.now()); render(); } });
window.addEventListener('pagehide', saveGame);
render();
window.bakeryRush = { get state() { return state; }, B, render };
