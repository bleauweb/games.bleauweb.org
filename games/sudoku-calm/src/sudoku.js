// Sudoku Calm: 4×4, 6×6 and 9×9 grids. Puzzles are thinned only while they remain solvable by
// singles (naked and hidden), so no guessing is ever needed, and the solution is unique.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';

export const LEVELS = [
  { id: 'four', name: '4 × 4', tip: 'Numbers 1 to 4 in every row, column and 2×2 box.', n: 4, bw: 2, bh: 2, keep: 0.55 },
  { id: 'six', name: '6 × 6', tip: 'Numbers 1 to 6, boxes are 3 wide and 2 tall.', n: 6, bw: 3, bh: 2, keep: 0.5 },
  { id: 'nine-easy', name: '9 × 9, gentle', tip: 'Plenty of givens. Singles all the way.', n: 9, bw: 3, bh: 3, keep: 0.5 },
  { id: 'nine', name: '9 × 9', tip: 'Fewer givens, still never a guess.', n: 9, bw: 3, bh: 3, keep: 0.38 },
];

export function boxOf(level, x, y) {
  return Math.floor(y / level.bh) * (level.n / level.bw) + Math.floor(x / level.bw);
}

export function candidates(level, g, x, y) {
  const n = level.n;
  const used = new Set();
  for (let i = 0; i < n; i++) { used.add(g[y][i]); used.add(g[i][x]); }
  const bx = Math.floor(x / level.bw) * level.bw;
  const by = Math.floor(y / level.bh) * level.bh;
  for (let yy = by; yy < by + level.bh; yy++) for (let xx = bx; xx < bx + level.bw; xx++) used.add(g[yy][xx]);
  const out = [];
  for (let v = 1; v <= n; v++) if (!used.has(v)) out.push(v);
  return out;
}

function fullGrid(level, rng) {
  const n = level.n;
  const g = Array.from({ length: n }, () => new Array(n).fill(0));
  function rec(i) {
    if (i === n * n) return true;
    const x = i % n;
    const y = Math.floor(i / n);
    const cands = candidates(level, g, x, y).sort(() => rng() - 0.5);
    for (const v of cands) {
      g[y][x] = v;
      if (rec(i + 1)) return true;
    }
    g[y][x] = 0;
    return false;
  }
  rec(0);
  return g;
}

/** Solve using only naked singles and hidden singles. Returns { solved, grid }. */
export function solveSingles(level, givens) {
  const n = level.n;
  const g = givens.map((r) => [...r]);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 1000) {
    changed = false;
    // Naked singles.
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (g[y][x]) continue;
      const c = candidates(level, g, x, y);
      if (c.length === 0) return { solved: false, grid: g, contradiction: true };
      if (c.length === 1) { g[y][x] = c[0]; changed = true; }
    }
    if (changed) continue;
    // Hidden singles in rows, columns, boxes.
    const units = [];
    for (let i = 0; i < n; i++) {
      units.push(Array.from({ length: n }, (_, k) => [k, i]));
      units.push(Array.from({ length: n }, (_, k) => [i, k]));
    }
    for (let b = 0; b < n; b++) {
      const cells = [];
      const bx = (b % (n / level.bw)) * level.bw;
      const by = Math.floor(b / (n / level.bw)) * level.bh;
      for (let yy = by; yy < by + level.bh; yy++) for (let xx = bx; xx < bx + level.bw; xx++) cells.push([xx, yy]);
      units.push(cells);
    }
    for (const unit of units) {
      for (let v = 1; v <= n; v++) {
        if (unit.some(([x, y]) => g[y][x] === v)) continue;
        const spots = unit.filter(([x, y]) => !g[y][x] && candidates(level, g, x, y).includes(v));
        if (spots.length === 1) { const [x, y] = spots[0]; g[y][x] = v; changed = true; }
      }
    }
  }
  return { solved: g.every((r) => r.every(Boolean)), grid: g };
}

export function countSolutions(level, givens, limit = 2) {
  const n = level.n;
  const g = givens.map((r) => [...r]);
  let count = 0;
  function rec() {
    if (count >= limit) return;
    let best = null;
    let bestC = null;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (g[y][x]) continue;
      const c = candidates(level, g, x, y);
      if (!bestC || c.length < bestC.length) { best = [x, y]; bestC = c; }
      if (c.length === 0) return;
    }
    if (!best) { count++; return; }
    for (const v of bestC) { g[best[1]][best[0]] = v; rec(); g[best[1]][best[0]] = 0; }
  }
  rec();
  return count;
}

export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const n = level.n;
  const solution = fullGrid(level, rng);
  const givens = solution.map((r) => [...r]);
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push([x, y]);
  cells.sort(() => rng() - 0.5);
  const floor = Math.round(n * n * level.keep);
  for (const [x, y] of cells) {
    if (givens.flat().filter(Boolean).length <= floor) break;
    const v = givens[y][x];
    givens[y][x] = 0;
    if (!solveSingles(level, givens).solved) givens[y][x] = v;
  }
  return { level, n, givens, solution };
}

export function conflicts(level, g, x, y) {
  const v = g[y][x];
  if (!v) return false;
  const n = level.n;
  for (let i = 0; i < n; i++) if ((i !== x && g[y][i] === v) || (i !== y && g[i][x] === v)) return true;
  const bx = Math.floor(x / level.bw) * level.bw;
  const by = Math.floor(y / level.bh) * level.bh;
  for (let yy = by; yy < by + level.bh; yy++) for (let xx = bx; xx < bx + level.bw; xx++) if ((xx !== x || yy !== y) && g[yy][xx] === v) return true;
  return false;
}
