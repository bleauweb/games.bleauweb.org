// Binary Grid (Takuzu): fill with two colours so no three in a row, every row and column has
// equal counts, and no two rows (or columns) are identical. Built from a full valid grid and
// thinned while a solver confirms a single solution.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';

export const LEVELS = [
  { id: 'four', name: '4 × 4', tip: 'Two of each colour per row and column, never three in a row.', n: 4 },
  { id: 'six', name: '6 × 6', tip: 'Three of each per line.', n: 6 },
  { id: 'eight', name: '8 × 8', tip: 'Four of each per line, and no two lines the same.', n: 8 },
  { id: 'ten', name: '10 × 10', tip: 'Five of each. Look for pairs that force the next square.', n: 10 },
];

/** Is a partial grid still consistent with the rules? (-1 = empty) */
export function consistent(g) {
  const n = g.length;
  const lines = [...g, ...g[0].map((_, x) => g.map((r) => r[x]))];
  for (const line of lines) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      if (line[i] === 0) a++;
      else if (line[i] === 1) b++;
      if (i >= 2 && line[i] !== -1 && line[i] === line[i - 1] && line[i] === line[i - 2]) return false;
    }
    if (a > n / 2 || b > n / 2) return false;
  }
  // Completed identical lines are not allowed.
  const full = (line) => line.every((v) => v !== -1);
  const rows = g.filter(full).map((r) => r.join(''));
  if (new Set(rows).size !== rows.length) return false;
  const cols = g[0].map((_, x) => g.map((r) => r[x])).filter(full).map((c) => c.join(''));
  if (new Set(cols).size !== cols.length) return false;
  return true;
}

export function countSolutions(grid, limit = 2) {
  const g = grid.map((r) => [...r]);
  const n = g.length;
  let count = 0;
  function rec() {
    if (count >= limit) return;
    let found = null;
    for (let y = 0; y < n && !found; y++) for (let x = 0; x < n; x++) if (g[y][x] === -1) { found = [x, y]; break; }
    if (!found) { count++; return; }
    const [x, y] = found;
    for (const v of [0, 1]) {
      g[y][x] = v;
      if (consistent(g)) rec();
      g[y][x] = -1;
    }
  }
  rec();
  return count;
}

function fullGrid(n, rng) {
  const g = Array.from({ length: n }, () => new Array(n).fill(-1));
  function rec(i) {
    if (i === n * n) return true;
    const x = i % n;
    const y = Math.floor(i / n);
    const order = rng() < 0.5 ? [0, 1] : [1, 0];
    for (const v of order) {
      g[y][x] = v;
      if (consistent(g) && rec(i + 1)) return true;
    }
    g[y][x] = -1;
    return false;
  }
  return rec(0) ? g : null;
}

export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const n = level.n;
  const solution = fullGrid(n, rng);
  const givens = solution.map((r) => [...r]);
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push([x, y]);
  cells.sort(() => rng() - 0.5);
  const floor = Math.round(n * n * (n <= 4 ? 0.4 : 0.32));
  for (const [x, y] of cells) {
    if (givens.flat().filter((v) => v !== -1).length <= floor) break;
    const v = givens[y][x];
    givens[y][x] = -1;
    if (countSolutions(givens) !== 1) givens[y][x] = v;
  }
  return { n, givens, solution };
}

/** Which rule a full-or-partial grid breaks, for gentle feedback. */
export function problems(g) {
  const n = g.length;
  const out = [];
  const check = (line, label) => {
    for (let i = 2; i < n; i++) if (line[i] !== -1 && line[i] === line[i - 1] && line[i] === line[i - 2]) { out.push(`${label}: three in a row`); return; }
    const a = line.filter((v) => v === 0).length;
    const b = line.filter((v) => v === 1).length;
    if (a > n / 2 || b > n / 2) out.push(`${label}: too many of one colour`);
  };
  g.forEach((r, y) => check(r, `row ${y + 1}`));
  g[0].forEach((_, x) => check(g.map((r) => r[x]), `column ${x + 1}`));
  return out;
}
