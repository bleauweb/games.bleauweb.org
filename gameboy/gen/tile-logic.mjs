import { LEVELS, makePuzzle } from '../../games/tile-logic/src/nonogram.js';
import { emit, pack, rowMask } from './emit.mjs';
// The Game Boy keeps the 5, 8 and two 10 x 10 picture levels; 12 x 12 does not fit beside its clues.
const USE = LEVELS.filter((l) => l.size <= 10);
const PER = 8, STRIDE = 1 + 2 * 10;
const puzzles = [], json = [];
USE.forEach((level, li) => {
  let seed = 7000 + li * 100;
  const seen = new Set();
  for (let i = 0; i < PER; i++) {
    let p;
    for (;;) { try { p = makePuzzle(level, seed++); } catch { continue; } const k = p.solution.map((r) => r.join('')).join('/'); if (!seen.has(k)) { seen.add(k); break; } }
    const bytes = [p.size];
    for (let y = 0; y < p.size; y++) bytes.push(...rowMask(p.solution[y]));
    puzzles.push(bytes); json.push({ level: li, n: p.size, solution: p.solution, rows: p.rows, cols: p.cols, name: p.name });
  }
});
emit('tile-logic', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: USE.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, json });
