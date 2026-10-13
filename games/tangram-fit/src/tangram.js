// Tangram Fit: fill a silhouette exactly with a fixed set of block pieces. Puzzles are built by
// placing the pieces first, so the silhouette is always fillable.

export const PIECES = {
  I3: [[0, 0], [1, 0], [2, 0]],
  L3: [[0, 0], [0, 1], [1, 1]],
  I4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T4: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S4: [[1, 0], [2, 0], [0, 1], [1, 1]],
  L4: [[0, 0], [0, 1], [0, 2], [1, 2]],
  F5: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  P5: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
  U5: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  V5: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  W5: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
  X5: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  Y5: [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]],
  Z5: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
  L5: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
  T5: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
};
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
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export function normalize(cells) {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
export function rotate(cells) { return normalize(cells.map(([x, y]) => [-y, x])); }
export function flip(cells) { return normalize(cells.map(([x, y]) => [-x, y])); }
export function key(cells) { return normalize(cells).map((c) => c.join(',')).join(';'); }

/** All distinct orientations of a piece (rotations and flips). */
export function orientations(cells) {
  const seen = new Map();
  let c = normalize(cells);
  for (let f = 0; f < 2; f++) {
    for (let r = 0; r < 4; r++) {
      seen.set(key(c), c);
      c = rotate(c);
    }
    c = flip(c);
  }
  return [...seen.values()];
}

export const LEVELS = [
  { id: 'three', name: 'Three pieces', tip: 'Small shapes made of three and four blocks.', pieces: 3, pool: ['I3', 'L3', 'O4', 'T4', 'L4'] },
  { id: 'four', name: 'Four pieces', tip: 'Four-block pieces. Turn them over as well as around.', pieces: 4, pool: ['I4', 'O4', 'T4', 'S4', 'L4'] },
  { id: 'pento', name: 'Five pieces, five blocks each', tip: 'The classic pentominoes.', pieces: 5, pool: ['F5', 'P5', 'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5', 'L5', 'T5'] },
  { id: 'six', name: 'Six pieces', tip: 'A mix of sizes.', pieces: 6, pool: ['I3', 'L3', 'I4', 'T4', 'S4', 'L4', 'P5', 'U5', 'Y5', 'W5'] },
  { id: 'eight', name: 'Eight pieces', tip: 'Big silhouettes.', pieces: 8, pool: ['I4', 'O4', 'T4', 'S4', 'L4', 'F5', 'P5', 'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5', 'L5', 'T5'] },
];

/** Build a connected silhouette by placing the pieces one by one, each touching what is there. */
export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const W = 10;
  const H = 10;
  for (let attempt = 0; attempt < 200; attempt++) {
    const occupied = new Map(); // "x,y" -> piece index
    const placed = [];
    const names = [];
    const pool = [...level.pool];
    for (let i = 0; i < level.pieces; i++) names.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] || pick(rng, level.pool));
    let ok = true;
    for (let i = 0; i < names.length; i++) {
      const ors = orientations(PIECES[names[i]]);
      const o = pick(rng, ors);
      const candidates = [];
      if (i === 0) candidates.push([4, 4]);
      else {
        for (const k of occupied.keys()) {
          const [x, y] = k.split(',').map(Number);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            for (const [cx, cy] of o) candidates.push([x + dx - cx, y + dy - cy]);
          }
        }
      }
      // Shuffle candidates and take the first that fits inside the box without overlap.
      for (let j = candidates.length - 1; j > 0; j--) { const t = Math.floor(rng() * (j + 1)); [candidates[j], candidates[t]] = [candidates[t], candidates[j]]; }
      let done = false;
      for (const [ox, oy] of candidates) {
        const cells = o.map(([x, y]) => [x + ox, y + oy]);
        if (cells.every(([x, y]) => x >= 0 && y >= 0 && x < W && y < H && !occupied.has(`${x},${y}`))) {
          for (const [x, y] of cells) occupied.set(`${x},${y}`, i);
          placed.push(cells);
          done = true;
          break;
        }
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    // Crop to the bounding box.
    const all = placed.flat();
    const mx = Math.min(...all.map((c) => c[0]));
    const my = Math.min(...all.map((c) => c[1]));
    const w = Math.max(...all.map((c) => c[0])) - mx + 1;
    const h = Math.max(...all.map((c) => c[1])) - my + 1;
    const solution = placed.map((cells) => cells.map(([x, y]) => [x - mx, y - my]));
    const silhouette = new Set(solution.flat().map((c) => c.join(',')));
    return {
      w, h, silhouette,
      pieces: names.map((n, i) => ({ id: i, name: n, cells: normalize(PIECES[n]), color: COLORS[i % COLORS.length] })),
      solution,
      seed,
    };
  }
  throw new Error('no puzzle');
}

/** Can these absolute cells go on the board? */
export function fits(puzzle, placedCells, cells) {
  return cells.every(([x, y]) => puzzle.silhouette.has(`${x},${y}`) && !placedCells.has(`${x},${y}`));
}

/** Find a placement of `shape` (an orientation) that covers the tapped cell, if any. */
export function placementCovering(puzzle, placedCells, shape, tx, ty) {
  for (const [cx, cy] of shape) {
    const cells = shape.map(([x, y]) => [x - cx + tx, y - cy + ty]);
    if (fits(puzzle, placedCells, cells)) return cells;
  }
  return null;
}
