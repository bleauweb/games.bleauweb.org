// Number Chain: a path of consecutive numbers snakes through the grid (4-neighbour steps).
// Some numbers are given; fill the rest. Built from a random snake, with a solver that keeps
// only puzzles with exactly one answer.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';

export const LEVELS = [
  { id: 'four', name: '4 × 4', tip: 'Sixteen numbers. Every number sits next to the one before it.', n: 4, givens: 0.5 },
  { id: 'five', name: '5 × 5', tip: 'Twenty-five numbers.', n: 5, givens: 0.42 },
  { id: 'six', name: '6 × 6', tip: 'Thirty-six numbers. Count forwards and backwards from the givens.', n: 6, givens: 0.36 },
  { id: 'seven', name: '7 × 7', tip: 'Forty-nine numbers.', n: 7, givens: 0.32 },
];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** A random Hamiltonian-ish snake: a random walk with backtracking that covers the grid. */
function snake(n, rng) {
  const grid = Array.from({ length: n }, () => new Array(n).fill(0));
  const total = n * n;
  const start = [Math.floor(rng() * n), Math.floor(rng() * n)];
  const path = [start];
  grid[start[1]][start[0]] = 1;
  let steps = 0;
  function rec() {
    if (++steps > 200000) return false;
    if (path.length === total) return true;
    const [x, y] = path[path.length - 1];
    const opts = DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !grid[b][a]);
    // Warnsdorff-style: fewest onward options first, with a little randomness.
    opts.sort((p, q) => onward(p) - onward(q) + (rng() - 0.5));
    for (const [a, b] of opts) {
      grid[b][a] = path.length + 1;
      path.push([a, b]);
      if (rec()) return true;
      path.pop();
      grid[b][a] = 0;
    }
    return false;
  }
  function onward([x, y]) {
    return DIRS.filter(([dx, dy]) => { const a = x + dx; const b = y + dy; return a >= 0 && b >= 0 && a < n && b < n && !grid[b][a]; }).length;
  }
  return rec() ? grid : null;
}

/** Count solutions (up to `limit`) of a givens grid; 0 = blank. */
export function countSolutions(givens, limit = 2) {
  const n = givens.length;
  const total = n * n;
  const pos = new Array(total + 1).fill(null);
  const grid = givens.map((r) => [...r]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (grid[y][x]) pos[grid[y][x]] = [x, y];
  if (!pos[1]) {
    // Try every start cell for 1.
    let count = 0;
    for (let y = 0; y < n && count < limit; y++) for (let x = 0; x < n && count < limit; x++) {
      if (grid[y][x]) continue;
      grid[y][x] = 1;
      pos[1] = [x, y];
      count += place(2);
      grid[y][x] = 0;
      pos[1] = null;
    }
    return count;
  }
  return place(2);
  function place(k) {
    if (k > total) return 1;
    const [px, py] = pos[k - 1];
    let count = 0;
    for (const [dx, dy] of DIRS) {
      const x = px + dx;
      const y = py + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      if (pos[k]) {
        if (pos[k][0] === x && pos[k][1] === y) { count += place(k + 1); }
        continue;
      }
      if (grid[y][x]) continue;
      grid[y][x] = k;
      pos[k] = [x, y];
      count += place(k + 1);
      if (count >= limit) { grid[y][x] = 0; pos[k] = null; return count; }
      grid[y][x] = 0;
      pos[k] = null;
    }
    return count;
  }
}

export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = snake(level.n, rng);
    if (!solution) continue;
    const n = level.n;
    const cells = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push([x, y]);
    // Start with 1 and the last number given, plus a random share; then remove extras while unique.
    const givens = solution.map((r) => r.map(() => 0));
    const keep = new Set([`${solution.findIndex((r) => r.includes(1))}`]);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = solution[y][x];
      if (v === 1 || v === n * n || rng() < level.givens) givens[y][x] = v;
    }
    if (countSolutions(givens) !== 1) continue;
    // Thin out: try removing givens (except 1 and the last) while the puzzle stays unique.
    // Thin out, but keep at least a fifth of the cells as givens so the puzzle reads calmly.
    const floor = Math.max(3, Math.round(n * n * 0.22));
    const order = [...cells].sort(() => rng() - 0.5);
    for (const [x, y] of order) {
      if (givens.flat().filter(Boolean).length <= floor) break;
      const v = givens[y][x];
      if (!v || v === 1 || v === n * n) continue;
      givens[y][x] = 0;
      if (countSolutions(givens) !== 1) givens[y][x] = v;
    }
    void keep;
    return { n, givens, solution };
  }
  throw new Error('no puzzle');
}

export function isComplete(grid, solution) {
  return grid.every((r, y) => r.every((v, x) => v === solution[y][x]));
}
