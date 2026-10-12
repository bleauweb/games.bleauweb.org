// Progress lives in localStorage. There is no account and nothing leaves the browser.
const KEY = 'gate-rush.save.v1';

const DEFAULTS = () => ({
  level: 1, // highest level unlocked
  coins: 0,
  upgrades: { start: 0, power: 0, armor: 0 },
  stars: {}, // level -> best stars
  muted: false,
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const data = JSON.parse(raw);
    return { ...DEFAULTS(), ...data, upgrades: { ...DEFAULTS().upgrades, ...(data.upgrades || {}) } };
  } catch {
    return DEFAULTS();
  }
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
  } catch {
    // ignore
  }
  return DEFAULTS();
}
