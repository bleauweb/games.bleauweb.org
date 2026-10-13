// Workshop: buy materials, craft parts and goods at stations, sell or deliver orders, upgrade.

export const DAY_MS = 90_000;
export const OFFLINE_CAP_MS = 8 * 3600_000;

export const MATERIALS = {
  wood: { name: 'Wood', price: 4 },
  ore: { name: 'Iron ore', price: 6 },
  leather: { name: 'Leather', price: 8 },
  cloth: { name: 'Cloth', price: 7 },
  gem: { name: 'Gemstone', price: 40, level: 3 },
};

export const STATIONS = {
  bench: { name: 'Workbench' },
  furnace: { name: 'Furnace' },
  anvil: { name: 'Anvil' },
  jeweler: { name: 'Jeweller’s table', upgrade: 'jeweler' },
};

export const RECIPES = {
  plank: { name: 'Plank', station: 'bench', time: 8_000, needs: { wood: 2 }, price: 12, level: 1 },
  strap: { name: 'Leather strap', station: 'bench', time: 6_000, needs: { leather: 1 }, price: 12, level: 1 },
  ingot: { name: 'Iron ingot', station: 'furnace', time: 12_000, needs: { ore: 2 }, price: 20, level: 1 },
  horseshoe: { name: 'Horseshoe', station: 'anvil', time: 10_000, needs: { ingot: 1 }, price: 36, level: 1 },
  hammer: { name: 'Hammer', station: 'anvil', time: 15_000, needs: { plank: 1, ingot: 1 }, price: 55, level: 1 },
  bucket: { name: 'Bucket', station: 'bench', time: 14_000, needs: { plank: 3, strap: 1 }, price: 70, level: 1 },
  lantern: { name: 'Lantern', station: 'anvil', time: 25_000, needs: { ingot: 1, plank: 1, cloth: 1 }, price: 110, level: 2 },
  saddle: { name: 'Saddle', station: 'bench', time: 30_000, needs: { strap: 2, plank: 1, cloth: 1 }, price: 130, level: 2 },
  ring: { name: 'Ring', station: 'jeweler', time: 20_000, needs: { ingot: 1, gem: 1 }, price: 160, level: 3 },
  clock: { name: 'Clock', station: 'jeweler', time: 60_000, needs: { ingot: 3, gem: 2, plank: 1, cloth: 1 }, price: 900, level: 4 },
  greatclock: { name: 'The Great Clock', station: 'jeweler', time: 120_000, needs: { clock: 1, gem: 3, ingot: 2 }, price: 0, level: 5, masterwork: true },
};

export const UPGRADES = {
  stations: {
    name: 'Stations',
    base: 'One job at a time at each station.',
    levels: [
      { name: 'Second bench', cost: 300, level: 1, desc: 'Two jobs at once at every station', slots: 2 },
      { name: 'Full crew', cost: 2000, level: 4, desc: 'Three jobs at once at every station', slots: 3 },
    ],
  },
  tools: {
    name: 'Tools',
    base: 'Plain tools.',
    levels: [
      { name: 'Good steel', cost: 250, level: 1, desc: 'Everything crafts 25% faster', speed: 1.25 },
      { name: 'Fine tools', cost: 1200, level: 3, desc: 'Everything crafts 60% faster', speed: 1.6 },
    ],
  },
  bellows: {
    name: 'Bellows',
    base: 'A hand bellows on the furnace.',
    levels: [{ name: 'Water-driven bellows', cost: 500, level: 2, desc: 'Ingots in half the time', furnace: 2 }],
  },
  jeweler: {
    name: 'Jeweller’s table',
    base: 'No fine work yet.',
    levels: [{ name: 'Jeweller’s table', cost: 800, level: 3, desc: 'Rings, clocks… and the masterwork' }],
  },
  supplier: {
    name: 'Supplier',
    base: 'You buy at the market rate.',
    levels: [
      { name: 'Standing order', cost: 400, level: 2, desc: 'Materials 15% cheaper', discount: 0.85 },
      { name: 'Guild contract', cost: 1800, level: 4, desc: 'Materials 30% cheaper', discount: 0.7 },
    ],
  },
  apprentice: {
    name: 'Apprentice',
    base: 'You queue every job yourself.',
    levels: [{ name: 'Apprentice', cost: 1000, level: 3, desc: 'Each station repeats its last job while materials last' }],
  },
};

export function xpForLevel(n) {
  return n <= 1 ? 0 : Math.round(120 * (n - 1) ** 1.6);
}
export function levelForXp(xp) {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

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
function rng(state) {
  state.seed = (state.seed + 1) >>> 0;
  return mulberry32(state.seed)();
}

export function newGame(now, seed = Date.now() % 1e9) {
  const state = {
    version: 1, seed, coins: 120, xp: 0, day: 1, dayStart: now,
    prices: Object.fromEntries(Object.keys(MATERIALS).map((m) => [m, 1])),
    inventory: {}, // materials, parts and goods all live here
    stations: Object.fromEntries(Object.keys(STATIONS).map((s) => [s, { jobs: [], last: null, repeat: false }])),
    orders: [], upgrades: Object.fromEntries(Object.keys(UPGRADES).map((u) => [u, 0])),
    log: [], stats: { crafted: 0, sold: 0, earned: 0, orders: 0 }, won: false, wonDay: null, lastTick: now,
  };
  state.orders = [makeOrder(state), makeOrder(state), makeOrder(state)];
  return state;
}

function log(state, text) {
  state.log.unshift({ day: state.day, text });
  if (state.log.length > 30) state.log.length = 30;
}
export function level(state) { return levelForXp(state.xp); }
function gainXp(state, n) {
  const before = level(state);
  state.xp += Math.max(1, Math.round(n));
  if (level(state) > before) log(state, `Level ${level(state)}! New recipes and upgrades.`);
}
export function upgradeInfo(state, id) { const l = state.upgrades[id]; return l > 0 ? UPGRADES[id].levels[l - 1] : null; }
export function slots(state) { return upgradeInfo(state, 'stations')?.slots || 1; }
export function speed(state, station) { return (upgradeInfo(state, 'tools')?.speed || 1) * (station === 'furnace' ? upgradeInfo(state, 'bellows')?.furnace || 1 : 1); }
export function discount(state) { return upgradeInfo(state, 'supplier')?.discount || 1; }
export function stationOpen(state, id) { const u = STATIONS[id].upgrade; return !u || state.upgrades[u] > 0; }
export function recipeUnlocked(state, id) { const r = RECIPES[id]; return r.level <= level(state) && stationOpen(state, r.station); }
export function materialPrice(state, m) { return Math.max(1, Math.round(MATERIALS[m].price * state.prices[m] * discount(state))); }
export function have(state, item) { return state.inventory[item] || 0; }
export function canCraft(state, id) {
  if (!recipeUnlocked(state, id)) return false;
  return Object.entries(RECIPES[id].needs).every(([k, n]) => have(state, k) >= n);
}
export function jobMs(state, id) { return Math.round(RECIPES[id].time / speed(state, RECIPES[id].station)); }

export function tick(state, now) {
  let dt = now - state.lastTick;
  if (dt <= 0) return state;
  if (dt > OFFLINE_CAP_MS) {
    now = state.lastTick + OFFLINE_CAP_MS;
    dt = OFFLINE_CAP_MS;
  }
  // Stations: active jobs progress; queued jobs start when a slot frees.
  for (const [sid, st] of Object.entries(state.stations)) {
    let guard = 0;
    while (guard++ < 1000) {
      const active = st.jobs.filter((j) => j.startedAt !== null);
      const waiting = st.jobs.filter((j) => j.startedAt === null);
      while (active.length < slots(state) && waiting.length) {
        const j = waiting.shift();
        j.startedAt = state.lastTick;
        active.push(j);
      }
      const finished = active.filter((j) => j.startedAt + j.ms <= now);
      if (!finished.length) break;
      for (const j of finished) {
        state.inventory[j.recipe] = (state.inventory[j.recipe] || 0) + 1;
        state.stats.crafted++;
        gainXp(state, RECIPES[j.recipe].price / 6 + 2);
        st.jobs.splice(st.jobs.indexOf(j), 1);
        if (RECIPES[j.recipe].masterwork && !state.won) {
          state.won = true;
          state.wonDay = state.day;
          log(state, `The Great Clock is finished on day ${state.day}. Master Craftsman!`);
        }
        if (st.repeat && upgradeInfo(state, 'apprentice') && canCraft(state, j.recipe) && st.jobs.length < slots(state) * 2) queue(state, j.recipe, j.startedAt + j.ms);
      }
      // Jobs that start after a finish begin at that finish time, so long absences chain correctly.
      for (const j of st.jobs) if (j.startedAt === null) j.startedAt = null;
      const nextStart = Math.max(...finished.map((j) => j.startedAt + j.ms));
      for (const j of st.jobs.filter((x) => x.startedAt === null).slice(0, slots(state))) j.startedAt = nextStart;
    }
  }
  state.lastTick = now;
  let guard = 0;
  while (now - state.dayStart >= DAY_MS && guard++ < 10000) {
    state.dayStart += DAY_MS;
    newDay(state);
  }
  return state;
}

function newDay(state) {
  state.day++;
  for (const m of Object.keys(MATERIALS)) {
    const old = state.prices[m];
    const next = old + (rng(state) - 0.5) * 0.3 + (1 - old) * 0.2;
    state.prices[m] = Math.round(Math.min(1.5, Math.max(0.7, next)) * 100) / 100;
  }
  state.orders = state.orders.filter((o) => o.expires > state.day);
  while (state.orders.length < 3) state.orders.push(makeOrder(state));
}

function makeOrder(state) {
  const lv = level(state);
  const pool = Object.keys(RECIPES).filter((r) => !RECIPES[r].masterwork && RECIPES[r].level <= lv && RECIPES[r].price >= 36);
  const recipe = pool[Math.floor(rng(state) * pool.length)];
  const qty = 1 + Math.floor(rng(state) * (RECIPES[recipe].price > 100 ? 2 : 4));
  const bonus = 1.5 + rng(state) * 0.4;
  const who = ['The farrier', 'The miller', 'A traveller', 'The manor', 'The stables', 'The chapel', 'The inn', 'A merchant'][Math.floor(rng(state) * 8)];
  return { id: `${state.day}-${Math.floor(rng(state) * 1e6)}`, who, recipe, qty, pay: Math.round(RECIPES[recipe].price * qty * bonus), expires: state.day + 3 };
}

export function buyMaterial(state, m, qty) {
  if (MATERIALS[m].level && MATERIALS[m].level > level(state)) return 0;
  const unit = materialPrice(state, m);
  const n = Math.max(0, Math.min(qty, Math.floor(state.coins / unit)));
  if (n <= 0) return 0;
  state.coins -= n * unit;
  state.inventory[m] = (state.inventory[m] || 0) + n;
  return n;
}

/** Queue a craft: materials are taken now. */
export function queue(state, id, at = state.lastTick) {
  if (!canCraft(state, id)) return false;
  const r = RECIPES[id];
  const st = state.stations[r.station];
  if (st.jobs.length >= slots(state) * 3) return false;
  for (const [k, n] of Object.entries(r.needs)) state.inventory[k] -= n;
  const active = st.jobs.filter((j) => j.startedAt !== null).length;
  st.jobs.push({ recipe: id, ms: jobMs(state, id), startedAt: active < slots(state) ? at : null });
  st.last = id;
  return true;
}

export function setRepeat(state, station, on) {
  if (!upgradeInfo(state, 'apprentice')) return false;
  state.stations[station].repeat = on;
  return true;
}

export function sellItem(state, id, qty) {
  const n = Math.min(qty, have(state, id));
  if (n <= 0 || !RECIPES[id] || RECIPES[id].masterwork) return 0;
  const earned = n * RECIPES[id].price;
  state.inventory[id] -= n;
  state.coins += earned;
  state.stats.sold += n;
  state.stats.earned += earned;
  gainXp(state, earned / 10);
  return earned;
}

export function canFulfil(state, o) { return have(state, o.recipe) >= o.qty; }
export function fulfil(state, id) {
  const i = state.orders.findIndex((o) => o.id === id);
  if (i < 0 || !canFulfil(state, state.orders[i])) return false;
  const o = state.orders[i];
  state.inventory[o.recipe] -= o.qty;
  state.coins += o.pay;
  state.stats.earned += o.pay;
  state.stats.orders++;
  gainXp(state, o.pay / 6);
  log(state, `${o.who} paid ${o.pay} for ${o.qty} ${RECIPES[o.recipe].name.toLowerCase()}.`);
  state.orders.splice(i, 1);
  state.orders.push(makeOrder(state));
  return true;
}

export function nextUpgrade(state, id) { return UPGRADES[id].levels[state.upgrades[id]] || null; }
export function canBuy(state, id) { const n = nextUpgrade(state, id); return !!n && state.coins >= n.cost && level(state) >= n.level; }
export function buyUpgrade(state, id) {
  if (!canBuy(state, id)) return false;
  const n = nextUpgrade(state, id);
  state.coins -= n.cost;
  state.upgrades[id]++;
  log(state, `Bought: ${n.name}.`);
  gainXp(state, n.cost / 12);
  return true;
}

/** Total material cost of a recipe at today's prices, counting parts at their own cost. */
export function costOf(state, id) {
  return Object.entries(RECIPES[id].needs).reduce((sum, [k, n]) => sum + n * (MATERIALS[k] ? materialPrice(state, k) : costOf(state, k)), 0);
}
