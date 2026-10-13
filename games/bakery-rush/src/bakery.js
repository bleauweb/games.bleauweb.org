// Bakery Rush: buy ingredients, bake in limited ovens, sell to customers who arrive on their
// own, with a lunchtime rush every day. Reputation rises when people get what they came for.

export const DAY_MS = 90_000;
export const RUSH_MS = 25_000; // the first part of every day is the rush
export const OFFLINE_CAP_MS = 8 * 3600_000;

export const INGREDIENTS = {
  flour: { name: 'Flour', price: 3 },
  eggs: { name: 'Eggs', price: 2 },
  milk: { name: 'Milk', price: 2 },
  sugar: { name: 'Sugar', price: 3 },
  butter: { name: 'Butter', price: 4 },
  berries: { name: 'Berries', price: 6 },
  chocolate: { name: 'Chocolate', price: 8 },
};

export const RECIPES = {
  bread: { name: 'Bread', needs: { flour: 2, milk: 1 }, time: 30_000, yield: 4, price: 7, level: 1 },
  rolls: { name: 'Rolls', needs: { flour: 2, butter: 1 }, time: 20_000, yield: 6, price: 5, level: 1 },
  cookies: { name: 'Cookies', needs: { flour: 1, butter: 1, sugar: 1, chocolate: 1 }, time: 25_000, yield: 8, price: 6, level: 2 },
  muffins: { name: 'Muffins', needs: { flour: 2, eggs: 1, sugar: 1, berries: 1 }, time: 40_000, yield: 6, price: 9, level: 2 },
  brownies: { name: 'Brownies', needs: { flour: 2, eggs: 1, sugar: 2, chocolate: 2, butter: 1 }, time: 50_000, yield: 6, price: 12, level: 3 },
  pie: { name: 'Berry pie', needs: { flour: 2, butter: 2, berries: 2 }, time: 60_000, yield: 4, price: 22, level: 3 },
  cake: { name: 'Cake', needs: { flour: 3, eggs: 2, sugar: 2, butter: 1, milk: 1 }, time: 70_000, yield: 4, price: 30, level: 4 },
};

export const UPGRADES = {
  ovens: {
    name: 'Ovens',
    base: 'One oven.',
    levels: [
      { name: 'Second oven', cost: 200, level: 1, desc: 'Two batches at once', ovens: 2 },
      { name: 'Third oven', cost: 900, level: 3, desc: 'Three batches at once', ovens: 3 },
      { name: 'Bakehouse', cost: 3000, level: 5, desc: 'Four batches at once', ovens: 4 },
    ],
  },
  heat: {
    name: 'Heat',
    base: 'Baking at normal speed.',
    levels: [
      { name: 'Convection fans', cost: 350, level: 2, desc: 'Bakes 30% faster', speed: 1.3 },
      { name: 'Stone deck', cost: 1500, level: 4, desc: 'Bakes 60% faster', speed: 1.6 },
    ],
  },
  mixer: {
    name: 'Mixer',
    base: 'Mixing by hand.',
    levels: [
      { name: 'Stand mixer', cost: 500, level: 2, desc: 'Batches yield 50% more', yield: 1.5 },
      { name: 'Dough machine', cost: 2200, level: 4, desc: 'Batches yield double', yield: 2 },
    ],
  },
  counter: {
    name: 'Counter',
    base: 'A small counter.',
    levels: [
      { name: 'Glass display', cost: 300, level: 1, desc: 'More customers come in', traffic: 1.3 },
      { name: 'Café tables', cost: 1200, level: 3, desc: 'Many more customers', traffic: 1.7 },
    ],
  },
  coffee: {
    name: 'Coffee machine',
    base: 'No coffee.',
    levels: [{ name: 'Coffee machine', cost: 700, level: 2, desc: 'Every sale adds a 3¢ coffee', coffee: 3 }],
  },
  bike: {
    name: 'Delivery bike',
    base: 'No deliveries.',
    levels: [{ name: 'Delivery bike', cost: 1000, level: 3, desc: 'Sells one item every 8 seconds, rush or not', bike: 8_000 }],
  },
  whisk: {
    name: 'Golden Whisk',
    base: 'The baker’s prize. Buy it and the town is yours.',
    levels: [{ name: 'Golden Whisk', cost: 6000, level: 5, desc: 'Win the game', win: true }],
  },
};

export function xpForLevel(n) { return n <= 1 ? 0 : Math.round(120 * (n - 1) ** 1.6); }
export function levelForXp(xp) { let n = 1; while (xpForLevel(n + 1) <= xp) n++; return n; }

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
function rng(state) { state.seed = (state.seed + 1) >>> 0; return mulberry32(state.seed)(); }

export function newGame(now, seed = Date.now() % 1e9) {
  return {
    version: 1, seed, coins: 60, xp: 0, day: 1, dayStart: now, special: 'bread',
    prices: Object.fromEntries(Object.keys(INGREDIENTS).map((i) => [i, 1])),
    demand: Object.fromEntries(Object.keys(RECIPES).map((r) => [r, 1])),
    pantry: {}, ovens: [], // { recipe, startedAt, ms, qty }
    shelf: [], // { recipe, qty, day }
    reputation: 50, served: 0, lost: 0, nextCustomer: now + 4000, nextBike: now + 8000,
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((u) => [u, 0])),
    log: [], stats: { baked: 0, sold: 0, earned: 0, customers: 0, lostCustomers: 0 }, won: false, wonDay: null, lastTick: now,
  };
}

function log(state, text) { state.log.unshift({ day: state.day, text }); if (state.log.length > 30) state.log.length = 30; }
export function level(state) { return levelForXp(state.xp); }
function gainXp(state, n) { const b = level(state); state.xp += Math.max(1, Math.round(n)); if (level(state) > b) log(state, `Level ${level(state)}! New recipes and upgrades.`); }
export function upgradeInfo(state, id) { const l = state.upgrades[id]; return l > 0 ? UPGRADES[id].levels[l - 1] : null; }
export function ovenCount(state) { return upgradeInfo(state, 'ovens')?.ovens || 1; }
export function bakeSpeed(state) { return upgradeInfo(state, 'heat')?.speed || 1; }
export function yieldMult(state) { return upgradeInfo(state, 'mixer')?.yield || 1; }
export function traffic(state) { return upgradeInfo(state, 'counter')?.traffic || 1; }
export function recipeUnlocked(state, id) { return RECIPES[id].level <= level(state); }
export function ingredientPrice(state, i) { return Math.max(1, Math.round(INGREDIENTS[i].price * state.prices[i])); }
export function isRush(state, now) { return now - state.dayStart < RUSH_MS; }
export function repStars(state) { return Math.round((state.reputation / 100) * 5 * 2) / 2; }
export function priceBonus(state) { return 0.85 + (state.reputation / 100) * 0.45; }
/** Shelf price today for a recipe, fresh. */
export function sellPrice(state, recipe, dayBaked = state.day) {
  const fresh = state.day - dayBaked <= 0 ? 1 : 0.6;
  const special = state.special === recipe ? 1.3 : 1;
  return Math.max(1, Math.round(RECIPES[recipe].price * state.demand[recipe] * special * priceBonus(state) * fresh));
}
export function shelfCount(state, recipe = null) { return state.shelf.filter((s) => !recipe || s.recipe === recipe).reduce((n, s) => n + s.qty, 0); }
export function canBake(state, id) {
  if (!recipeUnlocked(state, id) || state.ovens.length >= ovenCount(state)) return false;
  return Object.entries(RECIPES[id].needs).every(([k, n]) => (state.pantry[k] || 0) >= n);
}
export function bakeMs(state, id) { return Math.round(RECIPES[id].time / bakeSpeed(state)); }

export function buy(state, ing, qty) {
  const unit = ingredientPrice(state, ing);
  const n = Math.max(0, Math.min(qty, Math.floor(state.coins / unit)));
  if (n <= 0) return 0;
  state.coins -= n * unit;
  state.pantry[ing] = (state.pantry[ing] || 0) + n;
  return n;
}

/** Buy from a farm inventory (Market Day): wheat → 2 flour, egg → eggs, milk → 2 milk, 1¢ each. */
export const FARM_GOODS = { wheat: { gives: 'flour', per: 2 }, egg: { gives: 'eggs', per: 1 }, milk: { gives: 'milk', per: 2 } };
export function buyFromFarm(state, farmInventory, good, qty) {
  const f = FARM_GOODS[good];
  const have = farmInventory[good] || 0;
  const n = Math.max(0, Math.min(qty, have, state.coins));
  if (!f || n <= 0) return 0;
  farmInventory[good] = have - n;
  state.coins -= n;
  state.pantry[f.gives] = (state.pantry[f.gives] || 0) + n * f.per;
  return n;
}

export function bake(state, id, now = state.lastTick) {
  if (!canBake(state, id)) return false;
  for (const [k, n] of Object.entries(RECIPES[id].needs)) state.pantry[k] -= n;
  state.ovens.push({ recipe: id, startedAt: now, ms: bakeMs(state, id), qty: Math.round(RECIPES[id].yield * yieldMult(state)) });
  return true;
}

function takeFromShelf(state, recipe, qty) {
  // Oldest first, so day-old goods move before fresh ones.
  let left = qty;
  state.shelf.sort((a, b) => a.day - b.day);
  for (const s of state.shelf) {
    if (s.recipe !== recipe || left <= 0) continue;
    const n = Math.min(left, s.qty);
    s.qty -= n;
    left -= n;
    state.coins += n * sellPrice(state, recipe, s.day);
    state.stats.earned += n * sellPrice(state, recipe, s.day);
  }
  state.shelf = state.shelf.filter((s) => s.qty > 0);
  return qty - left;
}

function customer(state, now) {
  const unlocked = Object.keys(RECIPES).filter((r) => recipeUnlocked(state, r));
  const weights = unlocked.map((r) => (r === state.special ? 3 : 1) * (shelfCount(state, r) > 0 ? 1.6 : 1));
  let r = rng(state) * weights.reduce((a, b) => a + b, 0);
  let want = unlocked[unlocked.length - 1];
  for (let i = 0; i < unlocked.length; i++) { r -= weights[i]; if (r <= 0) { want = unlocked[i]; break; } }
  const qty = 1 + (rng(state) < 0.35 ? 1 : 0) + (rng(state) < 0.15 ? 1 : 0);
  state.stats.customers++;
  const sold = takeFromShelf(state, want, qty);
  if (sold > 0) {
    state.served++;
    state.stats.sold += sold;
    const coffee = upgradeInfo(state, 'coffee')?.coffee || 0;
    state.coins += coffee;
    state.stats.earned += coffee;
    state.reputation = Math.min(100, state.reputation + 1.2);
    gainXp(state, sold * RECIPES[want].price / 3 + 1);
  } else {
    state.lost++;
    state.stats.lostCustomers++;
    state.reputation = Math.max(0, state.reputation - 2.5);
  }
  return { want, sold };
}

export function tick(state, now) {
  if (now <= state.lastTick) return state;
  if (now - state.lastTick > OFFLINE_CAP_MS) now = state.lastTick + OFFLINE_CAP_MS;
  // Replay everything in time order: ovens finishing, customers, the bike, and day changes.
  let guard = 0;
  while (guard++ < 20000) {
    const ovenT = state.ovens.length ? Math.min(...state.ovens.map((o) => o.startedAt + o.ms)) : Infinity;
    const bike = upgradeInfo(state, 'bike')?.bike;
    const bikeT = bike ? state.nextBike : Infinity;
    const dayT = state.dayStart + DAY_MS;
    const t = Math.min(ovenT, state.nextCustomer, bikeT, dayT);
    if (t > now) break;
    if (t === ovenT) {
      const o = state.ovens.find((x) => x.startedAt + x.ms === ovenT);
      state.shelf.push({ recipe: o.recipe, qty: o.qty, day: state.day });
      state.stats.baked += o.qty;
      gainXp(state, o.qty);
      state.ovens.splice(state.ovens.indexOf(o), 1);
    } else if (t === state.nextCustomer) {
      customer(state, t);
      const base = isRush(state, t) ? 1200 : 4000;
      state.nextCustomer += Math.round((base / traffic(state)) * (0.7 + rng(state) * 0.6));
    } else if (t === bikeT) {
      const stocked = Object.keys(RECIPES).filter((r) => shelfCount(state, r) > 0);
      if (stocked.length) {
        const r = stocked[Math.floor(rng(state) * stocked.length)];
        state.stats.sold += takeFromShelf(state, r, 1);
      }
      state.nextBike += bike;
    } else {
      state.dayStart += DAY_MS;
      newDay(state);
    }
  }
  state.lastTick = now;
  return state;
}

function newDay(state) {
  state.day++;
  for (const i of Object.keys(INGREDIENTS)) {
    const o = state.prices[i];
    state.prices[i] = Math.round(Math.min(1.5, Math.max(0.7, o + (rng(state) - 0.5) * 0.3 + (1 - o) * 0.2)) * 100) / 100;
  }
  for (const r of Object.keys(RECIPES)) {
    const o = state.demand[r];
    state.demand[r] = Math.round(Math.min(1.4, Math.max(0.7, o + (rng(state) - 0.5) * 0.3 + (1 - o) * 0.2)) * 100) / 100;
  }
  const unlocked = Object.keys(RECIPES).filter((r) => recipeUnlocked(state, r));
  state.special = unlocked[Math.floor(rng(state) * unlocked.length)];
  const thrown = state.shelf.filter((s) => state.day - s.day >= 2).reduce((n, s) => n + s.qty, 0);
  state.shelf = state.shelf.filter((s) => state.day - s.day < 2);
  if (thrown) log(state, `${thrown} stale items thrown out.`);
  log(state, `Day ${state.day}: today’s special is ${RECIPES[state.special].name.toLowerCase()} (+30%).`);
  state.served = 0;
  state.lost = 0;
  // Never stuck: if the pantry and shelf are empty and coins cannot buy a loaf's worth, a friend helps.
  const stock = Object.values(state.pantry).reduce((a, b) => a + b, 0) + shelfCount(state);
  if (stock === 0 && state.ovens.length === 0 && state.coins < 8) {
    state.coins += 20;
    log(state, 'The miller sends a sack of flour on credit. Twenty coins to get going.');
  }
}

export function nextUpgrade(state, id) { return UPGRADES[id].levels[state.upgrades[id]] || null; }
export function canBuy(state, id) { const n = nextUpgrade(state, id); return !!n && state.coins >= n.cost && level(state) >= n.level; }
export function buyUpgrade(state, id) {
  if (!canBuy(state, id)) return false;
  const n = nextUpgrade(state, id);
  state.coins -= n.cost;
  state.upgrades[id]++;
  if (n.win && !state.won) { state.won = true; state.wonDay = state.day; log(state, `The Golden Whisk is yours on day ${state.day}!`); }
  else log(state, `Bought: ${n.name}.`);
  gainXp(state, n.cost / 12);
  return true;
}

export function costOf(state, id) {
  return Object.entries(RECIPES[id].needs).reduce((s, [k, n]) => s + n * ingredientPrice(state, k), 0);
}
