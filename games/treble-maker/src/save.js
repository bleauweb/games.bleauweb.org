const KEY = 'treble-maker.save.v1';

const DEFAULTS = () => ({
  unlocked: 1, // how many levels are open
  stars: {}, // level id -> 0..3
  best: {}, // level id -> best rush score
  stats: {}, // "clef:note" -> { seen, wrong }
  muted: false,
  labels: true, // letters on the piano keys
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    return { ...DEFAULTS(), ...JSON.parse(raw) };
  } catch {
    return DEFAULTS();
  }
}

export function writeSave(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable: the trainer still works, it just forgets
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
