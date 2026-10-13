// Slide Picture: the sliding-tile puzzle. Scrambled by legal moves, so it is always solvable.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';

export const LEVELS = [
  { id: 'three', name: '3 × 3', tip: 'Eight tiles. Get the top row right first.', n: 3, shuffle: 40 },
  { id: 'four', name: '4 × 4', tip: 'The classic fifteen.', n: 4, shuffle: 120 },
  { id: 'five', name: '5 × 5', tip: 'Twenty-four tiles. Row by row, then column by column.', n: 5, shuffle: 250 },
];

/** tiles[i] = which tile sits at position i (0 = blank). Solved when tiles[i] === i + 1, blank last. */
export function solvedTiles(n) {
  const t = Array.from({ length: n * n }, (_, i) => i + 1);
  t[n * n - 1] = 0;
  return t;
}

export function blankIndex(tiles) { return tiles.indexOf(0); }

export function neighbours(n, i) {
  const x = i % n;
  const y = Math.floor(i / n);
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  return out;
}

/** Slide the tile at i into the blank if adjacent (or a whole row/column segment toward the blank). */
export function move(state, i) {
  const { n, tiles } = state;
  const b = blankIndex(tiles);
  if (i === b) return false;
  const sameRow = Math.floor(i / n) === Math.floor(b / n);
  const sameCol = i % n === b % n;
  if (!sameRow && !sameCol) return false;
  const step = sameRow ? (i < b ? 1 : -1) : (i < b ? n : -n);
  // Shift every tile between i and the blank one step toward the blank.
  let pos = b;
  while (pos !== i) {
    tiles[pos] = tiles[pos - step];
    pos -= step;
  }
  tiles[i] = 0;
  state.moves++;
  return true;
}

export function isSolved(state) {
  const goal = solvedTiles(state.n);
  return state.tiles.every((t, i) => t === goal[i]);
}

export function scramble(n, shuffle, seed) {
  const rng = mulberry32(seed);
  const state = { n, tiles: solvedTiles(n), moves: 0 };
  let last = -1;
  for (let k = 0; k < shuffle; k++) {
    const b = blankIndex(state.tiles);
    const opts = neighbours(n, b).filter((i) => i !== last);
    const i = opts[Math.floor(rng() * opts.length)];
    last = b;
    move(state, i);
  }
  state.moves = 0;
  if (isSolved(state)) return scramble(n, shuffle, seed + 1);
  return state;
}

/** Parity check used by the tests: is this arrangement solvable at all? */
export function solvable(n, tiles) {
  let inv = 0;
  const arr = tiles.filter((t) => t !== 0);
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = n - Math.floor(blankIndex(tiles) / n);
  return (inv + blankRowFromBottom) % 2 === 1;
}

/** A procedural picture: gradient plus a few shapes, as an SVG data URL. Deterministic per seed. */
export function pictureSvg(seed) {
  const rng = mulberry32(seed);
  const hue = Math.floor(rng() * 360);
  const hue2 = (hue + 60 + Math.floor(rng() * 120)) % 360;
  const shapes = [];
  for (let i = 0; i < 4; i++) {
    const cx = 40 + rng() * 220;
    const cy = 40 + rng() * 220;
    const r = 20 + rng() * 50;
    const h = (hue + 180 + i * 40) % 360;
    shapes.push(i % 2 ? `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="hsl(${h} 70% 60%)" opacity="0.9"/>` : `<rect x="${(cx - r).toFixed(0)}" y="${(cy - r).toFixed(0)}" width="${(2 * r).toFixed(0)}" height="${(2 * r).toFixed(0)}" rx="${(r / 4).toFixed(0)}" fill="hsl(${h} 70% 60%)" opacity="0.9" transform="rotate(${(rng() * 60 - 30).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 45%)"/><stop offset="1" stop-color="hsl(${hue2} 60% 55%)"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/>${shapes.join('')}<path d="M0 230 Q 75 200 150 230 T 300 230 V300 H0 Z" fill="hsl(${hue2} 50% 35%)" opacity="0.6"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
