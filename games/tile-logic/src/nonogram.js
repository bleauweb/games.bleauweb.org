// Tile Logic: nonograms. Clues from a picture, a line-logic solver that proves a puzzle can be
// finished by deduction alone, random puzzles filtered through that solver, and pixel pictures.

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

export const UNKNOWN = 0;
export const FILL = 1;
export const EMPTY = 2;

export function lineClues(line) {
  const out = [];
  let run = 0;
  for (const c of line) {
    if (c === 1) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

export function cluesOf(grid) {
  const n = grid.length;
  const m = grid[0].length;
  return {
    rows: grid.map((r) => lineClues(r)),
    cols: Array.from({ length: m }, (_, x) => lineClues(Array.from({ length: n }, (_, y) => grid[y][x]))),
  };
}

/** All ways to place the clue blocks in a line of length n consistent with known cells. */
function placements(clues, line) {
  const n = line.length;
  const blocks = clues[0] === 0 ? [] : clues;
  const results = [];
  const cur = new Array(n).fill(EMPTY);
  function fits(start, len) {
    for (let i = start; i < start + len; i++) if (line[i] === EMPTY) return false;
    if (start > 0 && line[start - 1] === FILL) return false;
    if (start + len < n && line[start + len] === FILL) return false;
    return true;
  }
  function rec(bi, pos) {
    if (results.length > 4000) return; // long enough lines are judged on what we have
    if (bi === blocks.length) {
      for (let i = pos; i < n; i++) if (line[i] === FILL) return;
      results.push([...cur]);
      return;
    }
    const len = blocks[bi];
    const rest = blocks.slice(bi + 1).reduce((a, b) => a + b + 1, 0);
    for (let start = pos; start + len + rest <= n; start++) {
      if (fits(start, len)) {
        for (let i = start; i < start + len; i++) cur[i] = FILL;
        rec(bi + 1, start + len + 1);
        for (let i = start; i < start + len; i++) cur[i] = EMPTY;
      }
      // Once a known filled cell is passed, later starts would leave it uncovered.
      if (line[start] === FILL) break;
    }
  }
  rec(0, 0);
  return results;
}

/** Deduce every cell that is the same in all placements. Returns the new line (or null if impossible). */
export function solveLine(clues, line) {
  const ps = placements(clues, line);
  if (!ps.length) return null;
  const out = [...line];
  for (let i = 0; i < line.length; i++) {
    if (out[i] !== UNKNOWN) continue;
    const first = ps[0][i];
    if (ps.every((p) => p[i] === first)) out[i] = first;
  }
  return out;
}

/** Line-logic solver. solved = every cell determined without guessing. */
export function solve(rows, cols) {
  const n = rows.length;
  const m = cols.length;
  const g = Array.from({ length: n }, () => new Array(m).fill(UNKNOWN));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (let y = 0; y < n; y++) {
      const next = solveLine(rows[y], g[y]);
      if (!next) return { solved: false, grid: g, contradiction: true };
      for (let x = 0; x < m; x++) if (next[x] !== g[y][x]) { g[y][x] = next[x]; changed = true; }
    }
    for (let x = 0; x < m; x++) {
      const col = g.map((r) => r[x]);
      const next = solveLine(cols[x], col);
      if (!next) return { solved: false, grid: g, contradiction: true };
      for (let y = 0; y < n; y++) if (next[y] !== g[y][x]) { g[y][x] = next[y]; changed = true; }
    }
  }
  const solved = g.every((r) => r.every((c) => c !== UNKNOWN));
  return { solved, grid: g };
}

/** Does the player's fill satisfy every clue? (Any valid solution counts.) */
export function matches(fill, rows, cols) {
  const grid = fill.map((r) => r.map((c) => (c === FILL ? 1 : 0)));
  const c = cluesOf(grid);
  return JSON.stringify(c.rows) === JSON.stringify(rows) && JSON.stringify(c.cols) === JSON.stringify(cols);
}

// Pixel pictures (10 × 10). '#' filled.
export const PICTURES = {
  heart: ['..##..##..', '.########.', '##########', '##########', '##########', '.########.', '..######..', '...####...', '....##....', '..........'],
  house: ['....##....', '...####...', '..######..', '.########.', '##########', '.##....##.', '.##.##.##.', '.##.##.##.', '.##....##.', '.########.'],
  cat: ['#........#', '##......##', '###....###', '##########', '##########', '#..####..#', '##########', '.########.', '..##..##..', '..##..##..'],
  tree: ['....##....', '...####...', '..######..', '.########.', '...####...', '..######..', '.########.', '##########', '....##....', '...####...'],
  boat: ['.....#....', '....###...', '...#####..', '..#######.', '.....#....', '##########', '.########.', '..######..', '..........', '#.#.#.#.#.'],
  cup: ['..........', '.#######..', '.#######.#', '.#######.#', '.#######.#', '.#######..', '..#####...', '..........', '.########.', '..........'],
  key: ['..####....', '.##..##...', '.##..##...', '..####....', '...##.....', '...##.....', '...##.##..', '...##.....', '...##.##..', '...##.....'],
  star: ['....##....', '....##....', '...####...', '##########', '.########.', '..######..', '.########.', '.###..###.', '##......##', '..........'],
  fish: ['..........', '....####..', '..######.#', '.#######.#', '#########.', '.#######.#', '..######.#', '....####..', '..........', '..........'],
  umbrella: ['....##....', '..######..', '.########.', '##########', '#.#.##.#.#', '....##....', '....##....', '....##....', '....##.#..', '.....###..'],
  duck: ['..........', '...###....', '..#####...', '..#.####..', '..#####...', '...##.....', '.######...', '########..', '.#######..', '..#####...'],
  flower: ['...####...', '..######..', '.##.##.##.', '.########.', '..######..', '...####...', '....##....', '.##.##....', '..####....', '....##....'],
  mushroom: ['...####...', '..######..', '.##.####..', '##########', '##########', '...####...', '...####...', '...####...', '...####...', '..######..'],
  rocket: ['....##....', '...####...', '..######..', '..#.##.#..', '..######..', '..######..', '.###..###.', '.##.##.##.', '#.######.#', '....##....'],
};

export function pictureGrid(name) {
  return PICTURES[name].map((row) => row.split('').map((c) => (c === '#' ? 1 : 0)));
}

export const LEVELS = [
  { id: 'tiny', name: 'Tiny grids', tip: '5 × 5. Learn how the clues work.', size: 5, kind: 'random', density: 0.55 },
  { id: 'small', name: 'Small grids', tip: '8 × 8, random shapes.', size: 8, kind: 'random', density: 0.55 },
  { id: 'pictures', name: 'Pictures', tip: '10 × 10. Each one reveals something.', size: 10, kind: 'picture' },
  { id: 'big', name: 'Big grids', tip: '12 × 12, random shapes.', size: 12, kind: 'random', density: 0.55 },
  { id: 'pictures2', name: 'Pictures, mirrored', tip: '10 × 10 pictures flipped or turned, so you cannot guess from memory.', size: 10, kind: 'picture', transform: true },
];

/** Random grids are kept only if line logic alone solves them. */
export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const names = Object.keys(PICTURES);
  for (let attempt = 0; attempt < 400; attempt++) {
    let grid;
    let name = null;
    if (level.kind === 'picture') {
      name = names[Math.floor(rng() * names.length)];
      grid = pictureGrid(name);
      if (level.transform) {
        const t = Math.floor(rng() * 3);
        if (t === 0) grid = grid.map((r) => [...r].reverse());
        else if (t === 1) grid = [...grid].reverse();
        else grid = grid[0].map((_, x) => grid.map((r) => r[x]));
      }
    } else {
      const n = level.size;
      grid = Array.from({ length: n }, () => Array.from({ length: n }, () => (rng() < level.density ? 1 : 0)));
      // Avoid empty lines, which make dull puzzles.
      if (grid.some((r) => r.every((c) => !c))) continue;
      if (grid[0].some((_, x) => grid.every((r) => !r[x]))) continue;
    }
    const { rows, cols } = cluesOf(grid);
    const result = solve(rows, cols);
    if (result.solved) return { size: grid.length, rows, cols, solution: grid, name, seed };
    if (level.kind === 'picture' && !result.solved && attempt > 40) {
      // Every picture in the library is deducible; this only guards against a bad transform.
      continue;
    }
  }
  throw new Error('could not make a deducible puzzle');
}
