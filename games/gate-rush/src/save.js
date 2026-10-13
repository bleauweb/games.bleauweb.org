// Progress lives in localStorage. There is no account and nothing leaves the browser.
import { GRID } from './base.js';

const KEY = 'gate-rush.save.v2';
const OLD_KEY = 'gate-rush.save.v1';

const DEFAULTS = () => ({
  level: 1, // highest level unlocked
  coins: 0,
  upgrades: { power: 0, armor: 0, hero: 0 },
  stars: {}, // level -> best stars
  muted: false,
  units: new Array(GRID).fill(null).map((_, i) => (i < 2 ? { lv: 1 } : null)), // two recruits to start
  recruitsBought: 0,
  rooms: {}, // room id -> { gold, cleared }
});

function migrateV1(old) {
  const d = DEFAULTS();
  d.level = old.level || 1;
  d.coins = old.coins || 0;
  d.stars = old.stars || {};
  d.muted = !!old.muted;
  d.upgrades.power = old.upgrades?.power || 0;
  d.upgrades.armor = old.upgrades?.armor || 0;
  // Recruits bought in v1 become units on the grid, roughly worth the same troops.
  const start = old.upgrades?.start || 0;
  for (let i = 0; i < Math.min(start, GRID - 2); i++) d.units[i + 2] = { lv: 2 };
  return d;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const d = DEFAULTS();
      const units = Array.isArray(data.units) ? data.units.slice(0, GRID) : d.units;
      while (units.length < GRID) units.push(null);
      return { ...d, ...data, upgrades: { ...d.upgrades, ...(data.upgrades || {}) }, units, rooms: data.rooms || {} };
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const d = migrateV1(JSON.parse(old));
      writeSave(d);
      return d;
    }
  } catch {
    // fall through
  }
  return DEFAULTS();
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private mode or storage disabled: the game still plays, it just forgets.
  }
}

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // ignore
  }
  return DEFAULTS();
}
