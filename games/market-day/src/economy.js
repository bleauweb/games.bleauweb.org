// The farm as pure functions over a state object. Time comes in as `now` (ms) so growth
// continues while the tab is closed and the tests can run a whole career in a blink.
import {
  CROPS, ANIMALS, PRODUCTS, GOODS, UPGRADES, DAY_MS, ANIMAL_STORE, OFFLINE_CAP_MS, PEDDLER_RATE,
  CART_BASE, PLOTS_BASE, levelForXp, WEATHER,
} from './data.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(now, seed = Date.now() % 1e9) {
  const state = {
    version: 1,
    seed,
    coins: 50,
    xp: 0,
    day: 1,
    dayStart: now,
    weather: 'sunny',
    festival: null, // good in demand today
    plots: Array.from({ length: PLOTS_BASE }, () => ({ crop: null, progress: 0 })),
    animals: [],
    inventory: {},
    prices: Object.fromEntries(Object.keys(GOODS).map((g) => [g, 1])),
    trend: Object.fromEntries(Object.keys(GOODS).map((g) => [g, 0])),
    orders: [],
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((u) => [u, 0])),
    cart: {},
    log: [],
    stats: { harvested: 0, sold: 0, earned: 0, orders: 0, trips: 0 },
    won: false,
    wonDay: null,
    lastTick: now,
  };
  state.orders = makeOrders(state, 3);
  return state;
}

function rng(state) {
  state.seed = (state.seed + 1) >>> 0;
  return mulberry32(state.seed)();
}

// ---------- derived values ----------

export function level(state) {
  return levelForXp(state.xp);
}

export function upgradeInfo(state, id) {
  const lvl = state.upgrades[id];
  return lvl > 0 ? UPGRADES[id].levels[lvl - 1] : null;
}

export function plotCount(state) {
  return upgradeInfo(state, 'field')?.plots || PLOTS_BASE;
}

export function cartCapacity(state) {
  return upgradeInfo(state, 'cart')?.capacity || CART_BASE;
}

export function barnSlots(state) {
  return upgradeInfo(state, 'barn')?.slots || 0;
}

export function priceBonus(state) {
  return upgradeInfo(state, 'stall')?.bonus || 1;
}

export function growthSpeed(state) {
  const w = upgradeInfo(state, 'water');
  const weather = w?.weatherproof ? 1 : WEATHER[state.weather].speed;
  return (w?.speed || 1) * weather;
}

export function hasTool(state, n) {
  return state.upgrades.tools >= n;
}

export function cropUnlocked(state, id) {
  return CROPS[id].level <= level(state);
}

export function animalUnlocked(state, id) {
  return ANIMALS[id].level <= level(state) && state.upgrades.barn >= ANIMALS[id].barn;
}

/** Town price for one unit today. */
export function townPrice(state, good) {
  const festival = state.festival === good ? 1.8 : 1;
  return Math.max(1, Math.round(GOODS[good].price * state.prices[good] * festival * priceBonus(state)));
}

export function peddlerPrice(state, good) {
  return Math.max(1, Math.round(GOODS[good].price * PEDDLER_RATE));
}

export function cartLoad(state) {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}

export function cartValue(state) {
  return Object.entries(state.cart).reduce((sum, [g, q]) => sum + q * townPrice(state, g), 0);
}

function log(state, text) {
  state.log.unshift({ day: state.day, text });
  if (state.log.length > 30) state.log.length = 30;
}

function gainXp(state, amount) {
  const before = level(state);
  state.xp += Math.max(1, Math.round(amount));
  const after = level(state);
  if (after > before) log(state, `Level ${after}! New things in the shop.`);
  return after > before;
}

// ---------- time ----------

/** Advance the farm to `now`. Safe to call often; also catches up after being away. */
export function tick(state, now) {
  let dt = now - state.lastTick;
  if (dt <= 0) return state;
  if (dt > OFFLINE_CAP_MS) dt = OFFLINE_CAP_MS;
  const speed = growthSpeed(state);
  for (const p of state.plots) {
    if (p.crop && p.progress < 1) p.progress = Math.min(1, p.progress + (dt * speed) / CROPS[p.crop].grow);
  }
  for (const a of state.animals) {
    a.acc += dt;
    const cycle = ANIMALS[a.type].cycle;
    while (a.acc >= cycle && a.stored < ANIMAL_STORE) {
      a.acc -= cycle;
      a.stored++;
    }
    if (a.stored >= ANIMAL_STORE) a.acc = Math.min(a.acc, cycle); // a full animal does not bank time
  }
  state.lastTick = now;
  rescueIfStuck(state);
  // New days: prices move, weather changes, orders refresh, crows visit.
  let guard = 0;
  while (now - state.dayStart >= DAY_MS && guard++ < 10000) {
    state.dayStart += DAY_MS;
    newDay(state);
  }
  return state;
}

/** Nothing growing, nothing to sell, not enough for a seed: a neighbour helps out. */
function rescueIfStuck(state) {
  const growing = state.plots.some((p) => p.crop);
  const stock = Object.values(state.inventory).reduce((a, b) => a + b, 0) + cartLoad(state);
  const produce = state.animals.some((a) => a.stored > 0 || true) && state.animals.length > 0;
  if (!growing && stock === 0 && !produce && state.coins < cheapestSeed(state)) {
    state.coins += 2 * CROPS.wheat.seed;
    log(state, 'Your neighbour lends you a handful of coins for seed. Pay it forward.');
  }
}

function newDay(state) {
  state.day++;
  for (const g of Object.keys(GOODS)) {
    const old = state.prices[g];
    const drift = (rng(state) - 0.5) * 0.36 + (1 - old) * 0.15; // random walk pulled toward 1
    const next = Math.min(2, Math.max(0.5, old + drift));
    state.prices[g] = Math.round(next * 100) / 100;
    state.trend[g] = next > old + 0.02 ? 1 : next < old - 0.02 ? -1 : 0;
  }
  const w = rng(state);
  state.weather = w < 0.55 ? 'sunny' : w < 0.75 ? 'rain' : w < 0.9 ? 'mist' : 'heat';
  const unlocked = Object.keys(GOODS).filter((g) => GOODS[g].level <= level(state));
  state.festival = rng(state) < 0.3 ? unlocked[Math.floor(rng(state) * unlocked.length)] : null;
  if (state.festival) log(state, `${GOODS[state.festival].name} festival in town today: prices ×1.8.`);
  state.orders = state.orders.filter((o) => o.expires > state.day);
  while (state.orders.length < 3) state.orders.push(makeOrder(state));
  // Crows take one growing crop some days, but never one of your last two: a bad night must
  // not end the game.
  if (!state.upgrades.scarecrow && rng(state) < 0.35) {
    const growing = state.plots.filter((p) => p.crop && p.progress < 1);
    if (growing.length >= 3) {
      const victim = growing[Math.floor(rng(state) * growing.length)];
      log(state, `Crows ate your ${CROPS[victim.crop].name.toLowerCase()}. A scarecrow would stop that.`);
      victim.crop = null;
      victim.progress = 0;
    }
  }
}

// ---------- orders ----------

function makeOrder(state) {
  const lv = level(state);
  const pool = Object.keys(GOODS).filter((g) => GOODS[g].level <= lv);
  const good = pool[Math.floor(rng(state) * pool.length)];
  const qty = Math.max(2, Math.round((2 + rng(state) * 4) * (1 + lv * 0.15)));
  const bonus = 1.4 + rng(state) * 0.5;
  const names = ['The baker', 'The innkeeper', 'A travelling cook', 'The school', 'The mayor', 'A market trader', 'The weaver', 'The dairy'];
  return {
    id: `${state.day}-${Math.floor(rng(state) * 1e6)}`,
    who: names[Math.floor(rng(state) * names.length)],
    good,
    qty,
    pay: Math.round(GOODS[good].price * qty * bonus),
    expires: state.day + 2,
  };
}

function makeOrders(state, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeOrder(state));
  return out;
}

export function canFulfil(state, order) {
  return (state.inventory[order.good] || 0) >= order.qty;
}

export function fulfil(state, orderId) {
  const i = state.orders.findIndex((o) => o.id === orderId);
  if (i < 0) return false;
  const o = state.orders[i];
  if (!canFulfil(state, o)) return false;
  state.inventory[o.good] -= o.qty;
  state.coins += o.pay;
  state.stats.earned += o.pay;
  state.stats.orders++;
  gainXp(state, o.pay / 4);
  log(state, `${o.who} paid ${o.pay} for ${o.qty} ${GOODS[o.good].name.toLowerCase()}.`);
  state.orders.splice(i, 1);
  state.orders.push(makeOrder(state));
  return true;
}

// ---------- farming ----------

export function plant(state, index, crop) {
  const p = state.plots[index];
  if (!p || p.crop || !CROPS[crop] || !cropUnlocked(state, crop)) return false;
  if (state.coins < CROPS[crop].seed) return false;
  state.coins -= CROPS[crop].seed;
  p.crop = crop;
  p.progress = 0;
  return true;
}

export function plantAll(state, crop) {
  if (!hasTool(state, 1)) return 0;
  let n = 0;
  state.plots.forEach((p, i) => {
    if (!p.crop && plant(state, i, crop)) n++;
  });
  return n;
}

export function harvest(state, index) {
  const p = state.plots[index];
  if (!p || !p.crop || p.progress < 1) return null;
  const crop = p.crop;
  state.inventory[crop] = (state.inventory[crop] || 0) + 1;
  state.stats.harvested++;
  gainXp(state, CROPS[crop].price / 4);
  p.crop = null;
  p.progress = 0;
  if (hasTool(state, 3)) {
    // The tractor replants for free.
    p.crop = crop;
    p.progress = 0;
  }
  return crop;
}

export function harvestAll(state) {
  if (!hasTool(state, 2)) return 0;
  let n = 0;
  state.plots.forEach((p, i) => {
    if (p.crop && p.progress >= 1 && harvest(state, i)) n++;
  });
  return n;
}

export function buyAnimal(state, type) {
  if (!animalUnlocked(state, type)) return false;
  if (state.animals.length >= barnSlots(state)) return false;
  if (state.coins < ANIMALS[type].cost) return false;
  state.coins -= ANIMALS[type].cost;
  state.animals.push({ type, acc: 0, stored: 0 });
  log(state, `A new ${ANIMALS[type].name.toLowerCase()} joins the farm.`);
  return true;
}

export function collect(state, index) {
  const a = state.animals[index];
  if (!a || a.stored <= 0) return 0;
  const product = ANIMALS[a.type].product;
  const n = a.stored;
  state.inventory[product] = (state.inventory[product] || 0) + n;
  gainXp(state, (PRODUCTS[product].price * n) / 4);
  a.stored = 0;
  return n;
}

export function collectAll(state) {
  let n = 0;
  state.animals.forEach((_, i) => {
    n += collect(state, i);
  });
  return n;
}

// ---------- selling ----------

export function load(state, good, qty) {
  const have = state.inventory[good] || 0;
  const room = cartCapacity(state) - cartLoad(state);
  const n = Math.max(0, Math.min(qty, have, room));
  if (n <= 0) return 0;
  state.inventory[good] = have - n;
  state.cart[good] = (state.cart[good] || 0) + n;
  return n;
}

export function unload(state, good, qty = Infinity) {
  const n = Math.min(qty, state.cart[good] || 0);
  if (n <= 0) return 0;
  state.cart[good] -= n;
  if (state.cart[good] <= 0) delete state.cart[good];
  state.inventory[good] = (state.inventory[good] || 0) + n;
  return n;
}

/** Load the cart with the most valuable goods first. */
export function loadBest(state) {
  const goods = Object.keys(state.inventory)
    .filter((g) => state.inventory[g] > 0)
    .sort((a, b) => townPrice(state, b) - townPrice(state, a));
  let n = 0;
  for (const g of goods) n += load(state, g, Infinity);
  return n;
}

/** The trip to town: everything in the cart sells at today's prices. */
export function sellCart(state) {
  const earned = cartValue(state);
  const count = cartLoad(state);
  if (count === 0) return 0;
  state.coins += earned;
  state.stats.earned += earned;
  state.stats.sold += count;
  state.stats.trips++;
  gainXp(state, earned / 5);
  log(state, `Market day: ${count} goods sold for ${earned} coins.`);
  state.cart = {};
  return earned;
}

export function sellToPeddler(state, good, qty) {
  const n = Math.min(qty, state.inventory[good] || 0);
  if (n <= 0) return 0;
  const earned = n * peddlerPrice(state, good);
  state.inventory[good] -= n;
  state.coins += earned;
  state.stats.earned += earned;
  state.stats.sold += n;
  gainXp(state, earned / 8);
  return earned;
}

// ---------- shop ----------

export function nextUpgrade(state, id) {
  const lvl = state.upgrades[id];
  return UPGRADES[id].levels[lvl] || null;
}

export function canBuy(state, id) {
  const next = nextUpgrade(state, id);
  return !!next && state.coins >= next.cost && level(state) >= next.level;
}

export function buyUpgrade(state, id) {
  const next = nextUpgrade(state, id);
  if (!next || !canBuy(state, id)) return false;
  state.coins -= next.cost;
  state.upgrades[id]++;
  if (id === 'field') {
    while (state.plots.length < next.plots) state.plots.push({ crop: null, progress: 0 });
  }
  if (next.win && !state.won) {
    state.won = true;
    state.wonDay = state.day;
    log(state, `The Golden Tractor is yours on day ${state.day}. Master Merchant!`);
  } else log(state, `Bought: ${next.name}.`);
  gainXp(state, next.cost / 10);
  return true;
}

/** The cheapest way to earn: is the player stuck? (Never, thanks to the peddler.) */
export function cheapestSeed(state) {
  return Math.min(...Object.values(CROPS).filter((c) => c.level <= level(state)).map((c) => c.seed));
}
