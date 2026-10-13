// Market Day: the screens. Rules live in economy.js, numbers in data.js.
import * as E from './economy.js';
import { CROPS, ANIMALS, PRODUCTS, GOODS, UPGRADES, WEATHER, DAY_MS, TRIP_MS, ANIMAL_STORE, xpForLevel } from './data.js';
import { icon } from './icons.js';

const $ = (id) => document.getElementById(id);
const KEY = 'market-day.save.v1';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const secs = (ms) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.ceil(ms / 1000)}s`);

let state = loadGame();
let tab = 'farm';
let lastCrop = 'wheat';
let trip = null; // { until }
let sheetOpen = false;

// ---------- save / load ----------

function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) {
        const ripeBefore = s.plots.filter((p) => p.crop && p.progress >= 1).length;
        E.tick(s, Date.now());
        const ripeAfter = s.plots.filter((p) => p.crop && p.progress >= 1).length;
        const away = Date.now() - (s.savedAt || Date.now());
        if (away > 60_000) setTimeout(() => toast(`Welcome back. ${ripeAfter - ripeBefore > 0 ? `${ripeAfter - ripeBefore} crops ripened while you were away.` : 'The farm kept going.'}`), 300);
        return s;
      }
    }
  } catch {
    // fall through to a new game
  }
  return E.newGame(Date.now());
}

function saveGame() {
  try {
    state.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable
  }
}

// ---------- helpers ----------

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

function goodIcon(g) {
  return icon(g);
}

// ---------- top bar ----------

function renderTop() {
  const lv = E.level(state);
  $('t-coins').innerHTML = `${icon('coin')} ${fmt(state.coins)}`;
  $('t-level').innerHTML = `Lv ${lv}`;
  const w = WEATHER[state.weather];
  $('t-day').innerHTML = `Day ${state.day} · ${icon(state.weather)} ${w.name}`;
  const a = xpForLevel(lv);
  const b = xpForLevel(lv + 1);
  $('xpfill').style.width = `${Math.min(100, ((state.xp - a) / (b - a)) * 100)}%`;
}

// ---------- farm ----------

function renderFarm() {
  const ripe = state.plots.filter((p) => p.crop && p.progress >= 1).length;
  const cols = state.plots.length > 16 ? 'c5' : state.plots.length > 9 ? 'c4' : '';
  const speed = E.growthSpeed(state);
  const w = WEATHER[state.weather];
  let html = `
    <div class="card weather">${icon(state.weather)}<div><b>${w.name}</b><div class="muted small">Crops grow at ${Math.round(speed * 100)}% speed${state.festival ? ` · ${GOODS[state.festival].name} festival in town` : ''}</div></div></div>
    <h2>Field <span class="sub">${state.plots.length} plots · ${ripe} ripe</span></h2>
    <div class="field ${cols}">`;
  state.plots.forEach((p, i) => {
    if (!p.crop) html += `<div class="plot empty" data-plot="${i}">${icon('soil')}</div>`;
    else if (p.progress >= 1) html += `<div class="plot ripe" data-plot="${i}">${icon(p.crop)}<span class="plus">+1</span></div>`;
    else {
      const stage = p.progress < 0.4 ? 'sprout' : 'plant';
      const left = ((1 - p.progress) * CROPS[p.crop].grow) / speed;
      const r = 46;
      const c = 2 * Math.PI * r;
      html += `<div class="plot" data-plot="${i}">${icon(stage)}
        <svg class="ring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="${r}"/><circle class="fg" cx="50" cy="50" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p.progress)}"/></svg>
        <span class="left">${secs(left)}</span></div>`;
    }
  });
  html += '</div><div class="tools">';
  if (E.hasTool(state, 1)) html += `<button class="btn ghost small" data-act="plantall">Plant all: ${CROPS[lastCrop].name} (${CROPS[lastCrop].seed}¢ each)</button>`;
  if (E.hasTool(state, 2)) html += `<button class="btn small" data-act="harvestall" ${ripe ? '' : 'disabled'}>Harvest all (${ripe})${E.hasTool(state, 3) ? ' & replant' : ''}</button>`;
  html += '</div>';
  html += `<h2>Diary</h2><div class="card diary">${state.log.slice(0, 6).map((l) => `<div><b>Day ${l.day}</b>${l.text}</div>`).join('') || '<div class="muted">Nothing yet. Plant something!</div>'}</div>`;
  return html;
}

function openSeedSheet(index) {
  const lv = E.level(state);
  let html = `<h3>Plant in plot ${index + 1}<button class="x" data-close>✕</button></h3>`;
  for (const [id, c] of Object.entries(CROPS)) {
    const locked = c.level > lv;
    const poor = state.coins < c.seed;
    html += `<button class="pick" data-seed="${id}" ${locked || poor ? 'disabled' : ''}>${icon(id)}<div class="name">${c.name}${locked ? ` · level ${c.level}` : ''}</div><div class="meta">${secs(c.grow / E.growthSpeed(state))} · sells ${E.townPrice(state, id)}¢ in town</div><div class="cost">${c.seed}¢</div></button>`;
  }
  showSheet(html, (el) => {
    const seed = el.dataset.seed;
    if (seed) after(() => {
      if (E.plant(state, index, seed)) lastCrop = seed;
      closeSheet();
    });
  });
}

// ---------- barn ----------

function renderBarn() {
  const slots = E.barnSlots(state);
  if (!slots) {
    return `<div class="card"><b>No barn yet.</b><div class="muted small">Buy a chicken coop in the shop (80¢, level 2) to keep animals. They make eggs, milk and wool on their own while you farm.</div><button class="btn wide" data-goto="shop">Open the shop</button></div>`;
  }
  const ready = state.animals.reduce((n, a) => n + a.stored, 0);
  let html = `<h2>Animals <span class="sub">${state.animals.length} / ${slots} slots</span></h2><div class="pens">`;
  state.animals.forEach((a, i) => {
    const def = ANIMALS[a.type];
    const pct = a.stored >= ANIMAL_STORE ? 100 : Math.min(100, (a.acc / def.cycle) * 100);
    html += `<div class="pen ${a.stored ? 'ready' : ''}" data-animal="${i}">${a.stored ? `<span class="count">${a.stored}</span>` : ''}${icon(a.type)}<div class="name">${def.name}</div><div class="bar"><div style="width:${pct}%"></div></div></div>`;
  });
  for (let i = state.animals.length; i < slots; i++) html += `<div class="pen empty" data-buyanimal="1">+ Buy</div>`;
  html += '</div>';
  html += `<div class="tools"><button class="btn small" data-act="collectall" ${ready ? '' : 'disabled'}>Collect all (${ready})</button></div>`;
  html += `<div class="card small muted">Each animal keeps up to ${ANIMAL_STORE} of its produce until you collect. Tap an animal to collect.</div>`;
  return html;
}

function openAnimalSheet() {
  let html = `<h3>Buy an animal<button class="x" data-close>✕</button></h3>`;
  for (const [id, a] of Object.entries(ANIMALS)) {
    const unlocked = E.animalUnlocked(state, id);
    const why = !unlocked ? (ANIMALS[id].level > E.level(state) ? `level ${a.level}` : `needs ${UPGRADES.barn.levels[a.barn - 1].name}`) : '';
    html += `<button class="pick" data-animal-buy="${id}" ${!unlocked || state.coins < a.cost ? 'disabled' : ''}>${icon(id)}<div class="name">${a.name}${why ? ` · ${why}` : ''}</div><div class="meta">${PRODUCTS[a.product].name} every ${secs(a.cycle)} · sells ${E.townPrice(state, a.product)}¢</div><div class="cost">${a.cost}¢</div></button>`;
  }
  showSheet(html, (el) => {
    const id = el.dataset.animalBuy;
    if (id) after(() => {
      E.buyAnimal(state, id);
      closeSheet();
    });
  });
}

// ---------- market ----------

function renderMarket() {
  const lv = E.level(state);
  const goods = Object.keys(GOODS).filter((g) => GOODS[g].level <= lv || (state.inventory[g] || 0) > 0);
  let html = `<h2>Town prices <span class="sub">change every day</span></h2><div class="goods">`;
  for (const g of goods) {
    const have = state.inventory[g] || 0;
    const t = state.trend[g];
    html += `<div class="good">${goodIcon(g)}<div><div class="name">${GOODS[g].name} <span class="muted small">× ${have}</span></div><div class="meta">base ${GOODS[g].price}¢ · peddler pays ${E.peddlerPrice(state, g)}¢${state.festival === g ? ' · <span class="fest">festival ×1.8</span>' : ''}</div></div>
      <div class="price">${E.townPrice(state, g)}¢ <span class="${t > 0 ? 'up' : t < 0 ? 'down' : 'muted'}">${t > 0 ? '▲' : t < 0 ? '▼' : '•'}</span></div>
      ${have ? `<div class="acts"><button class="btn ghost small" data-load="${g}" data-qty="1">Load 1</button><button class="btn ghost small" data-load="${g}" data-qty="10">Load 10</button><button class="btn ghost small" data-load="${g}" data-qty="all">Load all</button><button class="btn ghost small" data-peddle="${g}">Peddler, sell all (${E.peddlerPrice(state, g) * have}¢)</button></div>` : ''}
    </div>`;
  }
  html += '</div>';
  html += `<h2>Orders <span class="sub">paid on delivery, no cart needed</span></h2><div class="orders">`;
  for (const o of state.orders) {
    const ok = E.canFulfil(state, o);
    html += `<div class="order">${goodIcon(o.good)}<div class="who">${o.who} wants ${o.qty} ${GOODS[o.good].name.toLowerCase()}</div><div class="what">pays ${o.pay}¢ (${Math.round(o.pay / o.qty)}¢ each) · ${o.expires - state.day} day${o.expires - state.day === 1 ? '' : 's'} left · you have ${state.inventory[o.good] || 0}</div><button class="btn small ${ok ? 'gold' : 'ghost'}" data-fulfil="${o.id}" ${ok ? '' : 'disabled'}>Deliver</button></div>`;
  }
  html += '</div>';
  const load = E.cartLoad(state);
  const cap = E.cartCapacity(state);
  html += `<div class="cartbar">
    <div class="row"><b>${icon('cart')} Cart ${load} / ${cap}</b><span class="muted small" style="margin-left:auto">worth ${fmt(E.cartValue(state))}¢ in town</span></div>
    <div class="meter"><div style="width:${(load / cap) * 100}%"></div></div>
    <div class="items">${Object.entries(state.cart).map(([g, q]) => `<span class="item" data-unload="${g}">${goodIcon(g)} ${q} ✕</span>`).join('') || '<span class="muted small">Load goods above, or tap “Load best”.</span>'}</div>
    <div class="row"><button class="btn ghost small" data-act="loadbest">Load best</button><button class="btn gold" style="flex:1" data-act="sell" ${load && !trip ? '' : 'disabled'}>${trip ? 'On the road…' : 'Go to town and sell'}</button></div>
    ${trip ? `<div class="trip"><div id="tripbar"></div></div>` : ''}
  </div>`;
  return html;
}

// ---------- shop ----------

function renderShop() {
  const lv = E.level(state);
  let html = `<div class="card small muted">Equipment is permanent. Levels come from harvesting and selling.</div>`;
  for (const [id, u] of Object.entries(UPGRADES)) {
    const cur = E.upgradeInfo(state, id);
    const next = E.nextUpgrade(state, id);
    const can = E.canBuy(state, id);
    html += `<div class="upg ${id === 'golden' ? 'golden' : ''}">
      <div class="name">${id === 'golden' ? icon('tractor') : id === 'scarecrow' ? icon('scarecrow') : ''} ${u.name}</div>
      <div class="cur">${cur ? `${cur.name}: ${cur.desc}` : u.base}</div>
      ${next ? `<div class="next">Next: <b>${next.name}</b> · ${next.desc}${next.level > lv ? ` <span class="req">· needs level ${next.level}</span>` : ''}</div>` : '<div class="next muted">Fully upgraded.</div>'}
      ${next ? `<button class="btn ${id === 'golden' ? 'gold' : ''}" data-buy="${id}" ${can ? '' : 'disabled'}>${fmt(next.cost)}¢</button>` : '<span></span>'}
    </div>`;
  }
  html += `<div class="card small muted">Stats: ${state.stats.harvested} harvested · ${state.stats.sold} sold · ${fmt(state.stats.earned)}¢ earned · ${state.stats.trips} trips · ${state.stats.orders} orders.${state.won ? ` Golden Tractor on day ${state.wonDay}.` : ''}</div>
    <button class="btn ghost wide small" data-act="reset">Start a new farm</button>`;
  return html;
}

// ---------- sheet ----------

function showSheet(html, onClick) {
  const sheet = $('sheet');
  sheet.innerHTML = `<div class="inner">${html}</div>`;
  sheet.classList.remove('hidden');
  sheetOpen = true;
  sheet.onclick = (e) => {
    if (e.target === sheet || e.target.closest('[data-close]')) return closeSheet();
    const btn = e.target.closest('button');
    if (btn && !btn.disabled) onClick(btn);
    return undefined;
  };
}

function closeSheet() {
  $('sheet').classList.add('hidden');
  $('sheet').innerHTML = '';
  sheetOpen = false;
}

// ---------- render ----------

function render() {
  renderTop();
  const view = $('view');
  if (state.won && !state.acknowledged) {
    view.innerHTML = `<div class="card win">${icon('tractor')}<h2>Master Merchant!</h2><p>You bought the Golden Tractor on day ${state.wonDay}. ${fmt(state.stats.earned)}¢ earned, ${state.stats.sold} goods sold, ${state.stats.trips} trips to town.</p><p class="muted small">The farm is yours to keep running. Can you do it faster on a new farm?</p><button class="btn gold wide" data-act="ack">Keep farming</button></div>`;
    return;
  }
  view.innerHTML = tab === 'farm' ? renderFarm() : tab === 'barn' ? renderBarn() : tab === 'market' ? renderMarket() : renderShop();
  const ripe = state.plots.filter((p) => p.crop && p.progress >= 1).length;
  const ready = state.animals.reduce((n, a) => n + a.stored, 0);
  const deliverable = state.orders.filter((o) => E.canFulfil(state, o)).length;
  for (const b of document.querySelectorAll('.tabs button')) {
    const t = b.dataset.tab;
    const n = t === 'farm' ? ripe : t === 'barn' ? ready : t === 'market' ? deliverable : 0;
    b.innerHTML = `${t[0].toUpperCase()}${t.slice(1)}${n ? `<span class="badge">${n}</span>` : ''}`;
    b.classList.toggle('on', t === tab);
  }
  if (trip) {
    const bar = $('tripbar');
    if (bar) {
      requestAnimationFrame(() => {
        bar.style.transitionDuration = `${Math.max(0, trip.until - Date.now())}ms`;
        bar.style.width = '100%';
      });
    }
  }
}

// ---------- events ----------

$('view').addEventListener('click', (e) => {
  const t = e.target.closest('[data-plot],[data-animal],[data-buyanimal],[data-act],[data-load],[data-unload],[data-peddle],[data-fulfil],[data-buy],[data-goto]');
  if (!t) return;
  const d = t.dataset;
  if (d.plot !== undefined) {
    const i = Number(d.plot);
    const p = state.plots[i];
    if (!p.crop) return openSeedSheet(i);
    if (p.progress >= 1) return after(() => E.harvest(state, i));
    return toast(`${CROPS[p.crop].name}: ${secs(((1 - p.progress) * CROPS[p.crop].grow) / E.growthSpeed(state))} to go`);
  }
  if (d.animal !== undefined) return after(() => { const n = E.collect(state, Number(d.animal)); if (n) toast(`+${n} ${PRODUCTS[ANIMALS[state.animals[Number(d.animal)].type].product].name.toLowerCase()}`); });
  if (d.buyanimal) return openAnimalSheet();
  if (d.goto) { tab = d.goto; return render(); }
  if (d.load) return after(() => E.load(state, d.load, d.qty === 'all' ? Infinity : Number(d.qty)));
  if (d.unload) return after(() => E.unload(state, d.unload));
  if (d.peddle) return after(() => { const c = E.sellToPeddler(state, d.peddle, Infinity); toast(`The peddler paid ${c}¢`); });
  if (d.fulfil) return after(() => { const o = state.orders.find((x) => x.id === d.fulfil); if (E.fulfil(state, d.fulfil)) toast(`Delivered! +${o.pay}¢`, 'gold'); });
  if (d.buy) return after(() => { const next = E.nextUpgrade(state, d.buy); if (E.buyUpgrade(state, d.buy)) toast(next.win ? 'The Golden Tractor is yours!' : `Bought ${next.name}`, 'gold'); });
  if (d.act === 'plantall') return after(() => { const n = E.plantAll(state, lastCrop); toast(n ? `Planted ${n} ${CROPS[lastCrop].name.toLowerCase()}` : 'Nothing to plant (no coins or no empty plots)'); });
  if (d.act === 'harvestall') return after(() => { const n = E.harvestAll(state); toast(E.hasTool(state, 3) ? `Harvested ${n} and replanted` : `Harvested ${n}`); });
  if (d.act === 'collectall') return after(() => { const n = E.collectAll(state); toast(`Collected ${n}`); });
  if (d.act === 'loadbest') return after(() => E.loadBest(state));
  if (d.act === 'sell') return goToTown();
  if (d.act === 'ack') return after(() => { state.acknowledged = true; });
  if (d.act === 'reset') {
    if (confirm('Start a brand new farm? Your current farm will be gone.')) {
      state = E.newGame(Date.now());
      saveGame();
      tab = 'farm';
      render();
    }
  }
  return undefined;
});

function goToTown() {
  if (trip || !E.cartLoad(state)) return;
  trip = { until: Date.now() + TRIP_MS };
  render();
  setTimeout(() => {
    trip = null;
    after(() => { const c = E.sellCart(state); toast(`Sold for ${fmt(c)}¢`, 'gold'); });
  }, TRIP_MS);
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  render();
});

// ---------- loop ----------

let lastDay = state.day;
setInterval(() => {
  E.tick(state, Date.now());
  if (state.day !== lastDay) {
    lastDay = state.day;
    toast(`Day ${state.day}: ${WEATHER[state.weather].name.toLowerCase()}${state.festival ? `, ${GOODS[state.festival].name.toLowerCase()} festival` : ''}. Prices changed.`);
    saveGame();
  }
  if (!sheetOpen && (tab === 'farm' || tab === 'barn')) render();
  else renderTop();
}, 1000);
setInterval(saveGame, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveGame();
  else {
    E.tick(state, Date.now());
    render();
  }
});
window.addEventListener('pagehide', saveGame);

render();
window.marketDay = { get state() { return state; }, E, render, setState(s) { state = s; render(); } };
