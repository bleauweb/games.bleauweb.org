// Shipping Lanes: buy low in one port, sail, sell high in another. Pure state over `now`.

export const DAY_MS = 60_000;
export const OFFLINE_CAP_MS = 6 * 3600_000;

export const GOODS = {
  timber: { name: 'Timber', price: 15 },
  wine: { name: 'Wine', price: 20 },
  cotton: { name: 'Cotton', price: 18 },
  iron: { name: 'Iron', price: 25 },
  cloth: { name: 'Cloth', price: 30 },
  tea: { name: 'Tea', price: 45 },
  spices: { name: 'Spices', price: 60 },
  silk: { name: 'Silk', price: 80 },
  porcelain: { name: 'Porcelain', price: 90 },
};

// sells: produced here (cheap). wants: in demand here (dear). Map is 100 × 100.
export const PORTS = [
  { id: 'lisbon', name: 'Lisbon', x: 10, y: 28, sells: { wine: 0.55, timber: 0.7 }, wants: { spices: 1.6, tea: 1.5, silk: 1.5, porcelain: 1.6 } },
  { id: 'tunis', name: 'Tunis', x: 28, y: 40, sells: { cloth: 0.6, iron: 0.7 }, wants: { timber: 1.5, tea: 1.4 } },
  { id: 'alexandria', name: 'Alexandria', x: 46, y: 46, sells: { cotton: 0.55, iron: 0.75 }, wants: { timber: 1.6, wine: 1.5, porcelain: 1.4 } },
  { id: 'zanzibar', name: 'Zanzibar', x: 56, y: 72, sells: { spices: 0.5, timber: 0.75 }, wants: { cloth: 1.5, iron: 1.5, wine: 1.4 } },
  { id: 'bombay', name: 'Bombay', x: 72, y: 54, sells: { tea: 0.55, cotton: 0.65, spices: 0.7 }, wants: { iron: 1.5, cloth: 1.4, wine: 1.6 } },
  { id: 'canton', name: 'Canton', x: 92, y: 42, sells: { silk: 0.5, porcelain: 0.5, tea: 0.65 }, wants: { cotton: 1.5, iron: 1.6, spices: 1.3 } },
];

export const UPGRADES = {
  ship: {
    name: 'Ship',
    base: 'A sloop. Holds 20 crates.',
    levels: [
      { name: 'Brig', cost: 900, desc: 'Holds 50 crates', capacity: 50 },
      { name: 'Galleon', cost: 3500, desc: 'Holds 120 crates', capacity: 120 },
      { name: 'Clipper', cost: 9000, desc: 'Holds 300 crates', capacity: 300 },
    ],
  },
  sails: {
    name: 'Sails',
    base: 'Plain canvas.',
    levels: [
      { name: 'Fine sails', cost: 600, desc: 'Voyages 30% shorter', speed: 1.3 },
      { name: 'Racing rig', cost: 2500, desc: 'Voyages 45% shorter', speed: 1.8 },
    ],
  },
  hull: {
    name: 'Hull',
    base: 'Storms can wash a fifth of the cargo overboard.',
    levels: [
      { name: 'Reinforced hull', cost: 800, desc: 'Half as many storm losses', storm: 0.5 },
      { name: 'Copper-bottomed', cost: 3000, desc: 'Storms take nothing', storm: 0 },
    ],
  },
  charts: {
    name: 'Charts',
    base: 'You know each port only from your last visit, plus what it is famous for.',
    levels: [{ name: 'Merchant charts', cost: 1200, desc: 'See today’s prices in every port', live: true }],
  },
  flagship: {
    name: 'Admiral’s flagship',
    base: 'The grandest ship on the sea. Buy it and retire rich.',
    levels: [{ name: 'Admiral’s flagship', cost: 20000, desc: 'Win the game', win: true }],
  },
};
export const CAPACITY_BASE = 20;

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

export function baseMult(port, good) {
  return port.sells[good] ?? port.wants[good] ?? 1;
}

export function newGame(now, seed = Date.now() % 1e9) {
  const state = {
    version: 1, seed, coins: 500, port: 'lisbon', voyage: null, cargo: {}, day: 1, dayStart: now,
    prices: {}, seen: {}, upgrades: Object.fromEntries(Object.keys(UPGRADES).map((u) => [u, 0])),
    log: [], stats: { voyages: 0, earned: 0, storms: 0 }, won: false, wonDay: null, lastTick: now,
  };
  for (const p of PORTS) state.prices[p.id] = Object.fromEntries(Object.keys(GOODS).map((g) => [g, baseMult(p, g)]));
  noteSeen(state);
  return state;
}

function log(state, text) {
  state.log.unshift({ day: state.day, text });
  if (state.log.length > 30) state.log.length = 30;
}

export function upgradeInfo(state, id) {
  const lvl = state.upgrades[id];
  return lvl > 0 ? UPGRADES[id].levels[lvl - 1] : null;
}
export function capacity(state) { return upgradeInfo(state, 'ship')?.capacity || CAPACITY_BASE; }
export function speed(state) { return upgradeInfo(state, 'sails')?.speed || 1; }
export function stormFactor(state) { return upgradeInfo(state, 'hull')?.storm ?? 1; }
export function hasCharts(state) { return !!upgradeInfo(state, 'charts')?.live; }
export function portById(id) { return PORTS.find((p) => p.id === id); }
export function cargoCount(state) { return Object.values(state.cargo).reduce((a, b) => a + b, 0); }

export function distance(a, b) {
  const pa = portById(a);
  const pb = portById(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}
export function voyageMs(state, from, to) {
  return Math.round((distance(from, to) * 420) / speed(state));
}
export function price(state, portId, good) {
  return Math.max(1, Math.round(GOODS[good].price * state.prices[portId][good]));
}
/** What the player knows about a port's price: live with charts, else the last visit. */
export function knownPrice(state, portId, good) {
  if (portId === state.port && !state.voyage) return { price: price(state, portId, good), live: true };
  if (hasCharts(state)) return { price: price(state, portId, good), live: true };
  const seen = state.seen[portId]?.[good];
  return seen ? { price: seen.price, day: seen.day, live: false } : null;
}
function noteSeen(state) {
  const p = state.port;
  state.seen[p] = state.seen[p] || {};
  for (const g of Object.keys(GOODS)) state.seen[p][g] = { price: price(state, p, g), day: state.day };
}

export function tick(state, now) {
  let dt = now - state.lastTick;
  if (dt <= 0) return state;
  if (dt > OFFLINE_CAP_MS) {
    now = state.lastTick + OFFLINE_CAP_MS;
    dt = OFFLINE_CAP_MS;
  }
  state.lastTick = now;
  if (state.voyage && now >= state.voyage.arriveAt) arrive(state);
  let guard = 0;
  while (now - state.dayStart >= DAY_MS && guard++ < 10000) {
    state.dayStart += DAY_MS;
    newDay(state);
  }
  return state;
}

function newDay(state) {
  state.day++;
  for (const p of PORTS) {
    for (const g of Object.keys(GOODS)) {
      const base = baseMult(p, g);
      const cur = state.prices[p.id][g];
      const next = cur + (rng(state) - 0.5) * 0.24 + (base - cur) * 0.2;
      state.prices[p.id][g] = Math.round(Math.min(base * 1.6, Math.max(base * 0.6, next)) * 100) / 100;
    }
  }
  if (!state.voyage) noteSeen(state);
}

export function buy(state, good, qty) {
  if (state.voyage) return 0;
  const unit = price(state, state.port, good);
  const room = capacity(state) - cargoCount(state);
  const n = Math.max(0, Math.min(qty, room, Math.floor(state.coins / unit)));
  if (n <= 0) return 0;
  state.coins -= n * unit;
  state.cargo[good] = (state.cargo[good] || 0) + n;
  return n;
}

export function sell(state, good, qty) {
  if (state.voyage) return 0;
  const n = Math.min(qty, state.cargo[good] || 0);
  if (n <= 0) return 0;
  const earned = n * price(state, state.port, good);
  state.cargo[good] -= n;
  if (state.cargo[good] <= 0) delete state.cargo[good];
  state.coins += earned;
  state.stats.earned += earned;
  return earned;
}

export function sail(state, to, now) {
  if (state.voyage || to === state.port || !portById(to)) return false;
  const ms = voyageMs(state, state.port, to);
  state.voyage = { from: state.port, to, departAt: now, arriveAt: now + ms };
  return true;
}

function arrive(state) {
  const v = state.voyage;
  const dist = distance(v.from, v.to);
  const chance = Math.min(0.5, 0.12 * (dist / 40)) * stormFactor(state);
  if (cargoCount(state) > 0 && rng(state) < chance) {
    let lost = 0;
    for (const g of Object.keys(state.cargo)) {
      const l = Math.floor(state.cargo[g] * 0.2);
      state.cargo[g] -= l;
      lost += l;
      if (state.cargo[g] <= 0) delete state.cargo[g];
    }
    state.stats.storms++;
    log(state, `A storm off ${portById(v.to).name}: ${lost} crates lost overboard.`);
  } else if (rng(state) < 0.25) log(state, `Fair winds into ${portById(v.to).name}.`);
  state.port = v.to;
  state.voyage = null;
  state.stats.voyages++;
  noteSeen(state);
}

export function nextUpgrade(state, id) { return UPGRADES[id].levels[state.upgrades[id]] || null; }
export function canBuy(state, id) { const n = nextUpgrade(state, id); return !!n && state.coins >= n.cost && !state.voyage; }
export function buyUpgrade(state, id) {
  if (!canBuy(state, id)) return false;
  const n = nextUpgrade(state, id);
  state.coins -= n.cost;
  state.upgrades[id]++;
  if (n.win && !state.won) {
    state.won = true;
    state.wonDay = state.day;
    log(state, `The Admiral’s flagship is yours on day ${state.day}.`);
  } else log(state, `Bought: ${n.name}.`);
  return true;
}

/** Best known trade from the current port: (profit per crate, good, destination). */
export function bestTrade(state) {
  let best = null;
  for (const g of Object.keys(GOODS)) {
    const here = price(state, state.port, g);
    for (const p of PORTS) {
      if (p.id === state.port) continue;
      const known = knownPrice(state, p.id, g);
      const there = known ? known.price : Math.round(GOODS[g].price * baseMult(p, g));
      const margin = there - here;
      if (!best || margin > best.margin) best = { good: g, to: p.id, margin, here, there };
    }
  }
  return best;
}
