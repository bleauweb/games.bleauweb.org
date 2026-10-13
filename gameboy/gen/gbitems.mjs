// Game Boy item attributes: colour becomes fill. Shared by the three "shape" games.
export const SHAPES = ['circle', 'square', 'triangle', 'star', 'hexagon'];
export const FILLS = ['solid', 'outline', 'striped'];
export const SIZES = ['small', 'large'];
export const COUNTS = [1, 2, 3];
export const code = (it) => SHAPES.indexOf(it.shape) | (FILLS.indexOf(it.fill) << 3) | (SIZES.indexOf(it.size) << 5) | (((it.count || 1) - 1) << 6);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export function shuffle(rng, arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function mulberry32(seed) { let a = seed >>> 0; return function next() { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
