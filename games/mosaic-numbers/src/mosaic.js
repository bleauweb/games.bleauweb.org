// Mosaic Numbers (Fill-a-Pix): each number says how many of the 3×3 squares around it,
// including itself, are filled. A deduction-only solver keeps puzzles that need no guessing.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';
import { PICTURES, pictureGrid } from '../../tile-logic/src/nonogram.js';

export const UNKNOWN = 0;
export const FILL = 1;
export const EMPTY = 2;

export const LEVELS = [
  { id: 'five', name: '5 × 5', tip: 'A 9 means the whole block around it is filled; a 0 means none of it.', n: 5, kind: 'random', clues: 0.6 },
  { id: 'seven', name: '7 × 7', tip: 'Start from the 0s and 9s, then the edges.', n: 7, kind: 'random', clues: 0.5 },
  { id: 'pictures', name: 'Pictures, 10 × 10', tip: 'The filled squares make a picture.', n: 10, kind: 'picture', clues: 0.45 },
  { id: 'twelve', name: '12 × 12', tip: 'Fewer numbers, more deduction.', n: 12, kind: 'random', clues: 0.4 },
];

function around(n, x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const a = x + dx;
    const b = y + dy;
    if (a >= 0 && b >= 0 && a < n && b < n) out.push([a, b]);
  }
  return out;
}

export function cluesFor(grid, mask) {
  const n = grid.length;
  return grid.map((row, y) => row.map((_, x) => (mask[y][x] ? around(n, x, y).filter(([a, b]) => grid[b][a]).length : null)));
}

/** Propagate: for each clue, if the unknowns around it must all be filled or all be empty, set them. */
export function solve(clues) {
  const n = clues.length;
  const g = Array.from({ length: n }, () => new Array(n).fill(UNKNOWN));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = clues[y][x];
      if (c === null) continue;
      const cells = around(n, x, y);
      const filled = cells.filter(([a, b]) => g[b][a] === FILL).length;
      const unknown = cells.filter(([a, b]) => g[b][a] === UNKNOWN);
      if (!unknown.length) continue;
      if (filled > c || filled + unknown.length < c) return { solved: false, grid: g, contradiction: true };
      if (filled === c) { for (const [a, b] of unknown) g[b][a] = EMPTY; changed = true; }
      else if (filled + unknown.length === c) { for (const [a, b] of unknown) g[b][a] = FILL; changed = true; }
    }
  }
  return { solved: g.every((r) => r.every((v) => v !== UNKNOWN)), grid: g };
}

export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const names = Object.keys(PICTURES);
  for (let attempt = 0; attempt < 400; attempt++) {
    let grid;
    let name = null;
    if (level.kind === 'picture') {
      name = names[Math.floor(rng() * names.length)];
      grid = pictureGrid(name);
    } else {
      grid = Array.from({ length: level.n }, () => Array.from({ length: level.n }, () => (rng() < 0.5 ? 1 : 0)));
    }
    const n = grid.length;
    // Start with every clue, then remove clues while the puzzle stays solvable by propagation.
    const mask = Array.from({ length: n }, () => new Array(n).fill(true));
    const order = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) order.push([x, y]);
    order.sort(() => rng() - 0.5);
    if (!solve(cluesFor(grid, mask)).solved) continue;
    const target = Math.round(n * n * level.clues);
    for (const [x, y] of order) {
      if (mask.flat().filter(Boolean).length <= target) break;
      mask[y][x] = false;
      if (!solve(cluesFor(grid, mask)).solved) mask[y][x] = true;
    }
    return { n, clues: cluesFor(grid, mask), solution: grid, name };
  }
  throw new Error('no puzzle');
}

export function isComplete(fill, solution) {
  return fill.every((r, y) => r.every((v, x) => (v === FILL ? 1 : 0) === solution[y][x]));
}
