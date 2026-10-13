// Rhythm Patterns: step patterns to watch and reproduce. Timing is optional; marking is not.

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

export const ROW_NAMES = ['Drum', 'Clap', 'Shaker'];
export const ROW_COLORS = ['#4f8fff', '#e8a33d', '#4cc25e'];

export const LEVELS = [
  { id: 'one8', name: 'One line, 8 steps', tip: 'Watch it play, then mark the steps you saw.', steps: 8, rows: 1, density: 0.45 },
  { id: 'two8', name: 'Two lines, 8 steps', tip: 'Drum and clap together.', steps: 8, rows: 2, density: 0.4 },
  { id: 'one16', name: 'One line, 16 steps', tip: 'Longer patterns. The beat marks help.', steps: 16, rows: 1, density: 0.4 },
  { id: 'two16', name: 'Two lines, 16 steps', tip: 'Two instruments, sixteen steps.', steps: 16, rows: 2, density: 0.38 },
  { id: 'three16', name: 'Three lines, 16 steps', tip: 'Drum, clap and shaker.', steps: 16, rows: 3, density: 0.35 },
];

export function makePattern(level, seed) {
  const rng = mulberry32(seed);
  const rows = [];
  for (let r = 0; r < level.rows; r++) {
    let row;
    let guard = 0;
    do {
      row = Array.from({ length: level.steps }, (_, i) => (i === 0 && r === 0 ? 1 : rng() < level.density ? 1 : 0));
      guard++;
    } while (guard < 50 && (row.filter(Boolean).length < 2 || row.filter(Boolean).length > level.steps - 2));
    rows.push(row);
  }
  return { steps: level.steps, rows };
}

/** Compare a marked grid with the pattern. */
export function compare(marked, pattern) {
  let wrong = 0;
  const cells = [];
  pattern.rows.forEach((row, r) => row.forEach((v, i) => {
    const m = marked[r]?.[i] ? 1 : 0;
    if (m !== v) { wrong++; cells.push([r, i]); }
  }));
  return { match: wrong === 0, wrong, cells };
}

/**
 * Score live taps (ms from the pattern start) against one row. A step counts as hit when a
 * tap falls within `tol` ms of it; extra taps count against you.
 */
export function scoreTaps(taps, row, stepMs, tol = 150) {
  const used = new Set();
  let hits = 0;
  const onsets = row.map((v, i) => (v ? i * stepMs : null)).filter((t) => t !== null);
  for (const t of onsets) {
    let best = -1;
    let bestD = tol + 1;
    taps.forEach((tap, k) => {
      if (used.has(k)) return;
      const d = Math.abs(tap - t);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best >= 0 && bestD <= tol) { used.add(best); hits++; }
  }
  return { hits, misses: onsets.length - hits, extra: taps.length - used.size, total: onsets.length };
}
