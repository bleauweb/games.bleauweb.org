// Forecaster: a small town's weather, simulated; the player sees only what their equipment
// shows and predicts tomorrow. Points buy better equipment. Five perfect days in a row wins.

export const CONDITIONS = ['sunny', 'cloudy', 'rain', 'snow'];
export const WINDS = ['calm', 'breezy', 'windy'];
export const SEASON_DAYS = 120; // one year
export const PERFECT = 100;
export const WIN_STREAK = 5;

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
function gauss(state) {
  return (rng(state) + rng(state) + rng(state) - 1.5) * 2; // roughly normal, sd ≈ 1
}

// ---------- equipment ----------
export const EQUIPMENT = {
  thermometer: { name: 'Thermometer', levels: [{ cost: 0, desc: 'Reads to the nearest 5°' }, { cost: 80, desc: 'Reads to the degree' }] },
  almanac: { name: 'Almanac', levels: [{ cost: 60, desc: 'The usual temperature for the date' }] },
  barometer: { name: 'Barometer', levels: [{ cost: 100, desc: 'Rising, steady or falling' }, { cost: 250, desc: 'Pressure and the 24-hour change' }] },
  hygrometer: { name: 'Hygrometer', levels: [{ cost: 150, desc: 'Humidity to the nearest 10%' }] },
  anemometer: { name: 'Anemometer', levels: [{ cost: 120, desc: 'Wind speed, not just direction' }] },
  neighbours: { name: 'Neighbour reports', levels: [{ cost: 200, desc: 'Weather in the town one day upwind' }, { cost: 350, desc: 'And the town two days upwind' }] },
  satellite: { name: 'Satellite feed', levels: [{ cost: 400, desc: 'How far away the next weather system is' }] },
  radar: { name: 'Radar', levels: [{ cost: 500, desc: 'Rain within a day of town' }] },
  model: { name: 'Computer model', levels: [{ cost: 500, desc: 'A rough model forecast (each part right 60% of the time)', skill: 0.6 }, { cost: 1000, desc: 'A good model (75%)', skill: 0.75 }, { cost: 1800, desc: 'The national model (90%)', skill: 0.9 }] },
};

// ---------- the atmosphere ----------
function seasonalMean(day) {
  // Warmest around day 30 of the year, coldest around day 90. Mean 12°, swing ±13°.
  return 12 + 13 * Math.cos(((day % SEASON_DAYS) / SEASON_DAYS) * 2 * Math.PI - Math.PI / 6);
}

function conditionFor(w) {
  // Rain when a system is overhead and the air is moist; snow when it is cold enough.
  const wet = w.front <= 0 && w.front > -1.5 && w.humidity >= 55;
  if (wet) return w.temp <= 1 ? 'snow' : 'rain';
  if (w.humidity >= 70 || (w.front > 0 && w.front <= 1) || (w.front <= 0 && w.front > -2)) return 'cloudy';
  return 'sunny';
}

function windFor(w) {
  if (w.front <= 1 && w.front > -2) return w.gust >= 0.55 ? 'windy' : 'breezy';
  if (w.gust >= 0.72 || w.pressureChange <= -4) return 'windy';
  if (w.gust >= 0.42 || Math.abs(w.pressureChange) >= 3) return 'breezy';
  return 'calm';
}

/** One day of hidden weather, derived from the dynamics. */
function weatherFrom(w) {
  const temp = Math.round(w.tempRaw - (w.front <= 0 && w.front > -1.5 ? 4 : 0) - (w.humidity >= 70 ? 1.5 : 0));
  const full = { ...w, temp };
  const condition = conditionFor(full);
  const wind = windFor(full);
  return { temp, condition, wind, pressure: Math.round(w.pressure), pressureChange: Math.round(w.pressureChange * 10) / 10, humidity: Math.round(w.humidity), front: Math.round(w.front * 10) / 10, windDir: w.windDir };
}

function initialDynamics(state) {
  return {
    day: 0,
    tempAnom: 0,
    tempRaw: seasonalMean(0),
    pressure: 1016,
    pressureChange: 0,
    humidity: 55,
    front: 3 + rng(state) * 3, // days until the next system
    gust: 0.2,
    windDir: 'west',
  };
}

/** Advance the atmosphere one day. */
function step(state) {
  const d = state.dyn;
  d.day++;
  d.tempAnom = d.tempAnom * 0.7 + gauss(state) * 1.6;
  d.tempRaw = seasonalMean(d.day) + d.tempAnom;
  d.front -= 1;
  if (d.front <= -2) d.front = 2 + rng(state) * 5; // the next system forms far away
  // Pressure falls ahead of a system, rises behind it.
  const target = d.front > 0 && d.front <= 2 ? 1004 : d.front <= 0 && d.front > -2 ? 998 : 1018;
  const newP = d.pressure + (target - d.pressure) * 0.5 + gauss(state) * 1.2;
  d.pressureChange = newP - d.pressure;
  d.pressure = newP;
  d.humidity = Math.max(20, Math.min(100, d.humidity * 0.6 + (d.front <= 1 && d.front > -2 ? 80 : 45) * 0.4 + gauss(state) * 6));
  d.gust = Math.max(0, Math.min(1, d.gust * 0.4 + rng(state) * 0.5));
  d.windDir = d.front > 0 && d.front <= 2 ? 'south-west' : d.front <= 0 && d.front > -2 ? 'north-west' : ['west', 'north', 'south', 'east'][Math.floor(rng(state) * 4)];
}

export function newGame(seed = Date.now() % 1e9) {
  const state = {
    version: 1, seed, points: 0, day: 1, streak: 0, bestStreak: 0, won: false, wonDay: null,
    gear: Object.fromEntries(Object.keys(EQUIPMENT).map((k) => [k, k === 'thermometer' ? 1 : 0])),
    history: [], // { day, actual, prediction, score }
    dyn: null, today: null, tomorrow: null, upwind: [], log: [],
  };
  state.dyn = initialDynamics(state);
  // Spin up a few days so the first day is not a blank slate, then fix today and tomorrow.
  for (let i = 0; i < 4; i++) step(state);
  state.upwind = [weatherFrom(state.dyn)];
  step(state);
  state.upwind.unshift(weatherFrom(state.dyn));
  step(state);
  state.today = weatherFrom(state.dyn);
  step(state);
  state.tomorrow = weatherFrom(state.dyn);
  return state;
}

export function gearLevel(state, id) { return state.gear[id] || 0; }
export function nextGear(state, id) { return EQUIPMENT[id].levels[gearLevel(state, id)] || null; }
export function canBuyGear(state, id) { const n = nextGear(state, id); return !!n && state.points >= n.cost; }
export function buyGear(state, id) {
  if (!canBuyGear(state, id)) return false;
  state.points -= nextGear(state, id).cost;
  state.gear[id]++;
  return true;
}

/** The model's forecast for tomorrow: the truth, each part wrong with probability 1 − skill. */
function modelForecast(state, skill) {
  const t = state.tomorrow;
  const wrong = () => rng(state) > skill;
  const condition = wrong() ? CONDITIONS.filter((c) => c !== t.condition)[Math.floor(rng(state) * 3)] : t.condition;
  const temp = wrong() ? t.temp + (rng(state) < 0.5 ? -1 : 1) * (2 + Math.floor(rng(state) * 4)) : t.temp;
  const wind = wrong() ? WINDS.filter((w) => w !== t.wind)[Math.floor(rng(state) * 2)] : t.wind;
  return { condition, temp, wind, skill };
}

/** Everything the player can see today, shaped by their equipment. Deterministic per day. */
export function observations(state) {
  const t = state.today;
  const g = (id) => gearLevel(state, id);
  const obs = { day: state.day, season: seasonName(state.dyn.day), windDir: t.windDir, condition: t.condition, wind: g('anemometer') ? t.wind : null };
  obs.temp = g('thermometer') >= 2 ? t.temp : Math.round(t.temp / 5) * 5;
  obs.tempCoarse = g('thermometer') < 2;
  if (g('almanac')) obs.normal = Math.round(seasonalMean(state.dyn.day));
  if (g('barometer') >= 1) obs.pressureTrend = t.pressureChange <= -2 ? 'falling' : t.pressureChange >= 2 ? 'rising' : 'steady';
  if (g('barometer') >= 2) { obs.pressure = t.pressure; obs.pressureChange = t.pressureChange; }
  if (g('hygrometer')) obs.humidity = Math.round(t.humidity / 10) * 10;
  if (g('neighbours') >= 1) obs.upwind1 = pick(state.upwind[0]);
  if (g('neighbours') >= 2) obs.upwind2 = pick(state.upwind[1]);
  if (g('satellite')) obs.front = t.front > 0 ? `${Math.max(0.5, Math.round(t.front * 2) / 2)} days away` : t.front > -1.5 ? 'overhead' : 'passed';
  if (g('radar')) obs.radar = state.tomorrow.condition === 'rain' || state.tomorrow.condition === 'snow' ? 'precipitation approaching' : 'clear within a day';
  if (g('model')) obs.model = state.modelCache || (state.modelCache = modelForecast(state, EQUIPMENT.model.levels[g('model') - 1].skill));
  return obs;
}
function pick(w) { return { condition: w.condition, temp: w.temp, wind: w.wind }; }

export function seasonName(day) {
  const d = day % SEASON_DAYS;
  return d < 30 ? 'spring' : d < 60 ? 'summer' : d < 90 ? 'autumn' : 'winter';
}

/** Score a prediction against the actual weather. 100 is perfect. */
export function score(prediction, actual) {
  const cond = prediction.condition === actual.condition ? 50 : 0;
  const dt = Math.abs(prediction.temp - actual.temp);
  const temp = dt <= 1 ? 30 : dt <= 3 ? 20 : dt <= 5 ? 10 : 0;
  const wind = prediction.wind === actual.wind ? 20 : 0;
  return { total: cond + temp + wind, cond, temp, wind, dt };
}

/** Submit tomorrow's forecast; the day advances and points are awarded. */
export function submit(state, prediction) {
  if (state.won && state.acknowledged === false) return null;
  const actual = state.tomorrow;
  const s = score(prediction, actual);
  state.points += s.total;
  state.history.unshift({ day: state.day, actual, prediction, score: s.total });
  if (state.history.length > 60) state.history.length = 60;
  if (s.total === PERFECT) {
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (state.streak >= WIN_STREAK && !state.won) {
      state.won = true;
      state.wonDay = state.day;
    }
  } else state.streak = 0;
  // Roll the world forward one day.
  state.upwind.unshift(state.today);
  state.upwind.length = 2;
  state.today = actual;
  step(state);
  state.tomorrow = weatherFrom(state.dyn);
  state.modelCache = null;
  state.day++;
  return { actual, score: s };
}

export function totalGearCost() {
  return Object.values(EQUIPMENT).reduce((sum, e) => sum + e.levels.reduce((a, l) => a + l.cost, 0), 0);
}
