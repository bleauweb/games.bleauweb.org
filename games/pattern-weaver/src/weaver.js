// Pattern Weaver: a sandbox. Painting with mirrors, repeats and colour cycles. Pure helpers.

export const PALETTE = ['#e05a5a', '#e8a33d', '#e6d84a', '#4cc25e', '#2dd4bf', '#4f8fff', '#b26ee6', '#f472b6', '#e9eefb', '#2b2a33'];

export const MIRRORS = {
  none: { name: 'No mirror' },
  v: { name: 'Mirror ↔' },
  h: { name: 'Mirror ↕' },
  four: { name: 'Four-way' },
  rot4: { name: 'Turn ×4' },
  eight: { name: 'Kaleidoscope' },
};

export function orbit(mode, n, x, y) {
  const m = n - 1;
  const pts = new Set();
  const add = (a, b) => pts.add(`${a},${b}`);
  add(x, y);
  if (mode === 'v' || mode === 'four' || mode === 'eight') add(m - x, y);
  if (mode === 'h' || mode === 'four' || mode === 'eight') add(x, m - y);
  if (mode === 'four' || mode === 'eight') add(m - x, m - y);
  if (mode === 'rot4') { add(m - y, x); add(m - x, m - y); add(y, m - x); }
  if (mode === 'eight') { add(y, x); add(m - y, x); add(y, m - x); add(m - y, m - x); }
  return [...pts].map((s) => s.split(',').map(Number));
}

/** Paint (x, y) and all its images; with a repeat tile, every repeat too. Returns changed cells. */
export function paint(grid, { x, y, color, mirror = 'none', tile = 0 }) {
  const n = grid.length;
  const changed = [];
  const targets = tile > 0 ? repeats(n, tile, x, y) : [[x, y]];
  for (const [tx, ty] of targets) {
    for (const [a, b] of orbit(mirror, n, tx, ty)) {
      if (grid[b][a] !== color) { grid[b][a] = color; changed.push([a, b]); }
    }
  }
  return changed;
}

/** With a tile of size t, (x, y) repeats every t cells. */
export function repeats(n, t, x, y) {
  const out = [];
  const bx = x % t;
  const by = y % t;
  for (let yy = by; yy < n; yy += t) for (let xx = bx; xx < n; xx += t) out.push([xx, yy]);
  return out;
}

/** Flood fill from (x, y) over same-coloured 4-connected cells. */
export function fill(grid, x, y, color) {
  const n = grid.length;
  const from = grid[y][x];
  if (from === color) return [];
  const stack = [[x, y]];
  const changed = [];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (a < 0 || b < 0 || a >= n || b >= n || grid[b][a] !== from) continue;
    grid[b][a] = color;
    changed.push([a, b]);
    stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
  return changed;
}

/** Shift every painted colour one step along the palette. */
export function cycle(grid, paletteSize) {
  for (const row of grid) for (let i = 0; i < row.length; i++) if (row[i] !== null) row[i] = (row[i] + 1) % paletteSize;
  return grid;
}

export function blank(n) {
  return Array.from({ length: n }, () => new Array(n).fill(null));
}

/** A seed pattern to start from: random cells painted with a kaleidoscope. */
export function seedPattern(n, rng = Math.random) {
  const g = blank(n);
  const count = Math.round(n * n * 0.12);
  for (let i = 0; i < count; i++) paint(g, { x: Math.floor(rng() * n), y: Math.floor(rng() * n), color: Math.floor(rng() * 8), mirror: 'eight' });
  return g;
}
