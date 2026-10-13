// Symmetry Studio: complete a coloured grid so it has a given symmetry. Pure helpers.

export const PALETTE = ['#e05a5a', '#e8a33d', '#e6d84a', '#4cc25e', '#4f8fff', '#b26ee6', '#e9eefb'];

export const MODES = {
  mirrorV: { name: 'Mirror, left and right', tip: 'The right half mirrors the left.' },
  mirrorH: { name: 'Mirror, top and bottom', tip: 'The bottom half mirrors the top.' },
  mirror4: { name: 'Four-way mirror', tip: 'Both mirrors at once: one quarter decides everything.' },
  rot2: { name: 'Half turn', tip: 'Turn the top half upside down to get the bottom.' },
  rot4: { name: 'Quarter turns', tip: 'One quarter, turned four times around the centre.' },
  kaleido: { name: 'Kaleidoscope', tip: 'Eight-way: mirrors across, down and both diagonals.' },
};

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

/** All cells equivalent to (x, y) under the mode, including itself. */
export function orbit(mode, n, x, y) {
  const m = n - 1;
  const pts = new Set();
  const add = (a, b) => pts.add(`${a},${b}`);
  add(x, y);
  switch (mode) {
    case 'mirrorV': add(m - x, y); break;
    case 'mirrorH': add(x, m - y); break;
    case 'mirror4': add(m - x, y); add(x, m - y); add(m - x, m - y); break;
    case 'rot2': add(m - x, m - y); break;
    case 'rot4': add(m - y, x); add(m - x, m - y); add(y, m - x); break;
    default: // kaleido: dihedral group of the square
      add(m - x, y); add(x, m - y); add(m - x, m - y); add(y, x); add(m - y, x); add(y, m - x); add(m - y, m - x);
  }
  return [...pts].map((s) => s.split(',').map(Number));
}

/** The representative of a cell's orbit: the smallest (y, x) in reading order. */
export function canonical(mode, n, x, y) {
  let best = null;
  for (const [a, b] of orbit(mode, n, x, y)) if (!best || b < best[1] || (b === best[1] && a < best[0])) best = [a, b];
  return best;
}

export function isSource(mode, n, x, y) {
  const [cx, cy] = canonical(mode, n, x, y);
  return cx === x && cy === y;
}

/** Fill every cell from its orbit's source. */
export function complete(grid, mode) {
  const n = grid.length;
  return grid.map((row, y) => row.map((_, x) => {
    const [cx, cy] = canonical(mode, n, x, y);
    return grid[cy][cx];
  }));
}

export const LEVELS = [
  { id: 'mirror6', name: 'Mirror, 6 × 6', mode: 'mirrorV', n: 6, colors: 3 },
  { id: 'mirrorH6', name: 'Top and bottom, 6 × 6', mode: 'mirrorH', n: 6, colors: 3 },
  { id: 'four6', name: 'Four-way, 6 × 6', mode: 'mirror4', n: 6, colors: 4 },
  { id: 'half8', name: 'Half turn, 8 × 8', mode: 'rot2', n: 8, colors: 4 },
  { id: 'quarter8', name: 'Quarter turns, 8 × 8', mode: 'rot4', n: 8, colors: 4 },
  { id: 'kaleido7', name: 'Kaleidoscope, 7 × 7', mode: 'kaleido', n: 7, colors: 5 },
  { id: 'quarter10', name: 'Quarter turns, 10 × 10', mode: 'rot4', n: 10, colors: 6 },
  { id: 'kaleido11', name: 'Kaleidoscope, 11 × 11', mode: 'kaleido', n: 11, colors: 6 },
];

/**
 * A puzzle: `given` holds the source cells (and the centre lines where they are their own
 * mirror), 0 elsewhere. `target` is the completed grid. Colours are 1..k; 0 is blank.
 */
export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const n = level.n;
  const k = level.colors;
  const src = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (isSource(level.mode, n, x, y)) src[y][x] = rng() < 0.3 ? 0 : 1 + Math.floor(rng() * k);
  }
  // Make sure the source is not nearly blank.
  const filled = src.flat().filter(Boolean).length;
  const sources = src.flat().length;
  if (filled < sources * 0.3) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (isSource(level.mode, n, x, y) && !src[y][x] && rng() < 0.5) src[y][x] = 1 + Math.floor(rng() * k);
  }
  const target = complete(src, level.mode);
  const given = target.map((row, y) => row.map((v, x) => (isSource(level.mode, n, x, y) ? v : 0)));
  const toFill = given.flat().filter((_, i) => !isSource(level.mode, n, i % n, Math.floor(i / n))).length;
  return { n, mode: level.mode, colors: k, given, target, toFill };
}

/** Compare a player's grid to the target. Blank (0) in the target must be blank in the grid. */
export function check(grid, target) {
  let wrong = 0;
  let missing = 0;
  const n = target.length;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (grid[y][x] !== target[y][x]) {
      if (grid[y][x] === 0 && target[y][x] !== 0) missing++;
      else wrong++;
    }
  }
  return { ok: wrong === 0 && missing === 0, wrong, missing };
}
