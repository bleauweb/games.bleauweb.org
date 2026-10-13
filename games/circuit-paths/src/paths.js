// Circuit Paths: connect matching endpoints with paths that fill the grid without crossing.
// Puzzles are made by cutting a full grid into paths, so every puzzle has a solution.

export const COLORS = ['#e05a5a', '#4f8fff', '#4cc25e', '#e8a33d', '#b26ee6', '#2dd4bf', '#f472b6', '#a3e635', '#fb923c', '#60a5fa'];

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

export const LEVELS = [
  { id: 'five', name: '5 × 5', tip: 'Four or five pairs. Every square gets used.', n: 5, minPaths: 4, maxPaths: 5 },
  { id: 'six', name: '6 × 6', tip: 'Five or six pairs.', n: 6, minPaths: 5, maxPaths: 6 },
  { id: 'seven', name: '7 × 7', tip: 'Six or seven pairs.', n: 7, minPaths: 6, maxPaths: 7 },
  { id: 'eight', name: '8 × 8', tip: 'Seven to nine pairs.', n: 8, minPaths: 7, maxPaths: 9 },
  { id: 'nine', name: '9 × 9', tip: 'Eight to ten pairs.', n: 9, minPaths: 8, maxPaths: 10 },
];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Cut the grid into random snaking paths covering every cell. Returns null when the cut is poor. */
function cut(n, rng, minPaths, maxPaths) {
  const owner = Array.from({ length: n }, () => new Array(n).fill(-1));
  const paths = [];
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push([x, y]);
  // Shuffle start cells.
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const free = (x, y) => x >= 0 && y >= 0 && x < n && y < n && owner[y][x] === -1;
  for (const [sx, sy] of cells) {
    if (!free(sx, sy)) continue;
    const id = paths.length;
    const path = [[sx, sy]];
    owner[sy][sx] = id;
    // Grow from both ends alternately, preferring neighbours with few free neighbours (fills corners).
    let grew = true;
    while (grew && path.length < n * 2) {
      grew = false;
      for (const end of [path.length - 1, 0]) {
        const [cx, cy] = path[end];
        const opts = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => free(x, y));
        if (!opts.length) continue;
        opts.sort((a, b) => freeAround(a) - freeAround(b) + (rng() - 0.5) * 1.5);
        const [nx, ny] = opts[0];
        owner[ny][nx] = id;
        if (end === 0) path.unshift([nx, ny]);
        else path.push([nx, ny]);
        grew = true;
        if (rng() < 0.12 && path.length >= 3) grew = false; // sometimes stop early for variety
      }
    }
    paths.push(path);
  }
  function freeAround([x, y]) {
    return DIRS.filter(([dx, dy]) => free(x + dx, y + dy)).length;
  }
  // Merge single cells into a neighbouring path's end when possible; otherwise reject.
  for (const p of paths) {
    if (p.length >= 2) continue;
    const [x, y] = p[0];
    const neighbour = DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n)
      .map(([a, b]) => paths[owner[b][a]]).find((q) => q.length >= 2 && (same(q[0], [x, y], 1) || same(q[q.length - 1], [x, y], 1)));
    if (!neighbour) return null;
    if (same(neighbour[0], [x, y], 1)) neighbour.unshift([x, y]);
    else neighbour.push([x, y]);
    owner[y][x] = paths.indexOf(neighbour);
    p.length = 0;
  }
  const real = paths.filter((p) => p.length >= 2);
  if (real.length < minPaths || real.length > maxPaths) return null;
  if (real.some((p) => p.length < 3) && n >= 6) return null; // avoid trivial two-cell pairs on bigger boards
  return real;
}
function same(a, b, dist) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === dist;
}

export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 500; attempt++) {
    const paths = cut(level.n, rng, level.minPaths, level.maxPaths);
    if (!paths) continue;
    return {
      n: level.n,
      pairs: paths.map((p, i) => ({ color: COLORS[i % COLORS.length], a: p[0], b: p[p.length - 1] })),
      solution: paths,
      seed,
    };
  }
  throw new Error('no puzzle');
}

/** paths: array (per pair) of cell lists the player drew. Solved = each connects its pair, no overlaps, grid full. */
export function isSolved(n, pairs, paths) {
  const seen = new Set();
  for (let i = 0; i < pairs.length; i++) {
    const p = paths[i] || [];
    if (p.length < 2) return false;
    const [a, b] = [pairs[i].a, pairs[i].b];
    const first = p[0];
    const last = p[p.length - 1];
    const ok = (same(first, a, 0) && same(last, b, 0)) || (same(first, b, 0) && same(last, a, 0));
    if (!ok) return false;
    for (let k = 0; k < p.length; k++) {
      const key = `${p[k][0]},${p[k][1]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      if (k > 0 && !same(p[k - 1], p[k], 1)) return false;
    }
  }
  return seen.size === n * n;
}
