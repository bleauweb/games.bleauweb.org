// Light Switch (Lights Out): pressing a light toggles it and its four neighbours. Turn them all off.
// Puzzles are made by pressing random lights on a dark board, so a solution always exists.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';

export const LEVELS = [
  { id: 'three', name: '3 × 3, a few presses', tip: 'Three presses undo it. Watch how a press spreads.', n: 3, presses: 3 },
  { id: 'four', name: '4 × 4', tip: 'Five presses.', n: 4, presses: 5 },
  { id: 'five', name: '5 × 5', tip: 'Seven presses. Work from the top row down.', n: 5, presses: 7 },
  { id: 'five2', name: '5 × 5, tangled', tip: 'Ten presses.', n: 5, presses: 10 },
  { id: 'six', name: '6 × 6', tip: 'Twelve presses.', n: 6, presses: 12 },
];

export function press(grid, x, y) {
  const n = grid.length;
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const a = x + dx;
    const b = y + dy;
    if (a >= 0 && b >= 0 && a < n && b < n) grid[b][a] = grid[b][a] ? 0 : 1;
  }
  return grid;
}

export function allOff(grid) {
  return grid.every((r) => r.every((v) => !v));
}

/** Returns { n, grid, solution } where solution is the set of cells that, pressed, clears it. */
export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const n = level.n;
  for (let attempt = 0; attempt < 100; attempt++) {
    const grid = Array.from({ length: n }, () => new Array(n).fill(0));
    const pressed = new Map();
    for (let i = 0; i < level.presses; i++) {
      const x = Math.floor(rng() * n);
      const y = Math.floor(rng() * n);
      const k = `${x},${y}`;
      pressed.set(k, (pressed.get(k) || 0) + 1);
      press(grid, x, y);
    }
    const solution = [...pressed.entries()].filter(([, c]) => c % 2 === 1).map(([k]) => k.split(',').map(Number));
    if (allOff(grid) || solution.length < Math.max(2, level.presses - 2)) continue;
    return { n, grid, solution };
  }
  throw new Error('no puzzle');
}
